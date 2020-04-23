import { EventEmitter } from 'events';
import * as Api from 'types/api';
import { BaseUser, BaseGroup, BaseProfile } from 'types/shared';
import { Conversation } from 'types/conversation';
import { version } from '../../package.json';
import vkapi from './vkapi';
import store from './store';
import { usersStorage } from './store/Storage';
import copyObject from './copyObject';

// --- Переменные

const deviceInfo = '(1; 1; 1; 1; 1; 1)';
export const VKDesktopUserAgent = `VKDesktop/${version} ${deviceInfo}`;
export const AndroidUserAgent = `VKAndroidApp/5.56.1-4841 ${deviceInfo}`;

export const fields =
  'photo_50,photo_100,verified,sex,status,first_name_acc,last_name_acc,online,last_seen,online_info,domain';

export const eventBus = new EventEmitter();

// --- Основные утилиты

export function timer(time: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, time));
}

export function escape(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function unescape(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export function isObject(obj: unknown) {
  return obj && !Array.isArray(obj) && typeof obj === 'object';
}

// --- Функции-обертки

// Вызывает переданную функцию через delay мс после последнего вызова
export function debounce(fn: Function, delay: number) {
  let timerId: NodeJS.Timeout;

  return function(...args: any[]) {
    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, delay);
  };
}

// Вызывает переданную функцию, если после последнего вызова прошло более delay мс
// А это значит, что функция может вообще не вызваться, что не всегда нужно
export function throttle(fn: Function, delay: number) {
  let lastCall = 0;

  return function(...args: any[]) {
    const now = Date.now();

    if (now - lastCall < delay) {
      return;
    }

    lastCall = now;
    fn.apply(this, args);
  };
}

// Выполняет асинхронную функцию только когда прошлая функция уже была выполнена
interface QueueItem {
  args: any[]
  context: unknown
  resolve: Function
}

export function createQueueManager<ReturnType>(fn: (...args: any[]) => Promise<ReturnType>) {
  const queue: QueueItem[] = [];
  let isExecuting = false;

  async function executeQueue() {
    const { args, resolve, context } = queue.shift();

    resolve(await fn.apply(context, args));

    if (queue.length) {
      executeQueue();
    } else {
      isExecuting = false;
    }
  }

  return function(...args: any[]) {
    return new Promise<ReturnType>((resolve) => {
      queue.push({ args, resolve, context: this });

      if (queue.length === 1 && !isExecuting) {
        isExecuting = true;
        executeQueue();
      }
    });
  };
}

// Создает парсер текста, который делит текст на блоки с помощью регулярки.
// parseText вызывается если кусок текста не входит в регулярку
// parseText(value (кусок текста), ...args (параметры, переданные в экземпляр парсера)) {}
// parseElement вызывается если кусок текста уже входит в регулярку
// parseElement(value, match (вывод регулярки), ...args) {}
// Эти функции обязательны и должны вернуть массив, который затем добавится к ответу
// Пример:
// const parser = createParser({
//   regexp: /element/g,
//   parseText: (value, customType) => [{ type: 'text', value }],
//   parseElement: (value, match, customType) => [{ type: customType, value }]
// });
// const result = parser('text element', 'myType');
// result = [{ type: 'text', value: 'text ' }, { type: 'myType', value: 'element' }];
interface CreateParserParams {
  regexp: RegExp
  parseText(text: string, ...args: any[]): any[]
  parseElement(element: string, match: RegExpExecArray | null, ...args: any[]): any[]
}

export function createParser<TextType, ElementType>(
  { regexp, parseText, parseElement }: CreateParserParams
) {
  return function(text: string, ...args: any[]) {
    const blocks: (TextType | ElementType)[] = [];
    let match: RegExpExecArray | null;
    let offset = 0;

    while ((match = regexp.exec(text))) {
      const len = match[0].length;

      if (offset !== match.index) {
        blocks.push(...parseText(text.slice(offset, match.index), ...args));
      }

      offset = match.index + len;

      blocks.push(...parseElement(text.slice(match.index, offset), match, ...args));
    }

    if (offset !== text.length) {
      blocks.push(...parseText(text.slice(offset, text.length), ...args));
    }

    return blocks;
  };
}

// --- Остальные вспомогательные функции

// 125 -> 125
// 12.732 -> 12K
// 5.324.267 -> 5M
export function convertCount(count: number) {
  if (count >= 1e6) {
    return Math.floor(count / 1e6) + 'M';
  } else if (count >= 1e3) {
    return Math.floor(count / 1e3) + 'K';
  }

  return count;
}

export function getPhoto(user: BaseProfile | Conversation['chat_settings']['photo'] | void): string | void {
  return user && (devicePixelRatio > 1 ? user.photo_100 : user.photo_50);
}

// Собирает массивы профилей и групп в единый массив, где у групп отрицательный id
export function concatProfiles(profiles: BaseUser[] | void, groups: BaseGroup[] | void): (BaseUser | BaseGroup)[] {
  profiles = profiles || [];
  groups = groups || [];

  return profiles.concat(
    groups.reduce((list, group) => {
      group.id = -group.id;
      list.push(group);
      return list;
    }, [])
  );
}

// Возвращает функцию, которая вызывает колбэк, если юзер долистал
// список до конца (или в начало), чтобы загрузить новую часть списка
export function endScroll(callback: (result: { isUp: boolean, isDown: boolean }) => void, reverse?: boolean | -1) {
  return function({ scrollTop, scrollHeight, offsetHeight }: HTMLDivElement) {
    // Если блок пустой либо видимая область блока = 0px.
    // Обычно возникает когда у блока стоит display: none или он скрыт другим способом.
    if (!scrollHeight || !offsetHeight) {
      return;
    }

    const isScrolledUp = scrollTop <= 100;
    const isScrolledDown = scrollTop + offsetHeight + 100 >= scrollHeight;

    // reverse = false: проверять скролл вниз
    // reverse = true: проверять скролл вверх
    // reverse = -1: проверять все сразу
    const isScrolled = reverse
      ? (reverse === -1 ? (isScrolledUp || isScrolledDown) : isScrolledUp)
      : isScrolledDown;

    if (isScrolled) {
      callback.call(this, {
        isUp: isScrolledUp,
        isDown: isScrolledDown
      });
    }
  };
}

export function onTransitionEnd(el: HTMLElement, anyTarget?: boolean) {
  return new Promise<void>((resolve) => {
    function onTransitionEndListener(event: TransitionEvent) {
      if (!anyTarget && event.target !== el) {
        return;
      }

      el.removeEventListener('transitionend', onTransitionEndListener);
      resolve();
    }

    el.addEventListener('transitionend', onTransitionEndListener);
  });
}

export function logout() {
  const { activeUser } = store.state.users;
  const usersData = copyObject<typeof usersStorage.data>(usersStorage.data);

  usersData.activeUser = null;
  delete usersData.users[activeUser];

  usersStorage.update(usersData);

  window.location.reload();
}

const loadingProfiles: number[] = [];
let isLoadingProfiles = false;

export async function loadProfile(id?: number) {
  if (loadingProfiles.includes(id)) {
    return;
  } else if (id) {
    loadingProfiles.push(id);
  }

  if (isLoadingProfiles) {
    return;
  }

  isLoadingProfiles = true;

  const profiles = loadingProfiles.slice();
  const newProfiles = await vkapi<Api.execute.getProfiles>('execute.getProfiles', {
    profile_ids: profiles.join(','),
    func_v: 2,
    fields
  });

  store.commit('addProfiles', newProfiles);

  loadingProfiles.splice(0, profiles.length);
  isLoadingProfiles = false;

  if (loadingProfiles.length) {
    loadProfile();
  }
}

export function getAppName(app_id: number) {
  switch (app_id) {
    case 2274003:
      return 'Android';
    case 3140623:
    case 3087106:
      return 'iPhone';
    case 3682744:
      return 'iPad';
    case 6146827:
    case 6482950:
    case 6481715:
      return 'VK Me';
    case 3502561:
    case 3502557:
      return 'Windows Phone';
    case 5027722:
      return 'VK Messenger';
    case 6121396:
      return 'VK Admin';
    case 2685278:
      return 'Kate Mobile';
    case 6717234:
      return 'VK Desktop';
    case 6614620:
      return 'Laney';
    case 5632485:
      return 'SpaceVK';
    case 6328039:
    case 6328868:
    case 6820516:
      return 'VK mp3 mod';
  }
}

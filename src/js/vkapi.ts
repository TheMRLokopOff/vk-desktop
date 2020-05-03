import querystring from 'querystring';
import electron from 'electron';
import { Account } from 'types/shared';
import { VKDesktopUserAgent, AndroidUserAgent } from './utils';
import request from './request';
import store from './store';
import { openModal } from './modals';

export const version = '5.124';

interface ErrorHandlerArgs {
  name: string
  params: Params
  data: VkapiRequestResult<unknown>
  user: Account
  resolve: Function
  reject: Function
}

type ErrorHandler = (context: ErrorHandlerArgs) => void;

const errorHandlers: Record<string, ErrorHandler> = {};

function addErrorHandler(code: number, fn: ErrorHandler) {
  errorHandlers[code] = fn;
}

// Сессия устарела
addErrorHandler(5, ({ params, data, user, reject }) => {
  // Был передан другой токен
  if (!user || ![user.access_token, user.android_token].includes(params.access_token)) {
    return reject(data.error);
  }

  // По умолчанию: закончилось время действия токена
  // или была принудительно завершена сессия
  let id = 0;

  switch (data.error.error_msg.slice(27)) {
    // Страница удалена
    case 'user is deactivated.':
      id = 1;
      break;

    // Страница заблокирована
    case 'invalid access_token (2).':
      id = 2;
      break;
  }

  openModal('blocked-account', { id });
});

// Много запросов в секунду
addErrorHandler(6, ({ reject }) => {
  setTimeout(reject, 1000);
});

// Flood control
addErrorHandler(9, ({ reject }) => {
  setTimeout(reject, 1000);
});

// Internal Server Error
addErrorHandler(10, ({ name, data, reject }) => {
  openModal('error-api', {
    method: name,
    error: data.error,
    retry: reject
  });
});

// Капча
addErrorHandler(14, ({ name, params, data, resolve, reject }) => {
  openModal('captcha', {
    src: data.error.captcha_img,
    send(code: string) {
      if (name === 'captcha.force') {
        return resolve(1);
      }

      params.captcha_sid = data.error.captcha_sid;
      params.captcha_key = code;

      reject();
    }
  });
});

addErrorHandler(17, async ({ data, resolve, reject }) => {
  const { data: redirectPage } = await request<string>(data.error.redirect_uri, { raw: true });
  const goCaptchaLinkMatch = /<div class="fi_row"><a href="(.+?)" rel="noopener">/.exec(redirectPage);

  // Это не ошибка подтверждения аккаунта, а запланированное действие, доступное только по данной ссылке
  if (!goCaptchaLinkMatch) {
    // Когда будет нужно можно будет переделать это в модальное окно электрона
    // и реализовать ожидание выхода из него, чтобы продолжить уже в клиенте.
    electron.shell.openItem(data.error.redirect_uri);

    return resolve({
      type: 'redirect',
      link: data.error.redirect_uri
    });
  }

  const goCaptchaLink = 'https://m.vk.com' + goCaptchaLinkMatch[1];
  const { data: firstCaptchaPage } = await request<string>(goCaptchaLink, { raw: true });
  let success = false;
  let captchaPage = firstCaptchaPage;

  while (!success) {
    const sendUrl = /<form action="(.+?)" method="post">/.exec(captchaPage)[1];
    const captchaSid = /name="captcha_sid" value="(.+?)">/.exec(captchaPage)[1];

    await new Promise((resume) => {
      openModal('captcha', {
        src: `https://m.vk.com/captcha.php?sid=${captchaSid}`,
        async send(code: string) {
          const res = await request<string>({
            host: 'm.vk.com',
            path: sendUrl,
            method: 'POST'
          }, {
            raw: true,
            postData: querystring.stringify({
              captcha_sid: captchaSid,
              captcha_key: code
            })
          });

          if (res.statusCode === 302) {
            success = true;
            // Повторяем вызов метода
            reject();
          } else {
            captchaPage = res.data;
          }

          resume();
        }
      });
    });
  }
});

type Params = Record<string, any>;
type Platform = { android?: boolean, vkme?: boolean };

interface VkapiRequestResult<MethodResult> {
  response: MethodResult
  error: {
    error_code: number
    error_msg: string
    request_params?: { key: string, value: string }[]

    // Error 14, captcha
    captcha_sid?: string
    captcha_img?: string

    // Error 17, (phone) validation required
    redirect_uri?: string
  }
}

function vkapi<MethodResult>(name: string, params: Params, platform: Platform = {}) {
  return new Promise<MethodResult>(async (resolve, reject) => {
    const user = store.getters['users/user'];

    params = {
      access_token: user && (platform.android ? user.android_token : user.access_token),
      lang: 'ru',
      v: version,
      ...params
    };

    const { data } = await request<VkapiRequestResult<MethodResult>>({
      host: platform.vkme ? 'api.vk.me' : 'api.vk.com',
      path: `/method/${name}`,
      method: 'POST',
      headers: {
        'User-Agent': platform.android ? AndroidUserAgent : VKDesktopUserAgent
      }
    }, {
      postData: querystring.stringify(params)
    });

    if (data.response !== undefined) {
      return resolve(data.response);
    }

    const errorHandler = errorHandlers[data.error.error_code];

    if (errorHandler) {
      errorHandler({ name, params, data, user, resolve, reject });
    } else {
      reject(data.error);
    }
  });
}

interface Method {
  execute<MethodResult>(): Promise<MethodResult>
  resolve: Function
  reject: Function
}

const methods: Method[] = [];
let inWork = false;

async function executeMethod() {
  const [{ execute, resolve, reject }] = methods;
  let shift = true;

  try {
    resolve(await execute());
  } catch (err) {
    if (err) {
      reject(err);
    } else {
      // Если вызвать reject без параметров, то этот метод не будет
      // удален из очереди и вызов метода повторится
      shift = false;
    }
  }

  if (shift) {
    methods.shift();
  }

  if (methods.length) {
    executeMethod();
  } else {
    inWork = false;
  }
}

export default function<MethodResult>(name: string, params: Params, platform: Platform = {}) {
  return new Promise<MethodResult>((resolve, reject) => {
    methods.push({
      execute: <MethodResult>() => vkapi<MethodResult>(name, params, platform),
      resolve,
      reject
    });

    if (!inWork) {
      inWork = true;
      executeMethod();
    }
  });
}

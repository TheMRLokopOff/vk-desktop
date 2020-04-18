import querystring from 'querystring';
import { VKDesktopUserAgent, AndroidUserAgent } from './utils';
import request from './request';
import store from './store';
import { openModal } from './modals';

export const version = '5.123';

type ErrorHandler = (context: { [key: string]: any }) => void;

const errorHandlers: { [key: string]: ErrorHandler } = {};

function addErrorHandler(codes: number[], fn: ErrorHandler) {
  for (const code of codes) {
    errorHandlers[code] = fn;
  }
}

// Сессия устарела
addErrorHandler([5], ({ params, data, user, reject }) => {
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

// Много запросов в секунду / Flood control
addErrorHandler([6, 9], ({ reject }) => {
  setTimeout(reject, 1000);
});

// Internal Server Error
addErrorHandler([10], ({ name, data, reject }) => {
  openModal('error-api', {
    method: name,
    error: data.error,
    retry: reject
  });
});

// Капча
addErrorHandler([14], ({ name, params, data, resolve, reject }) => {
  openModal('captcha', {
    src: data.error.captcha_img,
    send(code) {
      if (name === 'captcha.force') {
        return resolve(1);
      }

      params.captcha_sid = data.error.captcha_sid;
      params.captcha_key = code;

      reject();
    }
  });
});

addErrorHandler([17], async ({ data, reject }) => {
  const { data: redirectPage } = await request<string>(data.error.redirect_uri, { raw: true });
  const goCaptchaLink = 'https://m.vk.com' + redirectPage.match(
    /<div class="fi_row"><a href="(.+?)" rel="noopener">/
  )[1];
  const { data: firstCaptchaPage } = await request<string>(goCaptchaLink, { raw: true });
  let success = false;
  let captchaPage = firstCaptchaPage;

  while (!success) {
    const sendUrl = captchaPage.match(/<form action="(.+?)" method="post">/)[1];
    const captchaSid = captchaPage.match(/name="captcha_sid" value="(.+?)">/)[1];

    await new Promise((resume) => {
      openModal('captcha', {
        src: `https://m.vk.com/captcha.php?sid=${captchaSid}`,
        async send(code) {
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

type Name = string;
type Params = { [key: string]: any };
type Platform = { android?: boolean, vkme?: boolean };

interface VkapiRequestResult<MethodType> {
  response: MethodType
  error: any
}

function vkapi<MethodType>(name: Name, params: Params, platform: Platform = {}) {
  return new Promise<MethodType>(async (resolve, reject) => {
    const user = store.getters['users/user'];

    params = {
      access_token: user && (platform.android ? user.android_token : user.access_token),
      lang: 'ru',
      v: version,
      ...params
    };

    const { data } = await request<VkapiRequestResult<MethodType>>({
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
  execute<MethodType>(): Promise<MethodType>
  resolve(response: any): void
  reject(error: any): void
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

export default function<MethodType>(name: Name, params: Params, platform: Platform = {}) {
  return new Promise<MethodType>((resolve, reject) => {
    methods.push({
      execute: <MethodType>() => vkapi<MethodType>(name, params, platform),
      resolve,
      reject
    });

    if (!inWork) {
      inWork = true;
      executeMethod();
    }
  });
}

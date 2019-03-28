import { DesktopUserAgent } from './user-agent';
import querystring from 'querystring';
import request from './request';
import store from './store/';

export const version = '5.92';

function vkapi(name, params = {}) {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    const user = store.getters['users/user'];

    params = Object.assign({
      access_token: user ? user.access_token : null,
      lang: 'ru',
      v: version
    }, params);

    let { data } = await request({
      host: 'api.vk.com',
      path: `/method/${name}`,
      method: 'POST',
      headers: { 'User-Agent': DesktopUserAgent }
    }, querystring.stringify(params));

    console.log(`[API] ${name} ${Date.now() - startTime}ms`);

    if(data.response !== undefined) resolve(data.response);
    else reject(data);
  });
}

let methods = [],
    inWork = false;

async function executeMethod() {
  let { data, resolve, reject } = methods[0];
  inWork = true;

  try {
    resolve(await vkapi(...data));
  } catch(err) {
    console.warn('[VKAPI] error', err);
    reject(err);
  }

  methods.shift();
  if(methods.length) executeMethod();
  else inWork = false;
}

export default function(...data) {
  return new Promise((resolve, reject) => {
    methods.push({ data, resolve, reject });
    if(methods.length == 1 && !inWork) executeMethod();
  });
}

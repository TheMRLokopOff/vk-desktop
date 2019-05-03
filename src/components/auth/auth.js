import { AndroidUserAgent, DesktopUserAgent } from 'js/user-agent';
import vkapi, { version } from 'js/vkapi';
import querystring from 'querystring';
import request from 'js/request';
import { EventBus } from 'js/utils';

export function getAndroidToken(login, password, params = {}) {
  return new Promise(async (resolve) => {
    const { data } = await request({
      host: 'oauth.vk.com',
      path: '/token?' + querystring.stringify({
        scope: 'all',
        client_id: 2274003,
        client_secret: 'hHbZxrka2uZ6jB1inYsH',
        username: login,
        password: password,
        '2fa_supported': 1,
        grant_type: 'password',
        lang: 'ru',
        v: version,
        ...params
      }),
      headers: { 'User-Agent': AndroidUserAgent }
    });

    if(data.ban_info) {
      // let { member_name, message } = data.ban_info;
      //
      // app.$toast(`${member_name}, ${message}`);
      resolve({ error: 'invalid_client' });
    } else if(data.error == 'need_captcha') {
      EventBus.emit('modal:open', 'captcha', {
        src: data.captcha_img,
        send(code) {
          getAndroidToken(login, password, Object.assign(params, {
            captcha_sid: data.captcha_sid,
            captcha_key: code
          })).then(resolve);
        }
      });
    } else resolve(data);
  });
}

export async function getDesktopToken(androidToken) {
  const reqParams = {
    host: 'oauth.vk.com',
    path: '/authorize?' + querystring.stringify({
      redirect_uri: 'https://oauth.vk.com/blank.html',
      display: 'page',
      response_type: 'token',
      access_token: androidToken,
      revoke: 1,
      lang: 'ru',
      scope: 136297695,
      client_id: 6717234,
      v: version,
      sdk_package: 'ru.danyadev.vkdesktop',
      sdk_fingerprint: '9E76F3AF885CD6A1E2378197D4E7DF1B2C17E46C'
    }),
    headers: { 'User-Agent': DesktopUserAgent }
  };

  const { data } = await request(reqParams);
  const link = 'https://oauth.vk.com' + data.match(/\/auth_by_token?.+=\w+/)[0];
  const { headers } = await request(link);

  return headers.location.match(/#access_token=([A-z0-9]{85})/)[1];
}
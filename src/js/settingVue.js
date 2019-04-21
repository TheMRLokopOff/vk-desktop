import Vue from 'vue';
import emoji from './emoji';
import { regexp, EventBus } from './utils';
import getTranslate from './getTranslate';
import { version } from 'package-json';
import store from './store/';
import * as Sentry from '@sentry/electron';

Sentry.init({
  release: `VK Desktop ${version}`,
  dsn: 'https://158852fabff14fe185220d8105412aed@sentry.io/1395595',
  sendDefaultPii: true
});

Vue.config.errorHandler = function(stack, vm, type) {
  const { activeUser } = store.state.users;

  Sentry.captureException({
    vkd: version,
    vue: Vue.version,
    id: activeUser,
    stack: stack.stack || stack,
    type,
    tag: vm.$vnode.tag.split('-')[3] || vm.$vnode.tag
  });
}

Vue.config.productionTip = false;

Vue.directive('emoji', (el, { value = '', modifiers }) => {
  if(!modifiers.br) value = value.replace(/<br>/g, ' ');
  if(modifiers.push) value = value.replace(regexp.push, '$3');
  if(el.innerHTML != value) el.innerHTML = emoji(value);
});

Vue.prototype.l = getTranslate;

Vue.prototype.$modal = {
  open(name, params) {
    EventBus.emit('modal:open', name, params);
  },
  close(name) {
    EventBus.emit('modal:close', name);
  }
}

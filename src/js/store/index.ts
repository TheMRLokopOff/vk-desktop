// @ts-ignore
import { createStore, MutationPayload } from 'vuex';
import { settingsStorage, usersStorage } from './Storage';

import rootModule from './modules/index';
import messages from './modules/messages';
import settings from './modules/settings';
import users from './modules/users';

const store: any = createStore({
  ...rootModule,
  modules: {
    messages,
    settings,
    users
  }
});

store.subscribe(({ type }: MutationPayload, state: any) => {
  if (/^settings\//.test(type)) {
    settingsStorage.update(state.settings);
  } else if (/^users\//.test(type)) {
    usersStorage.update(state.users);
  }
});

export default store;

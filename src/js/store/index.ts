import { createStore, MutationPayload } from 'vuex';
import { State } from './State';
import { settingsStorage, usersStorage } from './Storage';

import rootModule from './modules/index';
import messages from './modules/messages';
import settings from './modules/settings';
import users from './modules/users';

const store = createStore<State>({
  ...rootModule,
  modules: {
    messages,
    settings,
    users
  }
});

store.subscribe(({ type }: MutationPayload, state) => {
  if (type.startsWith('settings/')) {
    settingsStorage.update(state.settings);
  } else if (type.startsWith('users/')) {
    usersStorage.update(state.users);
  }
});

export default store;

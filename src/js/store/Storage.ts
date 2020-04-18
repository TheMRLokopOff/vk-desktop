import electron from 'electron';

const win = electron.remote.getCurrentWindow();

type obj = { [key: string]: any };

interface StorageOptions {
  name: string
  defaults: object
  beforeSave?(data: obj): void
}

class Storage {
  name: string;
  data: obj;

  constructor({ name, defaults, beforeSave }: StorageOptions) {
    const storageData = JSON.parse(localStorage.getItem(name) || '{}');

    this.name = name;
    this.data = {
      ...defaults,
      ...storageData
    };

    if (beforeSave) {
      beforeSave(this.data);
    }

    this.save();
  }

  update(data) {
    this.data = data;
    this.save();
  }

  save() {
    localStorage.setItem(this.name, JSON.stringify(this.data));
  }
}

export const defaultUserSettings = {
  hiddenPinnedMessages: {},
  pinnedPeers: [],
  typing: true,
  notRead: true,
  devShowPeerId: false
};

export const usersStorage = new Storage({
  name: 'users',

  defaults: {
    activeUser: null,
    trustedHashes: {},
    users: {}
  }
});

export const settingsStorage = new Storage({
  name: 'settings',

  defaults: {
    window: win.getBounds(),
    langName: 'ru',
    userSettings: {}
  },

  beforeSave({ userSettings }) {
    for (const id in usersStorage.data.users) {
      userSettings[id] = {
        ...defaultUserSettings,
        ...userSettings[id]
      };
    }
  }
});

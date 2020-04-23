import electron from 'electron';
import { Account } from 'types/shared';

const win = electron.remote.getCurrentWindow();

interface StorageOptions<DataType> {
  name: string
  defaults: DataType
  beforeSave?(data: DataType): void
}

class Storage<DataType> {
  name: string;
  data: DataType;

  constructor({ name, defaults, beforeSave }: StorageOptions<DataType>) {
    const storageData: Partial<DataType> = JSON.parse(localStorage.getItem(name) || '{}');

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

  update(data: DataType) {
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

interface UsersStorage {
  activeUser: number | null
  trustedHashes: Record<string, string>
  users: Record<number, Account>
}

export const usersStorage = new Storage<UsersStorage>({
  name: 'users',

  defaults: {
    activeUser: null,
    trustedHashes: {},
    users: {}
  }
});

interface SettingsStorage {
  window: Electron.Rectangle
  langName: 'ru'
  userSettings: {
    hiddenPinnedMessages: {}
    pinnedPeers: number[]
    typing: boolean
    notRead: boolean
    devShowPeerId: boolean
  }
}

export const settingsStorage = new Storage<SettingsStorage>({
  name: 'settings',

  defaults: {
    window: win.getBounds(),
    langName: 'ru',
    userSettings: defaultUserSettings
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

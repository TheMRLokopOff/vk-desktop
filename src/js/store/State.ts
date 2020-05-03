import { BaseProfile, BasePeer } from 'types/shared';
import { ParsedMessage } from 'types/message';
import { SettingsStorage, UsersStorage } from './Storage';

export interface State {
  isMenuOpened: boolean
  menuCounters: Record<string, number>
  profiles: Record<number, BaseProfile>

  messages: {
    peerIds: number[]
    isMessagesPeersLoaded: boolean
    conversations: Record<number, BasePeer>
    messages: Record<number, ParsedMessage[]>
    loadingMessages: {}

    typing: Record<
      number,
      Record<number, {
        type: 'text' | 'audio'
        time: 1 | 2 | 3 | 4 | 5
      }>
    >

    peersConfig: Record<number, {
      opened: boolean
      loading: boolean
    }>
  }

  settings: SettingsStorage
  users: UsersStorage
}

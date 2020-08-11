import { VKUser, VKGroup, VKConversation, VKMessage } from '..';
import { MessagesGetLongPollServer } from './messages';
import { AccountGetCounters, AccountGetPushSettings } from './account';

export interface ExecuteInit {
  user: VKUser
  counters: AccountGetCounters
  pinnedPeers: {
    peer: VKConversation
    msg: VKMessage
  }[]
  profiles: VKUser[]
  groups: VKGroup[]
  lp: MessagesGetLongPollServer
  temporarilyDisabledNotifications: AccountGetPushSettings['conversations']['items']
  firstConversations: {
    conversation: VKConversation
    /**
     * Не приходит, когда это фантомный чат и все сообщения уже исчезли
     */
    last_message?: VKMessage
  }[]
}

export interface ExecuteInitParams {
  lp_version: number
  fields?: string
}


export type ExecuteGetProfiles = (VKUser | VKGroup)[];

export interface ExecuteGetProfilesParams {
  profile_ids: number | string
  fields?: string
  func_v: 2
}

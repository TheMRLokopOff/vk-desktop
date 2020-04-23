import { BaseUser, BaseGroup } from '../shared';
import { Conversation } from '../conversation';
import { Message } from '../message';

export namespace messages {
  export interface getConversationsById {
    count: number
    items: Conversation[]
    profiles?: BaseUser[]
    groups?: BaseGroup[]
  }

  export interface getConversationMembers {
    count: number
    items: {
      member_id: number
      invited_by: number
      join_date: number
      // Является ли пользователь администратором беседы
      is_admin?: true
      // Является ли пользователь создателем беседы
      is_owner?: true
      // Можно ли исключить данного пользователя
      can_kick?: true
    }[]
    // Приходит только создателю беседы
    chat_restrictions?: {
      only_admins_invite: boolean
      only_admins_edit_pin: boolean
      only_admins_edit_info: boolean
      admins_promote_users: boolean
    }
    profiles?: BaseUser[]
    groups?: BaseGroup[]
  }

  export interface getById {
    count: number
    items: Message[]
  }

  export interface getLongPollServer {
    server: string
    key: string
    ts: number
    pts: number
  }

  export interface getLongPollHistory {
    // Здесь содержатся некоторые события из LongPoll,
    // но вся информация действительно является только числами:
    // [event_id, msg_id, flag, peer_id] или что-то похожее
    history: number[][]
    from_pts: number
    new_pts: number
    conversations: Conversation[]
    messages: {
      count: number
      items: Message[]
    }
    profiles?: BaseUser[]
    groups?: BaseGroup[]
    more?: true
  }
}

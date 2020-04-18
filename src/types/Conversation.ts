import { Message } from './message';

interface Keyboard {
  one_time: boolean
  author_id: number
  buttons: KeyboardButton[][]
}

interface KeyboardButton {
  color: 'default' | 'primary' | 'positive' | 'negative'

  action: {
    type: 'text' | 'location' | 'vkpay' | 'open_app' | 'open_link'
    app_id?: number
    hash?: string
    link?: string
    label?: string
    owner_id?: number
    payload: string
  }
}

interface ChatSettingsAcl {
  can_change_info: boolean
  can_change_invite_link: boolean
  can_change_pin: boolean
  can_copy_chat: boolean
  can_invite: boolean
  can_moderate: boolean
  can_promote_users: boolean
  can_see_invite_link: boolean
}

export interface Conversation {
  peer: {
    id: number
    type: 'user' | 'chat' | 'group' | 'email'
    local_id: number
  }

  last_message_id: number
  in_read: number
  out_read: number

  sort_id: {
    major_id: 0
    minor_id: number
  }

  unread_count?: number
  mentions?: number[]

  current_keyboard?: Keyboard

  push_settings?: {
    disabled_until?: number
    disabled_forever?: true
    no_sound?: true
  }

  can_write: {
    allowed: boolean
    reason?: number
  }

  chat_settings?: {
    owner_id: number
    title: string
    state: 'in' | 'left' | 'kicked'

    acl: ChatSettingsAcl
    members_count?: number
    pinned_message?: Message

    photo?: {
      photo_50: string
      photo_100: string
      photo_200: string
    }

    admin_ids?: number[]
    active_ids: number[]

    is_group_channel?: true

    is_disappearing?: true
    disappearing_chat_link?: string
    theme?: 'orange'
  }
}

export interface ParsedConversation {
  id: number
  channel: boolean
  members: number | null
  left: boolean
  muted: boolean
  unread: number
  photo: string | null
  title: string | null
  canWrite: boolean
  keyboard: Keyboard | null
  last_msg_id: number
  in_read: number
  out_read: number
  mentions: number[]
  pinnedMsg: Message | null
  chatSettings: Conversation['chat_settings'] | null
  owner_id: number | null
  admin_ids: number[] | null
  loaded: true
}

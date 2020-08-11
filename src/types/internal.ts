import {
  VKUser,
  VKKeyboard, VKInlineKeyboard,
  VKConversation, VKConversationAcl,
  VKMessageTemplate, VKMessageAction
} from '.';
import { VKAttachment } from './attachments';

export interface IAccount extends VKUser {
  access_token: string
  android_token: string
}

export interface IParsedMessage {
  id: number | null
  from: number
  out: boolean
  text: string
  date: number
  peer_id: number
  conversation_msg_id: number
  random_id: number
  action: VKMessageAction | null
  hasAttachment: boolean
  fwdCount: number
  fwdMessages: IParsedMessage[]
  attachments: Omit<VKAttachment, 'type'>
  hasReplyMsg: boolean
  replyMsg: IParsedMessage | null
  keyboard: VKInlineKeyboard | null
  template: VKMessageTemplate | null
  hidden: boolean
  editTime: number
  was_listened: boolean
  isContentDeleted: boolean
  expireTtl: number
  isExpired: boolean
  fromLongPoll: boolean
}

export interface IParsedConversation {
  id: number
  isChannel: boolean
  isCasperChat: boolean
  members: number | null
  left: boolean
  muted: boolean
  unread: number
  photo: string | null
  title: string | null
  isWriteAllowed: boolean
  keyboard: VKKeyboard | null
  last_msg_id: number
  in_read: number
  out_read: number
  mentions: number[]
  pinnedMsg: IParsedMessage | null
  acl: VKConversationAcl | null
  chatState: VKConversation['chat_settings']['state'] | null
  owner_id: number | null
  admin_ids: number[] | null
  loaded: true
}

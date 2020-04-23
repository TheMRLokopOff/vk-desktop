import { BaseImage, MessageKeyboard, KeyboardButton } from './shared';
import { MessageAttachments, Geo } from './attachments';

interface TemplateElements {
  title: string
  action: {
    type: 'open_photo'
  }
  description: string
  photo: BaseImage[]
  buttons: KeyboardButton[]
}

interface Template {
  type: 'carousel'
  elements: TemplateElements[]
}

// chat_id со всеми сервисными сообщениями для тестов: 541
export interface MessageAction {
  type:
    | 'chat_create' | 'chat_photo_update' | 'chat_photo_remove' | 'chat_title_update' | 'chat_pin_message'
    | 'chat_unpin_message' | 'chat_invite_user' | 'chat_invite_user_by_link' | 'chat_kick_user' | 'chat_screenshot'
  // chat_create, chat_title_update
  text?: string
  // chat_pin_message
  message?: string
  // chat_pin_message, chat_unpin_message, chat_invite_user, chat_kick_user, chat_screenshot
  member_id?: number
  // chat_pin_message, chat_unpin_message
  conversation_message_id?: number

  // Только для сообщения из LongPoll
  is_channel?: 1
}

export interface LongPollMessageAction {
  source_act?: MessageAction['type']
  // chat_create, chat_title_update
  source_text?: string
  // chat_title_update
  source_old_text?: string
  // chat_pin_message
  source_message?: string
  // chat_pin_message, chat_unpin_message, chat_invite_user, chat_kick_user, chat_screenshot
  source_mid?: string
  // chat_pin_message, chat_unpin_message
  source_chat_local_id?: string
  // chat_title_update, может быть что-нибудь еще
  source_is_channel?: '1'
}

export interface Message {
  id?: number
  from_id: number
  peer_id?: number
  out?: 0 | 1
  text: string
  date: number
  conversation_message_id: number
  random_id?: number
  geo?: Geo
  action?: MessageAction
  fwd_messages?: Message[]
  attachments: MessageAttachments[]
  reply_message?: Message
  keyboard?: MessageKeyboard
  template?: Template
  important?: boolean
  is_hidden?: boolean
  update_time?: number
  deleted?: boolean
  was_listened?: boolean
  ref?: string
  ref_source?: string
  // Число, обозначающее через сколько секунд после отправки сообщения оно исчезнет.
  // Приходит только в обычных беседах или лс
  expire_ttl?: number
  // Число, обозначающее через сколько секунд после отправки сообщения оно исчезнет.
  // Приходит только в фантомных беседах
  ttl?: number
  // Исчезло ли сообщение
  is_expired?: true
}

export interface ParsedMessage {
  id: number | null
  from: number
  out: boolean
  text: string
  date: number
  conversation_msg_id: number
  random_id: number
  action: MessageAction | null
  hasAttachment: boolean
  fwdCount: number
  fwdMessages: ParsedMessage[]
  attachments: Omit<MessageAttachments, 'type'>
  hasReplyMsg: boolean
  replyMsg: ParsedMessage | null
  keyboard: MessageKeyboard | null
  hasTemplate: boolean
  template: Template | null
  hidden: boolean
  editTime: number
  was_listened: boolean
  isContentDeleted: boolean
  fromLongPoll: boolean
}

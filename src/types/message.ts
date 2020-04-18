import { Attachments, Geo } from './attachments';

// chat_id со всеми сервисными сообщениями для тестов: 541
type Action =
  | ChatCreateAction
  | ChatPhotoUpdateAction
  | ChatPhotoRemoveAction
  | ChatTitleUpdateAction
  | ChatPinMessageAction
  | ChatUnpinMessageAction
  | ChatInviteUserAction
  | ChatInviteUserByLinkAction
  | ChatKickUserAction
  | ChatScreenshotAction;

interface ChatCreateAction {}
interface ChatPhotoUpdateAction {}
interface ChatPhotoRemoveAction {}
interface ChatTitleUpdateAction {}
interface ChatPinMessageAction {}
interface ChatUnpinMessageAction {}
interface ChatInviteUserAction {}
interface ChatInviteUserByLinkAction {}
interface ChatKickUserAction {}
interface ChatScreenshotAction {}



export interface Message {
  date: number
  from_id: number
  id?: number
  out?: 0 | 1
  peer_id?: number
  text: string
  conversation_message_id: number
  action: Action
  fwd_messages?: Message[]
  important?: boolean
  random_id?: number
  attachments: Attachments
  geo?: Geo
  is_hidden?: boolean
  update_time?: number
  deleted?: boolean
  reply_message?: Message
  // Число, обозначающее через сколько секунд после отправки сообщения оно исчезнет.
  // Приходит только в обычных беседах или лс
  expire_ttl?: number
  // Число, обозначающее через сколько секунд после отправки сообщения оно исчезнет.
  // Приходит только в фантомных беседах
  ttl?: number
  // Исчезло ли сообщение
  is_expired?: true
}

export type MessageFragment = Partial<Message>;

export interface ParsedMessage {

}
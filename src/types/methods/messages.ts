/**
 * Возвращает ID отправленного сообщения
 */
export type MessagesSend = number;

export interface MessagesSendParams {
  user_id?: number
  random_id: number
  peer_id?: number
  domain?: string
  chat_id?: number
  message?: string
  lat?: number
  long?: number
  attachment?: string
  reply_to?: number
  forward_messages?: string
  sticker_id?: number
  group_id?: number
  // TODO
  keyboard?: any
  // TODO
  template?: any
  // TODO
  payload?: any
  dont_parse_links?: 0 | 1
  disable_mentions?: 0 | 1
  // TODO
  intent?: any
  // TODO
  subscribe_id?: number
  // title
  // type
  // external_user_id
  // expire_ttl
  // silent
  // track_code
}

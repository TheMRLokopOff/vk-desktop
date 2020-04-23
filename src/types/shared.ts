import { ParsedConversation } from './conversation';
import { ParsedMessage } from './message';

export enum UserSex {
  unknown,
  female,
  male
}

export interface BaseUser {
  id: number
  first_name: string
  first_name_acc: string
  last_name: string
  last_name_acc: string
  deactivated?: 'banned' | 'deleted'
  // Не приходит при наличии deactivated
  is_closed?: boolean
  // Не приходит при наличии deactivated
  can_access_closed?: boolean
  sex: UserSex
  domain: string
  photo_50: string
  photo_100: string
  online: 0 | 1
  online_app?: number
  online_mobile?: 1
  online_info: {
    visible: boolean
    is_online?: true
    last_seen?: number
    is_mobile?: true
    app_id?: number
    status?: 'recently' | 'last_week' | 'last_month' | 'long_ago' | 'now_show'
  }
  last_seen?: {
    time: number
    platform: 1 | 2 | 3 | 4 | 5 | 6 | 7
  }
  // Не приходит при наличии deactivated
  status?: string
  // Не приходит при наличии deactivated
  verified?: 0 | 1
}

export interface BaseGroup {
  id: number
  name: string
  screen_name: string
  type: 'group' | 'page' | 'event'
  deactivated?: 'deleted' | 'banned'
  // Не приходит при наличии deactivated
  status?: string
  photo_50: string
  photo_100: string
  is_closed: 0 | 1
  is_admin: 0 | 1
  is_member: 0 | 1
  is_advertiser: 0 | 1
  // Не приходит при наличии deactivated
  verified?: 0 | 1
}

export type BaseProfile = BaseUser | BaseGroup;

export interface Account extends BaseUser {
  access_token: string
  android_token: string
}

export interface Keyboard {
  inline?: true
  one_time: boolean
  author_id: number
  buttons?: KeyboardButton[][]
}

export interface KeyboardButton {
  // default = secondary
  color: 'primary' | 'default' | 'secondary' | 'positive' | 'negative'

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

export type MessageKeyboard = Keyboard & { inline: true };

export interface BasePeer {
  peer: ParsedConversation
  msg: ParsedMessage
}

interface BaseImageSize {
  // Описаны только типы, которые есть в документации
  type: 's' | 'm' | 'x' | 'o' | 'p' | 'q' | 'r' | 'y' | 'z' | 'w'
  url: string
  width: number
  height: number
}

export interface BaseImage {
  id: number
  album_id: number
  owner_id: number
  date: number
  user_id: number
  text: string
  sizes: BaseImageSize[]
}

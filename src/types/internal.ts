import { VKUser } from '.';

export interface IAccount extends VKUser {
  access_token: string
  android_token: string
}

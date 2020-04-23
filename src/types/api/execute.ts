import { BaseUser, BaseGroup } from '../shared';
import { Message } from '../message';
import { Conversation } from '../conversation';

export namespace execute {
  export type getProfiles = (BaseUser | BaseGroup)[];

  export interface getLastMessage {
    conversation: Conversation
    message: Message | null
  }
}

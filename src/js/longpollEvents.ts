import { timer, eventBus } from './utils';
import {
  parseMessage,
  parseConversation,
  loadConversation,
  loadConversationMembers,
  addNotificationsTimer
} from './messages';
import {
  supportedAttachments
} from '../components/messages/chat/attachments';
import vkapi from './vkapi';
import store from './store';
import router from './router';
import { VKConversationPushSettings, VKInlineKeyboard, VKKeyboard, VKMessageAction } from 'types';
import { IAccount, IParsedConversation, IParsedMessage } from 'types/internal';
import {
  ExecuteGetLastMessage,
  ExecuteGetLastMessageParams,
  MessagesGetById,
  MessagesGetByIdParams
} from 'types/methods';

interface LongPollMessageAction {
  source_act?: VKMessageAction['type']
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

type LongPollMessage = [
  number, // msg_id
  number, // flags
  number, // peer_id
  number, // timestamp
  string, // text
  {
    /**
     * TODO я уверен в этом?
     * Приходит только в лс | в каналах.
     */
    title?: ' ... ' | ''
    /**
     * Приходит только при наличии эмодзи в тексте.
     */
    emoji?: '1'
    /**
     * ID автора сообщения.
     *
     * Приходит только в беседах.
     */
    from?: string
    /**
     * TODO актуализировать информацию !!!
     *
     * Наличие шаблона (для получения шаблона нужно получить сообщение из API)
     */
    has_template?: '1'
    /**
     * 1: Список упомянутых людей прямо или через @online; Ответ на сообщение от [user_id]; @all
     * 2: Исчезающее сообщение в обычном чате
     */
    marked_users?: [
      | [1, number[] | 'all']
      | [2, 'all']
    ]
    keyboard?: VKKeyboard | VKInlineKeyboard
    /**
     * Сообщение исчезло, приходит в 18 событии
     */
    is_expired?: '1'
    /**
     * TODO
     */
    ttl?: any
    /**
     * TODO
     */
    expire_ttl?: any
  } & LongPollMessageAction,
  {
    // Есть пересланное сообщение или ответ на сообщение
    fwd?: '0_0'
    // Есть ответ на сообщение; "{"conversation_message_id":NUMBER}"
    reply?: string

    // Видимо только началась разработка выдачи вложений прямо в LongPoll,
    // поэтому эти поля приходят пока что только для стикеров
    // Число в строке
    attachments_count?: string
    // JSON с массивом вложений
    attachments?: string
    // Описание вложений вида { attach1_type, attach1, ... }
  } & Record<string, string>,
  number, // random_id
  number, // conversation_message_id
  number // edit_time, 0 (не редактировалось) или timestamp (время редактирования)
];

function hasFlag(mask: number) {
  const flags = {
    // Непрочитанное сообщение
    unread: 1,
    // Исходящее сообщение
    outbox: 1 << 1,
    // Важное сообщение
    important: 1 << 3,
    // Отправка сообщения в беседу через vk.com
    chat: 1 << 4,
    // Исходящее; входящее от друга в лс
    friends: 1 << 5,
    // Пометка сообщения как спам
    spam: 1 << 6,
    // Удаление сообщения локально
    deleted: 1 << 7,
    // Прослушано голосовое сообщение
    audio_listened: 1 << 12,
    // Отправка в беседу через клиенты
    chat2: 1 << 13,
    // Отмена пометки как спам
    cancel_spam: 1 << 15,
    // Приветственное сообщение от группы
    hidden: 1 << 16,
    // Удаление сообщения для всех
    deleted_all: 1 << 17,
    // Входящее сообщение в беседе
    chat_in: 1 << 19,
    // messages.send silent: true; выход из беседы
    silent: 1 << 20,
    // Ответ на сообщение
    reply_msg: 1 << 21
  };

  return (flag: string) => !!(flags[flag] & mask);
}

function getServiceMessage(data: LongPollMessage[5]): VKMessageAction | null {
  const source = {} as VKMessageAction;

  const replaces = {
    act: 'type',
    mid: 'member_id',
    chat_local_id: 'conversation_message_id'
  };

  for (const item in data) {
    const match = item.match(/source_(.+)/);

    if (match) {
      const key = replaces[match[1]] || match[1];

      source[key] = isNaN(data[item])
        ? data[item]
        : +data[item];
    }
  }

  return Object.keys(source).length
    ? source
    : null;
}

function getAttachments(data: LongPollMessage[6]) {
  const attachments: Record<string, null[]> = {};

  if (data.geo) {
    attachments.geo = [null];
  }

  for (const key in data) {
    const match = key.match(/attach(\d+)$/);

    if (match) {
      const id = match[1];
      const kind = data[`attach${id}_kind`];
      let type = data[`attach${id}_type`];

      if (kind === 'audiomsg') type = 'audio_message';
      if (kind === 'graffiti') type = 'graffiti';
      if (type === 'group') type = 'event';

      if (attachments[type]) {
        attachments[type].push(null);
      } else {
        attachments[type] = [null];
      }
    }
  }

  return attachments;
}

interface ParseLongPollMessageResult {
  peer: Partial<IParsedConversation>
  msg: IParsedMessage
}

// https://github.com/danyadev/longpoll-doc#структура-сообщения
function parseLongPollMessage(data: LongPollMessage): ParseLongPollMessageResult {
  // Если это 2 событие прочтения сообщения или пометки его важным
  if (!data[3]) {
    return;
  }

  // TODO store
  const user: IAccount = store.getters['users/user'];
  const flag = hasFlag(data[1]);
  const action = getServiceMessage(data[5]);
  const from_id = flag('outbox') ? user.id : +(data[5].from || data[2]);
  const { keyboard, marked_users } = data[5];
  const attachments = getAttachments(data[6]);
  const hasReplyMsg = flag('reply_msg');
  const hasAttachment = !!(hasReplyMsg || data[6].fwd || Object.keys(attachments).length);
  const out = from_id === user.id;
  let mentions: number[] = [];

  if (keyboard) {
    keyboard.author_id = from_id;
  }

  for (const [id, users] of marked_users || []) {
    if (id === 1) {
      mentions = (users === 'all' ? [user.id] : users);
    }

    // type 2 = бомбочка
  }

  return {
    peer: {
      id: data[2],
      isChannel:
        // Сообщение от повторного вступления в канал
        !out && flag('deleted') ||
        // Сообщение с некоторым сервисным сообщением
        !!data[5].source_is_channel,
      isCasperChat: !!data[5].ttl,
      keyboard: keyboard && !('inline' in keyboard) && keyboard,
      mentions
    },
    msg: {
      id: data[0],
      from: from_id,
      out: from_id === user.id || flag('outbox'),
      text: action ? '' : data[4],
      date: data[3],
      peer_id: data[2],
      conversation_msg_id: data[8],
      random_id: data[7],
      action,
      hasAttachment,
      fwdCount: !hasReplyMsg && data[6].fwd ? -1 : 0,
      fwdMessages: [],
      attachments,
      hasReplyMsg,
      replyMsg: null,
      keyboard: keyboard && ('inline' in keyboard) ? keyboard : null,
      hasTemplate: !!data[5].has_template,
      template: null,
      hidden: flag('hidden'),
      editTime: data[9],
      was_listened: false,
      isContentDeleted: !data[4] && !action && !hasAttachment,
      expireTtl: +data[5].expire_ttl || data[5].ttl || 0,
      isExpired: !!data[5].is_expired,
      fromLongPoll: true
    }
  };
}

async function getLastMessage(peer_id: number) {
  const { message, conversation } = await vkapi<
    ExecuteGetLastMessage,
    ExecuteGetLastMessageParams
  >('execute.getLastMessage', {
    peer_id,
    func_v: 2
  });

  const peer = parseConversation(conversation);
  const msg = message && parseMessage(message);

  store.commit('messages/updateConversation', {
    removeMsg: !msg,
    peer,
    msg
  });

  return { peer, msg };
}

async function loadMessages(peer_id: number, msg_ids: number[], onlyReturnMessages?: boolean) {
  const { items } = await vkapi<MessagesGetById, MessagesGetByIdParams>('messages.getById', {
    message_ids: msg_ids.join(',')
  });

  const messages: IParsedMessage[] = [];

  for (const msg of items) {
    const parsedMsg = parseMessage(msg);

    if (onlyReturnMessages) {
      messages.push(parsedMsg);
    } else {
      store.commit('messages/editMessage', {
        peer_id,
        msg: parsedMsg
      });
    }
  }

  return messages;
}

function hasSupportedAttachments(msg: ParseLongPollMessageResult['msg']) {
  if (msg.hasReplyMsg || msg.fwdCount || msg.hasTemplate) {
    return true;
  }

  for (const attach in msg.attachments) {
    if (supportedAttachments.has(attach)) {
      return true;
    }
  }

  return false;
}

function hasPreloadMessages(items: ParseLongPollMessageResult[]) {
  return items.some(({ msg }) => hasSupportedAttachments(msg));
}

async function watchTyping(peer_id: number, user_id: number): Promise<void> {
  await timer(1000);

  const typingPeer = store.state.messages.typing[peer_id];
  const user = typingPeer && typingPeer[user_id];

  if (user && user.time) {
    store.commit('messages/addUserTyping', {
      peer_id,
      user_id,
      type: user.type,
      time: user.time - 1
    });

    return watchTyping(peer_id, user_id);
  }

  store.commit('messages/removeUserTyping', { peer_id, user_id });
}

function removeTyping(peer_id: number, user_id: number, clearChat?: boolean) {
  const typing = store.state.messages.typing[peer_id] || {};

  if (typing[user_id] || clearChat) {
    store.commit('messages/removeUserTyping', {
      clearChat,
      peer_id,
      user_id
    });
  }
}

interface PackedEvent<T> {
  peer_id: number
  items: T[]
}

export default {
  2: {
    // 1) Пометка важным (important)
    // 2) Пометка как спам (spam)
    // 3) Удаление сообщения (deleted)
    // 4) Прослушка голосового сообщения (audio_listened)
    // 5) Удаление для всех (deleted, deleted_all)
    // [msg_id, flags, peer_id]
    pack: true,
    parser(data: [number, number, number]) {
      const flag = hasFlag(data[1]);

      // Так как в handler обрабатываются только пачки удаленных
      // сообщений, я решил обработать audio_listened здесь.
      if (flag('audio_listened')) {
        return store.commit('messages/editMessage', {
          peer_id: data[2],
          msg: {
            id: data[0],
            was_listened: true
          }
        });
      }

      if (!flag('important')) {
        return data[0];
      }
    },
    async handler({ peer_id, items: msg_ids }: PackedEvent<number>) {
      const { peer, msg } = await getLastMessage(peer_id);
      const route = router.currentRoute.value;

      if (
        store.state.messages.selectedMessages.length &&
        route.name === 'chat' && +route.params.id === peer_id
      ) {
        for (const id of msg_ids) {
          store.commit('messages/removeSelectedMessage', id);
        }
      }

      store.commit('messages/removeMessages', { peer_id, msg_ids });

      if (msg || peer.isCasperChat) {
        store.commit('messages/moveConversation', { peer_id });

        if (msg) {
          eventBus.emit('messages:event', 'checkScrolling', { peer_id });
        }
      } else {
        store.commit('messages/updatePeersList', {
          id: peer_id,
          remove: true
        });
      }
    }
  },

  3: {
    // 1) Прочитано сообщение (unread)
    // 2) Отмена пометки важным (important)
    // 3) Отмена пометки сообщения как спам (spam, cancel_spam)
    // 4) Восстановление удаленного сообщения (deleted)
    // Приходит сообщение (пункты 3 и 4)
    // [msg_id, flags, peer_id] (пункты 1 и 2)
    pack: true,
    parser: parseLongPollMessage,
    preload: hasPreloadMessages,
    async handler({ peer_id, items }: PackedEvent<ParseLongPollMessageResult>) {
      const conversation = store.state.messages.conversations[peer_id];
      const conversationsList = store.getters['messages/peersList'];
      const lastLocalConversation = conversationsList[conversationsList.length - 1];
      const messagesList = store.state.messages.messages[peer_id] || [];
      const [topMsg] = messagesList;
      const bottomMsg = messagesList[messagesList.length - 1];
      const { msg } = await getLastMessage(peer_id);
      let unlockUp: boolean;
      let unlockDown: boolean;

      if (!topMsg) {
        unlockUp = true;
        unlockDown = true;
      } else {
        items = items.filter((item) => {
          if (item.msg.id < topMsg.id) {
            unlockUp = true;
          } else if (item.msg.id > bottomMsg.id) {
            unlockDown = true;
          } else {
            return true;
          }
        });
      }

      if (items.length) {
        const { items: newMessages } = await vkapi('messages.getById', {
          message_ids: items.map(({ msg }) => msg.id).join(',')
        });

        for (const msg of newMessages) {
          store.commit('messages/insertMessage', {
            peer_id,
            msg: parseMessage(msg)
          });
        }
      }

      eventBus.emit('messages:event', 'checkScrolling', {
        peer_id,
        unlockUp,
        unlockDown
      });

      if (!lastLocalConversation || lastLocalConversation.msg.id < msg.id) {
        if (conversation && !store.state.messages.peerIds.includes(peer_id)) {
          store.commit('messages/updatePeersList', {
            id: peer_id
          });
        }

        store.commit('messages/moveConversation', {
          peer_id,
          isRestoreMsg: true
        });
      }
    }
  },

  4: {
    // Новое сообщение
    // Приходит сообщение
    pack: true,
    parser: parseLongPollMessage,
    preload: hasPreloadMessages,
    async handler({ peer_id, items }: PackedEvent<ParseLongPollMessageResult>, isPreload: boolean) {
      const { wasOpened, loading } = store.state.messages.peersConfig[peer_id] || {};
      const conversation = store.state.messages.conversations[peer_id];
      const localMessages = store.state.messages.messages[peer_id] || [];
      const lastLocalMsg = localMessages[localMessages.length - 1];
      let lastMsg = items[items.length - 1].msg;
      const messagesWithAttachments = [];
      const peerData: Partial<IParsedConversation> = {
        id: peer_id,
        last_msg_id: lastMsg.id,
        mentions: conversation && conversation.peer.mentions || []
      };

      const isChatLoadedBottom = wasOpened && (
        !lastLocalMsg && !loading ||
        lastLocalMsg && conversation.peer.last_msg_id === lastLocalMsg.id
      );

      if (isChatLoadedBottom) {
        store.commit('messages/addMessages', {
          peer_id,
          addNew: true,
          messages: items
            .filter((item) => !hasPreloadMessages([item]))
            .map((item) => item.msg)
        });
      }

      for (const { msg, peer: { keyboard, mentions } } of items) {
        if (hasSupportedAttachments(msg) && isChatLoadedBottom) {
          messagesWithAttachments.push(msg.id);
        }

        if (msg.action && msg.action.type === 'chat_title_update') {
          peerData.title = msg.action.text;
        }

        if (msg.out) {
          peerData.in_read = msg.id;
          peerData.unread = 0;
        } else {
          removeTyping(peer_id, msg.from);

          peerData.out_read = msg.id;

          if (keyboard) {
            peerData.keyboard = keyboard;
          }

          if (peerData.unread !== undefined) {
            peerData.unread++;
          } else if (conversation) {
            peerData.unread = (conversation.peer.unread || 0) + 1;
          }

          if (mentions.includes(store.state.users.activeUser)) {
            peerData.mentions.push(msg.id);
          }
        }
      }

      if (messagesWithAttachments.length) {
        if (isPreload) {
          const messages = await loadMessages(peer_id, messagesWithAttachments, true);

          store.commit('messages/addMessages', {
            peer_id,
            messages,
            addNew: true
          });

          lastMsg = messages[messages.length - 1];
        } else {
          loadMessages(peer_id, messagesWithAttachments);
        }
      }

      for (let i = 0; i < items.length; i++) {
        eventBus.emit('messages:event', 'new', {
          peer_id,
          random_id: items[i].msg.random_id,
          isFirstMsg: !i
        });
      }

      if (lastMsg.hidden) {
        return;
      }

      if (!store.state.messages.peerIds.includes(peer_id)) {
        store.commit('messages/addConversations', [{
          peer: peerData,
          msg: lastMsg
        }]);

        loadConversation(peer_id);
      } else {
        store.commit('messages/updateConversation', {
          peer: peerData,
          msg: lastMsg
        });
      }

      store.commit('messages/moveConversation', {
        peer_id,
        isNewMsg: true
      });
    }
  },

  5: {
    // Редактирование сообщения
    // Приходит сообщение
    parser: parseLongPollMessage,
    preload: (data: ParseLongPollMessageResult) => hasPreloadMessages([data]),
    async handler({ peer, msg }: ParseLongPollMessageResult, isPreload: boolean) {
      const conversation = store.state.messages.conversations[peer.id];
      const messages = store.state.messages.messages[peer.id] || [];
      const isLastMsg = conversation && conversation.msg.id === msg.id;
      const activeId = store.state.users.activeUser;

      removeTyping(peer.id, msg.from);

      if (hasSupportedAttachments(msg) && messages.find((message) => message.id === msg.id)) {
        if (isPreload) {
          [msg] = await loadMessages(peer.id, [msg.id], true);
        } else {
          loadMessages(peer.id, [msg.id]);
        }
      }

      const newConversationData: Partial<ParseLongPollMessageResult> = {
        peer: {
          id: peer.id,
          mentions: conversation && conversation.peer.mentions || []
        }
      };

      if (isLastMsg) {
        newConversationData.msg = msg;
      }

      if (
        msg.id > (conversation && conversation.peer.in_read) && // Непрочитанное сообщение
        newConversationData.peer.mentions.includes(msg.id) && // В старом сообщении есть упоминание
        !peer.mentions.includes(activeId) // В новом сообщении нет упоминания
      ) {
        newConversationData.peer.mentions.splice(
          newConversationData.peer.mentions.indexOf(msg.id),
          1
        );
      }

      store.commit('messages/updateConversation', newConversationData);
      store.commit('messages/editMessage', {
        peer_id: peer.id,
        msg
      });
    }
  },

  6: {
    // Прочтение входящих сообщений до msg_id
    // [peer_id, msg_id, count]
    handler([peer_id, msg_id, count]: [number, number, number]) {
      const conversation = store.state.messages.conversations[peer_id];
      const mentions = conversation && conversation.peer.mentions || [];
      const newMentions = mentions.slice();
      const isMyDialog = peer_id === store.state.users.activeUser;

      for (const id of mentions) {
        if (msg_id >= id) {
          newMentions.splice(newMentions.indexOf(id), 1);
        }
      }

      store.commit('messages/updateConversation', {
        peer: {
          id: peer_id,
          unread: count,
          in_read: msg_id,
          ...(isMyDialog && { out_read: msg_id }),
          mentions: newMentions
        }
      });
    }
  },

  7: {
    // Прочтение исходящих сообщений до msg_id
    // [peer_id, msg_id, count]
    handler([peer_id, msg_id]: [number, number]) {
      store.commit('messages/updateConversation', {
        peer: {
          id: peer_id,
          in_read: msg_id,
          out_read: msg_id
        }
      });
    }
  },

  8: {
    // Друг появился в сети
    // [-user_id, platform, timestamp, app_id]
    // platform: 1: любое приложение, 2: iphone, 3: ipad, 4: android, 5: wphone, 6: windows, 7: web
    handler([id, platform, time, app_id]: [number, number, number, number]) {
      if (!store.state.profiles[-id]) {
        return;
      }

      store.commit('updateProfile', {
        id: -id,
        online: true,
        online_mobile: ![6, 7].includes(platform),
        online_app: app_id,
        last_seen: { time, platform }
      });
    }
  },

  9: {
    // Друг вышел из сети
    // [-user_id, isTimeout, timestamp, app_id]
    // isTimeout: 1 - вышел по таймауту, 0 - вышел из vk.com
    handler([id, /* isTimeout */, time, app_id]: [number, 0 | 1, number, number]) {
      if (!store.state.profiles[-id]) {
        return;
      }

      store.commit('updateProfile', {
        id: -id,
        online: false,
        online_mobile: false,
        online_app: app_id,
        last_seen: { time }
      });
    }
  },

  10: {
    // Просмотрено упоминание, исчезающее сообщение или беседа была отмечена снова прочитанной
    // [peer_id, flag]
  },

  12: {
    // Появилось упоминание, исчезающее сообщение или беседа была отмечена непрочитанной
    // [peer_id, flag]
  },

  13: {
    // Удаление всех сообщений в диалоге
    // [peer_id, last_msg_id]
    handler([peer_id]: [number, number]) {
      store.commit('messages/removeConversationMessages', peer_id);
      store.commit('messages/updatePeersList', {
        id: peer_id,
        remove: true
      });

      store.commit('messages/updateConversation', {
        peer: { id: peer_id },
        removeMsg: true
      });
    }
  },

  18: {
    // 1. Добавление сниппета к сообщению (если сообщение с ссылкой)
    // 2. "Исчезновение сообщения" - удаление всего контента с добавлением ключа is_expired: true
    // Приходит сообщение
    parser: parseLongPollMessage,
    preload: (data: ParseLongPollMessageResult) => hasPreloadMessages([data]),
    async handler({ peer, msg }: ParseLongPollMessageResult, isPreload: boolean) {
      const conversation = store.state.messages.conversations[peer.id];
      const fullPeer = conversation && conversation.peer;
      const route = router.currentRoute.value;

      if (isPreload) {
        [msg] = await loadMessages(peer.id, [msg.id], true);
      }

      if (fullPeer && fullPeer.last_msg_id === msg.id && msg.isExpired) {
        store.commit('messages/updateConversation', {
          peer: { id: peer.id },
          msg
        });
      }

      if (
        msg.isExpired && store.state.messages.selectedMessages.length &&
        route.name === 'chat' && +route.params.id === peer.id
      ) {
        store.commit('messages/removeSelectedMessage', msg.id);
      }

      store.commit('messages/editMessage', {
        peer_id: peer.id,
        msg
      });
    }
  },

  19: {
    // Сброс кеша сообщения или исчезновение сообщения
    // [msg_id]
    // В первом случае необходимо переполучить сообщение через API
    async handler([msg_id]: [number]) {
      const conversations = store.state.messages.messages;

      // Ждем, пока в 18 событии сообщение пометится как исчезнувшее,
      // чтобы лишний раз не получать его через API
      await timer(0);

      for (const peer_id in conversations) {
        const messages = conversations[peer_id];

        for (const msg of messages) {
          if (msg.id === msg_id) {
            return !msg.isExpired && loadMessages(+peer_id, [msg.id]);
          }
        }
      }
    }
  },

  51: {
    // Изменение данных чата
    // [chat_id]
    // Событие не используется, так как событие 52 полностью его заменяет
  },

  52: {
    // Изменение данных чата
    // [type, peer_id, extra]
    handler([type, peer_id, extra]: [number, number, number]) {
      const isMe = extra === store.state.users.activeUser;
      const conversation = store.state.messages.conversations[peer_id];
      const peer = conversation && conversation.peer;

      // Изменение названия беседы (1)
      // и включение/выключение клавиатуры (11)
      // обрабатываются в 4 событии
      if (!peer || [1, 11].includes(type)) {
        return;
      }

      // Пользователь покинул или был исключен из беседы
      if ([7, 8].includes(type)) {
        removeTyping(peer_id, extra, isMe);
      }

      switch (type) {
        case 2: // Изменилась аватарка беседы
        case 3: // Назначен новый администратор
        case 4: // Изменение прав в беседе
        case 9: // Разжалован администратор
          loadConversation(peer_id);
          break;

        case 5: // Закрепление или открепление сообщения
          if (extra) {
            loadConversation(peer_id);
          } else {
            peer.pinnedMsg = null;
          }
          break;

        case 6: // Пользователь присоединился или вернулся в беседу
          if (peer.members != null) {
            peer.members++;
          }

          if (isMe) {
            peer.left = false;
            peer.isWriteAllowed = !peer.isChannel;

            if (!peer.isChannel) {
              loadConversation(peer_id);
              loadConversationMembers(peer.id, true);
            }
          }
          break;

        case 7: // Пользователь покинул беседу
          if (peer.members != null) {
            peer.members--;
          }

          if (isMe) {
            peer.left = true;
          }
          break;

        case 8: // Пользователя исключили из беседы
          if (peer.members != null) {
            peer.members--;
          }

          if (isMe) {
            peer.left = true;
            peer.isWriteAllowed = false;
          }
          break;

        default:
          console.warn('[lp] Неизвестное действие в 52 событии:', { type, peer_id, extra });
      }

      store.commit('messages/updateConversation', { peer });
    }
  },

  63: {
    // Статус набора сообщения
    // [peer_id, [from_ids], ids_length, timestamp]
    handler([peer_id, ids]: [number, number[], number, number]) {
      for (const id of ids) {
        if (id === store.state.users.activeUser) {
          continue;
        }

        store.commit('messages/addUserTyping', {
          peer_id,
          user_id: id,
          type: 'text'
        });

        watchTyping(peer_id, id);
      }
    }
  },

  64: {
    // Статус записи голосового сообщения
    // [peer_id, [from_ids], ids_length, timestamp]
    handler([peer_id, ids]: [number, number[], number, number]) {
      for (const id of ids) {
        if (id === store.state.users.activeUser) {
          continue;
        }

        store.commit('messages/addUserTyping', {
          peer_id,
          user_id: id,
          type: 'audio'
        });

        watchTyping(peer_id, id);
      }
    }
  },

  80: {
    // Изменение количества непрочитанных диалогов
    // [count, count_with_notifications, 0, 0]
    // count_with_notifications: кол-во непрочитанных диалогов, в которых включены уведомления
    handler([count]: [number, number, 0, 0]) {
      store.commit('updateMenuCounters', {
        name: 'messages',
        value: count
      });
    }
  },

  81: {
    // Изменение состояния невидимки друга
    // [-user_id, state, ts, -1, 0]
    // state: 1 - включена, 0 - выключена
  },

  114: {
    // Изменение настроек пуш-уведомлений в беседе
    // [{ peer_id, sound, disabled_until }]
    // disabled_until: -1 - выключены; 0 - включены; * - время их включения
    handler([{ peer_id, disabled_until }]: [VKConversationPushSettings]) {
      if (!store.state.messages.conversations[peer_id]) {
        return;
      }

      store.commit('messages/updateConversation', {
        peer: {
          id: peer_id,
          muted: !!disabled_until
        }
      });

      addNotificationsTimer({ peer_id, disabled_until }, disabled_until <= 0);
    }
  },

  115: {
    // Звонок
  }
};

import * as Api from 'types/api';
import { Account, MessageKeyboard } from 'types/shared';
import { ParsedConversation } from 'types/conversation';
import { ParsedMessage, MessageAction, LongPollMessageAction } from 'types/message';
import {
  parseMessage,
  parseConversation,
  loadConversation,
  loadConversationMembers,
  addNotificationsTimer
} from './messages';
import {
  supportedAttachments,
  preloadAttachments
} from '../components/messages/chat/attachments';
import { timer, eventBus } from './utils';
import store from './store';
import vkapi from './vkapi';

type LongPollMessage = [
  number, // msg_id
  number, // flags
  number, // peer_id
  number, // timestamp
  string, // text
  {
    // Приходит только в лс | в каналах
    title?: ' ... ' | ''
    // Наличие emoji
    emoji?: '1'
    // id автора сообщения. Приходит только в беседах
    from?: string
    // Наличие шаблона (для получения шаблона нужно получить сообщение из API)
    has_template?: '1'
    // 1: Список упомянутых людей прямо или через @online; Ответ на сообщение от [user_id]; @all
    // 2: Исчезающее сообщение в обычном чате
    marked_users?: [
      | [1, number[] | 'all']
      | [2, 'all']
    ]
    // Клавиатура для ботов (в т.ч. инлайн)
    keyboard?: MessageKeyboard
    // Сообщение исчезло, приходит в 18 событии
    is_expired?: '1'
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
    unread:         1,       // Непрочитанное сообщение
    outbox:         1 << 1,  // Исходящее сообщение
    important:      1 << 3,  // Важное сообщение
    chat:           1 << 4,  // Отправка сообщения в беседу через vk.com
    friends:        1 << 5,  // Исходящее; входящее от друга в лс
    spam:           1 << 6,  // Пометка сообщения как спам
    deleted:        1 << 7,  // Удаление сообщения локально
    audio_listened: 1 << 12, // Прослушано голосовое сообщение
    chat2:          1 << 13, // Отправка в беседу через клиенты
    cancel_spam:    1 << 15, // Отмена пометки как спам
    hidden:         1 << 16, // Приветственное сообщение от группы
    deleted_all:    1 << 17, // Удаление сообщения для всех
    chat_in:        1 << 19, // Входящее сообщение в беседе
    silent:         1 << 20, // messages.send silent: true; выход из беседы
    reply_msg:      1 << 21  // Ответ на сообщение
  };

  return (flag: string) => !!(flags[flag] & mask);
}

function getServiceMessage(data: LongPollMessage[5]): MessageAction | null {
  const source = {} as MessageAction;

  const replaces = {
    act: 'type',
    mid: 'member_id',
    chat_local_id: 'conversation_message_id'
  };

  for (const item in data) {
    const match = /source_(.+)/.exec(item);

    if (match) {
      const key: string = replaces[match[1]] || match[1];

      source[key] = isNaN(+data[item])
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
    const match = /attach(\d+)$/.exec(key);

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

interface ParsedLongPollConversation {
  peer: Partial<ParsedConversation>
  msg: ParsedMessage
}

function parseLongPollMessage(data: LongPollMessage, fromHistory: boolean): ParsedLongPollConversation {
  // Если данные получены через messages.getLongPollHistory
  if (fromHistory) {
    // На самом деле здесь приходит чистый ParsedConversation и ParsedMessage,
    // но я не хочу все усложнять
    return data as unknown as ParsedLongPollConversation;
  }

  // Если это 2 событие прочтения сообщения или пометки его важным
  if (!data[3]) {
    return;
  }

  const user: Account = store.getters['users/user'];
  const flag = hasFlag(data[1]);
  const action = getServiceMessage(data[5]);
  const from_id = flag('outbox') ? user.id : Number(data[5].from || data[2]);
  const { keyboard, marked_users } = data[5];
  const attachments = getAttachments(data[6]);
  const hasReplyMsg = flag('reply_msg');
  const hasAttachment = !!(hasReplyMsg || data[6].fwd || Object.keys(attachments).length);
  const out = from_id === user.id || flag('outbox');
  let mentions: number[] = [];

  if (keyboard) {
    keyboard.author_id = from_id;
  }

  for (const [id, users] of marked_users || []) {
    if (id === 1) {
      mentions = users as number[];
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
      keyboard: keyboard && !keyboard.inline && keyboard,
      mentions
    },
    msg: {
      id: data[0],
      from: from_id,
      out: from_id === user.id || flag('outbox'),
      text: action ? '' : data[4],
      date: data[3],
      conversation_msg_id: data[8],
      random_id: data[7],
      action,
      hasAttachment,
      fwdCount: !hasReplyMsg && data[6].fwd ? -1 : 0,
      fwdMessages: [],
      attachments,
      hasReplyMsg,
      replyMsg: null,
      keyboard: keyboard && keyboard.inline ? keyboard : null,
      hasTemplate: !!data[5].has_template,
      template: null,
      hidden: flag('hidden'),
      editTime: data[9],
      was_listened: false,
      isContentDeleted: !data[4] && !action && !hasAttachment,
      // Нужно только для пометки сообщения как обязательное для получения через апи
      fromLongPoll: true
    }
  };
}

async function getLastMessage(peer_id: number) {
  const { message, conversation } = await vkapi<Api.execute.getLastMessage>('execute.getLastMessage', {
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
  const { items } = await vkapi<Api.messages.getById>('messages.getById', {
    message_ids: msg_ids.join(',')
  });

  const messages: ParsedMessage[] = [];

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

function hasSupportedAttachments(msg: ParsedMessage) {
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

function hasPreloadMessages(messages: ParsedLongPollConversation[]) {
  for (const { msg } of messages) {
    if (msg.fwdCount || msg.hasTemplate) {
      return true;
    }

    for (const attach in msg.attachments) {
      if (preloadAttachments.has(attach)) {
        return true;
      }
    }
  }

  return false;
}

async function watchTyping(peer_id: number, user_id: number) {
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

interface LongPollEvent {
  pack?: true
  parser?: (rawEvent: any, fromHistory: boolean) => any
  preload?: (parsedEvent: any) => any
  handler?: (parsedEvent: any, isPreload: boolean) => void
}

interface PackedEvent<T> {
  peer_id: number
  items: T[]
}

const events = {} as Record<number, LongPollEvent>;

function addEvent(id: number, event: LongPollEvent) {
  events[id] = event;
}

type RawEvent2 = [number, number, number];

addEvent(2, {
  // 1) Пометка важным (important)
  // 2) Пометка как спам (spam)
  // 3) Удаление сообщения (deleted)
  // 4) Прослушка голосового сообщения (audio_listened)
  // 5) Удаление для всех (deleted, deleted_all)
  // [msg_id, flags, peer_id]
  pack: true,
  parser(data: RawEvent2): number | void {
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
    store.commit('messages/removeMessages', { peer_id, msg_ids });

    const { msg } = await getLastMessage(peer_id);

    if (msg) {
      store.commit('messages/moveConversation', { peer_id });
      eventBus.emit('messages:event', 'checkScrolling', { peer_id });
    } else {
      store.commit('messages/updatePeersList', {
        id: peer_id,
        remove: true
      });
    }
  }
});

addEvent(3, {
  // 1) Прочитано сообщение (unread)
  // 2) Отмена пометки важным (important)
  // 3) Отмена пометки сообщения как спам (spam, cancel_spam)
  // 4) Восстановление удаленного сообщения (deleted)
  // Приходит сообщение (пункты 3 и 4)
  // [msg_id, flags, peer_id] (пункты 1 и 2)
  pack: true,
  parser: parseLongPollMessage,
  preload: hasPreloadMessages,
  async handler({ peer_id, items }: PackedEvent<ParsedLongPollConversation>) {
    const conversation = store.state.messages.conversations[peer_id];
    const conversationsList = store.getters['messages/peersList'];
    const lastLocalConversation = conversationsList[conversationsList.length - 1];
    const messagesList = store.state.messages.messages[peer_id] || [];
    const [topMsg] = messagesList;
    const bottomMsg = messagesList[messagesList.length - 1];
    const { msg } = await getLastMessage(peer_id);
    let unlockUp = false;
    let unlockDown = false;

    items = items.filter((item) => {
      if (!topMsg) unlockUp = unlockDown = true;
      else if (item.msg.id < topMsg.id) unlockUp = true;
      else if (item.msg.id > bottomMsg.id) unlockDown = true;
      else return 1;
    });

    if (items.length) {
      const { items: newMessages } = await vkapi<Api.messages.getById>('messages.getById', {
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
});

addEvent(4, {
  // Новое сообщение
  // Приходит сообщение
  pack: true,
  parser: parseLongPollMessage,
  preload: hasPreloadMessages,
  async handler({ peer_id, items }: PackedEvent<ParsedLongPollConversation>, isPreload) {
    const { opened, loading } = store.state.messages.peersConfig[peer_id] || {};
    const conversation = store.state.messages.conversations[peer_id];
    const localMessages = store.state.messages.messages[peer_id] || [];
    const lastLocalMsg = localMessages[localMessages.length - 1];
    let lastMsg = items[items.length - 1].msg;
    const messagesWithAttachments: number[] = [];
    const peerData: Partial<ParsedConversation> = {
      id: peer_id,
      last_msg_id: lastMsg.id,
      mentions: conversation && conversation.peer.mentions || []
    };

    const isChatLoadedBottom = opened && (
      !lastLocalMsg && !loading ||
      lastLocalMsg && conversation.peer.last_msg_id === lastLocalMsg.id
    );

    if (isChatLoadedBottom) {
      store.commit('messages/addMessages', {
        peer_id,
        addNew: true,
        messages: items
          .filter((msg) => !hasPreloadMessages([msg]))
          .map((peer) => peer.msg)
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
});

addEvent(5, {
  // Редактирование сообщения
  // Приходит сообщение
  parser: parseLongPollMessage,
  preload: (data) => hasPreloadMessages([data]),
  async handler({ peer, msg }: ParsedLongPollConversation, isPreload) {
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

    const updateConversationData: Partial<ParsedLongPollConversation> = {
      peer: {
        id: peer.id,
        mentions: conversation && conversation.peer.mentions || []
      }
    };

    if (isLastMsg) {
      updateConversationData.msg = msg;
    }

    if (
      msg.id > (conversation && conversation.peer.in_read) && // Непрочитанное сообщение
      updateConversationData.peer.mentions.includes(msg.id) && // В старом сообщении есть упоминание
      !peer.mentions.includes(activeId) // В новом сообщении нет упоминания
    ) {
      updateConversationData.peer.mentions.splice(updateConversationData.peer.mentions.indexOf(msg.id), 1);
    }

    store.commit('messages/updateConversation', updateConversationData);
    store.commit('messages/editMessage', {
      peer_id: peer.id,
      msg
    });
  }
});

addEvent(6, {
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
        ...(isMyDialog ? { out_read: msg_id } : {}),
        mentions: newMentions
      }
    });
  }
});

addEvent(7, {
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
});

addEvent(8, {
  // Друг появился в сети
  // [-user_id, platform, timestamp, app_id]
  // platform: 1: mobile, 2: iPhone, 3: iPad, 4: android, 5: windowsPhone, 6: windows10, 7: web
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
});

addEvent(9, {
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
});

addEvent(10, {
  // Упоминание в беседе peer_id просмотрено
  // [peer_id, flag]
});

addEvent(12, {
  // Появилось упоминание (пуш или ответ на сообщение) в беседе peer_id
  // [peer_id, flag]
});

addEvent(13, {
  // Удаление всех сообщений в диалоге
  // [peer_id, last_msg_id]
  handler([peer_id]: [number]) {
    store.commit('messages/removeConversationMessages', peer_id);
    store.commit('messages/updatePeersList', {
      id: peer_id,
      remove: true
    });
  }
});

addEvent(18, {
  // Добавление сниппета к сообщению (если сообщение с ссылкой)
  // Приходит сообщение
  parser: parseLongPollMessage,
  preload: (data) => hasPreloadMessages([data]),
  async handler({ peer, msg }: ParsedLongPollConversation, isPreload) {
    if (isPreload) {
      [msg] = await loadMessages(peer.id, [msg.id], true);
    }

    store.commit('messages/editMessage', {
      peer_id: peer.id,
      msg
    });
  }
});

addEvent(19, {
  // Сброс кеша сообщения
  // [msg_id]
  // Необходимо переполучить сообщение через апи
  handler([msg_id]: [number]) {
    const conversations = store.state.messages.messages;

    for (const peer_id in conversations) {
      const messages = conversations[peer_id];

      for (const { id } of messages) {
        if (id === msg_id) {
          return loadMessages(+peer_id, [id]);
        }
      }
    }
  }
});

addEvent(51, {
  // Изменение данных чата
  // [chat_id]
  // Событие не используется, так как событие 52 полностью его заменяет
});

addEvent(52, {
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
      case 4: // Изменение прав в беседе
        loadConversation(peer_id);
        break;

      case 3: // Назначен новый администратор
        if (isMe) {
          loadConversation(peer_id);
        } else {
          peer.admin_ids.push(extra);
        }
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
        if (peer.members != null) peer.members--;
        if (isMe) peer.left = true;
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

      case 9: // Разжалован администратор
        if (isMe) {
          loadConversation(peer_id);
        } else {
          peer.admin_ids.splice(peer.admin_ids.indexOf(extra), 1);
        }
        break;

      default:
        console.warn('[lp] Неизвестное действие в 52 событии:', { type, peer_id, extra });
    }

    store.commit('messages/updateConversation', { peer });
  }
});

addEvent(63, {
  // Статус набора сообщения
  // [peer_id, [from_ids], ids_length, timestamp]
  handler([peer_id, ids]: [number, number[]]) {
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
});

addEvent(64, {
  // Статус записи голосового сообщения
  // [peer_id, [from_ids], ids_length, timestamp]
  handler([peer_id, ids]: [number, number[]]) {
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
});

addEvent(80, {
  // Изменение количества непрочитанных диалогов
  // [count, count_with_notifications, 0, 0]
  // count_with_notifications: кол-во непрочитанных диалогов, в которых включены уведомления
  handler([count]: [number]) {
    store.commit('updateMenuCounters', {
      name: 'messages',
      value: count
    });
  }
});

addEvent(81, {
  // Изменение состояния невидимки друга
  // [-user_id, state, ts, -1, 0]
  // state: 1 - включена, 0 - выключена
});

interface Event114Options {
  peer_id: number
  disabled_until: number
}

addEvent(114, {
  // Изменение настроек пуш-уведомлений в беседе
  // [{ peer_id, sound, disabled_until }]
  // disabled_until: -1 - выключены; 0 - включены; * - время их включения
  handler([{ peer_id, disabled_until }]: [Event114Options]) {
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
});

addEvent(115, {
  // Звонок
});

export default events;

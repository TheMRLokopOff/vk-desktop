import { Conversation, ParsedConversation } from 'types/conversation';
import { Message, ParsedMessage } from 'types/message';
import { escape, getPhoto, fields, concatProfiles, capitalize, getAppName } from './utils';
import { getLastOnlineDate } from './date';
import getTranslate from './getTranslate';
import store from './store';
import vkapi from './vkapi';

export function parseConversation(conversation: Conversation): ParsedConversation {
  const isChat = conversation.peer.id > 2e9;
  const { push_settings, chat_settings } = conversation;

  return {
    id: conversation.peer.id,
    channel: isChat && chat_settings.is_group_channel,
    members: isChat ? chat_settings.members_count : null,
    left: isChat && ['left', 'kicked'].includes(chat_settings.state),
    muted: push_settings && push_settings.disabled_forever,
    unread: conversation.unread_count || 0,
    photo: isChat ? getPhoto(chat_settings.photo) : null,
    title: isChat ? escape(chat_settings.title).replace(/\n/g, ' ') : null,
    canWrite: conversation.can_write.allowed,
    keyboard: conversation.current_keyboard || null,
    last_msg_id: conversation.last_message_id,
    // id последнего прочтенного входящего сообщения
    in_read: conversation.in_read,
    // id последнего прочтенного исходящего сообщения
    out_read: conversation.out_read,
    mentions: conversation.mentions || [],
    pinnedMsg: isChat && chat_settings.pinned_message ? parseMessage(chat_settings.pinned_message) : null,
    chatSettings: isChat ? chat_settings : null,
    owner_id: isChat ? chat_settings.owner_id : null,
    admin_ids: isChat ? chat_settings.admin_ids : null,
    loaded: true
  };
}

export function parseMessage(message: Message): ParsedMessage {
  if (message.geo) {
    message.attachments.push({
      type: 'geo',
      geo: message.geo
    });
  }

  // Поле fwd_messages отсутствует в ответе, пересланном сообщении и закрепе
  const fwdCount = message.fwd_messages ? message.fwd_messages.length : 0;
  const isReplyMsg = !!message.reply_message;
  const hasAttachment = fwdCount || isReplyMsg || message.attachments.length;
  const attachments = {};

  for (const attachDescription of message.attachments) {
    let { type } = attachDescription;
    const attach = attachDescription[type];

    if (type === 'link') {
      const playlistRE = /https:\/\/m\.vk\.com\/audio\?act=audio_playlist(\d+)_(\d+)/;
      const artistRE = /https:\/\/m\.vk\.com\/artist\/(.+?)\?/;
      const articleRE = /https:\/\/m\.vk\.com\/@/;

      if (playlistRE.test(attach.url)) {
        type = 'audio_playlist';
      } else if (artistRE.test(attach.url)) {
        type = 'artist';
      } else if (articleRE.test(attach.url)) {
        // articles.getByLink с ссылкой в поле links
        type = 'article';
      }
    }

    if (attachments[type]) {
      attachments[type].push(attach);
    } else {
      attachments[type] = [attach];
    }
  }

  return {
    id: message.id,
    text: escape(message.text).replace(/\n/g, '<br>'),
    from: message.from_id,
    date: message.date,
    out: message.from_id === store.state.users.activeUser,
    editTime: message.update_time || 0,
    hidden: message.is_hidden,
    action: message.action,
    fwdCount,
    fwdMessages: (message.fwd_messages || []).map(parseMessage),
    isReplyMsg,
    replyMsg: isReplyMsg && parseMessage(message.reply_message),
    attachments,
    conversation_msg_id: message.conversation_message_id,
    random_id: message.random_id,
    was_listened: !!message.was_listened,
    hasAttachment,
    isContentDeleted: !message.text && !message.action && !hasAttachment,
    keyboard: message.keyboard,
    template: message.template
  };
}

export function getMessagePreview(msg): string | void {
  if (msg.text) {
    return msg.text;
  } else if (msg.hasAttachment) {
    const { isReplyMsg, fwdCount, attachments } = msg;
    const [attachName] = Object.keys(attachments);

    if (attachName) {
      const count = attachments[attachName].length;
      const translate = getTranslate('im_attachments', attachName, [count], count);

      if (!translate) {
        console.warn('[im] Неизвестное вложение:', attachName, `(${count})`);
        return capitalize(attachName);
      }

      return translate;
    }

    if (isReplyMsg) {
      return getTranslate('im_replied');
    }

    if (fwdCount < 0) {
      return getTranslate('im_forwarded_some');
    }

    return getTranslate('im_forwarded', [fwdCount], fwdCount);
  }
}

export function getPeerOnline(peer_id: number, peer: ParsedConversation, owner): string {
  if (!peer || !peer.left && peer_id > 2e9 && peer.members == null) {
    return getTranslate('loading');
  }

  if (peer_id < 0) {
    return getTranslate('im_chat_group');
  }

  if (peer_id > 2e9) {
    const { chatSettings, members, channel, left } = peer;

    if (chatSettings.state === 'kicked') {
      return getTranslate('im_chat_kicked');
    } else if (left) {
      return getTranslate(channel ? 'im_chat_left_channel' : 'im_chat_left');
    } else {
      return getTranslate('im_chat_members', [members], members);
    }
  }

  if (!owner) {
    return getTranslate('loading');
  }

  if (owner.deactivated) {
    return getTranslate('im_user_deleted');
  }

  const { online, online_mobile, online_app, online_info: info, last_seen } = owner;

  if (online) {
    const appName = online_app > 0 && getAppName(online_app);

    if (appName) {
      return getTranslate('im_chat_online', 2, [appName]);
    } else {
      return getTranslate('im_chat_online', online_mobile ? 1 : 0);
    }
  }

  const isGirl = owner.sex === 1;

  if (!info.visible) {
    return getTranslate(`im_chat_online_${info.status}`, isGirl);
  }

  if (last_seen) {
    return getLastOnlineDate(new Date(last_seen.time * 1000), isGirl);
  }

  // У @id333 не приходит last_seen
  return '';
}

export function getPeerAvatar(peer_id, peer, owner) {
  if (peer_id > 2e9) {
    return peer && !peer.left && peer.photo || 'assets/im_chat_photo.png';
  } else {
    return getPhoto(owner) || 'assets/blank.gif';
  }
}

export function getPeerTitle(peer_id, peer, owner) {
  if (peer_id > 2e9) {
    return peer && peer.title || '...';
  } else if (owner) {
    return owner.name || `${owner.first_name} ${owner.last_name}`;
  }

  return '...';
}

export function getLastMsgId() {
  const [peer] = store.getters['messages/peersList'];
  return peer && peer.msg.id;
}

export async function loadConversation(id) {
  const { items: [conv], profiles, groups } = await vkapi('messages.getConversationsById', {
    peer_ids: id,
    extended: 1,
    fields
  });

  store.commit('addProfiles', concatProfiles(profiles, groups));
  store.commit('messages/updateConversation', {
    peer: parseConversation(conv)
  });
}

export const loadedConvMembers = new Set();

export async function loadConversationMembers(id, force) {
  if (loadedConvMembers.has(id) && !force) {
    return;
  }

  loadedConvMembers.add(id);

  try {
    const { profiles, groups } = await vkapi('messages.getConversationMembers', {
      peer_id: id,
      fields
    });

    store.commit('addProfiles', concatProfiles(profiles, groups));
  } catch (err) {
    // Пользователь исключен/вышел из беседы, но т.к. юзер может вернуться,
    // здесь удаляется пометка беседы как загруженная для возможности повторить попытку
    if (err.error_code === 917) {
      loadedConvMembers.delete(id);
    }
  }
}

const activeNotificationsTimers = new Map();

export function addNotificationsTimer({ peer_id, disabled_until }, remove) {
  if (activeNotificationsTimers.has(peer_id)) {
    clearTimeout(activeNotificationsTimers.get(peer_id));
  }

  if (remove) {
    return activeNotificationsTimers.delete(peer_id);
  }

  activeNotificationsTimers.set(
    peer_id,
    setTimeout(() => {
      activeNotificationsTimers.delete(peer_id);

      store.commit('messages/updateConversation', {
        peer: {
          id: peer_id,
          muted: false
        }
      });
    }, disabled_until * 1000 - Date.now())
  );
}

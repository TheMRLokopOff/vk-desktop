import { nextTick } from 'vue';
import { random, eventBus } from './utils';
import vkapi, { VkapiError } from './vkapi';
import store from './store';
import { VKKeyboard, VKKeyboardButton } from 'types';
import { MessagesSend, MessagesSendParams } from 'types/methods';

let counter = 0;

function parseInputText(nodes: NodeListOf<ChildNode>) {
  let text = '';

  for (const node of nodes || []) {
    switch (node.nodeName) {
      case '#text':
        text += (node as Text).data.replace(/\n/g, '');
        break;

      case 'BR':
        text += '\n';
        break;

      case 'IMG':
        text += (node as HTMLImageElement).alt;
        break;

      default:
        text += (node as HTMLElement).innerText;
        break;
    }
  }

  return text.trim().replace(/\n/g, '<br>');
}

function getMessage(peer_id: number, msg_id: number) {
  const messages = store.state.messages.messages[peer_id];
  return messages && messages.find((msg) => msg.id === msg_id);
}

interface SendMessageParams {
  peer_id: number
  input?: HTMLInputElement
  keyboardButton?: Pick<VKKeyboard, 'author_id' | 'one_time'> & Pick<VKKeyboardButton, 'action'>
  reply_to?: number
  // TODO VKMessageParsed
  fwdMessages?: any[]
}

// TODO переписать полностью
export default async function sendMessage({
  peer_id, input, keyboardButton, reply_to, fwdMessages = []
}: SendMessageParams) {
  const random_id = random(-2e9, 2e9);
  let message: string;

  if (keyboardButton) {
    const { author_id, action, one_time } = keyboardButton;
    // Почему-то в группах приходит screen_name вместо domain
    const { screen_name } = store.state.profiles[author_id];

    if (one_time) {
      store.commit('messages/updateConversation', {
        peer: {
          id: peer_id,
          keyboard: {}
        }
      });
    }

    message = peer_id > 2e9 ? `@${screen_name} ${action.label}` : action.label;
  } else {
    message = parseInputText(input.childNodes);
  }

  if (!message && (!fwdMessages.length || reply_to)) {
    return false;
  }

  if (input) {
    input.innerHTML = '';
  }

  const msg_id = 'loading' + counter++;
  const payload = keyboardButton && keyboardButton.action.payload;

  const params: MessagesSendParams = {
    peer_id,
    message,
    random_id
  };

  if (payload) params.payload = payload;
  if (reply_to) params.reply_to = reply_to;

  if (fwdMessages.length) {
    params.forward_messages = fwdMessages.map((msg) => msg.id).join(',');
  }

  store.commit('messages/addLoadingMessage', {
    peer_id,
    msg: {
      id: msg_id,
      from: store.state.users.activeUser,
      out: true,
      text: message,
      date: (Date.now() / 1000).toFixed(),
      random_id,
      fwdCount: fwdMessages.length,
      fwdMessages: fwdMessages.sort((a, b) => a.id - b.id),
      attachments: {},
      hasReplyMsg: !!params.reply_to,
      replyMsg: params.reply_to && getMessage(peer_id, params.reply_to),
      editTime: 0,

      isLoading: true,
      params
    }
  });

  await nextTick();

  eventBus.emit('messages:event', 'jump', {
    msg_id,
    peer_id,
    bottom: true,
    noSmooth: true
  });

  vkapi<MessagesSend, MessagesSendParams>('messages.send', params, { android: true }).catch((err: VkapiError) => {
    store.commit('messages/editLoadingMessage', {
      peer_id,
      random_id,
      error: true
    });

    /**
     * 900 - Нельзя отправить пользователю из черного списка
     * 902 - Нельзя отправить сообщение из-за настроек приватности собеседника
     */
    if ([900, 902].includes(err.error_code)) {
      store.commit('messages/updateConversation', {
        peer: {
          id: peer_id,
          isWriteAllowed: false
        }
      });
    }
  });

  return true;
}

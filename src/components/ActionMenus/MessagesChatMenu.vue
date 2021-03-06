<template>
  <ActionsMenu ref="actionsMenu" :hideList="!peer">
    <div class="act_menu_item" @click="goToFirstMsg">
      <Icon name="arrow_up" class="act_menu_icon" />
      <div class="act_menu_data">{{ l('im_go_to_first_msg') }}</div>
    </div>

    <div v-if="peer && peer.pinnedMsg" class="act_menu_item" @click="togglePinnedMsg">
      <Icon :name="showPinnedMsg ? 'hide' : 'show'" class="act_menu_icon" />
      <div class="act_menu_data">{{ l('im_toggle_pinned_msg', showPinnedMsg) }}</div>
    </div>

    <div
      v-if="peer && peer.pinnedMsg && peer.acl.can_change_pin"
      class="act_menu_item"
      @click="unpinMsg"
    >
      <Icon name="unpin" color="var(--icon-dark-gray)" class="act_menu_icon" />
      <div class="act_menu_data">{{ l('im_unpin_msg') }}</div>
    </div>

    <div class="act_menu_item" @click="toggleNotifications">
      <Icon
        :name="muted ? 'volume_active' : 'volume_muted'"
        color="var(--icon-dark-gray)"
        class="act_menu_icon"
      />
      <div class="act_menu_data">{{ l('im_toggle_notifications', !muted) }}</div>
    </div>

    <div v-if="!isChannel" class="act_menu_item" @click="clearHistory">
      <Icon name="trash" color="var(--icon-dark-gray)" class="act_menu_icon" />
      <div class="act_menu_data">{{ l('im_clear_history') }}</div>
    </div>

    <div v-if="peer_id > 2e9" class="act_menu_item" @click="leftFromChat">
      <template v-if="left">
        <Icon name="forward" color="var(--icon-dark-gray)" class="act_menu_icon" />
        <div class="act_menu_data">{{ l('im_toggle_left_state', isChannel ? 3 : 2) }}</div>
      </template>
      <template v-else>
        <Icon
          name="close"
          color="var(--icon-dark-gray)"
          class="act_menu_icon act_menu_close_icon"
        />
        <div class="act_menu_data">{{ l('im_toggle_left_state', isChannel ? 1 : 0) }}</div>
      </template>
    </div>
  </ActionsMenu>
</template>

<script>
import { reactive, computed, toRefs } from 'vue';
import { eventBus } from 'js/utils';
import { openModal } from 'js/modals';
import vkapi from 'js/vkapi';
import store from 'js/store';

import ActionsMenu from './ActionsMenu.vue';
import Icon from '../UI/Icon.vue';

export default {
  props: ['peer_id', 'peer'],

  components: {
    ActionsMenu,
    Icon
  },

  setup(props) {
    const state = reactive({
      actionsMenu: null,

      muted: computed(() => props.peer && props.peer.muted),
      left: computed(() => props.peer && props.peer.left),
      isChannel: computed(() => props.peer && props.peer.isChannel),
      hiddenPinnedMessages: computed(() => ({
        ...store.getters['settings/settings'].hiddenPinnedMessages
      })),
      showPinnedMsg: computed(() => !state.hiddenPinnedMessages[props.peer_id])
    });

    function goToFirstMsg() {
      state.actionsMenu.setActive(false);

      eventBus.emit('messages:event', 'jump', {
        peer_id: props.peer_id,
        top: true
      });
    }

    function togglePinnedMsg() {
      state.actionsMenu.setActive(false);

      const { hiddenPinnedMessages } = state;

      if (state.showPinnedMsg) {
        hiddenPinnedMessages[props.peer_id] = true;
      } else {
        delete hiddenPinnedMessages[props.peer_id];
      }

      store.commit('settings/updateUserSettings', {
        hiddenPinnedMessages
      });
    }

    function unpinMsg() {
      state.actionsMenu.setActive(false);

      vkapi('messages.unpin', {
        peer_id: props.peer_id
      });
    }

    function toggleNotifications() {
      state.actionsMenu.setActive(false);

      vkapi('account.setSilenceMode', {
        peer_id: props.peer_id,
        time: state.muted ? 0 : -1
      });
    }

    function clearHistory() {
      state.actionsMenu.setActive(false);

      openModal('clear-history', {
        peer_id: props.peer_id
      });
    }

    function leftFromChat() {
      state.actionsMenu.setActive(false);

      if (state.isChannel) {
        eventBus.emit('messages:event', 'changeLoadedState', {
          peer_id: props.peer_id,
          loadedUp: !state.left,
          loadedDown: !state.left
        });
      }

      vkapi(state.left ? 'messages.addChatUser' : 'messages.removeChatUser', {
        chat_id: props.peer_id - 2e9,
        user_id: store.state.users.activeUserID
      });
    }

    return {
      ...toRefs(state),

      goToFirstMsg,
      togglePinnedMsg,
      unpinMsg,
      toggleNotifications,
      clearHistory,
      leftFromChat
    };
  }
};
</script>

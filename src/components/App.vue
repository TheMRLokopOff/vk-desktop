<template>
  <div :class="['root', { mac }]">
    <Titlebar />

    <div class="app">
      <LeftMenu v-if="activeUser" />
      <RouterView />

      <ModalsWrapper />
      <ContextMenuWrapper />
      <SnackbarsWrapper />
      <TooltipsWrapper />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, computed, watch } from 'vue';
import { fields, concatProfiles } from 'js/utils';
import { addNotificationsTimer, parseMessage, parseConversation } from 'js/messages';
import { ExecuteInit, ExecuteInitParams } from 'types/methods';
import vkapi from 'js/vkapi';
import store from 'js/store';
import router from 'js/router';
import request from 'js/request';
import longpoll from 'js/longpoll';
import * as auth from './auth';

import 'css/shared.css';
import 'css/colors.css';

import Titlebar from './Titlebar.vue';
import LeftMenu from './menu/LeftMenu.vue';
import ModalsWrapper from './ModalsWrapper.vue';
import ContextMenuWrapper from './ContextMenus/ContextMenuWrapper.vue';
import SnackbarsWrapper from './SnackbarsWrapper.vue';
import TooltipsWrapper from './TooltipsWrapper.vue';

// Для разработки и отлова ошибок
(window as any).vkapi = vkapi;
(window as any).store = store;
(window as any).router = router;
(window as any).request = request;
(window as any).longpoll = longpoll;
(window as any).auth = auth;

export default defineComponent({
  components: {
    Titlebar,
    LeftMenu,
    ModalsWrapper,
    ContextMenuWrapper,
    SnackbarsWrapper,
    TooltipsWrapper
  },

  setup() {
    const state = reactive({
      mac: process.platform === 'darwin',
      activeUser: computed(() => store.state.users.activeUser)
    });

    async function initUser() {
      if (!state.activeUser) {
        return;
      }

      router.replace('/messages');

      const {
        user,
        counters,
        pinnedPeers,
        profiles,
        groups,
        lp,
        temporarilyDisabledNotifications,
        firstConversations
      } = await vkapi<ExecuteInit, ExecuteInitParams>('execute.init', {
        lp_version: longpoll.version,
        fields
      });

      store.commit('users/updateUser', user);
      store.commit('setMenuCounters', counters);
      store.commit('addProfiles', concatProfiles(profiles, groups));

      for (const { peer, msg } of pinnedPeers) {
        store.commit('messages/updateConversation', {
          peer: parseConversation(peer),
          msg: msg.id ? parseMessage(msg) : {}
        });
      }

      store.commit('messages/addConversations', firstConversations.map((conversation) => ({
        peer: parseConversation(conversation.conversation),
        msg: conversation.last_message ? parseMessage(conversation.last_message) : {}
      })));

      store.state.messages.pinnedPeers = pinnedPeers.map(({ peer }) => peer.peer.id);

      longpoll.start(lp);

      for (const peer of temporarilyDisabledNotifications) {
        addNotificationsTimer(peer);
      }
    }

    initUser();
    watch(() => state.activeUser, initUser);

    return state;
  }
});
</script>

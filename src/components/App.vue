<template>
  <div :class="['root', { mac }]">
    <Titlebar />

    <div class="app">
      <MainMenu v-if="activeUser" />
      <RouterView />

      <ModalsWrapper />
      <ContextMenuWrapper />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, computed, onMounted, watch } from 'vue';
import router from 'js/router';
import store from 'js/store';
import vkapi from 'js/vkapi';
import request from 'js/request';
import { fields, concatProfiles } from 'js/utils';
import { addNotificationsTimer, parseMessage, parseConversation } from 'js/messages';
import longpoll from 'js/longpoll';

import 'css/shared.css';
import 'css/colors.css';

import Titlebar from './Titlebar.vue';
import MainMenu from './MainMenu.vue';
import ModalsWrapper from './ModalsWrapper.vue';
import ContextMenuWrapper from './ContextMenus/ContextMenuWrapper.vue';

// для разработки / дебага
(window as any).vkapi = vkapi;
(window as any).store = store;
(window as any).router = router;
(window as any).longpoll = longpoll;
(window as any).request = request;

export default defineComponent({
  components: {
    Titlebar,
    MainMenu,
    ModalsWrapper,
    ContextMenuWrapper
  },

  setup() {
    const state = reactive({
      mac: process.platform === 'darwin',
      activeUser: computed(() => store.state.users.activeUser)
    });

    async function initUser() {
      if (!state.activeUser) {
        return router.replace('/auth');
      }

      router.replace('/messages');

      const {
        user,
        counters,
        pinnedPeers,
        profiles,
        groups,
        lp,
        temporarilyDisabledNotifications
      } = await vkapi('execute.init', {
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

      store.commit('settings/updateUserSettings', {
        pinnedPeers: pinnedPeers.map(({ peer }) => peer.peer.id)
      });

      longpoll.start(lp);

      for (const peer of temporarilyDisabledNotifications) {
        addNotificationsTimer(peer);
      }
    }

    onMounted(() => router.isReady().then(initUser));
    watch(() => state.activeUser, initUser);

    return state;
  }
});
</script>

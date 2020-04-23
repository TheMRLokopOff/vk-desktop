<template>
  <AuthForm v-if="!isConfirm" :isModal="isModal" @confirm="onConfirm" />
  <AuthConfirm v-else :isModal="isModal" :params="params" @back="onBack" />
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs } from 'vue';

import AuthForm from './AuthForm.vue';
import AuthConfirm from './AuthConfirm.vue';

export default defineComponent({
  props: ['isModal'],

  components: {
    AuthForm,
    AuthConfirm
  },

  setup() {
    const state = reactive({
      isConfirm: false,
      params: null
    });

    function onConfirm(params) {
      state.isConfirm = true;
      state.params = params;
    }

    function onBack() {
      state.isConfirm = false;
    }

    return {
      ...toRefs(state),

      onConfirm,
      onBack
    };
  }
});
</script>

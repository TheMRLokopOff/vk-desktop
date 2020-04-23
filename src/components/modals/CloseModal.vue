<template>
  <Icon
    v-if="closable"
    name="close"
    color="var(--blue-background-text)"
    class="modal_header_close"
    @click.stop="close"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { closeModal } from 'js/modals';

import Icon from '../UI/Icon.vue';

export default defineComponent({
  props: ['closable', 'isSettings'],

  components: {
    Icon
  },

  methods: {
    close() {
      const parent = this.isSettings ? this.$parent : this.$parent.$parent;

      closeModal(parent.$attrs['data-name']);
    }
  }
});
</script>

<style>
.modal_header_close {
  width: 40px;
  height: 40px;
  padding: 12px;
  border-radius: 50%;
  cursor: pointer;
  opacity: .7;
  transition: opacity .3s;
}

.modal_header_close:hover {
  opacity: 1;
}
</style>

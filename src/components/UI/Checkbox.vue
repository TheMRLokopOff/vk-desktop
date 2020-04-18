<template>
  <div :class="['checkbox', { active }]">
    <Icon v-if="active" name="done" color="var(--blue-background-text)" />
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import Icon from './Icon.vue';

export default defineComponent({
  props: ['active'],

  components: {
    Icon
  }
});
</script>

<style>
.checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 5px;
}

.checkbox.active {
  background: var(--icon-blue);
}

.checkbox:not(.active) {
  border: 2px solid var(--icon-gray);
}
</style>

<template>
  <div class="settings_wrap">
    <div class="settings">
      <div class="settings_header">
        <div class="settings_header_text text-overflow">{{ l('ml_settings_header') }}</div>
        <div class="settings_header_close">
          <CloseModal :closable="true" />
        </div>
      </div>
      <div class="settings_content">
        <div class="settings_left_panel">
          <Ripple
            v-for="section of sections"
            :key="section.name"
            color="var(--hover-background-ripple)"
            :class="['settings_left_item', { active: section.name === activeSection }]"
            @click="activeSection = section.name"
          >
            <Icon :name="section.icon" color="var(--accent)" />
            <div class="settings_left_name">{{ l('ml_settings_sections', section.name) }}</div>
          </Ripple>
        </div>
        <div class="settings_right_panel">
          <KeepAlive>
            <component :is="activeSection" />
          </KeepAlive>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CloseModal from './CloseModal.vue';
import Icon from '../UI/Icon.vue';
import Ripple from '../UI/Ripple.vue';

import Developers from './settingsSections/Developers.vue';

export default {
  components: {
    CloseModal,
    Icon,
    Ripple,

    Developers
  },

  setup() {
    return {
      activeSection: 'developers',
      sections: [
        { name: 'developers', icon: 'bug' }
      ]
    };
  }
};
</script>

<style>
.settings_wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  /* - 40px вместо margin 20px 0  */
  height: calc(100% - 40px);
  margin: 0 20px;
  max-width: 700px;
}

.settings {
  width: 100%;
  height: 100%;
  background: var(--background);
  border-radius: 10px;
  box-shadow: 0 1px 10px rgba(0, 0, 0, .25);
}

.settings_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  font-size: 18px;
  font-weight: 500;
  padding-left: 22px;
  border-bottom: 1px solid var(--separator);
}

.settings_header_close {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 64px;
}

.settings_header .modal_header_close {
  color: var(--icon-dark-gray);
}

.settings_content {
  display: flex;
  height: calc(100% - 64px);
}

.settings_left_panel {
  border-right: 1px solid var(--separator);
  padding: 12px;
  height: 100%;
  flex: none;
}

.settings_left_item {
  display: flex;
  align-items: center;
  line-height: 36px;
  height: 36px;
  border-radius: 8px;
  margin-bottom: 5px;
  transition: background-color .3s;
}

.settings_left_item svg {
  width: 22px;
  height: 22px;
  margin: 0 10px 0 12px;
}

.settings_left_name {
  padding-right: 20px;
}

.settings_left_item:hover,
.settings_left_item.active {
  background: var(--hover-background);
}

.settings_right_panel {
  padding: 14px 32px;
  width: 100%;
}

@media screen and (max-width: 650px) {
  .settings_wrap, .settings {
    margin: 0;
    height: 100%;
  }

  .settings_left_item svg {
    margin: 0 10px;
  }

  .settings_left_name {
    display: none;
  }
}

.settings_line {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  color: var(--text-dark-steel-gray);
}

.settings_line.clickable {
  cursor: pointer;
}

.settings_line .checkbox {
  margin-left: 20px;
}
</style>

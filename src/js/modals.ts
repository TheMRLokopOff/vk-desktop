import { reactive, computed } from 'vue';

export const modalsState = reactive({
  modals: {},
  hasModals: computed(() => !!Object.keys(modalsState.modals).length)
});

export function openModal(name: string, props: { [key: string]: any }) {
  modalsState.modals[name] = {
    name,
    props
  };
}

export function closeModal(name: string) {
  delete modalsState.modals[name];
}

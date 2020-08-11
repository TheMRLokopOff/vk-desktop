import { reactive, computed } from 'vue';

interface IModal {
  name: string
  props?: Record<string, any>
}

export const modalsState = reactive({
  modals: {} as Record<string, IModal>,
  hasModals: computed<boolean>(() => !!Object.keys(modalsState.modals).length)
});

export function openModal(name: IModal['name'], props?: IModal['props']) {
  modalsState.modals[name] = {
    name,
    props
  };
}

export function closeModal(name: string) {
  delete modalsState.modals[name];
}

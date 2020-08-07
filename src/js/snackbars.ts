import { reactive } from 'vue';

let id = 0;

interface SnackbarData {
  text?: string
  icon?: string
}

interface ISnackbarsState {
  snackbars: ({ id: number } & SnackbarData)[]
}

export const snackbarsState = reactive<ISnackbarsState>({
  snackbars: []
});

export function addSnackbar(data: SnackbarData) {
  const item = {
    id: id++,
    ...data
  };

  snackbarsState.snackbars.push(item);

  setTimeout(() => {
    snackbarsState.snackbars.splice(
      snackbarsState.snackbars.indexOf(item),
      1
    );
  }, 2000);
}

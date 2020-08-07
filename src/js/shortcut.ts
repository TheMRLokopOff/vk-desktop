import { currentWindow } from './utils';

const pressedKeys = new Set<string>();
// Предполагается, что одно и то же сочетание клавиш будет обрабатываться один раз
const callbacks = new Map<string, () => void>();

function getKeyName({ key, code }: KeyboardEvent) {
  return code.startsWith('Key') ? code.slice(3) : key;
}

window.addEventListener('keydown', (event) => {
  pressedKeys.add(getKeyName(event));

  for (const [accelerator, callback] of callbacks) {
    if (accelerator.split('+').every((key) => pressedKeys.has(key))) {
      callback();
    }
  }
});

window.addEventListener('keyup', (event) => {
  pressedKeys.delete(getKeyName(event));
});

currentWindow.webContents.on('devtools-opened', () => {
  pressedKeys.clear();
});

export default function(accelerators: string[], callback: () => void) {
  for (const accelerator of accelerators) {
    callbacks.set(accelerator, callback);
  }

  return function() {
    for (const accelerator of accelerators) {
      callbacks.delete(accelerator);
    }
  };
}

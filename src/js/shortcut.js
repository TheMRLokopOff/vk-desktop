const pressedKeys = new Set();
// Предполагается, что одно и тоже сочетание клавиш будет обрабатываться один раз
const callbacks = new Map();

function getKeyName({ key, code }) {
  return /^Key/.test(code) ? code.slice(3) : key;
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

export default function(accelerators, callback) {
  for (const accelerator of accelerators) {
    callbacks.set(accelerator, callback);
  }

  return function() {
    for (const accelerator of accelerators) {
      callbacks.delete(accelerator);
    }
  };
}

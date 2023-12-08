let keyMap = [];
let keyPool = "";
let timer = null;
const keyDelay = 400;
const ignoreKeys = [
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "Escape",
  "Enter",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
];

const mappingKeys = (...keys) => {
  keyMap = [...keyMap, ...keys];
};

document.addEventListener("keydown", ({ key, target }) => {
  if (target.tagName === "INPUT") return;
  if (ignoreKeys.includes(key)) return;

  keyPool += key;
  timer && clearTimeout(timer);
  timer = setTimeout(() => {
    keyMap.forEach(({ keys, action, type }) => {
      if (type === "regex") {
        const keyReg = new RegExp(`^${keys}$`);
        const [key, ...args] = keyPool.match(keyReg) ?? [];
        !!key && action && action(...args);
      } else {
        if (keys === keyPool) {
          action && action();
        }
      }
    });
    keyPool = "";
  }, keyDelay);
});

export { mappingKeys, keyMap };

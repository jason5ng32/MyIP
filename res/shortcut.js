let keyMap = [];
let keyPool = [];
const keyDelay = 700;

const mappingKeys = (map) => {
  keyMap = [...keyMap, ...map];
};

let timer = null;

document.addEventListener("keyup", (e) => {
  const { key, target } = e;
  if (target.tagName === "INPUT") return;

  keyPool.push(key);
  timer && clearTimeout(timer);
  timer = setTimeout(() => {
    keyPool = [];
  }, keyDelay);
  const strPool = keyPool.join("");
  keyMap.every((item) => {
    const keyReg = new RegExp(`${item.keys}$`);
    const [key, ...args] = strPool.match(keyReg) ?? [];
    if (key) {
      item.action && item.action(...args);
      return false;
    }
    return true;
  });
});

export { mappingKeys, keyMap };

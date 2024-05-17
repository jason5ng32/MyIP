let keyMap = [];
let keyPool = "";
let timer = null;
const keyDelay = 10;
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

// 导航
const navigateCards = (direction) => {
  const mainPart = document.getElementById('mainpart');
  const cardBodies = mainPart.querySelectorAll('.keyboard-shortcut-card');
  const cards = Array.from(cardBodies);
  let currentIndex = cards.findIndex(card => card.getAttribute('data-keyboard-hover') === 'true');

  if (currentIndex !== -1) {
    cards[currentIndex].classList.remove('hover', 'keyboard-hover');
    cards[currentIndex].removeAttribute('data-keyboard-hover');
  } else {
    currentIndex = -1; // 如果没有卡片高亮，则从第一张卡片开始
  }

  if (direction === 'down') {
    currentIndex = currentIndex < cards.length - 1 ? currentIndex + 1 : 0;
  } else if (direction === 'up') {
    currentIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
  }

  const currentCard = cards[currentIndex];
  currentCard.classList.add('keyboard-hover');
  currentCard.setAttribute('data-keyboard-hover', 'true');

  const cardTop = currentCard.getBoundingClientRect().top + window.pageYOffset;
  window.scrollTo({ top: cardTop - 200, behavior: 'smooth' });
};



document.addEventListener(
  "keydown",
  (event) => {
    const { key, target, metaKey, altKey, ctrlKey } = event;

    if (target.tagName === "INPUT") return;
    if (metaKey || altKey || ctrlKey) return;

    if (key === 'j' || key === 'k') {
      event.preventDefault(); // 阻止 'j' 和 'k' 的默认焦点行为
    }

    keyPool += ignoreKeys.includes(key) ? "" : key;
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
  }
);


export { mappingKeys, navigateCards, keyMap };

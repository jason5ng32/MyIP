// Global keyboard-shortcut dispatcher.
//
// One document-level keydown listener collects the typed keys and runs every
// registered entry that matches — unless an overlay is open.
//
// Overlays (Dialog / Sheet / Drawer) suspend every shortcut while they cover
// the page: their effects would happen out of sight, and a home-page action
// fired from inside a tool panel is never what the visitor meant. The rule is
// about the component's form, not its purpose, so it needs no per-overlay
// bookkeeping — the `ui/` roots register themselves through
// composables/use-overlay-shortcuts.js and anything built on them inherits it.
// Esc and the native scrolling keys are untouched (see ignoreKeys); they
// belong to reka-ui / vaul and the browser.

const keyMap = [];
// How many overlays are currently on screen — a count, not a flag, because a
// dialog can open over a drawer and each closes independently.
let overlayDepth = 0;
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

// Replaces the whole map rather than appending: Home re-mounting (route away
// and back) re-registers instead of stacking a second copy of every action.
// Called with [] when Home unmounts, so a keystroke on another route can't
// reach its unmounted refs.
const registerShortcuts = (entries) => {
  keyMap.length = 0;
  keyMap.push(...entries);
};

const openOverlay = () => {
  overlayDepth += 1;
};

const closeOverlay = () => {
  overlayDepth = Math.max(0, overlayDepth - 1);
};

const isOverlayOpen = () => overlayDepth > 0;

// Pure: the actions the given keystrokes match. Regex entries pass their
// captured groups through as arguments.
const collectShortcutActions = (pool, entries = keyMap) =>
  entries.flatMap(({ keys, action, type }) => {
    if (type === 'regex') {
      const [matched, ...args] = pool.match(new RegExp(`^${keys}$`)) ?? [];
      return matched && action ? [() => action(...args)] : [];
    }
    return keys === pool && action ? [action] : [];
  });

// Navigation
const navigateCards = (direction) => {
  const mainPart = document.getElementById('mainpart');
  const cardBodies = mainPart.querySelectorAll('.keyboard-shortcut-card');
  const cards = Array.from(cardBodies);
  let currentIndex = cards.findIndex(card => card.getAttribute('data-keyboard-hover') === 'true');

  if (currentIndex !== -1) {
    cards[currentIndex].classList.remove('hover', 'keyboard-hover');
    cards[currentIndex].removeAttribute('data-keyboard-hover');
  } else {
    currentIndex = -1; // If no card is highlighted, start from the first card
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

    // vConsole renders inside its own Shadow DOM, so when the user types in
    // its filter / eval inputs the event's `target` (as seen from document)
    // is the shadow host — typically a DIV — not the INPUT. The tagName
    // guard below would let those keystrokes through and fire our global
    // shortcuts. main.js sets this flag when vConsole boots; dev + mobile
    // only, so prod is unaffected (the flag is undefined → falsy).
    if (window.__vConsoleActive) return;

    // Before anything else, including the preventDefault below: inside an
    // overlay the page's keys belong to the browser, not to us.
    if (isOverlayOpen()) return;

    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (target.isContentEditable) return;
    if (metaKey || altKey || ctrlKey) return;

    if (key === 'j' || key === 'k') {
      event.preventDefault(); // Prevent default focus behavior of 'j' and 'k'
    }

    keyPool += ignoreKeys.includes(key) ? "" : key;
    timer && clearTimeout(timer);
    timer = setTimeout(() => {
      collectShortcutActions(keyPool).forEach((run) => run());
      keyPool = "";
    }, keyDelay);
  }
);


export {
  registerShortcuts,
  openOverlay,
  closeOverlay,
  isOverlayOpen,
  collectShortcutActions,
  navigateCards,
  keyMap,
};

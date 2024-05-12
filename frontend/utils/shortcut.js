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
  window.scrollTo({ top: cardTop - 60, behavior: 'smooth' });
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

// 快捷键
function ShortcutKeys(vm, isOriginalSite) {
  const shortcutConfig = [
    {
      keys: "g",
      action: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        vm.$trackEvent('ShortCut', 'ShortCut', 'GoToTop');
      },
      description: vm.$t('shortcutKeys.GoToTop'),
    },
    {
      keys: 'j',
      action: () => {
        navigateCards('down'),
          vm.$trackEvent('ShortCut', 'ShortCut', 'GoNext');
      },
      description: vm.$t('shortcutKeys.GoNext'),
    },
    {
      keys: 'k',
      action: () => {
        navigateCards('up'),
          vm.$trackEvent('ShortCut', 'ShortCut', 'GoPrevious');
      },
      description: vm.$t('shortcutKeys.GoPrevious'),
    },
    {
      keys: "G",
      action: () => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
        vm.$trackEvent('ShortCut', 'ShortCut', 'GoToBottom');
      },
      description: vm.$t('shortcutKeys.GoToBottom'),
    },
    {
      keys: "R",
      action: () => {
        vm.$store.commit('setRefreshEveryThing', true);
        vm.$trackEvent('ShortCut', 'ShortCut', 'RefreshEverything');
      },

      description: vm.$t('shortcutKeys.RefreshEverything'),
    },
    {
      keys: "([1-6])",
      type: "regex",
      action: (num) => {
        if (num > vm.userPreferences.ipCardsToShow) {
          return
        }
        const card = vm.$refs.IPCheckRef.ipDataCards[num - 1];
        vm.scrollToElement("IPInfo-" + num, 171);
        vm.$refs.IPCheckRef.refreshCard(card);
        vm.$trackEvent('ShortCut', 'ShortCut', 'IPCheck');
      },
      description: vm.$t('shortcutKeys.RefreshIPCard'),
    },
    {
      keys: "c",
      action: () => {
        vm.scrollToElement("Connectivity", 80);
        vm.$refs.connectivityRef.checkAllConnectivity(false, true, true);
        vm.$trackEvent('ShortCut', 'ShortCut', 'Connectivity');
      },
      description: vm.$t('shortcutKeys.RefreshConnectivityTests'),
    },
    {
      keys: "w",
      action: () => {
        vm.scrollToElement("WebRTC", 80);
        vm.$refs.webRTCRef.checkAllWebRTC(false);
        vm.$trackEvent('ShortCut', 'ShortCut', 'WebRTC');
      },
      description: vm.$t('shortcutKeys.RefreshWebRTC'),
    },
    {
      keys: "d",
      action: () => {
        vm.scrollToElement("DNSLeakTest", 80);
        vm.$refs.dnsLeaksRef.checkAllDNSLeakTest(true);
        vm.$trackEvent('ShortCut', 'ShortCut', 'DNSLeakTest');
      },
      description: vm.$t('shortcutKeys.RefreshDNSLeakTest'),
    },
    {
      keys: "s",
      action: () => {
        vm.scrollToElement("SpeedTest", 80);
        vm.$refs.speedTestRef.speedTestController();
        vm.$trackEvent('ShortCut', 'ShortCut', 'SpeedTest');
      },
      description: vm.$t('shortcutKeys.SpeedTestButton'),
    },
    {
      keys: "l",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/pingtest');
        vm.$trackEvent('Nav', 'NavClick', 'PingTest');
      },
      description: vm.$t('shortcutKeys.PingTest'),
    },
    {
      keys: "t",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/mtrtest');
        vm.$trackEvent('Nav', 'NavClick', 'MTRTest');
      },
      description: vm.$t('shortcutKeys.MTRTest'),
    },
    {
      keys: "r",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/ruletest');
        vm.$trackEvent('Nav', 'NavClick', 'RuleTest');
      },
      description: vm.$t('shortcutKeys.RuleTest'),
    },
    {
      keys: "n",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/dnsresolver');
        vm.$trackEvent('Nav', 'NavClick', 'DNSResolver');
      },
      description: vm.$t('shortcutKeys.DNSResolver'),
    },
    {
      keys: "b",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/censorshipcheck');
        vm.$trackEvent('Nav', 'NavClick', 'CensorshipCheck');
      },
      description: vm.$t('shortcutKeys.CensorshipCheck'),
    },
    {
      keys: "w",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/whois');
        vm.$trackEvent('Nav', 'NavClick', 'Whois');
      },
      description: vm.$t('shortcutKeys.Whois'),
    },
    {
      keys: "m",
      action: () => {
        if (vm.configs.bingMap) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          vm.$refs.preferencesRef.toggleMaps();
        };
        vm.$trackEvent('ShortCut', 'ShortCut', 'ToggleMaps');
      },
      description: vm.$t('shortcutKeys.ToggleMaps'),
    },
    {
      keys: "q",
      action: () => {
        vm.openModal("IPCheck");
        vm.$refs.queryIPRef.openQueryIP();
        vm.$trackEvent('ShortCut', 'ShortCut', 'QueryIP');
      },
      description: vm.$t('shortcutKeys.IPCheck'),
    },
    {
      keys: "h",
      action: () => {
        vm.isInfosLoaded && vm.toggleInfoMask();
        vm.$trackEvent('ShortCut', 'ShortCut', 'ToggleInfoMask');
      },
      description: vm.$t('shortcutKeys.ToggleInfoMask'),
    },
    {
      keys: "p",
      action: () => {
        vm.$refs.navBarRef.OpenPreferences();
        vm.$trackEvent('ShortCut', 'ShortCut', 'Preferences');
      },
      description: vm.$t('shortcutKeys.Preferences'),
    },
    {
      keys: "a",
      action: () => {
        vm.$refs.footerRef.openAbout();
        vm.$trackEvent('ShortCut', 'ShortCut', 'About');
      },
      description: vm.$t('shortcutKeys.About'),
    },
    // help
    {
      keys: "?",
      action: () => {
        vm.openModal("helpModal");
        vm.$trackEvent('ShortCut', 'ShortCut', 'Help');
      },
      description: vm.$t('shortcutKeys.Help'),
    },
  ];

  const invisibilitytest = [
    {
      keys: "i",
      action: () => {
        vm.scrollToElement("AdvancedTools", 80);
        vm.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/invisibilitytest');
        vm.$trackEvent('Nav', 'NavClick', 'InvisibilityTest');
      },
      description: vm.$t('shortcutKeys.InvisibilityTest'),
    },
  ];

  if (isOriginalSite) {
    shortcutConfig.push(...invisibilitytest);
  }

  return shortcutConfig;
}

export { mappingKeys, navigateCards, keyMap, ShortcutKeys };

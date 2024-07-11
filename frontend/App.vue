<template>
  <NavBar ref="navBarRef" />
  <Preferences ref="preferencesRef" />
  <Alert />
  <div id="mainpart" class="container mt-5 jn-container">
    <div data-bs-spy="scroll" data-bs-target="#navbar-top" data-bs-root-margin="0px 0px -40%"
      data-bs-smooth-scroll="true" class="rounded-2" tabindex="0">
      <IPCheck ref="IPCheckRef" />
      <Connectivity ref="connectivityRef" />
      <WebRTC ref="webRTCRef" />
      <DNSLeaks ref="dnsLeaksRef" />
      <SpeedTest ref="speedTestRef" />
      <AdvancedTools ref="advancedToolsRef" />
    </div>
  </div>
  <InfoMask :showMaskButton.value="showMaskButton" :infoMaskLevel.value="infoMaskLevel"
    :toggleInfoMask="toggleInfoMask" />
  <QueryIP ref="queryIPRef" />
  <HelpModal ref="helpModalRef" />
  <Footer ref="footerRef" />
  <PWA />
  <Patch />
</template>

<script setup>

// Components
import NavBar from './components/Nav.vue';
import IPCheck from './components/IpInfos.vue';
import Connectivity from './components/ConnectivityTest.vue';
import WebRTC from './components/WebRtcTest.vue';
import DNSLeaks from './components/DnsLeaksTest.vue';
import SpeedTest from './components/SpeedTest.vue';
import AdvancedTools from './components/Advanced.vue';
import Footer from './components/Footer.vue';

// Widgets
import Preferences from './components/widgets/Preferences.vue';
import QueryIP from './components/widgets/QueryIP.vue';
import HelpModal from './components/widgets/Help.vue';
import PWA from './components/widgets/PWA.vue';
import Alert from './components/widgets/Toast.vue';
import InfoMask from './components/widgets/InfoMask.vue';
import Patch from './components/widgets/Patch.vue';

// Vue
import { ref, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';

// Utils
import { mappingKeys, keyMap, navigateCards } from "@/utils/shortcut.js";
import { maskedInfo } from "@/utils/masked-info.js";

const { t } = useI18n();


// Store
const store = useMainStore();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const shouldRefreshEveryThing = computed(() => store.shouldRefreshEveryThing);
const Status = computed(() => store.mountingStatus);

// Template 里的 Ref
const navBarRef = ref(null);
const preferencesRef = ref(null);
const queryIPRef = ref(null);
const helpModalRef = ref(null);
const footerRef = ref(null);
const speedTestRef = ref(null);
const advancedToolsRef = ref(null);
const IPCheckRef = ref(null);
const connectivityRef = ref(null);
const webRTCRef = ref(null);
const dnsLeaksRef = ref(null);


// Data
const infoMaskLevel = ref(0);
const isInfosLoaded = ref(false);
const originipDataCards = ref([]);
const originleakTest = ref([]);
const originstunServers = ref([]);
const alertStyle = ref("");
const alertMessage = ref("");
const alertTitle = ref("");
const alertToShow = ref(false);
const autoStart = ref(userPreferences.value.autoStart);
const showMaskButton = ref(false);

//
// 加载相关
//
// 加载完成后隐藏 loading
const hideLoading = () => {
  let loadingElement = document.getElementById("jn-loading");
  if (loadingElement) {
    loadingElement.style.display = "none";
  }
};
hideLoading();


// 事件控制
const loadingControl = (t1 = 0, t2 = 2000, t3 = 3000, t4 = 2500) => {
  const mountedStatus = Object.values(Status.value).every(Boolean);
  if (mountedStatus) {
    setTimeout(() => {
      IPCheckRef.value.checkAllIPs();
    }, t1);
    if (autoStart.value) {
      setTimeout(() => {
        connectivityRef.value.handelCheckStart();
      }, t2);
      setTimeout(() => {
        webRTCRef.value.checkAllWebRTC(false);
      }, t3);
      setTimeout(() => {
        dnsLeaksRef.value.checkAllDNSLeakTest(false);
      }, t4);
    } else {
      // 如果不自动运行，将剩余的加载状态设置为 true
      store.setLoadingStatus('connectivity', true);
      store.setLoadingStatus('webrtc', true);
      store.setLoadingStatus('dnsleaktest', true);
    }
  } else {
    // 递归检查
    setTimeout(() => {
      loadingControl();
    }, 1000);
  }
};

//
// 刷新相关
//
// 时间任务
const scheduleTimedTasks = (tasks) => {
  tasks.forEach(task => {
    setTimeout(() => {
      task.action();
      if (task.message) {
        displayAlert(task.message);
      }
    }, task.delay);
  });
};

// 刷新所有
const refreshEverything = () => {

  // 重置加载状态
  store.setLoadingStatus('connectivity', false);
  store.setLoadingStatus('webrtc', false);
  store.setLoadingStatus('dnsleaktest', false);
  store.setLoadingStatus('ipcheck', false);

  const refreshTasks = [
    { action: () => IPCheckRef.value.checkAllIPs(), delay: 0 },
    { action: () => connectivityRef.value.handelCheckStart(true), delay: 2000 },
    { action: () => webRTCRef.value.checkAllWebRTC(true), delay: 3000 },
    { action: () => dnsLeaksRef.value.checkAllDNSLeakTest(true), delay: 2500 },
    { action: () => refreshingAlert(), delay: 500 },
  ];
  scheduleTimedTasks(refreshTasks);
  infoMaskLevel.value = 0;
  store.setRefreshEveryThing(false);
};

// 刷新完成后显示 Toast
const refreshingAlert = () => {
  alertStyle.value = "text-success";
  alertMessage.value = t('alert.refreshEverythingMessage');
  alertTitle.value = t('alert.refreshEverythingTitle');
  alertToShow.value = true;
  store.setAlert(alertToShow.value, alertStyle.value, alertMessage.value, alertTitle.value);
};

//
// 信息遮罩相关
//
// 信息遮罩
const toggleInfoMask = () => {
  trackEvent('SideButtons', 'ToggleClick', 'InfoMask');
  if (infoMaskLevel.value === 0) {
    originipDataCards.value = JSON.parse(JSON.stringify(IPCheckRef.value.ipDataCards));
    originstunServers.value = JSON.parse(JSON.stringify(webRTCRef.value.stunServers));
    originleakTest.value = JSON.parse(JSON.stringify(dnsLeaksRef.value.leakTest));
    infoMask();
    alertStyle.value = "text-warning";
    alertMessage.value = t('alert.maskedInfoMessage_1');
    alertTitle.value = t('alert.maskedInfoTitle_1');
  } else if (infoMaskLevel.value === 1) {
    infoMask();
    alertStyle.value = "text-success";
    alertMessage.value = t('alert.maskedInfoMessage');
    alertTitle.value = t('alert.maskedInfoTitle');
  } else {
    infoUnmask();
    alertStyle.value = "text-danger";
    alertMessage.value = t('alert.unmaskedInfoMessage');
    alertTitle.value = t('alert.unmaskedInfoTitle');
  }
  alertToShow.value = true;
  store.setAlert(alertToShow.value, alertStyle.value, alertMessage.value, alertTitle.value);
};

// 信息遮罩内容
const infoMask = () => {
  if (infoMaskLevel.value === 0) {
    IPCheckRef.value.ipDataCards.forEach((card) => {
      if (card.id === "cloudflare_v6" || card.id === "ipify_v6") {
        card.ip = maskedInfo(t).ipv6;
      } else {
        card.ip = maskedInfo(t).ipv4;
      }
    });
    webRTCRef.value.stunServers.forEach((server) => {
      server.ip = maskedInfo(t).webrtcip;
    });
    dnsLeaksRef.value.leakTest.forEach((server) => {
      server.ip = maskedInfo(t).dnsendpoints;
    });
    infoMaskLevel.value = 1;
  } else if (infoMaskLevel.value === 1) {
    IPCheckRef.value.ipDataCards.forEach(card => {
      const maskedInfoData = maskedInfo(t);
      Object.assign(card, maskedInfoData);
    });
    dnsLeaksRef.value.leakTest.forEach((server) => {
      server.geo = maskedInfo(t).country_name;
    });
    infoMaskLevel.value = 2;
  }
};

// 信息遮罩内容还原
const infoUnmask = () => {
  const newIpDataCards = JSON.parse(JSON.stringify(originipDataCards.value));
  IPCheckRef.value.ipDataCards.splice(0, IPCheckRef.value.ipDataCards.length, ...newIpDataCards);

  const newStunServers = JSON.parse(JSON.stringify(originstunServers.value));
  webRTCRef.value.stunServers.splice(0, webRTCRef.value.stunServers.length, ...newStunServers);

  const newLeakTests = JSON.parse(JSON.stringify(originleakTest.value));
  dnsLeaksRef.value.leakTest.splice(0, dnsLeaksRef.value.leakTest.length, ...newLeakTests);

  infoMaskLevel.value = 0;
};


//
// 快捷键相关
//    
// 滚动到指定元素
const scrollToElement = (el, offset = 0) => {
  const element = typeof el === "string" ? document.getElementById(el) : el;
  const y = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: y, behavior: "smooth" });
};

const ShortcutKeys = (isOriginalSite) => {
  const shortcutConfig = [
    {
      keys: "g",
      action: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        trackEvent('ShortCut', 'ShortCut', 'GoToTop');
      },
      description: t('shortcutKeys.GoToTop'),
    },
    {
      keys: 'j',
      action: () => {
        navigateCards('down'),
          trackEvent('ShortCut', 'ShortCut', 'GoNext');
      },
      description: t('shortcutKeys.GoNext'),
    },
    {
      keys: 'k',
      action: () => {
        navigateCards('up'),
          trackEvent('ShortCut', 'ShortCut', 'GoPrevious');
      },
      description: t('shortcutKeys.GoPrevious'),
    },
    {
      keys: "G",
      action: () => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
        trackEvent('ShortCut', 'ShortCut', 'GoToBottom');
      },
      description: t('shortcutKeys.GoToBottom'),
    },
    {
      keys: "R",
      action: () => {
        store.setRefreshEveryThing(true);
        trackEvent('ShortCut', 'ShortCut', 'RefreshEverything');
      },

      description: t('shortcutKeys.RefreshEverything'),
    },
    {
      keys: "([1-6])",
      type: "regex",
      action: (num) => {
        if (num > userPreferences.ipCardsToShow) {
          return
        }
        const card = IPCheckRef.value.ipDataCards[num - 1];
        scrollToElement("IPInfo-" + num, 300);
        IPCheckRef.value.refreshCard(card, num - 1);
        trackEvent('ShortCut', 'ShortCut', 'IPCheck');
      },
      description: t('shortcutKeys.RefreshIPCard'),
    },
    {
      keys: "c",
      action: () => {
        scrollToElement("Connectivity", 80);
        connectivityRef.value.handelCheckStart(true);
        trackEvent('ShortCut', 'ShortCut', 'Connectivity');
      },
      description: t('shortcutKeys.RefreshConnectivityTests'),
    },
    {
      keys: "w",
      action: () => {
        scrollToElement("WebRTC", 80);
        webRTCRef.value.checkAllWebRTC(false);
        trackEvent('ShortCut', 'ShortCut', 'WebRTC');
      },
      description: t('shortcutKeys.RefreshWebRTC'),
    },
    {
      keys: "d",
      action: () => {
        scrollToElement("DNSLeakTest", 80);
        dnsLeaksRef.value.checkAllDNSLeakTest(true);
        trackEvent('ShortCut', 'ShortCut', 'DNSLeakTest');
      },
      description: t('shortcutKeys.RefreshDNSLeakTest'),
    },
    {
      keys: "s",
      action: () => {
        scrollToElement("SpeedTest", 80);
        speedTestRef.value.speedTestController();
        trackEvent('ShortCut', 'ShortCut', 'SpeedTest');
      },
      description: t('shortcutKeys.SpeedTestButton'),
    },
    {
      keys: "l",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/pingtest');
        trackEvent('Nav', 'NavClick', 'PingTest');
      },
      description: t('shortcutKeys.PingTest'),
    },
    {
      keys: "M",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/macchecker');
        trackEvent('Nav', 'NavClick', 'MacChecker');
      },
      description: t('shortcutKeys.MacChecker'),
    },
    {
      keys: "t",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/mtrtest');
        trackEvent('Nav', 'NavClick', 'MTRTest');
      },
      description: t('shortcutKeys.MTRTest'),
    },
    {
      keys: "r",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/ruletest');
        trackEvent('Nav', 'NavClick', 'RuleTest');
      },
      description: t('shortcutKeys.RuleTest'),
    },
    {
      keys: "n",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/dnsresolver');
        trackEvent('Nav', 'NavClick', 'DNSResolver');
      },
      description: t('shortcutKeys.DNSResolver'),
    },
    {
      keys: "b",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/censorshipcheck');
        trackEvent('Nav', 'NavClick', 'CensorshipCheck');
      },
      description: t('shortcutKeys.CensorshipCheck'),
    },
    {
      keys: "W",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/whois');
        trackEvent('Nav', 'NavClick', 'Whois');
      },
      description: t('shortcutKeys.Whois'),
    },
    {
      keys: "m",
      action: () => {
        if (configs.value.bingMap) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          preferencesRef.value.toggleMaps();
        };
        trackEvent('ShortCut', 'ShortCut', 'ToggleMaps');
      },
      description: t('shortcutKeys.ToggleMaps'),
    },
    {
      keys: "q",
      action: () => {
        queryIPRef.value.openModal();
        trackEvent('ShortCut', 'ShortCut', 'QueryIP');
      },
      description: t('shortcutKeys.IPCheck'),
    },
    {
      keys: "h",
      action: () => {
        isInfosLoaded && toggleInfoMask();
        trackEvent('ShortCut', 'ShortCut', 'ToggleInfoMask');
      },
      description: t('shortcutKeys.ToggleInfoMask'),
    },
    {
      keys: "p",
      action: () => {
        navBarRef.value.OpenPreferences();
        trackEvent('ShortCut', 'ShortCut', 'Preferences');
      },
      description: t('shortcutKeys.Preferences'),
    },
    {
      keys: "a",
      action: () => {
        footerRef.value.openAbout();
        trackEvent('ShortCut', 'ShortCut', 'About');
      },
      description: t('shortcutKeys.About'),
    },
    // help
    {
      keys: "?",
      action: () => {
        helpModalRef.value.openModal();
        trackEvent('ShortCut', 'ShortCut', 'Help');
      },
      description: t('shortcutKeys.Help'),
    },
  ];

  const invisibilitytest = [
    {
      keys: "i",
      action: () => {
        scrollToElement("AdvancedTools", 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas('/invisibilitytest');
        trackEvent('Nav', 'NavClick', 'InvisibilityTest');
      },
      description: t('shortcutKeys.InvisibilityTest'),
    },
  ];

  if (isOriginalSite) {
    shortcutConfig.push(...invisibilitytest);
  }

  return shortcutConfig;
};

// 快捷键装载
const registerShortcutKeys = () => {
  const isOriginalSite = configs.value.originalSite;
  const shortcutConfig = ShortcutKeys(isOriginalSite);
  shortcutConfig.forEach(config => mappingKeys(config));
};

// 给 helpModal 发送快捷键内容
const sendKeyMap = () => {
  helpModalRef.value.keyMap = keyMap;
};

// 加载快捷键，稍微延迟，以等待 config 加载完成再注册
const loadShortcuts = () => {
  setTimeout(() => {
    registerShortcutKeys();
    sendKeyMap();
  }, 2000);
};

// 监控刷新动作
watch(shouldRefreshEveryThing, (newVal) => {
  if (newVal) {
    refreshEverything();
  }
});

// 监控加载状态并传递
watch(() => store.allHasLoaded, (newValue) => {
  isInfosLoaded.value = newValue;
  showMaskButton.value = true;
});

onMounted(() => {
  loadingControl();
  loadShortcuts();
});


</script>

<style scoped></style>

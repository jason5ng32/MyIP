<template>
  <NavBar ref="navBarRef" />
  <!-- Alerts -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3 jn-toast">
    <div id="toastInfoMask" class="toast" :class="{ 'dark-mode': isDarkMode }" role="alert" ref="toast"
      aria-live="assertive" aria-atomic="true">
      <div class="toast-header" :class="{ 'dark-mode-title': isDarkMode }">
        <strong class="me-auto" :class="alertStyle">{{ alertTitle }}</strong>
        <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
          data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        {{ alertMessage }}
      </div>
    </div>
  </div>
  <div id="mainpart" class="container mt-5 jn-container">
    <div data-bs-spy="scroll" data-bs-target="#navbar-top" data-bs-root-margin="0px 0px -40%"
      data-bs-smooth-scroll="true" class="rounded-2" tabindex="0">
      <IPCheck ref="IPCheckRef" />
      <Connectivity ref="connectivityRef" />
      <WebRTC ref="webRTCRef" />
      <DNSLeaks ref="dnsLeaksRef" />
      <SpeedTest ref="speedTestRef" />
      <AdvancedTools ref="advancedToolsRef" />
      <QueryIP ref="queryIPRef" />
      <HelpModal ref="helpModalRef" />
      <!-- Info Mask BTN-->
      <button v-if="isInfosLoaded" class="btn position-fixed"
        :class="infoMaskLevel === 0 ? 'btn-success' : infoMaskLevel === 1 ? 'btn-warning' : 'btn-secondary'"
        style="bottom: 66px; right: 20px; z-index: 1050;" @click="toggleInfoMask" aria-label="Toggle Info Mask"
        v-tooltip="$t('Tooltips.InfoMask')">
        <i :class="infoMaskLevel === 0 ? 'bi bi-eye' : 'bi bi-eye-slash'"></i>
      </button>
    </div>
  </div>
  <Footer />
  <PWA />
</template>

<script>
import NavBar from './components/nav.vue'
import IPCheck from './components/ipcheck.vue'
import Connectivity from './components/connectivity.vue'
import WebRTC from './components/webrtc.vue'
import DNSLeaks from './components/dnsleaks.vue'
import SpeedTest from './components/speedtest.vue'
import Footer from './components/footer.vue'
import QueryIP from './components/queryip.vue'
import HelpModal from './components/help.vue'
import PWA from './components/pwa.vue'
import AdvancedTools from './components/advancedtools.vue'
import { mappingKeys, navigateCards, keyMap } from "./shortcut.js";

import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { Modal, Toast } from 'bootstrap';

export default {

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);
    const configs = computed(() => store.state.configs);
    const shouldRefreshEveryThing = computed(() => store.state.shouldRefreshEveryThing);
    const shouldRefresh = ref(false);

    watch(shouldRefreshEveryThing, (newVal) => {
      shouldRefresh.value = newVal;
    });

    return {
      isDarkMode,
      isMobile,
      shouldRefresh,
      configs,
    };
  },

  components: {
    NavBar,
    IPCheck,
    Connectivity,
    WebRTC,
    DNSLeaks,
    SpeedTest,
    Footer,
    QueryIP,
    HelpModal,
    PWA,
    AdvancedTools,
  },
  name: 'App',
  data() {
    return {
      keyMap,
      infoMaskLevel: 0,
      isInfosLoaded: false,
      originipDataCards: [],
      originstunServers: [],
      originleakTest: [],
      alertToShow: false,
      alertStyle: "",
      alertMessage: "",
      alertTitle: "",
      trackedSections: new Set(),
    }
  },

  watch: {
    shouldRefresh(newVal) {
      if (newVal) {
        this.$refs.navBarRef.loaded = false;
        this.isInfosLoaded = false;
        this.refreshEverything();
        this.setInfosLoaded();
      }
    },
    isInfosLoaded(newVal) {
      if (newVal) {
        this.$refs.navBarRef.loaded = true;
      }
    },
  },
  created() {
    this.hideLoading();
  },
  methods: {

    // 加载完成后隐藏 loading
    hideLoading() {
      let loadingElement = document.getElementById("jn-loading");
      if (loadingElement) {
        loadingElement.style.display = "none";
      }
    },

    // 设置 isMobile
    handleResize() {
      this.$store.commit('setIsMobile', window.innerWidth < 768);
    },
    // 显示 Toast
    showToast(duration = 2000) {
      this.$nextTick(() => {
        const toastEl = this.$refs.toast;
        if (toastEl) {
          const toastInfoMask = new Toast(toastEl, {
            delay: duration
          });
          toastInfoMask.show();
        } else {
          console.error("Toast element not found");
        }
      });
    },
    // 延迟设置 isInfosLoaded
    setInfosLoaded() {
      setTimeout(() => {
        this.isInfosLoaded = true;
      }, 6000);
    },

    // 时间任务
    scheduleTimedTasks(tasks) {
      tasks.forEach(task => {
        setTimeout(() => {
          task.action();
          if (task.message) {
            this.displayAlert(task.message);
          }
        }, task.delay);
      });
    },

    // 刷新所有
    refreshEverything() {
      const refreshTasks = [
        { action: () => this.$refs.IPCheckRef.checkAllIPs(), delay: 0 },
        { action: () => this.$refs.connectivityRef.checkAllConnectivity(false, true), delay: 2000 },
        { action: () => this.$refs.webRTCRef.checkAllWebRTC(true), delay: 4000 },
        { action: () => this.$refs.dnsLeaksRef.checkAllDNSLeakTest(true), delay: 2500 },
        { action: () => this.refreshingAlert(), delay: 500 },
      ];
      this.scheduleTimedTasks(refreshTasks);
      this.infoMaskLevel = 0;
      this.$store.commit('setRefreshEveryThing', false);
    },

    // 刷新完成后显示 Toast
    refreshingAlert() {
      this.alertStyle = "text-success";
      this.alertMessage = this.$t('alert.refreshEverythingMessage');
      this.alertTitle = this.$t('alert.refreshEverythingTitle');
      this.alertToShow = true;
      this.showToast();
    },

    // 信息遮罩
    toggleInfoMask() {
      this.$trackEvent('SideButtons', 'ToggleClick', 'InfoMask');
      if (this.infoMaskLevel === 0) {
        this.originipDataCards = JSON.parse(JSON.stringify(this.$refs.IPCheckRef.ipDataCards));
        this.originstunServers = JSON.parse(JSON.stringify(this.$refs.webRTCRef.stunServers));
        this.originleakTest = JSON.parse(JSON.stringify(this.$refs.dnsLeaksRef.leakTest));
        this.infoMask();
        this.alertStyle = "text-warning";
        this.alertMessage = this.$t('alert.maskedInfoMessage_1');
        this.alertTitle = this.$t('alert.maskedInfoTitle_1');
        this.alertToShow = true;
        this.showToast();
      } else if (this.infoMaskLevel === 1) {
        this.infoMask();
        this.alertStyle = "text-success";
        this.alertMessage = this.$t('alert.maskedInfoMessage');
        this.alertTitle = this.$t('alert.maskedInfoTitle');
        this.alertToShow = true;
        this.showToast();
      } else {
        this.infoUnmask();
        this.alertStyle = "text-danger";
        this.alertMessage = this.$t('alert.unmaskedInfoMessage');
        this.alertTitle = this.$t('alert.unmaskedInfoTitle');
        this.alertToShow = true;
        this.showToast();
      }
    },

    // 信息遮罩内容
    infoMask() {
      if (this.infoMaskLevel === 0) {
        this.$refs.IPCheckRef.ipDataCards.forEach((card) => {
          card.ip = "8.8.8.8";
        });
        this.$refs.webRTCRef.stunServers.forEach((server) => {
          server.ip = "100.100.200.100";
        });
        this.$refs.dnsLeaksRef.leakTest.forEach((server) => {
          server.ip = "12.34.56.78";
        });
        this.infoMaskLevel = 1;
      } else if (this.infoMaskLevel === 1) {
        this.$refs.IPCheckRef.ipDataCards.forEach((card) => {
          card.country_name = "United States";
          card.country_code = "US";
          card.region = "California";
          card.city = "Mountain View";
          card.latitude = "37.40599";
          card.longitude = "-122.078514";
          card.isp = "Google LLC";
          card.asn = "AS15169";
          card.mapUrl = '/defaultMap.webp';
          card.mapUrl_dark = '/defaultMap_dark.webp';
          card.showASNInfo = false;
        });
        this.$refs.dnsLeaksRef.leakTest.forEach((server) => {
          server.geo = "United States";
        });
        this.infoMaskLevel = 2;
      }
    },

    // 信息遮罩内容还原
    infoUnmask() {
      this.$refs.IPCheckRef.ipDataCards = JSON.parse(JSON.stringify(this.originipDataCards));
      this.$refs.webRTCRef.stunServers = JSON.parse(JSON.stringify(this.originstunServers));
      this.$refs.dnsLeaksRef.leakTest = JSON.parse(JSON.stringify(this.originleakTest));
      this.infoMaskLevel = 0;
    },

    // 打开与关闭 Modal
    openModal(id) {
      const modalElement = document.getElementById(id);
      const modalInstance = Modal.getOrCreateInstance(modalElement);
      if (modalInstance) {
        modalInstance.show();
      }
    },
    closeModal(id) {
      const modalElement = document.getElementById(id);
      const modalInstance = Modal.getInstance(modalElement);
      if (modalInstance) {
        modalInstance.hide();
      }
    },

    // 设置 Modal 的聚焦
    setupModalFocus() {
      const modals = document.querySelectorAll(".modal");
      modals.forEach((modal) => {
        modal.addEventListener("shown.bs.modal", () => {
          this.$nextTick(() => {
            const inputElement = modal.querySelector(".form-control");
            if (inputElement) {
              inputElement.focus();
            }
          });
        });
      });
    },

    // 滚动到指定元素
    scrollToElement(el, offset = 0) {
      const element = typeof el === "string" ? document.getElementById(el) : el;
      const y = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    },

    // 快捷键
    registerShortcutKeys() {
      const shortcutConfig = [
        {
          keys: "g",
          action: () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            this.$trackEvent('ShortCut', 'ShortCut', 'GoToTop');
          },
          description: this.$t('shortcutKeys.GoToTop'),
        },
        {
          keys: 'j',
          action: () => {
            navigateCards('down'),
              this.$trackEvent('ShortCut', 'ShortCut', 'GoNext');
          },
          description: this.$t('shortcutKeys.GoNext'),
        },
        {
          keys: 'k',
          action: () => {
            navigateCards('up'),
              this.$trackEvent('ShortCut', 'ShortCut', 'GoPrevious');
          },
          description: this.$t('shortcutKeys.GoPrevious'),
        },
        {
          keys: "G",
          action: () => {
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            });
            this.$trackEvent('ShortCut', 'ShortCut', 'GoToBottom');
          },
          description: this.$t('shortcutKeys.GoToBottom'),
        },
        {
          keys: "D",
          action: () => {
            this.$refs.navBarRef.toggleDarkMode(),
              this.$trackEvent('ShortCut', 'ShortCut', 'ToggleDarkMode');
          },
          description: this.$t('shortcutKeys.ToggleDarkMode'),
        },
        {
          keys: "R",
          action: () => {
            this.$store.commit('setRefreshEveryThing', true);
            this.$trackEvent('ShortCut', 'ShortCut', 'RefreshEverything');
          },

          description: this.$t('shortcutKeys.RefreshEverything'),
        },
        {
          keys: "([1-6])",
          type: "regex",
          action: (num) => {
            const card = this.$refs.IPCheckRef.ipDataCards[num - 1];
            this.scrollToElement("IPInfo-" + num, 171);
            this.$refs.IPCheckRef.refreshCard(card);
            this.$trackEvent('ShortCut', 'ShortCut', 'IPCheck');
          },
          description: this.$t('shortcutKeys.RefreshIPCard'),
        },
        {
          keys: "c",
          action: () => {
            this.scrollToElement("Connectivity", 80);
            this.$refs.connectivityRef.checkAllConnectivity(false, true);
            this.$trackEvent('ShortCut', 'ShortCut', 'Connectivity');
          },
          description: this.$t('shortcutKeys.RefreshConnectivityTests'),
        },
        {
          keys: "w",
          action: () => {
            this.scrollToElement("WebRTC", 80);
            this.$refs.webRTCRef.checkAllWebRTC(false);
            this.$trackEvent('ShortCut', 'ShortCut', 'WebRTC');
          },
          description: this.$t('shortcutKeys.RefreshWebRTC'),
        },
        {
          keys: "d",
          action: () => {
            this.scrollToElement("DNSLeakTest", 80);
            this.$refs.dnsLeaksRef.checkAllDNSLeakTest(true);
            this.$trackEvent('ShortCut', 'ShortCut', 'DNSLeakTest');
          },
          description: this.$t('shortcutKeys.RefreshDNSLeakTest'),
        },
        {
          keys: "s",
          action: () => {
            this.scrollToElement("SpeedTest", 80);
            this.$refs.speedTestRef.speedTestController();
            this.$trackEvent('ShortCut', 'ShortCut', 'SpeedTest');
          },
          description: this.$t('shortcutKeys.SpeedTestButton'),
        },
        {
          keys: "l",
          action: () => {
            this.scrollToElement("AdvancedTools", 80);
            this.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/pingtest');
            this.$trackEvent('Nav', 'NavClick', 'PingTest');
          },
          description: this.$t('shortcutKeys.PingTest'),
        },
        {
          keys: "t",
          action: () => {
            this.scrollToElement("AdvancedTools", 80);
            this.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/mtrtest');
            this.$trackEvent('Nav', 'NavClick', 'MTRTest');
          },
          description: this.$t('shortcutKeys.MTRTest'),
        },
        {
          keys: "r",
          action: () => {
            this.scrollToElement("AdvancedTools", 80);
            this.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/ruletest');
            this.$trackEvent('Nav', 'NavClick', 'RuleTest');
          },
          description: this.$t('shortcutKeys.RuleTest'),
        },
        {
          keys: "n",
          action: () => {
            this.scrollToElement("AdvancedTools", 80);
            this.$refs.advancedToolsRef.navigateAndToggleOffcanvas('/dnsresolver');
            this.$trackEvent('Nav', 'NavClick', 'DNSResolver');
          },
          description: this.$t('shortcutKeys.DNSResolver'),
        },
        {
          keys: "m",
          action: () => {
            if (this.configs.bingMap) {
              window.scrollTo({ top: 0, behavior: "smooth" });
              this.$refs.IPCheckRef.toggleMaps();
            };
            this.$trackEvent('ShortCut', 'ShortCut', 'ToggleMaps');
          },
          description: this.$t('shortcutKeys.ToggleMaps'),
        },
        {
          keys: "q",
          action: () => {
            this.openModal("IPCheck");
            this.$refs.queryIPRef.loadRecaptchaScript();
            this.$trackEvent('ShortCut', 'ShortCut', 'QueryIP');
          },
          description: this.$t('shortcutKeys.IPCheck'),
        },
        {
          keys: "h",
          action: () => {
            this.isInfosLoaded && this.toggleInfoMask();
            this.$trackEvent('ShortCut', 'ShortCut', 'ToggleInfoMask');
          },
          description: this.$t('shortcutKeys.ToggleInfoMask'),
        },

        // help
        {
          keys: "?",
          action: () => {
            this.openModal("helpModal");
            this.$trackEvent('ShortCut', 'ShortCut', 'Help');
          },
          description: this.$t('shortcutKeys.Help'),
        },
      ];

      shortcutConfig.forEach(config => mappingKeys(config));
    },

    // 给 helpModal 发送快捷键内容
    sendKeyMap() {
      this.$refs.helpModalRef.keyMap = this.keyMap;
    },

    // 滚动到指定元素并记录事件
    checkSectionsAndTrack() {
      const sectionIds = ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'GlobalLatency', 'PingTest', 'MTRTest'];

      sectionIds.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section && this.isElementInViewport(section) && !this.trackedSections.has(sectionId)) {
          this.$trackEvent(sectionId, 'JNScroll', sectionId);
          this.trackedSections.add(sectionId);
        }
      });
    },

    // 判断元素是否在视窗内
    isElementInViewport(el) {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    },
  },
  mounted() {
    this.registerShortcutKeys();
    this.setupModalFocus();
    this.keyMap = keyMap;
    this.sendKeyMap();
    this.setInfosLoaded();
    window.addEventListener('scroll', this.checkSectionsAndTrack);
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.checkSectionsAndTrack);
  },
}

</script>

<style scoped></style>

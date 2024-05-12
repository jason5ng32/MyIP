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
  <Footer ref="footerRef" />
  <PWA />
</template>

<script>

// Components
import NavBar from './components/nav.vue';
import IPCheck from './components/ip-check.vue';
import Connectivity from './components/connectivity-test.vue';
import WebRTC from './components/webrtc-test.vue';
import DNSLeaks from './components/dns-leaks-test.vue';
import SpeedTest from './components/speed-test.vue';
import AdvancedTools from './components/advanced.vue';
import Footer from './components/footer.vue';

// Utils
import { mappingKeys, keyMap, ShortcutKeys } from "@/utils/shortcut.js";
import {maskedInfo } from "@/utils/masked-info.js";

// Widgets
import Preferences from './components/widgets/preferences.vue';
import QueryIP from './components/widgets/query-ip.vue';
import HelpModal from './components/widgets/help.vue';
import PWA from './components/widgets/pwa.vue';
import Alert from './components/widgets/alert.vue';

// Vue
import { ref, watch, computed } from 'vue';
import { useMainStore } from '@/store';
import { Modal, Toast, Offcanvas } from 'bootstrap';

export default {

  // 引入 Store
  setup() {
    const store = useMainStore();
    const isDarkMode = computed(() => store.isDarkMode);
    const isMobile = computed(() => store.isMobile);
    const configs = computed(() => store.configs);
    const userPreferences = computed(() => store.userPreferences);
    const shouldRefreshEveryThing = computed(() => store.shouldRefreshEveryThing);

    return {
      store,
      isDarkMode,
      isMobile,
      configs,
      userPreferences,
      shouldRefreshEveryThing,
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
    Preferences,
    Alert,
  },
  name: 'App',
  data() {
    return {
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
    shouldRefreshEveryThing(newVal) {
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
        { action: () => this.$refs.connectivityRef.checkAllConnectivity(false, true, true), delay: 2000 },
        { action: () => this.$refs.webRTCRef.checkAllWebRTC(true), delay: 4000 },
        { action: () => this.$refs.dnsLeaksRef.checkAllDNSLeakTest(true), delay: 2500 },
        { action: () => this.refreshingAlert(), delay: 500 },
      ];
      this.scheduleTimedTasks(refreshTasks);
      this.infoMaskLevel = 0;
      this.store.setRefreshEveryThing(false);
    },

    // 刷新完成后显示 Toast
    refreshingAlert() {
      this.alertStyle = "text-success";
      this.alertMessage = this.$t('alert.refreshEverythingMessage');
      this.alertTitle = this.$t('alert.refreshEverythingTitle');
      this.alertToShow = true;
      this.store.setAlert(this.alertToShow, this.alertStyle,this.alertMessage, this.alertTitle);
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
      } else if (this.infoMaskLevel === 1) {
        this.infoMask();
        this.alertStyle = "text-success";
        this.alertMessage = this.$t('alert.maskedInfoMessage');
        this.alertTitle = this.$t('alert.maskedInfoTitle');
        this.alertToShow = true;
      } else {
        this.infoUnmask();
        this.alertStyle = "text-danger";
        this.alertMessage = this.$t('alert.unmaskedInfoMessage');
        this.alertTitle = this.$t('alert.unmaskedInfoTitle');
        this.alertToShow = true;
      }
      this.store.setAlert(this.alertToShow, this.alertStyle,this.alertMessage, this.alertTitle);
    },

    // 信息遮罩内容
    infoMask() {
      if (this.infoMaskLevel === 0) {
        this.$refs.IPCheckRef.ipDataCards.forEach((card) => {
          if (card.id === "cloudflare_v6" || card.id === "ipify_v6") {
            card.ip = maskedInfo(this).ipv6;
          } else {
            card.ip = maskedInfo(this).ipv4;
          }
        });
        this.$refs.webRTCRef.stunServers.forEach((server) => {
          server.ip = maskedInfo(this).webrtcip;
        });
        this.$refs.dnsLeaksRef.leakTest.forEach((server) => {
          server.ip = maskedInfo(this).dnsendpoints;
        });
        this.infoMaskLevel = 1;
      } else if (this.infoMaskLevel === 1) {
        this.$refs.IPCheckRef.ipDataCards.forEach(card => {
          const maskedInfoData = maskedInfo(this);
          Object.assign(card, maskedInfoData);
        });
        this.$refs.dnsLeaksRef.leakTest.forEach((server) => {
          server.geo = maskedInfo(this).country_name;
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
      const isOriginalSite = this.configs.originalSite;
      const shortcutConfig = ShortcutKeys(this, isOriginalSite);
      shortcutConfig.forEach(config => mappingKeys(config));
    },

    // 给 helpModal 发送快捷键内容
    sendKeyMap() {
      this.$refs.helpModalRef.keyMap = keyMap;
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

    // 监听所有 offcanvas，避免同时打开多个导致浏览器崩溃
    listenOffcanvas() {
      const offcanvasElements = document.querySelectorAll('.offcanvas');
      const navElements = document.getElementById('navbarNavAltMarkup');
      const navElementsButton = document.querySelector('.navbar-toggler');
      offcanvasElements.forEach((element) => {
        const instance = Offcanvas.getOrCreateInstance(element); // 确保实例创建成功
        element.addEventListener('show.bs.offcanvas', () => {
          // 存在 Offcanvas 时关闭导航栏
          navElements.classList.remove('show');
          navElementsButton.setAttribute('aria-expanded', 'false');
          navElementsButton.classList.add('collapsed');
          // 关闭所有其他的 offcanvas
          offcanvasElements.forEach((offcanvas) => {
            if (offcanvas !== element) {
              const offcanvasInstance = Offcanvas.getInstance(offcanvas);
              if (offcanvasInstance) { // 确保实例有效
                offcanvasInstance.hide();
              }
            }
          });
        });
      });
    },

  },
  mounted() {
    this.setupModalFocus();
    setTimeout(() => {
      this.registerShortcutKeys();
      this.sendKeyMap();
    }, 2000);

    this.setInfosLoaded();
    this.listenOffcanvas();
    window.addEventListener('scroll', this.checkSectionsAndTrack);
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.checkSectionsAndTrack);
  },
}

</script>

<style scoped></style>

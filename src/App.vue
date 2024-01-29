<template>
  <NavBar ref="navBarRef" />
  <!-- Alerts -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3 jn-toast">
    <div id="toastInfoMask" class="toast" :class="{ 'dark-mode': isDarkMode }" role="alert" ref="toast"
      aria-live="assertive" aria-atomic="true">
      <div class="toast-header" :class="{ 'dark-mode-title': isDarkMode }">
        <strong class="me-auto" :class="alertStyle">{{ alertTitle }}</strong>
        <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }" data-bs-dismiss="toast"
          aria-label="Close"></button>
      </div>
      <div class="toast-body">
        {{ alertMessage }}
      </div>
    </div>
  </div>
  <div id="mainpart" class="container mt-5 jn-container">
    <div data-bs-spy="scroll" data-bs-target="#navbar-top" data-bs-root-margin="0px 0px -40%" data-bs-smooth-scroll="true"
      class="rounded-2" tabindex="0">
      <IPCheck ref="IPCheckRef" />
      <Connectivity ref="connectivityRef" />
      <WebRTC ref="webRTCRef" />
      <DNSLeaks ref="dnsLeaksRef" />
      <SpeedTest ref="speedTestRef" />
      <GlobalLatency ref="globalLatencyRef" />
      <MTRtest ref="mtrtestRef" />
      <QueryIP ref="queryIPRef" />
      <HelpModal ref="helpModalRef" />
      <!-- Info Mask BTN-->
      <button v-if="isInfosLoaded" class="btn position-fixed"
        :class="infoMaskLevel === 0 ? 'btn-success' : infoMaskLevel === 1 ? 'btn-warning' : 'btn-secondary'"
        style="bottom: 66px; right: 20px; z-index: 1050;" @click="toggleInfoMask">
        <i :class="infoMaskLevel === 0 ? 'bi bi-eye' : 'bi bi-eye-slash'"></i>
      </button>
    </div>
  </div>
  <Footer />
</template>

<script>
import NavBar from './components/nav.vue'
import IPCheck from './components/ipcheck.vue'
import Connectivity from './components/connectivity.vue'
import WebRTC from './components/webrtc.vue'
import DNSLeaks from './components/dnsleaks.vue'
import SpeedTest from './components/speedtest.vue'
import GlobalLatency from './components/globallatency.vue'
import MTRtest from './components/mtrtest.vue'
import Footer from './components/footer.vue'
import QueryIP from './components/queryip.vue'
import HelpModal from './components/help.vue'
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
    const shouldRefreshEveryThing = computed(() => store.state.shouldRefreshEveryThing);
    const shouldRefresh = ref(false);

    watch(shouldRefreshEveryThing, (newVal) => {
      shouldRefresh.value = newVal;
    });

    return {
      isDarkMode,
      isMobile,
      shouldRefresh,
    };
  },

  components: {
    NavBar,
    IPCheck,
    Connectivity,
    WebRTC,
    DNSLeaks,
    SpeedTest,
    GlobalLatency,
    MTRtest,
    Footer,
    QueryIP,
    HelpModal,
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
    }
  },

  watch: {
    shouldRefresh(newVal) {
      if (newVal) {
        this.refreshEverything();
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
      var loadingElement = document.getElementById("jn-loading");
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
          card.mapUrl = '/defaultMap.jpg';
          card.mapUrl_dark = '/defaultMap_dark.jpg';
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
          action() {
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
          description: this.$t('shortcutKeys.GoToTop'),
        },
        {
          keys: 'j',
          action: () => navigateCards('down'),
          description: this.$t('shortcutKeys.GoNext'),
        },
        {
          keys: 'k',
          action: () => navigateCards('up'),
          description: this.$t('shortcutKeys.GoPrevious'),
        },
        {
          keys: "G",
          action() {
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            });
          },
          description: this.$t('shortcutKeys.GoToBottom'),
        },
        {
          keys: "D",
          action: this.$refs.navBarRef.toggleDarkMode,
          description: this.$t('shortcutKeys.ToggleDarkMode'),
        },
        {
          keys: "R",
          action: this.refreshEverything,
          description: this.$t('shortcutKeys.RefreshEverything'),
        },
        {
          keys: "([1-6])",
          type: "regex",
          action: (num) => {
            const card = this.$refs.IPCheckRef.ipDataCards[num - 1];
            this.scrollToElement("IPInfo", 80);
            this.$refs.IPCheckRef.refreshCard(card);
          },
          description: this.$t('shortcutKeys.RefreshIPCard'),
        },
        {
          keys: "c",
          action: () => {
            this.scrollToElement("Connectivity", 80);
            this.$refs.connectivityRef.checkAllConnectivity(false, true);
          },
          description: this.$t('shortcutKeys.RefreshConnectivityTests'),
        },
        {
          keys: "w",
          action: () => {
            this.scrollToElement("WebRTC", 80);
            this.$refs.webRTCRef.checkAllWebRTC(true);
          },
          description: this.$t('shortcutKeys.RefreshWebRTC'),
        },
        {
          keys: "d",
          action: () => {
            this.scrollToElement("DNSLeakTest", 80);
            this.$refs.dnsLeaksRef.checkAllDNSLeakTest(true);
          },
          description: this.$t('shortcutKeys.RefreshDNSLeakTest'),
        },
        {
          keys: "s",
          action: () => {
            this.scrollToElement("SpeedTest", 80);
            this.$refs.speedTestRef.refreshstartSpeedTest();
          },
          description: this.$t('shortcutKeys.StartSpeedTest'),
        },
        {
          keys: "m",
          action: () => {
            if (this.$refs.IPCheckRef.isEnvBingMapKey) {
              window.scrollTo({ top: 0, behavior: "smooth" });
              this.$refs.IPCheckRef.toggleMaps();
            }
          },
          description: this.$t('shortcutKeys.ToggleMaps'),
        },
        {
          keys: "q",
          action: () => {
            this.openModal("IPCheck");
          },
          description: this.$t('shortcutKeys.IPCheck'),
        },
        {
          keys: "h",
          action: () => {
            this.isInfosLoaded && this.toggleInfoMask();
          },
          description: this.$t('shortcutKeys.ToggleInfoMask'),
        },

        // help
        {
          keys: "?",
          action: () => {
            this.openModal("helpModal");
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
  },
  mounted() {
    this.registerShortcutKeys();
    this.setupModalFocus();
    this.keyMap = keyMap;
    this.sendKeyMap();
    this.setInfosLoaded();
  },
}

</script>

<style scoped></style>

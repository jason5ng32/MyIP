<template>
  <!-- Alerts -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3 jn-toast">
    <div id="toast" class="toast" :class="{ 'dark-mode': isDarkMode }" role="alert" ref="toast" aria-live="assertive"
      aria-atomic="true">
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

  <div>
    <!-- Connectivity -->
    <div class="availability-test-section mb-4">
      <div class="jn-title2">
        <h2 id="Connectivity" :class="{ 'mobile-h2': isMobile }">🚦 {{ $t('connectivity.Title') }}</h2>
        <button @click="checkAllConnectivity(false, true)"
          :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']" aria-label="Refresh Connectivity Test"
          v-tooltip="$t('Tooltips.RefreshConnectivityTests')"><i class="bi bi-arrow-clockwise"></i></button>
      </div>
      <div class="text-secondary">
        <p>{{ $t('connectivity.Note') }}</p>
      </div>
      <div class="row">
        <div v-for="test in connectivityTests" :key="test.id" class="col-6 col-md-3 mb-4">
          <div class="card jn-card keyboard-shortcut-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
            <div class="card-body">
              <p class="jn-con-title card-title"><i class="bi" :class="'bi-' + test.icon"></i> {{ test.name }}</p>
              <p class="card-text" :class="{
                'text-info': test.status === $t('connectivity.StatusWait'),
                'text-success': test.status.includes($t('connectivity.StatusAvailable')) && test.time < 200,
                'jn-text-warning': test.status.includes($t('connectivity.StatusAvailable')) && test.time >= 200,
                'text-danger': test.status === $t('connectivity.StatusUnavailable') || test.status === $t('connectivity.StatusTimeout')
              }" :title="$t('connectivity.minTestTime') + test.mintime + ' ms'">
                <i v-if="test.status === $t('connectivity.StatusUnavailable') || test.status === $t('connectivity.StatusTimeout')"
                  class="bi bi-emoji-frown"></i>
                <i v-else-if="test.status === $t('connectivity.StatusAvailable') && test.time < 200"
                  class="bi bi-emoji-smile"></i>
                <i v-else-if="test.status === $t('connectivity.StatusAvailable') && test.time >= 200"
                  class="bi bi-emoji-expressionless"></i>
                <i v-else-if="test.time === 0" class="bi bi-hourglass-split"></i>
                {{ test.status }}
                <span v-if="test.time !== 0">
                  : {{ test.time }}
                  <span> ms</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { Toast, } from 'bootstrap';


export default {
  name: 'Connectivity',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);

    return {
      isDarkMode,
      isMobile,
    };
  },

  data() {
    return {
      alertToShow: false,
      alertStyle: "",
      alertTitle: "",
      alertMessage: "",
      connectivityTests: [
        {
          id: "bilibili",
          name: "Bilibili",
          icon: "tv-fill",
          url: "https://www.bilibili.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "baidu",
          name: "Baidu",
          icon: "browser-safari",
          url: "https://www.baidu.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "wechat",
          name: "WeChat",
          icon: "wechat",
          url: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "google",
          name: "Google",
          icon: "google",
          url: "https://www.google.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "cloudflare",
          name: "Cloudflare",
          icon: "cloud-fill",
          url: "https://www.cloudflare.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "youtube",
          name: "YouTube",
          icon: "youtube",
          url: "https://www.youtube.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "github",
          name: "GitHub",
          icon: "github",
          url: "https://github.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
        {
          id: "chatgpt",
          name: "ChatGPT",
          icon: "chat-quote-fill",
          url: "https://chat.openai.com/favicon.ico?",
          status: this.$t('connectivity.StatusWait'),
          time: 0,
          mintime: 0,
        },
      ],
    };
  },

  methods: {

    // 检查网络连通性
    checkConnectivityHandler(test, isAlertToShow, onTestComplete) {
      const beginTime = +new Date();

      let img = new Image();
      let timeout = setTimeout(() => {
        test.status = this.$t('connectivity.StatusUnavailable');
        onTestComplete(false);
      }, 3 * 1200);

      img.onload = () => {
        clearTimeout(timeout);
        test.status = this.$t('connectivity.StatusAvailable');
        let testTime = new Date() - beginTime;

        if (test.mintime === 0) {
          test.mintime = testTime;
        } else {
          test.mintime = Math.min(test.mintime, testTime);
        }

        test.time = testTime;

        onTestComplete(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        test.status = this.$t('connectivity.StatusUnavailable');
        onTestComplete(false);
      };

      img.src = `${test.url}${Date.now()}`;
    },

    // 检查所有网络连通性
    checkAllConnectivity(isAlertToShow, isRefresh) {

      if (isRefresh) {
        this.connectivityTests.forEach((test) => {
          test.status = this.$t('connectivity.StatusWait');
          test.time = 0;
        });
        this.$trackEvent('Section', 'RefreshClick', 'Connectivity');
      }
      let totalTests = this.connectivityTests.length;
      let successCount = 0;
      let completedCount = 0;

      const onTestComplete = (isSuccess) => {
        if (isSuccess) {
          successCount++;
        }
        completedCount++;

        // 只有当所有测试都完成时才做出最终判断
        if (completedCount === totalTests) {
          this.alertToShow = true;
          if (successCount === totalTests) {
            this.updateConnectivityAlert(true, "success");
          } else {
            this.updateConnectivityAlert(true, "error");
          }
        }
      };

      this.connectivityTests.forEach((test, index) => {
        setTimeout(() => {
          this.checkConnectivityHandler(test, isAlertToShow, onTestComplete);
        }, 50 * index);
      });

      if (isAlertToShow) {
        setTimeout(() => {
          this.showToast();
        }, 4000);
      }
    },

    // 更新通知气泡
    updateConnectivityAlert(show, type) {
      this.alertToShow = show;
      if (type === "success") {
        this.alertStyle = "text-success";
        this.alertMessage = this.$t('alert.Congrats_Message');
        this.alertTitle = this.$t('alert.Congrats');
      } else {
        this.alertStyle = "text-danger";
        this.alertMessage = this.$t('alert.OhNo_Message');
        this.alertTitle = this.$t('alert.OhNo');
      }
    },

    // 通知气泡
    showToast(duration = 2000) {
      this.$nextTick(() => {
        const toastEl = this.$refs.toast;
        if (toastEl) {
          const toast = new Toast(toastEl, {
            delay: duration
          });
          toast.show();
        } else {
          console.error("Toast element not found");
        }
      });
    },
  },

  mounted() {
    setTimeout(() => {
      this.checkAllConnectivity(true, false);
    }, 2000);
  },
}
</script>
<style scoped>
.jn-text-warning {
  color: #c67c14;
}
</style>

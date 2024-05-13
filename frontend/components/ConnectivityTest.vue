<template>
  <div>
    <!-- Connectivity -->
    <div class="availability-test-section mb-4">
      <div class="jn-title2">
        <h2 id="Connectivity" :class="{ 'mobile-h2': isMobile }">🚦 {{ t('connectivity.Title') }}</h2>
        <button @click="checkAllConnectivity(false, true, true)"
          :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
          aria-label="Refresh Connectivity Test" v-tooltip="t('Tooltips.RefreshConnectivityTests')"><i class="bi"
            :class="[isStarted ? 'bi-arrow-clockwise' : 'bi-caret-right-fill']"></i></button>
      </div>
      <div class="text-secondary">
        <p>{{ t('connectivity.Note') }}</p>
      </div>
      <div class="row">
        <div v-for="test in connectivityTests" :key="test.id" class="col-6 col-md-3 mb-4">
          <div class="card jn-card keyboard-shortcut-card"
            :class="{ 'dark-mode dark-mode-border': isDarkMode, 'jn-hover-card': !isMobile }">
            <div class="card-body">
              <p class="jn-con-title card-title"><i class="bi" :class="'bi-' + test.icon"></i> {{ test.name }}</p>
              <p class="card-text" :class="{
                'text-info': test.status === t('connectivity.StatusWait'),
                'text-success': test.status.includes(t('connectivity.StatusAvailable')) && test.time < 200,
                'jn-text-warning': test.status.includes(t('connectivity.StatusAvailable')) && test.time >= 200,
                'text-danger': test.status === t('connectivity.StatusUnavailable') || test.status === t('connectivity.StatusTimeout')
              }" :title="t('connectivity.minTestTime') + test.mintime + ' ms'">
                <i v-if="test.status === t('connectivity.StatusUnavailable') || test.status === t('connectivity.StatusTimeout')"
                  class="bi bi-emoji-frown"></i>
                <i v-else-if="test.status === t('connectivity.StatusAvailable') && test.time < 200"
                  class="bi bi-emoji-smile"></i>
                <i v-else-if="test.status === t('connectivity.StatusAvailable') && test.time >= 200"
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

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';


const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const userPreferences = computed(() => store.userPreferences);

const alertToShow = ref(false);
const alertStyle = ref("");
const alertTitle = ref("");
const alertMessage = ref("");
const autoRefresh = ref(userPreferences.value.connectivityAutoRefresh);
const autoShowAltert = ref(userPreferences.value.popupConnectivityNotifications);
const isStarted = ref(false);
const counter = ref(0);
const maxCounts = ref(5);
const manualRun = ref(false);
const intervalId = ref(3000);
const connectivityTests = reactive([
  {
    id: "bilibili",
    name: "Bilibili",
    icon: "tv-fill",
    url: "https://www.bilibili.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "baidu",
    name: "Baidu",
    icon: "browser-safari",
    url: "https://www.baidu.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "wechat",
    name: "WeChat",
    icon: "wechat",
    url: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "google",
    name: "Google",
    icon: "google",
    url: "https://www.google.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    icon: "cloud-fill",
    url: "https://www.cloudflare.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "youtube",
    url: "https://www.youtube.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "github",
    name: "GitHub",
    icon: "github",
    url: "https://github.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    icon: "chat-quote-fill",
    url: "https://chatgpt.com/favicon.ico?",
    status: t('connectivity.StatusWait'),
    time: 0,
    mintime: 0,
  },
]);

// 检查网络连通性
const checkConnectivityHandler = (test, onTestComplete, isManualRun) => {
  const beginTime = +new Date();
  manualRun.value = isManualRun;
  let img = new Image();
  let timeout = setTimeout(() => {
    test.status = t('connectivity.StatusUnavailable');
    onTestComplete(false);
  }, 3 * 1200);

  img.onload = () => {
    clearTimeout(timeout);
    test.status = t('connectivity.StatusAvailable');
    let testTime = new Date() - beginTime;

    if (test.mintime === 0) {
      test.mintime = testTime;
    } else {
      test.mintime = Math.min(test.mintime, testTime);
    }

    if (autoRefresh.value && !isManualRun) {
      test.time = test.mintime;
    } else {
      test.time = testTime;
    }

    onTestComplete(true);
  };

  img.onerror = () => {
    clearTimeout(timeout);
    test.time = 0;
    test.status = t('connectivity.StatusUnavailable');
    onTestComplete(false);
  };

  img.src = `${test.url}${Date.now()}`;
};

// 检查所有网络连通性
const checkAllConnectivity = (isAlertToShow, isRefresh, isManualRun) => {

  if (isRefresh) {
    connectivityTests.forEach((test) => {
      test.status = t('connectivity.StatusWait');
      test.time = 0;
    });
    trackEvent('Section', 'RefreshClick', 'Connectivity');
  }
  let totalTests = connectivityTests.length;
  let successCount = 0;
  let completedCount = 0;

  const onTestComplete = (isSuccess) => {
    if (isSuccess) {
      successCount++;
    }
    completedCount++;

    // 只有当所有测试都完成时才做出最终判断
    if (completedCount === totalTests) {
      alertToShow.value = true;
      if (successCount === totalTests) {
        updateConnectivityAlert(true, "success");
      } else {
        updateConnectivityAlert(true, "error");
      }
    }
  };

  connectivityTests.forEach((test, index) => {
    setTimeout(() => {
      checkConnectivityHandler(test, onTestComplete, isManualRun);
    }, 50 * index);
  });

  if ((isAlertToShow || !isStarted.value) && autoShowAltert.value) {
    setTimeout(() => {
      store.setAlert(alertToShow.value, alertStyle.value, alertMessage.value, alertTitle.value);
    }, 4000);
  }

  isStarted.value = true;
};

// 更新通知气泡
const updateConnectivityAlert = (show, type) => {
  alertToShow.value = show;
  if (type === "success") {
    alertStyle.value = "text-success";
    alertMessage.value = t('alert.Congrats_Message');
    alertTitle.value = t('alert.Congrats');
  } else {
    alertStyle.value = "text-danger";
    alertMessage.value = t('alert.OhNo_Message');
    alertTitle.value = t('alert.OhNo');
  }
};

const handelCheckStart = () => {
  setTimeout(() => {
    checkAllConnectivity(true, false, false);
  }, 2000);
  if (autoRefresh.value) {
    intervalId.value = setInterval(() => {
      if (counter.value < maxCounts.value && !manualRun.value) {
        checkAllConnectivity(false, false, false);
        counter.value++;
      } else {
        clearInterval(intervalId.value);
      }
    }, 3000);
  }
};

onMounted(() => {
  store.setLoadingStatus('connectivity', true);
});

defineExpose({
  checkAllConnectivity,
  handelCheckStart,
});

</script>
<style scoped>
.jn-text-warning {
  color: #c67c14;
}
</style>

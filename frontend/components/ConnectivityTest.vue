<template>
  <!-- Connectivity -->
  <div class="availability-test-section mb-4">
    <div class="jn-title2">
      <h2 id="Connectivity" :class="{ 'mobile-h2': isMobile }">🚦 {{ t('connectivity.Title') }}</h2>
      <JnTooltip :text="t('Tooltips.RefreshConnectivityTests')" side="left">
        <Button size="icon" variant="outline"
          @click="checkAllConnectivity(false, true, true)"
          aria-label="Refresh Connectivity Test">
          <component :is="isStarted ? RotateCw : ChevronRight" class="inline size-[1em] align-[-0.125em]" />
        </Button>
      </JnTooltip>
    </div>
    <div class="text-neutral-500">
      <p>{{ t('connectivity.Note') }}</p>
    </div>
    <div class="flex flex-wrap -mx-2">
      <div v-for="test in connectivityTests" :key="test.id" class="w-1/2 md:w-1/4 px-2 mb-4">
        <div class="jn-card keyboard-shortcut-card rounded-lg border bg-card text-card-foreground"
          :class="{ 'jn-hover-card': !isMobile }">
          <div class="p-4">
            <p class="jn-con-title mb-2" @click.prevent="checkConnectivityHandler(test, onTestComplete, true)"
              :title="t('connectivity.RefreshThisTest')">
              <component :is="getConnectivityIcon(test.icon)" class="inline size-[1em] align-[-0.125em]" /> {{ test.name }}
            </p>
            <p :class="{
                'text-sky-600': test.status === t('connectivity.StatusWait'),
                'text-green-600': test.status.includes(t('connectivity.StatusAvailable')) && test.time < 200,
                'jn-text-warning': test.status.includes(t('connectivity.StatusAvailable')) && test.time >= 200,
                'text-red-600': test.status === t('connectivity.StatusUnavailable') || test.status === t('connectivity.StatusTimeout')
              }" :title="t('connectivity.minTestTime') + test.mintime + ' ms'">
              <Frown v-if="test.status === t('connectivity.StatusUnavailable') || test.status === t('connectivity.StatusTimeout')"
                class="inline size-[1em] align-[-0.125em]" />
              <Smile v-else-if="test.status === t('connectivity.StatusAvailable') && test.time < 200"
                class="inline size-[1em] align-[-0.125em]" />
              <Meh v-else-if="test.status === t('connectivity.StatusAvailable') && test.time >= 200"
                class="inline size-[1em] align-[-0.125em]" />
              <Hourglass v-else-if="test.time === 0" class="inline size-[1em] align-[-0.125em]" />
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
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  Chrome,
  Cloud,
  Frown,
  Github,
  Hourglass,
  Meh,
  MessageCircle,
  MessageSquareQuote,
  RotateCw,
  Smile,
  Store,
  Youtube,
  Compass,
} from 'lucide-vue-next';

// 连通性测试项目使用的图标映射（原 bi-* 名称 → lucide 组件）
const connectivityIconMap = {
  'shop': Store,
  'browser-safari': Compass,
  'wechat': MessageCircle,
  'google': Chrome,
  'cloud-fill': Cloud,
  'youtube': Youtube,
  'github': Github,
  'chat-quote-fill': MessageSquareQuote,
};
const getConnectivityIcon = (name) => connectivityIconMap[name] || Compass;


const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const userPreferences = computed(() => store.userPreferences);

const alertCrontrol = ref(false);
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
    id: "taobao",
    name: "Taobao",
    icon: "shop",
    url: "https://www.taobao.com/favicon.ico?",
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
const checkConnectivityHandler = (test, onTestComplete = () => { }, isManualRun) => {
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
  alertToShow.value = isAlertToShow;
  return new Promise((resolve, reject) => {
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
    let testPromises = [];

    const onTestComplete = (isSuccess) => {
      if (isSuccess) {
        successCount++;
      }
      completedCount++;
    };

    connectivityTests.forEach((test, index) => {
      let testPromise = new Promise((testResolve, testReject) => {
        setTimeout(() => {
          checkConnectivityHandler(test, (isSuccess) => {
            if (isSuccess) {
              onTestComplete(true);
              testResolve();
            } else {
              onTestComplete(false);
              testReject();
            }
          }, isManualRun);
        }, 50 * index);
      });
      testPromises.push(testPromise);
    });

    // 无论如何都会 Resolve
    Promise.allSettled(testPromises).then(() => {
      if (successCount === totalTests) {
        updateConnectivityAlert("success");
      } else {
        updateConnectivityAlert("error");
      }
      resolve();
    });


    isStarted.value = true;
  });
};

const sendAlert = () => {
  if ((alertToShow.value || !isStarted.value) && autoShowAltert.value) {
    store.setAlert(alertToShow.value, alertStyle.value, alertMessage.value, alertTitle.value);
  }
};


// 更新通知气泡
const updateConnectivityAlert = (type) => {
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

// 主控制函数
const handelCheckStart = async (fromApp = false) => {
  if (fromApp) {
    await checkAllConnectivity(false, true, true);
  } else {
    await checkAllConnectivity(true, false, false);
  }
  // 传递完成状态到 store
  store.setLoadingStatus('connectivity', true);
  if (autoRefresh.value) {
    intervalId.value = setInterval(async () => {
      if (counter.value < maxCounts.value && !manualRun.value) {
        await checkAllConnectivity(false, false, false);
        counter.value++;
      } else {
        clearInterval(intervalId.value);
      }
    }, 3000);
  }
};

onMounted(() => {
  store.setMountingStatus('connectivity', true);
});

watch(() => store.allHasLoaded, (newValue, oldValue) => {
  if (newValue === true) {
    sendAlert();
  }
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

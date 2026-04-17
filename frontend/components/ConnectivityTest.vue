<template>
  <!-- Network Connectivity — refactor/UI round 2：去掉 jn-* 遗留样式，
       整体结构向 shadcn Card + 现代 service-status-card 模式靠拢 -->
  <section class="mb-10">
    <!-- 章节头：标题 + 说明 + 刷新按钮 -->
    <header class="flex items-start justify-between gap-4 mb-3">
      <div class="flex-1 min-w-0">
        <h2 id="Connectivity" class="text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚦 {{ t('connectivity.Title') }}
        </h2>
        <p class="my-3 text-base text-muted-foreground">{{ t('connectivity.Note') }}</p>
      </div>
      <JnTooltip :text="t('Tooltips.RefreshConnectivityTests')" side="left">
        <Button size="icon" variant="outline" class="shrink-0" @click="checkAllConnectivity(false, true, true)"
          aria-label="Refresh Connectivity Test">
          <component :is="isStarted ? RotateCw : ChevronRight" />
        </Button>
      </JnTooltip>
    </header>

    <!-- 卡片网格：现代设计用 CSS Grid 而不是负 margin flex -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card v-for="test in connectivityTests" :key="test.id" class="keyboard-shortcut-card cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50 jn-card"
        @click.prevent="checkConnectivityHandler(test, onTestComplete, true)"
        :title="t('connectivity.RefreshThisTest')">
        <CardContent class="p-4">
          <!-- 顶部：品牌图标 + 服务名 -->
          <div class="flex items-center gap-2 mb-3">
            <component :is="getConnectivityIcon(test.icon)" class="size-6 text-muted-foreground" />
            <span class="text-base font-medium truncate">{{ test.name }}</span>
          </div>
          <!-- 底部：状态指示灯 + 文字 + 延迟（mono 等宽数字右对齐） -->
          <div class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-1.5 text-base min-w-0">
              <span class="relative flex shrink-0">
                <span v-if="toneOf(test) === 'wait'"
                  class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
                <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(test))"></span>
              </span>
              <span :class="textClass(toneOf(test))" class="truncate">{{ test.status }}</span>
            </span>
            <span v-if="test.time !== 0" class="text-base font-mono tabular-nums text-muted-foreground"
              :title="t('connectivity.minTestTime') + test.mintime + ' ms'">
              {{ test.time }}<span class="ml-0.5 text-sm">ms</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStatusTone } from '@/composables/use-status-tone.js';
import {
  ChevronRight, Chrome, Cloud, Compass, Github, MessageCircle,
  MessageSquareQuote, RotateCw, Store, Youtube,
} from 'lucide-vue-next';

// 连通性测试的品牌图标映射（i18n 里还是 bi-* 名字）
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
  { id: 'taobao', name: 'Taobao', icon: 'shop', url: 'https://www.taobao.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'baidu', name: 'Baidu', icon: 'browser-safari', url: 'https://www.baidu.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'wechat', name: 'WeChat', icon: 'wechat', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'google', name: 'Google', icon: 'google', url: 'https://www.google.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'cloudflare', name: 'Cloudflare', icon: 'cloud-fill', url: 'https://www.cloudflare.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'youtube', name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'github', name: 'GitHub', icon: 'github', url: 'https://github.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'chatgpt', name: 'ChatGPT', icon: 'chat-quote-fill', url: 'https://chatgpt.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
]);

// 业务状态 → 4 档 tone（wait / ok-fast / ok-slow / fail）
const toneOf = (test) => {
  const waitLabel = t('connectivity.StatusWait');
  const okLabel = t('connectivity.StatusAvailable');
  const unavailableLabels = [t('connectivity.StatusUnavailable'), t('connectivity.StatusTimeout')];
  if (test.status === waitLabel) return 'wait';
  if (unavailableLabels.includes(test.status)) return 'fail';
  if (test.status.includes(okLabel)) return test.time < 200 ? 'ok-fast' : 'ok-slow';
  return 'wait';
};
const { dotClass, textClass } = useStatusTone();

// 检查单个连通性
const checkConnectivityHandler = (test, onTestComplete = () => { }, isManualRun) => {
  const beginTime = +new Date();
  manualRun.value = isManualRun;
  const img = new Image();
  const timeout = setTimeout(() => {
    test.status = t('connectivity.StatusUnavailable');
    onTestComplete(false);
  }, 3 * 1200);

  img.onload = () => {
    clearTimeout(timeout);
    test.status = t('connectivity.StatusAvailable');
    const testTime = new Date() - beginTime;
    test.mintime = test.mintime === 0 ? testTime : Math.min(test.mintime, testTime);
    test.time = (autoRefresh.value && !isManualRun) ? test.mintime : testTime;
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

// 检查所有
const checkAllConnectivity = (isAlertToShow, isRefresh, isManualRun) => {
  alertToShow.value = isAlertToShow;
  return new Promise((resolve) => {
    if (isRefresh) {
      connectivityTests.forEach((test) => {
        test.status = t('connectivity.StatusWait');
        test.time = 0;
      });
      trackEvent('Section', 'RefreshClick', 'Connectivity');
    }

    const totalTests = connectivityTests.length;
    let successCount = 0;
    const testPromises = [];

    const onTestComplete = (isSuccess) => { if (isSuccess) successCount++; };

    connectivityTests.forEach((test, index) => {
      testPromises.push(new Promise((testResolve, testReject) => {
        setTimeout(() => {
          checkConnectivityHandler(test, (isSuccess) => {
            if (isSuccess) { onTestComplete(true); testResolve(); }
            else { onTestComplete(false); testReject(); }
          }, isManualRun);
        }, 50 * index);
      }));
    });

    Promise.allSettled(testPromises).then(() => {
      updateConnectivityAlert(successCount === totalTests ? 'success' : 'error');
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

const updateConnectivityAlert = (type) => {
  if (type === 'success') {
    alertStyle.value = 'text-success';
    alertMessage.value = t('alert.Congrats_Message');
    alertTitle.value = t('alert.Congrats');
  } else {
    alertStyle.value = 'text-danger';
    alertMessage.value = t('alert.OhNo_Message');
    alertTitle.value = t('alert.OhNo');
  }
};

// 主控制
const handelCheckStart = async (fromApp = false) => {
  if (fromApp) await checkAllConnectivity(false, true, true);
  else await checkAllConnectivity(true, false, false);
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

watch(() => store.allHasLoaded, (newValue) => {
  if (newValue === true) sendAlert();
});

defineExpose({ checkAllConnectivity, handelCheckStart });
</script>

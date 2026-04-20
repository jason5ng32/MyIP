<template>
  <!-- Network Connectivity -->
  <section class="mb-10">
    <!-- Header -->
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="Connectivity"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚦 {{ t('connectivity.Title') }}
        </h2>
        <JnTooltip :text="t('Tooltips.RefreshConnectivityTests')" side="left">
          <Button size="icon" variant="outline" class="shrink-0 cursor-pointer"
            @click="checkAllConnectivity(false, true, true)" aria-label="Refresh Connectivity Test">
            <component :is="isStarted ? RotateCw : Play" />
          </Button>
        </JnTooltip>
      </div>
      <div class="text-base text-muted-foreground">
        <p>{{ t('connectivity.Note') }}</p>
      </div>
    </header>

    <!-- Card grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card v-for="test in connectivityTests" :key="test.id"
        class="keyboard-shortcut-card group relative cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50 jn-card"
        @click.prevent="checkConnectivityHandler(test, onTestComplete, true)"
        :title="t('connectivity.RefreshThisTest')">
        <!-- Remove button — only on custom cards, fades in on hover -->
        <button v-if="test.custom" type="button" @click.stop="removeCustomTarget(test.id)"
          class="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-opacity cursor-pointer"
          :aria-label="t('connectivity.addCustom.Remove')">
          <X class="size-3.5" />
        </button>
        <CardContent class="p-4">
          <!-- Top: brand icon + service name -->
          <div class="flex items-center gap-2 mb-3">
            <!-- Built-in: lucide icon. Custom: first-letter colored tile. -->
            <component v-if="test.icon" :is="test.icon" class="size-6 text-muted-foreground" />
            <span v-else
              class="size-6 shrink-0 rounded inline-flex items-center justify-center text-xs font-semibold text-white"
              :style="{ backgroundColor: letterColor(test.name) }">
              {{ (test.name || '?').charAt(0).toUpperCase() }}
            </span>
            <span class="text-base font-medium truncate">{{ test.name }}</span>
          </div>
          <!-- Bottom: status indicator + text + delay -->
          <div class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-1.5 text-base min-w-0">
              <span v-if="toneOf(test) === 'wait'" class="relative flex shrink-0">
                <span class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
                <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(test))"></span>
              </span>
              <component v-else-if="statusFaceIcon(test)" :is="statusFaceIcon(test)" class="size-4 shrink-0"
                :class="textClass(toneOf(test))" />
              <span :class="textClass(toneOf(test))" class="font-mono whitespace-nowrap min-w-0">{{ test.status
                }}</span>
            </span>
            <span v-if="test.time !== 0" class="text-base font-mono tabular-nums text-muted-foreground"
              :title="t('connectivity.minTestTime') + test.mintime + ' ms'">
              {{ test.time }}<span class="ml-0.5 text-sm">ms</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <!-- "+" tile for adding a custom test. Hidden when at the 10-item cap. -->
      <Card v-if="canAddCustom" @click="openAddDialog"
        class="cursor-pointer border-dashed bg-transparent hover:bg-muted/50 transition-colors"
        :title="t('connectivity.addCustom.AddCard')">
        <CardContent class="p-4 min-h-[84px] flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <CirclePlus class="size-5" />
          <span class="text-sm font-medium">{{ t('connectivity.addCustom.AddCard') }}</span>
        </CardContent>
      </Card>
    </div>

    <!-- Add custom test dialog -->
    <Dialog :open="addDialogOpen" @update:open="onAddDialogChange">
      <DialogContent class="max-w-md">
        <DialogHeader :icon="CirclePlus" :title="t('connectivity.addCustom.Title')" />
        <div class="space-y-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <Label for="custom-conn-name">{{ t('connectivity.addCustom.NameLabel') }}</Label>
            <Input id="custom-conn-name" v-model="addName" :placeholder="t('connectivity.addCustom.NamePlaceholder')"
              :aria-invalid="isNameError ? 'true' : undefined"
              @keyup.enter="handleAdd" maxlength="20" />
          </div>
          <!-- URL -->
          <div class="space-y-1.5">
            <Label for="custom-conn-url">{{ t('connectivity.addCustom.UrlLabel') }}</Label>
            <Input id="custom-conn-url" v-model="addUrl" :placeholder="t('connectivity.addCustom.UrlPlaceholder')"
              :aria-invalid="isUrlError ? 'true' : undefined"
              @keyup.enter="handleAdd" />
          </div>
          <!-- Hint about test method limitations -->
          <p class="mb-2 text-xs text-muted-foreground leading-relaxed">{{ t('connectivity.addCustom.Hint') }}</p>
          <!-- Error message. Always rendered (no v-if) with min-height so the
               dialog height never jumps when an error appears/disappears. -->
          <p class="text-xs text-destructive min-h-4" aria-live="polite">{{ addError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="action" type="button" @click="handleAdd"
              :disabled="addName.length === 0 || addUrl.length === 0" class="cursor-pointer">
              {{ t('connectivity.addCustom.Add') }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStatusTone } from '@/composables/use-status-tone.js';
import {
  Play, Chrome, Cloud, Compass, CirclePlus, Frown, Github, Meh, MessageCircle,
  MessageSquareQuote, RotateCw, Smile, Store, X, Youtube,
} from 'lucide-vue-next';

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

// Connectivity test list.
//
// The first 8 entries are the built-in (non-removable) targets. Any additional
// entries have `.custom = true` and are sync'd in from
// `userPreferences.customConnectivityTargets` by the watcher below. Keeping
// both in a single reactive array lets `checkAllConnectivity` / `forEach` /
// the J/K keyboard navigation treat all tiles uniformly — only the
// add/remove UI cares which one is which.
const MAX_CUSTOM_TARGETS = 9;
const connectivityTests = reactive([
  { id: 'wechat', name: 'WeChat', icon: MessageCircle, url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'taobao', name: 'Taobao', icon: Store, url: 'https://www.taobao.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'google', name: 'Google', icon: Chrome, url: 'https://www.google.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'cloudflare', name: 'Cloudflare', icon: Cloud, url: 'https://www.cloudflare.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'youtube', name: 'YouTube', icon: Youtube, url: 'https://www.youtube.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'github', name: 'GitHub', icon: Github, url: 'https://github.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
  { id: 'chatgpt', name: 'ChatGPT', icon: MessageSquareQuote, url: 'https://chatgpt.com/favicon.ico?', status: t('connectivity.StatusWait'), time: 0, mintime: 0 },
]);

// Sync user-defined custom targets into the reactive list. Runs on mount
// (immediate) and any time the stored preference changes (add / remove).
//
// IMPORTANT: preserve existing custom-test state on reconciliation. A naïve
// "remove all custom + re-push from storage" resets `status` / `time` /
// `mintime` every time the user adds one more target, flashing every existing
// custom card back to "Awaiting Test". Instead we diff by id: drop only the
// customs that disappeared, leave survivors untouched, and push brand-new
// ones in "Awaiting Test" state.
watch(
  () => userPreferences.value.customConnectivityTargets,
  (newTargets) => {
    const targets = newTargets || [];
    const targetIds = new Set(targets.map((t) => t.id));

    // Drop customs that are no longer in storage; keep the rest in place.
    for (let i = connectivityTests.length - 1; i >= 0; i--) {
      const entry = connectivityTests[i];
      if (entry.custom && !targetIds.has(entry.id)) {
        connectivityTests.splice(i, 1);
      }
    }

    // Track which custom ids already exist so we only push true newcomers.
    const existingCustomIds = new Set(
      connectivityTests.filter((entry) => entry.custom).map((entry) => entry.id),
    );

    for (const target of targets) {
      if (existingCustomIds.has(target.id)) continue;
      connectivityTests.push({
        id: target.id,
        name: target.name,
        url: target.url,
        custom: true,
        icon: null, // rendered as a first-letter tile in the template
        status: t('connectivity.StatusWait'),
        time: 0,
        mintime: 0,
      });
    }
  },
  { immediate: true, deep: true },
);

const canAddCustom = computed(() => {
  const current = userPreferences.value.customConnectivityTargets || [];
  return current.length < MAX_CUSTOM_TARGETS;
});

// Deterministic color for a name — same input always returns the same hue so
// "Weibo" stays red / "Mastodon" stays teal across sessions and devices.
const letterColor = (name) => {
  const hash = [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 50%, 45%)`;
};

// Business status → 4 tone levels (wait / ok-fast / ok-slow / fail)
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

// Face icon mapping
// Unreachable/timeout → Frown; reachable and <200ms → Smile; reachable and ≥200ms → Meh
// Wait state does not show face (the status light's ping animation already expresses "waiting")
const statusFaceIcon = (test) => {
  const unavailableLabels = [t('connectivity.StatusUnavailable'), t('connectivity.StatusTimeout')];
  const okLabel = t('connectivity.StatusAvailable');
  if (unavailableLabels.includes(test.status)) return Frown;
  if (test.status.includes(okLabel)) return test.time < 200 ? Smile : Meh;
  return null;
};

// Check single connectivity
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

// Check all
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

// ───────────────────────────────────────────────────────────────────────────
// Add/remove custom targets

const addDialogOpen = ref(false);
const addName = ref('');
const addUrl = ref('');
const addError = ref('');

// Map the shared `addError` string back to which field it belongs to, so we
// can toggle each Input's `aria-invalid` independently. Shadcn-vue's Input
// component has Tailwind `aria-invalid:*` styling built in — setting the
// attribute paints a red ring on just the offending field without any extra
// CSS. Comparing against translated strings is uglier than field-specific
// error refs would be, but it keeps the existing single-error API intact.
const isNameError = computed(() => addError.value === t('connectivity.addCustom.NameRequired'));
const isUrlError = computed(() => {
  const err = addError.value;
  return err === t('connectivity.addCustom.UrlRequired')
    || err === t('connectivity.addCustom.InvalidUrl');
});

const openAddDialog = () => {
  addName.value = '';
  addUrl.value = '';
  addError.value = '';
  addDialogOpen.value = true;
  // Focus the first input once the dialog's portal content mounts.
  nextTick(() => {
    const el = document.getElementById('custom-conn-name');
    if (el) el.focus();
  });
};

const onAddDialogChange = (val) => { addDialogOpen.value = val; };

// Normalize any of { "weibo.com", "www.weibo.com", "https://weibo.com/x/y?q=1" }
// down to a stable favicon URL ending with '?' (the cache-bust suffix
// gets appended at request time by checkConnectivityHandler).
const normalizeToFaviconUrl = (input) => {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return `${parsed.origin}/favicon.ico?`;
  } catch {
    return null;
  }
};

const handleAdd = () => {
  addError.value = '';
  const name = addName.value.trim();
  const rawUrl = addUrl.value.trim();

  if (!name) {
    addError.value = t('connectivity.addCustom.NameRequired');
    return;
  }
  if (!rawUrl) {
    addError.value = t('connectivity.addCustom.UrlRequired');
    return;
  }
  const url = normalizeToFaviconUrl(rawUrl);
  if (!url) {
    addError.value = t('connectivity.addCustom.InvalidUrl');
    return;
  }

  const current = userPreferences.value.customConnectivityTargets || [];
  if (current.length >= MAX_CUSTOM_TARGETS) {
    addError.value = t('connectivity.addCustom.LimitReached');
    return;
  }

  const newTarget = {
    id: `custom-${Date.now()}`,
    name: name.slice(0, 20),
    url,
  };
  store.updatePreference('customConnectivityTargets', [...current, newTarget]);
  trackEvent('Section', 'AddCustomTarget', 'Connectivity');
  addDialogOpen.value = false;
};

const removeCustomTarget = (id) => {
  const current = userPreferences.value.customConnectivityTargets || [];
  store.updatePreference(
    'customConnectivityTargets',
    current.filter((t) => t.id !== id),
  );
  trackEvent('Section', 'RemoveCustomTarget', 'Connectivity');
};

// ───────────────────────────────────────────────────────────────────────────
// Main control
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

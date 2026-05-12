<template>
  <section class="mb-10">
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
        class="keyboard-shortcut-card group relative transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50 jn-card">
        <!-- Custom-card remove button, fades in on hover -->
        <button v-if="test.custom" type="button" @click.stop="removeCustomTarget(test.id)"
          class="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground md:opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-opacity cursor-pointer"
          :aria-label="t('connectivity.addCustom.Remove')" :title="t('connectivity.addCustom.Remove')">
          <X class="size-3.5" />
        </button>
        <CardContent class="p-4">
          <!-- Brand icon (built-in) or first-letter tile (custom) + name -->
          <div class="flex items-center gap-2 mb-3">
            <component v-if="test.icon" :is="test.icon" class="size-6 text-muted-foreground" />
            <span v-else
              class="size-6 shrink-0 rounded-lg inline-flex items-center justify-center text-xs font-semibold text-muted-foreground border-2 border-muted-foreground">
              {{ (test.name || '?').charAt(0).toUpperCase() }}
            </span>
            <span class="text-base font-medium truncate">{{ test.name }}</span>
          </div>
          <!-- Status + ms. Multi mode pins these to the best round (see checkConnectivityHandler). -->
          <div class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-1.5 text-base min-w-0 cursor-pointer"
              @click.prevent="checkConnectivityHandler(test, onTestComplete, true)"
              :title="t('connectivity.RefreshThisTest')">
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
          <!-- Multi-test per-round progress dots (historical snapshot). -->
          <div v-if="multipleTests" class="flex items-center gap-1 mt-2">
            <JnTooltip v-for="i in totalRounds" :key="i" :text="roundTooltipText(test, i - 1)" side="top">
              <span class="group/dot inline-flex items-center justify-center p-1 -m-1 cursor-default">
                <span class="size-1.5 rounded-full md:transition-transform md:duration-200 md:group-hover/dot:scale-[2.0]"
                  :class="progressDotClass(test, i - 1)"></span>
              </span>
            </JnTooltip>
          </div>
        </CardContent>
      </Card>

      <!-- "+" tile to add a custom test; hidden at the cap -->
      <Card v-if="canAddCustom" @click="openAddDialog"
        class="cursor-pointer border-dashed bg-transparent hover:bg-muted/50 transition-colors"
        :title="t('connectivity.addCustom.AddCard')">
        <CardContent class="p-4 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
          :class="multipleTests ? 'min-h-[106px]' : 'min-h-[92px]'">
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
          <div class="space-y-1.5">
            <Label for="custom-conn-name">{{ t('connectivity.addCustom.NameLabel') }}</Label>
            <Input id="custom-conn-name" v-model="addName" :placeholder="t('connectivity.addCustom.NamePlaceholder')"
              :aria-invalid="isNameError ? 'true' : undefined" autocomplete="off" autocorrect="off" autocapitalize="off"
              spellcheck="false" data-1p-ignore data-lpignore="true" @keyup.enter="handleAdd" maxlength="20" />
          </div>
          <div class="space-y-1.5">
            <Label for="custom-conn-url">{{ t('connectivity.addCustom.UrlLabel') }}</Label>
            <Input id="custom-conn-url" v-model="addUrl" :placeholder="t('connectivity.addCustom.UrlPlaceholder')"
              :aria-invalid="isUrlError ? 'true' : undefined" autocomplete="off" autocorrect="off" autocapitalize="off"
              spellcheck="false" data-1p-ignore data-lpignore="true" @keyup.enter="handleAdd" />
          </div>
          <p class="mb-2 text-xs text-muted-foreground leading-relaxed">{{ t('connectivity.addCustom.Hint') }}</p>
          <!-- min-h-4 reserves space so the dialog height doesn't jump -->
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
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStatusTone, ipFieldTone } from '@/composables/use-status-tone.js';
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
// Snapshot at mount; pref applies on next reload to avoid mid-cycle split-brain.
const multipleTests = ref(userPreferences.value.connectivityMultipleTests);
const autoShowAltert = ref(userPreferences.value.popupConnectivityNotifications);
const isStarted = ref(false);
const counter = ref(0);
const maxCounts = ref(9);
const manualRun = ref(false);
const intervalId = ref(null);
const totalRounds = computed(() => 1 + maxCounts.value);
// Defer the toast until all rounds are done so multi mode can't fire OhNo after round 1.
const allRoundsDone = ref(false);
const alertFired = ref(false);

// Built-in targets first; custom ones (`.custom = true`) are merged in by
// the watcher below. Keeping both in one reactive array lets every iterator
// (run-loop, keyboard nav) treat tiles uniformly.
const MAX_CUSTOM_TARGETS = 9;
// `roundResults` records per-round { tone, time } for the progress dots,
// independent of the best-of-N face/text. `time` powers the per-dot hover
// tooltip; for `tone: 'fail'` rounds it stays 0. Bootstrap-only writer.
const connectivityTests = reactive([
  { id: 'wechat', name: 'WeChat', icon: MessageCircle, url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
  { id: 'taobao', name: 'Taobao', icon: Store, url: 'https://www.taobao.com/favicon.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
  { id: 'google', name: 'Google', icon: Chrome, url: 'https://www.google.com/favicon.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
  { id: 'cloudflare', name: 'Cloudflare', icon: Cloud, url: 'https://www.cloudflare.com/favicon.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
  { id: 'youtube', name: 'YouTube', icon: Youtube, url: 'https://www.youtube.com/favicon.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
  { id: 'github', name: 'GitHub', icon: Github, url: 'https://github.com/favicon.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
  { id: 'chatgpt', name: 'ChatGPT', icon: MessageSquareQuote, url: 'https://chatgpt.com/favicon.ico', status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [] },
]);

// Reconcile custom targets by id (not wipe-and-refill) so existing cards
// don't flash back to "Awaiting Test" each time the user adds another one.
watch(
  () => userPreferences.value.customConnectivityTargets,
  (newTargets) => {
    const targets = newTargets || [];
    const targetIds = new Set(targets.map((t) => t.id));

    // Drop customs no longer in storage.
    for (let i = connectivityTests.length - 1; i >= 0; i--) {
      const entry = connectivityTests[i];
      if (entry.custom && !targetIds.has(entry.id)) {
        connectivityTests.splice(i, 1);
      }
    }

    // Push only newcomers.
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
        icon: null,
        status: t('connectivity.StatusWait'),
        time: 0,
        mintime: 0,
        roundResults: [],
      });
    }
  },
  { immediate: true, deep: true },
);

const canAddCustom = computed(() => {
  const current = userPreferences.value.customConnectivityTargets || [];
  return current.length < MAX_CUSTOM_TARGETS;
});

const letterColor = (name) => {
  const hash = [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 50%, 45%)`;
};

// Status string → tone. Custom isSuccess + time-based fast/slow split,
// since the value here isn't an IP like the other toneOf call sites.
const toneOf = (test) => {
  const okLabel = t('connectivity.StatusAvailable');
  return ipFieldTone(test.status, {
    waitLabels: t('connectivity.StatusWait'),
    errorLabels: [t('connectivity.StatusUnavailable'), t('connectivity.StatusTimeout')],
    isSuccess: (s) => typeof s === 'string' && s.includes(okLabel),
    time: test.time,
  });
};
const { dotClass, textClass } = useStatusTone();

// Filled → tone color; head-of-queue → pulse (suppressed once the user
// takes over manually so we don't promise rounds that won't land); rest → dim.
const progressDotClass = (test, idx) => {
  const entry = test.roundResults[idx];
  if (entry) return dotClass(entry.tone);
  if (!manualRun.value && idx === test.roundResults.length) return 'bg-muted-foreground/40 animate-pulse';
  return 'bg-muted-foreground/20';
};

// Per-dot hover tooltip: empty string disables the tooltip (JnTooltip's
// own `!text` guard handles that), so pending/never-run dots stay quiet
// while finished rounds report their latency or a localized "Failed" label.
const roundTooltipText = (test, idx) => {
  const entry = test.roundResults[idx];
  if (!entry) return '';
  const n = idx + 1;
  if (entry.tone === 'fail') return t('connectivity.RoundCount', { n }) + t('connectivity.StatusUnavailable');
  return t('connectivity.RoundCount', { n}) + entry.time + ' ms';
};

// Reachable: Smile <200ms, Meh ≥200ms. Unreachable: Frown. Wait: no face.
const statusFaceIcon = (test) => {
  const unavailableLabels = [t('connectivity.StatusUnavailable'), t('connectivity.StatusTimeout')];
  const okLabel = t('connectivity.StatusAvailable');
  if (unavailableLabels.includes(test.status)) return Frown;
  if (test.status.includes(okLabel)) return test.time < 200 ? Smile : Meh;
  return null;
};

// no-cors GET so any reachable origin resolves the promise — HEAD and <img>
// both have failure modes that mis-flag reachable sites as down.
// cache: 'no-store' avoids cached near-zero RTTs. AbortController lets us
// distinguish a completed request from a timeout without double-firing.
const checkConnectivityHandler = async (test, onTestComplete = () => { }, isManualRun) => {
  manualRun.value = isManualRun;
  // Only bootstrap multi-test rounds feed the dot history; manual paths skip it.
  const recordRound = multipleTests.value && !isManualRun;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3 * 1200);
  const beginTime = performance.now();
  try {
    await fetch(test.url, {
      mode: 'no-cors',
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const testTime = Math.round(performance.now() - beginTime);
    test.status = t('connectivity.StatusAvailable');
    test.mintime = test.mintime === 0 ? testTime : Math.min(test.mintime, testTime);
    test.time = (multipleTests.value && !isManualRun) ? test.mintime : testTime;
    if (recordRound) test.roundResults.push({ tone: testTime < 200 ? 'ok-fast' : 'ok-slow', time: testTime });
    onTestComplete(true);
  } catch {
    clearTimeout(timeoutId);
    // Best-of-N: in multi mode a later failure doesn't downgrade a card
    // that already succeeded (mintime > 0). The dot row still records the
    // real 'fail' — it's per-round history, separate from the face/text.
    if (multipleTests.value && !isManualRun && test.mintime > 0) {
      test.status = t('connectivity.StatusAvailable');
      test.time = test.mintime;
    } else {
      test.time = 0;
      test.status = t('connectivity.StatusUnavailable');
    }
    if (recordRound) test.roundResults.push({ tone: 'fail', time: 0 });
    onTestComplete(false);
  }
};

const checkAllConnectivity = (isAlertToShow, isRefresh, isManualRun) => {
  // Sticky false→true; interval ticks must not overwrite the bootstrap's `true`.
  if (isAlertToShow) alertToShow.value = true;
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
      // Multi mode overwrites this with finalizeMultiTestAlert before the toast fires.
      updateConnectivityAlert(successCount === totalTests ? 'success' : 'error');
      resolve();
    });

    isStarted.value = true;
  });
};

// Fires once when all four gates pass: pref, bootstrap opted in, allHasLoaded, allRoundsDone.
const sendAlert = () => {
  if (alertFired.value) return;
  if (!autoShowAltert.value) return;
  if (!alertToShow.value) return;
  if (!store.allHasLoaded) return;
  if (!allRoundsDone.value) return;
  alertFired.value = true;
  store.setAlert(true, alertStyle.value, alertMessage.value, alertTitle.value);
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

// ── Add/remove custom targets ──────────────────────────────────────────────
const addDialogOpen = ref(false);
const addName = ref('');
const addUrl = ref('');
const addError = ref('');

// Map the shared addError back to its field so aria-invalid only flags the
// offending Input (shadcn-vue's Input paints the red ring from that attr).
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
  // Focus first input after the portal mounts.
  nextTick(() => {
    const el = document.getElementById('custom-conn-name');
    if (el) el.focus();
  });
};

const onAddDialogChange = (val) => { addDialogOpen.value = val; };

// Bare domain → /favicon.ico (CDN-cached, fast & meaningful RTT).
// Explicit paths preserved so users can probe specific endpoints.
const normalizeTestUrl = (input) => {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    if (parsed.pathname === '/' && !parsed.search) {
      return `${parsed.origin}/favicon.ico`;
    }
    return parsed.toString();
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
  const url = normalizeTestUrl(rawUrl);
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

// Multi-mode aggregate: `mintime > 0` ≡ reachable in at least one round.
const finalizeMultiTestAlert = () => {
  const total = connectivityTests.length;
  const everSucceeded = connectivityTests.filter((t) => t.mintime > 0).length;
  updateConnectivityAlert(everSucceeded === total ? 'success' : 'error');
};

// ── Main control ───────────────────────────────────────────────────────────
const handelCheckStart = async (fromApp = false) => {
  const multi = multipleTests.value;
  if (fromApp) await checkAllConnectivity(false, true, true);
  else await checkAllConnectivity(true, false, false);
  store.setLoadingStatus('connectivity', true);
  if (multi) {
    intervalId.value = setInterval(async () => {
      if (counter.value < maxCounts.value && !manualRun.value) {
        await checkAllConnectivity(false, false, false);
        counter.value++;
        if (counter.value >= maxCounts.value) {
          // Final round — re-aggregate and unlock the toast pipeline.
          finalizeMultiTestAlert();
          allRoundsDone.value = true;
          clearInterval(intervalId.value);
          intervalId.value = null;
        }
      } else {
        // User took over (card click) — stop and suppress the auto-toast.
        clearInterval(intervalId.value);
        intervalId.value = null;
      }
    }, 500);
  } else {
    allRoundsDone.value = true;
  }
};

onMounted(() => {
  store.setMountingStatus('connectivity', true);
});

// Stop the interval on unmount.
onBeforeUnmount(() => {
  if (intervalId.value !== null) {
    clearInterval(intervalId.value);
    intervalId.value = null;
  }
});

// Either signal flipping fires sendAlert; the gates inside pick the winner.
watch(() => store.allHasLoaded, (v) => { if (v) sendAlert(); });
watch(allRoundsDone, (v) => { if (v) sendAlert(); });

defineExpose({ checkAllConnectivity, handelCheckStart });
</script>

<template>
  <section class="mb-10">
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="Connectivity"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚦 {{ t('connectivity.Title') }}
        </h2>
        <JnTooltip :text="t('Tooltips.RefreshConnectivityTests')" side="left">
          <Button size="icon" variant="outline" class="shrink-0 cursor-pointer" @click="handelCheckStart('manual')"
            aria-label="Refresh Connectivity Test">
            <component :is="isStarted ? RotateCw : Play" />
          </Button>
        </JnTooltip>
      </div>
      <div class="text-base text-muted-foreground">
        <p v-if="!isSimpleMode">{{ t('connectivity.Note') }}</p>
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
          <!-- Site favicon (built-in / imported) or first-letter tile (custom) + name.
               Favicons are same-origin (public/favicons/), so they render even
               when the tested site is unreachable; a load error falls back to
               the letter tile. -->
          <div class="flex items-center gap-2 mb-3 cursor-pointer"
            @click.prevent="checkConnectivityHandler(test, () => { }, true)" :title="t('connectivity.RefreshThisTest')">
            <img v-if="test.favicon && !test.faviconFailed" :src="test.favicon" alt=""
              @error="test.faviconFailed = true"
              class="size-6 shrink-0 rounded-md border bg-background object-contain p-0.5" loading="lazy" />
            <span v-else
              class="size-6 shrink-0 rounded-lg inline-flex items-center justify-center text-xs font-semibold text-muted-foreground border">
              {{ (test.name || '?').charAt(0).toUpperCase() }}
            </span>
            <span class="text-base font-medium truncate">{{ test.name }}</span>
          </div>
          <!-- Status + ms. Multi mode pins these to the best round (see checkConnectivityHandler). -->
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
          <!-- Multi-test per-round progress dots (historical snapshot). -->
          <div v-if="multipleTests" class="flex items-center gap-1 mt-2">
            <JnTooltip v-for="i in totalRounds" :key="i" :text="roundTooltipText(test, i - 1)" side="top">
              <span class="group/dot inline-flex items-center justify-center p-1 -m-1 cursor-default">
                <span
                  class="size-1.5 rounded-full md:transition-transform md:duration-200 md:group-hover/dot:scale-[2.0]"
                  :class="progressDotClass(test, i - 1)"></span>
              </span>
            </JnTooltip>
          </div>
        </CardContent>
      </Card>

      <!-- "Add Test" tile: stacked flag/brand icons signal that curated
           lists live behind it, not just a blank form. Always visible —
           at the cap the dialog is still the way to remove imported lists. -->
      <Card @click="addDialogOpen = true"
        class="cursor-pointer border-dashed bg-transparent hover:bg-muted/50 transition-colors"
        :title="t('connectivity.addCustom.AddCard')">
        <CardContent class="p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground"
          :class="multipleTests ? 'min-h-[106px]' : 'min-h-[92px]'">
          <span class="flex -space-x-2">
            <template v-for="item in TILE_PREVIEW" :key="item.emoji || item.id">
              <span v-if="item.type === 'emoji'"
                class="size-6 rounded-full ring-2 ring-background bg-background inline-flex items-center justify-center text-sm leading-none">
                {{ item.emoji }}</span>
              <img v-else :src="faviconPath(item.id)" alt=""
                class="size-6 rounded-full ring-2 ring-background bg-background object-contain p-0.5" />
            </template>
          </span>
          <span class="text-sm font-medium inline-flex items-center gap-1">
            <Plus class="size-4" /> {{ t('connectivity.addCustom.AddCard') }}
          </span>
        </CardContent>
      </Card>
    </div>

    <!-- Add / import dialog (custom form + curated list browser) -->
    <ConnectivityAddDialog v-model:open="addDialogOpen" :builtin-urls="builtinUrls" />
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events';
import { CONNECTIVITY_STATUS } from '@/utils/report-schema.js';
import { TILE_PREVIEW, faviconPath } from '@/data/connectivity-import-lists.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ConnectivityAddDialog from '@/components/widgets/ConnectivityAddDialog.vue';
import { useStatusTone, ipFieldTone } from '@/composables/use-status-tone.js';
import {
  Play, Frown, Meh, Plus, RotateCw, Smile, X,
} from '@lucide/vue';

const { t } = useI18n();
const store = useMainStore();
const userPreferences = computed(() => store.userPreferences);
const isSimpleMode = computed(() => userPreferences.value.simpleMode);
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

// Built-in targets first; custom / imported ones (`.custom = true`) are
// merged in by the watcher below. Keeping both in one reactive array lets
// every iterator (run-loop, keyboard nav) treat tiles uniformly.
// `roundResults` records per-round { tone, time } for the progress dots,
// independent of the best-of-N face/text. `time` powers the per-dot hover
// tooltip; for `tone: 'fail'` rounds it stays 0. Bootstrap-only writer.
// Icons come from the committed same-origin favicon set (public/favicons/).
const builtinTarget = (id, name, url) => ({
  id, name, url, favicon: faviconPath(id), status: t('connectivity.StatusWait'), time: 0, mintime: 0, roundResults: [],
});
const connectivityTests = reactive([
  builtinTarget('google', 'Google', 'https://www.google.com/favicon.ico'),
  builtinTarget('youtube', 'YouTube', 'https://www.youtube.com/favicon.ico'),
  builtinTarget('github', 'GitHub', 'https://github.com/favicon.ico'),
  // Use speed.cloudflare.com (not www.cloudflare.com): the marketing site
  // attaches `Link: rel=preload` headers for its brand fonts to every response
  // — including /favicon.ico — which the browser honors regardless of fetch
  // mode, then fails CORS on the woff2 files. speed.cloudflare.com serves a
  // plain favicon with no preload headers.
  builtinTarget('cloudflare', 'Cloudflare', 'https://speed.cloudflare.com/favicon.ico'),
  builtinTarget('claude', 'Claude', 'https://claude.com/favicon.ico'),
  builtinTarget('chatgpt', 'ChatGPT', 'https://chatgpt.com/favicon.ico'),
  builtinTarget('wechat', 'WeChat', 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico'),
]);

// Hostname-dedupe input for the import dialog.
const builtinUrls = connectivityTests.map((test) => test.url);

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
      const entry = reactive({
        id: target.id,
        name: target.name,
        url: target.url,
        custom: true,
        // Imported entries carry a same-origin favicon + their source list;
        // hand-added ones fall back to the letter tile.
        favicon: target.favicon || null,
        listId: target.listId || null,
        status: t('connectivity.StatusWait'),
        time: 0,
        mintime: 0,
        roundResults: [],
      });
      connectivityTests.push(entry);
      // Cards added after the bootstrap pass (import / hand-add) test
      // themselves right away instead of sitting at "Awaiting Test".
      if (isStarted.value) checkConnectivityHandler(entry, () => { }, true);
    }
  },
  { immediate: true, deep: true },
);

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
  return t('connectivity.RoundCount', { n }) + entry.time + ' ms';
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
  // Only multi-cycle passes feed the dot history; per-card refreshes skip it.
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
    // Locale-free twin of the localized status label, consumed by the report
    // builder (utils/report-builders.js) — the label itself can't be mapped
    // back to an enum without string comparison against t() output.
    test.statusCode = CONNECTIVITY_STATUS.OK;
    test.mintime = test.mintime === 0 ? testTime : Math.min(test.mintime, testTime);
    test.time = recordRound ? test.mintime : testTime;
    if (recordRound) test.roundResults.push({ tone: testTime < 200 ? 'ok-fast' : 'ok-slow', time: testTime });
    onTestComplete(true);
  } catch {
    clearTimeout(timeoutId);
    // Best-of-N: in multi mode a later failure doesn't downgrade a card
    // that already succeeded (mintime > 0). The dot row still records the
    // real 'fail' — it's per-round history, separate from the face/text.
    if (recordRound && test.mintime > 0) {
      test.status = t('connectivity.StatusAvailable');
      test.statusCode = CONNECTIVITY_STATUS.OK;
      test.time = test.mintime;
    } else {
      test.time = 0;
      test.status = t('connectivity.StatusUnavailable');
      test.statusCode = CONNECTIVITY_STATUS.UNREACHABLE;
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
        test.statusCode = undefined;
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
      // Domain event: snapshot after every pass (multi-round included) —
      // latest wins downstream in the report collector.
      emitAppEvent('connectivity:finished', {
        targets: connectivityTests.map((test) => ({
          id: test.id,
          name: test.name,
          custom: test.custom === true,
          statusCode: test.statusCode,
          time: test.time,
          mintime: test.mintime,
        })),
      });
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
// The add/import dialog itself lives in ConnectivityAddDialog.vue; this
// component only owns the open flag and per-card removal.
const addDialogOpen = ref(false);

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
// `trigger` selects three behaviors (arming the toast = setting alertToShow):
//   'boot'    — startup auto-run: arm toast, no card reset
//   'manual'  — section refresh button: arm toast, reset cards
//   'refresh' — global "refresh everything": suppress toast (global alert covers it), reset cards
// Multi-round mode applies to every trigger, not just boot — with the
// connectivity auto-run switch off, the manual/global refresh IS the user's
// only entry point, and the rounds preference must still hold there.
const handelCheckStart = async (trigger = 'boot') => {
  const multi = multipleTests.value;
  const isAuto = trigger === 'boot';
  const showToast = trigger !== 'refresh';
  const resetCards = trigger !== 'boot';
  // Fresh multi cycle: stop any round loop still ticking and zero its
  // bookkeeping so the dot rows and the best-of-N aggregate restart cleanly.
  if (multi) {
    if (intervalId.value !== null) {
      clearInterval(intervalId.value);
      intervalId.value = null;
    }
    counter.value = 0;
    manualRun.value = false;
    allRoundsDone.value = false;
    connectivityTests.forEach((test) => {
      test.roundResults = [];
      test.mintime = 0;
    });
  }
  await checkAllConnectivity(showToast, resetCards, !multi && !isAuto);
  store.setLoadingStatus('Connectivity', true);
  if (multi) {
    if (intervalId.value !== null) clearInterval(intervalId.value);
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
  store.setMountingStatus('Connectivity', true);
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

defineExpose({ handelCheckStart });
</script>

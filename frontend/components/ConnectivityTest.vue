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
        <!-- Remove button, fades in on hover. Two-step confirm: first click
             arms "X?" (self-reverting), the second deletes; on the last
             remaining target the click just raises a toast. -->
        <button type="button" @click.stop="handleRemoveClick(test.id)"
          class="absolute top-1.5 right-1.5 p-1 rounded-md inline-flex items-center transition-opacity cursor-pointer"
          :class="confirmingRemoveId === test.id
            ? 'text-destructive bg-muted'
            : 'text-muted-foreground md:opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted'"
          :aria-label="t('connectivity.addCustom.Remove')" :title="t('connectivity.addCustom.Remove')">
          <X class="size-3.5" />
          <span v-if="confirmingRemoveId === test.id" class="text-xs font-semibold leading-none">?</span>
        </button>
        <CardContent class="p-4">
          <!-- Site favicon (default / imported) or first-letter tile (custom) + name.
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
          <!-- Multi-test per-round latency bars, all on one absolute scale
               (taller = slower, see barStyle); failed / pending rounds are
               short gray stubs. -->
          <div v-if="multipleTests" class="flex items-end gap-1 mt-2 h-4">
            <JnTooltip v-for="i in totalRounds" :key="i" :text="roundTooltipText(test, i - 1)" side="top">
              <span class="group/bar inline-flex h-full items-end justify-center px-1 -mx-1 cursor-default">
                <span class="w-1.5 rounded-[2px] md:transition-[height,filter] md:duration-200 md:group-hover/bar:brightness-125"
                  :class="barClass(test, i - 1)" :style="barStyle(test, i - 1)"></span>
              </span>
            </JnTooltip>
          </div>
        </CardContent>
      </Card>

      <!-- "Add Test" tile: stacked flag/brand icons signal that curated
           lists live behind it, not just a blank form. -->
      <Card @click="addDialogOpen = true"
        class="cursor-pointer border-dashed bg-transparent hover:bg-muted/50 transition-colors"
        :title="t('connectivity.addCustom.AddCard')">
        <CardContent class="p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground"
          :class="multipleTests ? 'min-h-29' : 'min-h-23'">
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
    <ConnectivityAddDialog v-model:open="addDialogOpen" />

  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent, waitForAppEvent } from '@/utils/app-events';
import { useAppCommand } from '@/composables/use-app-command.js';
import { CONNECTIVITY_STATUS } from '@/utils/report-schema.js';
import { TILE_PREVIEW, faviconPath } from '@/data/connectivity-import-lists.js';
import { removeTarget } from '@/utils/connectivity-import.js';
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

// One reactive test entry per stored target (the connectivityTargets
// preference holds the whole set, defaults included). `roundResults`
// records per-round { tone, time } for the latency bars; icons come from
// the committed favicon set, hand-added targets fall back to letter tiles.
const targetEntry = (target) => reactive({
  id: target.id,
  name: target.name,
  url: target.url,
  favicon: target.favicon || null,
  status: t('connectivity.StatusWait'),
  time: 0,
  mintime: 0,
  roundResults: [],
});
const connectivityTests = reactive([]);

// Reconcile by id (not wipe-and-refill) so existing cards don't flash back
// to "Awaiting Test" each time the user adds or removes another one.
watch(
  () => userPreferences.value.connectivityTargets,
  (newTargets) => {
    const targets = newTargets || [];
    const targetIds = new Set(targets.map((t) => t.id));

    // Drop targets no longer in storage.
    for (let i = connectivityTests.length - 1; i >= 0; i--) {
      if (!targetIds.has(connectivityTests[i].id)) {
        connectivityTests.splice(i, 1);
      }
    }

    // Push only newcomers.
    const existingIds = new Set(connectivityTests.map((entry) => entry.id));
    for (const target of targets) {
      if (existingIds.has(target.id)) continue;
      const entry = targetEntry(target);
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

// Bar color, by absolute latency bucket: green <200ms, yellow <1000ms, red
// beyond (extreme latency shares the fail tone), solid gray for
// unreachable rounds. Pending bars stay faint; head-of-queue pulses
// (suppressed once the user takes over manually).
const BAR_RED_MS = 1000;
const barClass = (test, idx) => {
  const entry = test.roundResults[idx];
  if (!entry) {
    if (!manualRun.value && idx === test.roundResults.length) return 'bg-muted-foreground/40 animate-pulse';
    return 'bg-muted-foreground/20';
  }
  if (entry.tone === 'fail') return 'bg-muted-foreground';
  if (entry.time < 200) return dotClass('ok-fast');
  if (entry.time < BAR_RED_MS) return dotClass('ok-slow');
  return dotClass('fail');
};

// Bar height, on the card's own dynamic range: the fastest round sits at
// the floor (kept hoverable), the slowest at 100%, the rest on a log curve
// between — rising latency compresses into ever-smaller height steps, and
// the top end is told apart by color instead. Failed and pending rounds
// have no latency and sit at the floor.
const BAR_FLOOR = 25;
const barStyle = (test, idx) => {
  const entry = test.roundResults[idx];
  if (!entry || !entry.time) return { height: `${BAR_FLOOR}%` };
  const times = test.roundResults.map((r) => r.time).filter((v) => v > 0);
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (max === min) return { height: '100%' };
  const p = Math.log(entry.time / min) / Math.log(max / min);
  return { height: `${Math.round(BAR_FLOOR + (100 - BAR_FLOOR) * p)}%` };
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
// Run generation: bumped per handelCheckStart cycle. Checks still in
// flight from a previous run must not write into the fresh grid; rounds
// overlapping within one run keep writing by design — slow sites' round
// results land after the next tick starts.
let runSeq = 0;

const checkConnectivityHandler = async (test, onTestComplete = () => { }, isManualRun) => {
  manualRun.value = isManualRun;
  const runId = runSeq;
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
    if (runId !== runSeq) {
      onTestComplete(true);
      return;
    }
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
    if (runId !== runSeq) {
      onTestComplete(false);
      return;
    }
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

// Pass generation counter: overlapping passes (a manual refresh over a
// still-running boot pass, or multi-round ticks outlasting their interval)
// share the per-target state, so only the newest pass may judge and report
// it — a superseded pass just resolves.
let passSeq = 0;

const checkAllConnectivity = (isAlertToShow, isRefresh, isManualRun) => {
  // Sticky false→true; interval ticks must not overwrite the bootstrap's `true`.
  if (isAlertToShow) alertToShow.value = true;
  const passId = ++passSeq;
  return new Promise((resolve) => {
    if (isRefresh) {
      connectivityTests.forEach((test) => {
        test.status = t('connectivity.StatusWait');
        test.statusCode = undefined;
        test.time = 0;
      });
      trackEvent('Section', 'RefreshClick', 'Connectivity');
    }

    // The pass judges only the targets it schedules here — cards added
    // mid-pass (self-tested by the watcher) belong to the next pass.
    const scheduledIds = new Set(connectivityTests.map((test) => test.id));
    const testPromises = [];

    connectivityTests.forEach((test, index) => {
      testPromises.push(new Promise((testResolve, testReject) => {
        setTimeout(() => {
          checkConnectivityHandler(test, (isSuccess) => {
            if (isSuccess) testResolve();
            else testReject();
          }, isManualRun);
        }, 50 * index);
      }));
    });

    Promise.allSettled(testPromises).then(() => {
      if (passId !== passSeq) {
        resolve();
        return;
      }
      // Verdict = scheduled targets still present at settle time: a card
      // removed mid-pass must not fail the survivors, a card added
      // mid-pass must not fail the pass it never ran in.
      // Multi mode overwrites this with finalizeMultiTestAlert before the toast fires.
      const finished = connectivityTests.filter(
        (test) => scheduledIds.has(test.id) && test.statusCode !== undefined,
      );
      const allOk = finished.every((test) => test.statusCode === CONNECTIVITY_STATUS.OK);
      updateConnectivityAlert(allOk ? 'success' : 'error');
      // Domain event: deliberately the whole grid, not just this pass —
      // the report is a latest-wins snapshot, and a mid-pass addition with
      // a real result is accurate information there.
      emitAppEvent('connectivity:finished', {
        targets: connectivityTests.map((test) => ({
          id: test.id,
          name: test.name,
          custom: test.id.startsWith('custom-'),
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

// ── Add/remove targets ─────────────────────────────────────────────────────
// The add/import dialog itself lives in ConnectivityAddDialog.vue; this
// component only owns the open flag and per-card removal.
const addDialogOpen = ref(false);

const removeTargetById = (id) => {
  const result = removeTarget(userPreferences.value.connectivityTargets || [], id);
  if (result.error) return;
  store.updatePreference('connectivityTargets', result.targets);
  trackEvent('Section', 'RemoveCustomTarget', 'Connectivity');
};

// Two-step removal: first click arms "X?" (self-reverting), second click
// deletes. The last remaining target skips the dance — the set must never
// go empty, so the click just explains itself via toast.
const confirmingRemoveId = ref(null);
let confirmResetTimer = null;
const handleRemoveClick = (id) => {
  clearTimeout(confirmResetTimer);
  if ((userPreferences.value.connectivityTargets || []).length <= 1) {
    confirmingRemoveId.value = null;
    store.setAlert(true, 'text-warning',
      t('connectivity.addCustom.LastTargetMessage'), t('connectivity.addCustom.LastTargetTitle'));
    return;
  }
  if (confirmingRemoveId.value === id) {
    confirmingRemoveId.value = null;
    removeTargetById(id);
    return;
  }
  confirmingRemoveId.value = id;
  confirmResetTimer = setTimeout(() => { confirmingRemoveId.value = null; }, 3000);
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
  runSeq += 1;
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

// Command owner: run the connectivity pass. `trigger` keeps handelCheckStart's
// toast / card-reset semantics; resolves with the next connectivity:finished
// snapshot (the first pass in multi-round mode).
useAppCommand('connectivity:run', ({ trigger = 'manual' } = {}) => {
  const finished = waitForAppEvent('connectivity:finished');
  handelCheckStart(trigger);
  return finished;
});

onMounted(() => {
  store.setMountingStatus('Connectivity', true);
});

// Stop the interval (and any pending confirm revert) on unmount.
onBeforeUnmount(() => {
  if (intervalId.value !== null) {
    clearInterval(intervalId.value);
    intervalId.value = null;
  }
  clearTimeout(confirmResetTimer);
});

// Either signal flipping fires sendAlert; the gates inside pick the winner.
watch(() => store.allHasLoaded, (v) => { if (v) sendAlert(); });
watch(allRoundsDone, (v) => { if (v) sendAlert(); });
</script>

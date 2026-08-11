<template>
    <!-- Nav entry: slow-orbit icon + green dot, no numbers exposed.
        Rendered only when VITE_PULSE_URL is configured. -->
    <JnTooltip v-if="pulseEnabled" :text="t('nav.pulse.tooltip')">
        <Button variant="ghost" size="icon" class="relative size-8 cursor-pointer" :aria-label="t('nav.pulse.title')"
            @click="openPulse">
            <Orbit class="size-4 animate-spin animation-duration-[8s]" />
            <span class="absolute right-1 top-1 size-1.5 rounded-full bg-success" aria-hidden="true"></span>
        </Button>
    </JnTooltip>

    <!-- Sheet: status composer → latest events → per-country share + mix. -->
    <Sheet :open="isOpen" @update:open="onOpenChange">
        <SheetContent side="right" :title="t('nav.pulse.title')"
            class="flex w-full max-w-full flex-col gap-0 p-0 md:w-125 md:max-w-125">
            <!-- Celebration overlay: one canvas above the whole Sheet, drawn
                by utils/pulse-celebration.js. Inert to input. -->
            <canvas ref="fxCanvas" class="pointer-events-none absolute inset-0 z-10 size-full"
                aria-hidden="true"></canvas>
            <header class="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
                <h2 class="m-0 flex items-center gap-2 text-base font-semibold">
                    <Orbit class="size-4 text-muted-foreground" />
                    {{ t('nav.pulse.title') }}
                    <span class="relative flex size-2">
                        <span
                            class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60"></span>
                        <span class="relative inline-flex size-2 rounded-full bg-success"></span>
                    </span>
                </h2>
                <SheetClose
                    class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
            </header>

            <div class="flex-1 overflow-y-auto px-4 py-3 pb-10">
                <!-- Composer: preset status ids only, never free text. -->
                <section>
                    <h3 class="mb-3 text-sm font-semibold">{{ t('nav.pulse.shareStatus') }}</h3>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="fest in activeFestivals" :key="fest.id" type="button"
                            :title="t('nav.pulse.limitedTitle')"
                            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-sm transition-colors"
                            :class="sentStatusId === fest.id
                                ? 'border-transparent bg-primary text-primary-foreground'
                                : 'border-primary/60 text-primary hover:bg-accent/50'"
                            @click="sendStatus(fest.id, $event)">
                            <span>{{ fest.emoji }}</span>
                            <span>{{ t('nav.pulse.statuses.' + fest.id) }}</span>
                        </button>
                        <button v-for="preset in PRESET_STATUSES" :key="preset.id" type="button"
                            class="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors"
                            :class="sentStatusId === preset.id
                                ? 'border-transparent bg-primary text-primary-foreground'
                                : 'hover:bg-accent/50'" @click="sendStatus(preset.id, $event)">
                            <span>{{ preset.emoji }}</span>
                            <span>{{ t('nav.pulse.statuses.' + preset.id) }}</span>
                        </button>
                    </div>
                    <p v-for="fest in activeFestivals" :key="'desc-' + fest.id"
                        class="m-0 my-1.5 text-xs text-muted-foreground flex items-center gap-1">
                        <ClockFading class="size-3" />{{ t('nav.pulse.limitedTitle') }} : {{ fest.emoji }} {{
                        t('nav.pulse.festivalDesc.' + fest.id) }}
                    </p>
                    <!-- Fixed-height hint slot (no layout shift). Auto-hide after 3 seconds. -->
                    <div class="mt-1 flex h-4 items-center text-xs" aria-live="polite">
                        <span v-if="hintKind" :key="hintStamp" class="pulse-hint-fade">
                            <span v-if="hintKind === 'sent'" class="inline-flex items-center gap-1 text-success">
                                <Check class="size-3.5" />
                                {{ t('nav.pulse.sent') }}
                            </span>
                            <span v-else-if="hintKind === 'already'" class="text-muted-foreground">
                                {{ t('nav.pulse.alreadySent') }}
                            </span>
                            <span v-else-if="hintKind === 'limited'" class="text-warning">
                                {{ t('nav.pulse.rateLimited') }}
                            </span>
                        </span>
                    </div>
                </section>

                <Separator class="my-2" />
                <!-- Latest events: IPs arrive pre-masked; status ids render in
                    the viewer's language. No local echo — the post-send
                    refetch shows the sender in the real feed. -->
                <section v-if="feedEntries.length > 0">
                    <h3 class="mb-3 text-sm font-semibold">{{ t('nav.pulse.latest') }}</h3>
                    <ul class="m-0 list-none space-y-3 p-0">
                        <li v-for="entry in feedEntries" :key="entry.ip + entry.status + entry.min"
                            class="flex items-start gap-2.5">
                            <Icon :icon="flagIcon(entry.code)" class="mt-0.5 size-5 shrink-0 rounded-full" />
                            <div class="min-w-0 flex-1">
                                <div class="flex items-baseline justify-between gap-2">
                                    <span class="truncate text-sm font-medium">
                                        {{ regionName(entry.code) }}
                                        <span class="ml-1 font-mono text-xs font-normal text-muted-foreground/70">{{
                                            entry.ip }}</span>
                                    </span>
                                    <span class="shrink-0 text-xs tabular-nums text-muted-foreground/70">{{
                                        relTime(entry.min) }}</span>
                                </div>
                                <div class="truncate text-sm text-muted-foreground">
                                    {{ statusById(entry.status).emoji }} {{ t('nav.pulse.statuses.' + entry.status) }}
                                    <ClockFading v-if="FESTIVAL_IDS.has(entry.status)"
                                        class="inline size-3 text-primary" />
                                </div>
                            </div>
                        </li>
                    </ul>
                </section>

                <!-- Global outage broadcast; renders its
                    own leading separator, collapses to nothing when empty. -->
                <PulseOutages />

                <Separator class="mt-7 mb-2" />
                <!-- Per-country share + status mix; quiet placeholder when
                    empty or the fetch failed. -->
                <section class="space-y-4">
                    <h3 class="mb-3 text-sm font-semibold">{{ t('nav.pulse.liveMap') }}</h3>

                    <div v-if="statsLoading && countries.length === 0" class="flex justify-center py-8">
                        <Spinner />
                    </div>

                    <p v-else-if="countries.length === 0" class="py-6 text-center text-sm text-muted-foreground">
                        {{ t('nav.pulse.quiet') }}
                    </p>

                    <template v-else>
                        <!-- Choropleth canvas. The wrapper's aspect ratio tracks
                            the equalEarth projection (~2.2:1) so the map fills
                            the full width with no letterboxing. -->
                        <div class="relative w-full aspect-[2.2/1] overflow-hidden rounded-lg border">
                            <canvas ref="mapCanvas"></canvas>
                        </div>

                        <ul class="m-0 list-none space-y-4 p-0">
                            <li v-for="entry in topCountries" :key="entry.code" class="flex items-start gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="mb-1 flex items-baseline justify-between gap-2">
                                        <span class="truncate text-sm flex items-center gap-1.5">
                                            <Icon :icon="flagIcon(entry.code)" class="size-4 shrink-0 rounded-full" />
                                            {{ regionName(entry.code) }}
                                        </span>
                                        <span class="text-xs tabular-nums text-muted-foreground">{{
                                            shareLabel(entry.share) }}</span>
                                    </div>
                                    <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div class="h-full rounded-full bg-primary"
                                            :style="{ width: barWidth(entry.share) }"></div>
                                    </div>
                                    <div v-if="entry.statuses.length > 0"
                                        class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span v-for="s in entry.statuses" :key="s.id"
                                            :title="t('nav.pulse.statuses.' + s.id)">
                                            {{ statusById(s.id).emoji }}
                                            <span class="tabular-nums">{{ s.pct }}%</span>
                                        </span>
                                    </div>
                                </div>
                            </li>
                            <li v-if="othersShare > 0" class="flex items-start gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="mb-1 flex items-baseline justify-between gap-2">
                                        <span class="truncate text-sm flex items-center gap-1.5">
                                            <Icon icon="circle-flags:earth" class="size-4 shrink-0 rounded-full" />
                                            {{ t('nav.pulse.others') }}
                                        </span>
                                        <span class="text-xs tabular-nums text-muted-foreground">{{
                                            shareLabel(othersShare) }}</span>
                                    </div>
                                    <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div class="h-full rounded-full bg-muted-foreground/40"
                                            :style="{ width: barWidth(othersShare) }"></div>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </template>
                </section>
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup>
// "Earth Online": anonymous, number-free view of where visitors come from and
// what they're expressing via preset statuses. Naming rule: "Earth Online" is
// the user-facing name only; everything technical (files, ids, locale keys,
// the backend service) uses the code name "pulse".
// POST <PULSE_URL>/status on pick; GET <PULSE_URL>/stats on open and after a
// send — uncached end to end. The visit beacon is app-level: App.vue via
// utils/pulse-beacon.js, not this widget.
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { PULSE_URL, isPulseEnabled as pulseEnabled } from '@/utils/pulse-beacon.js';
import { PRESET_STATUSES, FESTIVAL_STATUSES, festivalsActiveOn, localDateString } from '@/data/pulse-statuses.js';
import { playCelebration, resolveEffect } from '@/utils/pulse-celebration.js';
import { renderWorldMapChart } from '@/utils/world-map-chart.js';
import getCountryName from '@/data/country-name.js';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import { JnTooltip } from '@/components/ui/tooltip';
import PulseOutages from '@/components/widgets/PulseOutages.vue';
import { Icon } from '@iconify/vue';
import { Check, Orbit, ClockFading } from '@lucide/vue';

const { t, locale } = useI18n();
const store = useMainStore();


// Status vocabulary lives in data/pulse-statuses.js (shared with tests).
// KNOWN ids span BOTH lists with no window filtering — a festival status in
// the feed must keep rendering after its window closes; only the composer
// is window-gated.
const ALL_STATUSES = [...PRESET_STATUSES, ...FESTIVAL_STATUSES];
const KNOWN_STATUS_IDS = new Set(ALL_STATUSES.map((s) => s.id));
const FESTIVAL_IDS = new Set(FESTIVAL_STATUSES.map((s) => s.id));
const statusById = (id) => ALL_STATUSES.find((s) => s.id === id);

// Active festival windows, re-evaluated on every Sheet open (a session can
// straddle midnight).
const activeFestivals = ref([]);
const refreshFestivals = () => {
    activeFestivals.value = festivalsActiveOn(localDateString());
};

// Stats: fetched fresh on every open and after each send; previous data
// stays on screen while a refresh is in flight.
const stats = ref(null);
const statsLoading = ref(false);

const loadStats = async () => {
    if (statsLoading.value) return;
    statsLoading.value = true;
    try {
        const res = await fetchWithTimeout(`${PULSE_URL}/stats`);
        if (res.ok) stats.value = await res.json();
    } catch {
        /* keep whatever we had; empty state covers the rest */
    } finally {
        statsLoading.value = false;
    }
};

// Unknown status ids (a newer backend vocabulary) are dropped, not crashed on.
// The backend returns ALL countries (the map needs full coverage); the list
// shows the top N and aggregates the rest into "others" — display decisions
// live here, not in the contract.
const LIST_TOP = 20;
const countries = computed(() => (stats.value?.countries || []).map((entry) => ({
    ...entry,
    statuses: (entry.statuses || []).filter((s) => KNOWN_STATUS_IDS.has(s.id)),
})));
const topCountries = computed(() => countries.value.slice(0, LIST_TOP));
const othersShare = computed(() =>
    Math.round(countries.value.slice(LIST_TOP).reduce((sum, e) => sum + e.share, 0) * 10) / 10);
const feedEntries = computed(() =>
    (stats.value?.feed || []).filter((e) => KNOWN_STATUS_IDS.has(e.status)));

// Bars are scaled against the top share so the #1 country fills its track.
const barWidth = (share) => {
    const max = countries.value[0]?.share || 0;
    return max > 0 ? `${Math.min(100, (share / max) * 100)}%` : '0%';
};

// The backend sends shares at two decimals so tiny countries stay nonzero;
// below one display decimal they read as "<0.1%" — "few", never "zero".
const shareLabel = (share) => (share > 0 && share < 0.1 ? '<0.1%' : `${share.toFixed(1)}%`);

// Country names via the shared Intl helper (data/country-name.js).
// "T1" is the backend's pseudo-code for Tor exit traffic — no ISO name, no
// territory on the map. Any non-two-letter code (T1 included) falls back to
// the international flag (circle-flags:xx).
const isTor = (code) => code === 'T1';
const flagIcon = (code) =>
    `circle-flags:${/^[A-Za-z]{2}$/.test(code) ? code.toLowerCase() : 'xx'}`;
const regionName = (code) => {
    if (!code) return '';
    if (isTor(code)) return 'Tor';
    return getCountryName(code, locale.value) || code.toUpperCase();
};

// Relative times via Intl as well — no locale keys needed. Minutes within
// the first hour, hours beyond.
const relTime = (minutesAgo) => {
    try {
        const rtf = new Intl.RelativeTimeFormat(locale.value, { style: 'narrow' });
        return minutesAgo >= 60
            ? rtf.format(-Math.floor(minutesAgo / 60), 'hour')
            : rtf.format(-minutesAgo, 'minute');
    } catch {
        return `-${minutesAgo}m`;
    }
};

// Sending: 204 = the backend confirmed the write → refetch shows the
// sender; 429 = rate-limited → revert the highlight, no refresh. Hints are
// 3s one-shots; hintKind keeps the message mounted so fading is a pure
// opacity toggle (see template note).
const sentStatusId = ref(null);
const hintKind = ref(null); // 'sent' | 'already' | 'limited' — last shown message
const hintStamp = ref(0);   // re-keys the hint span so its animation replays
const showHint = (kind) => {
    hintKind.value = kind;
    hintStamp.value += 1;
};
// Celebration overlay (utils/pulse-celebration.js): one canvas over the
// Sheet, played optimistically on click — delight belongs to the tap, not
// the round-trip. A 429 stops it immediately (the send didn't count); a new
// click restarts it. The engine no-ops under prefers-reduced-motion.
const fxCanvas = ref(null);
let celebration = null;
const stopCelebration = () => {
    if (celebration) {
        celebration.stop();
        celebration = null;
    }
};
const playCelebrationFor = (id, evt) => {
    const canvas = fxCanvas.value;
    if (!canvas) return;
    stopCelebration();
    const { kind, emoji } = resolveEffect(statusById(id));
    const rect = canvas.getBoundingClientRect();
    const chip = evt?.currentTarget?.getBoundingClientRect?.();
    const origin = chip
        ? { x: chip.left + chip.width / 2 - rect.left, y: chip.top + chip.height / 2 - rect.top }
        : { x: rect.width / 2, y: rect.height / 3 };
    celebration = playCelebration({ canvas, kind, emoji, origin });
};

// Local send gate mirroring the backend's per-IP rate limit, in-memory
// only (no storage by design — a refresh resets it and the backend 429
// stays as the second line of defense). Two branches before any network:
// re-clicking the already-sent status is a free replay — animation +
// "already sent" hint, spam-friendly by design; switching statuses inside
// the cooldown window gets the rateLimited hint, no animation.
const SEND_COOLDOWN_MS = 2 * 60 * 1000;
let lastSentAt = 0;
let lastSentId = null;

const sendStatus = async (id, evt) => {
    if (lastSentId === id) {
        playCelebrationFor(id, evt);
        showHint('already');
        return;
    }
    if (lastSentAt && Date.now() - lastSentAt < SEND_COOLDOWN_MS) {
        showHint('limited');
        return;
    }
    playCelebrationFor(id, evt);
    const prev = sentStatusId.value;
    sentStatusId.value = id;
    trackEvent('Nav', 'PulseStatus', id);
    try {
        const res = await fetchWithTimeout(`${PULSE_URL}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: id }),
        });
        if (res.status === 429) {
            stopCelebration(); // the send didn't count — cut the party short
            sentStatusId.value = prev;
            showHint('limited');
        } else if (res.ok) {
            lastSentAt = Date.now();
            lastSentId = id;
            showHint('sent');
            emitAppEvent('pulse:status-sent', { status: id });
            loadStats();
        }
    } catch {
        /* network error — keep the optimistic highlight, no refresh */
    }
};

// World map via the shared choropleth util (utils/world-map-chart.js) —
// heat ramp (warm orange → deep red), fitting the "heatmap" framing; T1 has
// no territory to shade.
const mapCanvas = ref(null);
let mapChart = null;

const renderMap = async () => {
    mapChart = await renderWorldMapChart({
        canvas: mapCanvas.value,
        chart: mapChart,
        values: Object.fromEntries(countries.value
            .filter((entry) => !isTor(entry.code))
            .map((entry) => [entry.code.toUpperCase(), entry.share])),
        lang: locale.value,
        colorFrom: '#6597F3',
        colorTo: '#1449AB',
        formatValue: (value) => (value === undefined
            ? ` ${t('nav.pulse.noVisitors')}`
            : ` ${t('nav.pulse.share')}: ${shareLabel(value)}`),
    });
};

// Sheet visibility rides the store's exclusive sheet slot, like navMenu /
// preferences, so only one side panel is ever open.
const isOpen = computed(() => store.openSheet === 'pulse');
const onOpenChange = (val) => store.setOpenSheet(val ? 'pulse' : null);
const openPulse = () => {
    store.toggleSheet('pulse');
    trackEvent('Nav', 'NavClick', 'Pulse');
};
watch(isOpen, (open) => {
    if (open) {
        refreshFestivals();
        loadStats();
    } else {
        stopCelebration(); // don't let a rAF loop outlive the unmounted canvas
    }
});

// Map draw trigger — declared after isOpen (watch sources are read at setup;
// referencing a later const would hit its temporal dead zone). Closing the
// Sheet unmounts the canvas, so the chart is destroyed with it.
watch([isOpen, countries], async () => {
    if (!isOpen.value) {
        if (mapChart) {
            mapChart.destroy();
            mapChart = null;
        }
        return;
    }
    if (countries.value.length === 0) return;
    await nextTick(); // let the v-else branch render the map container first
    renderMap();
});
</script>

<style scoped>
/* Hint auto-hide: visible for 3s, then gone — no fade. */
@keyframes pulse-hint-fade {
    from {
        opacity: 1;
    }

    to {
        opacity: 0;
    }
}

.pulse-hint-fade {
    animation: pulse-hint-fade 3s step-end forwards;
}
</style>

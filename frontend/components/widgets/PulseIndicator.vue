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
            class="flex w-full max-w-full flex-col gap-0 p-0 md:w-105 md:max-w-105">
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

            <div class="flex-1 overflow-y-auto px-4 py-5 pb-10">
                <!-- Composer: preset status ids only, never free text. -->
                <section>
                    <h3 class="mb-2 text-sm font-semibold">{{ t('nav.pulse.shareStatus') }}</h3>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="preset in PRESET_STATUSES" :key="preset.id" type="button"
                            class="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors"
                            :class="sentStatusId === preset.id
                                ? 'border-transparent bg-primary text-primary-foreground'
                                : 'hover:bg-accent/50'" @click="sendStatus(preset.id)">
                            <span>{{ preset.emoji }}</span>
                            <span>{{ t('nav.pulse.statuses.' + preset.id) }}</span>
                        </button>
                    </div>
                    <!-- Fixed-height hint slot (no layout shift). The span stays
                        mounted and only fades — mobile WebKit can drop the
                        transitionend a removal would depend on. -->
                    <div class="mt-2 flex h-4 items-center text-xs" aria-live="polite">
                        <span class="transition-opacity duration-300"
                            :class="hintVisible ? 'opacity-100' : 'opacity-0'">
                            <span v-if="hintKind === 'sent'" class="inline-flex items-center gap-1 text-success">
                                <Check class="size-3.5" />
                                {{ t('nav.pulse.sent') }}
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
                    <h3 class="mb-2.5 text-sm font-semibold">{{ t('nav.pulse.latest') }}</h3>
                    <ul class="m-0 list-none space-y-3 p-0">
                        <li v-for="entry in feedEntries" :key="entry.ip + entry.status + entry.min"
                            class="flex items-start gap-2.5">
                            <Icon :icon="'circle-flags:' + entry.code.toLowerCase()"
                                class="mt-0.5 size-5 shrink-0 rounded-full" />
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
                                </div>
                            </div>
                        </li>
                    </ul>
                </section>

                <Separator class="mt-5 mb-2" />
                <!-- Per-country share + status mix; quiet placeholder when
                    empty or the fetch failed. -->
                <section class="space-y-4">
                    <h3 class="mb-2.5 text-sm font-semibold">{{ t('nav.pulse.worldSaying') }}</h3>

                    <div v-if="statsLoading && countries.length === 0" class="flex justify-center py-8">
                        <Spinner />
                    </div>

                    <p v-else-if="countries.length === 0" class="py-6 text-center text-sm text-muted-foreground">
                        {{ t('nav.pulse.quiet') }}
                    </p>

                    <template v-else>
                        <!-- svgmap container; id must match MAP_ELEMENT_ID. -->
                        <div id="pulseSvgMap" class="overflow-hidden rounded-lg border"></div>

                        <ul class="m-0 list-none space-y-4 p-0">
                            <li v-for="entry in countries" :key="entry.code" class="flex items-start gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="mb-1 flex items-baseline justify-between gap-2">
                                        <span class="truncate text-sm flex items-center gap-1.5">
                                            <Icon :icon="'circle-flags:' + entry.code.toLowerCase()"
                                                class="size-4 shrink-0 rounded-full" />
                                            {{ regionName(entry.code) }}
                                        </span>
                                        <span class="text-xs tabular-nums text-muted-foreground">{{
                                            entry.share.toFixed(1) }}%</span>
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
                                <Globe class="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                                <div class="min-w-0 flex-1">
                                    <div class="mb-1 flex items-baseline justify-between gap-2">
                                        <span class="truncate text-sm">{{ t('nav.pulse.others') }}</span>
                                        <span class="text-xs tabular-nums text-muted-foreground">{{
                                            othersShare.toFixed(1) }}%</span>
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
// uses the code name "pulse".
// POST <PULSE_URL>/status on pick; GET <PULSE_URL>/stats on open and after a
// send — uncached end to end. The visit beacon is app-level: App.vue via
// utils/pulse-beacon.js, not this widget.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { PULSE_URL, isPulseEnabled as pulseEnabled } from '@/utils/pulse-beacon.js';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import { JnTooltip } from '@/components/ui/tooltip';
import { Icon } from '@iconify/vue';
import { Check, Globe, Orbit } from '@lucide/vue';

const { t, locale } = useI18n();
const store = useMainStore();


// Fixed ids + emoji; text lives in the locale packs. Must stay in sync with
// the Worker's STATUS_IDS. Emoji must carry meaning alone (country rows show
// them bare). Ordered network → mood → greeting.
const PRESET_STATUSES = [
    { id: 'fast', emoji: '🚀' },
    { id: 'ok', emoji: '✅' },
    { id: 'slow', emoji: '🐢' },
    { id: 'flaky', emoji: '🔌' },
    { id: 'blocked', emoji: '🚧' },
    { id: 'lag', emoji: '🎮' },
    { id: 'newip', emoji: '🔄' },
    { id: 'vpn', emoji: '🛡️' },
    { id: 'good', emoji: '😎' },
    { id: 'bad', emoji: '😮‍💨' },
    { id: 'night', emoji: '🌙' },
    { id: 'passing', emoji: '👋' },
];
const KNOWN_STATUS_IDS = new Set(PRESET_STATUSES.map((s) => s.id));
const statusById = (id) => PRESET_STATUSES.find((s) => s.id === id);

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

// Unknown status ids (newer Worker vocabulary) are dropped, not crashed on.
const countries = computed(() => (stats.value?.countries || []).map((entry) => ({
    ...entry,
    statuses: (entry.statuses || []).filter((s) => KNOWN_STATUS_IDS.has(s.id)),
})));
const othersShare = computed(() => stats.value?.othersShare || 0);
const feedEntries = computed(() =>
    (stats.value?.feed || []).filter((e) => KNOWN_STATUS_IDS.has(e.status)));

// Bars are scaled against the top share so the #1 country fills its track.
const barWidth = (share) => {
    const max = countries.value[0]?.share || 0;
    return max > 0 ? `${Math.min(100, (share / max) * 100)}%` : '0%';
};

// Country names always via Intl.DisplayNames, per project convention.
const regionName = (code) => {
    try {
        return new Intl.DisplayNames([locale.value], { type: 'region' }).of(code.toUpperCase());
    } catch {
        return code.toUpperCase();
    }
};

// Relative times via Intl as well — no locale keys needed.
const relTime = (minutesAgo) => {
    try {
        return new Intl.RelativeTimeFormat(locale.value, { style: 'narrow' })
            .format(-minutesAgo, 'minute');
    } catch {
        return `-${minutesAgo}m`;
    }
};

// Sending: 204 = durably written (Worker awaits the DO) → refetch shows the
// sender; 429 = rate-limited → revert the highlight, no refresh. Hints are
// 3s one-shots; hintKind keeps the message mounted so fading is a pure
// opacity toggle (see template note).
const sentStatusId = ref(null);
const hintKind = ref(null); // 'sent' | 'limited' — last shown message
const hintVisible = ref(false);
let hintTimer = null;
const showHint = (kind) => {
    hintKind.value = kind;
    hintVisible.value = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hintVisible.value = false; }, 3000);
};
const sendStatus = async (id) => {
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
            sentStatusId.value = prev;
            showHint('limited');
        } else if (res.ok) {
            showHint('sent');
            loadStats();
        }
    } catch {
        /* network error — keep the optimistic highlight, no refresh */
    }
};
onBeforeUnmount(() => clearTimeout(hintTimer));

// World map (svgmap), shaded by share; the token discards a stale async
// draw superseded by newer data.
const MAP_ELEMENT_ID = 'pulseSvgMap';
let mapDrawToken = 0;
const drawMap = async () => {
    const token = ++mapDrawToken;
    const [svgMapModule] = await Promise.all([import('svgmap'), import('svgmap/style.min')]);
    const el = document.getElementById(MAP_ELEMENT_ID);
    if (token !== mapDrawToken || !el) return;
    el.innerHTML = '';
    const values = {};
    for (const entry of countries.value) {
        values[entry.code.toUpperCase()] = { share: entry.share };
    }
    new svgMapModule.default({
        targetElementID: MAP_ELEMENT_ID,
        data: {
            data: { share: { name: t('nav.pulse.share'), format: '{0}%' } },
            applyData: 'share',
            values,
        },
        colorMax: '#083923',
        colorMin: '#22CB80',
        minZoom: 1,
        maxZoom: 1,
        initialZoom: 1,
        mouseWheelZoomEnabled: false,
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
    if (open) loadStats();
});

// Map draw trigger — declared after isOpen (watch sources are read at setup;
// referencing a later const would hit its temporal dead zone).
watch([isOpen, countries], async () => {
    if (!isOpen.value || countries.value.length === 0) return;
    await nextTick(); // let the v-else branch render the map container first
    drawMap();
});
</script>

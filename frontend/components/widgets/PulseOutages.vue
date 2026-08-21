<template>
    <!-- Global internet outage broadcast via /api/outages,
        rendered between the Pulse latest-events feed and the live map. 
        A successful fetch with zero events shows the quiet line ("no news is good news"); 
        a FAILED fetch hides the section entirely. -->
    <template v-if="loaded || loading">
        <Separator class="mt-7 mb-2" />
        <section>
            <h3 class="mb-3 text-sm font-semibold">
                {{ t('nav.pulse.outages.title') }}
            </h3>

            <!-- Placeholder rows mirror a bulletin: kind badge + state, subject,
                description. A failed fetch drops the whole section, so this can
                end in a collapse rather than in content. -->
            <ul v-if="loading" class="m-0 list-none divide-y rounded-lg border bg-card p-0">
                <li v-for="i in PLACEHOLDER_ROWS" :key="i" class="space-y-2 px-3 py-2.5">
                    <div class="flex items-center justify-between gap-2">
                        <div class="h-4 w-28 animate-pulse rounded bg-muted"></div>
                        <div class="h-3.5 w-16 shrink-0 animate-pulse rounded bg-muted"></div>
                    </div>
                    <div class="h-4 w-40 animate-pulse rounded bg-muted"></div>
                    <div class="h-3 w-full animate-pulse rounded bg-muted"></div>
                </li>
            </ul>

            <p v-else-if="events.length === 0" class="py-4 text-center text-sm text-muted-foreground">
                {{ t('nav.pulse.outages.quiet') }}
            </p>

            <ul v-else class="m-0 list-none divide-y rounded-lg border bg-card p-0">
                <li v-for="event in visibleEvents" :key="event.id" class="px-3 py-2.5">
                    <div class="flex items-center justify-between gap-2">
                        <Badge variant="outline" class="px-1.5 py-0 text-[11px] font-semibold uppercase tracking-wide"
                            :class="event.kind === 'outage'
                                ? 'border-destructive/60 text-destructive'
                                : 'border-primary/60 text-primary'">
                            {{ t('nav.pulse.outages.' + (event.kind === 'outage' ? 'outage' : 'anomaly')) }}
                        </Badge>
                        <span v-if="!event.endDate"
                            class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
                            <span class="relative flex size-1.5">
                                <span
                                    class="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60"></span>
                                <span class="relative inline-flex size-1.5 rounded-full bg-warning"></span>
                            </span>
                            {{ t('nav.pulse.outages.ongoing') }}
                        </span>
                        <span v-else class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                            <CircleCheck class="size-3.5" />
                            {{ t('nav.pulse.outages.ended') }}
                        </span>
                    </div>
                    <!-- Subject: who is affected. -->
                    <div class="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
                        <Icon v-if="event.locations.length > 0" :icon="flagIcon(event.locations[0])"
                            class="size-4 shrink-0 rounded-full" />
                        <Network v-else-if="event.asns.length > 0"
                            class="size-4 shrink-0 text-muted-foreground" />
                        <Icon v-else icon="circle-flags:earth" class="size-4 shrink-0 rounded-full" />
                        <span class="truncate">{{ subjectName(event) }}</span>
                    </div>
                    <!-- Radar's editorial context, original (English) text. -->
                    <p v-if="event.description"
                        class="m-0 mt-1 wrap-break-word text-xs leading-relaxed text-muted-foreground">
                        {{ event.description }}
                    </p>
                    <!-- Cause / scope; hidden when the event carries neither. -->
                    <div v-if="metaLine(event)" class="mt-1 text-xs text-muted-foreground">
                        {{ metaLine(event) }}
                    </div>
                    <!-- Closing line: everything time-related, same slot for
                        both kinds — start age, plus duration once ended. -->
                    <div class="mt-0.5 text-xs tabular-nums text-muted-foreground/70">
                        {{ timeLine(event) }}
                    </div>
                </li>
            </ul>
            <!-- Burst escape hatch: the collapsed view holds LIST_TOP entries
                (ongoing events always included); one click reveals the full
                backend feed (capped at 30 upstream). -->
            <Button v-if="!expanded && events.length > visibleEvents.length" variant="ghost" size="sm"
                class="mt-1 w-full cursor-pointer text-xs text-muted-foreground" @click="expanded = true">
                {{ t('nav.pulse.outages.loadMore') }}
            </Button>
        </section>
    </template>
</template>

<script>
// Module-level cache shared across mounts: the Sheet unmounts its content on
// close, so a plain onMounted fetch would refire on every open. The edge
// cache makes that cheap, but skipping the refetch entirely is nicer.
// `loaded` records that some fetch succeeded — an empty-but-loaded feed shows
// the quiet line, while a never-loaded one keeps the section hidden.
const cachedEvents = { value: [], at: 0, loaded: false };
</script>

<script setup>
// Outage broadcast section for the Pulse Sheet. Data comes from our backend
// (/api/outages, edge-cached 1h), which merges Cloudflare Radar's verified
// outages and traffic anomalies. Cause/level vocabularies are translated for
// the values Radar is known to emit; anything new falls back to a Title Case
// rendering of the raw token (the fields carry no enum contract upstream).
// Radar's free-text description stays in its original English by design.
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import getCountryName from '@/data/country-name.js';
import { relativeTimeSince, formatDuration } from '@/utils/time-utils.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Icon } from '@iconify/vue';
import { CircleCheck, Network, RadioTower } from '@lucide/vue';

const { t, locale } = useI18n();

// Radar cause/level values with a translation; see locales `nav.pulse.outages`.
const KNOWN_CAUSES = new Set([
    'GOVERNMENT_DIRECTED', 'POWER_OUTAGE', 'CABLE_CUT', 'TECHNICAL_PROBLEM',
    'MECHANICAL', 'UNKNOWN', 'WEATHER', 'FIRE', 'CYBERATTACK', 'NATURAL_DISASTER',
    'MAINTENANCE', 'MILITARY_ACTION',
]);
const KNOWN_LEVELS = new Set(['NATIONWIDE', 'REGIONAL', 'NETWORK']);

const LIST_TOP = 8;
const CACHE_TTL_MS = 10 * 60 * 1000;
const PLACEHOLDER_ROWS = 3;

const events = ref(cachedEvents.value);
const loaded = ref(cachedEvents.loaded);
const expanded = ref(false);
// Only the very first fetch of the session shows placeholders; a warm module
// cache renders the real feed on the first frame.
const loading = ref(!cachedEvents.loaded);

// The backend delivers the display order: ongoing events first, ended ones
// after, newest-first inside each group. The collapsed view is therefore a
// plain prefix slice — widened past LIST_TOP only when the ongoing block
// alone exceeds it (every ongoing event is guaranteed a slot; a multi-day
// nationwide outage must not be pushed out by a burst of newer anomalies).
// "Load more" reveals the whole feed.
const visibleEvents = computed(() => {
    if (expanded.value) return events.value;
    const ongoingCount = events.value.filter((e) => !e.endDate).length;
    return events.value.slice(0, Math.max(LIST_TOP, ongoingCount));
});

const loadEvents = async () => {
    if (cachedEvents.loaded && Date.now() - cachedEvents.at < CACHE_TTL_MS) {
        events.value = cachedEvents.value;
        loaded.value = true;
        return;
    }
    try {
        const res = await fetchWithTimeout('/api/outages', { timeoutMs: 10000 });
        if (!res.ok) return;
        const data = await res.json();
        cachedEvents.value = Array.isArray(data.events) ? data.events : [];
        cachedEvents.at = Date.now();
        cachedEvents.loaded = true;
        events.value = cachedEvents.value;
        loaded.value = true;
    } catch {
        /* silent — the section simply doesn't render */
    } finally {
        loading.value = false;
    }
};

onMounted(loadEvents);

// SNAKE_CASE token → Title Case phrase ("GOVERNMENT_DIRECTED" →
// "Government Directed") — the open-vocabulary fallback for values that
// don't have a translation yet.
const titleCase = (token) => (token || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const causeLabel = (cause) =>
    (KNOWN_CAUSES.has(cause) ? t(`nav.pulse.outages.cause.${cause}`) : titleCase(cause));
const levelLabel = (level) =>
    (KNOWN_LEVELS.has(level) ? t(`nav.pulse.outages.level.${level}`) : titleCase(level));

const flagIcon = (code) =>
    `circle-flags:${/^[A-Za-z]{2}$/.test(code) ? code.toLowerCase() : 'xx'}`;

// Subject line: localized country names first, ASN entities second
// ("AS136442: OCEANWAVE-AS-AP"), and the scope text as a last resort (Radar
// occasionally files an event with no locations or ASNs at all — e.g.
// regional earthquake annotations; those still carry their story in the
// description paragraph).
const subjectName = (event) => {
    if (event.locations.length > 0) {
        return event.locations
            .map((code) => getCountryName(code, locale.value) || code.toUpperCase())
            .join(', ');
    }
    if (event.asns.length > 0) {
        return event.asns
            .map((a) => (a.name ? `AS${a.asn}: ${a.name}` : `AS${a.asn}`))
            .join(', ');
    }
    return event.scope || '—';
};

// "Power Outage · Nationwide" — the what; times live in timeLine below.
const metaLine = (event) => [
    event.cause ? causeLabel(event.cause) : null,
    event.level ? levelLabel(event.level) : null,
].filter(Boolean).join(' · ');

// "Started 3 hr. ago · Lasted 5h" — every time-related fact in one closing
// line; both halves come from the shared utils/time-utils.js helpers.
const timeLine = (event) => {
    const duration = event.endDate
        ? formatDuration(Date.parse(event.endDate) - Date.parse(event.startDate), locale.value)
        : '';
    return [
        t('nav.pulse.outages.started', { time: relativeTimeSince(event.startDate, locale.value) }),
        duration ? t('nav.pulse.outages.lasted', { duration }) : null,
    ].filter(Boolean).join(' · ');
};
</script>

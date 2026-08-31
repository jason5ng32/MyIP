<template>
  <!-- Country online-activity panel: weekday × hour heatmap of Cloudflare
       Radar HTTP traffic, hours in the IP's timezone. Bare content — the
       CountryTraffic dialog shell and QueryIP's inline expansion both host it. -->
  <p class="text-sm text-muted-foreground">{{ t('ipInfos.countryTraffic.subtitle') }}</p>

  <div v-if="trafficState === 'error'" class="text-sm text-destructive mt-3">
    {{ t('ipInfos.countryTraffic.error') }}
  </div>
  <div v-else-if="trafficState === 'loading'"
    class="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
    <Spinner class="size-4" />{{ t('ipInfos.countryTraffic.loading') }}
  </div>
  <div v-else class="space-y-0.5 mt-3">
    <!-- Scope switch: on = likely-human only (default), off = all traffic.
         The fixed label names the switch, not the current state. -->
    <div class="flex items-center justify-end gap-2 mb-4">
      <label :for="switchId" class="text-sm text-muted-foreground cursor-pointer select-none">
        {{ t('ipInfos.countryTraffic.human') }}
      </label>
      <Switch :id="switchId" :model-value="scope === 'human'"
        @update:model-value="(v) => scope = v ? 'human' : 'all'" />
    </div>
    <div v-for="(row, d) in trafficGrid" :key="d" class="flex items-center gap-1.5">
      <span class="w-6 shrink-0 text-xs text-muted-foreground text-right">{{ weekdayNames[d]
        }}</span>
      <div class="flex-1 grid gap-px md:gap-1" style="grid-template-columns: repeat(24, minmax(0, 1fr))">
        <div v-for="(v, h) in row" :key="h" class="aspect-square rounded-xs"
          :style="{ backgroundColor: heatColor(v) }" :title="`${weekdayNames[d]} ${String(h).padStart(2, '0')}:00`">
        </div>
      </div>
    </div>
    <!-- Hour ticks every 6 columns; labels overflow their tiny column on purpose -->
    <div class="flex items-center gap-1.5">
      <span class="w-8 shrink-0"></span>
      <div class="flex-1 grid gap-px md:gap-0.5" style="grid-template-columns: repeat(24, minmax(0, 1fr))">
        <span v-for="h in 24" :key="h" class="text-[10px] text-muted-foreground whitespace-nowrap overflow-visible">
          {{ (h - 1) % 6 === 0 ? String(h - 1).padStart(2, '0') : '' }}
        </span>
      </div>
    </div>

    <!-- Same type size/tone as the grid's weekday labels -->
    <span class="text-xs text-muted-foreground flex justify-end mt-2">UTC{{ heatmapUtcOffset }}</span>
  </div>
</template>

<script setup>
// Fetches /api/cfradar?view=country-traffic per (country, scope) and renders the 7×24
// heatmap. Mounts only while visible, so fetching starts on mount; repeat
// visits ride the browser's HTTP cache (long public max-age).
import { computed, reactive, ref, watch, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { getWeekdayNames, getZoneUtcOffsetMinutes, formatUtcOffset } from '@/utils/time-utils.js';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';

const { t, locale } = useI18n();

const props = defineProps({
  // Alpha-2 code of the IP's country.
  countryCode: { type: String, default: '' },
  // IANA zone of the IP — pins the heatmap's hour axis to local time there.
  timezone: { type: String, default: '' },
  isDarkMode: { type: Boolean, required: true },
});

// Multiple panels can be mounted at once (IPCard dialog + QueryIP inline).
const switchId = useId();

// 'human' (default view) | 'all' — 'human' maps to the backend's ?human=1.
const scope = ref('human');

// Keyed `${CC}:${scope}`: undefined = not fetched, 'loading', 'error',
// null = no usable series, or the 7×24 matrix.
const trafficCache = reactive({});

const cacheKey = computed(() => `${props.countryCode.toUpperCase()}:${scope.value}`);

const fetchTraffic = async (key, countryCode, humanOnly) => {
  trafficCache[key] = 'loading';
  try {
    const response = await fetchWithTimeout(
      `/api/cfradar?view=country-traffic&country=${countryCode}${humanOnly ? '&human=1' : ''}`,
      { timeoutMs: 15000 } // the Radar timeseries is slow on cold edge caches
    );
    if (!response.ok) {
      trafficCache[key] = 'error';
      return;
    }
    const data = await response.json();
    trafficCache[key] = data.trafficMatrix ?? null;
  } catch {
    trafficCache[key] = 'error';
  }
};

// Fetch the visible key when missing, then prefetch the other scope in the
// background so flipping the switch is instant.
watch(cacheKey, async (key) => {
  if (!props.countryCode) return;
  const [cc, keyScope] = key.split(':');
  if (trafficCache[key] === undefined) {
    await fetchTraffic(key, cc, keyScope === 'human');
  }
  const otherScope = keyScope === 'human' ? 'all' : 'human';
  const otherKey = `${cc}:${otherScope}`;
  if (trafficCache[otherKey] === undefined) {
    fetchTraffic(otherKey, cc, otherScope === 'human');
  }
}, { immediate: true });

const weekdayNames = computed(() => getWeekdayNames(locale.value));

// Hour axis pinned to the IP's timezone (viewer's clock when geo carried no
// zone), so the country's evening peak reads as evening for every viewer.
const heatmapOffsetMinutes = computed(() =>
  getZoneUtcOffsetMinutes(props.timezone) ?? -new Date().getTimezoneOffset());
const heatmapUtcOffset = computed(() => formatUtcOffset(heatmapOffsetMinutes.value));

// Rotate the UTC matrix to that wall clock (sub-hour offsets round to whole
// hours) and stretch [min, max] to [0, 1] — Radar normalizes against the
// window max, so a flat curve would otherwise render uniformly dark.
const trafficGrid = computed(() => {
  const matrix = trafficCache[cacheKey.value];
  if (!Array.isArray(matrix) || matrix.length !== 7) return null;
  const flat = matrix.flat();
  const min = Math.min(...flat);
  const span = Math.max(...flat) - min || 1;
  const offsetHours = Math.round(heatmapOffsetMinutes.value / 60);
  return matrix.map((_, d) => Array.from({ length: 24 }, (_, h) => {
    const utcTotal = h - offsetHours;
    const utcHour = ((utcTotal % 24) + 24) % 24;
    const utcDay = (((d + Math.floor(utcTotal / 24)) % 7) + 7) % 7;
    return ((matrix[utcDay]?.[utcHour] ?? min) - min) / span;
  }));
});

// Country-level series are practically never missing, so a null answer just
// shares the error line rather than earning a dedicated empty state.
const trafficState = computed(() => {
  const entry = trafficCache[cacheKey.value];
  if (entry === undefined || entry === 'loading') return 'loading';
  if (entry === 'error' || entry === null) return 'error';
  return trafficGrid.value ? 'ready' : 'error';
});

// Per-theme oklch ramp on the success hue — a single-token color-mix can't
// span enough lightness for the quiet-vs-peak read this chart exists for.
const heatColor = (v) => (props.isDarkMode
  ? `oklch(${(0.25 + 0.5 * v).toFixed(3)} ${(0.03 + 0.15 * v).toFixed(3)} 152)`
  : `oklch(${(0.96 - 0.53 * v).toFixed(3)} ${(0.03 + 0.12 * v).toFixed(3)} 152)`);
</script>

<template>
  <!-- Country online-activity dialog: weekday × hour heatmap of Cloudflare
       Radar HTTP traffic for the IP's country, hours in the IP's timezone. -->
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent :title="countryName" class="max-w-2xl">
      <DialogHeader>
        <template #title>
          <span class="flex items-center gap-2 min-w-0">
            <Icon v-if="countryCode" :icon="'circle-flags:' + countryCode.toLowerCase()" class="size-4 shrink-0" />
            <span class="truncate">{{ countryName }}</span>
          </span>
        </template>
      </DialogHeader>

      <p class="text-sm text-muted-foreground -mt-1">{{ t('ipInfos.countryTraffic.subtitle') }}</p>

      <div v-if="trafficState === 'error'" class="text-sm text-destructive">
        {{ t('ipInfos.countryTraffic.error') }}
      </div>
      <div v-else-if="trafficState === 'loading'"
        class="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
        <Spinner class="size-4" />{{ t('ipInfos.countryTraffic.loading') }}
      </div>
      <div v-else class="space-y-0.5">
        <!-- Scope switch: on = likely-human only (default), off = all traffic.
             The fixed label names the switch, not the current state. -->
        <div class="flex items-center justify-end gap-2 mb-4">
          <label for="country-traffic-scope" class="text-sm text-muted-foreground cursor-pointer select-none">
            {{ t('ipInfos.countryTraffic.human') }}
          </label>
          <Switch id="country-traffic-scope" :model-value="scope === 'human'"
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
    </DialogContent>
  </Dialog>
</template>

<script setup>
// Fetches /api/cfradar-traffic per (country, scope) into a per-dialog cache
// and renders the 7×24 heatmap.
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { getWeekdayNames, getZoneUtcOffsetMinutes, formatUtcOffset } from '@/utils/time-utils.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@iconify/vue';

const { t, locale } = useI18n();

const props = defineProps({
  open: { type: Boolean, required: true },
  // Alpha-2 code of the IP's country; drives both the query and the flag.
  countryCode: { type: String, default: '' },
  countryName: { type: String, default: '' },
  // IANA zone of the IP — pins the heatmap's hour axis to local time there.
  timezone: { type: String, default: '' },
  isDarkMode: { type: Boolean, required: true },
});

const emit = defineEmits(['update:open']);

// 'human' (default view) | 'all' — 'human' maps to the backend's ?human=1.
const scope = ref('human');

// Keyed `${CC}:${scope}`: undefined = not fetched, 'loading', 'error'
// (retried on the next look), null = no usable series, or the 7×24 matrix.
// Cross-card reuse rides the browser's HTTP cache (long public max-age).
const trafficCache = reactive({});

const cacheKey = computed(() => `${props.countryCode.toUpperCase()}:${scope.value}`);

const fetchTraffic = async (key, countryCode, humanOnly) => {
  trafficCache[key] = 'loading';
  try {
    const response = await fetchWithTimeout(
      `/api/cfradar-traffic?country=${countryCode}${humanOnly ? '&human=1' : ''}`,
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
watch([() => props.open, cacheKey], async ([open, key]) => {
  if (!open || !props.countryCode) return;
  const [cc, keyScope] = key.split(':');
  const entry = trafficCache[key];
  if (entry === undefined || entry === 'error') {
    await fetchTraffic(key, cc, keyScope === 'human');
  }
  const otherScope = keyScope === 'human' ? 'all' : 'human';
  const otherKey = `${cc}:${otherScope}`;
  if (props.open && trafficCache[otherKey] === undefined) {
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

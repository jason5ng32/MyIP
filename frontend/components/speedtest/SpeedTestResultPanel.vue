<!-- Post-run SpeedTest diagnostics: 2x2 scenario gauges on the left, load & run details on the right,
     and the latency/route follow-up hint below. Sits directly inside the SpeedTest card without a
     nested frame so all sections read as one unified test result. -->
<template>
  <div class="border-t border-border/70 pt-4">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-y-4 lg:gap-x-6">
      <!-- Left: 2x2 Scenario Performance Gauges -->
      <div class="lg:col-span-7">
        <p class="m-0 mb-3 text-xs font-medium text-muted-foreground">
          {{ t('speedtest.scenarioTitle') }}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
          <div v-for="item in scenarioItems" :key="item.key" class="min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="inline-flex items-center gap-2 min-w-0">
                <component :is="item.icon" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span class="text-sm text-foreground truncate">{{ item.label }}</span>
              </span>
              <span class="text-xs font-medium shrink-0" :class="textClass(qualityTone(item.quality))">
                {{ item.quality !== '-' ? t('speedtest.quality.' + item.quality) : '—' }}
              </span>
            </div>
            <div class="grid grid-cols-5 gap-1 h-1.5" aria-hidden="true">
              <span v-for="seg in 5" :key="seg" class="rounded-full transition-colors"
                :class="seg <= qualityLevel(item.quality) ? dotClass(qualityTone(item.quality)) : 'bg-muted'"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Load & Run Details (dl key-value list) -->
      <div class="lg:col-span-5 border-t border-border/70 pt-3.5 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6">
        <p class="m-0 mb-2.5 text-xs font-medium text-muted-foreground">
          {{ t('speedtest.detailsTitle') }}
        </p>
        <dl class="m-0 space-y-2 text-xs">
          <!-- Loaded Latency -->
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt class="text-muted-foreground shrink-0">{{ loadedLatencyTitle }}</dt>
            <dd v-if="speedTest.downLoadedLatency !== '-' || speedTest.upLoadedLatency !== '-'"
              class="m-0 ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 font-mono tabular-nums text-foreground">
              <span v-if="speedTest.downLoadedLatency !== '-'" class="inline-flex items-center gap-1 whitespace-nowrap">
                <span class="text-muted-foreground">↓</span>{{ speedTest.downLoadedLatency }} ms
                <span v-if="downDelta !== null" :class="textClass(deltaTone(downDelta))">
                  ({{ formatLoadedDelta(downDelta) }})
                </span>
              </span>
              <span v-if="speedTest.downLoadedLatency !== '-' && speedTest.upLoadedLatency !== '-'"
                class="text-muted-foreground/50" aria-hidden="true">·</span>
              <span v-if="speedTest.upLoadedLatency !== '-'" class="inline-flex items-center gap-1 whitespace-nowrap">
                <span class="text-muted-foreground">↑</span>{{ speedTest.upLoadedLatency }} ms
                <span v-if="upDelta !== null" :class="textClass(deltaTone(upDelta))">
                  ({{ formatLoadedDelta(upDelta) }})
                </span>
              </span>
            </dd>
            <dd v-else class="m-0 font-mono text-muted-foreground">—</dd>
          </div>

          <!-- Loaded Jitter -->
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt class="text-muted-foreground shrink-0">{{ t('speedtest.loadedJitter') }}</dt>
            <dd v-if="speedTest.downLoadedJitter !== '-' || speedTest.upLoadedJitter !== '-'"
              class="m-0 ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 font-mono tabular-nums text-foreground">
              <span v-if="speedTest.downLoadedJitter !== '-'" class="inline-flex items-center gap-1 whitespace-nowrap">
                <span class="text-muted-foreground">↓</span>{{ speedTest.downLoadedJitter }} ms
              </span>
              <span v-if="speedTest.downLoadedJitter !== '-' && speedTest.upLoadedJitter !== '-'"
                class="text-muted-foreground/50" aria-hidden="true">·</span>
              <span v-if="speedTest.upLoadedJitter !== '-'" class="inline-flex items-center gap-1 whitespace-nowrap">
                <span class="text-muted-foreground">↑</span>{{ speedTest.upLoadedJitter }} ms
              </span>
            </dd>
            <dd v-else class="m-0 font-mono text-muted-foreground">—</dd>
          </div>

          <!-- Actual Data Used -->
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted-foreground shrink-0">{{ t('speedtest.dataUsed') }}</dt>
            <dd class="m-0 font-mono tabular-nums text-foreground">
              {{ formatTransferredBytes(speedTest.transferredBytes) }}
            </dd>
          </div>

          <!-- Active Duration (pause time excluded) -->
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted-foreground shrink-0">{{ t('speedtest.duration') }}</dt>
            <dd class="m-0 font-mono tabular-nums text-foreground">
              {{ formattedDuration }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Full-width Route Readout & Follow-up Latency/Route Tools -->
    <div class="mt-4 pt-3 border-t border-dashed border-border/60 space-y-2">
      <div v-if="connection.colo"
        class="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5 sm:gap-y-1 text-xs text-muted-foreground">
        <div v-if="connection.ip" class="flex items-baseline gap-1 min-w-0 max-w-full">
          <span class="shrink-0">{{ t('speedtest.route') }}</span>
          <FitText :text="connection.ip" :tiers="ROUTE_IP_TIERS" :title="connection.ip"
            data-mask="ip" class="font-mono text-foreground/85 min-w-0" />
        </div>
        <div class="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
          <span v-if="!connection.ip" class="shrink-0">{{ t('speedtest.route') }}</span>
          <span v-else aria-hidden="true" class="font-mono">→</span>
          <i18n-t keypath="speedtest.cloudflareNode" tag="span" scope="global" class="text-foreground/85">
            <template #colo>
              <span class="font-mono">{{ connection.colo }}</span>
            </template>
          </i18n-t>
          <span v-if="coloLocation">{{ t('speedtest.coloLocation', { location: coloLocation }) }}</span>
        </div>
      </div>

      <i18n-t keypath="speedtest.ToolHint" tag="p" scope="global"
        class="m-0 text-xs text-muted-foreground leading-relaxed">
        <template #ping>
          <a href="/tools/pingtest" :class="toolLinkClass" @click="openTool($event, 'pingtest')">
            {{ t('pingtest.Title') }}</a>
        </template>
        <template #mtr>
          <a href="/tools/mtrtest" :class="toolLinkClass" @click="openTool($event, 'mtrtest')">
            {{ t('mtrtest.Title') }}</a>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CloudUpload, Gamepad2, Tv, Video } from '@lucide/vue';
import FitText from '@/components/widgets/FitText.vue';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { trackEvent } from '@/utils/analytics';
import { isPlainClick } from '@/utils/nav-target.js';
import { formatElapsedSeconds } from '@/utils/time-utils.js';
import {
  formatLoadedDelta, formatTransferredBytes,
  loadedLatencyDelta, qualityLevel,
} from '@/utils/features/speedtest-session.js';

const ROUTE_IP_TIERS = ['text-xs', 'text-[11px]', 'text-[10px]'];

const props = defineProps({
  speedTest: { type: Object, required: true },
  connection: { type: Object, required: true },
});

const { t, locale } = useI18n();
const router = useRouter();
const { dotClass, textClass } = useStatusTone();

const toolLinkClass = 'font-medium text-foreground/85 underline underline-offset-4 decoration-current/40 hover:text-foreground hover:decoration-current';
const openTool = (event, slug) => {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  trackEvent('SpeedTest', 'ToolEntry', slug);
  router.push({ path: `/tools/${slug}` });
};

const qualityTone = (classification) => {
  if (classification === 'good' || classification === 'great') return 'ok-fast';
  if (classification === 'average') return 'ok-slow';
  if (classification === 'poor' || classification === 'bad') return 'fail';
  return 'wait';
};

const deltaTone = (delta) => {
  if (delta === null || delta <= 0) return 'wait';
  if (delta <= 25) return 'ok-fast';
  if (delta <= 80) return 'ok-slow';
  return 'fail';
};

const scenarioItems = computed(() => [
  { key: 'streaming', icon: Tv, label: t('speedtest.videoStreaming').trim(), quality: props.speedTest.streamingQuality },
  { key: 'gaming', icon: Gamepad2, label: t('speedtest.gaming').trim(), quality: props.speedTest.gamingQuality },
  { key: 'rtc', icon: Video, label: t('speedtest.rtc').trim(), quality: props.speedTest.rtcQuality },
  { key: 'cloudSync', icon: CloudUpload, label: t('speedtest.cloudSync').trim(), quality: props.speedTest.cloudSyncQuality },
]);

const loadedLatencyTitle = computed(() => t('speedtest.loadedLatency').replace(/[:：\s]+$/, ''));
const formattedDuration = computed(() => formatElapsedSeconds(props.speedTest.activeDurationMs, locale.value) || '-');
const downDelta = computed(() => loadedLatencyDelta(props.speedTest.latency, props.speedTest.downLoadedLatency));
const upDelta = computed(() => loadedLatencyDelta(props.speedTest.latency, props.speedTest.upLoadedLatency));
const coloLocation = computed(() => (
  [props.connection.coloCity, props.connection.coloCountry].filter(Boolean).join(', ')
));
</script>

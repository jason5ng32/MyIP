<!-- Homepage SpeedTest section: packet controls, boot-draw telemetry cells, live charts, and results. -->
<template>
  <section class="mb-10">
    <!-- Header -->
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="SpeedTest"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚀 {{ t('speedtest.Title') }}
        </h2>
      </div>
      <div class="text-base text-muted-foreground">
        <p v-if="!isSimpleMode">{{ t('speedtest.Note') }}</p>
      </div>
    </header>

    <Card class="keyboard-shortcut-card jn-card jn-speedtest-card relative overflow-hidden"
      :data-st-status="state.speedTest.status"
      :data-st-drawing="state.speedTest.isDrawing || undefined"
      :data-st-drawn="state.speedTest.hasDrawn || undefined">
      <!-- Engineering CAD grid, drafting sweep cursor, and active horizon scanline -->
      <div class="jn-st-backdrop" aria-hidden="true">
        <div class="jn-st-grid"></div>
        <div class="jn-st-draw-line"></div>
        <div class="jn-st-scan"></div>
      </div>

      <CardContent class="p-4 md:p-6 relative z-[1]">
        <!-- Top Bar: Dynamic Client <-> Edge topology on top-left + Joined control group & Estimated data on top-right -->
        <div class="flex flex-col gap-3.5 md:flex-row md:items-start md:justify-between mb-3 md:mb-4">
          <div class="order-1 md:order-2 w-full md:w-auto md:ml-auto flex flex-col items-end gap-1.5 shrink-0">
            <div class="flex w-full md:inline-flex md:w-auto items-stretch">
              <span class="flex shrink-0 items-center px-3 border border-input rounded-l-md bg-muted" aria-hidden="true">
                <CloudDownload class="size-4 text-muted-foreground" />
              </span>
              <Select :model-value="String(state.config.package.download.bytes)"
                @update:model-value="(v) => v && (state.config.package.download.bytes = Number(v))"
                :disabled="isRunning || isPaused">
                <SelectTrigger aria-label="Download size"
                  class="rounded-none border-l-0 shadow-none gap-1.5 flex-1 min-w-0 md:flex-none md:w-auto md:min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="size in sizeOptions" :key="size" :value="String(size)">
                    {{ size / 1e6 }} MB
                  </SelectItem>
                </SelectContent>
              </Select>
              <span class="flex shrink-0 items-center px-3 border border-input border-l-0 bg-muted" aria-hidden="true">
                <CloudUpload class="size-4 text-muted-foreground" />
              </span>
              <Select :model-value="String(state.config.package.upload.bytes)"
                @update:model-value="(v) => v && (state.config.package.upload.bytes = Number(v))"
                :disabled="isRunning || isPaused">
                <SelectTrigger aria-label="Upload size"
                  class="rounded-none border-l-0 shadow-none gap-1.5 flex-1 min-w-0 md:flex-none md:w-auto md:min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="size in sizeOptions" :key="size" :value="String(size)">
                    {{ size / 1e6 }} MB
                  </SelectItem>
                </SelectContent>
              </Select>
              <JnTooltip :text="t('Tooltips.SpeedTestButton')" side="top">
                <Button size="icon" variant="outline" class="rounded-l-none border-l-0 shadow-none cursor-pointer"
                  @click="speedTestController" aria-label="Start/Pause Speed Test">
                  <component :is="ctaIcon" />
                </Button>
              </JnTooltip>
            </div>

            <p class="m-0 text-xs text-muted-foreground font-mono tabular-nums">
              {{ t('speedtest.estimatedData', { mb: estimatedTotalMB }) }}
            </p>
          </div>

          <Separator class="order-2 bg-border/70 md:hidden" />

          <SpeedTestTopology
            class="order-3 md:order-1 w-full md:w-auto md:pt-2"
            :connection="state.connection"
            :flow="linkFlow"
            :paused="isPaused" />
        </div>

        <!-- Standby & Live Status Rail -->
        <div class="mb-5">
          <div class="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div class="flex items-center gap-2 min-w-0">
              <span class="relative inline-flex size-2 shrink-0" aria-hidden="true">
                <span v-if="isRunning && !isCeremony"
                  class="absolute inline-flex size-full animate-ping rounded-full opacity-75"
                  :class="statusDotClass"></span>
                <span class="relative inline-flex size-2 rounded-full transition-colors duration-300"
                  :class="statusDotClass"></span>
              </span>
              <p class="m-0 truncate" role="status" aria-live="polite" aria-atomic="true">
                {{ progressLabel }}
              </p>
            </div>
            <span class="font-mono text-xs tabular-nums shrink-0">{{ Math.round(state.speedTest.progress) }}%</span>
          </div>
          <Progress :model-value="state.speedTest.progress" :aria-label="progressLabel" class="h-1.5"
            :indicator-class="progressIndicatorClass" />
        </div>

        <!-- 4 Engineered Metric Readout Cells -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div v-for="(m, idx) in metrics" :key="m.key"
            class="jn-st-metric-cell relative overflow-hidden rounded-md px-3 pt-2.5 pb-4 text-center"
            :style="{ '--st-col': idx, '--st-cell-tone': metricToneVar(m.key) }"
            :data-active="isMetricActive(m.key) || undefined"
            :data-toned="Boolean(metricToneVar(m.key)) || undefined">
            <div class="jn-st-cell-head flex items-center justify-between text-[10px] font-mono leading-none text-muted-foreground/75 mb-1.5"
              aria-hidden="true">
              <span>0{{ idx + 1 }}</span>
              <span class="relative inline-flex size-1.5">
                <span v-if="isMetricActive(m.key)"
                  class="absolute inline-flex size-full animate-ping rounded-full opacity-75"
                  :class="metricDotClass(m.key)"></span>
                <span class="relative inline-flex size-1.5 rounded-full transition-colors duration-300"
                  :class="metricDotClass(m.key)"></span>
              </span>
            </div>
            <p class="text-base md:text-lg uppercase tracking-wider text-primary mb-1">{{ m.label }}</p>
            <p class="text-2xl md:text-3xl font-mono font-light tabular-nums m-0 transition-colors duration-200"
              :class="metricColorClass">
              <span>{{ state.speedTest[m.key] === '-' ? '--' : state.speedTest[m.key] }}</span>
              <span class="ml-1 text-sm font-normal text-muted-foreground/70">{{ m.unit }}</span>
            </p>
            <div class="jn-st-ruler" aria-hidden="true"></div>
          </div>
        </div>

        <div id="result"></div>

        <!-- Charts Area (hidden while idle, during handshake/calibration, or when the run failed without data) -->
        <div v-show="!isIdle && !isError && !isCeremony" class="speed-charts-container jn-slide-in">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <div class="chart-wrapper"><canvas ref="downloadChart"></canvas></div>
            <div class="chart-wrapper"><canvas ref="uploadChart"></canvas></div>
            <div class="chart-wrapper"><canvas ref="latencyChart"></canvas></div>
            <div class="chart-wrapper"><canvas ref="jitterChart"></canvas></div>
          </div>
        </div>

        <!-- Scenario Performance & Load Details -->
        <SpeedTestResultPanel
          v-if="isFinished && state.speedTest.hasScores"
          class="jn-slide-in"
          :speed-test="state.speedTest"
          :connection="state.connection" />

        <!-- Error Block -->
        <div v-else-if="isError" class="jn-slide-in rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <div class="flex items-center gap-2">
            <CircleAlert class="size-4 text-destructive shrink-0" />
            <span class="text-sm text-destructive">{{ t('speedtest.testFailed') }}</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <InfoBanner section="speedtest" :settled="hasEverSettled" />
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleAlert, CloudDownload, CloudUpload, Pause, Play, RotateCw } from '@lucide/vue';
import { useMainStore } from '@/store';
import { useAppCommand } from '@/composables/use-app-command.js';
import useSpeedTest from '@/composables/use-speedtest.js';
import useSpeedTestCharts from '@/composables/use-speedtest-charts.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JnTooltip } from '@/components/ui/tooltip';
import SpeedTestResultPanel from '@/components/speedtest/SpeedTestResultPanel.vue';
import SpeedTestTopology from '@/components/speedtest/SpeedTestTopology.vue';
import InfoBanner from '@/components/widgets/InfoBanner.vue';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);
const isSimpleMode = computed(() => store.userPreferences.simpleMode);
const isMobile = computed(() => store.isMobile);

const {
  downloadChart, uploadChart, latencyChart, jitterChart,
  updateCharts, initStartingPoints, destroyCharts, resetChartData,
} = useSpeedTestCharts(t);

const {
  state, hasEverSettled, sizeOptions,
  isIdle, isRunning, isPaused, isFinished, isError, isCeremony,
  estimatedTotalMB, progressLabel, statusDotClass, progressIndicatorClass,
  metricColorClass, metricDotClass, metricToneVar, linkFlow, isMetricActive, speedTestController,
} = useSpeedTest({
  t,
  lang,
  updateAllIPs: (items) => store.updateAllIPs(items),
  initStartingPoints,
  updateCharts,
  resetChartData,
  destroyCharts,
});

const ctaIcon = computed(() => {
  if (isRunning.value) return Pause;
  if (isFinished.value || isError.value) return RotateCw;
  return Play;
});

const metrics = computed(() => [
  { key: 'downloadSpeed', label: t('speedtest.Download'), unit: 'Mb/s' },
  { key: 'uploadSpeed', label: t('speedtest.Upload'), unit: 'Mb/s' },
  { key: 'latency', label: t('speedtest.Latency'), unit: 'ms' },
  { key: 'jitter', label: t('speedtest.Jitter'), unit: 'ms' },
]);

useAppCommand('speedtest:toggle', () => speedTestController());
onMounted(() => { store.setMountingStatus('SpeedTest', true); });
</script>

<style scoped>
/* Powered-on telemetry backdrop: subtle CAD grid visible in standby; brightens on calibration/run */
.jn-st-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.jn-st-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, var(--jn-cad-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--jn-cad-grid) 1px, transparent 1px);
  background-size: 24px 24px;
  -webkit-mask-image: radial-gradient(ellipse 92% 85% at 50% 45%, #000 35%, transparent 100%);
  mask-image: radial-gradient(ellipse 92% 85% at 50% 45%, #000 35%, transparent 100%);
  opacity: 0.62;
  transition: opacity 400ms ease;
}

.jn-speedtest-card[data-st-drawn='true'] .jn-st-grid {
  opacity: 0.85;
}

.jn-speedtest-card[data-st-drawn='true'][data-st-status='running'] .jn-st-grid {
  opacity: 1;
  background-image:
    radial-gradient(ellipse 65% 55% at 50% 55%, var(--jn-cad-grid-active), transparent 75%),
    linear-gradient(to right, var(--jn-cad-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--jn-cad-grid) 1px, transparent 1px);
  background-size: 100% 100%, 24px 24px, 24px 24px;
}

.jn-st-draw-line {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in oklab, var(--info) 60%, transparent) 20%,
    color-mix(in oklab, var(--info) 60%, transparent) 80%,
    transparent
  ) no-repeat 0 0 / 1px 100%;
  opacity: 0;
  transform: translateX(0%);
}

@keyframes jn-st-cursor-sweep {
  0% { transform: translateX(0%); opacity: 0; }
  10% { opacity: 1; }
  88% { opacity: 0.9; }
  100% { transform: translateX(100%); opacity: 0; }
}

.jn-st-scan {
  position: absolute;
  top: 0;
  left: 0;
  width: 45%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--info), transparent);
  opacity: 0;
  transform: translateX(-100%);
  transition: opacity 250ms ease;
}

/* Metric gauge cells: solid standby instrument slots; staggered L->R calibration sweep on first start */
.jn-st-metric-cell {
  border: 1px solid var(--border);
  background-color: color-mix(in oklab, var(--card) 82%, transparent);
  transition: border-color 300ms ease, background-color 300ms ease;
}

.jn-st-cell-head {
  opacity: 0.82;
  transition: opacity 250ms ease;
}

.jn-speedtest-card[data-st-drawn='true'] .jn-st-cell-head {
  opacity: 1;
}

.jn-speedtest-card[data-st-drawn='true'] .jn-st-metric-cell[data-toned='true'] {
  border-color: color-mix(in oklab, var(--st-cell-tone) 34%, var(--border));
}

.jn-speedtest-card[data-st-drawn='true'] .jn-st-metric-cell[data-active='true'] {
  border-color: color-mix(in oklab, var(--st-cell-tone) 50%, var(--border));
  background-color: color-mix(in oklab, var(--st-cell-tone) 4%, var(--card));
}

.jn-st-ruler {
  position: absolute;
  inset-inline: 10px;
  bottom: 5px;
  height: 5px;
  background-image:
    repeating-linear-gradient(to right, var(--jn-cad-tick-major) 0 1px, transparent 1px 24px),
    repeating-linear-gradient(to right, var(--jn-cad-tick) 0 1px, transparent 1px 6px);
  background-size: 100% 5px, 100% 3px;
  background-position: left bottom, left bottom;
  background-repeat: no-repeat;
  opacity: 0.72;
  transition: opacity 300ms ease;
}

.jn-speedtest-card[data-st-drawn='true'] .jn-st-ruler {
  opacity: 1;
}

@keyframes jn-st-cell-calibrate {
  0%, 100% {
    border-color: var(--border);
    background-color: color-mix(in oklab, var(--card) 82%, transparent);
  }
  40% {
    border-color: color-mix(in oklab, var(--info) 45%, var(--border));
    background-color: color-mix(in oklab, var(--info) 4%, var(--card));
  }
}

@keyframes jn-st-horizon-scan {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(320%); }
}

@keyframes jn-st-ruler-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: no-preference) {
  .jn-speedtest-card[data-st-drawing='true'] .jn-st-draw-line {
    animation: jn-st-cursor-sweep 580ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .jn-speedtest-card[data-st-drawing='true'] .jn-st-metric-cell {
    animation: jn-st-cell-calibrate 320ms ease calc(var(--st-col, 0) * 95ms + 40ms);
  }

  .jn-speedtest-card[data-st-drawn='true'][data-st-status='running'] .jn-st-scan {
    opacity: 0.9;
    animation: jn-st-horizon-scan 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .jn-speedtest-card[data-st-drawn='true'] .jn-st-metric-cell[data-active='true'] .jn-st-ruler::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--info) 65%, transparent), transparent);
    animation: jn-st-ruler-sweep 1.6s ease-in-out infinite;
  }
}

.speed-charts-container {
  margin: 20pt 0;
}

.chart-wrapper {
  position: relative;
  height: 130pt;
  width: 100%;
  margin-bottom: 15pt;
}

@media (max-width: 768px) {
  .chart-wrapper {
    height: 100pt;
    margin-bottom: 20pt;
  }
}

@media (min-width: 769px) and (max-width: 991px) {
  .chart-wrapper {
    height: 100pt;
    margin-bottom: 25pt;
  }
}

.jn-slide-in {
  animation: jn-slide-in 0.2s ease-in forwards;
}

@keyframes jn-slide-in {
  from {
    transform: translateY(20px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>

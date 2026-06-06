<template>
  <section class="mb-10">
    <!-- Header: title + aggregate light + refresh trigger -->
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="ServiceStatus"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          📡 {{ t('serviceStatus.Title') }}
        </h2>
        <JnTooltip :text="t('serviceStatus.Refresh')" side="left">
          <Button size="icon" variant="outline" class="shrink-0 cursor-pointer" :disabled="loading" @click="refresh"
            aria-label="Refresh Service Status">
            <component :is="hasLoaded ? RotateCw : Play" />
          </Button>
        </JnTooltip>
      </div>
      <div class="text-base text-muted-foreground">
        <p v-if="!isSimpleMode">{{ t('serviceStatus.Note') }}</p>
      </div>
    </header>

    <!-- Provider card grid — always rendered from the static list, so a failed
        fetch shows per-card "status unavailable" rather than removing cards. -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Collapsible v-for="p in PROVIDERS" :key="p.id" v-model:open="openState[p.id]" as-child>
        <Card class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5">
          <!-- Always-visible summary; the whole header toggles the panel -->
          <CollapsibleTrigger class="w-full text-left cursor-pointer" @click="onToggle(p)">
            <CardContent class="p-4">
              <div class="flex items-center gap-2 mb-3">
                <Icon v-if="p.icon" :icon="p.icon" class="size-6 text-muted-foreground" />
                <span v-else
                  class="size-6 shrink-0 rounded-lg inline-flex items-center justify-center text-xs font-semibold text-muted-foreground border-2 border-muted-foreground">
                  {{ (p.name || '?').charAt(0).toUpperCase() }}
                </span>
                <span class="text-base font-medium truncate">{{ p.name }}</span>
                <ChevronDown class="size-4 ml-auto shrink-0 text-muted-foreground transition-transform duration-200"
                  :class="{ 'rotate-180': openState[p.id] }" />
              </div>
              <!-- Checking → pulse + label; otherwise a status icon + label -->
              <div class="flex items-center gap-1.5 text-base min-w-0">
                <template v-if="loading">
                  <span class="relative flex shrink-0">
                    <span class="absolute inline-flex size-2.5 rounded-full bg-info opacity-75 animate-ping"></span>
                    <span class="relative inline-flex size-2.5 rounded-full bg-info"></span>
                  </span>
                  <span class="text-muted-foreground truncate">{{ t('serviceStatus.Checking') }}</span>
                </template>
                <template v-else>
                  <component :is="toneIcon(indicatorTone(p))" class="size-4 shrink-0"
                    :class="textClass(indicatorTone(p))" />
                  <span :class="textClass(indicatorTone(p))" class="truncate">
                    {{ indicatorLabel(effectiveIndicator(p)) }}
                  </span>
                </template>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <!-- Expanded: services + recent incidents behind tabs (keeps the
               opened card from stretching the page too tall). Each tab's data
               is fetched on first view, not with the overview. -->
          <CollapsibleContent>
            <CardContent class="px-4 pb-4 pt-0">
              <Tabs :model-value="activeTab[p.id] || 'components'" @update:model-value="(v) => onTabChange(p, v)">
                <TabsList class="grid w-full grid-cols-2">
                  <TabsTrigger value="components">{{ t('serviceStatus.ComponentsTitle') }}</TabsTrigger>
                  <TabsTrigger value="incidents">{{ t('serviceStatus.IncidentsTitle') }}</TabsTrigger>
                </TabsList>

                <!-- Sub-services (first level only) -->
                <TabsContent value="components" class="mt-3">
                  <!-- Skeleton placeholder keeps the panel height stable while loading -->
                  <ul v-if="componentsState[p.id]?.loading" class="rounded-lg border bg-card divide-y">
                    <li v-for="(w, i) in placeholderSizes" :key="i" class="px-3 py-2.5">
                      <div class="h-3.5 bg-muted rounded animate-pulse" :style="`width:${(w / 12) * 100}%`"></div>
                    </li>
                  </ul>
                  <p v-else-if="componentsState[p.id]?.error" class="text-sm text-destructive py-2">
                    {{ t('serviceStatus.ComponentsError') }}
                  </p>
                  <ul v-else-if="componentsState[p.id]?.data?.length"
                    class="rounded-lg border bg-card divide-y max-h-150 overflow-y-auto">
                    <li v-for="(c, i) in componentsState[p.id].data" :key="i"
                      class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span class="truncate min-w-0">{{ c.name }}</span>
                      <span class="flex items-center gap-1.5 shrink-0">
                        <component :is="toneIcon(componentStatusToTone(c.status))" class="size-3.5 shrink-0"
                          :class="textClass(componentStatusToTone(c.status))" />
                        <span :class="textClass(componentStatusToTone(c.status))" class="text-xs whitespace-nowrap">
                          {{ componentLabel(c.status) }}
                        </span>
                      </span>
                    </li>
                  </ul>
                  <p v-else class="text-sm text-muted-foreground py-2">{{ t('serviceStatus.NoComponents') }}</p>
                </TabsContent>

                <!-- Recent incidents -->
                <TabsContent value="incidents" class="mt-3">
                  <ul v-if="incidentsState[p.id]?.loading" class="rounded-lg border bg-card divide-y">
                    <li v-for="(w, i) in placeholderSizes" :key="i" class="px-3 py-2.5">
                      <div class="h-3.5 bg-muted rounded animate-pulse" :style="`width:${(w / 12) * 100}%`"></div>
                    </li>
                  </ul>
                  <p v-else-if="incidentsState[p.id]?.error" class="text-sm text-destructive py-2">
                    {{ t('serviceStatus.IncidentsError') }}
                  </p>
                  <ul v-else-if="incidentsState[p.id]?.data?.length"
                    class="rounded-lg border bg-card divide-y max-h-150 overflow-y-auto">
                    <li v-for="inc in incidentsState[p.id].data" :key="inc.id" class="px-3 py-2 text-sm">
                      <!-- Line 1: incident title -->
                      <a :href="inc.url || statusById[p.id]?.page" target="_blank" rel="noopener noreferrer"
                        :title="inc.name" class="block truncate hover:underline">
                        {{ inc.name }}
                      </a>
                      <!-- Line 2: date · severity (! icon count, no color) · status (colored by lifecycle) -->
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <div class="mt-0.5 flex items-center gap-1.5  text-muted-foreground">
                          <span>{{ formatDate(inc.startedAt) }}</span>
                          <template v-if="impactLevel(inc.impact) > 0">
                            <span aria-hidden="true">·</span>
                            <span class="inline-flex items-center" :title="indicatorLabel(inc.impact)">
                              <TriangleAlert v-for="n in impactLevel(inc.impact)" :key="n" class="size-3 mr-[2px]" />
                            </span>
                          </template>
                        </div>
                        <span :class="textClass(incidentStatusTone(inc.status))">
                          {{ incidentStatusLabel(inc.status) }}
                        </span>
                      </div>
                    </li>
                  </ul>
                  <p v-else class="text-sm text-muted-foreground py-2">{{ t('serviceStatus.NoRecentIncidents') }}</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  </section>
</template>

<script setup>
// "Service Status" homepage section: shows whether a set of well-known
// products are currently up, with an aggregate check/alert/x light.
//
// The provider list is static here (like the Connectivity section's targets)
// so the cards always render — even if our API is unreachable, each card just
// falls back to a "status unavailable" state instead of the section vanishing.
//
// The backend polls every provider on a fixed 5-minute schedule and caches the
// result in memory. Three cheap snapshot-read endpoints back this view:
//   /api/service-status             → overview (status per provider)
//   /api/service-status/components  → one provider's sub-services (on expand)
//   /api/service-status/incidents   → one provider's recent incidents (on tab)
// so the initial load stays light and detail is pulled only when opened.
import { ref, reactive, computed, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import {
  indicatorToTone, componentStatusToTone, impactLevel, incidentStatusTone,
} from '@/utils/service-status-tone.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play, RotateCw, ChevronDown, CircleCheck, CircleAlert, CircleX, CircleHelp, TriangleAlert } from '@lucide/vue';
import { Icon } from '@iconify/vue';

const { t, locale } = useI18n();
const store = useMainStore();
const isSimpleMode = computed(() => store.userPreferences.simpleMode);
const { textClass } = useStatusTone();

// Static provider list — drives the always-visible cards. Brand icons from the
// iconify `ri` (Remix Icon) set, matching the Connectivity section. Cloudflare
// reuses the generic cloud glyph; providers with no reliable `ri` brand glyph
// are left null and fall back to a first-letter tile.
const PROVIDERS = [
  { id: 'claude', name: 'Claude', icon: 'ri:claude-line' },
  { id: 'openai', name: 'OpenAI', icon: 'ri:openai-line' },
  { id: 'cursor', name: 'Cursor', icon: 'simple-icons:cursor' },
  { id: 'notion', name: 'Notion', icon: 'ri:notion-line' },
  { id: 'github', name: 'GitHub', icon: 'ri:github-line' },
  { id: 'cloudflare', name: 'Cloudflare', icon: 'simple-icons:cloudflare' },
  { id: 'discord', name: 'Discord', icon: 'ri:discord-line' },
  { id: 'reddit', name: 'Reddit', icon: 'ri:reddit-line' },
];

const placeholderSizes = [10, 7, 9, 6, 8];

// Status tone → lucide icon. CircleHelp covers the "status unavailable"
// (couldn't fetch) tone; loading is shown as a pulse, not an icon.
const TONE_ICON = {
  'ok-fast': CircleCheck,
  'ok-slow': CircleAlert,
  'fail': CircleX,
  'wait': CircleHelp,
};
const toneIcon = (tone) => TONE_ICON[tone] || CircleHelp;

const hasLoaded = ref(false);
const loading = ref(true);
const fetchFailed = ref(false);

// id → { indicator, page } from the overview fetch.
const statusById = reactive({});
// Per-provider UI / detail-fetch state.
const openState = reactive({});       // id → bool (expanded)
const activeTab = reactive({});       // id → 'components' | 'incidents'
const componentsState = reactive({}); // id → { loading, error, data }
const incidentsState = reactive({});  // id → { loading, error, data }

// A provider with no known indicator (fetch failed, or our API unreachable)
// reads as 'unknown' → the "status unavailable" label + CircleHelp icon.
const effectiveIndicator = (p) =>
  (fetchFailed.value ? 'unknown' : statusById[p.id]?.indicator) || 'unknown';
const indicatorTone = (p) => indicatorToTone(effectiveIndicator(p));

// ── i18n label lookups (graceful fallback to the raw key) ───────────────────
const indicatorLabel = (indicator) => {
  const map = {
    none: t('serviceStatus.AllOperational'),
    minor: t('serviceStatus.indicator.minor'),
    major: t('serviceStatus.indicator.major'),
    critical: t('serviceStatus.indicator.critical'),
    maintenance: t('serviceStatus.indicator.maintenance'),
    unknown: t('serviceStatus.indicator.unknown'),
  };
  return map[indicator] || map.unknown;
};
const componentLabel = (status) => {
  const key = `serviceStatus.component.${status}`;
  const label = t(key);
  return label === key ? status : label;
};
const incidentStatusLabel = (status) => {
  if (!status) return '';
  const key = `serviceStatus.incidentStatus.${status}`;
  const label = t(key);
  return label === key ? status : label;
};

// Localized short date for an incident's start time.
const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale.value || 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return '';
  }
};

// ── Data loading ────────────────────────────────────────────────────────────
// Overview is a cheap snapshot read — the backend timer owns the upstream
// refresh, so this never triggers upstream traffic.
const loadOverview = async () => {
  loading.value = true;
  try {
    const res = await fetchWithTimeout('/api/service-status', { timeoutMs: 10000 });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    const list = Array.isArray(json.providers) ? json.providers : [];
    for (const item of list) {
      statusById[item.id] = { indicator: item.indicator, page: item.page };
    }
    fetchFailed.value = false;
  } catch {
    // Keep the cards; mark every one as "status unavailable".
    fetchFailed.value = true;
  } finally {
    loading.value = false;
    hasLoaded.value = true;
  }
};

// The detail snapshot reads are near-instant (memory + edge cache), so the
// skeleton would otherwise flash by. Hold it for at least this long. Run the
// fetch and the floor delay together → total wait is max(fetch, floor), not
// their sum, so slow fetches aren't further penalized.
const MIN_SKELETON_MS = 1000;
const floorDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lazy per-provider detail loaders. Both guard against duplicate fetches and
// cache their result on the reactive map until the next refresh clears it.
const loadComponents = async (id) => {
  if (componentsState[id]?.data || componentsState[id]?.loading) return;
  componentsState[id] = { loading: true, error: false, data: null };
  try {
    const [res] = await Promise.all([
      fetchWithTimeout(`/api/service-status/components?id=${id}`, { timeoutMs: 10000 }),
      floorDelay(MIN_SKELETON_MS),
    ]);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    componentsState[id] = { loading: false, error: false, data: json.components || [] };
  } catch {
    componentsState[id] = { loading: false, error: true, data: null };
  }
};

const loadIncidents = async (id) => {
  if (incidentsState[id]?.data || incidentsState[id]?.loading) return;
  incidentsState[id] = { loading: true, error: false, data: null };
  try {
    const [res] = await Promise.all([
      fetchWithTimeout(`/api/service-status/incidents?id=${id}`, { timeoutMs: 10000 }),
      floorDelay(MIN_SKELETON_MS),
    ]);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    incidentsState[id] = { loading: false, error: false, data: json.incidents || [] };
  } catch {
    incidentsState[id] = { loading: false, error: true, data: null };
  }
};

const onToggle = (p) => {
  // Collapsible flips openState via v-model; this fires on the same click, so
  // a falsy current value means we're opening. Default tab is components.
  if (!openState[p.id]) {
    trackEvent('Section', 'ExpandProvider', `ServiceStatus:${p.id}`);
    loadComponents(p.id);
  }
};

const onTabChange = (p, tab) => {
  activeTab[p.id] = tab;
  if (tab === 'incidents') loadIncidents(p.id);
  else loadComponents(p.id);
};

const refresh = () => {
  trackEvent('Section', 'RefreshClick', 'ServiceStatus');
  // Drop cached detail so a reopened card refetches the fresh snapshot.
  for (const k of Object.keys(componentsState)) delete componentsState[k];
  for (const k of Object.keys(incidentsState)) delete incidentsState[k];
  loadOverview();
};

onMounted(() => {
  // Critical: this signal lets the refresh orchestrator's loadingControl
  // proceed (it waits for every section's mountingStatus to be true).
  store.setMountingStatus('ServiceStatus', true);
  loadOverview();
});

defineExpose({ refresh });
</script>

<template>
  <!-- Service Status advanced tool: shows whether a set of well-known
       products are currently up, expandable per-card into sub-services and
       recent incidents. Lives inside the Advanced Tools drawer (its title is
       rendered by the drawer header), so this template starts at the note row
       rather than a section <h2>. -->
  <div class="service-status-section my-4 space-y-4">
    <!-- Top note -->
    <p class="text-sm text-muted-foreground leading-relaxed">{{ t('serviceStatus.Note') }}</p>

    <!-- Provider card grid — always rendered from the static list, so a failed
        fetch shows per-card "status unavailable" rather than removing cards. -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Collapsible v-for="p in PROVIDERS" :key="p.id" v-model:open="openState[p.id]" as-child>
        <Card class="jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5">
          <CardContent class="p-4 min-w-0">
            <!-- Header row (toggles the panel) — provider icon + name + chevron -->
            <CollapsibleTrigger class="w-full text-left cursor-pointer" @click="onToggle(p)">
              <div class="flex items-center gap-2 mb-3">
                <Icon v-if="p.icon" :icon="p.icon" class="size-6 text-muted-foreground shrink-0" />
                <span v-else
                  class="size-6 shrink-0 rounded-lg inline-flex items-center justify-center text-xs font-semibold text-muted-foreground border-2 border-muted-foreground">
                  {{ (p.name || '?').charAt(0).toUpperCase() }}
                </span>
                <span class="text-base font-medium truncate min-w-0 flex-1">{{ p.name }}</span>
                <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  :class="{ 'rotate-180': openState[p.id] }" />
              </div>
            </CollapsibleTrigger>

            <!-- Primary status line — checking → pulse + label; else status icon + label -->
            <div class="flex items-center gap-1.5 text-base min-w-0 min-h-6">
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

          <!-- Expanded: services + recent incidents behind tabs (keeps the
               opened card from stretching the page too tall). Each tab's data
               is fetched on first view, not with the overview. -->
          <CollapsibleContent>
            <CardContent class="px-4 pb-4 pt-0">
              <Tabs :model-value="activeTab[p.id] || 'components'" @update:model-value="(v) => (activeTab[p.id] = v)">
                <TabsList class="grid w-full grid-cols-2">
                  <TabsTrigger value="components">{{ t('serviceStatus.ComponentsTitle') }}</TabsTrigger>
                  <TabsTrigger value="incidents">{{ t('serviceStatus.IncidentsTitle') }}</TabsTrigger>
                </TabsList>

                <!-- Sub-services (first level only) -->
                <TabsContent value="components" class="mt-3">
                  <!-- Skeleton placeholder keeps the panel height stable while loading -->
                  <ul v-if="detailState[p.id]?.loading" class="rounded-lg border bg-card divide-y">
                    <li v-for="(w, i) in placeholderSizes" :key="i" class="px-3 py-2.5">
                      <div class="h-3.5 bg-muted rounded animate-pulse" :style="`width:${(w / 12) * 100}%`"></div>
                    </li>
                  </ul>
                  <p v-else-if="detailState[p.id]?.error" class="text-sm text-destructive py-2">
                    {{ t('serviceStatus.ComponentsError') }}
                  </p>
                  <ul v-else-if="detailState[p.id]?.components?.length"
                    class="rounded-lg border bg-card divide-y max-h-150 overflow-y-auto">
                    <li v-for="(c, i) in detailState[p.id].components" :key="i"
                      class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span class="truncate min-w-0" :title="c.name">{{ c.name }}</span>
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
                  <ul v-if="detailState[p.id]?.loading" class="rounded-lg border bg-card divide-y">
                    <li v-for="(w, i) in placeholderSizes" :key="i" class="px-3 py-2.5">
                      <div class="h-3.5 bg-muted rounded animate-pulse" :style="`width:${(w / 12) * 100}%`"></div>
                    </li>
                  </ul>
                  <p v-else-if="detailState[p.id]?.error" class="text-sm text-destructive py-2">
                    {{ t('serviceStatus.IncidentsError') }}
                  </p>
                  <ul v-else-if="detailState[p.id]?.incidents?.length"
                    class="rounded-lg border bg-card divide-y max-h-150 overflow-y-auto">
                    <li v-for="inc in detailState[p.id].incidents" :key="inc.id" class="px-3 py-2 text-sm">
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

    <!-- Bottom RefreshAll button (action color + Spinner standard) + the
         time of the frontend's last pull. We show *our last fetch* time, not
         the backend snapshot's: the poller refreshes on its own 5-min cadence,
         so surfacing its timestamp would leave the time (and content) looking
         frozen after a manual refresh. Seconds are included so back-to-back
         clicks within the same minute still visibly advance. -->
    <div class="flex flex-col items-center gap-2 pt-2">
      <Button variant="action" :disabled="loading" class="cursor-pointer" :class="[isMobile ? 'w-full' : 'w-64']"
        @click="refresh">
        <Spinner v-if="loading" />
        <RotateCw v-else />
        {{ t('serviceStatus.Refresh') }}
      </Button>
      <p v-if="formattedRefreshed" class="text-xs text-muted-foreground">
        {{ t('serviceStatus.LastChecked') }} · {{ formattedRefreshed }}
      </p>
    </div>
  </div>
</template>

<script setup>
// "Service Status" advanced tool: shows whether a set of well-known products
// are currently up, with a per-card check/alert/x light, a link to each
// provider's official status page, and our snapshot's last-checked time.
//
// The provider list is static here (like the Connectivity section's targets)
// so the cards always render — even if our API is unreachable, each card just
// falls back to a "status unavailable" state instead of the grid vanishing.
//
// The backend polls every provider on a fixed 5-minute schedule and caches the
// result in memory. Two cheap snapshot-read endpoints back this view:
//   /api/service-status         → overview (status + page per provider, updatedAt)
//   /api/service-status/detail  → one provider's sub-services + incidents (on expand)
// so the initial load stays light and detail is pulled only when a card opens.
//
// Moved out of the homepage into the Advanced Tools drawer: it mounts fresh
// each time the tool is opened (loadOverview on mount) and is no longer wired
// into the homepage's global-refresh orchestrator — the bottom Refresh button
// here is the only re-pull path.
import { ref, reactive, computed, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import {
  indicatorToTone, componentStatusToTone, impactLevel, incidentStatusTone,
} from '@/utils/service-status-tone.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import {
  RotateCw, ChevronDown, CircleCheck, CircleAlert, CircleX, CircleHelp, TriangleAlert,
} from '@lucide/vue';
import { Icon } from '@iconify/vue';

const { t, locale } = useI18n();
const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const { textClass } = useStatusTone();

// Static provider list — drives the always-visible cards. Brand icons from the
// iconify `ri` (Remix Icon) set, matching the Connectivity section. Cloudflare
// reuses the generic cloud glyph; providers with no reliable `ri` brand glyph
// are left null and fall back to a first-letter tile.
const PROVIDERS = [
  { id: 'claude', name: 'Claude', icon: 'ri:claude-line' },
  { id: 'chatgpt', name: 'ChatGPT', icon: 'ri:openai-line' },
  { id: 'cursor', name: 'Cursor', icon: 'simple-icons:cursor' },
  { id: 'notion', name: 'Notion', icon: 'ri:notion-line' },
  { id: 'github', name: 'GitHub', icon: 'ri:github-line' },
  { id: 'cloudflare', name: 'Cloudflare', icon: 'simple-icons:cloudflare' },
  { id: 'elevenlabs', name: 'ElevenLabs', icon: 'simple-icons:elevenlabs' },
  { id: 'langchain', name: 'LangChain', icon: 'simple-icons:langchain' },
  { id: 'vercel', name: 'Vercel', icon: 'simple-icons:vercel' },
  { id: 'netlify', name: 'Netlify', icon: 'simple-icons:netlify' },
  { id: 'render', name: 'Render', icon: 'simple-icons:render' },
  { id: 'supabase', name: 'Supabase', icon: 'simple-icons:supabase' },
  { id: 'replicate', name: 'Replicate', icon: 'simple-icons:replicate' },
  { id: 'figma', name: 'Figma', icon: 'simple-icons:figma' },
  { id: 'linear', name: 'Linear', icon: 'simple-icons:linear' },
  { id: 'stripe', name: 'Stripe', icon: 'simple-icons:stripe' },
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

const loading = ref(true);
const fetchFailed = ref(false);
// Wall-clock of the frontend's last overview pull (mount + each Refresh click).
// Deliberately NOT the backend snapshot's updatedAt — see the template comment.
const lastRefreshedAt = ref(null);

// id → { indicator, page } from the overview fetch.
const statusById = reactive({});
// Per-provider UI / detail-fetch state.
const openState = reactive({});   // id → bool (expanded)
const activeTab = reactive({});   // id → 'components' | 'incidents'
const detailState = reactive({}); // id → { loading, error, loaded, components, incidents }

// A provider with no known indicator (fetch failed, or our API unreachable)
// reads as 'unknown' → the "status unavailable" label + CircleHelp icon.
const effectiveIndicator = (p) =>
  (fetchFailed.value ? 'unknown' : statusById[p.id]?.indicator) || 'unknown';
const indicatorTone = (p) => indicatorToTone(effectiveIndicator(p));

// Localized HH:MM:SS of the frontend's last pull — the data-freshness signal
// shown under the Refresh button. Seconds included so rapid re-clicks advance.
const formattedRefreshed = computed(() => {
  if (!lastRefreshedAt.value) return '';
  try {
    return lastRefreshedAt.value.toLocaleTimeString(locale.value || 'en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return '';
  }
});

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
    // Stamp the pull time on every completed attempt (success or failure), so
    // the displayed time always advances when the user hits Refresh.
    lastRefreshedAt.value = new Date();
  }
};

// The detail snapshot reads are near-instant (memory + edge cache), so the
// skeleton would otherwise flash by. Hold it for at least this long. Run the
// fetch and the floor delay together → total wait is max(fetch, floor), not
// their sum, so slow fetches aren't further penalized.
const MIN_SKELETON_MS = 1000;
const floorDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lazy per-provider detail loader: one request returns both the sub-services
// and the recent incidents (a user who opens a card looks at both). Guards
// against duplicate fetches; a successful result is cached until refresh, while
// an error leaves `loaded` false so re-expanding retries.
const loadDetail = async (id) => {
  if (detailState[id]?.loading || detailState[id]?.loaded) return;
  detailState[id] = { loading: true, error: false, loaded: false, components: [], incidents: [] };
  try {
    const [res] = await Promise.all([
      fetchWithTimeout(`/api/service-status/detail?id=${id}`, { timeoutMs: 10000 }),
      floorDelay(MIN_SKELETON_MS),
    ]);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    detailState[id] = {
      loading: false, error: false, loaded: true,
      components: json.components || [],
      incidents: json.incidents || [],
    };
  } catch {
    detailState[id] = { loading: false, error: true, loaded: false, components: [], incidents: [] };
  }
};

const onToggle = (p) => {
  // Collapsible flips openState via v-model; this fires on the same click, so
  // a falsy current value means we're opening.
  if (!openState[p.id]) {
    trackEvent('Section', 'ExpandProvider', `ServiceStatus:${p.id}`);
    loadDetail(p.id);
  }
};

const refresh = () => {
  trackEvent('Section', 'RefreshClick', 'ServiceStatus');
  // Collapse any open cards (mirrors IPCard / WebRTC refresh behavior) and drop
  // cached detail so a reopened card refetches the fresh snapshot.
  for (const k of Object.keys(openState)) openState[k] = false;
  for (const k of Object.keys(detailState)) delete detailState[k];
  loadOverview();
};

onMounted(() => {
  loadOverview();
});
</script>

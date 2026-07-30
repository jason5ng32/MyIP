<template>
  <!-- IP Infos -->
  <section class="ip-data-section mb-10 mt-2">
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <h2 id="IPInfo"
        class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
        🔦 {{ t('ipInfos.Title') }}
      </h2>
      <div class="text-base text-muted-foreground">
        <p v-if="!isSimpleMode">{{ t('ipInfos.Notes') }}</p>
      </div>
    </header>

    <!-- Card grid: 1 col on mobile, always 2 cols on PC (md+). Card counts
        (2 / 4 / 6) are all even, so the last row always fills. -->
    <div class="grid gap-4 items-stretch grid-cols-1 md:grid-cols-2">
      <div v-for="(card, index) in ipDataCards.slice(0, ipCardsToShow)" :key="card.id" :ref="card.id"
        :id="'IPInfoCard-' + (index + 1)" class="flex"
        :class="{ 'opacity-60': !card.ip || card.ip === t('ipInfos.IPv4Error') || card.ip === t('ipInfos.IPv6Error') }">
        <IPCard class="w-full" :card="card" :index="index" :isDarkMode="isDarkMode" :isMobile="isMobile"
          :ipGeoSource="ipGeoSource" :configs="configs" :asnInfos="asnInfos" :asnHistoryInfos="asnHistoryInfos"
          :asnConnectivityInfos="asnConnectivityInfos" @refresh-card="refreshCard" />
      </div>
    </div>
  </section>
</template>


<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { isValidIP } from '@/utils/valid-ip.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { getIPFromIPIP, getIPFromCloudflare_V4, getIPFromCloudflare_V6, getIPFromIPChecking64, getIPFromIPChecking4, getIPFromIPChecking6 } from '@/utils/getips';
import { emitAppEvent } from '@/utils/app-events';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import IPCard from './ip-infos/IPCard.vue';


const { t } = useI18n();

// Store
const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const lang = computed(() => store.lang);
const isSimpleMode = computed(() => userPreferences.value.simpleMode);

// Default card data
const createDefaultCard = () => ({
  ip: "",
  country_name: "",
  region: "",
  city: "",
  latitude: "",
  longitude: "",
  isp: "",
  asn: "",
  asnlink: "",
  mapUrl: '/res/defaultMap.webp',
  mapUrl_dark: '/res/defaultMap_dark.webp',
});

// IP data cards
// Order: v4, v6, CF-v4, CF-v6, CN, v64
// First 2 / 4 / 6 slice is meaningful at every count the user can pick.
const ipDataCards = reactive([
  {
    ...createDefaultCard(),
    id: "ipchecking_v4",
    source: "IPCheck.ing IPv4",
  },
  {
    ...createDefaultCard(),
    id: "ipchecking_v6",
    source: "IPCheck.ing IPv6",
  },
  {
    ...createDefaultCard(),
    id: "cloudflare_v4",
    source: "Cloudflare IPv4",
  },
  {
    ...createDefaultCard(),
    id: "cloudflare_v6",
    source: "Cloudflare IPv6",
  },
  {
    ...createDefaultCard(),
    id: "cnsource",
    source: "CN Source",
  },
  {
    ...createDefaultCard(),
    id: "ipchecking_v64",
    source: "IPCheck.ing IPv6/4",
  },
]);

// Default ASN information
const asnInfos = ref({
  "AS888888": {
    "asnName": "Google", "asnOrgName": "GOGL-ARIN", "estimatedUsers": "888888", "IPv4_Pct": "95.35", "IPv6_Pct": "4.65", "HTTP_Pct": "3.16", "HTTPS_Pct": "96.84", "Desktop_Pct": "58.88", "Mobile_Pct": "41.12", "Bot_Pct": "98.46", "Human_Pct": "1.54"
  }
});

// ASN routing history (RIPEstat), keyed by BGP-floor prefix (/24 v4, /48 v6).
// Session cache — wipes on reload.
const asnHistoryInfos = ref({});

// ASN upstream connectivity graph, keyed by numeric ASN string. Session cache.
const asnConnectivityInfos = ref({});

// Other data
const ipCardsToShow = ref(userPreferences.value.ipCardsToShow);
const IPArray = ref([]);
const ipGeoSource = ref(userPreferences.value.ipGeoSource);
const usingSource = ref(userPreferences.value.ipGeoSource);
const fetchStatus = reactive([]);

// Middleware
let pendingIPDetailsRequests = new Map();
let ipDataCache = new Map();

// Each card is an independent pipeline: resolveIP paints the IP the moment it
// resolves, then loadCardDetails fills in its geo data. fetchIP chains the two
// for one card; checkAllIPs and refreshCard both drive cards through fetchIP, so
// a slow or failing source only ever delays its own card — never the others.

// Settle a card's fetch status — drives the global IPInfo loading indicator.
const markFetched = (cardID) => {
  fetchStatus[cardID] = { [cardID]: true };
  trackFetchStatus(fetchStatus);
};

// Stable source slugs by card ID, used in the ip-source:exhausted domain
// event (function names would be mangled by minification). Order matches the
// ipSources table in checkAllIPs.
const CARD_SOURCE_SLUGS = [
  'ipchecking-v4',
  'ipchecking-v6',
  'cloudflare-v4',
  'cloudflare-v6',
  'ipip',
  'ipchecking-64',
];

// Phase 1 — resolve one card's IP and render it immediately.
const resolveIP = async (cardID, getFromSource) => {
  let ip = null;
  let source = null;
  try {
    ({ ip, source } = await getFromSource(configs.value.originalSite));
  } catch (error) {
    // getips helpers shouldn't throw, but one must not sink the parallel batch.
    console.error('Error resolving IP for card ' + cardID + ':', error);
  }
  if (ip !== null) {
    ipDataCards[cardID].ip = ip;
    ipDataCards[cardID].source = source;
    // Record the IP now for the Globalping picker; country back-filled later.
    IPArray.value = [...IPArray.value, { ip, country: '' }];
  } else {
    // v6 cards: ipchecking_v6 (1), cloudflare_v6 (3).
    const isV6Card = cardID === 1 || cardID === 3;
    ipDataCards[cardID].ip = isV6Card
      ? t('ipInfos.IPv6Error')
      : t('ipInfos.IPv4Error');
    // Domain event: this source AND all its internal fallbacks failed to
    // produce an IP. Emitted unconditionally (bus semantics); subscribers
    // decide what matters — sentry-init.js gates exhaustion on evidence the
    // visitor's network works for that IP version (some card resolved one).
    emitAppEvent('ip-source:exhausted', {
      source: CARD_SOURCE_SLUGS[cardID] ?? `card-${cardID}`,
      ipVersion: isV6Card ? 'v6' : 'v4',
    });
    markFetched(cardID); // no IP → no detail phase
  }
  return { cardID, ip };
};

// Phase 2 — geo details for a resolved IP. finally-settles so a fully-failed
// card still clears the loading indicator.
const loadCardDetails = async (cardID, ip) => {
  try {
    await fetchIPDetails(cardID, ip);
    const card = ipDataCards[cardID];
    if (card.country_code) {
      // Full detail entry for the Globalping picker + IP history.
      IPArray.value = [...IPArray.value, {
        ip,
        country: card.country_code,
        location: [card.country_name, card.city].filter(Boolean).join(' · '),
        asn: card.asn || '',
        org: card.isp || '',
      }];
    }
  } catch {
    // fetchIPDetails already logged; swallow so it can't reject the batch.
  } finally {
    markFetched(cardID);
  }
};

// Single-card path (refresh button).
const fetchIP = async (cardID, getFromSource) => {
  const { ip } = await resolveIP(cardID, getFromSource);
  if (ip !== null) await loadCardDetails(cardID, ip);
};

// Report data fetch status, and send to store
const trackFetchStatus = (status) => {
  let allHasFetched = true;
  for (let i = 0; i < ipCardsToShow.value; i++) {
    if (status[i] === undefined) {
      allHasFetched = false;
    } else {
      allHasFetched = allHasFetched && status[i][i];
    }
  }
  if (allHasFetched) {
    store.setLoadingStatus('IPInfo', true);
    // Domain event: full snapshot of the visible cards, re-emitted whenever a
    // card settles after this point (single-card refresh included). The report
    // collector normalizes it (drops cards whose ip slot holds an error label).
    emitAppEvent('ipinfo:finished', {
      cards: ipDataCards.slice(0, ipCardsToShow.value).map((card) => ({
        source: card.source,
        ip: card.ip,
        country_code: card.country_code,
        region: card.region,
        city: card.city,
        asn: card.asn,
        isp: card.isp,
        // IPCheck.ing-source enrichments (locale-free codes; absent on other
        // sources or when the field is sign-in-gated).
        proxyCode: card.proxyCode,
        ipTypeCode: card.ipTypeCode,
        isNativeIP: card.isNativeIP,
        qualityScore: card.qualityScore,
        proxyProtocol: card.proxyProtocol,
        proxyProvider: card.proxyProvider,
      })),
    });
  }
};

// Drive every card through its own resolve→detail pipeline, all in parallel.
// allSettled so one card can't sink the batch (fetchIP already swallows per-card
// errors — this is belt-and-suspenders). Cards paint independently as they land.
const checkAllIPs = async () => {
  const ipSources = [
    [0, getIPFromIPChecking4],
    [1, getIPFromIPChecking6],
    [2, getIPFromCloudflare_V4],
    [3, getIPFromCloudflare_V6],
    [4, getIPFromIPIP],
    [5, getIPFromIPChecking64],
  ].slice(0, ipCardsToShow.value);

  await Promise.allSettled(
    ipSources.map(([cardID, getFromSource]) => fetchIP(cardID, getFromSource))
  );
};

// Get IP details from IP address
const fetchIPDetails = async (cardIndex, ip, sourceID = null) => {
  sourceID = sourceID || ipGeoSource.value;
  const card = ipDataCards[cardIndex];
  card.ip = ip;
  let setLang = lang.value;
  if (setLang === 'zh') {
    setLang = 'zh-CN';
  }

  // Check if the IP data is already in the cache
  if (ipDataCache.has(ip)) {
    const cachedData = ipDataCache.get(ip);
    Object.assign(card, cachedData);
    return;
  }

  // Check if there is a query in progress, if so, wait for it to complete
  if (pendingIPDetailsRequests.has(ip)) {
    await pendingIPDetailsRequests.get(ip);
    const cachedData = ipDataCache.get(ip);
    if (cachedData) {
      Object.assign(card, cachedData);
    }
    return;
  }

  const fetchPromise = (async () => {
    const sources = store.ipDBs.filter(source => source.enabled);

    // The requested source may be absent from the enabled list (config flag
    // off, or configs not loaded yet); findIndex yields -1 — start from 0.
    let currentSourceIndex = sourceID !== null ? sources.findIndex(source => source.id === sourceID) : 0;
    if (currentSourceIndex === -1) currentSourceIndex = 0;
    let attempts = 0;

    while (attempts < sources.length) {
      const source = sources[currentSourceIndex];
      try {
        const url = store.getDbUrl(source.id, ip, setLang);
        const response = await authenticatedFetch(url);
        const cardData = transformDataFromIPapi(response, source.id, t, lang.value);

        if (cardData) {
          // Fallback landed off the requested source: toast once (parallel
          // cards dedupe via usingSource), drift the runtime refs, but never
          // rewrite the user's stored preference.
          if (source.id !== sourceID && usingSource.value !== source.id) {
            const from = store.ipDBs.find(db => db.id === sourceID)?.text || `#${sourceID}`;
            store.setAlert(true, 'text-warning',
              t('alert.IpGeoSourceFallbackMessage', { from, to: source.text }),
              t('alert.IpGeoSourceFallbackTitle'), 5000);
          }
          ipGeoSource.value = source.id;
          usingSource.value = source.id;
          Object.assign(card, cardData);
          ipDataCache.set(ip, cardData);
          return;
        }
      } catch (error) {
        console.error("Error fetching IP details from source " + source.id + ":", error);
        currentSourceIndex = (currentSourceIndex + 1) % sources.length;
        attempts++;
      }
    }

    throw new Error("All sources failed to fetch IP details for IP: " + ip);
  })();

  // Store this Promise in pendingIPDetailsRequests to avoid duplicate queries
  pendingIPDetailsRequests.set(ip, fetchPromise);

  try {
    await fetchPromise;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    // After completion, remove from pendingIPDetailsRequests
    pendingIPDetailsRequests.delete(ip);
  }
};

// Re-fetch geo details for every card when the user picks a new IP database.
// Each card queries independently in parallel — no probe — so a slow or failing
// card never blocks the rest.
const selectIPGeoSource = async () => {
  // Clear stale detail fields, keep IP + map.
  ipDataCards.forEach((card) => {
    const { ip, mapUrl, mapUrl_dark } = card;
    Object.assign(card, createDefaultCard(), { ip, mapUrl, mapUrl_dark });
  });
  ipDataCache.clear();

  // Query every card that holds a valid IP against the chosen source, in
  // parallel. Captured once so an in-flight fetchIPDetails mutating
  // ipGeoSource.value can't shift the source mid-batch.
  const chosenSource = ipGeoSource.value;
  await Promise.allSettled(
    ipDataCards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => isValidIP(card.ip))
      .map(({ card, index }) => fetchIPDetails(index, card.ip, chosenSource))
  );
};

// Refresh a card
const refreshCard = (card, index) => {
  clearCardData(card);
  switch (index) {
    case 0:
      fetchIP(0, getIPFromIPChecking4);
      break;
    case 1:
      fetchIP(1, getIPFromIPChecking6);
      break;
    case 2:
      fetchIP(2, getIPFromCloudflare_V4);
      break;
    case 3:
      fetchIP(3, getIPFromCloudflare_V6);
      break;
    case 4:
      fetchIP(4, getIPFromIPIP);
      break;
    case 5:
      fetchIP(5, getIPFromIPChecking64);
      break;
    default:
      console.error("Undefind Source:");
  }
  trackEvent('IPCheck', 'RefreshClick', 'IPInfos');
};

// Clear card data
const clearCardData = (card) => {
  Object.assign(card, createDefaultCard());
};

watch(() => userPreferences.value.ipGeoSource, (newVal, oldVal) => {
  ipGeoSource.value = newVal;
  if (newVal !== usingSource.value) {
    selectIPGeoSource();
  }
});


watch(IPArray, () => {
  store.updateAllIPs(IPArray.value);
});

onMounted(() => {
  store.setMountingStatus('IPInfo', true);
});

defineExpose({
  checkAllIPs,
  ipDataCards,
  refreshCard,
});

</script>

<style scoped></style>
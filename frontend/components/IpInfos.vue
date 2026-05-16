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
          :ipGeoSource="ipGeoSource"
          :configs="configs" :asnInfos="asnInfos" :asnHistoryInfos="asnHistoryInfos"
          :asnConnectivityInfos="asnConnectivityInfos" @refresh-card="refreshCard" />
      </div>
    </div>
  </section>
</template>


<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { isValidIP } from '@/utils/valid-ip.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { getIPFromIPIP, getIPFromCloudflare_V4, getIPFromCloudflare_V6, getIPFromIPChecking64, getIPFromIPChecking4, getIPFromIPChecking6 } from '@/utils/getips';
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

// Shared method to get IP address
const fetchIP = async (cardID, getFromSource) => {
  const { ip, source } = await getFromSource(configs.value.originalSite);
  let fetchingStatus = false;
  if (ip !== null) {
    ipDataCards[cardID].ip = ip;
    ipDataCards[cardID].source = source;
    IPArray.value = [...IPArray.value, ip];
    await fetchIPDetails(cardID, ip);
  } else if (cardID === 1 || cardID === 3) {
    // v6 cards in the new order: ipchecking_v6 (1), cloudflare_v6 (3)
    ipDataCards[cardID].ip = t('ipInfos.IPv6Error');
  } else {
    ipDataCards[cardID].ip = t('ipInfos.IPv4Error');
  }
  // Always return true, even if fetching IP fails
  // for tracking fetch status
  fetchingStatus = true;
  fetchStatus[cardID] = { [cardID]: fetchingStatus };
  trackFetchStatus(fetchStatus);
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
    store.setLoadingStatus('ipcheck', true);
  }
};

// Check all IP addresses
const checkAllIPs = async () => {
  const ipFunctions = [
    () => fetchIP(0, getIPFromIPChecking4),
    () => fetchIP(1, getIPFromIPChecking6),
    () => fetchIP(2, getIPFromCloudflare_V4),
    () => fetchIP(3, getIPFromCloudflare_V6),
    () => fetchIP(4, getIPFromIPIP),
    () => fetchIP(5, getIPFromIPChecking64),
  ];

  // Limit the number of functions to execute to the length of ipCardsToShow
  const maxIndex = ipCardsToShow.value;

  let index = 0;
  const interval = setInterval(() => {
    if (index < maxIndex && index < ipFunctions.length) {
      ipFunctions[index].call(this);
      index++;
    } else {
      clearInterval(interval);
    }
  }, 500);
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

    let currentSourceIndex = sourceID !== null ? sources.findIndex(source => source.id === sourceID) : 0;
    let attempts = 0;

    while (attempts < sources.length) {
      const source = sources[currentSourceIndex];
      try {
        const url = store.getDbUrl(source.id, ip, setLang);
        const response = await authenticatedFetch(url);
        const cardData = transformDataFromIPapi(response, source.id, t, lang.value);

        if (cardData) {
          ipGeoSource.value = source.id;
          usingSource.value = source.id;
          store.updatePreference('ipGeoSource', source.id);
          Object.assign(card, cardData);
          ipDataCache.set(ip, cardData);
          return;
        }
      } catch (error) {
        console.error("Error fetching IP details from source " + source.id + ":", error);
        store.updateIPDBs({ id: source.id, enabled: false });
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

// When the IP database source is reselected, update the IP geographic data
const selectIPGeoSource = () => {
  // Clear partial data
  ipDataCards.forEach((card) => {
    const { ip, mapUrl, mapUrl_dark } = card;
    Object.assign(card, createDefaultCard(), { ip, mapUrl, mapUrl_dark });
  });

  ipDataCache.clear();

  // Try to update once, then get other IP data
  let runningSource = fetchIPDetails(0, ipDataCards[0].ip, ipGeoSource.value);

  // Re-fetch IP data
  let index = 1;
  const interval = setInterval(() => {
    if (index < ipDataCards.length) {
      const card = ipDataCards[index];
      if (isValidIP(card.ip)) {
        fetchIPDetails(index, card.ip, parseInt(runningSource));
      }
      index++;
    } else {
      clearInterval(interval);
    }
  }, 500);
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
  store.setMountingStatus('ipcheck', true);
});

defineExpose({
  checkAllIPs,
  ipDataCards,
  refreshCard,
});

</script>

<style scoped></style>
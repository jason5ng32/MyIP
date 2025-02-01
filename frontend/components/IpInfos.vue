<template>
  <!-- IP Infos -->
  <div class="ip-data-section mb-4 mt-4">
    <div class="jn-title2">
      <h2 id="IPInfo" class="col-4" :class="{ 'mobile-h2': isMobile }">🔎 {{ t('ipInfos.Title') }}</h2>
    </div>
    <div class="text-secondary">
      <p>{{ t('ipInfos.Notes') }}</p>
    </div>
    <div class="row">
      <div v-for="(card, index) in ipDataCards.slice(0, ipCardsToShow)" :key="card.id" :ref="card.id" :class="[colClass, {
        'jn-opacity': !card.ip || card.ip === t('ipInfos.IPv4Error') || card.ip === t('ipInfos.IPv6Error')
      }]">
        <IPCard :card="card" :index="index" :isDarkMode="isDarkMode" :isMobile="isMobile" :ipGeoSource="ipGeoSource"
          :isMapShown="isMapShown" :isCardsCollapsed="isCardsCollapsed" :copiedStatus="copiedStatus" :configs="configs"
          :asnInfos="asnInfos" @refresh-card="refreshCard" />
      </div>
    </div>
  </div>
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

// 页面的动态配置
const isMapShown = computed(() => userPreferences.value.showMap);
const isCardsCollapsed = computed(() => userPreferences.value.simpleMode);

// 创建样式
const colClass = computed(() => {
  const numCards = ipCardsToShow.value;
  if (numCards > 0) {
    // 保证每行不超过三个卡片
    const colSize = numCards > 3 ? 4 : Math.floor(12 / numCards);
    return `col-xl-${colSize} col-md-${colSize}  mb-4`;
  }
  return 'col-xl-4 col-lg-6 col-md-6 mb-4'; // 默认情况
});

// 默认卡片数据
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

// IP 数据卡片
const ipDataCards = reactive([
  {
    ...createDefaultCard(),
    id: "cnsource",
    source: "CN Source",
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
    id: "ipchecking_v64",
    source: "IPCheck.ing IPv6/4",
  },
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
]);

// 默认 ASN 信息
const asnInfos = ref({
  "AS888888": {
    "asnName": "Google", "asnOrgName": "GOGL-ARIN", "estimatedUsers": "888888", "IPv4_Pct": "95.35", "IPv6_Pct": "4.65", "HTTP_Pct": "3.16", "HTTPS_Pct": "96.84", "Desktop_Pct": "58.88", "Mobile_Pct": "41.12", "Bot_Pct": "98.46", "Human_Pct": "1.54"
  }
});

// 其它数据
const ipCardsToShow = ref(userPreferences.value.ipCardsToShow);
const copiedStatus = ref({});
const IPArray = ref([]);
const ipGeoSource = ref(userPreferences.value.ipGeoSource);
const usingSource = ref(userPreferences.value.ipGeoSource);
const fetchStatus = reactive([]);

// 中间件
let pendingIPDetailsRequests = new Map();
let ipDataCache = new Map();

// 公共获取 IP 地址方法
const fetchIP = async (cardID, getFromSource) => {
  const { ip, source } = await getFromSource(configs.value.originalSite);
  let fetchingStatus = false;
  if (ip !== null) {
    ipDataCards[cardID].ip = ip;
    ipDataCards[cardID].source = source;
    IPArray.value = [...IPArray.value, ip];
    await fetchIPDetails(cardID, ip);
  } else if (cardID === 2 || cardID === 5) {
    ipDataCards[cardID].ip = t('ipInfos.IPv6Error');
  } else {
    ipDataCards[cardID].ip = t('ipInfos.IPv4Error');
  }
  // 总是返回 true，即使获取 IP 失败，以便在 trackFetchStatus 中记录
  fetchingStatus = true;
  fetchStatus[cardID] = { [cardID]: fetchingStatus };
  trackFetchStatus(fetchStatus);
};

// 上报数据获取状态，并发送到 store
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

// 检查所有 IP 地址
const checkAllIPs = async () => {
  const ipFunctions = [
    () => fetchIP(0, getIPFromIPIP),
    () => fetchIP(1, getIPFromCloudflare_V4),
    () => fetchIP(2, getIPFromCloudflare_V6),
    () => fetchIP(3, getIPFromIPChecking64),
    () => fetchIP(4, getIPFromIPChecking4),
    () => fetchIP(5, getIPFromIPChecking6),
  ];

  // 限制执行的函数数量为 ipCardsToShow 的长度
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

// 从 IP 地址获取 IP 详细信息
const fetchIPDetails = async (cardIndex, ip, sourceID = null) => {
  sourceID = sourceID || ipGeoSource.value;
  const card = ipDataCards[cardIndex];
  card.ip = ip;
  let setLang = lang.value;
  if (setLang === 'zh') {
    setLang = 'zh-CN';
  }

  // 检查缓存中是否已有该 IP 的数据
  if (ipDataCache.has(ip)) {
    const cachedData = ipDataCache.get(ip);
    Object.assign(card, cachedData);
    return;
  }

  // 检查是否有正在进行的查询，如果有，则等待该查询完成
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

  // 将此 Promise 存储在 pendingIPDetailsRequests 中，以避免重复查询
  pendingIPDetailsRequests.set(ip, fetchPromise);

  try {
    await fetchPromise;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    // 完成后，从 pendingIPDetailsRequests 中移除
    pendingIPDetailsRequests.delete(ip);
  }
};

// 在重新选择 IP 数据库源时，更新 IP 地理数据
const selectIPGeoSource = () => {
  // 清空部分数据
  ipDataCards.forEach((card) => {
    const { ip, mapUrl, mapUrl_dark } = card;
    Object.assign(card, createDefaultCard(), { ip, mapUrl, mapUrl_dark });
  });

  ipDataCache.clear();

  // 尝试更新一次，成功后再获取其他 IP 数据
  let runningSource = fetchIPDetails(0, ipDataCards[0].ip, ipGeoSource.value);

  // 重新获取 IP 数据
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

// 刷新某张卡片
const refreshCard = (card, index) => {
  clearCardData(card);
  switch (index) {
    case 0:
      fetchIP(0, getIPFromIPIP);
      break;
    case 1:
      fetchIP(1, getIPFromCloudflare_V4);
      break;
    case 2:
      fetchIP(2, getIPFromCloudflare_V6);
      break;
    case 3:
      fetchIP(3, getIPFromIPChecking64);
      break;
    case 4:
      fetchIP(4, getIPFromIPChecking4);
      break;
    case 5:
      fetchIP(5, getIPFromIPChecking6);
      break;
    default:
      console.error("Undefind Source:");
  }
  trackEvent('IPCheck', 'RefreshClick', 'IPInfos');
};

// 清空卡片数据
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

<style scoped>
</style>
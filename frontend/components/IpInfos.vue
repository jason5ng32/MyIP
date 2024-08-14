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
          <div class="card jn-card keyboard-shortcut-card" :class="{
            'dark-mode dark-mode-border': isDarkMode,
            'jn-ip-card1 jn-hover-card': !isMobile && ipGeoSource === 0,
            'jn-ip-card2 jn-hover-card': !isMobile && ipGeoSource !== 0,
          }">
            <div class="card-header jn-ip-title jn-link1"
              :class="{ 'dark-mode-title': isDarkMode, 'bg-light': !isDarkMode }" style="font-weight: bold;">
              <span>
                <i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                {{ t('ipInfos.Source') }}: {{ card.source }}</span>
              <button @click="refreshCard(card,index)"
                :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                :aria-label="'Refresh' + card.source" v-tooltip="t('Tooltips.RefreshIPCard')">
                <i class="bi bi-arrow-clockwise"></i></button>
            </div>
            <div class="p-3 placeholder-glow " :class="{
              'dark-mode-title': isDarkMode,
              'jn-link2-dark': isDarkMode,
              'bg-light': !isDarkMode,
              'jn-link2': !isDarkMode
            }">
              <span class="jn-text col-auto">
                <i class="bi bi-pc-display-horizontal"></i>&nbsp;
              </span>
              <span v-if="card.ip" class="col-10" :class="{ 'jn-ip-font': (isMobile && card.ip.length > 32) }">
                {{ card.ip }}&nbsp;
                <i v-if="isValidIP(card.ip)"
                  :class="copiedStatus[card.id] ? 'bi bi-clipboard-check-fill' : 'bi bi-clipboard-plus'"
                  @click="copyToClipboard(card.ip, card.id)" role="button"
                  v-tooltip="{ title: t('Tooltips.CopyIP'), placement: 'right' }" :aria-label="'Copy' + card.ip"></i>
              </span>
              <span v-else class="placeholder col-10"></span>
            </div>


            <div v-if="(card.asn) || (card.ip === t('ipInfos.IPv4Error')) || (card.ip === t('ipInfos.IPv6Error')) || card.ip === '2001:4860:4860::8888'
            " class="card-body" :id="'IPInfo-' + (index + 1)">
              <ul class="list-group list-group-flush" v-if="card.country_name">

                <img v-if="isMapShown" :src="isDarkMode ? card.mapUrl_dark : card.mapUrl"
                  class="card-img-top jn-map-image" alt="Map">

                <li class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode, 'mobile-list': isMobile && isCardsCollapsed }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-geo-alt-fill"></i> {{ t('ipInfos.Country') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.country_name }}
                    <span v-if="card.country_code" :class="'jn-fl fi fi-' + card.country_code.toLowerCase()"></span>
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-houses"></i>
                    {{ t('ipInfos.Region') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.region }}
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-sign-turn-right"></i>
                    {{ t('ipInfos.City') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.city }}
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-ethernet"></i>
                    {{ t('ipInfos.ISP') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.isp }}
                  </span>
                </li>

                <li
                  v-show="(!isMobile || !isCardsCollapsed) && ipGeoSource === 0 && card.type !== t('ipInfos.proxyDetect.type.unknownType')"
                  class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-reception-4"></i>
                    {{ t('ipInfos.type') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.type }}
                    <span v-if="card.proxyOperator !== 'unknown'">
                      ( {{ card.proxyOperator }} )
                    </span>
                  </span>
                </li>

                <li
                  v-show="(!isMobile || !isCardsCollapsed) && ipGeoSource === 0 && card.isProxy !== t('ipInfos.proxyDetect.unknownProxyType')"
                  class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-shield-fill-check"></i>
                    {{ t('ipInfos.isProxy') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.isProxy }}
                    <span v-if="card.proxyProtocol !== t('ipInfos.proxyDetect.unknownProtocol')">
                      ( {{ card.proxyProtocol }} )
                    </span>
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item border-0"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-buildings"></i>
                    {{ t('ipInfos.ASN') }} :&nbsp;
                  </span>
                  <span v-if="card.asnlink" class="col-9 ">
                    {{ card.asn }} <i v-if="configs.cloudFlare" class="bi bi-info-circle"
                      @click="getASNInfo(card.asn, index)" data-bs-toggle="collapse"
                      :data-bs-target="'#' + 'collapseASNInfo-' + index" aria-expanded="false"
                      :aria-controls="'collapseASNInfo-' + index" role="button"
                      :aria-label="'Display AS Info of' + card.asn"
                      v-tooltip="{ title: t('Tooltips.ShowASNInfo'), placement: 'right' }"></i>
                  </span>
                </li>

                <div class="collapse alert alert-light placeholder-glow lh-lg fw-bold p-0"
                  :id="'collapseASNInfo-' + index" :data-bs-theme="isDarkMode ? 'dark' : ''">

                  <!-- 通过将 collapse 的 padding 设置为 0，然后添加一个子 div 设置 padding 的方式，避免 Bootstrap 的 collapse 发生卡顿，很奇怪的 bug -->

                  <div class="p-3">
                    <span v-if="asnInfos[card.asn]">
                      <i class="bi bi-info-circle-fill"></i> <span class="fw-light">{{ t('ipInfos.ASNInfo.note')
                        }}</span>
                      <br />
                      <template v-for="(item,key) in asnInfos[card.asn]">
                        <span class="fw-light">
                          {{ t(`ipInfos.ASNInfo.${key}`) }}
                        </span>
                        {{ item }}
                        <br />
                      </template>
                    </span>

                    <span v-else>
                      <span v-for="(colSize, index) in placeholderSizes" :key="index"
                        :class="{ 'dark-mode': isDarkMode }">
                        <span :class="`placeholder col-${colSize}`"></span>
                      </span>
                    </span>
                  </div>
                </div>
              </ul>
            </div>

            <div v-else class="card-body">
              <ul class="list-group list-group-flush placeholder-glow">
                <li v-for="(colSize, index) in placeholderSizes" :key="index" class="list-group-item jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span :class="`placeholder col-${colSize}`"></span>
                </li>
              </ul>
            </div>

          </div>
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
import { getIPFromIPIP, getIPFromUpai, getIPFromCloudflare_V4, getIPFromCloudflare_V6, getIPFromGCR, getIPFromIpify_V4, getIPFromIpify_V6 } from '@/utils/getips';


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
const placeholderSizes = [12, 8, 6, 8, 4];
const colClass = computed(() => {
  const numCards = ipCardsToShow.value;
  if (numCards > 0) {
    // 保证每行不超过三个卡片
    const colSize = numCards > 3 ? 4 : Math.floor(12 / numCards);
    return `col-xl-${colSize} col-md-${colSize}  mb-4`;
  }
  return 'col-xl-4 col-lg-6 col-md-6 mb-4'; // 默认情况，如果计算出错或没有卡片显示
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
    id: "special",
    source: "Special",
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
    id: "ipify_v4",
    source: "IPify IPv4",
  },
  {
    ...createDefaultCard(),
    id: "ipify_v6",
    source: "IPify IPv6",
  },
]);

// 默认 ASN 信息
const asnInfos = ref({
  "AS15169": {
    "asnName": "Google", "asnOrgName": "GOGL-ARIN", "estimatedUsers": "368891", "IPv4_Pct": "95.35", "IPv6_Pct": "4.65", "HTTP_Pct": "3.16", "HTTPS_Pct": "96.84", "Desktop_Pct": "58.88", "Mobile_Pct": "41.12", "Bot_Pct": "98.46", "Human_Pct": "1.54"
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
  const { ip, source } = await getFromSource();
  let fetchingStatus = false;
  if (ip !== null) {
    ipDataCards[cardID].ip = ip;
    ipDataCards[cardID].source = source;
    IPArray.value = [...IPArray.value, ip];
    await fetchIPDetails(cardID, ip);
  } else if (cardID === 3 || cardID === 5) {
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
    () => fetchIP(1, configs.value.originalSite ? getIPFromGCR : getIPFromUpai),
    () => fetchIP(2, getIPFromCloudflare_V4),
    () => fetchIP(3, getIPFromCloudflare_V6),
    () => fetchIP(4, getIPFromIpify_V4),
    () => fetchIP(5, getIPFromIpify_V6),
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
        const response = await fetch(url);
        const data = await response.json();
        const cardData = transformDataFromIPapi(data, source.id, t, lang.value);

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
      fetchIP(1, configs.value.originalSite ? getIPFromGCR : getIPFromUpai);
      break;
    case 2:
      fetchIP(2, getIPFromCloudflare_V4);
      break;
    case 3:
      fetchIP(3, getIPFromCloudflare_V6);
      break;
    case 4:
      fetchIP(4, getIPFromIpify_V4);
      break;
    case 5:
      fetchIP(5, getIPFromIpify_V6);
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

// 复制 IP 地址
const copyToClipboard = (ip, id) => {
  navigator.clipboard.writeText(ip).then(() => {
    copiedStatus.value[id] = true;
    trackEvent('IPCheck', 'CopyClick', 'Copy IP');
    setTimeout(() => {
      copiedStatus.value[id] = false;
    }, 5000);
  }).catch(err => {
    console.error('Copy error', err);
  });
};

// 从后端 API 获取 ASN 信息
const getASNInfo = async (asn) => {
  trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
  try {
    // 如果 asnInfos 中已有该 ASN 的信息，则直接返回
    if (asnInfos.value[asn]) {
      return;
    }
    asn = asn.replace('AS', '');

    const response = await fetch(`/api/cfradar?asn=${asn}`);
    const data = await response.json();
    asnInfos.value['AS' + asn] = data;
  } catch (error) {
    console.error("Error fetching ASN info:", error);
  }
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
.jn-select {
  cursor: pointer;
  user-select: none;
}

.jn-link1 {
  position: relative;
}

.jn-link2::before {
  content: '';
  position: absolute;
  top: 34px;
  left: 24px;
  transform: translateX(-50%);
  height: 40px;
  width: 2px;
  border-left: 2px dashed #212529;
  z-index: 1;
}

.jn-link2-dark::before {
  content: '';
  position: absolute;
  top: 34px;
  left: 24px;
  transform: translateX(-50%);
  height: 40px;
  width: 2px;
  border-left: 2px dashed #e3e3e3;
  z-index: 1;
}

.dropdown-item.disabled,
.dropdown-item:disabled {
  text-decoration: line-through;
}
</style>
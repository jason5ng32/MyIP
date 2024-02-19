<template>
  <!-- IP Infos -->
  <div class="ip-data-section mb-4">
    <div class="row" :class="{ 'jn-title2': !isMobile, 'jn-title': isMobile }">
      <h2 id="IPInfo" class="col-4" :class="{ 'mobile-h2': isMobile }">🔎
        {{ $t('ipInfos.Title') }}</h2>
      <div class="form-check form-switch col-8 jn-radio">

        <div :class="{ 'col-4': isMobile }">
          <input v-if="isMobile" class="form-check-input" type="checkbox" id="collapseSwitch" @change="toggleCollapse"
            :checked="!isCardsCollapsed" @click="$trackEvent('IPCheck', 'ToggleClick', 'Collaspes');"
            aria-label="Toggle Card Display">
          <label v-if="isMobile" class="form-check-label" for="collapseSwitch">&nbsp;<i class="bi bi-list-columns-reverse"
              aria-hidden="true"></i></label>
        </div>

        <div>
          <input class="form-check-input" type="checkbox" role="switch" id="toggleMapSwitch" @change="toggleMaps"
            aria-label="Toggle Map Display" :checked="isMapShown" :disabled="!isEnvBingMapKey"
            @click="$trackEvent('IPCheck', 'ToggleClick', 'ShowMap');">

          <label class="form-check-label" for="toggleMapSwitch">
            <i :class="['bi', isEnvBingMapKey ? 'bi bi-map-fill' : 'bi bi-map']" aria-hidden="true"></i>
          </label>
        </div>

        <!-- IP 数据源选择 -->
        <div class="dropdown">
          <span class="ms-3" role="button" id="SelectIPGEOSource" data-bs-toggle="dropdown" aria-expanded="false"
            :aria-label="$t('ipInfos.SelectSource')">
            <i class="bi bi-grid-fill"></i>
          </span>
          <ul class="dropdown-menu" aria-labelledby="SelectIPGEOSource" :data-bs-theme="isDarkMode ? 'dark' : ''">
            <li class="dropdown-header">
              {{ $t('ipInfos.SelectSource') }}
            </li>
            <li>
              <hr class="dropdown-divider">
            </li>
            <li v-for="source in sources" :key="source.id">
              <span class="dropdown-item jn-select"
                :class="{ active: ipGeoSource === source.id, disabled: !source.enabled }"
                @click="source.enabled ? selectIPGeoSource(source.id) : null" :disabled="!source.enabled"
                :aria-disabled="!source.enabled" :aria-label="source.text">
                {{ source.text }}
                <i class="bi bi-check2-circle" v-if="ipGeoSource === source.id"></i>
              </span>
            </li>
          </ul>
        </div>



      </div>
    </div>
    <div class="text-secondary">
      <p>{{ $t('ipInfos.Notes') }}</p>
    </div>
    <div class="jn-card-deck">
      <div class="row">
        <div v-for="(card, index) in ipDataCards" :key="card.id" :ref="card.id"
          :class="{ 'jn-opacity': !card.asn, 'col-xl-4': true, 'col-lg-6': true, 'col-md-6': true, 'mb-4': true }">
          <div class="card" :class="{
            'dark-mode dark-mode-border': isDarkMode,
            'jn-ip-card': !isMobile,
            'jn-card': isMobile,
          }">
            <div class="card-header jn-ip-title jn-link1"
              :class="{ 'dark-mode-title': isDarkMode, 'bg-light': !isDarkMode }" style="font-weight: bold;">
              <span>
                <i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                {{ $t('ipInfos.Source') }}: {{ card.source }}</span>
              <button @click="refreshCard(card)" :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                :aria-label="'Refresh' + card.source">
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
              <span v-if="(card.asn) || (card.ip === $t('ipInfos.IPv4Error')) || (card.ip === $t('ipInfos.IPv6Error'))"
                class="col-10" :class="{ 'jn-ip-font': (isMobile && card.ip.length > 32) }">
                {{ card.ip }}&nbsp;
                <i v-if="isValidIP(card.ip)"
                  :class="copiedStatus[card.id] ? 'bi bi-clipboard-check-fill' : 'bi bi-clipboard-plus'"
                  @click="copyToClipboard(card.ip, card.id)"></i>
              </span>
              <span v-else class="placeholder col-10"></span>
            </div>


            <div v-if="(card.asn) || (card.ip === $t('ipInfos.IPv4Error')) || (card.ip === $t('ipInfos.IPv6Error'))
              " class="card-body" :id="'IPInfo-' + (index + 1)">
              <ul class="list-group list-group-flush" v-if="card.country_name">

                <img v-if="isMapShown" :src="isDarkMode ? card.mapUrl_dark : card.mapUrl"
                  class="card-img-top jn-map-image" alt="Map">

                <li class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode, 'mobile-list': isMobile && isCardsCollapsed }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-geo-alt-fill"></i> {{ $t('ipInfos.Country') }} :&nbsp;
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
                    {{ $t('ipInfos.Region') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.region }}
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-sign-turn-right"></i>
                    {{ $t('ipInfos.City') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.city }}
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-ethernet"></i>
                    {{ $t('ipInfos.ISP') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.isp }}
                  </span>
                </li>

                <li
                  v-show="(!isMobile || !isCardsCollapsed) && ipGeoSource === 0 && card.type !== $t('ipInfos.proxyDetect.type.unknownType')"
                  class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-reception-4"></i>
                    {{ $t('ipInfos.type') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.type }}
                  </span>
                </li>

                <li
                  v-show="(!isMobile || !isCardsCollapsed) && ipGeoSource === 0 && card.isProxy !== $t('ipInfos.proxyDetect.unknownProxyType')"
                  class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-shield-fill-check"></i>
                    {{ $t('ipInfos.isProxy') }} :&nbsp;
                  </span>
                  <span class="col-10 ">
                    {{ card.isProxy }}
                    <span v-if="card.proxyProtocol !== $t('ipInfos.proxyDetect.unknownProtocol')">
                      ( {{ card.proxyProtocol }} )
                    </span>
                  </span>
                </li>

                <li v-show="!isMobile || !isCardsCollapsed" class="jn-list-group-item border-0"
                  :class="{ 'dark-mode': isDarkMode }">
                  <span class="jn-text col-auto">
                    <i class="bi bi-buildings"></i>
                    {{ $t('ipInfos.ASN') }} :&nbsp;
                  </span>
                  <span v-if="card.asnlink" class="col-9 ">
                    {{ card.asn }} <i class="bi bi-info-circle" @click="getASNInfo(card.asn, index)"
                      data-bs-toggle="collapse" :data-bs-target="'#' + 'collapseASNInfo-' + index" aria-expanded="false"
                      :aria-controls="'collapseASNInfo-' + index" role="button"
                      :aria-label="'Display AS Info of' + card.asn"></i>
                  </span>
                </li>

                <div class="collapse alert alert-light placeholder-glow lh-lg fw-bold p-0"
                  :id="'collapseASNInfo-' + index" :data-bs-theme="isDarkMode ? 'dark' : ''">

                  <!-- 通过将 collapse 的 padding 设置为 0，然后添加一个子 div 设置 padding 的方式，避免 Bootstrap 的 collapse 发生卡顿，很奇怪的 bug -->

                  <div class="p-3">
                    <span v-if="asnInfos[card.asn]">
                      <i class="bi bi-info-circle-fill"></i> <span class="fw-light">{{ $t('ipInfos.ASNInfo.note')
                      }}</span>
                      <br />
                      <template v-for="item in asnInfoItems">
                        <span class="fw-light">
                          {{ $t(`ipInfos.ASNInfo.${item.key}`) }}
                        </span>
                        {{ item.format(asnInfos[card.asn][item.key]) }}
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
  </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'IPCheck',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);
    const ipGeoSource = computed(() => store.state.ipGeoSource);

    return {
      isDarkMode,
      isMobile,
      ipGeoSource,
    };
  },

  data() {
    return {
      asnInfos: {
        "AS15169": {
          "asnName": "Google",
          "asnOrgName": "GOGL-ARIN",
          "estimatedUsers": "368891",
          "IPv4_Pct": "95.35",
          "IPv6_Pct": "4.65",
          "HTTP_Pct": "3.16",
          "HTTPS_Pct": "96.84",
          "Desktop_Pct": "58.88",
          "Mobile_Pct": "41.12",
          "Bot_Pct": "98.46",
          "Human_Pct": "1.54"
        }
      },
      asnInfoItems: [
        { key: 'asnName', format: value => value },
        { key: 'asnOrgName', format: value => value },
        { key: 'estimatedUsers', format: value => parseFloat(value).toLocaleString() },
        { key: 'IPv4_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'IPv6_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'HTTP_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'HTTPS_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'Desktop_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'Mobile_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'Bot_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
        { key: 'Human_Pct', format: value => `${parseFloat(value).toFixed(2)}%` },
      ],
      isCardsCollapsed: JSON.parse(localStorage.getItem('isCardsCollapsed')) || false,
      placeholderSizes: [12, 8, 6, 8, 4],
      sources: [
        { id: 0, text: 'IPCheck.ing', enabled: true },
        { id: 1, text: 'IP.SB', enabled: true },
        { id: 2, text: 'IPinfo.io', enabled: true },
        { id: 3, text: 'IP-API.com', enabled: true },
        { id: 4, text: 'IPAPI.co', enabled: true },
        { id: 5, text: 'KeyCDN', enabled: true },
      ],
      ipDataCards: [
        {
          id: "taobao",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.jpg',
          mapUrl_dark: '/defaultMap_dark.jpg',
          showMap: false,
          source: "TaoBao",
          showASNInfo: false,
        },
        {
          id: "special",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.jpg',
          mapUrl_dark: '/defaultMap_dark.jpg',
          showMap: false,
          source: "Special",
          showASNInfo: false,
        },
        {
          id: "cloudflare_v4",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.jpg',
          mapUrl_dark: '/defaultMap_dark.jpg',
          showMap: false,
          source: "Cloudflare IPv4",
          showASNInfo: false,
        },
        {
          id: "cloudflare_v6",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.jpg',
          mapUrl_dark: '/defaultMap_dark.jpg',
          showMap: false,
          source: "Cloudflare IPv6",
          showASNInfo: false,
        },
        {
          id: "ipify_v4",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.jpg',
          mapUrl_dark: '/defaultMap_dark.jpg',
          showMap: false,
          source: "IPify IPv4",
          showASNInfo: false,
        },
        {
          id: "ipify_v6",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.jpg',
          mapUrl_dark: '/defaultMap_dark.jpg',
          showMap: false,
          source: "IPify IPv6",
          showASNInfo: false,
        },
      ],
      isEnvBingMapKey: false,
      isMapShown: false,
      ipDataCache: new Map(),
      copiedStatus: {},
      bingMapLanguage: this.$Lang,
    };
  },

  methods: {

    // 检查 IP 地址是否合法
    isValidIP(ip) {
      const ipv4Pattern =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Pattern =
        /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;
      return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
    },

    // 切换地图显示
    toggleMaps() {
      this.isMapShown = !this.isMapShown;
      this.ipDataCards.forEach((card) => {
        card.showMap = this.isMapShown;
      });
    },

    // 切换卡片折叠
    toggleCollapse() {
      this.isCardsCollapsed = !this.isCardsCollapsed;
    },

    // 验证 Bing Map Key
    validateBingMapKey() {
      fetch('/api/validate-map-key')
        .then(response => response.json())
        .then(data => {
          this.isEnvBingMapKey = data.isValid;
          if (!this.isEnvBingMapKey) {
            this.isMapShown = false;
          } else if (localStorage.getItem("isMapShown")) {
            this.isMapShown = localStorage.getItem("isMapShown") === "true";
          }
        })
        .catch(error => {
          console.error('Error validating Bing Map Key:', error);
          this.isEnvBingMapKey = false;
          this.isMapShown = false;
        });
    },

    // 从淘宝获取 IP 地址
    getIPFromTaobao() {
      window.ipCallback = (data) => {
        var ip = data.ip;
        this.ipDataCards[0].source = "TaoBao";
        this.fetchIPDetails(0, ip, this.ipGeoSource);
        delete window.ipCallback;
      };
      var script = document.createElement("script");
      script.src = "https://www.taobao.com/help/getip.php?callback=ipCallback";
      document.head.appendChild(script);
      document.head.removeChild(script);
    },

    // 从特殊源获取 IP 地址
    async getIPFromSpecial() {
      try {
        const response = await fetch('/api/validate-site');
        const data = await response.json();
        // 将 data.isIpCheckEnabled 写入到 vuex 的 Global_siteValidate 中
        this.$store.commit('updateGlobalSiteValidate', data.isIpCheckEnabled);
        if (data.isIpCheckEnabled) {
          await this.getIPFromGCR();
        } else {
          await this.getIPFromUpai();
        }
      } catch (error) {
        console.error("Error in getIPFromSpecial:", error);
      }
    },

    // 从 Upai 获取 IP 地址
    async getIPFromUpai() {
      try {
        const unixTime = Date.now();
        const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${unixTime}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        const ip = data.remote_addr;
        this.ipDataCards[1].source = "Upai";
        this.fetchIPDetails(1, ip, this.ipGeoSource);
      } catch (error) {
        console.error("Error fetching IP from Upai:", error);
        this.ipDataCards[1].ip = this.$t('ipInfos.IPv4Error');
      }
    },

    // 从 GCR 获取 IP 地址
    async getIPFromGCR() {
      try {
        const url = `https://getipfromgoogle.ipcheck.ing/`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        const fullIp = data.ip;
        const ip = fullIp.includes(',') ? fullIp.split(',')[0] : fullIp;
        this.ipDataCards[1].source = "IPCheck.ing";
        this.fetchIPDetails(1, ip, this.ipGeoSource);
      } catch (error) {
        console.error("Error fetching IP from IPCheck.ing:", error);
        this.getIPFromUpai(); // 如果发生错误，调用 getIPFromUpai
      }
    },

    // 从 Cloudflare 获取 IPv4 地址
    async getIPFromCloudflare_V4() {
      try {
        const response = await fetch("https://1.0.0.1/cdn-cgi/trace");
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        if (ipLine) {
          const ip = ipLine.split("=")[1];
          this.fetchIPDetails(2, ip, this.ipGeoSource);
        }
      } catch (error) {
        console.error("Error fetching IP from Cloudflare:", error);
        this.ipDataCards[2].ip = this.$t('ipInfos.IPv4Error');
      }
    },

    // 从 Cloudflare 获取 IPv6 地址
    async getIPFromCloudflare_V6() {
      try {
        const response = await fetch("https://[2606:4700:4700::1111]/cdn-cgi/trace");
        const data = await response.text();

        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        if (ipLine) {
          const ip = ipLine.split("=")[1];
          this.fetchIPDetails(3, ip, this.ipGeoSource);
        }
      } catch (error) {
        console.error("Error fetching IP from Cloudflare:", error);
        this.ipDataCards[3].ip = this.$t('ipInfos.IPv6Error');
      }
    },

    // 从 IPify 获取 IPv4 地址
    async getIPFromIpify_V4() {
      try {
        const response = await fetch("https://api4.ipify.org?format=json");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        this.fetchIPDetails(4, data.ip, this.ipGeoSource);
      } catch (error) {
        console.error("Error fetching IPv4 address from ipify:", error);
        this.ipDataCards[4].ip = this.$t('ipInfos.IPv4Error');
      }
    },

    // 从 IPify 获取 IPv6 地址
    async getIPFromIpify_V6() {
      try {
        const response = await fetch("https://api6.ipify.org?format=json");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        this.fetchIPDetails(5, data.ip, this.ipGeoSource);
      } catch (error) {
        console.error("Error fetching IPv6 address from ipify:", error);
        this.ipDataCards[5].ip = this.$t('ipInfos.IPv6Error');
      }
    },

    // 从 IP 地址获取 IP 详细信息
    async fetchIPDetails(cardIndex, ip, sourceID = null) {
      const card = this.ipDataCards[cardIndex];
      card.ip = ip;
      let lang = this.$Lang;
      if (lang === 'zh') {
        lang = 'zh-CN';
      };

      // 检查缓存中是否已有该 IP 的数据
      if (this.ipDataCache.has(ip)) {
        // 使用缓存的数据填充卡片
        const cachedData = this.ipDataCache.get(ip);
        Object.assign(card, cachedData);
        return;
      }

      // 不同的源
      const sources = [
        { id: 0, url: `/api/ipchecking?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
        { id: 1, url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
        { id: 2, url: `/api/ipsb?ip=${ip}`, transform: this.transformDataFromIPapi },
        { id: 3, url: `/api/ipapicom?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
        { id: 4, url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
        { id: 5, url: `api/keycdn?ip=${ip}`, transform: this.transformDataFromIPapi },
      ];

      let OrignalSourceID = sourceID;
      let retryCount = 0;

      // 根据指定的源获取数据
      for (const source of sources) {
        if (sourceID && source.id !== sourceID) {
          continue;
        }

        try {
          const response = await fetch(source.url);
          const data = await response.json();

          // 根据数据源进行数据转换
          const cardData = source.transform(data);

          if (cardData) {
            Object.assign(card, cardData);
            this.ipDataCache.set(ip, cardData);
            break;
          }
        } catch (error) {
          this.sources[OrignalSourceID].enabled = false;
          if (retryCount < 5) {
            if (OrignalSourceID === 5) {
              OrignalSourceID = 0;
            } else {
              OrignalSourceID++;
            }

            this.selectIPGeoSource(OrignalSourceID);

            retryCount++;
          } else {
            console.error("Error fetching IP details:", error);
          }
        }
      }
    },

    // 选择 IP 数据源，并保存到本地存储
    selectIPGeoSource(sourceID) {
      if (this.ipGeoSource === sourceID) {
        return;
      }
      this.$store.commit('SET_IP_GEO_SOURCE', sourceID);
      localStorage.setItem("ipGeoSource", parseInt(sourceID));
      this.$trackEvent('IPCheck', 'SelectSource', this.sources[sourceID].text);
      // 清空部分数据
      this.ipDataCards.forEach((card) => {
        card.country_name = "";
        card.region = "";
        card.city = "";
        card.latitude = "";
        card.longitude = "";
        card.isp = "";
        card.asn = "";
        card.asnlink = "";
      });

      this.ipDataCache.clear();

      // 重新获取 IP 数据
      let index = 0;
      const interval = setInterval(() => {
        if (index < this.ipDataCards.length) {
          const card = this.ipDataCards[index];
          if (this.isValidIP(card.ip)) {
            this.fetchIPDetails(index, card.ip, sourceID);
          }
          index++;
        } else {
          clearInterval(interval);
        }
      }, 350);
    },

    // 格式化 IP 数据
    transformDataFromIPapi(data) {
      if (data.error) {
        throw new Error(data.reason);
      }


      if (this.ipGeoSource === 0) {

        const proxyDetect = data.proxyDetect || {};

        const isProxy = proxyDetect.proxy === 'yes' ? this.$t('ipInfos.proxyDetect.yes') :
          proxyDetect.proxy === 'no' ? this.$t('ipInfos.proxyDetect.no') :
            this.$t('ipInfos.proxyDetect.unknownProxyType');

        const type = proxyDetect.type === 'Business' ? this.$t('ipInfos.proxyDetect.type.Business') :
          proxyDetect.type === 'Residential' ? this.$t('ipInfos.proxyDetect.type.Residential') :
            proxyDetect.type === 'Wireless' ? this.$t('ipInfos.proxyDetect.type.Wireless') :
              proxyDetect.type === 'Hosting' ? this.$t('ipInfos.proxyDetect.type.Hosting') :
                proxyDetect.type ? proxyDetect.type : this.$t('ipInfos.proxyDetect.type.unknownType');

        const proxyProtocol = proxyDetect.protocol === 'unknown' ? this.$t('ipInfos.proxyDetect.unknownProtocol') :
          proxyDetect.protocol ? proxyDetect.protocol : this.$t('ipInfos.proxyDetect.unknownProtocol');

        return {
          country_name: data.country_name || "",
          country_code: data.country || "",
          region: data.region || "",
          city: data.city || "",
          latitude: data.latitude || "",
          longitude: data.longitude || "",
          isp: data.org || "",
          asn: data.asn || "",
          asnlink: data.asn ? `https://radar.cloudflare.com/${data.asn}` : false,
          mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=CanvasLight` : "",
          mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=RoadDark` : "",
          isProxy: isProxy,
          type: type,
          proxyProtocol: proxyProtocol,
        };
      }

      return {
        country_name: data.country_name || "",
        country_code: data.country || "",
        region: data.region || "",
        city: data.city || "",
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        isp: data.org || "",
        asn: data.asn || "",
        asnlink: data.asn ? `https://radar.cloudflare.com/${data.asn}` : false,
        mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=CanvasLight` : "",
        mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=RoadDark` : ""
      };
    },

    // 检查所有 IP 地址
    async checkAllIPs() {
      const ipFunctions = [
        this.getIPFromSpecial,
        this.getIPFromTaobao,
        this.getIPFromCloudflare_V4,
        this.getIPFromCloudflare_V6,
        this.getIPFromIpify_V4,
        this.getIPFromIpify_V6
      ];

      let index = 0;
      const interval = setInterval(() => {
        if (index < ipFunctions.length) {
          ipFunctions[index].call(this);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 50);
    },

    // 清空卡片数据
    refreshCard(card) {
      this.clearCardData(card);
      switch (card.source) {
        case "Cloudflare IPv4":
          this.getIPFromCloudflare_V4(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'Cloudflare IPv4');
          break;
        case "Cloudflare IPv6":
          this.getIPFromCloudflare_V6(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'Cloudflare IPv6');
          break;
        case "IPify IPv4":
          this.getIPFromIpify_V4(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'IPify IPv4');
          break;
        case "IPify IPv6":
          this.getIPFromIpify_V6(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'IPify IPv6');
          break;
        case "Upai":
          this.getIPFromUpai(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'Upai');
          break;
        case "IPCheck.ing":
          this.getIPFromGCR(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'IPCheck.ing');
          break;
        case "TaoBao":
          this.getIPFromTaobao(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'TaoBao');
          break;
        default:
          console.error("Undefind Source:", card.source);
      }
    },

    // 清空卡片数据
    clearCardData(card) {
      card.ip = "";
      card.country_name = "";
      card.country_code = "";
      card.region = "";
      card.city = "";
      card.latitude = "";
      card.longitude = "";
      card.asn = "";
      card.isp = "";
      card.mapUrl = '/defaultMap.jpg';
      card.mapUrl_dark = '/defaultMap_dark.jpg';
      card.showASNInfo = false;
    },

    // 复制 IP 地址
    copyToClipboard(ip, id) {
      navigator.clipboard.writeText(ip).then(() => {
        this.copiedStatus[id] = true;
        this.$trackEvent('IPCheck', 'CopyClick', 'Copy IP');
        setTimeout(() => {
          this.copiedStatus[id] = false;
        }, 5000);
      }).catch(err => {
        console.error('Copy error', err);
      });
    },

    // 将 ipDataCards 中的数据写入到 vuex 的 Global_ipDataCards 中
    updateGlobalIPDataCards() {
      setTimeout(() => {
        this.$store.commit('updateGlobalIpDataCards', this.ipDataCards);
      }, 5000);
    },

    // 从后端 API 获取 ASN 信息
    async getASNInfo(asn, ipDataCardsIndex) {
      this.$trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
      try {
        this.ipDataCards[ipDataCardsIndex].showASNInfo = true;
        // 如果 asnInfos 中已有该 ASN 的信息，则直接返回
        if (this.asnInfos[asn]) {
          return;
        }
        asn = asn.replace('AS', '');

        const response = await fetch(`/api/cfradar?asn=${asn}`);
        const data = await response.json();
        this.asnInfos['AS' + asn] = data;
      } catch (error) {
        console.error("Error fetching ASN info:", error);
      }
    },

  },

  created() {
    this.validateBingMapKey();
  },


  watch: {
    isMapShown(newVal) {
      localStorage.setItem("isMapShown", JSON.stringify(newVal));
    },
    isCardsCollapsed(newVal) {
      localStorage.setItem('isCardsCollapsed', JSON.stringify(newVal));
    },
    ipDataCards: {
      handler(newValue) {
        this.$store.commit('updateGlobalIpDataCards', newValue);
      },
      deep: true,
    },
  },

  mounted() {
    this.checkAllIPs();

    // 从本地存储中获取 ipGeoSource
    const ipGeoSource = localStorage.getItem('ipGeoSource');
    if (localStorage.getItem('ipGeoSource')) {
      this.$store.commit('SET_IP_GEO_SOURCE', parseInt(ipGeoSource));
    }
  },
}
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

.jn-ip-font {
  zoom: 0.8;
}
</style>

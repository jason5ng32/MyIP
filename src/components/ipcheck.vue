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
          <label v-if="isMobile" class="form-check-label" for="collapseSwitch">&nbsp;<i
              class="bi bi-list-columns-reverse" aria-hidden="true"></i></label>
        </div>

        <div>
          <input class="form-check-input" type="checkbox" role="button" id="toggleMapSwitch" @change="toggleMaps"
            aria-label="Toggle Map Display" :checked="isMapShown" :disabled="!configs.bingMap"
            @click="$trackEvent('IPCheck', 'ToggleClick', 'ShowMap');">

          <label class="form-check-label" for="toggleMapSwitch">
            <i :class="['bi', configs.bingMap ? 'bi bi-map-fill' : 'bi bi-map']" aria-hidden="true"
              aria-label="Toggle Map Display" v-tooltip="$t('Tooltips.ToggleMaps')"></i>
          </label>
        </div>

        <!-- IP 数据源选择 -->
        <div class="dropdown">
          <span class="ms-3" role="button" id="SelectIPGEOSource" data-bs-toggle="dropdown" aria-expanded="false"
            :aria-label="$t('ipInfos.SelectSource')">
            <i class="bi bi-grid-fill" v-tooltip="$t('Tooltips.SourceSelect')"></i>
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
          :class="{ 'jn-opacity': !card.ip || card.ip === $t('ipInfos.IPv4Error') || card.ip === $t('ipInfos.IPv6Error'), 'col-xl-4': true, 'col-lg-6': true, 'col-md-6': true, 'mb-4': true }">
          <div class="card jn-card keyboard-shortcut-card" :class="{
            'dark-mode dark-mode-border': isDarkMode,
            'jn-ip-card1': !isMobile && ipGeoSource === 0,
            'jn-ip-card2': !isMobile && ipGeoSource !== 0,
          }">
            <div class="card-header jn-ip-title jn-link1"
              :class="{ 'dark-mode-title': isDarkMode, 'bg-light': !isDarkMode }" style="font-weight: bold;">
              <span>
                <i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                {{ $t('ipInfos.Source') }}: {{ card.source }}</span>
              <button @click="refreshCard(card)"
                :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                :aria-label="'Refresh' + card.source" v-tooltip="$t('Tooltips.RefreshIPCard')">
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
                  v-tooltip="{ title: $t('Tooltips.CopyIP'), placement: 'right' }" :aria-label="'Copy' + card.ip"></i>
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
                    <span v-if="card.proxyOperator !== 'unknown'">
                      ( {{ card.proxyOperator }} )
                    </span>
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
                    {{ card.asn }} <i v-if="configs.cloudFlare" class="bi bi-info-circle"
                      @click="getASNInfo(card.asn, index)" data-bs-toggle="collapse"
                      :data-bs-target="'#' + 'collapseASNInfo-' + index" aria-expanded="false"
                      :aria-controls="'collapseASNInfo-' + index" role="button"
                      :aria-label="'Display AS Info of' + card.asn"
                      v-tooltip="{ title: $t('Tooltips.ShowASNInfo'), placement: 'right' }"></i>
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
    const configs = computed(() => store.state.configs);

    return {
      isDarkMode,
      isMobile,
      ipGeoSource,
      configs,
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
        { id: 1, text: 'IPinfo.io', enabled: true },
        { id: 2, text: 'IP-API.com', enabled: true },
        { id: 3, text: 'IPAPI.co', enabled: true },
        { id: 4, text: 'KeyCDN', enabled: true },
        { id: 5, text: 'IP.SB', enabled: true },
      ],
      pendingIPDetailsRequests: new Map(),
      ipDataCards: [
        {
          id: "cnsource",
          ip: "",
          country_name: "",
          region: "",
          city: "",
          latitude: "",
          longitude: "",
          isp: "",
          asn: "",
          asnlink: "",
          mapUrl: '/defaultMap.webp',
          mapUrl_dark: '/defaultMap_dark.webp',
          showMap: false,
          source: "CN Source",
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
          mapUrl: '/defaultMap.webp',
          mapUrl_dark: '/defaultMap_dark.webp',
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
          mapUrl: '/defaultMap.webp',
          mapUrl_dark: '/defaultMap_dark.webp',
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
          mapUrl: '/defaultMap.webp',
          mapUrl_dark: '/defaultMap_dark.webp',
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
          mapUrl: '/defaultMap.webp',
          mapUrl_dark: '/defaultMap_dark.webp',
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
          mapUrl: '/defaultMap.webp',
          mapUrl_dark: '/defaultMap_dark.webp',
          showMap: false,
          source: "IPify IPv6",
          showASNInfo: false,
        },
      ],
      isMapShown: false,
      ipDataCache: new Map(),
      copiedStatus: {},
      bingMapLanguage: this.$Lang,
      IPArray: [],
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

    // 从中国来源获取 IP 地址
    getIPfromCNSource() {
      this.getIPFromIPIP().catch(() => {
        this.getIPFromTaobao().catch(() => {
          this.getIPFromQQ();
        })
      });
    },

    // 从淘宝获取 IP 地址
    getIPFromTaobao() {
      return new Promise((resolve, reject) => {
        let script = document.createElement("script");
        script.src = "https://www.taobao.com/help/getip.php?callback=ipCallback";
        document.head.appendChild(script);

        window.ipCallback = (data) => {
          try {
            let ip = data.ip;
            this.ipDataCards[0].source = "TaoBao";
            this.fetchIPDetails(0, ip);
            this.IPArray = [...this.IPArray, ip];

            document.head.removeChild(script);
            delete window.ipCallback;
            resolve(ip);
          } catch (error) {
            console.error("Error processing IP data from Taobao:", error);
            document.head.removeChild(script);
            delete window.ipCallback;
            reject(new Error("Failed to process IP data from Taobao"));
          }
        };
        // 设置超时拒绝 Promise，以防万一请求挂起
        script.onerror = () => {
          console.error("Error loading script for IP data from Taobao");
          document.head.removeChild(script);
          delete window.ipCallback;
          reject(new Error("Script loading error for IP data from Taobao"));
        };
        setTimeout(() => {
          if (document.head.contains(script)) {
            document.head.removeChild(script);
            delete window.ipCallback;
            reject(new Error("Request to Taobao timed out"));
          }
        }, 2000);
      });
    },

    // 从 IPIP.net 获取 IP 地址
    async getIPFromIPIP() {
      try {
        const response = await fetch("https://myip.ipip.net/json");
        const data = await response.json();
        const ip = data.data.ip;
        this.IPArray = [...this.IPArray, ip];
        this.ipDataCards[0].source = "IPIP.net";
        this.fetchIPDetails(0, ip);
      } catch (error) {
        console.error("Error fetching IP from IPIP.net:", error);
        throw new Error("Failed to fetch IP from IPIP.net");
      }
    },

    // 从 QQ Video 获取 IP 地址
    getIPFromQQ() {
      return new Promise((resolve, reject) => {
        // 动态创建 script 标签发起 JSONP 请求
        let script = document.createElement("script");
        script.src = "https://vv.video.qq.com/checktime?otype=json&callback=ipCallback";
        document.head.appendChild(script);

        // 设置成功获取数据的回调
        window.ipCallback = (data) => {
          try {
            let ip = data.ip;
            this.ipDataCards[0].source = "QQ.com";
            this.fetchIPDetails(0, ip);
            this.IPArray = [...this.IPArray, ip];

            document.head.removeChild(script);
            delete window.ipCallback;
            resolve(ip); // 成功获取 IP，解决 Promise
          } catch (error) {
            console.error("Error processing IP data from QQ:", error);
            document.head.removeChild(script);
            delete window.ipCallback;
            reject(new Error("Failed to process IP data from QQ"));
          }
        };

        // 设置超时拒绝 Promise，以防万一请求挂起
        script.onerror = () => {
          console.error("Error loading script for IP data from QQ");
          document.head.removeChild(script);
          delete window.ipCallback;
          reject(new Error("Script loading error for IP data from QQ"));
        };

        setTimeout(() => {
          if (document.head.contains(script)) {
            console.error("Request to QQ timed out");
            document.head.removeChild(script);
            delete window.ipCallback;
            reject(new Error("Request to QQ timed out"));
          }
        }, 2000);
      });
    },


    // 从特殊源获取 IP 地址
    async getIPFromSpecial() {
      if (this.configs.originalSite) {
        await this.getIPFromGCR();
      } else {
        await this.getIPFromUpai();
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
        this.IPArray = [...this.IPArray, ip];
        this.ipDataCards[1].source = "Upai";
        this.fetchIPDetails(1, ip);
      } catch (error) {
        console.error("Error fetching IP from Upai:", error);
        this.getIPFromCloudflare_CN(); // 故障转移
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
        this.IPArray = [...this.IPArray, ip];
        this.ipDataCards[1].source = "IPCheck.ing";
        this.fetchIPDetails(1, ip);
      } catch (error) {
        console.error("Error fetching IP from IPCheck.ing:", error);
        this.getIPFromCloudflare_CN(); // 故障转移
      }
    },

    // 从 Cloudflare 中国获取 IP 地址
    async getIPFromCloudflare_CN() {
      try {
        const response = await fetch("https://cf-ns.com/cdn-cgi/trace");
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        if (ipLine) {
          const ip = ipLine.split("=")[1];
          this.IPArray = [...this.IPArray, ip];
          this.ipDataCards[1].source = "CF-CN";
          this.fetchIPDetails(1, ip);
        }
      } catch (error) {
        console.error("Error fetching IP from Cloudflare:", error);
        this.ipDataCards[1].ip = this.$t('ipInfos.IPv4Error');
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
          this.IPArray = [...this.IPArray, ip];
          this.fetchIPDetails(2, ip);
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
          this.IPArray = [...this.IPArray, ip];
          this.fetchIPDetails(3, ip);
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
        this.IPArray = [...this.IPArray, data.ip];
        this.fetchIPDetails(4, data.ip);
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
        this.IPArray = [...this.IPArray, data.ip];
        this.fetchIPDetails(5, data.ip);
      } catch (error) {
        console.error("Error fetching IPv6 address from ipify:", error);
        this.ipDataCards[5].ip = this.$t('ipInfos.IPv6Error');
      }
    },

    // 从 IP 地址获取 IP 详细信息
    async fetchIPDetails(cardIndex, ip, sourceID = null) {
      sourceID = sourceID || this.ipGeoSource;
      const card = this.ipDataCards[cardIndex];
      card.ip = ip;
      let lang = this.$Lang;
      if (lang === 'zh') {
        lang = 'zh-CN';
      }

      // 检查缓存中是否已有该 IP 的数据
      if (this.ipDataCache.has(ip)) {
        const cachedData = this.ipDataCache.get(ip);
        Object.assign(card, cachedData);
        return;
      }

      // 检查是否有正在进行的查询，如果有，则等待该查询完成
      if (this.pendingIPDetailsRequests.has(ip)) {
        await this.pendingIPDetailsRequests.get(ip);
        const cachedData = this.ipDataCache.get(ip);
        if (cachedData) {
          Object.assign(card, cachedData);
        }
        return;
      }

      const fetchPromise = (async () => {
        const sources = [
          { id: 0, url: `/api/ipchecking?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
          { id: 1, url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
          { id: 2, url: `/api/ipapicom?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
          { id: 3, url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
          { id: 4, url: `/api/keycdn?ip=${ip}`, transform: this.transformDataFromIPapi },
          { id: 5, url: `/api/ipsb?ip=${ip}`, transform: this.transformDataFromIPapi },
        ];

        let currentSourceIndex = sourceID !== null ? sources.findIndex(source => source.id === sourceID) : 0;
        let attempts = 0;

        while (attempts < sources.length) {
          const source = sources[currentSourceIndex];
          try {
            const response = await fetch(source.url);
            const data = await response.json();
            const cardData = source.transform(data);

            if (cardData) {
              this.$store.commit('SET_IP_GEO_SOURCE', source.id);
              localStorage.setItem("ipGeoSource", source.id.toString());
              Object.assign(card, cardData);
              this.ipDataCache.set(ip, cardData);
              return;
            }
          } catch (error) {
            console.error("Error fetching IP details from source " + source.id + ":", error);
            this.sources[source.id].enabled = false;
            currentSourceIndex = (currentSourceIndex + 1) % sources.length;
            attempts++;
          }
        }

        throw new Error("All sources failed to fetch IP details for IP: " + ip);
      })();

      // 将此 Promise 存储在 pendingIPDetailsRequests 中，以避免重复查询
      this.pendingIPDetailsRequests.set(ip, fetchPromise);

      try {
        await fetchPromise;
      } catch (error) {
        console.error(error);
      } finally {
        // 完成后，从 pendingIPDetailsRequests 中移除
        this.pendingIPDetailsRequests.delete(ip);
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

      // 尝试更新一次，成功后再获取其他 IP 数据
      let runningSource = this.fetchIPDetails(0, this.ipDataCards[0].ip, sourceID);

      // 重新获取 IP 数据
      let index = 1;
      const interval = setInterval(() => {
        if (index < this.ipDataCards.length) {
          const card = this.ipDataCards[index];
          if (this.isValidIP(card.ip)) {
            this.fetchIPDetails(index, card.ip, parseInt(runningSource));
          }
          index++;
        } else {
          clearInterval(interval);
        }
      }, 500);
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

        const proxyOperator = proxyDetect.operator ? proxyDetect.operator : "";

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
          proxyOperator: proxyOperator,
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
        this.getIPfromCNSource,
        this.getIPFromSpecial,
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
      }, 500);
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
        case "IPIP.net":
          this.getIPFromIPIP(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'IPIP.net');
          break;
        case "QQ.com":
          this.getIPFromQQ(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'QQ.com');
          break;
        case "CF-CN":
          this.getIPFromCloudflare_CN(card);
          this.$trackEvent('IPCheck', 'RefreshClick', 'CF-CN');
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
      card.mapUrl = '/defaultMap.webp';
      card.mapUrl_dark = '/defaultMap_dark.webp';
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

  watch: {
    isMapShown(newVal) {
      localStorage.setItem("isMapShown", JSON.stringify(newVal));
    },
    isCardsCollapsed(newVal) {
      localStorage.setItem('isCardsCollapsed', JSON.stringify(newVal));
    },
    IPArray: {
      handler() {
        this.$store.commit('updateGlobalIpDataCards', this.IPArray);
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
.dropdown-item.disabled, .dropdown-item:disabled {
  text-decoration: line-through;
}
</style>

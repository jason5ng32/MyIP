<template>
    <!-- IP Infos -->
    <div class="ip-data-section mb-4">
      <div class="row" :class="{ 'jn-title2': !isMobile, 'jn-title': isMobile }">
        <h2 id="IPInfo" class="col-4" :class="{ 'mobile-h2': isMobile }">🔎
          {{ $t('ipInfos.Title') }}</h2>
        <div class="form-check form-switch col-8 jn-radio">

          <div :class="{ 'col-4': isMobile }">
            <input v-if="isMobile" class="form-check-input" type="checkbox" id="collapseSwitch" @change="toggleCollapse"
              :checked="!isCardsCollapsed" @click="$trackEvent('IPCheck', 'ToggleClick', 'Collaspes');">
            <label v-if="isMobile" class="form-check-label" for="collapseSwitch">&nbsp;<i
                class="bi bi-list-columns-reverse"></i></label>
          </div>

          <div>
            <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckDefault" @change="toggleMaps"
              :checked="isMapShown" :disabled="!isEnvBingMapKey" @click="$trackEvent('IPCheck', 'ToggleClick', 'ShowMap');">

            <label class="form-check-label" for="flexSwitchCheckDefault">
              <i :class="['bi', isEnvBingMapKey ? 'bi bi-map-fill' : 'bi bi-map']"></i>
            </label>
          </div>

        </div>
      </div>
      <div class="text-secondary">
        <p>{{ $t('ipInfos.Notes') }}</p>
      </div>
      <div class="jn-card-deck">
        <div class="row">
          <div v-for="card in ipDataCards" :key="card.id" :ref="card.id"
            :class="{ 'jn-opacity': !card.asn, 'col-xl-4': true, 'col-lg-6': true, 'col-md-6': true, 'mb-4': true }">
            <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
              <div class="card-header jn-ip-title" :class="{ 'dark-mode-title': isDarkMode }" style="font-weight: bold;">
                <span>{{ $t('ipInfos.Source') }}: {{ card.source }}</span>
                <button @click="refreshCard(card)"
                  :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']">
                  <i class="bi bi-arrow-clockwise"></i></button>
              </div>
              <img v-if="isMapShown" :src="isDarkMode ? card.mapUrl_dark : card.mapUrl" class="card-img-top jn-map-image"
                alt="Map">

              <div class="card-body">
                <ul class="list-group list-group-flush">
                  <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }"><span
                      class="jn-text">🖥️ {{ $t('ipInfos.IP') }}</span>: {{ card.ip
                      }}
                    <i v-if="isValidIP(card.ip)"
                      :class="copiedStatus[card.id] ? 'bi bi-clipboard-check-fill' : 'bi bi-clipboard-plus'"
                      @click="copyToClipboard(card.ip, card.id)"></i>
                  </li>
                  <li class="list-group-item jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode, 'mobile-list': isMobile && isCardsCollapsed }">
                    <span class="jn-text">🌍 {{ $t('ipInfos.Country') }}</span>: {{
                      card.country_name }}&nbsp;<span v-if="card.country_code"
                      :class="'fi fi-' + card.country_code.toLowerCase()"></span>
                  </li>
                  <li v-show="!isMobile || !isCardsCollapsed" class="list-group-item jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode }"><span class="jn-text">🏚️
                      {{ $t('ipInfos.Region') }}</span>: {{ card.region
                      }}</li>
                  <li v-show="!isMobile || !isCardsCollapsed" class="list-group-item jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode }"><span class="jn-text">🚏
                      {{ $t('ipInfos.City') }}</span>: {{ card.city }}
                  </li>
                  <li v-show="!isMobile || !isCardsCollapsed" class="list-group-item jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode }"><span class="jn-text">🏢
                      {{ $t('ipInfos.ISP') }}</span>: {{ card.isp }}
                  </li>
                  <li v-show="!isMobile || !isCardsCollapsed" class="list-group-item jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode }"><span class="jn-text">📶
                      {{ $t('ipInfos.ASN') }}</span>: <a v-if="card.asnlink" :href="card.asnlink" target="_blank">{{
                        card.asn }}</a><a v-else>{{ card.asn }}</a></li>
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


    return {
      isDarkMode,
      isMobile,
    };
  },

  data() {
    return {
      isCardsCollapsed: JSON.parse(localStorage.getItem('isCardsCollapsed')) || false,
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
          source: "Taobao",
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
        this.fetchIPDetails(0, ip);
        delete window.ipCallback;
      };
      var script = document.createElement("script");
      script.src = "https://www.taobao.com/help/getip.php?callback=ipCallback";
      document.head.appendChild(script);
      document.head.removeChild(script);
    },

    // 从特殊源获取 IP 地址
    getIPFromSpecial() {
      fetch('/api/validate-site')
        .then(response => response.json())
        .then(data => {
          // 将 data.isIpCheckEnabled 写入到 vuex 的 Global_siteValidate 中
          this.$store.commit('updateGlobalSiteValidate', data.isIpCheckEnabled);

          if (data.isIpCheckEnabled) {
            this.getIPFromGCR();
          } else {
            this.getIPFromUpai();
          }
        });
    },

    // 从 Upai 获取 IP 地址
    getIPFromUpai() {
      const unixTime = Date.now();
      const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${unixTime}`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          const ip = data.remote_addr;
          this.ipDataCards[1].source = "Upai"
          this.fetchIPDetails(1, ip);
        })
        .catch((error) => {
          console.error("Error fetching IP from Upai:", error);
          this.ipDataCards[1].ip = this.$t('ipInfos.IPv4Error');
        });
    },

    // 从 GCR 获取 IP 地址
    getIPFromGCR() {
      const url = `https://getipfromgoogle.ipcheck.ing/`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          const fullIp = data.ip;
          const ip = fullIp.includes(',') ? fullIp.split(',')[0] : fullIp;
          this.ipDataCards[1].source = "IPCheck.ing";
          this.fetchIPDetails(1, ip);
        })

        .catch((error) => {
          console.error("Error fetching IP from IPCheck.ing:", error);
          this.getIPFromUpai();
        });
    },

    // 从 Cloudflare 获取 IPv4 地址
    getIPFromCloudflare_V4() {
      fetch("https://1.0.0.1/cdn-cgi/trace")
        .then((response) => response.text())
        .then((data) => {
          const lines = data.split("\n");
          const ipLine = lines.find((line) => line.startsWith("ip="));
          if (ipLine) {
            const ip = ipLine.split("=")[1];
            this.fetchIPDetails(2, ip);
          }
        })
        .catch((error) => {
          console.error("Error fetching IP from Cloudflare:", error);
          this.ipDataCards[2].ip = this.$t('ipInfos.IPv4Error');
        });
    },

    // 从 Cloudflare 获取 IPv6 地址
    getIPFromCloudflare_V6() {
      fetch("https://[2606:4700:4700::1111]/cdn-cgi/trace")
        .then((response) => response.text())
        .then((data) => {
          const lines = data.split("\n");
          const ipLine = lines.find((line) => line.startsWith("ip="));
          if (ipLine) {
            const ip = ipLine.split("=")[1];
            this.fetchIPDetails(3, ip);
          }
        })
        .catch((error) => {
          console.error("Error fetching IP from Cloudflare:", error);
          this.ipDataCards[3].ip = this.$t('ipInfos.IPv6Error');
        });
    },

    // 从 IPify 获取 IPv4 地址
    getIPFromIpify_V4() {
      fetch("https://api4.ipify.org?format=json")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.fetchIPDetails(4, data.ip);
        })
        .catch((error) => {
          console.error("Error fetching IPv4 address from ipify:", error);
          this.ipDataCards[4].ip = this.$t('ipInfos.IPv4Error');
        });
    },

    // 从 IPify 获取 IPv6 地址
    getIPFromIpify_V6() {
      fetch("https://api6.ipify.org?format=json")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.fetchIPDetails(5, data.ip);
        })
        .catch((error) => {
          console.error("Error fetching IPv6 address from ipify:", error);
          this.ipDataCards[5].ip = this.$t('ipInfos.IPv6Error');
        });
    },

    // 从 IP 地址获取 IP 详细信息
    async fetchIPDetails(cardIndex, ip) {
      const card = this.ipDataCards[cardIndex];
      card.ip = ip;

      // 检查缓存中是否已有该 IP 的数据
      if (this.ipDataCache.has(ip)) {
        // 使用缓存的数据填充卡片
        const cachedData = this.ipDataCache.get(ip);
        Object.assign(card, cachedData);
        return;
      }

      // 尝试从多个不同的源获取数据
      const sources = [
        { url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
        { url: `/api/ipapicom?ip=${ip}`, transform: this.transformDataFromIPapi },
        { url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
        { url: `api/keycdn?ip=${ip}`, transform: this.transformDataFromIPapi },
      ];

      for (const source of sources) {
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
          console.error("Error fetching IP details:", error);
        }
      }
    },

    // 格式化 IP 数据
    transformDataFromIPapi(data) {
      if (data.error) {
        throw new Error(data.reason);
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
        asnlink: data.asn ? `https://radar.cloudflare.com/traffic/${data.asn}` : false,
        mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=CanvasLight` : "",
        mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=RoadDark` : ""
      };
    },

    // 检查所有 IP 地址
    checkAllIPs() {
      setTimeout(() => {
        this.getIPFromSpecial();
      }, 500);
      setTimeout(() => {
        this.getIPFromTaobao();
      }, 500);
      setTimeout(() => {
        this.getIPFromCloudflare_V4();
      }, 500);
      setTimeout(() => {
        this.getIPFromCloudflare_V6();
      }, 100);
      setTimeout(() => {
        this.getIPFromIpify_V4();
      }, 1000);
      setTimeout(() => {
        this.getIPFromIpify_V6();
      }, 1000);
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
  },
}
</script>

<style scoped></style>

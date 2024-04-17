<template>
  <!-- DNS Leaks Test -->
  <div class="dnsleak-test-section mb-4">
    <div class="jn-title2">
      <h2 id="DNSLeakTest" :class="{ 'mobile-h2': isMobile }">🛑 {{ $t('dnsleaktest.Title') }}</h2>
      <button @click="checkAllDNSLeakTest(true)"
        :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']" aria-label="Refresh DNS Leak Test"
        v-tooltip="$t('Tooltips.RefreshDNSLeakTest')"><i class="bi bi-arrow-clockwise"></i></button>
    </div>
    <div class="text-secondary">
      <p>{{ $t('dnsleaktest.Note') }}</p>
      <p>{{ $t('dnsleaktest.Note2') }}</p>
    </div>
    <div class="row">
      <div v-for="(leak, index) in leakTest" :key="leak.id" class="col-lg-3 col-md-6 col-12 mb-4">
        <div class="card jn-card keyboard-shortcut-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">
            <p class="jn-con-title card-title"><i class="bi bi-heart-pulse-fill"></i> {{ leak.name }}
              <i class="bi" :class="'bi-' + (index + 1) + '-square'"></i>&nbsp;
            </p>
            <p class="card-text" :class="{
        'text-info': leak.ip === $t('dnsleaktest.StatusWait') || leak.ip === $t('dnsleaktest.StatusError'),
        'text-success': leak.ip.includes('.') || leak.ip.includes(':'),
      }">
              <i class="bi"
                :class="[leak.ip === $t('dnsleaktest.StatusWait') || leak.ip === $t('dnsleaktest.StatusError') ? 'bi-hourglass-split' : 'bi-box-arrow-right']"></i>
              {{ $t('dnsleaktest.Endpoint') }}: {{
        leak.ip }}
            </p>

            <div class="alert" :class="{
        'alert-info': leak.country === $t('dnsleaktest.StatusWait'),
        'alert-success': leak.country !== $t('dnsleaktest.StatusWait'),
      }" :data-bs-theme="isDarkMode ? 'dark' : ''">
              <i class="bi"
                :class="[leak.ip === $t('dnsleaktest.StatusWait') || leak.ip === $t('dnsleaktest.StatusError') ? 'bi-hourglass-split' : 'bi-geo-alt-fill']"></i>
              {{ $t('dnsleaktest.EndpointCountry') }}: <strong>{{ leak.country }}&nbsp;</strong>
              <span v-if="leak.country !== $t('dnsleaktest.StatusWait') && leak.country !== $t('dnsleaktest.StatusError')"
                :class="'jn-fl fi fi-' + leak.country_code.toLowerCase()"></span>
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
import countryLookup from 'country-code-lookup';

export default {
  name: 'DNSLeaks',

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
      leakTest: [
        {
          id: "ipapi1",
          name: this.$t('dnsleaktest.Name'),
          country_code: this.$t('dnsleaktest.StatusWait'),
          country: this.$t('dnsleaktest.StatusWait'),
          ip: this.$t('dnsleaktest.StatusWait'),
        },
        {
          id: "ipapi2",
          name: this.$t('dnsleaktest.Name'),
          country_code: this.$t('dnsleaktest.StatusWait'),
          country: this.$t('dnsleaktest.StatusWait'),
          ip: this.$t('dnsleaktest.StatusWait'),
        },
        {
          id: "sfshark1",
          name: this.$t('dnsleaktest.Name'),
          country_code: this.$t('dnsleaktest.StatusWait'),
          country: this.$t('dnsleaktest.StatusWait'),
          ip: this.$t('dnsleaktest.StatusWait'),
        },
        {
          id: "sfshark2",
          name: this.$t('dnsleaktest.Name'),
          country_code: this.$t('dnsleaktest.StatusWait'),
          country: this.$t('dnsleaktest.StatusWait'),
          ip: this.$t('dnsleaktest.StatusWait'),
        },
      ],
    };
  },

  methods: {

    // 生成 32 位随机字符串
    generate32DigitString() {
      const unixTime = Date.now().toString();
      const fixedString = "jason5ng32";
      const randomString = Math.random().toString(36).substring(2, 11);

      return unixTime + fixedString + randomString;
    },

    // 生成 14 位随机字符串
    generate14DigitString() {
      const fixedString = "jn32";
      const randomString = Math.random().toString(36).substring(2, 11);

      return fixedString + randomString;
    },

    // DNS 泄露测试 1
    fetchLeakTestIpApiCom(index) {
      const urlString = this.generate32DigitString();
      const url = `https://${urlString}.edns.ip-api.com/json`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          if (data.dns && "geo" in data.dns && "ip" in data.dns) {
            const geoSplit = data.dns.geo.split(" - ");
            this.leakTest[index].country = geoSplit[0];
            this.leakTest[index].country_code = countryLookup.byCountry(geoSplit[0]).iso2;
            this.leakTest[index].ip = data.dns.ip;
          } else {
            console.error("Unexpected data structure:", data);
          }
        })
        .catch((error) => {
          console.error("Error fetching leak test data:", error);
          this.leakTest[index].country = this.$t('dnsleaktest.StatusError');
          this.leakTest[index].country_code = this.$t('dnsleaktest.StatusError');
          this.leakTest[index].ip = this.$t('dnsleaktest.StatusError');
        });
    },

    // DNS 泄露测试 2
    fetchLeakTestSfSharkCom(index, key) {
      const urlString = this.generate14DigitString();
      const url = `https://${urlString}.ipv4.surfsharkdns.com`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          const getKey = Object.keys(data)[key];
          const keyEntry = data[getKey];

          if (keyEntry && keyEntry.CountryCode && keyEntry.IP) {
            this.leakTest[index].country_code = keyEntry.CountryCode;
            this.leakTest[index].country = keyEntry.Country;
            this.leakTest[index].ip = keyEntry.IP;
          } else {
            console.error("Unexpected data structure:", data);
          }
        })
        .catch((error) => {
          console.error("Error fetching leak test data:", error);
          this.leakTest[index].geo = this.$t('dnsleaktest.StatusError');
          this.leakTest[index].ip = this.$t('dnsleaktest.StatusError');
        });
    },

    // 检查所有 DNS 泄露测试
    checkAllDNSLeakTest(isRefresh) {
      this.leakTest.forEach((server) => {
        server.geo = this.$t('dnsleaktest.StatusWait');
        server.ip = this.$t('dnsleaktest.StatusWait');
      });
      if (isRefresh) {
        this.$trackEvent('Section', 'RefreshClick', 'DNSLeakTest');
      }
      setTimeout(() => {
        this.fetchLeakTestIpApiCom(0);
      }, 100);

      setTimeout(() => {
        this.fetchLeakTestIpApiCom(1);
      }, 1000);

      setTimeout(() => {
        this.fetchLeakTestSfSharkCom(2, 0);
      }, 100);

      setTimeout(() => {
        this.fetchLeakTestSfSharkCom(3, 0);
      }, 1000);
    },
  },
  mounted() {
    setTimeout(() => {
      this.checkAllDNSLeakTest(false);
    }, 2500);
  },
}
</script>

<style scoped>
/* Your style code goes here */
</style>

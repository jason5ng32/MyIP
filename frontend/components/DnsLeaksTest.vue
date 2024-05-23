<template>
  <!-- DNS Leaks Test -->
  <div class="dnsleak-test-section mb-4">
    <div class="jn-title2">
      <h2 id="DNSLeakTest" :class="{ 'mobile-h2': isMobile }">🛑 {{ t('dnsleaktest.Title') }}</h2>
      <button @click="checkAllDNSLeakTest(true)"
        :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']" aria-label="Refresh DNS Leak Test"
        v-tooltip="t('Tooltips.RefreshDNSLeakTest')"><i class="bi"
          :class="[isStarted ? 'bi-arrow-clockwise' : 'bi-caret-right-fill']"></i></button>
    </div>
    <div class="text-secondary">
      <p>{{ t('dnsleaktest.Note') }}</p>
      <p>{{ t('dnsleaktest.Note2') }}</p>
    </div>
    <div class="row">
      <div v-for="(leak, index) in leakTest" :key="leak.id" class="col-lg-3 col-md-6 col-12 mb-4">
        <div class="card jn-card keyboard-shortcut-card"
          :class="{ 'dark-mode dark-mode-border': isDarkMode, 'jn-hover-card': !isMobile }">
          <div class="card-body">
            <p class="jn-con-title card-title"><i class="bi bi-heart-pulse-fill"></i> {{ leak.name }}
              <i class="bi" :class="'bi-' + (index + 1) + '-square'"></i>&nbsp;
            </p>
            <p class="card-text" :class="{
              'text-info': leak.ip === t('dnsleaktest.StatusWait') || leak.ip === t('dnsleaktest.StatusError'),
              'text-success': leak.ip.includes('.') || leak.ip.includes(':'),
            }">
              <i class="bi"
                :class="[leak.ip === t('dnsleaktest.StatusWait') || leak.ip === t('dnsleaktest.StatusError') ? 'bi-hourglass-split' : 'bi-box-arrow-right']"></i>
              {{ t('dnsleaktest.Endpoint') }}: {{
              leak.ip }}
            </p>

            <div class="alert" :class="{
              'alert-info': leak.country === t('dnsleaktest.StatusWait'),
              'alert-success': leak.country !== t('dnsleaktest.StatusWait'),
            }" :data-bs-theme="isDarkMode ? 'dark' : ''">
              <i class="bi"
                :class="[leak.ip === t('dnsleaktest.StatusWait') || leak.ip === t('dnsleaktest.StatusError') ? 'bi-hourglass-split' : 'bi-geo-alt-fill']"></i>
              {{ t('dnsleaktest.EndpointCountry') }}: <strong>{{ leak.country }}&nbsp;</strong>
              <span v-if="leak.country !== t('dnsleaktest.StatusWait') && leak.country !== t('dnsleaktest.StatusError')"
                :class="'jn-fl fi fi-' + leak.country_code.toLowerCase()"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import countryLookup from 'country-code-lookup';
import getCountryName from '@/utils/country-name.js';


const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);


const createDefaultCard = () => ({
  name: t('dnsleaktest.Name'),
  country_code: t('dnsleaktest.StatusWait'),
  country: t('dnsleaktest.StatusWait'),
  ip: t('dnsleaktest.StatusWait'),
});

const leakTest = reactive([
  { ...createDefaultCard(), id: "ipapi1" },
  { ...createDefaultCard(), id: "ipapi2" },
  { ...createDefaultCard(), id: "sfshark1" },
  { ...createDefaultCard(), id: "sfshark2" },
]);

const isStarted = ref(false);

// 生成 32 位随机字符串
const generate32DigitString = () => {
  const unixTime = Date.now().toString();
  const fixedString = "jason5ng32";
  const randomString = Math.random().toString(36).substring(2, 11);

  return unixTime + fixedString + randomString;
};

// 生成 14 位随机字符串
const generate14DigitString = () => {
  const fixedString = "jn32";
  const randomString = Math.random().toString(36).substring(2, 11);

  return fixedString + randomString;
};

// DNS 泄露测试 1
const fetchLeakTestIpApiCom = (index) => {
  return new Promise((resolve, reject) => {
    const urlString = generate32DigitString();
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
          leakTest[index].country_code = countryLookup.byCountry(geoSplit[0]).iso2;
          leakTest[index].country = getCountryName(leakTest[index].country_code, lang.value);
          leakTest[index].ip = data.dns.ip;
          resolve();
        } else {
          console.error("Unexpected data structure:", data);
          reject(new Error("Unexpected data structure"));
        }
      })
      .catch((error) => {
        console.error("Error fetching leak test data:", error);
        leakTest[index].country = t('dnsleaktest.StatusError');
        leakTest[index].country_code = t('dnsleaktest.StatusError');
        leakTest[index].ip = t('dnsleaktest.StatusError');
        reject(error);
      });
  });
};

// DNS 泄露测试 2
const fetchLeakTestSfSharkCom = (index, key) => {
  return new Promise((resolve, reject) => {
    const urlString = generate14DigitString();
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
          leakTest[index].country_code = keyEntry.CountryCode;
          leakTest[index].country = getCountryName(keyEntry.CountryCode, lang.value);
          leakTest[index].ip = keyEntry.IP;
          resolve();
        } else {
          console.error("Unexpected data structure:", data);
          reject(new Error("Unexpected data structure"));
        }
      })
      .catch((error) => {
        console.error("Error fetching leak test data:", error);
        leakTest[index].geo = t('dnsleaktest.StatusError');
        leakTest[index].ip = t('dnsleaktest.StatusError');
        reject(error);
      });
  });
};

// 检查所有 DNS 泄露测试
const checkAllDNSLeakTest = async (isRefresh) => {
  isStarted.value = true;
  if (isRefresh) {
    trackEvent('Section', 'RefreshClick', 'DNSLeakTest');
    leakTest.forEach((server) => {
      server.geo = t('dnsleaktest.StatusWait');
      server.ip = t('dnsleaktest.StatusWait');
      server.country = t('dnsleaktest.StatusWait');
      server.country_code = t('dnsleaktest.StatusWait');
    });
  }

  // 设置延迟请求函数
  const delayedFetch = (fetchFunction, index, key, delay) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        fetchFunction(index, key).then(resolve).catch(resolve);  // 无论成功或失败都会解决
      }, delay);
    });
  };

  // 批量请求
  const promises = [
    delayedFetch(fetchLeakTestIpApiCom, 0, null, 100),
    delayedFetch(fetchLeakTestIpApiCom, 1, null, 1000),
    delayedFetch(fetchLeakTestSfSharkCom, 2, 0, 100),
    delayedFetch(fetchLeakTestSfSharkCom, 3, 0, 1000)
  ];

  // 最长等待 6 秒
  const allSettledPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));

  // 等待所有请求完成或超时
  return Promise.race([allSettledPromise, timeoutPromise]).then(() => {
    store.setLoadingStatus('dnsleaktest', true);
  });
};


onMounted(() => {
  store.setMountingStatus('dnsleaktest', true);
});

defineExpose({
  checkAllDNSLeakTest,
  leakTest
});
</script>

<style scoped></style>

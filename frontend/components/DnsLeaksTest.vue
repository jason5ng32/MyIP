<template>
  <!-- DNS Leak Test — 与 Connectivity 一致的 service-status-card 结构 -->
  <section class="mb-10">
    <!-- 章节头 -->
    <header class="flex items-start justify-between gap-4 mb-3">
      <div class="flex-1 min-w-0">
        <h2 id="DNSLeakTest" class="text-xl md:text-2xl font-semibold tracking-tight leading-tight">
          🛑 {{ t('dnsleaktest.Title') }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('dnsleaktest.Note') }}</p>
        <p class="text-sm text-muted-foreground">{{ t('dnsleaktest.Note2') }}</p>
      </div>
      <JnTooltip :text="t('Tooltips.RefreshDNSLeakTest')" side="left">
        <Button size="icon" variant="outline" class="shrink-0"
          @click="checkAllDNSLeakTest(true)"
          aria-label="Refresh DNS Leak Test">
          <component :is="isStarted ? RotateCw : ChevronRight" />
        </Button>
      </JnTooltip>
    </header>

    <!-- 卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card v-for="(leak, index) in leakTest" :key="leak.id"
        class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <CardContent class="p-4">
          <!-- 顶部：心跳图标 + 名字 + 序号 -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2 min-w-0">
              <HeartPulse class="size-6 text-muted-foreground shrink-0" />
              <span class="text-base font-medium truncate">{{ leak.name }}</span>
            </div>
            <span class="text-xs font-mono text-muted-foreground shrink-0">#{{ index + 1 }}</span>
          </div>

          <!-- 端点 IP 行（多行时 dot 顶端对齐，IPv6 / 长状态文案自然换行） -->
          <div class="flex items-start gap-1.5 text-base mb-3">
            <span class="relative flex shrink-0 mt-[0.5em]">
              <span v-if="toneOf(leak) === 'wait'"
                class="absolute inline-flex size-2 rounded-full bg-sky-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(leak))"></span>
            </span>
            <span class="break-all">
              <span class="text-muted-foreground">{{ t('dnsleaktest.Endpoint') }}:</span>
              <span class="font-mono ml-1" :class="textClass(toneOf(leak))">{{ leak.ip }}</span>
            </span>
          </div>

          <!-- ISP + Country 子块：stacked 排版，长文本自然换行不挤压卡片宽度 -->
          <dl class="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
            <div>
              <dt class="text-xs text-muted-foreground mb-0.5">{{ t('ipInfos.ISP') }}</dt>
              <dd class="font-medium break-words" :title="leak.org"
                :class="{ 'text-muted-foreground font-normal': toneOf(leak) === 'wait' || toneOf(leak) === 'fail' }">
                {{ leak.org }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground mb-0.5">{{ t('ipInfos.Country') }}</dt>
              <dd class="font-medium flex items-center gap-1.5 flex-wrap">
                <span v-if="leak.country_code"
                  :class="'fi fi-' + leak.country_code.toLowerCase()" class="shrink-0"></span>
                <span class="break-words"
                  :class="{ 'text-muted-foreground font-normal': toneOf(leak) === 'wait' || toneOf(leak) === 'fail' }">
                  {{ leak.country }}
                </span>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  </section>
</template>


<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import countryLookup from 'country-code-lookup';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import getCountryName from '@/utils/country-name.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { ChevronRight, HeartPulse, RotateCw } from 'lucide-vue-next';


const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);
const isStarted = ref(false);

const { dotClass, textClass } = useStatusTone();

// 业务状态 → 4 档 tone
const toneOf = (leak) => {
  if (leak.ip === t('dnsleaktest.StatusWait')) return 'wait';
  if (leak.ip === t('dnsleaktest.StatusError')) return 'fail';
  if (leak.ip.includes('.') || leak.ip.includes(':')) return 'ok-fast';
  return 'wait';
};

const createDefaultCard = () => ({
  name: t('dnsleaktest.Name'),
  country_code: '',
  country: t('dnsleaktest.StatusWait'),
  ip: t('dnsleaktest.StatusWait'),
  org: t('dnsleaktest.StatusWait'),
});

const leakTest = reactive([
  { ...createDefaultCard(), id: 'ipapi1' },
  { ...createDefaultCard(), id: 'ipapi2' },
  { ...createDefaultCard(), id: 'sfshark1' },
  { ...createDefaultCard(), id: 'sfshark2' },
]);

// 生成 32 位随机字符串
const generate32DigitString = () => {
  const unixTime = Date.now().toString();
  const fixedString = 'jason5ng32';
  const randomString = Math.random().toString(36).substring(2, 11);
  return unixTime + fixedString + randomString;
};

// 生成 14 位随机字符串
const generate14DigitString = () => {
  const fixedString = 'jn32';
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
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then((data) => {
        if (data.dns && 'geo' in data.dns && 'ip' in data.dns) {
          const geoSplit = data.dns.geo.split(' - ');
          leakTest[index].country_code = countryLookup.byCountry(geoSplit[0]).iso2;
          leakTest[index].country = getCountryName(leakTest[index].country_code, lang.value);
          leakTest[index].org = geoSplit[1] || '';
          leakTest[index].ip = data.dns.ip;
          resolve();
        } else {
          console.error('Unexpected data structure:', data);
          reject(new Error('Unexpected data structure'));
        }
      })
      .catch((error) => {
        console.error('Error fetching leak test data:', error);
        leakTest[index].country = t('dnsleaktest.StatusError');
        leakTest[index].ip = t('dnsleaktest.StatusError');
        leakTest[index].country_code = '';
        leakTest[index].org = '';
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
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then((data) => {
        const getKey = Object.keys(data)[key];
        const keyEntry = data[getKey];

        if (keyEntry && keyEntry.CountryCode && keyEntry.IP) {
          leakTest[index].country_code = keyEntry.CountryCode;
          leakTest[index].country = getCountryName(keyEntry.CountryCode, lang.value);
          leakTest[index].org = keyEntry.ISP || '';
          leakTest[index].ip = keyEntry.IP;
          resolve();
        } else {
          console.error('Unexpected data structure:', data);
          reject(new Error('Unexpected data structure'));
        }
      })
      .catch((error) => {
        console.error('Error fetching leak test data:', error);
        leakTest[index].ip = t('dnsleaktest.StatusError');
        leakTest[index].country = t('dnsleaktest.StatusError');
        leakTest[index].country_code = '';
        leakTest[index].org = '';
        reject(error);
      });
  });
};

// 检查所有
const checkAllDNSLeakTest = async (isRefresh) => {
  isStarted.value = true;
  if (isRefresh) {
    trackEvent('Section', 'RefreshClick', 'DNSLeakTest');
    leakTest.forEach((server) => {
      server.geo = t('dnsleaktest.StatusWait');
      server.ip = t('dnsleaktest.StatusWait');
      server.country = t('dnsleaktest.StatusWait');
      server.country_code = '';
      server.org = t('dnsleaktest.StatusWait');
    });
  }

  const delayedFetch = (fetchFunction, index, key, delay) => new Promise((resolve) => {
    setTimeout(() => {
      fetchFunction(index, key).then(resolve).catch(resolve);
    }, delay);
  });

  const promises = [
    delayedFetch(fetchLeakTestIpApiCom, 0, null, 100),
    delayedFetch(fetchLeakTestIpApiCom, 1, null, 1000),
    delayedFetch(fetchLeakTestSfSharkCom, 2, 0, 100),
    delayedFetch(fetchLeakTestSfSharkCom, 3, 0, 1000),
  ];

  const allSettledPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));

  return Promise.race([allSettledPromise, timeoutPromise]).then(() => {
    store.setLoadingStatus('dnsleaktest', true);
  });
};

onMounted(() => {
  store.setMountingStatus('dnsleaktest', true);
});

defineExpose({
  checkAllDNSLeakTest,
  leakTest,
});
</script>

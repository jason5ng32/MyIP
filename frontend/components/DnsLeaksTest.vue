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
            
            <span class="font-mono text-muted-foreground ">#{{ index + 1 }}</span>
          </div>
          </div>

          <!-- 端点状态行：解析成功时才显示 "DNS Endpoint: 1.2.3.4"，
               等待/错误态直接显示状态文字，省掉无意义的 label 前缀 -->
          <div class="flex items-start gap-1.5 text-base mb-3">
            <span class="relative flex shrink-0 mt-[0.5em]">
              <span v-if="toneOf(leak) === 'wait'"
                class="absolute inline-flex size-2 rounded-full bg-sky-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(leak))"></span>
            </span>
            <span class="break-all">
              <template v-if="isResolved(leak)">
                <span class="text-muted-foreground">{{ t('dnsleaktest.Endpoint') }}:</span>
                <span class="font-mono ml-1" :class="textClass(toneOf(leak))">{{ leak.ip }}</span>
              </template>
              <span v-else :class="textClass(toneOf(leak))">{{ leak.ip }}</span>
            </span>
          </div>

          <!-- ISP + Country 子块：dt 配图标做视觉锚点；
               等待/错误态字段显示 —，不复述状态文字 -->
          <dl class="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
            <div>
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Building2 class="size-3.5" />
                <span>{{ t('ipInfos.ISP') }}</span>
              </dt>
              <dd class="font-medium break-words" :title="leak.org">
                <span v-if="!isFieldPending(leak.org)">{{ leak.org }}</span>
                <span v-else class="text-muted-foreground font-normal">—</span>
              </dd>
            </div>
            <div>
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin class="size-3.5" />
                <span>{{ t('ipInfos.Country') }}</span>
              </dt>
              <dd class="font-medium flex items-center gap-1.5 flex-wrap">
                <template v-if="!isFieldPending(leak.country)">
                  <Icon v-if="leak.country_code"
                    :icon="'circle-flags:' + leak.country_code.toLowerCase()"
                    class="shrink-0 size-4" />
                  <span class="break-words">{{ leak.country }}</span>
                </template>
                <span v-else class="text-muted-foreground font-normal">—</span>
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
import { Building2, ChevronRight, HeartPulse, MapPin, RotateCw } from 'lucide-vue-next';
import { Icon } from '@iconify/vue';


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

// dl 子块里单个字段是否处于"无数据"态（等待/错误/空）
const isFieldPending = (value) => {
  return !value || value === t('dnsleaktest.StatusWait') || value === t('dnsleaktest.StatusError');
};
// 整张卡是否已经解析出了真实 endpoint（不在 wait/fail 态）
const isResolved = (leak) => toneOf(leak) === 'ok-fast';

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

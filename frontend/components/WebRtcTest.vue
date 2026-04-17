<template>
  <!-- WebRTC Test — 与 Connectivity 一致的 service-status-card 结构 -->
  <section class="mb-10">
    <!-- 章节头 -->
    <header class="flex items-start justify-between gap-4 mb-3">
      <div class="flex-1 min-w-0">
        <h2 id="WebRTC" class="text-xl md:text-2xl font-semibold tracking-tight leading-tight">
          🚥 {{ t('webrtc.Title') }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('webrtc.Note') }}</p>
      </div>
      <JnTooltip :text="t('Tooltips.RefreshWebRTC')" side="left">
        <Button size="icon" variant="outline" class="shrink-0"
          @click="checkAllWebRTC(true)"
          aria-label="Refresh WebRTC Test">
          <component :is="isStarted ? RotateCw : ChevronRight" />
        </Button>
      </JnTooltip>
    </header>

    <!-- 卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card v-for="stun in stunServers" :key="stun.id"
        class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <CardContent class="p-4">
          <!-- 顶部：服务商 icon + 名字 -->
          <div class="flex items-center gap-2 mb-1">
            <Merge class="size-6 text-muted-foreground shrink-0" />
            <span class="text-base font-medium truncate">{{ stun.name }}</span>
          </div>

          <!-- STUN URL（次要信息） -->
          <p class="text-xs font-mono text-muted-foreground mb-3 truncate" :title="stun.url">
            {{ stun.url }}
          </p>

          <!-- IP 行 -->
          <div class="flex items-center gap-1.5 text-base mb-3 min-w-0">
            <span class="relative flex shrink-0">
              <span v-if="toneOf(stun) === 'wait'"
                class="absolute inline-flex size-2 rounded-full bg-sky-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(stun))"></span>
            </span>
            <span class="truncate font-mono" :class="textClass(toneOf(stun))">{{ stun.ip }}</span>
          </div>

          <!-- NAT + Country 子块 -->
          <dl v-if="stun.natType" class="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
            <div class="flex items-baseline justify-between gap-2 min-w-0">
              <dt class="text-muted-foreground shrink-0">NAT</dt>
              <dd class="truncate text-right font-medium"
                :class="{ 'text-muted-foreground': stun.natType === t('webrtc.StatusWait') }">
                {{ stun.natType }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-2 min-w-0">
              <dt class="text-muted-foreground shrink-0">{{ t('ipInfos.Country') }}</dt>
              <dd class="flex items-center gap-1.5 min-w-0 font-medium">
                <span v-if="stun.country_code" :class="'fi fi-' + stun.country_code" class="shrink-0"></span>
                <span class="truncate"
                  :class="{ 'text-muted-foreground': stun.country === t('webrtc.StatusWait') || stun.country === t('webrtc.StatusError') }">
                  {{ stun.country }}
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
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import getCountryName from '@/utils/country-name.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { ChevronRight, Merge, RotateCw } from 'lucide-vue-next';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);
const { dotClass, textClass } = useStatusTone();

const isStarted = ref(false);
const IPArray = ref([]);
const stunServers = reactive([
  { id: 'google',     name: 'Google',     url: 'stun.l.google.com:19302',       ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
  { id: 'blackberry', name: 'BlackBerry', url: 'stun.voip.blackberry.com:3478', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
  { id: 'twilio',     name: 'Twilio',     url: 'global.stun.twilio.com',        ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
  { id: 'cloudflare', name: 'Cloudflare', url: 'stun.cloudflare.com',           ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
]);

// 业务状态 → 4 档 tone
const toneOf = (stun) => {
  if (stun.ip === t('webrtc.StatusWait')) return 'wait';
  if (stun.ip === t('webrtc.StatusError')) return 'fail';
  if (stun.ip.includes('.') || stun.ip.includes(':')) return 'ok-fast';
  return 'wait';
};

// 测试 STUN 服务器
const checkSTUNServer = async (stun) => {
  return new Promise((resolve, reject) => {
    try {
      const servers = { iceServers: [{ urls: 'stun:' + stun.url }] };
      const pc = new RTCPeerConnection(servers);
      let candidateReceived = false;

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          candidateReceived = true;
          const candidate = event.candidate.candidate;
          const ipMatch = /([0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f]{0,4}(:[0-9a-f]{1,4}){0,6}::[0-9a-f]{0,4}|::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}|[0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(candidate);
          if (ipMatch) {
            stun.ip = ipMatch[0];
            try {
              const countryInfo = await fetchCountryCode(stun.ip);
              stun.country_code = countryInfo[0];
              stun.country = countryInfo[1];
            } catch (error) {
              console.error('Error fetching country code:', error);
              reject(error);
              pc.close();
              return;
            }
            IPArray.value = [...IPArray.value, stun.ip];
            stun.natType = determineNATType(candidate);
            pc.close();
            resolve();
          }
        }
      };

      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      setTimeout(() => {
        if (!candidateReceived) {
          pc.close();
          reject(new Error('Stun Server Test Timeout'));
        }
      }, 5000);
    } catch (error) {
      console.error('STUN Server Test Error:', error);
      stun.ip = t('webrtc.StatusError');
      reject(error);
    }
  });
};

// 分析 ICE 候选信息，推断 NAT 类型
const determineNATType = (candidate) => {
  const parts = candidate.split(' ');
  const type = parts[7];
  if (type === 'host')  return t('webrtc.NATType.host');
  if (type === 'srflx') return t('webrtc.NATType.srflx');
  if (type === 'prflx') return t('webrtc.NATType.prflx');
  if (type === 'relay') return t('webrtc.NATType.relay');
  return t('webrtc.NATType.unknown');
};

// 通过 Maxmind 获取 IP 地区归属
const fetchCountryCode = async (ip) => {
  let setLang = lang.value;
  if (setLang === 'zh') setLang = 'zh-CN';
  const source = store.ipDBs.find((s) => s.text === 'MaxMind');

  try {
    const url = store.getDbUrl(source.id, ip, setLang);
    const response = await fetch(url);
    const data = await response.json();
    const ipData = transformDataFromIPapi(data, source.id, t, lang.value);
    if (ipData) {
      const country_code = ipData.country_code.toLowerCase();
      let country = ipData.country_code || 'N/A';
      if (country !== 'N/A') country = getCountryName(ipData.country_code, lang.value);
      return [country_code, country];
    }
  } catch (error) {
    console.error('Error fetching IP country code', error);
  }
};

// 测试所有 STUN 服务器
const checkAllWebRTC = async (isRefresh) => {
  if (isRefresh) trackEvent('Section', 'RefreshClick', 'WebRTC');
  isStarted.value = true;
  const promises = stunServers.map((server) => {
    server.ip = t('webrtc.StatusWait');
    server.natType = t('webrtc.StatusWait');
    server.country = t('webrtc.StatusWait');
    server.country_code = '';
    return checkSTUNServer(server);
  });

  const allSettledPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));
  return Promise.race([allSettledPromise, timeoutPromise]).then(() => {
    store.setLoadingStatus('webrtc', true);
  });
};

onMounted(() => {
  store.setMountingStatus('webrtc', true);
});

watch(IPArray, () => {
  store.updateAllIPs(IPArray.value);
}, { deep: true });

defineExpose({
  checkAllWebRTC,
  stunServers,
});
</script>

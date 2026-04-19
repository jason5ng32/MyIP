<template>
  <section class="mb-10">
    <!-- Header -->
    <header class="flex items-start justify-between gap-4 mb-3">
      <div class="flex-1 min-w-0">
        <h2 id="WebRTC" class="text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚥 {{ t('webrtc.Title') }}
        </h2>
        <p class="my-3 text-base text-muted-foreground">{{ t('webrtc.Note') }}</p>
      </div>
      <JnTooltip :text="t('Tooltips.RefreshWebRTC')" side="left">
        <Button size="icon" variant="outline" class="shrink-0 cursor-pointer" @click="checkAllWebRTC(true)"
          aria-label="Refresh WebRTC Test">
          <component :is="isStarted ? RotateCw : ChevronRight" />
        </Button>
      </JnTooltip>
    </header>

    <!-- Card grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card v-for="stun in stunServers" :key="stun.id"
        class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <CardContent class="p-4">
          <!-- Top: service provider icon + name -->
          <div class="flex items-center gap-2 mb-1">
            <Merge class="size-6 text-muted-foreground shrink-0" />
            <span class="text-base font-medium truncate">{{ stun.name }}</span>
          </div>

          <!-- STUN URL (secondary information) -->
          <p class="text-xs font-mono text-muted-foreground mb-3 break-all" :title="stun.url">
            {{ stun.url }}
          </p>

          <!-- IP -->
          <div class="flex items-center gap-1.5 text-base mb-3 min-w-0 min-h-6">
            <span class="relative flex shrink-0">
              <span v-if="toneOf(stun) === 'wait'"
                class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
              <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(stun))"></span>
            </span>
            <span class="font-mono whitespace-nowrap truncate min-w-0"
              :class="[fitOneLineClass(stun.ip), textClass(toneOf(stun))]" :title="stun.ip">{{ stun.ip }}</span>
          </div>

          <!-- NAT + Country -->
          <dl v-if="stun.natType" class="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
            <div>
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Network class="size-3.5" />
                <span>NAT</span>
              </dt>
              <dd class="font-medium wrap-break-word">
                <span v-if="!isFieldPending(stun.natType)">{{ stun.natType }}</span>
                <span v-else class="text-muted-foreground font-normal">—</span>
              </dd>
            </div>
            <div>
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin class="size-3.5" />
                <span>{{ t('ipInfos.Country') }}</span>
              </dt>
              <dd class="font-medium flex items-center gap-1.5 flex-wrap">
                <template v-if="!isFieldPending(stun.country)">
                  <Icon v-if="stun.country_code" :icon="'circle-flags:' + stun.country_code" class="shrink-0 size-4" />
                  <span class="wrap-break-word">{{ stun.country }}</span>
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
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import getCountryName from '@/data/country-name.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { ChevronRight, MapPin, Merge, Network, RotateCw } from 'lucide-vue-next';
import { Icon } from '@iconify/vue';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);
const { dotClass, textClass } = useStatusTone();

const isStarted = ref(false);
const IPArray = ref([]);
const stunServers = reactive([
  { id: 'google', name: 'Google', url: 'stun.l.google.com:19302', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
  { id: 'blackberry', name: 'BlackBerry', url: 'stun.voip.blackberry.com:3478', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
  { id: 'twilio', name: 'Twilio', url: 'global.stun.twilio.com', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
  { id: 'cloudflare', name: 'Cloudflare', url: 'stun.cloudflare.com', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '' },
]);

// Business status → 4 tone levels
const toneOf = (stun) => {
  if (stun.ip === t('webrtc.StatusWait')) return 'wait';
  if (stun.ip === t('webrtc.StatusError')) return 'fail';
  if (stun.ip.includes('.') || stun.ip.includes(':')) return 'ok-fast';
  return 'wait';
};

// Single field in dl block is in "no data" state (waiting/error)
// These fields may fail independently (e.g. IP success but country query fails), so determine by field.
const isFieldPending = (value) => {
  return !value || value === t('webrtc.StatusWait') || value === t('webrtc.StatusError');
};

// IP font size downgrade: IPv4 ≤15 characters keep base; short compressed IPv6 down to sm; full IPv6 (max 39 characters) down to xs
// Ensure full line display, without line breaks due to IPv6.
const fitOneLineClass = (text) => {
  const len = typeof text === 'string' ? text.length : 0;
  if (len <= 15) return 'text-base';
  if (len <= 26) return 'text-sm';
  return 'text-xs';
};

// Test STUN server
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
              stun.country = t('webrtc.StatusError');
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

      // STUN timeout (5s no candidate received): mark ip / natType / country as connection error
      setTimeout(() => {
        if (!candidateReceived) {
          stun.ip = t('webrtc.StatusError');
          stun.natType = t('webrtc.StatusError');
          stun.country = t('webrtc.StatusError');
          pc.close();
          reject(new Error('Stun Server Test Timeout'));
        }
      }, 5000);
    } catch (error) {
      console.error('STUN Server Test Error:', error);
      stun.ip = t('webrtc.StatusError');
      stun.natType = t('webrtc.StatusError');
      stun.country = t('webrtc.StatusError');
      reject(error);
    }
  });
};

// Analyze ICE candidate information, infer NAT type
const determineNATType = (candidate) => {
  const parts = candidate.split(' ');
  const type = parts[7];
  if (type === 'host') return t('webrtc.NATType.host');
  if (type === 'srflx') return t('webrtc.NATType.srflx');
  if (type === 'prflx') return t('webrtc.NATType.prflx');
  if (type === 'relay') return t('webrtc.NATType.relay');
  return t('webrtc.NATType.unknown');
};

// Get IP country via Maxmind
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

// Test all STUN servers
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

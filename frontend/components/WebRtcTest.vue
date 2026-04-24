<template>
  <section class="mb-10">
    <!-- Header -->
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="WebRTC"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚥 {{ t('webrtc.Title') }}
        </h2>
        <JnTooltip :text="t('Tooltips.RefreshWebRTC')" side="left">
          <Button size="icon" variant="outline" class="shrink-0 cursor-pointer" @click="checkAllWebRTC(true)"
            aria-label="Refresh WebRTC Test">
            <component :is="isStarted ? RotateCw : Play" />
          </Button>
        </JnTooltip>
      </div>
      <div class="text-base text-muted-foreground">
        <p>{{ t('webrtc.Note') }}</p>
      </div>
    </header>

    <!-- Card grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card v-for="stun in stunServers" :key="stun.id"
        class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <CardContent class="p-4">
          <!-- Top: service provider icon + name -->
          <div class="flex items-center gap-2 mb-1">
            <Flower class="size-6 text-muted-foreground shrink-0" />
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
            <FitText :text="stun.ip" :tiers="INLINE_TIERS" :title="stun.ip"
              class="font-mono min-w-0"
              :class="textClass(toneOf(stun))" />
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
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import getCountryName from '@/data/country-name.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStatusTone, ipFieldTone } from '@/composables/use-status-tone.js';
import { Play, MapPin, Flower, Network, RotateCw } from 'lucide-vue-next';
import { Icon } from '@iconify/vue';
import FitText from '@/components/widgets/FitText.vue';
import { INLINE_TIERS } from '@/composables/use-fit-text.js';

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

// Regex extracting the IP portion out of an ICE candidate line
// (full SDP grammar not needed — just IPv4 / IPv6 with common forms).
const CANDIDATE_IP_RE = /([0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f]{0,4}(:[0-9a-f]{1,4}){0,6}::[0-9a-f]{0,4}|::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}|[0-9]{1,3}(\.[0-9]{1,3}){3})/i;

// Track in-flight RTCPeerConnections so they can all be closed on unmount.
// Without this, navigating away mid-test would leave each pc (and its
// ICE gathering machinery) lingering until GC. Entries are added when
// the connection is created and removed once it's closed.
const activeConnections = new Set();

// Business status → 4 tone levels
const toneOf = (stun) => ipFieldTone(stun.ip, {
  waitLabels: t('webrtc.StatusWait'),
  errorLabels: t('webrtc.StatusError'),
});

// Single field in dl block is in "no data" state (waiting/error).
// Fields may fail independently (e.g. IP success but country lookup fails),
// so the check is run per-field in the template.
const isFieldPending = (value) => {
  return !value
    || value === t('webrtc.StatusWait')
    || value === t('webrtc.StatusError');
};

// Run a STUN test against one server. ICE gathering with a 5s backstop.
//
// Success criteria: receive a server-reflexive ('srflx') or peer-reflexive
// ('prflx') candidate with an extractable IP. That IP is what the STUN
// server reported; host candidates don't prove STUN worked (the browser
// emits them regardless) and must not be shown as the "STUN IP".
//
// Any non-success path — 5s elapsed without srflx / prflx, or an
// unexpected throw in the try/catch — collapses to StatusError.
// Distinguishing "timeout" vs "mDNS privacy" looks tempting but the
// two conditions are independent (mDNS privacy can be on while STUN
// still works via srflx, and vice versa), so a split label produces
// false positives — we deliberately stay vague here.
const checkSTUNServer = (stun) => {
  return new Promise((resolve) => {
    let pc = null;
    let timer = null;
    let settled = false;

    const finish = () => {
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (pc) {
        pc.close();
        activeConnections.delete(pc);
      }
      resolve();
    };

    const failWith = (statusKey) => {
      if (settled) return;
      const label = t(`webrtc.${statusKey}`);
      stun.ip = label;
      stun.natType = label;
      stun.country = label;
      stun.country_code = '';
      finish();
    };

    const succeedWith = async (ip, candidate) => {
      if (settled) return;
      // Mark settled now so a late candidate can't double-resolve,
      // but keep pc / timer alive until the country lookup returns.
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      stun.ip = ip;
      stun.natType = determineNATType(candidate);
      IPArray.value = [...IPArray.value, ip];
      // fetchCountryCode swallows its own errors and returns null on miss,
      // so a single null check handles both "no MaxMind source" and
      // "upstream failure" paths.
      const countryInfo = await fetchCountryCode(ip);
      if (countryInfo) {
        stun.country_code = countryInfo[0];
        stun.country = countryInfo[1];
      } else {
        stun.country = t('webrtc.StatusError');
      }
      if (pc) {
        pc.close();
        activeConnections.delete(pc);
      }
      resolve();
    };

    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:' + stun.url }] });
      activeConnections.add(pc);

      pc.onicecandidate = (event) => {
        if (!event.candidate || settled) return;  // null = end-of-candidates
        const candidate = event.candidate.candidate;
        const type = candidate.split(' ')[7];

        // Only server-reflexive / peer-reflexive candidates represent a
        // STUN answer. Host candidates (with or without mDNS) don't prove
        // STUN worked and we must not display them as the "STUN IP".
        if (type !== 'srflx' && type !== 'prflx') return;

        const ipMatch = CANDIDATE_IP_RE.exec(candidate);
        if (!ipMatch) return;
        succeedWith(ipMatch[0], candidate);
      };

      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      timer = setTimeout(() => {
        timer = null;
        failWith('StatusError');
      }, 5000);
    } catch (error) {
      console.error('STUN Server Test Error:', error);
      failWith('StatusError');
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

// Get IP country via Maxmind. Returns [country_code, country_name] on a
// successful lookup, or null on any miss (missing MaxMind source, empty
// upstream response, network error). Callers use the null as the signal
// to surface an Error label — no TypeError round-trip through a catch.
const fetchCountryCode = async (ip) => {
  const source = store.ipDBs.find((s) => s.text === 'MaxMind');
  if (!source) return null;
  let setLang = lang.value;
  if (setLang === 'zh') setLang = 'zh-CN';

  try {
    const url = store.getDbUrl(source.id, ip, setLang);
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    const ipData = transformDataFromIPapi(data, source.id, t, lang.value);
    if (!ipData) return null;
    const country_code = ipData.country_code.toLowerCase();
    const country = ipData.country_code
      ? getCountryName(ipData.country_code, lang.value)
      : 'N/A';
    return [country_code, country];
  } catch (error) {
    console.error('Error fetching IP country code', error);
    return null;
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

// Close any still-open peer connections if the component unmounts
// mid-test — otherwise ICE gathering keeps running for seconds and
// callbacks fire on refs that no longer exist.
onBeforeUnmount(() => {
  activeConnections.forEach((pc) => pc.close());
  activeConnections.clear();
});

watch(IPArray, () => {
  store.updateAllIPs(IPArray.value);
}, { deep: true });

defineExpose({
  checkAllWebRTC,
  stunServers,
});
</script>

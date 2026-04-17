<template>
  <!-- WebRTC Test -->
  <div class="webrtc-test-section mb-4">
    <div class="jn-title2">
      <h2 id="WebRTC" :class="{ 'mobile-h2': isMobile }">🚥 {{ t('webrtc.Title') }}</h2>
      <JnTooltip :text="t('Tooltips.RefreshWebRTC')" side="left">
        <Button size="icon" variant="outline"
          @click="checkAllWebRTC(true)" aria-label="Refresh WebRTC Test">
          <i class="bi" :class="[isStarted ? 'bi-arrow-clockwise' : 'bi-caret-right-fill']"></i>
        </Button>
      </JnTooltip>
    </div>
    <div class="text-neutral-500">
      <p>{{ t('webrtc.Note') }}</p>
    </div>
    <div class="flex flex-wrap -mx-2">
      <div v-for="stun in stunServers" :key="stun.id" class="w-full md:w-1/2 lg:w-1/4 px-2 mb-4">
        <div class="jn-card keyboard-shortcut-card rounded-lg border bg-card text-card-foreground"
          :class="{ 'jn-hover-card': !isMobile }">
          <div class="p-4">
            <p class="jn-con-title mb-1"><i class="bi bi-sign-merge-left-fill"></i> {{ stun.name }}</p>
            <p class="text-neutral-500 mb-2" style="font-size: 10pt;">
              <i class="bi bi-hdd-network-fill"></i> {{ stun.url }}
            </p>
            <p class="mb-2" :class="{
              'text-sky-600': stun.ip === t('webrtc.StatusWait'),
              'text-green-600': stun.ip.includes('.') || stun.ip.includes(':'),
              'text-red-600': stun.ip === t('webrtc.StatusError')
            }">
              <i class="bi" :class="[stun.ip === t('webrtc.StatusWait') ? 'bi-hourglass-split' : 'bi-pc-display-horizontal']">&nbsp;</i>
              <span :class="{ 'jn-ip-font': stun.ip.length > 32 }"> {{ stun.ip }}</span>
            </p>
            <div v-if="stun.natType" class="flex flex-col px-3 py-2 rounded-md border"
              :class="stun.natType === t('webrtc.StatusWait')
                ? 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200'
                : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'">
              <span>
                <i class="bi" :class="[stun.natType === t('webrtc.StatusWait') ? 'bi-hourglass-split' : 'bi-controller']"></i>
                NAT: {{ stun.natType }}
              </span>

              <span class="mt-2">
                <i class="bi"
                  :class="[stun.country === t('webrtc.StatusWait') || stun.country === t('webrtc.StatusError') ? 'bi-hourglass-split' : 'bi-geo-alt-fill']"></i>
                {{ t('ipInfos.Country') }}:
                <span :class="[stun.country !== t('webrtc.StatusWait') ? 'font-bold' : '']">{{ stun.country }}&nbsp;</span>
                <span v-show="stun.country_code" :class="'jn-fl fi fi-' + stun.country_code"></span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
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

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);


const isStarted = ref(false);
const IPArray = ref([]);
const stunServers = reactive([
  {
    id: "google",
    name: "Google",
    url: "stun.l.google.com:19302",
    ip: t('webrtc.StatusWait'),
    natType: t('webrtc.StatusWait'),
    country: t('webrtc.StatusWait'),
    country_code: '',
  },
  {
    id: "blackberry",
    name: "BlackBerry",
    url: "stun.voip.blackberry.com:3478",
    ip: t('webrtc.StatusWait'),
    natType: t('webrtc.StatusWait'),
    country: t('webrtc.StatusWait'),
    country_code: '',
  },
  {
    id: "twilio",
    name: "Twilio",
    url: "global.stun.twilio.com",
    ip: t('webrtc.StatusWait'),
    natType: t('webrtc.StatusWait'),
    country: t('webrtc.StatusWait'),
    country_code: '',
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    url: "stun.cloudflare.com",
    ip: t('webrtc.StatusWait'),
    natType: t('webrtc.StatusWait'),
    country: t('webrtc.StatusWait'),
    country_code: '',
  },
]);


// 测试 STUN 服务器
const checkSTUNServer = async (stun) => {
  return new Promise((resolve, reject) => {
    try {
      const servers = { iceServers: [{ urls: 'stun:' + stun.url }] };
      const pc = new RTCPeerConnection(servers);
      let candidateReceived = false;

      // 分别获取 STUN 服务器的 IP 地址和 NAT 类型
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          candidateReceived = true;
          const candidate = event.candidate.candidate;
          const ipMatch = /([0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f]{0,4}(:[0-9a-f]{1,4}){0,6}::[0-9a-f]{0,4}|::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}|[0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(candidate);
          if (ipMatch) {
            stun.ip = ipMatch[0];
            try {
              let countryInfo = await fetchCountryCode(stun.ip);
              stun.country_code = countryInfo[0];
              stun.country = countryInfo[1];
            } catch (error) {
              console.error("Error fetching country code:", error);
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

      pc.createDataChannel("");
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      // 设置一个超时计时器来拒绝 Promise
      setTimeout(() => {
        if (!candidateReceived) {
          pc.close();
          reject(new Error("Stun Server Test Timeout"));
        }
      }, 5000);
    } catch (error) {
      console.error("STUN Server Test Error:", error);
      stun.ip = t('webrtc.StatusError');
      reject(error);
    }
  });
};


// 分析ICE候选信息，推断NAT类型
const determineNATType = (candidate) => {
  const parts = candidate.split(' ');
  const type = parts[7];

  if (type === 'host') {
    return t('webrtc.NATType.host');
  } else if (type === 'srflx') {
    return t('webrtc.NATType.srflx');
  } else if (type === 'prflx') {
    return t('webrtc.NATType.prflx');
  } else if (type === 'relay') {
    return t('webrtc.NATType.relay');
  } else {
    return t('webrtc.NATType.unknown');
  }
};

// 通过 Maxmind 获取 IP 地区归属
const fetchCountryCode = async (ip) => {
  let setLang = lang.value;
  if (setLang === 'zh') {
    setLang = 'zh-CN';
  }
  const source = store.ipDBs.find(source => source.text === "MaxMind");

  try {
    const url = store.getDbUrl(source.id, ip, setLang);
    const response = await fetch(url);
    const data = await response.json();
    const ipData = transformDataFromIPapi(data, source.id, t, lang.value);

    if (ipData) {
      let country_code = ipData.country_code.toLowerCase();
      let country = ipData.country_code || 'N/A';
      if (country !== 'N/A') {
        country = getCountryName(ipData.country_code, lang.value); 
      }
      return [country_code, country];
    }
  } catch (error) {
    console.error("Error fetching IP country code", error);
  }
}


// 测试所有 STUN 服务器
const checkAllWebRTC = async (isRefresh) => {
  if (isRefresh) {
    trackEvent('Section', 'RefreshClick', 'WebRTC');
  }
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
  stunServers
});

</script>

<style scoped></style>

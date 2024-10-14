<template>
  <!-- WebRTC Test -->
  <div class="webrtc-test-section mb-4">
    <div class="jn-title2">
      <h2 id="WebRTC" :class="{ 'mobile-h2': isMobile }">🚥 {{ t('webrtc.Title') }}</h2>
      <button @click="checkAllWebRTC(true)" :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
        aria-label="Refresh WebRTC Test" v-tooltip="t('Tooltips.RefreshWebRTC')">
        <i class="bi" :class="[isStarted ? 'bi-arrow-clockwise' : 'bi-caret-right-fill']"></i>
      </button>
    </div>
    <div class="text-secondary">
      <p>{{ t('webrtc.Note') }}</p>
    </div>
    <div class="row">
      <div v-for="stun in stunServers" :key="stun.id" class="col-lg-3 col-md-6 col-12 mb-4">
        <div class="card jn-card keyboard-shortcut-card"
          :class="{ 'dark-mode dark-mode-border': isDarkMode, 'jn-hover-card': !isMobile }">
          <div class="card-body">
            <p class="card-title jn-con-title"><i class="bi bi-sign-merge-left-fill"></i> {{ stun.name }}</p>
            <p class="card-text text-secondary" style="font-size: 10pt;"><i class="bi bi-hdd-network-fill"></i> {{
              stun.url }}</p>
            <p class="card-text" :class="{
              'text-info': stun.ip === t('webrtc.StatusWait'),
              'text-success': stun.ip.includes('.') || stun.ip.includes(':'),
              'text-danger': stun.ip === t('webrtc.StatusError')
            }">
              <i class="bi"
                :class="[stun.ip === t('webrtc.StatusWait') ? 'bi-hourglass-split' : 'bi-pc-display-horizontal']">&nbsp;</i>
              <span :class="{ 'jn-ip-font': stun.ip.length > 32 }"> {{ stun.ip }}
              </span>

            </p>
            <div v-if="stun.natType" class="alert d-flex flex-column" :class="{
              'alert-info': stun.natType === t('webrtc.StatusWait'),
              'alert-success': stun.natType !== t('webrtc.StatusWait'),
            }" :data-bs-theme="isDarkMode ? 'dark' : ''">
              <span>
                <i class="bi"
                  :class="[stun.natType === t('webrtc.StatusWait') ? 'bi-hourglass-split' : ' bi-controller']"></i> NAT:
                {{
                stun.natType }}
              </span>

              <span class="mt-2">
                <i class="bi"
                  :class="[stun.country === t('webrtc.StatusWait') || stun.country === t('webrtc.StatusError') ? 'bi-hourglass-split' : 'bi-geo-alt-fill']"></i>
                {{ t('ipInfos.Country') }}: <span :class="[ stun.country !== t('webrtc.StatusWait') ? 'fw-bold':'']">{{
                  stun.country }}&nbsp;</span>
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

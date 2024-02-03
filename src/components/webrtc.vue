<template>
  <!-- WebRTC Test -->
  <div class="webrtc-test-section mb-4">
    <div class="jn-title2">
      <h2 id="WebRTC" :class="{ 'mobile-h2': isMobile }">🚥 {{ $t('webrtc.Title') }}</h2>
      <button @click="checkAllWebRTC(true)" :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"><i
          class="bi bi-arrow-clockwise"></i></button>
    </div>
    <div class="text-secondary">
      <p>{{ $t('webrtc.Note') }}</p>
    </div>
    <div class="row">
      <div v-for="stun in stunServers" :key="stun.id" class="col-6 col-md-3 mb-4">
        <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">
            <h5 class="card-title"><i class="bi bi-sign-merge-left-fill"></i> {{ stun.name }}</h5>
            <p class="card-text text-secondary" style="font-size: 10pt;"><i class="bi bi-hdd-network-fill"></i> {{
              stun.url }}</p>
            <p class="card-text" :class="{
              'text-info': stun.ip === $t('webrtc.StatusWait'),
              'text-success': stun.ip.includes('.') || stun.ip.includes(':'),
              'text-danger': stun.ip === $t('webrtc.StatusError')
            }" v-html="stun.ip"></p>
            <p class="card-text text-success" v-html="stun.natType"></p>
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
  name: 'WebRTC',

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
      stunServers: [
        {
          id: "google",
          name: "Google 1",
          url: "stun.l.google.com:19302",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "google",
          name: "Google 2",
          url: "stun2.l.google.com:19302",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "nextcloud",
          name: "NxtCld",
          url: "stun.nextcloud.com:443",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "twilio",
          name: "Twilio",
          url: "global.stun.twilio.com",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "cloudflare",
          name: "Cloudflare",
          url: "stun.cloudflare.com",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "miwifi",
          name: "MiWiFi",
          url: "stun.miwifi.com",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "qq",
          name: "QQ",
          url: "stun.qq.com",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
        {
          id: "stunprotocol",
          name: "StnPtc",
          url: "stunserver.stunprotocol.org",
          ip: this.$t('webrtc.StatusWait'),
          natType: "",
        },
      ],
    }
  },

  methods: {

    // 测试 STUN 服务器
    async checkSTUNServer(stun) {
      try {
        const servers = { iceServers: [{ urls: 'stun:' + stun.url }] };
        const pc = new RTCPeerConnection(servers);
        let candidateReceived = false;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidateReceived = true;
            const candidate = event.candidate.candidate;
            const ipMatch = /([0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f]{0,4}(:[0-9a-f]{1,4}){0,6}::[0-9a-f]{0,4}|::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}|[0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(candidate);
            if (ipMatch) {
              stun.ip = ipMatch[0];
              stun.natType = this.determineNATType(candidate);
              pc.close();
            }
          }
        };

        pc.createDataChannel("");
        await pc.createOffer().then((offer) => pc.setLocalDescription(offer));

        // 设置一个超时计时器
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            if (!candidateReceived) {
              reject(new Error("Stun Server Test Timeout"));
            } else {
              resolve();
            }
          }, 5000);
        });
      } catch (error) {
        console.error("STUN Server Test Error:", error);
        stun.ip = this.$t('webrtc.StatusError');
      }
    },

    // 分析ICE候选信息，推断NAT类型
    determineNATType(candidate) {
      const parts = candidate.split(' ');
      const type = parts[7];

      if (type === 'host') {
        return this.$t('webrtc.NATType.host');
      } else if (type === 'srflx') {
        return this.$t('webrtc.NATType.srflx');
      } else if (type === 'prflx') {
        return this.$t('webrtc.NATType.prflx');
      } else if (type === 'relay') {
        return this.$t('webrtc.NATType.relay');
      } else {
        return this.$t('webrtc.NATType.unknown');
      }
    },

    // 测试所有 STUN 服务器
    checkAllWebRTC(isRefresh) {
      this.stunServers.forEach((server) => {
        server.ip = this.$t('webrtc.StatusWait');
        server.natType = "";
        this.checkSTUNServer(server);
      });
      if (isRefresh) {
        this.$trackEvent('Section', 'RefreshClick', 'WebRTC');
      }
    },
  },
  mounted() {
    setTimeout(() => {
      this.checkAllWebRTC(false);
    }, 4000);
  },
}
</script>

<style scoped></style>

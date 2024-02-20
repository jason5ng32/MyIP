<template>
  <!-- Speed Test -->
  <div class="speed-test-section mb-4">
    <div class="jn-title2">
      <h2 id="SpeedTest" :class="{ 'mobile-h2': isMobile }">🚀 {{ $t('speedtest.Title') }}</h2>
      <button @click="startSpeedTest" :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
        aria-label="Start Speed Test" :disabled="speedTestStatus === 'running'" v-tooltip="$t('Tooltips.StartSpeedTest')">
        <i :class="speedTestStatus === 'running' ? 'bi bi-slash-circle' : 'bi bi-caret-right-fill'"></i>
      </button>

    </div>
    <div class="text-secondary">
      <p>{{ $t('speedtest.Note') }}</p>
    </div>
    <div class="row">
      <div class="col-12 mb-3">
        <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">
            <div class="progress" style="height: 20px; margin: 4pt 0 20pt 0;"
              :class="{ 'jn-opacity-0': speedTestStatus == 'idle', 'jn-progress-dark': isDarkMode }">
              <div class="progress-bar progress-bar-striped progress-bar-animated jn-progress"
                :class="[speedTestStatus === 'finished' ? 'bg-success' : 'bg-info']" role="progressbar" style="width: 0%;"
                aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="speedtest-progress" aria-label="Progress Bar">
              </div>
            </div>
            <div class="row" style="margin-bottom: 10pt;">
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Download') }}</p>
                <p id="download-speed" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.downloadSpeed }}</span>
                  <span v-if="speedTestStatus !== 'idle'">Mb/s</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Upload') }}</p>
                <p id="upload-speed" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.uploadSpeed }}</span>
                  <span v-if="speedTestStatus !== 'idle'">Mb/s</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Latency') }}</p>
                <p id="latency" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.latency }}</span>
                  <span v-if="speedTestStatus !== 'idle'">ms</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Jitter') }}</p>
                <p id="jitter" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.jitter }}</span>
                  <span v-if="speedTestStatus !== 'idle'">ms</span>
                </p>
              </div>
            </div>
            <div class="row alert alert-success m-1 p-2 " :data-bs-theme="isDarkMode ? 'dark' : ''"
              v-if="speedTestStatus === 'finished'">
              <p id="score" class="speedtest-p"><i class="bi bi-calendar2-check"></i> {{ $t('speedtest.score') }}
                {{ $t('speedtest.videoStreaming') }}
                <span :class="speedTest.streamingScore >= 50 ? 'text-success' : 'text-warning'">
                  {{ speedTest.streamingScore }}
                </span>
                {{ $t('speedtest.gaming') }}
                <span :class="speedTest.gamingScore >= 50 ? 'text-success' : 'text-warning'">
                  {{ speedTest.gamingScore }}
                </span>
                {{ $t('speedtest.rtc') }}
                <span :class="speedTest.rtcScore >= 50 ? 'text-success' : 'text-warning'">
                  {{ speedTest.rtcScore }}
                </span>
                {{ $t('speedtest.resultNote') }}
              </p>
            </div>
            <div id="result"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

// 引入 SpeedTest
import SpeedTestEngine from '@cloudflare/speedtest';

export default {
  name: 'SpeedTest',

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
      speedTest: {
        id: "speedTest",
        downloadSpeed: "-",
        uploadSpeed: "-",
        latency: "-",
        jitter: "-",
        streamingScore: "-",
        gamingScore: "-",
        rtcScore: "-",
      },
      speedTestStatus: 'idle',
    };
  },

  methods: {

    // 更新 Speed Test 结果
    updateSpeedTestResults(results) {
      const summary = results.getSummary();

      this.speedTest.downloadSpeed = parseFloat((summary.download / 1000000).toFixed(2));
      this.speedTest.uploadSpeed = parseFloat((summary.upload / 1000000).toFixed(2));
      this.speedTest.latency = parseFloat(summary.latency.toFixed(2));
      this.speedTest.jitter = parseFloat(summary.jitter.toFixed(2));
    },

    // 更新 Speed Test 进度条颜色
    updateSpeedTestColor(status) {
      switch (status) {
        case 'idle':
          return 'text-secondary';
        case 'running':
          return 'text-info';
        case 'finished':
          return 'text-success';
        case 'error':
          return 'text-danger';
        default:
          return '';
      }
    },

    // 重置 Speed Test
    resetSpeedTest() {
      const engine = new SpeedTestEngine({
        autoStart: false,
        measurements: [
          { type: 'latency', numPackets: 20 },
          { type: 'download', bytes: 5e7, count: 4 },
          { type: 'upload', bytes: 1.5e7, count: 3 }
        ]
      });
      return engine;
    },

    // 开始 Speed Test
    startSpeedTest() {
      const newEngine = this.resetSpeedTest();
      newEngine.onRunningChange = running => {
        this.speedTestStatus = "running";
        this.speedTest.downloadSpeed = 0;
        this.speedTest.uploadSpeed = 0;
        this.speedTest.latency = 0;
        this.speedTest.jitter = 0;
      };

      this.$trackEvent('Section', 'StartClick', 'SpeedTest');

      newEngine.onResultsChange = ({ type }) => {
        const rawData = newEngine.results.raw;

        // 进度条
        let progress = 0;
        const progressPerStage = 100 / 3;  // 将总进度平均分配到每个阶段

        if (rawData.download && rawData.download.started) {
          progress += rawData.download.finished ? progressPerStage : progressPerStage / 2;
        }
        if (rawData.upload && rawData.upload.started) {
          progress += rawData.upload.finished ? progressPerStage : progressPerStage / 2;
        }
        if (rawData.latency && rawData.latency.started) {
          progress += rawData.latency.finished ? progressPerStage : progressPerStage / 2;
        }

        // 确保进度不超过100%
        progress = Math.min(progress, 100);


        // 更新进度条
        const progressBar = document.getElementById('speedtest-progress');
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);

        // 更新下载速度
        if (rawData.download && rawData.download.results) {
          const downloadKeys = Object.keys(rawData.download.results);
          if (downloadKeys.length > 0) {
            const lastDownloadKey = downloadKeys[downloadKeys.length - 1];
            const downloadTimings = rawData.download.results[lastDownloadKey].timings;
            if (downloadTimings.length > 0) {
              const latestDownload = downloadTimings[downloadTimings.length - 1];
              const newDownloadSpeed = parseFloat((latestDownload.bps / 1000000).toFixed(2));
              if (newDownloadSpeed > this.speedTest.downloadSpeed) {
                this.speedTest.downloadSpeed = newDownloadSpeed;
              }
            }
          }
        }
        // 更新上传速度
        if (rawData.upload && rawData.upload.results) {
          const uploadKeys = Object.keys(rawData.upload.results);
          if (uploadKeys.length > 0) {
            const lastUploadKey = uploadKeys[uploadKeys.length - 1];
            const uploadTimings = rawData.upload.results[lastUploadKey].timings;
            if (uploadTimings.length > 0) {
              const latestUpload = uploadTimings[uploadTimings.length - 1];
              const newUploadSpeed = parseFloat((latestUpload.bps / 1000000).toFixed(2));
              if (newUploadSpeed > this.speedTest.uploadSpeed) {
                this.speedTest.uploadSpeed = newUploadSpeed;
              }
            }
          }
        }
        // 更新延迟
        if (rawData.latency && rawData.latency.results && rawData.latency.results.timings && rawData.latency.results.timings.length > 0) {
          const latencyTimings = rawData.latency.results.timings;
          const latestLatency = latencyTimings[latencyTimings.length - 1].ping;
          const newLatency = parseFloat(latestLatency.toFixed(2));
          if (newLatency < this.speedTest.latency || this.speedTest.latency === 0) {
            this.speedTest.latency = newLatency;
          }
        }
      };

      newEngine.onFinish = results => {
        this.speedTestStatus = "finished";
        this.updateSpeedTestResults(results);
        const scores = results.getScores();

        // 更新 Vue 实例的数据属性
        this.speedTest.streamingScore = scores.streaming.points;
        this.speedTest.gamingScore = scores.gaming.points;
        this.speedTest.rtcScore = scores.rtc.points;
      };

      newEngine.onError = (e) => {
        if (typeof e === 'string' && !e.includes("ICE")) {
          this.speedTestStatus = "error";
        }
        console.error('Speed Test Error: ', e);
      };

      newEngine.play();
    },

    // 刷新 Speed Test
    refreshstartSpeedTest() {
      if (this.speedTestStatus !== "running") {
        this.startSpeedTest();
      }
    },

  },

  mounted() {

  }
}
</script>

<style scoped></style>

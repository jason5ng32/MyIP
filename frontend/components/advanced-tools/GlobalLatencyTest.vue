<template>
  <!-- Ping Test -->
  <div class="ping-test-section mb-4">
    <div class="jn-title2">
      <h2 id="PingTest" :class="{ 'mobile-h2': isMobile }">⏱️ {{ t('pingtest.Title') }}</h2>

    </div>
    <div class="text-secondary">
      <p>{{ t('pingtest.Note') }}</p>
      <p v-if="!isMobile">{{ t('pingtest.Note2') }}</p>
    </div>
    <div class="row">
      <div class="col-12 mb-3">
        <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">
            <!-- Dropdown for IP Selection -->
            <div class="row mt-3 mb-3 align-items-center justify-content-center">
              <div class="col-12 col-md-auto">
                <label for="pingIP" class="col-form-label">{{ t('pingtest.Note3') }}</label>
              </div>
              <div class="col-12 col-md-auto mt-2 mt-md-0">
                <div class="input-group ">
                  <select id="pingIP" aria-label="Select IP to Ping" class="form-select jn-ping-form-select"
                    v-model="selectedIP" :class="{ 'bg-dark text-light': isDarkMode }">
                    <option disabled value="">{{ t('pingtest.SelectIP') }}</option>
                    <option v-for="ip in allIPs" :key="ip" :value="ip">{{ ip }}</option>
                  </select>

                  <button class="btn btn-primary" @click="startPingCheck"
                    :disabled="pingCheckStatus === 'running' || selectedIP === ''">
                    <span
                      v-if="pingCheckStatus === 'idle' || pingCheckStatus === 'finished' || pingCheckStatus === 'error'">{{
                      t('pingtest.Run') }}</span>
                    <span v-if="pingCheckStatus === 'running'" class="spinner-grow spinner-grow-sm"
                      aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Result Display -->
            <div id="pingresult" v-if="pingResults.length > 0">
              <div class="table-responsive text-nowrap">
                <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                  <thead>
                    <tr>
                      <th scope="col">{{ t('pingtest.Region') }}</th>
                      <th scope="col">{{ t('pingtest.MinDelay') }}</th>
                      <th scope="col">{{ t('pingtest.MaxDelay') }}</th>
                      <th scope="col">{{ t('pingtest.AvgDelay') }}</th>
                      <th scope="col">{{ t('pingtest.TotalPackets') }}</th>
                      <th scope="col">{{ t('pingtest.PacketLoss') }}</th>
                      <th scope="col">{{ t('pingtest.ReceivedPackets') }}</th>
                      <th scope="col">{{ t('pingtest.DroppedPackets') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="result in pingResults" :key="result.country">
                      <td>
                        <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>
                        {{ result.country_name }}
                      </td>
                      <td :class="result.stats.min < 100 ? 'text-success' : ''">{{ result.stats.min.toFixed(1) }}
                      </td>
                      <td :class="result.stats.max < 100 ? 'text-success' : ''">{{ result.stats.max.toFixed(1) }}
                      </td>
                      <td :class="result.stats.avg < 100 ? 'text-success' : ''">{{ result.stats.avg.toFixed(1) }}
                      </td>
                      <td>{{ result.stats.total }}</td>
                      <td>{{ Math.round(result.stats.loss) }}%</td>
                      <td>{{ result.stats.rcv }}</td>
                      <td>{{ result.stats.drop }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div id="svgMap"></div>

            <div id="pingresult-error" v-if="pingCheckStatus === 'error'">
              <div class="alert alert-info " :data-bs-theme="isDarkMode ? 'dark' : ''">{{ t('pingtest.Error') }}</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import svgMap from 'svgmap';
import 'svgmap/dist/svgMap.min.css';
import getCountryName from '@/utils/country-name.js';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
let allIPs = computed(() => {
  const _allIPs = store.allIPs;
  return _allIPs.filter(ip => ip && !ip.includes(' '));
});

const selectedIP = ref('');
const pingResults = ref([]);
const pingCheckStatus = ref("idle");

// 发起 ping 测试
const startPingCheck = () => {
  trackEvent('Section', 'StartClick', 'GlobalLatency');
  // 清空上一次结果
  pingResults.value = [];
  cleanMap();
  let tryCount = 0;
  // 子函数：发起 ping 请求
  const sendPingRequest = async () => {
    pingCheckStatus.value = "running";
    try {
      const response = await fetch("https://api.globalping.io/v1/measurements", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 16,
          locations: [
            { country: "HK" },
            { country: "TW" },
            { country: "CN" },
            { country: "JP" },
            { country: "SG" },
            { country: "IN" },
            { country: "RU" },
            { country: "US" },
            { country: "CA" },
            { country: "AU" },
            { country: "GB" },
            { country: "DE" },
            { country: "FR" },
            { country: "BR" },
            { country: "ZA" },
            { country: "SA" },
          ],
          target: selectedIP.value, // 使用用户选中的 IP 地址
          type: "ping",
          measurementOptions: {
            packets: 8
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error sending ping request:", error);
    }
  };

  // 子函数：获取 ping 结果
  const fetchpingResults = async (id) => {
    try {
      const response = await fetch(`https://api.globalping.io/v1/measurements/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      processpingResults(data);

      if (data.status === "in-progress" && tryCount < 4) {
        setTimeout(() => fetchpingResults(id), 1000);
        tryCount++;
      } else {
        // 如果 pingResults.value 是空数组，返回错误信息
        if (pingResults.value.length === 0) {
          pingCheckStatus.value = "error";
        } else {
          pingCheckStatus.value = "finished";
          drawMap();
        }
      }
    } catch (error) {
      console.error("Error fetching ping results:", error);
    }
  };

  // 执行流程
  sendPingRequest().then(data => {
    if (data && data.id) {
      setTimeout(() => {
        fetchpingResults(data.id);
      }, 1000);
    }
  });
};
const processpingResults = (data) => {
  const cleanedData = data.results
    .filter(item => item.result.status === "finished")
    .filter(item => item.result.stats.min !== null)
    .map(item => ({
      country: item.probe.country,
      country_name: getCountryName(item.probe.country, lang.value),
      stats: item.result.stats
    }));

  pingResults.value = cleanedData;
};

// 绘制地图
const drawMap = () => {
  const mapData = {
    data: {
      avgPing: {
        name: t('pingtest.AvgDelay'),
        format: '{0} ms',
        thresholdMax: 250,
        thresholdMin: 0
      },
      minPing: {
        name: t('pingtest.MinDelay'),
        format: '{0} ms',
      },
      maxPing: {
        name: t('pingtest.MaxDelay'),
        format: '{0} ms',
      },
      total: {
        name: t('pingtest.TotalPackets'),
        format: '{0}',
      },
      loss: {
        name: t('pingtest.PacketLoss'),
        format: '{0}%',
      },
      rcv: {
        name: t('pingtest.ReceivedPackets'),
        format: '{0}',
      },
      drop: {
        name: t('pingtest.DroppedPackets'),
        format: '{0}',
      }
    },
    applyData: 'avgPing',
    values: {}
  };

  pingResults.value.forEach(countryData => {
    mapData.values[countryData.country] = {
      avgPing: countryData.stats.avg,
      minPing: countryData.stats.min,
      maxPing: countryData.stats.max,
      total: countryData.stats.total,
      loss: countryData.stats.loss,
      rcv: countryData.stats.rcv,
      drop: countryData.stats.drop
    };
  });

  // 创建 svgMap 实例
  new svgMap({
    targetElementID: 'svgMap',
    data: mapData,
    colorMax: '#083923',
    colorMin: '#22CB80',
    minZoom: 1,
    maxZoom: 1,
    mouseWheelZoomEnabled: false,
    initialZoom: 1,
  });
}

// 清除地图数据
const cleanMap = () => { 
  document.getElementById('svgMap').innerHTML = '';
};

</script>

<style scoped></style>

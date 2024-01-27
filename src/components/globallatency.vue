<template>
  <!-- Ping Test -->
  <div class="ping-test-section mb-4">
    <div class="jn-title2">
      <h2 id="PingTest" :class="{ 'mobile-h2': isMobile }">🌐 {{ $t('pingtest.Title') }}</h2>

    </div>
    <div class="text-secondary">
      <p>{{ $t('pingtest.Note') }}</p>
    </div>
    <div class="row">
      <div class="col-12">
        <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">
            <!-- Dropdown for IP Selection -->
            <div class="row mt-3 mb-3 align-items-center justify-content-center">
              <div class="col-12 col-md-auto">
                <label for="pingIP" class="col-form-label">{{ $t('pingtest.Note2') }}</label>
              </div>
              <div class="col-12 col-md-auto mt-2 mt-md-0">
                <div class="row justify-content-between">
                  <div class="col-auto">
                    <select id="pingIP" class="form-select jn-ping-form-select" v-model="selectedIP"
                      :class="{ 'bg-dark text-light': isDarkMode }">
                      <option disabled value="">{{ $t('pingtest.SelectIP') }}</option>
                      <option v-for="ip in allIPs" :key="ip" :value="ip">{{ ip }}</option>
                    </select>
                  </div>
                  <div class="col-auto">
                    <button class="btn btn-primary" @click="startPingCheck"
                      :disabled="pingCheckStatus === 'running' || selectedIP === ''">
                      <span
                        v-if="pingCheckStatus === 'idle' || pingCheckStatus === 'finished' || pingCheckStatus === 'error'">{{
                          $t('pingtest.Run') }}</span>
                      <span v-if="pingCheckStatus === 'running'" class="spinner-grow spinner-grow-sm"
                        aria-hidden="true"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Result Display -->
            <div id="pingresult" v-if="pingResults.length > 0">
              <div class="table-responsive text-nowrap">
                <table class="table" :class="{ 'table-dark': isDarkMode }">
                  <thead>
                    <tr>
                      <th scope="col">{{ $t('pingtest.Region') }}</th>
                      <th scope="col">{{ $t('pingtest.MinDelay') }}</th>
                      <th scope="col">{{ $t('pingtest.MaxDelay') }}</th>
                      <th scope="col">{{ $t('pingtest.AvgDelay') }}</th>
                      <th scope="col">{{ $t('pingtest.TotalPackets') }}</th>
                      <th scope="col">{{ $t('pingtest.PacketLoss') }}</th>
                      <th scope="col">{{ $t('pingtest.ReceivedPackets') }}</th>
                      <th scope="col">{{ $t('pingtest.DroppedPackets') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="result in pingResults" :key="result.country">
                      <td>
                        <span :class="'fi fi-' + result.country.toLowerCase()"></span>
                        {{ result.country }}
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

            <div id="pingresult-error" v-if="pingCheckStatus === 'error'">
              <p class="text-center text-danger">{{ $t('pingtest.Error') }}</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'GlobalLatency',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);
    const ipDataCards = computed(() => store.state.Global_ipDataCards);
    const allIPs = ref([]); // 创建响应式引用

    const getAllIPs = (cards) => {
      let Global_allIPs = []; // 初始化数组
      cards.forEach(card => {
        if (card.ip && !card.ip.includes(' ') && !card.ip.includes(':')) {
          Global_allIPs.push(card.ip);
        }
      });
      Global_allIPs = [...new Set(Global_allIPs)]; // 去重
      allIPs.value = Global_allIPs; // 更新 allIPs 响应式引用

    };

    // 监听 ipDataCards 的变化
    watch(ipDataCards, (newVal) => {
      getAllIPs(newVal);
    });

    return {
      isDarkMode,
      isMobile,
      allIPs,
    };
  },

  data() {
    return {
      selectedIP: '',
      pingResults: {},
      pingCheckStatus: "idle",
    }
  },

  methods: {

    // 发起 ping 测试
    startPingCheck() {
      // 清空上一次结果
      this.pingResults = [];
      let tryCount = 0;
      // 子函数：发起 ping 请求
      const sendPingRequest = async () => {
        this.pingCheckStatus = "running";
        try {
          const response = await fetch("https://api.globalping.io/v1/measurements", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              limit: 12,
              locations: [
                { country: "HK" },
                { country: "TW" },
                { country: "US" },
                { country: "CA" },
                { country: "JP" },
                { country: "SG" },
                { country: "AU" },
                { country: "GB" },
                { country: "DE" },
                { country: "FR" },
                { country: "BR" },
                { country: "IN" },
              ],
              target: this.selectedIP, // 使用用户选中的 IP 地址
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
      const fetchPingResults = async (id) => {
        try {
          const response = await fetch(`https://api.globalping.io/v1/measurements/${id}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          this.processPingResults(data);

          if (data.status === "in-progress" && tryCount < 4) {
            setTimeout(() => fetchPingResults(id), 1000);
            tryCount++;
          } else {
            // 如果 this.pingResults 是空数组，返回错误信息
            if (this.pingResults.length === 0) {
              this.pingCheckStatus = "error";
            } else {
              this.pingCheckStatus = "finished";
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
            fetchPingResults(data.id);
          }, 1000);
        }
      });
    },
    processPingResults(data) {
      const cleanedData = data.results
        .filter(item => item.result.status === "finished")
        .filter(item => item.result.stats.min !== null)
        .map(item => ({
          country: item.probe.country,
          stats: item.result.stats
        }));

      this.pingResults = cleanedData;
    },
  },
}
</script>

<style scoped></style>

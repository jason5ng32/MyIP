<template>
  <!-- Ping Test -->
  <div class="ping-test-section my-4">
    <div class="text-neutral-500">
      <p>{{ t('pingtest.Note') }}</p>
      <p v-if="!isMobile">{{ t('pingtest.Note2') }}</p>
    </div>
    <div class="mb-3">
      <div class="jn-card rounded-lg border bg-card text-card-foreground">
        <div class="p-4">
          <!-- IP Selection -->
          <div class="flex flex-wrap items-center justify-center mt-3 mb-3 gap-2">
            <div>
              <label for="pingIP" class="inline-block">{{ t('pingtest.Note3') }}</label>
            </div>
            <div class="flex">
              <Select v-model="selectedIP">
                <SelectTrigger id="pingIP" aria-label="Select IP to Ping" class="w-56 rounded-r-none">
                  <SelectValue :placeholder="t('pingtest.SelectIP')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="ip in allIPs" :key="ip" :value="ip">
                    {{ ip }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                @click="startPingCheck"
                :disabled="pingCheckStatus === 'running' || selectedIP === ''">
                <span v-if="pingCheckStatus === 'idle' || pingCheckStatus === 'finished' || pingCheckStatus === 'error'">
                  {{ t('pingtest.Run') }}
                </span>
                <span v-if="pingCheckStatus === 'running'"
                  class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
              </Button>
            </div>
          </div>

          <!-- Result Display -->
          <div id="pingresult" v-if="pingResults.length > 0">
            <div class="overflow-x-auto whitespace-nowrap">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="border-b border-neutral-200 dark:border-neutral-700">
                    <th scope="col" class="text-left p-2" v-for="header in [
                      'Region', 'MinDelay', 'MaxDelay', 'AvgDelay',
                      'TotalPackets', 'PacketLoss', 'ReceivedPackets', 'DroppedPackets'
                    ]" :key="header">{{ t('pingtest.' + header) }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="result in pingResults" :key="result.country"
                    class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td class="p-2">
                      <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>
                      {{ result.country_name }}
                    </td>
                    <td class="p-2" v-for="stat in ['min', 'max', 'avg']" :key="stat"
                      :class="result.stats[stat] < 100 ? 'text-green-600' : ''">
                      {{ result.stats[stat].toFixed(1) }}
                    </td>
                    <td class="p-2">{{ result.stats.total }}</td>
                    <td class="p-2">{{ Math.round(result.stats.loss) }}%</td>
                    <td class="p-2">{{ result.stats.rcv }}</td>
                    <td class="p-2">{{ result.stats.drop }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="svgMap"></div>

          <div id="pingresult-error" v-if="pingCheckStatus === 'error'">
            <div class="px-3 py-2 rounded-md border bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200">
              {{ t('pingtest.Error') }}
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
import getCountryName from '@/utils/country-name.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
let allIPs = computed(() => {
  const _allIPs = store.allIPs;
  return _allIPs.filter(ip => ip && !ip.includes(' '));
});

const selectedIP = ref('');
const pingResults = ref([]);
const pingCheckStatus = ref("idle");

const startPingCheck = () => {
  trackEvent('Section', 'StartClick', 'GlobalLatency');
  pingResults.value = [];
  cleanMap();
  let tryCount = 0;
  const sendPingRequest = async () => {
    pingCheckStatus.value = "running";
    try {
      const response = await fetch("https://api.globalping.io/v1/measurements", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 16,
          locations: [
            { country: "HK" }, { country: "TW" }, { country: "CN" }, { country: "JP" },
            { country: "SG" }, { country: "IN" }, { country: "RU" }, { country: "US" },
            { country: "CA" }, { country: "AU" }, { country: "GB" }, { country: "DE" },
            { country: "FR" }, { country: "BR" }, { country: "ZA" }, { country: "SA" },
          ],
          target: selectedIP.value,
          type: "ping",
          measurementOptions: { packets: 8 }
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error sending ping request:", error);
    }
  };

  const fetchpingResults = async (id) => {
    try {
      const response = await fetch(`https://api.globalping.io/v1/measurements/${id}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      processpingResults(data);

      if (data.status === "in-progress" && tryCount < 4) {
        setTimeout(() => fetchpingResults(id), 1000);
        tryCount++;
      } else {
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

const drawMap = async () => {
  const svgMapModule = await import('svgmap');
  await import('svgmap/style.min');

  const mapData = {
    data: {
      avgPing: { name: t('pingtest.AvgDelay'), format: '{0} ms', thresholdMax: 250, thresholdMin: 0 },
      minPing: { name: t('pingtest.MinDelay'), format: '{0} ms' },
      maxPing: { name: t('pingtest.MaxDelay'), format: '{0} ms' },
      total: { name: t('pingtest.TotalPackets'), format: '{0}' },
      loss: { name: t('pingtest.PacketLoss'), format: '{0}%' },
      rcv: { name: t('pingtest.ReceivedPackets'), format: '{0}' },
      drop: { name: t('pingtest.DroppedPackets'), format: '{0}' }
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

  new svgMapModule.default({
    targetElementID: 'svgMap',
    data: mapData,
    colorMax: '#083923',
    colorMin: '#22CB80',
    minZoom: 1,
    maxZoom: 1,
    mouseWheelZoomEnabled: false,
    initialZoom: 1,
  });
};

const cleanMap = () => {
  document.getElementById('svgMap').innerHTML = '';
};
</script>

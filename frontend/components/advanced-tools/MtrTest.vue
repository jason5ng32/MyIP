<template>
  <!-- mtr Test -->
  <div class="mtr-test-section my-4">
    <div class="text-neutral-500">
      <p>{{ t('mtrtest.Note') }}</p>
      <p v-if="!isMobile">{{ t('mtrtest.Note2') }}</p>
    </div>
    <div class="mb-3">
      <div class="jn-card rounded-lg border bg-card text-card-foreground">
        <div class="p-4">
          <!-- IP Selection -->
          <div class="flex flex-wrap items-center justify-center mt-3 mb-3 gap-2">
            <div>
              <label for="mtrIP" class="inline-block">{{ t('mtrtest.Note3') }}</label>
            </div>
            <div class="flex">
              <Select v-model="selectedIP">
                <SelectTrigger id="mtrIP" aria-label="Select IP to MTR" class="w-56 rounded-r-none">
                  <SelectValue :placeholder="t('mtrtest.SelectIP')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="ip in allIPs" :key="ip" :value="ip">{{ ip }}</SelectItem>
                </SelectContent>
              </Select>
              <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                @click="startmtrCheck"
                :disabled="mtrCheckStatus === 'running' || selectedIP === ''">
                <span v-if="mtrCheckStatus === 'idle' || mtrCheckStatus === 'finished' || mtrCheckStatus === 'error'">
                  {{ t('mtrtest.Run') }}
                </span>
                <span v-if="mtrCheckStatus === 'running'"
                  class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
              </Button>
            </div>
          </div>

          <!-- Result Display -->
          <div id="mtrresult" v-if="mtrResults.length > 0">
            <Accordion type="single" collapsible default-value="0">
              <AccordionItem v-for="(result, index) in mtrResults" :key="result.country" :value="String(index)">
                <AccordionTrigger>
                  <span>
                    <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>&nbsp;
                    <strong>{{ result.country_name }}, {{ result.city }}</strong>
                    <span v-if="!isMobile">&nbsp;-&nbsp;{{ result.network }}&nbsp;</span>
                    <Badge v-if="!isMobile"
                      class="rounded-full bg-green-600 text-white border-transparent dark:bg-yellow-500 dark:text-neutral-900">
                      AS{{ result.asn }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div class="border-0 mt-3 p-4 rounded"
                    :class="[isDarkMode ? 'bg-black text-neutral-100' : 'bg-neutral-100']">
                    <pre>{{ result.rawOutput }}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div id="mtrresult-error" v-if="mtrCheckStatus === 'error'">
            <div class="px-3 py-2 rounded-md border bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200">
              {{ t('mtrtest.Error') }}
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
const mtrResults = ref([]);
const mtrCheckStatus = ref("idle");

const startmtrCheck = () => {
  trackEvent('Section', 'StartClick', 'MTRTest');
  mtrResults.value = [];
  let tryCount = 0;
  const sendmtrRequest = async () => {
    mtrCheckStatus.value = "running";
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
          type: "mtr",
          measurementOptions: { port: 80, protocol: "ICMP" }
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error sending mtr request:", error);
    }
  };

  const fetchmtrResults = async (id) => {
    try {
      const response = await fetch(`https://api.globalping.io/v1/measurements/${id}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      processmtrResults(data);

      if (data.status === "in-progress" && tryCount < 4) {
        setTimeout(() => fetchmtrResults(id), 1000);
        tryCount++;
      } else {
        if (mtrResults.value.length === 0) {
          mtrCheckStatus.value = "error";
        } else {
          mtrCheckStatus.value = "finished";
        }
      }
    } catch (error) {
      console.error("Error fetching mtr results:", error);
    }
  };

  sendmtrRequest().then(data => {
    if (data && data.id) {
      setTimeout(() => { fetchmtrResults(data.id); }, 1000);
    }
  });
};

const processmtrResults = (data) => {
  const cleanedData = data.results
    .filter(item => item.result.status === "finished")
    .filter(item => item.result.rawOutput !== null)
    .map(item => ({
      country: item.probe.country,
      country_name: getCountryName(item.probe.country, lang.value),
      city: item.probe.city,
      network: item.probe.network,
      asn: item.probe.asn,
      rawOutput: item.result.rawOutput,
    }));

  mtrResults.value = cleanedData;
};
</script>

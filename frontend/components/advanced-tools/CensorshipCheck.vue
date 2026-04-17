<template>
    <!-- Censorship Check -->
    <div class="mtr-test-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('censorshipcheck.Note') }}</p>
        </div>
        <div class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div>
                        <label for="queryURL" class="inline-block">{{ t('censorshipcheck.Note2') }}</label>
                    </div>

                    <div class="flex mb-2 mt-2">
                        <Input type="text" class="rounded-r-none"
                            :disabled="censorshipCheckStatus === 'running'"
                            :placeholder="t('censorshipcheck.Placeholder')"
                            v-model="queryURL" @keyup.enter="onSubmit"
                            name="queryURL" id="queryURL" data-1p-ignore />
                        <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                            @click="onSubmit"
                            :disabled="censorshipCheckStatus === 'running' || !queryURL">
                            <span v-if="censorshipCheckStatus !== 'running'">{{ t('censorshipcheck.Run') }}</span>
                            <span v-else class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                        </Button>
                    </div>
                    <div class="jn-placeholder">
                        <p v-if="errorMsg" class="text-red-600">{{ errorMsg }}</p>
                    </div>

                    <!-- Result Display -->
                    <div id="censorshipresult" class="flex flex-wrap -mx-2" v-if="censorshipResults.length > 0">
                        <div class="w-full md:w-1/2 px-2">
                            <h3 class="text-xl px-3 py-2 rounded-md border bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200">
                                {{ t('censorshipcheck.TestGroup') }}
                            </h3>
                            <div class="overflow-x-auto whitespace-nowrap">
                                <table class="w-full border-collapse">
                                    <thead>
                                        <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                            <template v-for="header in ['Country', 'Status', 'City', 'Network']" :key="header">
                                                <th scope="col" class="text-left p-2">{{ t('censorshipcheck.' + header) }}</th>
                                            </template>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(result, index) in censorshipResults.filter(r => highRiskCountries.includes(r.country))"
                                            :key="result.country + '-' + result.city + '-' + index"
                                            class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                            <td class="p-2">
                                                <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>
                                                {{ result.country_name }}
                                            </td>
                                            <td class="p-2">
                                                <i class="bi" :class="{
                                                    'bi-x-circle-fill text-red-600': result.status === 'failed',
                                                    'bi-check-circle-fill text-green-600': result.status === 'finished',
                                                }"></i>
                                                <span v-if="result.status === 'in-progress'"
                                                    class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                                            </td>
                                            <td class="p-2">{{ result.city }}</td>
                                            <td class="p-2">{{ result.network }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="w-full md:w-1/2 px-2">
                            <h3 class="text-xl px-3 py-2 rounded-md border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
                                {{ t('censorshipcheck.ControlGroup') }}
                            </h3>
                            <div class="overflow-x-auto whitespace-nowrap">
                                <table class="w-full border-collapse">
                                    <thead>
                                        <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                            <template v-for="header in ['Country', 'Status', 'City', 'Network']" :key="header">
                                                <th scope="col" class="text-left p-2">{{ t('censorshipcheck.' + header) }}</th>
                                            </template>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(result, index) in censorshipResults.filter(r => !highRiskCountries.includes(r.country))"
                                            :key="result.country + '-' + result.city + '-' + index"
                                            class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                            <td class="p-2">
                                                <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>
                                                {{ result.country_name }}
                                            </td>
                                            <td class="p-2">
                                                <i class="bi" :class="{
                                                    'bi-x-circle-fill text-red-600': result.status === 'failed',
                                                    'bi-check-circle-fill text-green-600': result.status === 'finished',
                                                }"></i>
                                                <span v-if="result.status === 'in-progress'"
                                                    class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                                            </td>
                                            <td class="p-2">{{ result.city }}</td>
                                            <td class="p-2">{{ result.network }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <transition @before-enter="beforeEnter" @enter="enter" @leave="leave">
                        <div v-if="censorshipCheckStatus === 'finished'">
                            <div class="px-3 py-2 rounded-md border mt-3"
                                :class="{
                                    'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200': isDown,
                                    'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200': isBlocked,
                                    'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200': !isBlocked && !isDown
                                }">
                                <span v-if="isBlocked">
                                    <i class="bi bi-emoji-frown"></i>
                                    {{ t('censorshipcheck.isBlocked') }}
                                </span>
                                <span v-else>
                                    <span v-if="!isDown">
                                        <i class="bi bi-emoji-smile"></i>
                                        {{ t('censorshipcheck.notBlocked') }}
                                    </span>
                                    <span v-else>
                                        <i class="bi bi-emoji-expressionless"></i>
                                        {{ t('censorshipcheck.isDown') }}
                                    </span>
                                </span>
                                <span class="opacity-75 italic">( {{ t('censorshipcheck.Note3') }} )</span>
                            </div>
                        </div>
                    </transition>
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const store = useMainStore();
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);
const highRiskCountries = ['CN', 'RU', 'TR', 'SA'];
const censorshipResults = ref([]);
const censorshipCheckStatus = ref("idle");
const isBlocked = ref(false);
const isDown = ref(false);
const blockedCountries = ref([]);
const queryURL = ref('');
const errorMsg = ref('');

const validateInput = (input) => {
    if (!input.match(/^https?:\/\//)) {
        input = 'http://' + input;
    }
    try {
        const url = new URL(input);
        const hostname = url.hostname;
        if (hostname.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) {
            return hostname;
        }
    } catch {
    }
    errorMsg.value = t('censorshipcheck.invalidURL');
    return null;
};

const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'CensorshipCheck');
    errorMsg.value = '';
    censorshipResults.value = [];
    censorshipCheckStatus.value = "idle";
    isBlocked.value = false;
    isDown.value = false;
    blockedCountries.value = [];
    const hostname = validateInput(queryURL.value);
    if (hostname) {
        startHttpCheck(hostname);
    }
};

const startHttpCheck = () => {
    trackEvent('Section', 'StartClick', 'CensorshipCheck');
    const hostname = validateInput(queryURL.value);
    if (!hostname) return;
    let tryCount = 0;
    const sendHttpRequest = async () => {
        censorshipCheckStatus.value = "running";
        try {
            const response = await fetch("https://api.globalping.io/v1/measurements", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locations: [
                        { country: "CN", limit: 2 }, { country: "RU", limit: 2 },
                        { country: "TR", limit: 2 }, { country: "SA", limit: 2 },
                        { country: "JP" }, { country: "US" }, { country: "CA" }, { country: "IT" },
                        { country: "FI" }, { country: "AU" }, { country: "FR" }, { country: "DE" },
                    ],
                    target: hostname,
                    type: "http",
                    measurementOptions: {
                        request: { host: hostname, path: "/", method: "HEAD" },
                        port: 443,
                        protocol: "HTTPS"
                    }
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error sending HTTP request:", error);
            censorshipCheckStatus.value = "error";
            errorMsg.value = t('censorshipcheck.invalidURL');
        }
    };

    const fetchHttpResults = async (id) => {
        try {
            const response = await fetch(`https://api.globalping.io/v1/measurements/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            processHttpResults(data);

            if (data.status === "in-progress" && tryCount < 5) {
                setTimeout(() => fetchHttpResults(id), 3000);
                tryCount++;
            } else {
                if (censorshipResults.value.length === 0) {
                    censorshipCheckStatus.value = "error";
                    errorMsg.value = t('censorshipcheck.fetchError');
                } else {
                    correctResult();
                    calResult(censorshipResults.value);
                    censorshipCheckStatus.value = "finished";
                }
            }
        } catch (error) {
            console.error("Error fetching HTTP results:", error);
            censorshipCheckStatus.value = "error";
            errorMsg.value = t('censorshipcheck.fetchError');
        }
    };

    sendHttpRequest().then(data => {
        if (data && data.id) {
            setTimeout(() => { fetchHttpResults(data.id); }, 3000);
        }
    });
};

const processHttpResults = (data) => {
    const cleanedData = data.results
        .filter(item => item.result.status === "finished" || item.result.status === "failed" || item.result.status === "in-progress")
        .filter(item => item.result.rawOutput !== null)
        .map(item => ({
            country: item.probe.country,
            country_name: getCountryName(item.probe.country, lang.value),
            city: item.probe.city,
            network: item.probe.network,
            status: item.result.status,
            headers: item.result.rawHeaders ? 'OK' : '',
        }));

    censorshipResults.value = cleanedData;
};

const correctResult = () => {
    censorshipResults.value.forEach(result => {
        if (result.status === 'in-progress') {
            result.status = 'failed';
        }
    });

    censorshipResults.value = [...censorshipResults.value.sort((a, b) => {
        const priorityIndexA = highRiskCountries.indexOf(a.country);
        const priorityIndexB = highRiskCountries.indexOf(b.country);

        if (priorityIndexA !== -1 && priorityIndexB !== -1) {
            return priorityIndexA - priorityIndexB;
        }
        if (priorityIndexA !== -1) return -1;
        if (priorityIndexB !== -1) return 1;
        return a.country.localeCompare(b.country);
    })];
};

const calResult = (testResults) => {
    blockedCountries.value = [];
    isBlocked.value = false;
    isDown.value = false;

    const isFailedResult = result => result.status === 'failed' && result.headers === '';

    const blockedHighRiskCountries = highRiskCountries.filter(country => {
        const countryResults = testResults.filter(result => result.country === country);
        return countryResults.length > 0 && countryResults.every(isFailedResult);
    });

    const otherResults = testResults.filter(result => !highRiskCountries.includes(result.country));
    const failedOtherResultsCount = otherResults.filter(isFailedResult).length;
    const failureRate = otherResults.length ? failedOtherResultsCount / otherResults.length : 0;

    if (failureRate > 0.5) {
        isDown.value = true;
    } else {
        blockedCountries.value = blockedHighRiskCountries;
        isBlocked.value = blockedHighRiskCountries.length > 0;
    }
    if (isSignedIn.value) {
        checkAchievements();
    }
};

const checkAchievements = () => {
    if (isBlocked.value) {
        if (!store.userAchievements.ItIsOpen.achieved) {
            store.setTriggerUpdateAchievements('ItIsOpen');
        }
    }
};

const beforeEnter = (el) => { el.style.height = '0'; };
const enter = (el, done) => {
    el.style.height = 'fit-content';
    el.addEventListener('transitionend', done);
};
const leave = (el, done) => {
    el.style.height = '0';
    el.addEventListener('transitionend', done);
};
</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
}
</style>

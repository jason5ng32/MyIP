<template>
    <div>
        <!-- RuleTest -->
        <div class="rule-test-section my-4">
            <div class="text-neutral-500">
                <p>{{ t('ruletest.Note') }}</p>
            </div>
            <div class="flex flex-wrap -mx-2">
                <div v-for="test in ruleTests" :key="test.id" class="w-full md:w-1/2 lg:w-1/4 px-2 mb-4">
                    <div class="jn-card rounded-lg border bg-card text-card-foreground"
                        :class="{ 'jn-hover-card': !isMobile }">
                        <div class="p-4">
                            <p class="jn-con-title mb-1">
                                <SignpostBig class="inline size-[1em] align-[-0.125em]" />
                                {{ test.name }}
                                <span class="inline-flex items-center justify-center w-[1.2em] h-[1.2em] text-[0.7em] font-semibold border rounded align-[-0.1em]">{{ test.id }}</span>&nbsp;
                            </p>

                            <p class="text-neutral-500 mb-2" style="font-size: 10pt;">
                                <Server class="inline size-[1em] align-[-0.125em]" />
                                {{ test.url }}
                            </p>
                            <p class="mb-2" :class="{
                                'text-sky-600': test.ip === t('ruletest.StatusWait'),
                                'text-green-600': test.ip.includes('.') || test.ip.includes(':'),
                                'text-red-600': test.ip === t('ruletest.StatusError')
                            }">
                                <component :is="test.ip === t('ruletest.StatusWait') ? Hourglass : Monitor"
                                    class="inline size-[1em] align-[-0.125em]" />&nbsp;
                                <span :class="{ 'jn-ip-font': test.ip.length > 32 }">{{ test.ip }}</span>
                            </p>
                            <div class="px-3 py-2 rounded-md border"
                                :class="[
                                    test.country === t('ruletest.StatusWait')
                                        ? 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200'
                                        : test.country === t('ruletest.StatusError')
                                            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
                                            : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
                                ]">
                                <component :is="test.ip === t('ruletest.StatusWait') || test.ip === t('ruletest.StatusError') ? Hourglass : MapPin"
                                    class="inline size-[1em] align-[-0.125em]" />
                                {{ t('ruletest.Country') }}: <strong>{{ test.country }}&nbsp;</strong>
                                <span v-show="test.country_code" :class="'jn-fl fi fi-' + test.country_code.toLowerCase()"></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="w-full flex justify-center" :class="[isMobile ? '' : 'mt-4']">
                    <Button
                        :class="[
                            finishAll ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-sky-600 hover:bg-sky-700 text-white',
                            isMobile ? 'w-full' : 'w-1/4'
                        ]"
                        :disabled="!finishAll" @click="checkAllRuleTest(true)">
                        <span v-if="finishAll"><RotateCw class="inline size-[1em] align-[-0.125em]" /> {{t('ruletest.RefreshAll')}}</span>
                        <span v-else class="inline-block h-3 w-3 rounded-full bg-white animate-pulse" aria-hidden="true"></span>
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import getCountryName from '@/utils/country-name.js';
import { Button } from '@/components/ui/button';
import { Hourglass, MapPin, Monitor, RotateCw, Server, SignpostBig } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);

const createDefaultCard = () => ({
    name: t('ruletest.Name'),
    ip: t('ruletest.StatusWait'),
    country_code: '',
    country: t('ruletest.StatusWait'),
});

const ruleTests = ref(Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    url: `ptest-${index + 1}.ipcheck.ing`,
    ...createDefaultCard(),
})));

const IPArray = ref([]);
const testCount = ref(ruleTests.value.length);
const finishAll = ref(false);

const fetchTrace = async (id, url) => {
    try {
        const response = await fetch(`https://${url}/cdn-cgi/trace`);
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        const countryLine = lines.find((line) => line.startsWith("loc="));
        if (ipLine) {
            const ip = ipLine.split("=")[1];
            ruleTests.value[id].ip = ip;
            IPArray.value = [...IPArray.value, ip];
        }
        if (countryLine) {
            const country = countryLine.split("=")[1];
            ruleTests.value[id].country_code = country;
            ruleTests.value[id].country = getCountryName(country, lang.value);
        }
    } catch (error) {
        ruleTests.value[id].ip = t('ruletest.StatusError');
        ruleTests.value[id].country_code = '';
        ruleTests.value[id].country = t('ruletest.StatusError');
        console.error("Error fetching Data:", error);
    }
};

const checkAllRuleTest = async (refresh = false) => {
    finishAll.value = false;
    if (refresh) {
        ruleTests.value.forEach((test) => {
            test.ip = t('ruletest.StatusWait');
            test.country = t('ruletest.StatusWait');
            test.country_code = '';
        });
    }

    const processTest = async (index) => {
        if (index < testCount.value) {
            try {
                await fetchTrace(index, ruleTests.value[index].url);
            } catch (error) {
                console.error("Error fetching Data:", error);
            } finally {
                processTest(index + 1);
                if (index === testCount.value - 1) {
                    finishAll.value = true;
                    if (isSignedIn.value) {
                        checkAchievements();
                    }
                }
            }
        }
    };

    processTest(0);
};

const checkAchievements = () => {
    const allIPs = ruleTests.value.map((test) => test.ip);
    const uniqueIPs = [...new Set(allIPs)];
    if (uniqueIPs.length === 8) {
        if (!store.userAchievements.CrossingTheWall.achieved) {
            store.setTriggerUpdateAchievements('CrossingTheWall');
        }
    }
};

onMounted(() => {
    setTimeout(() => {
        checkAllRuleTest();
    }, 1000);
});

watch(IPArray, () => {
    store.updateAllIPs(IPArray.value);
}, { deep: true });
</script>

<template>
    <div>
        <!-- RuleTest -->
        <div class="rule-test-section mb-4">
            <div class="jn-title2">
                <h2 id="RuleTest" :class="{ 'mobile-h2': isMobile }">🚏 {{ t('ruletest.Title') }}</h2>
                <button @click="checkAllRuleTest(true)"
                    :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                    aria-label="Refresh Rule Test" v-tooltip="t('Tooltips.RefreshRuleTests')"><i
                        class="bi bi-arrow-clockwise"></i></button>
            </div>
            <div class="text-secondary">
                <p>{{ t('ruletest.Note') }}</p>
            </div>
            <div class="row">
                <div v-for="test in ruleTests" :key="test.id" class="col-lg-3 col-md-6 col-12 mb-4">
                    <div class="card jn-card"
                        :class="{ 'dark-mode dark-mode-border': isDarkMode, 'jn-hover-card': !isMobile }">
                        <div class="card-body">
                            <p class="jn-con-title card-title"><i class="bi bi-signpost-split-fill"></i>
                                {{ test.name }}
                                <i class="bi" :class="'bi-' + (test.id) + '-square'"></i>&nbsp;
                            </p>

                            <p class="card-text text-secondary" style="font-size: 10pt;">
                                <i class="bi bi-hdd-network-fill"></i>
                                {{ test.url }}
                            </p>
                            <p class="card-text" :class="{
                                'text-info': test.ip === t('ruletest.StatusWait'),
                                'text-success': test.ip.includes('.') || test.ip.includes(':'),
                                'text-danger': test.ip === t('ruletest.StatusError')
                            }">
                                <i class="bi"
                                    :class="[test.ip === t('ruletest.StatusWait') ? 'bi-hourglass-split' : 'bi-pc-display-horizontal']">&nbsp;</i>
                                <span :class="{ 'jn-ip-font': test.ip.length > 32 }">{{ test.ip }}</span>
                            </p>
                            <div class="alert" :class="{
                                'alert-info': test.country_code === t('ruletest.StatusWait'),
                                'alert-success': test.country_code !== t('ruletest.StatusWait'),
                            }" :data-bs-theme="isDarkMode ? 'dark' : ''">
                                <i class="bi"
                                    :class="[test.ip === t('ruletest.StatusWait') || test.ip === t('ruletest.StatusError') ? 'bi-hourglass-split' : 'bi-geo-alt-fill']"></i>
                                {{ t('ruletest.Country') }}: <strong>{{ test.country }}&nbsp;</strong>
                                <span v-if="test.country_code !== t('ruletest.StatusWait')"
                                    :class="'jn-fl fi fi-' + test.country_code.toLowerCase()"></span>
                            </div>
                        </div>
                    </div>
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

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);

const createDefaultCard = () => ({
    name: t('ruletest.Name'),
    ip: t('ruletest.StatusWait'),
    country_code: t('ruletest.StatusWait'),
    country: t('ruletest.StatusWait'),
});

const ruleTests = ref(Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    url: `ptest-${index + 1}.ipcheck.ing`,
    ...createDefaultCard(),
})));

const IPArray = ref([]);
const testCount = ref(ruleTests.value.length);

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
        ruleTests.value[id].country_code = t('ruletest.StatusError');
        ruleTests.value[id].country = t('ruletest.StatusError');
        console.error("Error fetching Data:", error);
    }
};

// 检查所有 RuleTest
const checkAllRuleTest = async (refresh = false) => {

    if (refresh) {
        ruleTests.value.forEach((test) => {
            test.ip = t('ruletest.StatusWait');
            test.country_code = t('ruletest.StatusWait');
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
            }
        }
    };

    processTest(0);
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

<style scoped>
.jn-text-warning {
    color: #c67c14;
}
</style>
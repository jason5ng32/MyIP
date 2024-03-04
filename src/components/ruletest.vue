<template>
    <div>
        <!-- RuleTest -->
        <div class="rule-test-section mb-4">
            <div class="jn-title2">
                <h2 id="RuleTest" :class="{ 'mobile-h2': isMobile }">🚏 {{ $t('ruletest.Title') }}</h2>
                <button @click="checkAllRuleTest(true)"
                    :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                    aria-label="Refresh Rule Test" v-tooltip="$t('Tooltips.RefreshRuleTests')"><i
                        class="bi bi-arrow-clockwise"></i></button>
            </div>
            <div class="text-secondary">
                <p>{{ $t('ruletest.Note') }}</p>
            </div>
            <div class="row">
                <div v-for="test in ruleTests" :key="test.id" class="col-lg-3 col-md-6 col-12 mb-4">
                    <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
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
                    'text-info': test.ip === $t('ruletest.StatusWait'),
                    'text-success': test.ip.includes('.') || test.ip.includes(':'),
                    'text-danger': test.ip === $t('ruletest.StatusError')
                }">
                                <i class="bi"
                                    :class="[test.ip === $t('ruletest.StatusWait') ? 'bi-hourglass-split' : 'bi-pc-display-horizontal']">&nbsp;</i>
                                <span :class="{ 'jn-ip-font': test.ip.length > 32 }">{{ test.ip }}</span>
                            </p>
                            <div class="alert" :class="{
                    'alert-info': test.country_code === $t('ruletest.StatusWait'),
                    'alert-success': test.country_code !== $t('ruletest.StatusWait'),
                }" :data-bs-theme="isDarkMode ? 'dark' : ''">
                                <i class="bi"
                                    :class="[test.ip === $t('ruletest.StatusWait') || test.ip === $t('ruletest.StatusError') ? 'bi-hourglass-split' : 'bi-geo-alt-fill']"></i>
                                {{ $t('ruletest.Country') }}: <strong>{{ test.country }}&nbsp;</strong>
                                <span v-if="test.country_code !== $t('ruletest.StatusWait')"
                                    :class="'jn-fl fi fi-' + test.country_code.toLowerCase()"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';
import countryLookup from 'country-code-lookup';


export default {
    name: 'RuleTest',

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
            testCount: 8,
            ruleTests: [
                {
                    id: 1,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-1.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 2,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-2.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 3,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-3.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 4,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-4.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 5,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-5.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 6,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-6.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 7,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-7.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
                {
                    id: 8,
                    name: this.$t('ruletest.Name'),
                    url: 'ptest-8.ipcheck.ing',
                    ip: this.$t('ruletest.StatusWait'),
                    country_code: this.$t('ruletest.StatusWait'),
                    country: this.$t('ruletest.StatusWait'),
                },
            ],
            IPArray: [],
        };
    },

    methods: {

        // 获取 RuleTest 数据
        async fetchTrace(id, url) {
            try {
                const response = await fetch(`https://${url}/cdn-cgi/trace`);
                const data = await response.text();
                const lines = data.split("\n");
                const ipLine = lines.find((line) => line.startsWith("ip="));
                const countryLine = lines.find((line) => line.startsWith("loc="));
                if (ipLine) {
                    const ip = ipLine.split("=")[1];
                    this.ruleTests[id].ip = ip;
                    this.IPArray = [...this.IPArray, ip];
                }
                if (countryLine) {
                    const country = countryLine.split("=")[1];
                    this.ruleTests[id].country_code = country;
                    this.ruleTests[id].country = countryLookup.byIso(country).country;
                }
            } catch (error) {
                this.ruleTests[id].ip = this.$t('ruletest.StatusError');
                this.ruleTests[id].country_code = this.$t('ruletest.StatusError');
                this.ruleTests[id].country = this.$t('ruletest.StatusError');
                console.error("Error fetching Data:", error);
            }
        },

        // 检查所有 RuleTest
        async checkAllRuleTest(refresh = false) {

            if (refresh) {
                this.ruleTests.forEach((test) => {
                    test.ip = this.$t('ruletest.StatusWait');
                    test.country_code = this.$t('ruletest.StatusWait');
                });
            }

            const processTest = async (index) => {
                if (index < this.testCount) {
                    try {
                        await this.fetchTrace(index, this.ruleTests[index].url);
                    } catch (error) {
                        console.error("Error fetching Data:", error);
                    } finally {
                        processTest(index + 1);
                    }
                }
            };

            processTest(0);
        },
    },

    mounted() {
        setTimeout(() => {
            this.checkAllRuleTest();
        }, 1000);
    },
    watch: {
        IPArray: {
            handler() {
                this.$store.commit('updateGlobalIpDataCards', this.IPArray);
            },
            deep: true,
        },
    },
}
</script>

<style scoped>
.jn-text-warning {
    color: #c67c14;
}
</style>
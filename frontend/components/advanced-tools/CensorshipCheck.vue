<template>
    <!-- Censorship Check -->
    <div class="mtr-test-section my-4">
        <div class="text-secondary">
            <p>{{ t('censorshipcheck.Note') }}</p>
        </div>
        <div class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="col-12 col-md-auto">
                            <label for="queryURL" class="col-form-label">{{ t('censorshipcheck.Note2') }}</label>
                        </div>

                        <div class="input-group mb-2 mt-2 ">
                            <input type="text" class="form-control" :class="{ 'dark-mode': isDarkMode }"
                                :disabled="censorshipCheckStatus === 'running'"
                                :placeholder="t('censorshipcheck.Placeholder')" v-model="queryURL"
                                @keyup.enter="onSubmit" name="queryURL" id="queryURL" data-1p-ignore>

                            <button class="btn btn-primary" @click="onSubmit"
                                :disabled="censorshipCheckStatus === 'running' || !queryURL">
                                <span v-if="censorshipCheckStatus !== 'running'">{{
                                    t('censorshipcheck.Run') }}</span>
                                <span v-else class="spinner-grow spinner-grow-sm" aria-hidden="true"></span>
                            </button>

                        </div>
                        <div class="jn-placeholder">
                            <p v-if="errorMsg" class="text-danger">{{ errorMsg }}</p>
                        </div>

                        <!-- Result Display -->

                        <div id="censorshipresult" class="row" v-if="censorshipResults.length > 0">
                            <div class="col-md-6 col-12">
                                <h3 class="fs-4 alert alert-info ">{{ t('censorshipcheck.TestGroup') }}</h3>
                                <div class="table-responsive text-nowrap">

                                    <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                                        <thead>
                                            <tr>
                                                <template v-for="header in ['Country', 'Status', 'City', 'Network']"
                                                    :key="header">
                                                    <th scope="col">{{ t('censorshipcheck.' + header) }}</th>
                                                </template>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(result, index) in censorshipResults
                                                .filter(result => highRiskCountries.includes(result.country))"
                                                :key="result.country + '-' + result.city + '-' + index">
                                                <td>
                                                    <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>
                                                    {{ result.country_name }}
                                                </td>
                                                <td>
                                                    <i class="bi" :class="{
                                                        'bi-x-circle-fill text-danger': result.status === 'failed',
                                                        'bi-check-circle-fill text-success': result.status === 'finished',
                                                    }"></i>
                                                    <span v-if="result.status === 'in-progress'"
                                                        class="spinner-border spinner-border-sm"
                                                        aria-hidden="true"></span>
                                                </td>
                                                <td>{{ result.city }}</td>
                                                <td>{{ result.network }}</td>
                                            </tr>

                                        </tbody>

                                    </table>
                                </div>
                            </div>

                            <div class="col-md-6 col-12">
                                <h3 class="fs-4 alert alert-success">{{ t('censorshipcheck.ControlGroup') }}</h3>
                                <div class="table-responsive text-nowrap">

                                    <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                                        <thead>
                                            <tr>
                                                <template v-for="header in ['Country', 'Status', 'City', 'Network']"
                                                    :key="header">
                                                    <th scope="col">{{ t('censorshipcheck.' + header) }}</th>
                                                </template>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(result, index) in censorshipResults
                                                .filter(result => !highRiskCountries.includes(result.country))"
                                                :key="result.country + '-' + result.city + '-' + index">
                                                <td>
                                                    <span :class="'jn-fl fi fi-' + result.country.toLowerCase()"></span>
                                                    {{ result.country_name }}
                                                </td>
                                                <td>
                                                    <i class="bi" :class="{
                                                        'bi-x-circle-fill text-danger': result.status === 'failed',
                                                        'bi-check-circle-fill text-success': result.status === 'finished',
                                                    }"></i>
                                                    <span v-if="result.status === 'in-progress'"
                                                        class="spinner-border spinner-border-sm"
                                                        aria-hidden="true"></span>
                                                </td>
                                                <td>{{ result.city }}</td>
                                                <td>{{ result.network }}</td>
                                            </tr>

                                        </tbody>

                                    </table>
                                </div>

                            </div>

                        </div>

                        <transition @before-enter="beforeEnter" @enter="enter" @leave="leave">
                            <div v-if="censorshipCheckStatus === 'finished'">
                                <div class="alert" :class="{
                                    'alert-info': isDown,
                                    'alert-danger': isBlocked,
                                    'alert-success': !isBlocked && !isDown
                                }" :data-bs-theme="isDarkMode ? 'dark' : ''">

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
                                    <span class="opacity-75 fst-italic">( {{ t('censorshipcheck.Note3') }} )</span>

                                </div>
                            </div>
                        </transition>

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

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
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

// 检查 URL 输入是否有效
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

// 发起 http 测试
const startHttpCheck = () => {
    trackEvent('Section', 'StartClick', 'CensorshipCheck');
    const hostname = validateInput(queryURL.value);
    if (!hostname) {
        return;
    }
    let tryCount = 0;
    // 子函数：发起 http 请求
    const sendHttpRequest = async () => {
        censorshipCheckStatus.value = "running";
        try {
            const response = await fetch("https://api.globalping.io/v1/measurements", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    locations: [
                        { country: "CN", limit: 2 },
                        { country: "RU", limit: 2 },
                        { country: "TR", limit: 2 },
                        { country: "SA", limit: 2 },
                        { country: "JP" },
                        { country: "US" },
                        { country: "CA" },
                        { country: "IT" },
                        { country: "FI" },
                        { country: "AU" },
                        { country: "FR" },
                        { country: "DE" },
                    ],
                    target: hostname,
                    type: "http",
                    measurementOptions: {
                        "request": {
                            "host": hostname,
                            "path": "/",
                            "method": "HEAD"
                        },
                        "port": 443,
                        "protocol": "HTTPS"
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Error sending HTTP request:", error);
            censorshipCheckStatus.value = "error";
            errorMsg.value = t('censorshipcheck.invalidURL');
        }
    };

    // 子函数：获取 http 结果
    const fetchHttpResults = async (id) => {
        try {
            const response = await fetch(`https://api.globalping.io/v1/measurements/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

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

    // 执行流程
    sendHttpRequest().then(data => {
        if (data && data.id) {
            setTimeout(() => {
                fetchHttpResults(data.id);
            }, 3000);
        }
    });
};

// 过滤数据
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

// 结果修正
const correctResult = () => {
    // 超时的结果判断为连接失败
    censorshipResults.value.forEach(result => {
        if (result.status === 'in-progress') {
            result.status = 'failed';
        }
    });

    // 重新排序
    censorshipResults.value = [...censorshipResults.value.sort((a, b) => {
        // 高危国家排序
        const priorityIndexA = highRiskCountries.indexOf(a.country);
        const priorityIndexB = highRiskCountries.indexOf(b.country);

        if (priorityIndexA !== -1 && priorityIndexB !== -1) {
            return priorityIndexA - priorityIndexB;
        }

        // 如果只有一个是优先国家，那么这个国家排在前面
        if (priorityIndexA !== -1) {
            return -1;
        }
        if (priorityIndexB !== -1) {
            return 1;
        }

        // 如果都不是优先国家，按国家代码的字母顺序排序
        return a.country.localeCompare(b.country);
    })];
};

// 计算结果
const calResult = (testResults) => {
    // 重置状态
    blockedCountries.value = [];
    isBlocked.value = false;
    isDown.value = false;

    // 判断测试结果是否失败的函数
    const isFailedResult = result => result.status === 'failed' && result.headers === '';

    // 检查高风险国家
    const blockedHighRiskCountries = highRiskCountries.filter(country => {
        const countryResults = testResults.filter(result => result.country === country);
        return countryResults.length > 0 && countryResults.every(isFailedResult);
    });

    // 检查非高风险国家状态
    const otherResults = testResults.filter(result => !highRiskCountries.includes(result.country));
    const failedOtherResultsCount = otherResults.filter(isFailedResult).length;
    const failureRate = otherResults.length ? failedOtherResultsCount / otherResults.length : 0;

    // 判断网站状态
    if (failureRate > 0.5) {
        // 超过一半非高风险国家失败，可能是网站问题
        isDown.value = true;
    } else {
        // 否则更新被封锁国家列表
        blockedCountries.value = blockedHighRiskCountries;
        isBlocked.value = blockedHighRiskCountries.length > 0;
    }
    if (isSignedIn.value) {
        checkAchievements();
    }
};

// 检查是否达成成就
const checkAchievements = () => {
    if (isBlocked.value) {
        if (!store.userAchievements.ItIsOpen.achieved) {
            store.setTriggerUpdateAchievements('ItIsOpen');
        }
    }
}

// 一些动画效果
const beforeEnter = (el) => {
    el.style.height = '0';
};
const enter = (el, done) => {
    el.classList.add('collapsing');
    el.style.height = 'fit-content';
    el.addEventListener('transitionend', done);
};
const leave = (el, done) => {
    el.style.height = '0';
    el.addEventListener('transitionend', done);
}

</script>

<style scoped>
.jn-focus-remove {
    outline: none;
}

.jn-placeholder {
    height: 16pt;
}
</style>
<template>
    <!-- Whois Resolver -->
    <div class="whois-section mb-4">
        <div class="jn-title2">
            <h2 id="Whois" :class="{ 'mobile-h2': isMobile }">📓 {{ t('whois.Title') }}</h2>
        </div>
        <div class="text-secondary">
            <p>{{ t('whois.Note') }}</p>
        </div>
        <div class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="col-12 col-md-auto">
                            <label for="queryURLorIP" class="col-form-label">{{ t('whois.Note2') }}</label>
                        </div>

                        <div class="input-group mb-2 mt-2 ">
                            <input type="text" class="form-control" :class="{ 'dark-mode': isDarkMode }"
                                :disabled="whoisCheckStatus === 'running'" :placeholder="t('whois.Placeholder')"
                                v-model="queryURLorIP" @keyup.enter="onSubmit" name="queryURLorIP" id="queryURLorIP"
                                data-1p-ignore>

                            <button class="btn btn-primary" @click="onSubmit"
                                :disabled="whoisCheckStatus === 'running' || !queryURLorIP">
                                <span v-if="whoisCheckStatus === 'idle'">{{
                                    t('whois.Run') }}</span>
                                <span v-if="whoisCheckStatus === 'running'" class="spinner-grow spinner-grow-sm"
                                    aria-hidden="true"></span>
                            </button>

                        </div>

                        <div class="jn-placeholder">
                            <p v-if="errorMsg" class="text-danger">{{ errorMsg }}</p>
                        </div>

                        <!-- Results Table -->
                        <div v-if="whoisResults && Object.keys(whoisResults).length">

                            <div class="alert alert-success ">{{ t('whois.Note3') }}</div>
                            <div v-if="type === 'domain'" class="accordion" id="whoisResultAccordion"
                                :data-bs-theme="isDarkMode ? 'dark' : ''">
                                <div class="accordion-item" v-for="(provider, index) in providers" :key="provider">
                                    <h2 class="accordion-header" :id="'heading' + index">
                                        <button class="accordion-button" type="button" data-bs-toggle="collapse"
                                            :data-bs-target="'#collapse' + index"
                                            :aria-expanded="index === 0 ? 'true' : 'false'"
                                            :aria-controls="'collapse' + index" :class="{ collapsed: index !== 0 }">
                                            <span><i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                                                <strong>{{ t('whois.Provider') }} : {{ provider.toUpperCase()
                                                    }}</strong></span>
                                        </button>
                                    </h2>
                                    <div :id="'collapse' + index" class="accordion-collapse collapse"
                                        :class="{ show: index === 0 }" :aria-labelledby="'heading' + index">
                                        <div class="accordion-body" :class="[isMobile ? ' p-2' : '']">
                                            <div class="card card-body border-0 mt-3"
                                                :class="[isDarkMode ? 'bg-black text-light' : 'bg-light']">
                                                <pre>{{ filterDomainWhoisRawData(whoisResults[providers[index]].__raw) }}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div v-else class="card card-body border-0 mt-3"
                                :class="[isDarkMode ? 'bg-black text-light' : 'bg-light']">
                                <pre>{{ filterIPWhoisRawData(whoisResults.__raw) }}</pre>
                            </div>

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
import { isValidIP } from '@/utils/valid-ip.js';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

const queryURLorIP = ref('');
const whoisCheckStatus = ref('idle');
const errorMsg = ref('');
const providers = ref([]);
const type = ref('');
const whoisResults = ref({});

// 检查 URL 输入是否有效
const formatURL = (domain) => {
    // 检查是否包含协议头，若没有则尝试为其添加 http:// 以便进行 URL 格式验证
    if (!domain.match(/^https?:\/\//)) {
        domain = 'http://' + domain;
    }

    try {
        const url = new URL(domain);
        const hostname = url.hostname;

        const parts = hostname.split('.');
        const mainDomain = parts.slice(-2).join('.');

        if (mainDomain.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) {
            return mainDomain;
        }
    } catch {
    }
    return false;
};

// 检查输入是否有效
const validInput = (input) => {

    if (formatURL(input)) {
        type.value = 'domain';
        return formatURL(input);
    } else if (isValidIP(input)) {
        type.value = 'ip';
        return input;
    } else {
        errorMsg.value = t('whois.invalidURL');
        return false;
    };
};

// 提交查询
const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'Whois');
    errorMsg.value = '';
    providers.value = [];
    whoisResults.value = {};
    const query = validInput(queryURLorIP.value);
    if (query) {
        getWhoisResults(query);
    }
};

// 获取 Whois 结果
const getWhoisResults = async (query) => {
    whoisCheckStatus.value = 'running';
    try {
        const response = await fetch(`/api/whois?q=${query}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        getProviders(data);
        if (type.value === 'domain' && providers.value.length >= 1) {
            whoisResults.value = data;
            errorMsg.value = '';
        } else if (type.value === 'ip' && data.__raw) {
            whoisResults.value = data;
            errorMsg.value = '';
        } else {
            errorMsg.value = t('whois.fetchError');
        }
        whoisCheckStatus.value = 'idle';
    } catch (error) {
        console.error('Error fetching Whois results:', error);
        whoisCheckStatus.value = 'idle';
        errorMsg.value = t('whois.fetchError');
    }
};

// 获取 Whois 服务商
const getProviders = (data) => {
    if (type.value === 'domain') {
        for (const [key, value] of Object.entries(data)) {
            if (key.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) {
                if (data[key].__raw) {
                    providers.value.push(key);
                }
            }
        }
    }
};

const filterDomainWhoisRawData = (text) => {
    text = text.replace(/^( {1,20})/gm, ''); // 先移除文本里，每一行开头的连续空格
    const cutoffIndex = text.indexOf('\nFor more information'); // 移除不必要的其它信息
    return cutoffIndex !== -1 ? text.substring(0, cutoffIndex) : text;
};

const filterIPWhoisRawData = (text) => {
    text = text.replace(/^#.*\n/gm, ''); // 移除所有以 # 开头的行
    text = text.replace(/^\n*/, ''); // 移除开头的所有空行
    text = text.replace(/\n$/, ''); // 移除最后一个空行
    return text;
};
</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
}
</style>

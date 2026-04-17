<template>
    <!-- Whois Resolver -->
    <div class="whois-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('whois.Note') }}</p>
        </div>
        <div class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div>
                        <label for="queryURLorIP" class="inline-block">{{ t('whois.Note2') }}</label>
                    </div>

                    <div class="flex mb-2 mt-2">
                        <Input type="text" class="rounded-r-none"
                            :disabled="whoisCheckStatus === 'running'"
                            :placeholder="t('whois.Placeholder')"
                            v-model="queryURLorIP" @keyup.enter="onSubmit"
                            name="queryURLorIP" id="queryURLorIP" data-1p-ignore />
                        <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                            @click="onSubmit"
                            :disabled="whoisCheckStatus === 'running' || !queryURLorIP">
                            <span v-if="whoisCheckStatus === 'idle'">{{ t('whois.Run') }}</span>
                            <span v-if="whoisCheckStatus === 'running'"
                                class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                        </Button>
                    </div>

                    <div class="jn-placeholder">
                        <p v-if="errorMsg" class="text-red-600">{{ errorMsg }}</p>
                    </div>

                    <!-- Results -->
                    <div v-if="whoisResults && Object.keys(whoisResults).length">
                        <div class="px-3 py-2 rounded-md border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
                            {{ t('whois.Note3') }}
                        </div>
                        <Accordion v-if="type === 'domain'" type="single" collapsible default-value="0">
                            <AccordionItem v-for="(provider, index) in providers" :key="provider"
                                :value="String(index)">
                                <AccordionTrigger>
                                    <span>
                                        <i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                                        <strong>{{ t('whois.Provider') }} : {{ provider.toUpperCase() }}</strong>
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent :class="[isMobile ? 'p-2' : '']">
                                    <div class="border-0 mt-3 p-4 rounded"
                                        :class="[isDarkMode ? 'bg-black text-neutral-100' : 'bg-neutral-100']">
                                        <pre>{{ filterDomainWhoisRawData(whoisResults[providers[index]].__raw) }}</pre>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div v-else class="border-0 mt-3 p-4 rounded"
                            :class="[isDarkMode ? 'bg-black text-neutral-100' : 'bg-neutral-100']">
                            <pre>{{ filterIPWhoisRawData(whoisResults.__raw) }}</pre>
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const isSignedIn = computed(() => store.isSignedIn);

const queryURLorIP = ref('');
const whoisCheckStatus = ref('idle');
const errorMsg = ref('');
const providers = ref([]);
const type = ref('');
const whoisResults = ref({});

const formatURL = (domain) => {
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
    }
};

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
            if (isSignedIn.value && query.toLowerCase().includes('ipcheck.ing')) {
                checkAchievements();
            }
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
    text = text.replace(/^( {1,20})/gm, '');
    const cutoffIndex = text.indexOf('\nFor more information');
    return cutoffIndex !== -1 ? text.substring(0, cutoffIndex) : text;
};

const filterIPWhoisRawData = (text) => {
    text = text.replace(/^#.*\n/gm, '');
    text = text.replace(/^\n*/, '');
    text = text.replace(/\n$/, '');
    return text;
};

const checkAchievements = () => {
    if (!store.userAchievements.CuriousCat.achieved) {
        store.setTriggerUpdateAchievements('CuriousCat');
    }
};
</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
}
</style>

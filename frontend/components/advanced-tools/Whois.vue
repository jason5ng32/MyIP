<template>
    <div class="whois-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('whois.Note') }}</p>

        <!-- Input area -->
        <div class="space-y-2">
            <Label for="queryURLorIP">{{ t('whois.Note2') }}</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="queryURLorIP" name="queryURLorIP" data-1p-ignore
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    :disabled="whoisCheckStatus === 'running'"
                    :placeholder="t('whois.Placeholder')"
                    v-model="queryURLorIP" @keyup.enter="onSubmit" :aria-invalid="errorMsg !== ''" />
                <Button variant="action"
                    :disabled="whoisCheckStatus === 'running' || !queryURLorIP"
                    @click="onSubmit" class="cursor-pointer">
                    <Spinner v-if="whoisCheckStatus === 'running'" />
                    <template v-else>
                        <Search class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- Result area -->
        <div v-if="whoisResults && Object.keys(whoisResults).length" class="space-y-3">
            <!-- Top success prompt bar -->
            <div class="flex items-start gap-2 p-3 rounded-md border border-success/30 bg-success/10 text-sm text-success">
                <Info class="size-4 mt-0.5 shrink-0" />
                <span class="leading-relaxed">{{ t('whois.Note3') }}</span>
            </div>

            <!-- domain type: multiple provider Accordion -->
            <Accordion v-if="type === 'domain'" type="single" collapsible default-value="0" class="space-y-2">
                <AccordionItem v-for="(provider, index) in providers" :key="provider" :value="String(index)"
                    class="rounded-lg border bg-card px-4">
                    <AccordionTrigger class="hover:no-underline">
                        <div class="flex items-center gap-2 min-w-0">
                            <span
                                class="shrink-0 inline-flex size-5 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
                                {{ index + 1 }}
                            </span>
                            <span class="text-sm text-muted-foreground">{{ t('whois.Provider') }}:</span>
                            <span class="text-sm font-semibold truncate">{{ provider.toUpperCase() }}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <pre
                            class="mt-2 p-4 rounded-md bg-muted font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap wrap-break-word">{{ filterDomainWhoisRawData(whoisResults[providers[index]].__raw) }}</pre>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <!-- ip type: single block raw output -->
            <div v-else>
                <pre
                    class="p-4 rounded-md bg-muted font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap wrap-break-word">{{ filterIPWhoisRawData(whoisResults.__raw) }}</pre>
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
import { Spinner } from '@/components/ui/spinner';
import { Info, Search } from 'lucide-vue-next';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const store = useMainStore();
const isSignedIn = computed(() => store.isSignedIn);

const queryURLorIP = ref('');
const whoisCheckStatus = ref('idle');
const errorMsg = ref('');
const providers = ref([]);
const type = ref('');
const whoisResults = ref({});

const formatURL = (domain) => {
    if (!domain.match(/^https?:\/\//)) domain = 'http://' + domain;
    try {
        const url = new URL(domain);
        const hostname = url.hostname;
        const parts = hostname.split('.');
        const mainDomain = parts.slice(-2).join('.');
        if (mainDomain.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) return mainDomain;
    } catch { /* noop */ }
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
    if (query) getWhoisResults(query);
};

const getWhoisResults = async (query) => {
    whoisCheckStatus.value = 'running';
    try {
        const response = await fetch(`/api/whois?q=${query}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        getProviders(data);
        if (type.value === 'domain' && providers.value.length >= 1) {
            whoisResults.value = data;
            if (isSignedIn.value && query.toLowerCase().includes('ipcheck.ing')) checkAchievements();
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
        for (const [key] of Object.entries(data)) {
            if (key.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) {
                if (data[key].__raw) providers.value.push(key);
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

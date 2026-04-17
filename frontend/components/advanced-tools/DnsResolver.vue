<template>
    <!-- DNS Resolver -->
    <div class="dns-resolver-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('dnsresolver.Note') }}</p>
        </div>
        <div class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div>
                        <label for="queryURL" class="inline-block">{{ t('dnsresolver.Note2') }}</label>
                    </div>

                    <div class="flex mb-2 mt-2">
                        <Input type="text" class="rounded-r-none"
                            :disabled="dnsCheckStatus === 'running'"
                            :placeholder="t('dnsresolver.Placeholder')"
                            v-model="queryURL" @keyup.enter="onSubmit"
                            name="queryURL" id="queryURL" data-1p-ignore />

                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button type="button"
                                    class="rounded-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                                    :disabled="dnsCheckStatus === 'running' || !queryURL">
                                    {{ queryType }} {{ t('dnsresolver.Record') }}
                                    <span class="sr-only">Choose Type</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem v-for="type in ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT']"
                                    :key="type" @select="changeType(type)">
                                    {{ type }}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                            @click="onSubmit"
                            :disabled="dnsCheckStatus === 'running' || !queryURL">
                            <span v-if="dnsCheckStatus === 'idle'">{{ t('dnsresolver.Run') }}</span>
                            <span v-if="dnsCheckStatus === 'running'"
                                class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                        </Button>
                    </div>
                    <div class="jn-placeholder">
                        <p v-if="errorMsg" class="text-red-600">{{ errorMsg }}</p>
                    </div>

                    <!-- Results Table -->
                    <div v-if="combinedResults && combinedResults.length">
                        <div class="overflow-x-auto whitespace-nowrap">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                        <th scope="col" class="text-left p-2">{{ t('dnsresolver.Provider') }}</th>
                                        <th scope="col" class="text-left p-2">{{ t('dnsresolver.Result') }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(result, index) in combinedResults" :key="index"
                                        class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ result.provider }}</td>
                                        <td class="p-2" :class="[result.address === 'N/A' ? 'opacity-50' : '']">
                                            {{ result.address }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const queryURL = ref('');
const queryType = ref('A');
const dnsCheckStatus = ref('idle');
const errorMsg = ref('');
const combinedResults = ref([]);

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
    errorMsg.value = t('dnsresolver.invalidURL');
    return null;
};

const changeType = (type) => {
    queryType.value = type;
};

const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'DNSResolver');
    errorMsg.value = '';
    const hostname = validateInput(queryURL.value);
    const type = queryType.value;
    if (hostname) {
        getDNSResults(hostname, type);
    }
};

const getDNSResults = async (hostname, type) => {
    combinedResults.value = [];
    dnsCheckStatus.value = 'running';
    try {
        const response = await fetch(`/api/dnsresolver?hostname=${hostname}&type=${type}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        processResults(data);
        dnsCheckStatus.value = 'idle';
        errorMsg.value = '';
    } catch (error) {
        console.error('Error fetching DNS results:', error);
        dnsCheckStatus.value = 'idle';
        errorMsg.value = t('dnsresolver.fetchError');
    }
};

const processResults = (data) => {
    const processEntries = (entries, type) => entries.map(entry => {
        const provider = Object.keys(entry)[0];
        const address = Array.isArray(entry[provider]) ? entry[provider].join(', ') : entry[provider];
        return { provider: `${provider} (${type})`, address };
    });

    if (data.result_dns) {
        combinedResults.value.push(...processEntries(data.result_dns, 'DNS'));
    }
    if (data.result_doh) {
        combinedResults.value.push(...processEntries(data.result_doh, 'DoH 🔒'));
    }
};
</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
}
</style>

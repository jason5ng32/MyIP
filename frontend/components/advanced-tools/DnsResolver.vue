<template>
    <div class="dns-resolver-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground">{{ t('dnsresolver.Note') }}</p>

        <!-- Input area -->
        <div class="space-y-3">
            <Label for="queryURL">{{ t('dnsresolver.Note2') }}</Label>

            <!-- Record type selector: 6 options → ToggleGroup horizontally -->
            <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-muted-foreground">{{ t('dnsresolver.Record') }}:</span>
                <ToggleGroup :model-value="queryType" type="single"
                    @update:model-value="(v) => v && changeType(v)">
                    <ToggleGroupItem v-for="type in recordTypes" :key="type" :value="type" class="h-8 px-3">
                        {{ type }}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <!-- Input + Run -->
            <div class="flex items-center gap-2">
                <Input type="text" id="queryURL" name="queryURL" data-1p-ignore
                    :disabled="dnsCheckStatus === 'running'"
                    :placeholder="t('dnsresolver.Placeholder')"
                    v-model="queryURL" @keyup.enter="onSubmit" :aria-invalid="errorMsg !== ''" />
                <Button variant="action"
                    :disabled="dnsCheckStatus === 'running' || !queryURL"
                    @click="onSubmit" class="cursor-pointer">
                    <Spinner v-if="dnsCheckStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- Result table -->
        <Card v-if="combinedResults && combinedResults.length">
            <CardContent class="p-0">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b">
                                <th scope="col"
                                    class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    {{ t('dnsresolver.Provider') }}
                                </th>
                                <th scope="col"
                                    class="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    {{ t('dnsresolver.Result') }}
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr v-for="(result, index) in combinedResults" :key="index"
                                class="hover:bg-muted/50 transition-colors">
                                <td class="px-4 py-2.5 whitespace-nowrap font-medium">{{ result.provider }}</td>
                                <td class="px-4 py-2.5 font-mono wrap-break-word"
                                    :class="result.address === 'N/A' ? 'text-muted-foreground/60' : ''">
                                    {{ result.address }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { Play } from 'lucide-vue-next';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const queryURL = ref('');
const queryType = ref('A');
const dnsCheckStatus = ref('idle');
const errorMsg = ref('');
const combinedResults = ref([]);

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT'];

const validateInput = (input) => {
    if (!input.match(/^https?:\/\//)) input = 'http://' + input;
    try {
        const url = new URL(input);
        const hostname = url.hostname;
        if (hostname.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) return hostname;
    } catch { /* noop */ }
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
    if (hostname) getDNSResults(hostname, type);
};

const getDNSResults = async (hostname, type) => {
    combinedResults.value = [];
    dnsCheckStatus.value = 'running';
    try {
        const response = await fetch(`/api/dnsresolver?hostname=${hostname}&type=${type}`);
        if (!response.ok) throw new Error('Network response was not ok');
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
    const processEntries = (entries, kind) => entries.map(entry => {
        const provider = Object.keys(entry)[0];
        const address = Array.isArray(entry[provider]) ? entry[provider].join(', ') : entry[provider];
        return { provider: `${provider} (${kind})`, address };
    });

    if (data.result_dns) combinedResults.value.push(...processEntries(data.result_dns, 'DNS'));
    if (data.result_doh) combinedResults.value.push(...processEntries(data.result_doh, 'DoH 🔒'));
};
</script>

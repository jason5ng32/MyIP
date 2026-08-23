<template>
    <div class="dns-resolver-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground">{{ t('dnsresolver.Note') }}</p>

        <!-- Input area -->
        <div class="space-y-3">
            <Label for="queryURL">{{ t('dnsresolver.Note2') }}</Label>

            <!-- Record type selector: 6 options → ToggleGroup horizontally -->
            <div class="flex flex-col md:flex-row items-start md:items-center gap-2">
                <span class="text-xs text-muted-foreground">{{ t('dnsresolver.Record') }}:</span>
                <ToggleGroup :model-value="queryType" type="single" variant="outline"
                    @update:model-value="(v) => v && changeType(v)">
                    <ToggleGroupItem v-for="type in recordTypes" :key="type" :value="type"
                        class="flex-1 gap-1.5 min-w-12 md:min-w-20 cursor-pointer" :aria-label="type" :title="type">
                        {{ type }}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <!-- Input + Run -->
            <div class="flex items-center gap-2">
                <Input type="text" id="queryURL" name="queryURL" data-1p-ignore data-lpignore="true" class="font-mono"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    :disabled="dnsCheckStatus === 'running'"
                    :placeholder="t('dnsresolver.Placeholder')" v-model="queryURL" @keyup.enter="onSubmit"
                    :aria-invalid="errorMsg !== ''" />
                <Button variant="action" :disabled="dnsCheckStatus === 'running' || !queryURL" @click="onSubmit"
                    class="cursor-pointer">
                    <Spinner v-if="dnsCheckStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- Results: region filter chips + provider table -->
        <div v-if="combinedResults && combinedResults.length" class="space-y-3">
            <!-- Country selector (first-appearance order from the response),
                 badge-shaped toggles: all regions + one per country. -->
            <ToggleGroup :model-value="countryFilter" type="single" variant="outline" size="sm"
                class="flex-wrap justify-start"
                @update:model-value="(v) => v && (countryFilter = v)">
                <ToggleGroupItem value="all" class="gap-1.5 cursor-pointer">
                    {{ t('dnsresolver.AllRegions') }}
                </ToggleGroupItem>
                <ToggleGroupItem v-for="country in resultCountries" :key="country" :value="country"
                    class="gap-1.5 cursor-pointer" :aria-label="countryName(country)">
                    <Icon :icon="'circle-flags:' + country.toLowerCase()" class="size-3.5 shrink-0" />
                    {{ countryName(country) }}
                </ToggleGroupItem>
            </ToggleGroup>

            <Card>
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
                                <tr v-for="(result, index) in filteredResults" :key="result.country + '-' + index"
                                    class="hover:bg-muted/50 transition-colors">
                                    <td class="px-4 py-2.5 whitespace-nowrap font-medium">
                                        <span class="flex items-center gap-2">
                                            <Icon :icon="'circle-flags:' + result.country.toLowerCase()"
                                                class="size-4 shrink-0" :title="countryName(result.country)" />
                                            {{ result.provider }}
                                        </span>
                                    </td>
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
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { trackEvent } from '@/utils/analytics';
import { isValidDomain } from '@/utils/valid-ip.js';
import getCountryName from '@/data/country-name.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { Play } from '@lucide/vue';
import { Label } from '@/components/ui/label';

const { t, locale } = useI18n();

const queryURL = ref('');
const queryType = ref('A');
const dnsCheckStatus = ref('idle');
const errorMsg = ref('');
const combinedResults = ref([]);
const countryFilter = ref('all');

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA'];

const validateInput = (input) => {
    if (!input.match(/^https?:\/\//)) input = 'http://' + input;
    try {
        const url = new URL(input);
        if (isValidDomain(url.hostname)) return url.hostname;
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

// Flatten the API's { id, provider, country, type, result } rows into
// display rows; the protocol keeps its label suffix on the provider name.
const processResults = (data) => {
    if (!Array.isArray(data.results)) return;
    combinedResults.value = data.results.map(entry => ({
        country: entry.country,
        provider: `${entry.provider} (${entry.type === 'doh' ? 'DoH 🔒' : 'DNS'})`,
        address: Array.isArray(entry.result) ? entry.result.join(', ') : entry.result,
    }));
    // A previously selected region may be absent from the new result set.
    if (countryFilter.value !== 'all' && !resultCountries.value.includes(countryFilter.value)) {
        countryFilter.value = 'all';
    }
};

// Countries present in the results, first-appearance order.
const resultCountries = computed(() => [...new Set(combinedResults.value.map((r) => r.country))]);

const filteredResults = computed(() => (countryFilter.value === 'all'
    ? combinedResults.value
    : combinedResults.value.filter((r) => r.country === countryFilter.value)));

// Localized country name via Intl.DisplayNames; fall back to the raw code.
const countryName = (code) => getCountryName(code, locale.value) || code;
</script>

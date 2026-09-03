<!-- IP Calculator (advanced tool, slug `ipcalculator`): one smart input
     (IPv4 / IPv6, prefix, number, range, prefix list — never a MAC, that is
     MAC Lookup's job) dispatched to the matching card under ./ip-calculator/.
     Pure local computation via utils/ip-calc.js.

     The query rides the URL as `?q=` on both /tools/ipcalculator and
     /?tool=ipcalculator, written back on every run so results are shareable.
     Example pills under the input teach the accepted syntaxes; on the home
     page the visitor's own IPs (store.allIPs) are offered the same way. -->
<template>
    <div class="ip-calculator-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('ipcalculator.Note') }}</p>

        <!-- Input area: label + Input + icon trigger -->
        <div class="space-y-2">
            <Label for="ipCalcQuery">{{ t('ipcalculator.Note2') }}</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="ipCalcQuery" name="ipCalcQuery" data-1p-ignore data-lpignore="true"
                    class="font-mono" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    :placeholder="t('ipcalculator.Placeholder')" v-model="query" @keyup.enter="onSubmit"
                    :aria-invalid="errorMsg !== ''" />
                <Button variant="action" :disabled="!query.trim()" @click="onSubmit" class="cursor-pointer"
                    :aria-label="t('ipcalculator.Calculate')">
                    <Calculator class="size-4 shrink-0" />
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

            <!-- Example inputs: one per accepted syntax, tap to run -->
            <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-muted-foreground">{{ t('ipcalculator.Examples') }}</span>
                <ToggleGroup :model-value="picked" type="single" variant="outline" :spacing="2"
                    class="flex-wrap justify-start" @update:model-value="(v) => v && runPreset(v)">
                    <ToggleGroupItem v-for="example in EXAMPLES" :key="example.input" :value="example.input"
                        :class="tagClass" :aria-label="`${t(example.labelKey)}: ${example.input}`">
                        <span class="text-muted-foreground">{{ t(example.labelKey) }}</span>
                        <span class="font-mono">{{ example.input }}</span>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <!-- The visitor's own IPs as one-tap pills (home page only) -->
            <div v-if="myIPs.length" class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-muted-foreground">{{ t('ipcalculator.MyIPs') }}</span>
                <ToggleGroup :model-value="picked" type="single" variant="outline" :spacing="2"
                    class="flex-wrap justify-start" @update:model-value="(v) => v && runPreset(v)">
                    <ToggleGroupItem v-for="item in myIPs" :key="item.ip" :value="item.ip" :class="tagClass"
                        :aria-label="item.ip">
                        <Icon v-if="item.country" :icon="'circle-flags:' + item.country.toLowerCase()" class="size-3.5 shrink-0" />
                        <span class="max-w-56 truncate font-mono">{{ item.ip }}</span>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </div>

        <!-- Result -->
        <template v-if="result">
            <div class="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{{ t(`ipcalculator.kind.${camel(result.kind)}`) }}</Badge>
                <Badge v-for="block in blocks" :key="block.id" :variant="block.global ? 'success' : 'secondary'"
                    class="max-w-full">
                    <span class="truncate">{{ block.label }} · RFC {{ block.rfc.join(', ') }}</span>
                </Badge>
                <span v-if="scope" class="text-xs text-muted-foreground">{{ t(`ipcalculator.scope.${camel(scope)}`) }}</span>
            </div>

            <component :is="resultComponent" v-bind="resultProps"
                @update:prefix="onPrefix" @commit:prefix="onPrefixCommit" />
        </template>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { Calculator } from '@lucide/vue';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { isValidIP } from '@/utils/valid-ip.js';
import { selectableIPs } from '@/composables/use-globalping-measurement.js';
import { analyzeCidr, calculate } from '@/utils/ip-calc.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Ipv4Result from './ip-calculator/Ipv4Result.vue';
import Ipv6Result from './ip-calculator/Ipv6Result.vue';
import RangeResult from './ip-calculator/RangeResult.vue';

const { t } = useI18n();
const store = useMainStore();
const route = useRoute();
const router = useRouter();

const query = ref('');
const errorMsg = ref('');
const result = ref(null);
// Which pill (example or own IP) the current result came from, if any.
const picked = ref('');

// One example per accepted syntax; the pills double as syntax documentation.
const EXAMPLES = [
    { labelKey: 'ipcalculator.kind.ipv4Cidr', input: '192.168.1.130/26' },
    { labelKey: 'ipcalculator.kind.ipv6', input: '2001:db8:85a3::8a2e:370:7334' },
    { labelKey: 'ipcalculator.kind.ipv6Cidr', input: '2001:db8::/48' },
    { labelKey: 'ipcalculator.kind.range', input: '10.0.0.1-10.0.0.254' },
    { labelKey: 'ipcalculator.kind.cidrList', input: '192.168.0.0/24 192.168.1.0/24' },
    { labelKey: 'ipcalculator.kind.hex', input: '0x7f000001' },
    { labelKey: 'ipcalculator.exampleObfuscated', input: '127.1' },
    { labelKey: 'ipcalculator.exampleEui64', input: 'fe80::211:22ff:fe33:4455' },
];

// Pills match IPHistory / DnsResolver's tag row.
const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';

// i18n keys are camelCase; classifier ids use hyphens (`ipv4-cidr`, `link-local`).
const camel = (id) => id.replace(/-(\w)/g, (_, c) => c.toUpperCase());

const myIPs = computed(() => selectableIPs(store.allIPs).filter((e) => isValidIP(e.ip)));

/* ------------------------------------------------------------------ */
/* Running the calculator                                              */
/* ------------------------------------------------------------------ */

const run = (raw) => {
    const r = calculate(raw);
    if (r.kind === 'invalid') {
        result.value = null;
        errorMsg.value = t(`ipcalculator.invalid.${camel(r.reason)}`);
        return;
    }
    errorMsg.value = '';
    // `split` feeds the subnet splitter and lags `cidr` during a drag.
    if (r.analysis?.cidr) r.analysis.split = r.analysis.cidr;
    result.value = r;
};

// Keep `?q=` in step with the last run without growing history.
const syncQuery = () => {
    const q = query.value.trim();
    if (route.query.q === q) return;
    router.replace({ query: { ...route.query, q } });
};

const onSubmit = () => {
    const raw = query.value.trim();
    if (!raw) return;
    trackEvent('Section', 'StartClick', 'IpCalculator');
    const presets = [...EXAMPLES.map((e) => e.input), ...myIPs.value.map((e) => e.ip)];
    picked.value = presets.includes(raw) ? raw : '';
    run(raw);
    syncQuery();
};

const runPreset = (input) => {
    query.value = input;
    onSubmit();
};

// While dragging, prefix math follows live but the subnet list stays put: a
// shrinking list shortens the page and the scroll clamp would yank the thumb
// from under the pointer. The list catches up on release.
const onPrefix = (prefix) => {
    const a = result.value?.analysis;
    if (!a?.address) return;
    const ip = a.address.family === 4 ? a.address.canonical : a.address.compressed;
    a.cidr = analyzeCidr(`${ip}/${prefix}`);
};

const onPrefixCommit = (prefix) => {
    onPrefix(prefix);
    const a = result.value?.analysis;
    if (a?.cidr) a.split = a.cidr;
};

onMounted(() => {
    const q = route.query.q;
    if (typeof q === 'string' && q.trim()) {
        query.value = q;
        run(q);
    }
});

/* ------------------------------------------------------------------ */
/* Result dispatch                                                     */
/* ------------------------------------------------------------------ */

const addressFamily = computed(() => result.value?.analysis?.address?.family ?? null);

const resultComponent = computed(() => {
    switch (result.value?.kind) {
        case 'range':
        case 'cidr-list': return RangeResult;
        default: return addressFamily.value === 4 ? Ipv4Result : Ipv6Result;
    }
});

// The BigInt the bitmap needs: `value` for hosts / numbers, `cidr.address` for prefixes.
const addressValue = computed(() => {
    const r = result.value;
    if (!r) return null;
    return r.cidr ? r.cidr.address : r.value;
});

const resultProps = computed(() => {
    const r = result.value;
    switch (r.kind) {
        case 'range':
        case 'cidr-list': return { analysis: r.analysis, kind: r.kind };
        default: return { analysis: r.analysis, value: addressValue.value, zone: r.zone ?? null };
    }
});

const blocks = computed(() => result.value?.analysis?.address?.blocks ?? []);
const scope = computed(() => result.value?.analysis?.address?.scope ?? null);
</script>

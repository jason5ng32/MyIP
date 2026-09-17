<!-- Result card for the two set-shaped inputs: an address range (start –
     end → the fewest CIDRs that cover it) and a list of prefixes (aggregated
     per family, overlaps absorbed, adjacent siblings merged). Lists are
     bordered <ul>s with copy-all; ignored tokens are reported, not hidden. -->
<template>
    <Card>
        <CardContent class="space-y-8 p-4 md:p-6">
            <!-- Range -->
            <template v-if="kind === 'range'">
                <CalcSection :icon="Route" :title="t('ipcalculator.section.Range')">
                    <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                        <ValueRow :label="t('ipcalculator.start')" :value="analysis.start" />
                        <ValueRow :label="t('ipcalculator.end')" :value="analysis.end" />
                        <ValueRow :label="t('ipcalculator.total')" :value="countLabel(analysis.count)" :copy="false" />
                        <ValueRow :label="t('ipcalculator.aggregated')" :value="analysis.aggregated" />
                    </dl>
                </CalcSection>
                <CidrList :title="t('ipcalculator.section.Cidrs')" :cidrs="analysis.cidrs" />
            </template>

            <!-- Prefix list, per family -->
            <template v-else>
                <template v-for="fam in families" :key="fam.key">
                    <CidrList :title="t(`ipcalculator.section.${fam.title}`)" :cidrs="fam.data.aggregated">
                        <p class="mt-2 text-xs text-muted-foreground">
                            {{ t('ipcalculator.aggregationSummary', {
                                input: fam.data.input.length,
                                output: fam.data.aggregated.length,
                                addresses: countLabel(fam.data.count),
                            }) }}
                        </p>
                    </CidrList>
                </template>
                <p v-if="analysis.invalid.length" class="m-0 text-xs text-muted-foreground">
                    {{ t('ipcalculator.invalidTokens', { list: analysis.invalid.join(', ') }) }}
                </p>
            </template>
        </CardContent>
    </Card>
</template>

<script setup>
import { computed, defineComponent, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { ListTree, Route } from '@lucide/vue';
import { Card, CardContent } from '@/components/ui/card';
import CopyButton from '@/components/widgets/CopyButton.vue';
import CalcSection from './CalcSection.vue';
import ValueRow from './ValueRow.vue';
import { countLabel } from '@/utils/ip-calc.js';

const props = defineProps({
    analysis: { type: Object, required: true },
    kind: { type: String, required: true },
});
const { t } = useI18n();

const families = computed(() => [
    { key: 'v4', title: 'IPv4Blocks', data: props.analysis.v4 },
    { key: 'v6', title: 'IPv6Blocks', data: props.analysis.v6 },
].filter((f) => f.data.input.length));

// Bordered CIDR list + copy-all, used for both the range cover and each
// family's aggregate. Local render function: too small for its own file.
const CidrList = defineComponent({
    props: { title: { type: String, required: true }, cidrs: { type: Array, required: true } },
    setup(p, { slots }) {
        return () => h(CalcSection, { icon: ListTree, title: p.title }, {
            actions: () => h(CopyButton, { value: () => p.cidrs.join('\n'), tooltip: t('ipcalculator.copyAll') }),
            default: () => [
                h('ul', { class: 'm-0 max-h-72 list-none overflow-y-auto rounded-lg border bg-card p-0 divide-y' },
                    p.cidrs.map((c) => h('li', { key: c, class: 'px-3 py-1.5 font-mono text-sm' }, c))),
                slots.default?.(),
            ],
        });
    },
});
</script>

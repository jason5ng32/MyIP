<!-- "Split into subnets" section shared by the IPv4 and IPv6 result cards:
     a Select of target prefix lengths (the analysis' presets), the child
     subnets as a bordered list capped at 256 rows, and copy-all. -->
<template>
    <CalcSection v-if="presets.length" :icon="Split" :title="t('ipcalculator.section.Split')">
        <template #actions>
            <div class="flex items-center gap-1">
                <Select :model-value="String(target)" @update:model-value="(v) => v && (target = Number(v))">
                    <SelectTrigger class="h-8 w-auto shrink-0 gap-1 font-mono text-xs"
                        :aria-label="t('ipcalculator.splitTo')">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="p in presets" :key="p" :value="String(p)" class="font-mono">/{{ p }}</SelectItem>
                    </SelectContent>
                </Select>
                <CopyButton v-if="split" :value="() => split.subnets.join('\n')" :tooltip="t('ipcalculator.copyAll')" />
            </div>
        </template>

        <template v-if="split">
            <ul class="m-0 max-h-72 list-none overflow-y-auto rounded-lg border bg-card p-0 divide-y">
                <li v-for="subnet in split.subnets" :key="subnet" class="px-3 py-1.5 font-mono text-sm">{{ subnet }}</li>
            </ul>
            <p class="mt-2 text-xs text-muted-foreground">
                <template v-if="split.truncated">
                    {{ t('ipcalculator.showingFirst', { shown: split.subnets.length, total: totalLabel }) }}
                </template>
                <template v-else>{{ t('ipcalculator.subnetCount', { count: totalLabel }) }}</template>
            </p>
        </template>
    </CalcSection>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Split } from '@lucide/vue';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CopyButton from '@/components/widgets/CopyButton.vue';
import CalcSection from './CalcSection.vue';
import { splitCidr } from '@/utils/ip-math.js';
import { countLabel, formatCount } from '@/utils/ip-calc.js';

const props = defineProps({
    cidr: { type: String, required: true },
    presets: { type: Array, required: true },
});
const { t } = useI18n();

const target = ref(props.presets[0] ?? null);
// A new prefix (slider) shifts the presets; keep the pick inside them.
watch(() => props.presets, (presets) => {
    if (!presets.includes(target.value)) target.value = presets[0] ?? null;
});

const split = computed(() => (target.value === null ? null : splitCidr(props.cidr, target.value, { limit: 256 })));
const totalLabel = computed(() => (split.value ? countLabel(formatCount(split.value.total)) : ''));
</script>

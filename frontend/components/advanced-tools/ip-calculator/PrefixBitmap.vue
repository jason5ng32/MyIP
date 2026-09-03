<!-- Prefix-length slider plus a bit map of the address: network bits in the
     primary tone, host bits muted. IPv4 draws all 32 bits in four octet
     groups; IPv6 draws 32 nibbles in eight hextet groups (128 bit cells never
     fit a phone), tinting a nibble the boundary cuts through at half
     strength. Groups wrap so the map stays readable at any width.

     `update:prefix` fires on every step; `commit:prefix` on release (and
     after a keyboard step), for consumers that must not resize mid-drag. -->
<template>
    <div class="space-y-3">
        <div class="flex items-center gap-3">
            <Slider :model-value="[prefix]" :min="0" :max="bits" :step="1" class="flex-1"
                :aria-label="t('ipcalculator.prefixLength')"
                @update:model-value="(v) => v && emit('update:prefix', v[0])"
                @value-commit="(v) => v && emit('commit:prefix', v[0])" />
            <span class="w-12 text-right font-mono text-sm font-medium tabular-nums">/{{ prefix }}</span>
        </div>

        <div class="flex flex-wrap gap-x-4 gap-y-2">
            <div v-for="group in groups" :key="group.index" class="flex flex-col items-center gap-0.5">
                <div class="flex gap-px">
                    <span v-for="cell in group.cells" :key="cell.index"
                        class="inline-flex h-6 items-center justify-center rounded-sm font-mono text-[11px] tabular-nums"
                        :class="[cellWidth, CELL_TONES[cell.state]]">{{ cell.text }}</span>
                </div>
                <span class="font-mono text-[10px] text-muted-foreground">{{ group.label }}</span>
            </div>
        </div>

        <div class="flex items-center gap-4 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5">
                <span class="inline-block size-3 rounded-sm bg-primary/15" />{{ t('ipcalculator.networkBits') }}
            </span>
            <span class="flex items-center gap-1.5">
                <span class="inline-block size-3 rounded-sm bg-muted" />{{ t('ipcalculator.hostBits') }}
            </span>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Slider } from '@/components/ui/slider';
import { toOctets, toHextets } from '@/utils/ip-math.js';

const props = defineProps({
    value: { type: BigInt, required: true },
    family: { type: Number, required: true },
    prefix: { type: Number, required: true },
});
const emit = defineEmits(['update:prefix', 'commit:prefix']);
const { t } = useI18n();

const CELL_TONES = {
    network: 'bg-primary/15 text-primary',
    split: 'bg-primary/8 text-primary/80',
    host: 'bg-muted text-muted-foreground',
};

const bits = computed(() => (props.family === 4 ? 32 : 128));
const cellWidth = computed(() => (props.family === 4 ? 'w-4' : 'w-5'));

const groups = computed(() => {
    if (props.family === 4) {
        return toOctets(props.value).map((octet, g) => ({
            index: g,
            label: String(octet),
            cells: Array.from({ length: 8 }, (_, b) => {
                const index = g * 8 + b;
                return { index, text: (octet >> (7 - b)) & 1, state: index < props.prefix ? 'network' : 'host' };
            }),
        }));
    }
    return toHextets(props.value).map((hextet, g) => ({
        index: g,
        label: hextet.toString(16).padStart(4, '0'),
        cells: Array.from({ length: 4 }, (_, n) => {
            const index = g * 4 + n;
            const start = index * 4;
            let state = 'host';
            if (start + 4 <= props.prefix) state = 'network';
            else if (start < props.prefix) state = 'split';
            return { index, text: ((hextet >> ((3 - n) * 4)) & 0xf).toString(16), state };
        }),
    }));
});
</script>

<!-- IPv4 result card: network math behind the prefix bitmap, alternative
     representations, obfuscated notations, embedded-IPv6 forms and the
     subnet splitter. `analysis` is calculate()'s `{ address, cidr, split, number? }`;
     `value` is the address as a BigInt for the bitmap. The slider emits
     upward so the shell recomputes `cidr`. -->
<template>
    <Card>
        <CardContent class="space-y-8 p-4 md:p-6">
            <!-- Network math -->
            <CalcSection :icon="Network" :title="t('ipcalculator.section.Network')">
                <PrefixBitmap :value="value" :family="4" :prefix="cidr.prefix"
                    @update:prefix="(p) => emit('update:prefix', p)"
                    @commit:prefix="(p) => emit('commit:prefix', p)" />
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.network')" :value="cidr.cidr" />
                    <ValueRow :label="t('ipcalculator.broadcast')" :value="cidr.broadcast" />
                    <ValueRow :label="t('ipcalculator.netmask')" :value="cidr.mask" />
                    <ValueRow :label="t('ipcalculator.wildcard')" :value="cidr.wildcard" />
                    <ValueRow :label="t('ipcalculator.firstHost')" :value="cidr.first" />
                    <ValueRow :label="t('ipcalculator.lastHost')" :value="cidr.last" />
                    <ValueRow :label="t('ipcalculator.usable')" :value="countLabel(cidr.usable)" :copy="false" />
                    <ValueRow :label="t('ipcalculator.total')" :value="countLabel(cidr.count)" :copy="false" />
                    <ValueRow :label="t('ipcalculator.ptrZone')" :value="cidr.ptrZone" />
                    <ValueRow :label="t('ipcalculator.class')" :value="address.class" :copy="false" />
                </dl>
                <!-- Always rendered (min-h) so the /31 note can't move the page mid-drag. -->
                <p class="m-0 min-h-4 text-xs text-muted-foreground">
                    <template v-if="cidr.prefix >= 31">{{ t('ipcalculator.rfc3021Note') }}</template>
                </p>
            </CalcSection>

            <!-- Representations -->
            <CalcSection :icon="Binary" :title="t('ipcalculator.section.Representations')">
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.decimal')" :value="address.integer" />
                    <ValueRow :label="t('ipcalculator.hex')" :value="address.hex" />
                    <ValueRow :label="t('ipcalculator.octal')" :value="address.octal" />
                    <ValueRow :label="t('ipcalculator.binary')" :value="address.binary" />
                    <ValueRow :label="t('ipcalculator.ptr')" :value="address.ptr" />
                </dl>
            </CalcSection>

            <!-- Obfuscated notations -->
            <CalcSection :icon="EyeOff" :title="t('ipcalculator.section.Obfuscated')">
                <p class="mb-2 text-xs text-muted-foreground">{{ t('ipcalculator.obfuscatedNote') }}</p>
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.dottedHex')" :value="address.obfuscated.dottedHex" />
                    <ValueRow :label="t('ipcalculator.dottedOctal')" :value="address.obfuscated.dottedOctal" />
                    <ValueRow :label="t('ipcalculator.shortForm', { parts: 3 })" :value="address.obfuscated.short[0]" />
                    <ValueRow :label="t('ipcalculator.shortForm', { parts: 2 })" :value="address.obfuscated.short[1]" />
                </dl>
            </CalcSection>

            <!-- Embedded in IPv6 -->
            <CalcSection :icon="ArrowLeftRight" :title="t('ipcalculator.section.AsIPv6')">
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.mapped')" :value="address.embedded.mapped" />
                    <ValueRow :label="t('ipcalculator.mappedHex')" :value="address.embedded.mappedHex" />
                    <ValueRow :label="t('ipcalculator.compat')" :value="address.embedded.compat" />
                    <ValueRow :label="t('ipcalculator.nat64')" :value="address.embedded.nat64" />
                    <ValueRow :label="t('ipcalculator.sixToFour')" :value="address.embedded.sixToFour" />
                </dl>
            </CalcSection>

            <!-- `analysis.split` only advances on slider release, so the list
                 never resizes mid-drag. -->
            <SubnetSplitter :cidr="split.cidr" :presets="split.splitPresets" />
        </CardContent>
    </Card>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftRight, Binary, EyeOff, Network, Info } from '@lucide/vue';
import { Card, CardContent } from '@/components/ui/card';
import CalcSection from './CalcSection.vue';
import ValueRow from './ValueRow.vue';
import PrefixBitmap from './PrefixBitmap.vue';
import SubnetSplitter from './SubnetSplitter.vue';
import { countLabel } from '@/utils/ip-calc.js';

const props = defineProps({
    analysis: { type: Object, required: true },
    value: { type: BigInt, required: true },
});
const emit = defineEmits(['update:prefix', 'commit:prefix']);
const { t } = useI18n();

const address = computed(() => props.analysis.address);
const cidr = computed(() => props.analysis.cidr);
const split = computed(() => props.analysis.split);
</script>

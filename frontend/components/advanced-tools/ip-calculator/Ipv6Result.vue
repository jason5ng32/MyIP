<!-- IPv6 result card: canonical forms, what the address type encodes
     (embedded IPv4, Teredo, ULA, multicast), the interface identifier
     (EUI-64 → MAC, privacy IIDs, solicited-node), prefix math behind the
     nibble bitmap, and the subnet splitter. `analysis` is calculate()'s
     `{ address, cidr, split, number? }`; `value` is the BigInt for the bitmap. -->
<template>
    <Card>
        <CardContent class="space-y-8 p-4 md:p-6">
            <p v-if="analysis.number" class="m-0 text-sm text-muted-foreground">
                {{ t('ipcalculator.InterpretedAs') }}
                <span class="font-mono font-medium text-foreground">{{ address.compressed }}</span>
            </p>

            <!-- Canonical forms -->
            <CalcSection :icon="Globe" :title="t('ipcalculator.section.Address')">
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.compressed')" :value="address.compressed" />
                    <ValueRow :label="t('ipcalculator.expanded')" :value="address.expanded" />
                    <ValueRow :label="t('ipcalculator.hex')" :value="address.hex" />
                    <ValueRow :label="t('ipcalculator.decimal')" :value="address.integer" />
                    <ValueRow :label="t('ipcalculator.ptr')" :value="address.ptr" />
                    <ValueRow v-if="zone" :label="t('ipcalculator.zone')" :value="zone" />
                </dl>
            </CalcSection>

            <!-- What the type encodes -->
            <CalcSection v-if="hasTypeDetails" :icon="Tag" :title="t('ipcalculator.section.Type')">
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow v-if="address.embeddedV4" :label="t('ipcalculator.embeddedIPv4')" :value="address.embeddedV4" />
                    <template v-if="address.teredo">
                        <ValueRow :label="t('ipcalculator.teredoServer')" :value="address.teredo.server" />
                        <ValueRow :label="t('ipcalculator.teredoClient')" :value="address.teredo.client" />
                        <ValueRow :label="t('ipcalculator.teredoPort')" :value="String(address.teredo.port)" :copy="false" />
                        <ValueRow :label="t('ipcalculator.teredoCone')" :value="yesNo(address.teredo.cone)" :copy="false" />
                    </template>
                    <template v-if="address.ula">
                        <ValueRow :label="t('ipcalculator.locallyAssigned')" :value="yesNo(address.ula.locallyAssigned)" :copy="false" />
                        <ValueRow :label="t('ipcalculator.globalId')" :value="address.ula.globalId" />
                        <ValueRow :label="t('ipcalculator.subnetId')" :value="address.ula.subnetId" />
                    </template>
                    <template v-if="address.multicast">
                        <ValueRow :label="t('ipcalculator.mcastScope')" :value="mcastScope" :copy="false" />
                        <ValueRow :label="t('ipcalculator.flags')" :value="mcastFlags" :copy="false" />
                        <ValueRow v-if="address.multicast.solicitedNodeSuffix" :label="t('ipcalculator.solicitedNodeSuffix')"
                            :value="address.multicast.solicitedNodeSuffix" />
                    </template>
                </dl>
            </CalcSection>

            <!-- Interface identifier -->
            <CalcSection v-if="address.iid" :icon="Fingerprint" :title="t('ipcalculator.section.InterfaceId')">
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.iid')" :value="address.iid.hex" />
                    <ValueRow v-if="address.iid.isEui64" :label="t('ipcalculator.mac')" :value="address.iid.mac" />
                    <ValueRow :label="t('ipcalculator.solicitedNode')" :value="address.iid.solicitedNode" />
                </dl>
                <p class="m-0 text-xs text-muted-foreground">
                    <template v-if="address.iid.isSubnetRouterAnycast">{{ t('ipcalculator.subnetRouterAnycast') }}</template>
                    <template v-else-if="address.iid.isEui64">
                        {{ address.iid.universal ? t('ipcalculator.universalMac') : t('ipcalculator.localMac') }}
                    </template>
                    <template v-else>{{ t('ipcalculator.privacyIid') }}</template>
                </p>
            </CalcSection>

            <!-- Prefix math -->
            <CalcSection :icon="Network" :title="t('ipcalculator.section.Prefix')">
                <PrefixBitmap :value="value" :family="6" :prefix="cidr.prefix"
                    @update:prefix="(p) => emit('update:prefix', p)"
                    @commit:prefix="(p) => emit('commit:prefix', p)" />
                <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <ValueRow :label="t('ipcalculator.network')" :value="cidr.cidr" />
                    <ValueRow :label="t('ipcalculator.netmask')" :value="cidr.mask" />
                    <ValueRow :label="t('ipcalculator.firstAddress')" :value="cidr.first" />
                    <ValueRow :label="t('ipcalculator.lastAddress')" :value="cidr.last" />
                    <ValueRow :label="t('ipcalculator.total')" :value="countLabel(cidr.count)" :copy="false" />
                    <ValueRow :label="t('ipcalculator.slash64s')" :value="cidr.slash64s ? countLabel(cidr.slash64s) : null" :copy="false" />
                    <ValueRow :label="t('ipcalculator.ptrZone')" :value="cidr.ptrZone" />
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
import { Fingerprint, Globe, Network, Tag } from '@lucide/vue';
import { Card, CardContent } from '@/components/ui/card';
import CalcSection from './CalcSection.vue';
import ValueRow from './ValueRow.vue';
import PrefixBitmap from './PrefixBitmap.vue';
import SubnetSplitter from './SubnetSplitter.vue';
import { countLabel } from '@/utils/ip-calc.js';

const props = defineProps({
    analysis: { type: Object, required: true },
    value: { type: BigInt, required: true },
    zone: { type: [String, null], default: null },
});
const emit = defineEmits(['update:prefix', 'commit:prefix']);
const { t } = useI18n();

const address = computed(() => props.analysis.address);
const cidr = computed(() => props.analysis.cidr);
const split = computed(() => props.analysis.split);

const yesNo = (flag) => (flag ? t('ipcalculator.yes') : t('ipcalculator.no'));

const hasTypeDetails = computed(() => {
    const a = address.value;
    return Boolean(a.embeddedV4 || a.teredo || a.ula || a.multicast);
});

const mcastScope = computed(() => {
    const scope = address.value.multicast?.scope;
    return scope ? `${scope.id} · ${scope.name}` : null;
});

const mcastFlags = computed(() => {
    const flags = address.value.multicast?.flags;
    if (!flags) return null;
    const set = Object.entries(flags).filter(([, on]) => on).map(([name]) => t(`ipcalculator.flag${name}`));
    return set.length ? set.join(', ') : t('ipcalculator.noFlags');
});
</script>

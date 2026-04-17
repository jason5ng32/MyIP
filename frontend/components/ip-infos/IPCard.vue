<template>
    <div class="jn-card keyboard-shortcut-card rounded-lg border bg-card text-card-foreground overflow-hidden" :class="{
            'jn-ip-card1 jn-hover-card': !isMobile && ipGeoSource === 0,
            'jn-ip-card2 jn-hover-card': !isMobile && ipGeoSource !== 0,
        }">
        <div class="flex items-center justify-between px-3 py-2 font-bold jn-link1 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
            <span>
                <i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                {{ t('ipInfos.Source') }}: {{ card.source }}
            </span>
            <JnTooltip :text="t('Tooltips.RefreshIPCard')" side="left">
                <Button size="icon" variant="outline"
                    @click="$emit('refresh-card', card, index)"
                    :aria-label="'Refresh' + card.source">
                    <i class="bi bi-arrow-clockwise"></i>
                </Button>
            </JnTooltip>
        </div>
        <div class="p-3 bg-neutral-50 dark:bg-neutral-800" :class="{
            'jn-link2-dark': isDarkMode,
            'jn-link2': !isDarkMode
            }">
            <span class="shrink-0">
                <i class="bi bi-pc-display-horizontal"></i>&nbsp;
            </span>
            <span v-if="card.ip" :class="{ 'jn-ip-font': (isMobile && card.ip.length > 32) }">
                {{ card.ip }}&nbsp;
                <JnTooltip v-if="isValidIP(card.ip)" :text="t('Tooltips.CopyIP')" side="right">
                    <i :class="copiedStatus[card.id] ? 'bi bi-clipboard-check-fill' : 'bi bi-clipboard-plus'"
                        @click="copyToClipboard(card.ip, card.id)" role="button"
                        :aria-label="'Copy' + card.ip"></i>
                </JnTooltip>
            </span>
            <span v-else class="inline-block h-4 w-4/5 bg-neutral-300 dark:bg-neutral-700 rounded animate-pulse"></span>
        </div>

        <div v-if="(card.asn) || card.ip === '2001:4860:4860::8888'"
            class="p-3" :id="'IPInfo-' + (index + 1)">
            <ul class="flex flex-col" v-if="card.country_name">

                <img v-if="isMapShown" :src="isDarkMode ? card.mapUrl_dark : card.mapUrl"
                    class="rounded-t-lg w-full jn-map-image" alt="Map">

                <li class="jn-list-group-item flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700"
                    :class="{ 'mobile-list': isMobile && isCardsCollapsed }">
                    <span class="shrink-0 mr-2">
                        <i class="bi bi-geo-alt-fill"></i> {{ t('ipInfos.Country') }} :&nbsp;
                    </span>
                    <span class="flex-1">
                        {{ card.country_name }}
                        <span v-if="card.country_code" :class="'jn-fl fi fi-' + card.country_code.toLowerCase()"></span>
                    </span>
                </li>

                <template v-if="!isMobile || !isCardsCollapsed">
                    <li class="flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-houses"></i> {{ t('ipInfos.Region') }} :&nbsp;</span>
                        <span class="flex-1">{{ card.region }}</span>
                    </li>
                    <li class="flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-sign-turn-right"></i> {{ t('ipInfos.City') }} :&nbsp;</span>
                        <span class="flex-1">{{ card.city }}</span>
                    </li>
                    <li class="flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-ethernet"></i> {{ t('ipInfos.ISP') }} :&nbsp;</span>
                        <span class="flex-1">{{ card.isp }}</span>
                    </li>

                    <li v-show="ipGeoSource === 0 && card.type !== t('ipInfos.advancedData.type.unknownType')"
                        class="flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-reception-4"></i> {{ t('ipInfos.type') }} :&nbsp;</span>
                        <span v-if="card.type !== 'sign_in_required'" class="flex-1">
                            {{ card.type }}
                            <span v-if="card.proxyOperator !== 'unknown'">( {{ card.proxyOperator }} )</span>
                        </span>
                        <span v-else class="text-neutral-500">{{ t('user.SignInToView') }}</span>
                    </li>

                    <li v-show="ipGeoSource === 0 && card.isProxy !== t('ipInfos.advancedData.proxyUnknown')"
                        class="flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-shield-fill-check"></i> {{ t('ipInfos.isProxy') }} :&nbsp;</span>
                        <span v-if="card.isProxy !== 'sign_in_required'" class="flex-1">
                            {{ card.isProxy }}
                            <span v-if="card.proxyProtocol !== t('ipInfos.advancedData.proxyUnknownProtocol')">
                                ( {{ card.proxyProtocol }} )
                            </span>
                        </span>
                        <span v-else class="text-neutral-500">{{ t('user.SignInToView') }}</span>
                    </li>

                    <li v-show="ipGeoSource === 0" class="flex items-start py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-house-check"></i> {{ t('ipInfos.advancedData.Nativeness') }} :&nbsp;</span>
                        <span v-if="card.isNativeIP !== 'sign_in_required'" class="flex-1">
                            <span v-if="card.isNativeIP === true">
                                <i class="bi bi-check-circle-fill"></i>
                                {{ t('ipInfos.advancedData.NativeIPYes') }}
                            </span>
                            <span v-else>
                                <i class="bi bi-x-circle"></i>
                                {{ t('ipInfos.advancedData.NativeIPNo') }}
                            </span>
                        </span>
                        <span v-else class="text-neutral-500">{{ t('user.SignInToView') }}</span>
                    </li>

                    <li v-show="ipGeoSource === 0" class="flex items-center py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                        <span class="shrink-0 mr-2"><i class="bi bi-speedometer"></i> {{ t('ipInfos.qualityScore') }} :&nbsp;</span>
                        <span v-if="card.qualityScore !== 'unknown' && card.qualityScore !== 'sign_in_required'"
                            class="w-20">
                            <Progress :model-value="Number(card.qualityScore) || 0" class="jn-ip-score-progress" />
                        </span>
                        <span v-if="card.qualityScore !== 'sign_in_required'" class="ps-2">
                            <span v-if="card.qualityScore === 'unknown'">{{ t('ipInfos.qualityScoreUnknown') }}</span>
                            <span v-else>
                                {{ card.qualityScore }}/100
                                <JnTooltip v-if="!isMobile" :text="t('Tooltips.qualityScoreExplain')" side="top">
                                    <i class="bi bi-question-circle"></i>
                                </JnTooltip>
                            </span>
                        </span>
                        <span v-if="card.qualityScore === 'sign_in_required'" class="text-neutral-500">
                            {{ t('user.SignInToView') }}
                        </span>
                    </li>

                    <li class="flex items-start py-2">
                        <span class="shrink-0 mr-2"><i class="bi bi-buildings"></i> {{ t('ipInfos.ASN') }} :&nbsp;</span>
                        <span v-if="card.asnlink" class="flex-1">
                            {{ card.asn }}
                            <JnTooltip v-if="configs.cloudFlare" :text="t('Tooltips.ShowASNInfo')" side="right">
                                <i class="bi cursor-pointer"
                                    :class="isAsnOpen ? 'bi-caret-up-square' : 'bi-caret-down-square'"
                                    @click="toggleASNCollapse(card.asn)"
                                    :aria-expanded="isAsnOpen" role="button"
                                    :aria-label="'Display AS Info of' + card.asn">
                                </i>
                            </JnTooltip>
                        </span>
                        <span v-else-if="card.asn">{{ card.asn }}</span>
                    </li>
                </template>

                <Collapsible :open="isAsnOpen" @update:open="isAsnOpen = $event">
                    <CollapsibleContent>
                        <ASNInfo :index="index" :isDarkMode="isDarkMode" :asn="card.asn" :asnInfos="asnInfos" />
                    </CollapsibleContent>
                </Collapsible>
            </ul>
        </div>

        <div v-else-if="(card.ip === t('ipInfos.IPv4Error')) || (card.ip === t('ipInfos.IPv6Error'))"
            class="p-3 jn-ip-error">
            <div>
                <IPErrorIcon />
            </div>
        </div>

        <div v-else class="p-3">
            <ul class="flex flex-col animate-pulse">
                <li v-for="(colSize, index) in placeholderSizes" :key="index"
                    class="py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700">
                    <span class="inline-block h-4 bg-neutral-300 dark:bg-neutral-700 rounded"
                        :style="`width: ${(colSize / 12) * 100}%`"></span>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/valid-ip.js';
import ASNInfo from './ASNInfo.vue';
import IPErrorIcon from '../svgicons/IPError.vue';
import { trackEvent } from '@/utils/use-analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const { t } = useI18n();

const placeholderSizes = [12, 8, 6, 8, 4];

const isAsnOpen = ref(false);

const props = defineProps({
    card: { type: Object, required: true },
    index: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true },
    isMobile: { type: Boolean, required: true },
    ipGeoSource: { type: Number, required: true },
    isMapShown: { type: Boolean, required: true },
    isCardsCollapsed: { type: Boolean, required: true },
    copiedStatus: { type: Object, required: true },
    configs: { type: Object, required: true },
    asnInfos: { type: Object, required: true }
});

const emit = defineEmits(['refresh-card', 'get-asn-info']);

const copyToClipboard = (ip, id) => {
    navigator.clipboard.writeText(ip).then(() => {
        props.copiedStatus[id] = true;
        setTimeout(() => {
            props.copiedStatus[id] = false;
        }, 5000);
    }).catch(err => {
        console.error('Copy error', err);
    });
};

const toggleASNCollapse = async (asn) => {
    isAsnOpen.value = !isAsnOpen.value;
    if (isAsnOpen.value) {
        await getASNInfo(asn);
    }
};

const getASNInfo = async (asn) => {
    trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
    try {
        if (props.asnInfos[asn]) {
            return;
        }
        asn = asn.replace('AS', '');
        const response = await fetch(`/api/cfradar?asn=${asn}`);
        const data = await response.json();
        props.asnInfos['AS' + asn] = data;
    } catch (error) {
        console.error("Error fetching ASN info:", error);
    }
};
</script>

<style scoped>
.jn-link1 {
    position: relative;
}

.jn-link2::before {
    content: '';
    position: absolute;
    top: 34px;
    left: 24px;
    transform: translateX(-50%);
    height: 40px;
    width: 2px;
    border-left: 2px dashed #212529;
    z-index: 1;
}

.jn-link2-dark::before {
    content: '';
    position: absolute;
    top: 34px;
    left: 24px;
    transform: translateX(-50%);
    height: 40px;
    width: 2px;
    border-left: 2px dashed #e3e3e3;
    z-index: 1;
}

.jn-ip-error {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    flex-direction: column;
}

.jn-ip-score-progress {
    height: 16px;
    border-radius: 8px;
}
</style>

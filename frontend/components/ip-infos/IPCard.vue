<template>
    <div class="card jn-card keyboard-shortcut-card" :class="{
            'dark-mode dark-mode-border': isDarkMode,
            'jn-ip-card1 jn-hover-card': !isMobile && ipGeoSource === 0,
            'jn-ip-card2 jn-hover-card': !isMobile && ipGeoSource !== 0,
        }">
        <div class="card-header jn-ip-title jn-link1"
            :class="{ 'dark-mode-title': isDarkMode, 'bg-light': !isDarkMode }" style="font-weight: bold;">
            <span>
                <i class="bi" :class="'bi-' + (index + 1) + '-circle-fill'"></i>&nbsp;
                {{ t('ipInfos.Source') }}: {{ card.source }}</span>
            <button @click="$emit('refresh-card', card, index)"
                :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                :aria-label="'Refresh' + card.source" v-tooltip="t('Tooltips.RefreshIPCard')">
                <i class="bi bi-arrow-clockwise"></i></button>
        </div>
        <div class="p-3 placeholder-glow " :class="{
            'dark-mode-title': isDarkMode,
            'jn-link2-dark': isDarkMode,
            'bg-light': !isDarkMode,
            'jn-link2': !isDarkMode
            }">
            <span class="jn-text col-auto">
                <i class="bi bi-pc-display-horizontal"></i>&nbsp;
            </span>
            <span v-if="card.ip" class="col-10" :class="{ 'jn-ip-font': (isMobile && card.ip.length > 32) }">
                {{ card.ip }}&nbsp;
                <i v-if="isValidIP(card.ip)"
                    :class="copiedStatus[card.id] ? 'bi bi-clipboard-check-fill' : 'bi bi-clipboard-plus'"
                    @click="copyToClipboard(card.ip, card.id)" role="button"
                    v-tooltip="{ title: t('Tooltips.CopyIP'), placement: 'right' }" :aria-label="'Copy' + card.ip"></i>
            </span>
            <span v-else class="placeholder col-10"></span>
        </div>


        <div v-if="(card.asn) || card.ip === '2001:4860:4860::8888'
            " class="card-body" :id="'IPInfo-' + (index + 1)">
            <ul class="list-group list-group-flush" v-if="card.country_name">

                <img v-if="isMapShown" :src="isDarkMode ? card.mapUrl_dark : card.mapUrl"
                    class="card-img-top jn-map-image" alt="Map">

                <li class="jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode, 'mobile-list': isMobile && isCardsCollapsed }">
                    <span class="jn-text col-auto">
                        <i class="bi bi-geo-alt-fill"></i> {{ t('ipInfos.Country') }} :&nbsp;
                    </span>
                    <span class="col-10 ">
                        {{ card.country_name }}
                        <span v-if="card.country_code" :class="'jn-fl fi fi-' + card.country_code.toLowerCase()"></span>
                    </span>
                </li>

                <template v-if="!isMobile || !isCardsCollapsed">
                    <li class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-houses"></i>
                            {{ t('ipInfos.Region') }} :&nbsp;
                        </span>
                        <span class="col-10 ">
                            {{ card.region }}
                        </span>
                    </li>

                    <li class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-sign-turn-right"></i>
                            {{ t('ipInfos.City') }} :&nbsp;
                        </span>
                        <span class="col-10 ">
                            {{ card.city }}
                        </span>
                    </li>

                    <li class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-ethernet"></i>
                            {{ t('ipInfos.ISP') }} :&nbsp;
                        </span>
                        <span class="col-10 ">
                            {{ card.isp }}
                        </span>
                    </li>

                    <li v-show=" ipGeoSource === 0 && card.type !== t('ipInfos.proxyDetect.type.unknownType')"
                        class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-reception-4"></i>
                            {{ t('ipInfos.type') }} :&nbsp;
                        </span>
                        <span v-if="card.type !=='sign_in_required'" class="col-10 ">
                            {{ card.type }}
                            <span v-if="card.proxyOperator !== 'unknown'">
                                ( {{ card.proxyOperator }} )
                            </span>
                        </span>

                        <span v-else class="col-8 text-secondary">
                            {{ t('user.SignInToView') }}
                        </span>
                    </li>

                    <li v-show="ipGeoSource === 0 && card.isProxy !== t('ipInfos.proxyDetect.unknownProxyType')"
                        class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-shield-fill-check"></i>
                            {{ t('ipInfos.isProxy') }} :&nbsp;
                        </span>
                        <span v-if="card.isProxy !=='sign_in_required'" class="col-10 ">
                            {{ card.isProxy }}
                            <span v-if="card.proxyProtocol !== t('ipInfos.proxyDetect.unknownProtocol')">
                                ( {{ card.proxyProtocol }} )
                            </span>
                        </span>
                        <span v-else class="col-8 text-secondary">
                            {{ t('user.SignInToView') }}
                        </span>
                    </li>

                    <li v-show="ipGeoSource === 0" class="jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-speedometer"></i>
                            {{ t('ipInfos.qualityScore') }} :&nbsp;
                        </span>

                        <span v-if="card.qualityScore !== 'unknown' && card.qualityScore !== 'sign_in_required'"
                            class="col-3 jn-risk-score ">
                            <span class="progress border" :class="[isDarkMode ? 'border-light bg-dark' : 'border-dark']"
                                role="progressbar" aria-label="Quality Score" aria-valuenow="0" aria-valuemin="0"
                                aria-valuemax="100">
                                <span class="progress-bar" :class="[isDarkMode ? 'bg-light' : 'bg-dark']"
                                    :style='"width:" + card.qualityScore +"%"'></span>
                            </span>
                        </span>

                        <span v-if="card.qualityScore !== 'sign_in_required'" class="ps-2">
                            <span v-if="card.qualityScore === 'unknown'">
                                {{ t('ipInfos.qualityScoreUnknown') }}
                            </span>
                            <span v-else>{{ card.qualityScore }}% <i v-if="!isMobile"
                                    v-tooltip="t('Tooltips.qualityScoreExplain')"
                                    class="bi bi-question-circle"></i></span>
                        </span>

                        <span v-if="card.qualityScore === 'sign_in_required'" class="col-8 text-secondary">
                            {{ t('user.SignInToView') }}
                        </span>

                    </li>

                    <li class="jn-list-group-item border-0" :class="{ 'dark-mode': isDarkMode }">
                        <span class="jn-text col-auto">
                            <i class="bi bi-buildings"></i>
                            {{ t('ipInfos.ASN') }} :&nbsp;
                        </span>
                        <span v-if="card.asnlink" class="col-9">
                            {{ card.asn }}
                            <i v-if="configs.cloudFlare" class="bi bi-info-circle" @click="getASNInfo(card.asn)"
                                data-bs-toggle="collapse" :data-bs-target="'#' + 'collapseASNInfo-' + index"
                                aria-expanded="false" :aria-controls="'collapseASNInfo-' + index" role="button"
                                :aria-label="'Display AS Info of' + card.asn"
                                v-tooltip="{ title: t('Tooltips.ShowASNInfo'), placement: 'right' }">
                            </i>
                        </span>
                    </li>
                </template>

                <ASNInfo :index="index" :isDarkMode="isDarkMode" :asn="card.asn" :asnInfos="asnInfos" />
            </ul>
        </div>

        <div v-else-if="(card.ip === t('ipInfos.IPv4Error')) || (card.ip === t('ipInfos.IPv6Error'))"
            class="card-body  jn-ip-error">
            <div>
                <IPErrorIcon />
            </div>
        </div>

        <div v-else class="card-body">
            <ul class="list-group list-group-flush placeholder-glow">
                <li v-for="(colSize, index) in placeholderSizes" :key="index" class="list-group-item jn-list-group-item"
                    :class="{ 'dark-mode': isDarkMode }">
                    <span :class="`placeholder col-${colSize}`"></span>
                </li>
            </ul>
        </div>

    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/valid-ip.js';
import ASNInfo from './ASNInfo.vue';
import IPErrorIcon from '../svgicons/IPError.vue';
import { trackEvent } from '@/utils/use-analytics';

const { t } = useI18n();

const placeholderSizes = [12, 8, 6, 8, 4];

const props = defineProps({
    card: {
        type: Object,
        required: true
    },
    index: {
        type: Number,
        required: true
    },
    isDarkMode: {
        type: Boolean,
        required: true
    },
    isMobile: {
        type: Boolean,
        required: true
    },
    ipGeoSource: {
        type: Number,
        required: true
    },
    isMapShown: {
        type: Boolean,
        required: true
    },
    isCardsCollapsed: {
        type: Boolean,
        required: true
    },
    copiedStatus: {
        type: Object,
        required: true
    },
    configs: {
        type: Object,
        required: true
    },
    asnInfos: {
        type: Object,
        required: true
    }
});

// 定义事件
const emit = defineEmits(['refresh-card', 'get-asn-info']);

// 复制 IP 地址
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

// 从后端 API 获取 ASN 信息
const getASNInfo = async (asn) => {
    trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
    try {
        // 如果 asnInfos 中已有该 ASN 的信息，则直接返回
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
</style>
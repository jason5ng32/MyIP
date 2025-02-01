<template>
    <div class="collapse alert alert-light placeholder-glow lh-lg fw-bold p-0" :id="'collapseASNInfo-' + index"
        :data-bs-theme="isDarkMode ? 'dark' : ''">
        <div class="p-3">
            <span v-if="asnInfos[asn]">
                <i class="bi bi-info-circle-fill"></i>
                <span class="fw-light">&nbsp;{{ t('ipInfos.ASNInfo.note') }}</span>
                <br />
                <template v-for="(item,key) in asnInfos[asn]">
                    <span class="fw-light">
                        {{ t(`ipInfos.ASNInfo.${key}`) }}
                    </span>
                    {{ item }}
                    <br />
                </template>
            </span>
            <span v-else>
                <span v-for="(colSize, index) in placeholderSizes" :key="index" :class="{ 'dark-mode': isDarkMode }">
                    <span :class="`placeholder col-${colSize}`"></span>
                </span>
            </span>
        </div>
    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const placeholderSizes = [12, 8, 6, 8, 4];

defineProps({
    index: {
        type: Number,
        required: true
    },
    isDarkMode: {
        type: Boolean,
        required: true
    },
    asn: {
        type: String,
        required: true
    },
    asnInfos: {
        type: Object,
        required: true
    }
});
</script>
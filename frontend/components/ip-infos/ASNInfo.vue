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
                    <span v-if="key === 'asnCountryCode'">
                        {{ getCountryName(item, lang) }}
                        <span :class="'jn-fl fi fi-' + item.toLowerCase()"></span>
                    </span>
                    <span v-else>
                        {{ item }}
                    </span>
                    <br />
                </template>
                <div class="fw-light d-flex">
                    <span class="fw-light">
                        {{ t('ipInfos.ASNInfo.moreData') }}
                    </span>
                    <span>
                        <a class="text-decoration-none px-2" :href="`https://bgp.tools/as/${removeASPrefix(asn)}`"
                            target="_blank" title="BGP.Tools">
                            <span class="badge" :class="!isDarkMode ? 'text-bg-dark' : 'text-bg-light'"><i
                                    class="bi bi-database-fill"></i> BGPTools </span>
                        </a>
                    </span>
                    <span>
                        <a class="text-decoration-none" :href="`https://radar.cloudflare.com/${asn}`" target="_blank"
                            title="Cloudflare Radar">
                            <span class="badge" :class="!isDarkMode ? 'text-bg-dark' : 'text-bg-light'"><i
                                    class="bi bi-database-fill"></i> CF Radar </span>
                        </a>
                    </span>
                </div>
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
import { useMainStore } from '@/store';
import { computed } from 'vue';
import getCountryName from '@/utils/country-name.js';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);


const placeholderSizes = [12, 8, 6, 8, 4];

const removeASPrefix = (asn) => {
    return asn.replace('AS', '');
}

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
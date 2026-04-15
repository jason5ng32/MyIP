<template>
    <!-- Search BTN -->
    <JnTooltip :text="t('Tooltips.QueryIP')" side="left">
        <button class="btn btn-primary queryip" aria-label="IP Check"
            @click="openQueryIP"><i class="bi bi-search"></i></button>
    </JnTooltip>

    <!-- Search Dialog (refactor/01: 旧 Bootstrap Modal → shadcn-vue Dialog) -->
    <Dialog :open="isOpen" @update:open="onOpenChange">
        <DialogContent
            :title="t('ipcheck.Title')"
            :data-bs-theme="isDarkMode ? 'dark' : ''"
        >
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header d-flex align-items-center justify-content-between" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title m-0" id="IPCheckTitle">{{ t('ipcheck.Title') }}</h5>
                    <DialogClose class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }" />
                </div>
                <div class="modal-body" :class="{ 'dark-mode': isDarkMode }">

                    <div class="input-group mb-3">
                        <input type="text" class="form-control" :class="{ 'dark-mode': isDarkMode }"
                            :placeholder="t('ipcheck.Placeholder')" v-model="inputIP" @keyup.enter="submitQuery"
                            name="inputIP" id="inputIP">
                        <button id="sumitQueryButton" type="button" class="btn btn-primary"
                            :class="{ 'btn-secondary': !isValidIP(inputIP), 'btn-primary': isValidIP(inputIP) }"
                            @click="submitQuery" :disabled="!isValidIP(inputIP) || isChecking === 'running'
                            ">{{
                            t('ipcheck.Button') }}</button>
                    </div>

                    <div v-if="modalQueryError" class="text-danger">{{ modalQueryError }}</div>
                    <div v-if="modalQueryResult" class="mt-2">
                        <div class="card-body">
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-pc-display-horizontal"></i> {{ t('ipInfos.Country')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">{{ modalQueryResult.country_name }}&nbsp;
                                        <span v-if="modalQueryResult.country_code"
                                            :class="'jn-fl fi fi-' + modalQueryResult.country_code.toLowerCase()"></span>
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto"><i class="bi bi-houses"></i> {{ t('ipInfos.Region')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.region }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto"><i class="bi bi-sign-turn-right"></i> {{
                                        t('ipInfos.City')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.city }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto"><i class="bi bi-ethernet"></i> {{ t('ipInfos.ISP')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.isp }}
                                    </span>
                                </li>


                                <li v-if="ipGeoSource === 0 && modalQueryResult.type !== t('ipInfos.advancedData.type.unknownType')"
                                    class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-reception-4"></i> {{ t('ipInfos.type')
                                        }}</span>&nbsp;:&nbsp;
                                    <span v-if="modalQueryResult.type !=='sign_in_required'" class="col-10 ">
                                        {{ modalQueryResult.type }}
                                        <span v-if="modalQueryResult.proxyOperator !== 'unknown'">
                                            ( {{ modalQueryResult.proxyOperator }} )
                                        </span>
                                    </span>

                                    <span v-else class="col-8 text-secondary">
                                        {{ t('user.SignInToView') }}
                                    </span>
                                </li>

                                <li v-if="ipGeoSource === 0 && modalQueryResult.isProxy !== t('ipInfos.advancedData.proxyUnknown')"
                                    class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-shield-fill-check"></i>
                                        {{ t('ipInfos.isProxy') }}</span>&nbsp;:&nbsp;
                                    <span v-if="modalQueryResult.isProxy !=='sign_in_required'" class="col-10 ">
                                        {{ modalQueryResult.isProxy }}
                                        <span
                                            v-if="modalQueryResult.proxyProtocol !== t('ipInfos.advancedData.proxyUnknownProtocol')">
                                            ( {{ modalQueryResult.proxyProtocol }} )
                                        </span>
                                    </span>
                                    <span v-else class="col-8 text-secondary">
                                        {{ t('user.SignInToView') }}
                                    </span>
                                </li>

                                <li v-if="ipGeoSource === 0" class="jn-list-group-item"
                                    :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-house-check"></i>
                                        {{ t('ipInfos.advancedData.Nativeness') }} :&nbsp;
                                    </span>
                                    <span v-if="modalQueryResult.isNativeIP !=='sign_in_required'" class="col-10 ">
                                        <span v-if="modalQueryResult.isNativeIP === true">
                                            <i class="bi bi-check-circle-fill"></i>
                                            {{t('ipInfos.advancedData.NativeIPYes')}}
                                        </span>
                                        <span v-else>
                                            <i class="bi bi-x-circle"></i>
                                            {{t('ipInfos.advancedData.NativeIPNo')}}
                                        </span>
                                    </span>

                                    <span v-else class="col-8 text-secondary">
                                        {{ t('user.SignInToView') }}
                                    </span>
                                </li>


                                <li v-if="ipGeoSource === 0" class="jn-list-group-item"
                                    :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-speedometer"></i>
                                        {{ t('ipInfos.qualityScore') }} :&nbsp;
                                    </span>

                                    <span
                                        v-if="modalQueryResult.qualityScore !== 'unknown' && modalQueryResult.qualityScore !== 'sign_in_required'"
                                        class="col-3 jn-ip-score ">
                                        <span class="progress border"
                                            :class="[isDarkMode ? 'border-light bg-dark' : 'border-dark']"
                                            role="progressbar" aria-label="Quality Score" aria-valuenow="0"
                                            aria-valuemin="0" aria-valuemax="100">
                                            <span class="progress-bar" :class="[isDarkMode ? 'bg-light' : 'bg-dark']"
                                                :style='"width:" + modalQueryResult.qualityScore +"%"'></span>
                                        </span>
                                    </span>

                                    <span v-if="modalQueryResult.qualityScore !== 'sign_in_required'" class="ps-2">
                                        <span v-if="modalQueryResult.qualityScore === 'unknown'">
                                            {{ t('ipInfos.qualityScoreUnknown') }}
                                        </span>
                                        <span v-else>{{ modalQueryResult.qualityScore }}%</span>
                                    </span>
                                    <span v-if="modalQueryResult.qualityScore === 'sign_in_required'"
                                        class="col-8 text-secondary">
                                        {{ t('user.SignInToView') }}
                                    </span>
                                </li>

                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-buildings"></i> {{ t('ipInfos.ASN') }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        <a v-if="modalQueryResult.asnlink" :href="modalQueryResult.asnlink"
                                            target="_blank"
                                            class="link-underline-opacity-50 link-underline-opacity-100-hover"
                                            :class="[isDarkMode ? 'link-light' : 'link-dark']">{{ modalQueryResult.asn
                                            }}</a>
                                            <span v-else-if="modalQueryResult.asn">{{ modalQueryResult.asn }}</span>
                                    </span>
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>


            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { isValidIP } from '@/utils/valid-ip.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { JnTooltip } from '@/components/ui/tooltip';

const { t } = useI18n();

// 引入 Store
const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const userPreferences = computed(() => store.userPreferences);
const lang = computed(() => store.lang);
const inputIP = ref('');
const modalQueryResult = ref(null);
const modalQueryError = ref("");
const isChecking = ref("idle");
const ipGeoSource = ref(userPreferences.value.ipGeoSource);


// 实时变化查询源
watch(() => userPreferences.value.ipGeoSource, (newVal, oldVal) => {
    ipGeoSource.value = newVal;
}, { deep: true });

// 查询 IP 信息
const submitQuery = async () => {
    if (isValidIP(inputIP.value)) {
        modalQueryError.value = "";
        modalQueryResult.value = null;
        isChecking.value = "running";
        await fetchIPForModal(inputIP.value);
    } else {
        modalQueryError.value = t('ipcheck.Error');
        modalQueryResult.value = null;
        isChecking.value = "idle";
    }
};

// Dialog 开关 + 打开时自动聚焦输入框（refactor/01）
const isOpen = ref(false);
const onOpenChange = (val) => {
    isOpen.value = val;
    if (val) {
        nextTick(() => {
            const inputElement = document.getElementById('inputIP');
            if (inputElement) inputElement.focus();
        });
    }
};

// 打开查询 IP 的模态框
const openQueryIP = () => {
    trackEvent('SideButtons', 'ToggleClick', 'QueryIP');
    openModal();
};

// 打开 Dialog（对外 API 保持 openModal()）
const openModal = () => {
    onOpenChange(true);
};

// 获取 IP 信息
const fetchIPForModal = async (ip, sourceID = null) => {
    let selectedLang = lang.value === 'zh' ? 'zh-CN' : lang.value;
    sourceID = ipGeoSource.value;
    const sources = store.ipDBs;

    for (const source of sources) {
        if (sourceID && source.id !== sourceID) continue;
        try {
            const url = store.getDbUrl(source.id, ip, selectedLang);
            const response = await authenticatedFetch(url);
            modalQueryResult.value = transformDataFromIPapi(response, source.id, t, lang.value);
            isChecking.value = "idle";
            break;
        } catch (error) {
            console.error("Error fetching IP details:", error);
        }
    }
};

const adjustButtonPosition = () => {
    const screenWidth = window.innerWidth;
    const contentWidth = 1600; // 主内容区域的宽度
    const spaceOnRight = (screenWidth - contentWidth) / 2;

    const button = document.querySelector('.queryip');
    if (screenWidth > 1600) { // 只在屏幕宽度大于1600px时调整
        button.style.right = `${spaceOnRight + 20}px`; // 保持20px的距离
    } else {
        button.style.right = '20px'; // 在小屏幕上使用默认位置
    }
}

onMounted(() => {
    window.addEventListener('resize', adjustButtonPosition);
    adjustButtonPosition();
});

defineExpose({
    openModal,
});
</script>


<style scoped>
.queryip {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1050;
}
</style>

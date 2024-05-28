<template>
    <!-- Search BTN -->
    <button class="btn btn-primary queryip"
        data-bs-toggle="modal" aria-label="IP Check" data-bs-target="#IPCheck" @click="openQueryIP"
        v-tooltip="t('Tooltips.QueryIP')"><i class="bi bi-search"></i></button>

    <!-- Search Modal -->
    <div class="modal fade" id="IPCheck" tabindex="-1" aria-labelledby="IPCheck" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title" id="IPCheckTitle">{{ t('ipcheck.Title') }}</h5>
                    <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                        data-bs-dismiss="modal" aria-label="Close"></button>

                </div>
                <div class="modal-body" :class="{ 'dark-mode': isDarkMode }">
                    <input type="text" class="form-control mb-2" :class="{ 'dark-mode': isDarkMode }"
                        :placeholder="t('ipcheck.Placeholder')" v-model="inputIP" @keyup.enter="submitQuery"
                        name="inputIP" id="inputIP">
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


                                <li v-if="ipGeoSource === 0 && modalQueryResult.type !== t('ipInfos.proxyDetect.type.unknownType')"
                                    class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-reception-4"></i> {{ t('ipInfos.type')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.type }}
                                        <span v-if="modalQueryResult.proxyOperator !== 'unknown'">
                                            ( {{ modalQueryResult.proxyOperator }} )
                                        </span>
                                    </span>
                                </li>

                                <li v-if="ipGeoSource === 0 && modalQueryResult.isProxy !== t('ipInfos.proxyDetect.unknownProxyType')"
                                    class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-shield-fill-check"></i>
                                        {{ t('ipInfos.isProxy') }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.isProxy }}
                                        <span
                                            v-if="modalQueryResult.proxyProtocol !== t('ipInfos.proxyDetect.unknownProtocol')">
                                            ( {{ modalQueryResult.proxyProtocol }} )
                                        </span>
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
                                    </span>
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>
                <div class="modal-footer" :class="{ 'dark-mode-border': isDarkMode }">
                    <button id="sumitQueryButton" type="button" class="btn btn-primary"
                        :class="{ 'btn-secondary': !isValidIP(inputIP), 'btn-primary': isValidIP(inputIP) }"
                        @click="submitQuery" :disabled="!isValidIP(inputIP) || isChecking === 'running'
                            ">{{
                        t('ipcheck.Button') }}</button>
                </div>


            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { Modal } from 'bootstrap';
import { isValidIP } from '@/utils/valid-ip.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';

const {t} = useI18n();

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

// 打开查询 IP 的模态框
const openQueryIP = () => {
    trackEvent('SideButtons', 'ToggleClick', 'QueryIP');
    openModal();
};

// 打开 Modal
const openModal = () => {
    const modalElement = document.getElementById('IPCheck');
    const modalInstance = Modal.getOrCreateInstance(modalElement);
    if (modalInstance) {
        modalInstance.show();
        setupModalFocus();
    }
};

// 设置 Modal 的聚焦
const setupModalFocus = () => {
    const modals = document.querySelectorAll(".modal");
    modals.forEach((modal) => {
        modal.addEventListener("shown.bs.modal", () => {
            nextTick(() => {
                const inputElement = modal.querySelector(".form-control");
                if (inputElement) {
                    inputElement.focus();
                }
            });
        });
    });
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
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.reason || "IP lookup failed");
            }
            modalQueryResult.value = transformDataFromIPapi(data, source.id, t,lang.value);
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

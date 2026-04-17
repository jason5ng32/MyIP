<template>
    <!-- Search BTN -->
    <JnTooltip :text="t('Tooltips.QueryIP')" side="left">
        <Button
            size="icon"
            type="button"
            class="fixed bottom-5 z-[1050] bg-blue-600 text-white hover:bg-blue-700"
            :style="positionStyle"
            aria-label="IP Check"
            @click="openQueryIP">
            <Search class="inline size-[1em] align-[-0.125em]" />
        </Button>
    </JnTooltip>

    <!-- Search Dialog -->
    <Dialog :open="isOpen" @update:open="onOpenChange">
        <DialogContent :title="t('ipcheck.Title')">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <h5 class="m-0 text-lg font-semibold" id="IPCheckTitle">{{ t('ipcheck.Title') }}</h5>
                <DialogClose />
            </div>
            <div class="pt-3">
                <div class="flex w-full mb-3">
                    <Input type="text" class="rounded-r-none"
                        :placeholder="t('ipcheck.Placeholder')" v-model="inputIP" @keyup.enter="submitQuery"
                        name="inputIP" id="inputIP" />
                    <Button id="sumitQueryButton" type="button"
                        class="rounded-l-none -ml-px"
                        :class="isValidIP(inputIP) ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-neutral-500 hover:bg-neutral-600 text-white'"
                        @click="submitQuery" :disabled="!isValidIP(inputIP) || isChecking === 'running'">
                        {{ t('ipcheck.Button') }}
                    </Button>
                </div>

                <div v-if="modalQueryError" class="text-red-600">{{ modalQueryError }}</div>
                <div v-if="modalQueryResult" class="mt-2">
                    <ul class="flex flex-col">
                        <li class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2">
                                <Monitor class="inline size-[1em] align-[-0.125em]" /> {{ t('ipInfos.Country') }}
                            </span>&nbsp;:&nbsp;
                            <span class="flex-1">{{ modalQueryResult.country_name }}&nbsp;
                                <span v-if="modalQueryResult.country_code"
                                    :class="'jn-fl fi fi-' + modalQueryResult.country_code.toLowerCase()"></span>
                            </span>
                        </li>
                        <li class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2"><House class="inline size-[1em] align-[-0.125em]" /> {{ t('ipInfos.Region') }}</span>&nbsp;:&nbsp;
                            <span class="flex-1">{{ modalQueryResult.region }}</span>
                        </li>
                        <li class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2"><CornerUpRight class="inline size-[1em] align-[-0.125em]" /> {{ t('ipInfos.City') }}</span>&nbsp;:&nbsp;
                            <span class="flex-1">{{ modalQueryResult.city }}</span>
                        </li>
                        <li class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2"><EthernetPort class="inline size-[1em] align-[-0.125em]" /> {{ t('ipInfos.ISP') }}</span>&nbsp;:&nbsp;
                            <span class="flex-1">{{ modalQueryResult.isp }}</span>
                        </li>

                        <li v-if="ipGeoSource === 0 && modalQueryResult.type !== t('ipInfos.advancedData.type.unknownType')"
                            class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2">
                                <SignalHigh class="inline size-[1em] align-[-0.125em]" /> {{ t('ipInfos.type') }}
                            </span>&nbsp;:&nbsp;
                            <span v-if="modalQueryResult.type !=='sign_in_required'" class="flex-1">
                                {{ modalQueryResult.type }}
                                <span v-if="modalQueryResult.proxyOperator !== 'unknown'">
                                    ( {{ modalQueryResult.proxyOperator }} )
                                </span>
                            </span>
                            <span v-else class="text-neutral-500">{{ t('user.SignInToView') }}</span>
                        </li>

                        <li v-if="ipGeoSource === 0 && modalQueryResult.isProxy !== t('ipInfos.advancedData.proxyUnknown')"
                            class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2">
                                <ShieldCheck class="inline size-[1em] align-[-0.125em]" />
                                {{ t('ipInfos.isProxy') }}
                            </span>&nbsp;:&nbsp;
                            <span v-if="modalQueryResult.isProxy !=='sign_in_required'" class="flex-1">
                                {{ modalQueryResult.isProxy }}
                                <span v-if="modalQueryResult.proxyProtocol !== t('ipInfos.advancedData.proxyUnknownProtocol')">
                                    ( {{ modalQueryResult.proxyProtocol }} )
                                </span>
                            </span>
                            <span v-else class="text-neutral-500">{{ t('user.SignInToView') }}</span>
                        </li>

                        <li v-if="ipGeoSource === 0" class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2">
                                <House class="inline size-[1em] align-[-0.125em]" />
                                {{ t('ipInfos.advancedData.Nativeness') }} :&nbsp;
                            </span>
                            <span v-if="modalQueryResult.isNativeIP !=='sign_in_required'" class="flex-1">
                                <span v-if="modalQueryResult.isNativeIP === true">
                                    <CircleCheck class="inline size-[1em] align-[-0.125em]" />
                                    {{t('ipInfos.advancedData.NativeIPYes')}}
                                </span>
                                <span v-else>
                                    <CircleX class="inline size-[1em] align-[-0.125em]" />
                                    {{t('ipInfos.advancedData.NativeIPNo')}}
                                </span>
                            </span>
                            <span v-else class="text-neutral-500">{{ t('user.SignInToView') }}</span>
                        </li>

                        <li v-if="ipGeoSource === 0" class="flex items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                            <span class="shrink-0 mr-2">
                                <Gauge class="inline size-[1em] align-[-0.125em]" />
                                {{ t('ipInfos.qualityScore') }} :&nbsp;
                            </span>
                            <span v-if="modalQueryResult.qualityScore !== 'unknown' && modalQueryResult.qualityScore !== 'sign_in_required'"
                                class="w-24">
                                <Progress :model-value="Number(modalQueryResult.qualityScore) || 0" />
                            </span>
                            <span v-if="modalQueryResult.qualityScore !== 'sign_in_required'" class="ps-2">
                                <span v-if="modalQueryResult.qualityScore === 'unknown'">
                                    {{ t('ipInfos.qualityScoreUnknown') }}
                                </span>
                                <span v-else>{{ modalQueryResult.qualityScore }}%</span>
                            </span>
                            <span v-if="modalQueryResult.qualityScore === 'sign_in_required'" class="text-neutral-500">
                                {{ t('user.SignInToView') }}
                            </span>
                        </li>

                        <li class="flex items-center py-2">
                            <span class="shrink-0 mr-2">
                                <Building2 class="inline size-[1em] align-[-0.125em]" /> {{ t('ipInfos.ASN') }}
                            </span>&nbsp;:&nbsp;
                            <span class="flex-1">
                                <a v-if="modalQueryResult.asnlink" :href="modalQueryResult.asnlink" target="_blank"
                                    class="no-underline hover:underline text-neutral-900 dark:text-neutral-100">{{ modalQueryResult.asn }}</a>
                                <span v-else-if="modalQueryResult.asn">{{ modalQueryResult.asn }}</span>
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// refactor/01 阶段 C.2：QueryIP 模板从 Bootstrap class 改为 Tailwind + shadcn
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useMainStore } from '@/store';
import { isValidIP } from '@/utils/valid-ip.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Building2,
    CircleCheck,
    CircleX,
    CornerUpRight,
    EthernetPort,
    Gauge,
    House,
    Monitor,
    Search,
    ShieldCheck,
    SignalHigh,
} from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const userPreferences = computed(() => store.userPreferences);
const lang = computed(() => store.lang);
const inputIP = ref('');
const modalQueryResult = ref(null);
const modalQueryError = ref("");
const isChecking = ref("idle");
const ipGeoSource = ref(userPreferences.value.ipGeoSource);

watch(() => userPreferences.value.ipGeoSource, (newVal) => {
    ipGeoSource.value = newVal;
}, { deep: true });

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

const openQueryIP = () => {
    trackEvent('SideButtons', 'ToggleClick', 'QueryIP');
    openModal();
};

const openModal = () => {
    onOpenChange(true);
};

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

// 超宽屏（>1600px）时对齐到内容区右侧
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
const positionStyle = computed(() => {
    if (screenWidth.value > 1600) {
        const spaceOnRight = (screenWidth.value - 1600) / 2;
        return { right: `${spaceOnRight + 20}px` };
    }
    return { right: '20px' };
});
const handleResize = () => { screenWidth.value = window.innerWidth; };

onMounted(() => { window.addEventListener('resize', handleResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); });

defineExpose({
    openModal,
});
</script>

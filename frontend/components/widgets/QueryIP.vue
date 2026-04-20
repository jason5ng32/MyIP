<template>
    <!-- Floating query button (bottom right fixed) -->
    <JnTooltip :text="t('Tooltips.QueryIP')" side="left">
        <Button size="icon" variant="action" type="button" aria-label="IP Check"
            class="fixed bottom-6 z-1050 rounded-full shadow-lg cursor-pointer" :style="positionStyle"
            @click="openQueryIP">
            <Search class="size-4" />
        </Button>
    </JnTooltip>

    <!-- Query Dialog -->
    <Dialog :open="isOpen" @update:open="onOpenChange">
        <DialogContent :title="t('ipcheck.Title')" class="max-w-xl min-h-[200px]">
            <DialogHeader :icon="Search" :title="t('ipcheck.Title')" />

            <div class="space-y-4">
                <!-- Input Group -->
                <div class="flex items-center gap-2">
                    <Input type="text" id="inputIP" name="inputIP" :placeholder="t('ipcheck.Placeholder')"
                        v-model="inputIP" @keyup.enter="submitQuery" :aria-invalid="modalQueryError !== ''"
                        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                        data-1p-ignore data-lpignore="true" />
                    <Button id="sumitQueryButton" type="button" variant="action"
                        :disabled="!isValidIP(inputIP) || isChecking === 'running'" @click="submitQuery"
                        class="cursor-pointer">
                        <Spinner v-if="isChecking === 'running'" />
                        <template v-else>
                            <Search class="size-4 shrink-0" />
                        </template>
                    </Button>
                </div>

                <!-- Error message -->
                <p v-if="modalQueryError" class="text-sm text-destructive">{{ modalQueryError }}</p>

                <!-- Query result: Hero IP (no Copy / Map) + shared IpDetailPanel -->
                <div v-if="modalQueryResult" class="rounded-lg border bg-card overflow-hidden">
                    <div class="px-4 py-3 flex items-start gap-2 min-w-0 border-b mb-4">                        
                        <FitText :text="inputIP" :tiers="HERO_TIERS" :title="inputIP"
                        :max-lines="2"
                            class="font-mono font-semibold min-w-0">
                            <template #prefix>
                                <Monitor class="inline size-5 align-middle text-muted-foreground mr-2 mb-1" />
                            </template>
                        </FitText>
                    </div>

                    <IpDetailPanel :data="modalQueryResult" :ip-geo-source="ipGeoSource" :asn-infos="asnInfos"
                        :configs="configs" :is-dark-mode="isDarkMode" :enable-map="false" />
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// QueryIP — manual IP lookup. Shares IpDetailPanel with IPCard so the info display stays in sync.
// Differences from IPCard:
// - No Copy button (the IP was typed by the user — copying it is pointless).
// - No Map button (Dialog-in-Dialog stacking is avoided; enableMap=false).
// - Own asnInfos cache (local to this component; not shared with IPCard).
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useMainStore } from '@/store';
import { isValidIP } from '@/utils/valid-ip.js';
import FitText from '@/components/widgets/FitText.vue';
import { HERO_TIERS } from '@/composables/use-fit-text.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import IpDetailPanel from '../ip-infos/IpDetailPanel.vue';
import { Monitor, Search } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const userPreferences = computed(() => store.userPreferences);
const configs = computed(() => store.configs);
const isDarkMode = computed(() => store.isDarkMode);
const lang = computed(() => store.lang);

const inputIP = ref('');
const modalQueryResult = ref(null);
const modalQueryError = ref('');
const isChecking = ref('idle');
const ipGeoSource = ref(userPreferences.value.ipGeoSource);
const asnInfos = ref({});

watch(() => userPreferences.value.ipGeoSource, (newVal) => {
    ipGeoSource.value = newVal;
}, { deep: true });

const submitQuery = async () => {
    if (isValidIP(inputIP.value)) {
        modalQueryError.value = '';
        modalQueryResult.value = null;
        isChecking.value = 'running';
        await fetchIPForModal(inputIP.value);
    } else {
        modalQueryError.value = t('ipcheck.Error');
        modalQueryResult.value = null;
        isChecking.value = 'idle';
    }
};

const isOpen = ref(false);

// Programmatic focus here is only useful on desktop. On iOS, focus outside of
// the direct tap on the <input> doesn't trigger the native keyboard + visual
// viewport scroll-into-view, so it's better to let the user tap the input
// themselves and let iOS handle the whole dance natively.
// iPadOS 13+ reports a Mac user-agent, so we detect it via the "lying Mac"
// trick: a Macintosh UA that also claims multi-touch capability. We avoid
// `navigator.platform` because it's deprecated.
const isIOS = typeof navigator !== 'undefined'
    && (/iPad|iPhone|iPod/.test(navigator.userAgent)
        || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const onOpenChange = (val) => {
    isOpen.value = val;
    if (val && !isIOS) {
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

const openModal = () => onOpenChange(true);

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
            isChecking.value = 'idle';
            break;
        } catch (error) {
            console.error('Error fetching IP details:', error);
        }
    }
};

// Floating button positioning (align to content area right on wide screen)
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
const positionStyle = computed(() => {
    if (screenWidth.value > 1600) {
        const spaceOnRight = (screenWidth.value - 1600) / 2;
        return { right: `${spaceOnRight + 20}px` };
    }
    return { right: '20px' };
});
const handleResize = () => { screenWidth.value = window.innerWidth; };
onMounted(() => window.addEventListener('resize', handleResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleResize));

defineExpose({ openModal });
</script>

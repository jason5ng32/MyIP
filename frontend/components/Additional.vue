<template>
    <!-- Curl Dialog -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('curl.Title')">
            <DialogHeader :icon="Terminal" :title="t('curl.Title')" />

            <div v-if="curlDomainsHadSet" class="space-y-3">
                <!-- Description -->
                <div class="space-y-1 text-xs font-mono">
                    <p class="jn-comment"><span class="text-muted-foreground">{{ t('curl.Note1') }}</span></p>
                    <p class="jn-comment">
                        <span class="text-muted-foreground">{{ t('curl.Note2_1') }}
                            <Badge variant="outline" class="text-success">curl</Badge> {{ t('curl.Note2_2') }}</span>
                    </p>
                    <p class="jn-comment">
                        <span class="text-muted-foreground"><Badge variant="outline" class="text-success">geo</Badge> {{ t('curl.Note3') }}</span>
                    </p>
                    <p class="jn-comment">
                        <span class="text-muted-foreground"><Badge variant="outline" class="text-success">YOUR_API_KEY</Badge> {{ t('curl.Note4') }}</span>
                    </p>
                </div>

                <!-- 3 curl command blocks -->
                <div class="space-y-3">
                    <div>
                        <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.getIPv4') }}</p>
                        <pre class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ ipv4Domain }}<span class="text-success">/geo</span> -H 'x-key: <span class="text-yellow-400">YOUR_API_KEY</span>'</pre>
                    </div>
                    <div>
                        <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.getIPv6') }}</p>
                        <pre class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ ipv6Domain }}<span class="text-success">/geo</span> -H 'x-key: <span class="text-yellow-400">YOUR_API_KEY</span>'</pre>
                    </div>
                    <div>
                        <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.get6and4') }}</p>
                        <pre class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ ipv64Domain }}<span class="text-success">/geo</span> -H 'x-key: <span class="text-yellow-400">YOUR_API_KEY</span>'</pre>
                    </div>
                </div>
            </div>
            <div v-else class="py-6 text-center">
                <p class="text-sm text-muted-foreground">{{ t('curl.notAvailable') }}</p>
            </div>
        </DialogContent>
    </Dialog>

    <!-- Additional Tools: external product link bar -->
    <div class="mx-auto text-center max-w-[98%]">
        <div id="morefromipchecking" class="flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
            <a href="https://www.raycast.com/jason5ng32/ipcheck-ing" target="_blank" rel="noopener"
                @click="trackEvent('Additional', 'AdditionalClick', 'Raycast')">
                <img src="/additional/raycast.webp" alt="IPCheck.ing on Raycast"
                    class="w-[108px] sm:w-[180px] h-auto">
            </a>

            <button type="button" @click="openCurlModal"
                aria-label="IPCheck.ing for Curl"
                class="cursor-pointer bg-transparent border-0 p-0">
                <img src="/additional/curl.webp" alt="IPCheck.ing for Curl"
                    class="w-[108px] sm:w-[180px] h-auto">
            </button>

            <a href="https://lite.ipcheck.ing" target="_blank" rel="noopener"
                @click="trackEvent('Additional', 'AdditionalClick', 'Lite')">
                <img src="/additional/lite.webp" alt="IPCheck.ing lite"
                    class="w-[108px] sm:w-[180px] h-auto">
            </a>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Terminal } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';

const { t } = useI18n();

const store = useMainStore();

const ipv4Domain = computed(() => store.curl.ipv4Domain);
const ipv6Domain = computed(() => store.curl.ipv6Domain);
const ipv64Domain = computed(() => store.curl.ipv64Domain);
const curlDomainsHadSet = computed(() => store.curlDomainsHadSet);

const isOpen = ref(false);
const openCurlModal = () => {
    isOpen.value = true;
    trackEvent('Additional', 'AdditionalClick', 'Curl');
};

defineExpose({
    openCurlModal,
});
</script>

<style scoped>
.jn-curl::before {
    content: '$ ';
    color: var(--muted-foreground);
    font-weight: 500;
    margin-right: 0.25rem;
    opacity: 0.7;
}

.jn-comment::before {
    content: '// ';
    color: var(--muted-foreground);
    font-weight: 500;
    opacity: 0.7;
}
</style>

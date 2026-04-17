<template>
    <!-- Curl Dialog -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('curl.Title')">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <h5 class="m-0 text-lg font-semibold">
                    <i class="bi bi-terminal-fill"></i> {{ t('curl.Title') }}
                </h5>
                <DialogClose />
            </div>
            <div v-if="curlDomainsHadSet" class="m-2">
                <code class="flex flex-col items-start gap-1">
                    <span class="jn-comment"><span class="text-neutral-500">{{t('curl.Note1')}}</span></span>
                    <span class="jn-comment"><span class="text-neutral-500">{{t('curl.Note2_1')}} <span class="text-green-600">curl</span> {{t('curl.Note2_2')}}</span></span>
                    <span class="jn-comment"><span class="text-neutral-500"><span class="text-green-600">geo</span> {{t('curl.Note3')}}</span></span>
                    <span class="jn-comment"><span class="text-neutral-500"><span class="text-green-600">YOUR_API_KEY</span> {{t('curl.Note4')}}</span></span>
                    <span>&nbsp;</span>
                    <span class="jn-comment"><span class="text-neutral-500">{{t('curl.getIPv4')}}</span></span>
                    <span class="jn-curl bg-black p-3 m-2 rounded-md">curl <span class="text-neutral-100">{{ipv4Domain}}<span class="text-green-600">/geo</span> -H 'x-key: <span class="text-yellow-400">YOUR_API_KEY</span>'</span></span>
                    <span class="jn-comment"><span class="text-neutral-500">{{t('curl.getIPv6')}}</span></span>
                    <span class="jn-curl bg-black p-3 m-2 rounded-md">curl <span class="text-neutral-100">{{ipv6Domain}}<span class="text-green-600">/geo</span> -H 'x-key: <span class="text-yellow-400">YOUR_API_KEY</span>'</span></span>
                    <span class="jn-comment"><span class="text-neutral-500">{{t('curl.get6and4')}}</span></span>
                    <span class="jn-curl bg-black p-3 m-2 rounded-md">curl <span class="text-neutral-100">{{ipv64Domain}}<span class="text-green-600">/geo</span> -H 'x-key: <span class="text-yellow-400">YOUR_API_KEY</span>'</span></span>
                </code>
            </div>
            <div v-else class="m-2">
                <code class="flex justify-center">
                    <span class="jn-comment"><span class="text-neutral-500">{{t('curl.notAvailable')}}</span></span>
                </code>
            </div>
        </DialogContent>
    </Dialog>

    <!-- Additional Tools -->
    <div class="mx-auto text-center jn-add max-w-[98%]">
        <div id="morefromipchecking" class="flex justify-center">
            <div :class="[isMobile ? 'mx-1' : 'mx-3']">
                <a href="https://www.raycast.com/jason5ng32/ipcheck-ing" target="_blank"
                    @click="trackEvent('Additional', 'AdditionalClick', 'Raycast');">
                    <img src="/additional/raycast.webp" alt="IPCheck.ing on Raycast" :width="[isMobile ? '108' : '180']"
                        :height="[isMobile ? '39' : '65']">
                </a>
            </div>

            <div :class="[isMobile ? 'mx-1' : 'mx-3']">
                <img type="button" @click="openCurlModal" src="/additional/curl.webp" class="cursor-pointer"
                    alt="IPCheck.ing for Curl" :width="[isMobile ? '108' : '180']" :height="[isMobile ? '39' : '65']">
            </div>

            <div :class="[isMobile ? 'mx-1' : 'mx-3']">
                <a href="https://lite.ipcheck.ing" target="_blank"
                    @click="trackEvent('Additional', 'AdditionalClick', 'Lite');">
                    <img src="/additional/lite.webp" alt="IPCheck.ing lite" :width="[isMobile ? '108' : '180']"
                        :height="[isMobile ? '39' : '65']">
                </a>
            </div>
        </div>
    </div>
</template>

<script setup>
// refactor/01 阶段 C.2：Additional 模板从 Bootstrap class 改为 Tailwind
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);

// 获取 CURL 请求域名
const ipv4Domain = computed(() => store.curl.ipv4Domain);
const ipv6Domain = computed(() => store.curl.ipv6Domain);
const ipv64Domain = computed(() => store.curl.ipv64Domain);
const curlDomainsHadSet = computed(() => store.curlDomainsHadSet);

// Dialog 开关（对外 API 保持 openCurlModal()）
const isOpen = ref(false);
const openCurlModal = () => {
    isOpen.value = true;
    trackEvent('Additional', 'AdditionalClick', 'Curl');
};

defineExpose({
    openCurlModal
});
</script>

<style scoped>
.jn-curl::before {
    content: '$ ';
    color: #6c757d;
    font-weight: 500;
    margin-right: 0.5rem;
}

.jn-comment {
    margin-left: 26pt;
    white-space: break-spaces;
}

.jn-comment::before {
    content: '// ';
    color: #6c757d;
    font-weight: 500;
    margin-left: -20pt;
}
</style>

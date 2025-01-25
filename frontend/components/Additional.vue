<template>
    <!-- Shell Modal -->
    <div class="modal fade" id="Shell" tabindex="-1" aria-labelledby="Shell" aria-hidden="false">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title" id="ShellTitle">{{ t('shell.Title') }}</h5>
                    <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                        data-bs-dismiss="modal" aria-label="Close"></button>

                </div>
                <div v-if="curlDomainsHadSet" class="modal-body m-2" :class="{ 'dark-mode': isDarkMode }">
                    <code class="row flex justify-content-center">
                        <span class="jn-comment"><span class="text-secondary">{{t('shell.Note1')}}</span></span>
                        <span class="jn-comment"><span class="text-secondary">{{t('shell.Note2_1')}} <span class="text-success">curl</span> {{t('shell.Note2_2')}}</span></span>
                        <span class="text-secondary jn-comment"><span class="text-success">geo</span> {{t('shell.Note3')}}</span>
                        <span>&nbsp;</span>
                        <span class="jn-comment"><span class="text-secondary">{{t('shell.getIPv4')}}</span></span>
                        <span class="jn-shell bg-black p-3 m-2 rounded-3">curl <span class="text-light">{{ipv4Domain}}<span class="text-success">/geo</span></span></span>
                        <span class="jn-comment"><span class="text-secondary">{{t('shell.getIPv6')}}</span></span>
                        <span class="jn-shell bg-black p-3 m-2 rounded-3">curl <span class="text-light">{{ipv6Domain}}<span class="text-success">/geo</span></span></span>
                        <span class="jn-comment"><span class="text-secondary">{{t('shell.get6and4')}}</span></span>
                        <span class="jn-shell bg-black p-3 m-2 rounded-3">curl <span class="text-light">{{ipv64Domain}}<span class="text-success">/geo</span></span></span>
                    </code>
                </div>
                <div v-else class="modal-body m-2" :class="{ 'dark-mode': isDarkMode }">
                    <code class="row flex justify-content-center">
                        <span class="jn-comment"><span class="text-secondary">{{t('shell.notAvailable')}}</span></span>
                        </code>
                </div>
                <div class="modal-footer" :class="{ 'dark-mode-border': isDarkMode }">
                </div>
            </div>
        </div>
    </div>

    <!-- Additional Tools -->
    <div class="container text-center jn-add">
        <div id="morefromipchecking" class="d-flex justify-content-center">
            <div :class="[isMobile ? 'mx-1' : 'mx-3']">
                <a href="https://www.raycast.com/jason5ng32/ipcheck-ing" target="_blank">
                    <img src="/additional/raycast.webp" alt="IPCheck.ing on Raycast" :width="[isMobile ? '108' : '180']"
                        :height="[isMobile ? '39' : '65']">
                </a>
            </div>

            <div :class="[isMobile ? 'mx-1' : 'mx-3']">
                <img type="button" data-bs-toggle="modal" aria-label="Shell" data-bs-target="#Shell" @click="openModal"
                    src="/additional/curl.webp" alt="IPCheck.ing for Curl" :width="[isMobile ? '108' : '180']"
                    :height="[isMobile ? '39' : '65']">
            </div>

            <div :class="[isMobile ? 'mx-1' : 'mx-3']">
                <a href="https://lite.ipcheck.ing" target="_blank">
                    <img src="/additional/lite.webp" alt="IPCheck.ing lite" :width="[isMobile ? '108' : '180']"
                        :height="[isMobile ? '39' : '65']">
                </a>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useMainStore } from '@/store';
import { Modal } from 'bootstrap';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

// 获取 CURL 请求域名
const ipv4Domain = computed(() => store.shell.ipv4Domain);
const ipv6Domain = computed(() => store.shell.ipv6Domain);
const ipv64Domain = computed(() => store.shell.ipv64Domain);
const curlDomainsHadSet = computed(() => store.curlDomainsHadSet);


// 打开 Modal
const openCurlModal = () => {
    const modalElement = document.getElementById('Shell');
    const modalInstance = Modal.getOrCreateInstance(modalElement);
    if (modalInstance) {
        modalInstance.show();
    }
};


defineExpose({
    openCurlModal
});
</script>

<style scoped>
.jn-add {
    max-width: 98%;
    overflow: scroll;
}

.jn-shell::before {
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
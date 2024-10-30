<template>
    <!-- Shell BTN -->
    <button v-if="!isMobile && curlDomainsHadSet" class="btn btn-dark jn-shell-button" data-bs-toggle="modal"
        aria-label="Shell" data-bs-target="#Shell" @click="openModal" v-tooltip="t('Tooltips.Shell')"><i
            class="bi bi-terminal"></i></button>
    <!-- Shell Modal -->
    <div class="modal fade" id="Shell" tabindex="-1" aria-labelledby="Shell" aria-hidden="true">
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
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { Modal } from 'bootstrap';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// 引入 Store
const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

// 获取 CURL 请求域名
const ipv4Domain = computed(() => store.shell.ipv4Domain);
const ipv6Domain = computed(() => store.shell.ipv6Domain);
const ipv64Domain = computed(() => store.shell.ipv64Domain);

const curlDomainsHadSet = computed(() => store.curlDomainsHadSet);

// 打开 Modal
const openModal = () => {
    const modalElement = document.getElementById('Shell');
    const modalInstance = Modal.getOrCreateInstance(modalElement);
    if (modalInstance) {
        modalInstance.show();
    }
};

const adjustButtonPosition = () => {
    if (isMobile.value || !curlDomainsHadSet.value) {
        return;
    }
    const screenWidth = window.innerWidth;
    const contentWidth = 1600; // 主内容区域的宽度
    const spaceOnRight = (screenWidth - contentWidth) / 2;

    const button = document.querySelector('.jn-shell-button');
    if (screenWidth > 1600) { // 只在屏幕宽度大于1600px时调整
        button.style.right = `${spaceOnRight + 20}px`; // 保持20px的距离
    } else {
        button.style.right = '20px'; // 在小屏幕上使用默认位置
    }
}

onMounted(() => {
    if (!isMobile.value && curlDomainsHadSet.value) {
        window.addEventListener('resize', adjustButtonPosition);
        adjustButtonPosition();
    }

});

defineExpose({
    openModal,
});

</script>


<style scoped>
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

.jn-shell-button {
    position: fixed;
    bottom: 66px;
    right: 20px;
    z-index: 1050;
}
</style>

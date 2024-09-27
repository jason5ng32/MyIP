<template>
    <!-- Shell Modal -->
    <div class="modal fade" id="Shell" tabindex="-1" aria-labelledby="Shell" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title" id="ShellTitle">{{ t('shell.Title') }}</h5>
                    <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                        data-bs-dismiss="modal" aria-label="Close"></button>

                </div>
                <div class="modal-body m-2" :class="{ 'dark-mode': isDarkMode }">
                    <code class="row flex justify-content-center">
                                <span class="jn-comment"><span class="text-secondary">{{t('shell.Note1')}}</span></span>
                                <span class="jn-comment"><span class="text-secondary">{{t('shell.Note2_1')}} <span class="text-success">curl</span> {{t('shell.Note2_2')}}</span></span>
                                <span class="text-secondary jn-comment"><span class="text-success">geo</span> {{t('shell.Note3')}}</span>
                                <span>&nbsp;</span>
                                <span class="jn-comment"><span class="text-secondary">{{t('shell.getIPv4')}}</span></span>
                                <span class="jn-shell bg-black p-3 m-2 rounded-3">curl <span class="text-light">4.ipcheck.ing<span class="text-success">/geo</span></span></span>
                                <span class="jn-comment"><span class="text-secondary">{{t('shell.getIPv6')}}</span></span>
                                <span class="jn-shell bg-black p-3 m-2 rounded-3">curl <span class="text-light">6.ipcheck.ing<span class="text-success">/geo</span></span></span>
                                <span class="jn-comment"><span class="text-secondary">{{t('shell.get6and4')}}</span></span>
                                <span class="jn-shell bg-black p-3 m-2 rounded-3">curl <span class="text-light">64.ipcheck.ing<span class="text-success">/geo</span></span></span>
                            </code>
                </div>
                <div class="modal-footer" :class="{ 'dark-mode-border': isDarkMode }">
                </div>


            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { Modal } from 'bootstrap';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// 引入 Store
const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);

// 打开 Modal
const openModal = () => {
    const modalElement = document.getElementById('Shell');
    const modalInstance = Modal.getOrCreateInstance(modalElement);
    if (modalInstance) {
        modalInstance.show();
    }
};

defineExpose({
    openModal,
});

</script>


<style scoped>
.jn-curl-button {
    position: fixed;
    bottom: 66px;
    right: 20px;
    z-index: 1050;
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

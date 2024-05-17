<template>
    <!-- Help Modal -->
    <div class="modal fade" id="helpModal" tabindex="-1" aria-labelledby="helpModal" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title" id="helpModalTitle"><i class="bi bi-keyboard"></i> {{ t('helpModal.Title')
                        }}</h5>
                    <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                        data-bs-dismiss="modal" aria-label="Close"></button>

                </div>
                <div class="modal-body" :class="{ 'dark-mode': isDarkMode }">
                    <p class="jn-help-note "><i class="bi bi-hand-thumbs-up-fill"></i>
                        {{ t('shortcutKeys.HelpNote') }}
                    </p>
                    <div class="row flex-nowrap text-nowrap">
                        <!-- 左边的列 -->
                        <div class="col text-nowrap ">
                            <div v-for="(key, index) in splitKeyMap.left" :key="`left-${key.keys}`"
                                class="row p-2 justify-content-between mx-1"
                                :class="[isDarkMode ? 'border-dark-subtle jn-dark-mode-help-border' : 'border-light-subtle']">
                                <div class="col-8">
                                    {{ key.description }}
                                </div>
                                <div class="col-auto">
                                    <kbd :class="{ 'text-bg-light': isDarkMode }">
                                        {{ key.keys.replace(/[\[\]\\\(\)]/g, '') }}
                                    </kbd>
                                </div>
                            </div>
                        </div>
                        <!-- 右边的列 -->
                        <div class="col text-nowrap">
                            <div v-for="(key, index) in splitKeyMap.right" :key="`right-${key.keys}`"
                                class="row p-2 justify-content-between mx-1"
                                :class="[isDarkMode ? 'border-dark-subtle jn-dark-mode-help-border' : 'border-light-subtle']">
                                <div class="col-8">
                                    {{ key.description }}
                                </div>
                                <div class="col-auto">
                                    <kbd :class="{ 'text-bg-light': isDarkMode }">
                                        {{ key.keys.replace(/[\[\]\\\(\)]/g, '') }}
                                    </kbd>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useMainStore } from '@/store';
import { Modal } from 'bootstrap';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);

// 快捷键映射
const keyMap = ref([]);

// 打开快捷键模态框
const openModal = () => {
    const modalElement = document.getElementById('helpModal');
    const modalInstance = Modal.getOrCreateInstance(modalElement);
    if (modalInstance) {
        modalInstance.show();
    }
};

// 把快捷键映射分成两列
const splitKeyMap = computed(() => {
    const half = Math.ceil(keyMap.value.length / 2);
    return {
        left: keyMap.value.slice(0, half),
        right: keyMap.value.slice(half),
    };
});

// 暴露给模板的数据
defineExpose({
    keyMap,
    openModal,
});
</script>

<style scoped></style>

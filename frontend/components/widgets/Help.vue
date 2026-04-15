<template>
    <!-- Help Dialog (refactor/01: 旧 Bootstrap Modal → shadcn-vue Dialog) -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent
            :title="t('helpModal.Title')"
            class="max-w-2xl"
            :data-bs-theme="isDarkMode ? 'dark' : ''"
        >
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header d-flex align-items-center justify-content-between" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title m-0" id="helpModalTitle"><i class="bi bi-keyboard"></i> {{ t('helpModal.Title')
                        }}</h5>
                    <DialogClose class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }" />
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
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);

// 快捷键映射
const keyMap = ref([]);

// Dialog 开关（对外 API 保持 openModal()）
const isOpen = ref(false);
const openModal = () => {
    isOpen.value = true;
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

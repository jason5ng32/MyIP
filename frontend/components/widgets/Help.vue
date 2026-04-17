<template>
    <!-- Help Dialog -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('helpModal.Title')" class="max-w-2xl">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <h5 class="m-0 text-lg font-semibold">
                    <Keyboard class="inline size-[1em] align-[-0.125em]" /> {{ t('helpModal.Title') }}
                </h5>
                <DialogClose />
            </div>
            <div class="pt-3">
                <p class="mb-3">
                    <ThumbsUp class="inline size-[1em] align-[-0.125em]" />
                    {{ t('shortcutKeys.HelpNote') }}
                </p>
                <div class="flex flex-nowrap whitespace-nowrap gap-2">
                    <!-- 左边的列 -->
                    <div class="flex-1 whitespace-nowrap">
                        <div v-for="(key, index) in splitKeyMap.left" :key="`left-${key.keys}`"
                            class="flex p-2 justify-between mx-1 border-b border-neutral-200 dark:border-neutral-700">
                            <div class="flex-1 pr-2">
                                {{ key.description }}
                            </div>
                            <div class="shrink-0">
                                <kbd class="px-1.5 py-0.5 text-xs rounded border border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100">
                                    {{ key.keys.replace(/[\[\]\\\(\)]/g, '') }}
                                </kbd>
                            </div>
                        </div>
                    </div>
                    <!-- 右边的列 -->
                    <div class="flex-1 whitespace-nowrap">
                        <div v-for="(key, index) in splitKeyMap.right" :key="`right-${key.keys}`"
                            class="flex p-2 justify-between mx-1 border-b border-neutral-200 dark:border-neutral-700">
                            <div class="flex-1 pr-2">
                                {{ key.description }}
                            </div>
                            <div class="shrink-0">
                                <kbd class="px-1.5 py-0.5 text-xs rounded border border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100">
                                    {{ key.keys.replace(/[\[\]\\\(\)]/g, '') }}
                                </kbd>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// refactor/01 阶段 C.2：Help 模板从 Bootstrap row/col 改为 Tailwind flex
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Keyboard, ThumbsUp } from 'lucide-vue-next';

const { t } = useI18n();

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

defineExpose({
    keyMap,
    openModal,
});
</script>

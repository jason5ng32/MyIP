<template>
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('helpModal.Title')" class="max-w-4xl">
            <DialogHeader :icon="Keyboard" :title="t('helpModal.Title')" />

            <div class="space-y-4">
                <p class="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                    <ThumbsUp class="size-4 mt-0.5 shrink-0" />
                    <span>{{ t('shortcutKeys.HelpNote') }}</span>
                </p>

                <!-- Multi-column shortcut list -->
                <div class="grid grid-cols-2 md:grid-cols-3  gap-x-6 gap-y-1">
                    <div v-for="key in keyMap" :key="key.keys"
                        class="flex items-center justify-between gap-3 py-2 border-b">
                        <span class="text-sm">{{ key.description }}</span>
                        <kbd
                            class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border bg-muted text-xs font-mono text-foreground">
                            {{ key.keys.replace(/[\[\]\\\(\)]/g, '') }}
                        </kbd>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Keyboard, ThumbsUp } from '@lucide/vue';

const { t } = useI18n();

const keyMap = ref([]);

const isOpen = ref(false);
const openModal = () => { isOpen.value = true; };

defineExpose({
    keyMap,
    openModal,
});
</script>

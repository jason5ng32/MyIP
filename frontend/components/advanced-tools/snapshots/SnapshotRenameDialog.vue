<!-- Snapshots rename dialog: one snapshot's name in a Dialog, prefilled with
     the current name, the auto label as placeholder. Enter saves, Esc
     cancels (the Dialog's own close); saving it empty restores the auto
     label. -->
<template>
    <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
        <DialogContent :title="t('snapshots.RenameTitle')" class="max-w-md">
            <DialogHeader class="border-b border-border pb-2" :icon="Pencil" :title="t('snapshots.RenameTitle')" />
            <div class="space-y-4">
                <div class="space-y-1.5">
                    <Input id="snapshotName" v-model="draft" :maxlength="SNAPSHOT_NAME_MAX" :placeholder="placeholder"
                        :aria-label="t('snapshots.NameLabel')" autocomplete="off" autocorrect="off"
                        autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
                        @keydown.enter="onEnter" />
                    <p class="m-0 text-xs text-muted-foreground">{{ t('snapshots.RenameHint') }}</p>
                </div>
                <div class="flex justify-end gap-2">
                    <Button variant="outline" class="cursor-pointer" @click="emit('update:open', false)">
                        {{ t('snapshots.Cancel') }}
                    </Button>
                    <Button class="cursor-pointer" @click="save">{{ t('snapshots.Save') }}</Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pencil } from '@lucide/vue';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SNAPSHOT_NAME_MAX } from '@/utils/features/snapshots.js';

const props = defineProps({
    open: { type: Boolean, default: false },
    name: { type: String, default: '' },
    // The auto label, shown when the name is empty.
    placeholder: { type: String, default: '' },
});
const emit = defineEmits(['update:open', 'save']);

const { t } = useI18n();

const draft = ref('');
// Each opening starts from the snapshot's current name.
watch(() => props.open, (open) => {
    if (open) draft.value = props.name;
});

const save = () => {
    emit('save', draft.value.trim());
    emit('update:open', false);
};

// Enter saves, unless it is confirming an IME composition.
const onEnter = (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    save();
};
</script>

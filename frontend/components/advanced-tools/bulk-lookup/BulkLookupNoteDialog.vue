<!-- Bulk IP Lookup note editor: one row's note in a Dialog. Cmd/Ctrl+Enter
     saves, Esc cancels (the Dialog's own close). -->
<template>
    <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
        <DialogContent :title="t('bulklookup.EditNote')" class="max-w-md">
            <DialogHeader class="border-b border-border pb-2" :icon="PencilLine" :title="t('bulklookup.EditNote')" />
            <div class="space-y-4" data-sentry-block>
                <p class="font-mono text-sm break-all mb-2">{{ ip }}</p>
                <Textarea id="bulkLookupNote" v-model="draft" rows="3" :maxlength="NOTE_MAX"
                    class="min-h-20 max-h-48 text-sm" :placeholder="t('bulklookup.NotePlaceholder')"
                    :aria-label="t('bulklookup.col.note')" autocomplete="off" autocorrect="off"
                    autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
                    @keydown.enter.meta.prevent="save" @keydown.enter.ctrl.prevent="save" />
                <div class="flex items-center justify-between gap-2">
                    <span class="text-xs text-muted-foreground tabular-nums">{{ draft.length }}/{{ NOTE_MAX }}</span>
                    <div class="flex gap-2">
                        <Button variant="outline" class="cursor-pointer" @click="emit('update:open', false)">
                            {{ t('bulklookup.Cancel') }}
                        </Button>
                        <Button class="cursor-pointer" @click="save">{{ t('bulklookup.Save') }}</Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NOTE_MAX } from '@/composables/use-bulk-lookup.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PencilLine } from '@lucide/vue';

const props = defineProps({
    open: { type: Boolean, default: false },
    ip: { type: String, default: '' },
    note: { type: String, default: '' },
});
const emit = defineEmits(['update:open', 'save']);

const { t } = useI18n();

const draft = ref('');
// Each opening starts from the row's current note.
watch(() => props.open, (open) => {
    if (open) draft.value = props.note;
});

const save = () => {
    emit('save', props.ip, draft.value.trim());
    emit('update:open', false);
};
</script>

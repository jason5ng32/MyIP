<template>
  <!-- One-time sync choice: the shared controls (off by default; choose, then Save), and what never syncs.
       Any way out reports a choice: Save → `save`, everything else → `dismiss`. -->
  <Dialog :open="open" @update:open="(value) => !value && emit('dismiss')">
    <DialogContent :title="t('syncDialog.Title')" class="max-w-md">
      <DialogHeader :icon="RefreshCw" :title="t('syncDialog.Title')" />
      <p class="m-0 text-sm text-muted-foreground leading-relaxed">{{ t('syncDialog.Note') }}</p>

      <SyncChoiceControls v-model="choice" id-prefix="syncDialog" expanded class="mt-4" />

      <p class="mt-4 mb-0 text-sm font-medium leading-relaxed">{{ t('nav.preferences.syncNever') }}</p>

      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" @click="emit('dismiss')" class="cursor-pointer">{{ t('syncDialog.Later') }}</Button>
        <Button @click="emit('save', choice)" class="cursor-pointer">{{ t('syncDialog.Save') }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from '@lucide/vue';
import SyncChoiceControls from './SyncChoiceControls.vue';
import { defaultSyncChoice } from '@/utils/features/sync-settings.js';

defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['save', 'dismiss']);

const { t } = useI18n();

const choice = ref(defaultSyncChoice());
</script>

<template>
  <!-- The sync choice, in the Preferences switch-row style: an "Enable" row with its tip, and while it is on one
       indented switch row per collection. Emits the next choice (applySyncToggle); the caller decides when it is
       saved. -->
  <div class="rounded-lg border bg-card divide-y overflow-hidden">
    <div class="p-3 pb-2">
      <div class="flex items-center justify-between gap-3">
        <label :for="`${idPrefix}Master`" class="min-w-0 flex-1 text-sm font-medium select-none"
          :class="disabled ? 'opacity-50' : 'cursor-pointer'">{{ t('nav.preferences.syncEnable') }}</label>
        <Switch :id="`${idPrefix}Master`" class="shrink-0" :model-value="modelValue.master" :disabled="disabled"
          @update:model-value="(value) => toggle('master', value)" />
      </div>
      <p class="mt-1 text-xs text-muted-foreground leading-relaxed">{{ t('nav.preferences.syncTips') }}</p>
    </div>
    <template v-if="modelValue.master">
      <!-- Collections: indented and tinted, so they read as parts of the row above. -->
      <div v-for="option in SYNC_OPTIONS" :key="option.id"
        class="flex items-center justify-between gap-3 bg-muted/40 py-2.5 pr-3 pl-7">
        <label :for="`${idPrefix}_${option.id}`" class="min-w-0 flex-1 text-sm select-none"
          :class="disabled ? 'opacity-50' : 'cursor-pointer'">{{ t(option.label) }}</label>
        <Switch :id="`${idPrefix}_${option.id}`" class="shrink-0" :model-value="modelValue[option.id]"
          :disabled="disabled" @update:model-value="(value) => toggle(option.id, value)" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { applySyncToggle } from '@/utils/features/sync-settings.js';
import { Switch } from '@/components/ui/switch';

const props = defineProps({
  // `{ master, <collection id>: boolean }` (utils/features/sync-settings.js)
  modelValue: { type: Object, required: true },
  idPrefix: { type: String, default: 'sync' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const SYNC_OPTIONS = [
  { id: 'preferences', label: 'nav.preferences.syncPreferences' },
  { id: 'connectivity', label: 'nav.preferences.syncConnectivity' },
  { id: 'checklist', label: 'nav.preferences.syncChecklist' },
  { id: 'speedtest', label: 'nav.preferences.syncSpeedtest' },
];

const toggle = (field, value) => emit('update:modelValue', applySyncToggle(props.modelValue, field, value));
</script>

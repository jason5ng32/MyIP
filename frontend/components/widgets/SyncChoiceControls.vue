<template>
  <!-- The sync choice: an "Enable" switch with the collections as checkboxes nested under it, shown while it is
       on. Emits the next choice (applySyncToggle); the caller decides when it is saved. -->
  <div class="rounded-lg border bg-card">
    <div class="flex items-center justify-between gap-3 p-3">
      <label :for="`${idPrefix}Master`" class="min-w-0 flex-1 text-sm font-medium select-none"
        :class="disabled ? 'opacity-50' : 'cursor-pointer'">{{ t('nav.preferences.syncEnable') }}</label>
      <Switch :id="`${idPrefix}Master`" class="shrink-0" :model-value="modelValue.master" :disabled="disabled"
        @update:model-value="(value) => toggle('master', value)" />
    </div>
    <div v-if="modelValue.master" class="space-y-2 border-t px-3 py-3 pl-6">
      <label v-for="option in SYNC_OPTIONS" :key="option.id" class="flex items-center gap-2 text-sm select-none"
        :class="disabled ? 'opacity-50' : 'cursor-pointer'">
        <Checkbox :model-value="modelValue[option.id]" :disabled="disabled"
          @update:model-value="(value) => toggle(option.id, value === true)" :class="disabled ? '' : 'cursor-pointer'" />
        {{ t(option.label) }}
      </label>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { applySyncToggle } from '@/utils/features/sync-settings.js';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

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

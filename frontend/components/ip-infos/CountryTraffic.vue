<template>
  <!-- Dialog shell around CountryTrafficPanel — IPCard's hosting mode.
       QueryIP embeds the panel inline instead (it is already a Dialog). -->
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent :title="countryName" class="max-w-2xl">
      <DialogHeader>
        <template #title>
          <span class="flex items-center gap-2 min-w-0">
            <Icon v-if="countryCode" :icon="'circle-flags:' + countryCode.toLowerCase()" class="size-4 shrink-0" />
            <span class="truncate">{{ countryName }}</span>
          </span>
        </template>
      </DialogHeader>

      <CountryTrafficPanel :country-code="countryCode" :timezone="timezone" :is-dark-mode="isDarkMode" />
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Icon } from '@iconify/vue';
import CountryTrafficPanel from './CountryTrafficPanel.vue';

defineProps({
  open: { type: Boolean, required: true },
  countryCode: { type: String, default: '' },
  countryName: { type: String, default: '' },
  timezone: { type: String, default: '' },
  isDarkMode: { type: Boolean, required: true },
});

const emit = defineEmits(['update:open']);
</script>

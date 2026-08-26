<template>
  <!-- Dialog shell around LocationMapPanel — IPCard's hosting mode.
       QueryIP embeds the panel inline instead (it is already a Dialog). -->
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent :title="data.ip" class="max-w-2xl">
      <DialogHeader>
        <template #title>
          <span class="flex items-center gap-2 min-w-0">
            <Icon v-if="data.country_code" :icon="'circle-flags:' + data.country_code.toLowerCase()"
              class="size-4 shrink-0" />
            <span class="truncate">{{ data.country_name }}<template v-if="data.city"> · {{ data.city
                }}
              </template>
            </span>
          </span>
        </template>
      </DialogHeader>
      <LocationMapPanel :data="data" :is-dark-mode="isDarkMode" />
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Icon } from '@iconify/vue';
import LocationMapPanel from './LocationMapPanel.vue';

defineProps({
  open: { type: Boolean, required: true },
  // The IP payload — ip / country / city / coordinates / mapUrl(_dark).
  data: { type: Object, required: true },
  isDarkMode: { type: Boolean, required: true },
});

const emit = defineEmits(['update:open']);
</script>

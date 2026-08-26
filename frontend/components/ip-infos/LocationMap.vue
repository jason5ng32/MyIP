<template>
  <!-- Location map dialog: the IP's coordinates and static map image,
       opened from the map icon button beside the City field. -->
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
      <div class="mb-2">
        <span class="flex items-center gap-2 text-sm text-muted-foreground ">
          <Earth class="size-4" />
          <span class="text-sm text-muted-foreground">{{ t('ipInfos.Coordinates') }}</span>
        </span>
        <span class="font-mono shrink-0 truncate whitespace-nowrap">{{ data.longitude }}, {{ data.latitude
          }}</span>
      </div>
      <span>
        <img :src="isDarkMode ? data.mapUrl_dark : data.mapUrl"
          class="w-full rounded-md border bg-muted aspect-2/1 object-cover" alt="Map">
      </span>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Icon } from '@iconify/vue';
import { Earth } from '@lucide/vue';

const { t } = useI18n();

defineProps({
  open: { type: Boolean, required: true },
  // The IP payload — ip / country / city / coordinates / mapUrl(_dark).
  data: { type: Object, required: true },
  isDarkMode: { type: Boolean, required: true },
});

const emit = defineEmits(['update:open']);
</script>

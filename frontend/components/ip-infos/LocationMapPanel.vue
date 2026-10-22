<template>
  <!-- Location map panel: the IP's coordinates and static map image. Bare
       content — the LocationMap dialog shell and QueryIP's inline expansion
       both host it. -->
  <div class="mb-2">
    <span class="flex items-center gap-2 text-sm text-muted-foreground ">
      <Earth class="size-4" />
      <span class="text-sm text-muted-foreground">{{ t('ipInfos.Coordinates') }}</span>
    </span>
    <span class="font-mono shrink-0 truncate whitespace-nowrap">{{ data.longitude }}, {{ data.latitude
      }}</span>
  </div>
  <!-- No map URL (no coordinates, or the card is reloading): a same-sized
       muted box instead of a broken image. -->
  <span>
    <img v-if="mapSrc" :src="mapSrc"
      class="w-full rounded-md border bg-muted aspect-2/1 object-cover" alt="Map">
    <span v-else class="block w-full rounded-md border bg-muted aspect-2/1" aria-hidden="true"></span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Earth } from '@lucide/vue';

const { t } = useI18n();

const props = defineProps({
  // The IP payload — coordinates / mapUrl(_dark).
  data: { type: Object, required: true },
  isDarkMode: { type: Boolean, required: true },
});

const mapSrc = computed(() => (props.isDarkMode ? props.data.mapUrl_dark : props.data.mapUrl));
</script>

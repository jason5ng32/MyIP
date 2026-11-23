<!-- The IP section's inline data-source sentence: the source answering (the Preferences choice, or the one a fallback landed on), linking to its site. -->
<template>
  <i18n-t v-if="selectedSource" keypath="ipInfos.sourceFields.sentence" tag="span" scope="global">
    <template #source>
      <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener"
        class="underline underline-offset-2 hover:text-foreground">{{ selectedSource.text }}</a>
      <template v-else>{{ selectedSource.text }}</template>
    </template>
  </i18n-t>
</template>

<script setup>
import { computed } from 'vue';
import { useMainStore } from '@/store';

const store = useMainStore();

const props = defineProps({
  // Id of the source answering the IP cards (data/ip-databases.js).
  sourceId: { type: Number, default: null },
});

const selectedSource = computed(() => store.ipDBs.find((db) => db.id === props.sourceId) || null);
const sourceUrl = computed(() => selectedSource.value?.attribution?.url || '');
</script>

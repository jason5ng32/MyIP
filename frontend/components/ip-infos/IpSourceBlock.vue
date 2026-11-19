<!-- The IP section's inline data-source sentence: the source answering (the Preferences choice, or the one a fallback landed on), linking to its site, and a link to its picker in Preferences. -->
<template>
  <i18n-t v-if="selectedSource" keypath="ipInfos.sourceFields.sentence" tag="span" scope="global">
    <template #source>
      <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener"
        class="underline underline-offset-2 hover:text-foreground">{{ selectedSource.text }}</a>
      <template v-else>{{ selectedSource.text }}</template>
    </template>
    <template #preferences>
      <button type="button" @click="openSourcePicker"
        class="inline cursor-pointer p-0 align-baseline underline underline-offset-2 hover:text-foreground">{{ t('ipInfos.sourceFields.preferences') }}</button>
    </template>
  </i18n-t>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';

const { t } = useI18n();
const store = useMainStore();

const props = defineProps({
  // Id of the source answering the IP cards (data/ip-databases.js).
  sourceId: { type: Number, default: null },
});

const selectedSource = computed(() => store.ipDBs.find((db) => db.id === props.sourceId) || null);
const sourceUrl = computed(() => selectedSource.value?.attribution?.url || '');

// The source is a global preference: open Preferences at its picker.
const openSourcePicker = () => {
  trackEvent('IPCheck', 'SourceSwitchClick', 'Open Preferences');
  store.openPreferencesAt('Pref_ipGeoSource');
};
</script>

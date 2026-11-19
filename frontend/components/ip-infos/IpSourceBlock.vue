<!-- The IP section's inline data-source sentence: the source selected in Preferences, linking to its site, and a way to switch it. -->
<template>
  <i18n-t v-if="answeringSource" keypath="ipInfos.sourceFields.sentence" tag="span" scope="global">
    <template #source>
      <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener"
        class="underline underline-offset-2 hover:text-foreground">{{ answeringSource.text }}</a>
      <template v-else>{{ answeringSource.text }}</template>
    </template>
    <template #switch>
      <button type="button" @click="openSourcePicker"
        class="inline cursor-pointer p-0 align-baseline underline underline-offset-2 hover:text-foreground">{{ t('ipInfos.sourceFields.switch') }}</button>
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

// The selected source's row (data/ip-databases.js); the preference stays on an enabled one.
const answeringSource = computed(() => store.ipDBs.find((db) => db.id === store.userPreferences.ipGeoSource) || null);
const sourceUrl = computed(() => answeringSource.value?.attribution?.url || '');

// The source is a global preference: open Preferences at its picker.
const openSourcePicker = () => {
  trackEvent('IPCheck', 'SourceSwitchClick', 'Open Preferences');
  store.openPreferencesAt('Pref_ipGeoSource');
};
</script>

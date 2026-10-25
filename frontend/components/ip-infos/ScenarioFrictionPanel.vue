<!-- Scenario friction details: how it was estimated, then one row per scenario in the card
     dots' order, smoothest first (name + tone dot + verdict). Root blocks sit directly in the
     IpAdvancedBlock details frame, which spaces them like the score details and draws the border
     and the closing Persona Check line. -->
<template>
    <div>
        <p class="text-xs text-muted-foreground mb-1.5">{{ t('ipInfos.scenarioFriction.introTitle') }}</p>
        <p class="text-xs leading-relaxed text-muted-foreground">{{ t('ipInfos.scenarioFriction.intro') }}</p>
    </div>
    <p class="text-xs text-muted-foreground mb-1.5">{{ t('ipInfos.scenarioFriction.listTitle') }}</p>
    <div class="border-t pt-3">
        <dl class="grid grid-cols-1 gap-y-1.5 text-xs">
            <div v-for="s in sorted" :key="s.id" class="flex items-center justify-between gap-2 min-w-0">
                <dt class="text-muted-foreground min-w-0 wrap-break-word">
                    {{ t(scenarioNameKey(s, countryName), { country: countryName }) }}
                </dt>
                <dd class="shrink-0 flex items-center gap-1.5 text-foreground">
                    <span class="size-1.5 rounded-full" :class="dotClass(scenarioTone(s))" />
                    {{ t(verdictKey(s)) }}
                </dd>
            </div>
        </dl>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { scenarioNameKey, scenarioTone, sortByLevel, verdictKey } from '@/utils/features/scenario-friction.js';

const props = defineProps({
    scenarios: { type: Array, required: true },
    countryName: { type: String, default: '' },
});

const { t } = useI18n();
const { dotClass } = useStatusTone();

const sorted = computed(() => sortByLevel(props.scenarios));
</script>

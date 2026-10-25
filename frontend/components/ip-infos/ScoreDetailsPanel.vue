<!-- Quality-score details: the plain-language explanation (needs the `dimensions` block), then
     every attribute tag. Root blocks sit directly in the IpAdvancedBlock details frame, which
     spaces them like the friction details and draws the closing Blocklist Check line. -->
<template>
    <div v-if="explanation.length">
        <p class="text-xs text-muted-foreground mb-1.5">{{ t('ipInfos.scoreDetails.explainTitle') }}</p>
        <!-- One i18n template per sentence; slots keep the IP under the info-mask blur. -->
        <p class="text-xs leading-relaxed text-muted-foreground">
            <template v-for="(sentence, i) in explanation" :key="sentence.key">
                <I18nT :keypath="sentence.key" tag="span" scope="global">
                    <template #ip><span data-mask="ip" class="font-medium text-foreground">{{ sentence.params.ip }}</span></template>
                    <template #operator><span class="text-foreground">{{ sentence.params.operator }}</span></template>
                    <template #score><span class="font-medium text-foreground tabular-nums">{{ sentence.params.score }}</span></template>
                    <template #date>{{ sentence.params.date }}</template>
                </I18nT>{{ i === explanation.length - 1 ? '' : sentenceGap }}
            </template>
        </p>
    </div>

    <!-- All attributes: label + check / cross / question mark. -->
    <div v-if="tags.length" :class="explanation.length && 'border-t pt-3'">
        <p class="text-xs text-muted-foreground mb-1.5">{{ t('ipInfos.scoreDetails.tagsTitle') }}</p>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div v-for="tag in tags" :key="tag.key"
                class="flex items-center justify-between gap-2 min-w-0">
                <dt class="text-muted-foreground min-w-0 wrap-break-word">
                    {{ t('ipInfos.scoreDetails.tags.' + tag.key) }}
                </dt>
                <!-- One neutral tone for every state: a tag is a fact, not a verdict. -->
                <dd class="shrink-0 text-foreground">
                    <component :is="TAG_STATE_ICONS[tag.state]" class="size-3.5" aria-hidden="true" />
                    <span class="sr-only">{{ t('ipInfos.scoreDetails.tagState.' + tag.state) }}</span>
                </dd>
            </div>
        </dl>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n, I18nT } from 'vue-i18n';
import { Check, CircleQuestionMark, X } from '@lucide/vue';

defineProps({
    // buildScoreExplanation() sentences and listScoreTags() rows (utils/ip/ip-score-details.js).
    explanation: { type: Array, required: true },
    tags: { type: Array, required: true },
});

const { t, locale } = useI18n();

// Row state → icon; the question mark marks a suspected residential proxy.
const TAG_STATE_ICONS = { yes: Check, no: X, suspected: CircleQuestionMark };
// CJK sentences run together; others take a space.
const sentenceGap = computed(() => (/^(zh|ja|ko)/.test(locale.value) ? '' : ' '));
</script>

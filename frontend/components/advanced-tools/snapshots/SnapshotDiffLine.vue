<!-- Snapshots diff view: one field line — a gutter mark, the field label,
     the recorded value. `-` / `+` are the compared / viewed value of a
     changed field on the removed / added tint, its differing segments on the
     stronger tint (removed / added like any code diff, never worse / better); `±` is a measurement that differs, folded
     into one context line; a blank gutter is context. `line` null is the
     empty placeholder of a split side without this line. `plain` (nothing
     compared) shows values at full contrast. -->
<template>
    <div v-if="!line" class="h-full min-h-6 bg-muted/40" aria-hidden="true"></div>
    <div v-else class="grid h-full items-start font-mono text-[13px] leading-6"
        :class="[compact ? 'grid-cols-[1.25rem_minmax(0,6.5rem)_minmax(0,1fr)]' : 'grid-cols-[1.25rem_minmax(0,6.5rem)_minmax(0,1fr)] sm:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)]', TONES[line.mark]]">
        <!-- Gutter: the mark, never color alone -->
        <JnTooltip v-if="line.mark === '±'" :text="t('snapshots.DriftHint')" side="right">
            <span class="cursor-default select-none text-center text-muted-foreground/60" tabindex="0"
                :aria-label="t('snapshots.DriftHint')">±</span>
        </JnTooltip>
        <span v-else class="select-none text-center">
            <span aria-hidden="true">{{ GLYPHS[line.mark] }}</span><span v-if="gutterLabel" class="sr-only">{{ gutterLabel }}</span>
        </span>

        <span class="min-w-0 truncate pr-2" :class="line.mark === '-' || line.mark === '+' ? '' : 'text-muted-foreground'"
            >{{ fieldText }}</span>
        <span class="flex min-w-0 items-start gap-1.5 pr-2"
            :class="line.mark === ' ' || line.mark === '±' ? (plain ? 'text-foreground' : 'text-muted-foreground') : ''">
            <Icon v-if="flag" :icon="'circle-flags:' + flag" class="mt-1 size-4 shrink-0" />
            <span v-if="segments" class="min-w-0 wrap-break-word"><span v-for="(segment, index) in segments"
                    :key="index" :class="segment.changed ? STRONG[line.mark] : ''">{{ segment.text }}</span></span>
            <span v-else class="min-w-0 wrap-break-word">{{ valueText }}</span>
        </span>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { useSnapshotLabels } from '@/composables/use-snapshot-labels.js';
import { fieldFlag, inlineDiffSegments } from '@/utils/features/snapshot-diff-format.js';

const props = defineProps({
    line: { type: Object, default: null },
    plain: { type: Boolean, default: false },
    // Split columns: the narrow label column at every width.
    compact: { type: Boolean, default: false },
});

const TONES = {
    ' ': '',
    '±': '',
    '-': 'bg-diff-removed text-diff-removed-foreground',
    '+': 'bg-diff-added text-diff-added-foreground',
};
const STRONG = {
    '-': 'rounded-sm bg-diff-removed-strong',
    '+': 'rounded-sm bg-diff-added-strong',
};
const GLYPHS = { ' ': '', '-': '−', '+': '+' };

const { t } = useI18n();
const labels = useSnapshotLabels();

const fieldText = computed(() => `${labels.fieldLabel(props.line.field)}:`);
const valueText = computed(() => labels.fieldValue(props.line.field, props.line.value));
// −/+ only: the value split against the other side's, formatted alike.
const segments = computed(() => (STRONG[props.line.mark]
    ? inlineDiffSegments(valueText.value, labels.fieldValue(props.line.field, props.line.otherValue))
    : null));
const flag = computed(() => fieldFlag(props.line.field, props.line.value));
const gutterLabel = computed(() => {
    if (props.line.mark === '-') return t('snapshots.SideCompared');
    if (props.line.mark === '+') return t('snapshots.SideViewed');
    return undefined;
});
</script>

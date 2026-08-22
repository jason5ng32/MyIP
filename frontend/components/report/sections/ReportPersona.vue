<template>
    <div>
        <!-- Grade headline: target country, letter + score, how much was
             measured, then the graded conclusion in the tool's own words. -->
        <div class="px-4 py-3 border-b space-y-1.5">
            <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <span v-if="section.country" class="flex items-center gap-1.5">
                    <Icon :icon="'circle-flags:' + section.country.toLowerCase()" class="size-4 shrink-0" />
                    <span class="text-foreground">{{ countryName }}</span>
                </span>
                <span class="font-mono font-semibold" :class="textClass(gradeTone)">
                    {{ section.grade === 'unknown' ? '—' : section.grade }}
                    <span v-if="section.score !== null" class="ml-1 font-normal text-muted-foreground">
                        {{ section.score }}/100
                    </span>
                </span>
                <span class="text-muted-foreground">
                    {{ t('personacheck.dependencies.measured', {
                        n: section.counts.scored, total: section.counts.total }) }}
                </span>
            </div>
            <p class="text-xs m-0" :class="textClass(gradeTone)">
                {{ t(`personacheck.report.grade.${section.grade}`, { country: countryName }) }}
            </p>
        </div>

        <!-- Every check's conclusion. No detail values are stored in a report,
             so each row is its title, its axis and its verdict. -->
        <ul class="divide-y text-xs">
            <li v-for="result in section.results" :key="result.id"
                class="flex items-center justify-between gap-4 px-4 py-2">
                <span class="min-w-0">
                    {{ t(`personacheck.checks.${result.id}.title`) }}
                    <span class="ml-1.5 text-muted-foreground">
                        {{ t(`personacheck.axis.${result.axis}`) }}
                    </span>
                </span>
                <span class="shrink-0" :class="textClass(VERDICT_TONE[result.verdict])">
                    {{ t(`personacheck.report.state.${result.verdict}`) }}
                </span>
            </li>
        </ul>
    </div>
</template>

<script setup>
// Read-only renderer for the Persona Check report section: the grade against
// the declared country, then every check's verdict — reusing the tool's own
// i18n entries so the shared page speaks the reader's language, not the
// author's.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { useStatusTone } from '@/composables/use-status-tone.js';
import getCountryName from '@/data/country-name.js';

const props = defineProps({ section: { type: Object, required: true } });

const { t, locale } = useI18n();
const { textClass } = useStatusTone();

// Same tone mapping the live report uses.
const VERDICT_TONE = {
    match: 'ok-fast',
    mismatch: 'ok-slow',
    unnatural: 'ok-slow',
    leak: 'fail',
    unknown: 'wait',
    'not-applicable': 'wait',
};

const GRADE_TONE = { A: 'ok-fast', B: 'ok-fast', C: 'ok-slow', D: 'fail', unknown: 'wait' };

const gradeTone = computed(() => GRADE_TONE[props.section.grade] || 'wait');

const countryName = computed(() =>
    getCountryName(props.section.country, locale.value) || props.section.country);
</script>

<!--
  The graded answer to "does this look like a local of the chosen country".

  Score first, then every dimension in one list — passing ones included, each
  expandable. A check that passed still deserves an explanation of what it
  looked at, because "why am I fine here" is as much a part of understanding
  the result as "what do I fix".
-->

<template>
    <div class="divide-y">
        <!-- Score hero. The grade sits inside a ring that draws to the score,
             so the number is read spatially before it is read numerically;
             everything is toned by the grade, nothing else competes. -->
        <section class="space-y-4 p-4 md:p-6">
            <div class="flex flex-wrap items-center gap-5 md:gap-8">
                <!-- Grade dial: track + score arc, letter and score inside.
                     An ungraded run shows the bare track around a dash. -->
                <div class="relative size-28 shrink-0" role="img"
                    :aria-label="scoreOutOf100 !== null ? `${grade} · ${scoreOutOf100}/100` : ''">
                    <svg class="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="7"
                            class="text-muted" />
                        <circle v-if="scoreOutOf100 !== null" cx="50" cy="50" r="45" fill="none" stroke="currentColor"
                            stroke-width="7" stroke-linecap="round" :stroke-dasharray="RING_CIRCUMFERENCE"
                            :stroke-dashoffset="ringOffset"
                            :class="[textClass(gradeTone), 'transition-[stroke-dashoffset] duration-700 ease-out']" />
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-4xl font-bold leading-none tracking-tight" :class="textClass(gradeTone)">
                            {{ grade === 'unknown' ? '—' : grade }}
                        </span>
                        <span v-if="scoreOutOf100 !== null" class="mt-1 text-xs tabular-nums text-muted-foreground">
                            {{ scoreOutOf100 }}<span class="opacity-60">/100</span>
                        </span>
                    </div>
                </div>

                <div class="min-w-0 flex-1 space-y-1.5">
                    <!-- The verdict sentence — no flag here, just the
                         conclusion, in the same tone as the grade letter. -->
                    <p class="text-base md:text-lg font-semibold leading-snug m-0" :class="textClass(gradeTone)">
                        {{ t(`personacheck.report.grade.${grade}`, { country: countryName }) }}
                    </p>
                    <p class="text-sm leading-relaxed text-muted-foreground">
                        {{ t(`personacheck.report.gradeNote.${grade}`) }}
                    </p>
                </div>
            </div>

            <!-- How the checks fell, as proportions of everything measured —
                 the same tones as the legend beneath, so the bar needs no
                 labels of its own. -->
            <div class="space-y-2">
                <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div v-for="entry in counts" :key="entry.key" :class="dotClass(entry.tone)"
                        :style="{ width: `${entry.percent}%` }" />
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span v-for="entry in counts" :key="entry.key" class="flex items-center gap-1.5">
                        <span class="size-2 rounded-full" :class="dotClass(entry.tone)" />
                        {{ t(`personacheck.report.counts.${entry.key}`, { n: entry.n }) }}
                    </span>
                </div>
            </div>

            <p v-if="nothingActionable" class="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
                {{ t('personacheck.report.nothingActionable') }}
            </p>
        </section>

        <!-- Every dimension, each its own bordered box — same shape the MTR
             tool uses for its per-probe results. -->
        <section class="space-y-3 p-4 md:p-6">
            <div class="space-y-1 flex justify-between items-center">
                <h3 class="text-base font-semibold tracking-tight m-0">
                    {{ t('personacheck.report.profileTitle') }}
                </h3>
                <Badge variant="secondary" class="font-normal">
                    {{ t('personacheck.dependencies.measured', {
                    n: measured.scored, total: measured.total }) }}
                </Badge>
            </div>
            <Accordion type="single" collapsible class="space-y-2">
                <AccordionItem v-for="row in rows" :key="row.id" :value="row.id"
                    class="rounded-lg border bg-card px-4 data-[state=open]:border-primary/30">
                    <AccordionTrigger class="hover:no-underline cursor-pointer my-1">
                        <div class="flex min-w-0 flex-1 items-center gap-2 pr-2 text-left">
                            <component :is="VERDICT_ICON[row.verdict]" class="size-4 shrink-0"
                                :class="textClass(VERDICT_TONE[row.verdict])" />
                            <span class="truncate text-sm" :class="row.actionable ? 'font-semibold' : ''"
                                :title="row.known ? t(`personacheck.checks.${row.id}.title`) : row.id">
                                {{ row.known ? t(`personacheck.checks.${row.id}.title`) : row.id }}
                            </span>
                            <span class="ml-auto shrink-0 text-xs" :class="textClass(VERDICT_TONE[row.verdict])">
                                {{ t(`personacheck.report.state.${row.verdict}`) }}
                            </span>
                        </div>
                    </AccordionTrigger>

                    <AccordionContent class="space-y-3 pb-4">
                        <!-- Which of the three questions this row answers. -->
                        <Badge v-if="row.axis" variant="outline" class="font-normal">
                            {{ t(`personacheck.axis.${row.axis}`) }}
                        </Badge>

                        <!-- What this dimension looks at — shown for every row,
                             passing ones included. -->
                        <p v-if="row.known" class="text-sm text-muted-foreground">
                            {{ t(`personacheck.checks.${row.id}.what`) }}
                        </p>

                        <p class="text-sm" :class="textClass(VERDICT_TONE[row.verdict])">
                            <template v-if="row.reasonKey">
                                {{ t(row.reasonKey) }} ·
                            </template>
                            {{ t(`personacheck.report.verdict.${row.verdict}`) }}
                        </p>

                        <dl v-if="scalarDetail(row.detail).length"
                            class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div v-for="item in scalarDetail(row.detail)" :key="item.key"
                                class="flex items-center gap-2 min-w-0">
                                <dt class="shrink-0 text-muted-foreground">
                                    {{ t(`personacheck.detail.${item.key}`) }}
                                </dt>
                                <dd class="min-w-0">
                                    <!-- title carries the full value of the
                                         truncated line. -->
                                    <Badge variant="secondary" class="max-w-full font-normal shadow-none"
                                        :class="item.kind === 'mono' ? 'font-mono' : ''" :title="item.text">
                                        <Icon v-if="item.kind === 'country'"
                                            :icon="'circle-flags:' + item.code.toLowerCase()"
                                            class="mr-1 size-3.5 shrink-0" />
                                        <span class="truncate">{{ item.text }}</span>
                                    </Badge>
                                </dd>
                            </div>
                        </dl>

                        <!-- WebRTC's shaped payload is the evidence itself -->
                        <ul v-if="row.detail?.exposed?.length" class="rounded-lg border bg-muted/40 divide-y text-sm">
                            <!-- Keyed by position, not by address: the evaluator
                                 dedupes, but an older one repeating the same
                                 address must not collide here. -->
                            <li v-for="(entry, index) in row.detail.exposed" :key="index"
                                class="flex items-center justify-between gap-2 px-3 py-1.5">
                                <span class="font-mono truncate" :title="entry.ip">{{ entry.ip }}</span>
                                <span v-if="entry.countryCode"
                                    class="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                                    <Icon :icon="'circle-flags:' + entry.countryCode.toLowerCase()" class="size-4" />
                                    {{ getCountryName(entry.countryCode, locale) || entry.countryCode }}
                                </span>
                            </li>
                        </ul>

                        <!-- Who reads this, and what to do — only where there
                             is something to do. -->
                        <template v-if="row.actionable && row.known">
                            <p v-if="row.visibility" class="flex items-start gap-2 text-sm text-muted-foreground">
                                <Eye class="size-4 mt-0.5 shrink-0" />
                                <span>{{ t(`personacheck.report.visibility.${row.visibility}`) }}</span>
                            </p>
                            <div class="rounded-lg border border-info/30 bg-info/10 p-3 space-y-1">
                                <p class="flex items-center gap-1.5 text-sm font-medium">
                                    <Wrench class="size-4" />
                                    {{ t('personacheck.report.howToFix') }}
                                </p>
                                <p class="text-sm leading-relaxed">
                                    {{ t(`personacheck.checks.${row.id}.fix`) }}
                                </p>
                            </div>
                        </template>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </section>
    </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStatusTone } from '@/composables/use-status-tone.js';
import {
    VERDICT, GRADE, AXIS, VISIBILITY, PERSONA_CHECK_IDS, PERSONA_UNKNOWN_REASONS,
} from '@/utils/persona/check-ids.js';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Icon } from '@iconify/vue';
import getCountryName from '@/data/country-name.js';
import { ShieldAlert, ShieldCheck, TriangleAlert, CircleHelp, CircleX, CircleSlash, Eye, Wrench } from '@lucide/vue';

const props = defineProps({
    report: { type: Object, required: true },
    profile: { type: Object, required: true },
    persona: { type: Object, required: true },
});

const { t, locale } = useI18n();
const { textClass, dotClass } = useStatusTone();

// Business state → the project's four shared tones. Mismatch and unnatural
// share 'ok-slow' on purpose: both are warnings, and their difference is
// carried by the label rather than by inventing a fifth colour.
const VERDICT_TONE = {
    [VERDICT.MATCH]: 'ok-fast',
    [VERDICT.MISMATCH]: 'ok-slow',
    [VERDICT.UNNATURAL]: 'ok-slow',
    [VERDICT.LEAK]: 'fail',
    [VERDICT.UNKNOWN]: 'wait',
    [VERDICT.NOT_APPLICABLE]: 'wait',
};

const GRADE_TONE = {
    [GRADE.A]: 'ok-fast', [GRADE.B]: 'ok-fast', [GRADE.C]: 'ok-slow',
    [GRADE.D]: 'fail', [GRADE.UNKNOWN]: 'wait',
};

const VERDICT_ICON = {
    [VERDICT.MATCH]: ShieldCheck,
    [VERDICT.MISMATCH]: CircleX,
    [VERDICT.UNNATURAL]: TriangleAlert,
    [VERDICT.LEAK]: ShieldAlert,
    [VERDICT.UNKNOWN]: CircleHelp,
    [VERDICT.NOT_APPLICABLE]: CircleSlash,
};

// A grade this build has no copy for reads as ungraded — the dial then shows
// its bare track, which is honest about "we cannot say" either way.
const KNOWN_GRADES = new Set(Object.values(GRADE));
const grade = computed(() =>
    (KNOWN_GRADES.has(props.report.grade) ? props.report.grade : GRADE.UNKNOWN));

const gradeTone = computed(() => GRADE_TONE[grade.value] || 'wait');

// The graded sentence names the country ("you look like a local of X") — the
// localized display name, same source as everywhere else in the app.
const countryName = computed(() =>
    getCountryName(props.persona.country, locale.value) || props.persona.country);

// Out of 100 rather than a percentage: a score compares against other runs,
// where a percentage reads like a proportion of something.
// Grade dial geometry. The arc starts empty and transitions to the score;
// the watch covers re-runs that replace the report without a remount.
const RING_CIRCUMFERENCE = 2 * Math.PI * 45;
const ringProgress = ref(0);
const ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - ringProgress.value));
// A score is a 0..1 fraction, or null when the run was too thin to grade.
// Anything else (absent, NaN) reads as ungraded rather than as 0.
const score = computed(() =>
    (Number.isFinite(props.report.score) ? props.report.score : null));

const syncRing = () => { ringProgress.value = score.value ?? 0; };
onMounted(() => requestAnimationFrame(syncRing));
watch(score, syncRing);

const scoreOutOf100 = computed(() =>
    (score.value === null ? null : Math.round(score.value * 100)));

const isActionable = (verdict) =>
    [VERDICT.LEAK, VERDICT.UNNATURAL, VERDICT.MISMATCH].includes(verdict);

// One list, already ordered by "fix this first" upstream.
// Which no-answer reasons get their own line. Not-applicable rows always
// explain themselves; unknown rows only for the reasons whose fix is in the
// visitor's hands (a mistyped card prefix vs our lookup being down).
const RENDERED_UNKNOWN_REASONS = new Set(PERSONA_UNKNOWN_REASONS);

const reasonKey = (result) => {
    const reason = result.detail?.reason;
    if (!reason) return '';
    if (result.verdict === VERDICT.NOT_APPLICABLE) return `personacheck.reason.${reason}`;
    if (result.verdict === VERDICT.UNKNOWN && RENDERED_UNKNOWN_REASONS.has(reason)) {
        return `personacheck.reason.${reason}`;
    }
    return '';
};

// The evaluator can ship a check before this front end ships its copy, so a
// row's id / verdict / axis are treated as claims rather than as facts: an
// unrecognized one degrades to something renderable instead of a raw
// translation key. The row still appears — it counted toward the score, and
// dropping it would leave the numbers unexplained.
const KNOWN_CHECK_IDS = new Set(PERSONA_CHECK_IDS);
const KNOWN_VERDICTS = new Set(Object.values(VERDICT));
const KNOWN_AXES = new Set(Object.values(AXIS));
const KNOWN_VISIBILITIES = new Set(Object.values(VISIBILITY));

const rows = computed(() => (Array.isArray(props.report.results) ? props.report.results : [])
    .map((result) => {
        const verdict = KNOWN_VERDICTS.has(result?.verdict) ? result.verdict : VERDICT.UNKNOWN;
        return {
            ...result,
            verdict,
            // '' hides the chip / line rather than printing an untranslated one.
            axis: KNOWN_AXES.has(result?.axis) ? result.axis : '',
            visibility: KNOWN_VISIBILITIES.has(result?.visibility) ? result.visibility : '',
            known: KNOWN_CHECK_IDS.has(result?.id),
            actionable: isActionable(verdict),
            reasonKey: reasonKey({ ...result, verdict }),
        };
    }));

const safeCount = (value) => (Number.isFinite(value) ? value : 0);

const counts = computed(() => {
    const raw = props.report.counts ?? {};
    const entries = [
        { key: 'leak', tone: 'fail', n: safeCount(raw.leak) },
        { key: 'warning', tone: 'ok-slow', n: safeCount(raw.mismatch) + safeCount(raw.unnatural) },
        { key: 'match', tone: 'ok-fast', n: safeCount(raw.match) },
        { key: 'unknown', tone: 'wait', n: safeCount(raw.unknown) },
        { key: 'notApplicable', tone: 'wait', n: safeCount(raw.notApplicable) },
    ].filter((entry) => entry.n > 0);
    // The bar divides by the total, so it is taken from the entries rather
    // than from a `total` that could arrive as 0 or absent.
    const total = entries.reduce((sum, entry) => sum + entry.n, 0);
    return entries.map((entry) => ({ ...entry, percent: total ? (entry.n / total) * 100 : 0 }));
});

// Headline counters, each safe to render on their own.
const measured = computed(() => {
    const raw = props.report.counts ?? {};
    return { scored: safeCount(raw.scored), total: safeCount(raw.total) };
});

const nothingActionable = computed(() => {
    const raw = props.report.counts ?? {};
    return !safeCount(raw.leak) && !safeCount(raw.mismatch) && !safeCount(raw.unnatural);
});

// --- value rendering --------------------------------------------------------
// Raw values are the checks' own vocabulary, not the visitor's. A country code,
// an enum slug and a bare `true` all need translating before they mean
// anything on screen.

// Fields whose value is an ISO country code. The guard below also requires the
// value to look like one, so a field that carries a timezone or a format
// sample here (timezone-vs-persona's `expected`, for instance) falls through
// to plain text on its own.
const COUNTRY_FIELDS = new Set(['expected', 'actual', 'v4', 'v6']);

// The IP type enum already has copy elsewhere in the app — reuse it rather
// than translating "hosting" a second time.
const IP_TYPE_KEYS = {
    residential: 'Residential', wireless: 'Wireless',
    business: 'Business', hosting: 'Hosting',
};

const isCountryCode = (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value);

// Intl's hour-cycle enums (h11/h12/h23/h24) are opaque to anyone who has not
// read the spec — spell them out. Value-shaped like the country-code guard:
// nothing else a detail field carries looks like these four tokens.
const isHourCycle = (value) => typeof value === 'string' && /^h(11|12|23|24)$/.test(value);

// { kind, ... } so the template can pick a Badge shape per kind. `detail` is
// the whole detail object, for fields that annotate a sibling value.
const renderValue = (key, value, detail) => {
    if (typeof value === 'boolean') {
        return { kind: 'text', text: t(value ? 'personacheck.value.yes' : 'personacheck.value.no') };
    }
    if (key === 'ipType') {
        const suffix = IP_TYPE_KEYS[String(value).toLowerCase()];
        return {
            kind: 'text',
            text: suffix ? t(`ipInfos.advancedData.type.${suffix}`) : t('ipInfos.advancedData.type.unknownType'),
        };
    }
    if (isHourCycle(value)) {
        return { kind: 'text', text: t(`personacheck.hourCycle.${value}`) };
    }
    if (COUNTRY_FIELDS.has(key) && isCountryCode(value)) {
        const name = getCountryName(value, locale.value);
        if (name) {
            // The consensus share rides on the value itself ("US · 4/6").
            const share = key === 'actual' && detail?.agreement ? ` · ${detail.agreement}` : '';
            return { kind: 'country', code: value, text: name + share };
        }
    }
    return { kind: 'mono', text: String(value) };
};

// Only scalars render generically; shaped fields are summarized by the copy.
// `agreement` is skipped here because it renders inside `actual` (above).
const scalarDetail = (detail) => Object.entries(detail || {})
    .filter(([key, value]) => key !== 'reason' && key !== 'agreement'
        && ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ({ key, ...renderValue(key, value, detail) }));
</script>

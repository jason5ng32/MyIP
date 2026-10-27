<!-- Advanced block (IPCheck.ing source only): locked CTA + `***` preview when gated, otherwise the
     label-value grid with the single-select score / friction details frame under it. One of
     IpDetailPanel's root siblings; its own root carries the collapsed / source gates. -->
<template>
    <div v-if="!collapsed" v-show="showAdvancedBlock" class="px-4 pb-3 border-t pt-3 space-y-2.5">

        <!-- Gated: single CTA banner + 4-field preview grid with *** values.
             Signed-out shows the sign-in copy; over-quota shows the monthly
             quota copy + sponsor link instead. -->
        <template v-if="allAdvancedLocked || allAdvancedQuotaExceeded">
            <span
                class="w-full flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 text-muted-foreground transition-colors group">
                <span class="flex items-center gap-1.5 min-w-0">
                    <component :is="allAdvancedQuotaExceeded ? Hourglass : Lock" class="size-3.5 shrink-0" />
                    <span class="truncate">
                        {{ allAdvancedQuotaExceeded ? t('ipInfos.advancedQuotaCta') : t('ipInfos.advancedUnlockCta') }}
                    </span>
                </span>
                <!-- Opens the Benefits & Usage dialog (usage tab for signed-in
                     users) — the sponsor path lives there, not a direct jump. -->
                <button v-if="allAdvancedQuotaExceeded" type="button"
                    class="shrink-0 underline underline-offset-2 hover:text-foreground cursor-pointer"
                    @click="openUsageDialog">
                    {{ t('user.ViewUsage') }}
                </button>
            </span>

            <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 text-sm items-start">
                <div v-for="f in lockedFieldList" :key="f.key">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <component :is="f.icon" class="size-3.5" />
                        <span>{{ f.label }}</span>
                    </dt>
                    <dd class="font-normal text-muted-foreground/60">***</dd>
                </div>
            </dl>
        </template>

        <!-- Signed-in: same vertical "label on top, value below" rhythm as the metadata grid,
             plus the collapsible score / friction details panel under it (one child for space-y). -->
        <div v-else>
            <dl class="grid grid-cols-2 md:grid-cols-2 gap-x-3 gap-y-3 text-sm items-start">
                <div v-if="showTypeBadge">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <SignalHigh class="size-3.5" />
                        <span>{{ t('ipInfos.type') }}</span>
                    </dt>
                    <dd class="font-normal wrap-break-word">{{ data.type }}</dd>
                </div>

                <div v-if="showAnonymityBadge">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <ShieldCheck class="size-3.5" />
                        <span>{{ t('ipInfos.anonymity.label') }}</span>
                    </dt>
                    <dd class="font-normal wrap-break-word">
                        {{ data.anonymity }}
                    </dd>
                    <!-- Anonymizing service, when the API named one. -->
                    <dd v-if="anonymityService" class="font-normal wrap-break-word">
                        <span class="text-muted-foreground font-normal text-xs">{{ anonymityService }}</span>
                    </dd>
                </div>

                <div v-if="showNativeBadge">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <House class="size-3.5" />
                        <span>{{ t('ipInfos.advancedData.Nativeness') }}</span>
                        <JnTooltip :text="t('ipInfos.advancedData.nativenessTooltip')" side="top" class="hidden md:block">
                            <CircleQuestionMark class="size-3 cursor-help opacity-70" />
                        </JnTooltip>
                    </dt>
                    <dd class="font-normal flex items-center gap-1 wrap-break-word">
                        <component :is="data.isNativeIP === true ? Equal : EqualNot" class="size-3.5 shrink-0" />
                        <span>{{ data.isNativeIP === true ? t('ipInfos.advancedData.NativeIPYes') :
                            t('ipInfos.advancedData.NativeIPNo') }}</span>
                    </dd>
                </div>

                <div v-if="showQualityScore">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Gauge class="size-3.5" />
                        <span>{{ t('ipInfos.qualityScore') }}</span>
                    </dt>
                    <dd class="flex items-center gap-2">
                        <span v-if="data.qualityScore === 'unknown'" class="font-normal text-muted-foreground">
                            {{ t('ipInfos.qualityScoreUnknown') }}
                        </span>
                        <template v-else>
                            <Progress :model-value="Number(data.qualityScore) || 0" class="h-2 flex-1 min-w-12"
                                :indicator-class="qualityTone === 'ok-fast' ? 'bg-success' : qualityTone === 'ok-slow' ? 'bg-warning' : 'bg-destructive'" />
                            <span class="text-sm font-normal tabular-nums shrink-0">{{ data.qualityScore }}/100</span>
                        </template>
                        <!-- Score-details toggle -->
                        <JnTooltip v-if="hasScoreDetails" :text="t('ipInfos.scoreDetails.toggle')" side="top">
                            <Button variant="ghost" size="icon"
                                :class="['size-6 -my-1 shrink-0 cursor-pointer', isDetailActive('score') && 'bg-muted text-foreground hover:bg-muted']"
                                @click="toggleDetail('score')" :aria-expanded="isDetailActive('score')"
                                :aria-label="t('ipInfos.scoreDetails.toggle')">
                                <ChevronDown class="size-3.5 transition-transform duration-200"
                                    :class="isDetailActive('score') && 'rotate-180'" />
                            </Button>
                        </JnTooltip>
                    </dd>
                </div>

                <div v-if="abuseLevel">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Flag class="size-3.5" />
                        <span>{{ t('ipInfos.abuseLevel.label') }}</span>
                    </dt>
                    <dd class="font-normal wrap-break-word">{{ t('ipInfos.abuseLevel.' + abuseLevel) }}</dd>
                </div>

                <!-- Scenario friction: one tone dot per scenario, low → high (deliberately not a score
                     bar); hidden when the answer carries no scenarios. -->
                <div v-if="hasFriction">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Compass class="size-3.5" />
                        <span>{{ t('ipInfos.scenarioFriction.label') }}</span>
                    </dt>
                    <!-- min-h-5 matches the quality-score row's text line. Dots + chevron form one
                         left-aligned group: 8px dots at a 4px gap (10 → 116px) that close up rather
                         than overflow a narrow cell; free space trails, like the text cells. -->
                    <dd class="flex min-h-5 items-center gap-2">
                        <div role="img" :aria-label="frictionBreakdown" :title="frictionBreakdown"
                            class="flex min-w-0 flex-nowrap items-center justify-between"
                            :style="{ width: `${frictionDotList.length * 12 - 4}px` }">
                            <span v-for="dot in frictionDotList" :key="dot.id"
                                class="size-2 shrink-0 rounded-full" :class="dotClass(dot.tone)" />
                        </div>
                        <JnTooltip :text="t('ipInfos.scenarioFriction.toggle')" side="top">
                            <Button variant="ghost" size="icon"
                                :class="['size-6 -my-1 shrink-0 cursor-pointer', isDetailActive('friction') && 'bg-muted text-foreground hover:bg-muted']"
                                @click="toggleDetail('friction')" :aria-expanded="isDetailActive('friction')"
                                :aria-label="t('ipInfos.scenarioFriction.toggle')">
                                <ChevronDown class="size-3.5 transition-transform duration-200"
                                    :class="isDetailActive('friction') && 'rotate-180'" />
                            </Button>
                        </JnTooltip>
                    </dd>
                </div>
            </dl>

            <!-- Details frame, one at a time. Score: plain-language explanation (needs the
                 `dimensions` block), then every attribute tag. Friction: the scenario list. -->
            <Collapsible :open="isDetailOpen" @update:open="isDetailOpen = $event">
                <CollapsibleContent>
                    <div class="pt-3">
                        <div class="rounded-md border bg-muted/40 p-3 space-y-3">
                            <template v-if="openDetail === 'score'">
                                <ScoreDetailsPanel :explanation="scoreExplanation" :tags="scoreTagRows" />

                                <!-- Point to a blocklist check of this IP. -->
                                <p v-if="blocklistHref"
                                    class="border-t pt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
                                    <span>{{ t('ipInfos.scoreDetails.blocklistHint') }}</span>
                                    <a :href="blocklistHref" @click="openBlocklist"
                                        class="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-2 hover:underline">
                                        {{ t('ipInfos.scoreDetails.blocklistLink') }}<ArrowRight class="size-3" />
                                    </a>
                                </p>
                            </template>

                            <template v-else-if="openDetail === 'friction' && hasFriction">
                                <ScenarioFrictionPanel :scenarios="data.frictionScenarios"
                                    :country-name="data.country_name || ''" />

                                <!-- Point to a Persona Check of this browser. -->
                                <p v-if="personacheckHref"
                                    class="border-t pt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-muted-foreground">
                                    <span>{{ t('ipInfos.scenarioFriction.personaHint') }}</span>
                                    <a :href="personacheckHref" @click="openPersonacheck"
                                        class="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-2 hover:underline">
                                        {{ t('ipInfos.scenarioFriction.personaLink') }}<ArrowRight class="size-3" />
                                    </a>
                                </p>
                            </template>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { trackEvent } from '@/utils/analytics';
import { formatIsoDate } from '@/utils/time-utils.js';
import { buildScoreExplanation, listScoreTags } from '@/utils/ip/ip-score-details.js';
import { isToolAvailable } from '@/utils/tool-availability.js';
import { TOOL_BY_SLUG } from '@/data/tools.js';
import { isPlainClick } from '@/utils/nav-target.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { frictionDots, frictionShares } from '@/utils/features/scenario-friction.js';
import ScenarioFrictionPanel from './ScenarioFrictionPanel.vue';
import ScoreDetailsPanel from './ScoreDetailsPanel.vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    ArrowRight,
    ChevronDown,
    CircleQuestionMark,
    Compass,
    Equal,
    EqualNot,
    Flag,
    Gauge,
    Hourglass,
    House,
    Lock,
    ShieldCheck,
    SignalHigh,
} from '@lucide/vue';

const { t, locale } = useI18n();
const store = useMainStore();

const props = defineProps({
    data: { type: Object, required: true },
    ipGeoSource: { type: Number, required: true },
    configs: { type: Object, required: true },
    collapsed: { type: Boolean, default: false },
});

// Re-emitted by IpDetailPanel to its consumer (see there).
const emit = defineEmits(['view-usage', 'open-tool']);

const openUsageDialog = () => {
    emit('view-usage');
    store.setTriggerUserBenefits(true);
};

// Advanced block only surfaces for the IPCheck.ing source (ipGeoSource === 0).
const showAdvancedBlock = computed(() => props.ipGeoSource === 0 && Boolean(props.data));

// Backend gating sentinels for the advanced fields (see transform-ip-data.js).
const isGatedValue = (value) => value === 'sign_in_required' || value === 'quota_exceeded';

// If every advanced field is masked → show the single CTA + preview grid instead
// of rendering four individual gated rows. The two sentinels pick different copy.
const allAdvancedLocked = computed(() =>
    props.data.type === 'sign_in_required' &&
    props.data.anonymity === 'sign_in_required' &&
    props.data.isNativeIP === 'sign_in_required' &&
    props.data.qualityScore === 'sign_in_required'
);
const allAdvancedQuotaExceeded = computed(() =>
    props.data.type === 'quota_exceeded' &&
    props.data.anonymity === 'quota_exceeded' &&
    props.data.isNativeIP === 'quota_exceeded' &&
    props.data.qualityScore === 'quota_exceeded'
);

const showTypeBadge = computed(() =>
    props.data.type && !isGatedValue(props.data.type)
    && props.data.type !== t('ipInfos.advancedData.type.unknownType')
);
const showAnonymityBadge = computed(() =>
    Boolean(props.data.anonymity) && !isGatedValue(props.data.anonymity)
);
// "Provider · protocol"; both are null unless the API named a service.
const anonymityService = computed(() =>
    [props.data.anonymityProvider, props.data.anonymityProtocol].filter(Boolean).join(' · ')
);
const showNativeBadge = computed(() =>
    props.data.isNativeIP !== undefined && !isGatedValue(props.data.isNativeIP)
);
const showQualityScore = computed(() =>
    props.data.qualityScore !== undefined && !isGatedValue(props.data.qualityScore)
);

// Locked field preview: the 4 advanced fields shown as "label + ***" for signed-out users.
const lockedFieldList = computed(() => [
    { key: 'type', icon: SignalHigh, label: t('ipInfos.type') },
    { key: 'anonymity', icon: ShieldCheck, label: t('ipInfos.anonymity.label') },
    { key: 'native', icon: House, label: t('ipInfos.advancedData.Nativeness') },
    { key: 'quality', icon: Gauge, label: t('ipInfos.qualityScore') },
]);

// Quality Score color tiers — reuse the same 4-tone semantic as use-status-tone.
const qualityTone = computed(() => {
    const n = Number(props.data.qualityScore);
    if (isNaN(n)) return 'wait';
    if (n >= 80) return 'ok-fast';
    if (n >= 50) return 'ok-slow';
    return 'fail';
});

// Score-details panel (IPCheck.ing source): explanation sentences (need
// `dimensions`) and attribute rows. Both are empty for gated data, and the
// toggle only shows when either has content.
const scoreExplanation = computed(() => buildScoreExplanation(props.data, {
    t,
    formatDate: (day) => formatIsoDate(day, locale.value),
}));
const scoreTagRows = computed(() => listScoreTags(props.data.scoreTags));
const hasScoreDetails = computed(() =>
    showAdvancedBlock.value && (scoreExplanation.value.length > 0 || scoreTagRows.value.length > 0)
);

// Abuse level from the v3 reputation dimension (`ipInfos.abuseLevel.*`); anything else hides the cell.
const ABUSE_LEVELS = ['none', 'low', 'medium', 'high'];
const abuseLevel = computed(() => {
    const level = props.data.scoreDimensions?.reputation?.level;
    return ABUSE_LEVELS.includes(level) ? level : '';
});

// Scenario friction: normalized scenarios (transform-ip-data.js), one dot each.
const { dotClass } = useStatusTone();
const hasFriction = computed(() =>
    Array.isArray(props.data.frictionScenarios) && props.data.frictionScenarios.length > 0
);
const frictionList = computed(() => (hasFriction.value ? props.data.frictionScenarios : []));
const frictionCounts = computed(() => frictionShares(frictionList.value));
const frictionDotList = computed(() => frictionDots(frictionList.value));
const frictionBreakdown = computed(() => t('ipInfos.scenarioFriction.breakdown', {
    smooth: frictionCounts.value.smooth,
    checks: frictionCounts.value.checks,
    restricted: frictionCounts.value.restricted,
}));

// Single-select details frame ('score' | 'friction'). Content is kept separate
// from the open state, so the close animation keeps its content.
const openDetail = ref(null);
const isDetailOpen = ref(false);
const isDetailActive = (name) => isDetailOpen.value && openDetail.value === name;
const toggleDetail = (name) => {
    if (isDetailActive(name)) {
        isDetailOpen.value = false;
        return;
    }
    if (name === 'score') trackEvent('IPCheck', 'ScoreDetailsClick', 'Show Score Details');
    else trackEvent('IPCheck', 'ScenarioFrictionClick', 'Show Scenario Friction');
    openDetail.value = name;
    isDetailOpen.value = true;
};
// A different IP starts collapsed.
watch(() => props.data.ip, () => { isDetailOpen.value = false; });
// A refresh without scenarios closes their frame instead of leaving it empty.
watch(hasFriction, (has) => { if (!has && openDetail.value === 'friction') isDetailOpen.value = false; });

// Blocklist Check entry: hidden when the tool is gated off; `q` only prefills.
const router = useRouter();
const blocklistHref = computed(() => (
    isToolAvailable(TOOL_BY_SLUG.get('blocklist'), props.configs) && props.data.ip
        ? `/tools/blocklist?q=${encodeURIComponent(props.data.ip)}`
        : ''
));
const openBlocklist = (e) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    trackEvent('IPCheck', 'BlocklistCTAClick', 'Open Blocklist Check');
    emit('open-tool');
    router.push({ path: '/tools/blocklist', query: { q: props.data.ip } });
};

// Persona Check invitation closing the friction details: dropped when the tool is gated off.
const personacheckHref = computed(() => (
    isToolAvailable(TOOL_BY_SLUG.get('personacheck'), props.configs) ? '/tools/personacheck' : ''
));
const openPersonacheck = (e) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    trackEvent('IPCheck', 'PersonaCheckCTAClick', 'Open Persona Check');
    emit('open-tool');
    router.push({ path: '/tools/personacheck' });
};
</script>

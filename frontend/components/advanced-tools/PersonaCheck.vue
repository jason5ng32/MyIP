<!--
  Persona Check — does this browser look like it belongs to someone who
  actually lives in a given country?

  The rail is one intake flow, three numbered zones: declare the expected
  identity, optionally sharpen it (GPS, card prefix), then run — the run
  requires every base test to have run, not to have found something. Sign-in
  gated like the other quota-metered tools; signed out, the rail is
  display-only.
-->

<template>
    <div class="persona-check-section my-4 space-y-4">
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('personacheck.Note') }}</p>
            <p>{{ t('personacheck.NoteVs') }}</p>
            <p>{{ t('personacheck.Note2') }}</p>
        </div>

        <!-- Setup rail (left) + result (right), the layout the latency and MTR
             tools use. Status lines that change during a run (GPS, card) keep
             reserved slots so nothing jumps mid-flow; one-time hints (country
             error, language note) render only when they apply. -->
        <Card>
            <CardContent class="p-0">
                <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    <!-- Left: the intake rail. Signed out, everything below is
                         display-only — the hint at the top is the one thing to
                         act on. -->
                    <div class="col-span-1 px-4 py-4 space-y-5">
                        <!-- Sign-in first: shown before the zones so the rail
                             reads as "do this, then the rest unlocks". -->
                        <div v-if="!signedIn"
                            class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
                            <Info class="size-4 mt-0.5 shrink-0" />
                            <span>{{ t('user.SignInToUse') }}</span>
                        </div>

                        <!-- Zone 1 — the identity the visitor expects to show -->
                        <div class="space-y-4">
                            <h4 class="flex items-center gap-2 text-sm font-semibold tracking-tight m-0 mb-3">
                                <span
                                    class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">1</span>
                                {{ t('personacheck.zone.expected') }}
                            </h4>

                            <div class="space-y-1.5">
                                <p class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <Globe class="size-4 text-muted-foreground" />
                                    {{ t('personacheck.step.country') }}
                                </p>
                                <CountryPicker v-model="country" :disabled="!signedIn"
                                    :placeholder="t('personacheck.selectCountry')" />
                                <!-- Only rendered for the rare territory with
                                     no profile (BV, HM) — a reserved slot here
                                     would be permanent blank space. -->
                                <p v-if="country && !hasProfile" class="text-xs leading-4 text-destructive">
                                    {{ t('personacheck.noProfile') }}
                                </p>
                            </div>

                            <!-- Language: a Select even when there is only one
                                 option, so the rail keeps the same height for
                                 every country; the line below says why the
                                 picker is (or is not) offering a choice. -->
                            <div class="space-y-1.5">
                                <p class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <Languages class="size-4 text-muted-foreground" />
                                    {{ t('personacheck.step.language') }}
                                </p>
                                <Select v-model="primaryLanguage"
                                    :disabled="!signedIn || !profile || profile.languages.length < 2">
                                    <SelectTrigger>
                                        <SelectValue :placeholder="t('personacheck.step.awaitingCountry')" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="entry in profile?.languages ?? []" :key="entry.tag"
                                            :value="entry.tag">
                                            {{ entry.tag }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p v-if="profile" class="text-xs leading-4 text-muted-foreground">
                                    {{ profile.languages.length > 1
                                    ? t('personacheck.languageMulti')
                                    : t('personacheck.languageSingle') }}
                                </p>
                            </div>

                            <!-- Time zone: only multi-zone countries offer a
                                 choice, titled like the other steps. -->
                            <div v-if="profile && profile.timeZones.length > 1" class="space-y-1.5">
                                <p class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <Clock class="size-4 text-muted-foreground" />
                                    {{ t('personacheck.profile.timezone') }}
                                </p>
                                <Select v-model="timeZone" :disabled="!signedIn">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="zone in profile.timeZones" :key="zone" :value="zone">
                                            {{ zone }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p class="text-xs leading-4 text-muted-foreground">
                                    {{ t('personacheck.timezoneMulti') }}
                                </p>
                            </div>
                        </div>

                        <!-- Zone 2 — optional inputs, both settled before
                             the run so no permission prompt lands mid-report. -->
                        <div class="space-y-4 border-t pt-4">
                            <h4 class="flex items-center gap-2 text-sm font-semibold tracking-tight m-0 mb-3">
                                <span
                                    class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">2</span>
                                {{ t('personacheck.zone.optional') }}
                            </h4>

                            <div class="space-y-1.5">
                                <p class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <MapPin class="size-4 text-muted-foreground" />
                                    {{ t('personacheck.step.location') }}
                                </p>
                                <p class="text-xs leading-4 text-muted-foreground">
                                    {{ t('personacheck.optional.gpsNote') }}
                                </p>
                                <Button variant="outline" size="sm" class="w-full cursor-pointer"
                                    :disabled="!signedIn || locating" @click="requestLocation">
                                    <Spinner v-if="locating" />
                                    <MapPin v-else class="size-4" />
                                    {{ t('personacheck.optional.gpsButton') }}
                                </Button>
                                <!-- Fixed-height status line: reserved whether
                                     or not a result has arrived. -->
                                <p class="min-h-4 text-xs leading-4"
                                    :class="geolocation?.available ? 'text-success' : 'text-muted-foreground'">
                                    <span v-if="geolocation">
                                        {{ geolocation.available
                                        ? t('personacheck.optional.gpsGranted')
                                        : t(`personacheck.optional.gpsFailed.${geolocation.reason}`) }}
                                    </span>
                                </p>
                            </div>

                            <div class="space-y-1.5">
                                <p class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <CreditCard class="size-4 text-muted-foreground" />
                                    {{ t('personacheck.step.card') }}
                                </p>
                                <p class="text-xs leading-4 text-muted-foreground">
                                    {{ t('personacheck.optional.cardNote') }}
                                </p>
                                <!-- One box per digit, so the 6-8 expectation
                                     is visible before anything is typed; the
                                     digits-only pattern rejects letters. -->
                                <InputOTP v-model="cardBin" :maxlength="BIN_MAX_LENGTH" :pattern="REGEXP_ONLY_DIGITS"
                                    :disabled="!signedIn" autocomplete="off" class="w-full gap-1">
                                    <InputOTPGroup class="w-full">
                                        <InputOTPSlot v-for="slot in BIN_MAX_LENGTH" :key="slot" :index="slot - 1"
                                            class="h-9 flex-1 min-w-0" />
                                    </InputOTPGroup>
                                </InputOTP>
                                <!-- The same reserved line carries "long
                                     enough" and the too-short error. -->
                                <p class="min-h-4 text-xs leading-4"
                                    :class="binReady ? 'text-success' : 'text-destructive'">
                                    <span v-if="binReady">{{ t('personacheck.optional.cardReady') }}</span>
                                    <span v-else-if="binError">{{ t('personacheck.optional.cardError') }}</span>
                                </p>
                            </div>
                        </div>

                        <!-- Zone 3 — run. Base tests are required input: one
                             that hasn't run disables the run, repaired in one
                             click. A test that ran and found nothing counts —
                             the checks reading it report as not applicable. -->
                        <div class="space-y-4 border-t pt-4">
                            <h4 class="flex items-center gap-2 text-sm font-semibold tracking-tight m-0 mb-3">
                                <span
                                    class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">3</span>
                                {{ t('personacheck.zone.run') }}
                            </h4>

                            <div class="space-y-1.5">
                                <p class="text-xs leading-4 text-muted-foreground">
                                    {{ t('personacheck.dependencies.note') }}
                                </p>
                                <ul class="space-y-1 text-xs">
                                    <li v-for="row in dependencyRows" :key="row.id" class="flex items-center gap-1.5">
                                        <CircleCheck v-if="row.ready" class="size-3.5 shrink-0 text-success" />
                                        <span v-else
                                            class="size-3.5 shrink-0 rounded-full border border-current opacity-40" />
                                        <span :class="row.ready
                                            ? 'text-muted-foreground line-through'
                                            : 'text-muted-foreground'">
                                            {{ t(`personacheck.source.${row.id}`) }}
                                        </span>
                                    </li>
                                </ul>
                                <Button v-if="missingSources.length || runningDependencies" variant="outline" size="sm"
                                    class="w-full cursor-pointer" :disabled="!signedIn || runningDependencies"
                                    @click="runDependencies">
                                    <Spinner v-if="runningDependencies" />
                                    <RefreshCw v-else class="size-4" />
                                    {{ runningDependencies
                                    ? t('personacheck.dependencies.runButtonRunning')
                                    : t('personacheck.dependencies.runButton') }}
                                </Button>
                                <p v-else class="flex items-center gap-1.5 text-xs text-success">
                                    <CircleCheck class="size-3.5 shrink-0" />
                                    {{ t('personacheck.dependencies.allReady') }}
                                </p>
                            </div>

                            <div class="space-y-2">
                                <Button variant="action" class="w-full cursor-pointer"
                                    :disabled="!canRun || runStatus === 'running'" @click="run">
                                    <Spinner v-if="runStatus === 'running'" />
                                    <Play v-else class="size-4" />
                                    {{ t('personacheck.runCompare') }}
                                </Button>

                                <p v-if="errorKey" class="text-xs text-destructive">{{ t(errorKey) }}</p>

                                <!-- Monthly quota exhausted: not an error —
                                     explain + the usage / sponsor path. -->
                                <div v-if="quotaExceeded"
                                    class="flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-sm text-warning">
                                    <Hourglass class="size-4 mt-0.5 shrink-0" />
                                    <span>
                                        {{ t('user.QuotaExceeded') }}
                                        <button type="button" class="underline underline-offset-2 cursor-pointer"
                                            @click="openUsageDialog">{{ t('user.ViewUsage') }}</button>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: dependencies before the run, report after.
                         No padding here — the report's own sections carry it,
                         so the rule between them reaches both edges. -->
                    <div class="col-span-3">
                        <!-- h-full so the hint centres in the whole column, not
                             in a 16rem strip pinned to the top of it. -->
                        <div v-if="!report"
                            class="flex h-full min-h-64 items-center justify-center p-4 text-center md:p-6">
                            <p class="max-w-sm text-sm text-muted-foreground">
                                {{ country ? t('personacheck.readyHint') : t('personacheck.emptyHint') }}
                            </p>
                        </div>

                        <PersonaReport v-else :report="report" :profile="profile" :persona="persona" />
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { REGEXP_ONLY_DIGITS } from 'vue-input-otp';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events.js';
import { dispatchAppCommand, waitForAppCommand } from '@/utils/app-commands.js';
import { authenticatedFetch, fetchErrorLabel } from '@/utils/authenticated-fetch';
import { buildObservation, usePersonaSnapshots } from '@/composables/use-persona-collector.js';
import { localProfile } from '@/utils/persona/local-profile.js';
import { probeGeolocation } from '@/utils/persona/probe-geolocation.js';
import { isValidBin, BIN_MAX_LENGTH } from '@/utils/persona/card-bin.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CircleCheck, Clock, CreditCard, Globe, Hourglass, Info, Languages, MapPin, Play, RefreshCw } from '@lucide/vue';
import CountryPicker from '@/components/widgets/CountryPicker.vue';
import PersonaReport from '@/components/advanced-tools/PersonaReport.vue';

const { t } = useI18n();
const store = useMainStore();
const route = useRoute();
const router = useRouter();
const { snapshots, missingSources } = usePersonaSnapshots();

// Sign-in gates the whole rail, not just the run button: every run spends
// quota, so a signed-out visitor gets a display-only preview and one hint.
const signedIn = computed(() => Boolean(store.user));

// --- zone 1: the expected identity ------------------------------------------

const country = ref('');
const timeZone = ref('');
const primaryLanguage = ref('');

// Languages and timezones to choose from come from Intl, right here: picking a
// country is instant and costs no request. The server is asked exactly once,
// when the visitor presses run.
const profile = computed(() => (country.value ? localProfile(country.value) : null));

// A country with no zone at all is a real case (uninhabited territories) and
// the only reason the picker can come up empty.
const hasProfile = computed(() => Boolean(profile.value?.timeZones.length));

watch(profile, (next) => {
    timeZone.value = next?.timeZones[0] || '';
    primaryLanguage.value = next?.languages[0]?.tag || '';
});

// What the visitor declares, and nothing more: country, time zone, and which
// of the country's languages they want to be read as — everything else is
// derived where the check runs. The visitor's language pick leads the list.
const persona = computed(() => {
    const all = (profile.value?.languages ?? []).map((entry) => entry.tag);
    const ordered = primaryLanguage.value
        ? [primaryLanguage.value, ...all.filter((tag) => tag !== primaryLanguage.value)]
        : all;
    return {
        country: country.value,
        timeZone: timeZone.value,
        languages: ordered,
    };
});

// --- zone 2: optional sharpeners --------------------------------------------

const geolocation = ref(null);
const locating = ref(false);

// Only the issuer prefix, never a card number: exactly BIN_MAX_LENGTH boxes,
// so the cap is visible rather than enforced silently.
const cardBin = ref('');
// The issuing country is resolved during the run, not while typing — these
// only say whether what has been typed is long enough to look one up.
const binReady = computed(() => isValidBin(cardBin.value));
const binError = computed(() => cardBin.value.length > 0 && !binReady.value);

const requestLocation = async () => {
    locating.value = true;
    try {
        geolocation.value = await probeGeolocation();
    } finally {
        locating.value = false;
    }
};

// --- zone 3: base tests + run -----------------------------------------------
// The IP, WebRTC and DNS tests belong to the homepage components. Rather than
// running second copies here, the tool requires their snapshots before the
// run — a thorough check must not silently skip a whole dimension — and the
// repair is one click on the sequence that owns them. Having run is the whole
// requirement: a browser that blocks WebRTC, or a network that resolves no
// IP, still leaves a snapshot, and the evaluator reports the checks that read
// it as not applicable rather than passed.

const dependencyRows = computed(() => ['ipinfo', 'webrtc', 'dnsleak']
    .map((id) => ({ id, ready: Boolean(snapshots[id]) })));

// The repair click dispatches only the tests that never ran, through the
// command bus; each dispatch resolves when its test reports. The button holds
// its running state until every dispatch settles; the per-command timeout
// hands it back if a test never reports at all.
const DEPENDENCY_RUN_TIMEOUT = 60 * 1000;
const runningDependencies = ref(false);

// missing source id → its owner's command (all payload-free here: these
// tests never ran, so nothing needs the refresh/reset variants).
const DEPENDENCY_COMMANDS = {
    ipinfo: 'ipinfo:refresh',
    webrtc: 'webrtc:run',
    dnsleak: 'dnsleak:run',
};

const runDependencies = async () => {
    if (runningDependencies.value) return;
    const missing = missingSources.value;
    if (!missing.length) return;
    runningDependencies.value = true;
    try {
        // Off the homepage, the owners aren't mounted yet — navigate first,
        // then wait for each command to be registered before dispatching.
        if (route.name !== 'home') await router.push('/');
        await Promise.allSettled(missing.map(async (source) => {
            const command = DEPENDENCY_COMMANDS[source];
            await waitForAppCommand(command, { timeoutMs: DEPENDENCY_RUN_TIMEOUT });
            await dispatchAppCommand(command, {}, { timeoutMs: DEPENDENCY_RUN_TIMEOUT });
        }));
    } finally {
        runningDependencies.value = false;
    }
};

const report = ref(null);
const runStatus = ref('idle');
// Which line renders under the run button; a locale key so it translates live.
const errorKey = ref('');
const quotaExceeded = ref(false);

// Every gate in one place: signed in, a scoreable country, and every base
// test run — the run button is the rail's own summary of the three zones.
const canRun = computed(() =>
    signedIn.value && hasProfile.value && !missingSources.value.length);

const openUsageDialog = () => {
    if (route.query.tool) router.push({ path: '/', query: {} });
    store.setTriggerUserBenefits(true);
};

const run = async () => {
    // Pre-flight gate, same as the other quota-metered tools: when the local
    // snapshot already says the month is spent, every run would 429.
    if (store.quotaExceeded.persona_check) {
        quotaExceeded.value = true;
        return;
    }
    trackEvent('Section', 'StartClick', 'PersonaCheck');
    runStatus.value = 'running';
    errorKey.value = '';
    quotaExceeded.value = false;
    try {
        const observation = await buildObservation({
            geolocation: geolocation.value,
            cardBin: binReady.value ? cardBin.value : '',
        });
        report.value = await authenticatedFetch('/api/persona/evaluate', 'POST',
            { persona: persona.value, observation });
        runStatus.value = 'finished';
        // The shareable report keeps only each check's conclusion — the
        // builder in utils/report-builders.js drops every detail field.
        emitAppEvent('persona:finished', {
            country: persona.value.country,
            grade: report.value.grade,
            score: report.value.score,
            counts: report.value.counts,
            results: report.value.results,
        });
    } catch (error) {
        runStatus.value = 'idle';
        // 429 passed through by the backend: monthly quota exhausted —
        // retrying can't fix it, show the quota hint (with the sponsor path).
        if (error.status === 429) {
            quotaExceeded.value = true;
            store.markQuotaExhausted('persona_check');
            return;
        }
        // 401/403: the visitor's sign-in state is the problem, not the tool.
        if (error.status === 401 || error.status === 403) {
            errorKey.value = error.message?.includes('Invalid token')
                ? 'user.InvalidUserToken'
                : 'user.SignInToUse';
            return;
        }
        // An unreachable evaluator leaves the tool on its error line rather
        // than an empty report. Status in the first argument so Sentry
        // fingerprints an edge-blocked 4xx apart from a 5xx.
        console.error(`Error running persona checks: ${fetchErrorLabel(error)}`, error);
        errorKey.value = 'personacheck.runError';
    }
};

// Any change to the target invalidates a report scored against the old one.
watch([country, timeZone, primaryLanguage, cardBin, geolocation], () => {
    if (runStatus.value === 'finished') { report.value = null; runStatus.value = 'idle'; }
});
</script>

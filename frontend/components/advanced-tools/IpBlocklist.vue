<template>
    <div class="ip-blocklist-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('ipblocklist.Note') }}</p>
            <p>{{ t('ipblocklist.Note2') }}</p>
        </div>

        <!-- Input area -->
        <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <Label :for="manualMode ? 'blocklistIPManual' : 'blocklistIP'" class="font-medium">
                    {{ manualMode ? t('ipblocklist.EnterIPLabel') : t('ipblocklist.SelectIPLabel') }}
                </Label>
                <div v-if="allIPs.length" class="flex items-center gap-2 shrink-0">
                    <Switch id="blocklistUseStored" v-model="useStored" :disabled="isRunning" />
                    <Label for="blocklistUseStored" class="font-normal text-muted-foreground cursor-pointer">
                        {{ t('ipblocklist.UseStored') }}
                    </Label>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Select v-if="!manualMode" v-model="selectedIP" :disabled="isRunning">
                    <SelectTrigger id="blocklistIP" aria-label="Select IP to check" class="flex-1 min-w-0">
                        <SelectValue :placeholder="t('ipblocklist.SelectIP')" class="truncate font-mono" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="item in allIPs" :key="item.ip" :value="item.ip">
                            <span class="flex items-center gap-1 min-w-0">
                                <Icon v-if="item.country" :icon="'circle-flags:' + item.country.toLowerCase()"
                                    class="size-3.5 md:size-4 shrink-0" />
                                <span class="font-mono truncate text-xs md:text-sm">{{ item.ip }}</span>
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
                <Input v-else id="blocklistIPManual" v-model="manualIP" class="flex-1 font-mono"
                    :placeholder="t('ipblocklist.EnterIPPlaceholder')" :disabled="isRunning"
                    :aria-invalid="inputInvalid" autocomplete="off"
                    autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
                    @keyup.enter="runCheck" />
                <Button variant="action" class="cursor-pointer" :disabled="!canRun" @click="runCheck"
                    aria-label="Run blocklist check">
                    <Spinner v-if="isRunning" />
                    <Play v-else class="size-4 shrink-0" />
                </Button>
            </div>
            <p v-if="inputInvalid" class="text-sm text-destructive">{{ t('ipblocklist.InvalidIP') }}</p>

            <!-- Login hint -->
            <div v-if="!store.user"
                class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
                <Info class="size-4 mt-0.5 shrink-0" />
                <span>{{ t('user.SignInToUse') }}</span>
            </div>

            <!-- Running: a cold DNSBL pass can take a while -->
            <p v-if="isRunning" class="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner class="size-4" />{{ t('ipblocklist.Checking') }}
            </p>

            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

            <!-- Monthly quota exhausted: not an error — explain + usage / sponsor path -->
            <div v-if="quotaExceeded"
                class="flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-sm text-warning">
                <Hourglass class="size-4 mt-0.5 shrink-0" />
                <span>
                    {{ t('user.QuotaExceeded') }}
                    <button type="button" class="underline underline-offset-2 cursor-pointer"
                        @click="store.setTriggerUserBenefits(true)">{{ t('user.ViewUsage') }}</button>
                </span>
            </div>
        </div>

        <!-- Result -->
        <template v-if="result">
            <!-- Summary: IP, verdict, four counts -->
            <Card>
                <CardContent class="p-4 md:p-6 space-y-4">
                    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span class="font-mono font-semibold text-lg break-all">{{ result.ip }}</span>
                        <span class="text-xs text-muted-foreground">
                            {{ t('ipblocklist.CheckedAt', { time: isoToDateTime(result.checkedAt, lang) }) }}
                        </span>
                    </div>
                    <div class="flex items-start gap-2 text-sm font-medium" :class="TONE_TEXT[verdict]">
                        <component :is="TONE_ICON[verdict]" class="size-4 mt-0.5 shrink-0" />
                        <span>{{ t(`ipblocklist.verdict.${verdict}`) }}</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div v-for="tile in tiles" :key="tile.key" class="rounded-md bg-muted/50 px-3 py-2">
                            <div class="text-xs text-muted-foreground">{{ t(`ipblocklist.count.${tile.key}`) }}</div>
                            <div class="text-2xl font-semibold tabular-nums"
                                :class="tile.value > 0 ? TONE_TEXT[tile.key] : 'text-muted-foreground'">
                                {{ tile.value }}
                            </div>
                        </div>
                    </div>
                    <p v-if="result.summary?.error > 0" class="text-xs text-muted-foreground">
                        {{ t('ipblocklist.SomeFailed', { n: result.summary.error }) }}
                    </p>
                </CardContent>
            </Card>

            <!-- One card per part: hits open, the rest folded -->
            <Card v-for="part in parts" :key="part.id">
                <CardContent class="p-0">
                    <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 border-b">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold m-0">
                                <component :is="part.icon" class="size-4 text-muted-foreground shrink-0" />
                                {{ t(`ipblocklist.part.${part.id}.title`) }}
                            </h3>
                            <p class="text-xs text-muted-foreground mt-0.5 mb-0">
                                {{ t(`ipblocklist.part.${part.id}.desc`) }}
                            </p>
                        </div>
                        <span class="text-xs text-muted-foreground tabular-nums">
                            {{ partCounts(part.summary) }}
                        </span>
                    </header>

                    <!-- Hits -->
                    <ul v-if="part.hits.length" class="divide-y list-none p-0 m-0">
                        <li v-for="item in part.hits" :key="item.id" class="flex items-start gap-3 px-4 py-3">
                            <component :is="TONE_ICON[itemTone(item)]" class="size-4 mt-0.5 shrink-0"
                                :class="TONE_TEXT[itemTone(item)]" />
                            <div class="flex-1 min-w-0 space-y-1.5">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-sm font-medium">{{ item.name }}</span>
                                    <Badge variant="outline" class="font-normal text-muted-foreground">
                                        {{ categoryLabel(item.category) }}
                                    </Badge>
                                </div>
                                <div v-if="item.reasons.length" class="flex flex-wrap gap-1.5">
                                    <span v-for="reason in item.reasons" :key="reason"
                                        class="rounded-md px-2 py-0.5 text-xs" :class="TONE_CHIP[itemTone(item)]">
                                        {{ reasonLabel(reason) }}
                                    </span>
                                </div>
                                <p v-if="item.lastSeen" class="text-xs text-muted-foreground m-0">
                                    {{ t('ipblocklist.LastSeen', { date: formatIsoDate(item.lastSeen, lang) }) }}
                                </p>
                            </div>
                            <a v-if="item.removalUrl && item.status === 'listed'" :href="item.removalUrl"
                                target="_blank" rel="noopener"
                                class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">
                                {{ t('ipblocklist.RequestRemoval') }}
                                <ExternalLink class="size-3" />
                            </a>
                        </li>
                    </ul>
                    <p v-else class="px-4 py-3 text-sm text-muted-foreground m-0">
                        {{ t('ipblocklist.NoHits') }}
                    </p>

                    <!-- Everything else, folded -->
                    <Collapsible v-if="part.rest.length" v-model:open="openRest[part.id]">
                        <CollapsibleTrigger as-child>
                            <button type="button"
                                class="flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground cursor-pointer">
                                <ChevronDown class="size-4 transition-transform duration-200"
                                    :class="{ 'rotate-180': openRest[part.id] }" />
                                {{ openRest[part.id] ? t('ipblocklist.HideRest') : t('ipblocklist.ShowRest', { n: part.rest.length }) }}
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 list-none m-0 px-4 py-3 border-t">
                                <li v-for="item in part.rest" :key="item.id"
                                    class="flex items-center gap-2 min-w-0 text-sm">
                                    <component :is="TONE_ICON[itemTone(item)]" class="size-4 shrink-0"
                                        :class="TONE_TEXT[itemTone(item)]" />
                                    <span class="truncate" :class="{ 'text-muted-foreground': item.status !== 'clean' }"
                                        :title="item.name">{{ item.name }}</span>
                                    <span v-if="item.status === 'error'" class="shrink-0 text-xs text-muted-foreground">
                                        {{ t('ipblocklist.CheckFailed') }}
                                    </span>
                                </li>
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>
                </CardContent>
            </Card>

            <!-- Legend: what each mark means, for every row above -->
            <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 list-none m-0 p-0 text-xs text-muted-foreground">
                <li v-for="tone in LEGEND" :key="tone" class="flex items-start gap-1.5">
                    <component :is="TONE_ICON[tone]" class="size-3.5 mt-px shrink-0" :class="TONE_TEXT[tone]" />
                    <span>
                        <span class="font-medium text-foreground">{{ t(`ipblocklist.legend.${tone}.label`) }}</span>
                        {{ t(`ipblocklist.legend.${tone}.desc`) }}
                    </span>
                </li>
            </ul>
        </template>
    </div>
</template>

<script setup>
// IP Blocklist Check: which blocklists an IP is on — live DNSBLs and static
// threat lists — via /api/ipblocklist (the private API's /iphitlist; signed-in
// users, original site only). Verdict / row split live in
// utils/features/ip-blocklist.js.
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { isoToDateTime, formatIsoDate } from '@/utils/time-utils.js';
import { blocklistVerdict, listedCounts, splitPart, itemTone, reasonMessage } from '@/utils/features/ip-blocklist.js';
import { selectableIPs, classifyTarget } from '@/composables/use-globalping-measurement';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Icon } from '@iconify/vue';
import {
    ChevronDown, CircleAlert, CircleCheck, CircleHelp, CircleX, ExternalLink, Hourglass, Info, ListChecks, Play, Radar,
} from '@lucide/vue';

const { t, te } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);

// The backend waits up to 30s on the upstream; give it room to answer first.
const CLIENT_TIMEOUT_MS = 35000;

// Tone → classes / icons, one circled-icon family for every row and the
// verdict: abuse ✕, anonymity !, notice i, clean ✓, error ?.
const TONE_TEXT = {
    abuse: 'text-destructive', anonymity: 'text-warning', notice: 'text-info', clean: 'text-success', error: 'text-muted-foreground',
};
const TONE_CHIP = { abuse: 'bg-destructive/10 text-destructive', anonymity: 'bg-warning/10 text-warning', notice: 'bg-info/10 text-info' };
const TONE_ICON = { abuse: CircleX, anonymity: CircleAlert, notice: Info, clean: CircleCheck, error: CircleHelp };
const LEGEND = ['abuse', 'anonymity', 'notice', 'clean', 'error'];

// ── Input ────────────────────────────────────────────────────────────────
// Manual entry is forced when no IPs are stored (the homepage never ran);
// otherwise the switch (on by default) picks between dropdown and typing.
const allIPs = computed(() => selectableIPs(store.allIPs));
const useStored = ref(true);
const manualMode = computed(() => allIPs.value.length === 0 || !useStored.value);
const selectedIP = ref('');
const manualIP = ref('');
// The typed IP is validated on submit, not while typing (like Whois): the
// button only needs something entered, and a rejected value flags the input
// until the next run.
const inputInvalid = ref(false);
const targetIP = computed(() => (manualMode.value ? manualIP.value.trim() : selectedIP.value));

const status = ref('idle'); // 'idle' | 'running'
const isRunning = computed(() => status.value === 'running');
const canRun = computed(() => !isRunning.value && !!store.user && !!targetIP.value);

// ── Result ───────────────────────────────────────────────────────────────
const result = ref(null);
const errorMsg = ref('');
const quotaExceeded = ref(false);
const openRest = ref({});

const verdict = computed(() => blocklistVerdict(result.value?.summary));
const tiles = computed(() => {
    const s = result.value?.summary ?? {};
    const listed = listedCounts(s);
    return [
        { key: 'abuse', value: listed.abuse },
        { key: 'anonymity', value: listed.anonymity },
        { key: 'notice', value: s.notice ?? 0 },
        { key: 'clean', value: s.clean ?? 0 },
    ];
});
const parts = computed(() => [
    { id: 'dnsbl', icon: Radar },
    { id: 'static', icon: ListChecks },
]
    .filter(({ id }) => result.value?.[id])
    .map((p) => ({ ...p, summary: result.value[p.id].summary, ...splitPart(result.value[p.id]) })));

// "2 abuse · 1 anonymity · 41 clean" — non-zero counts only.
const partCounts = (s) => [
    ['abuse', listedCounts(s).abuse],
    ['anonymity', listedCounts(s).anonymity],
    ['notice', s?.notice],
    ['clean', s?.clean],
    ['error', s?.error],
]
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${t(`ipblocklist.count.${key}`)} ${n}`)
    .join(' · ');

// Unknown keys (added upstream before a translation lands) show as-is.
const reasonLabel = (reason) => {
    const { key, params } = reasonMessage(reason);
    return te(key) ? t(key, params) : reason;
};
const categoryLabel = (category) => {
    const key = `ipblocklist.category.${category}`;
    return te(key) ? t(key) : category;
};

// ── Run ──────────────────────────────────────────────────────────────────
const runCheck = async () => {
    if (!canRun.value) return;
    // Public IPv4 / IPv6 only ('invalid' / 'unreachable' = not an IP / not public).
    inputInvalid.value = manualMode.value && classifyTarget(targetIP.value) !== 'ok';
    if (inputInvalid.value) return;
    // Frontend first line: the quota snapshot already says the month is used
    // up. The backend enforces the same limit (429) as the real guard.
    if (store.quotaExceeded.ip_hitlist) {
        quotaExceeded.value = true;
        return;
    }
    status.value = 'running';
    errorMsg.value = '';
    quotaExceeded.value = false;
    result.value = null;
    openRest.value = {};
    trackEvent('Section', 'StartClick', 'IpBlocklist');
    try {
        const ip = encodeURIComponent(targetIP.value);
        result.value = await authenticatedFetch(`/api/ipblocklist?ip=${ip}`, 'GET', null, CLIENT_TIMEOUT_MS);
    } catch (error) {
        // 429: monthly quota exhausted — show the quota hint, not an error.
        if (error.status === 429) {
            quotaExceeded.value = true;
            store.markQuotaExhausted('ip_hitlist');
            return;
        }
        console.error('IP blocklist check failed:', error);
        // 401/403: the visitor's sign-in state, not a failure to retry.
        if (error.status === 401 || error.status === 403) {
            errorMsg.value = error.message.includes('Invalid token') ? t('user.InvalidUserToken') : t('user.SignInToUse');
        } else {
            errorMsg.value = t('ipblocklist.FetchError');
        }
    } finally {
        status.value = 'idle';
    }
};
</script>

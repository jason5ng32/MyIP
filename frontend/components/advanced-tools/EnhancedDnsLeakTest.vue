<template>
    <!-- Enhanced DNS leak test. Sign-in gated (like InvisibilityTest) — the
        NS capture side keeps logs per session, so we want authenticated
        users only. -->
    <div class="enhanced-dns-leak-section my-4 space-y-4">
        <!-- Intro -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('enhanceddnsleaktest.Note') }}</p>
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('enhanceddnsleaktest.Note2') }}</p>
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('enhanceddnsleaktest.Note3') }}</p>

        <!-- Run button -->
        <Button variant="action" :disabled="isBusy || !store.user" @click="runTest" class="cursor-pointer">
            <Spinner v-if="isBusy" />
            <template v-else>
                <Play class="size-4 shrink-0" />
            </template>
            <span class="ml-1.5">{{ runLabel }}</span>
        </Button>

        <!-- Sign-in hint (same style as InvisibilityTest for consistency) -->
        <div v-if="!store.user"
            class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
            <Info class="size-4 mt-0.5 shrink-0" />
            <span>{{ t('user.SignInToUse') }}</span>
        </div>

        <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

        <!-- Flow progress: status dot + stage text + percent, then the bar. -->
        <Card v-if="showFlow">
            <CardContent class="px-4 py-6 space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <p class="text-sm m-0 flex items-start gap-2 min-w-0 flex-1">
                        <span class="relative flex shrink-0 mt-1.5">
                            <span v-if="isBusy"
                                class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
                            <span class="relative inline-flex size-2 rounded-full"
                                :class="isBusy ? 'bg-info' : 'bg-success'"></span>
                        </span>
                        <span class="min-w-0 wrap-break-word">{{ stageText }}</span>
                    </p>
                    <span class="shrink-0 text-xs text-muted-foreground font-mono tabular-nums pt-0.5">
                        {{ progressValue }}%
                    </span>
                </div>
                <Progress :model-value="progressValue" class="h-2" :indicator-class="indicatorBarClass" />
            </CardContent>
        </Card>

        <!-- Summary stat row, visible after the first fetch -->
        <div v-if="hasResult" class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card>
                <CardContent class="p-4">
                    <p class="text-xs text-muted-foreground mb-1">
                        {{ t('enhanceddnsleaktest.Summary.ResolverCount') }}
                    </p>
                    <p class="text-2xl font-mono font-semibold">{{ result.resolverCount }}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent class="p-4">
                    <p class="text-xs text-muted-foreground mb-1">
                        {{ t('enhanceddnsleaktest.Summary.RawCount') }}
                    </p>
                    <p class="text-2xl font-mono font-semibold">{{ result.rawCount }}</p>
                </CardContent>
            </Card>
            <Card class="col-span-2 md:col-span-1">
                <CardContent class="p-4">
                    <p class="text-xs text-muted-foreground mb-1">
                        {{ t('enhanceddnsleaktest.Summary.DnssecPosture') }}
                    </p>
                    <p class="text-sm font-medium"
                        :class="dnssecSummary.tone === 'good' ? 'text-success' : dnssecSummary.tone === 'warn' ? 'text-warning' : 'text-muted-foreground'">
                        {{ dnssecSummary.text }}
                    </p>
                </CardContent>
            </Card>
        </div>

        <!-- Empty state: we got a response but zero captured queries -->
        <Card v-if="hasResult && result.queries.length === 0">
            <CardContent class="p-6 text-center text-sm text-muted-foreground">
                {{ t('enhanceddnsleaktest.Empty') }}
            </CardContent>
        </Card>

        <!-- Result table: sorted (ECS-first → country → IP numeric),
             optionally deduped on (resolver IP, ECS) via the header switch. -->
        <Card v-if="hasResult && result.queries.length > 0">
            <CardContent class="p-0">
                <header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="relative flex shrink-0">
                            <span class="relative inline-flex size-2 rounded-full bg-success"></span>
                        </span>
                        <h3 class="text-sm font-semibold m-0">
                            {{ t('enhanceddnsleaktest.TableTitle') }}
                        </h3>
                    </div>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                            <Switch :model-value="dedupe" @update:model-value="dedupe = $event"
                                :aria-label="t('enhanceddnsleaktest.DedupeToggle')" />
                            <span>{{ t('enhanceddnsleaktest.DedupeToggle') }}</span>
                        </label>
                    </div>
                </header>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">#</TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">
                                {{ t('enhanceddnsleaktest.Fields.ResolverIP') }}
                            </TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">
                                {{ t('enhanceddnsleaktest.Fields.Location') }}
                            </TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">
                                {{ t('enhanceddnsleaktest.Fields.ASN') }}
                            </TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">
                                {{ t('enhanceddnsleaktest.Fields.QueryType') }}
                            </TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">
                                {{ t('enhanceddnsleaktest.Fields.Transport') }}
                            </TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide">
                                {{ t('enhanceddnsleaktest.Fields.ECS') }}
                            </TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide text-center"
                                :title="t('enhanceddnsleaktest.Legend.DO')">DO</TableHead>
                            <TableHead class="text-xs text-muted-foreground uppercase tracking-wide text-center"
                                :title="t('enhanceddnsleaktest.Legend.CD')">CD</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="(row, i) in visibleRows" :key="i">
                            <TableCell class="font-mono text-muted-foreground align-top">{{ i + 1 }}</TableCell>

                            <!-- Resolver IP -->
                            <TableCell class="font-mono align-top wrap-break-word whitespace-normal">
                                <span v-if="row.ip">{{ row.ip }}</span>
                                <span v-else class="text-muted-foreground/60">—</span>
                            </TableCell>

                            <!-- Location: flag+country / region·city -->
                            <TableCell class="align-top whitespace-normal">
                                <template
                                    v-if="row.ipInfo && row.ipInfo.country_code && row.ipInfo.country_code !== 'N/A'">
                                    <div class="flex flex-col items-start">
                                        <div class="flex items-center gap-1.5">
                                            <Icon :icon="'circle-flags:' + row.ipInfo.country_code.toLowerCase()"
                                                class="shrink-0 size-4" />
                                            <span class="truncate">
                                                {{ resolveCountryName(row.ipInfo) }}
                                            </span>
                                        </div>
                                        <span v-if="locationDetail(row.ipInfo)"
                                            class="text-xs text-muted-foreground mt-0.5 truncate">
                                            {{ locationDetail(row.ipInfo) }}
                                        </span>
                                    </div>
                                </template>
                                <span v-else class="text-muted-foreground/60">—</span>
                            </TableCell>

                            <!-- ASN: org / AS number -->
                            <TableCell class="align-top whitespace-normal">
                                <div v-if="row.ipInfo && row.ipInfo.asn && row.ipInfo.asn !== 'N/A'"
                                    class="min-w-0 flex flex-col items-start">
                                    <span class="truncate">{{ row.ipInfo.org }}</span>
                                    <span
                                        class="truncate font-mono text-xs text-muted-foreground wrap-break-word mt-0.5">
                                        {{ row.ipInfo.asn }}
                                    </span>
                                </div>
                                <span v-else class="text-muted-foreground/60">—</span>
                            </TableCell>

                            <!-- Query type -->
                            <TableCell class="align-top">
                                <Badge variant="outline" class="font-mono font-normal" v-if="row.queryType">{{ row.queryType }}</Badge>
                                <span v-else class="text-muted-foreground/60">—</span>
                            </TableCell>

                            <!-- Transport -->
                            <TableCell class="align-top">
                                <Badge variant="outline" class="font-mono font-normal" v-if="row.transport">
                                    {{ row.transport.toUpperCase() }}
                                </Badge>
                                <span v-else class="text-muted-foreground/60">—</span>
                            </TableCell>

                            <!-- ECS: subnet / flag + country · region · city (single horizontal line) -->
                            <TableCell class="align-top whitespace-normal">
                                <template v-if="row.ecs">
                                    <div class="flex flex-col items-start">
                                        <span class="font-mono truncate">{{ row.ecs }}</span>
                                        <span v-if="ecsDetail(row)"
                                            class="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1 truncate max-w-full">
                                            <Icon
                                                v-if="row.ecsInfo && row.ecsInfo.country_code && row.ecsInfo.country_code !== 'N/A'"
                                                :icon="'circle-flags:' + row.ecsInfo.country_code.toLowerCase()"
                                                class="shrink-0 size-3" />
                                            <span class="truncate">{{ ecsDetail(row) }}</span>
                                        </span>
                                    </div>
                                </template>
                                <span v-else class="text-muted-foreground/60">—</span>
                            </TableCell>

                            <!-- DNSSEC DO / CD — green ✓ = healthy state, amber ✗ = caution.
                                 No red; neither state is strictly dangerous on its own. -->
                            <TableCell class="text-center">
                                <Check v-if="row.do" class="inline size-4 text-success"
                                    :aria-label="t('enhanceddnsleaktest.DnssecChip.Signed')" />
                                <X v-else class="inline size-4 text-warning"
                                    :aria-label="t('enhanceddnsleaktest.DnssecChip.Unsigned')" />
                            </TableCell>
                            <TableCell class="text-center">
                                <Check v-if="!row.cd" class="inline size-4 text-success"
                                    :aria-label="t('enhanceddnsleaktest.DnssecChip.Validated')" />
                                <X v-else class="inline size-4 text-warning"
                                    :aria-label="t('enhanceddnsleaktest.DnssecChip.CdSet')" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <!-- Field legend: one bordered block per field, icon + name + description. -->
        <Card v-if="hasResult && result.queries.length > 0">
            <CardContent class="p-4 md:p-5 space-y-4">
                <h4 class="text-base font-semibold mb-2">
                    {{ t('enhanceddnsleaktest.Legend.Title') }}
                </h4>
                <dl class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="item in legendItems" :key="item.key"
                        class="rounded-md border bg-muted/30 p-3 space-y-1.5">
                        <dt class="flex items-center gap-2 text-sm font-medium">
                            <component :is="item.icon" class="size-4 text-muted-foreground shrink-0" />
                            <span>{{ item.label }}</span>
                        </dt>
                        <dd class="text-sm text-muted-foreground leading-relaxed">
                            {{ item.desc }}
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import getCountryName from '@/data/country-name.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@iconify/vue';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Play, Check, X, Info, Server, Hash, Route, MapPin, ShieldCheck, ShieldAlert } from 'lucide-vue-next';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);

// NS-capture session config. Token + probe FQDNs are generated client-side;
// the NS passively captures any {nonce}.{token}.{DOMAIN} that shows up.
const PROBE_DOMAIN = 'leak.ipcheck.ing';
const PROBE_COUNT = 4;
const PROBE_STEP_MS = 450;   // delay between UI animation steps
const POLL_AFTER_MS = 3500;  // wait before first fetch so NS can absorb probes
const FETCH_RETRY_DELAY_MS = 2500;
const FETCH_MAX_ATTEMPTS = 3;

// status: idle | firing | polling | fetching | done | error
const status = ref('idle');
const errorMsg = ref('');
const result = ref(null);
const dedupe = ref(true);

const probeStates = reactive(Array.from({ length: PROBE_COUNT }, () => ({
    state: 'pending', fqdn: '', nonce: '',
})));

const isBusy = computed(() => ['firing', 'polling', 'fetching'].includes(status.value));
// Hide the Flow card when the run errored out — otherwise it stays on screen
// showing a green dot + 0% bar next to the error banner, which reads as
// "completed ok" and contradicts the red error message right above it.
const showFlow = computed(() =>
    status.value !== 'error'
    && (isBusy.value || probeStates.some(p => p.state !== 'pending'))
);
const hasResult = computed(() => result.value !== null && status.value === 'done');

const runLabel = computed(() => {
    if (status.value === 'firing') return t('enhanceddnsleaktest.RunningProbes');
    if (status.value === 'polling' || status.value === 'fetching') return t('enhanceddnsleaktest.PollingResult');
    if (status.value === 'done' || status.value === 'error') return t('enhanceddnsleaktest.RunAgain');
    return t('enhanceddnsleaktest.Run');
});

// Country name in the current UI locale; falls back to code if the lookup misses.
const resolveCountryName = (info) => {
    if (!info) return '';
    const code = info.country_code;
    if (!code || code === 'N/A') return info.country_name || '';
    return getCountryName(code, lang.value) || info.country_name || code;
};

// "Region · City" (drops blanks and the redundant region==city case).
const locationDetail = (info) => {
    if (!info) return '';
    const parts = [];
    if (info.region && info.region !== 'N/A') parts.push(info.region);
    if (info.city && info.city !== 'N/A' && info.city !== info.region) parts.push(info.city);
    return parts.join(' · ');
};

// Single-line "country · region · city" for the ECS cell.
const ecsDetail = (row) => {
    const info = row?.ecsInfo;
    if (!info) return '';
    const parts = [];
    if (info.country_code && info.country_code !== 'N/A') parts.push(resolveCountryName(info));
    const detail = locationDetail(info);
    if (detail) parts.push(detail);
    return parts.join(' · ');
};

const indicatorBarClass = computed(() => status.value === 'done' ? 'bg-success' : 'bg-info');

// Bottom "what each field means" cards.
const legendItems = computed(() => [
    { key: 'ResolverIP', icon: Server,      label: t('enhanceddnsleaktest.Fields.ResolverIP'), desc: t('enhanceddnsleaktest.Legend.ResolverIP') },
    { key: 'QueryType',  icon: Hash,        label: t('enhanceddnsleaktest.Fields.QueryType'),  desc: t('enhanceddnsleaktest.Legend.QueryType') },
    { key: 'ECS',        icon: MapPin,      label: t('enhanceddnsleaktest.Fields.ECS'),        desc: t('enhanceddnsleaktest.Legend.ECS') },
    { key: 'Transport',  icon: Route,       label: t('enhanceddnsleaktest.Fields.Transport'),  desc: t('enhanceddnsleaktest.Legend.Transport') },
    { key: 'DO',         icon: ShieldCheck, label: 'DO',                                       desc: t('enhanceddnsleaktest.Legend.DO') },
    { key: 'CD',         icon: ShieldAlert, label: 'CD',                                       desc: t('enhanceddnsleaktest.Legend.CD') },
]);

// Worst-of across all captured rows.
const dnssecSummary = computed(() => {
    if (!result.value || result.value.queries.length === 0) {
        return { tone: 'neutral', text: t('enhanceddnsleaktest.Summary.DnssecNone') };
    }
    const rows = result.value.queries;
    if (rows.some(r => r.cd)) return { tone: 'warn', text: t('enhanceddnsleaktest.Summary.DnssecCdSet') };
    if (rows.some(r => !r.do)) return { tone: 'warn', text: t('enhanceddnsleaktest.Summary.DnssecNoDo') };
    return { tone: 'good', text: t('enhanceddnsleaktest.Summary.DnssecGood') };
});

// IPv4/IPv6 → BigInt for numeric sort. IPv4 is split separately (4 < 5 octets)
// so we handle family ordering in the comparator, not here.
const ipToBigInt = (ip) => {
    if (!ip) return 0n;
    if (ip.includes(':')) {
        const parts = ip.split(':');
        const dcIdx = parts.indexOf('');
        let segs = parts;
        if (dcIdx !== -1) {
            const left = parts.slice(0, dcIdx).filter(Boolean);
            const right = parts.slice(dcIdx + 1).filter(Boolean);
            const missing = Math.max(0, 8 - left.length - right.length);
            segs = [...left, ...Array(missing).fill('0'), ...right];
        }
        let n = 0n;
        for (const seg of segs) n = (n << 16n) | BigInt(parseInt(seg || '0', 16) || 0);
        return n;
    }
    const octets = ip.split('.').map(x => Number(x) || 0);
    let n = 0n;
    for (const o of octets) n = (n << 8n) | BigInt(o);
    return n;
};

// Rows with ECS first, then without; inside each group: country → IPv4/v6 → numeric IP.
const sortedRows = computed(() => {
    const cmp = (a, b) => {
        const ca = (a.ipInfo?.country_code || 'ZZZ').toUpperCase();
        const cb = (b.ipInfo?.country_code || 'ZZZ').toUpperCase();
        if (ca !== cb) return ca.localeCompare(cb);
        const fa = (a.ip || '').includes(':') ? 1 : 0;
        const fb = (b.ip || '').includes(':') ? 1 : 0;
        if (fa !== fb) return fa - fb;
        const ia = ipToBigInt(a.ip);
        const ib = ipToBigInt(b.ip);
        return ia < ib ? -1 : ia > ib ? 1 : 0;
    };
    const rows = result.value?.queries ?? [];
    const withEcs = rows.filter(r => r.ecs);
    const withoutEcs = rows.filter(r => !r.ecs);
    return [...withEcs.slice().sort(cmp), ...withoutEcs.slice().sort(cmp)];
});

// Dedupe on (ip|ecs) keeps only the first occurrence when the toggle is on.
const visibleRows = computed(() => {
    const rows = sortedRows.value;
    if (!dedupe.value) return rows;
    const seen = new Set();
    const out = [];
    for (const r of rows) {
        const key = `${r.ip || ''}|${r.ecs || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(r);
    }
    return out;
});

const progressValue = computed(() => {
    if (status.value === 'firing') {
        const sent = probeStates.filter(p => p.state === 'sent').length;
        return Math.round((sent / PROBE_COUNT) * 50);
    }
    if (status.value === 'polling') return 70;
    if (status.value === 'fetching') return 90;
    if (status.value === 'done') return 100;
    return 0;
});

const stageText = computed(() => {
    if (status.value === 'firing') {
        const firingIdx = probeStates.findIndex(p => p.state === 'firing');
        const current = firingIdx >= 0
            ? firingIdx + 1
            : Math.min(PROBE_COUNT, probeStates.filter(p => p.state === 'sent').length);
        return t('enhanceddnsleaktest.Flow.Probing', { current, total: PROBE_COUNT });
    }
    if (status.value === 'polling') return t('enhanceddnsleaktest.Flow.Waiting');
    if (status.value === 'fetching') return t('enhanceddnsleaktest.Flow.Fetching');
    if (status.value === 'done') return t('enhanceddnsleaktest.Flow.Done');
    return '';
});

// Lowercase hex: DNS labels are case-insensitive, so base64url would lose bits.
const generateToken = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const generateNonce = () => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const primeProbes = (token) => {
    for (let i = 0; i < PROBE_COUNT; i++) {
        const nonce = generateNonce();
        probeStates[i].state = 'pending';
        probeStates[i].nonce = nonce;
        probeStates[i].fqdn = `${nonce}.${token}.${PROBE_DOMAIN}`;
    }
};

// Fire all four probes in parallel; <img> triggers DNS even though the TLS
// handshake after it fails, which is all we need for NS-side capture.
const fireAllProbes = () => {
    for (const p of probeStates) {
        try {
            const img = new Image();
            img.src = `https://${p.fqdn}/probe.gif?t=${Date.now()}`;
        } catch { /* DNS already went out */ }
    }
};

// Pure UI animation — probes have already been fired in parallel.
const animateProbes = async () => {
    for (let i = 0; i < probeStates.length; i++) {
        probeStates[i].state = 'firing';
        await new Promise(r => setTimeout(r, PROBE_STEP_MS));
        probeStates[i].state = 'sent';
    }
};

// store.lang is 'zh' but the upstream keys on 'zh-CN' (same mapping as IpInfos/WebRtcTest).
const apiLang = () => {
    const current = lang.value;
    if (current === 'zh') return 'zh-CN';
    if (current && ['en', 'fr', 'tr', 'zh-CN'].includes(current)) return current;
    return 'zh-CN';
};

// authenticatedFetch attaches the Firebase ID token as Authorization; our
// backend then forwards request headers to the upstream IPCheck.ing API.
const fetchResultOnce = async (token) => {
    const url = `/api/dnsleaktest/session/${encodeURIComponent(token)}?lang=${encodeURIComponent(apiLang())}`;
    return authenticatedFetch(url);
};

// Retry transient failures. Auth / token errors bypass the retry — there's
// no point re-hitting the upstream with the same (rejected) credentials.
const fetchResultWithRetry = async (token) => {
    let lastErr;
    for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
        try {
            return await fetchResultOnce(token);
        } catch (err) {
            lastErr = err;
            if (err.message.includes('Sign in required') || err.message.includes('Invalid token')) {
                throw err;
            }
            console.warn(`[dnsleak] fetch attempt ${attempt}/${FETCH_MAX_ATTEMPTS} failed:`, err.message);
            if (attempt < FETCH_MAX_ATTEMPTS) await new Promise(r => setTimeout(r, FETCH_RETRY_DELAY_MS));
        }
    }
    throw lastErr;
};

const runTest = async () => {
    if (!store.user) return;
    trackEvent('Section', 'StartClick', 'EnhancedDnsLeakTest');
    errorMsg.value = '';
    result.value = null;

    try {
        const token = generateToken();
        primeProbes(token);

        status.value = 'firing';
        fireAllProbes();
        await animateProbes();

        status.value = 'polling';
        await new Promise(r => setTimeout(r, POLL_AFTER_MS));

        status.value = 'fetching';
        let data = await fetchResultWithRetry(token);

        // A slow resolver can lag the others by several seconds — retry the pull
        // a couple of times when the first response still has zero captures.
        if ((data?.resolverCount ?? 0) === 0) {
            for (let attempt = 0; attempt < 2 && (data?.resolverCount ?? 0) === 0; attempt++) {
                await new Promise(r => setTimeout(r, FETCH_RETRY_DELAY_MS));
                data = await fetchResultWithRetry(token);
            }
        }

        result.value = {
            rawCount: data.rawCount ?? 0,
            resolverCount: data.resolverCount ?? 0,
            queries: Array.isArray(data.queries) ? data.queries : [],
        };
        status.value = 'done';
    } catch (error) {
        console.error('Enhanced DNS leak test failed:', error);
        if (error.message.includes('Invalid token')) {
            errorMsg.value = t('user.InvalidUserToken');
        } else if (error.message.includes('Sign in required')) {
            errorMsg.value = t('user.SignInToUse');
        } else {
            errorMsg.value = t('enhanceddnsleaktest.FetchError');
        }
        status.value = 'error';
    }
};
</script>

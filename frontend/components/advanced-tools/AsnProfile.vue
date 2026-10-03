<!-- ASN Profile — FRONT-END DEMO. Every figure is hardcoded or seeded sample
     data switched in-page; nothing is fetched. A demo switch toggles the
     official-site-only reputation layer (Reputation card + hero verdict).
     Order: hero (+ whois) → reputation → scale | traffic → map →
     prefixes → connectivity (+ topology) → sources. -->
<template>
    <div class="my-4 space-y-4">
        <!-- Demo marker + reputation-layer switch + top note -->
        <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" class="border-warning/60 bg-warning/15 text-foreground">Demo — sample data</Badge>
                <div class="flex items-center gap-2">
                    <Switch id="asnReputationSwitch" v-model="reputationOn" />
                    <Label for="asnReputationSwitch" class="text-xs font-normal cursor-pointer">
                        Reputation data: <span class="font-semibold">{{ reputationOn ? 'on' : 'off' }}</span>
                        <span class="text-muted-foreground">(official site only)</span>
                    </Label>
                </div>
            </div>
            <p class="text-sm text-muted-foreground leading-relaxed">
                Identity, scale, routing and footprint of any autonomous system, at a glance.</p>
        </div>

        <!-- Input row + quick-pick samples -->
        <div class="space-y-2">
            <Label for="asnProfileQuery">AS number</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="asnProfileQuery" name="asnProfileQuery" class="font-mono"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore
                    data-lpignore="true" placeholder="e.g. AS13335" v-model="query" :disabled="loading"
                    @keyup.enter="onSubmit" :aria-invalid="errorMsg !== ''" />
                <Button variant="action" class="cursor-pointer" :disabled="loading || !query" @click="onSubmit">
                    <Spinner v-if="loading" />
                    <Search v-else class="size-4 shrink-0" />
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
            <ToggleGroup :model-value="String(target)" type="single" variant="outline" :spacing="2"
                class="w-full flex-wrap justify-start" :disabled="loading"
                @update:model-value="(v) => v && pick(Number(v))">
                <ToggleGroupItem v-for="item in SAMPLE_LIST" :key="item.asn" :value="String(item.asn)" :class="tagClass">
                    <span class="font-mono">AS{{ item.asn }}</span>
                    <span class="text-muted-foreground group-data-[state=on]:text-inherit">{{ item.pill }}</span>
                </ToggleGroupItem>
            </ToggleGroup>
        </div>

        <div class="space-y-4 transition-opacity" :class="loading && 'opacity-50'" :aria-busy="loading">
            <!-- ============ Hero: identity → registration → raw record ============ -->
            <div class="rounded-lg border bg-card p-4 md:p-5 space-y-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="font-mono text-3xl md:text-4xl font-semibold tracking-tight">AS{{ sample.asn }}</div>
                        <div class="mt-1 text-sm text-muted-foreground wrap-break-word">
                            <span class="font-medium text-foreground">{{ sample.name }}</span> · {{ sample.org }}
                        </div>
                    </div>
                    <span class="inline-flex shrink-0 items-center gap-1.5 text-sm">
                        <Icon :icon="'circle-flags:' + sample.country.toLowerCase()" class="size-4 shrink-0" />
                        {{ getCountryName(sample.country, locale) }}
                    </span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">Rank #{{ nf.format(sample.rank) }}</Badge>
                    <Badge v-if="sample.tier1" variant="secondary">Tier 1</Badge>
                    <Badge v-if="reputationOn" :variant="verdict.variant" class="gap-1" :class="verdict.extra">
                        <component :is="verdict.icon" class="size-3.5" />{{ verdict.label }}
                    </Badge>
                </div>

                <Separator />

                <!-- Registration (RDAP autnum); fields the header already shows are left out -->
                <dl class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                    <div v-for="field in whoisFields" :key="field.label" class="min-w-0"
                        :class="field.wide && 'col-span-2 lg:col-span-1'">
                        <dt class="text-[11px] text-muted-foreground">{{ field.label }}</dt>
                        <dd class="text-sm wrap-break-word" :class="field.mono && 'font-mono text-xs leading-5'">{{ field.value }}</dd>
                    </div>
                </dl>

                <!-- Raw record, collapsed by default -->
                <Collapsible v-model:open="rawOpen" class="rounded-md border">
                    <div class="flex items-center justify-between gap-2 pr-1.5">
                        <CollapsibleTrigger>
                            <Button type="button" variant="ghost"
                                class="group h-auto flex-1 justify-start gap-2 px-3 py-1.5 text-xs cursor-pointer">
                                <ChevronRight class="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                Raw whois record
                            </Button>
                        </CollapsibleTrigger>
                        <CopyButton :value="() => sample.whois.raw" aria-label="Copy raw record" icon-class="size-3.5" />
                    </div>
                    <CollapsibleContent>
                        <pre class="mx-2 mb-2 max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{{ sample.whois.raw }}</pre>
                    </CollapsibleContent>
                </Collapsible>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <!-- ============ Reputation (official site only) ============ -->
                <div v-if="reputationOn" class="rounded-lg border bg-card p-4 space-y-4 md:col-span-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <h2 class="text-base font-semibold">🛡️ Reputation</h2>
                        <Badge variant="outline" class="text-[10px] font-medium text-muted-foreground">IPCheck.ing data</Badge>
                    </div>
                    <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
                        <!-- Density meters on a shared log axis; tick = global baseline -->
                        <div class="space-y-3">
                            <div v-for="meter in meters" :key="meter.key">
                                <div class="flex items-baseline justify-between gap-2 text-sm">
                                    <span>{{ meter.label }}</span>
                                    <span class="font-mono tabular-nums">{{ nf.format(meter.value) }}
                                        <span class="text-xs text-muted-foreground">/ 10k</span></span>
                                </div>
                                <div class="relative mt-1.5 h-2 rounded-full bg-muted">
                                    <div class="absolute inset-y-0 left-0 rounded-full" :class="dotClass(meter.tone)"
                                        :style="{ width: meter.pos + '%' }" />
                                    <div class="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-foreground/70"
                                        :style="{ left: BASELINE_POS + '%' }" title="Global baseline" />
                                </div>
                                <div class="mt-1 flex justify-between gap-2 text-xs">
                                    <span class="text-muted-foreground">Baseline {{ nf.format(meter.baseline) }}</span>
                                    <span class="font-medium" :class="textClass(meter.tone)">{{ meter.note }}</span>
                                </div>
                            </div>
                            <!-- Shared axis labels -->
                            <div class="relative h-3 text-[10px] text-muted-foreground">
                                <span v-for="tick in AXIS_TICKS" :key="tick.label" class="absolute"
                                    :class="tick.shift" :style="{ left: tick.pos + '%' }">{{ tick.label }}</span>
                            </div>
                        </div>

                        <!-- Blocklist status + listed total -->
                        <div class="space-y-3">
                            <div v-if="sample.drop"
                                class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                <ShieldX class="size-4 mt-0.5 shrink-0" />
                                <div class="space-y-0.5">
                                    <div class="font-semibold">Listed on Spamhaus ASN-DROP</div>
                                    <div class="text-xs">Since {{ formatIsoDate(sample.drop.since, locale) }} · {{ sample.drop.reason }}</div>
                                </div>
                            </div>
                            <div v-else class="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                                <ShieldCheck class="size-4 mt-0.5 shrink-0 text-success" />
                                <span>Not listed on Spamhaus ASN-DROP</span>
                            </div>
                            <div class="rounded-md bg-muted/40 p-3">
                                <div class="text-lg font-semibold tabular-nums">≈{{ nf.format(abuseListed) }}</div>
                                <div class="text-xs text-muted-foreground">abuse-listed IPv4 addresses</div>
                            </div>
                        </div>
                    </div>
                    <p class="text-[11px] text-muted-foreground leading-relaxed">
                        Densities count individually listed IPv4 addresses only, per 10,000 announced IPv4 addresses;
                        the baseline is the global median across announcing ASes. Log scale.</p>
                </div>

                <!-- ============ Scale ============ -->
                <div class="rounded-lg border bg-card p-4 space-y-3">
                    <h2 class="text-base font-semibold">📊 Scale</h2>
                    <div class="grid grid-cols-2 gap-2.5">
                        <div v-for="tile in scaleTiles" :key="tile.label" class="rounded-md bg-muted/40 p-3 min-w-0">
                            <div class="text-lg font-semibold tabular-nums truncate">{{ tile.value }}</div>
                            <div class="text-xs text-muted-foreground">{{ tile.label }}</div>
                            <div v-if="tile.sub" class="text-[11px] text-muted-foreground/80">{{ tile.sub }}</div>
                        </div>
                    </div>
                </div>

                <!-- ============ Traffic profile & connection quality ============ -->
                <div class="rounded-lg border bg-card p-4 space-y-3">
                    <h2 class="text-base font-semibold">📈 Traffic profile</h2>
                    <div class="space-y-2.5">
                        <DataPairBar v-for="pair in trafficPairs" :key="pair.leftLabel" v-bind="pair" />
                    </div>
                    <div class="pt-1 text-xs text-muted-foreground">Connection quality</div>
                    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div v-for="row in qualityRows" :key="row.label">
                            <dt class="text-xs text-muted-foreground mb-0.5">{{ row.label }}</dt>
                            <dd class="font-mono tabular-nums">{{ row.value }}</dd>
                        </div>
                    </dl>
                </div>

                <!-- ============ Global IP distribution ============ -->
                <div class="rounded-lg border bg-card p-4 space-y-3 md:col-span-2">
                    <h2 class="text-base font-semibold">🌍 Global IP distribution</h2>
                    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                        <div class="relative w-full aspect-[2/1] overflow-hidden rounded-md">
                            <canvas ref="mapCanvas" role="img" aria-label="Map of announced IPv4 by country"></canvas>
                            <div v-if="!mapReady && !mapFailed" class="absolute inset-0 flex items-center justify-center">
                                <Spinner class="size-4 text-muted-foreground" />
                            </div>
                        </div>
                        <ul class="space-y-1.5">
                            <li v-for="row in topCountries" :key="row.cc" class="flex items-center gap-2 text-sm">
                                <Icon :icon="'circle-flags:' + row.cc.toLowerCase()" class="size-4 shrink-0" />
                                <span class="w-24 truncate">{{ getCountryName(row.cc, locale) }}</span>
                                <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div class="h-full rounded-full bg-info" :style="{ width: row.bar + '%' }" />
                                </div>
                                <span class="w-12 text-right font-mono text-xs tabular-nums">{{ row.pct }}%</span>
                            </li>
                        </ul>
                    </div>
                    <p class="text-[11px] text-muted-foreground">Share of announced IPv4 addresses by geolocated country.</p>
                </div>

                <!-- ============ Announced prefixes (+ RPKI routing summary) ============ -->
                <div class="rounded-lg border bg-card p-4 space-y-4 md:col-span-2 min-w-0">
                    <div>
                        <h2 class="text-base font-semibold">📜 Announced prefixes</h2>
                        <div class="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {{ nf.format(prefixes.v4.length) }} IPv4 · {{ nf.format(prefixes.v6.length) }} IPv6</div>
                    </div>

                    <!-- Routing: RPKI route-origin validation (both builds) -->
                    <div class="space-y-1.5">
                        <div class="flex items-baseline justify-between gap-2 text-sm">
                            <span>RPKI route origin</span>
                            <span class="font-mono tabular-nums">{{ rpki.validPct }}% valid</span>
                        </div>
                        <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                            <div v-for="seg in RPKI_STATES" :key="seg.key" :class="seg.dot"
                                :style="{ width: rpki.pct[seg.key] + '%' }" />
                        </div>
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span v-for="seg in RPKI_STATES" :key="seg.key" class="inline-flex items-center gap-1.5">
                                <span class="size-2 rounded-full" :class="seg.dot" />
                                <span class="text-muted-foreground">{{ seg.key }}</span>
                                <span class="font-medium tabular-nums">{{ nf.format(rpki.counts[seg.key]) }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- Family filter + export of the filtered set -->
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <ToggleGroup :model-value="familyFilter" type="single" variant="outline" :spacing="2"
                            class="flex-wrap justify-start" aria-label="Address family"
                            @update:model-value="(v) => v && (familyFilter = v)">
                            <ToggleGroupItem v-for="opt in FAMILY_OPTIONS" :key="opt.value" :value="opt.value"
                                :class="tagClass">{{ opt.label }}</ToggleGroupItem>
                        </ToggleGroup>
                        <div class="flex items-center gap-1">
                            <Button variant="ghost" size="sm" class="h-7 cursor-pointer gap-1.5 text-xs"
                                :disabled="!filtered.length" @click="copyFiltered">
                                <Copy class="size-3.5" />Copy all</Button>
                            <Button variant="ghost" size="sm" class="h-7 cursor-pointer gap-1.5 text-xs"
                                :disabled="!filtered.length" @click="downloadFiltered">
                                <Download class="size-3.5" />Download .txt</Button>
                        </div>
                    </div>

                    <!-- Prefix table; horizontal overflow stays in here -->
                    <div class="overflow-x-auto rounded-lg border">
                        <table class="w-full text-sm">
                            <thead class="bg-muted/40">
                                <tr class="text-left text-xs text-muted-foreground">
                                    <th scope="col" class="px-3 py-2 font-medium">Prefix</th>
                                    <th scope="col" class="px-3 py-2 font-medium text-right">Size</th>
                                    <th scope="col" class="px-3 py-2 font-medium">RPKI</th>
                                    <th scope="col" class="px-3 py-2 font-medium text-right">Visibility</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                <tr v-for="row in shownRows" :key="row.prefix">
                                    <td class="px-3 py-1.5 font-mono whitespace-nowrap">{{ row.prefix }}</td>
                                    <td class="px-3 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                                        {{ sizeLabel(row) }}</td>
                                    <td class="px-3 py-1.5 whitespace-nowrap">
                                        <span class="inline-flex items-center gap-1.5 text-xs">
                                            <span class="size-1.5 rounded-full shrink-0" :class="RPKI_DOT[row.rpki]" />
                                            {{ row.rpki }}
                                        </span>
                                    </td>
                                    <td class="px-3 py-1.5 text-right font-mono text-xs tabular-nums">{{ row.peers }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Paging: first 10 ship with the page, the rest loads on first "Show more" -->
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs text-muted-foreground tabular-nums">
                            {{ nf.format(shownRows.length) }} of {{ nf.format(filtered.length) }} shown</span>
                        <Button v-if="filtered.length > limit" variant="outline" size="sm"
                            class="h-7 cursor-pointer gap-1.5 text-xs" :disabled="restState === 'loading'" @click="showMore">
                            <Spinner v-if="restState === 'loading'" class="size-3.5" />
                            Show {{ nf.format(Math.min(PAGE, filtered.length - limit)) }} more</Button>
                    </div>
                    <p class="text-[11px] text-muted-foreground">Visibility = route collector peers carrying the prefix.</p>
                </div>

                <!-- ============ Connectivity ============ -->
                <div class="rounded-lg border bg-card p-4 space-y-4 md:col-span-2 min-w-0">
                    <h2 class="text-base font-semibold">🕸️ Connectivity</h2>
                    <div class="grid grid-cols-3 gap-2.5 text-center">
                        <div v-for="group in neighbourGroups" :key="group.key" class="rounded-md bg-muted/40 py-2">
                            <div class="text-lg font-semibold tabular-nums">{{ nf.format(group.count) }}</div>
                            <div class="text-xs text-muted-foreground">{{ group.label }}</div>
                        </div>
                    </div>

                    <!-- Upstream topology: the IP-card component, fed mock /api/asn-connectivity data -->
                    <ASNConnectivity :asn="String(sample.asn)" :asnConnectivityInfos="CONNECTIVITY_INFOS" />

                    <div class="grid gap-4 md:grid-cols-3">
                        <div v-for="group in neighbourGroups" :key="group.key" class="min-w-0">
                            <div class="text-xs text-muted-foreground mb-1">{{ group.label }}</div>
                            <div v-if="group.names.length" class="flex flex-wrap gap-1.5">
                                <Badge v-for="name in group.names.slice(0, NAME_PREVIEW)" :key="name" variant="outline"
                                    class="font-normal">{{ name }}</Badge>
                                <span v-if="group.count > NAME_PREVIEW" class="self-center text-xs text-muted-foreground">
                                    +{{ nf.format(group.count - NAME_PREVIEW) }}</span>
                            </div>
                            <p v-else class="text-xs text-muted-foreground">None observed</p>
                        </div>
                    </div>

                    <!-- IXP presence, collapsed by default -->
                    <p v-if="!sample.ixps.length" class="text-sm text-muted-foreground">No IXP presence listed in PeeringDB.</p>
                    <Collapsible v-else v-model:open="ixpOpen" class="rounded-md border">
                        <CollapsibleTrigger>
                            <Button type="button" variant="ghost"
                                class="group h-auto w-full justify-start gap-2 px-3 py-2 text-xs cursor-pointer">
                                <ChevronRight class="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                IXP presence
                                <span class="text-muted-foreground tabular-nums">{{ nf.format(sample.ixps.length) }}</span>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ul class="divide-y border-t">
                                <li v-for="ixp in sample.ixps" :key="ixp.ix" class="flex items-center gap-2 px-3 py-2 text-sm">
                                    <Icon :icon="'circle-flags:' + ixp.cc.toLowerCase()" class="size-4 shrink-0" />
                                    <span class="min-w-0 truncate">{{ ixp.ix }}</span>
                                    <span class="hidden sm:inline truncate text-xs text-muted-foreground">{{ ixp.city }}</span>
                                    <span class="ml-auto shrink-0 font-mono text-xs">{{ formatSpeed(ixp.speed) }}</span>
                                    <Badge v-if="ixp.rs" variant="secondary" class="shrink-0 px-1.5 text-[10px]">RS</Badge>
                                </li>
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </div>

            <!-- ============ Sources ============ -->
            <p class="text-[11px] text-muted-foreground leading-relaxed">
                Sources: Cloudflare Radar · CAIDA AS Rank, AS relationships &amp; as2org · NRO delegated stats ·
                RIR RDAP · PeeringDB · MaxMind GeoLite2<template v-if="reputationOn"> · Spamhaus ASN-DROP ·
                IPCheck.ing blocklist index</template></p>
        </div>
    </div>
</template>

<script setup>
// DEMO: hardcoded copy — English only, no i18n keys beyond the registry's
// title + note. Registered in data/tools.js (slug `asn`).
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ChevronRight, Copy, Download, Search, ShieldAlert, ShieldCheck, ShieldX } from '@lucide/vue';
import { useMainStore } from '@/store';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { useWorldMapChart } from '@/composables/use-world-map-chart.js';
import { formatIsoDate } from '@/utils/time-utils.js';
import getCountryName from '@/data/country-name.js';
import DataPairBar from '@/components/ip-infos/DataPairBar.vue';
import CopyButton from '@/components/widgets/CopyButton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Heavy (dagre + SVG) — async, as IpDetailPanel loads it.
const ASNConnectivity = defineAsyncComponent(() => import('@/components/ip-infos/ASNConnectivity.vue'));

const { locale } = useI18n();
const store = useMainStore();
const { dotClass, textClass } = useStatusTone();

// ---- sample data -----------------------------------------------------------
// AS64501 / AS65550 and their fictional neighbours sit in the RFC 5398
// documentation ASN ranges; their prefixes come from documentation /
// benchmark space (RFC 5737, 2544, 3849, 9637) — no real network is
// described by them.

// Global median, listed IPv4 addresses per 10k announced.
const BASELINES = { abuse: 4.0, vpn: 2.5, proxy: 0.8 };

const SAMPLES = {
    13335: {
        asn: 13335, pill: 'Cloudflare', name: 'CLOUDFLARENET', org: 'Cloudflare, Inc.', country: 'US',
        rir: 'ARIN', registered: '2010-07-14', rank: 32, tier1: false,
        density: { abuse: 1.1, vpn: 1.9, proxy: 0.3 },
        drop: null,
        scale: { coneAsns: 413, coneAddresses: 2310000, users: 4200000 },
        prefixPlan: {
            v4: {
                target: 2514, maxLen: 24, peers: [290, 340],
                covering: ['103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '104.16.0.0/13', '104.24.0.0/14',
                    '108.162.192.0/18', '131.0.72.0/22', '141.101.64.0/18', '162.158.0.0/15', '172.64.0.0/13',
                    '173.245.48.0/20', '188.114.96.0/20', '190.93.240.0/20', '197.234.240.0/22', '198.41.128.0/17'],
            },
            v6: {
                target: 1204, maxLen: 48, peers: [280, 330],
                covering: ['2400:cb00::/32', '2405:8100::/32', '2405:b500::/32', '2606:4700::/32',
                    '2803:f800::/32', '2a06:98c0::/29', '2c0f:f248::/32'],
            },
            rpki: { Valid: 0.995, Invalid: 0 },
        },
        // Hypergiant shape: no transit, settlement-free peering with the clique.
        topology: {
            nodes: [
                { asn: 13335, type: 'origin', name: 'Cloudflare, Inc.' },
                { asn: 1299, type: 'tier1', name: 'Arelion Sweden AB' },
                { asn: 3356, type: 'tier1', name: 'Level 3 Parent, LLC' },
                { asn: 2914, type: 'tier1', name: 'NTT America, Inc.' },
                { asn: 174, type: 'tier1', name: 'Cogent Communications' },
                { asn: 6762, type: 'tier1', name: 'Telecom Italia Sparkle' },
                { asn: 3257, type: 'tier1', name: 'GTT Communications Inc.' },
                { asn: 6453, type: 'tier1', name: 'TATA Communications' },
            ],
            edges: [1299, 3356, 2914, 174, 6762, 3257, 6453].map((to) => ({ from: 13335, to, kind: 'peering' })),
        },
        geo: {
            US: 38.0, DE: 5.6, GB: 5.1, JP: 4.3, SG: 3.9, NL: 3.6, FR: 3.4, BR: 3.0, AU: 2.7, IN: 2.6,
            CA: 2.4, HK: 2.1, KR: 1.9, SE: 1.6, ES: 1.5, IT: 1.5, PL: 1.3, ZA: 1.2, AE: 1.1, MX: 1.1,
            AR: 0.9, CL: 0.8, ID: 0.8, TR: 0.8, CH: 0.7, FI: 0.6, NG: 0.6, KE: 0.5, EG: 0.5, NZ: 0.5,
            VN: 0.5, TH: 0.5, PH: 0.4, CO: 0.4, PE: 0.3,
        },
        upstreams: { count: 0, names: [] },
        peers: { count: 10412, names: ['Arelion', 'Lumen', 'NTT', 'Cogent', 'Sparkle', 'GTT', 'Tata Communications', 'Hurricane Electric', 'Google', 'Amazon'] },
        customers: { count: 412, names: ['Northwind Hosting', 'Contoso Cloud', 'Fabrikam Networks', 'Tailspin Telecom', 'Woodgrove Online', 'Litware ISP', 'Adatum Data', 'Proseware Net', 'Wingtip Fiber'] },
        ixps: [
            { ix: 'DE-CIX Frankfurt', city: 'Frankfurt', cc: 'DE', speed: 400000, rs: true },
            { ix: 'AMS-IX', city: 'Amsterdam', cc: 'NL', speed: 300000, rs: false },
            { ix: 'LINX LON1', city: 'London', cc: 'GB', speed: 300000, rs: true },
            { ix: 'Equinix Ashburn', city: 'Ashburn', cc: 'US', speed: 200000, rs: false },
            { ix: 'Equinix Singapore', city: 'Singapore', cc: 'SG', speed: 200000, rs: true },
            { ix: 'JPNAP Tokyo', city: 'Tokyo', cc: 'JP', speed: 100000, rs: false },
            { ix: 'France-IX Paris', city: 'Paris', cc: 'FR', speed: 100000, rs: true },
            { ix: 'IX.br São Paulo', city: 'São Paulo', cc: 'BR', speed: 100000, rs: true },
            { ix: 'HKIX', city: 'Hong Kong', cc: 'HK', speed: 100000, rs: false },
            { ix: 'Any2 Los Angeles', city: 'Los Angeles', cc: 'US', speed: 100000, rs: true },
            { ix: 'Equinix Sydney', city: 'Sydney', cc: 'AU', speed: 100000, rs: false },
            { ix: 'NAPAfrica Johannesburg', city: 'Johannesburg', cc: 'ZA', speed: 40000, rs: true },
            { ix: 'Netnod Stockholm', city: 'Stockholm', cc: 'SE', speed: 40000, rs: false },
            { ix: 'MIX Milan', city: 'Milan', cc: 'IT', speed: 40000, rs: true },
        ],
        traffic: { IPv4: 72.4, HTTP: 4.1, Desktop: 38.2, Human: 68.5 },
        quality: { download: 312, upload: 98, latency: 18, jitter: 4 },
        whois: {
            status: 'active', changed: '2017-02-17', abuse: 'abuse@cloudflare.com',
            raw: `ASNumber:       13335
ASName:         CLOUDFLARENET
ASHandle:       AS13335
RegDate:        2010-07-14
Updated:        2017-02-17
Ref:            https://rdap.arin.net/registry/autnum/13335

OrgName:        Cloudflare, Inc.
OrgId:          CLOUD14
Address:        101 Townsend Street
City:           San Francisco
StateProv:      CA
PostalCode:     94107
Country:        US
Ref:            https://rdap.arin.net/registry/entity/CLOUD14

OrgAbuseName:   Abuse
OrgAbuseEmail:  abuse@cloudflare.com
OrgAbuseRef:    https://rdap.arin.net/registry/entity/CLOUD14

OrgNOCName:     NOC
OrgNOCEmail:    noc@cloudflare.com`,
        },
    },
    64501: {
        asn: 64501, pill: 'Residential ISP', name: 'LINDENFELD-NET', org: 'Lindenfeld Netz GmbH (sample)', country: 'DE',
        rir: 'RIPE NCC', registered: '2004-03-18', rank: 2140, tier1: false,
        density: { abuse: 9.6, vpn: 1.4, proxy: 1.9 },
        drop: null,
        scale: { coneAsns: 7, coneAddresses: 126976, users: 410000 },
        prefixPlan: {
            v4: {
                target: 304, maxLen: 24, peers: [250, 320],
                covering: ['198.18.0.0/16', '198.19.0.0/17', '198.19.128.0/18', '198.19.192.0/20', '198.19.224.0/24'],
            },
            v6: { target: 21, maxLen: 48, peers: [230, 300], covering: ['2001:db8::/32'] },
            rpki: { Valid: 0.84, Invalid: 0 },
        },
        // Two regional upstreams, each buying transit from Tier 1s.
        topology: {
            nodes: [
                { asn: 64501, type: 'origin', name: 'Lindenfeld Netz GmbH (sample)' },
                { asn: 64502, type: 'intermediate', name: 'Rhein Transit (sample)' },
                { asn: 64503, type: 'intermediate', name: 'Alpen Carrier (sample)' },
                { asn: 1299, type: 'tier1', name: 'Arelion Sweden AB' },
                { asn: 3356, type: 'tier1', name: 'Level 3 Parent, LLC' },
                { asn: 174, type: 'tier1', name: 'Cogent Communications' },
                { asn: 6762, type: 'tier1', name: 'Telecom Italia Sparkle' },
            ],
            edges: [
                { from: 64501, to: 64502, kind: 'transit' },
                { from: 64501, to: 64503, kind: 'transit' },
                { from: 64502, to: 1299, kind: 'transit' },
                { from: 64502, to: 3356, kind: 'transit' },
                { from: 64503, to: 174, kind: 'transit' },
                { from: 64503, to: 6762, kind: 'transit' },
            ],
        },
        geo: { DE: 91.2, AT: 4.1, CH: 2.0, NL: 0.9, PL: 0.6, LU: 0.4, FR: 0.3, CZ: 0.2, DK: 0.2, BE: 0.1 },
        upstreams: { count: 2, names: ['Rhein Transit (sample)', 'Alpen Carrier (sample)'] },
        peers: { count: 186, names: ['Google', 'Hurricane Electric', 'Amazon', 'Meta', 'Akamai', 'Netflix', 'Microsoft', 'Cloudflare', 'Apple'] },
        customers: { count: 6, names: ['Stadtwerke Lindenfeld', 'Kreisnetz Süd', 'Talbrücke Media', 'Hofgut Hosting', 'Auenland IT', 'Rheinbogen Online'] },
        ixps: [
            { ix: 'DE-CIX Frankfurt', city: 'Frankfurt', cc: 'DE', speed: 100000, rs: true },
            { ix: 'DE-CIX Munich', city: 'Munich', cc: 'DE', speed: 20000, rs: true },
            { ix: 'DE-CIX Hamburg', city: 'Hamburg', cc: 'DE', speed: 10000, rs: true },
            { ix: 'BCIX', city: 'Berlin', cc: 'DE', speed: 10000, rs: true },
            { ix: 'VIX', city: 'Vienna', cc: 'AT', speed: 10000, rs: false },
            { ix: 'SwissIX', city: 'Zurich', cc: 'CH', speed: 10000, rs: true },
        ],
        traffic: { IPv4: 58.0, HTTP: 3.2, Desktop: 44.0, Human: 82.0 },
        quality: { download: 168, upload: 41, latency: 22, jitter: 6 },
        whois: {
            status: 'active', changed: '2025-06-02', abuse: 'abuse@lindenfeld-netz.example.net',
            raw: `aut-num:        AS64501
as-name:        LINDENFELD-NET
descr:          Lindenfeld Netz GmbH (sample record)
org:            ORG-LN1-SAMPLE
import:         from AS64502 accept ANY
import:         from AS64503 accept ANY
export:         to AS64502 announce AS-LINDENFELD
export:         to AS64503 announce AS-LINDENFELD
admin-c:        LN1-SAMPLE
tech-c:         LN1-SAMPLE
status:         ASSIGNED
mnt-by:         LINDENFELD-MNT
created:        2004-03-18T09:12:44Z
last-modified:  2025-06-02T14:30:11Z
source:         SAMPLE

organisation:   ORG-LN1-SAMPLE
org-name:       Lindenfeld Netz GmbH (sample)
country:        DE
abuse-c:        LNAB1-SAMPLE

% Abuse contact for 'AS64501' is 'abuse@lindenfeld-netz.example.net'`,
        },
    },
    65550: {
        asn: 65550, pill: 'Blocklisted', name: 'NULLROUTE-AS', org: 'Nullroute Hosting Ltd (sample)', country: 'SC',
        rir: 'RIPE NCC', registered: '2019-11-02', rank: 48210, tier1: false,
        density: { abuse: 1840, vpn: 820, proxy: 310 },
        drop: { since: '2024-05-12', reason: 'Bulletproof hosting, spam and malware operations' },
        scale: { coneAsns: 1, coneAddresses: 768, users: null },
        prefixPlan: {
            v4: {
                target: 41, maxLen: 28, peers: [40, 190],
                covering: ['192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24'],
            },
            v6: { target: 2, maxLen: 48, peers: [60, 140], covering: ['3fff:bad::/32'] },
            rpki: { Valid: 0.07, Invalid: 0.22 },
        },
        // A single fictional upstream chain.
        topology: {
            nodes: [
                { asn: 65550, type: 'origin', name: 'Nullroute Hosting Ltd (sample)' },
                { asn: 65551, type: 'intermediate', name: 'Ironbridge Transit (sample)' },
                { asn: 64510, type: 'intermediate', name: 'Kestrel Networks (sample)' },
                { asn: 1299, type: 'tier1', name: 'Arelion Sweden AB' },
            ],
            edges: [
                { from: 65550, to: 65551, kind: 'transit' },
                { from: 65551, to: 64510, kind: 'transit' },
                { from: 64510, to: 1299, kind: 'transit' },
            ],
        },
        geo: { NL: 31.5, RU: 17.8, US: 13.9, MD: 9.2, HK: 7.1, SC: 6.4, DE: 5.0, UA: 3.6, BG: 2.8, RO: 2.7 },
        upstreams: { count: 1, names: ['Ironbridge Transit (sample)'] },
        peers: { count: 4, names: ['Greyline Data (sample)', 'Moorgate Hosting (sample)', 'Sable Cloud (sample)', 'Quillon Net (sample)'] },
        customers: { count: 0, names: [] },
        ixps: [],
        traffic: { IPv4: 97.1, HTTP: 18.4, Desktop: 89.3, Human: 22.0 },
        quality: { download: 410, upload: 380, latency: 61, jitter: 18 },
        whois: {
            status: 'active', changed: '2025-09-14', abuse: 'abuse@nullroute-hosting.example.net',
            raw: `aut-num:        AS65550
as-name:        NULLROUTE-AS
descr:          Nullroute Hosting Ltd (sample record)
org:            ORG-NH1-SAMPLE
admin-c:        NH1-SAMPLE
tech-c:         NH1-SAMPLE
status:         ASSIGNED
mnt-by:         NULLROUTE-MNT
created:        2019-11-02T17:45:03Z
last-modified:  2025-09-14T02:11:58Z
source:         SAMPLE

organisation:   ORG-NH1-SAMPLE
org-name:       Nullroute Hosting Ltd (sample)
country:        SC
abuse-c:        NHAB1-SAMPLE

% Abuse contact for 'AS65550' is 'abuse@nullroute-hosting.example.net'`,
        },
    },
};
const SAMPLE_LIST = Object.values(SAMPLES);

// ASNConnectivity's cache shape: { [numeric asn string]: { graph } }, where
// graph is the /api/asn-connectivity body.
const CONNECTIVITY_INFOS = Object.fromEntries(SAMPLE_LIST.map((s) => [
    String(s.asn), { graph: { origin: s.asn, ...s.topology } },
]));

// ---- input + sample switching ----------------------------------------------

const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';
const FAKE_LATENCY_MS = 400;
const FAKE_REST_LATENCY_MS = 500;

const reputationOn = ref(true);
const active = ref(13335);
// The pill reflects the pick at once; `active` swaps after the fake latency.
const target = ref(13335);
const query = ref('AS13335');
const loading = ref(false);
const errorMsg = ref('');
const rawOpen = ref(false);
const ixpOpen = ref(false);
let timer = null;
let restTimer = null;

const pick = (asn) => {
    if (loading.value || asn === active.value) return;
    errorMsg.value = '';
    query.value = `AS${asn}`;
    target.value = asn;
    loading.value = true;
    timer = setTimeout(() => {
        active.value = asn;
        rawOpen.value = false;
        ixpOpen.value = false;
        resetPrefixView();
        loading.value = false;
    }, FAKE_LATENCY_MS);
};

const onSubmit = () => {
    const match = /^\s*(?:AS)?\s*(\d+)\s*$/i.exec(query.value);
    if (!match) {
        errorMsg.value = 'Enter an AS number, e.g. AS13335.';
        return;
    }
    const asn = Number(match[1]);
    if (!SAMPLES[asn]) {
        errorMsg.value = 'This demo only has sample data for AS13335, AS64501 and AS65550.';
        return;
    }
    pick(asn);
};

onBeforeUnmount(() => {
    clearTimeout(timer);
    clearTimeout(restTimer);
});

// ---- derived view state ----------------------------------------------------

const sample = computed(() => SAMPLES[active.value]);
const nf = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }));
const compact = computed(() => new Intl.NumberFormat(locale.value, { notation: 'compact', maximumFractionDigits: 1 }));

// Covering v4 blocks never overlap, so their sizes sum to the announced space.
const announcedIpv4 = computed(() => sample.value.prefixPlan.v4.covering
    .reduce((sum, cidr) => sum + 2 ** (32 - Number(cidr.split('/')[1])), 0));

// Log axis over the AS/baseline ratio: 0 → 0%, 1× → ~15%, 100× → 100%.
const RATIO_MAX = 100;
const ratioPos = (ratio) => Math.min(100, (Math.log10(1 + ratio) / Math.log10(1 + RATIO_MAX)) * 100);
const BASELINE_POS = ratioPos(1);
// Edge labels anchor inward so they never poke past the track.
const AXIS_TICKS = [
    { label: '0', pos: 0, shift: '' },
    { label: '1×', pos: BASELINE_POS, shift: '-translate-x-1/2' },
    { label: '10×', pos: ratioPos(10), shift: '-translate-x-1/2' },
    { label: '100×', pos: 100, shift: '-translate-x-full' },
];

const densityTone = (ratio) => (ratio < 1.5 ? 'ok-fast' : ratio < 5 ? 'ok-slow' : 'fail');

const ratioNote = (ratio) => {
    if (ratio < 0.95) return 'below baseline';
    if (ratio < 1.05) return 'at baseline';
    return `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× baseline`;
};

const METER_LABELS = { abuse: 'Abuse IP density', vpn: 'VPN exit density', proxy: 'Public proxy density' };

const meters = computed(() => Object.entries(METER_LABELS).map(([key, label]) => {
    const value = sample.value.density[key];
    const ratio = value / BASELINES[key];
    return {
        key, label, value,
        baseline: BASELINES[key],
        pos: Math.max(ratioPos(ratio), 1),
        tone: densityTone(ratio),
        note: ratioNote(ratio),
    };
}));

const abuseListed = computed(() => Math.round((sample.value.density.abuse * announcedIpv4.value) / 10000));

// Verdict: DROP listing wins; any density ≥ 1.5× baseline → Watch.
const VERDICTS = {
    clean: { label: 'Clean', variant: 'success', icon: ShieldCheck },
    watch: { label: 'Watch', variant: 'outline', icon: ShieldAlert, extra: 'border-transparent bg-warning text-warning-foreground shadow' },
    blocklisted: { label: 'Blocklisted', variant: 'destructive', icon: ShieldX },
};
const verdict = computed(() => {
    if (sample.value.drop) return VERDICTS.blocklisted;
    return meters.value.some((m) => m.tone !== 'ok-fast') ? VERDICTS.watch : VERDICTS.clean;
});

// Registration fields; AS number, name, org and country already sit in the
// hero header right above, so they are left out here.
const whoisFields = computed(() => {
    const s = sample.value;
    return [
        { label: 'Registry', value: s.rir },
        { label: 'Status', value: s.whois.status },
        { label: 'Registered', value: formatIsoDate(s.registered, locale.value) },
        { label: 'Last changed', value: formatIsoDate(s.whois.changed, locale.value) },
        { label: 'Abuse contact', value: s.whois.abuse, mono: true, wide: true },
    ];
});

// Share of the full 2^32 IPv4 space.
const IPV4_SPACE = 2 ** 32;
const scaleTiles = computed(() => {
    const s = sample.value.scale;
    const share = new Intl.NumberFormat(locale.value, { maximumSignificantDigits: 2 })
        .format((announcedIpv4.value / IPV4_SPACE) * 100);
    return [
        { label: 'Global rank', value: `#${nf.value.format(sample.value.rank)}`, sub: 'CAIDA AS Rank' },
        { label: 'Customer cone · ASes', value: nf.value.format(s.coneAsns) },
        { label: 'Customer cone · addresses', value: compact.value.format(s.coneAddresses) },
        { label: 'Prefixes v4 · v6', value: `${nf.value.format(prefixes.value.v4.length)} · ${nf.value.format(prefixes.value.v6.length)}` },
        { label: 'Announced IPv4', value: nf.value.format(announcedIpv4.value), sub: `≈${share}% of the IPv4 internet` },
        { label: 'Estimated users', value: s.users == null ? '—' : compact.value.format(s.users) },
    ];
});

// DataPairBar translates its own labels (ipInfos.ASNInfo.*).
const trafficPairs = computed(() => {
    const tr = sample.value.traffic;
    const pair = (left, right, value) => ({
        leftLabel: `${left}_Pct`, leftValue: value,
        rightLabel: `${right}_Pct`, rightValue: Math.round((100 - value) * 10) / 10,
    });
    return [
        pair('IPv4', 'IPv6', tr.IPv4),
        pair('HTTP', 'HTTPS', tr.HTTP),
        pair('Desktop', 'Mobile', tr.Desktop),
        pair('Human', 'Bot', tr.Human),
    ];
});

const qualityRows = computed(() => {
    const q = sample.value.quality;
    return [
        { label: 'Download', value: `${q.download} Mbps` },
        { label: 'Upload', value: `${q.upload} Mbps` },
        { label: 'Latency', value: `${q.latency} ms` },
        { label: 'Jitter', value: `${q.jitter} ms` },
    ];
});

const topCountries = computed(() => {
    const rows = Object.entries(sample.value.geo).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = rows[0]?.[1] || 1;
    return rows.map(([cc, share]) => ({ cc, pct: share.toFixed(1), bar: Math.max((share / max) * 100, 2) }));
});

// ---- mock prefix generator -------------------------------------------------
// Seeded per ASN so rows never reshuffle. Covering prefixes are announced
// as-is; random aligned more-specifics (biased to maxLen) fill each block.
// Addresses are BigInt for both families so one code path serves v4 and v6.

const mulberry32 = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const parseV4 = (ip) => ip.split('.').reduce((acc, octet) => (acc << 8n) + BigInt(octet), 0n);
const formatV4 = (addr) => [24n, 16n, 8n, 0n].map((shift) => (addr >> shift) & 255n).join('.');

const parseV6 = (ip) => {
    const [head, tail = ''] = ip.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    const groups = [...headGroups, ...Array(8 - headGroups.length - tailGroups.length).fill('0'), ...tailGroups];
    return groups.reduce((acc, group) => (acc << 16n) + BigInt(parseInt(group, 16)), 0n);
};

// RFC 5952 form: lowercase, longest zero run (≥ 2 groups) compressed.
const formatV6 = (addr) => {
    const groups = Array.from({ length: 8 }, (_, i) => Number((addr >> BigInt(112 - i * 16)) & 0xffffn));
    let best = { start: -1, len: 0 };
    for (let i = 0; i < 8;) {
        if (groups[i] !== 0) { i += 1; continue; }
        let j = i;
        while (j < 8 && groups[j] === 0) j += 1;
        if (j - i > best.len) best = { start: i, len: j - i };
        i = j;
    }
    const hex = groups.map((g) => g.toString(16));
    if (best.len < 2) return hex.join(':');
    return `${hex.slice(0, best.start).join(':')}::${hex.slice(best.start + best.len).join(':')}`;
};

const FAMILY_CODEC = {
    v4: { bits: 32, parse: parseV4, format: formatV4 },
    v6: { bits: 128, parse: parseV6, format: formatV6 },
};

const pickRpki = (rand, weights) => {
    const roll = rand();
    if (roll < weights.Valid) return 'Valid';
    if (roll < weights.Valid + weights.Invalid) return 'Invalid';
    return 'Unknown';
};

const generateFamily = (fam, plan, rpkiWeights, rand) => {
    const { bits, parse, format } = FAMILY_CODEC[fam];
    const seen = new Map();
    const add = (addr, len, covering) => {
        const key = `${addr}/${len}`;
        if (!seen.has(key)) seen.set(key, { addr, len, covering });
    };
    const roots = plan.covering.map((cidr) => {
        const [ip, len] = cidr.split('/');
        return { addr: parse(ip), len: Number(len) };
    });
    roots.forEach((root) => add(root.addr, root.len, true));

    // Bounded attempts: small blocks saturate and their picks are dropped.
    for (let attempts = 0; seen.size < plan.target && attempts < plan.target * 50; attempts += 1) {
        const root = roots[Math.floor(rand() * roots.length)];
        if (root.len >= plan.maxLen) continue;
        const len = rand() < 0.65 ? plan.maxLen : root.len + 1 + Math.floor(rand() * (plan.maxLen - root.len));
        const index = BigInt(Math.floor(rand() * 2 ** (len - root.len)));
        add(root.addr + (index << BigInt(bits - len)), len, false);
    }

    const [peerMin, peerMax] = plan.peers;
    return [...seen.values()]
        .sort((a, b) => (a.addr < b.addr ? -1 : a.addr > b.addr ? 1 : a.len - b.len))
        .map((entry) => ({
            prefix: `${format(entry.addr)}/${entry.len}`,
            fam,
            len: entry.len,
            rpki: pickRpki(rand, rpkiWeights),
            // Covering routes reach (almost) every collector.
            peers: entry.covering ? peerMax - Math.floor(rand() * 6) : peerMin + Math.floor(rand() * (peerMax - peerMin)),
        }));
};

const prefixCache = new Map();
const getPrefixes = (asn) => {
    if (!prefixCache.has(asn)) {
        const { prefixPlan } = SAMPLES[asn];
        const rand = mulberry32(asn);
        prefixCache.set(asn, {
            v4: generateFamily('v4', prefixPlan.v4, prefixPlan.rpki, rand),
            v6: generateFamily('v6', prefixPlan.v6, prefixPlan.rpki, rand),
        });
    }
    return prefixCache.get(asn);
};

const prefixes = computed(() => getPrefixes(active.value));
const allRows = computed(() => [...prefixes.value.v4, ...prefixes.value.v6]);

// ---- routing (RPKI) summary ------------------------------------------------

const RPKI_STATES = [
    { key: 'Valid', dot: 'bg-success' },
    { key: 'Invalid', dot: 'bg-destructive' },
    { key: 'Unknown', dot: 'bg-muted-foreground/40' },
];
const RPKI_DOT = Object.fromEntries(RPKI_STATES.map((s) => [s.key, s.dot]));

const rpki = computed(() => {
    const counts = { Valid: 0, Invalid: 0, Unknown: 0 };
    allRows.value.forEach((row) => { counts[row.rpki] += 1; });
    const total = allRows.value.length || 1;
    const pct = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, (n / total) * 100]));
    return { counts, pct, validPct: Math.round(pct.Valid * 10) / 10 };
});

// ---- prefix list: family filter + paging -----------------------------------
// The first 10 rows ship with the page; the rest arrives in one request on
// the first "Show more" (faked with a short spinner), then pages by 50.

const FIRST_ROWS = 10;
const PAGE = 50;
const FAMILY_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'v4', label: 'IPv4' },
    { value: 'v6', label: 'IPv6' },
];

const familyFilter = ref('all');
const limit = ref(FIRST_ROWS);
const restState = ref('idle');

const resetPrefixView = () => {
    clearTimeout(restTimer);
    familyFilter.value = 'all';
    limit.value = FIRST_ROWS;
    restState.value = 'idle';
};

const filtered = computed(() => (familyFilter.value === 'all'
    ? allRows.value
    : allRows.value.filter((row) => row.fam === familyFilter.value)));

const shownRows = computed(() => filtered.value.slice(0, limit.value));

watch(familyFilter, () => { limit.value = FIRST_ROWS; });

const showMore = () => {
    if (restState.value === 'done') {
        limit.value += PAGE;
        return;
    }
    restState.value = 'loading';
    restTimer = setTimeout(() => {
        restState.value = 'done';
        limit.value += PAGE;
    }, FAKE_REST_LATENCY_MS);
};

// v4 → address count; v6 → how many /48s the prefix spans.
const sizeLabel = (row) => {
    if (row.fam === 'v4') return nf.value.format(2 ** (32 - row.len));
    return row.len <= 48 ? `${nf.value.format(2 ** (48 - row.len))} × /48` : `/${row.len}`;
};

const filteredText = () => filtered.value.map((row) => row.prefix).join('\n');

const copyFiltered = async () => {
    try {
        await navigator.clipboard.writeText(filteredText());
        store.setAlert(true, 'text-success', `${nf.value.format(filtered.value.length)} prefixes copied to the clipboard.`, 'Copied');
    } catch (error) {
        console.error('Prefix list copy failed:', error);
    }
};

const downloadFiltered = () => {
    const url = URL.createObjectURL(new Blob([`${filteredText()}\n`], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `AS${sample.value.asn}-prefixes.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

// ---- connectivity ----------------------------------------------------------

const NAME_PREVIEW = 8;

const neighbourGroups = computed(() => [
    { key: 'up', label: 'Upstreams', ...sample.value.upstreams },
    { key: 'peer', label: 'Peers', ...sample.value.peers },
    { key: 'cust', label: 'Customers', ...sample.value.customers },
]);

// PeeringDB port speeds are Mbps.
const formatSpeed = (mbps) => (mbps >= 1000 ? `${nf.value.format(mbps / 1000)}G` : `${nf.value.format(mbps)}M`);

// ---- world map -------------------------------------------------------------

const mapCanvas = ref(null);

// sqrt keeps a dominant country from washing every other one out.
const mapOptions = computed(() => {
    const geo = sample.value.geo;
    const max = Math.max(...Object.values(geo));
    return {
        values: Object.fromEntries(Object.entries(geo).map(([cc, share]) => [cc, Math.sqrt(share / max)])),
        lang: locale.value,
        colorFrom: '#7dd3fc',
        colorTo: '#075985',
        tooltipOnMissing: false,
        formatValue: (_value, cc) => (geo[cc] == null ? '' : ` ${geo[cc].toFixed(1)}% of announced IPv4`),
    };
});

const { ready: mapReady, failed: mapFailed } = useWorldMapChart({
    canvas: mapCanvas, visible: true, options: mapOptions, theme: () => store.isDarkMode,
});
</script>

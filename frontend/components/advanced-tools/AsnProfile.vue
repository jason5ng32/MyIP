<!-- ASN Profile (advanced tool, slug `asn`): everything known about one AS
     number, from one request to /api/asn-profile (the backend gathers every
     source and answers once; see server/asn-profile.js). The page shows one
     loading state, then renders whole; a section whose source had nothing or
     failed is simply left out.
     Order: hero (identity, key facts, registration) beside a compact
     reputation card when there is one → traffic & quality beside top
     countries → prefixes → connectivity (+ customer cone, topology) →
     peering & facilities (PeeringDB, self-reported).
     One source per concept: relationships = local CAIDA (graph, counts and
     lists alike); prefixes, addresses and RPKI = the pfx2as list; identity =
     Radar → RDAP → ASRank. The query rides the URL as `?q=` (shareable,
     written back on every run). Shaping lives in utils/ip/asn-profile-view.js. -->
<template>
    <div class="my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('asnprofile.Note') }}</p>

        <!-- Input row -->
        <div class="space-y-2">
            <Label for="asnProfileQuery">{{ t('asnprofile.InputLabel') }}</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="asnProfileQuery" name="asnProfileQuery" class="font-mono"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore
                    data-lpignore="true" :placeholder="t('asnprofile.Placeholder')" v-model="query"
                    :disabled="loading" @keyup.enter="onSubmit" :aria-invalid="errorMsg !== ''" />
                <Button variant="action" class="cursor-pointer" :disabled="loading || !query.trim()"
                    :aria-label="t('asnprofile.Lookup')" @click="onSubmit">
                    <Spinner v-if="loading" />
                    <Search v-else class="size-4 shrink-0" />
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- ============ Loading: one placeholder for the whole page ============ -->
        <div v-if="state === 'loading'" class="space-y-4" aria-busy="true">
            <div class="rounded-lg border bg-card p-4 md:p-5 space-y-4">
                <div class="font-mono text-3xl md:text-4xl font-semibold tracking-tight">AS{{ profileAsn }}</div>
                <div class="h-4 w-56 max-w-full rounded bg-muted animate-pulse" />
                <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                    <div v-for="i in 4" :key="i" class="h-16 rounded-md bg-muted/60 animate-pulse" />
                </div>
                <div class="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                    <div v-for="i in 6" :key="i" class="h-4 rounded bg-muted animate-pulse" />
                </div>
            </div>
            <div class="rounded-lg border bg-card p-4 space-y-3">
                <div class="h-5 w-40 rounded bg-muted animate-pulse" />
                <div v-for="i in 4" :key="i" class="h-3.5 rounded bg-muted animate-pulse" />
            </div>
        </div>

        <!-- The request itself failed (network, or every source down) -->
        <p v-else-if="state === 'error'" class="rounded-lg border bg-card p-4 text-sm text-destructive">
            {{ t('asnprofile.loadError') }}</p>

        <div v-else-if="state === 'done'" class="space-y-4">
            <!-- Hero row: the hero alone, or hero 2 : reputation 1 from lg up -->
            <div class="grid gap-4" :class="reputation && 'lg:grid-cols-3'">
                <!-- ============ Hero: identity → key facts → registration ============ -->
                <div class="rounded-lg border bg-card p-4 md:p-5 space-y-4 min-w-0" :class="reputation && 'lg:col-span-2'">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-1">
                            <div class="font-mono text-3xl md:text-4xl font-semibold tracking-tight">AS{{ profileAsn }}</div>
                            <div v-if="identity.name || identity.org" class="text-sm text-muted-foreground wrap-break-word">
                                <span v-if="identity.name" class="font-medium text-foreground">{{ identity.name }}</span>
                                <template v-if="identity.name && identity.org"> · </template>{{ identity.org }}
                            </div>
                        </div>
                        <span v-if="identity.country" class="inline-flex shrink-0 items-center gap-1.5 text-sm">
                            <Icon :icon="'circle-flags:' + identity.country.toLowerCase()" class="size-4 shrink-0" />
                            {{ getCountryName(identity.country, locale) }}
                        </span>
                    </div>

                    <!-- Tier 1 + PeeringDB network types, scope and website; each only when present -->
                    <div v-if="isTier1 || peerHero.types.length || peerHero.scope || peerHero.website"
                        class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                        <div v-if="isTier1 || peerHero.types.length" class="flex flex-wrap items-center gap-1.5">
                            <Badge v-if="isTier1" variant="secondary">{{ t('asnprofile.tier1') }}</Badge>
                            <Badge v-for="type in peerHero.types" :key="type" variant="outline" class="font-normal">
                                {{ enumLabel('types', type) }}</Badge>
                        </div>
                        <span v-if="peerHero.scope" class="inline-flex items-center gap-1.5 text-muted-foreground"
                            :title="t('asnprofile.peering.scope')">
                            <Globe class="size-3.5 shrink-0" />{{ enumLabel('scopes', peerHero.scope) }}</span>
                        <a v-if="peerHero.website" :href="peerHero.website.href" target="_blank" rel="noopener"
                            class="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                            :title="peerHero.website.href" :aria-label="t('asnprofile.peering.website')">
                            <ExternalLink class="size-3.5 shrink-0" /><span class="truncate">{{ peerHero.website.label }}</span></a>
                    </div>

                    <!-- Key facts -->
                    <div v-if="facts.length" class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                        <div v-for="fact in facts" :key="fact.key" class="rounded-md bg-muted/40 p-3 min-w-0">
                            <div class="text-lg font-semibold tabular-nums truncate">{{ fact.value }}</div>
                            <div class="text-xs text-muted-foreground">{{ fact.label }}</div>
                            <div v-if="fact.sub" class="text-[11px] text-muted-foreground/80">{{ fact.sub }}</div>
                        </div>
                    </div>

                    <!-- Registration (RDAP autnum): label / value pairs, two columns
                         from sm up; name, org and country already sit above. -->
                    <template v-if="registration.length || rawRecord">
                        <Separator />
                        <div class="space-y-3">
                            <h3 class="text-xs font-medium text-muted-foreground">{{ t('asnprofile.registration.title') }}</h3>
                            <dl v-if="registration.length" class="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                                <div v-for="field in registration" :key="field.key" class="flex min-w-0 items-baseline gap-3"
                                    :class="field.wide && 'sm:col-span-2'">
                                    <dt class="w-28 shrink-0 text-xs text-muted-foreground">{{ t(`asnprofile.registration.${field.key}`) }}</dt>
                                    <dd class="min-w-0 text-sm wrap-break-word" :class="field.mono && 'font-mono text-xs'">{{ field.value }}</dd>
                                </div>
                            </dl>

                            <!-- Raw record, collapsed. Trigger, copy button and <pre>
                                 share the px-3 edges; hover only recolours text. -->
                            <Collapsible v-if="rawRecord" v-model:open="rawOpen" class="rounded-md border">
                                <div class="flex items-center gap-2 px-3">
                                    <CollapsibleTrigger>
                                        <button type="button"
                                            class="group flex flex-1 items-center gap-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground data-[state=open]:text-foreground cursor-pointer">
                                            <ChevronRight class="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                            {{ t('asnprofile.registration.raw') }}
                                        </button>
                                    </CollapsibleTrigger>
                                    <CopyButton :value="() => rawRecord" :aria-label="t('asnprofile.registration.copyRaw')"
                                        class="-mr-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                                        icon-class="size-3.5" />
                                </div>
                                <CollapsibleContent>
                                    <pre class="mx-3 mb-3 max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{{ rawRecord }}</pre>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </template>
                </div>

                <!-- ============ Reputation (backend sends it on the official site only) ============ -->
                <div v-if="reputation" class="rounded-lg border bg-card p-4 space-y-4 min-w-0">
                    <div class="space-y-1">
                        <div class="flex items-start justify-between gap-2">
                            <h2 class="text-base font-semibold">{{ t('asnprofile.reputation.title') }}</h2>
                            <Badge variant="outline" class="shrink-0 text-[10px] font-medium text-muted-foreground">
                                {{ t('asnprofile.reputation.source') }}</Badge>
                        </div>
                        <p class="text-xs text-muted-foreground leading-relaxed">{{ t('asnprofile.reputation.desc') }}</p>
                    </div>

                    <!-- Verdict from the scoring level -->
                    <Badge v-if="verdict" :variant="verdict.variant" class="gap-1" :class="verdict.extra">
                        <component :is="verdict.icon" class="size-3.5" />{{ verdict.label }}
                    </Badge>

                    <!-- Abuse / VPN as a multiple of the baseline: log bar, tick = 1× -->
                    <div v-for="meter in meters" :key="meter.key">
                        <div class="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                            <span>{{ t(`asnprofile.reputation.${meter.key}`) }}</span>
                            <span class="text-xs font-medium tabular-nums" :class="textClass(meter.tone)">{{ ratioNote(meter.ratio) }}</span>
                        </div>
                        <div class="relative mt-1.5 h-2 rounded-full bg-muted">
                            <div class="absolute inset-y-0 left-0 rounded-full" :class="dotClass(meter.tone)"
                                :style="{ width: meter.pos + '%' }" />
                            <div class="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-foreground/70"
                                :style="{ left: BASELINE_POSITION + '%' }" />
                        </div>
                    </div>

                    <!-- Proxies detected: the listed count, when there is one -->
                    <div v-if="proxyListed !== null" class="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                        <span>{{ t('asnprofile.reputation.proxy') }}</span>
                        <span class="font-medium tabular-nums">{{ nf.format(proxyListed) }}</span>
                    </div>

                    <!-- Evidence tag, only when listed -->
                    <div v-if="reputation.dropListed"
                        class="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                        <ShieldX class="size-3.5 shrink-0" />{{ t('asnprofile.reputation.drop') }}
                    </div>

                    <p v-if="reputationDate" class="text-[11px] text-muted-foreground">
                        {{ t('asnprofile.reputation.updated', { date: reputationDate }) }}</p>
                </div>
            </div>

            <!-- Unknown AS: one notice instead of a column of empty cards -->
            <p v-if="empty" class="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                {{ t('asnprofile.noData', { asn: profileAsn }) }}</p>

            <template v-else>
                <!-- Traffic | distribution: one row from lg up; a lone card spans it -->
                <div v-if="trafficVisible || topCountries.length" class="grid gap-4 lg:grid-cols-2">
                    <!-- ============ Traffic profile & connection quality ============ -->
                    <div v-if="trafficVisible" class="rounded-lg border bg-card p-4 space-y-3 min-w-0"
                        :class="!topCountries.length && 'lg:col-span-2'">
                        <div class="space-y-1">
                            <h2 class="text-base font-semibold">{{ t('asnprofile.traffic.title') }}</h2>
                            <p class="text-xs text-muted-foreground leading-relaxed">{{ t('asnprofile.traffic.desc') }}</p>
                        </div>
                        <!-- Stacked: reads at half width; quality keeps its own two columns -->
                        <div class="space-y-4">
                            <AsnTrafficShares :info="radar" />
                            <AsnConnectionQuality :info="radar" />
                        </div>
                    </div>

                    <!-- ============ Global IP distribution (top countries) ============ -->
                    <div v-if="topCountries.length" class="rounded-lg border bg-card p-4 space-y-3 min-w-0"
                        :class="!trafficVisible && 'lg:col-span-2'">
                        <div class="space-y-1">
                            <h2 class="text-base font-semibold">{{ t('asnprofile.map.title') }}</h2>
                            <p class="text-xs text-muted-foreground leading-relaxed">{{ t('asnprofile.map.desc') }}</p>
                        </div>
                        <ul class="space-y-1.5">
                            <li v-for="row in topCountries" :key="row.cc" class="flex items-center gap-2 text-sm">
                                <Icon :icon="'circle-flags:' + row.cc.toLowerCase()" class="size-4 shrink-0" />
                                <span class="w-32 truncate">{{ getCountryName(row.cc, locale) }}</span>
                                <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div class="h-full rounded-full bg-info" :style="{ width: row.bar + '%' }" />
                                </div>
                                <span class="w-12 text-right font-mono text-xs tabular-nums">{{ nf.format(row.pct) }}%</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- ============ Announced prefixes (+ RPKI routing summary) ============ -->
                <div v-if="rows.length" class="rounded-lg border bg-card p-4 space-y-4 min-w-0">
                    <div class="space-y-1">
                        <h2 class="text-base font-semibold">{{ t('asnprofile.prefixes.title') }}</h2>
                        <div class="text-xs text-muted-foreground tabular-nums">
                            {{ t('asnprofile.prefixes.counts', { v4: nf.format(counts.v4), v6: nf.format(counts.v6) }) }}</div>
                        <p class="text-xs text-muted-foreground leading-relaxed">{{ t('asnprofile.prefixes.desc') }}</p>
                    </div>

                    <!-- RPKI route-origin validation -->
                    <div v-if="rpki" class="space-y-1.5">
                        <div class="flex items-baseline justify-between gap-2 text-sm">
                            <span>{{ t('asnprofile.prefixes.rpki') }}</span>
                            <span class="font-mono tabular-nums">{{ t('asnprofile.prefixes.rpkiValid', { pct: nf.format(rpki.validPct) }) }}</span>
                        </div>
                        <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                            <div v-for="rpkiState in RPKI_STATES" :key="rpkiState" :class="RPKI_DOT[rpkiState]"
                                :style="{ width: rpki.pct[rpkiState] + '%' }" />
                        </div>
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span v-for="rpkiState in RPKI_STATES" :key="rpkiState" class="inline-flex items-center gap-1.5">
                                <span class="size-2 rounded-full" :class="RPKI_DOT[rpkiState]" />
                                <span class="text-muted-foreground">{{ t(`asnprofile.rpki.${rpkiState}`) }}</span>
                                <span class="font-medium tabular-nums">{{ nf.format(rpki.counts[rpkiState]) }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- Family filter + export of the filtered set -->
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <ToggleGroup :model-value="familyFilter" type="single" variant="outline" :spacing="2"
                            class="flex-wrap justify-start" :aria-label="t('asnprofile.prefixes.family')"
                            @update:model-value="(v) => v && (familyFilter = v)">
                            <ToggleGroupItem v-for="opt in familyOptions" :key="opt.value" :value="opt.value"
                                :class="tagClass">{{ opt.label }}</ToggleGroupItem>
                        </ToggleGroup>
                        <div class="flex items-center gap-1">
                            <CopyButton :value="filteredText" :tooltip="t('asnprofile.prefixes.copy')"
                                tooltip-side="top" icon-class="size-3.5" />
                            <Button variant="ghost" size="sm" class="h-7 cursor-pointer gap-1.5 text-xs"
                                :disabled="!filtered.length" @click="downloadFiltered">
                                <Download class="size-3.5" />{{ t('asnprofile.prefixes.download') }}</Button>
                        </div>
                    </div>

                    <!-- Prefix table; horizontal overflow stays in here -->
                    <div class="overflow-x-auto rounded-lg border">
                        <table class="w-full text-sm">
                            <thead class="bg-muted/40">
                                <tr class="text-left text-xs text-muted-foreground">
                                    <th scope="col" class="px-3 py-2 font-medium">{{ t('asnprofile.prefixes.prefix') }}</th>
                                    <th scope="col" class="px-3 py-2 font-medium text-right">{{ t('asnprofile.prefixes.size') }}</th>
                                    <th scope="col" class="px-3 py-2 font-medium">{{ t('asnprofile.prefixes.rpkiColumn') }}</th>
                                    <th scope="col" class="px-3 py-2 font-medium text-right">{{ t('asnprofile.prefixes.visibility') }}</th>
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
                                            {{ t(`asnprofile.rpki.${row.rpki}`) }}
                                        </span>
                                    </td>
                                    <td class="px-3 py-1.5 text-right font-mono text-xs tabular-nums">{{ nf.format(row.peers) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Paging over the one response: 10 rows first, then +50 a click -->
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs text-muted-foreground tabular-nums">
                            {{ t('asnprofile.prefixes.shown', { shown: nf.format(shownRows.length), total: nf.format(filtered.length) }) }}</span>
                        <Button v-if="filtered.length > limit" variant="outline" size="sm"
                            class="h-7 cursor-pointer text-xs" @click="limit += PAGE">
                            {{ t('asnprofile.prefixes.showMore', { count: nf.format(Math.min(PAGE, filtered.length - limit)) }) }}</Button>
                    </div>
                </div>

                <!-- ============ Connectivity (+ customer cone, topology) ============ -->
                <div v-if="graph || cone !== null" class="rounded-lg border bg-card p-4 space-y-4 min-w-0">
                    <div class="space-y-1">
                        <h2 class="text-base font-semibold">{{ t('asnprofile.connectivity.title') }}</h2>
                        <p class="text-xs text-muted-foreground leading-relaxed">{{ t('asnprofile.connectivity.desc') }}</p>
                    </div>
                    <!-- One row: the three neighbour counts (CAIDA, same reading as the
                         graph and lists below) + the ASRank customer-cone size -->
                    <div class="grid grid-cols-2 gap-2.5 text-center sm:grid-cols-4">
                        <template v-if="graph">
                            <div v-for="group in groups" :key="group.kind" class="rounded-md bg-muted/40 px-2 py-2 min-w-0">
                                <div class="text-lg font-semibold tabular-nums">{{ nf.format(group.count) }}</div>
                                <div class="text-xs text-muted-foreground">{{ t(`asnprofile.connectivity.${group.kind}`) }}</div>
                            </div>
                        </template>
                        <div v-if="cone !== null" class="rounded-md bg-muted/40 px-2 py-2 min-w-0">
                            <div class="text-lg font-semibold tabular-nums">{{ nf.format(cone) }}</div>
                            <div class="text-xs text-muted-foreground">{{ t('asnprofile.connectivity.cone') }}</div>
                        </div>
                    </div>

                    <!-- Upstream topology: the IP-card component on its cache
                         contract, borderless (this card draws the border) and
                         without its drawer (the page is a drawer already). -->
                    <ASNConnectivity v-if="hasTopology(graph)" :asn="String(profileAsn)"
                        :asnConnectivityInfos="connectivityInfos" :expandable="false" :bordered="false" />

                    <div v-if="graph" class="grid gap-4 md:grid-cols-3">
                        <div v-for="group in groups" :key="group.kind" class="min-w-0">
                            <div class="text-xs text-muted-foreground mb-1">{{ t(`asnprofile.connectivity.${group.kind}`) }}</div>
                            <div v-if="group.names.length" class="flex flex-wrap gap-1.5">
                                <Badge v-for="item in group.names" :key="item.asn" variant="outline"
                                    class="font-normal max-w-full" :title="`AS${item.asn}`">
                                    <span class="min-w-0 truncate">{{ item.label }}</span></Badge>
                                <span v-if="group.more" class="self-center text-xs text-muted-foreground">
                                    +{{ nf.format(group.more) }}</span>
                            </div>
                            <p v-else class="text-xs text-muted-foreground">{{ t('asnprofile.connectivity.none') }}</p>
                        </div>
                    </div>
                </div>

                <!-- ============ Peering & facilities (PeeringDB, self-reported) ============ -->
                <div v-if="peeringCard" class="rounded-lg border bg-card p-4 space-y-4 min-w-0">
                    <div class="space-y-1">
                        <h2 class="text-base font-semibold">{{ t('asnprofile.peering.title') }}</h2>
                        <p class="text-xs text-muted-foreground leading-relaxed">{{ t('asnprofile.peering.desc') }}</p>
                    </div>

                    <!-- Policy / traffic level / ratio / IRR as-set -->
                    <dl v-if="peerFacts.length" class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                        <div v-for="fact in peerFacts" :key="fact.key" class="rounded-md bg-muted/40 p-3 min-w-0">
                            <dt class="text-xs text-muted-foreground">{{ t(`asnprofile.peering.${fact.key}`) }}</dt>
                            <dd class="mt-0.5 text-sm font-medium wrap-break-word" :class="fact.mono && 'font-mono text-xs'">
                                {{ fact.label }}</dd>
                        </div>
                    </dl>

                    <!-- IX | facility lists: side by side from lg up; a lone list spans the row -->
                    <div v-if="exchanges.length || facilities.length" class="grid gap-4"
                        :class="exchanges.length && facilities.length && 'lg:grid-cols-2'">
                        <!-- Exchanges: flag, name, city, RS badge, port capacity summed per IX -->
                        <section v-if="exchanges.length" class="space-y-2 min-w-0">
                            <h3 class="text-xs font-medium text-muted-foreground">
                                {{ t('asnprofile.peering.exchanges', { count: nf.format(exchanges.length) }) }}</h3>
                            <ul class="rounded-lg border bg-card divide-y">
                                <li v-for="(row, i) in shownExchanges" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm">
                                    <Icon v-if="row.cc" :icon="'circle-flags:' + row.cc.toLowerCase()" class="size-4 shrink-0" />
                                    <span v-else class="size-4 shrink-0" />
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate" :title="row.name">{{ row.name }}</div>
                                        <div v-if="row.city" class="truncate text-xs text-muted-foreground" :title="row.city">{{ row.city }}</div>
                                    </div>
                                    <Badge v-if="row.rsPeer" variant="outline" :title="t('asnprofile.peering.rsTitle')"
                                        class="shrink-0 px-1.5 text-[10px] font-medium text-muted-foreground">{{ t('asnprofile.peering.rs') }}</Badge>
                                    <span class="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{{ formatPortSpeed(row.speed, nf.format) }}</span>
                                </li>
                            </ul>
                            <Button v-if="exchanges.length > FIRST_ROWS" variant="outline" size="sm" class="h-7 cursor-pointer text-xs"
                                @click="showAllExchanges = !showAllExchanges">
                                {{ showAllExchanges ? t('asnprofile.peering.showLess') : t('asnprofile.peering.showAll', { count: nf.format(exchanges.length) }) }}</Button>
                        </section>

                        <!-- Facilities: flag, name, city -->
                        <section v-if="facilities.length" class="space-y-2 min-w-0">
                            <h3 class="text-xs font-medium text-muted-foreground">
                                {{ t('asnprofile.peering.facilities', { count: nf.format(facilities.length) }) }}</h3>
                            <ul class="rounded-lg border bg-card divide-y">
                                <li v-for="(row, i) in shownFacilities" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm">
                                    <Icon v-if="row.cc" :icon="'circle-flags:' + row.cc.toLowerCase()" class="size-4 shrink-0" />
                                    <span v-else class="size-4 shrink-0" />
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate" :title="row.name">{{ row.name }}</div>
                                        <div v-if="row.city" class="truncate text-xs text-muted-foreground" :title="row.city">{{ row.city }}</div>
                                    </div>
                                </li>
                            </ul>
                            <Button v-if="facilities.length > FIRST_ROWS" variant="outline" size="sm" class="h-7 cursor-pointer text-xs"
                                @click="showAllFacilities = !showAllFacilities">
                                {{ showAllFacilities ? t('asnprofile.peering.showLess') : t('asnprofile.peering.showAll', { count: nf.format(facilities.length) }) }}</Button>
                        </section>
                    </div>
                </div>
            </template>

            <!-- Sources that didn't answer this time (one quiet line) -->
            <p v-if="failed.length" class="text-xs text-muted-foreground">
                {{ t('asnprofile.partial', { list: failed.join(', ') }) }}</p>
        </div>
    </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ChevronRight, Download, ExternalLink, Globe, Search, ShieldAlert, ShieldCheck, ShieldX } from '@lucide/vue';
import { trackEvent } from '@/utils/analytics';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { parseAsnInput } from '@/utils/ip/asn-input.js';
import { buildTrafficPairs, pickConnectionQuality } from '@/utils/ip/asn-metrics.js';
import {
    asnProfileUrl, ASN_PROFILE_TIMEOUT_MS, sectionData, isProfileEmpty, failedSources,
    hasTopology, isTier1Origin, heroIdentity, registrationFields, keyFacts, coneAsns,
    RPKI_STATES, shapePrefixRows, familyCounts, filterPrefixRows, rpkiSummary, prefixListText,
    countryShareRows, neighbourGroups,
    BASELINE_POSITION, reputationMeters, proxyListedCount, verdictLevel, VERDICT_TONE,
    peeringEnumKey, peeringHero, peeringFacts, formatPortSpeed, exchangeRows, facilityRows, hasPeeringCard, visibleRows,
} from '@/utils/ip/asn-profile-view.js';
import { formatIsoDate } from '@/utils/time-utils.js';
import getCountryName from '@/data/country-name.js';
import AsnConnectionQuality from '@/components/ip-infos/AsnConnectionQuality.vue';
import AsnTrafficShares from '@/components/ip-infos/AsnTrafficShares.vue';
import CopyButton from '@/components/widgets/CopyButton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Heavy (dagre + SVG) — async, as IpDetailPanel loads it.
const ASNConnectivity = defineAsyncComponent(() => import('@/components/ip-infos/ASNConnectivity.vue'));

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const { dotClass, textClass } = useStatusTone();


const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';
const nf = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }));
const compact = computed(() => new Intl.NumberFormat(locale.value, { notation: 'compact', maximumFractionDigits: 1 }));

// ---- run state -------------------------------------------------------------
// state: 'idle' | 'loading' | 'done' | 'error'. A response from an older run
// is dropped.

const query = ref('');
const errorMsg = ref('');
const profileAsn = ref(null);
const state = ref('idle');
const profile = shallowRef(null);
const rawOpen = ref(false);
let runId = 0;

const FIRST_ROWS = 10;
const PAGE = 50;
const familyFilter = ref('all');
const limit = ref(FIRST_ROWS);
const showAllExchanges = ref(false);
const showAllFacilities = ref(false);

const loading = computed(() => state.value === 'loading');

const run = async (asn) => {
    const id = ++runId;
    profileAsn.value = asn;
    profile.value = null;
    state.value = 'loading';
    rawOpen.value = false;
    familyFilter.value = 'all';
    limit.value = FIRST_ROWS;
    showAllExchanges.value = false;
    showAllFacilities.value = false;
    try {
        const response = await fetchWithTimeout(asnProfileUrl(asn), { timeoutMs: ASN_PROFILE_TIMEOUT_MS });
        const body = response.ok ? await response.json() : null;
        if (id !== runId) return;
        profile.value = body?.status ? body : null;
        state.value = profile.value ? 'done' : 'error';
    } catch (error) {
        if (id !== runId) return;
        console.warn('ASN Profile request failed:', error);
        state.value = 'error';
    }
};

// ---- input + shareable ?q= -------------------------------------------------

// Keep `?q=` in step with the last run without growing history.
const syncQuery = (q) => {
    if (route.query.q === q) return;
    router.replace({ query: { ...route.query, q } });
};

const start = (raw, { track = true } = {}) => {
    const asn = parseAsnInput(raw);
    if (asn === null) {
        errorMsg.value = t('asnprofile.invalidInput');
        return;
    }
    errorMsg.value = '';
    query.value = `AS${asn}`;
    if (track) trackEvent('Section', 'StartClick', 'AsnProfile');
    syncQuery(query.value);
    run(asn);
};

const onSubmit = () => {
    if (query.value.trim()) start(query.value);
};

// `?q=` on mount, and any later change while the drawer stays open (an ASN
// link followed from inside it, history navigation). Our own write-back
// equals `query` already, so it doesn't run twice.
watch(() => route.query.q, (q) => {
    if (typeof q === 'string' && q.trim() && q !== query.value) {
        query.value = q;
        start(q, { track: false });
    }
}, { immediate: true });

// ---- sections --------------------------------------------------------------

const radar = computed(() => sectionData(profile.value, 'radar'));
const prefixesData = computed(() => sectionData(profile.value, 'prefixes'));
const graph = computed(() => sectionData(profile.value, 'connectivity'));
const whois = computed(() => sectionData(profile.value, 'whois'));
const rank = computed(() => sectionData(profile.value, 'rank'));
const reputation = computed(() => sectionData(profile.value, 'reputation'));
const peeringdb = computed(() => sectionData(profile.value, 'peeringdb'));

const empty = computed(() => isProfileEmpty(profile.value));
const failed = computed(() => failedSources(profile.value));

// ---- hero ------------------------------------------------------------------

const identity = computed(() => heroIdentity({ radar: radar.value, whois: whois.value, rank: rank.value }));
const isTier1 = computed(() => isTier1Origin(graph.value));

const rows = computed(() => shapePrefixRows(prefixesData.value?.prefixes));

const FACT_FORMAT = {
    rank: (fact) => ({ value: `#${nf.value.format(fact.value)}`, sub: t('asnprofile.facts.rankSource') }),
    announcedIpv4: (fact) => ({
        value: nf.value.format(fact.value),
        sub: t('asnprofile.facts.ipv4Share', {
            share: new Intl.NumberFormat(locale.value, { maximumSignificantDigits: 2 }).format(fact.share),
        }),
    }),
    prefixes: (fact) => ({ value: `${nf.value.format(fact.v4)} · ${nf.value.format(fact.v6)}` }),
    users: (fact) => ({ value: compact.value.format(fact.value) }),
};

const facts = computed(() => keyFacts({ radar: radar.value, rank: rank.value, rows: rows.value })
    .map((fact) => ({ key: fact.key, label: t(`asnprofile.facts.${fact.key}`), ...FACT_FORMAT[fact.key](fact) })));

const registration = computed(() => registrationFields(whois.value, (day) => formatIsoDate(day, locale.value)));
const rawRecord = computed(() => whois.value?.__raw || '');

// Verdict badge: the scoring level's wording, coloured by tone.
const VERDICT_STYLE = {
    'ok-fast': { variant: 'success', icon: ShieldCheck },
    'ok-slow': { variant: 'outline', icon: ShieldAlert, extra: 'border-transparent bg-warning text-warning-foreground' },
    fail: { variant: 'destructive', icon: ShieldX },
};
const verdict = computed(() => {
    const level = verdictLevel(reputation.value);
    if (!level) return null;
    return { ...VERDICT_STYLE[VERDICT_TONE[level]], label: t(`asnprofile.reputation.level.${level}`) };
});

// ---- reputation ------------------------------------------------------------

const meters = computed(() => reputationMeters(reputation.value));
const proxyListed = computed(() => proxyListedCount(reputation.value));

const ratioNote = (ratio) => (ratio > 1
    ? t('asnprofile.reputation.ratio', { ratio: ratio >= 10 ? nf.value.format(Math.round(ratio)) : nf.value.format(ratio) })
    : t('asnprofile.reputation.belowBaseline'));

const reputationDate = computed(() => {
    const day = /^\d{4}-\d{2}-\d{2}/.exec(reputation.value?.updatedAt || '');
    return day ? formatIsoDate(day[0], locale.value) : '';
});

// ---- traffic ---------------------------------------------------------------

const trafficVisible = computed(() => buildTrafficPairs(radar.value).length > 0
    || Object.keys(pickConnectionQuality(radar.value)).length > 0);

// ---- prefixes + RPKI -------------------------------------------------------

const RPKI_DOT = { valid: 'bg-success', invalid: 'bg-destructive', unknown: 'bg-muted-foreground/40' };

const familyOptions = computed(() => [
    { value: 'all', label: t('asnprofile.prefixes.all') },
    { value: 'v4', label: t('ipInfos.ASNInfo.IPv4_Pct') },
    { value: 'v6', label: t('ipInfos.ASNInfo.IPv6_Pct') },
]);

const counts = computed(() => familyCounts(rows.value));
const filtered = computed(() => filterPrefixRows(rows.value, familyFilter.value));
const shownRows = computed(() => filtered.value.slice(0, limit.value));
const filteredText = () => prefixListText(filtered.value);

watch(familyFilter, () => { limit.value = FIRST_ROWS; });

// Counted over the prefix rows, so the bar always matches the table.
const rpki = computed(() => rpkiSummary(rows.value));

// v4 → address count; v6 → how many /48s the prefix spans.
const sizeLabel = (row) => {
    if (row.family === 4) return nf.value.format(row.count);
    return row.count === null ? `/${row.length}` : `${nf.value.format(row.count)} × /48`;
};

const downloadFiltered = () => {
    const url = URL.createObjectURL(new Blob([`${filteredText()}\n`], { type: 'text/plain' }));
    const suffix = familyFilter.value === 'all' ? '' : `-${familyFilter.value}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `AS${profileAsn.value}-prefixes${suffix}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

// ---- country distribution --------------------------------------------------

const topCountries = computed(() => countryShareRows(prefixesData.value?.countries, 10));

// ---- connectivity ----------------------------------------------------------

const NAME_PREVIEW = 8;

const groups = computed(() => neighbourGroups(graph.value?.neighbours, NAME_PREVIEW));

// ASNConnectivity reads the IP-card cache shape: { [numeric asn]: { graph } }.
const connectivityInfos = computed(() => (graph.value ? { [String(profileAsn.value)]: { graph: graph.value } } : {}));

const cone = computed(() => coneAsns(rank.value));

// ---- peering & facilities (PeeringDB) --------------------------------------

// PeeringDB vocabulary → translated label; anything else as written.
const enumLabel = (group, value) => {
    const key = peeringEnumKey(group, value);
    return key ? t(key) : value;
};

const peerHero = computed(() => peeringHero(peeringdb.value));
const peerFacts = computed(() => peeringFacts(peeringdb.value)
    .map((fact) => ({ ...fact, label: fact.group ? enumLabel(fact.group, fact.value) : fact.value })));
const exchanges = computed(() => exchangeRows(peeringdb.value));
const facilities = computed(() => facilityRows(peeringdb.value));
const peeringCard = computed(() => hasPeeringCard(peeringdb.value));
const shownExchanges = computed(() => visibleRows(exchanges.value, showAllExchanges.value, FIRST_ROWS));
const shownFacilities = computed(() => visibleRows(facilities.value, showAllFacilities.value, FIRST_ROWS));
</script>

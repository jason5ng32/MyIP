<template>
    <!-- Floating history button (bottom-right dock, between InfoMask and QueryIP) -->
    <JnTooltip v-if="enabled" :text="t('Tooltips.IPHistory')" side="left">
        <Button size="icon" type="button" variant="default" aria-label="IP History"
            class="rounded-full shadow-lg cursor-pointer" @click="openPanel">
            <History class="size-4" />
        </Button>
    </JnTooltip>

    <!-- History panel: left sheet, same shell as Preferences -->
    <Sheet :open="isOpen && enabled" @update:open="onOpenChange">
        <SheetContent side="left" :title="t('ipHistory.Title')"
            class="flex flex-col p-0 gap-0 w-full max-w-full md:w-125 md:max-w-125">
            <!-- Header -->
            <header class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
                <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                    <History class="size-4 text-muted-foreground" />
                    {{ t('ipHistory.Title') }}
                </h2>
                <SheetClose
                    class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
            </header>

            <!-- Content (scrollable) -->
            <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <!-- Local-only privacy note -->
                <p class="text-xs text-muted-foreground leading-relaxed">
                    {{ t('ipHistory.Notes') }}
                </p>

                <!-- Empty state -->
                <div v-if="!hasHistory"
                    class="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <History class="size-8 opacity-40" />
                    {{ t('ipHistory.Empty') }}
                </div>

                <!-- Filters — flat toggle tags: highlight any combination.
                    Within a row selections OR together, the two rows AND.
                    Nothing highlighted = no filter. Tags and counts come from
                    the full history so the layout never shifts mid-combo. -->
                <div v-if="hasHistory && (showTypeFilter || showCountryFilter)" class="space-y-2">
                    <!-- IP type tags -->
                    <ToggleGroup v-if="showTypeFilter" v-model="versionFilter" type="multiple" variant="outline"
                        :spacing="2" class="w-full flex-wrap justify-start"
                        :aria-label="t('ipHistory.FilterByType')">
                        <ToggleGroupItem value="v4" :class="tagClass">
                            IPv4
                            <span :class="tagCountClass">({{ versionCounts.v4 }})</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="v6" :class="tagClass">
                            IPv6
                            <span :class="tagCountClass">({{ versionCounts.v6 }})</span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <!-- Country / region tags -->
                    <ToggleGroup v-if="showCountryFilter" v-model="countryFilter" type="multiple" variant="outline"
                        :spacing="2" class="w-full flex-wrap justify-start"
                        :aria-label="t('ipHistory.FilterByCountry')">
                        <ToggleGroupItem v-for="facet in countries" :key="facet.code || 'unknown'"
                            :value="facet.code || 'unknown'" :class="tagClass">
                            <Icon v-if="facet.code" :icon="'circle-flags:' + facet.code.toLowerCase()"
                                class="size-3.5 shrink-0" />
                            <Globe v-else :class="['size-3.5 shrink-0', tagCountClass]" />
                            <span class="truncate max-w-32">{{ countryName(facet.code) }}</span>
                            <span :class="tagCountClass">({{ facet.count }})</span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                <!-- Empty result for the selected tag combination -->
                <div v-if="hasHistory && displayDays.length === 0"
                    class="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <ListFilter class="size-8 opacity-40" />
                    {{ t('ipHistory.NoMatch') }}
                </div>

                <!-- Day groups, newest first -->
                <section v-for="group in displayDays" :key="group.day">
                    <h3 class="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                        {{ formatDay(group.day) }}
                    </h3>
                    <ul class="rounded-lg border bg-card divide-y">
                        <li v-for="entry in group.entries" :key="entry.ip" class="px-3 py-2.5 min-w-0">
                            <!-- IP row: flag + fit-to-width IP. -->
                            <div class="flex items-center gap-2 min-w-0">
                                <Icon v-if="entry.country" :icon="'circle-flags:' + entry.country.toLowerCase()"
                                    class="size-4 shrink-0" />
                                <Globe v-else class="size-4 shrink-0 text-muted-foreground" />
                                <FitText :text="entry.ip" :tiers="INLINE_TIERS" :title="entry.ip"
                                    class="font-mono min-w-0" />
                            </div>
                            <!-- Detail row: location + ASN -->
                            <div
                                class="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground min-w-0">
                                <span class="truncate">{{ entry.location || '—' }}</span>
                                <Badge v-if="entry.asn" variant="secondary" class="font-mono shrink-0">
                                    {{ entry.asn }}
                                </Badge>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>

            <!-- Bottom bar: clear-all with two-step confirm. A <div>, not
                <footer> — style.css sizes the footer tag globally (100pt). -->
            <div v-if="hasHistory" class="flex items-center px-4 py-6 border-t shrink-0">
                <Button type="button" size="sm" :variant="confirmingClear ? 'destructive' : 'outline'"
                    class="w-full cursor-pointer" @click="onClearClick">
                    <Trash2 class="size-4" />
                    {{ confirmingClear ? t('ipHistory.ClearConfirm') : t('ipHistory.ClearAll') }}
                </Button>
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup>
// IPHistory — local record of every IP detected while using the app.
// Data comes from store.allIPs via use-ip-history (localStorage, grouped by
// day, 90-day retention, never synced to the account). The panel mirrors the
// Preferences left-sheet shell.
import { ref, computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { useIpHistory } from '@/composables/use-ip-history.js';
import { INLINE_TIERS } from '@/composables/use-fit-text.js';
import { filterHistoryDays, countryFacets, ipVersionCounts } from '@/utils/ip-history.js';
import { formatIsoDate } from '@/utils/time-utils.js';
import getCountryName from '@/data/country-name.js';
import FitText from '@/components/widgets/FitText.vue';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@iconify/vue';
import { Globe, History, ListFilter, Trash2 } from '@lucide/vue';

const { t } = useI18n();
const store = useMainStore();

const { enabled, sortedDays, hasHistory, clearHistory } = useIpHistory({ store });

// Sheet open state rides the shared openSheet slot (same as Preferences).
const isOpen = computed(() => store.openSheet === 'ipHistory');
const onOpenChange = (val) => {
    store.setOpenSheet(val ? 'ipHistory' : null);
};

const openPanel = () => {
    trackEvent('SideButtons', 'ToggleClick', 'IPHistory');
    store.toggleSheet('ipHistory');
};

const lang = computed(() => store.lang);

// Filters — flat toggle tags, any combination. Empty selection = that
// dimension unfiltered. Country values are country codes plus the 'unknown'
// sentinel (lowercase, so it can never collide with the uppercase ISO codes)
// for entries recorded without a country.
const versionFilter = ref([]); // subset of ['v4', 'v6']
const countryFilter = ref([]); // country codes + 'unknown'

// Tag pill look on top of the toggle primitive (whose pressed state is the
// high-contrast primary pair). `group` lets the muted count / icon flip along
// with the selection via tagCountClass.
const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';
const tagCountClass = 'text-muted-foreground group-data-[state=on]:text-primary-foreground/70';

const versionCounts = computed(() => ipVersionCounts(sortedDays.value));
const showTypeFilter = computed(() => versionCounts.value.v4 > 0 && versionCounts.value.v6 > 0);
const countries = computed(() => countryFacets(sortedDays.value));
const showCountryFilter = computed(() => countries.value.length > 1);

const displayDays = computed(() => filterHistoryDays(sortedDays.value, {
    versions: versionFilter.value.map((v) => (v === 'v6' ? 6 : 4)),
    countries: countryFilter.value.map((c) => (c === 'unknown' ? '' : c)),
}));

// Drop selections whose records vanished entirely (retention pruning,
// clear-all), so stale hidden tags don't keep filtering the list.
watch(countries, (facets) => {
    const alive = new Set(facets.map((f) => f.code || 'unknown'));
    const kept = countryFilter.value.filter((c) => alive.has(c));
    if (kept.length !== countryFilter.value.length) countryFilter.value = kept;
});
watch(showTypeFilter, (shown) => {
    if (!shown) versionFilter.value = [];
});

// Localized country name for a facet code, via the shared country list
// (data/country-name.js) — same source the rest of the product uses.
const countryName = (code) => {
    if (!code) return t('ipHistory.UnknownCountry');
    return getCountryName(code, lang.value) || code;
};

// Localized day header, e.g. "Jul 8, 2026" / "2026年7月8日" — the shared
// helper takes the storage bucket's "YYYY-MM-DD" key directly.
const formatDay = (dayKey) => formatIsoDate(dayKey, lang.value);

// Clear-all is destructive: first click arms, second click within the armed
// window actually clears. Disarms when the panel closes.
const confirmingClear = ref(false);
const onClearClick = () => {
    if (!confirmingClear.value) {
        confirmingClear.value = true;
        return;
    }
    clearHistory();
    confirmingClear.value = false;
    trackEvent('SideButtons', 'Click', 'ClearIPHistory');
};
watch(isOpen, (open) => {
    if (!open) confirmingClear.value = false;
});
</script>

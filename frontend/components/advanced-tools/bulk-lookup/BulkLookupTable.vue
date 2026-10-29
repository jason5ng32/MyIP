<!-- Bulk IP Lookup table: the rows the page has already filtered and sorted,
     one page at a time. Sort headers, star, note, details and delete emit
     upward; the blocklist link is a real one to the Blocklist tool. -->
<template>
    <div class="space-y-3">
        <!-- `relative` makes the scroller the containing block of the header's
             sr-only (absolute) labels; otherwise they resolve against the page
             and drag the document wide whenever the table outgrows it.
             data-sentry-block keeps the rows (third parties' IPs) out of replays. -->
        <div class="relative overflow-x-auto rounded-lg border" data-sentry-block>
            <table class="w-full text-sm">
                <thead class="bg-muted/40">
                    <tr class="text-left text-xs text-muted-foreground">
                        <th scope="col" :class="thClass" class="w-0 text-right">#</th>
                        <th scope="col" :class="thClass" class="w-0"><span class="sr-only">{{ t('bulklookup.col.star') }}</span></th>
                        <th v-for="col in COLUMNS" :key="col.key" scope="col" :class="[thClass, col.class]"
                            :aria-sort="ariaSort(col.key)">
                            <button type="button" :class="sortButtonClass" @click="emit('sort', col.key)">
                                {{ t(`bulklookup.col.${col.key}`) }}
                                <component :is="sortIcon(col.key)" class="size-3 shrink-0"
                                    :class="sortKey === col.key ? 'text-foreground' : 'opacity-50'" />
                            </button>
                        </th>
                        <th scope="col" :class="thClass">{{ t('bulklookup.col.note') }}</th>
                        <th scope="col" :class="thClass" class="w-0"><span class="sr-only">{{ t('bulklookup.col.actions') }}</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    <!-- Only filters can empty it: the page hides an empty list -->
                    <tr v-if="!rows.length">
                        <td :colspan="COLUMNS.length + 4" class="px-4 py-8 text-center text-sm text-muted-foreground">{{ t('bulklookup.NoMatches') }}</td>
                    </tr>
                    <tr v-for="(row, index) in pageRows" :key="row.ip" class="hover:bg-muted/50 transition-colors">
                        <td :class="tdClass" class="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {{ range.from + index }}
                        </td>
                        <td :class="tdClass" class="px-1">
                            <button type="button" class="p-1 rounded-md cursor-pointer hover:bg-muted"
                                :class="row.starred ? 'text-warning' : 'text-muted-foreground/50 hover:text-foreground'"
                                :aria-pressed="row.starred" :aria-label="t(row.starred ? 'bulklookup.Unstar' : 'bulklookup.Star')"
                                :title="t(row.starred ? 'bulklookup.Unstar' : 'bulklookup.Star')" @click="emit('star', row.ip)">
                                <Star class="size-3.5" :class="{ 'fill-current': row.starred }" />
                            </button>
                        </td>
                        <td :class="tdClass" class="font-mono">{{ row.ip }}</td>
                        <td :class="tdClass">
                            <span v-if="row.country" class="flex items-center gap-1.5">
                                <Icon :icon="'circle-flags:' + row.country.toLowerCase()" class="size-4 shrink-0" />
                                <span class="truncate max-w-24 sm:max-w-40" :title="countryName(row.country)">{{ countryName(row.country) || row.country }}</span>
                            </span>
                            <span v-else class="text-muted-foreground">{{ t('bulklookup.Unknown') }}</span>
                        </td>
                        <td :class="tdClass">
                            <span v-if="row.city" class="block truncate max-w-24 sm:max-w-40" :title="cityTitle(row)">{{ row.city }}</span>
                            <span v-else class="text-muted-foreground">—</span>
                        </td>
                        <td :class="tdClass" class="font-mono text-xs">
                            <span :class="{ 'text-muted-foreground': !row.asn }">{{ row.asn || '—' }}</span>
                        </td>
                        <td :class="tdClass">
                            <span class="block truncate max-w-28 sm:max-w-48 text-muted-foreground" :title="row.org || ''">{{ row.org || '—' }}</span>
                        </td>
                        <td :class="tdClass" class="text-right font-mono text-xs tabular-nums">{{ formatCount(row.count) }}</td>

                        <!-- Note: static text (full note on hover) + edit button -->
                        <td :class="tdClass">
                            <div class="flex items-center gap-1">
                                <span class="truncate max-w-24 sm:max-w-40 text-xs" :title="row.note">{{ row.note }}</span>
                                <Button variant="ghost" size="icon" class="size-6 shrink-0 cursor-pointer text-muted-foreground"
                                    :aria-label="t('bulklookup.EditNote')" :title="t('bulklookup.EditNote')"
                                    @click="emit('edit-note', row.ip)">
                                    <PencilLine class="size-3.5" />
                                </Button>
                            </div>
                        </td>

                        <!-- Actions: details dialog, blocklist page (where listed), delete -->
                        <td :class="tdClass" class="px-2">
                            <div class="flex items-center gap-0.5">
                                <JnTooltip :text="t('bulklookup.IpDetails')" side="top">
                                    <Button variant="ghost" size="icon" class="size-7 cursor-pointer"
                                        :aria-label="t('bulklookup.IpDetails')" @click="emit('details', row.ip)">
                                        <Search class="size-3.5" />
                                    </Button>
                                </JnTooltip>
                                <JnTooltip v-if="blocklistAvailable" :text="t('bulklookup.CheckBlocklist')" side="top">
                                    <Button variant="ghost" size="icon" class="size-7 cursor-pointer" as-child>
                                        <a :href="blocklistHref(row.ip)" :aria-label="t('bulklookup.CheckBlocklist')"
                                            @click="openBlocklist($event, row.ip)">
                                            <ShieldAlert class="size-3.5" />
                                        </a>
                                    </Button>
                                </JnTooltip>
                                <JnTooltip :text="t('bulklookup.Delete')" side="top">
                                    <Button variant="ghost" size="icon" class="size-7 cursor-pointer hover:text-destructive"
                                        :aria-label="t('bulklookup.Delete')" @click="emit('remove', row.ip)">
                                        <Trash2 class="size-3.5" />
                                    </Button>
                                </JnTooltip>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Paging: range + page size, then the page buttons; only past the
             smallest page size (showPaging), so short lists end at the table -->
        <div v-if="showPaging(rows.length)" class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground md:justify-start">
                <span class="tabular-nums">{{ t('bulklookup.PageRange', range) }}</span>
                <span class="flex items-center gap-2">
                    <span>{{ t('bulklookup.PageSize') }}</span>
                    <Select :model-value="String(pageSize)" @update:model-value="(v) => setPageSize(Number(v))">
                        <SelectTrigger class="h-7 w-18 text-xs" :aria-label="t('bulklookup.PageSize')">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="String(size)">{{ size }}</SelectItem>
                        </SelectContent>
                    </Select>
                </span>
            </div>
            <Pagination v-slot="{ page: current }" :page="page" :total="rows.length"
                :items-per-page="pageSize" :sibling-count="store.isMobile ? 0 : 1" show-edges class="mx-0 w-auto justify-center md:justify-end"
                @update:page="(p) => (page = p)">
                <PaginationContent v-slot="{ items }">
                    <PaginationPrevious :aria-label="t('bulklookup.PagePrev')">
                        <ChevronLeft /><span class="max-sm:hidden">{{ t('bulklookup.PagePrev') }}</span>
                    </PaginationPrevious>
                    <template v-for="(item, i) in items" :key="i">
                        <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === current"
                            class="size-8 text-xs tabular-nums cursor-pointer">
                            {{ item.value }}
                        </PaginationItem>
                        <PaginationEllipsis v-else class="size-8" />
                    </template>
                    <PaginationNext :aria-label="t('bulklookup.PageNext')">
                        <span class="max-sm:hidden">{{ t('bulklookup.PageNext') }}</span><ChevronRight />
                    </PaginationNext>
                </PaginationContent>
            </Pagination>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { Icon } from '@iconify/vue';
import getCountryName from '@/data/country-name.js';
import { isPlainClick } from '@/utils/nav-target.js';
import { trackEvent } from '@/utils/analytics';
import {
    PAGE_SIZES, DEFAULT_PAGE_SIZE, pageCount, clampPage, pageSlice, pageRange, showPaging,
} from '@/composables/use-bulk-lookup.js';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
    Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import {
    ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, PencilLine, Search, ShieldAlert, Star, Trash2,
} from '@lucide/vue';

const props = defineProps({
    rows: { type: Array, required: true },
    sortKey: { type: String, default: 'count' },
    sortDir: { type: String, default: 'desc' },
    // Any change (sort, filter, batch) sends the table back to page 1.
    resetKey: { type: String, default: '' },
    blocklistAvailable: { type: Boolean, default: false },
});
const emit = defineEmits(['sort', 'star', 'remove', 'details', 'edit-note']);

const { t, locale } = useI18n();
const router = useRouter();
// Phones get fewer page buttons, so the pager fits a 320px-wide card.
const store = useMainStore();

const thClass = 'px-3 py-2 font-medium whitespace-nowrap';
const tdClass = 'px-3 py-1.5 whitespace-nowrap align-middle';
const sortButtonClass = 'inline-flex items-center gap-1 cursor-pointer hover:text-foreground';

const COLUMNS = [
    { key: 'ip' },
    { key: 'country' },
    { key: 'city' },
    { key: 'asn' },
    { key: 'org' },
    { key: 'count', class: 'text-right' },
];

const countryName = (code) => getCountryName(code, locale.value);
const cityTitle = (row) => [row.city, row.region].filter(Boolean).join(', ');
const formatCount = (n) => n.toLocaleString(locale.value);

const sortIcon = (key) => {
    if (props.sortKey !== key) return ArrowUpDown;
    return props.sortDir === 'asc' ? ArrowUp : ArrowDown;
};
const ariaSort = (key) => {
    if (props.sortKey !== key) return 'none';
    return props.sortDir === 'asc' ? 'ascending' : 'descending';
};

// ── Paging ──────────────────────────────────────────────────────────
const page = ref(1);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const pages = computed(() => pageCount(props.rows.length, pageSize.value));
const pageRows = computed(() => pageSlice(props.rows, page.value, pageSize.value));
const range = computed(() => pageRange(page.value, props.rows.length, pageSize.value));

watch(() => props.resetKey, () => { page.value = 1; });
// Deleting rows can leave the page past the end.
watch(pages, () => { page.value = clampPage(page.value, props.rows.length, pageSize.value); });

const setPageSize = (size) => {
    if (!PAGE_SIZES.includes(size)) return;
    pageSize.value = size;
    page.value = 1;
};

// ── Blocklist link: a real link, routed in-app on a plain click ─────
const blocklistHref = (ip) => `/tools/blocklist?q=${encodeURIComponent(ip)}`;
const openBlocklist = (event, ip) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    trackEvent('BulkLookup', 'BlocklistClick', 'Open Blocklist Check');
    router.push({ path: '/tools/blocklist', query: { q: ip } });
};
</script>

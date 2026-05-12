<template>
    <!-- ASN History Panel: embedded in IpDetailPanel's Collapsible.
         Lists every ASN that has announced (a prefix covering) this IP over
         time, per RIPEstat routing-history. -->
    <div class="rounded-md border bg-muted/40 text-sm">
        <!-- Top note -->
        <div class="px-3 pt-3 pb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <Info class="size-3.5 mt-[0.15em] shrink-0" />
            <span>{{ t('ipInfos.ASNHistory.note') }}</span>
        </div>

        <!-- Loaded with rows -->
        <ul v-if="rows && rows.length" class="px-3 pb-3 divide-y divide-border">
            <li v-for="row in rows" :key="row.asn + ':' + row.firstSeen" class="py-2.5 flex flex-col gap-1">
                <div class="flex items-center justify-between gap-2 min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <Building2 class="size-3.5 text-muted-foreground shrink-0" />
                        <span class="font-mono font-medium shrink-0">AS{{ row.asn }}</span>
                        <span v-if="row.org" class="truncate text-muted-foreground" :title="row.org">· {{ row.org }}</span>
                    </div>
                    <Badge v-if="row.peers" variant="outline" class="shrink-0 gap-1 font-normal"
                        :title="t('ipInfos.ASNHistory.seenBy', { peers: row.peers })">
                        <Eye class="size-3" />
                        <span class="tabular-nums">{{ row.peers }}</span>
                    </Badge>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock4 class="size-3" />
                    <span class="tabular-nums">{{ fmtDate(row.firstSeen) }} → {{ fmtDate(row.lastSeen) }}</span>
                </div>
                <div v-if="row.prefixes && row.prefixes.length" class="flex flex-wrap gap-1">
                    <Badge v-for="p in row.prefixes.slice(0, 4)" :key="p" variant="outline"
                        class="font-mono text-[10px] py-0 px-1.5 font-normal">{{ p }}</Badge>
                    <span v-if="row.prefixes.length > 4" class="text-[10px] text-muted-foreground self-center">
                        +{{ row.prefixes.length - 4 }}
                    </span>
                </div>
            </li>
        </ul>

        <!-- Empty -->
        <div v-else-if="rows && rows.length === 0" class="px-3 pb-3 text-xs text-muted-foreground">
            {{ t('ipInfos.ASNHistory.empty') }}
        </div>

        <!-- Error -->
        <div v-else-if="entry && entry.error" class="px-3 pb-3 text-xs text-destructive">
            {{ t('ipInfos.ASNHistory.error') }}
        </div>

        <!-- Loading skeleton -->
        <div v-else class="px-3 pb-3 space-y-2">
            <div v-for="(w, i) in placeholderSizes" :key="i" class="h-3.5 bg-muted rounded animate-pulse"
                :style="`width: ${(w / 12) * 100}%`"></div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Building2, Clock4, Eye, Info } from 'lucide-vue-next';

const { t } = useI18n();

const placeholderSizes = [12, 8, 6, 8, 4];

const props = defineProps({
    // BGP-floor prefix the parent quantized the IP to (/24 v4, /48 v6).
    // Used both as cache key and as the URL param sent to the backend.
    prefix: { type: String, required: true },
    // Shared session cache, keyed by prefix. Owned by IpInfos.vue (or local in QueryIP).
    asnHistoryInfos: { type: Object, required: true },
});

const entry = computed(() => props.asnHistoryInfos[props.prefix]);
const rows = computed(() => (entry.value && !entry.value.error) ? entry.value.history : null);

// Compact YYYY-MM-DD — RIPEstat returns "2013-12-05T00:00:00", so slice is enough.
const fmtDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '—');
</script>

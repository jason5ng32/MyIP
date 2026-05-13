<template>
    <!-- ASN Connectivity Panel: layered graph of upstream paths from the
         origin AS toward Tier 1 ISPs. Lazy-loads dagre on first open. -->
    <div class="rounded-md border bg-muted/40 text-sm">
        <div class="px-3 pt-3 pb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <span class="flex-1">{{ t('ipInfos.ASNConnectivity.note') }}</span>
            <button v-if="layout" type="button" @click="isExpanded = true"
                class="shrink-0 rounded-sm p-0.5 hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                :aria-label="t('ipInfos.ASNConnectivity.expand')"
                :title="t('ipInfos.ASNConnectivity.expand')">
                <Maximize2 class="size-3.5" />
            </button>
        </div>

        <!-- Loaded -->
        <div v-if="layout" class="px-3 pb-3 overflow-auto">
            <!-- height: auto (not px) so the SVG scales proportionally when
                 maxWidth:100% shrinks it on narrow viewports; otherwise the
                 viewBox-preserved aspect ratio centers the content and leaves
                 large empty bands above and below. -->
            <svg :viewBox="`0 0 ${layout.width} ${layout.height}`"
                :style="{ width: layout.width + 'px', height: 'auto', maxWidth: '100%' }"
                class="block mx-auto">
                <defs>
                    <marker id="jn-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                    </marker>
                </defs>
                <g class="text-muted-foreground">
                    <path v-for="(e, i) in layout.edges" :key="i" :d="e.d"
                        fill="none" stroke="currentColor" stroke-width="1.2"
                        marker-end="url(#jn-arrow)" opacity="0.6"
                        stroke-linejoin="miter" />
                </g>
                <!-- Each node = opaque fill-card base + tinted "type" rect on
                     top, so edges routed behind the node don't bleed through. -->
                <g v-for="n in layout.nodes" :key="n.asn"
                    :transform="`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`">
                    <title v-if="n.label">AS{{ n.asn }} · {{ n.label }}</title>
                    <rect :width="n.w" :height="n.h" rx="6" class="fill-card" />
                    <rect :width="n.w" :height="n.h" rx="6"
                        :class="nodeBoxClass(n.type)" stroke-width="1.5" />
                    <text :x="n.w / 2" :y="n.h / 2 - 5" text-anchor="middle"
                        class="font-mono font-semibold text-[11px] fill-foreground">
                        AS{{ n.asn }}
                    </text>
                    <text v-if="n.label" :x="n.w / 2" :y="n.h / 2 + 9" text-anchor="middle"
                        class="text-[10px] fill-muted-foreground">
                        {{ shortLabel(n.label) }}
                    </text>
                </g>
            </svg>

            <div class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span v-for="item in legendItems" :key="item.label" class="inline-flex items-center gap-1.5">
                    <span class="inline-block size-3 rounded-sm" :class="item.swatchClass"></span>
                    {{ item.label }}
                </span>
            </div>
        </div>

        <!-- Empty (graph has 0 nodes — usually means the AS wasn't found
             in CAIDA at all). Tier 1 origins legitimately produce a 1-node
             graph, so we don't treat that as empty. -->
        <div v-else-if="entry && !entry.error && entry.graph && (!entry.graph.nodes || entry.graph.nodes.length === 0)"
            class="px-3 pb-3 text-xs text-muted-foreground">
            {{ t('ipInfos.ASNConnectivity.empty') }}
        </div>

        <!-- Error -->
        <div v-else-if="entry && entry.error" class="px-3 pb-3 text-xs text-destructive">
            {{ t('ipInfos.ASNConnectivity.error') }}
        </div>

        <!-- Loading skeleton -->
        <div v-else class="px-3 pb-3 space-y-2">
            <div v-for="(w, i) in placeholderSizes" :key="i" class="h-3.5 bg-muted rounded animate-pulse"
                :style="`width: ${(w / 12) * 100}%`"></div>
        </div>
    </div>

    <!-- Expanded view: same SVG at natural pixel size, no maxWidth clamp.
         Wide graphs scroll horizontally inside the dialog. -->
    <Dialog v-if="layout" :open="isExpanded" @update:open="isExpanded = $event">
        <DialogContent class="max-w-[95vw] sm:max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader :icon="Network"
                :title="t('ipInfos.ASNConnectivity.dialogTitle', { asn: props.asn })" />
            <div class="overflow-auto flex-1 min-h-0">
                <svg :viewBox="`0 0 ${layout.width} ${layout.height}`"
                    :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
                    class="block">
                    <defs>
                        <marker id="jn-arrow-lg" viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                        </marker>
                    </defs>
                    <g class="text-muted-foreground">
                        <path v-for="(e, i) in layout.edges" :key="i" :d="e.d"
                            fill="none" stroke="currentColor" stroke-width="1.2"
                            marker-end="url(#jn-arrow-lg)" opacity="0.6"
                            stroke-linejoin="miter" />
                    </g>
                    <g v-for="n in layout.nodes" :key="n.asn"
                        :transform="`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`">
                        <title v-if="n.label">AS{{ n.asn }} · {{ n.label }}</title>
                        <rect :width="n.w" :height="n.h" rx="6" class="fill-card" />
                        <rect :width="n.w" :height="n.h" rx="6"
                            :class="nodeBoxClass(n.type)" stroke-width="1.5" />
                        <text :x="n.w / 2" :y="n.h / 2 - 5" text-anchor="middle"
                            class="font-mono font-semibold text-[11px] fill-foreground">
                            AS{{ n.asn }}
                        </text>
                        <text v-if="n.label" :x="n.w / 2" :y="n.h / 2 + 9" text-anchor="middle"
                            class="text-[10px] fill-muted-foreground">
                            {{ shortLabel(n.label) }}
                        </text>
                    </g>
                </svg>
            </div>
            <!-- Legend pinned outside the scroll area so it stays visible. -->
            <div class="shrink-0 pt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t">
                <span v-for="item in legendItems" :key="item.label" class="inline-flex items-center gap-1.5">
                    <span class="inline-block size-3 rounded-sm" :class="item.swatchClass"></span>
                    {{ item.label }}
                </span>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Info, Maximize2, Network } from 'lucide-vue-next';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

const { t } = useI18n();
const placeholderSizes = [12, 10, 8, 6, 4];

const props = defineProps({
    // Numeric string — parent strips the "AS" prefix to keep cache keys consistent.
    asn: { type: String, required: true },
    asnConnectivityInfos: { type: Object, required: true },
});

const entry = computed(() => props.asnConnectivityInfos[props.asn]);

// Dagre is ~25 KB gzip — dynamic import keeps it out of the initial bundle.
const layout = ref(null);
const isExpanded = ref(false);

// Shared by inline + dialog views so swatches and labels can't drift.
const legendItems = computed(() => [
    { swatchClass: 'border-2 border-success bg-success/10', label: t('ipInfos.ASNConnectivity.legendOrigin') },
    { swatchClass: 'border-2 border-info bg-info/10',       label: t('ipInfos.ASNConnectivity.legendTier1') },
    { swatchClass: 'border bg-card',                        label: t('ipInfos.ASNConnectivity.legendIntermediate') },
]);

watch(
    () => entry.value && !entry.value.error ? entry.value.graph : null,
    async (graph) => {
        if (!graph || !graph.nodes || graph.nodes.length === 0) {
            layout.value = null;
            return;
        }
        try {
            const dagre = await import('dagre');
            layout.value = computeLayout(dagre.default || dagre, graph);
        } catch (error) {
            console.error('Failed to lay out ASN graph:', error);
            layout.value = null;
        }
    },
    { immediate: true },
);

// LR dagre layout, then Manhattan routing on top. We bypass dagre's natural
// spline points (which produce diagonal-looking polylines) for explicit
// right-angle paths via buildChannelPath.
function computeLayout(dagre, graph) {
    const NODE_W = 130;
    const NODE_H = 46;

    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'LR',
        ranksep: 70,    // wider channels for Manhattan bends
        nodesep: 14,
        marginx: 16,
        marginy: 14,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const n of graph.nodes) {
        const opts = { width: NODE_W, height: NODE_H, _data: n };
        // Pin Tier 1s to the rightmost column so all "destinations" line up,
        // matching bgp.tools' look. Trade-off: direct origin → Tier 1 edges
        // become long horizontal lines.
        if (n.type === 'tier1') opts.rank = 'sink';
        g.setNode(String(n.asn), opts);
    }
    for (const e of graph.edges) {
        g.setEdge(String(e.from), String(e.to));
    }

    dagre.layout(g);

    const nodeById = new Map();
    const nodes = g.nodes().map(id => {
        const n = g.node(id);
        const data = n._data;
        const layoutNode = {
            asn: data.asn,
            type: data.type,
            label: data.name || null,
            x: n.x, y: n.y, w: n.width, h: n.height,
        };
        nodeById.set(id, layoutNode);
        return layoutNode;
    });

    // Vertical corridors at each inter-column midpoint — buildChannelPath
    // routes edge bends through these so they never cut through a node.
    const colXs = [...new Set(nodes.map(n => n.x))].sort((a, b) => a - b);
    const channelXs = [];
    for (let i = 0; i < colXs.length - 1; i++) {
        channelXs.push((colXs[i] + colXs[i + 1]) / 2);
    }

    const edges = g.edges().map(e => ({
        d: buildChannelPath(nodeById.get(e.v), nodeById.get(e.w), channelXs),
    }));

    const { width, height } = g.graph();
    return { width, height, nodes, edges };
}

// 3-segment Manhattan path that bends at the LAST inter-column channel before
// the target, so the vertical segment is always in known-empty space (never
// passes through an intermediate column). Multiple edges converging on the
// same target column share that channel, forming a clean trunk-and-branches.
// Same-row edges degenerate to a straight horizontal line.
function buildChannelPath(source, target, channelXs) {
    const sourceRight = source.x + source.w / 2;
    const targetLeft = target.x - target.w / 2;
    if (Math.abs(source.y - target.y) < 1) {
        return `M ${sourceRight} ${source.y} L ${targetLeft} ${target.y}`;
    }
    const valid = channelXs.filter(x => x > sourceRight && x < targetLeft);
    const channelX = valid.length > 0
        ? valid[valid.length - 1]
        : (sourceRight + targetLeft) / 2;
    return `M ${sourceRight} ${source.y} `
         + `L ${channelX} ${source.y} `
         + `L ${channelX} ${target.y} `
         + `L ${targetLeft} ${target.y}`;
}

function nodeBoxClass(type) {
    if (type === 'origin') return 'fill-success/10 stroke-success';
    // The queried AS is itself a Tier 1: blue fill (Tier 1 column) + green
    // stroke (origin marker) so the box says "both" without needing a
    // separate color or a third legend entry.
    if (type === 'origin-tier1') return 'fill-info/10 stroke-success';
    if (type === 'tier1') return 'fill-info/10 stroke-info';
    return 'fill-card stroke-border';
}

// Truncate org names that would overflow the 130px node box. Full name is
// still available via the SVG <title> browser tooltip.
const MAX_LABEL_CHARS = 20;
function shortLabel(label) {
    if (!label) return '';
    return label.length > MAX_LABEL_CHARS
        ? label.slice(0, MAX_LABEL_CHARS - 1).trimEnd() + '…'
        : label;
}
</script>

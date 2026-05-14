<template>
    <!-- ASN Connectivity: layered upstream graph from origin AS to Tier 1 ISPs (lazy-loads dagre). -->
    <div class="rounded-md border bg-muted/40 text-sm">
        <div class="px-3 pt-3 pb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <span class="flex-1">{{ t('ipInfos.ASNConnectivity.note') }}</span>
            <button v-if="layout" type="button" @click="isExpanded = true"
                class="shrink-0 rounded-sm p-0.5 hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                :aria-label="t('ipInfos.ASNConnectivity.expand')" :title="t('ipInfos.ASNConnectivity.expand')">
                <Maximize2 class="size-3.5" />
            </button>
        </div>

        <!-- Loaded -->
        <div v-if="layout" class="px-3 pb-3 overflow-auto">
            <!-- height:auto + maxWidth:100% lets the viewBox ratio scale without letterboxing. -->
            <svg :viewBox="`0 0 ${layout.width} ${layout.height}`"
                :style="{ width: layout.width + 'px', height: 'auto', maxWidth: '100%' }" class="block mx-auto">
                <defs>
                    <marker id="jn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"
                        orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                    </marker>
                </defs>
                <g class="text-muted-foreground">
                    <path v-for="(e, i) in layout.edges" :key="i" :d="e.d" fill="none" stroke="currentColor"
                        stroke-width="1.2" marker-end="url(#jn-arrow)" opacity="0.6" stroke-linejoin="miter" />
                </g>
                <!-- Opaque fill-card base under the tinted type rect so edges behind don't bleed through. -->
                <g v-for="n in layout.nodes" :key="n.asn" :transform="`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`">
                    <title v-if="n.label">AS{{ n.asn }} · {{ n.label }}</title>
                    <rect :width="n.w" :height="n.h" rx="6" class="fill-card" />
                    <rect :width="n.w" :height="n.h" rx="6" :class="nodeBoxClass(n.type)" stroke-width="1.5" />
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

            <div
                class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span v-for="item in legendItems" :key="item.label" class="inline-flex items-center gap-1.5">
                    <span class="inline-block size-3 rounded-sm" :class="item.swatchClass"></span>
                    {{ item.label }}
                </span>
            </div>
        </div>

        <!-- Empty (0 nodes = AS not in CAIDA). 1-node graphs are legit (Tier 1 origins). -->
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

    <!-- Expanded view: bottom Drawer (mobile-fullscreen / md+ sheet at 90vh). -->
    <Drawer v-if="layout" :open="isExpanded" @update:open="isExpanded = $event">
        <DrawerContent :title="t('ipInfos.ASNConnectivity.dialogTitle', { asn: props.asn })"
            class="overflow-hidden flex flex-col h-full rounded-none md:h-[90vh] md:rounded-t-[14px]">
            <header class="flex items-center gap-2 px-4 pt-1 pb-3 border-b shrink-0">
                <span
                    class="flex-1 text-base font-semibold truncate flex items-center justify-start md:justify-center gap-2">
                    <Network class="size-4 shrink-0 text-muted-foreground" />
                    {{ t('ipInfos.ASNConnectivity.dialogTitle', { asn: props.asn }) }}
                </span>
                <DrawerClose
                    class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
            </header>

            <!-- Relative wrapper so the floating zoom controls stay pinned while the SVG scrolls. -->
            <div class="relative flex-1 min-h-0">
                <div
                    class="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-card/90 backdrop-blur-sm shadow-sm p-0.5">
                    <button v-for="ctrl in zoomControls" :key="ctrl.label" type="button" @click="ctrl.action"
                        :disabled="ctrl.disabled"
                        class="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        :aria-label="ctrl.label" :title="ctrl.label">
                        <component :is="ctrl.icon" class="size-4" />
                    </button>
                </div>
                <!-- flex + m-auto + shrink-0: narrow SVG centers, wide SVG hugs the start (scroll from x=0).
                    @click clears the click-pinned highlight; nodes use @click.stop to opt out. -->
                <div class="h-full overflow-auto px-4 flex" @click="pinnedAsn = null">
                    <!-- intrinsic w/h scaled by zoom; viewBox stays fixed so content scales with it.
                        max-h clamp is only kept at zoom=1 so the wrapper actually scrolls when zoomed. -->
                    <svg :viewBox="`0 0 ${layout.width} ${layout.height}`" :width="layout.width * zoom"
                        :height="layout.height * zoom"
                        :class="['block m-auto shrink-0', zoom === 1 ? 'w-auto max-h-full md:max-h-none' : '']">
                        <defs>
                            <marker id="jn-arrow-lg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
                                markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                            </marker>
                        </defs>
                        <g class="text-muted-foreground">
                            <path v-for="(e, i) in layout.edges" :key="i" :d="e.d" fill="none" stroke="currentColor"
                                stroke-width="1.2" marker-end="url(#jn-arrow-lg)" stroke-linejoin="miter"
                                class="transition-opacity duration-150"
                                :class="isDimmedEdge(i) ? 'opacity-10' : 'opacity-60'" />
                        </g>
                        <g v-for="n in layout.nodes" :key="n.asn"
                            :transform="`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`"
                            class="cursor-pointer transition-opacity duration-150"
                            :class="{ 'opacity-25': isDimmedNode(n.asn) }" @mouseenter="hoveredAsn = n.asn"
                            @mouseleave="hoveredAsn = null" @click.stop="onNodeClick(n.asn)">
                            <title v-if="n.label">AS{{ n.asn }} · {{ n.label }}</title>
                            <rect :width="n.w" :height="n.h" rx="6" class="fill-card" />
                            <rect :width="n.w" :height="n.h" rx="6" :class="nodeBoxClass(n.type)" stroke-width="1.5" />
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
            </div>
            <!-- Legend pinned outside the scroll area so it stays visible. -->
            <div
                class="shrink-0 px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t">
                <span v-for="item in legendItems" :key="item.label" class="inline-flex items-center gap-1.5">
                    <span class="inline-block size-3 rounded-sm" :class="item.swatchClass"></span>
                    {{ item.label }}
                </span>
            </div>
        </DrawerContent>
    </Drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Maximize2, Network, ZoomIn, ZoomOut, RotateCcw } from 'lucide-vue-next';
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer';

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
// Drawer-only path highlight. Hover sets `hoveredAsn` (desktop), click toggles
// `pinnedAsn` (mobile) — pin wins so a moved-away cursor doesn't drop the selection.
const hoveredAsn = ref(null);
const pinnedAsn = ref(null);
const activeAsn = computed(() => pinnedAsn.value ?? hoveredAsn.value);

function onNodeClick(asn) {
    pinnedAsn.value = pinnedAsn.value === asn ? null : asn;
}

// Drawer SVG zoom (multiplier on width/height attrs; viewBox stays fixed).
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const zoom = ref(1);

function zoomIn() { zoom.value = Math.min(ZOOM_MAX, +(zoom.value + ZOOM_STEP).toFixed(2)); }
function zoomOut() { zoom.value = Math.max(ZOOM_MIN, +(zoom.value - ZOOM_STEP).toFixed(2)); }
function resetZoom() { zoom.value = 1; }

const zoomControls = computed(() => [
    { action: zoomOut, icon: ZoomOut, disabled: zoom.value <= ZOOM_MIN, label: t('ipInfos.ASNConnectivity.zoomOut') },
    { action: resetZoom, icon: RotateCcw, disabled: zoom.value === 1, label: t('ipInfos.ASNConnectivity.zoomReset') },
    { action: zoomIn, icon: ZoomIn, disabled: zoom.value >= ZOOM_MAX, label: t('ipInfos.ASNConnectivity.zoomIn') },
]);

// Each drawer open starts fresh.
watch(isExpanded, (open) => {
    if (!open) {
        zoom.value = 1;
        pinnedAsn.value = null;
        hoveredAsn.value = null;
    }
});

// Reverse BFS from the active node collects every ancestor that can reach it.
// An edge is on-path iff both endpoints are in that ancestor set — works for graphs
// with multiple parallel paths to the same node (no need to enumerate paths).
const highlight = computed(() => {
    if (!layout.value || activeAsn.value == null) return null;
    const target = String(activeAsn.value);
    const preds = new Map();
    for (const e of layout.value.edges) {
        if (!preds.has(e.w)) preds.set(e.w, []);
        preds.get(e.w).push(e.v);
    }
    const nodes = new Set([target]);
    const stack = [target];
    while (stack.length) {
        const cur = stack.pop();
        for (const p of preds.get(cur) || []) {
            if (!nodes.has(p)) {
                nodes.add(p);
                stack.push(p);
            }
        }
    }
    const edgeIdxs = new Set();
    layout.value.edges.forEach((e, i) => {
        if (nodes.has(e.v) && nodes.has(e.w)) edgeIdxs.add(i);
    });
    return { nodes, edges: edgeIdxs };
});

function isDimmedNode(asn) {
    return highlight.value && !highlight.value.nodes.has(String(asn));
}
function isDimmedEdge(idx) {
    return highlight.value && !highlight.value.edges.has(idx);
}

// Shared by inline + drawer views so swatches and labels can't drift.
const legendItems = computed(() => [
    { swatchClass: 'border-2 border-success bg-success/10', label: t('ipInfos.ASNConnectivity.legendOrigin') },
    { swatchClass: 'border-2 border-info bg-info/10', label: t('ipInfos.ASNConnectivity.legendTier1') },
    { swatchClass: 'border bg-card', label: t('ipInfos.ASNConnectivity.legendIntermediate') },
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

// LR dagre layout + custom Manhattan routing. Three tricks keep edges from overlapping:
//   1. Per-edge source/target ports — multi-edges on a node fan out across its vertical
//      side instead of sharing one anchor (no overlapping initial/final horizontals).
//   2. Per-edge channel lanes — each edge that bends in a corridor gets its own x lane
//      (no overlapping verticals; replaces the old trunk-and-branches sharing).
//   3. Ports sorted by other-end y, lanes sorted by source y — preserves geometric
//      order so segments don't cross unnecessarily.
// We bypass dagre's own spline points entirely; they produce diagonal-looking polylines.
function computeLayout(dagre, graph) {
    const NODE_W = 130;
    const NODE_H = 46;
    const PORT_SPAN = NODE_H * 0.75;  // ports use middle 75% of node height

    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'LR',
        ranksep: 90,    // wide enough to fit multiple lanes per corridor
        nodesep: 18,
        marginx: 16,
        marginy: 14,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const n of graph.nodes) {
        const opts = { width: NODE_W, height: NODE_H, _data: n };
        // Pin Tier 1s to the rightmost column (bgp.tools look).
        // Trade-off: direct origin → Tier 1 edges become long horizontals.
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

    const colXs = [...new Set(nodes.map(n => n.x))].sort((a, b) => a - b);
    const colIdxByX = new Map(colXs.map((x, i) => [x, i]));
    const rawEdges = g.edges().map(e => ({ v: e.v, w: e.w }));

    // --- Source/target ports.
    // Group edges by source and by target, then distribute each group across PORT_SPAN.
    // Sort by the OTHER end's y so port order matches geometric order — keeps edges from
    // crossing each other right at the node attachment.
    const outgoing = new Map();
    const incoming = new Map();
    rawEdges.forEach((e, i) => {
        if (!outgoing.has(e.v)) outgoing.set(e.v, []);
        if (!incoming.has(e.w)) incoming.set(e.w, []);
        outgoing.get(e.v).push(i);
        incoming.get(e.w).push(i);
    });

    const sourceY = new Array(rawEdges.length);
    const targetY = new Array(rawEdges.length);

    function assignPorts(nodeId, edgeIdxs, otherEnd, store) {
        const node = nodeById.get(nodeId);
        const sorted = edgeIdxs.slice().sort((a, b) =>
            nodeById.get(rawEdges[a][otherEnd]).y - nodeById.get(rawEdges[b][otherEnd]).y);
        const n = sorted.length;
        sorted.forEach((idx, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            store[idx] = node.y - PORT_SPAN / 2 + t * PORT_SPAN;
        });
    }
    for (const [id, idxs] of outgoing) assignPorts(id, idxs, 'w', sourceY);
    for (const [id, idxs] of incoming) assignPorts(id, idxs, 'v', targetY);

    // --- Channel lanes.
    // Every edge bends in the corridor immediately before its target column (so vertical
    // segments never cut through intermediate columns). Within each corridor, give each
    // edge its own x lane — sorted by source y so lanes don't cross inside the corridor.
    const corridors = new Map();
    rawEdges.forEach((e, idx) => {
        const srcCol = colIdxByX.get(nodeById.get(e.v).x);
        const tgtCol = colIdxByX.get(nodeById.get(e.w).x);
        if (tgtCol > srcCol) {
            const cIdx = tgtCol - 1;
            if (!corridors.has(cIdx)) corridors.set(cIdx, []);
            corridors.get(cIdx).push(idx);
        }
    });

    const laneX = new Array(rawEdges.length);
    for (const [cIdx, idxs] of corridors) {
        const leftEdge = colXs[cIdx] + NODE_W / 2;
        const rightEdge = colXs[cIdx + 1] - NODE_W / 2;
        const sorted = idxs.slice().sort((a, b) => sourceY[a] - sourceY[b]);
        const n = sorted.length;
        sorted.forEach((idx, i) => {
            const t = (i + 1) / (n + 1);
            laneX[idx] = leftEdge + t * (rightEdge - leftEdge);
        });
    }

    // --- Build paths. Straight line when ports happen to align; Manhattan otherwise.
    // Edge endpoints (v / w) ride along so hover-highlight can match edges to nodes.
    const edges = rawEdges.map((e, idx) => {
        const src = nodeById.get(e.v);
        const tgt = nodeById.get(e.w);
        const sourceRight = src.x + src.w / 2;
        const targetLeft = tgt.x - tgt.w / 2;
        const sy = sourceY[idx];
        const ty = targetY[idx];
        if (Math.abs(sy - ty) < 0.5) {
            return { v: e.v, w: e.w, d: `M ${sourceRight} ${sy} L ${targetLeft} ${ty}` };
        }
        const cx = laneX[idx];
        return {
            v: e.v,
            w: e.w,
            d: `M ${sourceRight} ${sy} `
                + `L ${cx} ${sy} `
                + `L ${cx} ${ty} `
                + `L ${targetLeft} ${ty}`,
        };
    });

    const { width, height } = g.graph();
    return { width, height, nodes, edges };
}

function nodeBoxClass(type) {
    if (type === 'origin') return 'fill-success/10 stroke-success';
    // Queried AS is itself a Tier 1: blue fill + green stroke says "both" without a third legend entry.
    if (type === 'origin-tier1') return 'fill-info/10 stroke-success';
    if (type === 'tier1') return 'fill-info/10 stroke-info';
    return 'fill-card stroke-border';
}

// Truncate org names that would overflow the 130px node box; full name stays in the SVG <title> tooltip.
const MAX_LABEL_CHARS = 20;
function shortLabel(label) {
    if (!label) return '';
    return label.length > MAX_LABEL_CHARS
        ? label.slice(0, MAX_LABEL_CHARS - 1).trimEnd() + '…'
        : label;
}
</script>

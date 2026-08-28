<template>
    <!-- ASN Connectivity: layered upstream graph from origin AS to Tier 1 ISPs (lazy-loads dagre). -->
    <div class="rounded-md border bg-muted/40 text-sm">
        <div class="px-3 pt-3 pb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <span class="flex-1">{{ t('ipInfos.ASNConnectivity.note') }}</span>
            <button v-if="layout" type="button" @click="isExpanded = true"
                class="shrink-0 rounded-sm p-0.5 hover:text-foreground hover:bg-muted-foreground/10 cursor-pointer transition-colors"
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
                        stroke-width="1.2" marker-end="url(#jn-arrow)" opacity="0.6" stroke-linejoin="miter"
                        :stroke-dasharray="e.kind === 'peering' ? '6 4' : null" />
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
                    <span v-if="item.lineClass" class="inline-block w-4 border-t-2" :class="item.lineClass"
                        aria-hidden="true"></span>
                    <span v-else class="inline-block size-3 rounded-sm" :class="item.swatchClass"></span>
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
        <DrawerContent :title="t('ipInfos.ASNConnectivity.dialogTitle', { asn: props.asn })" :safe-area-top="isMobile"
            class="overflow-hidden flex flex-col h-full rounded-none md:h-[90vh] md:rounded-t-[14px]">
            <!-- Screenshot root; control widgets inside opt out via `data-screenshot-exclude`. -->
            <div data-screenshot-root class="flex flex-col flex-1 min-h-0 bg-background">
                <header class="flex items-center gap-2 px-4 pt-1 pb-3 border-b shrink-0">
                    <span
                        class="flex-1 text-base font-semibold truncate flex items-center justify-start md:justify-center gap-2">
                        <Network class="size-4 shrink-0 text-muted-foreground" />
                        {{ t('ipInfos.ASNConnectivity.dialogTitle', { asn: props.asn }) }}
                    </span>
                    <DrawerClose data-screenshot-exclude
                        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
                </header>

                <!-- Relative wrapper so the floating zoom controls stay pinned while the SVG scrolls. -->
                <div class="relative flex-1 min-h-0">
                    <div data-screenshot-exclude
                        class="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-card/90 backdrop-blur-sm shadow-sm p-0.5">
                        <button v-for="ctrl in zoomControls" :key="ctrl.label" type="button" @click="ctrl.action"
                            :disabled="ctrl.disabled"
                            class="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            :aria-label="ctrl.label" :title="ctrl.label">
                            <component :is="ctrl.icon" class="size-4" />
                        </button>
                        <span class="w-px h-5 bg-border mx-0.5" aria-hidden="true"></span>
                        <ScreenshotButton filename-prefix="asn-connectivity" :filename-label="props.asn"
                            :track-label="`AS${props.asn}`" :before-capture="prepareGraphForCapture">
                            <template #default="{ capture, isCapturing }">
                                <button type="button" @click="capture" :disabled="isCapturing"
                                    class="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    :aria-label="t('Tooltips.SaveAsImage')" :title="t('Tooltips.SaveAsImage')">
                                    <Spinner v-if="isCapturing" class="size-4" />
                                    <ImageDown v-else class="size-4" />
                                </button>
                            </template>
                        </ScreenshotButton>
                    </div>
                    <!-- flex + m-auto + shrink-0: narrow SVG centers, wide SVG hugs the start (scroll from x=0).
                        @click clears the click-pinned highlight; nodes use @click.stop to opt out.
                        touch-pan-x/y keeps one-finger scrolling native while two-finger pinch
                        (and trackpad ctrl+wheel) is handled by the zoom handlers below. -->
                    <div ref="scrollEl" data-svg-scroll class="h-full overflow-auto px-4 flex touch-pan-x touch-pan-y"
                        @click="pinnedAsn = null" @touchstart.passive="onTouchStart" @touchmove="onTouchMove"
                        @touchend="onTouchEnd" @touchcancel="onTouchEnd" @wheel="onWheel">
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
                                    :class="isDimmedEdge(i) ? 'opacity-10' : 'opacity-60'"
                                    :stroke-dasharray="e.kind === 'peering' ? '6 4' : null" />
                            </g>
                            <g v-for="n in layout.nodes" :key="n.asn"
                                :transform="`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`"
                                class="cursor-pointer transition-opacity duration-150"
                                :class="{ 'opacity-25': isDimmedNode(n.asn) }" @mouseenter="hoveredAsn = n.asn"
                                @mouseleave="hoveredAsn = null" @click.stop="onNodeClick(n.asn)">
                                <title v-if="n.label">AS{{ n.asn }} · {{ n.label }}</title>
                                <rect :width="n.w" :height="n.h" rx="6" class="fill-card" />
                                <rect :width="n.w" :height="n.h" rx="6" :class="nodeBoxClass(n.type)"
                                    stroke-width="1.5" />
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
                        <span v-if="item.lineClass" class="inline-block w-4 border-t-2" :class="item.lineClass"
                            aria-hidden="true"></span>
                        <span v-else class="inline-block size-3 rounded-sm" :class="item.swatchClass"></span>
                        {{ item.label }}
                    </span>
                </div>
            </div>
        </DrawerContent>
    </Drawer>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ImageDown, Maximize2, Network, ZoomIn, ZoomOut, RotateCcw } from '@lucide/vue';
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer';
import { Spinner } from '@/components/ui/spinner';
import ScreenshotButton from '@/components/widgets/ScreenshotButton.vue';
import { useMainStore } from '@/store';

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
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

// --- Gesture zoom: two-finger pinch on touch, ctrl+wheel (trackpad pinch) on desktop.
const scrollEl = ref(null);
let pinchStart = null; // { dist, zoom } while a two-finger gesture is active

const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// Actual on-screen scale. At zoom=1 the fit classes (w-auto max-h-full) may render the
// SVG smaller than intrinsic, so gestures baseline on the rendered width, not `zoom`.
const effectiveZoom = () => {
    const svg = scrollEl.value?.querySelector('svg');
    return svg && layout.value
        ? svg.getBoundingClientRect().width / layout.value.width
        : zoom.value;
};

// Zoom keeping the content point under (clientX, clientY) stationary. Anchored on
// the SVG's own rect — not the scroll container's — so the container padding and
// the m-auto centering offsets can't skew it; the post-render re-measure corrects
// for wherever those offsets end up at the new size.
const zoomAt = (next, clientX, clientY) => {
    const el = scrollEl.value;
    const svg = el?.querySelector('svg');
    next = clampZoom(next);
    const prev = effectiveZoom();
    if (!el || !svg || next === prev) { zoom.value = next; return; }
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / prev;
    const py = (clientY - rect.top) / prev;
    zoom.value = next;
    nextTick(() => {
        const moved = svg.getBoundingClientRect();
        el.scrollLeft += moved.left + px * next - clientX;
        el.scrollTop += moved.top + py * next - clientY;
    });
};

const touchDistance = (touches) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

const onTouchStart = (e) => {
    if (e.touches.length === 2) pinchStart = { dist: touchDistance(e.touches), zoom: effectiveZoom() };
};

const onTouchMove = (e) => {
    if (!pinchStart || e.touches.length !== 2) return;
    e.preventDefault(); // keep the browser from page-zooming and vaul from dragging
    zoomAt(
        pinchStart.zoom * (touchDistance(e.touches) / pinchStart.dist),
        (e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2,
    );
};

const onTouchEnd = (e) => {
    if (e.touches.length < 2) pinchStart = null;
};

const onWheel = (e) => {
    if (!e.ctrlKey) return; // plain wheel keeps native scrolling
    e.preventDefault();
    zoomAt(effectiveZoom() * Math.exp(-e.deltaY / 100), e.clientX, e.clientY);
};

// Each drawer open starts fresh.
watch(isExpanded, (open) => {
    if (!open) {
        zoom.value = 1;
        pinnedAsn.value = null;
        hoveredAsn.value = null;
    }
});

// Force the captured image to be the full 1:1 topology regardless of the
// Drawer viewport or current zoom: reset zoom to 1 and drop every height /
// overflow / max-* constraint that would otherwise clip the SVG. The flex-1
// hosts also need `flex: none`, or flex sizing keeps them at viewport height
// and the capture comes out truncated. Teardown restores prior inline styles.
const prepareGraphForCapture = async (cap) => {
    const scr = cap.querySelector('[data-svg-scroll]');
    const svg = scr?.querySelector('svg');
    const wrap = scr?.parentElement;  // the relative flex-1 zoom-controls host
    if (!scr || !svg || !wrap) return;

    const prevZoom = zoom.value;
    const snapshot = [
        { el: cap, css: cap.style.cssText },
        { el: wrap, css: wrap.style.cssText },
        { el: scr, css: scr.style.cssText },
        { el: svg, css: svg.style.cssText },
    ];

    zoom.value = 1;
    // `min-width: max-content` so wide topologies aren't clipped to Drawer width.
    cap.style.flex = 'none';
    cap.style.height = 'auto';
    cap.style.minWidth = 'max-content';
    wrap.style.flex = 'none';
    wrap.style.height = 'auto';
    scr.style.height = 'auto';
    scr.style.overflow = 'visible';
    svg.style.maxHeight = 'none';
    svg.style.maxWidth = 'none';
    await nextTick();

    return () => {
        zoom.value = prevZoom;
        snapshot.forEach(({ el, css }) => { el.style.cssText = css; });
    };
};

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
// Node types render as swatches (swatchClass); edge kinds as line samples (lineClass).
const legendItems = computed(() => [
    { swatchClass: 'border-2 border-success bg-success/10', label: t('ipInfos.ASNConnectivity.legendOrigin') },
    { swatchClass: 'border-2 border-info bg-info/10', label: t('ipInfos.ASNConnectivity.legendTier1') },
    { swatchClass: 'border bg-card', label: t('ipInfos.ASNConnectivity.legendIntermediate') },
    { lineClass: 'border-muted-foreground', label: t('ipInfos.ASNConnectivity.legendTransit') },
    { lineClass: 'border-dashed border-muted-foreground', label: t('ipInfos.ASNConnectivity.legendPeering') },
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

// Dagre layering/ordering + custom column placement + Manhattan trunk routing:
//   1. Own coordinates — Tier 1s re-pinned to one terminal column (wrapped in
//      two staggered sub-columns when tall), columns stacked tightly, centered.
//   2. Target-bundled edges — all edges into a node share one corridor lane
//      and one entry point: one trunk instead of N parallel lines.
//   3. Geometric sorting (ports and lanes by target y) avoids trunk crossings.
function computeLayout(dagre, graph) {
    const NODE_W = 130;
    const NODE_H = 46;
    const PORT_SPAN = NODE_H * 0.75;  // ports use middle 75% of node height
    const NODE_SEP = 18;
    const COL_GAP = 90;               // corridor between columns (lane space)
    const SINK_SUBCOL_GAP = 80;       // corridor between the two terminal sub-columns
    const MARGIN_X = 16;
    const MARGIN_Y = 14;
    const WRAP_MIN_ROWS = 10;         // terminal column wraps in two beyond this

    // Dagre supplies layering and a crossing-minimizing vertical order only;
    // its raw positions scatter Tier 1s across columns and leave holes.
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', ranksep: COL_GAP, nodesep: NODE_SEP });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of graph.nodes) {
        g.setNode(String(n.asn), { width: NODE_W, height: NODE_H, _data: n });
    }
    for (const e of graph.edges) {
        // kind ('transit' | 'peering') rides the edge label so it survives dagre.
        g.setEdge(String(e.from), String(e.to), { kind: e.kind });
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

    // --- Column assignment. Non-terminals keep their dagre layer (compacted);
    // every tier1 node is re-pinned to one terminal column on the far right.
    const dagreColXs = [...new Set(nodes.map(n => n.x))].sort((a, b) => a - b);
    const dagreColOf = new Map(dagreColXs.map((x, i) => [x, i]));
    const isTerminal = (n) => n.type === 'tier1';
    const interCols = [...new Set(
        nodes.filter(n => !isTerminal(n)).map(n => dagreColOf.get(n.x)),
    )].sort((a, b) => a - b);
    const compactCol = new Map(interCols.map((c, i) => [c, i]));
    const sinkCol = interCols.length;

    const columns = [];
    for (const n of nodes) {
        const c = isTerminal(n) ? sinkCol : compactCol.get(dagreColOf.get(n.x));
        (columns[c] ??= []).push(n);
    }
    // Dagre's vertical order minimizes crossings — keep it per column.
    columns.forEach(col => col.sort((a, b) => a.y - b.y));

    // --- Stacking. Columns stack tightly, centered on the tallest. A big
    // terminal column wraps into two half-row-staggered sub-columns, so
    // trunks to the far one cross the near one at its row gaps.
    const rowStep = NODE_H + NODE_SEP;
    const colX = (c) => MARGIN_X + NODE_W / 2 + c * (NODE_W + COL_GAP);
    const wrapSink = (columns[sinkCol]?.length ?? 0) >= WRAP_MIN_ROWS;
    const heights = columns.map((col, c) =>
        c === sinkCol && wrapSink
            ? (Math.ceil(col.length / 2) - 1) * rowStep + rowStep / 2 + NODE_H
            : (col.length - 1) * rowStep + NODE_H);
    const graphH = Math.max(...heights);
    columns.forEach((col, c) => {
        const top = MARGIN_Y + (graphH - heights[c]) / 2 + NODE_H / 2;
        col.forEach((n, i) => {
            if (c === sinkCol && wrapSink) {
                n.x = colX(c) + (i % 2) * (NODE_W + SINK_SUBCOL_GAP);
                n.y = top + Math.floor(i / 2) * rowStep + (i % 2) * (rowStep / 2);
            } else {
                n.x = colX(c);
                n.y = top + i * rowStep;
            }
        });
    });
    // --- Skip-edge stagger. A single-node column crossed by an edge between
    // its neighbors (A → B → C plus a direct A → C) sits on that edge's line,
    // hiding it under the node's box. Nudge such columns off center,
    // alternating direction so consecutive nudged columns don't realign.
    const colOfAsn = new Map();
    columns.forEach((col, c) => col.forEach(n => colOfAsn.set(n.asn, c)));
    let flip = 1;
    columns.forEach((col, c) => {
        if (col.length !== 1) return;
        const crossed = graph.edges.some(e =>
            colOfAsn.get(e.from) < c && colOfAsn.get(e.to) > c);
        if (!crossed) return;
        col[0].y += flip * rowStep * 0.75;
        flip = -flip;
    });
    // Nudges can poke past the stacked extent — re-anchor and size off nodes.
    const shiftY = MARGIN_Y - Math.min(...nodes.map(n => n.y - n.h / 2));
    nodes.forEach(n => { n.y += shiftY; });
    const frame = {
        width: colX(columns.length - 1) + (wrapSink ? NODE_W + SINK_SUBCOL_GAP : 0)
            + NODE_W / 2 + MARGIN_X,
        height: Math.max(...nodes.map(n => n.y + n.h / 2)) + MARGIN_Y,
    };

    const colXs = [...new Set(nodes.map(n => n.x))].sort((a, b) => a - b);
    const colIdxByX = new Map(colXs.map((x, i) => [x, i]));
    const rawEdges = g.edges().map(e => ({ v: e.v, w: e.w, kind: g.edge(e).kind }));

    // --- Ports. Sources fan edges across PORT_SPAN sorted by target y;
    // targets take every edge at their center (single bundled entry).
    const outgoing = new Map();
    rawEdges.forEach((e, i) => {
        if (!outgoing.has(e.v)) outgoing.set(e.v, []);
        outgoing.get(e.v).push(i);
    });

    const sourceY = new Array(rawEdges.length);
    const targetY = rawEdges.map(e => nodeById.get(e.w).y);

    for (const [id, edgeIdxs] of outgoing) {
        const node = nodeById.get(id);
        const sorted = edgeIdxs.slice().sort((a, b) =>
            nodeById.get(rawEdges[a].w).y - nodeById.get(rawEdges[b].w).y);
        const n = sorted.length;
        sorted.forEach((idx, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            sourceY[idx] = node.y - PORT_SPAN / 2 + t * PORT_SPAN;
        });
    }

    // --- Channel lanes. Every edge bends in the corridor right after its
    // source, so the long horizontal of a column-skipping edge runs at TARGET
    // height — through the terminal column's brick gaps and clear of nudged
    // columns — instead of at source-port height under whatever box it meets.
    // Edges sharing a target share one x lane per corridor (the trunk), and
    // lanes sort by target y so trunks don't cross inside a corridor.
    const corridors = new Map();  // corridor idx → Map(target id → edge idxs)
    rawEdges.forEach((e, idx) => {
        const srcCol = colIdxByX.get(nodeById.get(e.v).x);
        const tgtCol = colIdxByX.get(nodeById.get(e.w).x);
        if (tgtCol > srcCol) {
            if (!corridors.has(srcCol)) corridors.set(srcCol, new Map());
            const byTarget = corridors.get(srcCol);
            if (!byTarget.has(e.w)) byTarget.set(e.w, []);
            byTarget.get(e.w).push(idx);
        }
    });

    const laneX = new Array(rawEdges.length);
    for (const [cIdx, byTarget] of corridors) {
        const leftEdge = colXs[cIdx] + NODE_W / 2;
        const rightEdge = colXs[cIdx + 1] - NODE_W / 2;
        const targets = [...byTarget.keys()].sort((a, b) =>
            nodeById.get(a).y - nodeById.get(b).y);
        const n = targets.length;
        targets.forEach((id, i) => {
            const x = leftEdge + ((i + 1) / (n + 1)) * (rightEdge - leftEdge);
            for (const idx of byTarget.get(id)) laneX[idx] = x;
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
            return { v: e.v, w: e.w, kind: e.kind, d: `M ${sourceRight} ${sy} L ${targetLeft} ${ty}` };
        }
        const cx = laneX[idx];
        return {
            v: e.v,
            w: e.w,
            kind: e.kind,
            d: `M ${sourceRight} ${sy} `
                + `L ${cx} ${sy} `
                + `L ${cx} ${ty} `
                + `L ${targetLeft} ${ty}`,
        };
    });

    return { width: frame.width, height: frame.height, nodes, edges };
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

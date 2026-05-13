<template>
    <div class="browser-info-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('browserinfo.Note') }}</p>
            <p>{{ t('browserinfo.Note2') }}</p>
        </div>

        <Transition name="slide-fade" mode="out-in">
            <!-- Loading / error state -->
            <div v-if="checkingStatus !== 'finished'"
                class="flex items-center justify-center gap-2 py-8 text-sm">
                <template v-if="checkingStatus === 'running'">
                    <Spinner class="text-info" />
                    <span class="text-muted-foreground">{{ t('browserinfo.calculating') }}</span>
                </template>
                <p v-else-if="checkingStatus === 'error'" class="text-destructive">{{ errorMsg }}</p>
            </div>

            <!-- Result: Browser (2/3) + Fingerprint (1/3), then full-width components breakdown. -->
            <Card v-else id="browserInfoResult">
                <CardContent class="p-4 md:p-6 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Browser area -->
                        <section class="md:col-span-2 space-y-4">
                            <header class="flex items-center gap-2">
                                <BriefcaseBusiness class="size-5 text-muted-foreground" />
                                <h3 class="text-lg font-semibold tracking-tight m-0">
                                    {{ t('browserinfo.browser.Infos') }}
                                </h3>
                            </header>

                            <!-- UA hero block —— success color emphasis -->
                            <div class="rounded-lg border border-success/30 bg-success/10 p-3 space-y-2">
                                <div class="flex items-center justify-between gap-2">
                                    <Badge class="bg-success text-success-foreground border-transparent font-normal">
                                        User Agent
                                    </Badge>
                                    <Button variant="ghost" size="icon" class="size-7 -mr-1 cursor-pointer hover:bg-transparent"
                                        @click="copyToClipboard(userAgent.ua)"
                                        aria-label="Copy UA">
                                        <component :is="copiedStatus ? CopyCheck : Copy" class="size-4"
                                        :class="copiedStatus ? 'text-success' : ''" />
                                    </Button>
                                </div>
                                <p class="font-mono text-sm leading-relaxed wrap-break-word">{{ userAgent.ua }}</p>
                            </div>

                            <!-- Field dl grid -->
                            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div v-for="f in browserFields" :key="f.label">
                                    <dt class="text-sm text-muted-foreground mb-0.5">{{ f.label }}</dt>
                                    <dd class="text-base font-medium wrap-break-word">{{ f.value || '—' }}</dd>
                                </div>
                            </dl>
                        </section>

                        <!-- Fingerprint area -->
                        <section class="space-y-4">
                            <header class="flex items-center gap-2">
                                <Fingerprint class="size-5 text-muted-foreground" />
                                <h3 class="text-lg font-semibold tracking-tight m-0">
                                    {{ t('browserinfo.fingerprint.Infos') }}
                                </h3>
                            </header>

                            <!-- Fingerprint hero block —— info color emphasis (different from UA) -->
                            <div class="rounded-lg border border-info/30 bg-info/10 p-3 space-y-2">
                                <Badge class="bg-info text-info-foreground border-transparent font-normal">
                                    {{ t('browserinfo.fingerprint.fingerprint') }}
                                </Badge>
                                <p class="font-mono text-sm wrap-break-word">{{ fingerprint }}</p>
                            </div>

                            <!-- Exclude options list -->
                            <div>
                                <p class="text-sm mb-2">{{ t('browserinfo.fingerprint.changeOption') }}</p>
                                <div class="rounded-lg border bg-card divide-y">
                                    <div v-for="(_, key) in excludeOptions" :key="key"
                                        class="flex items-center justify-between gap-2 px-3 py-2">
                                        <label :for="key" class="text-sm cursor-pointer select-none">
                                            {{ t(`browserinfo.options.${key}`) }}
                                        </label>
                                        <Switch :id="key" v-model="excludeOptions[key]" />
                                    </div>
                                </div>
                            </div>

                            <!-- Hint -->
                            <div class="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                                <Info class="size-3.5 mt-0.5 shrink-0" />
                                <span class="leading-relaxed">{{ t('browserinfo.fingerprint.browserTips') }}</span>
                            </div>
                        </section>
                    </div>

                    <!-- Components breakdown — each block has its own scrollable box so
                         long arrays (fonts) don't blow up page height. -->
                    <section class="space-y-3 border-t pt-6">
                        <header class="flex items-center gap-2">
                            <Microscope class="size-5 text-muted-foreground" />
                            <h3 class="text-lg font-semibold tracking-tight m-0">
                                {{ t('browserinfo.components.title') }}
                            </h3>
                        </header>
                        <p class="text-sm text-muted-foreground">{{ t('browserinfo.components.note') }}</p>

                        <div class="rounded-lg border bg-card divide-y">
                            <div v-for="(value, key) in components" :key="key" class="p-3 space-y-2">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" class="font-mono shrink-0">{{ key }}</Badge>
                                    <span class="text-xs text-muted-foreground">
                                        {{ t(`browserinfo.options.${key}`) }}
                                    </span>
                                </div>
                                <div class="max-h-64 overflow-auto rounded bg-muted/40 p-2 space-y-0.5">
                                    <div v-for="row in flatten(value)" :key="row.key"
                                        class="flex gap-3 text-xs">
                                        <code class="text-muted-foreground shrink-0 font-mono">{{ row.key }}</code>
                                        <span class="font-mono break-all">{{ row.value }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </CardContent>
            </Card>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { BriefcaseBusiness, CopyCheck, Copy, Fingerprint, Info, Microscope } from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);

const fingerprint = ref('');
// Per-component data from `result.components`; powers the breakdown panel.
const components = ref({});
// One toggle per component thumbmarkjs's factory registers — keep in sync
// when upstream adds a new one (also need `options.<key>` in all 4 locales).
const excludeOptions = ref({
    'audio': true,
    'canvas': true,
    'fonts': true,
    'hardware': true,
    'locales': true,
    'permissions': true,
    'plugins': true,
    'screen': true,
    'system': true,
    'webgl': true,
    'math': true,
    'intl': true,
    'mediaDevices': true,
    'speech': true,
    'mathml': true,
    'webrtc': true,
});
const errorMsg = ref('');
const checkingStatus = ref('idle');
const copiedStatus = ref(false);

const userAgent = ref('');
const gpu = ref('');
const otherInfos = ref({});

const fmtList = (arr) => Array.isArray(arr) && arr.length ? arr.join(', ') : '—';
const fmtDisplay = (d) => d
    ? `${d.width}×${d.height} · ${d.colorDepth}-bit · ${d.pixelRatio}× DPR`
    : '—';
const fmtConnection = (c) => {
    if (!c) return 'N/A';
    const parts = [];
    if (c.effectiveType) parts.push(c.effectiveType);
    if (c.downlink) parts.push(`${c.downlink} Mbps`);
    if (typeof c.rtt === 'number') parts.push(`${c.rtt} ms RTT`);
    if (c.saveData) parts.push('save-data');
    return parts.length ? parts.join(' · ') : '—';
};
// DNT spec: '1' enabled, '0' disabled, anything else = unset.
const fmtDNT = (v) => v === '1' ? t('browserinfo.browser.doNotTrackOn')
    : v === '0' ? t('browserinfo.browser.doNotTrackOff')
    : t('browserinfo.browser.doNotTrackUnset');
const fmtPdfViewer = (b) => b === true ? t('browserinfo.browser.pdfViewerYes')
    : b === false ? t('browserinfo.browser.pdfViewerNo')
    : '—';

// Order: identity → locale → display → network → input → privacy → capabilities.
const browserFields = computed(() => {
    if (!userAgent.value || !userAgent.value.browser) return [];
    const o = otherInfos.value;
    return [
        { label: t('browserinfo.browser.browserName'),     value: `${userAgent.value.browser.name || ''} ${userAgent.value.browser.version || ''}`.trim() },
        { label: t('browserinfo.browser.deviceVendor'),    value: `${userAgent.value.device.vendor || ''} ${userAgent.value.device.model || ''}`.trim() },
        { label: t('browserinfo.browser.engineName'),      value: `${userAgent.value.engine.name || ''} ${userAgent.value.engine.version || ''}`.trim() },
        { label: t('browserinfo.browser.cpuArchitecture'), value: userAgent.value.device.cpu ? userAgent.value.device.cpu.architecture : 'N/A' },
        { label: t('browserinfo.browser.osName'),          value: `${userAgent.value.os.name || ''} ${userAgent.value.os.version || ''}`.trim() },
        { label: t('browserinfo.browser.gpu'),             value: gpu.value },
        { label: t('browserinfo.browser.languages'),       value: fmtList(o.languages) },
        { label: t('browserinfo.browser.timezone'),        value: o.timezone },
        { label: t('browserinfo.browser.display'),         value: fmtDisplay(o.display) },
        { label: t('browserinfo.browser.connection'),      value: fmtConnection(o.connection) },
        { label: t('browserinfo.browser.touchPoints'),     value: typeof o.touchPoints === 'number' ? String(o.touchPoints) : '—' },
        { label: t('browserinfo.browser.cpuCores'),        value: o.cpucores },
        { label: t('browserinfo.browser.doNotTrack'),      value: fmtDNT(o.doNotTrack) },
        { label: t('browserinfo.browser.pdfViewer'),       value: fmtPdfViewer(o.pdfViewer) },
        { label: t('browserinfo.browser.cookieEnabled'),   value: o.cookieEnabled
            ? t('browserinfo.browser.cookieEnabledTrue')
            : t('browserinfo.browser.cookieEnabledFalse') },
    ];
});

// Raw WebGL renderer — same string sites read via UNMASKED_RENDERER_WEBGL.
const getGPU = () => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) { gpu.value = 'N/A'; return; }
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = dbg
            ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER);
        gpu.value = renderer || 'N/A';
    } catch (error) {
        console.error('Error getting GPU info:', error);
        gpu.value = 'N/A';
    }
};

const getUA = async () => {
    try {
        const { UAParser } = await import('ua-parser-js');
        const parser = new UAParser();
        parser.setUA(parser.getUA());
        userAgent.value = parser.getResult();
    } catch (error) {
        console.error('Error getting user agent:', error);
        throw error;
    }
};

const getOtherBrowserInfo = () => {
    try {
        otherInfos.value = {
            cookieEnabled: navigator.cookieEnabled,
            cpucores: navigator.hardwareConcurrency,
            // Full Accept-Language preference order, not just the primary.
            languages: navigator.languages || [navigator.language].filter(Boolean),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            display: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
                pixelRatio: window.devicePixelRatio,
            },
            // Chrome / Edge / Android only — falsy elsewhere.
            connection: navigator.connection
                ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt,
                    saveData: navigator.connection.saveData,
                }
                : null,
            touchPoints: navigator.maxTouchPoints,
            doNotTrack: navigator.doNotTrack,
            pdfViewer: navigator.pdfViewerEnabled,
        };
    } catch (error) {
        console.error('Error getting other browser info:', error);
        throw error;
    }
};

// Flatten a nested component value into `{ key: 'a.b[0]', value }` rows so
// the breakdown panel renders one leaf per row instead of a JSON blob.
const flatten = (value, prefix = '') => {
    const rows = [];
    if (value === null || value === undefined) {
        rows.push({ key: prefix || '·', value: String(value) });
        return rows;
    }
    if (typeof value !== 'object') {
        rows.push({ key: prefix || '·', value: String(value) });
        return rows;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            rows.push({ key: prefix || '·', value: '[]' });
        } else {
            value.forEach((item, i) => {
                rows.push(...flatten(item, prefix ? `${prefix}[${i}]` : `[${i}]`));
            });
        }
        return rows;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) {
        rows.push({ key: prefix || '·', value: '{}' });
    } else {
        keys.forEach(k => {
            rows.push(...flatten(value[k], prefix ? `${prefix}.${k}` : k));
        });
    }
    return rows;
};

const getExcludeOptions = async () => {
    const results = [];
    const checkOptions = (options, prefix = '') => {
        for (const key in options) {
            const value = options[key];
            const fullPath = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object') checkOptions(value, fullPath);
            else if (!value) results.push(fullPath);
        }
    };
    checkOptions(excludeOptions.value);
    return results;
};

const getFingerPrint = async () => {
    fingerprint.value = t('browserinfo.calculating');
    try {
        const excludes = await getExcludeOptions();
        const { Thumbmark } = await import('@thumbmarkjs/thumbmarkjs');
        // `stabilize: []` overrides the default ['private', 'iframe'] — the
        // library otherwise unconditionally drops permissions (the 'iframe'
        // rule has no browsers filter, fires everywhere) and silently masks
        // canvas/audio/fonts on private mode. Our toggles are the only gate.
        const tm = new Thumbmark({ exclude: excludes, stabilize: [] });
        const result = await tm.get();
        fingerprint.value = result.thumbmark;
        components.value = result.components || {};
    } catch (error) {
        console.error('Error getting fingerprint:', error);
        throw error;
    }
};

const getAll = async () => {
    try {
        checkingStatus.value = 'running';
        await Promise.all([getUA(), getFingerPrint(), getGPU(), getOtherBrowserInfo()]);
        checkingStatus.value = 'finished';
    } catch (error) {
        console.error('Error during checks:', error);
        checkingStatus.value = 'error';
        errorMsg.value = t('browserinfo.calError');
    }
};

const copyToClipboard = async (ua) => {
    try {
        await navigator.clipboard.writeText(ua);
        copiedStatus.value = true;
        setTimeout(() => { copiedStatus.value = false; }, 5000);
    } catch (err) {
        console.error('Copy error:', err);
    }
};

onMounted(() => {
    checkingStatus.value = 'running';
    setTimeout(() => { getAll(); }, 1000);
});

watch(excludeOptions, () => { getFingerPrint(); }, { immediate: true, deep: true });
</script>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.3s ease-out;
}
.slide-fade-enter-from {
    transform: translateY(60px);
    opacity: 0;
}
.slide-fade-leave-to {
    opacity: 0;
}
</style>

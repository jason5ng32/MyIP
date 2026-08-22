<template>
    <div class="flex min-h-screen flex-col">
        <StandalonePageHeader :title="t('report.Title')" />
        <main class="flex-1 mx-auto w-full max-w-300 px-4 py-6 space-y-4">
        <!-- Loading -->
        <div v-if="state === 'loading'"
            class="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Spinner />
            {{ t('reportPage.Loading') }}
        </div>

        <!-- Not found / failed / unsupported version -->
        <div v-else-if="state === 'error'" class="flex flex-col items-center gap-3 py-24 text-center">
            <FileQuestion class="size-10 opacity-40" />
            <p class="font-medium">{{ t(errorKey) }}</p>
            <p v-if="errorKey === 'reportPage.NotFound'" class="text-sm text-muted-foreground">
                {{ t('reportPage.NotFoundNote') }}
            </p>
            <Button as-child variant="action" class="mt-2 cursor-pointer">
                <RouterLink to="/">{{ t('reportPage.TestMine') }}</RouterLink>
            </Button>
        </div>

        <!-- The report -->
        <template v-else-if="report">
            <!-- Banner: provenance + freshness -->
            <div class="rounded-lg border bg-card px-4 py-3 space-y-1">
                <div class="flex items-center gap-2 text-sm">
                    <FileText class="size-4 text-muted-foreground shrink-0" />
                    <span>{{ t('reportPage.GeneratedBy', { origin: report.origin, time: generatedAtDisplay }) }}</span>
                </div>
                <p v-if="expiresAtDisplay" class="text-xs text-muted-foreground">
                    {{ t('report.ExpiresAt', { time: expiresAtDisplay }) }}
                </p>
                <p v-if="isStale" class="text-xs text-warning">{{ t('reportPage.Stale') }}</p>
            </div>

            <ReportSectionCard v-for="id in presentSectionIds" :key="id" :section-id="id"
                :tested-at="report.sections[id].testedAt">
                <component :is="SECTION_COMPONENTS[id]" :section="report.sections[id]" />
            </ReportSectionCard>

            <!-- Recipient actions -->
            <div class="flex flex-wrap items-center gap-2 pt-2">
                <Button type="button" variant="outline" class="cursor-pointer" @click="onCopyForAI">
                    <Bot class="size-4 shrink-0" />
                    {{ t('report.CopyAI') }}
                </Button>
                <Button as-child variant="action" class="cursor-pointer">
                    <RouterLink to="/">{{ t('reportPage.TestMine') }}</RouterLink>
                </Button>
            </div>
        </template>
        </main>
        <Footer />
    </div>
</template>

<script setup>
// Read-only page for a shared diagnostic report (/r/:id). Fetches the stored
// report from /api/report/:id and renders every present section in homepage
// order, in the VIEWER's language (payloads only hold locale-free enums).
// The page never runs tests and is marked noindex — share links are private
// by obscurity and expire, search engines have no business here.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { isoToDateTime } from '@/utils/time-utils.js';
import { REPORT_VERSION, REPORT_SECTION_IDS } from '@/utils/report-schema.js';
import { reportToMarkdown } from '@/utils/report-export.js';
import { useDocumentMeta } from '@/composables/use-document-meta.js';
import StandalonePageHeader from '@/components/StandalonePageHeader.vue';
import Footer from '@/components/Footer.vue';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import ReportSectionCard from './sections/ReportSectionCard.vue';
import ReportIpinfo from './sections/ReportIpinfo.vue';
import ReportConnectivity from './sections/ReportConnectivity.vue';
import ReportWebrtc from './sections/ReportWebrtc.vue';
import ReportDnsleak from './sections/ReportDnsleak.vue';
import ReportSpeedtest from './sections/ReportSpeedtest.vue';
import ReportPingtest from './sections/ReportPingtest.vue';
import ReportMtrtest from './sections/ReportMtrtest.vue';
import ReportRuletest from './sections/ReportRuletest.vue';
import ReportBrowserinfo from './sections/ReportBrowserinfo.vue';
import ReportInvisibility from './sections/ReportInvisibility.vue';
import ReportEnhanceddnsleak from './sections/ReportEnhanceddnsleak.vue';
import ReportPersona from './sections/ReportPersona.vue';
import { FileText, FileQuestion, Bot } from '@lucide/vue';

const SECTION_COMPONENTS = {
    ipinfo: ReportIpinfo,
    connectivity: ReportConnectivity,
    webrtc: ReportWebrtc,
    dnsleak: ReportDnsleak,
    speedtest: ReportSpeedtest,
    pingtest: ReportPingtest,
    mtrtest: ReportMtrtest,
    ruletest: ReportRuletest,
    browserinfo: ReportBrowserinfo,
    invisibility: ReportInvisibility,
    enhanceddnsleak: ReportEnhanceddnsleak,
    persona: ReportPersona,
};

const { t, locale } = useI18n();
const route = useRoute();
const store = useMainStore();

const state = ref('loading'); // 'loading' | 'error' | 'ready'
const errorKey = ref('reportPage.NotFound');
const report = ref(null);
const expiresAt = ref('');

const presentSectionIds = computed(() =>
    REPORT_SECTION_IDS.filter((id) => report.value?.sections?.[id]));

const generatedAtDisplay = computed(() =>
    report.value ? isoToDateTime(report.value.generatedAt, locale.value) : '');

const expiresAtDisplay = computed(() => isoToDateTime(expiresAt.value, locale.value));

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const isStale = computed(() =>
    report.value && Date.now() - Date.parse(report.value.generatedAt) > STALE_AFTER_MS);

const loadReport = async () => {
    const id = String(route.params.id ?? '');
    // Same format the backend guard enforces; skip the request for junk ids.
    if (!/^[A-Za-z0-9_-]{22}$/.test(id)) {
        errorKey.value = 'reportPage.NotFound';
        state.value = 'error';
        return;
    }
    try {
        const response = await fetchWithTimeout(`/api/report/${id}`, { timeoutMs: 15000 });
        if (response.status === 404) {
            errorKey.value = 'reportPage.NotFound';
            state.value = 'error';
            return;
        }
        if (!response.ok) throw new Error(`report fetch responded ${response.status}`);
        // The API serves { expiresAt, report }; expiresAt is best-effort.
        const payload = await response.json();
        const data = payload?.report;
        // Older viewers can't know how to render a newer schema.
        if (data?.v !== REPORT_VERSION || !data.sections) {
            errorKey.value = 'reportPage.Unsupported';
            state.value = 'error';
            return;
        }
        report.value = data;
        expiresAt.value = typeof payload.expiresAt === 'string' ? payload.expiresAt : '';
        state.value = 'ready';
    } catch (error) {
        console.error('Loading shared report failed:', error);
        errorKey.value = 'reportPage.LoadFailed';
        state.value = 'error';
    }
};

const onCopyForAI = async () => {
    try {
        await navigator.clipboard.writeText(reportToMarkdown(report.value, t));
        store.setAlert(true, 'text-success', t('report.CopiedMessage'), t('report.CopiedTitle'));
    } catch (error) {
        console.error('Copy for AI failed:', error);
    }
};

useDocumentMeta(() => ({ title: `${t('report.Title')} · IPCheck.ing` }));

// Shared reports must not be indexed; the tag is page-scoped, so drop it on
// SPA-navigation away.
let robotsMeta = null;
onMounted(() => {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    robotsMeta.setAttribute('content', 'noindex');
    document.head.appendChild(robotsMeta);
    loadReport();
});
onBeforeUnmount(() => {
    robotsMeta?.remove();
    robotsMeta = null;
});
</script>

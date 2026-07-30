<template>
    <!-- Dock trigger (stateless panel → default variant, per FAB semantics) -->
    <JnTooltip :text="t('Tooltips.ShareReport')" side="left">
        <Button size="icon" type="button" variant="default" aria-label="Diagnostic Report"
            class="rounded-full shadow-lg cursor-pointer" @click="openDialog">
            <Share2 class="size-4" />
        </Button>
    </JnTooltip>

    <Dialog :open="isOpen" @update:open="onOpenChange">
        <DialogContent :title="t('report.Title')" class="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader :icon="Share2" :title="t('report.Title')" />

            <div class="space-y-4">
                <p class="text-xs text-muted-foreground leading-relaxed">{{ t('report.Note') }}</p>

                <!-- Section checklist: completed tests toggle on/off, the rest
                     stay disabled with a "not tested" hint. -->
                <div class="space-y-2">
                    <Label class="font-medium">{{ t('report.SectionsLabel') }}</Label>
                    <ToggleGroup v-model="selectedIds" type="multiple" variant="outline" :spacing="2"
                        class="w-full flex-wrap justify-start" :aria-label="t('report.SectionsLabel')">
                        <ToggleGroupItem v-for="id in visibleSectionIds" :key="id" :value="id"
                            :disabled="!availableSectionIds.includes(id)"
                            class="rounded-full border px-3 h-8 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground cursor-pointer disabled:cursor-not-allowed">
                            {{ t(SECTION_TITLE_KEYS[id]) }}
                            <span v-if="!availableSectionIds.includes(id)" class="opacity-60">
                                ({{ t('report.NotTested') }})
                            </span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                <!-- Privacy + retention options -->
                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div class="flex items-center gap-2">
                        <Switch id="reportMaskTail" v-model="maskTail" />
                        <Label for="reportMaskTail" class="font-normal cursor-pointer">
                            {{ t('report.MaskTail') }}
                        </Label>
                    </div>
                    <div v-if="sharingEnabled" class="flex items-center gap-2">
                        <Label for="reportTtl" class="font-normal text-muted-foreground">
                            {{ t('report.TtlLabel') }}
                        </Label>
                        <Select v-model="ttlDays">
                            <SelectTrigger id="reportTtl" class="h-8 w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <!-- reka-ui SelectItem values are strings; ttlDays converts back
                                     to a number at POST time. -->
                                <SelectItem v-for="days in REPORT_TTL_DAYS" :key="days" :value="String(days)">
                                    {{ t(`report.Ttl${days}`) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <!-- Preview: exactly what leaves the device (masking applied) -->
                <Collapsible v-model:open="previewOpen">
                    <CollapsibleTrigger
                        class="flex flex-row items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <span>{{ t('report.Preview') }}
                            <ChevronRight class="size-4 transition-transform" :class="previewOpen ? 'rotate-90' : ''" />
                        </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <pre v-if="hasSelection"
                            class="mt-2 p-3 rounded-md bg-muted font-mono text-[11px] leading-relaxed max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word">{{ previewMarkdown }}</pre>
                        <p v-else class="mt-2 text-xs text-muted-foreground">{{ t('report.NoSelection') }}</p>
                    </CollapsibleContent>
                </Collapsible>

                <!-- Actions -->
                <div class="flex flex-wrap items-center gap-2">
                    <Button v-if="sharingEnabled" type="button" variant="action" class="cursor-pointer"
                        :disabled="!hasSelection || creating" @click="onCreateLink">
                        <Spinner v-if="creating" />
                        <Link2 v-else class="size-4 shrink-0" />
                        {{ t('report.CreateLink') }}
                    </Button>
                    <Button type="button" variant="outline" class="cursor-pointer" :disabled="!hasSelection"
                        @click="onCopyForAI">
                        <Bot class="size-4 shrink-0" />
                        {{ t('report.CopyAI') }}
                    </Button>
                    <Button type="button" variant="outline" class="cursor-pointer" :disabled="!hasSelection"
                        @click="onDownloadJson">
                        <FileJson class="size-4 shrink-0" />
                        {{ t('report.DownloadJson') }}
                    </Button>
                </div>

                <p v-if="shareError" class="text-sm text-destructive">{{ t('report.CreateFailed') }}</p>

                <!-- The created link — shown once, with its expiry -->

                <div v-if="shareLink" class="rounded-lg border border-action/30 bg-action/10 p-3 space-y-2">
                    <div
                        class="flex items-center gap-2 min-w-0 border bg-primary-foreground text-primary p-2 rounded-md">
                        <span class="font-mono text-sm break-all flex-1">{{ shareLink }}</span>
                        <CopyButton :value="shareLink" :tooltip="t('report.CopyLink')" />
                    </div>
                    <p class="text-xs text-action">{{ t('report.LinkOnce') }}</p>
                    <p class="text-xs text-muted-foreground mb-0">{{ t('report.ExpiresAt', { time: expiresAtDisplay })
                        }} </p>
                </div>

            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// Share-report dialog + its dock trigger. Reads the collector's snapshots,
// lets the user pick sections / mask IP tails / choose the link TTL, and
// fans out to the three exports: share link (env-gated via
// configs.reportSharing), Markdown for AI assistants, JSON download.
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { useCollectedReport } from '@/composables/use-report-collector.js';
import { useReportShare } from '@/composables/use-report-share.js';
import { REPORT_SECTION_IDS, REPORT_TTL_DAYS } from '@/utils/report-schema.js';
import { SECTION_TITLE_KEYS, buildShareReport, reportToMarkdown, downloadReportJson } from '@/utils/report-export.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import CopyButton from '@/components/widgets/CopyButton.vue';
import { Share2, Link2, Bot, FileJson, ChevronRight } from '@lucide/vue';

const { t } = useI18n();
const store = useMainStore();
const { sections, availableSectionIds } = useCollectedReport();
const { creating, shareLink, expiresAt, shareError, createShareLink, resetShareLink } = useReportShare();

const sharingEnabled = computed(() => store.configs?.reportSharing === true);

const isOpen = ref(false);
const selectedIds = ref([]);
const maskTail = ref(false);
const ttlDays = ref(String(REPORT_TTL_DAYS[0]));
const previewOpen = ref(false);

// The two original-site-only tools (sign-in + private API) don't exist for
// self-host visitors — same gate as Advanced.vue's card grid. Hiding them
// here keeps the checklist honest: no permanently-"not tested" entries.
const ORIGINAL_SITE_ONLY_SECTIONS = new Set(['invisibility', 'enhanceddnsleak']);
const visibleSectionIds = computed(() => REPORT_SECTION_IDS.filter((id) =>
    !ORIGINAL_SITE_ONLY_SECTIONS.has(id) || store.configs?.originalSite === true));

const hasSelection = computed(() => selectedIds.value.length > 0);

const openDialog = () => {
    trackEvent('SideButtons', 'ToggleClick', 'ShareReport');
    // Fresh run each time: preselect everything that has data, drop any
    // previously created link (its report may no longer match the data).
    selectedIds.value = [...availableSectionIds.value];
    resetShareLink();
    isOpen.value = true;
};

const onOpenChange = (value) => { isOpen.value = value; };

// A stale link must never sit next to controls that no longer describe it.
watch([selectedIds, maskTail], () => resetShareLink());

const assembleReport = () => buildShareReport({
    sections,
    selectedIds: selectedIds.value,
    maskTail: maskTail.value,
    locale: store.lang,
    origin: window.location.hostname,
});

const previewMarkdown = computed(() => {
    if (!isOpen.value || !hasSelection.value) return '';
    return reportToMarkdown(assembleReport(), t, { masked: maskTail.value });
});

const onCreateLink = async () => {
    trackEvent('Section', 'StartClick', 'ShareReportLink');
    await createShareLink(assembleReport(), Number(ttlDays.value));
};

const onCopyForAI = async () => {
    trackEvent('Section', 'StartClick', 'ShareReportCopyAI');
    try {
        await navigator.clipboard.writeText(reportToMarkdown(assembleReport(), t, { masked: maskTail.value }));
        store.setAlert(true, 'text-success', t('report.CopiedMessage'), t('report.CopiedTitle'));
    } catch (error) {
        console.error('Copy for AI failed:', error);
    }
};

const onDownloadJson = () => {
    trackEvent('Section', 'StartClick', 'ShareReportDownload');
    downloadReportJson(assembleReport());
};

const expiresAtDisplay = computed(() =>
    expiresAt.value ? new Date(expiresAt.value).toLocaleString() : '');

// For the `e` keyboard shortcut (use-shortcuts.js).
defineExpose({ openDialog });
</script>

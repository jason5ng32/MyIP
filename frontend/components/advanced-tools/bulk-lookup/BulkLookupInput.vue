<!-- Bulk IP Lookup input card: pasted text, the firstPerLine switch, and one
     status bar beside the run button. Extraction and normalization finish
     here; `run` carries the clean entries. A paste with more new IPs than one
     run takes (or than the list has room for) is refused whole. -->
<template>
    <Card>
        <CardContent class="p-4 md:p-6 space-y-3">
            <Label for="bulkLookupText">{{ t('bulklookup.InputLabel') }}</Label>
            <Textarea id="bulkLookupText" v-model="text" rows="6" :disabled="running"
                class="font-mono text-xs md:text-xs min-h-32 max-h-72 overflow-auto"
                :placeholder="t('bulklookup.Placeholder')" autocomplete="off" autocorrect="off"
                autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" />

            <!-- firstPerLine: the switch sits in a box one title line (20px) tall,
                 so it centres on that line however the hint wraps -->
            <div class="flex items-start gap-2">
                <span class="flex h-5 shrink-0 items-center">
                    <Switch id="bulkLookupFirstPerLine" v-model="firstPerLine" :disabled="running" />
                </span>
                <Label for="bulkLookupFirstPerLine" class="flex flex-col items-start gap-0.5 font-normal cursor-pointer">
                    <span class="text-sm leading-5">{{ t('bulklookup.FirstPerLine') }}</span>
                    <span class="text-xs leading-4 text-muted-foreground">{{ t('bulklookup.FirstPerLineHint') }}</span>
                </Label>
            </div>

            <!-- Status bar + run button: one unit, the same height on one line -->
            <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div class="flex flex-1 min-w-0 min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
                    :class="TONE_CLASS[status.tone]" aria-live="polite">
                    <Spinner v-if="status.state === 'running' || status.state === 'updating'" class="size-3.5 shrink-0" />
                    <component :is="STATE_ICON[status.state]" v-else class="size-3.5 shrink-0" />
                    <span class="min-w-0">
                        <i18n-t v-if="status.state === 'ready'" keypath="bulklookup.status.ready" tag="span" scope="global">
                            <template #n>{{ status.params.n }}</template>
                            <template #fresh>
                                <strong class="font-medium text-foreground">{{ t('bulklookup.status.new', { n: status.params.fresh }) }}</strong>
                            </template>
                        </i18n-t>
                        <template v-else>{{ t(`bulklookup.status.${status.state}`, status.params) }}</template>
                        <template v-for="extra in status.extras" :key="extra.key">
                            · {{ t(`bulklookup.status.${extra.key}`, { n: extra.n }) }}
                        </template>
                    </span>
                </div>
                <Button variant="action" class="h-9 w-full shrink-0 cursor-pointer sm:w-auto" :disabled="!canRun" @click="onRun">
                    <Spinner v-if="running" />
                    <Play v-else class="size-4 shrink-0" />
                    {{ runLabel }}
                </Button>
            </div>
        </CardContent>
    </Card>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { watchDebounced } from '@vueuse/core';
import { extractIPs } from '@/utils/features/bulk-lookup-extract.js';
import { planRun, inputStatus } from '@/composables/use-bulk-lookup.js';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { ClipboardPaste, ListChecks, Play, RefreshCw, SearchX, TriangleAlert } from '@lucide/vue';

const props = defineProps({
    // Stored rows, for the new / already-listed split and the caps.
    rows: { type: Array, required: true },
    running: { type: Boolean, default: false },
});
const emit = defineEmits(['run']);

const { t } = useI18n();

const TONE_CLASS = {
    neutral: 'bg-muted/40 text-muted-foreground',
    warning: 'border-warning/30 bg-warning/10 text-warning',
};
const STATE_ICON = {
    empty: ClipboardPaste, none: SearchX, ready: ListChecks, known: RefreshCw, tooMany: TriangleAlert, noRoom: TriangleAlert,
};

const text = ref('');
const firstPerLine = ref(false);

// `hasText` rides with the scan, so the bar never judges text it hasn't read yet.
const scan = () => ({
    ...extractIPs(text.value, { firstPerLine: firstPerLine.value }),
    hasText: text.value.trim() !== '',
});

// Debounced: a large paste is scanned once typing settles.
const extraction = ref(scan());
watchDebounced([text, firstPerLine], () => {
    extraction.value = scan();
}, { debounce: 250 });
// A cleared input previews nothing straight away.
watch(text, (value) => {
    if (!value) extraction.value = scan();
});

const plan = computed(() => planRun(props.rows, extraction.value.entries));

const status = computed(() => inputStatus({
    hasText: extraction.value.hasText,
    summary: extraction.value.summary,
    plan: plan.value,
    running: props.running,
}));

const canRun = computed(() => !props.running && ['run', 'counts'].includes(status.value.button.key));
const runLabel = computed(() => {
    const { key, n } = status.value.button;
    if (key === 'run') return t('bulklookup.Run', { n });
    if (key === 'counts') return t('bulklookup.RunCountsOnly');
    return t('bulklookup.RunIdle');
});

// Rescanned on click, so a run never misses the last debounce.
const onRun = () => {
    if (!canRun.value) return;
    extraction.value = scan();
    if (extraction.value.entries.length && !plan.value.blocked) emit('run', extraction.value.entries);
};

// Called by the page once a run has landed.
const reset = () => {
    text.value = '';
};

defineExpose({ reset });
</script>

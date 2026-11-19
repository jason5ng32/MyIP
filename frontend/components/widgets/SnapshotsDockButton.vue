<template>
    <!-- Dock entry to the Snapshots tool page; the badge counts stored snapshots from the second on. -->
    <JnTooltip :text="t('Tooltips.Snapshots')" side="left">
        <Button size="icon" type="button" variant="default" :aria-label="t('Tooltips.Snapshots')"
            class="relative rounded-full shadow-lg cursor-pointer" @click="openTool">
            <Camera class="size-4" />
            <span v-if="count >= 2" aria-hidden="true"
                class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full border bg-background text-foreground text-[10px] font-medium leading-[14px] tabular-nums text-center">
                {{ count }}
            </span>
        </Button>
    </JnTooltip>
</template>

<script setup>
// Snapshots dock button: opens /tools/snapshots and shows how many snapshots
// this browser holds (hidden below 2: one tells the visitor nothing).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { trackEvent } from '@/utils/analytics';
import { useSnapshots } from '@/composables/use-snapshot-recorder.js';
import { SNAPSHOTS_TOOL_PATH } from '@/utils/features/snapshot-entry.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Camera } from '@lucide/vue';

const { t } = useI18n();
const router = useRouter();
const { snapshots } = useSnapshots();
const count = computed(() => snapshots.value.length);

const openTool = () => {
    trackEvent('SideButtons', 'ToggleClick', 'Snapshots');
    router.push(SNAPSHOTS_TOOL_PATH);
};
</script>

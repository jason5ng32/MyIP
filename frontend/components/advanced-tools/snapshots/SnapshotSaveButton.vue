<!-- Snapshots page: the "Save snapshot now" button (width from the
     caller's class). It is
     disabled only while a save runs the homepage tests (no IP results yet
     this visit; use-snapshot-save.js), showing a spinner and "Running
     homepage tests…". Shown at the top of the left column (≥1024px), in the
     main column's action row (below 1024px) and in the empty state. -->
<template>
    <Button variant="action" class="cursor-pointer" :disabled="running" :aria-busy="running" @click="emit('save')">
        <Spinner v-if="running" /><Camera v-else />
        {{ t(running ? 'snapshots.SaveNowRunning' : 'snapshots.SaveNow') }}
    </Button>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Camera } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

defineProps({
    running: { type: Boolean, default: false },
});
const emit = defineEmits(['save']);

const { t } = useI18n();
</script>

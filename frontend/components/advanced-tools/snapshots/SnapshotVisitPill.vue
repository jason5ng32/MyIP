<!-- Snapshots: the "This visit" pill — the pulsing live dot plus its label —
     marking the snapshot this visit is recorded into; wraps as one unit. -->
<template>
    <Badge variant="outline" class="shrink-0 gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-muted-foreground">
        <SnapshotLiveDot />{{ t('snapshots.ThisVisit') }}
    </Badge>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import SnapshotLiveDot from './SnapshotLiveDot.vue';

const { t } = useI18n();
</script>

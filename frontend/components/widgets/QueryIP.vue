<template>
    <!-- Floating query button (bottom right fixed) -->
    <JnTooltip :text="t('Tooltips.QueryIP')" side="left">
        <Button size="icon" variant="action" type="button" aria-label="IP Check"
            class="rounded-full shadow-lg cursor-pointer" @click="openQueryIP">
            <Search class="size-4" />
        </Button>
    </JnTooltip>

    <QueryIPDialog v-model:open="isOpen" />
</template>

<script setup>
// QueryIP — Home's FAB for the manual IP lookup; the dialog itself is
// QueryIPDialog, which tool pages mount on their own.
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import QueryIPDialog from './QueryIPDialog.vue';
import { Search } from '@lucide/vue';

const { t } = useI18n();

const isOpen = ref(false);

const openQueryIP = () => {
    trackEvent('SideButtons', 'ToggleClick', 'QueryIP');
    openModal();
};

const openModal = () => {
    isOpen.value = true;
};

defineExpose({ openModal });
</script>

<template>
    <JnTooltip v-if="pulseVisible" :text="t('nav.pulse.tooltip')">
        <Button variant="ghost" :size="isMobile ? 'icon' : 'sm'" class="relative cursor-pointer"
            :class="isMobile ? 'size-8' : 'h-8 gap-1.5 px-2'" :aria-label="t('nav.pulse.title')" @click="openPulse">
            <span v-if="festivalEmoji" class="inline-flex size-4 items-center justify-center text-sm leading-none"
                aria-hidden="true">{{ festivalEmoji }}</span>
            <Earth v-else class="size-4 animate-spin animation-duration-[8s]" />
            <span v-if="!isMobile">{{ t('nav.pulse.title') }}</span>
            <span class="flex size-1.5" :class="isMobile ? 'absolute right-1 top-1' : 'relative'" aria-hidden="true">
                <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60"></span>
                <span class="relative inline-flex size-1.5 rounded-full bg-success"></span>
            </span>
        </Button>
    </JnTooltip>

    <PulseSheet v-if="hasOpenedPulse" />
</template>

<script setup>
// "Earth Online" Nav trigger. Naming rule: "Earth Online" is the user-facing
// name only; everything technical (files, ids, locale keys, the backend
// service) uses the code name "pulse".
//
// Two-tier gating: the social sections need the pulse beacon backend
// (VITE_PULSE_BEACON_URL, build-time); the outage feed only needs
// /api/cfradar?view=outages, gated on the runtime `cloudFlare` configs flag.
// The entry button shows when either half can render; the Sheet body
// (PulseSheet.vue) loads lazily on first open — whether triggered from this
// button, the keyboard shortcut, or an InfoBanner action.
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { hasPulseBackend } from '@/utils/features/pulse-beacon.js';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import { useFestivalSkin } from '@/composables/use-festival-skin.js';
import { Earth } from '@lucide/vue';

const PulseSheet = defineAsyncComponent(() => import('@/components/widgets/PulseSheet.vue'));

const { t } = useI18n();
const store = useMainStore();
const isMobile = computed(() => store.isMobile);
// The active festival's emoji stands in for the entry button's globe.
const { pulseEmoji: festivalEmoji } = useFestivalSkin();

// Entry visibility: either half of the panel can carry it (see header).
// `cloudFlare` lands with the /api/configs fetch, so the button may appear late.
const pulseVisible = computed(() => hasPulseBackend || Boolean(store.configs.cloudFlare));

const hasOpenedPulse = ref(false);
watch(() => store.openSheet === 'pulse', (open) => {
    if (open) hasOpenedPulse.value = true;
}, { immediate: true });

const openPulse = () => {
    store.toggleSheet('pulse');
    trackEvent('Nav', 'NavClick', 'Pulse');
};
</script>

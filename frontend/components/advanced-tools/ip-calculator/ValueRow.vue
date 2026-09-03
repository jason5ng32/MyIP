<!-- One label / value pair inside the IP Calculator's <dl> grids: muted
     label, mono value fitted to the column width, copy button on the right.
     A null / empty value renders an em dash and no copy button; the default
     slot lets a caller append a badge or note after the value. The value
     line has a fixed min-height so flipping to the dash or a smaller FitText
     tier never moves the page while the prefix slider is being dragged. -->
<template>
    <div class="min-w-0">
        <dt class="text-sm text-muted-foreground mb-0.5">{{ label }}</dt>
        <dd class="flex items-center gap-1 min-w-0 m-0 min-h-6">
            <template v-if="hasValue">
                <FitText v-if="fit" :text="value" :tiers="INLINE_TIERS" :title="value"
                    class="font-mono font-medium min-w-0" />
                <span v-else class="font-mono font-medium wrap-break-word min-w-0">{{ value }}</span>
                <CopyButton v-if="copy" :value="value" :aria-label="t('ipcalculator.copy')"
                    class="p-1 text-muted-foreground hover:text-primary" icon-class="size-3.5" />
            </template>
            <span v-else class="text-muted-foreground">—</span>
            <slot />
        </dd>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CopyButton from '@/components/widgets/CopyButton.vue';
import FitText from '@/components/widgets/FitText.vue';
import { INLINE_TIERS } from '@/composables/use-fit-text.js';

const props = defineProps({
    label: { type: String, required: true },
    value: { type: [String, null], default: null },
    fit: { type: Boolean, default: true },
    copy: { type: Boolean, default: true },
});

const { t } = useI18n();
const hasValue = computed(() => typeof props.value === 'string' && props.value !== '');
</script>

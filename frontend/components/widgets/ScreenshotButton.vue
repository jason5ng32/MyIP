<!-- Reusable screenshot trigger. Finds its capture target via `closest()` —
     callers mark the target with `data-screenshot-root` and drop this
     component anywhere inside it. Default UI is a shadcn icon Button +
     JnTooltip; provide a default slot to replace the UI entirely. -->
<template>
    <span ref="rootRef" class="contents">
        <slot v-if="$slots.default" :capture="onCapture" :is-capturing="isCapturing" />
        <JnTooltip v-else :text="tooltipText" :side="tooltipSide">
            <Button :size="size" :variant="variant" :class="buttonClass"
                :disabled="disabled || isCapturing"
                @click="onCapture" :aria-label="ariaLabel || tooltipText">
                <Spinner v-if="isCapturing" />
                <ImageDown v-else class="size-4" />
            </Button>
        </JnTooltip>
    </span>
</template>

<script setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { JnTooltip } from '@/components/ui/tooltip';
import { ImageDown } from '@lucide/vue';
import { useScreenshot, slugifyForFilename } from '@/composables/use-screenshot.js';

// Filename = `${prefix}-${slug(label)}-${Date.now()}.png`.
const props = defineProps({
    targetSelector: { type: String, default: '[data-screenshot-root]' },
    filenamePrefix: { type: String, required: true },
    filenameLabel: { type: String, default: '' },
    trackLabel: { type: String, default: '' },
    pixelRatio: { type: Number, default: 2 },
    beforeCapture: { type: Function, default: null },

    // Default-UI passthrough (ignored when the default slot is used).
    disabled: { type: Boolean, default: false },
    tooltipText: { type: String, default: '' },
    tooltipSide: { type: String, default: 'left' },
    ariaLabel: { type: String, default: '' },
    size: { type: String, default: 'icon' },
    variant: { type: String, default: 'outline' },
    buttonClass: { type: [String, Array, Object], default: 'size-8 cursor-pointer' },
});

// `class="contents"` keeps the span out of layout while still giving us a
// stable DOM node to ascend from with `closest()`.
const rootRef = ref(null);
const { isCapturing, capture } = useScreenshot();

const onCapture = () => {
    const start = rootRef.value;
    if (!start) return;
    const target = start.closest(props.targetSelector);
    if (!target) return;
    const slug = slugifyForFilename(props.filenameLabel, 'image');
    return capture(target, {
        filename: `${props.filenamePrefix}-${slug}-${Date.now()}.png`,
        trackLabel: props.trackLabel,
        pixelRatio: props.pixelRatio,
        beforeCapture: props.beforeCapture,
    });
};
</script>

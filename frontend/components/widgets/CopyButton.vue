<script setup>
// Reusable "copy to clipboard" icon button with the project's standard
// success-feedback UX: click → write text → swap Copy → CopyCheck (green) →
// auto-revert after `duration` ms. Optionally wraps a JnTooltip; the tooltip
// is skipped when no `tooltip` text is given (JnTooltip's own disabled path).
//
// Props:
// - `value`: string | () => string. Function form is preferred when the
//   payload is large or expensive to compute (e.g. joined log arrays) so we
//   don't recompute it on every render.
// - `tooltip` / `tooltipSide`: optional tooltip wrapper.
// - `class`: merged into the button's default styling via `cn()` so callers
//   can override hover colors / position / size cleanly (later wins).
// - `iconClass`: lets a caller resize the icon without touching button padding.
// - `ariaLabel`: explicit a11y label; falls back to `tooltip`, then 'Copy'.
// - `duration`: ms the "copied" state stays before reverting (default 5000).
//
// Events:
// - `copied(text)` on success, `error(err)` on clipboard failure.
import { ref, onBeforeUnmount } from 'vue';
import { Copy, CopyCheck } from 'lucide-vue-next';
import { JnTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const props = defineProps({
  value: { type: [String, Function], required: true },
  tooltip: { type: String, default: '' },
  tooltipSide: { type: String, default: 'left' },
  ariaLabel: { type: String, default: '' },
  duration: { type: Number, default: 5000 },
  class: { type: [String, Array, Object], default: undefined },
  iconClass: { type: [String, Array, Object], default: 'size-4' },
});

const emit = defineEmits(['copied', 'error']);

const copied = ref(false);
let revertTimer = null;

const onClick = async () => {
  const text = typeof props.value === 'function' ? props.value() : props.value;
  if (text === null || text === undefined || text === '') return;
  try {
    await navigator.clipboard.writeText(String(text));
    copied.value = true;
    if (revertTimer !== null) clearTimeout(revertTimer);
    revertTimer = setTimeout(() => {
      copied.value = false;
      revertTimer = null;
    }, props.duration);
    emit('copied', text);
  } catch (err) {
    console.error('Copy error:', err);
    emit('error', err);
  }
};

onBeforeUnmount(() => {
  if (revertTimer !== null) clearTimeout(revertTimer);
});
</script>

<template>
  <JnTooltip :text="tooltip" :side="tooltipSide" :disabled="!tooltip">
    <button type="button"
      :class="cn('shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer', $props.class)"
      :aria-label="ariaLabel || tooltip || 'Copy'"
      @click="onClick">
      <component :is="copied ? CopyCheck : Copy"
        :class="cn($props.iconClass, copied ? 'text-success' : '')" />
    </button>
  </JnTooltip>
</template>

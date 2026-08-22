<!-- InfoBanner — fade-slide section banner that upsells an advanced tool
     after a homepage test settles (DNS Leak → Enhanced DNS Leak Test) or
     carries a sponsored placement. With `sweep`, it also announces itself with
     a border light sweep whenever it scrolls into view.
     Callers pass icon / copy / action, plus optional show / sweep. -->
<template>
  <Transition name="fade-slide">
    <div v-if="show" ref="root" :class="{ 'jn-banner-sweep': sweep && visible }"
      class="jn-banner mt-3 flex flex-col md:flex-row items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-4 md:p-5">
      <div class="flex-1 min-w-0 space-y-1.5">
        <h3 class="text-sm font-semibold m-0 flex items-center gap-2 mb-2">
          <component :is="icon" class="size-4 text-info shrink-0" />
          {{ title }}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed m-0">
          {{ note }}
        </p>
      </div>
      <div class="w-full md:w-auto md:self-stretch flex justify-end items-end md:items-center">
        <Button variant="action" size="sm" @click="emit('action')" class="w-full md:w-auto shrink-0 cursor-pointer">
          <span>{{ cta }}</span>
          <ArrowRight class="size-4 ml-1" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue';
import { useElementVisibility } from '@vueuse/core';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@lucide/vue';

defineProps({
  show: { type: Boolean, default: true },
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  note: { type: String, required: true },
  cta: { type: String, required: true },
  sweep: { type: Boolean, default: false },
});

const emit = defineEmits(['action']);

// `show` can flip while the banner is still below the fold, so entering the
// viewport — not mounting — is what triggers the sweep. Leaving and coming
// back replays it. Nothing is observed until the element exists, so a banner
// without `sweep` only pays for one idle observer.
const root = ref(null);
const visible = useElementVisibility(root, { threshold: 0.5 });
</script>

<style scoped>
/* Border light sweep — a conic gradient rotating behind a ring-shaped mask,
   two laps then gone. Motion only; the resting banner is unchanged. */
@property --jn-sweep-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.jn-banner {
  position: relative;
}

.jn-banner-sweep::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: conic-gradient(from var(--jn-sweep-angle),
      transparent 0deg 250deg,
      color-mix(in oklch, var(--info) 60%, transparent) 320deg,
      var(--info) 352deg,
      transparent 360deg);
  /* Keep only the 1px ring: full box minus content box. */
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .jn-banner-sweep::before {
    animation: jn-banner-sweep 3.6s linear both;
  }
}

@keyframes jn-banner-sweep {
  0% { --jn-sweep-angle: 0deg; opacity: 0; }
  6% { opacity: 1; }
  80% { opacity: 1; }
  100% { --jn-sweep-angle: 720deg; opacity: 0; }
}

.fade-slide-enter-active {
  transition: all 0.3s ease-out;
}

.fade-slide-leave-active {
  transition: all 0.2s ease-out;
}

.fade-slide-enter-from {
  transform: translateY(10px);
  opacity: 0;
}

.fade-slide-leave-to {
  opacity: 0;
}
</style>

<!-- InfoBanner — the per-section info-banner slot. Every homepage section
     permanently wires one of these at its bottom; what (if anything) shows is
     decided purely by data: frontend/data/banners/<section>.js (contract in
     utils/banners.js), one banner per section. The directory is deploy-time
     data, never in git — placing a file there IS the decision to show that
     banner on that deployment (self-promo of a built-in tool via `to`, or an
     external advertiser via `url`); a missing file and a file
     default-exporting null both mean the slot renders nothing. Timing is
     data-driven: parents feed their section's completion into the `settled`
     prop, and
     a banner waits for it unless its data sets requireSettled: false. The
     fade-slide appear/disappear can be turned off per banner with
     transition: false; with `sweep: true`, the banner announces itself with a
     border light sweep whenever it scrolls into view. -->
<template>
  <Transition :name="transitionName">
    <div v-if="banner && shown" ref="root" :class="{ 'jn-banner-sweep': sweep && visible }"
      class="jn-banner mt-3 flex flex-col md:flex-row items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-4 md:p-5">
      <div class="flex-1 min-w-0 space-y-1.5">
        <h3 class="text-sm font-semibold m-0 flex items-center gap-2 mb-2">
          <component :is="icon" class="size-4 text-info shrink-0" />
          {{ text.title }}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed m-0">
          {{ text.note }}
        </p>
      </div>
      <div class="w-full md:w-auto md:self-stretch flex justify-end items-end md:items-center">
        <Button variant="action" size="sm" @click="openBanner" class="w-full md:w-auto shrink-0 cursor-pointer">
          <span>{{ text.cta }}</span>
          <ArrowRight class="size-4 ml-1" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useElementVisibility } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { Button } from '@/components/ui/button';
import { ArrowRight, Globe, Megaphone, Server, Shield, Sparkles, Zap } from '@lucide/vue';
import { trackEvent } from '@/utils/analytics';
import { bannerCopy, bannerLink, pickBanner } from '@/utils/banners';

const props = defineProps({
  section: { type: String, required: true },
  settled: { type: Boolean, default: true }, // parent's "section tests have completed a full pass" signal
});

// Data discovery — glob is resolved at build time; the slot's file is the one
// named after the section, and null/absent both mean "render nothing".
const modules = import.meta.glob('../../data/banners/*.js', { eager: true });
const banner = pickBanner(modules, props.section);

// Data files carry lucide icon NAMES so they stay pure (Node-loadable by the
// data test); the component maps them onto imported components here.
const ICONS = { Globe, Megaphone, Server, Shield, Sparkles, Zap };
const icon = ICONS[banner?.icon] ?? Megaphone;
const sweep = banner?.sweep === true; // opt-in per banner, default off
// transition: false in the data swaps to a name with no CSS hooks, so the
// Transition finds no transition/animation styles and inserts/removes the
// element instantly — no fade-slide.
const transitionName = banner?.transition === false ? 'jn-none' : 'fade-slide';

const store = useMainStore();
const router = useRouter();
const lang = computed(() => store.lang);
// requireSettled defaults to true — only an explicit false shows the banner
// before the parent reports `settled`. Deployment placement is the only other
// gate: whoever put the data file on this deployment wanted the banner shown.
const shown = computed(() => banner?.requireSettled === false || props.settled);
// Locale-reactive: the inline `copy` map resolves via the store language.
const text = computed(() => bannerCopy(banner, lang.value));

const openBanner = () => {
  // Section in the event name (GA4 reports list event names out of the box;
  // params would need registered custom dimensions), campaign id as label.
  trackEvent('Section', `BannerClick_${props.section}`, banner.track);
  if (banner.to) {
    router.push(banner.to);
  } else {
    window.open(bannerLink(banner, lang.value), '_blank', 'noopener');
  }
};

// `shown` can flip while the banner is still below the fold, so entering the
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

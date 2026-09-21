<!-- Per-section banner slot. Deploy-time data in data/banners/<section>.js
     exports null, one campaign object, or up to two campaigns. Each campaign
     keeps its own completion gate and animation; visible pairs use two columns. -->
<template>
  <div :class="[shownCount > 0 ? 'grid mt-3 gap-3' : 'contents', { 'md:grid-cols-2': paired }]">
    <Transition v-for="({ banner, text, pricing, icon, theme, shown }, index) in banners" :key="banner.id"
      :name="banner.transition === false ? 'jn-none' : 'fade-slide'">
      <div v-if="shown" :ref="(element) => { slots[index].element.value = element; }" :style="theme"
        :class="{ 'jn-banner-sweep': banner.sweep === true && slots[index].visible.value, 'md:flex-row md:items-center': !paired }"
        class="jn-banner min-w-0 flex flex-col items-start gap-3 rounded-lg border p-4 md:p-5">
        <div class="flex-1 min-w-0 space-y-1.5">
          <h3 class="text-sm font-semibold m-0 flex items-center gap-2 mb-2">
            <component :is="icon" class="jn-banner-icon size-4 shrink-0" />
            {{ text.title }}
          </h3>
          <p class="text-sm text-muted-foreground leading-relaxed m-0">
            {{ text.note }}
          </p>
        </div>
        <!-- Keep the offer next to its action, at the bottom of paired cards. -->
        <div class="w-full flex flex-col justify-center items-center gap-2"
          :class="paired ? 'mt-auto md:flex-row md:justify-between md:gap-3' : 'md:w-auto md:max-w-[45%] md:flex-row md:gap-4'">
          <p v-if="pricing" class="jn-banner-price m-0 min-w-0 max-w-full flex flex-wrap items-baseline justify-center gap-x-1 text-center break-words"
            :class="{ 'md:flex-1 md:justify-start md:text-left': paired }">
            <span v-if="pricing.text" class="text-sm font-medium">{{ pricing.text }}</span>
            <template v-else>
              <span v-if="pricing.prefix" class="text-xs">{{ pricing.prefix }}</span>
              <span class="text-xl leading-6 font-semibold tabular-nums tracking-tight">{{ pricing.amount }}</span>
              <span v-if="pricing.suffix" class="text-xs">{{ pricing.suffix }}</span>
            </template>
          </p>
          <Button variant="action" size="sm" @click="openBanner(banner)"
            :class="{ 'jn-banner-cta': banner.color, 'md:ml-auto': paired, 'md:max-w-[55%]': pricing }"
            class="w-full md:w-auto h-auto min-h-11 md:min-h-9 px-4 py-2 text-sm leading-5 whitespace-normal shrink-0 cursor-pointer">
            <span>{{ text.cta }}</span>
            <ArrowRight class="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useElementVisibility } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { Button } from '@/components/ui/button';
import { ArrowRight, Globe, Megaphone, Server, Shield, Sparkles, Zap } from '@lucide/vue';
import { trackEvent } from '@/utils/analytics';
import { bannerCopy, bannerLink, bannerPricing, bannerShown, bannerTheme, pickBanners } from '@/utils/banners';

const props = defineProps({
  section: { type: String, required: true },
  settled: { type: Boolean, default: true },
});

// Campaign data stays Node-loadable by using icon names instead of imports.
const ICONS = { Globe, Megaphone, Server, Shield, Sparkles, Zap };
const modules = import.meta.glob('../../data/banners/*.js', { eager: true });
const store = useMainStore();
const router = useRouter();
const lang = computed(() => store.lang);
const banners = computed(() => pickBanners(modules, props.section).map((banner) => ({
  banner,
  text: bannerCopy(banner, lang.value),
  pricing: bannerPricing(bannerCopy(banner, lang.value).pricing),
  icon: ICONS[banner.icon] ?? Megaphone,
  theme: bannerTheme(banner),
  shown: bannerShown(banner, props.settled),
})));
const shownCount = computed(() => banners.value.filter(({ shown }) => shown).length);
const paired = computed(() => shownCount.value > 1);
// The slot holds at most two cards. Observe each independently so entering
// the viewport replays only that card's sweep, including after a settled gate.
const slots = Array.from({ length: 2 }, () => {
  const element = ref(null);
  const visible = useElementVisibility(element, { threshold: 0.5 });
  return { element, visible };
});

const openBanner = (banner) => {
  // Section in the event name, campaign id as label for GA4 attribution.
  trackEvent('Section', `BannerClick_${props.section}`, banner.track);
  if (banner.sheet) {
    store.setOpenSheet(banner.sheet);
  } else if (banner.to) {
    router.push(banner.to);
  } else {
    window.open(bannerLink(banner, lang.value), '_blank', 'noopener');
  }
};
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
  border-color: color-mix(in oklch, var(--banner-color) 30%, transparent);
  background: color-mix(in oklch, var(--banner-color) 5%, transparent);
}

.jn-banner-icon,
.jn-banner-price {
  color: var(--banner-color);
}

.jn-banner-cta {
  background: var(--banner-color);
  color: var(--banner-foreground);
}

.jn-banner-cta:hover {
  background: color-mix(in oklch, var(--banner-color) 90%, transparent);
}

.jn-banner-sweep::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: conic-gradient(from var(--jn-sweep-angle),
      transparent 0deg 250deg,
      color-mix(in oklch, var(--banner-color) 60%, transparent) 320deg,
      var(--banner-color) 352deg,
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

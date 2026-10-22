// Whether the site nav's link row fits beside the brand and the action
// group. Collapse follows the measured content, not a breakpoint: link
// labels differ widely in width across locales.

import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const isSize = (n) => typeof n === 'number' && Number.isFinite(n);

// The nav lays out brand · links · actions with `gap` between each pair, so
// the links get the nav width minus the other two groups and two gaps.
// An unmeasured nav (a missing size, or a zero-width nav) counts as fitting,
// so desktop never collapses on bad input.
export const navLinksFit = ({ navWidth, brandWidth, actionsWidth, linksWidth, gap }) => {
  const sizes = [navWidth, brandWidth, actionsWidth, linksWidth, gap];
  if (!sizes.every(isSize) || navWidth <= 0) return true;
  return linksWidth <= navWidth - brandWidth - actionsWidth - 2 * gap;
};

const widthOf = (el) => (el ? el.getBoundingClientRect().width : NaN);

// Template refs in, `overflow` out. The links element must stay rendered
// (and keep its natural width) while collapsed so it can still be measured.
export const useNavOverflow = ({ nav, brand, links, actions, gap }) => {
  const overflow = ref(false);
  const { locale } = useI18n();
  let observer = null;

  const measure = () => {
    overflow.value = !navLinksFit({
      navWidth: widthOf(nav.value),
      brandWidth: widthOf(brand.value),
      actionsWidth: widthOf(actions.value),
      linksWidth: widthOf(links.value),
      gap,
    });
  };

  // Synchronous first pass, so the first paint already has the right layout.
  onMounted(() => {
    if (typeof ResizeObserver === 'undefined') return;
    measure();
    observer = new ResizeObserver(measure);
    for (const el of [nav.value, brand.value, links.value, actions.value]) {
      if (el) observer.observe(el);
    }
  });

  // Translated labels change the links' width; measure once they rendered.
  watch(locale, async () => {
    if (!observer) return;
    await nextTick();
    measure();
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return { overflow };
};

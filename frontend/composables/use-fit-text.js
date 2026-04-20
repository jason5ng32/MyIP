// Fit-to-width class picker: picks the largest tier whose rendered
// extent fits inside the element, recomputing on container resize and
// text change.

import { ref, watch, onBeforeUnmount } from 'vue';

// HERO_TIERS is used by prominent IP rows (IPCard / QueryIP). It floors
// at text-xs as a last resort for narrow cards that also host a Copy
// button. INLINE_TIERS is used by the smaller cards in WebRTC / DnsLeak
// / RuleTest where 12px is already acceptable.
export const HERO_TIERS   = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
export const INLINE_TIERS = ['text-base', 'text-sm', 'text-xs'];

export function useFitText(elRef, textSource, tiers, options = {}) {
    // With maxLines > 1 the caller must set `line-clamp-N` on the
    // element so `clientHeight` caps at N lines while `scrollHeight`
    // keeps the full content height — that's what lets the vertical
    // overflow check work.
    const maxLines = options.maxLines ?? 1;
    const cls = ref(tiers[0]);
    let ro = null;

    const fitsAtCurrentTier = (el) => maxLines <= 1
        ? el.scrollWidth  <= el.clientWidth
        : el.scrollHeight <= el.clientHeight;

    const measure = () => {
        const el = elRef.value;
        if (!el) return;
        for (const t of tiers) el.classList.remove(t);
        let chosen = tiers[tiers.length - 1];
        for (const t of tiers) {
            el.classList.add(t);
            if (fitsAtCurrentTier(el)) { chosen = t; break; }
            el.classList.remove(t);
        }
        // Strip any tier left on the element by an interrupted run —
        // Vue's :class reconciliation won't remove classes it didn't
        // write itself.
        for (const t of tiers) if (t !== chosen) el.classList.remove(t);
        if (!el.classList.contains(chosen)) el.classList.add(chosen);
        cls.value = chosen;
    };

    const disconnect = () => { if (ro) { ro.disconnect(); ro = null; } };

    watch(elRef, (el, _prev, onCleanup) => {
        disconnect();
        if (!el || !el.parentElement) return;
        ro = new ResizeObserver(() => measure());
        ro.observe(el.parentElement);
        // RO's own initial callback is async; fire one sync pass so the
        // first paint is already at the right tier.
        measure();
        onCleanup(disconnect);
    }, { immediate: true, flush: 'post' });

    watch(textSource, () => measure(), { flush: 'post' });

    onBeforeUnmount(disconnect);

    return cls;
}

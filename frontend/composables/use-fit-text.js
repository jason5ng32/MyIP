// Fit-to-width class picker: picks the largest tier whose rendered
// extent fits inside the element, recomputing on container resize and
// text change. All instances share one ResizeObserver and one batched
// measure pass, so a long list costs a handful of layouts, not one per row.

import { ref, watch, onBeforeUnmount } from 'vue';

// HERO_TIERS is used by prominent IP rows (IPCard / QueryIP). It floors
// at text-xs as a last resort for narrow cards that also host a Copy
// button. INLINE_TIERS is used by the smaller cards in WebRTC / DnsLeak
// / RuleTest where 12px is already acceptable.
export const HERO_TIERS   = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
export const INLINE_TIERS = ['text-base', 'text-sm', 'text-xs'];

// With maxLines > 1 the caller must set `line-clamp-N` on the element so
// `clientHeight` caps at N lines while `scrollHeight` keeps the full
// content height — that's what lets the vertical overflow check work.
const fits = ({ el, maxLines }) => maxLines <= 1
    ? el.scrollWidth  <= el.clientWidth
    : el.scrollHeight <= el.clientHeight;

// Leave exactly one tier on the element. Also strips tiers left by an
// interrupted run — Vue's :class reconciliation won't remove classes it
// didn't write itself.
const applyTier = ({ el, tiers }, index) => {
    for (const t of tiers) if (t !== tiers[index]) el.classList.remove(t);
    el.classList.add(tiers[index]);
};

// Fit a batch of jobs ({ el, tiers, maxLines, onFit }). Each pass reads
// every unsettled element before writing any, then steps the misfits down
// one tier — layouts are bounded by the tier count, not the job count.
export const fitAll = (jobs) => {
    let active = jobs.filter(({ el }) => el && el.isConnected !== false);
    for (const job of active) {
        job.index = 0;
        applyTier(job, 0);
    }
    while (active.length) {
        const fitted = active.map(fits);
        const next = [];
        active.forEach((job, i) => {
            if (fitted[i] || job.index === job.tiers.length - 1) {
                job.onFit(job.tiers[job.index]);
            } else {
                job.index += 1;
                applyTier(job, job.index);
                next.push(job);
            }
        });
        active = next;
    }
};

/* Shared scheduler: mounts and text changes queue into one microtask
   (still before paint); resizes are fitted inside the observer callback. */
const pending = new Set();
const jobsByParent = new Map();
let observer = null;

const flush = () => {
    const batch = [...pending];
    pending.clear();
    fitAll(batch);
};

const schedule = (job) => {
    if (!pending.size) queueMicrotask(flush);
    pending.add(job);
};

const getObserver = () => {
    if (!observer && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver((entries) => {
            const batch = new Set();
            for (const { target } of entries) {
                for (const job of jobsByParent.get(target) || []) batch.add(job);
            }
            fitAll([...batch]);
        });
    }
    return observer;
};

const register = (job) => {
    const parent = job.el.parentElement;
    job.parent = parent;
    if (!jobsByParent.has(parent)) {
        jobsByParent.set(parent, new Set());
        getObserver()?.observe(parent);
    }
    jobsByParent.get(parent).add(job);
    schedule(job);
};

const unregister = (job) => {
    pending.delete(job);
    const jobs = jobsByParent.get(job.parent);
    if (!jobs) return;
    jobs.delete(job);
    if (!jobs.size) {
        jobsByParent.delete(job.parent);
        observer?.unobserve(job.parent);
    }
};

export function useFitText(elRef, textSource, tiers, options = {}) {
    const cls = ref(tiers[0]);
    let job = null;

    const release = () => {
        if (job) unregister(job);
        job = null;
    };

    watch(elRef, (el, _prev, onCleanup) => {
        release();
        if (!el || !el.parentElement) return;
        job = {
            el, tiers,
            maxLines: options.maxLines ?? 1,
            onFit: (tier) => { cls.value = tier; },
        };
        register(job);
        onCleanup(release);
    }, { immediate: true, flush: 'post' });

    watch(textSource, () => { if (job) schedule(job); }, { flush: 'post' });

    onBeforeUnmount(release);

    return cls;
}

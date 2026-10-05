<template>
  <!-- TEMPORARY diagnostic overlay for the iOS "Nav animations stall after a
       swipe-back" problem. Opt in with ?debug=nav (kept in localStorage; ?debug=off
       clears it). Shows, live: the rAF frame rate, whether Pulse's ping animation
       advances and iterates, two reference CSS animations (one in this fixed
       panel, one injected into the page flow), the Nav's state, and a timeline
       of navigation / visibility / input events. The buttons try candidate
       remedies one at a time, so the one that revives the Nav names the cause.
       "Copy" puts the whole log on the clipboard. Not localized — remove when done. -->
  <div class="fixed bottom-2 left-2 right-2 z-[99999] rounded-md border bg-card/95 p-2 font-mono text-[11px] leading-tight text-foreground shadow-lg"
    style="max-height: 46vh; overflow: auto;">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>rAF <b>{{ fps }}</b>/s · gap≤<b>{{ maxGap }}</b>ms</span>
      <span>ping t+<b>{{ pingDelta }}</b>ms/500 · {{ pingState }} · iter {{ pingIterations }}</span>
      <span>vis {{ visibility }} · focus {{ focused ? 'y' : 'n' }}</span>
      <span>scrollY {{ scrollY }} · navHidden {{ navHidden }}</span>
      <span class="inline-flex items-center gap-1">panel
        <span class="inline-block size-3 animate-spin rounded-sm bg-primary" style="animation-duration: 2s" />
      </span>
      <span>ua-vt {{ lastUaTransition }}</span>
    </div>
    <div class="mt-1 flex flex-wrap gap-1">
      <button v-for="action in actions" :key="action.label" type="button"
        class="rounded border px-1.5 py-0.5 active:bg-muted" @click="run(action)">{{ action.label }}</button>
      <button type="button" class="rounded border px-1.5 py-0.5 font-semibold active:bg-muted" @click="copyLog">Copy</button>
      <button type="button" class="rounded border px-1.5 py-0.5 active:bg-muted" @click="lines = []">Clear</button>
    </div>
    <pre class="mt-1 whitespace-pre-wrap break-all">{{ lines.join('\n') }}</pre>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { REVIVED_EVENT } from '@/utils/revive-animations.js';

const router = useRouter();

const lines = ref([]);
const fps = ref(0);
const maxGap = ref(0);
const pingDelta = ref(0);
const pingState = ref('-');
const pingIterations = ref(0);
const visibility = ref(document.visibilityState);
const focused = ref(document.hasFocus());
const scrollY = ref(Math.round(window.scrollY));
const navHidden = ref('?');
const lastUaTransition = ref('-');

const t0 = performance.now();
const stamp = () => ((performance.now() - t0) / 1000).toFixed(2).padStart(7);
const log = (message) => {
    lines.value.push(`${stamp()} ${message}`);
    if (lines.value.length > 60) lines.value.shift();
};

const nav = () => document.querySelector('.jn-site-nav');
const pingEl = () => nav()?.querySelector('.animate-ping') ?? null;
const pingAnimation = () => pingEl()?.getAnimations?.()?.[0] ?? null;

// ---- live sampling ---------------------------------------------------------
let frames = 0;
let lastFrame = performance.now();
let rafId = 0;
const tick = (now) => {
    frames += 1;
    maxGap.value = Math.max(maxGap.value, Math.round(now - lastFrame));
    lastFrame = now;
    rafId = requestAnimationFrame(tick);
};

let lastPingTime = null;
let sampler = 0;
const sample = () => {
    fps.value = frames * 2;
    frames = 0;
    const animation = pingAnimation();
    if (animation) {
        const t = animation.currentTime ?? 0;
        pingDelta.value = lastPingTime === null ? 0 : Math.round(t - lastPingTime);
        lastPingTime = t;
        pingState.value = animation.playState;
    } else {
        pingState.value = 'none';
    }
    visibility.value = document.visibilityState;
    focused.value = document.hasFocus();
    scrollY.value = Math.round(window.scrollY);
    const header = nav();
    navHidden.value = header ? String(header.classList.contains('-translate-y-full')) : '?';
    maxGap.value = 0;
};

// ---- event timeline --------------------------------------------------------
const onPopstate = (event) => {
    lastUaTransition.value = String(event.hasUAVisualTransition);
    log(`popstate hasUAVisualTransition=${event.hasUAVisualTransition}`);
};
const onVisibility = () => log(`visibilitychange → ${document.visibilityState}`);
const onPageShow = (e) => log(`pageshow persisted=${e.persisted}`);
const onPageHide = (e) => log(`pagehide persisted=${e.persisted}`);
const onFocus = () => log('window focus');
const onBlur = () => log('window blur');
const onTouch = () => log('touchstart');
let scrollLogged = false;
const onScroll = () => {
    if (scrollLogged) return;
    scrollLogged = true;
    log(`scroll (y=${Math.round(window.scrollY)})`);
    setTimeout(() => { scrollLogged = false; }, 1000);
};
const onResize = () => log(`resize ${window.innerWidth}×${window.innerHeight}`);
const onRevived = (e) => log(`revived ${e.detail.revived} animations (+${e.detail.delayMs}ms)`);
const onIteration = (e) => {
    if (e.animationName && e.target === pingEl()) pingIterations.value += 1;
};

let removeBefore = null;
let removeAfter = null;

// ---- candidate remedies ----------------------------------------------------
const actions = [
    { label: 'restart anims', run: () => {
        const list = nav()?.getAnimations({ subtree: true }) ?? [];
        list.forEach((a) => { a.cancel(); a.play(); });
        return `${list.length} animations`;
    } },
    { label: 'toggle will-change', run: () => {
        const h = nav(); if (!h) return 'no nav';
        h.classList.toggle('will-change-transform');
        return h.classList.contains('will-change-transform') ? 'on' : 'off';
    } },
    { label: 'toggle backdrop', run: () => {
        const h = nav(); if (!h) return 'no nav';
        h.classList.toggle('backdrop-blur');
        return h.classList.contains('backdrop-blur') ? 'on' : 'off';
    } },
    { label: 'reflow nav', run: () => {
        const h = nav(); if (!h) return 'no nav';
        h.style.display = 'none'; void h.offsetHeight; h.style.display = '';
        return 'display none→back';
    } },
    { label: 'refix nav', run: () => {
        const h = nav(); if (!h) return 'no nav';
        h.style.position = 'absolute'; void h.offsetHeight; h.style.position = '';
        return 'absolute→fixed';
    } },
    { label: 'translateZ', run: () => {
        const h = nav(); if (!h) return 'no nav';
        h.style.transform = h.style.transform ? '' : 'translateZ(0)';
        return h.style.transform || 'cleared';
    } },
    { label: 'nudge scroll', run: () => { window.scrollBy(0, 1); window.scrollBy(0, -1); return 'done'; } },
    { label: 'remount pulse', run: () => {
        const el = pingEl()?.parentElement; if (!el) return 'no pulse';
        const parent = el.parentElement; const next = el.nextSibling;
        parent.removeChild(el); void parent.offsetHeight; parent.insertBefore(el, next);
        return 'detached→reattached';
    } },
];
const run = (action) => {
    let result;
    try { result = action.run(); } catch (e) { result = `error ${e.message}`; }
    log(`[${action.label}] ${result}`);
};

const copyLog = async () => {
    const text = [
        `ua: ${navigator.userAgent}`,
        `standalone: ${window.navigator.standalone ?? matchMedia('(display-mode: standalone)').matches}`,
        `rAF ${fps.value}/s, ping ${pingState.value} +${pingDelta.value}ms/500, iter ${pingIterations.value}, vis ${visibility.value}, focus ${focused.value}, scrollY ${scrollY.value}, navHidden ${navHidden.value}`,
        ...lines.value,
    ].join('\n');
    try {
        await navigator.clipboard.writeText(text);
        log('copied');
    } catch {
        try { await navigator.share({ text }); } catch { log('copy failed'); }
    }
};

onMounted(() => {
    log(`start ${location.pathname}`);
    rafId = requestAnimationFrame(tick);
    sampler = setInterval(sample, 500);
    window.addEventListener('popstate', onPopstate, { capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener(REVIVED_EVENT, onRevived);
    document.addEventListener('animationiteration', onIteration, true);
    removeBefore = router.beforeEach((to, from) => { log(`route ${from.fullPath} → ${to.fullPath}`); });
    removeAfter = router.afterEach((to, from, failure) => { log(`afterEach ${to.path}${failure ? ' FAILED' : ''} y=${Math.round(window.scrollY)}`); });
    // A reference CSS animation in the page flow, below the fixed Nav.
    const marker = document.createElement('div');
    marker.id = 'jn-debug-flow-spinner';
    marker.className = 'fixed top-16 right-2 z-[99998] size-4 animate-spin rounded-sm bg-destructive';
    marker.style.animationDuration = '2s';
    marker.style.position = 'absolute';
    document.body.appendChild(marker);
});

onBeforeUnmount(() => {
    cancelAnimationFrame(rafId);
    clearInterval(sampler);
    window.removeEventListener('popstate', onPopstate, { capture: true });
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('touchstart', onTouch);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener(REVIVED_EVENT, onRevived);
    document.removeEventListener('animationiteration', onIteration, true);
    removeBefore?.(); removeAfter?.();
    document.getElementById('jn-debug-flow-spinner')?.remove();
});
</script>

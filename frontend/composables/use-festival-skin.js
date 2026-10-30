// Festival theme, shared app-wide: while a Pulse festival is in its window,
// the Pulse entry shows its emoji and its skin folder (components/festival/
// <id>/) dresses the logo and nav. App.vue calls startFestivalSkin() once;
// it evaluates now, then re-checks on a coarse timer and on tab return.
import { computed, defineAsyncComponent, shallowRef } from 'vue';
import { FESTIVAL_STATUSES } from '@/data/pulse-statuses.js';
import { FESTIVAL_SKINS_ENABLED, activeFestivalAt, skinPartPath } from '@/utils/features/festival-skin.js';

const RECHECK_MS = 10 * 60 * 1000;

const PART_LOADERS = import.meta.glob('../components/festival/*/*.vue');
const partCache = new Map();
const partComponent = (festivalId, slot) => {
    const path = skinPartPath(festivalId, slot);
    if (!partCache.has(path)) {
        const load = PART_LOADERS[path];
        partCache.set(path, load ? defineAsyncComponent(load) : null);
    }
    return partCache.get(path);
};

const festival = shallowRef(null);
let started = false;

// DEV only: ?festival=<id> forces a festival, ignoring switch and window.
const previewFestival = () => {
    if (!import.meta.env.DEV) return null;
    const id = new URLSearchParams(window.location.search).get('festival');
    return FESTIVAL_STATUSES.find((f) => f.id === id) ?? null;
};

export const startFestivalSkin = () => {
    if (started) return;
    started = true;
    const preview = previewFestival();
    if (!preview && !FESTIVAL_SKINS_ENABLED) return;

    const evaluate = () => {
        festival.value = preview ?? activeFestivalAt();
    };
    evaluate();
    if (!preview) setInterval(evaluate, RECHECK_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') evaluate();
    });
};

const logo = computed(() => (festival.value ? partComponent(festival.value.id, 'Logo') : null));
const navTrim = computed(() => (festival.value ? partComponent(festival.value.id, 'NavTrim') : null));
const pulseEmoji = computed(() => festival.value?.emoji ?? '');

export const useFestivalSkin = () => ({ logo, navTrim, pulseEmoji });

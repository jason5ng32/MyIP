// Festival theme, shared app-wide: while a Pulse festival is in its window,
// the Pulse entry shows its emoji and its skin folder (components/festival/
// <id>/) dresses the logo, nav and footer. App.vue calls startFestivalSkin() once;
// it evaluates now, then re-checks on a coarse timer and on tab return.
import { computed, defineAsyncComponent, shallowRef } from 'vue';
import {
    FESTIVAL_SKINS_ENABLED,
    SKIN_SLOTS,
    activeFestivalAt,
    previewFestival,
    skinPartPath,
} from '@/utils/features/festival-skin.js';

const RECHECK_MS = 10 * 60 * 1000;

const PART_LOADERS = import.meta.glob('../components/festival/*/*.vue');
const partCache = new Map();
const hasSkin = (id) => SKIN_SLOTS.some((slot) => Boolean(PART_LOADERS[skinPartPath(id, slot)]));
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

export const startFestivalSkin = () => {
    if (started) return;
    started = true;
    const preview = previewFestival();
    if (!preview && !FESTIVAL_SKINS_ENABLED) return;

    const evaluate = () => {
        festival.value = preview ?? activeFestivalAt(new Date(), hasSkin);
    };
    evaluate();
    if (!preview) setInterval(evaluate, RECHECK_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') evaluate();
    });
};

const part = (slot) => computed(() => (festival.value ? partComponent(festival.value.id, slot) : null));
const logo = part('Logo');
const navTrim = part('NavTrim');
const footerTrim = part('FooterTrim');
const pulseEmoji = computed(() => festival.value?.emoji ?? '');

export const useFestivalSkin = () => ({ logo, navTrim, footerTrim, pulseEmoji });

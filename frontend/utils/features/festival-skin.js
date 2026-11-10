// Festival theme (pure): the build-time switch, the DEV ?festival= preview,
// which Pulse festival dresses the site right now, which festivals the Pulse
// composer offers, and where skin parts live. State and DOM live in
// composables/use-festival-skin.js.
import { FESTIVAL_STATUSES, festivalWindowStartAt, festivalsActiveAt } from '../../data/pulse-statuses.js';

// A skin is a folder named after a Pulse festival id holding any of these.
export const SKIN_SLOTS = ['Logo', 'NavTrim', 'FooterTrim'];
export const skinPartPath = (festivalId, slot) => `../components/festival/${festivalId}/${slot}.vue`;

// VITE_FESTIVAL_SKINS="true" turns the theme on; anything else leaves it off.
export const parseSkinSwitch = (raw) => String(raw ?? '').trim().toLowerCase() === 'true';

export const FESTIVAL_SKINS_ENABLED = parseSkinSwitch((import.meta.env ?? {}).VITE_FESTIVAL_SKINS);

// DEV only: ?festival=<id> forces a festival, ignoring switch and window.
export const previewFestivalFrom = (search, isDev) => {
    if (!isDev) return null;
    const id = new URLSearchParams(search).get('festival');
    return FESTIVAL_STATUSES.find((f) => f.id === id) ?? null;
};

export const previewFestival = () =>
    previewFestivalFrom(globalThis.location?.search ?? '', (import.meta.env ?? {}).DEV);

// Festivals ordered most recently opened first, a tie keeping list order.
const byMostRecentlyOpened = (festivals, t) =>
    festivals
        .map((f) => ({ f, start: festivalWindowStartAt(f, t) }))
        .sort((a, b) => b.start - a.start)
        .map(({ f }) => f);

// The Pulse composer's festivals: the active ones, most recently opened
// first; the preview leads if it isn't among them (it never hides a
// genuinely active one).
export const festivalsForComposer = (now = new Date(), preview = previewFestival()) => {
    const active = byMostRecentlyOpened(festivalsActiveAt(now), now.getTime());
    if (!preview || active.some((f) => f.id === preview.id)) return active;
    return [preview, ...active];
};

// Overlapping windows (a ~50h window outlasts its day): festivals with a
// skin (hasSkin(id)) go first, else all active ones; within that group the
// most recently opened wins, a tie goes to the first listed.
export const activeFestivalAt = (now = new Date(), hasSkin = () => false) => {
    const active = festivalsActiveAt(now);
    const skinned = active.filter((f) => hasSkin(f.id));
    return byMostRecentlyOpened(skinned.length ? skinned : active, now.getTime())[0] ?? null;
};

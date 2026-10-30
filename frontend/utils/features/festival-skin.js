// Festival theme (pure): the build-time switch, which Pulse festival dresses
// the site right now, and where its skin parts live. State and DOM live in
// composables/use-festival-skin.js.
import { festivalWindowStartAt, festivalsActiveAt } from '../../data/pulse-statuses.js';

// A skin is a folder named after a Pulse festival id holding any of these.
export const SKIN_SLOTS = ['Logo', 'NavTrim'];
export const skinPartPath = (festivalId, slot) => `../components/festival/${festivalId}/${slot}.vue`;

// VITE_FESTIVAL_SKINS="true" turns the theme on; anything else leaves it off.
export const parseSkinSwitch = (raw) => String(raw ?? '').trim().toLowerCase() === 'true';

export const FESTIVAL_SKINS_ENABLED = parseSkinSwitch((import.meta.env ?? {}).VITE_FESTIVAL_SKINS);

// Overlapping windows (a ~50h window outlasts its day): the most recently
// opened one wins; a tie goes to the first listed.
export const activeFestivalAt = (now = new Date()) => {
    const t = now.getTime();
    let best = null;
    let bestStart = -Infinity;
    for (const f of festivalsActiveAt(now)) {
        const start = festivalWindowStartAt(f, t);
        if (start > bestStart) {
            best = f;
            bestStart = start;
        }
    }
    return best;
};

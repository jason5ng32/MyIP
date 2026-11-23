// Snapshots tool page, pure layer: which snapshot is shown and which one it
// is compared with (from the `?q=` / `?vs=` query) and a snapshot's time span.
// Formatting that needs Intl or vue-i18n is passed in.

// The "Compare with" choices: the next older snapshot, or one picked by id.
export const COMPARE_PREVIOUS = 'previous';
export const COMPARE_SPECIFIC = 'specific';

// --- route state ------------------------------------------------------------

// `ids` newest first. Shown: `q` when stored, else this visit's snapshot,
// else the newest. Compared: `vs` when stored and not the shown one (mode
// 'specific'), else the next older snapshot (mode 'previous';
// `defaultComparedId`, null for the oldest).
export const resolveSnapshotView = (ids, query = {}, currentId = null) => {
    const list = Array.isArray(ids) ? ids : [];
    const has = (id) => typeof id === 'string' && list.includes(id);
    let selectedId = null;
    if (has(query.q)) selectedId = query.q;
    else if (has(currentId)) selectedId = currentId;
    else selectedId = list[0] ?? null;
    if (selectedId === null) {
        return { selectedId: null, comparedId: null, defaultComparedId: null, mode: COMPARE_PREVIOUS };
    }

    const defaultComparedId = list[list.indexOf(selectedId) + 1] ?? null;
    if (has(query.vs) && query.vs !== selectedId) {
        return { selectedId, comparedId: query.vs, defaultComparedId, mode: COMPARE_SPECIFIC };
    }
    return { selectedId, comparedId: defaultComparedId, defaultComparedId, mode: COMPARE_PREVIOUS };
};

// The query that spells a view out: `vs` only for a specific snapshot; {}
// when nothing is shown.
export const snapshotViewQuery = ({ selectedId, comparedId, mode }) => {
    if (!selectedId) return {};
    return mode === COMPARE_SPECIFIC && comparedId ? { q: selectedId, vs: comparedId } : { q: selectedId };
};

// --- time span --------------------------------------------------------------

// Created / last updated; `range` when the two differ.
export const seenSpan = (snapshot) => {
    const first = snapshot?.firstSeenAt ?? '';
    const last = snapshot?.lastSeenAt ?? '';
    return { first, last, range: last !== first };
};

// The span as text through `format`: `last` only when it formats unlike
// `first` (an update in the same minute reads as one time).
export const seenSpanText = (snapshot, format) => {
    const span = seenSpan(snapshot);
    const first = format(span.first);
    if (!span.range) return { first };
    const last = format(span.last);
    return last === first ? { first } : { first, last };
};

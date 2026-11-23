// Security Checklist progress: slug → 'checked' | 'ignored' (an unset item is absent), its localStorage copy, edits
// as `{ <slug>: mark | '' }`, and a pull's changes applied to it. The account sync items are the progress itself.
import { isChecklistSlug, isChecklistMark } from '../sync-collections.js';

export const CHECKLIST_STORAGE_KEY = 'securityChecklistSlugs';

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// Only well-formed slugs with a mark; '' and anything else drop.
export const cleanChecklistProgress = (value) => (isPlainObject(value)
    ? Object.fromEntries(Object.entries(value).filter(([slug, mark]) => isChecklistSlug(slug) && isChecklistMark(mark)))
    : null);

// What localStorage holds now, or null when it is missing or unreadable.
export const readStoredChecklist = (storage) => {
    try {
        return cleanChecklistProgress(JSON.parse(storage?.getItem(CHECKLIST_STORAGE_KEY) ?? 'null'));
    } catch {
        return null;
    }
};

export const writeStoredChecklist = (storage, progress) => {
    try {
        storage?.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(progress));
    } catch { /* storage full or blocked: memory still holds it */ }
};

// `{ <slug>: 'checked' | 'ignored' | '' }` over the progress → the next progress ('' unsets).
export const applyChecklistMarks = (progress, marks) => {
    const next = { ...progress };
    for (const [slug, mark] of Object.entries(marks ?? {})) {
        if (!isChecklistSlug(slug)) continue;
        if (isChecklistMark(mark)) next[slug] = mark;
        else delete next[slug];
    }
    return next;
};

// A pull's `{ upserts, deletes }` → the next progress.
export const applyChecklistItems = (progress, { upserts = {}, deletes = [] }) => applyChecklistMarks(progress, {
    ...Object.fromEntries(deletes.map((slug) => [slug, ''])),
    ...upserts,
});

// Every marked item unset (Reset).
export const unsetAllMarks = (progress) => Object.fromEntries(Object.keys(progress ?? {}).map((slug) => [slug, '']));

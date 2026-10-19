// Pure layer of the Ad & Tracker Blocking Test (AdblockTest.vue): turning the
// probe list (data/adblock-probes.js) into a run plan, classifying one probe
// request, tallying statuses, and the verdicts drawn from them. DOM work
// (cosmetic baits) stays in the component; only its predicate lives here.

import { fetchWithTimeout } from '../fetch-with-timeout.js';

// A per-target status: 'pending' before its answer, then one of
//   blocked — the request never left (blocker / DNS sinkhole / refused)
//   open    — any response came back (opaque, status unknowable)
//   unknown — timed out; a stalled request proves neither
export const PROBE_TIMEOUT_MS = 8000;
export const PROBE_CONCURRENCY = 24;
// Gecko on macOS stalls with many blocked requests in flight.
export const GECKO_MAC_TIMEOUT_MS = 5000;
export const GECKO_MAC_CONCURRENCY = 6;

// How long a cosmetic bait may take to be hidden, and how often to look.
export const COSMETIC_WAIT_MS = 2000;
export const COSMETIC_POLL_MS = 250;

// Bait elements, keyed by the target ids of the 'cosmetic' group: the class
// names and markup generic cosmetic filters (EasyList and the like) hide.
export const COSMETIC_BAITS = {
    'ad-container': { tag: 'div', className: 'ad-banner adsbox ad-placement banner-ads textads', attrs: {} },
    'adsense-slot': { tag: 'ins', className: 'adsbygoogle', attrs: { 'data-ad-client': 'ca-pub-0000000000000000', 'data-ad-slot': '0000000000' } },
};

export const vendorKey = (groupId, vendorId) => `${groupId}/${vendorId}`;

export const allVendorKeys = (groups) => groups.flatMap((g) => g.vendors.map((v) => vendorKey(g.id, v.id)));

// The URL a target is fetched at; cosmetic targets have none.
export const probeUrlOf = (kind, target) => {
    if (kind === 'domain') return `https://${target}/`;
    if (kind === 'script') return target;
    return null;
};

// Flat run plan for the selected vendors, in list order:
// [{ id, groupId, vendorId, kind, target, url }].
export const buildPlan = (groups, selectedKeys) => {
    const selected = new Set(selectedKeys);
    return groups.flatMap((g) => g.vendors
        .filter((v) => selected.has(vendorKey(g.id, v.id)))
        .flatMap((v) => v.targets.map((target) => ({
            id: `${vendorKey(g.id, v.id)}/${target}`,
            groupId: g.id,
            vendorId: v.id,
            kind: g.kind,
            target,
            url: probeUrlOf(g.kind, target),
        }))));
};

// One no-cors request → 'open' | 'blocked' | 'unknown'. No cookies, no
// referrer: an unblocked probe tells the third party nothing about us.
export const probeRequest = async (url, { timeoutMs = PROBE_TIMEOUT_MS } = {}) => {
    try {
        await fetchWithTimeout(url, {
            method: 'HEAD',
            mode: 'no-cors',
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            timeoutMs,
        });
        return 'open';
    } catch (error) {
        return error?.name === 'AbortError' ? 'unknown' : 'blocked';
    }
};

// Run async tasks with at most `limit` in flight; resolves when all settle.
export const runWithConcurrency = async (tasks, limit) => {
    let next = 0;
    const worker = async () => {
        while (next < tasks.length) {
            const task = tasks[next++];
            await task();
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
};

// Firefox-family on macOS (iOS browsers are WebKit and excluded).
export const isGeckoMac = (ua = '', platform = '') => {
    if (/iPhone|iPad|iPod|FxiOS|CriOS|EdgiOS/.test(ua)) return false;
    const gecko = /\b(Firefox|Waterfox|LibreWolf|IceCat)\//.test(ua);
    const mac = /Mac/.test(platform) || /Macintosh/.test(ua);
    return gecko && mac;
};

export const probeLimits = (ua, platform) => (isGeckoMac(ua, platform)
    ? { timeoutMs: GECKO_MAC_TIMEOUT_MS, concurrency: GECKO_MAC_CONCURRENCY }
    : { timeoutMs: PROBE_TIMEOUT_MS, concurrency: PROBE_CONCURRENCY });

// A bait counts as hidden when it was removed, collapsed or display:none'd.
export const isBaitHidden = ({ connected, offsetHeight, display, visibility }) =>
    !connected || offsetHeight === 0 || display === 'none' || visibility === 'hidden';

// Counts over a list of statuses. `score` is the blocked share of the
// answered ones (unknown excluded), 0–100, or null when none answered.
export const tally = (statuses) => {
    const counts = { total: statuses.length, blocked: 0, open: 0, unknown: 0, pending: 0 };
    for (const s of statuses) {
        if (s in counts && s !== 'total') counts[s] += 1;
        else counts.pending += 1;
    }
    const answered = counts.blocked + counts.open;
    counts.score = answered ? Math.round((counts.blocked / answered) * 100) : null;
    return counts;
};

// A probe status as a status tone (composables/use-status-tone.js): blocked
// reads as a stop (fail, red), not blocked as passing through (ok-fast,
// green), the rest as wait.
export const statusTone = (status) => ({ blocked: 'fail', open: 'ok-fast' })[status] ?? 'wait';

// Picker "invert": every key in `allKeys` not currently selected.
export const invertSelection = (allKeys, selected) => {
    const current = new Set(selected);
    return allKeys.filter((key) => !current.has(key));
};

// Where the blocking most likely happens, from what was tested:
//   browser — a bait got hidden: an extension or a browser's own blocker
//   network — requests blocked, baits untouched: DNS / VPN / router level
//   none    — nothing blocked anywhere
// null when the answer needs a part that wasn't run (or nothing answered).
export const blockingLayer = ({ requests, cosmetic }) => {
    const hasRequests = requests.blocked + requests.open > 0;
    const hasCosmetic = cosmetic.blocked + cosmetic.open > 0;
    if (hasCosmetic && cosmetic.blocked > 0) return 'browser';
    if (!hasRequests) return null;
    if (requests.blocked === 0) return hasCosmetic ? 'none' : null;
    return hasCosmetic ? 'network' : null;
};

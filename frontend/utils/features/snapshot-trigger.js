// Snapshot trigger: decides whether a page load's sections differ enough
// from the newest stored snapshot for the "smart" auto mode to record them.
// A homepage section the load holds and the snapshot lacks fires; one the
// snapshot holds and the load lacks never does (sections arrive one by one).
// Items align by key as in the diff (snapshot-diff.js); an item or a field on
// one side only (an empty string counts as absent), or an item without a
// usable result (no valid IP), is not compared. WebRTC also fires
// when its servers go from some IP to none, or back. Run-to-run noise never
// fires: connectivity latency drift below the thresholds, rotating DNS
// resolver IPs, a card missing this time, one STUN server failing, advanced
// IP fields absent while their source is on cooldown or fallback.
// `notableChanges` is the stricter check behind the change notice: only
// what both sides carry counts (no new section, target or field), plus
// WebRTC going from some IP to none.

import { isValidIP } from '../ip/valid-ip.js';
import { HOME_SECTION_IDS } from './snapshots.js';
import { CONNECTIVITY_STATUS } from '../codes/connectivity.js';
import { keyedItems, sectionFields, sameValue } from './snapshot-diff.js';
import { readField } from './snapshot-diff-format.js';

// --- thresholds -------------------------------------------------------------

// Connectivity latency fires only when the median log2(new/old) is at least
// log2 of this in either direction (x2 slower or x0.5 faster) and the median
// absolute change at least CONNECTIVITY_LATENCY_DELTA_MS.
export const CONNECTIVITY_LATENCY_RATIO = 2;
export const CONNECTIVITY_LATENCY_DELTA_MS = 100;

// --- keyed sections ---------------------------------------------------------

// Compared fields per keyed section; dnsleak leaves out `ip` (resolver
// egress IPs rotate on every run).
const COMPARED_FIELDS = {
    ipinfo: sectionFields('ipinfo'),
    webrtc: ['ip', 'natType'],
    dnsleak: ['org', 'countryCode'],
};

const usableItems = (id, section) =>
    new Map([...keyedItems(id, section)].filter(([, item]) => isValidIP(item?.ip)));

// A field differs only when both sides carry it: readField maps null to
// undefined, and '' (a builder's missing country / region / city) is absent
// too; 0 and false are values.
const isPresent = (value) => value !== undefined && value !== '';

const fieldChanged = (from, to, field) => {
    const [a, b] = [readField(from, field), readField(to, field)];
    return isPresent(a) && isPresent(b) && !sameValue(a, b);
};

// True when an item present (and usable) on both sides differs in a field.
const keyedChanged = (id, previous, current) => {
    const before = usableItems(id, previous);
    const after = usableItems(id, current);
    return [...after].some(([key, item]) => before.has(key)
        && COMPARED_FIELDS[id].some((field) => fieldChanged(before.get(key), item, field)));
};

// WebRTC reachability: at least one STUN server returned a valid IP. The
// builder keeps failed servers (natType 'error' / 'unavailable', no ip), so a
// fully blocked test still yields a section with none.
const hasWebrtcIp = (section) => (section?.servers ?? []).some((item) => isValidIP(item?.ip));

// --- connectivity -----------------------------------------------------------

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const isTime = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// [old, new] latency of a target pair: minTimeMs when both sides have it,
// else timeMs; null without both.
const latencyPair = (before, after) => {
    const field = isTime(before.minTimeMs) && isTime(after.minTimeMs) ? 'minTimeMs' : 'timeMs';
    const [from, to] = [before[field], after[field]];
    return isTime(from) && isTime(to) ? [from, to] : null;
};

// Median log2 ratio (symmetric: x2 and x0.5 cancel out) and median absolute
// change, both thresholds met. Only pairs positive on both sides count — a 0
// is an unmeasured time and has no log; false without any.
export const latencyShifted = (pairs) => {
    const usable = pairs.filter(([from, to]) => from > 0 && to > 0);
    if (!usable.length) return false;
    const logRatio = median(usable.map(([from, to]) => Math.log2(to / from)));
    const delta = median(usable.map(([from, to]) => Math.abs(to - from)));
    return Math.abs(logRatio) >= Math.log2(CONNECTIVITY_LATENCY_RATIO) && delta >= CONNECTIVITY_LATENCY_DELTA_MS;
};

// Over the targets both sides carry:
// 'connectivity.status' | 'connectivity.latency' | null
const sharedTargetsChange = (before, after) => {
    const common = [...after].filter(([key]) => before.has(key)).map(([key, item]) => [before.get(key), item]);
    if (common.some(([from, to]) => from?.status !== to?.status)) return 'connectivity.status';
    const pairs = common
        .filter(([from]) => from?.status === CONNECTIVITY_STATUS.OK)
        .map(([from, to]) => latencyPair(from, to))
        .filter(Boolean);
    return latencyShifted(pairs) ? 'connectivity.latency' : null;
};

// 'connectivity.targets' | 'connectivity.status' | 'connectivity.latency' | null
const connectivityChange = (previous, current) => {
    const before = keyedItems('connectivity', previous);
    const after = keyedItems('connectivity', current);
    if (before.size !== after.size || [...after.keys()].some((key) => !before.has(key))) return 'connectivity.targets';
    return sharedTargetsChange(before, after);
};

// --- entry point ------------------------------------------------------------

// The rule that fires for `current` (a load's sections) against `previous`
// (the newest stored snapshot's sections, null when none is stored):
// 'first' | 'speedtest' | 'section.added' | 'ipinfo' | 'webrtc' | 'dnsleak' | 'webrtc.reachability' |
// 'connectivity.targets' | 'connectivity.status' | 'connectivity.latency',
// or null when nothing does.
export const snapshotTrigger = (previous, current) => {
    if (!previous) return 'first';
    if (current?.speedtest) return 'speedtest';
    if (HOME_SECTION_IDS.some((id) => current?.[id] && !previous[id])) return 'section.added';
    for (const id of Object.keys(COMPARED_FIELDS)) {
        if (previous[id] && current?.[id] && keyedChanged(id, previous[id], current[id])) return id;
    }
    if (previous.webrtc && current?.webrtc && hasWebrtcIp(previous.webrtc) !== hasWebrtcIp(current.webrtc)) {
        return 'webrtc.reachability';
    }
    if (previous.connectivity && current?.connectivity) {
        return connectivityChange(previous.connectivity, current.connectivity);
    }
    return null;
};

export const shouldRecordSnapshot = (previous, current) => snapshotTrigger(previous, current) !== null;

// --- change notice ----------------------------------------------------------

// Per section, whether what both sides carry changed notably.
const SHARED_CHANGED = {
    ipinfo: (before, after) => keyedChanged('ipinfo', before, after),
    connectivity: (before, after) => sharedTargetsChange(
        keyedItems('connectivity', before), keyedItems('connectivity', after)) !== null,
    webrtc: (before, after) => keyedChanged('webrtc', before, after)
        || (hasWebrtcIp(before) && !hasWebrtcIp(after)),
    dnsleak: (before, after) => keyedChanged('dnsleak', before, after),
};

// The homepage sections (in homepage order) where `current` differs notably
// from `previous` in what both carry; [] without both.
export const notableChanges = (previous, current) => (previous && current
    ? HOME_SECTION_IDS.filter((id) => SHARED_CHANGED[id] && previous[id] && current[id]
        && SHARED_CHANGED[id](previous[id], current[id]))
    : []);

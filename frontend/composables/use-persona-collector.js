// Persona collector — keeps the latest snapshot of every homepage test the
// Persona Check reads, normalized into the observation the API consumes.
// Same pattern as the report collector: components emit domain events, this
// subscribes; nothing is ever re-run here — the homepage tests keep their
// single owner. Call useAppPersonaCollector() once from App.vue setup.
//
// A snapshot records that the test RAN, not that it found something: a
// browser blocking WebRTC, or an IP chain that resolved nothing, still leaves
// its slice here with an empty list. That distinction is the whole contract
// with the evaluator — an absent slice means "never run" and the checks
// reading it stay unmeasured, an empty one means "ran, found nothing" and
// they report as not-applicable. Neither is ever scored as a pass, so a
// visitor whose browser can't answer a question is never blocked by it.

import { reactive, computed, onScopeDispose } from 'vue';
import { onAppEvent } from '../utils/app-events.js';
import { isValidIP, isIPv6 } from '../utils/valid-ip.js';
import { observeBrowser } from '../utils/persona/observe-browser.js';
import { probeFonts } from '../utils/persona/probe-fonts.js';
import { probeVoices, probeKeyboard } from '../utils/persona/probe-locale.js';
import { probeTrace } from '../utils/persona/probe-server.js';

// Module-level so the tool sees whatever App.vue's subscriber collected while
// the visitor was on the homepage.
const snapshots = reactive({
    ipinfo: null,
    webrtc: null,
    dnsleak: null,
});

// --- normalizers: event payload → observation slice --------------------------

const normalizeIpinfo = (payload) => ({
    cards: (payload?.cards ?? [])
        .filter((card) => isValidIP(card?.ip))
        .map((card) => ({
            source: card.source || '',
            ip: card.ip,
            countryCode: (card.country_code || '').toUpperCase() || undefined,
            timezone: card.timezone || undefined,
            asn: card.asn || undefined,
            isp: card.isp || undefined,
            ipType: card.ipTypeCode || undefined,
            isProxy: card.proxyCode || undefined,
            version: isIPv6(card.ip) ? 6 : 4,
        })),
});

const normalizeWebrtc = (payload) => ({
    servers: (payload?.servers ?? [])
        .filter((server) => isValidIP(server?.ip))
        .map((server) => ({
            ip: server.ip,
            natType: server.natTypeCode || undefined,
            countryCode: (server.country_code || '').toUpperCase() || undefined,
            org: server.org || undefined,
        })),
});

const normalizeDnsleak = (payload) => ({
    providers: (payload?.providers ?? [])
        .filter((provider) => isValidIP(provider?.ip))
        .map((provider) => ({
            name: provider.name || '',
            ip: provider.ip,
            countryCode: (provider.country_code || '').toUpperCase() || undefined,
            org: provider.org || undefined,
        })),
});

// `list` names the array inside each slice, so the subscriber below can tell
// a run that found something from one that came back empty.
const NORMALIZERS = {
    'ipinfo:finished': { key: 'ipinfo', list: 'cards', normalize: normalizeIpinfo },
    'webrtc:finished': { key: 'webrtc', list: 'servers', normalize: normalizeWebrtc },
    'dnsleak:finished': { key: 'dnsleak', list: 'providers', normalize: normalizeDnsleak },
};

// Which observation slices each source feeds, for the "what's missing" list.
export const PERSONA_SOURCES = ['ipinfo', 'webrtc', 'dnsleak'];

/** Subscribe once, app-wide. */
export const useAppPersonaCollector = () => {
    const unsubscribes = Object.entries(NORMALIZERS).map(([event, { key, list, normalize }]) =>
        onAppEvent(event, (payload) => {
            const normalized = normalize(payload);
            // Latest-wins, except that a run producing nothing usable must not
            // erase a good earlier snapshot — it still records that the test
            // ran, which is all the run button asks for.
            const held = snapshots[key]?.[list]?.length ?? 0;
            if (normalized[list].length || !held) snapshots[key] = normalized;
        }));

    onScopeDispose(() => unsubscribes.forEach((unsubscribe) => unsubscribe()));
};

/**
 * Assemble the observation to score: the collected snapshots plus the active
 * probes, run concurrently. GPS and the card prefix are opt-in and passed in
 * by the caller — neither happens without an explicit visitor action.
 */
export const buildObservation = async ({ geolocation, cardBin } = {}) => {
    const [trace, fonts, voices, keyboard] = await Promise.all([
        probeTrace(),
        probeFonts(),
        probeVoices(),
        probeKeyboard(),
    ]);
    const browser = observeBrowser();
    return {
        ip: snapshots.ipinfo || undefined,
        webrtc: snapshots.webrtc || undefined,
        dns: snapshots.dnsleak || undefined,
        browser,
        intl: browser.intl || undefined,
        trace: trace.available ? trace : undefined,
        fonts,
        voices: voices || undefined,
        keyboard: keyboard || undefined,
        geolocation: geolocation || undefined,
        card: cardBin ? { bin: cardBin } : undefined,
    };
};

/** Read-only view for the tool: raw snapshots plus what hasn't been run yet. */
export const usePersonaSnapshots = () => ({
    snapshots,
    // Missing means "not run yet". Whether the run found anything is the
    // evaluator's problem — gating on results would lock the tool away from
    // exactly the browsers whose blocked tests make it interesting.
    missingSources: computed(() => PERSONA_SOURCES.filter((source) => !snapshots[source])),
    hasAnySource: computed(() => PERSONA_SOURCES.some((source) => snapshots[source])),
});

/** Drop every snapshot — module state is shared, so tests need this. */
export const resetPersonaSnapshots = () => {
    for (const key of PERSONA_SOURCES) snapshots[key] = null;
};

export { normalizeIpinfo, normalizeWebrtc, normalizeDnsleak };

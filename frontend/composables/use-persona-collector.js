// Persona collector — keeps the latest snapshot of every homepage test the
// Persona Check reads, normalized into the observation the API consumes.
// Same pattern as the report collector: components emit domain events, this
// subscribes; nothing is ever re-run here — the homepage tests keep their
// single owner. Call useAppPersonaCollector() once from App.vue setup.

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

const normalizeIpinfo = (payload) => {
    const cards = (payload?.cards ?? [])
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
        }));
    return cards.length ? { cards } : null;
};

const normalizeWebrtc = (payload) => {
    const servers = (payload?.servers ?? [])
        .filter((server) => isValidIP(server?.ip))
        .map((server) => ({
            ip: server.ip,
            natType: server.natTypeCode || undefined,
            countryCode: (server.country_code || '').toUpperCase() || undefined,
            org: server.org || undefined,
        }));
    return servers.length ? { servers } : null;
};

const normalizeDnsleak = (payload) => {
    const providers = (payload?.providers ?? [])
        .filter((provider) => isValidIP(provider?.ip))
        .map((provider) => ({
            name: provider.name || '',
            ip: provider.ip,
            countryCode: (provider.country_code || '').toUpperCase() || undefined,
            org: provider.org || undefined,
        }));
    return providers.length ? { providers } : null;
};

const NORMALIZERS = {
    'ipinfo:finished': { key: 'ipinfo', normalize: normalizeIpinfo },
    'webrtc:finished': { key: 'webrtc', normalize: normalizeWebrtc },
    'dnsleak:finished': { key: 'dnsleak', normalize: normalizeDnsleak },
};

// Which observation slices each source feeds, for the "what's missing" list.
export const PERSONA_SOURCES = ['ipinfo', 'webrtc', 'dnsleak'];

/** Subscribe once, app-wide. */
export const useAppPersonaCollector = () => {
    const unsubscribes = Object.entries(NORMALIZERS).map(([event, { key, normalize }]) =>
        onAppEvent(event, (payload) => {
            const normalized = normalize(payload);
            // Latest-wins, but a run that produced nothing usable must not
            // erase a good earlier snapshot.
            if (normalized !== null) snapshots[key] = normalized;
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
    missingSources: computed(() => PERSONA_SOURCES.filter((source) => !snapshots[source])),
    hasAnySource: computed(() => PERSONA_SOURCES.some((source) => snapshots[source])),
});

/** Drop every snapshot — module state is shared, so tests need this. */
export const resetPersonaSnapshots = () => {
    for (const key of PERSONA_SOURCES) snapshots[key] = null;
};

export { normalizeIpinfo, normalizeWebrtc, normalizeDnsleak };

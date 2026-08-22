// Pure support for the docs assistant's `run_my_tests` tool: which report
// sections can be (re)run through the app command bus, the command + payload
// each one maps to, and defensive normalization of the tool-call arguments.
// GitBook's argument passing is unverified, so anything missing or malformed
// is treated as "run everything".

// Section id → its owner's command and payload. Refresh-flavored payloads on
// purpose: these runs re-trigger tests that already ran once at boot.
export const RUNNABLE_SECTION_COMMANDS = {
    ipinfo: { command: 'ipinfo:refresh', payload: {} },
    connectivity: { command: 'connectivity:run', payload: { trigger: 'manual' } },
    webrtc: { command: 'webrtc:run', payload: { isRefresh: true } },
    dnsleak: { command: 'dnsleak:run', payload: { isRefresh: true } },
};

export const RUNNABLE_SECTION_IDS = Object.keys(RUNNABLE_SECTION_COMMANDS);

// `args?.sections` → { requested, unknown }, both deduped. A missing,
// malformed, or empty list means "run all"; a non-empty list that names only
// unknown ids runs nothing — the assistant asked for something specific and
// gets the mismatch reported back instead of a full run it didn't ask for.
export const normalizeRunSections = (args) => {
    const sections = Array.isArray(args?.sections) ? args.sections : [];
    if (!sections.length) return { requested: [...RUNNABLE_SECTION_IDS], unknown: [] };
    const requested = [];
    const unknown = [];
    for (const entry of sections) {
        if (RUNNABLE_SECTION_IDS.includes(entry)) {
            if (!requested.includes(entry)) requested.push(entry);
        } else {
            const label = String(entry);
            if (!unknown.includes(label)) unknown.push(label);
        }
    }
    return { requested, unknown };
};

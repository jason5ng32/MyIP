// Locale signals read from the browser: the installed speech-synthesis
// voices (their language tags only) and, on Chromium, the physical keyboard
// layout. A missing API returns null and the check reports "not measured"
// rather than guessing.

// getVoices() is frequently empty on first call — the list arrives
// asynchronously — so wait for voiceschanged, but never longer than this.
const VOICES_TIMEOUT_MS = 600;

export const probeVoices = async () => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth?.getVoices) return null;

    let voices = synth.getVoices();
    if (!voices.length) {
        await new Promise((resolve) => {
            const timer = setTimeout(resolve, VOICES_TIMEOUT_MS);
            synth.addEventListener('voiceschanged', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        });
        voices = synth.getVoices();
    }
    if (!voices.length) return null;

    // Only language tags travel — voice names would be needless entropy.
    return {
        languages: [...new Set(voices.map((voice) => voice.lang).filter(Boolean))],
        count: voices.length,
    };
};

// Physical-key → produced-character pairs that separate the major layouts,
// read from the layout map rather than inferred from the UA.
const LAYOUT_KEYS = ['KeyQ', 'KeyW', 'KeyA', 'KeyY', 'KeyZ', 'Semicolon', 'IntlRo', 'IntlYen'];

// JIS keyboards carry two keys no other layout has.
const isJIS = (keys) => 'IntlRo' in keys && 'IntlYen' in keys;

export const layoutOf = (keys) => {
    if (!keys || !Object.keys(keys).length) return null;
    if (isJIS(keys)) return 'jis';
    if (keys.KeyA === 'q' && keys.KeyQ === 'a') return 'azerty';
    if (keys.KeyZ === 'y' && keys.KeyY === 'z') return 'qwertz';
    if (keys.KeyQ === 'q' && keys.KeyW === 'w') return 'qwerty';
    return 'other';
};

export const probeKeyboard = async () => {
    const keyboard = typeof navigator !== 'undefined' ? navigator.keyboard : null;
    if (!keyboard?.getLayoutMap) return null;
    try {
        const map = await keyboard.getLayoutMap();
        const keys = {};
        for (const code of LAYOUT_KEYS) {
            const value = map.get(code);
            if (value !== undefined) keys[code] = value;
        }
        return { keys, layout: layoutOf(keys) };
    } catch {
        return null;
    }
};

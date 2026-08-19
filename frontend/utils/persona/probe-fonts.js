// Font probing — which writing systems does this machine have fonts for?
// Only the script-marker fonts in data/persona-tables.js are measured, every
// script each time; the table loads on first probe rather than with the
// module, so a visitor who never opens the tool never downloads it.

// Fallback faces the target is measured against. A font that exists renders
// the samples with different metrics than the generic family it falls back to.
const BASE_FONTS = ['monospace', 'sans-serif', 'serif'];

// Two samples per candidate: the script sample shows whether the script
// renders at all, the Latin sample separates fonts whose script glyphs share
// metrics (CJK advances are uniform em-widths, and on a CJK system the
// generic fallbacks are CJK fonts themselves). Ink bounds ride along with
// the width for fonts that differ only in shape.
const SCRIPT_SAMPLES = {
    Jpan: 'あアン亜',
    Hans: '中文简体',
    Hant: '中文繁體',
    Kore: '한국어글',
    Arab: 'العربية',
    Hebr: 'עברית',
    Thai: 'ภาษาไทย',
    Deva: 'देवनागरी',
    Beng: 'বাংলা',
    Taml: 'தமிழ்',
    Telu: 'తెలుగు',
    Knda: 'ಕನ್ನಡ',
    Mlym: 'മലയാളം',
    Guru: 'ਗੁਰਮੁਖੀ',
    Gujr: 'ગુજરાતી',
    Sinh: 'සිංහල',
    Mymr: 'မြန်မာ',
    Khmr: 'ខ្មែរ',
    Laoo: 'ລາວ',
    Ethi: 'ግዕዝ',
    Geor: 'ქართული',
    Armn: 'հայերեն',
};

const LATIN_SAMPLE = 'mmmmmmmmmmlli';
const PROBE_SIZE = 72;

// measureText on a detached canvas: no DOM insertion, no reflow — a few
// hundred measurements complete well inside one frame. Engines without
// actualBoundingBox* degrade to width-only.
const makeMeasurer = () => {
    if (typeof document === 'undefined') return null;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return null;
    return (font, sample) => {
        context.font = `${PROBE_SIZE}px ${font}`;
        const metrics = context.measureText(sample);
        return [
            metrics.width,
            metrics.actualBoundingBoxAscent ?? 0,
            metrics.actualBoundingBoxDescent ?? 0,
        ].join('|');
    };
};

/**
 * Probe the font markers of every writing system in the table.
 * Returns { scripts: { <Script>: { present: [...], probed: n } }, available }
 * where `available` is false when the browser gave us no canvas to measure on
 * (the checks then report UNKNOWN rather than "no fonts installed").
 */
export const probeFonts = async () => {
    const measure = makeMeasurer();
    if (!measure) return { scripts: {}, available: false };

    const { FONTS_BY_SCRIPT } = await import('../../data/persona-tables.js');
    const scripts = {};
    for (const [script, fonts] of Object.entries(FONTS_BY_SCRIPT)) {
        const samples = [SCRIPT_SAMPLES[script] || LATIN_SAMPLE, LATIN_SAMPLE];
        // One baseline per (base, sample) pair, shared across this script's
        // candidates.
        const baselines = BASE_FONTS.map((base) => samples.map((sample) => measure(base, sample)));
        // Quoting matters: an unquoted multi-word family name is invalid CSS
        // and the whole font shorthand would be dropped silently.
        const present = fonts.filter((font) => BASE_FONTS.some((base, baseIndex) =>
            samples.some((sample, sampleIndex) =>
                measure(`"${font}", ${base}`, sample) !== baselines[baseIndex][sampleIndex])));
        scripts[script] = { present, probed: fonts.length };
    }
    return { scripts, available: true };
};

/** Scripts with at least one marker font installed. */
export const scriptsWithFonts = (probe) =>
    Object.entries(probe?.scripts ?? {})
        .filter(([, result]) => result.present.length > 0)
        .map(([script]) => script);

// The two reference tables the tool needs before any request is made: which
// languages a country's locals plausibly run their machine in (the picker),
// and which fonts mark a writing system (the font probe). Everything else
// about a country comes from Intl at runtime (utils/persona/local-profile.js).
// This file is the single owner of both tables — an edit here is the whole
// edit.

// ---------------------------------------------------------------------------
// Additional languages a country's residents plausibly run their OS in,
// beyond the one Intl.Locale#maximize() reports. Order is significance; an
// entry may safely repeat the primary (deduped at merge). Not a census — an
// entry earns its place only when the language realistically appears in
// `navigator.languages` on a local machine.
// ---------------------------------------------------------------------------
export const EXTRA_LANGUAGES = {
    AE: ['ar', 'en'], AF: ['fa', 'ps'], AM: ['hy', 'ru'], AT: ['de'],
    AZ: ['az', 'ru'], BA: ['bs', 'hr', 'sr'], BE: ['nl', 'fr', 'de'],
    BN: ['ms', 'en'], BO: ['es', 'qu', 'ay'], BY: ['be', 'ru'], CA: ['en', 'fr'],
    CH: ['de', 'fr', 'it'], CM: ['fr', 'en'], CY: ['el', 'tr'], DJ: ['fr', 'ar'],
    DZ: ['ar', 'fr'], EE: ['et', 'ru'], ER: ['ti', 'ar', 'en'],
    ES: ['es', 'ca', 'eu', 'gl'], ET: ['am', 'om'], FI: ['fi', 'sv'],
    FJ: ['en', 'fj'], GE: ['ka', 'ru'], HK: ['zh', 'en'], IE: ['en', 'ga'],
    IL: ['he', 'ar', 'ru'], IN: ['hi', 'en'], IQ: ['ar', 'ku'], KE: ['sw', 'en'],
    KG: ['ky', 'ru'], KZ: ['kk', 'ru'], LB: ['ar', 'fr'],
    LK: ['si', 'ta', 'en'], LU: ['lb', 'fr', 'de'], LV: ['lv', 'ru'],
    MA: ['ar', 'fr'], MD: ['ro', 'ru'], MG: ['mg', 'fr'], MK: ['mk', 'sq'],
    ML: ['fr', 'bm'], MO: ['zh', 'pt'], MT: ['mt', 'en'], MU: ['en', 'fr'],
    MY: ['ms', 'en', 'zh'], NG: ['en', 'ha', 'yo', 'ig'], NO: ['nb', 'nn'],
    NZ: ['en', 'mi'], PE: ['es', 'qu'], PH: ['fil', 'en'], PK: ['ur', 'en'],
    PY: ['es', 'gn'], RW: ['rw', 'fr', 'en'], SC: ['fr', 'en'],
    SG: ['en', 'zh', 'ms', 'ta'], SN: ['fr', 'wo'], SO: ['so', 'ar'],
    TJ: ['tg', 'ru'], TL: ['pt', 'tet'], TN: ['ar', 'fr'], TZ: ['sw', 'en'],
    UA: ['uk', 'ru'], US: ['en', 'es'], UZ: ['uz', 'ru'],
    VU: ['bi', 'en', 'fr'], ZA: ['en', 'af', 'zu', 'xh'],
};

// ---------------------------------------------------------------------------
// Writing system → marker fonts, keyed by ISO 15924 script code. Latin and
// Cyrillic are absent (every OS ships them). Fonts that every install of an
// OS carries regardless of language are excluded wherever a language-gated
// alternative exists — they would match for everyone — and kept only for
// scripts that have no such alternative, where dropping them would penalize
// genuine locals instead.
// ---------------------------------------------------------------------------
export const FONTS_BY_SCRIPT = {
    Jpan: ['Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', 'MS Mincho', 'Yu Mincho', 'Noto Sans JP', 'Noto Sans CJK JP', 'Source Han Sans JP'],
    Hans: ['PingFang SC', 'Songti SC', 'DengXian', 'SimHei', 'KaiTi', 'Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei', 'WenQuanYi Zen Hei'],
    Hant: ['PingFang TC', 'Heiti TC', 'PMingLiU', 'MingLiU', 'DFKai-SB', 'Noto Sans TC', 'Noto Sans CJK TC', 'Source Han Sans TC'],
    Kore: ['Apple SD Gothic Neo', 'Gulim', 'Batang', 'Dotum', 'Noto Sans KR', 'Noto Sans CJK KR', 'Source Han Sans K', 'NanumGothic'],
    Arab: ['Geeza Pro', 'Al Bayan', 'Traditional Arabic', 'Arabic Typesetting', 'Sakkal Majalla', 'Noto Sans Arabic'],
    Hebr: ['Arial Hebrew', 'David', 'Gisha', 'Noto Sans Hebrew'],
    Thai: ['Thonburi', 'Angsana New', 'Cordia New', 'Browallia New', 'Noto Sans Thai'],
    Deva: ['Kohinoor Devanagari', 'Mangal', 'Aparajita', 'Noto Sans Devanagari'],
    Beng: ['Bangla Sangam MN', 'Vrinda', 'Shonar Bangla', 'Noto Sans Bengali'],
    Taml: ['Tamil Sangam MN', 'Latha', 'Vijaya', 'Noto Sans Tamil'],
    Telu: ['Telugu Sangam MN', 'Gautami', 'Vani', 'Noto Sans Telugu'],
    Knda: ['Kannada Sangam MN', 'Tunga', 'Noto Sans Kannada'],
    Mlym: ['Malayalam Sangam MN', 'Kartika', 'Noto Sans Malayalam'],
    Guru: ['Gurmukhi MN', 'Raavi', 'Noto Sans Gurmukhi'],
    Gujr: ['Gujarati Sangam MN', 'Shruti', 'Noto Sans Gujarati'],
    Sinh: ['Sinhala Sangam MN', 'Iskoola Pota', 'Noto Sans Sinhala'],
    Mymr: ['Myanmar Sangam MN', 'Myanmar Text', 'Noto Sans Myanmar'],
    Khmr: ['Khmer Sangam MN', 'Khmer UI', 'DaunPenh', 'Noto Sans Khmer'],
    Laoo: ['Lao Sangam MN', 'Lao UI', 'DokChampa', 'Noto Sans Lao'],
    Ethi: ['Kefa', 'Nyala', 'Noto Sans Ethiopic'],
    Geor: ['Sylfaen', 'Noto Sans Georgian'],
    Armn: ['Mshtakan', 'Sylfaen', 'Noto Sans Armenian'],
};

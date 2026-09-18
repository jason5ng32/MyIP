// Section-banner tests: unit-tests for the pure helpers in
// frontend/utils/banners.js, plus a data-validation block over
// frontend/data/banners/. The whole directory is deploy-time data (gitignored),
// so the scan validates whatever files are present on this machine and passes
// vacuously when the directory is empty or absent.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BANNER_COLORS, bannerCopy, bannerLink, bannerPricing, bannerShown, bannerTheme, pickBanners } from '../frontend/utils/banners.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANNERS_DIR = path.join(repoRoot, 'frontend', 'data', 'banners');

// Inline fixtures matching the data-file contract documented in the util.
const external = {
    id: 'vps',
    icon: 'Server',
    url: 'https://sponsor.example.com/deal?ref=abc',
    utm: { source: 'ipcheck.ing', medium: 'referral', campaign: 'ipinfo-vps' },
    copy: {
        en: { title: 'Fast VPS', note: 'A note.', cta: 'Get it' },
        zh: { title: '高速 VPS', note: '一段说明。', cta: '立即获取' },
    },
    track: 'IPInfoVPS',
};

const internal = {
    id: 'invisibility',
    icon: 'Shield',
    to: '/?tool=invisibilitytest',
    copy: { en: { title: 'Go deeper', note: 'A note.', cta: 'Try it' } },
    track: 'WebRTCInvisibility',
};

describe('bannerCopy', () => {
    it('returns the inline copy for the active language', () => {
        assert.deepEqual(bannerCopy(external, 'zh'), external.copy.zh);
    });

    it('falls back to English for an uncovered language', () => {
        assert.deepEqual(bannerCopy(external, 'fr'), external.copy.en);
    });

    it('stays renderable with no banner or no copy at all', () => {
        for (const value of [null, undefined, {}]) {
            assert.deepEqual(bannerCopy(value, 'en'), { title: '', note: '', cta: '' });
        }
    });
});

describe('bannerPricing', () => {
    it('preserves legacy price strings without guessing currency or language boundaries', () => {
        for (const text of ['Starting from $2.99 / month', '每月低至 $2.99', 'À partir de 2,99 $']) {
            assert.deepEqual(bannerPricing(text), { text });
        }
    });

    it('supports localized structured prices and optional qualifiers', () => {
        const pricing = { prefix: '低至', amount: '$2.99', suffix: '/ 月' };
        assert.deepEqual(bannerPricing(pricing), pricing);
        assert.deepEqual(bannerPricing({ amount: '免费' }), { prefix: '', amount: '免费', suffix: '' });
        assert.deepEqual(bannerPricing({ amount: '$0.00', suffix: '/ month' }), {
            prefix: '', amount: '$0.00', suffix: '/ month',
        });
    });

    it('hides missing, blank and malformed prices rather than rendering object text', () => {
        for (const pricing of [undefined, null, '', '  ', 2.99, [], {}, { prefix: 'From' },
            { amount: '' }, { amount: ' ' }, { amount: 2.99 }, { amount: '$2.99', suffix: 1 }]) {
            assert.equal(bannerPricing(pricing), null);
        }
    });

    it('resolves structured prices through the existing campaign locale fallback', () => {
        const en = { prefix: 'From', amount: '$2.99', suffix: '/ month' };
        const zh = { prefix: '低至', amount: '$2.99', suffix: '/ 月' };
        const banner = { copy: { en: { pricing: en }, zh: { pricing: zh } } };
        assert.deepEqual(bannerPricing(bannerCopy(banner, 'zh').pricing), zh);
        assert.deepEqual(bannerPricing(bannerCopy(banner, 'fr').pricing), en);
    });
});

describe('bannerLink', () => {
    it('appends prefixed utm params and utm_content=lang, keeping existing query', () => {
        const url = new URL(bannerLink(external, 'zh'));
        assert.equal(url.origin + url.pathname, 'https://sponsor.example.com/deal');
        assert.equal(url.searchParams.get('ref'), 'abc');
        assert.equal(url.searchParams.get('utm_source'), 'ipcheck.ing');
        assert.equal(url.searchParams.get('utm_medium'), 'referral');
        assert.equal(url.searchParams.get('utm_campaign'), 'ipinfo-vps');
        assert.equal(url.searchParams.get('utm_content'), 'zh');
    });

    it('works with an empty or missing utm object', () => {
        const url = new URL(bannerLink({ url: 'https://x.example.com/' }, 'en'));
        assert.equal(url.searchParams.get('utm_content'), 'en');
        assert.equal([...url.searchParams.keys()].length, 1);
    });
});

describe('pickBanners', () => {
    // Shape mirrors an eager import.meta.glob result: { path: { default } }.
    const modules = {
        '../../data/banners/ipinfo.js': { default: external },
        '../../data/banners/webrtc.js': { default: internal },
        '../../data/banners/speedtest.js': { default: null }, // explicitly off
    };

    it('matches by filename: <section>.js serves section "<section>"', () => {
        assert.deepEqual(pickBanners(modules, 'ipinfo'), [external]);
        assert.deepEqual(pickBanners(modules, 'webrtc'), [internal]);
    });

    it('treats a null default export as absent', () => {
        assert.deepEqual(pickBanners(modules, 'speedtest'), []);
        assert.deepEqual(pickBanners({ './x.js': {} }, 'x'), []); // undefined default
    });

    it('returns an empty array when nothing matches or the map is empty', () => {
        assert.deepEqual(pickBanners(modules, 'connectivity'), []);
        assert.deepEqual(pickBanners({}, 'ipinfo'), []);
        assert.deepEqual(pickBanners(undefined, 'ipinfo'), []);
    });
});

describe('banner arrays and presentation options', () => {
    it('keeps array order and limits display to two without mutating the data', () => {
        const campaigns = [external, internal, { ...internal, id: 'third' }];
        assert.deepEqual(pickBanners({ './ipinfo.js': { default: campaigns } }, 'ipinfo'), [external, internal]);
        assert.equal(campaigns.length, 3);
        assert.deepEqual(pickBanners({ './ipinfo.js': { default: [] } }, 'ipinfo'), []);
        assert.deepEqual(pickBanners({ './ipinfo.js': { default: [external] } }, 'ipinfo'), [external]);
    });

    it('gates each campaign independently and defaults to waiting for completion', () => {
        assert.equal(bannerShown(external, false), false);
        assert.equal(bannerShown(external, true), true);
        assert.equal(bannerShown({ requireSettled: true }, false), false);
        assert.equal(bannerShown({ requireSettled: false }, false), true);
        const campaigns = [external, { ...internal, requireSettled: false }];
        assert.equal(campaigns.filter((banner) => bannerShown(banner, false)).length, 1);
        assert.equal(campaigns.filter((banner) => bannerShown(banner, true)).length, 2);
    });

    it('uses paired semantic color tokens, with info as the default and invalid-value fallback', () => {
        for (const color of BANNER_COLORS) {
            assert.deepEqual(bannerTheme({ color }), {
                '--banner-color': `var(--${color})`,
                '--banner-foreground': `var(--${color}-foreground)`,
            });
        }
        for (const value of [undefined, {}, { color: 'unknown' }, { color: '#fff' }]) {
            assert.deepEqual(bannerTheme(value), bannerTheme({ color: 'info' }));
        }
    });

    it('resolves localized pricing with the campaign copy and its English fallback', () => {
        const banner = { copy: {
            en: { ...external.copy.en, pricing: 'Starting from $2.99' },
            zh: { ...external.copy.zh, pricing: '低至 $2.99' },
        } };
        assert.equal(bannerCopy(banner, 'zh').pricing, '低至 $2.99');
        assert.equal(bannerCopy(banner, 'fr').pricing, 'Starting from $2.99');
        assert.equal(bannerCopy(external, 'en').pricing, undefined);
    });
});

describe('banner data files', () => {
    // A missing directory would be an empty list, not a failure — null-export
    // files likewise stay vacuously valid.
    const listBannerFiles = async () => {
        try {
            return (await readdir(BANNERS_DIR)).filter((f) => f.endsWith('.js'));
        } catch (err) {
            if (err.code === 'ENOENT') return [];
            throw err;
        }
    };

    it('every data file is pure, Node-loadable, and matches the contract', async () => {
        const files = await listBannerFiles();
        const ids = [];
        for (const file of files) {
            // Dynamic import doubles as the purity check: a data file that
            // imported Vue or app code would fail to load under Node.
            const mod = await import(pathToFileURL(path.join(BANNERS_DIR, file)).href);
            const data = mod.default;
            if (data === null) continue; // explicitly disabled slot — valid
            const banners = Array.isArray(data) ? data : [data];
            assert.ok(banners.length <= 2, `${file}: at most two banners per section`);
            for (const banner of banners) {
                assert.ok(banner && typeof banner === 'object' && !Array.isArray(banner),
                    `${file}: each banner must be an object`);
                for (const field of ['id', 'icon', 'track']) {
                    assert.ok(typeof banner[field] === 'string' && banner[field].length > 0,
                        `${file}: ${field} must be a non-empty string`);
                }
                // Click target: exactly one of external `url` / internal `to` /
                // side panel `sheet`.
                const hasUrl = typeof banner.url === 'string';
                const targets = ['url', 'to', 'sheet'].filter((k) => typeof banner[k] === 'string');
                assert.equal(targets.length, 1, `${file}: exactly one of url | to | sheet`);
                if (hasUrl) {
                    assert.doesNotThrow(() => new URL(banner.url), `${file}: url must parse`);
                } else {
                    assert.ok(banner.utm === undefined, `${file}: utm only makes sense with url`);
                }
                // Wording is always the inline `copy` map: en required and
                // complete, other languages optional (bannerCopy falls back).
                for (const field of ['title', 'note', 'cta']) {
                    assert.ok(typeof banner.copy?.en?.[field] === 'string' && banner.copy.en[field].length > 0,
                        `${file}: copy.en.${field} must be a non-empty string`);
                }
                for (const flag of ['requireSettled', 'transition', 'sweep']) {
                    if (banner[flag] !== undefined) {
                        assert.equal(typeof banner[flag], 'boolean', `${file}: ${flag} must be a boolean`);
                    }
                }
                if (banner.color !== undefined) {
                    assert.ok(BANNER_COLORS.includes(banner.color), `${file}: color must be a supported theme token`);
                }
                for (const [lang, copy] of Object.entries(banner.copy)) {
                    if (copy.pricing !== undefined) {
                        assert.ok(typeof copy.pricing === 'string' || bannerPricing(copy.pricing)?.amount,
                            `${file}: copy.${lang}.pricing must be a string or a structured price with a non-empty amount`);
                    }
                }
                ids.push(banner.id);
            }
        }
        assert.equal(new Set(ids).size, ids.length, 'banner ids must be unique');
    });
});

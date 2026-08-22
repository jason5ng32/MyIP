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
import { bannerCopy, bannerLink, pickBanner } from '../frontend/utils/banners.js';

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

describe('pickBanner', () => {
    // Shape mirrors an eager import.meta.glob result: { path: { default } }.
    const modules = {
        '../../data/banners/ipinfo.js': { default: external },
        '../../data/banners/webrtc.js': { default: internal },
        '../../data/banners/speedtest.js': { default: null }, // explicitly off
    };

    it('matches by filename: <section>.js serves section "<section>"', () => {
        assert.equal(pickBanner(modules, 'ipinfo'), external);
        assert.equal(pickBanner(modules, 'webrtc'), internal);
    });

    it('treats a null default export as absent', () => {
        assert.equal(pickBanner(modules, 'speedtest'), null);
        assert.equal(pickBanner({ './x.js': {} }, 'x'), null); // undefined default
    });

    it('returns null when nothing matches or the map is empty', () => {
        assert.equal(pickBanner(modules, 'connectivity'), null);
        assert.equal(pickBanner({}, 'ipinfo'), null);
        assert.equal(pickBanner(undefined, 'ipinfo'), null);
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
            const banner = mod.default;
            if (banner === null) continue; // explicitly disabled slot — valid
            assert.ok(banner && typeof banner === 'object', `${file}: default export must be an object or null`);
            for (const field of ['id', 'icon', 'track']) {
                assert.ok(typeof banner[field] === 'string' && banner[field].length > 0,
                    `${file}: ${field} must be a non-empty string`);
            }
            // Click target: exactly one of external `url` / internal `to`.
            const hasUrl = typeof banner.url === 'string';
            const hasTo = typeof banner.to === 'string';
            assert.ok(hasUrl !== hasTo, `${file}: exactly one of url | to`);
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
            ids.push(banner.id);
        }
        assert.equal(new Set(ids).size, ids.length, 'banner ids must be unique');
    });
});

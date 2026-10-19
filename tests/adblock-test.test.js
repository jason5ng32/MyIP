// Tests for the Ad & Tracker Blocking Test: the shape of the static probe
// list (frontend/data/adblock-probes.js) and the pure layer in
// frontend/utils/features/adblock-test.js.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { ADBLOCK_PROBE_GROUPS, ADBLOCK_PROBES_VERSION } from '../frontend/data/adblock-probes.js';
import {
    COSMETIC_BAITS,
    allVendorKeys,
    blockingLayer,
    buildPlan,
    isBaitHidden,
    isGeckoMac,
    probeLimits,
    probeRequest,
    probeUrlOf,
    runWithConcurrency,
    tally,
    statusTone,
    invertSelection,
    vendorKey,
    GECKO_MAC_CONCURRENCY,
    PROBE_CONCURRENCY,
} from '../frontend/utils/features/adblock-test.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

describe('adblock probe list', () => {
    it('carries a dated version', () => {
        assert.match(ADBLOCK_PROBES_VERSION, /^\d{4}-\d{2}-\d{2}$/);
    });

    it('has unique group ids and unique vendor ids per group', () => {
        const groupIds = ADBLOCK_PROBE_GROUPS.map((g) => g.id);
        assert.equal(new Set(groupIds).size, groupIds.length);
        for (const g of ADBLOCK_PROBE_GROUPS) {
            const ids = g.vendors.map((v) => v.id);
            assert.equal(new Set(ids).size, ids.length, `${g.id}: duplicate vendor id`);
            assert.ok(g.vendors.length > 0, `${g.id}: no vendors`);
        }
    });

    it('every vendor has targets of its group kind', () => {
        for (const g of ADBLOCK_PROBE_GROUPS) {
            assert.ok(['domain', 'script', 'cosmetic'].includes(g.kind), `${g.id}: kind ${g.kind}`);
            for (const v of g.vendors) {
                assert.ok(v.targets.length > 0, `${g.id}/${v.id}: no targets`);
                if (g.kind !== 'cosmetic') assert.equal(typeof v.name, 'string', `${g.id}/${v.id}: name`);
                for (const t of v.targets) {
                    if (g.kind === 'domain') assert.match(t, HOST, `${g.id}/${v.id}: ${t}`);
                    if (g.kind === 'script') {
                        const url = new URL(t);
                        assert.equal(url.protocol, 'https:', t);
                        assert.match(url.hostname, HOST, t);
                    }
                    if (g.kind === 'cosmetic') assert.ok(COSMETIC_BAITS[t], `${t}: no bait`);
                }
            }
        }
    });

    it('lists no domain twice', () => {
        const hosts = ADBLOCK_PROBE_GROUPS.filter((g) => g.kind === 'domain')
            .flatMap((g) => g.vendors.flatMap((v) => v.targets));
        const dupes = hosts.filter((h, i) => hosts.indexOf(h) !== i);
        assert.deepEqual(dupes, []);
    });
});

describe('buildPlan', () => {
    const groups = [
        { id: 'ads', kind: 'domain', vendors: [{ id: 'a', targets: ['a.example.com', 'b.example.com'] }, { id: 'b', targets: ['c.example.com'] }] },
        { id: 'scripts', kind: 'script', vendors: [{ id: 's', targets: ['https://x.example.com/t.js'] }] },
    ];

    it('expands only the selected vendors, in list order', () => {
        const plan = buildPlan(groups, [vendorKey('scripts', 's'), vendorKey('ads', 'a')]);
        assert.deepEqual(plan.map((p) => p.url), [
            'https://a.example.com/', 'https://b.example.com/', 'https://x.example.com/t.js',
        ]);
        assert.deepEqual(plan[0], {
            id: 'ads/a/a.example.com', groupId: 'ads', vendorId: 'a', kind: 'domain',
            target: 'a.example.com', url: 'https://a.example.com/',
        });
    });

    it('allVendorKeys selects everything', () => {
        assert.equal(buildPlan(groups, allVendorKeys(groups)).length, 4);
        assert.deepEqual(buildPlan(groups, []), []);
    });

    it('probeUrlOf maps each kind', () => {
        assert.equal(probeUrlOf('domain', 'x.com'), 'https://x.com/');
        assert.equal(probeUrlOf('script', 'https://x.com/a.js'), 'https://x.com/a.js');
        assert.equal(probeUrlOf('cosmetic', 'ad-container'), null);
    });
});

describe('probeRequest', () => {
    it('any response is open, and the request carries no credentials or referrer', async () => {
        let init;
        globalThis.fetch = async (_url, i) => { init = i; return { status: 0, type: 'opaque' }; };
        assert.equal(await probeRequest('https://x.example.com/'), 'open');
        assert.equal(init.mode, 'no-cors');
        assert.equal(init.credentials, 'omit');
        assert.equal(init.referrerPolicy, 'no-referrer');
    });

    it('a network error is blocked', async () => {
        globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
        assert.equal(await probeRequest('https://x.example.com/'), 'blocked');
    });

    it('a timeout is unknown', async () => {
        globalThis.fetch = (_url, { signal }) => new Promise((_, reject) => {
            signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        });
        assert.equal(await probeRequest('https://x.example.com/', { timeoutMs: 10 }), 'unknown');
    });
});

describe('runWithConcurrency', () => {
    it('runs every task with at most `limit` in flight', async () => {
        let inFlight = 0;
        let peak = 0;
        const done = [];
        const tasks = Array.from({ length: 10 }, (_, i) => async () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 2));
            inFlight -= 1;
            done.push(i);
        });
        await runWithConcurrency(tasks, 3);
        assert.equal(done.length, 10);
        assert.equal(peak, 3);
    });

    it('handles an empty list', async () => {
        await runWithConcurrency([], 4);
    });
});

describe('isGeckoMac / probeLimits', () => {
    const FF_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0';
    const FF_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15';
    const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
    const FF_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

    it('matches only Firefox-family on macOS', () => {
        assert.equal(isGeckoMac(FF_MAC, 'MacIntel'), true);
        assert.equal(isGeckoMac(FF_IOS, 'iPhone'), false);
        assert.equal(isGeckoMac(CHROME_MAC, 'MacIntel'), false);
        assert.equal(isGeckoMac(FF_WIN, 'Win32'), false);
    });

    it('throttles Gecko on macOS', () => {
        assert.equal(probeLimits(FF_MAC, 'MacIntel').concurrency, GECKO_MAC_CONCURRENCY);
        assert.equal(probeLimits(CHROME_MAC, 'MacIntel').concurrency, PROBE_CONCURRENCY);
    });
});

describe('isBaitHidden', () => {
    const shown = { connected: true, offsetHeight: 10, display: 'block', visibility: 'visible' };
    it('a laid-out, visible bait is shown', () => assert.equal(isBaitHidden(shown), false));
    it('removed, collapsed, display:none or hidden all count as hidden', () => {
        assert.equal(isBaitHidden({ ...shown, connected: false }), true);
        assert.equal(isBaitHidden({ ...shown, offsetHeight: 0 }), true);
        assert.equal(isBaitHidden({ ...shown, display: 'none' }), true);
        assert.equal(isBaitHidden({ ...shown, visibility: 'hidden' }), true);
    });
});

describe('tally', () => {
    it('counts statuses and scores the answered ones', () => {
        assert.deepEqual(tally(['blocked', 'blocked', 'open', 'unknown', 'pending']), {
            total: 5, blocked: 2, open: 1, unknown: 1, pending: 1, score: 67,
        });
    });

    it('scores null when nothing answered', () => {
        assert.equal(tally(['unknown', 'pending']).score, null);
        assert.equal(tally([]).score, null);
    });
});

describe('statusTone / invertSelection', () => {
    it('blocked is a stop, not blocked passes through, the rest wait', () => {
        assert.equal(statusTone('blocked'), 'fail');
        assert.equal(statusTone('open'), 'ok-fast');
        assert.equal(statusTone('unknown'), 'wait');
        assert.equal(statusTone('pending'), 'wait');
    });

    it('inverts against the full key list, keeping its order', () => {
        assert.deepEqual(invertSelection(['a', 'b', 'c', 'd'], new Set(['b', 'd'])), ['a', 'c']);
        assert.deepEqual(invertSelection(['a', 'b'], []), ['a', 'b']);
        assert.deepEqual(invertSelection(['a', 'b'], ['a', 'b']), []);
    });
});

describe('blockingLayer', () => {
    const c = (blocked, open) => ({ blocked, open });

    it('a hidden bait means a browser-level blocker', () => {
        assert.equal(blockingLayer({ requests: c(10, 2), cosmetic: c(1, 1) }), 'browser');
        assert.equal(blockingLayer({ requests: c(0, 0), cosmetic: c(2, 0) }), 'browser');
    });

    it('blocked requests with untouched baits mean network level', () => {
        assert.equal(blockingLayer({ requests: c(10, 2), cosmetic: c(0, 2) }), 'network');
    });

    it('nothing blocked anywhere is none', () => {
        assert.equal(blockingLayer({ requests: c(0, 12), cosmetic: c(0, 2) }), 'none');
    });

    it('cannot tell without the cosmetic part or any answer', () => {
        assert.equal(blockingLayer({ requests: c(10, 2), cosmetic: c(0, 0) }), null);
        assert.equal(blockingLayer({ requests: c(0, 12), cosmetic: c(0, 0) }), null);
        assert.equal(blockingLayer({ requests: c(0, 0), cosmetic: c(0, 0) }), null);
    });
});

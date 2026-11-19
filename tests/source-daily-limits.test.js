// Tests for server/source-daily-limits.js — parsing IP_SOURCE_DAILY_LIMITS,
// the per-day counters, their state, the route middleware and its wiring.

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { describe, it } from 'node:test';

import {
    SOURCE_DAILY_LIMIT_CODE, parseSourceDailyLimits, localDayKey, restoreCounts,
    createDailyCounter, sourceDailyLimitMiddleware, sourceDailyLimit, initSourceDailyLimits,
} from '../server/source-daily-limits.js';

// The keys the backend passes in (api/ip-sources.js; its own spec checks them).
const KEYS = ['ipinfoio', 'ipapicom', 'ipsb', 'ipapiis', 'ip2locationio', 'maxmind', 'ipchecking'];

// A clock the test moves by hand.
const clock = (iso) => {
    let at = new Date(iso);
    return { now: () => at, set: (next) => { at = new Date(next); } };
};

const DAY = '2026-11-19T10:00:00';

describe('parseSourceDailyLimits', () => {
    it('reads key=number pairs, tolerating whitespace and case', () => {
        assert.deepEqual(parseSourceDailyLimits(' ipapiis=90000 , IP2LocationIO = 50000 ,', KEYS), {
            limits: { ipapiis: 90000, ip2locationio: 50000 },
            ignored: [],
        });
    });

    it('treats 0, empty and unset as unlimited', () => {
        assert.deepEqual(parseSourceDailyLimits('maxmind=0', KEYS), { limits: {}, ignored: [] });
        assert.deepEqual(parseSourceDailyLimits('', KEYS), { limits: {}, ignored: [] });
        assert.deepEqual(parseSourceDailyLimits(undefined, KEYS), { limits: {}, ignored: [] });
    });

    it('ignores and names every malformed pair, keeping the rest', () => {
        const value = 'ipinfoio=10,foo=5,ipsb,ipsb=,=3,ipapicom=-1,maxmind=1.5,ipchecking=1e3,ipapiis=+4,'
            + 'ip2locationio=abc,ipinfoio=20,ipapiis=99999999999999999999';
        const { limits, ignored } = parseSourceDailyLimits(value, KEYS);
        assert.deepEqual(limits, { ipinfoio: 10 });
        assert.deepEqual(ignored, ['foo=5', 'ipsb', 'ipsb=', '=3', 'ipapicom=-1', 'maxmind=1.5', 'ipchecking=1e3',
            'ipapiis=+4', 'ip2locationio=abc', 'ipinfoio=20', 'ipapiis=99999999999999999999']);
    });

    it('accepts only the keys it is given', () => {
        assert.deepEqual(parseSourceDailyLimits('ipinfoio=1,ipsb=2', ['ipsb']), { limits: { ipsb: 2 }, ignored: ['ipinfoio=1'] });
    });
});

describe('localDayKey / restoreCounts', () => {
    it('keys the local calendar day', () => {
        assert.equal(localDayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
        assert.equal(localDayKey(new Date(2026, 0, 6, 0, 0)), '2026-01-06');
    });

    it('restores today\'s counts and ignores another day or a bad shape', () => {
        assert.deepEqual(restoreCounts({ day: '2026-11-19', counts: { ipinfoio: 3, gone: 2 } }, '2026-11-19', KEYS), { ipinfoio: 3 });
        assert.equal(restoreCounts({ day: '2026-11-18', counts: { ipinfoio: 3 } }, '2026-11-19', KEYS), null);
        for (const bad of [null, 'x', [], { day: '2026-11-19' }, { day: '2026-11-19', counts: [] },
            { day: '2026-11-19', counts: { ipinfoio: -1 } }, { day: '2026-11-19', counts: { ipinfoio: '3' } }]) {
            assert.equal(restoreCounts(bad, '2026-11-19', KEYS), null, JSON.stringify(bad));
        }
    });
});

describe('createDailyCounter', () => {
    it('reserves up to the limit, then refuses with one ceiling signal', () => {
        const ceilings = [];
        const counter = createDailyCounter({ limits: { ipinfoio: 2 }, now: clock(DAY).now, onCeiling: (...a) => ceilings.push(a) });
        assert.equal(counter.reserve('ipinfoio').ok, true);
        assert.equal(counter.reserve('ipinfoio').ok, true);
        assert.equal(counter.reserve('ipinfoio').ok, false);
        assert.equal(counter.reserve('ipinfoio').ok, false);
        assert.deepEqual(ceilings, [['ipinfoio', 2]]);
        assert.equal(counter.count('ipinfoio'), 2);
    });

    it('a release gives the slot back, never below zero', () => {
        const counter = createDailyCounter({ limits: { ipinfoio: 1 }, now: clock(DAY).now });
        const slot = counter.reserve('ipinfoio');
        assert.equal(counter.reserve('ipinfoio').ok, false);
        counter.release('ipinfoio', slot.day);
        assert.equal(counter.count('ipinfoio'), 0);
        counter.release('ipinfoio', slot.day);
        assert.equal(counter.count('ipinfoio'), 0);
        assert.equal(counter.reserve('ipinfoio').ok, true);
    });

    it('starts over on the next local day, and a slot from yesterday releases nothing', () => {
        const time = clock(DAY);
        const ceilings = [];
        const counter = createDailyCounter({ limits: { ipsb: 1 }, now: time.now, onCeiling: (key) => ceilings.push(key) });
        const yesterday = counter.reserve('ipsb');
        assert.equal(counter.reserve('ipsb').ok, false);
        time.set('2026-11-20T00:00:01');
        const today = counter.reserve('ipsb');
        assert.equal(today.ok, true);
        counter.release('ipsb', yesterday.day);
        assert.equal(counter.count('ipsb'), 1);
        assert.equal(counter.reserve('ipsb').ok, false);
        assert.deepEqual(ceilings, ['ipsb', 'ipsb']);
    });

    it('leaves sources without a limit alone', () => {
        const counter = createDailyCounter({ limits: { ipinfoio: 1 }, now: clock(DAY).now });
        for (let i = 0; i < 5; i += 1) assert.equal(counter.reserve('maxmind').ok, true);
        assert.equal(counter.count('maxmind'), 0);
        assert.equal(counter.limitOf('maxmind'), 0);
    });

    it('continues today\'s stored counts and ignores another day\'s', () => {
        const stored = { day: '2026-11-19', counts: { ipinfoio: 2 } };
        const counter = createDailyCounter({ limits: { ipinfoio: 3 }, now: clock(DAY).now, load: () => stored });
        assert.equal(counter.count('ipinfoio'), 2);
        assert.equal(counter.reserve('ipinfoio').ok, true);
        assert.equal(counter.reserve('ipinfoio').ok, false);

        const old = createDailyCounter({ limits: { ipinfoio: 3 }, now: clock('2026-11-21T08:00:00').now, load: () => stored });
        assert.equal(old.count('ipinfoio'), 0);
    });

    it('saves after a delay, at most once per window, and at once on a ceiling', async () => {
        const saved = [];
        const counter = createDailyCounter({
            limits: { ipinfoio: 2 }, now: clock(DAY).now, save: async (s) => { saved.push(s); }, saveDelayMs: 20,
        });
        counter.reserve('ipinfoio');
        counter.reserve('ipinfoio');
        assert.equal(saved.length, 0);
        await new Promise((r) => { setTimeout(r, 40); });
        assert.deepEqual(saved, [{ day: '2026-11-19', counts: { ipinfoio: 2 } }]);
        counter.reserve('ipinfoio');
        await Promise.resolve();
        assert.equal(saved.length, 2);
        counter.reserve('ipinfoio');
        await Promise.resolve();
        assert.equal(saved.length, 2);
    });

    it('counts in memory when the state cannot be read or written, warning once each', async () => {
        const loadErrors = [];
        const saveErrors = [];
        const counter = createDailyCounter({
            limits: { ipinfoio: 5 },
            now: clock(DAY).now,
            load: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); },
            save: async () => { throw new Error('read-only'); },
            onLoadError: (e) => loadErrors.push(e.message),
            onSaveError: (e) => saveErrors.push(e.message),
        });
        counter.reserve('ipinfoio');
        await counter.flush();
        counter.reserve('ipinfoio');
        await counter.flush();
        assert.equal(counter.count('ipinfoio'), 2);
        assert.deepEqual(loadErrors, ['denied']);
        assert.deepEqual(saveErrors, ['read-only']);
    });

    it('treats a missing state as a fresh start, without a warning', () => {
        const loadErrors = [];
        const counter = createDailyCounter({
            limits: { ipinfoio: 5 },
            now: clock(DAY).now,
            load: () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); },
            onLoadError: (e) => loadErrors.push(e),
        });
        assert.equal(counter.count('ipinfoio'), 0);
        assert.equal(loadErrors.length, 0);
    });

    it('a malformed state file is ignored', () => {
        const loadErrors = [];
        const counter = createDailyCounter({
            limits: { ipinfoio: 5 },
            now: clock(DAY).now,
            load: () => JSON.parse('{not json'),
            onLoadError: (e) => loadErrors.push(e),
        });
        assert.equal(counter.count('ipinfoio'), 0);
        assert.equal(loadErrors.length, 1);
    });
});

// A response stand-in that emits 'finish' / 'close' like Node's.
const makeRes = () => {
    const res = new EventEmitter();
    Object.assign(res, {
        statusCode: 200,
        writableFinished: false,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    });
    res.end = (status = res.statusCode) => {
        res.statusCode = status;
        res.writableFinished = true;
        res.emit('finish');
        res.emit('close');
    };
    res.abort = () => res.emit('close');
    return res;
};

const run = (middleware) => {
    const res = makeRes();
    let next = 0;
    middleware({}, res, () => { next += 1; });
    return { res, next };
};

describe('sourceDailyLimitMiddleware', () => {
    const limited = (limit = 1) => createDailyCounter({ limits: { ipinfoio: limit }, now: clock(DAY).now });

    it('admits within the limit and keeps the slot on success', () => {
        const counter = limited();
        const { res, next } = run(sourceDailyLimitMiddleware(counter, 'ipinfoio'));
        assert.equal(next, 1);
        res.end(200);
        assert.equal(counter.count('ipinfoio'), 1);
    });

    it('answers 429 with a code once the day is used up', () => {
        const counter = limited();
        const middleware = sourceDailyLimitMiddleware(counter, 'ipinfoio');
        run(middleware).res.end(200);
        const { res, next } = run(middleware);
        assert.equal(next, 0);
        assert.equal(res.statusCode, 429);
        assert.deepEqual(res.body, { error: 'Daily limit reached for this source', code: SOURCE_DAILY_LIMIT_CODE });
    });

    it('releases on an error status, once', () => {
        const counter = limited(3);
        const middleware = sourceDailyLimitMiddleware(counter, 'ipinfoio');
        run(middleware).res.end(200);
        const { res } = run(middleware);
        res.end(500);
        res.emit('finish');
        res.emit('close');
        assert.equal(counter.count('ipinfoio'), 1);
        run(middleware).res.end(400);
        assert.equal(counter.count('ipinfoio'), 1);
    });

    it('releases on an aborted connection, once', () => {
        const counter = limited(2);
        const middleware = sourceDailyLimitMiddleware(counter, 'ipinfoio');
        run(middleware).res.end(200);
        const { res } = run(middleware);
        res.abort();
        res.abort();
        assert.equal(counter.count('ipinfoio'), 1);
    });

    it('leaves an unlimited source untouched', () => {
        const counter = limited();
        const middleware = sourceDailyLimitMiddleware(counter, 'maxmind');
        const { res, next } = run(middleware);
        assert.equal(next, 1);
        assert.equal(res.listenerCount('finish') + res.listenerCount('close'), 0);
        assert.equal(sourceDailyLimitMiddleware({ limitOf: () => 0 }, 'ipinfoio'), middleware);
    });
});

// Runs in order: the module's counters are process-wide, set by the first init.
describe('sourceDailyLimit', () => {
    it('refuses to wire a route before the keys are known', () => {
        assert.throws(() => sourceDailyLimit('ipinfoio'), /before initSourceDailyLimits/);
    });

    it('rejects an unknown source key at wiring time', () => {
        initSourceDailyLimits(KEYS, '');
        assert.throws(() => sourceDailyLimit('nope'), /Unknown IP source key: nope/);
        assert.equal(typeof sourceDailyLimit('maxmind'), 'function');
    });
});

describe('backend-server.js wiring', () => {
    const server = fs.readFileSync(new URL('../backend-server.js', import.meta.url), 'utf8');
    const loop = server.slice(server.indexOf('for (const source of IP_SOURCES)'));
    const at = (needle) => {
        const index = loop.indexOf(needle);
        assert.ok(index >= 0, `${needle} not found in the geo route loop`);
        return index;
    };

    it('initializes the limits with the registry keys', () => {
        assert.match(server, /initSourceDailyLimits\(IP_SOURCE_KEYS\)/);
    });

    it('each geo route carries its own key, after its gates and before the answer chain', () => {
        const limit = at('sourceDailyLimit(source.key)');
        assert.ok(at('requirePublicIP()') < at('source.gates') && at('source.gates') < limit);
        assert.ok(limit < at('withTimeZone()') && at('withTimeZone()') < at('cacheable(source.cacheSeconds)'));
        assert.ok(at('cacheable(source.cacheSeconds)') < at('source.handler'));
    });

    it('no other route carries it', () => {
        assert.equal(server.match(/sourceDailyLimit\(/g).length, 1);
    });
});

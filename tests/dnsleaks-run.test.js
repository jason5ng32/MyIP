// Exercise DNS card refreshes and shared fallbacks without DOM or network access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { computed, reactive, ref } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { createDnsLeakRunner } from '../frontend/utils/dnsleaks/index.js';

const source = readFileSync(new URL('../frontend/components/DnsLeaksTest.vue', import.meta.url), 'utf8');
const script = parse(source).descriptor.scriptSetup.content.replace(/^import[\s\S]*?;$/gm, '');
const deferred = () => {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return { promise, resolve };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

const fixture = (lookupMaxmind = async () => null) => {
    const events = [];
    const timers = [];
    const providers = Object.fromEntries(['ipApi', 'surfshark', 'myipstack', 'fastly', 'bashws', 'browserleaks', 'ipleak']
        .map(id => [id, { id, name: id, run: async () => ({ ip: '192.0.2.53' }) }]));
    const bindings = {
        computed, reactive, ref, createDnsLeakRunner, ...providers,
        useMainStore: () => ({ userPreferences: {}, setLoadingStatus: () => {} }),
        useI18n: () => ({ t: key => key }),
        useMaxmind: () => ({ lookupMaxmind }),
        createMaskGate: () => () => {},
        useStatusTone: () => ({}),
        useAppCommand: () => {},
        onMounted: () => {},
        trackEvent: () => {},
        emitAppEvent: (name, payload) => events.push({ name, payload }),
        setTimeout: (callback, delay) => timers.push({ callback, delay, fired: false }),
    };
    const setup = new Function(...Object.keys(bindings), `${script}\nreturn { checkAllDNSLeakTest, leakTest };`);
    const component = setup(...Object.values(bindings));
    const startSlots = () => {
        for (const timer of timers.filter(timer => !timer.fired && timer.delay < 6000)) {
            timer.fired = true;
            timer.callback();
        }
    };
    return { ...component, providers, events, startSlots };
};

test('cards share one standby request per run and refresh obtains a fresh result', async () => {
    const run = fixture();
    const calls = {};
    for (const [id, provider] of Object.entries(run.providers)) {
        calls[id] = 0;
        provider.run = async () => {
            calls[id]++;
            if (id !== 'bashws') throw new Error('unavailable');
            return { ip: `192.0.2.${calls[id]}` };
        };
    }
    for (const attempt of [1, 2]) {
        const finished = run.checkAllDNSLeakTest(attempt > 1);
        run.startSlots();
        await finished;
        assert(run.leakTest.every(card => card.id === 'bashws' && card.ip === `192.0.2.${attempt}`));
        assert.equal(calls.bashws, attempt);
        assert.equal(calls.ipApi, attempt * 2);
        assert.equal(run.events.length, attempt);
        assert.equal(calls.browserleaks, 0);
        assert.equal(calls.ipleak, 0);
    }
});

test('a superseded probe cannot overwrite refreshed cards or emit a stale report', async () => {
    const old = deferred();
    const run = fixture();
    for (const provider of Object.values(run.providers)) {
        let calls = 0;
        provider.run = () => ++calls === 1 ? old.promise : Promise.resolve({ ip: '192.0.2.2' });
    }
    const first = run.checkAllDNSLeakTest(false);
    run.startSlots();
    const second = run.checkAllDNSLeakTest(true);
    run.startSlots();
    await second;
    old.resolve({ ip: '192.0.2.1' });
    await first;
    assert(run.leakTest.every(card => card.ip === '192.0.2.2'));
    assert.equal(run.events.length, 1);
    assert(run.events[0].payload.providers.every(provider => provider.ip === '192.0.2.2'));
});

test('a delayed geo result cannot overwrite the new run', async () => {
    const oldGeo = deferred();
    const run = fixture(ip => ip === '192.0.2.1'
        ? oldGeo.promise
        : Promise.resolve({ country_code: 'US', country: 'New country', org: 'New org' }));
    for (const provider of Object.values(run.providers)) {
        let calls = 0;
        provider.run = async () => ({ ip: `192.0.2.${++calls}` });
    }
    const first = run.checkAllDNSLeakTest(false);
    run.startSlots();
    await flush();
    assert(run.leakTest.every(card => card.ip === '192.0.2.1'));
    const second = run.checkAllDNSLeakTest(true);
    run.startSlots();
    await second;
    oldGeo.resolve({ country_code: 'GB', country: 'Old country', org: 'Old org' });
    await first;
    assert(run.leakTest.every(card => card.ip === '192.0.2.2' && card.org === 'New org'));
    assert.equal(run.events.length, 1);
});

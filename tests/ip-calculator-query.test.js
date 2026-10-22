// Exercise calculator prefix commits and shareable query state without a DOM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { analyzeCidr, calculate } from '../frontend/utils/features/ip-calc.js';
import { useActiveValue } from '../frontend/composables/use-route-active.js';

const source = readFileSync(new URL('../frontend/components/advanced-tools/IpCalculator.vue', import.meta.url), 'utf8');
const script = parse(source).descriptor.scriptSetup.content.replace(/^import[\s\S]*?;$/gm, '');
// `active` stands in for the page's KeepAlive state (use-route-active.js).
const fixture = (q, active = ref(true)) => {
    const route = reactive({ path: '/tools/ipcalculator', query: { q, hl: 'en' } });
    const replacements = [];
    const bindings = {
        computed, ref, watch, analyzeCidr, calculate,
        useActiveValue: (getter, options) => useActiveValue(getter, { ...options, active }),
        useRoute: () => route,
        useRouter: () => ({ replace: value => { replacements.push(value); route.query = value.query; } }),
        useI18n: () => ({ t: key => key }),
        useMainStore: () => ({ allIPs: [] }),
    };
    const setup = new Function(...Object.keys(bindings), `${script}\nreturn { query, result, picked, onPrefix, onPrefixCommit };`);
    const component = setup(...Object.values(bindings));
    return { ...component, route, replacements };
};

for (const [input, prefix, expected] of [
    ['192.168.1.130/26', 24, '192.168.1.130/24'],
    ['2001:0db8:0000::1234/48', 64, '2001:db8::1234/64'],
    ['0x7f000001', 8, '127.0.0.1/8'],
    ['192.0.2.1', 0, '192.0.2.1/0'],
    ['192.0.2.1/24', 32, '192.0.2.1/32'],
    ['2001:db8::1/64', 128, '2001:db8::1/128'],
]) {
    test(`prefix commit preserves the host in the share URL: ${input}`, () => {
        const run = fixture(input);
        const split = run.result.value.analysis.split;
        run.picked.value = input;
        run.onPrefix(prefix);
        assert.equal(run.query.value, input, 'dragging leaves the input and URL untouched');
        assert.equal(run.replacements.length, 0);
        assert.equal(run.result.value.analysis.split, split, 'dragging preserves the subnet list');
        run.onPrefixCommit(prefix);
        assert.equal(run.query.value, expected);
        assert.deepEqual(run.route.query, { q: expected, hl: 'en' });
        assert.equal(run.replacements.length, 1);
        assert.equal(run.picked.value, '');
        assert.deepEqual(calculate(run.route.query.q).analysis.cidr, run.result.value.analysis.cidr);
        assert.equal(run.result.value.analysis.split, run.result.value.analysis.cidr);
        run.onPrefixCommit(prefix);
        assert.equal(run.replacements.length, 1, 'an unchanged prefix does not replace the URL again');
    });
}

test('a prefix commit without an address result leaves the URL alone', () => {
    for (const input of ['invalid', '10.0.0.1-10.0.0.10']) {
        const run = fixture(input);
        run.onPrefixCommit(24);
        assert.equal(run.query.value, input);
        assert.equal(run.replacements.length, 0);
    }
});

test('?q= runs on mount, follows the route while active, and is ignored while cached away', async () => {
    const active = ref(true);
    const run = fixture('10.0.0.0/22', active);
    assert.equal(run.query.value, '10.0.0.0/22');
    assert.equal(run.result.value.analysis.cidr.prefix, 22);

    // The route changes before this page is deactivated; the path tells them apart.
    run.route.path = '/tools/asn';
    run.route.query = { q: 'AS13335' };
    await nextTick();
    assert.equal(run.query.value, '10.0.0.0/22', 'another path\'s ?q= is ignored');

    active.value = false;
    run.route.query = { q: 'AS15169' };
    await nextTick();
    assert.equal(run.query.value, '10.0.0.0/22', 'a hidden tool ignores the route');
    assert.equal(run.result.value.analysis.cidr.prefix, 22);

    run.route.path = '/tools/ipcalculator';
    run.route.query = { q: '10.0.0.0/22' };
    run.query.value = '192.0.2.';
    active.value = true;
    await nextTick();
    assert.equal(run.query.value, '192.0.2.', 'an unchanged ?q= does not overwrite the input');

    active.value = false;
    run.route.query = { q: '192.0.2.0/24' };
    active.value = true;
    await nextTick();
    assert.equal(run.query.value, '192.0.2.0/24');
    assert.equal(run.result.value.analysis.cidr.prefix, 24);
    assert.equal(run.replacements.length, 0, 'reading ?q= never writes it back');
});

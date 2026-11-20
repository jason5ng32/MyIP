// Pins how MyIP learns a signed-in user's IPCheck.ing API usage: the coded over-quota answer and the in-memory usage summary.
//
// The store reaches for localStorage / window / document at import time —
// same globalThis stubs as store.test.js, installed before the dynamic imports.

globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; },
};
globalThis.window = {
  location: { search: '' },
  addEventListener() {},
  innerWidth: 1024,
};
globalThis.document = {
  addEventListener() {},
  title: '',
  querySelector() { return null; },
  documentElement: { classList: { toggle() {} } },
};

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { ipCheckingApiErrorBody } from '../server/ipcheck-ing-api.js';
import { SERVICE_ERROR_CODE } from '../common/codes/service-errors.js';

const { useMainStore } = await import('../frontend/store.js');
const { authenticatedFetch } = await import('../frontend/utils/authenticated-fetch.js');
const { ADVANCED_TOOLS } = await import('../frontend/data/tools.js');
const { IP_DATABASES } = await import('../frontend/data/ip-databases.js');

const realFetch = globalThis.fetch;

beforeEach(() => {
  setActivePinia(createPinia());
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

// --- source scan ------------------------------------------------------------

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_DIRS = ['frontend', 'api', 'server', 'common'];
// Tracked code only: frontend/data/banners is deploy-time data kept out of git.
const CODE_SKIP = new Set(['node_modules', 'frontend/locales', 'frontend/components/ui', 'frontend/data/banners']);
const ROOT_ENTRIES = ['backend-server.js', 'frontend-server.js', 'sentry-instrument.js', 'vite.config.js'];

const toPosix = (path) => path.split(sep).join('/');

const listFiles = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = toPosix(join(dir, entry.name));
  if (entry.isDirectory()) return CODE_SKIP.has(path) || CODE_SKIP.has(entry.name) ? [] : listFiles(path);
  return /\.(js|vue)$/.test(entry.name) ? [path] : [];
});

const CODE_FILES = [...CODE_DIRS.flatMap(listFiles), ...ROOT_ENTRIES];
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const SOURCES = new Map(CODE_FILES.map((path) => [path, read(path)]));

// `path:line` of every line matching `pattern` in the given files.
const hitsOf = (pattern, files = [...SOURCES.keys()]) => files.flatMap((path) => SOURCES.get(path).split('\n')
  .flatMap((line, i) => (pattern.test(line) ? [`${path}:${i + 1}`] : [])));

// --- fixture ----------------------------------------------------------------

// The /api/getuserinfo summary in the shape the front end reads (invented values).
const summaryFixture = () => ({
  userLevel: 2,
  functionUses: { total: 1234 },
  quota: {
    month: '2026-11',
    isSponsor: false,
    features: {
      ipinfo: { percent: 40, exhausted: false, daily: { percent: 100, exhausted: true, resetsAt: '2026-11-21T00:00:00Z' } },
      invisibility_test: { percent: 100, exhausted: true },
      dns_leak_test: { percent: 99, exhausted: false },
      persona_check: { percent: 0, exhausted: false },
      ip_hitlist: { percent: 10, exhausted: false },
    },
  },
  achievements: { IAmHuman: { achieved: true, achievedTime: 1763600000000 } },
});

// The registries' quotaKey values: the only home of the metered feature names.
const REGISTRY_FILES = ['frontend/data/tools.js', 'frontend/data/ip-databases.js'];
const QUOTA_KEYS = ['ipinfo', 'invisibility_test', 'dns_leak_test', 'persona_check', 'ip_hitlist'];
const registryQuotaKeys = () => [...IP_DATABASES, ...ADVANCED_TOOLS].filter((row) => row.quotaKey).map((row) => row.quotaKey);

// --- channel 1: the over-quota answer ---------------------------------------

describe('usage contract — the over-quota answer', () => {
  const upstream = (status, body) => new Response(JSON.stringify(body), { status });
  // The backend's coded body, as the browser receives it.
  const throughBrowser = async (body) => {
    globalThis.fetch = async () => ({ ok: false, status: 429, statusText: '', json: async () => body });
    return authenticatedFetch('/api/persona/evaluate', 'POST', {}).catch((e) => e);
  };

  it('codes the upstream quota_exceeded 429 as quota, with no extra fields', async () => {
    const body = await ipCheckingApiErrorBody(upstream(429, { error: 'Monthly quota exceeded', code: 'quota_exceeded' }));
    assert.deepEqual(body, { error: 'Monthly quota exceeded', code: SERVICE_ERROR_CODE.QUOTA });
    const error = await throughBrowser(body);
    assert.equal(error.status, 429);
    assert.equal(error.code, SERVICE_ERROR_CODE.QUOTA);
  });

  it('leaves the service-limit 429 uncoded all the way to the caller', async () => {
    const body = await ipCheckingApiErrorBody(upstream(429, { error: 'Service limit reached', code: 'service_limit' }));
    assert.equal('code' in body, false);
    const error = await throughBrowser(body);
    assert.equal(error.status, 429);
    assert.equal(error.code, undefined);
  });

  it('flips quotaExceeded only through markQuotaExhausted', () => {
    const s = useMainStore();
    s.remoteUserInfo = summaryFixture();
    assert.equal(s.quotaExceeded('persona_check'), false);
    s.markQuotaExhausted('persona_check');
    assert.equal(s.quotaExceeded('persona_check'), true);
    assert.deepEqual(s.remoteUserInfo.quota.features.persona_check, { percent: 100, exhausted: true });
  });

  it('calls markQuotaExhausted only under a quota-coded failure, with a registry key', () => {
    const calls = hitsOf(/markQuotaExhausted\(/).filter((hit) => !hit.startsWith('frontend/store.js:'));
    assert.ok(calls.length > 0);
    for (const hit of calls) {
      const [path, line] = hit.split(':');
      const lines = SOURCES.get(path).split('\n');
      const call = lines[Number(line) - 1];
      assert.match(call, /markQuotaExhausted\(QUOTA_KEY\)/, `${hit} passes a registry-derived key`);
      // The guard opens the block the call sits in, a few lines above.
      const guard = lines.slice(Math.max(0, Number(line) - 6), Number(line)).join('\n');
      assert.match(guard, /\.code === SERVICE_ERROR_CODE\.QUOTA\)/, `${hit} sits under a quota-code check`);
    }
  });
});

// --- channel 2: the usage summary -------------------------------------------

describe('usage contract — the usage summary', () => {
  it('quotaExceeded reads each feature\'s monthly exhausted flag', () => {
    const s = useMainStore();
    s.remoteUserInfo = summaryFixture();
    const read = Object.fromEntries(QUOTA_KEYS.map((key) => [key, s.quotaExceeded(key)]));
    // The ipinfo daily limit being used up is not the monthly quota.
    assert.deepEqual(read, {
      ipinfo: false, invisibility_test: true, dns_leak_test: false, persona_check: false, ip_hitlist: false,
    });
  });

  it('reads absent data as not exceeded and leaves it absent', () => {
    const s = useMainStore();
    for (const info of [{}, null, { quota: {} }, { quota: { features: {} } }, { functionUses: { total: 3 } }]) {
      s.remoteUserInfo = info;
      assert.equal(s.quotaExceeded('ipinfo'), false);
      s.markQuotaExhausted('ipinfo');
      assert.equal(s.quotaExceeded('ipinfo'), false);
    }
  });

  it('reads functionUses only for its total', () => {
    const readers = [...SOURCES.keys()].filter((path) => SOURCES.get(path).includes('functionUses'));
    assert.deepEqual(readers, ['frontend/components/User.vue']);
    const accesses = SOURCES.get('frontend/components/User.vue').match(/functionUses(\?\.|\.|\[)\w*/g);
    assert.deepEqual([...new Set(accesses)], ['functionUses?.total']);
  });
});

// --- feature names live only in the registries ------------------------------

describe('usage contract — metered feature names', () => {
  it('the registries name exactly the five metered features', () => {
    assert.deepEqual(registryQuotaKeys().sort(), [...QUOTA_KEYS].sort());
  });

  it('no code outside the registries spells out a metered feature name', () => {
    // These four are unambiguous anywhere; `ipinfo` is also a section id.
    const unambiguous = new RegExp(`\\b(${QUOTA_KEYS.filter((key) => key !== 'ipinfo').join('|')})\\b`);
    const outside = [...SOURCES.keys()].filter((path) => !REGISTRY_FILES.includes(path));
    assert.deepEqual(hitsOf(unambiguous, outside), []);
  });

  it('no code passes a literal key where a quota key goes', () => {
    const names = QUOTA_KEYS.join('|');
    const outside = [...SOURCES.keys()].filter((path) => !REGISTRY_FILES.includes(path));
    // Getter / action arguments, a quotaKey field, and feature lookups in the summary.
    assert.deepEqual(hitsOf(/(quotaExceeded|markQuotaExhausted)\(\s*['"`]/), []);
    assert.deepEqual(hitsOf(/quotaKey\s*:\s*['"`]/, outside), []);
    assert.deepEqual(hitsOf(new RegExp(`features(\\?\\.|\\.)(${names})\\b|features(\\?\\.)?\\[\\s*['"\`](${names})['"\`]`)), []);
  });
});

// --- no persistence ---------------------------------------------------------

describe('usage contract — the summary stays in memory', () => {
  it('preference writes never carry the summary', () => {
    const s = useMainStore();
    s.remoteUserInfo = summaryFixture();
    s.loadPreferences();
    s.updatePreference('theme', 'dark');
    s.setPreferences({ ...s.userPreferences });
    const stored = Object.values(globalThis.localStorage._data).join('\n');
    assert.ok(stored.length > 0);
    for (const marker of ['remoteUserInfo', 'functionUses', 'invisibility_test', 'isSponsor']) {
      assert.equal(stored.includes(marker), false, marker);
    }
  });

  it('no storage write or store subscription touches remoteUserInfo', () => {
    const writes = hitsOf(/(localStorage|sessionStorage)\.setItem|indexedDB|useStorage|useLocalStorage|useSessionStorage/);
    assert.ok(writes.length > 0);
    for (const hit of writes) {
      const [path, line] = hit.split(':');
      assert.doesNotMatch(SOURCES.get(path).split('\n')[Number(line) - 1], /remoteUserInfo|functionUses/, hit);
    }
    // No Pinia persistence: a $subscribe or a persist option could copy the summary out.
    assert.deepEqual(hitsOf(/\$subscribe|persistedstate|\bpersist\s*:/), []);
  });
});

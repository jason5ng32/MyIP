// Tests for api/ip-sources.js — the geo source registry, its /api/configs flags and its match with frontend/data/ip-databases.js.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { IP_SOURCES, IP_SOURCE_KEYS, ipSourceFlags } from '../api/ip-sources.js';
import { IP_DATABASES } from '../frontend/data/ip-databases.js';

const ENV_KEYS = [
    'IPINFO_API_KEY', 'IPINFO_API_TOKEN', 'IP2LOCATION_API_KEY', 'IPAPIIS_API_KEY',
    'IPCHECKING_API' + '_KEY', 'IPCHECKING_API' + '_ENDPOINT',
];
let envBackup = {};

beforeEach(() => {
    envBackup = {};
    for (const k of ENV_KEYS) envBackup[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (envBackup[k] === undefined) delete process.env[k];
        else process.env[k] = envBackup[k];
    }
});

const ONE_DAY = 24 * 60 * 60;
const keysWhere = (test) => IP_SOURCES.filter(test).map((s) => s.key);
const flagOf = (source) => source.configFlag ?? source.key;

describe('IP_SOURCES', () => {
    it('lists the seven geo routes once each, in order', () => {
        assert.deepEqual(IP_SOURCE_KEYS, ['ipinfoio', 'ipapicom', 'ipsb', 'ipapiis', 'ip2locationio', 'maxmind', 'ipchecking']);
        assert.equal(new Set(IP_SOURCE_KEYS).size, IP_SOURCE_KEYS.length);
        assert.ok(Object.isFrozen(IP_SOURCES) && Object.isFrozen(IP_SOURCE_KEYS));
    });

    it('gives every row a handler', () => {
        for (const source of IP_SOURCES) assert.equal(typeof source.handler, 'function', source.key);
    });

    it('marks only the sources that need configuration', () => {
        assert.deepEqual(keysWhere((s) => s.isConfigured).sort(), ['ip2locationio', 'ipapiis', 'ipchecking', 'ipinfoio']);
        for (const source of IP_SOURCES.filter((s) => s.isConfigured)) assert.equal(typeof source.isConfigured, 'function');
        assert.deepEqual(keysWhere((s) => s.configFlag), ['ipchecking']);
    });

    it('caches every source for a day but ipchecking', () => {
        assert.deepEqual(keysWhere((s) => s.cacheSeconds === undefined), ['ipchecking']);
        for (const source of IP_SOURCES.filter((s) => s.key !== 'ipchecking')) assert.equal(source.cacheSeconds, ONE_DAY, source.key);
    });

    it('counts signed-in uses of ipchecking only', () => {
        assert.deepEqual(IP_SOURCES.filter((s) => s.featureUse).map((s) => [s.key, s.featureUse]), [['ipchecking', 'ipdb:ipchecking']]);
    });

    it('gates maxmind on its data and ipchecking on an optional sign-in', () => {
        assert.deepEqual(keysWhere((s) => s.gates), ['maxmind', 'ipchecking']);
        for (const key of ['maxmind', 'ipchecking']) {
            for (const gate of IP_SOURCES.find((s) => s.key === key).gates) assert.equal(typeof gate, 'function');
        }
    });
});

describe('ipSourceFlags', () => {
    it('reports one false flag per configurable source when nothing is set', () => {
        assert.deepEqual(ipSourceFlags(), { ipinfoio: false, ipapiis: false, ip2locationio: false, ipChecking: false });
    });

    it('follows the env at call time', () => {
        process.env.IPINFO_API_TOKEN = 'legacy-token';
        process.env.IP2LOCATION_API_KEY = 'k';
        process.env.IPAPIIS_API_KEY = 'k';
        process.env['IPCHECKING_API' + '_KEY'] = 'k';
        assert.deepEqual(ipSourceFlags(), { ipinfoio: true, ipapiis: true, ip2locationio: true, ipChecking: false });
        process.env['IPCHECKING_API' + '_ENDPOINT'] = 'https://upstream.invalid';
        assert.equal(ipSourceFlags().ipChecking, true);
        delete process.env.IPINFO_API_TOKEN;
        process.env.IPINFO_API_KEY = 'k';
        assert.equal(ipSourceFlags().ipinfoio, true);
        delete process.env.IPINFO_API_KEY;
        assert.equal(ipSourceFlags().ipinfoio, false);
    });
});

describe('frontend IP_DATABASES match the registry', () => {
    const keyOfUrl = (url) => /^\/api\/([^/?]+)\?/.exec(url)?.[1];

    it('pairs each frontend row with one registry key, and each key with one row', () => {
        const rowKeys = IP_DATABASES.map((db) => keyOfUrl(db.url));
        for (const [i, key] of rowKeys.entries()) assert.ok(IP_SOURCE_KEYS.includes(key), IP_DATABASES[i].url);
        for (const key of IP_SOURCE_KEYS) assert.equal(rowKeys.filter((k) => k === key).length, 1, key);
    });

    it('gates a frontend row on the registry flag exactly when the source needs configuration', () => {
        for (const db of IP_DATABASES) {
            const source = IP_SOURCES.find((s) => s.key === keyOfUrl(db.url));
            assert.equal(db.configKey, source.isConfigured ? flagOf(source) : undefined, db.text);
        }
    });
});

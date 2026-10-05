// Tests for frontend/utils/features/ip-blocklist.js — the IP Blocklist Check's
// verdict, row split, row tone and reason-key lookup.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { blocklistVerdict, listedCounts, splitPart, itemTone, reasonMessage } from '../frontend/utils/features/ip-blocklist.js';

const en = JSON.parse(readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));

// The reason keys and categories /iphitlist can send, as the private API's
// docs list them (docs/ip-monitoring/hitlist.md §1.1-1.2 there).
const API_REASONS = [
    'socksProxy', 'httpProxy', 'proxyChain', 'webProxy', 'wingateProxy', 'openProxy', 'torExit',
    'exploited', 'compromisedHost', 'compromisedRouter', 'botnet', 'worm', 'ircDrone', 'ddosDrone', 'bottler', 'spambot',
    'bruteForce', 'spamSource', 'spamtrap', 'badReputation', 'hijackedNetwork',
    'endUserRange', 'dynamicRange', 'noMailRange', 'missingPtr', 'poorReputation', 'mixedReputation',
    'rangeListed', 'networkListed', 'unaccountableOperator', 'noMailService', 'unreliableAbuseDesk',
    'reported1d', 'reported7d', 'reported30d', 'reported90d',
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `feeds${n}`),
    'testEntry',
];
const API_CATEGORIES = ['spam', 'abuse', 'proxy', 'vpn', 'relay', 'tor', 'scanner', 'backscatter', 'mixed'];
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], en);

const summary = (listed, notice, abuse, anonymity) => ({
    listed, notice, clean: 0, error: 0, total: listed + notice, listedBy: { abuse, anonymity },
});

describe('blocklistVerdict', () => {
    it('a bad record outweighs everything else', () => {
        assert.equal(blocklistVerdict(summary(3, 1, 1, 2)), 'abuse');
    });

    it('anonymizer marks alone are not a bad record', () => {
        assert.equal(blocklistVerdict(summary(2, 1, 0, 2)), 'anonymity');
    });

    it('notices alone are advisory', () => {
        assert.equal(blocklistVerdict(summary(0, 2, 0, 0)), 'notice');
    });

    it('nothing listed is clean, as is a missing summary', () => {
        assert.equal(blocklistVerdict(summary(0, 0, 0, 0)), 'clean');
        assert.equal(blocklistVerdict(undefined), 'clean');
    });

    it('an answer without listedBy never reads a hit as clean', () => {
        assert.equal(blocklistVerdict({ listed: 1, notice: 0 }), 'abuse');
        assert.deepEqual(listedCounts({ listed: 3 }), { abuse: 3, anonymity: 0 });
    });
});

describe('splitPart', () => {
    it('keeps listed and notice rows open, folds clean and error, in order', () => {
        const results = [
            { id: 'a', status: 'listed' },
            { id: 'b', status: 'notice' },
            { id: 'c', status: 'error' },
            { id: 'd', status: 'clean' },
        ];
        const { hits, rest } = splitPart({ results });
        assert.deepEqual(hits.map((r) => r.id), ['a', 'b']);
        assert.deepEqual(rest.map((r) => r.id), ['c', 'd']);
    });

    it('a missing part has no rows', () => {
        assert.deepEqual(splitPart(null), { hits: [], rest: [] });
        assert.deepEqual(splitPart({ results: 'x' }), { hits: [], rest: [] });
    });
});

describe('itemTone', () => {
    it('follows kind for listings and stays advisory for notices', () => {
        assert.equal(itemTone({ status: 'listed', kind: 'abuse' }), 'abuse');
        assert.equal(itemTone({ status: 'listed', kind: 'anonymity' }), 'anonymity');
        assert.equal(itemTone({ status: 'notice', kind: 'abuse' }), 'notice');
    });

    it('clean and failed rows keep their own tone whatever their kind', () => {
        assert.equal(itemTone({ status: 'clean', kind: 'anonymity' }), 'clean');
        assert.equal(itemTone({ status: 'error', kind: 'abuse' }), 'error');
    });

    it('an unknown kind reads as abuse', () => {
        assert.equal(itemTone({ status: 'listed' }), 'abuse');
    });
});

describe('reasonMessage', () => {
    it('maps IPsum levels onto one parametrized key', () => {
        assert.deepEqual(reasonMessage('feeds5'), { key: 'ipblocklist.reason.feeds', params: { n: 5 } });
    });

    it('maps any other reason onto its own key', () => {
        assert.deepEqual(reasonMessage('socksProxy'), { key: 'ipblocklist.reason.socksProxy', params: {} });
        assert.deepEqual(reasonMessage('reported7d'), { key: 'ipblocklist.reason.reported7d', params: {} });
    });
});

describe('ip-blocklist copy (en)', () => {
    it('every reason the API sends has a label', () => {
        for (const reason of API_REASONS) {
            assert.equal(typeof lookup(reasonMessage(reason).key), 'string', reason);
        }
    });

    it('every list category has a label', () => {
        for (const category of API_CATEGORIES) {
            assert.equal(typeof en.ipblocklist.category[category], 'string', category);
        }
    });
});

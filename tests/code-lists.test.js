// Tests for the domain code lists (common/codes/), their frontend bridges
// and the code → i18n-key label maps: bridges re-export the very same lists,
// every code has a label in the en pack, and the IP card's line type keeps
// its labels and fallback.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import * as ipCodes from '../common/codes/ip.js';
import * as connectivityCodes from '../common/codes/connectivity.js';
import * as webrtcCodes from '../common/codes/webrtc.js';
import * as speedtestCodes from '../common/codes/speedtest.js';
import * as personaCodes from '../common/codes/persona.js';
import * as ipCodesBridge from '../frontend/utils/codes/ip.js';
import * as connectivityCodesBridge from '../frontend/utils/codes/connectivity.js';
import * as webrtcCodesBridge from '../frontend/utils/codes/webrtc.js';
import * as speedtestCodesBridge from '../frontend/utils/codes/speedtest.js';
import * as personaCodesBridge from '../frontend/utils/codes/persona.js';
import { VERDICT, AXIS, GRADE } from '../frontend/utils/persona/check-ids.js';
import { IP_TYPE_I18N_KEYS, IP_TYPE_UNKNOWN_KEY, ABUSE_LEVEL_I18N_KEYS } from '../frontend/utils/codes/ip-labels.js';
import { CONNECTIVITY_STATUS_KEYS } from '../frontend/utils/codes/connectivity-labels.js';
import { natTypeKey } from '../frontend/utils/codes/webrtc-labels.js';
import { extractAdvancedData } from '../frontend/utils/ip/transform-ip-data.js';

const en = JSON.parse(readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], en);

describe('code list bridges', () => {
    const pairs = [
        ['ip', ipCodes, ipCodesBridge],
        ['connectivity', connectivityCodes, connectivityCodesBridge],
        ['webrtc', webrtcCodes, webrtcCodesBridge],
        ['speedtest', speedtestCodes, speedtestCodesBridge],
        ['persona', personaCodes, personaCodesBridge],
    ];
    for (const [name, source, bridge] of pairs) {
        it(`${name}: re-exports every list as the same object`, () => {
            assert.deepEqual(Object.keys(bridge).sort(), Object.keys(source).sort());
            for (const key of Object.keys(source)) assert.equal(bridge[key], source[key], key);
        });
    }

    it('persona check-ids re-exports the shared enums', () => {
        assert.equal(VERDICT, personaCodes.PERSONA_VERDICT);
        assert.equal(AXIS, personaCodes.PERSONA_AXIS);
        assert.equal(GRADE, personaCodes.PERSONA_GRADE);
    });

    it('NAT type codes extend the ICE candidate types', () => {
        assert.deepEqual(webrtcCodes.NAT_TYPE_CODES.slice(0, webrtcCodes.ICE_CANDIDATE_TYPES.length),
            webrtcCodes.ICE_CANDIDATE_TYPES);
    });
});

describe('code label maps', () => {
    it('IP line types: one key per code, each in the en pack', () => {
        assert.deepEqual(Object.keys(IP_TYPE_I18N_KEYS).sort(), [...ipCodes.IP_TYPE_CODES].sort());
        for (const key of [...Object.values(IP_TYPE_I18N_KEYS), IP_TYPE_UNKNOWN_KEY]) {
            assert.equal(typeof lookup(key), 'string', key);
        }
    });

    it('abuse levels: one key per code, each in the en pack', () => {
        assert.deepEqual(Object.keys(ABUSE_LEVEL_I18N_KEYS), ipCodes.ABUSE_LEVELS);
        for (const code of ipCodes.ABUSE_LEVELS) {
            assert.equal(typeof lookup(ABUSE_LEVEL_I18N_KEYS[code]), 'string', code);
        }
    });

    it('connectivity statuses: one key per code, each in the en pack', () => {
        assert.deepEqual(Object.keys(CONNECTIVITY_STATUS_KEYS).sort(),
            Object.values(connectivityCodes.CONNECTIVITY_STATUS).sort());
        for (const key of Object.values(CONNECTIVITY_STATUS_KEYS)) assert.equal(typeof lookup(key), 'string', key);
    });

    it('NAT types: every code maps onto a key in the en pack', () => {
        assert.equal(natTypeKey('srflx'), 'webrtc.NATType.srflx');
        assert.equal(natTypeKey('unavailable'), 'webrtc.StatusUnavailable');
        assert.equal(natTypeKey('error'), 'webrtc.StatusError');
        for (const code of webrtcCodes.NAT_TYPE_CODES) assert.equal(typeof lookup(natTypeKey(code)), 'string', code);
    });
});

describe('IP card line type label', () => {
    const t = (key) => `<${key}>`;
    const typeOf = (operatorType) => extractAdvancedData({ tags: {}, operatorType, score: 50 }, t).type;

    it('labels each known type through the shared map', () => {
        assert.equal(typeOf('Business'), '<ipInfos.advancedData.type.Business>');
        assert.equal(typeOf('Residential'), '<ipInfos.advancedData.type.Residential>');
        assert.equal(typeOf('Wireless'), '<ipInfos.advancedData.type.Wireless>');
        assert.equal(typeOf('Hosting'), '<ipInfos.advancedData.type.Hosting>');
    });

    it('falls back to the unknown label, and passes gated sentinels through', () => {
        assert.equal(typeOf('Satellite'), '<ipInfos.advancedData.type.unknownType>');
        assert.equal(typeOf(undefined), '<ipInfos.advancedData.type.unknownType>');
        assert.equal(typeOf('hosting'), '<ipInfos.advancedData.type.unknownType>');
        assert.equal(typeOf('sign_in_required'), 'sign_in_required');
    });
});

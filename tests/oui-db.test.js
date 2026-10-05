// Tests for common/oui-db.js — parsing the IEEE MAC registries (CSV, the
// country read off the address) and the longest-assignment lookup behind
// /api/macchecker. Fixtures are written to a temp dir; the repo's
// common/oui-db/ is never read.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import {
    OUI_REGISTRIES, parseCsv, countryFromAddress, parseRegistry, readOuiRegistries, describeMac, macFlags,
} from '../common/oui-db.js';

const HEADER = 'Registry,Assignment,Organization Name,Organization Address';
const spec = (registry) => OUI_REGISTRIES.find((entry) => entry.registry === registry);

describe('parseCsv', () => {
    it('handles quoted commas, doubled quotes, CRLF and a missing final newline', () => {
        const text = 'a,"b, c","say ""hi"""\r\nd,,"multi\nline"';
        assert.deepEqual(parseCsv(text), [['a', 'b, c', 'say "hi"'], ['d', '', 'multi\nline']]);
    });
});

describe('countryFromAddress', () => {
    it('reads the code before the postal code', () => {
        assert.equal(countryFromAddress('80 West Tasman Drive San Jose CA US 94568'), 'US');
        assert.equal(countryFromAddress('No.388 Ning Qiao Road Shanghai CN 201206'), 'CN');
        assert.equal(countryFromAddress('The Pentagon Abingdon Oxfordshire GB OX14 3YP'), 'GB');
    });

    it('is not fooled by Dutch postcode letters that are country codes', () => {
        assert.equal(countryFromAddress('ESP 237 Eindhoven Noord-Brabant NL 5633 AD'), 'NL');
        assert.equal(countryFromAddress('High Tech Campus 27 Eindhoven NB NL 5656 AE'), 'NL');
    });

    it('takes a trailing code, or one before free-text postal fields', () => {
        assert.equal(countryFromAddress('STRATUMSED K31 THE NL'), 'NL');
        assert.equal(countryFromAddress('1006, Block A, HONG HK KONG'), 'HK');
        assert.equal(countryFromAddress('7F., 116, HOU-KANG ST., TAIWAN TAIWAN TW R.O.C.'), 'TW');
    });

    it('answers null when no country code is there', () => {
        assert.equal(countryFromAddress('VIA MACCANI, 169 ITALY'), null);
        assert.equal(countryFromAddress(''), null);
    });
});

describe('parseRegistry', () => {
    it('keeps rows of its own registry and length, with the country derived', () => {
        const text = `﻿${HEADER}\n`
            + 'MA-M,F040AF9,Raspberry Pi (Trading) Ltd,"Maurice Wilkes Building  Cambridge   GB CB4 0DS "\n'
            + 'MA-L,F040AF,Wrong Registry,\n'
            + 'MA-M,F040AF,Too Short,\n'
            + 'MA-M,F040AFZ,Not Hex,\n';
        assert.deepEqual(parseRegistry(text, spec('MA-M')), [['F040AF9', {
            registry: 'MA-M',
            company: 'Raspberry Pi (Trading) Ltd',
            address: 'Maurice Wilkes Building Cambridge GB CB4 0DS',
            country: 'GB',
        }]]);
    });

    it('refuses a file that is not an IEEE registry CSV', () => {
        assert.throws(() => parseRegistry('<html>Request Rejected</html>', spec('MA-L')), /unexpected CSV header/);
    });
});

describe('readOuiRegistries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myip-oui-test-'));
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    // `count` synthetic rows per registry, hex counting up from `base`.
    const writeRegistries = (dir, { short } = {}) => {
        fs.mkdirSync(dir, { recursive: true });
        for (const { registry, file, hexLength, min } of OUI_REGISTRIES) {
            const count = registry === short ? min - 1 : min;
            const rows = Array.from({ length: count }, (_, i) =>
                `${registry},${i.toString(16).toUpperCase().padStart(hexLength, '0')},Vendor ${i},Street City US 12345`);
            fs.writeFileSync(path.join(dir, file), `${HEADER}\n${rows.join('\n')}\n`);
        }
    };

    it('merges every registry into one map', () => {
        const dir = path.join(root, 'ok');
        writeRegistries(dir);
        const blocks = readOuiRegistries((file) => path.join(dir, file));
        assert.equal(blocks.get('0000000').registry, 'MA-M');
        assert.equal(blocks.get('000000000').registry, 'IAB', 'IAB is read after MA-S');
    });

    it('refuses a registry below its row floor, and a missing file', () => {
        const dir = path.join(root, 'short');
        writeRegistries(dir, { short: 'MA-S' });
        assert.throws(() => readOuiRegistries((file) => path.join(dir, file)), /MA-S has only \d+ assignments/);
        const partial = path.join(root, 'partial');
        writeRegistries(partial);
        fs.rmSync(path.join(partial, 'cid.csv'));
        assert.throws(() => readOuiRegistries((file) => path.join(partial, file)), /ENOENT/);
    });
});

describe('describeMac', () => {
    const block = (registry, company, address = '', country = null) => ({ registry, company, address, country });
    const blocks = new Map([
        ['F040AF', block('MA-L', 'IEEE Registration Authority', '445 Hoes Lane Piscataway NJ US 08554', 'US')],
        ['F040AF9', block('MA-M', 'Raspberry Pi (Trading) Ltd', 'Cambridge GB CB4 0DS', 'GB')],
        ['8C1F6434A', block('MA-S', 'Raspberry Pi (Trading) Ltd', 'Cambridge GB CB4 0DS', 'GB')],
        ['ACDE48', block('MA-L', 'Private')],
        ['EA2701', block('CID', 'ACCE Technology Corp.', 'Hsinchu City TW 300024', 'TW')],
        ['00005E', block('MA-L', 'ICANN, IANA Department', 'Los Angeles CA US 90094-2536', 'US')],
    ]);

    it('answers the longest assignment covering the address, with its range', () => {
        assert.deepEqual(describeMac(blocks, 'F040AF912345'), {
            success: true,
            found: true,
            macPrefix: 'F0:40:AF:9',
            company: 'Raspberry Pi (Trading) Ltd',
            address: 'Cambridge GB CB4 0DS',
            country: 'GB',
            blockStart: 'F0:40:AF:90:00:00',
            blockEnd: 'F0:40:AF:9F:FF:FF',
            blockSize: 1048576,
            blockType: 'MA-M',
            isPrivate: false,
            isMulticast: false,
            isUnicast: true,
            isLocal: false,
            isGlobal: true,
            isRand: false,
        });
        const small = describeMac(blocks, '8C1F6434A123');
        assert.equal(small.blockType, 'MA-S');
        assert.equal(small.blockSize, 4096);
        assert.equal(small.blockEnd, '8C:1F:64:34:AF:FF');
    });

    it('falls back to the parent prefix outside an assigned sub-block, and for a prefix too short to reach one', () => {
        assert.equal(describeMac(blocks, 'F040AF100000').company, 'IEEE Registration Authority');
        const prefix = describeMac(blocks, 'F040AF');
        assert.equal(prefix.blockType, 'MA-L');
        assert.equal(prefix.blockSize, 16777216);
        assert.equal(describeMac(blocks, 'F040AF9').blockType, 'MA-M');
    });

    it('marks a private registration, N/A for its blank address', () => {
        const result = describeMac(blocks, 'ACDE48001122');
        assert.equal(result.isPrivate, true);
        assert.equal(result.address, 'N/A');
        assert.equal(result.country, 'N/A');
    });

    it('answers an uncovered address with found: false and its flags', () => {
        const result = describeMac(blocks, '429FC3157AE0');
        assert.equal(result.found, false);
        assert.equal(result.macPrefix, '42:9F:C3');
        assert.equal(result.company, 'N/A');
        assert.equal(result.blockSize, 'N/A');
        assert.equal(result.isRand, true);
    });

    it('resolves a multicast address to the block it derives from, flags kept', () => {
        const result = describeMac(blocks, '01005E0000FB');
        assert.equal(result.company, 'ICANN, IANA Department');
        assert.equal(result.macPrefix, '00:00:5E');
        assert.equal(result.isMulticast, true);
    });

    it('matches a Company ID in locally administered space', () => {
        const result = describeMac(blocks, 'EA2701000000');
        assert.equal(result.blockType, 'CID');
        assert.equal(result.isLocal, true);
    });
});

describe('macFlags', () => {
    it('reads the multicast and locally administered bits of the first octet', () => {
        assert.deepEqual(macFlags('01005E'), { isMulticast: true, isUnicast: false, isLocal: false, isGlobal: true, isRand: false });
        assert.deepEqual(macFlags('020000'), { isMulticast: false, isUnicast: true, isLocal: true, isGlobal: false, isRand: true });
        assert.deepEqual(macFlags('030000'), { isMulticast: true, isUnicast: false, isLocal: true, isGlobal: false, isRand: false });
    });
});

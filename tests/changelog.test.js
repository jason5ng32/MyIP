// Test changelog.json format and content
// Verifies the format and content of changelog.json
// In case forgetting to update all locales, this test will fail.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import changelog from '../frontend/data/changelog.json' with { type: 'json' };

const REQUIRED_LOCALES = ['en', 'zh', 'fr', 'tr'];
const VALID_TYPES = new Set(['add', 'improve', 'fix']);

describe('changelog.json', () => {
    it('is a non-empty array', () => {
        assert.ok(Array.isArray(changelog), 'changelog root must be an array');
        assert.ok(changelog.length > 0, 'changelog must contain at least one version');
    });

    it('every version has { version, date, content[] }', () => {
        for (const v of changelog) {
            assert.equal(typeof v.version, 'string', `missing version string`);
            assert.match(v.version, /^v\d+\.\d+/, `version ${v.version} should look like "vX.Y"`);
            assert.equal(typeof v.date, 'string', `${v.version} missing date`);
            assert.ok(Array.isArray(v.content), `${v.version} content must be an array`);
            assert.ok(v.content.length > 0, `${v.version} content must be non-empty`);
        }
    });

    it('every content item has a valid type and a complete change object', () => {
        for (const v of changelog) {
            v.content.forEach((item, idx) => {
                const label = `${v.version} item#${idx}`;
                assert.ok(VALID_TYPES.has(item.type), `${label} type must be one of ${[...VALID_TYPES]}, got ${item.type}`);
                assert.equal(typeof item.change, 'object', `${label} change must be an object`);
                assert.ok(item.change !== null, `${label} change must not be null`);
                for (const lang of REQUIRED_LOCALES) {
                    assert.equal(typeof item.change[lang], 'string', `${label} missing ${lang} translation`);
                    assert.ok(item.change[lang].length > 0, `${label} ${lang} translation is empty`);
                }
            });
        }
    });

    it('locale files no longer carry changelog.versions (migrated to changelog.json)', () => {
        for (const lang of REQUIRED_LOCALES) {
            const pack = JSON.parse(fs.readFileSync(`frontend/locales/${lang}.json`, 'utf8'));
            assert.equal(pack.changelog?.versions, undefined,
                `${lang}.json still has changelog.versions — it should live only in changelog.json`);
            // UI chrome should still be present.
            for (const key of ['Title', 'add', 'improve', 'fix']) {
                assert.equal(typeof pack.changelog?.[key], 'string',
                    `${lang}.json lost changelog.${key} during migration`);
            }
        }
    });
});

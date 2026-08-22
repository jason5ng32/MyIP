// Tests for the pure half of scripts/i18n-scaffold.js — what `pnpm i18n-new`
// and `pnpm i18n-sync` write. The CLI shell (reading and writing files) is out
// of scope; everything that decides content is here.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    buildSkeleton,
    isChecklistDataKey,
    validateExtraPack,
    syncPack,
    nativeNameFor,
    flagFor,
    buildRegistryEntry,
    formatRegistryLine,
    insertRegistryLine,
    validateNewCode,
} from '../scripts/i18n-scaffold.js';
import { flattenPack } from '../common/locale-pack.js';
import { LOCALE_CODES } from '../common/locale-registry.js';

const en = JSON.parse(fs.readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));

describe('buildSkeleton', () => {
    it('keeps en\'s shape and blanks every string', () => {
        assert.deepEqual(buildSkeleton({ a: 'x', b: { c: 'y', d: ['p', 'q'] } }), { a: '', b: { c: '', d: ['', ''] } });
    });

    it('carries non-copy leaves over as they are', () => {
        assert.deepEqual(buildSkeleton({ n: 3, b: true, z: null }), { n: 3, b: true, z: null });
    });

    it('keeps the keys the caller claims as data', () => {
        const checklist = [{ title: 'Auth', slug: 'auth', checklist: [{ point: 'Use 2FA', priority: 'Essential' }] }];
        assert.deepEqual(buildSkeleton(checklist, isChecklistDataKey),
            [{ title: '', slug: 'auth', checklist: [{ point: '', priority: 'Essential' }] }]);
    });

    it('produces exactly en\'s key set — this is what the gate compares against', () => {
        const skeleton = flattenPack(buildSkeleton(en));
        assert.deepEqual([...skeleton.keys()], [...flattenPack(en).keys()]);
        assert.ok([...skeleton.values()].every((value) => value === ''));
    });
});

describe('syncPack', () => {
    it('adds en\'s new keys as "" and reports them', () => {
        const { pack, added } = syncPack({ a: 'x', fresh: 'new' }, { a: 'traduzido' });
        assert.deepEqual(pack, { a: 'traduzido', fresh: '' });
        assert.deepEqual(added, ['fresh']);
    });

    it('drops what en no longer has and reports that too', () => {
        const { pack, removed } = syncPack({ a: 'x' }, { a: 'traduzido', gone: 'stale' });
        assert.deepEqual(pack, { a: 'traduzido' });
        assert.deepEqual(removed, ['gone']);
    });

    it('reports nested paths, not bare key names', () => {
        const { added, removed } = syncPack({ deep: { fresh: 'new' } }, { deep: { gone: 'stale' } });
        assert.deepEqual(added, ['deep.fresh']);
        assert.deepEqual(removed, ['deep.gone']);
    });

    it('keeps an existing "" without calling it new', () => {
        const { pack, added } = syncPack({ a: 'x' }, { a: '' });
        assert.deepEqual(pack, { a: '' });
        assert.deepEqual(added, []);
    });

    it('takes en\'s key order, whatever order the pack was in', () => {
        const { pack } = syncPack({ first: 'a', second: 'b' }, { second: 'dois', first: 'um' });
        assert.deepEqual(Object.keys(pack), ['first', 'second']);
    });

    it('resizes arrays to en\'s length', () => {
        const { pack } = syncPack({ list: ['a', 'b', 'c'] }, { list: ['um', 'dois', 'tres', 'quatro'] });
        assert.deepEqual(pack.list, ['um', 'dois', 'tres']);
    });

    it('is a no-op on a pack that is already aligned', () => {
        const aligned = { a: 'traduzido', b: { c: '' } };
        const { pack, added, removed } = syncPack({ a: 'x', b: { c: 'y' } }, aligned);
        assert.deepEqual(pack, aligned);
        assert.deepEqual([...added, ...removed], []);
    });

    it('scaffolds a whole pack when there is nothing to sync yet', () => {
        const { pack } = syncPack({ a: 'x', b: { c: 'y' } }, {});
        assert.deepEqual(pack, buildSkeleton({ a: 'x', b: { c: 'y' } }));
    });
});

describe('validateExtraPack', () => {
    const ok = { registered: true, hasMainPack: true, exists: false };

    it('lets an optional dataset ride on a registered language', () => {
        assert.deepEqual(validateExtraPack('pt-BR', 'privacy/', ok), []);
    });

    it('sends an unknown language back to the plain i18n-new run', () => {
        for (const state of [{ ...ok, registered: false }, { ...ok, hasMainPack: false }]) {
            assert.match(validateExtraPack('pt-BR', 'privacy/', state)[0], /run `pnpm i18n-new pt-BR` first/);
        }
    });

    it('never writes over a file that is already there', () => {
        assert.match(validateExtraPack('pt-BR', 'privacy/', { ...ok, exists: true })[0], /already exists/);
    });
});

describe('registry entry', () => {
    it('names the language the way its own speakers write it', () => {
        assert.equal(nativeNameFor('pt-BR'), 'Português (Brasil)');
        assert.equal(nativeNameFor('fr'), 'Français');
    });

    it('takes the flag from the region, then from the known list', () => {
        assert.deepEqual(flagFor('pt-BR'), { flag: 'br', guessed: true });
        assert.deepEqual(flagFor('ja'), { flag: 'jp', guessed: true });
        assert.deepEqual(flagFor('xh'), { flag: 'xh', guessed: false });
    });

    it('formats a line the registry file can take verbatim', () => {
        assert.equal(
            formatRegistryLine(buildRegistryEntry('pt-BR')),
            "    { code: 'pt-BR', nativeName: 'Português (Brasil)', flag: 'br', apiTag: 'pt-BR', htmlLang: 'pt-BR', status: 'beta' },",
        );
    });

    it('starts every new locale as beta, with the code as its own tags', () => {
        const entry = buildRegistryEntry('sv');
        assert.equal(entry.status, 'beta');
        assert.equal(entry.apiTag, 'sv');
        assert.equal(entry.htmlLang, 'sv');
    });

    it('inserts the line as the last entry of LOCALES', () => {
        const source = 'export const LOCALES = [\n    { code: \'en\' },\n];\n\nexport const OTHER = [\n];\n';
        const inserted = insertRegistryLine(source, '    { code: \'sv\' },');
        assert.equal(inserted, 'export const LOCALES = [\n    { code: \'en\' },\n    { code: \'sv\' },\n];\n\nexport const OTHER = [\n];\n');
    });

    it('refuses to guess when the registry doesn\'t look like itself', () => {
        assert.throws(() => insertRegistryLine('const NOPE = [];', '    {}'), /LOCALES/);
    });
});

describe('validateNewCode', () => {
    it('accepts a plain language, a region variant and a script variant', () => {
        for (const code of ['sv', 'pt-BR', 'sr-Latn']) {
            assert.deepEqual(validateNewCode(code, ['en']).errors, [], code);
        }
    });

    it('rejects anything that isn\'t a locale code', () => {
        for (const code of ['Klingon', 'PT', 'pt_BR', 'p', 'pt-br', '']) {
            assert.equal(validateNewCode(code, ['en']).errors.length, 1, code);
        }
    });

    it('rejects a code already in the registry', () => {
        assert.match(validateNewCode('en', LOCALE_CODES).errors[0], /already registered/);
    });

    it('warns — but does not refuse — on the first regional pack of a family', () => {
        const first = validateNewCode('pt-BR', ['en']);
        assert.deepEqual(first.errors, []);
        assert.match(first.warnings[0], /takes the bare code/);
        // Once the family is on the registry, a sibling is unremarkable.
        assert.deepEqual(validateNewCode('pt-PT', ['en', 'pt-BR']).warnings, []);
    });

    it('warns when it has no flag to offer', () => {
        assert.match(validateNewCode('xh', ['en']).warnings.at(-1), /no flag known/);
    });
});

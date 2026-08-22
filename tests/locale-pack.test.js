// Tests for common/locale-pack.js — the empty-value convention's runtime half.
// vite.config.js runs every locale pack through stripPack() on the way into
// the bundle, so these rules decide what an untranslated string does in the
// app: nothing at all, leaving the key to the i18n fallback chain.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { flattenPack, isUntranslated, stripUntranslated, stripPack } from '../common/locale-pack.js';

describe('flattenPack', () => {
    it('walks objects and arrays down to their leaves', () => {
        const flat = flattenPack({ a: 'x', b: { c: 'y' }, d: ['p', 'q'] });
        assert.deepEqual([...flat], [['a', 'x'], ['b.c', 'y'], ['d.0', 'p'], ['d.1', 'q']]);
    });
});

describe('isUntranslated', () => {
    it('is an empty or whitespace-only string, nothing else', () => {
        assert.equal(isUntranslated(''), true);
        assert.equal(isUntranslated('   '), true);
        assert.equal(isUntranslated('x'), false);
        assert.equal(isUntranslated(0), false);
        assert.equal(isUntranslated(null), false);
        assert.equal(isUntranslated(undefined), false);
    });
});

describe('stripUntranslated', () => {
    it('drops empty leaves and keeps translated ones', () => {
        assert.deepEqual(stripUntranslated({ a: 'x', b: '' }), { a: 'x' });
    });

    it('drops a branch that ends up with nothing in it', () => {
        assert.equal(stripUntranslated({ a: '', b: { c: '' } }), undefined);
        assert.deepEqual(stripUntranslated({ a: 'x', b: { c: '' } }), { a: 'x' });
    });

    it('takes arrays all or nothing — a hole would shift the rest', () => {
        assert.deepEqual(stripUntranslated(['p', 'q']), ['p', 'q']);
        assert.equal(stripUntranslated(['p', '']), undefined);
        assert.deepEqual(stripUntranslated({ list: ['p', ''], a: 'x' }), { a: 'x' });
    });

    it('leaves non-copy leaves alone', () => {
        assert.deepEqual(stripUntranslated({ n: 0, b: false, z: null, s: '' }), { n: 0, b: false, z: null });
    });

    it('copies rather than mutates', () => {
        const source = { a: 'x', b: '' };
        stripUntranslated(source);
        assert.deepEqual(source, { a: 'x', b: '' });
    });
});

describe('stripPack', () => {
    it('never hands back undefined — an untranslated pack is an empty one', () => {
        assert.deepEqual(stripPack({ a: '', b: { c: '' } }), {});
        assert.deepEqual(stripPack(['', '']), []);
    });

    it('is the identity for a fully translated pack', () => {
        const pack = { a: 'x', b: { c: 'y' }, d: ['p', 'q'] };
        assert.deepEqual(stripPack(pack), pack);
    });
});

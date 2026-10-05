// resolveLegacyToolLink() — the router redirect that sends the drawer-era
// `/?tool=<slug>` links to the tool's /tools/<slug> page.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveLegacyToolLink } from '../frontend/utils/legacy-tool-link.js';

describe('resolveLegacyToolLink()', () => {
    it('sends a known slug to its page', () => {
        assert.deepEqual(resolveLegacyToolLink({ path: '/', query: { tool: 'whois' } }),
            { path: '/tools/whois', query: {} });
    });

    it('keeps the other query params and the hash', () => {
        assert.deepEqual(
            resolveLegacyToolLink({ path: '/', query: { tool: 'asn', q: 'AS13335', utm_source: 'x' }, hash: '#top' }),
            { path: '/tools/asn', query: { q: 'AS13335', utm_source: 'x' }, hash: '#top' },
        );
    });

    it('drops an unknown slug and stays on the homepage', () => {
        assert.deepEqual(resolveLegacyToolLink({ path: '/', query: { tool: 'nope', x: '1' } }),
            { path: '/', query: { x: '1' } });
    });

    it('treats a repeated, empty or valueless param as unknown', () => {
        for (const tool of [['whois', 'asn'], ['whois'], '', null, undefined]) {
            assert.deepEqual(resolveLegacyToolLink({ path: '/', query: { tool } }),
                { path: '/', query: {} }, String(tool));
        }
    });

    it('leaves a homepage URL without the param alone', () => {
        assert.equal(resolveLegacyToolLink({ path: '/', query: {} }), null);
        assert.equal(resolveLegacyToolLink({ path: '/', query: { q: 'AS13335' } }), null);
        assert.equal(resolveLegacyToolLink({ path: '/' }), null);
    });

    it('leaves every other path alone', () => {
        assert.equal(resolveLegacyToolLink({ path: '/tools/whois', query: { tool: 'asn' } }), null);
        assert.equal(resolveLegacyToolLink({ path: '/privacy', query: { tool: 'whois' } }), null);
    });

    it('survives a missing argument', () => {
        assert.equal(resolveLegacyToolLink(), null);
    });
});

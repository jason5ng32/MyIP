// Specs for common/upstream-ua.js — the backend User-Agent bootstrap.
// Asserts the `MyIP/v<version>/<site>` format and its graceful degradation
// when VITE_SITE_URL is absent. Version is read from the real package.json,
// so the assertions match on shape rather than a hardcoded number.

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { initUpstreamUserAgent } from '../common/upstream-ua.js';
import { setUpstreamUserAgent } from '../common/fetch-with-timeout.js';

const ORIGINAL_SITE_URL = process.env.VITE_SITE_URL;

describe('initUpstreamUserAgent()', () => {
    afterEach(() => {
        if (ORIGINAL_SITE_URL === undefined) {
            delete process.env.VITE_SITE_URL;
        } else {
            process.env.VITE_SITE_URL = ORIGINAL_SITE_URL;
        }
        setUpstreamUserAgent(null);
    });

    it('builds MyIP/v<version>/<site> from package.json and VITE_SITE_URL', () => {
        process.env.VITE_SITE_URL = 'https://example.test';
        const ua = initUpstreamUserAgent();
        assert.match(ua, /^MyIP\/v\d+\.\d+\.\d+\/https:\/\/example\.test$/);
    });

    it('drops the site segment when VITE_SITE_URL is unset', () => {
        delete process.env.VITE_SITE_URL;
        const ua = initUpstreamUserAgent();
        assert.match(ua, /^MyIP\/v\d+\.\d+\.\d+$/);
    });

    it('ignores a whitespace-only VITE_SITE_URL', () => {
        process.env.VITE_SITE_URL = '   ';
        const ua = initUpstreamUserAgent();
        assert.match(ua, /^MyIP\/v\d+\.\d+\.\d+$/);
    });
});

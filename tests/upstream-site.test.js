// Tests for frontend/utils/upstream-site.js — the hostname check behind the
// footer credit line and the IP probes' JSON endpoint.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UPSTREAM_HOSTNAMES, isUpstreamSite } from '../frontend/utils/upstream-site.js';

describe('isUpstreamSite', () => {
    it('accepts each upstream hostname', () => {
        assert.equal(UPSTREAM_HOSTNAMES.length, 5);
        for (const hostname of UPSTREAM_HOSTNAMES) {
            assert.equal(isUpstreamSite(hostname), true, hostname);
        }
    });

    it('rejects other deployments, lookalikes and an empty hostname', () => {
        for (const hostname of ['localhost', '127.0.0.1', 'example.com', 'ipcheck.ing.example.com', 'fork.ipcheck.ing', 'notipcheck.ing', '']) {
            assert.equal(isUpstreamSite(hostname), false, hostname);
        }
    });

    it('reads location.hostname by default and is false without a DOM', () => {
        assert.equal(globalThis.location, undefined);
        assert.equal(isUpstreamSite(), false);
    });
});

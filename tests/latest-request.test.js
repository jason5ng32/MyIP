// Guards frontend/utils/latest-request.js — latest-wins sequencing behind
// QueryIPDialog: a newer start or a cancel supersedes a call in flight, and
// pendingKey tracks only the current one.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createLatestRequest } from '../frontend/utils/latest-request.js';

describe('latest-request', () => {
    it('a newer start supersedes the call in flight', () => {
        const request = createLatestRequest();
        const a = request.start('1.1.1.1');
        assert.equal(request.pendingKey(), '1.1.1.1');
        const b = request.start('8.8.8.8');
        assert.equal(a.isCurrent(), false);
        assert.equal(b.isCurrent(), true);
        assert.equal(request.pendingKey(), '8.8.8.8');
    });

    it('a superseded call settling leaves the newer one pending', () => {
        const request = createLatestRequest();
        const a = request.start('1.1.1.1');
        const b = request.start('8.8.8.8');
        a.done();
        assert.equal(request.pendingKey(), '8.8.8.8');
        b.done();
        assert.equal(request.pendingKey(), null);
        assert.equal(b.isCurrent(), true);
    });

    it('cancel supersedes without starting anything', () => {
        const request = createLatestRequest();
        const a = request.start('1.1.1.1');
        request.cancel();
        assert.equal(a.isCurrent(), false);
        assert.equal(request.pendingKey(), null);
    });

    it('drops a late answer to an earlier call (open A, then B)', async () => {
        const request = createLatestRequest();
        let shown = null;
        const fetchFor = async (ip, delay) => {
            const call = request.start(ip);
            await new Promise((resolve) => setTimeout(resolve, delay));
            if (!call.isCurrent()) return;
            shown = ip;
            call.done();
        };
        const slowA = fetchFor('1.1.1.1', 20);
        const fastB = fetchFor('8.8.8.8', 1);
        await Promise.all([slowA, fastB]);
        assert.equal(shown, '8.8.8.8');
        assert.equal(request.pendingKey(), null);
    });
});

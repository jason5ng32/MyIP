// Tests for server/listen-callback.js — the app.listen() callback: the ready
// line on success, an error log plus exit(1) on a failed bind.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createListenCallback } from '../server/listen-callback.js';

// Stub logger and exit that record every call.
const setup = () => {
    const calls = { info: [], error: [], exit: [] };
    const logger = {
        info: (...args) => calls.info.push(args),
        error: (...args) => calls.error.push(args),
    };
    const exit = (code) => calls.exit.push(code);
    return { calls, callback: createListenCallback({ port: 11966, logger, exit }) };
};

describe('createListenCallback', () => {
    it('logs the ready line and does not exit without an error', () => {
        const { calls, callback } = setup();
        callback();
        assert.deepEqual(calls.info, [['🚀 Backend server ready on http://localhost:11966']]);
        assert.equal(calls.error.length, 0);
        assert.equal(calls.exit.length, 0);
    });

    it('names EADDRINUSE and exits with 1 when the port is taken', () => {
        const { calls, callback } = setup();
        const err = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
        callback(err);
        assert.equal(calls.error.length, 1);
        const [ctx, message] = calls.error[0];
        assert.equal(ctx.err, err);
        assert.equal(ctx.port, 11966);
        assert.match(message, /in use/);
        assert.match(message, /EADDRINUSE/);
        assert.deepEqual(calls.exit, [1]);
        assert.equal(calls.info.length, 0);
    });

    it('logs any other listen error and exits with 1', () => {
        const { calls, callback } = setup();
        const err = Object.assign(new Error('listen EACCES'), { code: 'EACCES' });
        callback(err);
        assert.equal(calls.error.length, 1);
        const [ctx, message] = calls.error[0];
        assert.equal(ctx.err, err);
        assert.equal(ctx.port, 11966);
        assert.match(message, /failed to listen/);
        assert.doesNotMatch(message, /in use/);
        assert.deepEqual(calls.exit, [1]);
    });
});

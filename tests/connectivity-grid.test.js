// Tests for frontend/utils/features/connectivity-grid.js — the grid
// publisher behind `connectivity:finished`: the whole grid on every publish,
// `settled` only with nothing in flight and no round left, and one settled
// re-publish for a grid last published unsettled.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { connectivityTargets, isGridSettled, createGridPublisher } from '../frontend/utils/features/connectivity-grid.js';

const test = (id, fields = {}) => ({ id, name: id, url: `https://${id}.example`, status: 'label', statusCode: 'ok', time: 40, mintime: 30, roundResults: [], ...fields });

const setup = (tests = [test('google'), test('custom-1')]) => {
    const events = [];
    const grid = createGridPublisher({ readTests: () => tests, emit: (payload) => events.push(payload) });
    return { grid, events, tests };
};

describe('connectivity grid — payload', () => {
    it('maps every test to its target row, in grid order', () => {
        assert.deepEqual(connectivityTargets([test('google'), test('custom-1', { statusCode: undefined, time: 0, mintime: 0 })]), [
            { id: 'google', name: 'google', custom: false, statusCode: 'ok', time: 40, mintime: 30 },
            { id: 'custom-1', name: 'custom-1', custom: true, statusCode: undefined, time: 0, mintime: 0 },
        ]);
    });

    it('publishes the live grid at publish time', () => {
        const { grid, events, tests } = setup();
        tests.splice(1, 1);
        grid.publish();
        assert.deepEqual(events.map((e) => e.targets.map((row) => row.id)), [['google']]);
    });
});

describe('connectivity grid — settled', () => {
    it('is settled only with nothing in flight and no round left', () => {
        assert.equal(isGridSettled({ inFlight: 0, roundsLeft: false }), true);
        assert.equal(isGridSettled({ inFlight: 1, roundsLeft: false }), false);
        assert.equal(isGridSettled({ inFlight: 0, roundsLeft: true }), false);
    });

    it('counts requests in flight, never below zero', () => {
        const { grid } = setup();
        grid.requestStarted();
        grid.requestStarted();
        grid.requestFinished();
        assert.equal(grid.settled(), false);
        grid.requestFinished();
        assert.equal(grid.settled(), true);
        grid.requestFinished();
        grid.requestStarted();
        assert.equal(grid.settled(), false, 'an extra finish does not hide a later start');
    });

    it('single pass: published settled once every request landed', () => {
        const { grid, events } = setup();
        grid.requestStarted();
        grid.requestStarted();
        grid.requestFinished();
        grid.requestFinished();
        grid.publish();
        assert.deepEqual(events.map((e) => e.settled), [true]);
    });

    it('multi-round: unsettled while rounds are left, settled on the final round', () => {
        const { grid, events } = setup();
        grid.setRoundsLeft(true);
        grid.publish(); // round 1
        grid.publish(); // round 2
        grid.setRoundsLeft(false); // final count reached before the pass publishes
        grid.publish();
        assert.deepEqual(events.map((e) => e.settled), [false, false, true]);
    });

    it('a pass ending under a card test in flight publishes unsettled; the card publishes settled', () => {
        const { grid, events } = setup();
        grid.requestStarted(); // card test
        grid.publish(); // pass end
        grid.requestFinished();
        grid.publish(); // card test landed
        assert.deepEqual(events.map((e) => e.settled), [false, true]);
    });
});

describe('connectivity grid — settleIfIdle', () => {
    it('re-publishes a grid left unsettled once nothing is left to run', () => {
        const { grid, events } = setup();
        grid.setRoundsLeft(true);
        grid.publish();
        grid.requestStarted();
        grid.setRoundsLeft(false); // loop stopped by a card click
        grid.settleIfIdle();
        assert.equal(events.length, 1, 'still in flight: nothing yet');
        grid.requestFinished();
        grid.settleIfIdle(); // a superseded pass ends
        assert.deepEqual(events.map((e) => e.settled), [false, true]);
        grid.settleIfIdle();
        assert.equal(events.length, 2, 'already settled: no repeat');
    });

    it('loop stopped with nothing in flight: one settled publish', () => {
        const { grid, events } = setup();
        grid.setRoundsLeft(true);
        grid.publish();
        grid.setRoundsLeft(false);
        grid.settleIfIdle();
        assert.deepEqual(events.map((e) => e.settled), [false, true]);
    });

    it('never publishes before anything was published, nor while rounds are left', () => {
        const { grid, events } = setup();
        grid.settleIfIdle();
        grid.setRoundsLeft(true);
        grid.publish();
        grid.settleIfIdle();
        assert.deepEqual(events.map((e) => e.settled), [false]);
    });
});

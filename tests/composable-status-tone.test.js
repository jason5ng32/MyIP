// Tests for ipFieldTone — the unified "status string → tone" mapping that
// WebRtcTest / DnsLeaksTest / RuleTest / ConnectivityTest all use.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ipFieldTone, useStatusTone } from '../frontend/composables/use-status-tone.js';

describe('ipFieldTone()', () => {
  it('returns "wait" when value equals the wait label', () => {
    assert.equal(ipFieldTone('Waiting', { waitLabels: 'Waiting', errorLabels: 'Error' }), 'wait');
  });

  it('returns "fail" when value equals the error label', () => {
    assert.equal(ipFieldTone('Error', { waitLabels: 'Waiting', errorLabels: 'Error' }), 'fail');
  });

  it('accepts arrays of wait/error labels', () => {
    const opts = { waitLabels: ['W1', 'W2'], errorLabels: ['E1', 'E2'] };
    assert.equal(ipFieldTone('W2', opts), 'wait');
    assert.equal(ipFieldTone('E1', opts), 'fail');
  });

  it('returns "ok-fast" for an IPv4-shaped value (default success predicate)', () => {
    assert.equal(ipFieldTone('192.168.1.1', { waitLabels: 'W', errorLabels: 'E' }), 'ok-fast');
  });

  it('returns "ok-fast" for an IPv6-shaped value (default success predicate)', () => {
    assert.equal(ipFieldTone('2001:db8::1', { waitLabels: 'W', errorLabels: 'E' }), 'ok-fast');
  });

  it('falls back to "wait" for unrecognized non-IP strings', () => {
    assert.equal(ipFieldTone('hello', { waitLabels: 'W', errorLabels: 'E' }), 'wait');
  });

  it('splits success into ok-fast vs ok-slow when time is a number', () => {
    const opts = { waitLabels: 'W', errorLabels: 'E' };
    assert.equal(ipFieldTone('1.2.3.4', { ...opts, time: 150 }), 'ok-fast');
    assert.equal(ipFieldTone('1.2.3.4', { ...opts, time: 350 }), 'ok-slow');
  });

  it('respects a custom fastMs cutoff', () => {
    const opts = { waitLabels: 'W', errorLabels: 'E', fastMs: 100 };
    assert.equal(ipFieldTone('1.2.3.4', { ...opts, time: 80 }), 'ok-fast');
    assert.equal(ipFieldTone('1.2.3.4', { ...opts, time: 150 }), 'ok-slow');
  });

  it('uses a custom isSuccess predicate (ConnectivityTest-style)', () => {
    // ConnectivityTest: status string like "Available (123ms)" includes an
    // "Available" label rather than being IP-shaped.
    const opts = {
      waitLabels: 'Waiting',
      errorLabels: ['Unavailable', 'Timeout'],
      isSuccess: (s) => s.includes('Available'),
      time: 80,
      fastMs: 200,
    };
    assert.equal(ipFieldTone('Available (80ms)', opts), 'ok-fast');
    assert.equal(ipFieldTone('Available (500ms)', { ...opts, time: 500 }), 'ok-slow');
    assert.equal(ipFieldTone('Waiting', opts), 'wait');
    assert.equal(ipFieldTone('Timeout', opts), 'fail');
  });

  it('is resilient to non-string values', () => {
    assert.equal(ipFieldTone(undefined, { waitLabels: 'W', errorLabels: 'E' }), 'wait');
    assert.equal(ipFieldTone(null, { waitLabels: 'W', errorLabels: 'E' }), 'wait');
  });
});

describe('useStatusTone() (existing contract still holds)', () => {
  it('dotClass maps tones to bg-* classes', () => {
    const { dotClass } = useStatusTone();
    assert.equal(dotClass('wait'), 'bg-info');
    assert.equal(dotClass('ok-fast'), 'bg-success');
    assert.equal(dotClass('ok-slow'), 'bg-warning');
    assert.equal(dotClass('fail'), 'bg-destructive');
    // unknown tone falls back to wait
    assert.equal(dotClass('bogus'), 'bg-info');
  });
});

import assert from 'node:assert/strict';
import { describe, it, afterEach, beforeEach } from 'node:test';

import { refererCheck } from '../common/referer-check.js';

// 每条用例前备份 ALLOWED_DOMAINS，用完恢复
let backup;
beforeEach(() => { backup = process.env.ALLOWED_DOMAINS; });
afterEach(() => {
  if (backup === undefined) delete process.env.ALLOWED_DOMAINS;
  else process.env.ALLOWED_DOMAINS = backup;
});

describe('refererCheck — base cases', () => {
  it('returns false for missing referer', () => {
    assert.equal(refererCheck(), false);
    assert.equal(refererCheck(undefined), false);
    assert.equal(refererCheck(null), false);
  });

  it('returns false for empty string referer', () => {
    // Falsy short-circuit: not a URL parse attempt, just false
    assert.equal(refererCheck(''), false);
  });

  it('always whitelists localhost regardless of ALLOWED_DOMAINS', () => {
    delete process.env.ALLOWED_DOMAINS;
    assert.equal(refererCheck('http://localhost/'), true);
    assert.equal(refererCheck('http://localhost:5173/tools'), true);
    assert.equal(refererCheck('https://localhost:443/'), true);
  });
});

describe('refererCheck — ALLOWED_DOMAINS parsing', () => {
  it('accepts a single configured domain', () => {
    process.env.ALLOWED_DOMAINS = 'example.com';
    assert.equal(refererCheck('https://example.com/'), true);
    assert.equal(refererCheck('https://example.com/sub/path?q=1'), true);
  });

  it('accepts any of several comma-separated domains', () => {
    process.env.ALLOWED_DOMAINS = 'a.com,b.net,c.org';
    assert.equal(refererCheck('https://a.com/'), true);
    assert.equal(refererCheck('https://b.net/'), true);
    assert.equal(refererCheck('https://c.org/'), true);
  });

  it('rejects subdomains that are not explicitly listed', () => {
    // Current implementation uses exact hostname match, not suffix match
    process.env.ALLOWED_DOMAINS = 'example.com';
    assert.equal(refererCheck('https://sub.example.com/'), false);
  });

  it('rejects look-alike / unknown domains', () => {
    process.env.ALLOWED_DOMAINS = 'example.com';
    assert.equal(refererCheck('https://example.net/'), false);
    assert.equal(refererCheck('https://evil.example.com.attacker.xyz/'), false);
  });

  it('trims URL properly (hostname extraction ignores port, path, query)', () => {
    process.env.ALLOWED_DOMAINS = 'example.com';
    assert.equal(refererCheck('https://example.com:8443/deep/path?x=1#frag'), true);
  });

  it('treats unset ALLOWED_DOMAINS as "only localhost allowed"', () => {
    delete process.env.ALLOWED_DOMAINS;
    assert.equal(refererCheck('https://example.com/'), false);
    assert.equal(refererCheck('http://localhost/'), true);
  });

  it('empty ALLOWED_DOMAINS still permits localhost', () => {
    process.env.ALLOWED_DOMAINS = '';
    assert.equal(refererCheck('http://localhost/'), true);
    assert.equal(refererCheck('https://example.com/'), false);
  });
});

describe('refererCheck — malformed inputs', () => {
  it('throws on non-URL strings (caller must catch)', () => {
    // URL constructor throws on garbage; current code doesn't try/catch.
    // Documenting the behavior so callers know to validate upstream.
    assert.throws(() => refererCheck('not-a-url'));
  });
});

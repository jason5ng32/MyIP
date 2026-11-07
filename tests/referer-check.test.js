import assert from 'node:assert/strict';
import { describe, it, afterEach, beforeEach } from 'node:test';

import { refererCheck, refererHostname, inspectAllowedDomains } from '../server/referer-check.js';

// backup ALLOWED_DOMAINS before each test, restore after each test
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
  it('returns false on non-URL strings instead of throwing', () => {
    // Scanners send garbage Referer headers; parse failure means denial,
    // not an exception bubbling up to a 500.
    assert.equal(refererCheck('not-a-url'), false);
    assert.equal(refererCheck('http://'), false);
    assert.equal(refererCheck('%%%'), false);
  });
});

describe('refererHostname', () => {
  it('returns the hostname, or null for a missing or unparseable Referer', () => {
    assert.equal(refererHostname('https://Ip.Example.com:8443/x?y=1'), 'ip.example.com');
    assert.equal(refererHostname(undefined), null);
    assert.equal(refererHostname(''), null);
    assert.equal(refererHostname('not-a-url'), null);
  });
});

describe('inspectAllowedDomains', () => {
  it('lists the entries and ignores empty ones', () => {
    assert.deepEqual(inspectAllowedDomains('a.com,,192.168.1.10,'), {
      domains: ['a.com', '192.168.1.10'],
      problems: [],
    });
    assert.deepEqual(inspectAllowedDomains(undefined), { domains: [], problems: [] });
    assert.deepEqual(inspectAllowedDomains(''), { domains: [], problems: [] });
  });

  it('flags entries no Referer hostname can ever equal', () => {
    const { problems } = inspectAllowedDomains('a.com, b.com,https://c.com,d.com/x,e.com:8080,F.com');
    assert.deepEqual(problems.map((p) => p.entry), [' b.com', 'https://c.com', 'd.com/x', 'e.com:8080', 'F.com']);
    // Each flagged entry really is rejected by refererCheck.
    process.env.ALLOWED_DOMAINS = 'a.com, b.com,https://c.com,d.com/x,e.com:8080,F.com';
    for (const host of ['b.com', 'c.com', 'd.com', 'e.com', 'f.com']) {
      assert.equal(refererCheck(`https://${host}/`), false, host);
    }
    assert.equal(refererCheck('https://a.com/'), true);
  });

  it('does not flag IPv6 literals as ports', () => {
    assert.deepEqual(inspectAllowedDomains('[2001:db8::1]').problems, []);
  });
});

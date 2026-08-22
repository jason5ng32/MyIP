# Security Policy

## Supported versions

Only the latest release gets security fixes. Older tags are not patched — if you
self-host, upgrade before reporting.

## Reporting a vulnerability

**Report privately, not through a public issue.** Use GitHub's private reporting form:

**[Report a vulnerability →](https://github.com/jason5ng32/MyIP/security/advisories/new)**

It's visible only to the maintainer, and it's the right channel even if you're unsure
whether what you found is a real issue.

Helpful things to include:

- What an attacker can do with it, and what they'd need to start (a session? just a URL?).
- Steps to reproduce — a request, a payload, or a short script.
- Where the problem lives: front-end (`frontend/`), API handler (`api/`), or shared
  code (`common/`).
- Whether you hit it on [ipcheck.ing](https://ipcheck.ing) or your own deployment, and
  the version if self-hosted.

## What to expect

- An acknowledgement within a few days.
- A fix in the next release once it's confirmed, or an explanation if it turns out to be
  out of scope.
- Credit in the release notes and the advisory, unless you'd rather stay anonymous.

Please hold off on public disclosure until a fix ships.

## Out of scope

- **Findings against [ipcheck.ing](https://ipcheck.ing) infrastructure** rather than this
  codebase — rate limits, TLS configuration, DNS, hosting. Report those the same way, but
  they aren't code issues.
- **Third-party data providers.** MyIP queries external IP-geolocation and network APIs;
  their vulnerabilities belong to them.
- **Automated scanner output** with no working proof of concept.
- **Missing optional hardening in a self-hosted instance.** `ALLOWED_DOMAINS` and the
  other environment settings are documented in the
  [Developer Guide](https://docs.ipcheck.ing/developer) — an instance running without them
  is misconfigured, not vulnerable.

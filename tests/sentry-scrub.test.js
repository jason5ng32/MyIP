// Specs for server/sentry-scrub.js — the pure helpers that redact API-key
// params from backend Sentry telemetry while keeping the rest of the
// query (e.g. ?ip=) as debugging context.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { redactQueryString, redactUrlQuery, scrubBreadcrumb, scrubEventRequest, scrubSpan } from '../server/sentry-scrub.js';

describe('redactQueryString', () => {
    it('redacts sensitive params and keeps the rest', () => {
        assert.equal(
            redactQueryString('q=1.2.3.4&key=secret&lang=en'),
            'q=1.2.3.4&key=[redacted]&lang=en'
        );
    });

    it('matches sensitive names case-insensitively and with separators', () => {
        assert.equal(
            redactQueryString('API_KEY=abc&Token=t&api-key=x'),
            'API_KEY=[redacted]&Token=[redacted]&api-key=[redacted]'
        );
    });

    it('leaves valueless pairs and non-strings untouched', () => {
        assert.equal(redactQueryString('flag&ip=1.2.3.4'), 'flag&ip=1.2.3.4');
        assert.equal(redactQueryString(undefined), undefined);
    });

    it('redacts the first param even with a leading question mark', () => {
        assert.equal(
            redactQueryString('?key=secret&ip=8.8.8.8&lang=en'),
            '?key=[redacted]&ip=8.8.8.8&lang=en'
        );
    });
});

describe('redactUrlQuery', () => {
    it('redacts only the key param in a full URL', () => {
        assert.equal(
            redactUrlQuery('https://api.example.com/geo?q=1.2.3.4&key=secret'),
            'https://api.example.com/geo?q=1.2.3.4&key=[redacted]'
        );
    });

    it('works on relative targets', () => {
        assert.equal(
            redactUrlQuery('/ipinfo?key=secret&ip=1.2.3.4'),
            '/ipinfo?key=[redacted]&ip=1.2.3.4'
        );
    });

    it('leaves query-less URLs and non-strings untouched', () => {
        assert.equal(redactUrlQuery('https://example.com/path'), 'https://example.com/path');
        assert.equal(redactUrlQuery(42), 42);
    });
});

describe('scrubBreadcrumb', () => {
    it('redacts the key in http breadcrumb URLs, keeps other data', () => {
        const crumb = { data: { url: 'https://api.example.com/geo?q=1.2.3.4&key=secret', status_code: 502 } };
        assert.equal(scrubBreadcrumb(crumb).data.url, 'https://api.example.com/geo?q=1.2.3.4&key=[redacted]');
        assert.equal(crumb.data.status_code, 502);
    });

    it('redacts http.query breadcrumb data including the leading question mark form', () => {
        const crumb = {
            data: {
                'http.method': 'GET',
                'http.query': '?key=secret&ip=8.8.8.8&lang=en',
                status_code: 400,
            },
        };
        assert.equal(scrubBreadcrumb(crumb).data['http.query'], '?key=[redacted]&ip=8.8.8.8&lang=en');
        assert.equal(crumb.data['http.method'], 'GET');
    });

    it('tolerates breadcrumbs without url data', () => {
        const crumb = { category: 'console', message: 'hi' };
        assert.equal(scrubBreadcrumb(crumb), crumb);
    });
});

describe('scrubSpan', () => {
    it('redacts URL attributes and the description', () => {
        const span = {
            description: 'GET https://api.example.com/geo?q=1.2.3.4&key=secret',
            data: {
                'url.full': 'https://api.example.com/geo?q=1.2.3.4&key=secret',
                'http.url': 'https://api.example.com/geo?q=1.2.3.4&key=secret',
                'http.target': '/ipinfo?key=secret&ip=1.2.3.4',
                'url.query': 'q=1.2.3.4&key=secret',
                'http.method': 'GET',
            },
        };
        const out = scrubSpan(span);
        assert.equal(out.description, 'GET https://api.example.com/geo?q=1.2.3.4&key=[redacted]');
        assert.equal(out.data['url.full'], 'https://api.example.com/geo?q=1.2.3.4&key=[redacted]');
        assert.equal(out.data['http.url'], 'https://api.example.com/geo?q=1.2.3.4&key=[redacted]');
        assert.equal(out.data['http.target'], '/ipinfo?key=[redacted]&ip=1.2.3.4');
        assert.equal(out.data['url.query'], 'q=1.2.3.4&key=[redacted]');
        assert.equal(out.data['http.method'], 'GET');
    });

    it('tolerates spans without data', () => {
        assert.equal(scrubSpan(null), null);
        const bare = { description: 'db query' };
        assert.equal(scrubSpan(bare).description, 'db query');
    });
});

describe('scrubEventRequest', () => {
    it('redacts the request URL and query_string, keeps debug params', () => {
        const event = {
            request: {
                url: 'https://localhost:11966/api/ipapiis?ip=1.2.3.4&token=abc',
                query_string: 'ip=1.2.3.4&token=abc',
                method: 'GET',
            },
        };
        const out = scrubEventRequest(event);
        assert.equal(out.request.url, 'https://localhost:11966/api/ipapiis?ip=1.2.3.4&token=[redacted]');
        assert.equal(out.request.query_string, 'ip=1.2.3.4&token=[redacted]');
        assert.equal(out.request.method, 'GET');
    });

    it('scrubs the root span trace attributes', () => {
        const event = {
            contexts: { trace: { data: { 'http.url': 'https://api.example.com/geo?q=1.2.3.4&key=secret' } } },
        };
        assert.equal(
            scrubEventRequest(event).contexts.trace.data['http.url'],
            'https://api.example.com/geo?q=1.2.3.4&key=[redacted]'
        );
    });

    it('tolerates events without request context', () => {
        const event = { message: 'plain' };
        assert.equal(scrubEventRequest(event), event);
    });
});

// resolveBackTarget() — where the page breadcrumb's "Home" crumb goes.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveBackTarget } from '../frontend/utils/back-target.js';

describe('resolveBackTarget()', () => {
    it('steps back when the previous entry is the homepage', () => {
        assert.equal(resolveBackTarget({ back: '/', current: '/tools/whois' }), 'back');
    });

    it('treats a homepage entry with a query or hash as the homepage', () => {
        assert.equal(resolveBackTarget({ back: '/?utm_source=x' }), 'back');
        assert.equal(resolveBackTarget({ back: '/#AdvancedTools' }), 'back');
    });

    it('pushes home when the page was opened directly', () => {
        assert.equal(resolveBackTarget({ back: null, current: '/tools/whois' }), '/');
        assert.equal(resolveBackTarget(null), '/');
        assert.equal(resolveBackTarget(undefined), '/');
        assert.equal(resolveBackTarget({}), '/');
    });

    it('pushes home when the previous entry is another page', () => {
        assert.equal(resolveBackTarget({ back: '/tools/ipcalculator' }), '/');
        assert.equal(resolveBackTarget({ back: '/privacy' }), '/');
        assert.equal(resolveBackTarget({ back: '/r/abc' }), '/');
    });

    it('ignores a non-string back entry', () => {
        assert.equal(resolveBackTarget({ back: 1 }), '/');
        assert.equal(resolveBackTarget({ back: { path: '/' } }), '/');
    });
});

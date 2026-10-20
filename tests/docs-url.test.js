// docsUrl() — locale-aware links into docs.ipcheck.ing.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { docsUrl } from '../frontend/utils/docs-url.js';

describe('docsUrl()', () => {
    it('puts English at the section root', () => {
        assert.equal(docsUrl('knowledge-base', 'en'), 'https://docs.ipcheck.ing/knowledge-base/');
        assert.equal(docsUrl('developer', 'en'), 'https://docs.ipcheck.ing/developer/');
    });

    it('puts any other locale under the section', () => {
        assert.equal(docsUrl('knowledge-base', 'zh'), 'https://docs.ipcheck.ing/knowledge-base/zh/');
        assert.equal(docsUrl('developer', 'pt-BR'), 'https://docs.ipcheck.ing/developer/pt-BR/');
    });

    it('appends the path after the locale segment', () => {
        assert.equal(docsUrl('developer', 'en', 'getting-started/'), 'https://docs.ipcheck.ing/developer/getting-started/');
        assert.equal(docsUrl('developer', 'zh', 'getting-started/'), 'https://docs.ipcheck.ing/developer/zh/getting-started/');
    });

    it('never produces a double slash', () => {
        const urls = [
            docsUrl('/developer/', 'zh', '/getting-started/'),
            docsUrl('developer', 'en', '/getting-started/'),
            docsUrl('developer/', 'fr'),
        ];
        for (const url of urls) assert.doesNotMatch(url.replace('https://', ''), /\/\//);
        assert.equal(urls[0], 'https://docs.ipcheck.ing/developer/zh/getting-started/');
    });

    it('treats a missing locale as English', () => {
        assert.equal(docsUrl('developer', undefined), 'https://docs.ipcheck.ing/developer/');
    });
});

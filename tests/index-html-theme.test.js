// index.html's head script seeds the `.dark` class before the bundle loads,
// so it reads the `?theme=` override by hand. This spec runs that script
// against stubs and holds its parameter name and values to
// frontend/data/url-params.js and THEME_OPTIONS.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import { URL_PARAMS } from '../frontend/data/url-params.js';
import { THEME_OPTIONS } from '../common/preferences-schema.js';
import { PREFS_STORAGE_KEY } from '../frontend/data/default-preferences.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The inline <script> that defines jnReadPrefs.
const headScript = (() => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    const script = scripts.find((source) => source.includes('window.jnReadPrefs = function'));
    assert.ok(script, 'index.html no longer carries the theme seeding script');
    return script;
})();

// Runs the head script: `search` in the URL, `stored` in localStorage, the OS
// dark or not. Returns whether it added `.dark`.
const runHead = ({ search = '', stored, osDark = false }) => {
    const classes = new Set();
    const window = {
        location: { search },
        matchMedia: () => ({ matches: osDark }),
    };
    const document = {
        documentElement: { setAttribute() {}, classList: { add: (cls) => classes.add(cls) } },
    };
    const localStorage = {
        getItem: (key) => (key === PREFS_STORAGE_KEY && stored !== undefined ? JSON.stringify(stored) : null),
    };
    new Function('window', 'document', 'localStorage', headScript)(window, document, localStorage);
    return classes.has('dark');
};

describe('index.html theme seeding', () => {
    it('reads the registry\'s theme override parameter', () => {
        const row = URL_PARAMS.find((param) => param.kind === 'override' && param.preference === 'theme');
        assert.ok(headScript.includes(`.get('${row.name}')`), `index.html must read ?${row.name}=`);
    });

    it('accepts exactly THEME_OPTIONS', () => {
        const match = headScript.match(/var THEME_VALUES = (\[[^\]]*\]);/);
        assert.ok(match, 'index.html no longer declares THEME_VALUES');
        assert.deepEqual(JSON.parse(match[1].replaceAll("'", '"')), [...THEME_OPTIONS]);
    });

    it('takes the stored theme, else the OS', () => {
        assert.equal(runHead({ stored: { theme: 'dark' } }), true);
        assert.equal(runHead({ stored: { theme: 'light' }, osDark: true }), false);
        assert.equal(runHead({ osDark: true }), true);
        assert.equal(runHead({}), false);
    });

    it('lets ?theme= win over the stored theme, in any case', () => {
        assert.equal(runHead({ search: '?theme=dark', stored: { theme: 'light' } }), true);
        assert.equal(runHead({ search: '?theme=LIGHT', stored: { theme: 'dark' } }), false);
        assert.equal(runHead({ search: '?theme=auto', stored: { theme: 'dark' }, osDark: false }), false);
        assert.equal(runHead({ search: '?theme=Auto', stored: { theme: 'light' }, osDark: true }), true);
    });

    it('ignores an invalid ?theme=', () => {
        assert.equal(runHead({ search: '?theme=sepia', stored: { theme: 'dark' } }), true);
        assert.equal(runHead({ search: '?theme=', stored: { theme: 'light' }, osDark: true }), false);
    });
});

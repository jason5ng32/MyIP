// Keeps the open-source core neutral about the IPCheck.ing API: each rule
// names a pattern the core must not use, matched on code with comments
// stripped. Files still allowed to match are listed per rule with the
// reason, and a listed file that no longer matches fails, so the lists only
// shrink.
// The wording rule reads raw text (comments, tests, docs) and has no list.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_DIRS = ['frontend', 'api', 'server', 'common'];
const CODE_SKIP = new Set(['node_modules', 'frontend/locales', 'frontend/components/ui']);
const CODE_EXT = /\.(js|vue)$/;
const ROOT_ENTRIES = ['backend-server.js', 'frontend-server.js', 'sentry-instrument.js', 'vite.config.js'];
const DOC_DIRS = ['frontend', 'api', 'server', 'common', '.github'];

// --- scan -------------------------------------------------------------------

const toPosix = (path) => path.split(sep).join('/');

const listFiles = (dir, ext, skip = new Set(['node_modules'])) => readdirSync(join(ROOT, dir), { withFileTypes: true })
    .flatMap((entry) => {
        const path = toPosix(join(dir, entry.name));
        if (entry.isDirectory()) return skip.has(path) || skip.has(entry.name) ? [] : listFiles(path, ext, skip);
        return ext.test(entry.name) ? [path] : [];
    });

const rootFiles = (ext) => readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && ext.test(entry.name))
    .map((entry) => entry.name);

const codeFiles = () => [...CODE_DIRS.flatMap((dir) => listFiles(dir, CODE_EXT, CODE_SKIP)), ...ROOT_ENTRIES];

// Raw-text scope of the wording rule: code without the exclusions, tests, docs.
const wordingFiles = () => [
    ...CODE_DIRS.flatMap((dir) => listFiles(dir, CODE_EXT)),
    ...ROOT_ENTRIES,
    ...listFiles('tests', /\.js$/),
    ...rootFiles(/\.md$/),
    ...DOC_DIRS.flatMap((dir) => listFiles(dir, /\.md$/)),
];

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

// --- comment stripping ------------------------------------------------------

// An unterminated `<!--` is left as text rather than hiding the rest.
const stripHtmlComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '');

// A `/` after one of these (or at the start) opens a regex literal.
const REGEX_PRECEDERS = new Set([...'(,=:[!&|?{};+-*%<>~^']);
// So does a `/` after one of these keywords.
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'throw', 'new', 'delete', 'void', 'in', 'of', 'do',
    'else', 'instanceof', 'yield', 'await']);

// Drops `//` and `/* */` comments outside strings, templates (placeholders
// included) and regex literals, so a `://` inside a URL string stays put.
const stripJsComments = (source) => {
    let out = '';
    let last = '';
    let depth = 0;
    const placeholders = []; // brace depth at each open `${`
    // Ends a template chunk at its closing backtick or after a `${`.
    const templateChunkEnd = (from) => {
        let end = from;
        while (end < source.length && source[end] !== '`' && !(source[end] === '$' && source[end + 1] === '{')) {
            end += source[end] === '\\' ? 2 : 1;
        }
        if (source[end] !== '$') return end + 1;
        placeholders.push(depth);
        return end + 2;
    };
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        const next = source[i + 1];
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && next === '*') {
            const close = source.indexOf('*/', i + 2);
            i = close === -1 ? source.length : close + 2;
            out += ' ';
            continue;
        }
        let end = i + 1;
        let token = ch;
        if (ch === '`' || (ch === '}' && placeholders.at(-1) === depth)) {
            if (ch === '}') placeholders.pop();
            end = templateChunkEnd(i + 1);
            token = source[end - 1] === '{' ? '{' : 'x';
        } else if (ch === '"' || ch === "'") {
            while (end < source.length && source[end] !== ch && source[end] !== '\n') {
                end += source[end] === '\\' ? 2 : 1;
            }
            end += 1;
            token = 'x';
        } else if (ch === '/' && (last === '' || REGEX_PRECEDERS.has(last))) {
            let inClass = false;
            while (end < source.length && source[end] !== '\n' && (inClass || source[end] !== '/')) {
                if (source[end] === '[') inClass = true;
                else if (source[end] === ']') inClass = false;
                end += source[end] === '\\' ? 2 : 1;
            }
            end += 1;
            token = 'x';
        } else if (/[A-Za-z_$]/.test(ch)) {
            while (end < source.length && /[\w$]/.test(source[end])) end += 1;
            token = REGEX_KEYWORDS.has(source.slice(i, end)) ? '(' : 'x';
        } else if (ch === '{') {
            depth += 1;
        } else if (ch === '}') {
            depth -= 1;
        }
        out += source.slice(i, end);
        if (!/\s/.test(ch)) last = token;
        i = end;
    }
    return out;
};

const VUE_BLOCK = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/g;

// `.vue`: JS comments in <script>, CSS comments in <style>, HTML comments
// in the rest only.
const stripComments = (source, path) => {
    if (!path.endsWith('.vue')) return stripJsComments(source);
    let out = '';
    let at = 0;
    for (const match of source.matchAll(VUE_BLOCK)) {
        const [whole, open, tag, body, close] = match;
        const clean = tag === 'script' ? stripJsComments(body) : body.replace(/\/\*[\s\S]*?\*\//g, ' ');
        out += stripHtmlComments(source.slice(at, match.index)) + open + clean + close;
        at = match.index + whole.length;
    }
    return out + stripHtmlComments(source.slice(at));
};

// --- rules ------------------------------------------------------------------

// Forbidden words are assembled from parts so this file never matches them.
const IDENTITY_WORDS = ['origin' + 'alSite', 'requiresOrigin' + 'alSite', 'ORIGINAL_SITE' + '_ONLY'];
const ADVANCED = 'advanced' + 'Data';
const I18N_ADVANCED = new RegExp(`ipInfos\\.${ADVANCED}\\.`, 'g');
const ENV_WORDS = ['IPCHECKING_API' + '_KEY', 'IPCHECKING_API' + '_ENDPOINT'];
const WORDING = new RegExp('priv' + 'ate[- ](ipcheck\\.ing[- ])?(api|service|backend|endpoint|upstream)', 'i');

const inBackend = (path) => path.startsWith('api/') || path.startsWith('server/');

// `req.headers` used as a whole: anything but a property access after it.
const WHOLE_REQ_HEADERS = /\breq\??\.headers\b(?!\s*(\.|\?\.|\[))/;
const HEADERS_SPREAD = /\bheaders\s*:\s*\{[^}]*\.\.\.\s*[A-Za-z_$]/;
const PLACEHOLDER = /\$\{[^{}]*\}/g;

const NEGATED_SOURCE = /!\s*([\w$]+\??\.)*ipGeoSource\b/;
const ZERO_COMPARE = /(?<![!=<>])===?\s*0(?![\d.])|(?<![\w.])0\s*===?(?!=)/;

// Each rule: `test(code)` on comment-stripped code, `applies(path)` for its
// scope, and the files allowed to match (path → what the file is).
const RULES = [
    {
        name: 'no identity gate',
        test: (code) => new RegExp(IDENTITY_WORDS.join('|')).test(code),
        permanent: {},
    },
    {
        name: 'no source-id 0 check on ipGeoSource',
        test: (code) => code.split('\n').some((line) => NEGATED_SOURCE.test(line)
            || (/\bipGeoSource\b/.test(line) && ZERO_COMPARE.test(line))),
        permanent: {},
    },
    {
        name: `no data access to ${ADVANCED} (i18n keys aside)`,
        test: (code) => new RegExp(`\\b${ADVANCED}\\b`).test(code.replace(I18N_ADVANCED, '')),
        permanent: {
            'server/ipcheck-ing-extended.js': 'the adapter that parses the IPCheck.ing API answer',
        },
    },
    {
        name: 'no quoted gate strings',
        test: (code) => /(['"`])(sign_in_required|quota_exceeded)\1/.test(code),
        permanent: {
            'server/ipcheck-ing-extended.js': 'the adapter that parses the IPCheck.ing API answer',
            'common/codes/service-errors.js': 'the service error code list, auth reasons included',
        },
    },
    {
        name: 'no whole request headers in api/ and server/',
        applies: inBackend,
        test: (code) => WHOLE_REQ_HEADERS.test(code) || HEADERS_SPREAD.test(code.replace(PLACEHOLDER, '')),
        permanent: {
            'api/sentry-tunnel.js': 'the Sentry tunnel: visitorIpFrom reads cf-connecting-ip only',
        },
    },
    {
        name: 'no reads of the IPCheck.ing API env variables',
        test: (code) => new RegExp(`\\b(${ENV_WORDS.join('|')})\\b`).test(code),
        permanent: {
            'server/ipcheck-ing-api.js': 'the adapter that sends requests to the IPCheck.ing API',
        },
    },
    {
        name: 'no IPCheck.ing hostname or name in code',
        test: (code) => /ipcheck\.ing/i.test(code),
        permanent: {
            'frontend/utils/upstream-site.js': 'the one identity check: the upstream hostnames',
            'frontend/utils/getips/ipchecking4.js': 'an IP probe: its public endpoint and provider name',
            'frontend/utils/getips/ipchecking6.js': 'an IP probe: its public endpoint and provider name',
            'frontend/utils/getips/ipchecking64.js': 'an IP probe: its public endpoint and provider name',
            'frontend/data/ip-databases.js': 'the IP source list: the source display name',
            'frontend/components/IpInfos.vue': 'the IP cards: the probe display names',
            'frontend/utils/ip/asn-profile-view.js': 'the ASN Profile view: the reputation source name',
            'frontend/data/achievement-rules.js': 'the achievement rules: one matches the Whois query text',
            'frontend/components/Footer.vue': 'the footer: the lite site link',
            'frontend/components/widgets/FooterAcknowledgements.vue': 'the acknowledgements: utm source of a sponsor link',
            'frontend/utils/docs-url.js': 'the docs link builder: the docs site origin',
            'frontend/components/ToolPage.vue': 'a page: its title suffix',
            'frontend/components/PrivacyPolicy.vue': 'a page: its title suffix',
            'frontend/components/report/ReportPage.vue': 'a page: its title suffix',
            'frontend/data/banners/ipinfo.js': 'a homepage banner: its link utm source',
            'frontend/data/banners/speedtest.js': 'a homepage banner: its copy',
            'frontend/components/advanced-tools/RuleTest.vue': 'the Rule Test tool: its probe hostnames',
            'vite.config.js': 'the build config: dev server allowedHosts',
        },
    },
];

const hitsOf = (rule, sources) => [...sources.entries()]
    .filter(([path, code]) => (rule.applies ?? (() => true))(path) && rule.test(code))
    .map(([path]) => path)
    .sort();

// --- tests ------------------------------------------------------------------

describe('provider neutrality', () => {
    const files = codeFiles();
    const sources = new Map(files.map((path) => [path, stripComments(read(path), path)]));

    it('scans the source tree', () => {
        assert.ok(files.length > 200, `only ${files.length} source files found`);
        assert.ok(files.some((path) => path.endsWith('.vue')), 'no .vue files found');
        assert.ok(!files.some((path) => path.startsWith('frontend/locales/') || path.startsWith('frontend/components/ui/')));
    });

    it('strips comments but keeps strings, URLs and regex literals', () => {
        const js = [
            '// line comment HIDDEN',
            "const url = 'https://example.com/a'; // trailing HIDDEN",
            '/* block',
            '   HIDDEN */ const b = 1;',
            'const re = /\\/\\/[\'"]/g; const kept = "KEPT";',
            'const t = `x // KEPT ${1}`;',
        ].join('\n');
        const clean = stripComments(js, 'a.js');
        assert.ok(!clean.includes('HIDDEN'), clean);
        assert.ok(clean.includes("'https://example.com/a'"), clean);
        assert.equal(clean.match(/KEPT/g)?.length, 2, clean);
        assert.ok(clean.includes('const b = 1;'), clean);

        const vue = '<template><!-- HIDDEN --><a href="https://x.test">KEPT</a></template>\n<script setup>\n// HIDDEN\nconst k = 1;\n</script>';
        const cleanVue = stripComments(vue, 'a.vue');
        assert.ok(!cleanVue.includes('HIDDEN'), cleanVue);
        assert.ok(cleanVue.includes('href="https://x.test">KEPT') && cleanVue.includes('const k = 1;'), cleanVue);

        // Regex literals after keywords and nested templates keep what follows.
        const identity = RULES[0];
        const gate = `configs.${IDENTITY_WORDS[0]}`;
        assert.ok(identity.test(stripComments(`const f = (u) => { return /\\/\\//.test(u) && ${gate}; };`, 'a.js')));
        assert.ok(identity.test(stripComments(`const n = \`a \${\`//\`} b\`; if (${gate}) go();`, 'a.js')));
        assert.ok(identity.test(stripComments(`const n = \`\${{ a: \`\${1}\` }.a}\`; if (${gate}) go();`, 'a.js')));

        // A `<!--` in a script, or unterminated in the template, hides nothing.
        const scriptMarker = `<template><div /></template>\n<script setup>\nconst marker = '<!--';\nif (${gate}) go();\n</script>`;
        assert.ok(identity.test(stripComments(scriptMarker, 'a.vue')));
        const openTemplate = `<template><!-- open <a v-if="${gate}" /></template>\n<script setup>\nconst k = 1;\n</script>`;
        assert.ok(identity.test(stripComments(openTemplate, 'a.vue')));
        const style = '<style>\n/* HIDDEN */ .a { background: url(https://x.test/a.png); }\n</style>';
        const cleanStyle = stripComments(style, 'a.vue');
        assert.ok(!cleanStyle.includes('HIDDEN') && cleanStyle.includes('url(https://x.test/a.png)'), cleanStyle);
    });

    it('each pattern bites its sample and spares the look-alike', () => {
        const samples = [
            [`if (configs.${IDENTITY_WORDS[0]}) go();`, 'if (configs.siteName) go();'],
            ['if (store.ipGeoSource === 0) go();', 'if (store.ipGeoSource === 10) go();'],
            [`const s = data.${ADVANCED}.score;`, `t('ipInfos.${ADVANCED}.score');`],
            ["if (code === 'quota_exceeded') stop();", 'if (code === quotaExceeded) stop();'],
            ['fetchUpstream(url, { headers: { ...headers } });', "fetchUpstream(url, { headers: { 'user-agent': ua } });"],
            [`const key = process.env.${ENV_WORDS[0]};`, 'const key = process.env.CLOUDFLARE_API_KEY;'],
            ["const name = 'IPCheck.ing';", 'const skipCheck = ipChecking;'],
        ];
        assert.equal(samples.length, RULES.length);
        RULES.forEach((rule, index) => {
            const [hit, miss] = samples[index];
            assert.ok(rule.test(stripComments(hit, 'a.js')), `${rule.name}: ${hit}`);
            assert.ok(!rule.test(stripComments(miss, 'a.js')), `${rule.name}: ${miss}`);
            assert.ok(!rule.test(stripComments(`// ${hit}`, 'a.js')), `${rule.name}: comment`);
        });
        const source = RULES[1];
        for (const hit of ['if (store.ipGeoSource == 0) go();', 'if (0 === ipGeoSource) go();', 'if (0 == ipGeoSource) go();',
            'if (!ipGeoSource) go();', 'if (!props.ipGeoSource) go();', 'if (!x.value.ipGeoSource) go();']) {
            assert.ok(source.test(hit), hit);
        }
        for (const miss of ['if (ipGeoSource === 10) go();', 'if (ipGeoSource !== 0) go();', 'if (ipGeoSource != 0) go();',
            '<IpAdvancedBlock :ipGeoSource="ipGeoSource" />']) {
            assert.ok(!source.test(miss), miss);
        }

        const headers = RULES.find((rule) => rule.applies === inBackend);
        for (const hit of ['fetchUpstream(url, { headers: { ...req.headers, host } });', 'const h = { ...req.headers };',
            'fetchUpstream(url, { headers: req.headers });', 'const h = new Headers(req.headers);',
            'const h = Object.assign({}, req.headers);', 'const { host, ...rest } = req.headers;',
            'const h = { ...req?.headers };', 'helper(asn, req.headers, opts);',
            'fetchUpstream(url, { headers: { id: `${id}`, ...extra } });']) {
            assert.ok(headers.test(hit), hit);
        }
        for (const miss of ['const r = req.headers.referer;', "const ua = req.headers['user-agent'];",
            'const h = req?.headers?.host;', 'const r = req.headers?.referer;']) {
            assert.ok(!headers.test(miss), miss);
        }

        const priv = 'priv' + 'ate';
        assert.ok(WORDING.test(`the ${priv}-API proxy`) && WORDING.test(`a ${'Priv' + 'ate'} backend`));
        assert.ok(WORDING.test(`our ${priv} IPCheck.ing API`) && WORDING.test(`the ${priv} endpoint`)
            && WORDING.test(`a ${priv} upstream`));
        assert.ok(!WORDING.test('the IPCheck.ing API') && !WORDING.test('privacy policy'));
    });

    for (const rule of RULES) {
        describe(rule.name, () => {
            const hits = hitsOf(rule, sources);
            const listed = rule.permanent;

            it('matches only listed files', () => {
                assert.deepEqual(hits.filter((path) => !(path in listed)), []);
            });

            it('every listed file still matches', () => {
                assert.deepEqual(Object.keys(listed).filter((path) => !hits.includes(path)), []);
            });

            it('gives every listed file a reason', () => {
                assert.deepEqual(Object.entries(listed).filter(([, reason]) => !reason.trim()), []);
            });
        });
    }

    it('public text names the service without the forbidden wording', () => {
        const found = wordingFiles().filter((path) => WORDING.test(read(path)));
        assert.deepEqual(found, []);
    });
});

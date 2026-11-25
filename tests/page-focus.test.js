// Spec for utils/page-focus.js: the focus decision, the heading's Tab
// redirect and the router / keydown hook-up, driven by a fake router and
// document.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isPathChange,
    isPageArrival,
    shouldFocusPageHeading,
    focusContext,
    isPlainTab,
    isShown,
    isEnabled,
    pageFocusTarget,
    headingTabTarget,
    installPageFocus,
} from '../frontend/utils/page-focus.js';

const home = { name: 'home', path: '/' };
const whois = { name: 'tool', path: '/tools/whois' };
const dns = { name: 'tool', path: '/tools/dns' };
const start = { name: undefined, path: '/', matched: [] };

describe('isPathChange() / isPageArrival()', () => {
    it('counts a successful move onto another path', () => {
        assert.equal(isPathChange(home, whois), true);
        assert.equal(isPathChange(whois, dns), true);
        assert.equal(isPageArrival({ from: home, to: whois }), true);
    });

    it('counts the first load, even onto the start path', () => {
        assert.equal(isPathChange(start, dns), true);
        assert.equal(isPathChange(start, home), true);
        assert.equal(isPathChange(undefined, dns), true);
    });

    it('ignores a query / hash-only change', () => {
        assert.equal(isPathChange(dns, { ...dns, query: { q: 'example.com' } }), false);
        assert.equal(isPathChange(home, { ...home, hash: '#x' }), false);
    });

    it('ignores a failed navigation and a missing target', () => {
        assert.equal(isPathChange(home, whois, { type: 4 }), false);
        assert.equal(isPathChange(home, null), false);
    });

    it('leaves a history step to the browser', () => {
        assert.equal(isPageArrival({ from: home, to: whois, viaHistory: true }), false);
    });
});

describe('shouldFocusPageHeading()', () => {
    const base = { from: home, to: whois, viaHistory: false, hasHeading: true, focusInPage: false, focusInDialog: false };

    it('focuses the heading after a navigation and on the first load', () => {
        assert.equal(shouldFocusPageHeading(base), true);
        assert.equal(shouldFocusPageHeading({ ...base, from: start, to: dns }), true);
    });

    it('does nothing on a query-only change, a history step or a failure', () => {
        assert.equal(shouldFocusPageHeading({ ...base, from: whois, to: { ...whois, query: { q: '1' } } }), false);
        assert.equal(shouldFocusPageHeading({ ...base, viaHistory: true }), false);
        assert.equal(shouldFocusPageHeading({ ...base, failure: { type: 8 } }), false);
    });

    it('never moves focus already in the page or a dialog', () => {
        assert.equal(shouldFocusPageHeading({ ...base, focusInPage: true }), false);
        assert.equal(shouldFocusPageHeading({ ...base, focusInDialog: true }), false);
    });

    it('does nothing without a heading', () => {
        assert.equal(shouldFocusPageHeading({ ...base, hasHeading: false }), false);
        assert.equal(shouldFocusPageHeading({ ...base, hasHeading: undefined }), false);
    });
});

// A minimal element tree: `closest` matches a tag name or a role selector.
const makeElement = (tag, { parent = null, role = null } = {}) => {
    const el = {
        tag, role, parentElement: parent, focusCalls: [],
        contains(other) {
            for (let node = other; node; node = node.parentElement) if (node === el) return true;
            return false;
        },
        closest(selector) {
            for (let node = el; node; node = node.parentElement) {
                if (selector === node.tag) return node;
                if (node.role && selector.includes(`[role="${node.role}"]`)) return node;
            }
            return null;
        },
        focus(options) { el.focusCalls.push(options); },
    };
    return el;
};

const makePage = () => {
    const body = makeElement('body');
    const page = makeElement('div', { parent: body });
    const main = makeElement('main', { parent: page });
    const heading = makeElement('h1', { parent: main });
    const input = makeElement('input', { parent: main });
    const footerLink = makeElement('a', { parent: page });
    const nav = makeElement('a', { parent: body });
    const dialog = makeElement('div', { parent: body, role: 'dialog' });
    const dialogButton = makeElement('button', { parent: dialog });
    return { body, page, main, heading, input, footerLink, nav, dialog, dialogButton };
};

describe('focusContext()', () => {
    it('places focus inside the page around the heading, footer included', () => {
        const els = makePage();
        assert.deepEqual(focusContext({ activeElement: els.input }, els.heading), { focusInPage: true, focusInDialog: false });
        assert.deepEqual(focusContext({ activeElement: els.footerLink }, els.heading), { focusInPage: true, focusInDialog: false });
    });

    it('tells focus outside the page and inside a dialog apart', () => {
        const els = makePage();
        assert.deepEqual(focusContext({ activeElement: els.body }, els.heading), { focusInPage: false, focusInDialog: false });
        assert.deepEqual(focusContext({ activeElement: els.nav }, els.heading), { focusInPage: false, focusInDialog: false });
        assert.deepEqual(focusContext({ activeElement: els.dialogButton }, els.heading), { focusInPage: false, focusInDialog: true });
    });

    it('tolerates no heading and no focus', () => {
        assert.deepEqual(focusContext({ activeElement: null }, null), { focusInPage: false, focusInDialog: false });
    });
});

const setup = ({ withHeading = true, nextFrame } = {}) => {
    let afterEach = null;
    const router = { afterEach: (fn) => { afterEach = fn; } };
    const els = makePage();
    const doc = {
        activeElement: els.body,
        heading: withHeading ? els.heading : null,
        querySelector(selector) { return selector === '[data-page-heading]' ? doc.heading : null; },
    };
    let popstate = null;
    const win = { addEventListener: (type, fn, options) => { if (type === 'popstate' && options?.capture) popstate = fn; } };
    installPageFocus(router, { doc, win, nextTick: () => Promise.resolve(), nextFrame: nextFrame ?? (() => Promise.resolve()) });
    return { afterEach: (...args) => afterEach(...args), doc, els, popstate: () => popstate() };
};

describe('installPageFocus()', () => {
    it('focuses the page heading without scrolling after a navigation', async () => {
        const { afterEach, els } = setup();
        await afterEach(whois, home);
        assert.deepEqual(els.heading.focusCalls, [{ preventScroll: true }]);
    });

    it('focuses it on the first load too', async () => {
        const { afterEach, els } = setup();
        await afterEach(dns, start);
        assert.equal(els.heading.focusCalls.length, 1);
    });

    it('leaves a query-only change, a failure and a history step alone', async () => {
        const { afterEach, els, popstate } = setup();
        await afterEach({ ...dns, query: { q: 'x' } }, dns);
        await afterEach(whois, home, { type: 4 });
        popstate();
        await afterEach(home, whois);
        await afterEach(dns, home);
        assert.equal(els.heading.focusCalls.length, 1, 'the popstate flag covers one navigation only');
    });

    it('keeps focus the page or a dialog already holds', async () => {
        const { afterEach, doc, els } = setup();
        doc.activeElement = els.input;
        await afterEach(whois, home);
        doc.activeElement = els.dialogButton;
        await afterEach(dns, whois);
        assert.equal(els.heading.focusCalls.length, 0);
        doc.activeElement = els.nav;
        await afterEach(whois, dns);
        assert.equal(els.heading.focusCalls.length, 1);
    });

    it('does nothing on a page without a heading', async () => {
        const { afterEach, doc } = setup({ withHeading: false });
        await assert.doesNotReject(afterEach(home, whois));
        assert.equal(doc.heading, null);
    });

    it('drops a pending focus once a newer navigation arrives', async () => {
        const frames = [];
        const { afterEach, els } = setup({ nextFrame: () => new Promise((resolve) => frames.push(resolve)) });
        const first = afterEach(whois, home);
        const second = afterEach(dns, whois);
        await new Promise((r) => setTimeout(r, 0));
        assert.equal(frames.length, 2);
        frames.forEach((resolve) => resolve());
        await Promise.all([first, second]);
        assert.equal(els.heading.focusCalls.length, 1);
    });

    it('ignores a missing document or router', () => {
        assert.doesNotThrow(() => installPageFocus({ afterEach: () => {} }, { doc: null }));
        assert.doesNotThrow(() => installPageFocus(null, { doc: { querySelector: () => null } }));
    });
});

// A fake DOM for the Tab redirect: tags, attributes, `display: none`
// (`hiddenBox`), connection and a matcher for the simple selectors in use.
const matchesOne = (el, selector) => {
    if (selector === ':disabled') {
        return ['button', 'input', 'select', 'textarea'].includes(el.tag) && 'disabled' in el.attrs;
    }
    const m = selector.match(/^([a-z0-9]*)(?:\[([\w-]+)(?:="([^"]*)")?\])?(?::not\(\[([\w-]+)="([^"]*)"\]\))?$/);
    if (!m) throw new Error(`fake DOM cannot match ${selector}`);
    const [, tag, attr, value, notAttr, notValue] = m;
    if (tag && el.tag !== tag) return false;
    if (attr && !(attr in el.attrs)) return false;
    if (attr && value !== undefined && el.attrs[attr] !== value) return false;
    if (notAttr && el.attrs[notAttr] === notValue) return false;
    return Boolean(tag || attr);
};

const node = (tag, attrs = {}, children = [], { hiddenBox = false, refusesFocus = false } = {}) => {
    const el = {
        tag, attrs, children, parentElement: null, hiddenBox, refusesFocus, root: false, doc: null,
        get isConnected() {
            let top = el;
            while (top.parentElement) top = top.parentElement;
            return top.root;
        },
        getClientRects() {
            for (let n = el; n; n = n.parentElement) if (n.hiddenBox) return [];
            return [{}];
        },
        matches(selector) { return selector.split(',').some((part) => matchesOne(el, part.trim())); },
        closest(selector) {
            for (let n = el; n; n = n.parentElement) if (n.matches(selector)) return n;
            return null;
        },
        contains(other) {
            for (let n = other; n; n = n.parentElement) if (n === el) return true;
            return false;
        },
        querySelectorAll(selector) {
            const found = [];
            const walk = (n) => n.children.forEach((c) => { if (c.matches(selector)) found.push(c); walk(c); });
            walk(el);
            return found;
        },
        querySelector(selector) { return el.querySelectorAll(selector)[0] ?? null; },
        focus() {
            let top = el;
            while (top.parentElement) top = top.parentElement;
            if (!el.refusesFocus && top.doc) top.doc.activeElement = el;
        },
    };
    children.forEach((c) => { c.parentElement = el; });
    return el;
};

// body > [nav link, page > [main > [h1, …content], footer link]]
const makeTabPage = (content) => {
    const heading = node('h1', { 'data-page-heading': '', tabindex: '-1' });
    const main = node('main', {}, [heading, ...content]);
    const page = node('div', {}, [main, node('a', { href: '/about' })]);
    const navLink = node('a', { href: '/' });
    const body = node('body', {}, [navLink, page]);
    const doc = { activeElement: heading, body };
    body.root = true;
    body.doc = doc;
    return { heading, main, page, navLink, body, doc };
};

const tab = (target, extra = {}) => {
    const event = { key: 'Tab', target, defaultPrevented: false, ...extra };
    event.preventDefault = () => { event.defaultPrevented = true; };
    return event;
};

describe('isPlainTab()', () => {
    it('accepts a bare Tab only', () => {
        assert.equal(isPlainTab(tab(null)), true);
        for (const flag of ['shiftKey', 'altKey', 'ctrlKey', 'metaKey', 'isComposing', 'defaultPrevented']) {
            assert.equal(isPlainTab(tab(null, { [flag]: true })), false, flag);
        }
        assert.equal(isPlainTab(tab(null, { key: 'Enter' })), false);
        assert.equal(isPlainTab(null), false);
    });
});

describe('isShown() / isEnabled()', () => {
    it('needs a connected, laid-out element outside [hidden] and [inert]', () => {
        const input = node('input');
        const { main } = makeTabPage([node('div', {}, [input])]);
        assert.equal(isShown(input), true);
        input.parentElement.hiddenBox = true;
        assert.equal(isShown(input), false, 'display: none on an ancestor');
        input.parentElement.hiddenBox = false;
        input.parentElement.attrs.hidden = '';
        assert.equal(isShown(input), false, 'inside [hidden]');
        delete input.parentElement.attrs.hidden;
        main.attrs.inert = '';
        assert.equal(isShown(input), false, 'inside [inert]');
        assert.equal(isShown(node('input')), false, 'detached');
        assert.equal(isShown(null), false);
    });

    it('treats a disabled control as unusable', () => {
        assert.equal(isEnabled(node('input')), true);
        assert.equal(isEnabled(node('button', { disabled: '' })), false);
    });
});

describe('pageFocusTarget() / headingTabTarget()', () => {
    it('sends a plain Tab from the heading to the marked control', () => {
        const input = node('input', { 'data-page-focus': '' });
        const { heading } = makeTabPage([node('button'), node('div', {}, [input])]);
        assert.equal(pageFocusTarget(heading), input);
        assert.equal(headingTabTarget(tab(heading)), input);
    });

    it('leaves Shift+Tab, modified Tabs and other keys alone', () => {
        const input = node('input', { 'data-page-focus': '' });
        const { heading } = makeTabPage([input]);
        assert.equal(headingTabTarget(tab(heading, { shiftKey: true })), null);
        assert.equal(headingTabTarget(tab(heading, { ctrlKey: true })), null);
        assert.equal(headingTabTarget(tab(heading, { key: 'ArrowDown' })), null);
    });

    it('acts only while focus is on the heading', () => {
        const other = node('button');
        const input = node('input', { 'data-page-focus': '' });
        const { navLink } = makeTabPage([other, input]);
        assert.equal(headingTabTarget(tab(other)), null);
        assert.equal(headingTabTarget(tab(navLink)), null);
    });

    it('falls back without a marker, or with a hidden or disabled one', () => {
        assert.equal(pageFocusTarget(makeTabPage([node('input')]).heading), null);
        const hidden = node('input', { 'data-page-focus': '' }, [], { hiddenBox: true });
        assert.equal(pageFocusTarget(makeTabPage([hidden]).heading), null);
        const disabled = node('input', { 'data-page-focus': '', disabled: '' });
        assert.equal(pageFocusTarget(makeTabPage([disabled]).heading), null);
        const inert = node('div', { inert: '' }, [node('input', { 'data-page-focus': '' })]);
        assert.equal(pageFocusTarget(makeTabPage([inert]).heading), null);
        assert.equal(pageFocusTarget(null), null);
    });

    it('focuses the first usable control inside a marked wrapper', () => {
        // A component root around a tabindex="-1" trigger (the Combobox).
        const trigger = node('button', { tabindex: '-1' });
        const wrapper = node('div', { 'data-page-focus': '' }, [node('div', {}, [trigger])]);
        assert.equal(pageFocusTarget(makeTabPage([wrapper]).heading), trigger);

        const off = node('button', { disabled: '' });
        const next = node('input');
        const mixed = node('div', { 'data-page-focus': '' }, [off, next]);
        assert.equal(pageFocusTarget(makeTabPage([mixed]).heading), next);

        const onlyOff = node('div', { 'data-page-focus': '' }, [node('button', { disabled: '' })]);
        assert.equal(pageFocusTarget(makeTabPage([onlyOff]).heading), null, 'signed out: trigger disabled');
    });

    it('skips an unusable marker for the next usable one', () => {
        // Snapshots: the wide column's button is display: none on a narrow screen.
        const wide = node('button', { 'data-page-focus': '' }, [], { hiddenBox: true });
        const narrow = node('button', { 'data-page-focus': '' });
        assert.equal(pageFocusTarget(makeTabPage([wide, narrow]).heading), narrow);

        const off = node('button', { 'data-page-focus': '', disabled: '' });
        const on = node('input', { 'data-page-focus': '' });
        assert.equal(pageFocusTarget(makeTabPage([off, on]).heading), on);
    });

    it('never uses a marker outside the heading\'s page', () => {
        const { heading, body } = makeTabPage([node('input')]);
        const elsewhere = node('input', { 'data-page-focus': '' });
        elsewhere.parentElement = body;
        body.children.push(elsewhere);
        assert.equal(pageFocusTarget(heading), null);
    });
});

describe('installPageFocus() keydown', () => {
    const install = (content) => {
        const els = makeTabPage(content);
        let keydown = null;
        els.doc.querySelector = () => null;
        els.doc.addEventListener = (type, fn) => { if (type === 'keydown') keydown = fn; };
        installPageFocus({ afterEach: () => {} }, { doc: els.doc, win: null });
        return { ...els, press: (event) => { keydown(event); return event; } };
    };

    it('moves focus to the marked control and cancels the native Tab', () => {
        const input = node('input', { 'data-page-focus': '' });
        const { doc, heading, press } = install([input]);
        const event = press(tab(heading));
        assert.equal(doc.activeElement, input);
        assert.equal(event.defaultPrevented, true);
        // From there on, Tab is the browser's.
        const next = press(tab(input));
        assert.equal(next.defaultPrevented, false);
    });

    it('lets the native Tab run when nothing applies', () => {
        const input = node('input', { 'data-page-focus': '' });
        const { doc, heading, press } = install([input]);
        assert.equal(press(tab(heading, { shiftKey: true })).defaultPrevented, false);
        assert.equal(doc.activeElement, heading);
    });

    it('keeps the native Tab when the target refuses focus', () => {
        const input = node('input', { 'data-page-focus': '' }, [], { refusesFocus: true });
        const { doc, heading, press } = install([input]);
        assert.equal(press(tab(heading)).defaultPrevented, false);
        assert.equal(doc.activeElement, heading);
    });
});

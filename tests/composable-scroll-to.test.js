import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';

import { scrollToElement } from '../frontend/composables/use-scroll-to.js';

// 注入最小 DOM 桩，模块本身不访问 globalThis，函数调用时才读
let scrollTarget = null;
globalThis.window = {
  scrollY: 100,
  scrollTo(opts) { scrollTarget = opts; },
};
globalThis.document = {
  _elements: new Map(),
  getElementById(id) { return this._elements.get(id) || null; },
};

function registerElement(id, top) {
  globalThis.document._elements.set(id, {
    getBoundingClientRect() { return { top }; },
  });
}

describe('scrollToElement()', () => {
  it('scrolls to element.top + window.scrollY - offset', () => {
    registerElement('hero', 250);
    scrollToElement('hero', 80);
    assert.deepEqual(scrollTarget, { top: 270, behavior: 'smooth' });
  });

  it('accepts an element object directly (not just an id)', () => {
    const el = { getBoundingClientRect() { return { top: 500 }; } };
    scrollToElement(el, 0);
    assert.deepEqual(scrollTarget, { top: 600, behavior: 'smooth' });
  });

  it('no-ops silently when id is unknown (no throw)', () => {
    scrollTarget = 'unchanged';
    scrollToElement('does-not-exist', 10);
    assert.equal(scrollTarget, 'unchanged');
  });
});

after(() => {
  delete globalThis.window;
  delete globalThis.document;
});

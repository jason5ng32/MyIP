// Per-route document head (title / description / canonical / Open Graph).
//
// There's no SSR, so this runs client-side: each routed page (Home.vue and the
// standalone tool pages) calls useDocumentMeta() with its own values. Because
// those pages swap through <router-view>, whichever is mounted fully owns the
// head — no restore bookkeeping needed. It's reactive (watchEffect), so locale
// switches and slug changes re-apply automatically.
//
// index.html ships sensible homepage defaults (used on first paint and as the
// fallback here); this just overrides them once Vue is driving the page.

import { watchEffect } from 'vue';

// Snapshot the index.html-provided values once, before any route overrides
// them — Home.vue reuses these so SPA-navigating back to `/` restores the
// homepage head.
export const DEFAULT_META = {
    title: document.title,
    description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') || '',
};

// Create-or-update a <meta> tag keyed by name= or property=.
function setMeta(key, attr, content) {
    if (content == null) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

// Create-or-update a <link rel="..."> tag.
function setLink(rel, href) {
    if (!href) return;
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

// `getMeta` returns { title?, description?, canonical? }. Missing fields fall
// back to the homepage defaults / the current origin. Read reactive sources
// (t(), route params) inside it so the head tracks them.
export function useDocumentMeta(getMeta) {
    watchEffect(() => {
        const meta = getMeta() || {};
        const title = meta.title || DEFAULT_META.title;
        const description = meta.description || DEFAULT_META.description;
        const canonical = meta.canonical || `${window.location.origin}/`;

        document.title = title;
        setMeta('description', 'name', description);
        setLink('canonical', canonical);
        setMeta('og:url', 'property', canonical);
        setMeta('og:title', 'property', title);
        setMeta('og:description', 'property', description);
        setMeta('twitter:title', 'name', title);
        setMeta('twitter:description', 'name', description);
    });
}

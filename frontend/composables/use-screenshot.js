// Generic DOM screenshot composable. Wraps html-to-image with retina output,
// `data-screenshot-exclude` filtering, and dynamic import so the library
// doesn't enter the initial bundle.

import { ref } from 'vue';
import { trackEvent } from '../utils/use-analytics.js';

// On touch-primary devices route through the OS share sheet — iOS in
// particular surfaces "Save Image" → Photos there, while a plain <a download>
// on iOS Safari only saves to Files. Desktop browsers keep the classic
// download path so a click doesn't unexpectedly open a share UI.
async function deliverImage(dataUrl, filename) {
    const wantsShare = typeof window !== 'undefined'
        && window.matchMedia?.('(pointer: coarse)').matches
        && typeof navigator !== 'undefined'
        && typeof navigator.canShare === 'function';
    if (wantsShare) {
        try {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], filename, { type: blob.type || 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: filename });
                return;
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;  // user dismissed the sheet
            // Anything else: fall through to download.
        }
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

export function slugifyForFilename(text, fallback = 'image') {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || fallback;
}

// External CSS rules targeting SVG children (Tailwind `fill-card` etc.) are
// dropped when html-to-image serializes the SVG, so every <rect> would fall
// back to black. We force-inline the computed paint here and restore it
// afterwards.
const SVG_INLINED_PROPS = [
    'fill', 'fill-opacity',
    'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linejoin', 'stroke-linecap',
    'opacity',
    'font-family', 'font-size', 'font-weight',
];

function inlineSvgComputedStyles(root) {
    if (!root || typeof window === 'undefined') return () => {};
    const targets = root.querySelectorAll('svg, svg *');
    const restorers = [];
    targets.forEach((el) => {
        const cs = window.getComputedStyle(el);
        const orig = el.getAttribute('style');
        let next = orig || '';
        SVG_INLINED_PROPS.forEach((prop) => {
            const v = cs.getPropertyValue(prop);
            if (v) next += `;${prop}:${v}`;
        });
        el.setAttribute('style', next);
        restorers.push(() => {
            if (orig === null) el.removeAttribute('style');
            else el.setAttribute('style', orig);
        });
    });
    return () => restorers.forEach((fn) => fn());
}

export function useScreenshot() {
    const isCapturing = ref(false);

    // `beforeCapture(element)` lets callers mutate DOM right before capture
    // (e.g. expand a clipped container); return a teardown to restore.
    const capture = async (element, {
        filename,
        trackLabel,
        pixelRatio = 2,
        beforeCapture,
    } = {}) => {
        if (!element || isCapturing.value) return false;
        isCapturing.value = true;
        if (trackLabel) trackEvent('Screenshot', 'SaveImageClick', trackLabel);
        const cleanups = [];
        try {
            if (typeof beforeCapture === 'function') {
                const teardown = await beforeCapture(element);
                if (typeof teardown === 'function') cleanups.push(teardown);
            }
            cleanups.push(inlineSvgComputedStyles(element));
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(element, {
                pixelRatio,
                cacheBust: true,
                filter: (node) => !(node instanceof HTMLElement)
                    || !node.hasAttribute('data-screenshot-exclude'),
            });
            // Restore DOM before opening share sheet / triggering download,
            // so the page behind the iOS share sheet shows the normal UI.
            while (cleanups.length) cleanups.pop()();
            await deliverImage(dataUrl, filename || `myip-${Date.now()}.png`);
            return true;
        } catch (err) {
            console.error('Screenshot failed:', err);
            return false;
        } finally {
            // LIFO: undo SVG inlining first, then caller's teardown.
            while (cleanups.length) cleanups.pop()();
            isCapturing.value = false;
        }
    };

    return { isCapturing, capture };
}

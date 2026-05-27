// Minimal browser & OS detection for the PWA install flow and a couple of
// mobile-only debug switches. UA sniffing is unreliable — only use where a
// wrong answer is harmless; prefer feature detection elsewhere.
//
// We avoid `navigator.platform` (deprecated, frozen to legacy strings like
// "MacIntel" / "Win32") and `navigator.userAgentData` (Firefox / Safari
// don't ship it, high-entropy fields are async).

const getUA = () => (typeof window !== 'undefined' && window.navigator?.userAgent) || '';
const getMaxTouch = () => (typeof window !== 'undefined' && window.navigator?.maxTouchPoints) || 0;

const detectBrowser = () => {
    const ua = getUA();
    const isFirefox = /Firefox\/|FxiOS\//.test(ua);
    // Chromium Opera → "OPR/"; legacy Presto Opera → "Opera/".
    const isOpera = /OPR\/|Opera\//.test(ua);
    const isIE = /Trident\//.test(ua);
    // Modern Edge is "Edg/" (no 'e'); legacy "Edge/" (EdgeHTML) is retired.
    const isEdge = /Edg\//.test(ua);
    // Chromium-based, NOT strictly Google Chrome — Edge / Opera / Brave /
    // Samsung Internet all carry "Chrome/". Combine with !isEdge && !isOpera
    // at the call site if you need real Chrome.
    const isChrome = /Chrome\//.test(ua);
    // Real Safari: "Safari/" without any other-engine / iOS-wrapper marker.
    const isSafari = /Safari\//.test(ua)
        && !/Chrome\/|Chromium\/|Edg\/|OPR\/|FxiOS\/|CriOS\/|EdgiOS\//.test(ua);
    return { isFirefox, isOpera, isIE, isEdge, isChrome, isSafari };
};

const detectOS = () => {
    const ua = getUA();
    // iPadOS 13+ requests the desktop site by default — its UA is identical
    // to macOS Safari. Touch capability is the only reliable distinguisher
    // (desktop Macs have no native touchscreen).
    const isIPadOS = /Macintosh/.test(ua) && getMaxTouch() > 1;
    const isIOS = /iPhone|iPod|iPad/.test(ua) || isIPadOS;
    const isAndroid = /Android/.test(ua);
    // iPhone UA contains "Mac OS X" and iPadOS impersonates "Macintosh" —
    // iOS must win first, otherwise both also flag as macOS.
    const isMac = !isIOS && /Macintosh|Mac OS X/.test(ua);
    const isWindows = /Windows|Win64|Win32/.test(ua);
    // Chromebooks carry "CrOS", not "Linux" — exclude so they don't flag
    // as Linux desktop.
    const isLinux = !isAndroid && !/CrOS/.test(ua) && /Linux/.test(ua);
    return { isMac, isWindows, isLinux, isAndroid, isIOS };
};

export { detectBrowser, detectOS };

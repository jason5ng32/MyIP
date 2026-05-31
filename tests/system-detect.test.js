import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';

// The module reads `userAgent` / `maxTouchPoints` via getters on every
// call, so we just swap a stub on globalThis between cases. Node has no
// window of its own.

function setNavigator({ userAgent = '', maxTouchPoints = 0 } = {}) {
    globalThis.window = { navigator: { userAgent, maxTouchPoints } };
}

setNavigator();
const { detectBrowser, detectOS } = await import('../frontend/utils/system-detect.js');

describe('detectBrowser()', () => {
    it('recognizes Chrome on macOS', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const b = detectBrowser();
        assert.equal(b.isChrome, true);
        assert.equal(b.isSafari, false, 'Chrome UA contains "Safari" but should not be classified as Safari');
        assert.equal(b.isFirefox, false);
        assert.equal(b.isEdge, false);
    });

    it('recognizes Safari (no Chrome substring)', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        });
        const b = detectBrowser();
        assert.equal(b.isSafari, true);
        assert.equal(b.isChrome, false);
    });

    it('recognizes Firefox', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
        });
        const b = detectBrowser();
        assert.equal(b.isFirefox, true);
        assert.equal(b.isChrome, false);
    });

    it('recognizes Opera (OPR)', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
        });
        const b = detectBrowser();
        assert.equal(b.isOpera, true);
    });

    it('recognizes IE via Trident', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
        });
        assert.equal(detectBrowser().isIE, true);
    });

    // Modern Edge is "Edg/" — guard against regressing to legacy "Edge/".
    it('recognizes Chromium Edge ("Edg/")', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        });
        const b = detectBrowser();
        assert.equal(b.isEdge, true);
        assert.equal(b.isChrome, true, 'Edge is Chromium-based; isChrome marks engine, not vendor');
        assert.equal(b.isSafari, false);
    });

    // iOS Chrome ("CriOS/") is a WebKit wrapper — must not register as
    // Safari just because the UA carries a trailing "Safari/" token.
    it('does not classify iOS Chrome (CriOS) as Safari', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
        });
        const b = detectBrowser();
        assert.equal(b.isSafari, false);
        assert.equal(b.isChrome, false, 'iOS Chrome is a WebKit wrapper, not Chromium');
    });

    it('does not classify iOS Firefox (FxiOS) as Safari', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',
        });
        const b = detectBrowser();
        assert.equal(b.isSafari, false);
        assert.equal(b.isFirefox, true);
    });
});

describe('detectOS()', () => {
    it('recognizes macOS', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        });
        const os = detectOS();
        assert.equal(os.isMac, true);
        assert.equal(os.isWindows, false);
        assert.equal(os.isIOS, false);
    });

    it('recognizes Windows', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        });
        const os = detectOS();
        assert.equal(os.isWindows, true);
        assert.equal(os.isMac, false);
    });

    it('recognizes Linux (not Android)', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        });
        const os = detectOS();
        assert.equal(os.isLinux, true);
        assert.equal(os.isAndroid, false);
    });

    it('recognizes Android as not Linux', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36',
        });
        const os = detectOS();
        assert.equal(os.isAndroid, true);
        assert.equal(os.isLinux, false, 'Android should not also register as Linux');
    });

    it('recognizes iOS (iPhone)', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        });
        const os = detectOS();
        assert.equal(os.isIOS, true);
    });

    // iPhone UA contains "Mac OS X" — without the iOS-first guard it would
    // also flag as macOS.
    it('does not classify iPhone as macOS', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        });
        const os = detectOS();
        assert.equal(os.isIOS, true);
        assert.equal(os.isMac, false, 'iPhone UA contains "Mac OS X" but the device is iOS, not macOS');
    });

    // iPadOS 13+ ships an identical UA to macOS Safari; touch capability
    // is the only reliable distinguisher.
    it('recognizes iPadOS 13+ disguised as macOS (touch capability)', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            maxTouchPoints: 5,
        });
        const os = detectOS();
        assert.equal(os.isIOS, true);
        assert.equal(os.isMac, false, 'iPad on iPadOS 13+ must be classified as iOS, not macOS');
    });

    // Same UA as the iPad above with no touch — pins the disambiguation.
    it('keeps desktop Mac classified as macOS when no touch is present', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            maxTouchPoints: 0,
        });
        const os = detectOS();
        assert.equal(os.isMac, true);
        assert.equal(os.isIOS, false);
    });

    it('does not classify Chrome OS as Linux', () => {
        setNavigator({
            userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const os = detectOS();
        assert.equal(os.isLinux, false, 'Chromebook UA carries "CrOS"; it is not Linux desktop');
    });
});

after(() => {
    delete globalThis.window;
});

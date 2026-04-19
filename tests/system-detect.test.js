import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';

// The tested module accesses UA / platform via window.navigator, Node environment does not have window,
// here we inject a minimal globalThis.window stub directly, the module reads the value after loading,
// so it must be injected before the import.

function setNavigator({ userAgent = '', platform = '' } = {}) {
  globalThis.window = { navigator: { userAgent, platform } };
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
});

describe('detectOS()', () => {
  it('recognizes macOS', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      platform: 'MacIntel',
    });
    const os = detectOS();
    assert.equal(os.isMac, true);
    assert.equal(os.isWindows, false);
  });

  it('recognizes Windows', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      platform: 'Win32',
    });
    const os = detectOS();
    assert.equal(os.isWindows, true);
    assert.equal(os.isMac, false);
  });

  it('recognizes Linux (not Android)', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      platform: 'Linux x86_64',
    });
    const os = detectOS();
    assert.equal(os.isLinux, true);
    assert.equal(os.isAndroid, false);
  });

  it('recognizes Android as not Linux', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36',
      platform: 'Linux armv8l',
    });
    const os = detectOS();
    assert.equal(os.isAndroid, true);
    assert.equal(os.isLinux, false, 'Android should not also register as Linux');
  });

  it('recognizes iOS', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
    });
    const os = detectOS();
    assert.equal(os.isIOS, true);
  });
});

// clean up global pollution
after(() => {
  delete globalThis.window;
});

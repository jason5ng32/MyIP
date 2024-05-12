// browserDetect.js
const detectBrowser = () => {
    const userAgent = window.navigator.userAgent;
    const isFirefox = userAgent.includes('Firefox');
    const isOpera = userAgent.includes('Opera') || userAgent.includes('OPR');
    const isIE = userAgent.includes('Trident');
    const isEdge = userAgent.includes('Edge');
    const isChrome = userAgent.includes('Chrome');
    const isSafari = userAgent.includes('Safari') && !isChrome;

    return { isFirefox, isOpera, isIE, isEdge, isChrome, isSafari };
};

const detectOS = () => {
    const platform = window.navigator.platform;
    const userAgent = window.navigator.userAgent;
    const isMac = platform.startsWith('Mac');
    const isWindows = platform.startsWith('Win');
    const isLinux = platform.includes('Linux') && !userAgent.includes('Android');
    const isAndroid = userAgent.includes('Android');
    const isIOS = /iPhone|iPad|iPod/.test(platform);

    return { isMac, isWindows, isLinux, isAndroid, isIOS };
};

export { detectBrowser, detectOS };
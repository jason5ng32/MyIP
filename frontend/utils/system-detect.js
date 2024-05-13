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
    const isMac = platform.includes('Mac') || userAgent.includes('Mac' || 'Macintosh' || 'MacIntel' || 'MacPPC' || 'Mac68K');
    const isWindows = platform.startsWith('Win') || userAgent.includes('Windows' || 'Win64' || 'Win32');
    const isLinux = platform.includes('Linux') && !userAgent.includes('Android');
    const isAndroid = userAgent.includes('Android');
    const isIOS = /iPhone|iPod|iOS/.test(platform) || userAgent.includes('iPhone' || 'iPod' || 'iOS');

    return { isMac, isWindows, isLinux, isAndroid, isIOS };
};

export { detectBrowser, detectOS };
// 引入 Google Analytics 配置
const MEASUREMENT_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID || '';

// 全局状态
let scriptInjected = false;
let eventQueue = [];

// 注入 gtag.js
function injectGAScript() {
    if (scriptInjected || !MEASUREMENT_ID || typeof window === 'undefined') return;
    scriptInjected = true;

    // 若页面已存在 gtag 脚本（例如 GTM），直接初始化即可
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
        initialiseGtag();
        return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

    script.onload = initialiseGtag;
    script.onerror = () => {
        console.warn('[GA] Failed to load gtag.js');
        scriptInjected = false;               // 允许后续重试
    };

    document.head.appendChild(script);
}

// 初始化 gtag & flush 队列
function initialiseGtag() {
    if (window.gtag) { flushQueue(); return; }

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID);

    flushQueue();
}

function flushQueue() {
    if (!window.gtag) return;
    eventQueue.forEach(args => window.gtag(...args));
    eventQueue.length = 0;                    // 清空队列
}

// 内部助手：推送或排队
function pushEvent(...args) {
    if (typeof window === 'undefined') return; // SSR 安全
    if (!scriptInjected) injectGAScript();     // 懒加载脚本

    if (window.gtag) {
        window.gtag(...args);
    } else {
        eventQueue.push(args);
    }
}

// 公共 API
const analytics = {
    /** analytics.track(action, { category, label, ... }) */
    track(action, properties = {}) {
        pushEvent('event', action, {
            event_category: properties.category ?? 'general',
            event_label: properties.label ?? '',
            ...properties
        });
    },

    /** analytics.page(url) */
    page(url) {
        pushEvent('config', MEASUREMENT_ID, { page_path: url });
    },

    /** analytics.identify(userId, traits) */
    identify(userId, traits = {}) {
        pushEvent('config', MEASUREMENT_ID, { user_id: userId, ...traits });
    }
};

// 兼容 MyIP 旧版的 helper
function trackEvent(category, action, label) {
    analytics.track(action, { category, label });
}

// 首屏初始化
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectGAScript);
    } else {
        injectGAScript();
    }
}

export { analytics, trackEvent };

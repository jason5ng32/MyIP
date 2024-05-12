import i18n from '../i18n';

// 更新网页标题和元数据的函数
function updateMeta() {
    // 使用 i18n.global.t 来获取翻译后的值
    document.title = i18n.global.t('page.title');

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaKeywords) {
        metaKeywords.setAttribute('content', i18n.global.t('page.keywords'));
    }
    if (metaDescription) {
        metaDescription.setAttribute('content', i18n.global.t('page.description'));
    }
}

// 设置语言的函数，Fallback 顺序：URL 参数 hl -> 浏览器语言 -> 默认语言
function setLanguage() {
    const searchParams = new URLSearchParams(window.location.search);
    const browserLanguage = navigator.language || navigator.userLanguage;
    const hl = searchParams.get('hl');
    if (hl && ['en', 'zh', 'fr'].includes(hl)) {
        i18n.global.locale = hl;
    } else if (!hl) {
        const bl = browserLanguage.substring(0, 2);
        if (['en', 'zh', 'fr'].includes(bl)) {
            i18n.global.locale = bl;
        } else {
            i18n.global.locale = 'en';
        }
    }
    updateMeta();
    return i18n.global.locale;
}

export { updateMeta, setLanguage };
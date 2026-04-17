// 平滑滚动到指定元素（支持传元素或 id 字符串）
export function scrollToElement(el, offset = 0) {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (!element) return;
    const y = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
}

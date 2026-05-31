// Smooth scroll to specified element (supports passing element or id string)
export function scrollToElement(el, offset = 0) {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (!element) return;
    const y = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
}

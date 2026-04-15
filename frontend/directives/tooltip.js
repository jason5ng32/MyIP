// v-tooltip 指令（refactor/01 阶段 B：原 Bootstrap Tooltip 已移除）
//
// 保持原 API 兼容：
//   v-tooltip="'纯字符串'"                                 → title 字符串，默认左侧
//   v-tooltip="{ title: '...', placement: 'top|bottom|left|right' }"
//
// 行为：hover 或 focus 时创建一个 teleport 到 body 的 tooltip 节点，
// mouseleave / blur 时销毁。移动端直接跳过（与原行为一致）。

import { useMainStore } from '@/store';

// 每个元素的 handler 引用，用于 beforeUnmount 清理
const BOUND = new WeakMap();

function createTooltipEl(text) {
  const el = document.createElement('div');
  el.setAttribute('role', 'tooltip');
  el.className =
    'jn-tooltip pointer-events-none fixed z-[10003] rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap opacity-0 transition-opacity duration-150';
  el.textContent = text;
  return el;
}

function positionTooltip(tipEl, targetEl, placement) {
  const rect = targetEl.getBoundingClientRect();
  const tRect = tipEl.getBoundingClientRect();
  const gap = 6;
  let top = 0;
  let left = 0;
  switch (placement) {
    case 'top':
      top = rect.top - tRect.height - gap;
      left = rect.left + (rect.width - tRect.width) / 2;
      break;
    case 'bottom':
      top = rect.bottom + gap;
      left = rect.left + (rect.width - tRect.width) / 2;
      break;
    case 'right':
      top = rect.top + (rect.height - tRect.height) / 2;
      left = rect.right + gap;
      break;
    case 'left':
    default:
      top = rect.top + (rect.height - tRect.height) / 2;
      left = rect.left - tRect.width - gap;
      break;
  }
  // 视窗内夹紧
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left < 4) left = 4;
  if (left + tRect.width > vw - 4) left = vw - tRect.width - 4;
  if (top < 4) top = 4;
  if (top + tRect.height > vh - 4) top = vh - tRect.height - 4;
  tipEl.style.top = `${top}px`;
  tipEl.style.left = `${left}px`;
}

function parseBinding(value) {
  if (typeof value === 'string') {
    return { title: value, placement: 'left' };
  }
  if (value && typeof value === 'object') {
    return { placement: 'left', ...value };
  }
  return { title: '', placement: 'left' };
}

export const tooltip = {
  mounted(el, binding) {
    // Pinia 在 main.js 里已先于任何组件 mount 装载完，这里可以安全使用
    const store = useMainStore();
    if (store.isMobile) return;

    let opts = parseBinding(binding.value);
    if (!opts.title) return;

    let tipEl = null;

    const show = () => {
      if (tipEl) return;
      tipEl = createTooltipEl(opts.title);
      document.body.appendChild(tipEl);
      positionTooltip(tipEl, el, opts.placement);
      // 两帧保证初始位置渲染完再 fade in
      requestAnimationFrame(() => {
        if (tipEl) tipEl.style.opacity = '1';
      });
    };

    const hide = () => {
      if (tipEl) {
        tipEl.remove();
        tipEl = null;
      }
    };

    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('blur', hide);

    BOUND.set(el, { show, hide, updateOpts: (v) => { opts = parseBinding(v); } });
  },

  updated(el, binding) {
    const handlers = BOUND.get(el);
    if (handlers) handlers.updateOpts(binding.value);
  },

  beforeUnmount(el) {
    const handlers = BOUND.get(el);
    if (!handlers) return;
    el.removeEventListener('mouseenter', handlers.show);
    el.removeEventListener('focus', handlers.show);
    el.removeEventListener('mouseleave', handlers.hide);
    el.removeEventListener('blur', handlers.hide);
    handlers.hide();
    BOUND.delete(el);
  },
};

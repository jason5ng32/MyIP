// shadcn-vue cn() 帮助函数：合并 class，处理 Tailwind 冲突
// 见 refactor/01

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

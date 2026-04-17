import { cva } from 'class-variance-authority';

// Badge 本身是展示元素，默认不应响应 hover（shadcn 原版 variants 里写了 hover:bg-*/80，
// 那是为"Badge 被包进 <a> / <button>"预留的，裸用时反而是 bug）。这里移除。
// 需要 interactive 效果的场景，在外层 <a class="hover:..."> 控制。
export const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground',
        success: 'border-transparent bg-success text-success-foreground shadow',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

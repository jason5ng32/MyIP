<script setup>
// shadcn-vue Button Group：把一组 Button 视觉上拼接成一体
// - 相邻 Button 的内侧 border / rounding 取消，外侧保留；-ml-px 让 border 重叠不加粗
// - 支持 horizontal（默认）/ vertical
// 用法：<ButtonGroup><Button variant="outline">A</Button><Button ...>B</Button></ButtonGroup>
// 常见搭配 Tab 语义时：active 项 variant="default"，其他 variant="outline"
import { cn } from '@/lib/utils';

defineProps({
  orientation: { type: String, default: 'horizontal' }, // 'horizontal' | 'vertical'
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <div
    role="group"
    data-slot="button-group"
    :data-orientation="orientation"
    :class="cn(
      'inline-flex w-fit items-stretch',
      '[&>*]:focus-visible:relative [&>*]:focus-visible:z-10',
      // 横向：去掉相邻 Button 的内侧 rounding + 用负 margin 折叠相邻 border
      'data-[orientation=horizontal]:flex-row',
      'data-[orientation=horizontal]:[&>*:not(:first-child)]:rounded-l-none',
      'data-[orientation=horizontal]:[&>*:not(:last-child)]:rounded-r-none',
      'data-[orientation=horizontal]:[&>*:not(:first-child)]:-ml-px',
      // 纵向
      'data-[orientation=vertical]:flex-col',
      'data-[orientation=vertical]:[&>*:not(:first-child)]:rounded-t-none',
      'data-[orientation=vertical]:[&>*:not(:last-child)]:rounded-b-none',
      'data-[orientation=vertical]:[&>*:not(:first-child)]:-mt-px',
      $props.class,
    )"
  >
    <slot />
  </div>
</template>

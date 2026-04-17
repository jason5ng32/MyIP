// 统一的"状态 → 视觉"映射：4 档 tone 共享同一套色
//
//   wait     等待/未执行     sky
//   ok-fast  成功 + 快       green
//   ok-slow  成功 + 慢       amber
//   fail     失败/超时       red
//
// 各模块自己把业务状态（e.g. test.status === 'Available' && test.time < 200）
// 映射到这 4 档 tone，然后调用 dotClass(tone) / textClass(tone) 拿到对应的
// Tailwind class。这样 Connectivity / WebRTC / DnsLeak / 未来其他类似模块
// 都走同一套视觉语言，一处调色全站生效。

export const dotColorMap = {
    'wait':    'bg-sky-500',
    'ok-fast': 'bg-green-500',
    'ok-slow': 'bg-amber-500',
    'fail':    'bg-red-500',
};

export const textColorMap = {
    'wait':    'text-muted-foreground',
    'ok-fast': 'text-green-600 dark:text-green-400',
    'ok-slow': 'text-amber-600 dark:text-amber-400',
    'fail':    'text-red-600 dark:text-red-400',
};

export function useStatusTone() {
    return {
        dotClass:  (tone) => dotColorMap[tone]  || dotColorMap.wait,
        textClass: (tone) => textColorMap[tone] || textColorMap.wait,
    };
}

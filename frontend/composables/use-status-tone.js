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

// 统一走 style.css 里定义的语义 token：bg-info / bg-success / bg-warning /
// bg-destructive。每个 token 明暗模式都已经在 :root / .dark 下配好
// （light = *-500、dark = *-400），所以用这些 class 的地方不需要再写 dark: 变体
export const dotColorMap = {
    'wait':    'bg-info',
    'ok-fast': 'bg-success',
    'ok-slow': 'bg-warning',
    'fail':    'bg-destructive',
};

export const textColorMap = {
    'wait':    'text-muted-foreground',
    'ok-fast': 'text-success',
    'ok-slow': 'text-warning',
    'fail':    'text-destructive',
};

export function useStatusTone() {
    return {
        dotClass:  (tone) => dotColorMap[tone]  || dotColorMap.wait,
        textClass: (tone) => textColorMap[tone] || textColorMap.wait,
    };
}

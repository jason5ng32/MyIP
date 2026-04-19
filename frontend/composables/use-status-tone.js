// Unified "state → visual" mapping: 4 tone levels share the same color scheme
//
//   wait     waiting/not executed     sky
//   ok-fast  success + fast       green
//   ok-slow  success + slow       amber
//   fail     failure/timeout       red
//
// Each module maps its business status (e.g. test.status === 'Available' && test.time < 200)
// to these 4 tone levels, then calls dotClass(tone) / textClass(tone) to get the corresponding
// Tailwind class. This way Connectivity / WebRTC / DnsLeak / future similar modules
// all use the same visual language, and the color scheme is applied throughout the site.
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

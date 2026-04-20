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

// Unified "IP/MAC/status string → tone" mapping for card-like rows.
//
// Four call sites share the same shape: a single string value that's either
// a "wait" sentinel (localized), an "error" sentinel (localized), or a
// successful payload (IP/host). Business variations are expressed via
// options rather than by copying the whole function:
//
//   - waitLabels / errorLabels: single string or array; compared by ===
//   - isSuccess(value): custom predicate for "this value represents a
//       successful result". Default checks for IP-shaped tokens (contains
//       '.' or ':'), which fits WebRTC / DnsLeak / RuleTest. Connectivity
//       passes a custom predicate based on its localized "Available" label.
//   - time / fastMs: if time is a number, success splits into ok-fast
//       (< fastMs) vs ok-slow; otherwise success is flat 'ok-fast'.
export function ipFieldTone(value, {
    waitLabels = [],
    errorLabels = [],
    isSuccess = defaultIsSuccess,
    time,
    fastMs = 200,
} = {}) {
    const waits = asArray(waitLabels);
    const errs  = asArray(errorLabels);
    if (waits.includes(value)) return 'wait';
    if (errs.includes(value))  return 'fail';
    if (isSuccess(value)) {
        if (typeof time === 'number') return time < fastMs ? 'ok-fast' : 'ok-slow';
        return 'ok-fast';
    }
    return 'wait';
}

function asArray(x) {
    if (Array.isArray(x)) return x;
    if (x == null) return [];
    return [x];
}

function defaultIsSuccess(v) {
    return typeof v === 'string' && (v.includes('.') || v.includes(':'));
}

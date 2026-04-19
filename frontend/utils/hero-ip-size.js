// Shared Hero IP font-size helper.
// IPv6 strings are longer than IPv4; on narrow mobile screens they need a
// smaller tier to fit without truncating, but at md+ both converge so IPv4
// and IPv6 cards feel balanced side by side.
export function heroIpSizeClass(ip) {
    const len = typeof ip === 'string' ? ip.length : 0;
    if (len >= 25) return 'text-sm md:text-xl';
    return 'text-xl';
}

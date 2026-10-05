// Shared parser for Cloudflare /cdn-cgi/trace responses (key=value lines).
//
// Every trace consumer — the getips/ IP sources, SpeedTest, RuleTest — goes
// through this instead of hand-splitting lines. Values are trimmed because a
// body that crossed a rewriting middlebox (TLS-decrypting proxy, corporate
// gateway) can arrive with CRLF line endings, and a trailing "\r" on the ip
// value would fail IP validation downstream.

// Parse a trace body into a { key: value } map. Non-string input yields {}.
// Each line splits on its first "=" only (values may themselves contain "=");
// keys and values are trimmed; lines without a key are skipped. Missing keys
// simply stay absent, so callers read them as undefined.
export const parseTrace = (text) => {
    const fields = {};
    if (typeof text !== 'string') return fields;
    for (const line of text.split('\n')) {
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        if (!key) continue;
        fields[key] = line.slice(eq + 1).trim();
    }
    return fields;
};

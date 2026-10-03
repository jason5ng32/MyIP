// Parse a typed AS number ('AS13335' / '13335') for the tools that take one
// (Whois, ASN Profile). Grammar and range match normalizeAsnQuery in
// common/guards.js: up to ten digits, AS1 … AS4294967295.

export const MAX_ASN = 4294967295;

// → the ASN as a number, or null. Surrounding spaces are ignored and the
// `AS` prefix is case-insensitive; `requirePrefix` rejects a bare number
// (the Whois box, where digits alone are not an AS query).
export const parseAsnInput = (raw, { requirePrefix = false } = {}) => {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    const pattern = requirePrefix ? /^AS(\d+)$/i : /^(?:AS)?(\d+)$/i;
    const match = pattern.exec(String(raw).trim());
    if (!match || match[1].length > 10) return null;
    const asn = Number(match[1]);
    return asn >= 1 && asn <= MAX_ASN ? asn : null;
};

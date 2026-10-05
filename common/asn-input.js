// The AS-number grammar shared by the ASN guards (server/guards.js) and the
// tools that take a typed AS number (Whois, ASN Profile — via the
// frontend/utils/asn-input.js bridge): up to ten digits, AS1 … AS4294967295,
// `AS` prefix case-insensitive.

export const MAX_ASN = 4294967295;

// → the ASN as a number (leading zeros dropped), or null. Surrounding spaces
// are ignored; `requirePrefix` rejects a bare number (the Whois box, where
// digits alone are not an AS query).
export const parseAsnInput = (raw, { requirePrefix = false } = {}) => {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    const pattern = requirePrefix ? /^AS(\d+)$/i : /^(?:AS)?(\d+)$/i;
    const match = pattern.exec(String(raw).trim());
    if (!match || match[1].length > 10) return null;
    const asn = Number(match[1]);
    return asn >= 1 && asn <= MAX_ASN ? asn : null;
};

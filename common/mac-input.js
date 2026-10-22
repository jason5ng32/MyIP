// MAC Lookup query parsing, shared by the /api/macchecker handler and the
// MacChecker form (via frontend/utils/features/mac-input.js). A query is a
// full 48-bit address or any leading part of one, down to a 24-bit vendor
// prefix, in the usual notations: colon / hyphen pairs, Cisco dotted quads,
// or bare hex.

export const MAC_HEX_LENGTH = 12;
export const MAC_PREFIX_MIN_HEX = 6;

// Separators accepted between hex digits: `:` `-` `.` and whitespace.
const SEPARATORS = /[\s:.-]/g;

/**
 * Upper-case bare hex of a full address or a prefix (6–12 hex digits), or
 * null for anything else.
 */
export const normalizeMacQuery = (input) => {
    if (typeof input !== 'string') return null;
    const hex = input.replace(SEPARATORS, '').toUpperCase();
    if (hex.length < MAC_PREFIX_MIN_HEX || hex.length > MAC_HEX_LENGTH) return null;
    return /^[0-9A-F]+$/.test(hex) ? hex : null;
};

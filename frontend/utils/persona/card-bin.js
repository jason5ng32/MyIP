// Input rules for the card issuer prefix. Only the first 6-8 digits are ever
// handled: they identify the issuing bank, not the account, and the input
// renders exactly BIN_MAX_LENGTH digit boxes so the cap is structural.

export const BIN_MIN_LENGTH = 6;
export const BIN_MAX_LENGTH = 8;

const BIN_RE = new RegExp(`^\\d{${BIN_MIN_LENGTH},${BIN_MAX_LENGTH}}$`);

export const isValidBin = (value) => typeof value === 'string' && BIN_RE.test(value);

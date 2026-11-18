// Build-time endpoints the Invisibility Test and Enhanced DNS Leak Test probe from the browser.
const env = import.meta.env ?? {};

export const INVISIBILITY_TEST_SCRIPT_URL = env.VITE_INVISIBILITY_TEST_SCRIPT_URL || '';
export const DNS_LEAK_TEST_DOMAIN = env.VITE_DNS_LEAK_TEST_DOMAIN || '';

// Capability facts for the tool gates (store `capabilities`).
export const PROBE_CAPABILITIES = Object.freeze({
    invisibilityProbe: INVISIBILITY_TEST_SCRIPT_URL !== '',
    dnsLeakProbe: DNS_LEAK_TEST_DOMAIN !== '',
});

// Whether this page is served from the upstream IPCheck.ing site.

export const UPSTREAM_HOSTNAMES = Object.freeze([
    'ipcheck.ing',
    'www.ipcheck.ing',
    'localtest.ipcheck.ing',
    'dev.ipcheck.ing',
    'test.ipcheck.ing',
]);

export const isUpstreamSite = (hostname = globalThis.location?.hostname) =>
    UPSTREAM_HOSTNAMES.includes(hostname);

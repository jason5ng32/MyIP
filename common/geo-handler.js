// Factory for IP-geolocation source handlers.
//
// Every geo source (ipinfo.io, ip-api.com, ipapi.is, ip2location.io, ip.sb)
// shares an identical Express shell: read the (already-validated) ?ip,
// build a source-specific URL, fetch it through fetchUpstream, normalize the
// upstream JSON into the canonical response shape, and respond — with a
// uniform try/catch that logs the error and returns a 500.
//
// makeGeoHandler captures that shell. Each source supplies only:
//   - name      : short id used in the error log message
//   - buildUrl  : (req) => string URL  OR  { url, logContext } when the
//                 handler wants extra fields (e.g. lang) on the error log
//   - normalize : (json) => canonical response object
//
// buildUrl runs before the try block so any env-key selection it performs
// keeps its current behavior (e.g. throwing on a missing key surfaces the
// same way the original inline handlers did).

import { fetchUpstream } from './fetch-with-timeout.js';
import logger from './logger.js';

export function makeGeoHandler({ name, buildUrl, normalize }) {
    return async (req, res) => {
        // IP presence + validity guaranteed by requireValidIP middleware.
        const ipAddress = req.query.ip;

        const built = buildUrl(req);
        const url = typeof built === 'string' ? built : built.url;
        const logContext = typeof built === 'string' ? {} : (built.logContext || {});

        try {
            const apiRes = await fetchUpstream(url);
            const json = await apiRes.json();
            res.json(normalize(json));
        } catch (e) {
            logger.error({ err: e, ip: ipAddress, ...logContext }, `${name} handler failed`);
            res.status(500).json({ error: e.message });
        }
    };
}

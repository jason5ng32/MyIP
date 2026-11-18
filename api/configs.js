// Validate environment variables exist to enable/disable frontend features
import { isReportSharingConfigured } from './share-report.js';
import { bulkLookupSource } from '../server/bulk-lookup-sources.js';

export default (req, res) => {
    // defensive; app.get() in backend-server.js already gates method, but a
    // dedicated smoke test asserts this branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // IPINFO_API_TOKEN / CLOUDFLARE_API are the pre-rename spellings — keep
    // reading them so existing deployments keep their features on upgrade.
    const envConfigs = {
        map: process.env.GOOGLE_MAP_API_KEY,
        ipInfo: process.env.IPINFO_API_KEY || process.env.IPINFO_API_TOKEN,
        ipChecking: process.env.IPCHECKING_API_KEY && process.env.IPCHECKING_API_ENDPOINT,
        ip2location: process.env.IP2LOCATION_API_KEY,
        cloudFlare: process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API,
        ipapiis: process.env.IPAPIIS_API_KEY,
        // Share-link feature gate: all three CLOUDFLARE_* KV variables present.
        reportSharing: isReportSharingConfigured(),
    };
    let result = {};
    for (const key in envConfigs) {
        result[key] = !!envConfigs[key];
    }
    // The one non-boolean: which source the Bulk IP Lookup page names.
    result.bulkLookupSource = bulkLookupSource().id;
    res.status(200).json(result);
};
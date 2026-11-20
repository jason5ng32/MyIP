// Validate environment variables exist to enable/disable frontend features
import { isReportSharingConfigured } from './share-report.js';
import { bulkLookupSource } from '../server/bulk-lookup-sources.js';
import { ipSourceFlags } from './ip-sources.js';
import { isUserStorageConfigured } from '../server/db/user-storage.js';

export default (req, res) => {
    // defensive; app.get() in backend-server.js already gates method, but a
    // dedicated smoke test asserts this branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const envConfigs = {
        map: process.env.GOOGLE_MAP_API_KEY,
        // One flag per IP source that needs configuration (api/ip-sources.js).
        ...ipSourceFlags(),
        // CLOUDFLARE_API is the pre-rename spelling — keep reading it so
        // existing deployments keep their features on upgrade.
        cloudFlare: process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API,
        // Share-link feature gate: all three CLOUDFLARE_* KV variables present.
        reportSharing: isReportSharingConfigured(),
        // Configured, not ready: this answer is edge-cached.
        userStorage: isUserStorageConfigured(),
    };
    let result = {};
    for (const key in envConfigs) {
        result[key] = !!envConfigs[key];
    }
    // The one non-boolean: which source the Bulk IP Lookup page names.
    result.bulkLookupSource = bulkLookupSource().id;
    res.status(200).json(result);
};
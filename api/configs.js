// Validate environment variables exist to enable/disable frontend features
export default (req, res) => {
    // defensive; app.get() in backend-server.js already gates method, but a
    // dedicated smoke test asserts this branch directly against the handler.
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Referer has already been validated by requireReferer middleware. Here we
    // just read it to classify whether the caller is the canonical ipcheck.ing
    // deployment ("originalSite") or someone self-hosting a fork.
    const referer = req.headers.referer;
    const hostname = referer ? new URL(referer).hostname : '';
    const allowedHostnames = ['ipcheck.ing', 'www.ipcheck.ing', 'localtest.ipcheck.ing', 'dev.ipcheck.ing', 'test.ipcheck.ing'];
    const originalSite = allowedHostnames.includes(hostname);

    const envConfigs = {
        map: process.env.GOOGLE_MAP_API_KEY,
        ipInfo: process.env.IPINFO_API_TOKEN,
        ipChecking: process.env.IPCHECKING_API_KEY,
        ip2location: process.env.IP2LOCATION_API_KEY,
        originalSite,
        cloudFlare: process.env.CLOUDFLARE_API,
        ipapiis: process.env.IPAPIIS_API_KEY,
    };
    let result = {};
    for (const key in envConfigs) {
        result[key] = !!envConfigs[key];
    }
    res.status(200).json(result);
};
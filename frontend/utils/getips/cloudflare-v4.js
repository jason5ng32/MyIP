import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { parseTrace } from '@/utils/parse-trace.js';
import { getIPFromMyExternalIP_V4 } from "./myexternalip-v4";

// Get IPv4 address from Cloudflare
const getIPFromCloudflare_V4 = async () => {
    try {
        const response = await fetchWithTimeout("https://1.0.0.1/cdn-cgi/trace");
        const data = await response.text();
        const ip = parseTrace(data).ip ?? "";
        const source = "Cloudflare IPv4";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else { 
            console.warn("Invalid IP from Cloudflare:", ip);
            return {
                ip: null,
                source: source
            };
        }
    } catch (error) {
        console.warn("Error fetching IP from Cloudflare:", error);
    }
    // Fallback
    const { ip, source } = await getIPFromMyExternalIP_V4();
    return {
        ip: ip,
        source: source
    };
};

export { getIPFromCloudflare_V4 };
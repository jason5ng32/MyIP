import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { parseTrace } from '@/utils/parse-trace.js';
import { getIPFromMyExternalIP_V6 } from "./myexternalip-v6";

// Get IPv6 address from Cloudflare
const getIPFromCloudflare_V6 = async () => {
    try {
        const response = await fetchWithTimeout("https://[2606:4700:4700::1111]/cdn-cgi/trace");
        const data = await response.text();
        const ip = parseTrace(data).ip ?? "";
        const source = "Cloudflare IPv6";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else { 
            console.warn("Invalid IP from Cloudflare IPv6:", ip);
            return {
                ip: null,
                source: source
            };
        }
    } catch (error) {
        console.warn("Error fetching IP from Cloudflare IPv6:", error);
    }
    // Fallback
    const { ip, source } = await getIPFromMyExternalIP_V6();
    return {
        ip: ip,
        source: source
    };
};

export { getIPFromCloudflare_V6 };
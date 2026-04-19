import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { getIPFromMyExternalIP_V6 } from "./myexternalip-v6";

// Get IPv6 address from Cloudflare
const getIPFromCloudflare_V6 = async () => {
    try {
        const response = await fetchWithTimeout("https://[2606:4700:4700::1111]/cdn-cgi/trace");
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        let ip = "";
        if (ipLine) {
            ip = ipLine.split("=")[1];
        }
        const source = "Cloudflare IPv6";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else { 
            console.error("Invalid IP from Cloudflare:", ip);
            return {
                ip: null,
                source: source
            };
        }
    } catch (error) {
        console.error("Error fetching IP from Cloudflare:", error);
    }
    // Fallback
    const { ip, source } = await getIPFromMyExternalIP_V6();
    return {
        ip: ip,
        source: source
    };
};

export { getIPFromCloudflare_V6 };
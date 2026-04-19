import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';

// Get IP address from Cloudflare China
const getIPFromCloudflare_CN = async () => {
    try {
        const response = await fetchWithTimeout("https://cf-ns.com/cdn-cgi/trace");
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        let ip = "";
        if (ipLine) {
            ip = ipLine.split("=")[1];
        }
        const source = "CF-CN";
        if (isValidIP(ip)) {
            return { ip: ip, source: source };
        } else {
            return { ip: null, source: source };
        }
    } catch (error) {
        console.error("Error fetching IP from Cloudflare:", error);
        return {
            ip: null,
            source: "CF-CN"
        };
    }
};

export { getIPFromCloudflare_CN };
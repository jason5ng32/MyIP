import { getIPFromUpai } from "./upai";
import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';

// Get IP address from IPIP.net
const getIPFromIPIP = async () => {
    try {
        const response = await fetchWithTimeout("https://myip.ipip.net/json");
        const data = await response.json();
        const ip = data.data.ip;
        const source = "IPIP.net";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else {
            console.error("Invalid IP from IPIP.net:", ip);
        }
    } catch (error) {
        console.error("Error fetching IP from IPIP.net:", error);
    }
    // Fallback
    const { ip, source } = await getIPFromUpai();
    return {
        ip: ip,
        source: source
    };
};

export { getIPFromIPIP };
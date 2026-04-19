import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';

// Get IP address from Upai
const getIPFromUpai = async () => {
    try {
        const unixTime = Date.now();
        const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${unixTime}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.json();
        const ip = data.remote_addr;
        const source = "Upai";
        if (isValidIP(ip)) {
            return { ip: ip, source: source };
        } else {
            console.error("Invalid IP from Upai:", ip);
        }
    } catch (error) {
        console.error("Error fetching IP from Upai:", error);
    }
};

export { getIPFromUpai };
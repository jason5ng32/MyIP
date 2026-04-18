import { isValidIP } from '@/utils/valid-ip.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';

// 从 MyExternalIP 获取 IPv4 地址
const getIPFromMyExternalIP_V4 = async () => {
    try {
        const response = await fetchWithTimeout("https://ipv4.myexternalip.com/json");
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.json();
        const ip = data.ip;
        const source = "MyExternalIP IPv4";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else { 
            console.error("Invalid IP from MyExternalIP:", ip);
            return {
                ip: null,
                source: source
            };
        }
    } catch (error) {
        console.error("Error fetching IPv4 address from MyExternalIP:", error);
        return {
            ip: null,
            source: "MyExternalIP IPv4"
        };
    }
};

export { getIPFromMyExternalIP_V4 };
import { isValidIP } from '@/utils/valid-ip.js';

// 从 IPify 获取 IPv4 地址
const getIPFromIpify_V4 = async () => {
    try {
        const response = await fetch("https://api4.ipify.org?format=json");
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.json();
        const ip = data.ip;
        const source = "IPify IPv4";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else { 
            console.error("Invalid IP from IPify:", ip);
            return {
                ip: null,
                source: source
            };
        }
    } catch (error) {
        console.error("Error fetching IPv4 address from ipify:", error);
        return {
            ip: null,
            source: "IPify IPv4"
        };
    }
};

export { getIPFromIpify_V4 };
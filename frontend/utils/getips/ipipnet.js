// import { getIPFromQQ } from "./qqvideo";
import { getIPFromAliCDN } from "./alicdn";
import { isValidIP } from '@/utils/valid-ip.js';

// 从 IPIP.net 获取 IP 地址
const getIPFromIPIP = async () => {
    try {
        const response = await fetch("https://myip.ipip.net/json");
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
    // 故障时尝试从 AliCDN 获取 IP 地址
    const { ip, source } = await getIPFromAliCDN();
    return {
        ip: ip,
        source: source
    };
};

export { getIPFromIPIP };
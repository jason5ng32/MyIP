import { isValidIP } from '@/utils/valid-ip.js';

// 从 IPCheck.ing 获取 IPv6 地址
const getIPFromIPChecking64 = async () => {
    try {
        const response = await fetch("https://64.ipcheck.ing/cdn-cgi/trace");
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        let ip = "";
        if (ipLine) {
            ip = ipLine.split("=")[1];
        }
        const source = "IPCheck.ing IPv6/4";
        if (isValidIP(ip)) {
            return {
                ip: ip,
                source: source
            };
        } else { 
            console.error("Invalid IP from IPCheck.ing IPv6/4:", ip);
            return {
                ip: null,
                source: source
            };
        }
    } catch (error) {
        console.error("Error fetching IP from IPCheck.ing IPv6/4:", error);
        return { 
            ip: null, 
            source: "IPCheck.ing IPv6/4" 
        };
    }
};

export { getIPFromIPChecking64 };
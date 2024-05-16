import { isValidIP } from '@/utils/valid-ip.js';

// 从 Cloudflare 获取 IPv4 地址
const getIPFromCloudflare_V4 = async () => {
    try {
        const response = await fetch("https://1.0.0.1/cdn-cgi/trace");
        const data = await response.text();
        const lines = data.split("\n");
        const ipLine = lines.find((line) => line.startsWith("ip="));
        let ip = "";
        if (ipLine) {
            ip = ipLine.split("=")[1];
        }
        const source = "Cloudflare IPv4";
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
        return {
            ip: null,
            source: "Cloudflare IPv4"
        };
    }
};

export { getIPFromCloudflare_V4 };
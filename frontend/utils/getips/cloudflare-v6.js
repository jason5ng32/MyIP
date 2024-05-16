import { isValidIP } from '@/utils/valid-ip.js';

// 从 Cloudflare 获取 IPv6 地址
const getIPFromCloudflare_V6 = async () => {
    try {
        const response = await fetch("https://[2606:4700:4700::1111]/cdn-cgi/trace");
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
        return { 
            ip: null, 
            source: "Cloudflare IPv6" 
        };
    }
};

export { getIPFromCloudflare_V6 };
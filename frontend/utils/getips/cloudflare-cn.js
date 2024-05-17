import { isValidIP } from '@/utils/valid-ip.js';

// 从 Cloudflare 中国获取 IP 地址
const getIPFromCloudflare_CN = async () => {
    try {
        const response = await fetch("https://cf-ns.com/cdn-cgi/trace");
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
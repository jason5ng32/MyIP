import { getIPFromCloudflare_CN } from "./cloudflare-cn";
import { isValidIP } from '@/utils/valid-ip.js';

// 从 Upai 获取 IP 地址
const getIPFromUpai = async () => {
    try {
        const unixTime = Date.now();
        const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${unixTime}`;
        const response = await fetch(url);
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

    // 故障时尝试从 Cloudflare 中国获取 IP 地址
    const { ip, source } = await getIPFromCloudflare_CN();
    return {
        ip: ip,
        source: source
    };
};

export { getIPFromUpai };
import { getIPFromCloudflare_CN } from "./cloudflare-cn";

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
        return { ip: ip, source: source };
    } catch (error) {
        console.error("Error fetching IP from Upai:", error);
        let { ip , source } = await getIPFromCloudflare_CN();
        return {
            ip: ip,
            source: source
        };
    }
};

export { getIPFromUpai };
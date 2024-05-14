import { getIPFromQQ } from "./qqvideo";

// 从 IPIP.net 获取 IP 地址
const getIPFromIPIP = async () => {
    let ip = "";
    let source = "";
    try {
        const response = await fetch("https://myip.ipip.net/json");
        const data = await response.json();
        ip = data.data.ip;
        source = "IPIP.net";
        return {
            ip: ip,
            source: source
        };
    } catch (error) {
        console.error("Error fetching IP from IPIP.net:", error);
        // 故障时尝试从 QQ Video 获取 IP 地址
        let { ip , source } = await getIPFromQQ();
        return {
            ip: ip,
            source: source
        };
    }
};


export { getIPFromIPIP };
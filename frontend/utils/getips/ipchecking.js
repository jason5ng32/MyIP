import { getIPFromCloudflare_CN } from "./cloudflare-cn";

// 从 GCR 获取 IP 地址
const getIPFromGCR = async () => {
  try {
    const url = `https://getipfromgoogle.ipcheck.ing/`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    const fullIp = data.ip;
    const ip = fullIp.includes(',') ? fullIp.split(',')[0] : fullIp;
    const source = "IPCheck.ing";
    return {
      ip: ip,
      source: source
    };
  } catch (error) {
    console.error("Error fetching IP from IPCheck.ing:", error);
    let { ip , source } = await getIPFromCloudflare_CN();
        return {
            ip: ip,
            source: source
        };
  }
};

export { getIPFromGCR };
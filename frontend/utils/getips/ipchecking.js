import { getIPFromCloudflare_CN } from "./cloudflare-cn";
import { isValidIP } from '@/utils/valid-ip.js';

// 从 GCR 获取 IP 地址
const getIPFromGCR = async () => {
  try {
    const url = `https://getipfromgoogle.IPTool.uk/`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    const fullIp = data.ip;
    const ip = fullIp.includes(',') ? fullIp.split(',')[0] : fullIp;
    const source = "IPTool.uk";
    if (isValidIP(ip)) {
      return { ip: ip, source: source };
    } else {
      console.error("Invalid IP from IPTool.uk:", ip);
    }
  } catch (error) {
    console.error("Error fetching IP from IPTool.uk:", error);
  }

  // 故障时尝试从 Cloudflare 中国获取 IP 地址
  const { ip, source } = await getIPFromCloudflare_CN();
  return {
    ip: ip,
    source: source
  };
};

export { getIPFromGCR };
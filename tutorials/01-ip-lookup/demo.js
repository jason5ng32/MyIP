/**
 * tutorials/01-ip-lookup/demo.js
 * 
 * 完全隔离的 IP 探测链实现示例（零外部 npm 依赖）
 * 运行方式：node tutorials/01-ip-lookup/demo.js
 */

// 1. 基础校验工具：验证 IP 格式并严格区分 IPv4 / IPv6
const isValidIP = (ip) => {
  if (typeof ip !== 'string') return false;
  // IPv4 严格四段点分十进制正则 (0-255)
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
  if (ipv4Pattern.test(ip)) return true;

  // IPv6 压缩及常规格式校验
  const doubleColonParts = ip.split('::');
  if (doubleColonParts.length > 2) return false;
  const hasCompressedGroup = doubleColonParts.length === 2;
  const groups = doubleColonParts.flatMap((part) => (part === '' ? [] : part.split(':')));
  if (groups.some((group) => !/^[0-9a-fA-F]{1,4}$/.test(group))) return false;
  return hasCompressedGroup ? groups.length < 8 : groups.length === 8;
};

// 区分协议版本
const isIPv6 = (ip) => typeof ip === 'string' && ip.includes(':');
const isIPv4 = (ip) => isValidIP(ip) && !isIPv6(ip);
const isIPv6Only = (ip) => isValidIP(ip) && isIPv6(ip);

// 2. 超时 HTTP 客户端（避免某个探针卡死阻塞整条链）
const fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

// 3. 解析 Cloudflare cdn-cgi/trace 纯文本响应
const parseTrace = (text) => {
  const result = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return result;
};

// 4. 定义各类独立探针 Provider
const providers = {
  // IPv4 探针 1：IPCheck.ing 官方 IPv4 跟踪端点
  ipChecking4: {
    id: 'ipchecking-v4',
    name: 'IPCheck.ing IPv4',
    async run() {
      const res = await fetchWithTimeout('https://4.ipcheck.ing/cdn-cgi/trace');
      const text = await res.text();
      return parseTrace(text).ip ?? '';
    },
  },
  // IPv4 探针 2：Cloudflare 1.1.1.1 跟踪端点
  cloudflareV4: {
    id: 'cloudflare-v4',
    name: 'Cloudflare IPv4',
    async run() {
      const res = await fetchWithTimeout('https://1.1.1.1/cdn-cgi/trace');
      const text = await res.text();
      return parseTrace(text).ip ?? '';
    },
  },
  // IPv6 探针 1：IPCheck.ing 官方 IPv6 跟踪端点
  ipChecking6: {
    id: 'ipchecking-v6',
    name: 'IPCheck.ing IPv6',
    async run() {
      const res = await fetchWithTimeout('https://6.ipcheck.ing/cdn-cgi/trace');
      const text = await res.text();
      return parseTrace(text).ip ?? '';
    },
  },
  // IPv6 探针 2：纯 IPv6 域名的 IPify 端点
  ipifyV6: {
    id: 'ipify-v6',
    name: 'IPify IPv6 (api6)',
    async run() {
      const res = await fetchWithTimeout('https://api6.ipify.org?format=json');
      const json = await res.json();
      return json.ip ?? '';
    },
  },
};

// 5. 核心探针链调度器（支持 Validator 协议隔离）
const runChain = async (providerList, validator = isValidIP) => {
  for (const provider of providerList) {
    try {
      console.log(`    -> 尝试探测源: [${provider.name}]...`);
      const rawIp = await provider.run();
      
      // 严格校验器检查：不仅要合法，还要匹配所期望的协议版本
      if (validator(rawIp)) {
        return { ip: rawIp, source: provider.name };
      }
      console.warn(`    ⚠️ [${provider.name}] 返回的 IP 不符合预期协议: "${rawIp}"，继续回退下一源...`);
    } catch (err) {
      console.warn(`    ✕ [${provider.name}] 访问失败: ${err.message || '网络超时'}，继续回退下一源...`);
    }
  }
  // 链条全部耗尽
  return { ip: null, source: providerList[providerList.length - 1].name };
};

// 6. 执行测试
async function main() {
  console.log('==================================================');
  console.log('       MyIP 探针链与双栈隔离机制演示脚本           ');
  console.log('==================================================\n');

  // 测试 1：纯 IPv4 探测链（绑定 isIPv4 校验器）
  console.log('[测试 1] 正在请求 IPv4 探测链 (规则: 必须为纯 IPv4)...');
  const v4Chain = [providers.ipChecking4, providers.cloudflareV4];
  const v4Result = await runChain(v4Chain, isIPv4);
  console.log(`  ==> 结果: IP = ${v4Result.ip ?? '未获取到'}, 来源 = ${v4Result.source}\n`);

  // 测试 2：纯 IPv6 探测链（绑定 isIPv6Only 校验器）
  console.log('[测试 2] 正在请求 IPv6 探测链 (规则: 必须为纯 IPv6，拒绝 IPv4 混淆)...');
  const v6Chain = [providers.ipChecking6, providers.ipifyV6];
  const v6Result = await runChain(v6Chain, isIPv6Only);
  console.log(`  ==> 结果: IP = ${v6Result.ip ?? '无 IPv6 或不可达'}, 来源 = ${v6Result.source}\n`);

  console.log('==================================================');
  console.log('测试完成：协议隔离有效防止了代理环境下 IPv4 污染 IPv6 卡片。');
}

main().catch(console.error);

/**
 * tutorials/03-dns-leak/demo.js
 * 
 * 完全隔离的 DNS 泄漏检测脚本（零外部 npm 依赖）
 * 运行方式：node tutorials/03-dns-leak/demo.js
 */

// 超时 Fetch 工具函数
const fetchWithTimeout = async (url, options = {}, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

// 获取当前的网页访问出口 IP (Cloudflare Trace)
async function getCurrentEgressIP() {
  try {
    const res = await fetchWithTimeout('https://1.1.1.1/cdn-cgi/trace');
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('ip=')) return line.slice(3).trim();
    }
  } catch {
    return '获取失败';
  }
  return '未知';
}

// 核心探测函数
async function detectDnsLeaks() {
  console.log('==================================================');
  console.log('       DNS 泄漏深度检测独立演示脚本                ');
  console.log('==================================================\n');

  console.log('[步骤 1] 正在探测当前网页出口 IP...');
  const egressIP = await getCurrentEgressIP();
  console.log(`  --> 当前公网出口 IP: ${egressIP}\n`);

  console.log('[步骤 2] 向检测平台申请唯一会话 Token...');
  let testId = '';
  try {
    const idRes = await fetchWithTimeout('https://bash.ws/id');
    testId = (await idRes.text()).trim();
    console.log(`  --> 获得测试会话 ID: ${testId}`);
  } catch (err) {
    console.error(`  ✕ 无法连接检测服务器: ${err.message}`);
    return;
  }

  console.log('\n[步骤 3] 正在向专属随机子域名触发 DNS 递归查询...');
  const probeHost = `probe.1.${testId}.bash.ws`;
  console.log(`  --> 发送解析请求: https://${probeHost}/probe.css`);
  
  // 触发 DNS 递归，忽略连接本身的握手错误（重点在于让 LocalDNS 向权威 DNS 解析该域名）
  try {
    await fetchWithTimeout(`https://${probeHost}/probe.css`, { timeoutMs: 3500 });
  } catch {
    // 预期可能连接超时或拒绝，解析动作在网络层已完成
  }

  // 稍作等待以让权威 DNS 聚合日志
  console.log('  --> 等待权威服务器记录解析来源...');
  await new Promise((r) => setTimeout(r, 1200));

  console.log('\n[步骤 4] 获取实际承担解析任务的 DNS 递归服务器列表...');
  try {
    const resultRes = await fetchWithTimeout(`https://bash.ws/dnsleak/test/${testId}?json`);
    const records = await resultRes.json();

    const validNodes = records.filter(node => node && node.ip && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]+$/.test(node.ip));

    if (validNodes.length === 0) {
      console.log('  ⚠️ 未捕获到 DNS 请求，可能解析被完全拦截或本地使用了极高缓存。');
      return;
    }

    console.log(`  --> 共捕获到 ${validNodes.length} 个 DNS 递归服务器节点：\n`);

    validNodes.forEach((node, index) => {
      console.log(`  【DNS 节点 #${index + 1}】`);
      console.log(`    - IP 地址:  ${node.ip}`);
      console.log(`    - 国家/地区: ${node.country_name || node.country || '未知'}`);
      console.log(`    - 所属 ISP: ${node.asn || node.isp || '未知'}`);

      if (node.type === 'dns') {
        console.log(`    - 节点类型: 真实递归解析服务器 (Resolver)`);
      }
      console.log('');
    });

    console.log('==================================================');
    console.log('诊断评估：');
    console.log(`* 您的网页访问出口是: [${egressIP}]`);
    console.log(`* 您的 DNS 解析节点是: [${records.map(r => r.ip).join(', ')}]`);
    console.log('* 结论建议：若您开启了代理，但上述 DNS 节点显示为您的家庭直连宽带 ISP，则表明存在 DNS 泄漏风险。');
    console.log('==================================================');

  } catch (err) {
    console.error(`  ✕ 获取检测结果失败: ${err.message}`);
  }
}

detectDnsLeaks().catch(console.error);

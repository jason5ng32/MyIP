/**
 * tutorials/02-webrtc-leak/demo.js
 * 
 * 演示 ICE Candidate 解析算法与 NAT/泄漏识别（Node.js 独立运行）
 * 运行方式：node tutorials/02-webrtc-leak/demo.js
 */

const CANDIDATE_IP_RE = /[0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){7}/i;

/**
 * 解析原生 ICE Candidate 字符串
 * 典型格式：candidate:42300 1 udp 2122260223 116.23.45.67 54321 typ srflx raddr 192.168.1.10 rport 54321 ...
 */
function parseIceCandidate(candidateStr) {
  if (!candidateStr || typeof candidateStr !== 'string') return null;

  const parts = candidateStr.trim().split(/\s+/);
  if (parts.length < 8) return null;

  // 提取各字段
  const foundation = parts[0].replace(/^candidate:/, '');
  const componentId = parts[1];
  const transport = parts[2].toLowerCase();
  const priority = parts[3];
  const connectionAddress = parts[4];
  const port = parts[5];
  const typeIndex = parts.indexOf('typ');
  const type = typeIndex !== -1 ? parts[typeIndex + 1] : 'unknown';

  const raddrIndex = parts.indexOf('raddr');
  const relatedAddress = raddrIndex !== -1 ? parts[raddrIndex + 1] : null;

  const rportIndex = parts.indexOf('rport');
  const relatedPort = rportIndex !== -1 ? parts[rportIndex + 1] : null;

  const ipMatch = CANDIDATE_IP_RE.exec(connectionAddress);
  const ip = ipMatch ? ipMatch[0] : null;

  return {
    raw: candidateStr,
    type,
    transport,
    ip,
    port,
    relatedAddress,
    relatedPort,
    isReflexive: type === 'srflx' || type === 'prflx',
    isHost: type === 'host',
    isRelay: type === 'relay',
  };
}

/**
 * 根据反射端口与相关端口初步评估 NAT 行为模式
 */
function evaluateNatBehavior(parsed) {
  if (!parsed.isReflexive) return '不适用 (非反射地址)';
  if (!parsed.relatedPort) return '常规 NAT 映射';
  if (parsed.port === parsed.relatedPort) {
    return '独立映射 / 锥形 NAT (端口保持一致，P2P 连通率高)';
  }
  return '对称型 NAT / 动态端口转换 (端口被重写，P2P 打洞难度大)';
}

// 模拟采集到的实际 ICE Candidate 数据集合
const sampleCandidates = [
  'candidate:0 1 UDP 2122252543 e2e5c8e3-4632-4d2c-8822-26168536b579.local 51838 typ host',
  'candidate:1 1 UDP 2122186943 192.168.31.25 51839 typ host',
  'candidate:2 1 UDP 1686052607 183.6.90.200 51839 typ srflx raddr 192.168.31.25 rport 51839',
  'candidate:3 1 UDP 41819903 104.28.163.1 52000 typ relay raddr 183.6.90.200 rport 51839',
];

console.log('==================================================');
console.log('       WebRTC ICE Candidate 解析算法演示            ');
console.log('==================================================\n');

// 模拟当前用户访问网页时使用的出口 IP（假设用户使用了代理出口 104.28.163.235）
const proxyEgressIp = '104.28.163.235';
console.log(`[当前网页访问 IP] (代理节点): ${proxyEgressIp}\n`);

sampleCandidates.forEach((candidateStr, idx) => {
  console.log(`--- [候选报文 #${idx + 1}] ---`);
  console.log(`原始文本: ${candidateStr}`);

  const parsed = parseIceCandidate(candidateStr);
  if (!parsed) {
    console.log('解析失败\n');
    return;
  }

  console.log(`  > 候选类型: ${parsed.type}`);
  console.log(`  > 提取 IP:  ${parsed.ip ?? '未包含裸 IP (可能使用了 mDNS 掩盖)'}`);

  if (parsed.isReflexive) {
    console.log(`  > NAT 类型: ${evaluateNatBehavior(parsed)}`);
    // 泄漏判定
    if (parsed.ip && parsed.ip !== proxyEgressIp) {
      console.log(`  🚨 警告: 发生真实 IP 泄漏！`);
      console.log(`     网页出口为代理 [${proxyEgressIp}]，但 WebRTC STUN 暴露了真实公网 IP [${parsed.ip}]！`);
    }
  } else if (parsed.isHost) {
    console.log('  ℹ️  局域网 Host 候选 (现代浏览器常使用 .local mDNS 防护)');
  }

  console.log('');
});

console.log('==================================================');
console.log('结论：仅当 Candidate 类型为 "srflx" 时，提取的 IP 才是 STUN 反射公网 IP。');

/**
 * tutorials/04-speed-test/demo.js
 * 
 * 完全隔离的轻量网络测速引擎示例（零外部 npm 依赖）
 * 运行方式：node tutorials/04-speed-test/demo.js
 */

import { performance } from 'node:perf_hooks';

// 超时 Fetch 工具
const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

// 1. 探测客户端连接的边缘 CDN 节点信息
async function probeEdgeColo() {
  try {
    const res = await fetchWithTimeout('https://speed.cloudflare.com/cdn-cgi/trace');
    const text = await res.text();
    const info = {};
    for (const line of text.split('\n')) {
      const idx = line.indexOf('=');
      if (idx !== -1) info[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return {
      ip: info.ip ?? '未知',
      colo: info.colo ?? '未知机房',
      loc: info.loc ?? '未知地区',
    };
  } catch {
    return { ip: '未知', colo: '未知', loc: '未知' };
  }
}

// 2. 测量网络时延与抖动（Jitter，基于 RFC 3550 模型）
async function measureLatencyAndJitter(samples = 5) {
  console.log(`[阶段 1] 正在发起 ${samples} 轮时延（RTT）与抖动采样...`);
  const rttList = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      // 请求 0 字节 payload，仅测试纯 HTTP/TLS 握手与往返传输延迟
      await fetchWithTimeout(`https://speed.cloudflare.com/__down?bytes=0&t=${Date.now()}`, {
        cache: 'no-store',
      });
      const duration = performance.now() - start;
      rttList.push(duration);
      console.log(`    采样 #${i + 1}: ${duration.toFixed(2)} ms`);
    } catch (err) {
      console.warn(`    采样 #${i + 1} 超时失败`);
    }
    // 样本间间隔 100ms
    await new Promise((r) => setTimeout(r, 100));
  }

  if (rttList.length === 0) {
    return { avgLatency: null, minLatency: null, jitter: null };
  }

  // 计算平均时延与最低时延
  const sum = rttList.reduce((acc, v) => acc + v, 0);
  const avgLatency = sum / rttList.length;
  const minLatency = Math.min(...rttList);

  // 计算 RFC 3550 抖动（相邻测量值绝对差值的平均数）
  let jitterSum = 0;
  for (let i = 1; i < rttList.length; i++) {
    jitterSum += Math.abs(rttList[i] - rttList[i - 1]);
  }
  const jitter = rttList.length > 1 ? jitterSum / (rttList.length - 1) : 0;

  return { avgLatency, minLatency, jitter };
}

// 3. 测量下行带宽（流式吞吐量计算）
async function measureDownloadSpeed(bytes = 10_000_000) {
  const mbSize = (bytes / 1_000_000).toFixed(1);
  console.log(`\n[阶段 2] 正在启动分块下载测速 (测速包体大小: ${mbSize} MB)...`);

  const startTime = performance.now();
  let receivedBytes = 0;

  try {
    const res = await fetchWithTimeout(`https://speed.cloudflare.com/__down?bytes=${bytes}`);
    if (!res.ok) throw new Error(`HTTP 状态异常: ${res.status}`);

    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.length;
      }
    }

    const totalSeconds = (performance.now() - startTime) / 1000;
    // 吞吐量公式：Mbps = (Bytes * 8) / (Seconds * 1,000,000)
    const mbps = (receivedBytes * 8) / (totalSeconds * 1_000_000);
    const mBps = receivedBytes / (totalSeconds * 1024 * 1024);

    return {
      mbps,
      mBps,
      receivedBytes,
      totalSeconds,
    };
  } catch (err) {
    console.error(`  ✕ 下载测速中断: ${err.message}`);
    return null;
  }
}

// 主执行函数
async function runSpeedTest() {
  console.log('==================================================');
  console.log('         网络测速引擎算法独立演示脚本               ');
  console.log('==================================================\n');

  console.log('[准备] 探测当前边缘 CDN 机房与公网入口...');
  const edgeInfo = await probeEdgeColo();
  console.log(`  --> 客户端 IP: ${edgeInfo.ip}`);
  console.log(`  --> 连接边缘机房 (Colo): [${edgeInfo.colo}] (${edgeInfo.loc})\n`);

  // 1. 延迟与抖动
  const pingStats = await measureLatencyAndJitter(5);
  if (pingStats.avgLatency !== null) {
    console.log(`  ==> 平均时延 (Latency): ${pingStats.avgLatency.toFixed(2)} ms`);
    console.log(`  ==> 最小时延 (Min):     ${pingStats.minLatency.toFixed(2)} ms`);
    console.log(`  ==> 延迟抖动 (Jitter):  ${pingStats.jitter.toFixed(2)} ms`);
  }

  // 2. 带宽测速 (10MB)
  const downStats = await measureDownloadSpeed(10_000_000);
  if (downStats) {
    console.log(`  ==> 传输耗时:   ${downStats.totalSeconds.toFixed(2)} 秒`);
    console.log(`  ==> 接收数据:   ${(downStats.receivedBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  ==> 下行带宽:   ${downStats.mbps.toFixed(2)} Mbps (${downStats.mBps.toFixed(2)} MB/s)`);
  }

  console.log('\n==================================================');
  console.log('测试完成：独立测速模型已成功跑通。');
}

runSpeedTest().catch(console.error);

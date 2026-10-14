# MyIP 核心网络与隐私工具开发教程与隔离实现

本目录收录了 **MyIP (IPCheck.ing)** 中最核心的网络与隐私检测工具的**原理详解、技术实现规范与完全解耦的独立示例代码**。

每个工具模块均采用独立的文件夹组织，遵循**高内聚、零外部框架依赖**的代码隔离原则，方便独立学习、移植、集成或排查问题。

---

## 📚 工具模块索引

| 序号 | 工具模块 | 核心原理 | 关键技术点 | 独立运行代码 |
| :--- | :--- | :--- | :--- | :--- |
| **01** | [**IP 查询与双栈探测链**](./01-ip-lookup/README.md) | 递归 Fallback 探针链 + 协议严格隔离 | IPv4/IPv6 协议分离、双栈回退、Trace 解析 | [`01-ip-lookup/demo.js`](./01-ip-lookup/demo.js) |
| **02** | [**WebRTC 真实 IP 泄漏检测**](./02-webrtc-leak/README.md) | STUN 协议与 ICE Candidate 反射 | RTCPeerConnection、`srflx` 提取、mDNS 绕过分析 | [`02-webrtc-leak/demo.html`](./02-webrtc-leak/demo.html) · [`demo.js`](./02-webrtc-leak/demo.js) |
| **03** | [**DNS 泄漏深度检测**](./03-dns-leak/README.md) | 动态随机子域名泛解析追踪 | 会话 ID、权威 DNS 记录捕获、DoH 泄漏分析 | [`03-dns-leak/demo.js`](./03-dns-leak/demo.js) |
| **04** | [**网络测速引擎**](./04-speed-test/README.md) | 分块并发下载/上传 + 延迟与抖动算法 | RTT 延迟采样、Jitter 抖动计算、多阶平滑吞吐量 | [`04-speed-test/demo.js`](./04-speed-test/demo.js) |

---

## 🛠️ 代码隔离设计准则

1. **环境纯粹性**：所有示例代码均基于标准 ECMAScript 语法编写，不引入 Vite/Vue/Pinia 等前端框架依赖。
2. **开箱即用**：
   - 命令行工具：仅依赖 Node.js 原生环境（v18+ 原生 `fetch`），直接执行 `node demo.js` 即可运行。
   - 浏览器特性（如 WebRTC）：提供零依赖的独立 HTML 文件，直接在浏览器中双击打开即可观察完整过程。
3. **架构参考价值**：代码结构直接映射 MyIP 生产环境代码的核心抽象模型，保留生产级的异常重试、协议校验和降级机制。

---

## 🚀 快速开始

克隆或进入项目后，进入各工具子目录即可体验：

```bash
# 1. 测试 IP 查询与探测链
node tutorials/01-ip-lookup/demo.js

# 2. 测试 WebRTC 探测（支持浏览器与本地解析）
# 直接在浏览器打开 tutorials/02-webrtc-leak/demo.html
node tutorials/02-webrtc-leak/demo.js

# 3. 测试 DNS 泄漏探针
node tutorials/03-dns-leak/demo.js

# 4. 测试网络延迟与下载带宽
node tutorials/04-speed-test/demo.js
```

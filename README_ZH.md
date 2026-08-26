# 🧰 MyIP - 更好的 IP 工具箱

> [!NOTE]
> 这是由社区维护的翻译版本；英文版 README 为唯一权威来源，本页面内容可能滞后于英文版。

<div align="center">

![IPCheck.ing Banner](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/gh_banner.png)

<a href="https://trendshift.io/repositories/5332" target="_blank"><img src="https://trendshift.io/api/badge/repositories/5332" alt="jason5ng32%2FMyIP | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

[![Mentioned in Awesome Self Hosted](https://awesome.re/mentioned-badge.svg)](https://github.com/awesome-selfhosted/awesome-selfhosted)

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub forks](https://img.shields.io/github/forks/jason5ng32/myip)
![Docker Pulls](https://img.shields.io/docker/pulls/jason5ng32/myip)

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fipcheck.ing&up_message=online&label=IPCheck.ing 'IPCheck.ing')](https://ipcheck.ing)
![PWA](https://img.shields.io/badge/PWA-Supported-blue)

![CodeQL](https://github.com/jason5ng32/MyIP/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)
![Docker Build and Push](https://github.com/jason5ng32/MyIP/actions/workflows/docker-image.yml/badge.svg?branch=main)

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH_TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md)

一个开源的一站式 IP 工具箱：多来源 IP 查询、连通性测试、WebRTC 与 DNS 泄露检测、网速测试、MTR、封锁检测、Whois 等等 —— 一条 Docker 命令即可自行部署。

👉 在这里体验：[https://ipcheck.ing](https://ipcheck.ing)

欢迎收藏在线版本，也可以自行部署。

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 主要功能

### 🪪 你的 IP 与身份

* 🛜 **IP 卡片**：从多个相互独立的来源并列检测你的 IPv4 和 IPv6 —— 国家、地区、城市、ASN、组织，以及该 IP 所在地的时区。
* 🔍 **IP 查询**：查询任意一个你感兴趣的 IP 地址的同样详细的信息。
* 🧾 **IP 历史记录**：在本地记录你使用过的 IP，可按类型和国家筛选 —— 数据只存在你的浏览器里。
* 🖥️ **浏览器指纹**：用多种方式计算你的浏览器指纹，并展示是什么让你变得可被识别。

### 🕵️ 泄露与隐私

* 🚥 **WebRTC 检测**：揭示 WebRTC 连接过程中暴露的 IP 地址 —— 包括你的浏览器是否开启了隐私强化。
* 🛑 **DNS 泄露测试**：展示是哪些 DNS 出口在解析你的请求，以便评估使用 VPN 或代理时 DNS 泄露的风险。
* 📋 **安全检查清单**：一份覆盖 12 个领域、共 258 项的个人网络安全检查清单，进度保存在你的浏览器里。

### 📡 网络测试

* 🚦 **网络连通性**：检测最多 60 个你自选网站的可达性，多轮测试取最低延迟 —— 还提供精选导入列表，从国家套装到 AI、社交、流媒体、游戏、开发者等应有尽有。并根据检测结果，提示你当前能否访问全球互联网。
* 🚀 **网速测试**：基于边缘网络测量你的下载、上传速度与延迟。
* ⏱️ **全球延迟测试**：从遍布全球的探针 ping 你的目标 —— 可从所有可用的 Globalping 探针中按大洲分组选择国家。
* 🚉 **MTR 测试**：从分布在全球的探针发起 MTR，查看数据包实际经过的路由。
* 🚧 **封锁测试**：展示一个网站在全球哪些地方被封锁 —— 以及是通过什么手段封锁的。
* 🚏 **分流测试**：验证你的代理软件的规则配置是否按你的预期工作。

### 🔦 查询与基础设施

* 📟 **DNS 解析**：同时通过多个解析器解析一个域名，并按国家分组 —— 轻松发现劫持或污染。
* 📓 **Whois 查询**：对域名和 IP 地址进行 Whois 查询。
* 🗄️ **MAC 地址查询**：识别一个物理地址背后的厂商与详细信息。
* 🛰️ **ASN 信息与上游拓扑**：展示 AS 详情、IP 前缀的历史宣告记录，以及从某个 ASN 到 Tier 1 骨干网的上游路径。
* 📶 **服务可用性**：知名服务的实时可用状态 —— Claude、OpenAI、GitHub、Cloudflare 等 —— 数据来自它们的官方状态页，并附最近的事故。

### ✨ 平台能力

* 📤 **诊断报告分享**：把你的测试结果生成一份诊断报告 —— 可选自动过期的只读链接、适合喂给 AI 的 Markdown，或 JSON。
* ⌨️ **命令行 API**：在终端里用一条 `curl` 命令获取你的 IP。
* 🌍 **地球在线**：一个实时播报全球断网事件的面板。
* 🌗 **暗黑模式**：自动跟随系统，也可以手动切换。
* 📲 **PWA**：可以安装为手机应用，也可以安装为桌面上的 Chrome 应用。
* ⚡ **快捷键**：每个功能都有对应的快捷键 —— 按 `?` 查看列表。
* 🔤 **多语言**：界面内置 6 种语言，添加你的语言只需一个语言包。

## 📕 如何使用

### 使用 Docker

一条命令即可运行：

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

或者点击本页顶部的「Deploy with Docker」按钮。

### 在 Node 环境部署

确保你已经安装了 Node.js，然后克隆代码：

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

安装与构建。本项目使用 pnpm —— 如果你还没有，请先安装（npm 随 Node 一起提供，这条命令一定能用）：

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

运行：

```bash
pnpm start
```

程序会运行在 18966 端口。

## ⚙️ 配置

> [!IMPORTANT]
> **MaxMind GeoLite2 凭证是必需的。** 它为 IP 地理位置与 ASN 查询提供数据 —— 不配置时，MaxMind 数据源会返回 503。凭证是免费的：→ [MaxMind Setup](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **在真实域名上部署时，`ALLOWED_DOMAINS` 是必需的。** 它是后端 API 的主机名白名单 —— 不配置时，来自非 localhost 域名的每个请求都会收到 403。→ [Reverse Proxy & Domains](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

其余全部是可选配置 —— 第三方 API Key、安全与限流、日志、Sentry、curl API 域名等，详见[环境变量参考](https://docs.ipcheck.ing/developer/reference/environment-variables)。

## 📖 官方文档

完整指南在 MyIP 文档中心：**[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [开发者指南](https://docs.ipcheck.ing/developer) —— 部署、配置、架构说明与参与贡献
* [知识库](https://docs.ipcheck.ing/knowledge-base) —— 每个工具的使用说明、网络问题排查步骤、网络概念科普

## 🤝 参与贡献

欢迎参与贡献！我们维护着一批对新手友好的任务，每条都写明了具体文件路径、验收标准，并有测试引导你完成一次绿色构建：

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) —— 添加你所在国家的 DNS 解析服务、添加精选网站列表、把 README 翻译成你的语言、润色翻译等
* 🌐 [TRANSLATING.md](TRANSLATING.md) —— 把 UI 带到你的语言：一个语言包加上一行注册表，而且**部分翻译也是欢迎的首次 PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) —— 环境搭建、开发约定与 PR 流程（请将 PR 提交到 `dev` 分支）

## 👩🏻‍💻 高级用法

<details>
<summary>同时查询真实 IP 与代理 IP 的代理规则</summary>

如果你在通过代理上网，可以考虑在你的代理配置里增加下面的规则（请根据你使用的客户端进行修改）。这样就可以同时查询你的真实 IP 和使用代理时的 IP：

```ini
# IP Testing
IP-CIDR,1.0.0.2/32,Proxy,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,Proxy,no-resolve
DOMAIN,4.ipcheck.ing,DIRECT
DOMAIN,6.ipcheck.ing,DIRECT
# Rule Testing
DOMAIN,ptest-1.ipcheck.ing,Proxy1
DOMAIN,ptest-2.ipcheck.ing,Proxy2
DOMAIN,ptest-3.ipcheck.ing,Proxy3
DOMAIN,ptest-4.ipcheck.ing,Proxy4
DOMAIN,ptest-5.ipcheck.ing,Proxy5
DOMAIN,ptest-6.ipcheck.ing,Proxy6
DOMAIN,ptest-7.ipcheck.ing,Proxy7
DOMAIN,ptest-8.ipcheck.ing,Proxy8
```

</details>

## 💖 赞助者

作为一个开源项目，我非常感谢以下赞助者对我的支持：

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

## 📄 开源协议

[MIT](LICENSE) © Jason Ng

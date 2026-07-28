# 🧰 IP 工具箱

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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇷🇺 [Русский](README_RU.md) | 🇫🇷 [Français](README_FR.md)

👉 在这里体验：[https://ipcheck.ing](https://ipcheck.ing)

你可以直接用我已经搭建好的服务，也可以自行搭建。

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 主要功能

* 🛜 **看自己的 IP**：从多个 IPv4 和 IPv6 来源检测显示本机的 IP
* 🔍 **查任意 IP 信息**：可以通过小工具查询任意 IP 的信息
* 🕵️ **看 IP 信息**：显示所有 IP 的相关信息，包括国家、地区、ASN、地理位置等
* 🛰️ **ASN 历史与上游拓扑**：查看 IP 前缀的历史 AS 宣告记录，以及该 ASN 到 Tier 1 骨干网的上游路径图
* 🚦 **可用性检测**：检测一些网站的可用性：Google, Github, Youtube, 网易, 百度等
* 📡 **服务可用性**：展示一些知名服务（Claude、OpenAI、GitHub、Cloudflare 等）的实时可用状态，数据来自它们的官方状态页，可查看各子服务状态与最近的事故
* 🚥 **WebRTC 检测**：查看使用 WebRTC 连接时使用的 IP
* 🛑 **DNS 泄露检测**：查看 DNS 出口信息，以便查看在 VPN/代理的情况下，是否存在 DNS 泄露隐私的风险
* 🚀 **网速测试**：利用边缘网络进行网速测试
* 🚏 **代理规则测试**：配合代理软件的规则设置，测试规则设置是否正常
* ⏱️ **全球延迟测试**：从分布在全球的多个服务器进行延迟测试，了解你与全球网络的连接速度
* 🚉 **MTR 测试**：从分布在全球的多个服务器进行 MTR 测试，了解你与全球的连接路径
* 🔦 **DNS 解析器**：从多个渠道对域名进行 DNS 解析，获取实时的解析结果，可用于污染判断
* 🚧 **封锁测试**：检查特定的网站在部分国家是否被封锁
* 📓 **Whois 查询**：对域名或 IP 进行 whois 信息查询
* 📀 **MAC 地址查询**：查询物理地址的归属信息
* 🖥️ **浏览器指纹**：多种方式查看浏览器指纹
* 📋 **网络安全检查清单**：一共有 258 项的，全面的网络安全检查清单

## 💪 同时还支持

* 🌗 **暗黑模式**：根据系统设置自动切换暗黑/白天模式，也可以手动切换
* 📲 **支持 PWA**：可以添加为手机应用以及电脑里的桌面应用，方便使用
* ⌨️ **支持快捷键**：可以随时输入 `?` 查看快捷键菜单
* 🌍 根据可用性检测结果，返回目前是否可以访问全世界网络的提示
* 🇺🇸 🇨🇳 🇷🇺 🇫🇷 支持中文、英文、俄文、法文

## 📕 如何使用

### 在 Node 环境部署

确保你系统里已经有 Node.js 环境。

克隆代码:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

安装与编译。本项目使用 pnpm，如果你还没有，请先安装（npm 随 Node 一起提供，这条命令一定能用）：

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

运行:

```bash
pnpm start
```

程序会运行在 18966 端口。

### 使用 Docker

点击顶部的部署到 Docker 按钮，即可完成部署，又或者，直接输入下面的命令：

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📖 官方文档

完整文档在 MyIP 文档中心：**[docs.ipcheck.ing](https://docs.ipcheck.ing)**（右上角可切换中文）

* [开发者指南](https://docs.ipcheck.ing/developer) —— 部署、配置、架构说明与参与贡献
* [知识库](https://docs.ipcheck.ing/knowledge-base) —— 每个工具的使用说明、网络问题排查指南、网络概念科普

## ⚙️ 配置

开始之前，有两项配置最重要：

* **MaxMind GeoLite2（必须）** —— 免费凭证，为 IP 地理位置与 ASN 查询提供数据。不配置时 MaxMind 数据源会返回 503。→ [MaxMind 配置指南](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)
* **`ALLOWED_DOMAINS`（使用真实域名时必须）** —— 后端 API 的域名白名单。不配置时，来自非 localhost 域名的请求都会收到 403。→ [反向代理与域名](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

其余全部为可选配置 —— 第三方 API Key、安全与限流、日志、Sentry、CURL API 域名等，详见[环境变量参考](https://docs.ipcheck.ing/developer/reference/environment-variables)。


## 👩🏻‍💻 高级用法

如果你在通过代理上网，可以考虑在你的代理配置里，增加下面的规则（请根据你使用的客户端进行修改），这样就可以实现同时查询真实 IP 和代理后的 IP：

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

## 💖 赞助者

作为一个开源项目，我非常感谢以下赞助者对我的支持：

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

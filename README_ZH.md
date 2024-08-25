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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇫🇷 [Français](README_FR.md)

👉 在这里体验：[https://ipcheck.ing](https://ipcheck.ing)

你可以直接用我已经搭建好的服务，也可以自行搭建。

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 主要功能

* 🖥️ **看自己的 IP**：从多个 IPv4 和 IPv6 来源检测显示本机的 IP
* 🕵️ **看 IP 信息**：显示所有 IP 的相关信息，包括国家、地区、ASN、地理位置等
* 🚦 **可用性检测**：检测一些网站的可用性：Google, Github, Youtube, 网易, 百度等
* 🚥 **WebRTC 检测**：查看使用 WebRTC 连接时使用的 IP
* 🛑 **DNS 泄露检测**：查看 DNS 出口信息，以便查看在 VPN/代理的情况下，是否存在 DNS 泄露隐私的风险
* 🚀 **网速测试**：利用边缘网络进行网速测试
* 🚏 **代理规则测试**：配合代理软件的规则设置，测试规则设置是否正常
* ⏱️ **全球延迟测试**：从分布在全球的多个服务器进行延迟测试，了解你与全球网络的连接速度
* 📡 **MTR 测试**：从分布在全球的多个服务器进行 MTR 测试，了解你与全球的连接路径
* 🔦 **DNS 解析器**：从多个渠道对域名进行 DNS 解析，获取实时的解析结果，可用于污染判断
* 🚧 **封锁测试**：检查特定的网站在部分国家是否被封锁
* 📓 **Whois 查询**：对域名或 IP 进行 whois 信息查询
* 📀 **MAC 地址查询**：查询物理地址的归属信息
* 🌗 **暗黑模式**：根据系统设置自动切换暗黑/白天模式，也可以手动切换
* 📱 **简约模式**：为移动版提供的专门模式，缩短页面长度，快速查看最重要的信息
* 🔍 **查任意 IP 信息**：可以通过小工具查询任意 IP 的信息
* 📲 **支持 PWA**：可以添加为手机应用以及电脑里的桌面应用，方便使用
* ⌨️ **支持快捷键**：可以随时输入 `?` 查看快捷键菜单
* 🌍 根据可用性检测结果，返回目前是否可以访问全世界网络的提示
* 🇺🇸 🇨🇳 🇫🇷 支持中文、英文、法文

## 📕 如何使用

### 在 Node 环境部署

确保你系统里已经有 Node.js 环境。

克隆代码:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

安装与编译:

```bash
npm install && npm run build
```

运行:

```bash
npm start
```

程序会运行在 18966 端口。

### 使用 Docker

点击顶部的部署到 Docker 按钮，即可完成部署，又或者，直接输入下面的命令：

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📚 环境变量

你可以不添加环境变量直接使用，但是如果你想使用一些高级功能，可以添加下面的环境变量：

| 变量名 | 是否必须 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `BACKEND_PORT` | 否 | `"11966"` | 程序后端部分的运行端口 |
| `FRONTEND_PORT` | 否 | `"18966"` | 程序前端部分的运行端口 |
| `SECURITY_RATE_LIMIT` | 否 | `"0"` | 控制每 60 分钟一个 IP 可以对后端服务器请求的次数（设置为 0 则为不限制） |
| `SECURITY_DELAY_AFTER` | 否 | `"0"` | 控制每 20 分钟一个 IP 的前 X 次请求不受速度限制，超过 X 次后会逐次增加延迟 |
| `SECURITY_BLACKLIST_LOG_FILE_PATH` | 否 | `"logs/blacklist-ip.log"` | 路径设置。记录由 SECURITY_RATE_LIMIT 开启后，触发限制的 IP 列表 |
| `BING_MAP_API_KEY` | 否 | `""` | Bing 地图的 API Key，用于展示 IP 所在地的地图 |
| `ALLOWED_DOMAINS` | 否 | `""` | 允许访问的域名，用逗号分隔，用于防止后端 API 被滥用 |
| `IPCHECKING_API_KEY` | 否 | `""` | IPCheck.ing 的 API Key，用于获取精准的 IP 归属地信息 |
| `IPINFO_API_TOKEN` | 否 | `""` | IPInfo.io 的 API Token，用于通过 IPInfo.io 获取 IP 归属地信息 |
| `IPAPIIS_API_KEY` | 否 | `""` | IPAPI.is 的 API Key，用于通过 IPAPI.is 获取 IP 归属地信息 |
| `KEYCDN_USER_AGENT` | 否 | `""` | 使用 KeyCDN 时的域名，需包含 https 前缀。用于通过 KeyCDN 获取 IP 归属地信息 |
| `CLOUDFLARE_API` | 否 | `""` | Cloudflare 的 API Key，用于通过 Cloudflare 获取 AS 系统的信息 |
| `MAC_LOOKUP_API_KEY` | 否 | `""` | MAC 查询的 API Key，用于通过 MAC Lookup 获取 MAC 地址的归属信息 |
| `VITE_GOOGLE_ANALYTICS_ID` | **是** | `""` | Google Analytics 的 ID，用于统计访问量 |

### 在 Node 环境里使用环境变量

创建环境变量：

```bash
cp .env.example .env
```

修改 `.env` 里的内容，比如：

```bash
BACKEND_PORT=11966
FRONTEND_PORT=18966
BING_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
IPCHECKING_API="YOUR_KEY_HERE"
```

然后重新启动后端服务。

### 在 Docker 里使用环境变量

你可以在运行 Docker 的时候，添加环境变量，比如：

```bash
docker run -d -p 18966:18966 \
  -e BING_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  -e IPCHECKING_API="YOUR_TOKEN_HERE" \
  --name myip \
  jason5ng32/myip:latest

```

## 👩🏻‍💻 高级用法

如果你在通过代理上网，可以考虑在你的代理配置里，增加下面的规则（请根据你使用的客户端进行修改），这样就可以实现同时查询真实 IP 和代理后的 IP：

```ini
# IP Testing
IP-CIDR,1.0.0.1/32,DIRECT,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,DIRECT,no-resolve
DOMAIN-SUFFIX,ipify.org,Proxy
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

## 😶‍🌫️ 额外说明

在 V2.0 发布的时候，我曾经说：这个程序的 70% 的代码不是我写的，是通过 ChatGPT 写的。大概来回 90 个回合，外加一些细微的手动修改，完成了全部代码。

当然，程序的架构和 UI 还是需要自己进行设计。

随着 V3.0 及后续的代码发布，ChatGPT 帮助我写代码的比例逐渐下降，估计现在在 40% - 50% 之间。相反，在这个过程中，我从完全不会 JavaScript 和 Vue ，与 AI 结对编程后，我现在已经能看懂大部分的 JS 代码了，并且也已经能手撸一些。

感谢 AI ，给了我这样一个失业产品经理快速学习编程的机会。

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)

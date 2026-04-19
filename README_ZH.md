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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇫🇷 [Français](README_FR.md) | 🇹🇷 [Türkçe](README_TR.md)

👉 在这里体验：[https://ipcheck.ing](https://ipcheck.ing)

你可以直接用我已经搭建好的服务，也可以自行搭建。

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 主要功能

* 🛜 **看自己的 IP**：从多个 IPv4 和 IPv6 来源检测显示本机的 IP
* 🔍 **查任意 IP 信息**：可以通过小工具查询任意 IP 的信息
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
* 🖥️ **浏览器指纹**：多种方式查看浏览器指纹
* 📋 **网络安全检查清单**：一共有 258 项的，全面的网络安全检查清单

## 💪 同时还支持

* 🌗 **暗黑模式**：根据系统设置自动切换暗黑/白天模式，也可以手动切换
* 📱 **简约模式**：为移动版提供的专门模式，缩短页面长度，快速查看最重要的信息
* 📲 **支持 PWA**：可以添加为手机应用以及电脑里的桌面应用，方便使用
* ⌨️ **支持快捷键**：可以随时输入 `?` 查看快捷键菜单
* 🌍 根据可用性检测结果，返回目前是否可以访问全世界网络的提示
* 🇺🇸 🇨🇳 🇫🇷 🇹🇷 支持中文、英文、法文、土耳其文

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

下表中标记为 **是** 的变量必须配置，后端才能正常工作。其中 MaxMind 相关的三项尤其重要——填写环境变量之前请先阅读下面的 MaxMind 配置说明。

### MaxMind 数据库（必须配置）

MyIP 依赖 MaxMind 提供的免费 **GeoLite2** 数据库（City + ASN）来进行 IP 地理位置查询、ASN / 组织归属查询，以及全站各处（IP 卡片、WebRTC ICE candidate 等）的国家/地区标识。MaxMind 配置是后端完整运行的前提。

由于 MaxMind GeoLite2 协议不允许再分发，`.mmdb` 文件**没有被包含在本仓库里**，你需要自己准备。有两种做法：

**方案 A —— 自动下载（推荐，Docker 部署必选）**

1. 去 [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup) 注册一个免费账号。
2. 在账号的 "Manage License Keys" 页面生成一个 License Key。
3. 配置这三个环境变量：
   ```bash
   MAXMIND_ACCOUNT_ID="your-account-id"
   MAXMIND_LICENSE_KEY="your-license-key"
   MAXMIND_AUTO_UPDATE="true"
   ```
4. 启动后端。首次启动后约 60 秒内，程序会自动下载两个数据库，之后每 24 小时自动检查更新。

> ⚠️ **Docker 部署必须使用方案 A。** 一个全新的容器里 `common/maxmind-db/` 目录是空的——如果不配置这三个变量，后端虽然能起来，但 MaxMind 相关的 IP 查询源和 WebRTC 国家标识将无法工作，并且每次启动日志里都会刷出 `MaxMind API will return 503...` 的报错。

**方案 B —— 手动放置（离线 / 非 Docker 场景）**

从你的 MaxMind 账号下载 `GeoLite2-City.mmdb` 和 `GeoLite2-ASN.mmdb`，在启动后端前手动放入 `common/maxmind-db/` 目录。这种情况下 `MAXMIND_AUTO_UPDATE` 可以保持 `"false"`，但每次 MaxMind 发布新版本时你需要自己手动更新文件。

### 环境变量一览

| 变量名 | 是否必须 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `IPCHECKING_API_ENDPOINT` | **是** | `""` | IPCheck.ing 的 API 端点 URL |
| `MAXMIND_ACCOUNT_ID` | **是** | `""` | MaxMind 账号 ID，和 `MAXMIND_LICENSE_KEY` 一起用于下载 GeoLite2 数据库。详见上方 MaxMind 配置说明。 |
| `MAXMIND_LICENSE_KEY` | **是** | `""` | MaxMind License Key，和 `MAXMIND_ACCOUNT_ID` 配合使用。详见上方 MaxMind 配置说明。 |
| `MAXMIND_AUTO_UPDATE` | **是** | `"false"` | 设置为 `"true"` 时，程序会在启动后 60 秒左右自动下载 GeoLite2 数据库，之后每 24 小时刷新一次。**Docker 部署必须设置为 `"true"`。** 只有当你已经手动放置了 `.mmdb` 文件时，才能保持为 `"false"`。 |
| `VITE_GOOGLE_ANALYTICS_ID` | **是** | `""` | Google Analytics 的 ID，用于统计访问量 |
| `BACKEND_PORT` | 否 | `"11966"` | 程序后端部分的运行端口 |
| `FRONTEND_PORT` | 否 | `"18966"` | 程序前端部分的运行端口 |
| `SECURITY_RATE_LIMIT` | 否 | `"0"` | 控制每 60 分钟一个 IP 可以对后端服务器请求的次数（设置为 0 则为不限制） |
| `SECURITY_DELAY_AFTER` | 否 | `"0"` | 控制每 20 分钟一个 IP 的前 X 次请求不受速度限制，超过 X 次后会逐次增加延迟 |
| `SECURITY_BLACKLIST_LOG_FILE_PATH` | 否 | `"logs/blacklist-ip.log"` | 路径设置。记录由 SECURITY_RATE_LIMIT 开启后，触发限制的 IP 列表 |
| `ALLOWED_DOMAINS` | 否 | `""` | 允许访问的域名，用逗号分隔，用于防止后端 API 被滥用 |
| `GOOGLE_MAP_API_KEY` | 否 | `""` | Google 地图的 API Key，用于展示 IP 所在地的地图 |
| `IPCHECKING_API_KEY` | 否 | `""` | IPCheck.ing 的 API Key，用于获取精准的 IP 归属地信息 |
| `IPINFO_API_TOKEN` | 否 | `""` | IPInfo.io 的 API Token，用于通过 IPInfo.io 获取 IP 归属地信息 |
| `IPAPIIS_API_KEY` | 否 | `""` | IPAPI.is 的 API Key，用于通过 IPAPI.is 获取 IP 归属地信息 |
| `IP2LOCATION_API_KEY` | 否 | `""` | IP2Location.io 的 API Key，用于通过 IP2Location.io 获取 IP 归属地信息 |
| `CLOUDFLARE_API` | 否 | `""` | Cloudflare 的 API Key，用于通过 Cloudflare 获取 AS 系统的信息 |
| `MAC_LOOKUP_API_KEY` | 否 | `""` | MAC 查询的 API Key，用于通过 MAC Lookup 获取 MAC 地址的归属信息 |
| `VITE_CURL_IPV4_DOMAIN` | 否 | `""` | 为用户提供 CURL API 的 IPv4 域名 |
| `VITE_CURL_IPV6_DOMAIN` | 否 | `""` | 为用户提供 CURL API 的 IPv6 域名 |
| `VITE_CURL_IPV64_DOMAIN` | 否 | `""` | 为用户提供 CURL API 的双网络栈域名 |

需要注意的是，如果 CURL 系列的环境变量任意一个缺失，都不会启用 CURL API。

### 在 Node 环境里使用环境变量

创建环境变量：

```bash
cp .env.example .env
```

修改 `.env` 里的内容，比如：

```bash
BACKEND_PORT=11966
FRONTEND_PORT=18966
IPCHECKING_API_ENDPOINT="YOUR_ENDPOINT_HERE"
MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID"
MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY"
MAXMIND_AUTO_UPDATE="true"
GOOGLE_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
```

然后重新启动后端服务。

### 在 Docker 里使用环境变量

你可以在运行 Docker 的时候，添加环境变量，比如：

```bash
docker run -d -p 18966:18966 \
  -e IPCHECKING_API_ENDPOINT="YOUR_ENDPOINT_HERE" \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e GOOGLE_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  --name myip \
  jason5ng32/myip:latest

```

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

## 😶‍🌫️ 额外说明

在 V2.0 发布的时候，我曾经说：这个程序的 70% 的代码不是我写的，是通过 AI 写的。大概来回 90 个回合，外加一些细微的手动修改，完成了全部代码。

当然，程序的架构和 UI 还是需要自己进行设计。

随着 V3.0 及后续的代码发布，AI 帮助我写代码的比例逐渐下降，估计现在在 40% - 50% 之间。相反，在这个过程中，我从完全不会 JavaScript 和 Vue ，与 AI 结对编程后，我现在已经能看懂大部分的 JS 代码了，并且也已经能手撸一些。

感谢 AI ，给了我这样一个失业产品经理快速学习编程的机会。

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)

## 💖 赞助者

作为一个开源项目，我非常感谢以下赞助者对我的支持：

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://opensource.nyc3.cdn.digitaloceanspaces.com/attribution/assets/SVG/DO_Logo_horizontal_blue.svg" height="40px" title="DigitalOcean" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://cf-assets.www.cloudflare.com/zkvhlag99gkb/69RwBidpiEHCDZ9rFVVk7T/092507edbed698420b89658e5a6d5105/CF_logo_stacked_blktype.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" height="60px" /></a>

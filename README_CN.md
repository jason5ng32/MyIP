# 🧰 IP 工具箱

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub](https://img.shields.io/github/license/jason5ng32/MyIP)
![GitHub contributors](https://img.shields.io/github/contributors/jason5ng32/MyIP)
![GitHub commit activity (branch)](https://img.shields.io/github/commit-activity/m/jason5ng32/MyIP)

[🇺🇸 English](README.md) | [🇨🇳 简体中文](README_CN.md)

👉 在这里体验：[https://ipcheck.ing](https://ipcheck.ing)

备注：你可以直接用我已经搭建好的服务，也可以自行搭建。

[![Deploy with Vercel](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/Vercel.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&project-name=MyIP&repository-name=MyIP)
[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

这是一个完全开源的 IP 信息查看器，可以查询本机 IP、查询任意 IP、查询国内外网站可用性等。这是我第一次用 Vue.js 练手的项目。我……只是一个普通的产品经理。

## 👀 主要功能

* 🖥️ **看自己的 IP**：从多个 IPv4 和 IPv6 来源检测显示本机的 IP
* 🕵️ **看 IP 信息**：显示所有 IP 的相关信息，包括国家、地区、ASN、地理位置等
* 🚦 **可用性检测**：检测一些网站的可用性：Google, Github, Youtube, 网易, 百度等
* 🚥 **WebRTC 检测**：查看使用 WebRTC 连接时使用的 IP
* 🛑 **DNS 泄露检测**：查看 DNS 出口信息，以便查看在 VPN/代理的情况下，是否存在 DNS 泄露隐私的风险
* 🚀 **网速测试**：利用边缘网络进行网速测试
* 🌐 **全球延迟测试**：从分布在全球的多个服务器进行延迟测试，了解你与全球网络的连接速度
* 📡 **MTR 测试**：从分布在全球的多个服务器进行 MTR 测试，了解你与全球的连接路径
* 🌗 **暗黑模式**：根据系统设置自动切换暗黑/白天模式，也可以手动切换
* 📱 **简约模式**：为移动版提供的专门模式，缩短页面长度，快速查看最重要的信息
* 🔍 **查任意 IP 信息**：可以通过小工具查询任意 IP 的信息
* 📲 **支持 PWA**：可以添加为手机桌面应用以及电脑里的 Chrome 应用
* ⌨️ **支持快捷键**：可以随时输入 `?` 查看快捷键菜单
* 🌍 根据可用性检测结果，返回目前是否可以访问全世界网络的提示
* 🇺🇸 🇨🇳 支持中文和英文

## 📕 如何使用

3 种部署方式：

### 在 Node 环境部署

确保你系统里已经有 Node.js 环境。

克隆代码:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

安装:

```bash
npm install
```

编译：

```bash
npm run build
```

运行:

```bash
npm start
```

程序会运行在 18966 端口。

如果你想添加 Bing 地图，在启动之前，进行如下修改：

创建环境变量：

```bash
mv .env.example .env
```

修改 `.env` 里的 Bing 地图 API Key 以及你的域名（防止滥用）。

```bash
BING_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
```

如果你先使用 IPinfo.io 的 API，可以添加：

```bash
IPINFO_API_TOKEN="YOUR_TOKEN_HERE"
```

### 使用 Vercel

点击顶部的部署到 Vercel 按钮，即可完成部署。

如果希望展示地图，则在部署的时候，添加下面 2 个环境变量：

```bash
BING_MAP_API_KEY
ALLOWED_DOMAINS
```

如果你想使用 IPinfo.io 的 API，可以添加：

```bash
IPINFO_API_TOKEN
```

### 使用 Docker

点击顶部的部署到 Docker 按钮，即可完成部署，又或者，直接输入下面的命令：

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

如果你希望展示地图，则在部署的时候，设置 Bing Map API Key 和允许的域名：

```bash
docker run -d -p 18966:18966 \
  -e BING_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  --name myip \
  jason5ng32/myip:latest

```

如果你希望同时使用 IPinfo.io 的 API：

```bash
docker run -d -p 18966:18966 \
  -e BING_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  -e IPINFO_API_TOKEN="YOUR_TOKEN_HERE" \
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
```

## 😶‍🌫️ 额外说明

这个程序的 70% 的代码不是我写的，是通过 ChatGPT 写的。大概来回 90 个回合，外加一些细微的手动修改，完成了全部代码。

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)
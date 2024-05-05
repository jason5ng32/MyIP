# 🧰 MyIP - A Better IP Toolbox

![IPCheck.ing Banner](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/gh_banner.png)

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub forks](https://img.shields.io/github/forks/jason5ng32/myip)
![Docker Pulls](https://img.shields.io/docker/pulls/jason5ng32/myip)
![GitHub license](https://img.shields.io/github/license/jason5ng32/MyIP)

![CodeQL](https://github.com/jason5ng32/MyIP/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)
![Docker Build and Push](https://github.com/jason5ng32/MyIP/actions/workflows/docker-image.yml/badge.svg?branch=main)

![PWA](https://img.shields.io/badge/PWA-Supported-blue)
![Windows-image](https://img.shields.io/badge/-Windows-blue?logo=windows)
![MacOS-image](https://img.shields.io/badge/-MacOS-black?logo=apple)
![Linux-image](https://img.shields.io/badge/-Linux-333?logo=ubuntu)

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fipcheck.ing&up_message=online&label=IPCheck.ing 'IPCheck.ing')](https://ipcheck.ing)

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇫🇷 [Français](README_FR.md)

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Notes: You can use my demo for free, and you can also deploy it yourself.

[![Deploy with Vercel](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/Vercel.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&project-name=MyIP&repository-name=MyIP)
[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

## 👀 Main Features

* 🖥️ **View Your IPs**: Detects and displays your local IPs, sourcing from multiple IPv4 and IPv6 providers.
* 🕵️ **IP Information**: Presents detailed information for all IP addresses, including country, region, ASN, geographic location, and more.
* 🚦 **Availability Check**: Tests the accessibility of various websites, such as Google, GitHub, YouTube, ChatGPT, and others.
* 🚥 **WebRTC Detection**: Identifies the IP address used during WebRTC connections.
* 🛑 **DNS Leak Test**: Shows DNS endpoint data to evaluate the risk of DNS leaks when using VPNs or proxies.
* 🚀 **Speed Test**：Test your network speed with edge networks.
* 🚏 **Proxy Rule Testing**: Test the rule settings of proxy software to ensure their correctness.
* 🌐 **Global Latency Test**: Performe lantency tests on servers located in different regions around the world.
* 📡 **MTR Test**: Perform MTR tests on servers located in different regions around the world.
* 🔦 **DNS Resolver**: Performs DNS resolution of a domain name from multiple sources and obtains real-time resolution results that can be used for contamination determination.
* 🚧 **Censorship Check**: Check if a website is blocked in some countries.
* 🌗 **Dark Mode**: Automatically toggles between dark and daylight modes based on system settings, with an option for manual switching.
* 📱 **Minimalist Mode**: A mobile-optimized mode that shortens page length for quick access to essential information..
* 🔍 **Search IP Information**: Provides a tool for querying information about any IP address.
* 📲 **PWA Supported**：Can be added as a desktop app on your phone as well as a Chrome app on your computer.
* ⌨️ **Keyboard Shortcuts**: Supports keyboard shortcuts for all functions, press `?` to view the shortcut list.
* 🌍 Based on availability test results, it indicates whether global internet access is currently feasible.
* 🇺🇸 🇨🇳 🇫🇷 English, Chinese, and French support.

## 📕 How to Use

There are 3 Ways to deploy:

### Deploying in a Node Environment

Make sure you have Node.js installed.

Clone the code:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Install:

```bash
npm install
```

Build:

```bash
npm run build
```

Run:

```bash
npm start
```

The program will run on port 18966.

### Using Vercel

Click the 'Deploy to Vercel' button at the top to complete the deployment. Note that some features are not available on Vercel (see the environment variable section for details).

### Using Docker

Click the 'Deploy to Docker' button at the top to complete the deployment. Or, use the following shell:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📚 Environment Variable

You can use the program without adding any environment variables, but if you want to use some advanced features, you can add the following environment variables:

| Variable Name | Required | Default Value | Description |
| --- | --- | --- | --- |
| `BACKEND_PORT` | No | `"11966"` | The running port of the backend part of the program |
| `FRONTEND_PORT` | No | `"18966"` | The running port of the frontend part of the program |
| `SECURITY_RATE_LIMIT` | No | `"0"` | Controls the number of requests an IP can make to the backend server every 60 minutes (set to 0 for no limit) |
| `SECURITY_DELAY_AFTER` | No | `"0"` | Controls the first X requests from an IP every 20 minutes that are not subject to speed limits, and after X requests, the delay will increase |
| `SECURITY_BLACKLIST_LOG_FILE_PATH` | No | `"logs/blacklist-ip.log"` | Path setting. Records the list of IPs that triggered the limit after SECURITY_RATE_LIMIT is enabled |
| `BING_MAP_API_KEY` | No | `""` | API Key for Bing Maps, used to display the location of the IP on a map |
| `ALLOWED_DOMAINS` | No | `""` | Allowed domains for access, separated by commas, used to prevent misuse of the backend API |
| `IPCHECKING_API_KEY` | No | `""` | API Key for IPCheck.ing, used to obtain accurate IP geolocation information |
| `IPINFO_API_TOKEN` | No | `""` | API Token for IPInfo.io, used to obtain IP geolocation information through IPInfo.io |
| `KEYCDN_USER_AGENT` | No | `""` | The domain name when using KeyCDN, must contain https prefix. Used to obtain IP address information through KeyCDN |
| `CLOUDFLARE_API` | No | `""` | API Key for Cloudflare, used to obtain AS system information through Cloudflare |
| `VITE_RECAPTCHA_SITE_KEY` | No | `""` | Google reCAPTCHA's Site Key, used to display reCAPTCHA verification on the frontend |
| `RECAPTCHA_SECRET_KEY` | No | `""` | Google reCAPTCHA's Secret Key, used to verify reCAPTCHA verification on the backend |

> [!TIP]
> Environment variables starting with `SECURITY_` are only valid when deploying using npm or Docker.
>

### Using Environment Variables in a Node Environment

Create environment variables:

```bash
cp .env.example .env
```

Modify `.env`, and for example, add the following:

```bash
BACKEND_PORT=11966
FRONTEND_PORT=18966
BING_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
IPCHECKING_API="YOUR_KEY_HERE"
```

Then restart the backend service.

### Using Environment Variables in Vercel

Please refer to the content in `.env.example` and add it to the environment variables in Vercel.

### Using Environment Variables in Docker

You can add environment variables when running Docker, for example:

```bash
docker run -d -p 18966:18966 \
  -e BING_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  -e IPCHECKING_API="YOUR_TOKEN_HERE" \
  --name myip \
  jason5ng32/myip:latest

```

## 👩🏻‍💻 Advanced Usage

If you're using a proxy for internet access, consider adding this rule to your proxy configuration (modify it according to your client). This setup lets you check both your real IP and the IP when using the proxy:

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

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)

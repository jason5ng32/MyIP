# 🧰 MyIP - A Better IP Toolbox

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub](https://img.shields.io/github/license/jason5ng32/MyIP)
![GitHub contributors](https://img.shields.io/github/contributors/jason5ng32/MyIP)
![GitHub commit activity (branch)](https://img.shields.io/github/commit-activity/m/jason5ng32/MyIP)

[🇺🇸 English](README.md) | [🇨🇳 简体中文](README_CN.md)

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Notes: You can use my demo, but please don't use it for commercial purposes. If you want to use it for commercial purposes, please deploy it yourself.

[![Deploy with Vercel](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/res/img/Vercel.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&project-name=MyIP&repository-name=MyIP)
[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/res/img/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

## 👀 Main Features

* 🖥️ **View Your IPs**: Detects and displays your local IP, sourcing from multiple IPv4 and IPv6 providers.
* 🕵️ **IP Information**: Presents detailed information for all IP addresses, including country, region, ASN, geographic location, and more.
* 🚦 **Availability Check**: Tests the accessibility of various websites, such as Google, GitHub, YouTube, ChatGPT, and others.
* 🚥 **WebRTC Detection**: Identifies the IP address used during WebRTC connections.
* 🛑 **DNS Leak Test**: Shows DNS endpoint data to evaluate the risk of DNS leaks when using VPNs or proxies.
* 🌗 **Dark Mode**: Automatically toggles between dark and daylight modes based on system settings, with an option for manual switching.
* 📱 **Minimalist Mode**: A mobile-optimized mode that shortens page length for quick access to essential information..
* 🔍 **Search IP Information**: Provides a tool for querying information about any IP address.
* 📲 **PWA Supported**：Can be added as a desktop app on your phone as well as a Chrome app on your computer.
* 🚀 **Speed Test**：Test your network speed with edge networks.
* ⌨️ **Keyboard Shortcuts**: Supports keyboard shortcuts for all functions, press `?` to view the shortcut list.
* 🌍 Based on availability test results, it indicates whether global internet access is currently feasible.
* 🇺🇸🇨🇳 English and Chinese supported.

## 📕 How to Use

There are 3 Ways to Deploy:

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

Run:

```bash
npm start
```

The program will run on port 8966.

If you want to add Bing Maps, make the following changes before starting:

Create environment variables:

```bash
mv .env.example .env
```

Modify the Bing Maps API Key and your domain (to prevent abuse) in `.env` .

```bash
BING_MAP_API_KEY="YOU_KEY_HERE"
ALLOWED_DOMAINS="example.com"
```

### Using Vercel

Click the 'Deploy to Vercel' button at the top to complete the deployment.

If you want to display maps, set the following 2 environment variables during deployment:

```bash
BING_MAP_API_KEY
ALLOWED_DOMAINS
```

Or, click this button to deploy with environment variables:

[![Deploy with Vercel](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/res/img/Vercel.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&env=BING_MAP_API_KEY,ALLOWED_DOMAINS)

### Using Docker

Click the 'Deploy to Docker' button at the top to complete the deployment. Or, use the following shell:

```bash
docker run -d -p 8966:8966 --name myip --restart always jason5ng32/myip:latest
```

If you wish to display maps, set the Bing Map API Key and allowed domains during deployment:

```bash
docker run -d -p 8966:8966 -e BING_MAP_API_KEY="YOUR_KEY_HERE" -e ALLOWED_DOMAINS="example.com" --name myip jason5ng32/myip:latest
```

## 👩🏻‍💻 Advanced Usage

If you're using a proxy for internet access, consider adding this rule to your proxy configuration (modify it according to your client). This setup lets you check both your real IP and the IP when using the proxy:

```ini
# IP Testing
IP-CIDR,1.0.0.1/32,DIRECT,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,DIRECT,no-resolve
DOMAIN-SUFFIX,ipify.org,Proxy
```

## 😶‍🌫️ Additional Notes

70% of the code for this program was not written by me, but generated through ChatGPT. After about 50 rounds of back-and-forth and some minor manual adjustments, all the code was completed.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)
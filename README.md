# 🧰 MyIP - A Better IP Toolbox

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

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Feel free to bookmark the demo or deploy your own.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Main Features

* 🛜 **View Your IPs**: Detects and displays your local IPs, sourcing from multiple IPv4 and IPv6 providers.
* 🔍 **Search IP Information**: Provides a tool for querying information about any IP address. 
* 🕵️ **IP Information**: Presents detailed information for all IP addresses, including country, region, ASN, geographic location, and more.
* 🛰️ **ASN History & Upstream Topology**: View historical AS announcements for an IP prefix, and visualize the upstream paths from an ASN to the Tier 1 backbone networks.
* 🚦 **Availability Check**: Tests the accessibility of various websites, such as Google, GitHub, YouTube, ChatGPT, and others.
* 📡 **Service Status**: Shows the live availability of well-known services (Claude, OpenAI, GitHub, Cloudflare, and more) from their official status pages, with per-service status and recent incidents.
* 🚥 **WebRTC Detection**: Identifies the IP address used during WebRTC connections.
* 🛑 **DNS Leak Test**: Shows DNS endpoint data to evaluate the risk of DNS leaks when using VPNs or proxies.
* 🚀 **Speed Test**：Test your network speed with edge networks.
* 🚏 **Proxy Rule Testing**: Test the rule settings of proxy software to ensure their correctness.
* ⏱️ **Global Latency Test**: Performe lantency tests on servers located in different regions around the world.
* 🚉 **MTR Test**: Perform MTR tests on servers located in different regions around the world.
* 🔦 **DNS Resolver**: Performs DNS resolution of a domain name from multiple sources and obtains real-time resolution results that can be used for contamination determination.
* 🚧 **Censorship Check**: Check if a website is blocked in some countries.
* 📓 **Whois Search**: Perform whois information search for domain names or IP addresses
* 📀 **MAC Lookup**: Query information of a physical address
* 🖥️ **Browser Fingerprints**：Multiple ways to caculate your browser fingerprint
* 📋 **Cybersecurity Checklist**：A comprehensive cybersecurity checklist with a total of 258 items

## 💪 Also

* 🌗 **Dark Mode**: Automatically toggles between dark and daylight modes based on system settings, with an option for manual switching.
* 📲 **PWA Supported**：Can be added as a desktop app on your phone as well as a Chrome app on your computer.
* ⌨️ **Keyboard Shortcuts**: Supports keyboard shortcuts for all functions, press `?` to view the shortcut list.
* 🌍 Based on availability test results, it indicates whether global internet access is currently feasible.
* 🇺🇸 🇨🇳 🇷🇺 🇫🇷 English, Chinese, Russian, French support.

## 📕 How to Use

### Deploying in a Node Environment

Make sure you have Node.js installed.

Clone the code:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Install and build. This project uses pnpm — if you don't have it, install it first (npm ships with Node, so this command always works):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Run:

```bash
pnpm start
```

The program will run on port 18966.

### Using Docker

Click the 'Deploy to Docker' button at the top to complete the deployment. Or, use the following shell:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📖 Documentation

Full guides live in the MyIP Docs Center: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Developer Guide](https://docs.ipcheck.ing/developer) — deployment, configuration, architecture, and contributing
* [Knowledge Base](https://docs.ipcheck.ing/knowledge-base) — how to use every tool, step-by-step network diagnosis, and networking concepts

## ⚙️ Configuration

Two settings matter before anything else:

* **MaxMind GeoLite2 (required)** — free credentials that power IP geolocation and ASN lookups. Without them, the MaxMind source returns 503. → [MaxMind Setup](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)
* **`ALLOWED_DOMAINS` (required on a real domain)** — hostname allowlist for the backend API. Without it, every request from a non-localhost domain gets 403. → [Reverse Proxy & Domains](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

Everything else — optional API keys, security & rate limiting, logging, Sentry, the curl API domains — is documented in the [Environment Variables reference](https://docs.ipcheck.ing/developer/reference/environment-variables).


## 👩🏻‍💻 Advanced Usage

If you're using a proxy for internet access, consider adding this rule to your proxy configuration (modify it according to your client). This setup lets you check both your real IP and the IP when using the proxy:

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

## 💖 Sponsors

As a open source project, I'm very grateful to the following sponsors for their support:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

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
[![CI](https://github.com/jason5ng32/MyIP/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jason5ng32/MyIP/actions/workflows/ci.yml)

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH-TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md)

An open-source, all-in-one IP toolbox: IP lookup from multiple sources, connectivity tests, WebRTC & DNS-leak detection, speed test, MTR, censorship checks, Whois, and more — self-hostable with one Docker command.

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Feel free to bookmark the demo or deploy your own.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Features

### 🪪 Your IP & Identity

* 🛜 **IP Cards**: Detects your IPv4 and IPv6 from multiple independent sources side by side — country, region, city, ASN, organization, and the IP's local time zone.
* 🔍 **Query IP**: Looks up the same detailed information for any IP address you're curious about.
* 🧾 **IP History**: Keeps a local record of the IPs you've been seen with, filterable by type and country — stored in your browser only.
* 🖥️ **Browser Fingerprint**: Calculates your browser fingerprint in multiple ways and shows what makes you identifiable.

### 🕵️ Leaks & Privacy

* 🚥 **WebRTC Detection**: Reveals the IP address exposed during WebRTC connections — including whether your browser's privacy hardening is on.
* 🛑 **DNS Leak Test**: Shows which DNS endpoints resolve your queries, to evaluate the risk of DNS leaks when using VPNs or proxies.
* 📋 **Security Checklist**: A 258-item personal cybersecurity checklist across 12 areas, with progress saved in your browser.

### 📡 Network Tests

* 🚦 **Connectivity Check**: Tests the reachability of up to 60 sites of your choice, with multi-round minimum-latency results — plus curated import lists, from country packs to AI, social, streaming, gaming, developer, and more. Based on the results, it signals whether global internet access is currently feasible for you.
* 🚀 **Speed Test**: Measures your download, upload, and latency against edge networks.
* ⏱️ **Global Latency Test**: Pings your target from probes all over the world — pick countries from all available Globalping probes, grouped by continent.
* 🚉 **MTR Test**: Runs MTR from globally distributed probes to see the route packets actually take.
* 🚧 **Censorship Check**: Shows where a website is blocked worldwide — and by what means.
* 🚏 **Proxy Rule Test**: Verifies that your proxy software's rule configuration works the way you intended.

### 🔦 Lookup & Infrastructure

* 📟 **DNS Resolver**: Resolves a domain through multiple resolvers at once, grouped by country — an easy way to spot hijacking or contamination.
* 📓 **Whois Search**: Performs Whois lookups for domain names and IP addresses.
* 🗄️ **MAC Lookup**: Identifies the vendor and details behind a physical address.
* 🛰️ **ASN Info & Upstream Topology**: Shows AS details, historical announcements for an IP prefix, and the upstream paths from an ASN to the Tier 1 backbone.
* 📶 **Service Status**: Live availability of well-known services — Claude, OpenAI, GitHub, Cloudflare, and more — from their official status pages, with recent incidents.

### ✨ Platform

* 📤 **Shareable Reports**: Turn your test results into a diagnostic report — a read-only link with auto-expiry, AI-ready Markdown, or JSON.
* ⌨️ **Curl API**: Get your IP from the terminal with a single `curl` command.
* 🌍 **Earth Online**: A panel broadcasting global internet outage events as they happen.
* 🌗 **Dark Mode**: Follows your system automatically, with a manual toggle.
* 📲 **PWA**: Installable as an app on your phone and as a Chrome app on your desktop.
* ⚡ **Keyboard Shortcuts**: Every function has one — press `?` to see the list.
* 🔤 **Multiple Languages**: The UI ships in 6 languages, and adding yours takes one locale pack.

## 📕 How to Use

### Using Docker

One command and you're up:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

Or click the "Deploy with Docker" button at the top of this page.

### Deploying in a Node Environment

Make sure you have Node.js installed, then clone the code:

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

## ⚙️ Configuration

> [!IMPORTANT]
> **MaxMind GeoLite2 credentials are required.** They power IP geolocation and ASN lookups — without them, the MaxMind source returns 503. They're free: → [MaxMind Setup](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **`ALLOWED_DOMAINS` is required on a real domain.** It's the hostname allowlist for the backend API — without it, every request from a non-localhost domain gets 403. → [Reverse Proxy & Domains](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

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

## 📖 Documentation

Full guides live in the MyIP Docs Center: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Developer Guide](https://docs.ipcheck.ing/developer) — deployment, configuration, architecture, and contributing
* [Knowledge Base](https://docs.ipcheck.ing/knowledge-base) — how to use every tool, step-by-step network diagnosis, and networking concepts

## 🤝 Contributing

Contributions are welcome! We keep a curated set of beginner-friendly tasks — each with exact file paths, acceptance criteria, and tests that guide you to a green build:

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — add a DNS resolver from your country, add curated site lists, translate the README into your language, polish translations, and more
* 🌐 [TRANSLATING.md](TRANSLATING.md) — bring the UI to your language: a locale pack plus one registry line, and a **partial translation is a welcome first PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — setup, conventions, and how PRs flow (target the `dev` branch)

## 👩🏻‍💻 Advanced Usage

<details>
<summary>Proxy rules for checking your real IP and your proxy IP at the same time</summary>

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

</details>

## 💖 Sponsors

As an open source project, I'm very grateful to the following sponsors for their support:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

## 📄 License

[MIT](LICENSE) © Jason Ng

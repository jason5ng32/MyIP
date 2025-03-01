# 🌐 MyIP - The Ultimate IP Toolbox

![IPCheck.ing Banner](https://your-banner-url.com)

[![GitHub Repo](https://img.shields.io/github/stars/jason5ng32/MyIP?style=flat-square)](https://github.com/jason5ng32/MyIP) [![GitHub Forks](https://img.shields.io/github/forks/jason5ng32/MyIP?style=flat-square)](https://github.com/jason5ng32/MyIP) [![Docker Pulls](https://img.shields.io/docker/pulls/jason5ng32/myip?style=flat-square)](https://hub.docker.com/r/jason5ng32/myip)

🚀 **Live Demo:** [ipcheck.ing](https://ipcheck.ing)  
💾 **Deploy Your Own Instance** using Docker or Node.js

## 🌟 Key Features

- 🛜 **View Your IPs:** Detects and displays local IPs using multiple IPv4 and IPv6 providers.
- 🔍 **IP Lookup:** Search and retrieve details on any IP address.
- 🕵️ **Detailed IP Information:** Country, region, ASN, geolocation, and more.
- 🚦 **Website Availability Test:** Check access to major sites like Google, GitHub, and ChatGPT.
- 🚥 **WebRTC Detection:** Identify your WebRTC-exposed IP.
- 🛑 **DNS Leak Test:** Evaluate DNS endpoint leaks for VPN/proxy users.
- 🚀 **Speed Test:** Measure your network performance with edge networks.
- 🚏 **Proxy Rule Testing:** Verify the accuracy of your proxy settings.
- ⏱️ **Global Latency Test:** Ping servers worldwide.
- 📡 **MTR Test:** Perform MTR tests on different regions.
- 🔦 **DNS Resolver:** Analyze domain resolution from multiple sources.
- 🚧 **Censorship Check:** Detect regional content restrictions.
- 📓 **Whois Search:** Retrieve domain and IP registration details.
- 📀 **MAC Lookup:** Identify physical address information.
- 🖥️ **Browser Fingerprint Analysis:** Generate unique browser fingerprints.
- 📋 **Cybersecurity Checklist:** A comprehensive 258-item security guide.

## 🎨 Additional Features

- 🌗 **Dark Mode:** Automatic light/dark theme switching.
- 📱 **Minimalist Mode:** Mobile-friendly view for quick access.
- 📲 **PWA Support:** Installable as a desktop or mobile app.
- ⌨️ **Keyboard Shortcuts:** Press `?` to view available shortcuts.
- 🌍 **Global Internet Status:** Indicates real-time internet accessibility.
- 🇺🇸 🇨🇳 🇫🇷 **Multi-language Support:** English, Chinese, and French.

## 🛠️ How to Deploy

### **Node.js Deployment**
Ensure you have Node.js installed, then:

```bash
git clone https://github.com/jason5ng32/MyIP.git
cd MyIP
npm install && npm run build
npm start
```

The app runs on port `18966`.

### **Docker Deployment**
Deploy via Docker with:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## ⚙️ Environment Variables

Customize features using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `11966` | Backend service port |
| `FRONTEND_PORT` | `18966` | Frontend service port |
| `SECURITY_RATE_LIMIT` | `0` | Limit requests per IP per hour (0 = no limit) |
| `SECURITY_BLACKLIST_LOG_FILE_PATH` | `logs/blacklist-ip.log` | Path to log blacklisted IPs |
| `GOOGLE_MAP_API_KEY` | `""` | API Key for displaying IP locations |
| `IPCHECKING_API_KEY` | `""` | API Key for accurate geolocation |
| `VITE_GOOGLE_ANALYTICS_ID` | `""` | Google Analytics tracking ID |

Example usage in Docker:

```bash
docker run -d -p 18966:18966 \
  -e GOOGLE_MAP_API_KEY="YOUR_KEY_HERE" \
  -e IPCHECKING_API_KEY="YOUR_TOKEN_HERE" \
  --name myip \
  jason5ng32/myip:latest
```

## 🔧 Advanced Usage

If using a proxy, configure it properly to test both real and proxied IPs:

```bash
# IP Testing
IP-CIDR,1.0.0.2/32,Proxy,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,Proxy,no-resolve
DOMAIN,4.ipcheck.ing,DIRECT
DOMAIN,6.ipcheck.ing,DIRECT
# Rule Testing
DOMAIN,ptest-1.ipcheck.ing,Proxy1
DOMAIN,ptest-2.ipcheck.ing,Proxy2
```

## 🤖 AI-Assisted Development

With the release of **version 2.0**, about 70% of the code was generated with ChatGPT's help. Over time, my JavaScript and Vue knowledge grew, reducing AI assistance to **40-50%** in **version 3.0+**. AI has been a valuable learning tool, transforming me from a product manager into a hands-on developer.

## ⭐ Star History

[![Star History](https://your-star-history-url.com)](https://github.com/jason5ng32/MyIP/stargazers)

---

📌 **Like this project?** Give it a ⭐ on GitHub!  
📢 **Suggestions?** Open an issue or contribute!  
📨 **Follow for updates!** [GitHub](https://github.com/jason5ng32) | [Website](https://ipcheck.ing)

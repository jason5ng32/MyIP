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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇹🇼 [繁體中文](README_ZH_TW.md) | 🇷🇺 [Русский](README_RU.md) | 🇫🇷 [Français](README_FR.md)

👉 在這裡體驗：[https://ipcheck.ing](https://ipcheck.ing)

你可以直接使用我已經架設好的服務，也可以自行架設。

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 主要功能

* 🛜 **看自己的 IP**：從多個 IPv4 和 IPv6 來源偵測並顯示本機的 IP
* 🔍 **查任意 IP 資訊**：可以透過小工具查詢任意 IP 的資訊
* 🕵️ **看 IP 資訊**：顯示所有 IP 的相關資訊，包括國家、地區、ASN、地理位置等
* 🛰️ **ASN 歷史與上游拓撲**：查看 IP 前綴的歷史 AS 宣告記錄，以及該 ASN 到 Tier 1 骨幹網路的上游路徑圖
* 🚦 **可用性偵測**：偵測一些網站的可用性：Google, Github, Youtube, 網易, 百度等
* 📡 **服務可用性**：展示一些知名服務（Claude、OpenAI、GitHub、Cloudflare 等）的即時可用狀態，資料來自它們的官方狀態頁，可查看各子服務狀態與最近的事故
* 🚥 **WebRTC 偵測**：查看使用 WebRTC 連線時使用的 IP
* 🛑 **DNS 洩漏測試**：查看 DNS 出口資訊，以便得知在 VPN／代理的情況下，是否存在 DNS 洩漏隱私的風險
* 🚀 **網速測試**：利用邊緣網路進行網速測試
* 🚏 **分流測試**：配合代理軟體的規則設定，測試規則設定是否正常
* ⏱️ **全球延遲測試**：從分佈在全球的多個伺服器進行延遲測試，了解你與全球網路的連線速度
* 🚉 **MTR 測試**：從分佈在全球的多個伺服器進行 MTR 測試，了解你與全球的連線路徑
* 🔦 **DNS 解析**：從多個管道對網域名稱進行 DNS 解析，取得即時的解析結果，可用於污染判斷
* 🚧 **封鎖測試**：檢查特定的網站在部分國家是否被封鎖
* 📓 **Whois 查詢**：對網域名稱或 IP 進行 whois 資訊查詢
* 📀 **MAC 位址查詢**：查詢實體位址的歸屬資訊
* 🖥️ **瀏覽器指紋**：多種方式查看瀏覽器指紋
* 📋 **網路安全檢查清單**：一共有 258 個項目、完整全面的網路安全檢查清單

## 💪 同時還支援

* 🌗 **深色模式**：根據系統設定自動切換深色／日間模式，也可以手動切換
* 📲 **支援 PWA**：可以新增為手機應用程式以及電腦裡的桌面應用程式，方便使用
* ⌨️ **支援快捷鍵**：可以隨時輸入 `?` 查看快捷鍵選單
* 🌍 根據可用性偵測結果，回傳目前是否可以存取全世界網路的提示
* 🇺🇸 🇨🇳 🇹🇼 🇷🇺 🇫🇷 支援簡體中文、繁體中文、英文、俄文、法文

## 📕 如何使用

### 在 Node 環境部署

確保你系統裡已經有 Node.js 環境。

複製程式碼：

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

安裝與編譯。本專案使用 pnpm，如果你還沒有，請先安裝（npm 隨 Node 一起提供，這條指令一定能用）：

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

執行：

```bash
pnpm start
```

程式會執行在 18966 連接埠。

### 使用 Docker

點選頂部的部署到 Docker 按鈕，即可完成部署，又或者，直接輸入下面的指令：

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📖 官方說明文件

完整說明文件在 MyIP 文件中心：**[docs.ipcheck.ing](https://docs.ipcheck.ing)**（右上角可切換中文）

* [開發者指南](https://docs.ipcheck.ing/developer/zh) —— 部署、設定、架構說明與參與貢獻
* [知識庫](https://docs.ipcheck.ing/knowledge-base/zh) —— 每個工具的使用說明、網路問題疑難排解指南、網路概念入門

## 🤝 參與貢獻

歡迎參與貢獻！我們維護著一批對新手友善的任務，每條都寫明了具體檔案、驗收標準，並有測試引導你完成：

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) —— 新增你所在國家的 DNS 解析服務、新增精選網站清單、把 README 翻譯成你的語言、潤飾翻譯等
* 🌐 [TRANSLATING.md](TRANSLATING.md) —— 把 UI 帶到你的語言：一個語言包加上一行註冊表，以及 **部分翻譯也是歡迎的首次 PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) —— 環境架設、開發約定與 PR 流程（請將 PR 提交到 `dev` 分支）

## ⚙️ 設定

開始之前，有兩項設定最重要：

* **MaxMind GeoLite2（必須）** —— 免費憑證，為 IP 地理位置與 ASN 查詢提供資料。不設定時 MaxMind 資料來源會回傳 503。→ [MaxMind 設定指南](https://docs.ipcheck.ing/developer/getting-started/zh/maxmind-setup)
* **`ALLOWED_DOMAINS`（使用真實網域時必須）** —— 後端 API 的網域白名單。不設定時，來自非 localhost 網域的請求都會收到 403。→ [反向代理與網域](https://docs.ipcheck.ing/developer/getting-started/zh/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

其餘全部為選用設定 —— 第三方 API Key、安全與流量限制、日誌、Sentry、CURL API 網域等，詳見[環境變數參考](https://docs.ipcheck.ing/developer/reference/zh/environment-variables)。


## 👩🏻‍💻 進階用法

如果你在透過代理上網，可以考慮在你的代理設定裡，增加下面的規則（請根據你使用的用戶端進行修改），這樣就可以同時查詢真實 IP 和代理後的 IP：

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

## 💖 贊助者

作為一個開源專案，我非常感謝以下贊助者對我的支持：

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=zh"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

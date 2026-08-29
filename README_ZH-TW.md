# 🧰 MyIP - 更好的 IP 工具箱

> [!NOTE]
> 這是由社群維護的翻譯版本；英文版 README 為唯一權威來源，本頁內容可能落後於英文版。

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

一個開源的多合一 IP 工具箱：多來源 IP 查詢、連通性測試、WebRTC 與 DNS 洩漏偵測、網速測試、MTR、審查封鎖檢查、Whois 等——一條 Docker 指令即可自行架設。

👉 在這裡體驗：[https://ipcheck.ing](https://ipcheck.ing)

歡迎把展示站加入書籤，也可以自行部署一套。

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 主要功能

### 🪪 你的 IP 與身分

* 🛜 **IP 卡片**：從多個獨立來源並列偵測你的 IPv4 與 IPv6——包括國家、地區、城市、ASN、組織，以及該 IP 所在地的當地時區。
* 🔍 **IP 查詢**：查詢任何一個你感興趣的 IP 位址的同樣詳細資訊。
* 🧾 **IP 歷史記錄**：在本機記錄你曾被偵測到的 IP，可依類型與國家篩選——只儲存在你的瀏覽器裡。
* 🖥️ **瀏覽器指紋**：以多種方式計算你的瀏覽器指紋，並顯示是哪些特徵讓你可被識別。

### 🕵️ 洩漏與隱私

* 🚥 **WebRTC 洩漏測試**：揭示 WebRTC 連線過程中暴露的 IP 位址——包括你的瀏覽器隱私強化設定是否已開啟。
* 🛑 **DNS 洩漏測試**：顯示是哪些 DNS 端點在解析你的查詢，以評估使用 VPN 或代理時 DNS 洩漏的風險。
* 📋 **安全檢查清單**：一份涵蓋 12 個領域、共 258 個項目的個人網路安全檢查清單，進度儲存在你的瀏覽器裡。

### 📡 網路測試

* 🚦 **網路連通性**：測試最多 60 個你自選網站的可達性，多輪測試取最低延遲——並提供精選匯入清單，從各國組合包到 AI、社群、串流、遊戲、開發者等應有盡有。根據測試結果，提示你目前是否能順暢存取全球網路。
* 🚀 **網速測試**：對邊緣網路測量你的下載、上傳與延遲。
* ⏱️ **全球延遲測試**：從遍布全球的探測節點 ping 你的目標——可從所有可用的 Globalping 探測節點中依洲別挑選國家。
* 🚉 **MTR 測試**：從分布全球的探測節點執行 MTR，查看封包實際行經的路徑。
* 🚧 **封鎖測試**：顯示一個網站在全球哪些地方被封鎖——以及封鎖的手段。
* 🚏 **分流測試**：驗證你的代理軟體規則設定是否如你預期般運作。

### 🔦 查詢與基礎設施

* 📟 **DNS 解析**：同時透過多個解析器解析網域，並依國家分組——輕鬆看出是否存在劫持或污染。
* 📓 **Whois 查詢**：對網域名稱與 IP 位址進行 Whois 查詢。
* 🗄️ **MAC 位址查詢**：識別實體位址背後的廠商與詳細資訊。
* 🛰️ **ASN 資訊與上游拓撲**：顯示 AS 詳細資訊、IP 前綴的歷史宣告記錄，以及該 ASN 到 Tier 1 骨幹網路的上游路徑。
* 📶 **服務可用性**：知名服務（Claude、OpenAI、GitHub、Cloudflare 等）的即時可用狀態，資料來自它們的官方狀態頁，並附最近的事故。

### ✨ 平台功能

* 📤 **診斷報告**：把你的測試結果轉成可分享的診斷報告——附自動過期的唯讀連結、AI 可直接使用的 Markdown，或 JSON。
* ⌨️ **命令列 API**：在終端機裡用一條 `curl` 指令取得你的 IP。
* 🌍 **地球線上**：一個即時播報全球網路斷網事件的面板。
* 🌗 **深色模式**：自動跟隨系統設定，也可手動切換。
* 📲 **PWA**：可安裝為手機上的應用程式，以及電腦上的 Chrome 應用程式。
* ⚡ **鍵盤快速鍵**：每個功能都有對應快速鍵——按下 `?` 查看完整清單。
* 🔤 **多語言**：UI 內建 6 種語言，新增你的語言只需一個語言包。

## 📕 如何使用

### 使用 Docker

一條指令即可啟動：

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

也可以點選本頁頂部的「Deploy with Docker」按鈕。

### 在 Node 環境部署

確保你已安裝 Node.js，然後複製程式碼：

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

安裝與建置。本專案使用 pnpm——如果你還沒有，請先安裝（npm 隨 Node 一起提供，這條指令一定能用）：

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

執行：

```bash
pnpm start
```

程式會執行在 18966 連接埠。

## ⚙️ 設定

> [!IMPORTANT]
> **必須設定 MaxMind GeoLite2 憑證。** 它為 IP 地理位置與 ASN 查詢提供資料——未設定時，MaxMind 來源會回傳 503。憑證是免費的：→ [MaxMind 設定指南](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **使用真實網域時必須設定 `ALLOWED_DOMAINS`。** 它是後端 API 的主機名稱允許清單——未設定時，來自非 localhost 網域的每個請求都會收到 403。→ [反向代理與網域](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

其餘一切——選用的 API Key、安全與流量限制、日誌、Sentry、curl API 網域——都記錄在[環境變數參考](https://docs.ipcheck.ing/developer/reference/environment-variables)中。

## 📖 官方說明文件

完整指南在 MyIP 文件中心：**[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [開發者指南](https://docs.ipcheck.ing/developer) —— 部署、設定、架構說明與參與貢獻
* [知識庫](https://docs.ipcheck.ing/knowledge-base) —— 每個工具的使用說明、逐步的網路問題診斷，以及網路概念入門

## 🤝 參與貢獻

歡迎參與貢獻！我們維護著一批對新手友善的任務，每條都寫明了具體檔案路徑與驗收標準，並有測試引導你完成：

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) —— 新增你所在國家的 DNS 解析服務、新增精選網站清單、把 README 翻譯成你的語言、潤飾翻譯等
* 🌐 [TRANSLATING.md](TRANSLATING.md) —— 把 UI 帶到你的語言：一個語言包加上一行註冊表，而且 **部分翻譯也是歡迎的首次 PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) —— 環境架設、開發約定與 PR 流程（請將 PR 提交到 `dev` 分支）

## 👩🏻‍💻 進階用法

<details>
<summary>同時查詢真實 IP 與代理 IP 的代理規則</summary>

如果你在透過代理上網，可以考慮在你的代理設定裡加入下面的規則（請根據你使用的用戶端進行修改）。這樣設定後，就可以同時查詢真實 IP 和使用代理時的 IP：

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

## 💖 贊助者

作為一個開源專案，我非常感謝以下贊助者對我的支持：

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

## 📄 授權條款

[MIT](LICENSE) © Jason Ng

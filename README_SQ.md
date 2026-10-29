# 🧰 MyIP - Një kuti më e mirë mjetesh IP

> [!NOTE]
> Ky është një përkthim i mirëmbajtur nga komuniteti; README-ja në anglisht është burimi zyrtar dhe ky version mund të mbetet prapa.

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

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH-TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md) | [Shqip](README_SQ.md) | [ไทย](README_TH.md) | [हिन्दी](README_HI.md)

Një kuti mjetesh IP gjithëpërfshirëse dhe me burim të hapur: kërkim IP nga shumë burime, teste lidhshmërie, zbulim i rrjedhjeve WebRTC dhe DNS, test shpejtësie, MTR, kontrolle censure, Whois e shumë të tjera — e vetë-strehueshme me një komandë të vetme Docker.

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Mund ta ruani demon te faqeshënuesit ose të vendosni instancën tuaj.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Veçoritë

### 🪪 IP-ja dhe identiteti juaj

* 🛜 **Kartat e IP-së**: Zbulojnë IPv4 dhe IPv6 tuaj nga disa burime të pavarura krah për krah — shtetin, rajonin, qytetin, ASN-në, organizatën dhe zonën kohore lokale të IP-së.
* 🔍 **Kërkimi i IP-së**: Kërkon të njëjtin informacion të detajuar për çdo adresë IP për të cilën jeni kureshtarë.
* 🧾 **Historiku i IP-ve**: Mban një regjistër lokal të IP-ve me të cilat jeni parë, të filtrueshëm sipas llojit dhe shtetit — i ruajtur vetëm në shfletuesin tuaj.
* 🖥️ **Gjurma e shfletuesit**: Llogarit gjurmën e shfletuesit tuaj në disa mënyra dhe tregon çfarë ju bën të identifikueshëm.

### 🕵️ Rrjedhjet dhe privatësia

* 🚥 **Zbulimi WebRTC**: Zbulon adresën IP që ekspozohet gjatë lidhjeve WebRTC — përfshirë nëse mbrojtja e privatësisë së shfletuesit tuaj është aktive.
* 🛑 **Testi i rrjedhjes DNS**: Tregon cilat pika fundore DNS i zgjidhin kërkesat tuaja, për të vlerësuar rrezikun e rrjedhjeve DNS kur përdorni VPN ose proxy.
* 🛡️ **Testi i bllokimit të reklamave dhe gjurmuesve**: Kontrollon çfarë bllokojnë vërtet bllokuesi i reklamave, shfletuesi, filtri DNS, VPN-ja ose router-i juaj — rrjetet e reklamave, analitikën, gjurmuesit socialë, monitorimin e gabimeve, telemetrinë e prodhuesve të pajisjeve, skriptet e gjurmimit dhe fshehjen e elementeve.
* 📋 **Lista e sigurisë**: Një listë personale kontrolli për sigurinë kibernetike me 258 pika në 12 fusha, me progresin të ruajtur në shfletuesin tuaj.

### 📡 Testet e rrjetit

* 🚦 **Kontrolli i lidhshmërisë**: Teston arritshmërinë e deri në 60 faqeve sipas zgjedhjes suaj, me rezultate të vonesës minimale në disa raunde — plus lista të kuruara për import, nga paketat për shtete te AI, rrjetet sociale, transmetimi, lojërat, zhvilluesit e të tjera. Bazuar në rezultatet, tregon nëse aksesi në internetin global është aktualisht i mundur për ju.
* 🚀 **Testi i shpejtësisë**: Mat shkarkimin, ngarkimin dhe vonesën tuaj kundrejt rrjeteve edge.
* ⏱️ **Testi global i vonesës**: Bën ping objektivit tuaj nga sonda në mbarë botën — zgjidhni shtetet nga të gjitha sondat e disponueshme të Globalping, të grupuara sipas kontinentit.
* 🚉 **Testi MTR**: Ekzekuton MTR nga sonda të shpërndara globalisht për të parë rrugën që ndjekin realisht paketat.
* 🚧 **Kontrolli i censurës**: Tregon ku është bllokuar një faqe interneti në mbarë botën — dhe me çfarë mjetesh.
* 🚏 **Testi i rregullave të proxy-t**: Verifikon që konfigurimi i rregullave të softuerit tuaj proxy funksionon ashtu siç e keni menduar.

### 🔦 Kërkimi dhe infrastruktura

* 📟 **Zgjidhësi DNS**: Zgjidh një domen përmes disa zgjidhësve njëkohësisht, të grupuar sipas shtetit — një mënyrë e thjeshtë për të vënë re rrëmbimin ose ndotjen.
* 📓 **Kërkimi Whois**: Kryen kërkime Whois për emra domenesh, adresa IP dhe numra AS.
* 🗄️ **Kërkimi MAC**: Identifikon prodhuesin dhe detajet pas një adrese fizike.
* 🧮 **Kalkulatori IP**: Llogaritje subnetesh, konvertime shënimesh dhe detaje të ndërfaqes IPv6 për çdo IP, prefiks, varg ose listë, të llogaritura lokalisht.
* 🛰️ **Informacioni ASN dhe topologjia drejt furnizuesve**: Direkt në çdo kartë IP — detajet e AS-së, shpalljet historike për prefiksin e IP-së dhe shtigjet nga ASN-ja e saj drejt shtyllës kurrizore Tier 1.
* 🛂 **Profili ASN**: Tabloja e plotë e çdo AS — regjistrimi me të dhënat e papërpunuara Whois, renditja dhe madhësia globale, trafiku dhe cilësia e lidhjes, ku përdoret hapësira e saj IPv4, çdo prefiks i shpallur me gjendjen RPKI, furnizuesit, peer-at dhe klientët e saj, si dhe pikat e shkëmbimit të internetit dhe qendrat e të dhënave ku është e pranishme.
* 📶 **Gjendja e shërbimeve**: Disponueshmëria live e shërbimeve të njohura — Claude, OpenAI, GitHub, Cloudflare e të tjera — nga faqet e tyre zyrtare të gjendjes, me incidentet e fundit.

### ✨ Platforma

* 📤 **Raporte për t'u ndarë**: Ktheni rezultatet e testeve tuaja në një raport diagnostikues — një lidhje vetëm për lexim me skadim automatik, Markdown gati për AI ose JSON.
* ⌨️ **API Curl**: Merrni IP-në tuaj nga terminali me një komandë të vetme `curl`.
* 🌍 **Toka Online**: Një panel që transmeton ngjarjet globale të ndërprerjeve të internetit në kohën kur ndodhin.
* 🌗 **Modaliteti i errët**: Ndjek automatikisht sistemin tuaj, me mundësi ndërrimi manual.
* 📲 **PWA**: Mund të instalohet si aplikacion në telefon dhe si aplikacion Chrome në desktop.
* ⚡ **Shkurtoret e tastierës**: Çdo funksion ka një të tillë — shtypni `?` për të parë listën.
* 🔤 **Shumë gjuhë**: Ndërfaqja vjen në 6 gjuhë, dhe shtimi i gjuhës suaj kërkon vetëm një paketë lokalizimi.

## 📕 Si ta përdorni

### Me Docker

Një komandë dhe jeni gati:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

Ose klikoni butonin "Deploy with Docker" në krye të kësaj faqeje.

### Vendosja në një mjedis Node

Sigurohuni që keni të instaluar Node.js, pastaj klononi kodin:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Instaloni dhe ndërtoni. Ky projekt përdor pnpm — nëse nuk e keni, instalojeni së pari (npm vjen me Node, ndaj kjo komandë funksionon gjithmonë):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Ekzekutoni:

```bash
pnpm start
```

Programi do të ekzekutohet në portën 18966.

## ⚙️ Konfigurimi

> [!IMPORTANT]
> **Kredencialet e MaxMind GeoLite2 janë të detyrueshme.** Ato mundësojnë gjeolokacionin e IP-ve dhe kërkimet ASN — pa to, burimi MaxMind kthen 503. Janë falas: → [MaxMind Setup](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **`ALLOWED_DOMAINS` është i detyrueshëm në një domen real.** Është lista e lejuar e emrave të hosteve për API-në e backend-it — pa të, çdo kërkesë nga një domen që nuk është localhost merr 403. → [Reverse Proxy & Domains](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e DATASET_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

Gjithçka tjetër — çelësat opsionalë API, siguria dhe kufizimi i shpejtësisë, regjistrimi, Sentry, domenet e API-së curl — është dokumentuar te [Environment Variables reference](https://docs.ipcheck.ing/developer/reference/environment-variables).

## 📖 Dokumentacioni

Udhëzuesit e plotë ndodhen në Qendrën e Dokumentacionit të MyIP: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Developer Guide](https://docs.ipcheck.ing/developer) — vendosja, konfigurimi, arkitektura dhe kontributi
* [Knowledge Base](https://docs.ipcheck.ing/knowledge-base) — si të përdorni çdo mjet, diagnostikimi i rrjetit hap pas hapi dhe konceptet e rrjetit

## 🤝 Kontributi

Kontributet janë të mirëpritura! Mbajmë një grup të kuruar detyrash të përshtatshme për fillestarët — secila me shtigje të sakta skedarësh, kritere pranimi dhe teste që ju udhëheqin drejt një ndërtimi të suksesshëm:

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — shtoni një zgjidhës DNS nga shteti juaj, shtoni lista të kuruara faqesh, përktheni README-në në gjuhën tuaj, përmirësoni përkthimet e të tjera
* 🌐 [TRANSLATING.md](TRANSLATING.md) — sillni ndërfaqen në gjuhën tuaj: një paketë lokalizimi plus një rresht në regjistër, dhe **një përkthim i pjesshëm është një PR i parë i mirëpritur**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — konfigurimi, konventat dhe si rrjedhin PR-të (synoni degën `dev`)

## 👩🏻‍💻 Përdorimi i avancuar

<details>
<summary>Rregulla proxy për të kontrolluar njëkohësisht IP-në tuaj të vërtetë dhe IP-në e proxy-t</summary>

Nëse përdorni një proxy për t'u lidhur me internetin, mendoni të shtoni këtë rregull në konfigurimin e proxy-t tuaj (përshtateni sipas klientit tuaj). Ky konfigurim ju lejon të kontrolloni si IP-në tuaj të vërtetë, ashtu edhe IP-në kur përdorni proxy-n:

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
DOMAIN,ptest-9.ipcheck.ing,Proxy9
DOMAIN,ptest-10.ipcheck.ing,Proxy10
DOMAIN,ptest-11.ipcheck.ing,Proxy11
DOMAIN,ptest-12.ipcheck.ing,Proxy12
```

</details>

## 💖 Sponsorët dhe mbështetësit

Si projekt me burim të hapur, jam shumë mirënjohës për mbështetjen e sponsorëve të mëposhtëm:

**Sponsorët**

<a href="https://www.swiftproxy.net/?ref=myip"><img src="https://res.ipcheck.ing/img/swiftproxy_logo.png" alt="SwiftProxy" height="48" /></a><br />
<sub>↳ **<a href="https://www.swiftproxy.net/?ref=myip">SwiftProxy</a>** — High-quality rotating and static residential proxies, with 90M+ residential IPs across 220+ locations worldwide. It supports HTTP(S), SOCKS5, rotating and sticky sessions, with residential proxy plans starting at just $0.7/GB. Use code `PROXY90` for an additional 10% off.
</sub>

<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4"><img src="https://res.ipcheck.ing/img/proxyseller_logo.png" alt="Proxy-Seller" height="48" /></a><br />
<sub>↳ **<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4">Proxy-Seller</a>** — offers private residential, mobile (4G/5G/LTE), ISP, and datacenter IPv4/IPv6 proxies with HTTP(S) and SOCKS5 support, 47M+ residential IPs in 220+ locations, precise country/city/ISP targeting, 99.7% uptime, and 24/7 support. MyIP users can use promo code `CHECKINGIP15` to get 15% off.
</sub>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=sq"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="V.PS" height="48" /></a><br />
<sub>↳ **<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=sq">V.PS</a>** — High-performance KVM VPS with global locations, fast connectivity, and IPv4 & IPv6 included.</sub>

----

**Mbështetësit**

<p><a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" height="32" /></a></p>
<p><a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" height="32" /></a></p>
<p><a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" height="32" /></a></p>
<p><a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" height="32" /></a></p>
<p><a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" height="32" /></a></p>

Jeni të interesuar të sponsorizoni MyIP? [Bëhu sponsor](https://github.com/sponsors/jason5ng32)

## 📄 Licenca

[AGPL-3.0](LICENSE) © Jason Ng

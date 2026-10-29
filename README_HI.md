# 🧰 MyIP - एक बेहतर IP टूलबॉक्स

> [!NOTE]
> यह अनुवाद समुदाय के लोग संभालते हैं. आधिकारिक स्रोत अंग्रेज़ी README है, और हो सकता है यह वर्शन उससे पीछे रह जाए.

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

एक ओपन-सोर्स, ऑल-इन-वन IP टूलबॉक्स: कई स्रोतों से IP की जानकारी, कनेक्टिविटी जांच, WebRTC और DNS लीक की पहचान, स्पीड टेस्ट, MTR, सेंसरशिप जांच, Whois और बहुत कुछ — Docker की एक कमांड से अपने सर्वर पर चलाएं.

👉 डेमो: [https://ipcheck.ing](https://ipcheck.ing)

डेमो को बुकमार्क करें या अपना खुद का वर्शन डिप्लॉय करें.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 सुविधाएं

### 🪪 आपका IP और पहचान

* 🛜 **IP कार्ड**: कई अलग-अलग स्रोतों से आपका IPv4 और IPv6 एक साथ पता करता है — देश, क्षेत्र, शहर, ASN, संगठन और उस IP का स्थानीय समय क्षेत्र.
* 🔍 **IP खोजें**: किसी भी IP पते की यही पूरी जानकारी देखें.
* 🧾 **IP इतिहास**: आपके इस्तेमाल किए गए IP का लोकल रिकॉर्ड रखता है, जिसे प्रकार और देश के हिसाब से फ़िल्टर किया जा सकता है — यह सिर्फ़ आपके ब्राउज़र में सेव रहता है.
* 🖥️ **ब्राउज़र फ़िंगरप्रिंट**: कई तरीकों से आपके ब्राउज़र का फ़िंगरप्रिंट निकालता है और दिखाता है कि किन चीज़ों से आपकी पहचान हो सकती है.

### 🕵️ लीक और निजता

* 🚥 **WebRTC जांच**: WebRTC कनेक्शन के दौरान दिखने वाला IP पता बताता है — साथ ही यह भी कि आपके ब्राउज़र की निजता सुरक्षा चालू है या नहीं.
* 🛑 **DNS लीक जांच**: दिखाता है कि आपकी DNS क्वेरी कौन-से DNS सर्वर हल करते हैं, ताकि VPN या प्रॉक्सी इस्तेमाल करते समय DNS लीक का खतरा समझा जा सके.
* 🛡️ **ऐड और ट्रैकर ब्लॉकिंग जांच**: जांचता है कि आपका ऐड ब्लॉकर, ब्राउज़र, DNS फ़िल्टर, VPN या राउटर असल में क्या ब्लॉक करता है — ऐड नेटवर्क, एनालिटिक्स, सोशल ट्रैकर, एरर मॉनिटरिंग, डिवाइस बनाने वाली कंपनियों की टेलीमेट्री, ट्रैकिंग स्क्रिप्ट और एलिमेंट छिपाना.
* 📋 **सुरक्षा चेकलिस्ट**: 12 क्षेत्रों में 258 बातों वाली निजी साइबर सुरक्षा चेकलिस्ट, जिसकी प्रगति आपके ब्राउज़र में सेव रहती है.

### 📡 नेटवर्क जांच

* 🚦 **कनेक्टिविटी जांच**: आपकी चुनी हुई 60 तक साइटें खुल रही हैं या नहीं, यह जांचता है और कई राउंड में सबसे कम इंतज़ार का समय दिखाता है — साथ में तैयार सूचियां भी हैं, देशों की सूचियों से लेकर AI, सोशल, स्ट्रीमिंग, गेमिंग, डेवलपर और बहुत कुछ. नतीजों के आधार पर यह बताता है कि अभी आप दुनिया भर का इंटरनेट इस्तेमाल कर सकते हैं या नहीं.
* 🚀 **स्पीड टेस्ट**: एज नेटवर्क से आपकी डाउनलोड, अपलोड स्पीड और इंतज़ार का समय मापता है.
* ⏱️ **दुनिया भर से पिंग जांच**: दुनिया भर के प्रोब से आपके टारगेट को पिंग करता है — सभी उपलब्ध Globalping प्रोब में से, महाद्वीप के हिसाब से देश चुनें.
* 🚉 **MTR जांच**: दुनिया भर में फैले प्रोब से MTR चलाकर दिखाता है कि पैकेट असल में किस रास्ते से जाते हैं.
* 🚧 **सेंसरशिप जांच**: दिखाता है कि कोई वेबसाइट दुनिया में कहां-कहां ब्लॉक है — और किस तरीके से.
* 🚏 **प्रॉक्सी नियम जांच**: पक्का करता है कि आपके प्रॉक्सी सॉफ़्टवेयर के नियम वैसे ही काम कर रहे हैं जैसा आपने सोचा था.

### 🔦 लुकअप और इन्फ़्रास्ट्रक्चर

* 📟 **DNS रिज़ॉल्वर**: एक डोमेन को एक साथ कई रिज़ॉल्वर से हल करता है, देश के हिसाब से ग्रुप करके — DNS हाइजैकिंग या गड़बड़ी पकड़ने का आसान तरीका.
* 📓 **Whois खोज**: डोमेन नाम, IP पते और AS नंबर के लिए Whois लुकअप करता है.
* 🗄️ **MAC लुकअप**: किसी हार्डवेयर (MAC) पते के पीछे की कंपनी और जानकारी बताता है.
* 🧮 **IP कैलकुलेटर**: किसी भी IP, प्रीफ़िक्स, रेंज या सूची के लिए सबनेट का हिसाब, फ़ॉर्मैट बदलना और IPv6 इंटरफ़ेस की जानकारी — सब कुछ आपके डिवाइस पर ही.
* 🛰️ **ASN जानकारी और अपस्ट्रीम टोपोलॉजी**: हर IP कार्ड पर ही — AS की जानकारी, IP के प्रीफ़िक्स की पिछली घोषणाएं, और उसके ASN से Tier 1 बैकबोन तक के अपस्ट्रीम रास्ते.
* 🛂 **ASN प्रोफ़ाइल**: किसी भी AS की पूरी तस्वीर — मूल Whois रिकॉर्ड के साथ रजिस्ट्रेशन, दुनिया में रैंक और आकार, ट्रैफ़िक और कनेक्शन की गुणवत्ता, उसका IPv4 स्पेस कहां इस्तेमाल होता है, RPKI स्थिति के साथ हर घोषित प्रीफ़िक्स, उसके अपस्ट्रीम, पीयर और ग्राहक, और वे इंटरनेट एक्सचेंज और डेटा सेंटर जहां वह मौजूद है.
* 📶 **सेवा की स्थिति**: जानी-मानी सेवाओं — Claude, OpenAI, GitHub, Cloudflare और दूसरी — की लाइव स्थिति, उनके आधिकारिक स्टेटस पेज से, हाल की घटनाओं के साथ.

### ✨ प्लैटफ़ॉर्म

* 📤 **शेयर करने लायक रिपोर्ट**: अपनी जांच के नतीजों से एक जांच रिपोर्ट बनाएं — अपने-आप खत्म होने वाला सिर्फ़ पढ़ने लायक लिंक, AI के लिए तैयार Markdown, या JSON.
* ⌨️ **Curl API**: टर्मिनल से एक `curl` कमांड में अपना IP जानें.
* 🌍 **Earth Online**: एक पैनल जो दुनिया भर में इंटरनेट ठप होने की घटनाएं होते ही दिखाता है.
* 🌗 **डार्क मोड**: अपने-आप आपके सिस्टम की सेटिंग अपनाता है, और हाथ से बदलने का विकल्प भी है.
* 📲 **PWA**: फ़ोन पर ऐप की तरह और डेस्कटॉप पर Chrome ऐप की तरह इंस्टॉल किया जा सकता है.
* ⚡ **कीबोर्ड शॉर्टकट**: हर सुविधा का एक शॉर्टकट है — सूची देखने के लिए `?` दबाएं.
* 🔤 **कई भाषाएं**: UI 6 भाषाओं में उपलब्ध है, और अपनी भाषा जोड़ने के लिए बस एक लोकेल पैक चाहिए.

## 📕 इस्तेमाल कैसे करें

### Docker से

बस एक कमांड और यह चालू:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

या इस पेज के ऊपर दिए "Deploy with Docker" बटन पर क्लिक करें.

### Node के साथ डिप्लॉय करना

पक्का करें कि Node.js इंस्टॉल है, फिर कोड क्लोन करें:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

इंस्टॉल और बिल्ड करें. यह प्रोजेक्ट pnpm इस्तेमाल करता है — अगर आपके पास नहीं है, तो पहले इसे इंस्टॉल करें (npm, Node के साथ आता है, इसलिए यह कमांड हमेशा काम करती है):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

चलाएं:

```bash
pnpm start
```

प्रोग्राम पोर्ट 18966 पर चलेगा.

## ⚙️ कॉन्फ़िगरेशन

> [!IMPORTANT]
> **MaxMind GeoLite2 क्रेडेंशियल ज़रूरी हैं.** IP की जगह और ASN की जानकारी इन्हीं से मिलती है — इनके बिना MaxMind स्रोत 503 लौटाता है. ये मुफ़्त हैं: → [MaxMind Setup](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **असली डोमेन पर `ALLOWED_DOMAINS` ज़रूरी है.** यह बैकएंड API के लिए अनुमति वाले होस्टनेम की सूची है — इसके बिना localhost के अलावा किसी भी डोमेन से आने वाले हर अनुरोध को 403 मिलता है. → [Reverse Proxy & Domains](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e DATASET_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

बाकी सब कुछ — वैकल्पिक API कुंजियां, सुरक्षा और रेट लिमिटिंग, लॉगिंग, Sentry, curl API के डोमेन — [Environment Variables reference](https://docs.ipcheck.ing/developer/reference/environment-variables) में लिखा है.

## 📖 दस्तावेज़

पूरी गाइड MyIP Docs Center में हैं: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Developer Guide](https://docs.ipcheck.ing/developer) — डिप्लॉयमेंट, कॉन्फ़िगरेशन, आर्किटेक्चर और योगदान
* [Knowledge Base](https://docs.ipcheck.ing/knowledge-base) — हर टूल का इस्तेमाल, नेटवर्क की गड़बड़ी को कदम-दर-कदम समझना, और नेटवर्किंग की बुनियादी बातें

## 🤝 योगदान

योगदान का स्वागत है! हम नए लोगों के लिए आसान कामों की एक चुनी हुई सूची रखते हैं — हर काम में सही फ़ाइल पाथ, पूरा होने की शर्तें और टेस्ट हैं, जो आपको ग्रीन बिल्ड तक ले जाते हैं:

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — अपने देश का DNS रिज़ॉल्वर जोड़ें, साइटों की सूचियां जोड़ें, README का अपनी भाषा में अनुवाद करें, अनुवाद बेहतर बनाएं, और भी बहुत कुछ
* 🌐 [TRANSLATING.md](TRANSLATING.md) — UI को अपनी भाषा में लाएं: एक लोकेल पैक और रजिस्ट्री की एक लाइन, और **अधूरा अनुवाद भी पहले PR के रूप में स्वागत योग्य है**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — सेटअप, नियम, और PR कैसे आगे बढ़ते हैं (`dev` ब्रांच को टारगेट करें)

## 👩🏻‍💻 ऐडवांस इस्तेमाल

<details>
<summary>असली IP और प्रॉक्सी IP दोनों एक साथ जांचने के लिए प्रॉक्सी नियम</summary>

अगर आप इंटरनेट के लिए प्रॉक्सी इस्तेमाल करते हैं, तो यह नियम अपनी प्रॉक्सी कॉन्फ़िगरेशन में जोड़ें (अपने क्लाइंट के हिसाब से बदल लें). इससे आप अपना असली IP और प्रॉक्सी वाला IP, दोनों देख सकते हैं:

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

## 💖 स्पॉन्सर और सपोर्टर

एक ओपन-सोर्स प्रोजेक्ट के तौर पर, मैं इन स्पॉन्सर का उनके सहयोग के लिए बहुत आभारी हूं:

**स्पॉन्सर**

<a href="https://www.swiftproxy.net/?ref=myip"><img src="https://res.ipcheck.ing/img/swiftproxy_logo.png" alt="SwiftProxy" height="48" /></a><br />
<sub>↳ **<a href="https://www.swiftproxy.net/?ref=myip">SwiftProxy</a>** — High-quality rotating and static residential proxies, with 90M+ residential IPs across 220+ locations worldwide. It supports HTTP(S), SOCKS5, rotating and sticky sessions, with residential proxy plans starting at just $0.7/GB. Use code `PROXY90` for an additional 10% off.
</sub>

<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4"><img src="https://res.ipcheck.ing/img/proxyseller_logo.png" alt="Proxy-Seller" height="48" /></a><br />
<sub>↳ **<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4">Proxy-Seller</a>** — offers private residential, mobile (4G/5G/LTE), ISP, and datacenter IPv4/IPv6 proxies with HTTP(S) and SOCKS5 support, 47M+ residential IPs in 220+ locations, precise country/city/ISP targeting, 99.7% uptime, and 24/7 support. MyIP users can use promo code `CHECKINGIP15` to get 15% off.
</sub>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=hi"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="V.PS" height="48" /></a><br />
<sub>↳ **<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=hi">V.PS</a>** — High-performance KVM VPS with global locations, fast connectivity, and IPv4 & IPv6 included.</sub>

----

**सपोर्टर**

<p><a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" height="32" /></a></p>
<p><a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" height="32" /></a></p>
<p><a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" height="32" /></a></p>
<p><a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" height="32" /></a></p>
<p><a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" height="32" /></a></p>

MyIP को स्पॉन्सर करना चाहते हैं? [स्पॉन्सर बनें](https://github.com/sponsors/jason5ng32)

## 📄 लाइसेंस

[AGPL-3.0](LICENSE) © Jason Ng

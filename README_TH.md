# 🧰 MyIP - กล่องเครื่องมือ IP ที่ดีกว่าเดิม

> [!NOTE]
> นี่คือคำแปลที่ดูแลโดยชุมชน README ภาษาอังกฤษคือต้นฉบับหลัก ฉบับนี้อาจอัปเดตไม่ทันต้นฉบับ

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

กล่องเครื่องมือ IP แบบโอเพนซอร์สที่รวมทุกอย่างไว้ในที่เดียว: ตรวจ IP จากหลายแหล่ง, ทดสอบการเชื่อมต่อ, ตรวจจับ WebRTC และ DNS รั่ว, ทดสอบความเร็ว, MTR, ตรวจการเซ็นเซอร์, Whois และอีกมากมาย ติดตั้งบนเซิร์ฟเวอร์ของคุณเองได้ด้วยคำสั่ง Docker เพียงคำสั่งเดียว

👉 เดโม: [https://ipcheck.ing](https://ipcheck.ing)

จะบุ๊กมาร์กเว็บเดโมไว้ใช้ หรือติดตั้งเองก็ได้ตามสะดวก

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 ฟีเจอร์

### 🪪 IP และตัวตนของคุณ

* 🛜 **IP Cards**: ตรวจ IPv4 และ IPv6 ของคุณจากหลายแหล่งที่เป็นอิสระต่อกันแล้วแสดงเทียบกัน พร้อมประเทศ ภูมิภาค เมือง ASN องค์กร และเขตเวลาท้องถิ่นของ IP นั้น
* 🔍 **ค้นหา IP**: ดูข้อมูลละเอียดแบบเดียวกันของ IP ใดก็ได้ที่คุณอยากรู้
* 🧾 **ประวัติ IP**: บันทึก IP ที่คุณเคยใช้ไว้ในเครื่อง กรองตามประเภทและประเทศได้ ข้อมูลเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น
* 🖥️ **Browser Fingerprint**: คำนวณลายนิ้วมือเบราว์เซอร์ของคุณด้วยหลายวิธี และแสดงว่าอะไรบ้างที่ทำให้คุณถูกระบุตัวตนได้

### 🕵️ การรั่วไหลและความเป็นส่วนตัว

* 🚥 **ตรวจ WebRTC**: เผย IP ที่หลุดออกไประหว่างการเชื่อมต่อ WebRTC รวมถึงบอกว่าเบราว์เซอร์ของคุณเปิดการป้องกันความเป็นส่วนตัวไว้หรือไม่
* 🛑 **ทดสอบ DNS รั่ว**: แสดงว่าเซิร์ฟเวอร์ DNS ตัวไหนบ้างที่ตอบคำขอของคุณ เพื่อประเมินความเสี่ยง DNS รั่วเวลาใช้ VPN หรือพร็อกซี
* 🛡️ **ทดสอบการบล็อกโฆษณาและตัวติดตาม**: ตรวจว่าตัวบล็อกโฆษณา เบราว์เซอร์ ตัวกรอง DNS VPN หรือเราเตอร์ของคุณบล็อกอะไรได้จริง ทั้งเครือข่ายโฆษณา ระบบวิเคราะห์ ตัวติดตามโซเชียล ระบบมอนิเตอร์ข้อผิดพลาด การส่งข้อมูลกลับของผู้ผลิตอุปกรณ์ สคริปต์ติดตาม และการซ่อนองค์ประกอบบนหน้าเว็บ
* 📋 **เช็กลิสต์ความปลอดภัย**: เช็กลิสต์ความปลอดภัยไซเบอร์ส่วนบุคคล 258 ข้อใน 12 หมวด บันทึกความคืบหน้าไว้ในเบราว์เซอร์

### 📡 ทดสอบเครือข่าย

* 🚦 **ตรวจการเชื่อมต่อ**: ทดสอบว่าเข้าถึงเว็บที่คุณเลือกได้หรือไม่ สูงสุด 60 เว็บ วัดหลายรอบแล้วเอาค่าหน่วงต่ำสุด มีรายการเว็บสำเร็จรูปให้นำเข้า ตั้งแต่ชุดประจำประเทศไปจนถึง AI โซเชียล สตรีมมิง เกม นักพัฒนา และอื่น ๆ แล้วสรุปจากผลว่าตอนนี้คุณเข้าถึงอินเทอร์เน็ตทั่วโลกได้หรือไม่
* 🚀 **ทดสอบความเร็ว**: วัดความเร็วดาวน์โหลด อัปโหลด และค่าหน่วงกับเครือข่าย edge
* ⏱️ **ทดสอบค่าหน่วงทั่วโลก**: ping เป้าหมายของคุณจากจุดวัดทั่วโลก เลือกประเทศได้จากจุดวัดของ Globalping ทั้งหมด จัดกลุ่มตามทวีป
* 🚉 **ทดสอบ MTR**: รัน MTR จากจุดวัดที่กระจายอยู่ทั่วโลก เพื่อดูเส้นทางที่แพ็กเก็ตวิ่งจริง
* 🚧 **ตรวจการเซ็นเซอร์**: แสดงว่าเว็บไซต์ถูกบล็อกที่ไหนบ้างทั่วโลก และถูกบล็อกด้วยวิธีใด
* 🚏 **ทดสอบกฎพร็อกซี**: ตรวจว่ากฎในโปรแกรมพร็อกซีของคุณทำงานตามที่ตั้งใจไว้จริง

### 🔦 ค้นหาข้อมูลและโครงสร้างพื้นฐาน

* 📟 **DNS Resolver**: แปลงโดเมนผ่าน resolver หลายตัวพร้อมกัน จัดกลุ่มตามประเทศ ช่วยให้เห็นได้ง่ายว่า DNS ถูกดักแก้ (hijack) หรือถูกปนเปื้อนหรือไม่
* 📓 **ค้นหา Whois**: ค้น Whois ของชื่อโดเมน IP และหมายเลข AS
* 🗄️ **ค้นหา MAC**: ระบุผู้ผลิตและรายละเอียดของ MAC address
* 🧮 **IP Calculator**: คำนวณ subnet แปลงรูปแบบการเขียน และดูรายละเอียด interface ของ IPv6 สำหรับ IP, prefix, ช่วง หรือรายการ IP ใดก็ได้ คำนวณในเครื่องทั้งหมด
* 🛰️ **ข้อมูล ASN และโทโพโลยีต้นทาง**: อยู่บน IP Card ทุกใบ มีรายละเอียด AS ประวัติการประกาศ prefix ของ IP นั้น และเส้นทางต้นทางจาก ASN ไปจนถึงแกนหลัก Tier 1
* 🛂 **โปรไฟล์ ASN**: ภาพรวมครบถ้วนของ AS ใดก็ได้ ทั้งข้อมูลการจดทะเบียนพร้อม Whois ดิบ อันดับและขนาดระดับโลก ปริมาณทราฟฟิกและคุณภาพการเชื่อมต่อ พื้นที่ใช้งาน IPv4 ทุก prefix ที่ประกาศพร้อมสถานะ RPKI ผู้ให้บริการต้นทาง peer และลูกค้า รวมถึงจุดแลกเปลี่ยนอินเทอร์เน็ตและดาต้าเซ็นเตอร์ที่ AS นั้นตั้งอยู่
* 📶 **สถานะบริการ**: สถานะการใช้งานแบบเรียลไทม์ของบริการดัง ๆ เช่น Claude, OpenAI, GitHub, Cloudflare และอื่น ๆ ดึงจากหน้าสถานะทางการ พร้อมเหตุขัดข้องล่าสุด

### ✨ แพลตฟอร์ม

* 📤 **รายงานที่แชร์ได้**: เปลี่ยนผลทดสอบเป็นรายงานวินิจฉัย ในรูปแบบลิงก์อ่านอย่างเดียวที่หมดอายุเอง, Markdown ที่พร้อมส่งให้ AI หรือ JSON
* ⌨️ **Curl API**: ดู IP ของคุณจาก terminal ด้วยคำสั่ง `curl` คำสั่งเดียว
* 🌍 **Earth Online**: แผงที่รายงานเหตุอินเทอร์เน็ตล่มทั่วโลกแบบทันที
* 🌗 **โหมดมืด**: เปลี่ยนตามระบบอัตโนมัติ และสลับเองได้
* 📲 **PWA**: ติดตั้งเป็นแอปบนมือถือ และเป็นแอป Chrome บนเดสก์ท็อปได้
* ⚡ **คีย์ลัด**: ทุกฟังก์ชันมีคีย์ลัด กด `?` เพื่อดูรายการทั้งหมด
* 🔤 **หลายภาษา**: หน้าเว็บมีให้ 6 ภาษา และเพิ่มภาษาของคุณได้ด้วยไฟล์ภาษาเพียงชุดเดียว

## 📕 วิธีใช้งาน

### ใช้ Docker

คำสั่งเดียวก็พร้อมใช้งาน:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

หรือกดปุ่ม "Deploy with Docker" ที่ด้านบนของหน้านี้

### ติดตั้งในสภาพแวดล้อม Node

ตรวจให้แน่ใจว่าติดตั้ง Node.js แล้ว จากนั้น clone โค้ด:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

ติดตั้งและ build โปรเจกต์นี้ใช้ pnpm ถ้ายังไม่มี ให้ติดตั้งก่อน (npm มากับ Node อยู่แล้ว คำสั่งนี้จึงใช้ได้เสมอ):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

รัน:

```bash
pnpm start
```

โปรแกรมจะทำงานที่พอร์ต 18966

## ⚙️ การตั้งค่า

> [!IMPORTANT]
> **ต้องมีข้อมูลบัญชี MaxMind GeoLite2** ใช้สำหรับระบุตำแหน่ง IP และค้นหา ASN ถ้าไม่มี แหล่งข้อมูล MaxMind จะตอบกลับเป็น 503 สมัครได้ฟรี → [ตั้งค่า MaxMind](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **ต้องตั้ง `ALLOWED_DOMAINS` เมื่อใช้กับโดเมนจริง** เป็นรายการชื่อโฮสต์ที่อนุญาตให้เรียก API หลังบ้าน ถ้าไม่ตั้ง ทุกคำขอจากโดเมนที่ไม่ใช่ localhost จะได้ 403 → [Reverse Proxy และโดเมน](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e DATASET_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

การตั้งค่าอื่นทั้งหมด เช่น API key เสริม ความปลอดภัยและการจำกัดอัตราคำขอ การเก็บ log, Sentry และโดเมนสำหรับ curl API มีอธิบายไว้ใน[เอกสารอ้างอิงตัวแปรสภาพแวดล้อม](https://docs.ipcheck.ing/developer/reference/environment-variables)

## 📖 เอกสาร

คู่มือฉบับเต็มอยู่ที่ MyIP Docs Center: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [คู่มือนักพัฒนา](https://docs.ipcheck.ing/developer) — การติดตั้ง การตั้งค่า สถาปัตยกรรม และการร่วมพัฒนา
* [ฐานความรู้](https://docs.ipcheck.ing/knowledge-base) — วิธีใช้เครื่องมือทุกตัว การวินิจฉัยเครือข่ายทีละขั้น และแนวคิดด้านเครือข่าย

## 🤝 ร่วมพัฒนา

ยินดีต้อนรับทุกการมีส่วนร่วม! เราคัดงานที่เหมาะกับมือใหม่ไว้ให้ แต่ละงานระบุไฟล์ที่ต้องแก้ เกณฑ์การรับงาน และมีเทสต์คอยนำทางจนกว่าจะ build ผ่าน:

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — เพิ่ม DNS resolver จากประเทศของคุณ เพิ่มรายการเว็บ แปล README เป็นภาษาของคุณ ขัดเกลาคำแปล และอื่น ๆ
* 🌐 [TRANSLATING.md](TRANSLATING.md) — แปลหน้าเว็บเป็นภาษาของคุณ ใช้ไฟล์ภาษาหนึ่งชุดกับการลงทะเบียนหนึ่งบรรทัด และ**แปลแค่บางส่วนก็ส่งเป็น PR แรกได้**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — การเตรียมเครื่อง ข้อตกลงต่าง ๆ และขั้นตอนของ PR (ส่งเข้า branch `dev`)

## 👩🏻‍💻 การใช้งานขั้นสูง

<details>
<summary>กฎพร็อกซีสำหรับดู IP จริงกับ IP ของพร็อกซีพร้อมกัน</summary>

ถ้าคุณใช้พร็อกซีในการเข้าอินเทอร์เน็ต ลองเพิ่มกฎนี้ในการตั้งค่าพร็อกซี (ปรับตามโปรแกรมที่คุณใช้) จะช่วยให้ดูได้ทั้ง IP จริงและ IP ตอนใช้พร็อกซี:

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

## 💖 ผู้สนับสนุน

ในฐานะโปรเจกต์โอเพนซอร์ส ขอขอบคุณผู้สนับสนุนต่อไปนี้เป็นอย่างยิ่ง:

**Sponsors**

<a href="https://www.swiftproxy.net/?ref=myip"><img src="https://res.ipcheck.ing/img/swiftproxy_logo.png" alt="SwiftProxy" height="48" /></a><br />
<sub>↳ **<a href="https://www.swiftproxy.net/?ref=myip">SwiftProxy</a>** — พร็อกซี residential คุณภาพสูงทั้งแบบหมุนเวียนและแบบคงที่ มี IP residential มากกว่า 90 ล้าน IP ในกว่า 220 พื้นที่ทั่วโลก รองรับ HTTP(S), SOCKS5, session แบบหมุนเวียนและแบบคงที่ แพ็กเกจ residential เริ่มต้นเพียง $0.7/GB ใช้โค้ด `PROXY90` รับส่วนลดเพิ่มอีก 10%
</sub>

<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4"><img src="https://res.ipcheck.ing/img/proxyseller_logo.png" alt="Proxy-Seller" height="48" /></a><br />
<sub>↳ **<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4">Proxy-Seller</a>** — ให้บริการพร็อกซีส่วนตัวแบบ residential, mobile (4G/5G/LTE), ISP และดาต้าเซ็นเตอร์ทั้ง IPv4/IPv6 รองรับ HTTP(S) และ SOCKS5 มี IP residential มากกว่า 47 ล้าน IP ในกว่า 220 พื้นที่ เลือกประเทศ/เมือง/ISP ได้แม่นยำ uptime 99.7% และซัพพอร์ตตลอด 24 ชั่วโมง ผู้ใช้ MyIP ใช้โค้ด `CHECKINGIP15` รับส่วนลด 15%
</sub>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=th"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="V.PS" height="48" /></a><br />
<sub>↳ **<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=th">V.PS</a>** — VPS แบบ KVM ประสิทธิภาพสูง มีหลายพื้นที่ทั่วโลก เชื่อมต่อเร็ว ให้ทั้ง IPv4 และ IPv6</sub>

----

**Supporters**

<p><a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" height="32" /></a></p>
<p><a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" height="32" /></a></p>
<p><a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" height="32" /></a></p>
<p><a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" height="32" /></a></p>
<p><a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" height="32" /></a></p>

สนใจสนับสนุน MyIP? [มาเป็นผู้สนับสนุน](https://github.com/sponsors/jason5ng32)

## 📄 สัญญาอนุญาต

[AGPL-3.0](LICENSE) © Jason Ng

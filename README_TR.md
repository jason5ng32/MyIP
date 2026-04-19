# 🧰 MyIP - Daha İyi Bir IP Araç Kutusu

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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇫🇷 [Français](README_FR.md) | 🇹🇷 [Türkçe](README_TR.md)

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Demo'yu yer imlerine ekleyebilir veya kendi kurulumunuzu yapabilirsiniz.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Ana Özellikler

* 🛜 **IP'lerinizi Görüntüleyin**: Yerel IP'lerinizi tespit eder ve birden fazla IPv4/IPv6 sağlayıcısından alır.
* 🔍 **IP Bilgisi Arama**: Herhangi bir IP adresi hakkında sorgu yapma aracı sağlar.
* 🕵️ **IP Bilgileri**: Ülke, bölge, ASN, coğrafi konum ve daha fazlasını içeren ayrıntılı IP bilgileri sunar.
* 🚦 **Erişilebilirlik Kontrolü**: Google, GitHub, YouTube, ChatGPT ve diğerleri gibi sitelerin erişilebilirliğini test eder.
* 🚥 **WebRTC Tespiti**: WebRTC bağlantısında kullanılan IP adresini belirler.
* 🛑 **DNS Leak Testi**: VPN veya proxy kullanırken DNS sızıntısı riskini değerlendirmek için DNS uç nokta verilerini gösterir.
* 🚀 **Hız Testi**：Edge ağlarıyla ağ hızınızı test edin.
* 🚏 **Proxy Kural Testi**: Proxy yazılımlarının kural ayarlarını doğru çalışıp çalışmadığını test edin.
* ⏱️ **Küresel Gecikme Testi**: Dünyanın farklı bölgelerindeki sunuculara gecikme testleri yapın.
* 📡 **MTR Testi**: Dünya çapındaki sunucular için MTR testleri gerçekleştirin.
* 🔦 **DNS Çözücüsü**: Bir alan adının birden fazla kaynaktan DNS çözümlemesini yapar ve gerçek zamanlı çözümleme sonuçları alır.
* 🚧 **Sansür Kontrolü**: Bir web sitesinin bazı ülkelerde engellenip engellenmediğini kontrol edin.
* 📓 **Whois Arama**: Alan adı veya IP adresi için whois bilgisi sorgulayın.
* 📀 **MAC Sorgulama**: Fiziksel adres bilgisi sorgulama.
* 🖥️ **Tarayıcı Parmak İzi**：Tarayıcı parmak izini hesaplamak için birden fazla yöntem.
* 📋 **Siber Güvenlik Kontrol Listesi**：Toplam 258 madde içeren kapsamlı bir güvenlik kontrol listesi.

## 💪 Ayrıca

* 🌗 **Karanlık Mod**: Sistem ayarlarına göre otomatik olarak gündüz/karanlık mod arasında geçiş yapar; manuel geçiş seçeneği de vardır.
* 📱 **Minimal Mod**: Mobil için optimize edilmiş, sayfa uzunluğunu kısaltan hızlı erişim modu.
* 📲 **PWA Desteği**：Telefonunuza masaüstü uygulaması olarak veya bilgisayarınızda Chrome uygulaması olarak eklenebilir.
* ⌨️ **Klavye Kısayolları**: Tüm işlevler için kısayolları destekler; kısayol listesini görmek için `?` tuşuna basın.
* 🌍 Erişilebilirlik test sonuçlarına göre küresel internet erişiminin şu an mümkün olup olmadığını gösterir.
* 🇺🇸 🇨🇳 🇫🇷 🇹🇷 İngilizce, Çince, Fransızca ve Türkçe desteği.

## 📕 Nasıl Kullanılır

### Node Ortamında Dağıtım

Node.js yüklü olduğundan emin olun.

Kodu klonlayın:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Kurun ve derleyin:

```bash
npm install && npm run build
```

Çalıştırın:

```bash
npm start
```

Uygulama 18966 portunda çalışacaktır.

### Docker Kullanımı

Üstteki 'Deploy to Docker' butonuna tıklayarak dağıtımı tamamlayabilirsiniz. Veya şu komutu kullanın:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📚 Ortam Değişkenleri

Aşağıda **Evet** olarak işaretlenen değişkenler, backend'in düzgün çalışması için mutlaka ayarlanmalıdır. Özellikle MaxMind kimlik bilgileri gereklidir — tabloyu doldurmadan önce aşağıdaki MaxMind yapılandırma notlarını okuyun.

### MaxMind Veritabanları (zorunlu)

MyIP, IP coğrafi konumu, ASN / kuruluş araması ve uygulama genelinde görünen ülke kodu rozetleri (IP kartları, WebRTC ICE adayları vb.) için MaxMind'in ücretsiz **GeoLite2** veritabanlarına (City + ASN) güvenir. Backend'in tam bir deneyim sunması için çalışan bir MaxMind kurulumu zorunludur.

MaxMind'in GeoLite2 lisansı yeniden dağıtıma izin vermediği için `.mmdb` dosyaları **bu depoda yer almıyor**. Kendiniz sağlamanız gerekir. İki yol vardır:

**Seçenek A — Otomatik (önerilir, Docker için zorunlu)**

1. [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup) adresinden ücretsiz bir hesap oluşturun.
2. Hesabınızın "Manage License Keys" sayfasından bir lisans anahtarı oluşturun.
3. Şu üç ortam değişkenini ayarlayın:
   ```bash
   MAXMIND_ACCOUNT_ID="your-account-id"
   MAXMIND_LICENSE_KEY="your-license-key"
   MAXMIND_AUTO_UPDATE="true"
   ```
4. Backend'i başlatın. İlk başlatmadan yaklaşık 60 saniye sonra updater her iki veritabanını da indirir. Sonrasında her 24 saatte bir otomatik olarak yenilenir.

> ⚠️ **Docker dağıtımları Seçenek A'yı kullanmak zorundadır.** Yeni bir konteyner boş bir `common/maxmind-db/` dizini ile gelir — yukarıdaki üç değişken ayarlanmadan backend başlar, ancak MaxMind tabanlı IP kaynağı ve WebRTC ülke rozetleri çalışmaz ve her başlatma logunda `MaxMind API will return 503...` hatasını görürsünüz.

**Seçenek B — Manuel (izole / Docker dışı ortamlar için)**

MaxMind hesabınızdan `GeoLite2-City.mmdb` ve `GeoLite2-ASN.mmdb` dosyalarını indirin ve backend'i başlatmadan önce `common/maxmind-db/` dizinine bırakın. Bu durumda `MAXMIND_AUTO_UPDATE` `"false"` olarak kalabilir, ancak MaxMind yeni sürümler yayınladıkça dosyaları manuel olarak yenilemeniz gerekir.

### Ortam değişkenleri listesi

| Değişken Adı | Zorunlu | Varsayılan Değer | Açıklama |
| --- | --- | --- | --- |
| `IPCHECKING_API_ENDPOINT` | **Evet** | `""` | IPCheck.ing API uç noktası |
| `MAXMIND_ACCOUNT_ID` | **Evet** | `""` | MaxMind hesap ID'si, GeoLite2 veritabanlarını indirmek için `MAXMIND_LICENSE_KEY` ile birlikte kullanılır. Yukarıdaki MaxMind bölümüne bakın. |
| `MAXMIND_LICENSE_KEY` | **Evet** | `""` | MaxMind lisans anahtarı, `MAXMIND_ACCOUNT_ID` ile birlikte kullanılır. Yukarıdaki MaxMind bölümüne bakın. |
| `MAXMIND_AUTO_UPDATE` | **Evet** | `"false"` | `"true"` yapıldığında GeoLite2 veritabanları başlatmadan yaklaşık 60 saniye sonra otomatik olarak indirilir ve her 24 saatte bir yenilenir. **Docker için zorunlu.** Yalnızca `.mmdb` dosyalarını manuel olarak yerleştirdiyseniz `"false"` olarak kalabilir. |
| `VITE_GOOGLE_ANALYTICS_ID` | **Evet** | `""` | Google Analytics ID, kullanıcı davranışını izlemek için |
| `BACKEND_PORT` | Hayır | `"11966"` | Backend kısmının çalıştığı port |
| `FRONTEND_PORT` | Hayır | `"18966"` | Frontend kısmının çalıştığı port |
| `SECURITY_RATE_LIMIT` | Hayır | `"0"` | Bir IP'nin backend sunucusuna 60 dakikada yapabileceği istek sayısını kontrol eder (sınır yok için 0) |
| `SECURITY_DELAY_AFTER` | Hayır | `"0"` | 20 dakikada bir IP'den gelen ilk X isteğin hız sınırına tabi olmadığını kontrol eder; X'ten sonra gecikme artar |
| `SECURITY_BLACKLIST_LOG_FILE_PATH` | Hayır | `"logs/blacklist-ip.log"` | Yol ayarı. SECURITY_RATE_LIMIT etkinleştirildiğinde limit tetikleyen IP'leri kaydeder |
| `ALLOWED_DOMAINS` | Hayır | `""` | Erişime izin verilen alan adları, virgülle ayrılmış; backend API kötüye kullanımını önlemek için kullanılır |
| `GOOGLE_MAP_API_KEY` | Hayır | `""` | IP'nin konumunu haritada göstermek için Google Maps API Anahtarı |
| `IPCHECKING_API_KEY` | Hayır | `""` | IPCheck.ing API anahtarı, doğru IP konum bilgisi almak için |
| `IPINFO_API_TOKEN` | Hayır | `""` | IPInfo.io API token'ı, IP konum bilgisi almak için |
| `IPAPIIS_API_KEY` | Hayır | `""` | IPAPI.is API anahtarı, IP konum bilgisi almak için |
| `IP2LOCATION_API_KEY` | Hayır | `""` | IP2Location.io API anahtarı, IP konum bilgisi almak için |
| `CLOUDFLARE_API` | Hayır | `""` | Cloudflare API anahtarı, AS sistemi bilgisi almak için |
| `MAC_LOOKUP_API_KEY` | Hayır | `""` | MAC Lookup API anahtarı, MAC adresi bilgisi almak için |
| `VITE_CURL_IPV4_DOMAIN` | Hayır | `""` | Kullanıcılara CURL API için IPv4 domain sağlar |
| `VITE_CURL_IPV6_DOMAIN` | Hayır | `""` | Kullanıcılara CURL API için IPv6 domain sağlar |
| `VITE_CURL_IPV64_DOMAIN` | Hayır | `""` | Kullanıcılara CURL API için dual-stack domain sağlar |

CURL serisi ortam değişkenlerinden herhangi biri eksikse, CURL API etkinleştirilmeyecektir.

### Node Ortamında Ortam Değişkenleri Kullanma

Ortam değişkenlerini oluşturun:

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin, örneğin şu şekilde ekleyin:

```bash
BACKEND_PORT=11966
FRONTEND_PORT=18966
IPCHECKING_API_ENDPOINT="YOUR_ENDPOINT_HERE"
MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID"
MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY"
MAXMIND_AUTO_UPDATE="true"
GOOGLE_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
```

Ardından backend servisini yeniden başlatın.

### Docker'da Ortam Değişkenleri Kullanma

Docker çalıştırırken ortam değişkenleri ekleyebilirsiniz, örneğin:

```bash
docker run -d -p 18966:18966 \
  -e IPCHECKING_API_ENDPOINT="YOUR_ENDPOINT_HERE" \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e GOOGLE_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  --name myip \
  jason5ng32/myip:latest
```

## 👩🏻‍💻 Gelişmiş Kullanım

İnternet erişimi için proxy kullanıyorsanız, istemcinize göre düzenleyebileceğiniz aşağıdaki kuralı eklemeyi düşünün. Bu yapılandırma hem gerçek IP'nizi hem de proxy kullanırken görünen IP'nizi kontrol etmenizi sağlar:

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

## 😶‍🌫️ Ek Notlar

Sürüm 2.0 yayımlandığında, bu programın kodunun %70'inin AI tarafından yazıldığını söylemiştim. Yaklaşık 90 etkileşim ve bazı küçük manuel düzeltmeler sonrasında, tüm kod tabanı tamamlandı.

Elbette, mimari ve kullanıcı arayüzü hâlâ benim tasarımım oldu.

Sürüm 3.0 ve sonrasıyla birlikte AI yardımıyla yazılan kod oranı giderek azaldı; şimdi tahmini %40–50 aralığında. Bu süreçte JavaScript ve Vue hakkında hiç bilgim yokken, çoğu JS kodunu anlayacak seviyeye geldim ve artık biraz da yazabiliyorum.

Yapay zekâ sayesinde, işsiz bir ürün yöneticisi olarak programlamayı hızlıca öğrenme imkânı buldum.

## 🌟 Yıldız Geçmişi

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)

## 💖 Sponsorlar

Açık kaynak proje olarak, destekleri için aşağıdaki sponsorlarımıza minnettarım:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://opensource.nyc3.cdn.digitaloceanspaces.com/attribution/assets/SVG/DO_Logo_horizontal_blue.svg" height="40px" title="DigitalOcean" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://cf-assets.www.cloudflare.com/zkvhlag99gkb/69RwBidpiEHCDZ9rFVVk7T/092507edbed698420b89658e5a6d5105/CF_logo_stacked_blktype.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" height="60px" /></a>

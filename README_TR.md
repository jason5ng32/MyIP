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

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH-TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md) | [Shqip](README_SQ.md) | [ไทย](README_TH.md) | [हिन्दी](README_HI.md) | [Türkçe](README_TR.md)

> 🌐 Bu, topluluk tarafından hazırlanan bir çeviridir; esas metin İngilizce [README.md](README.md) dosyasıdır.

Açık kaynaklı, hepsi bir arada IP araç kutusu: birden fazla kaynaktan IP sorgulama, bağlantı testleri, WebRTC ve DNS sızıntısı tespiti, hız testi, MTR, sansür kontrolleri, Whois ve daha fazlası. Tek bir Docker komutuyla kendi sunucunuzda çalıştırabilirsiniz.

👉 Demo: [https://ipcheck.ing](https://ipcheck.ing)

Demoyu yer imlerinize ekleyebilir veya kendiniz kurabilirsiniz.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Özellikler

### 🪪 IP'niz ve Kimliğiniz

* 🛜 **IP Kartları**: IPv4 ve IPv6 adresinizi birbirinden bağımsız birden fazla kaynaktan yan yana algılar: ülke, bölge, şehir, ASN, kuruluş ve IP'nin yerel saat dilimi.
* 🔍 **IP Sorgula**: Merak ettiğiniz herhangi bir IP adresi için aynı ayrıntılı bilgiyi getirir.
* 🧾 **IP Geçmişi**: Hangi IP'lerle görüldüğünüzün yerel bir kaydını tutar; türe ve ülkeye göre filtrelenebilir. Yalnızca tarayıcınızda saklanır.
* 🖥️ **Tarayıcı Parmak İzi**: Tarayıcı parmak izinizi birden fazla yöntemle hesaplar ve sizi tanınabilir kılan öğeleri gösterir.

### 🕵️ Sızıntılar ve Gizlilik

* 🚥 **WebRTC Tespiti**: WebRTC bağlantıları sırasında açığa çıkan IP adresini gösterir; tarayıcınızın gizlilik korumasının açık olup olmadığını da belirtir.
* 🛑 **DNS Sızıntı Testi**: Sorgularınızı hangi DNS uç noktalarının çözdüğünü göstererek VPN veya proxy kullanırken DNS sızıntısı riskini değerlendirmenize yardımcı olur.
* 🛡️ **Reklam ve İzleyici Engelleme Testi**: Reklam engelleyicinizin, tarayıcınızın, DNS filtrenizin, VPN'inizin veya yönlendiricinizin gerçekte neyi engellediğini denetler: reklam ağları, analiz hizmetleri, sosyal medya izleyicileri, hata izleme, cihaz üreticisi telemetrisi, izleme betikleri ve öğe gizleme.
* 📋 **Güvenlik Kontrol Listesi**: 12 alana yayılan, 258 maddelik kişisel siber güvenlik kontrol listesi; ilerlemeniz tarayıcınızda kaydedilir.

### 📡 Ağ Testleri

* 🚦 **Bağlantı Kontrolü**: Seçtiğiniz en fazla 60 sitenin erişilebilirliğini, çok turlu en düşük gecikme sonuçlarıyla test eder. Ülke paketlerinden yapay zekâ, sosyal medya, yayın, oyun, geliştirici ve daha fazlasına kadar hazır içe aktarma listeleri de sunar. Sonuçlara göre, küresel internete şu anda erişilip erişilemediğini bildirir.
* 🚀 **Hız Testi**: İndirme, yükleme ve gecikmenizi uç ağlara karşı ölçer.
* ⏱️ **Küresel Gecikme Testi**: Hedefinize dünyanın dört bir yanındaki test noktalarından ping atar; tüm Globalping noktaları arasından kıtalara göre gruplanmış ülkeleri seçebilirsiniz.
* 🚉 **MTR Testi**: Paketlerin gerçekte izlediği yolu görmek için dünya geneline dağıtılmış noktalardan MTR çalıştırır.
* 🚧 **Sansür Kontrolü**: Bir web sitesinin dünyada nerelerde ve hangi yöntemle engellendiğini gösterir.
* 🚏 **Proxy Kural Testi**: Proxy yazılımınızın kural yapılandırmasının amaçladığınız gibi çalıştığını doğrular.

### 🔦 Sorgulama ve Altyapı

* 📟 **DNS Çözücü**: Bir alan adını aynı anda birden fazla çözücüyle, ülkelere göre gruplayarak çözer; ele geçirme veya DNS kirlenmesini fark etmenin kolay bir yoludur.
* 📓 **Whois Araması**: Alan adları, IP adresleri ve AS numaraları için Whois sorgusu yapar.
* 🗄️ **MAC Sorgulama**: Fiziksel adresin arkasındaki üreticiyi ve ayrıntıları belirler.
* 🧮 **IP Hesaplayıcı**: Herhangi bir IP, önek, aralık veya liste için alt ağ hesapları, gösterim dönüşümleri ve IPv6 arayüz ayrıntıları; hepsi yerelde hesaplanır.
* 🧾 **Toplu IP Sorgulama**: IP listelerini veya ham sunucu günlüklerini (Nginx, Apache, güvenlik duvarı, CDN…) yapıştırın, içindeki tüm IP'lerin konumunu bir seferde bulun.
* 🛰️ **ASN Bilgisi ve Üst Akış Topolojisi**: Her IP kartının üzerinde yer alır: AS ayrıntıları, IP'nin önekinin geçmiş duyuruları ve ASN'sinden Tier 1 omurgaya giden üst akış yolları.
* 🛂 **ASN Profili**: Herhangi bir AS'nin tam resmi: ham Whois kaydıyla birlikte kayıt bilgisi, küresel sıralaması ve büyüklüğü, trafik ve bağlantı kalitesi, IPv4 alanının kullanıldığı yerler, RPKI durumuyla birlikte duyurulan tüm önekler, üst akış sağlayıcıları, eşleri ve müşterileri ile bulunduğu internet değişim noktaları ve veri merkezleri.
* 📶 **Hizmet Durumu**: Claude, OpenAI, GitHub, Cloudflare gibi tanınmış hizmetlerin resmî durum sayfalarından alınan canlı erişilebilirlik bilgisi ve son olaylar.

### ✨ Platform

* 📤 **Paylaşılabilir Raporlar**: Test sonuçlarınızı bir tanılama raporuna dönüştürün: otomatik süresi dolan salt okunur bir bağlantı, yapay zekâya hazır Markdown veya JSON.
* ⌨️ **Curl API**: Terminalden tek bir `curl` komutuyla IP'nizi öğrenin.
* 🌍 **Earth Online**: Küresel internet kesintisi olaylarını gerçekleştikçe yayımlayan bir panel.
* 🌗 **Koyu Mod**: Sistemi otomatik takip eder, elle de değiştirilebilir.
* 📲 **PWA**: Telefonunuza uygulama olarak, masaüstünüze ise Chrome uygulaması olarak kurulabilir.
* ⚡ **Klavye Kısayolları**: Her işlevin bir kısayolu vardır; listeyi görmek için `?` tuşuna basın.
* 🔤 **Çoklu Dil**: Arayüz 6 dilde sunulur ve kendi dilinizi eklemek tek bir dil paketi gerektirir.

## 📕 Nasıl Kullanılır

### Docker ile

Tek komutla başlayın:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

Ya da bu sayfanın üstündeki "Deploy with Docker" düğmesine tıklayın.

### Node Ortamında Kurulum

Node.js'in kurulu olduğundan emin olun, ardından kodu klonlayın:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Kurun ve derleyin. Bu proje pnpm kullanır; yoksa önce kurun (npm, Node ile birlikte gelir, bu yüzden bu komut her zaman çalışır):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Çalıştırın:

```bash
pnpm start
```

Program 18966 numaralı bağlantı noktasında çalışacaktır.

## ⚙️ Yapılandırma

> [!IMPORTANT]
> **MaxMind GeoLite2 kimlik bilgileri gereklidir.** IP konum bulma ve ASN sorgularını bunlar sağlar; olmazsa MaxMind kaynağı 503 döndürür. Ücretsizdir: → [MaxMind Kurulumu](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **Gerçek bir alan adında `ALLOWED_DOMAINS` gereklidir.** Arka uç API'sinin ana bilgisayar adı izin listesidir; olmazsa localhost dışındaki bir alan adından gelen her istek 403 alır. → [Ters Proxy ve Alan Adları](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e DATASET_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

Geri kalan her şey (isteğe bağlı API anahtarları, güvenlik ve istek sınırlama, günlükleme, Sentry, curl API alan adları) [Ortam Değişkenleri başvurusunda](https://docs.ipcheck.ing/developer/reference/environment-variables) belgelenmiştir.

## 📖 Belgeler

Tüm kılavuzlar MyIP Belge Merkezi'nde: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Geliştirici Kılavuzu](https://docs.ipcheck.ing/developer): dağıtım, yapılandırma, mimari ve katkıda bulunma
* [Bilgi Bankası](https://docs.ipcheck.ing/knowledge-base): her aracın kullanımı, adım adım ağ tanılama ve ağ kavramları

## 🤝 Katkıda Bulunma

Katkılar memnuniyetle karşılanır! Başlangıç dostu görevlerden oluşan özenle seçilmiş bir liste tutuyoruz; her birinde tam dosya yolları, kabul ölçütleri ve sizi yeşil bir derlemeye ulaştıran testler var:

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue): ülkenizden bir DNS çözücü ekleyin, hazır site listeleri ekleyin, README'yi kendi dilinize çevirin, çevirileri iyileştirin ve daha fazlası
* 🌐 [TRANSLATING.md](TRANSLATING.md): arayüzü kendi dilinize getirin; bir dil paketi ve bir kayıt satırı yeterli, **kısmi çeviri de memnuniyetle karşılanan bir ilk PR'dır**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md): kurulum, kurallar ve PR'ların nasıl ilerlediği (`dev` dalını hedefleyin)

## 👩🏻‍💻 Gelişmiş Kullanım

<details>
<summary>Gerçek IP'nizi ve proxy IP'nizi aynı anda kontrol etmek için proxy kuralları</summary>

İnternete proxy ile bağlanıyorsanız, proxy yapılandırmanıza şu kuralı eklemeyi düşünün (istemcinize göre değiştirin). Bu düzenleme, hem gerçek IP'nizi hem de proxy kullanırkenki IP'nizi kontrol etmenizi sağlar:

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

## 💖 Sponsorlar ve Destekçiler

Açık kaynaklı bir proje olarak, desteklerinden dolayı aşağıdaki sponsorlara çok minnettarım:

**Sponsorlar**

<a href="https://www.swiftproxy.net/?ref=myip"><img src="https://res.ipcheck.ing/img/swiftproxy_logo.png" alt="SwiftProxy" height="48" /></a><br />
<sub>↳ **<a href="https://www.swiftproxy.net/?ref=myip">SwiftProxy</a>**: Dünya genelinde 220'den fazla konumda 90 milyondan fazla konut IP'siyle yüksek kaliteli dönen ve sabit konut proxy'leri. HTTP(S), SOCKS5, dönen ve yapışkan oturumları destekler; konut proxy planları yalnızca 0,7 $/GB'tan başlar. Ek %10 indirim için `PROXY90` kodunu kullanın.
</sub>

<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4"><img src="https://res.ipcheck.ing/img/proxyseller_logo.png" alt="Proxy-Seller" height="48" /></a><br />
<sub>↳ **<a href="https://proxy-seller.com/?partner=4FEC1644D12240F4">Proxy-Seller</a>**: HTTP(S) ve SOCKS5 destekli özel konut, mobil (4G/5G/LTE), ISP ve veri merkezi IPv4/IPv6 proxy'leri sunar; 220'den fazla konumda 47 milyondan fazla konut IP'si, ülke/şehir/ISP bazında hassas hedefleme, %99,7 çalışma süresi ve 7/24 destek sağlar. MyIP kullanıcıları %15 indirim için `CHECKINGIP15` promosyon kodunu kullanabilir.
</sub>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=tr"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="V.PS" height="48" /></a><br />
<sub>↳ **<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=tr">V.PS</a>**: Küresel konumlar, hızlı bağlantı ve dahil IPv4 ile IPv6 sunan yüksek performanslı KVM VPS.</sub>

----

**Destekçiler**

<p><a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" height="32" /></a></p>
<p><a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" height="32" /></a></p>
<p><a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" height="32" /></a></p>
<p><a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" height="32" /></a></p>
<p><a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" height="32" /></a></p>

MyIP'ye sponsor olmak mı istiyorsunuz? [Sponsor olun](https://github.com/sponsors/jason5ng32)

## 📄 Lisans

[AGPL-3.0](LICENSE) © Jason Ng

# 🧰 MyIP — удобный набор инструментов для работы с IP

<div align="center">

![Баннер IPCheck.ing](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/gh_banner.png)

<a href="https://trendshift.io/repositories/5332" target="_blank"><img src="https://trendshift.io/api/badge/repositories/5332" alt="jason5ng32%2FMyIP | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

[![Упоминается в Awesome Self Hosted](https://awesome.re/mentioned-badge.svg)](https://github.com/awesome-selfhosted/awesome-selfhosted)

![Звёзды репозитория GitHub](https://img.shields.io/github/stars/jason5ng32/MyIP)
![Форки GitHub](https://img.shields.io/github/forks/jason5ng32/myip)
![Загрузки Docker](https://img.shields.io/docker/pulls/jason5ng32/myip)

[![Сайт](https://img.shields.io/website?url=https%3A%2F%2Fipcheck.ing&up_message=online&label=IPCheck.ing 'IPCheck.ing')](https://ipcheck.ing)
![PWA](https://img.shields.io/badge/PWA-Supported-blue)

![CodeQL](https://github.com/jason5ng32/MyIP/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)
![Сборка и публикация Docker](https://github.com/jason5ng32/MyIP/actions/workflows/docker-image.yml/badge.svg?branch=main)

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇷🇺 [Русский](README_RU.md) | 🇫🇷 [Français](README_FR.md)

👉 Демо: [https://ipcheck.ing](https://ipcheck.ing)

Добавьте демо-сайт в закладки или разверните собственный экземпляр.

[![Развернуть с помощью Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Основные возможности

* 🛜 **Просмотр ваших IP-адресов**: обнаруживает и показывает локальные IP-адреса, используя несколько источников IPv4 и IPv6.
* 🔍 **Поиск информации об IP**: позволяет получить сведения о любом IP-адресе.
* 🕵️ **Информация об IP**: показывает подробные сведения обо всех IP-адресах, включая страну, регион, ASN, географическое положение и многое другое.
* 🛰️ **История ASN и топология вышестоящих сетей**: показывает историю анонсов AS для IP-префикса и визуализирует пути от ASN к магистральным сетям Tier 1.
* 🚦 **Проверка доступности**: проверяет доступность различных сайтов, например Google, GitHub, YouTube, ChatGPT и других.
* 📡 **Состояние сервисов**: показывает текущую доступность известных сервисов (Claude, OpenAI, GitHub, Cloudflare и других) по данным их официальных страниц состояния, включая состояние отдельных компонентов и недавние инциденты.
* 🚥 **Проверка WebRTC**: определяет IP-адрес, используемый при подключениях WebRTC.
* 🛑 **Тест утечки DNS**: показывает данные конечных точек DNS, чтобы оценить риск утечки DNS при использовании VPN или прокси.
* 🚀 **Тест скорости**: проверяет скорость сети с помощью пограничной инфраструктуры.
* 🚏 **Проверка правил прокси**: проверяет корректность правил маршрутизации в прокси-программах.
* ⏱️ **Глобальный тест задержки**: измеряет задержку с серверов, расположенных в разных регионах мира.
* 🚉 **Тест MTR**: выполняет MTR-тесты с серверов, расположенных в разных регионах мира.
* 🔦 **DNS-резолвер**: выполняет разрешение доменного имени через несколько источников и получает актуальные результаты, которые можно использовать для выявления подмены DNS.
* 🚧 **Проверка цензуры**: проверяет, заблокирован ли сайт в некоторых странах.
* 📓 **Поиск Whois**: получает регистрационные сведения о доменных именах и IP-адресах.
* 📀 **Поиск MAC-адреса**: получает сведения о физическом адресе устройства.
* 🖥️ **Цифровой отпечаток браузера**: позволяет рассчитать отпечаток браузера несколькими способами.
* 📋 **Контрольный список кибербезопасности**: содержит 258 рекомендаций по комплексной защите цифровой жизни.

## 💪 Дополнительно

* 🌗 **Тёмная тема**: автоматически переключается между светлой и тёмной темой в соответствии с настройками системы; также доступно ручное переключение.
* 📲 **Поддержка PWA**: сайт можно установить как приложение на телефон или компьютер через Chrome.
* ⌨️ **Сочетания клавиш**: все функции поддерживают горячие клавиши; нажмите `?`, чтобы открыть их список.
* 🌍 По результатам проверки доступности определяется, возможен ли полноценный доступ к глобальному интернету.
* 🇺🇸 🇨🇳 🇷🇺 🇫🇷 Поддерживаются английский, китайский, русский и французский языки.

## 📕 Использование

### Развёртывание в среде Node.js

Убедитесь, что Node.js установлен.

Клонируйте репозиторий:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Установите зависимости и соберите проект. Проект использует pnpm. Если pnpm ещё не установлен, сначала установите его (npm входит в состав Node.js, поэтому эта команда всегда доступна):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Запустите проект:

```bash
pnpm start
```

Приложение будет доступно на порту 18966.

### Использование Docker

Нажмите кнопку «Развернуть с помощью Docker» в верхней части страницы или выполните следующую команду:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📖 Документация

Полные руководства — в центре документации MyIP: **[docs.ipcheck.ing](https://docs.ipcheck.ing)** (переключатель языка в правом верхнем углу)

* [Руководство разработчика](https://docs.ipcheck.ing/developer) — развёртывание, настройка, архитектура и участие в разработке
* [База знаний](https://docs.ipcheck.ing/knowledge-base) — как пользоваться каждым инструментом, пошаговая диагностика сети, сетевые концепции

## ⚙️ Конфигурация

Прежде всего важны две настройки:

* **MaxMind GeoLite2 (обязательно)** — бесплатные учётные данные для геолокации IP и запросов ASN. Без них источник MaxMind возвращает 503. → [Настройка MaxMind](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)
* **`ALLOWED_DOMAINS` (обязательно на реальном домене)** — белый список хостов для backend API. Без него любой запрос с домена, отличного от localhost, получает 403. → [Обратный прокси и домены](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

Всё остальное — необязательные ключи API, безопасность и ограничение частоты запросов, логирование, Sentry, домены curl API — описано в [справочнике переменных окружения](https://docs.ipcheck.ing/developer/reference/environment-variables).


## 👩🏻‍💻 Расширенное использование

Если для доступа в интернет используется прокси, добавьте следующее правило в конфигурацию прокси-клиента, изменив его под своё приложение. Это позволит проверять как настоящий IP-адрес, так и адрес, используемый через прокси:

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

## 💖 Спонсоры

Я очень благодарен следующим спонсорам за поддержку проекта с открытым исходным кодом:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

# 🧰 MyIP — удобный набор инструментов для работы с IP

> [!NOTE]
> Это перевод, поддерживаемый сообществом; английская версия README является основной, и данная версия может отставать от неё.

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

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH_TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md)

Универсальный набор IP-инструментов с открытым исходным кодом: определение IP по нескольким источникам, проверка доступности сайтов, обнаружение утечек WebRTC и DNS, тест скорости, MTR, проверка цензуры, Whois и многое другое — разворачивается на своём сервере одной командой Docker.

👉 Демо: [https://ipcheck.ing](https://ipcheck.ing)

Добавьте демо в закладки или разверните собственный экземпляр.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Возможности

### 🪪 Ваш IP и идентичность

* 🛜 **Карточки IP**: определяют ваши IPv4 и IPv6 по нескольким независимым источникам одновременно — страна, регион, город, ASN, организация и местный часовой пояс IP-адреса.
* 🔍 **Проверка IP**: показывает те же подробные сведения о любом интересующем вас IP-адресе.
* 🧾 **История IP**: ведёт локальный журнал IP-адресов, с которых вас видели в сети, с фильтрами по типу и стране — данные хранятся только в вашем браузере.
* 🖥️ **Цифровой отпечаток браузера**: рассчитывает отпечаток браузера несколькими способами и показывает, что именно делает вас узнаваемым.

### 🕵️ Утечки и приватность

* 🚥 **Обнаружение WebRTC**: показывает IP-адрес, раскрываемый при подключениях WebRTC, — в том числе включена ли в вашем браузере усиленная защита приватности.
* 🛑 **Тест утечки DNS**: показывает, какие конечные точки DNS обрабатывают ваши запросы, чтобы оценить риск утечки DNS при использовании VPN или прокси.
* 📋 **Контрольный список безопасности**: 258 рекомендаций по личной кибербезопасности в 12 разделах; прогресс сохраняется в браузере.

### 📡 Сетевые тесты

* 🚦 **Проверка доступности**: проверяет доступность до 60 сайтов на ваш выбор, показывая минимальную задержку по итогам нескольких раундов, а готовые списки для импорта охватывают подборки по странам, ИИ-сервисы, соцсети, стриминг, игры, инструменты разработчика и многое другое. По результатам инструмент показывает, доступен ли вам сейчас глобальный интернет.
* 🚀 **Тест скорости**: измеряет скорость загрузки, отдачи и задержку через периферийные сети.
* ⏱️ **Глобальный тест задержки**: пингует вашу цель с зондов по всему миру — выбирайте страны из всех доступных зондов Globalping, сгруппированных по континентам.
* 🚉 **Тест MTR**: запускает MTR с распределённых по миру зондов, чтобы увидеть, каким маршрутом на самом деле идут пакеты.
* 🚧 **Проверка цензуры**: показывает, где в мире сайт заблокирован и какими методами.
* 🚏 **Проверка правил прокси**: проверяет, что правила в вашей прокси-программе работают именно так, как вы задумали.

### 🔦 Поиск и инфраструктура

* 📟 **Разрешение DNS**: разрешает домен сразу через несколько резолверов, сгруппированных по странам, — простой способ заметить перехват или загрязнение DNS.
* 📓 **Поиск Whois**: выполняет Whois-запросы для доменных имён и IP-адресов.
* 🗄️ **Поиск MAC-адреса**: определяет производителя и другие сведения по физическому адресу.
* 🛰️ **Сведения об ASN и топология вышестоящих сетей**: показывают данные автономной системы, историю анонсов IP-префикса и пути от ASN к магистральным сетям Tier 1.
* 📶 **Состояние сервисов**: актуальная доступность известных сервисов — Claude, OpenAI, GitHub, Cloudflare и других — по данным их официальных страниц состояния, включая недавние инциденты.

### ✨ Платформа

* 📤 **Диагностические отчёты**: превращают результаты тестов в отчёт, которым можно поделиться, — ссылка только для чтения с автоматическим истечением срока, Markdown для ИИ или JSON.
* ⌨️ **Curl API**: узнайте свой IP прямо из терминала одной командой `curl`.
* 🌍 **Земля онлайн**: панель, транслирующая глобальные сбои интернета в момент их возникновения.
* 🌗 **Тёмная тема**: автоматически следует настройкам системы, с ручным переключателем.
* 📲 **PWA**: устанавливается как приложение на телефон и как приложение Chrome на компьютер.
* ⚡ **Сочетания клавиш**: есть у каждой функции — нажмите `?`, чтобы увидеть список.
* 🔤 **Несколько языков**: интерфейс доступен на 6 языках, а чтобы добавить свой, достаточно одного языкового пакета.

## 📕 Использование

### Использование Docker

Одна команда — и всё готово:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

Или нажмите кнопку «Deploy with Docker» в верхней части этой страницы.

### Развёртывание в среде Node

Убедитесь, что Node.js установлен, затем клонируйте репозиторий:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Установите зависимости и соберите проект. Проект использует pnpm — если он ещё не установлен, сначала установите его (npm входит в состав Node, поэтому эта команда всегда доступна):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Запустите:

```bash
pnpm start
```

Приложение будет работать на порту 18966.

## ⚙️ Конфигурация

> [!IMPORTANT]
> **Учётные данные MaxMind GeoLite2 обязательны.** Они обеспечивают геолокацию IP и запросы ASN — без них источник MaxMind возвращает 503. Они бесплатны: → [MaxMind Setup](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **`ALLOWED_DOMAINS` обязателен на реальном домене.** Это список разрешённых хостов для backend API — без него любой запрос с домена, отличного от localhost, получает 403. → [Reverse Proxy & Domains](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

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

## 📖 Документация

Полные руководства — в центре документации MyIP: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Руководство разработчика](https://docs.ipcheck.ing/developer) — развёртывание, настройка, архитектура и участие в разработке
* [База знаний](https://docs.ipcheck.ing/knowledge-base) — как пользоваться каждым инструментом, пошаговая диагностика сети и сетевые концепции

## 🤝 Участие в проекте

Мы рады вашему участию! У нас есть подборка задач для новичков — с точными путями к файлам, критериями приёмки и тестами, которые ведут вас к зелёной сборке:

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — добавьте DNS-резолвер своей страны, расширьте подборки сайтов, переведите README на свой язык, улучшите переводы и не только
* 🌐 [TRANSLATING.md](TRANSLATING.md) — переведите интерфейс на свой язык: языковой пакет плюс одна строка в реестре, причём **частичный перевод — отличный первый PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — настройка окружения, соглашения и процесс работы с PR (направляйте их в ветку `dev`)

## 👩🏻‍💻 Расширенное использование

<details>
<summary>Правила прокси для одновременной проверки реального IP и IP через прокси</summary>

Если вы выходите в интернет через прокси, добавьте это правило в конфигурацию прокси (адаптировав его под свой клиент). Такая настройка позволяет проверять и ваш реальный IP, и IP при использовании прокси:

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

## 💖 Спонсоры

Как автор проекта с открытым исходным кодом, я очень благодарен следующим спонсорам за поддержку:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

## 📄 Лицензия

[MIT](LICENSE) © Jason Ng

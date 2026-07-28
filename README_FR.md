# 🧰 MyIP - Une meilleure boîte à outils IP

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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇷🇺 [Русский](README_RU.md) | 🇫🇷 [Français](README_FR.md)

👉 Démo: [https://ipcheck.ing](https://ipcheck.ing)

Notes: Vous pouvez utiliser ma démo gratuitement et vous pouvez également la déployer vous-même.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Principales fonctionnalités

* 🛜 **Afficher vos adresses IP** : Détecte et affiche votre adresse IP locale, provenant de plusieurs fournisseurs IPv4 et IPv6.
* 🔍 **Recherche d'informations sur l'adresse IP** : Fournit un outil pour interroger des informations sur n'importe quelle adresse IP.
* 🕵️ **Informations sur l'adresse IP** : Présente des informations détaillées pour toutes les adresses IP, y compris le pays, la région, l'ASN, la localisation géographique, et plus encore.
* 🛰️ **Historique ASN et topologie amont** : Consultez l'historique des annonces AS pour un préfixe IP, et visualisez les chemins amont d'un ASN vers les réseaux dorsaux Tier 1.
* 🚦 **Vérification de disponibilité** : Teste l'accessibilité de différents sites web, tels que Google, GitHub, YouTube, ChatGPT, et d'autres.
* 📡 **État des services** : Affiche la disponibilité en temps réel de services populaires (Claude, OpenAI, GitHub, Cloudflare, etc.) depuis leurs pages d'état officielles, avec l'état de chaque sous-service et les incidents récents.
* 🚥 **Détection WebRTC** : Identifie l'adresse IP utilisée lors des connexions WebRTC.
* 🛑 **Test de fuite DNS** : Affiche les données de point de terminaison DNS pour évaluer le risque de fuites DNS lors de l'utilisation de VPN ou de proxies.
* 🚀 **Test de vitesse** : Testez la vitesse de votre réseau avec des réseaux de pointe.
* 🚏 **Test de règles** : Teste si les paramètres de règles fonctionnent correctement avec le logiciel de proxy.
* ⏱️ **Test de latence mondiale** : Effectue des tests de latence sur des serveurs situés dans différentes régions du monde.
* 🚉 **Test MTR** : Effectue des tests MTR sur des serveurs situés dans différentes régions du monde.
* 🔦 **Résolveur DNS** : effectue la résolution DNS d'un nom de domaine à partir de plusieurs sources, obtient les résultats de la résolution en temps réel et peut être utilisé pour la détermination de la contamination.
* 🚧 **Test de Censorship**: Vérifier si un site est bloqué dans certains pays.
* 📓 **Recherche Whois** : Effectuer une recherche d'informations Whois pour les noms de domaine ou les adresses IP
* 📀 **Recherche MAC** : Requête d'informations d'une adresse physique
* 🖥️ **Empreinte digitale du navigateur**: Plusieurs façons de visualiser l'empreinte digitale de votre navigateur
* 📋 **Liste de contrôle de cybersécurité**：: Une liste de contrôle complète de la cybersécurité avec un total de 258 éléments

## 💪Également

* 🌗 **Mode sombre** : Bascule automatiquement entre les modes sombre et clair en fonction des paramètres du système, avec une option de basculement manuel.
* 📲 **Prise en charge de PWA** : Peut être ajouté en tant qu'application de bureau sur votre téléphone ainsi qu'en tant qu'application Chrome sur votre ordinateur.
* ⌨️ **Raccourcis clavier** : Prend en charge les raccourcis clavier pour toutes les fonctions, appuyez sur `?` pour afficher la liste des raccourcis.
* 🌍 Basé sur les résultats des tests de disponibilité, il indique si l'accès Internet mondial est actuellement réalisable.
* 🇺🇸 🇨🇳 🇷🇺 🇫🇷 Prise en charge de l'anglais, du chinois, du russe et du français.

## 📕 Comment utiliser

### Déploiement dans un environnement Node

Assurez-vous d'avoir Node.js installé.

Clonez le code :

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Installer & Construire. Ce projet utilise pnpm — si vous ne l'avez pas, installez-le d'abord (npm est fourni avec Node, donc cette commande fonctionne toujours) :

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Exécuter:

```bash
pnpm start
```

Le programme s'exécutera sur le port 18966.

### Using Docker

Cliquez sur le bouton 'Déployer sur Docker' en haut pour terminer le déploiement. Ou utilisez le shell suivant :

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📖 Documentation

Les guides complets se trouvent dans le centre de documentation MyIP : **[docs.ipcheck.ing](https://docs.ipcheck.ing)** (sélecteur de langue en haut à droite)

* [Guide du développeur](https://docs.ipcheck.ing/developer) — déploiement, configuration, architecture et contribution
* [Base de connaissances](https://docs.ipcheck.ing/knowledge-base) — utilisation de chaque outil, diagnostic réseau pas à pas, concepts réseau

## ⚙️ Configuration

Deux réglages comptent avant tout :

* **MaxMind GeoLite2 (requis)** — identifiants gratuits pour la géolocalisation IP et les recherches ASN. Sans eux, la source MaxMind renvoie 503. → [Configuration MaxMind](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)
* **`ALLOWED_DOMAINS` (requis sur un vrai domaine)** — liste blanche de noms d'hôte pour l'API backend. Sans elle, toute requête venant d'un domaine autre que localhost reçoit un 403. → [Reverse proxy et domaines](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

Tout le reste — clés API optionnelles, sécurité et limitation de débit, journalisation, Sentry, domaines de l'API curl — est documenté dans la [référence des variables d'environnement](https://docs.ipcheck.ing/developer/reference/environment-variables).


## 👩🏻‍💻 Utilisation avancée

Si vous utilisez un proxy pour accéder à Internet, envisagez d'ajouter cette règle à votre configuration de proxy (modifiez-la en fonction de votre client). Cette configuration vous permet de vérifier à la fois votre véritable adresse IP et l'adresse IP lorsque vous utilisez le proxy :

```ini
# Test d'adresse IP
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

## 💖 Sponsors

En tant que projet open source, je suis très reconnaissant aux sponsors suivants pour leur soutien :

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

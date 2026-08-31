# 🧰 MyIP - Une meilleure boîte à outils IP

> [!NOTE]
> Ceci est une traduction maintenue par la communauté ; le README anglais fait foi et cette version peut être en retard sur celui-ci.

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

Une boîte à outils IP tout-en-un et open source : recherche d'IP depuis plusieurs sources, tests de connectivité, détection WebRTC et de fuites DNS, test de vitesse, MTR, vérification de la censure, Whois et plus encore — auto-hébergeable en une seule commande Docker.

👉 Démo : [https://ipcheck.ing](https://ipcheck.ing)

N'hésitez pas à mettre la démo en favori ou à déployer votre propre instance.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Fonctionnalités

### 🪪 Votre IP et votre identité

* 🛜 **Cartes IP** : Détecte vos adresses IPv4 et IPv6 depuis plusieurs sources indépendantes, présentées côte à côte — pays, région, ville, ASN, organisation et fuseau horaire local de l'IP.
* 🔍 **Recherche d'IP** : Affiche les mêmes informations détaillées pour n'importe quelle adresse IP qui vous intrigue.
* 🧾 **Historique des IP** : Conserve un enregistrement local des IP sous lesquelles vous avez été vu, filtrable par type et par pays — stocké uniquement dans votre navigateur.
* 🖥️ **Empreinte du navigateur** : Calcule l'empreinte de votre navigateur de plusieurs manières et montre ce qui vous rend identifiable.

### 🕵️ Fuites et vie privée

* 🚥 **Détection WebRTC** : Révèle l'adresse IP exposée lors des connexions WebRTC — y compris si les protections de confidentialité de votre navigateur sont actives.
* 🛑 **Test de fuite DNS** : Montre quels points de terminaison DNS résolvent vos requêtes, afin d'évaluer le risque de fuite DNS lors de l'utilisation d'un VPN ou d'un proxy.
* 📋 **Liste de contrôle de cybersécurité** : Une liste personnelle de 258 points de cybersécurité répartis en 12 domaines, avec progression sauvegardée dans votre navigateur.

### 📡 Tests réseau

* 🚦 **Test de connectivité** : Teste l'accessibilité de jusqu'à 60 sites de votre choix, avec la latence minimale mesurée sur plusieurs tours — plus des listes d'import sélectionnées, des packs par pays jusqu'à l'IA, les réseaux sociaux, le streaming, le jeu, le développement et plus encore. D'après les résultats, il indique si l'accès à l'Internet mondial est actuellement possible pour vous.
* 🚀 **Test de vitesse** : Mesure vos débits descendant et montant ainsi que votre latence face à des réseaux edge.
* ⏱️ **Test de latence mondiale** : Mesure le ping vers votre cible depuis des sondes du monde entier — choisissez les pays parmi toutes les sondes Globalping disponibles, regroupées par continent.
* 🚉 **Test MTR** : Lance MTR depuis des sondes réparties dans le monde pour voir la route réellement empruntée par les paquets.
* 🚧 **Test de censure** : Montre où un site web est bloqué dans le monde — et par quels moyens.
* 🚏 **Test de règles de proxy** : Vérifie que la configuration des règles de votre logiciel de proxy fonctionne comme prévu.

### 🔦 Recherches et infrastructure

* 📟 **Résolveur DNS** : Résout un domaine via plusieurs résolveurs à la fois, regroupés par pays — un moyen simple de repérer un détournement ou une contamination.
* 📓 **Recherche Whois** : Effectue des recherches Whois pour les noms de domaine et les adresses IP.
* 🗄️ **Recherche MAC** : Identifie le fabricant et les détails derrière une adresse physique.
* 🛰️ **Infos ASN et topologie amont** : Affiche les détails d'un AS, l'historique des annonces d'un préfixe IP et les chemins amont d'un ASN vers la dorsale Tier 1.
* 📶 **État des services** : Disponibilité en direct de services connus — Claude, OpenAI, GitHub, Cloudflare et d'autres — depuis leurs pages d'état officielles, avec les incidents récents.

### ✨ Plateforme

* 📤 **Rapports partageables** : Transformez vos résultats de test en rapport de diagnostic — un lien en lecture seule à expiration automatique, du Markdown prêt pour l'IA ou du JSON.
* ⌨️ **API curl** : Obtenez votre IP depuis le terminal avec une simple commande `curl`.
* 🌍 **La Terre en ligne** : Un panneau qui diffuse les pannes d'Internet mondiales au moment où elles se produisent.
* 🌗 **Mode sombre** : Suit automatiquement votre système, avec un basculement manuel.
* 📲 **PWA** : Installable comme application sur votre téléphone et comme application Chrome sur votre ordinateur.
* ⚡ **Raccourcis clavier** : Chaque fonction a le sien — appuyez sur `?` pour afficher la liste.
* 🔤 **Multilingue** : L'interface est disponible en 6 langues, et ajouter la vôtre ne demande qu'un paquet de langue.

## 📕 Comment utiliser

### Avec Docker

Une seule commande et c'est parti :

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

Ou cliquez sur le bouton « Deploy with Docker » en haut de cette page.

### Déploiement dans un environnement Node

Assurez-vous d'avoir Node.js installé, puis clonez le code :

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Installez et compilez. Ce projet utilise pnpm — si vous ne l'avez pas, installez-le d'abord (npm est fourni avec Node, donc cette commande fonctionne toujours) :

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Lancez :

```bash
pnpm start
```

Le programme s'exécutera sur le port 18966.

## ⚙️ Configuration

> [!IMPORTANT]
> **Les identifiants MaxMind GeoLite2 sont requis.** Ils alimentent la géolocalisation IP et les recherches ASN — sans eux, la source MaxMind renvoie une erreur 503. Ils sont gratuits : → [Configuration MaxMind](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **`ALLOWED_DOMAINS` est requis sur un vrai domaine.** C'est la liste blanche de noms d'hôte pour l'API backend — sans elle, toute requête venant d'un domaine autre que localhost reçoit un 403. → [Reverse proxy et domaines](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

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

## 📖 Documentation

Les guides complets se trouvent dans le centre de documentation MyIP : **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Guide du développeur](https://docs.ipcheck.ing/developer) — déploiement, configuration, architecture et contribution
* [Base de connaissances](https://docs.ipcheck.ing/knowledge-base) — comment utiliser chaque outil, diagnostic réseau pas à pas et concepts réseau

## 🤝 Contribuer

Les contributions sont les bienvenues ! Nous maintenons une sélection de tâches adaptées aux débutants — chacune avec les chemins de fichiers exacts, des critères d'acceptation et des tests qui vous guident jusqu'à un build vert :

* 🏷️ [Good first issues](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — ajouter un résolveur DNS de votre pays, enrichir les listes de sites sélectionnées, traduire le README dans votre langue, peaufiner les traductions, et plus encore
* 🌐 [TRANSLATING.md](TRANSLATING.md) — mettez l'interface dans votre langue : un paquet de langue plus une ligne dans le registre, et **une traduction partielle est une première PR bienvenue**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — installation, conventions et cheminement des PR (ciblez la branche `dev`)

## 👩🏻‍💻 Utilisation avancée

<details>
<summary>Règles de proxy pour vérifier en même temps votre IP réelle et votre IP de proxy</summary>

Si vous utilisez un proxy pour accéder à Internet, envisagez d'ajouter cette règle à votre configuration de proxy (adaptez-la à votre client). Cette configuration vous permet de vérifier à la fois votre véritable adresse IP et celle utilisée via le proxy :

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

## 💖 Sponsors

En tant que projet open source, je suis très reconnaissant aux sponsors suivants pour leur soutien :

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

## 📄 Licence

[MIT](LICENSE) © Jason Ng

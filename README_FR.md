# 🧰 MyIP - Une meilleure boîte à outils IP

![IPCheck.ing Banner](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/gh_banner.png)

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub forks](https://img.shields.io/github/forks/jason5ng32/myip)
![Docker Pulls](https://img.shields.io/docker/pulls/jason5ng32/myip)
![GitHub license](https://img.shields.io/github/license/jason5ng32/MyIP)

![CodeQL](https://github.com/jason5ng32/MyIP/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)
![Docker Build and Push](https://github.com/jason5ng32/MyIP/actions/workflows/docker-image.yml/badge.svg?branch=main)

![PWA](https://img.shields.io/badge/PWA-Supported-blue)
![Windows-image](https://img.shields.io/badge/-Windows-blue?logo=windows)
![MacOS-image](https://img.shields.io/badge/-MacOS-black?logo=apple)
![Linux-image](https://img.shields.io/badge/-Linux-333?logo=ubuntu)

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fipcheck.ing&up_message=online&label=IPCheck.ing 'IPCheck.ing')](https://ipcheck.ing)

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇫🇷 [Français](README_FR.md)

👉 Démo: [https://ipcheck.ing](https://ipcheck.ing)

Notes: Vous pouvez utiliser ma démo gratuitement et vous pouvez également la déployer vous-même.

[![Deploy with Vercel](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/Vercel.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&project-name=MyIP&repository-name=MyIP)
[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

## 👀 Principales fonctionnalités

* 🖥️ **Afficher vos adresses IP** : Détecte et affiche votre adresse IP locale, provenant de plusieurs fournisseurs IPv4 et IPv6.
* 🕵️ **Informations sur l'adresse IP** : Présente des informations détaillées pour toutes les adresses IP, y compris le pays, la région, l'ASN, la localisation géographique, et plus encore.
* 🚦 **Vérification de disponibilité** : Teste l'accessibilité de différents sites web, tels que Google, GitHub, YouTube, ChatGPT, et d'autres.
* 🚥 **Détection WebRTC** : Identifie l'adresse IP utilisée lors des connexions WebRTC.
* 🛑 **Test de fuite DNS** : Affiche les données de point de terminaison DNS pour évaluer le risque de fuites DNS lors de l'utilisation de VPN ou de proxies.
* 🚀 **Test de vitesse** : Testez la vitesse de votre réseau avec des réseaux de pointe.
* 🚏 **Test de règles** : Teste si les paramètres de règles fonctionnent correctement avec le logiciel de proxy.
* 🌐 **Test de latence mondiale** : Effectue des tests de latence sur des serveurs situés dans différentes régions du monde.
* 📡 **Test MTR** : Effectue des tests MTR sur des serveurs situés dans différentes régions du monde.
* 🔦 **Résolveur DNS** : effectue la résolution DNS d'un nom de domaine à partir de plusieurs sources, obtient les résultats de la résolution en temps réel et peut être utilisé pour la détermination de la contamination.
* 🌗 **Mode sombre** : Bascule automatiquement entre les modes sombre et clair en fonction des paramètres du système, avec une option de basculement manuel.
* 📱 **Mode minimaliste** : Un mode optimisé pour les mobiles qui réduit la longueur de la page pour un accès rapide aux informations essentielles.
* 🔍 **Recherche d'informations sur l'adresse IP** : Fournit un outil pour interroger des informations sur n'importe quelle adresse IP.
* 📲 **Prise en charge de PWA** : Peut être ajouté en tant qu'application de bureau sur votre téléphone ainsi qu'en tant qu'application Chrome sur votre ordinateur.
* ⌨️ **Raccourcis clavier** : Prend en charge les raccourcis clavier pour toutes les fonctions, appuyez sur `?` pour afficher la liste des raccourcis.
* 🌍 Basé sur les résultats des tests de disponibilité, il indique si l'accès Internet mondial est actuellement réalisable.
* 🇺🇸 🇨🇳 🇫🇷 Prise en charge de l'anglais, du chinois et du français.

## 📕 Comment utiliser

Il existe 3 façons de déployer :

### Déploiement dans un environnement Node

Assurez-vous d'avoir Node.js installé.

Clonez le code :

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Installer:

```bash
npm install
```

Construire:

```bash
npm run build
```

Exécuter:

```bash
npm start
```

Le programme s'exécutera sur le port 18966.

### Using Vercel

Cliquez sur le bouton 'Déployer sur Vercel' en haut pour terminer le déploiement.

### Using Docker

Cliquez sur le bouton 'Déployer sur Docker' en haut pour terminer le déploiement. Ou utilisez le shell suivant :

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📚 Variables d'environnement

Vous pouvez utiliser le programme sans ajouter de variables d'environnement, mais si vous souhaitez utiliser certaines fonctionnalités avancées, vous pouvez ajouter les variables d'environnement suivantes :

| Nom de la variable | Requis | Valeur par défaut | Description |
| --- | --- | --- | --- |
| `PORT` | Non | `18966` | Le port sur lequel le programme s'exécute |
| `BING_MAP_API_KEY` | Non | `""` | Clé API pour Bing Maps, utilisée pour afficher l'emplacement de l'adresse IP sur une carte |
| `ALLOWED_DOMAINS` | Non | `""` | Domaines autorisés pour l'accès, séparés par des virgules, utilisés pour empêcher une utilisation abusive de l'API backend |
| `IPCHECKING_API_KEY` | Non | `""` | Clé API pour IPCheck.ing, utilisée pour obtenir des informations de géolocalisation précises sur l'adresse IP |
| `IPINFO_API_TOKEN` | Non | `""` | Jeton API pour IPInfo.io, utilisé pour obtenir des informations de géolocalisation sur l'adresse IP via IPInfo.io |
| `KEYCDN_USER_AGENT` | Non | `""` | Le nom de domaine lorsque vous utilisez KeyCDN, doit contenir le préfixe https. Utilisé pour obtenir des informations sur l'adresse IP via KeyCDN |
| `CLOUDFLARE_API` | Non | `""` | Clé API pour Cloudflare, utilisée pour obtenir des informations sur le système AS via Cloudflare |
| `VITE_RECAPTCHA_SITE_KEY` | Non | `""` | Clé de site reCAPTCHA de Google, utilisée pour afficher la vérification reCAPTCHA sur le frontend |
| `RECAPTCHA_SECRET_KEY` | Non | `""` | Clé secrète reCAPTCHA de Google, utilisée pour vérifier la vérification reCAPTCHA sur le backend |

### Utilisation des variables d'environnement dans un environnement Node

Créez les variables d'environnement :

```bash
cp .env.example .env
```

Modifiez le fichier `.env`, et par exemple, ajoutez ce qui suit :

```bash
PORT=18966
BING_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
IPCHECKING_API="YOUR_KEY_HERE"
```

Ensuite, redémarrez le service backend.

### Utilisation des variables d'environnement dans Vercel

Veuillez vous référer au contenu de `.env.example` et ajoutez-le aux variables d'environnement dans Vercel.

### Utilisation des variables d'environnement dans Docker

Vous pouvez ajouter des variables d'environnement lors de l'exécution de Docker, par exemple :

```bash
docker run -d -p 18966:18966 \
  -e BING_MAP_API_KEY="YOUR_KEY_HERE" \
  -e ALLOWED_DOMAINS="example.com" \
  -e IPCHECKING_API="YOUR_TOKEN_HERE" \
  --name myip \
  jason5ng32/myip:latest

```

## 👩🏻‍💻 Utilisation avancée

Si vous utilisez un proxy pour accéder à Internet, envisagez d'ajouter cette règle à votre configuration de proxy (modifiez-la en fonction de votre client). Cette configuration vous permet de vérifier à la fois votre véritable adresse IP et l'adresse IP lorsque vous utilisez le proxy :

```ini
# Test d'adresse IP
IP-CIDR,1.0.0.1/32,DIRECT,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,DIRECT,no-resolve
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

## 🌟 Historique des étoiles

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)
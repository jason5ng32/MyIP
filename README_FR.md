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

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README_ZH.md) | 🇫🇷 [Français](README_FR.md)

👉 Démo: [https://ipcheck.ing](https://ipcheck.ing)

Notes: Vous pouvez utiliser ma démo gratuitement et vous pouvez également la déployer vous-même.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Principales fonctionnalités

* 🖥️ **Afficher vos adresses IP** : Détecte et affiche votre adresse IP locale, provenant de plusieurs fournisseurs IPv4 et IPv6.
* 🕵️ **Informations sur l'adresse IP** : Présente des informations détaillées pour toutes les adresses IP, y compris le pays, la région, l'ASN, la localisation géographique, et plus encore.
* 🚦 **Vérification de disponibilité** : Teste l'accessibilité de différents sites web, tels que Google, GitHub, YouTube, ChatGPT, et d'autres.
* 🚥 **Détection WebRTC** : Identifie l'adresse IP utilisée lors des connexions WebRTC.
* 🛑 **Test de fuite DNS** : Affiche les données de point de terminaison DNS pour évaluer le risque de fuites DNS lors de l'utilisation de VPN ou de proxies.
* 🚀 **Test de vitesse** : Testez la vitesse de votre réseau avec des réseaux de pointe.
* 🚏 **Test de règles** : Teste si les paramètres de règles fonctionnent correctement avec le logiciel de proxy.
* ⏱️ **Test de latence mondiale** : Effectue des tests de latence sur des serveurs situés dans différentes régions du monde.
* 📡 **Test MTR** : Effectue des tests MTR sur des serveurs situés dans différentes régions du monde.
* 🔦 **Résolveur DNS** : effectue la résolution DNS d'un nom de domaine à partir de plusieurs sources, obtient les résultats de la résolution en temps réel et peut être utilisé pour la détermination de la contamination.
* 🚧 **Test de Censorship**: Vérifier si un site est bloqué dans certains pays.
* 📓 **Recherche Whois** : Effectuer une recherche d'informations Whois pour les noms de domaine ou les adresses IP
* 📀 **Recherche MAC** : Requête d'informations d'une adresse physique
* 🌗 **Mode sombre** : Bascule automatiquement entre les modes sombre et clair en fonction des paramètres du système, avec une option de basculement manuel.
* 📱 **Mode minimaliste** : Un mode optimisé pour les mobiles qui réduit la longueur de la page pour un accès rapide aux informations essentielles.
* 🔍 **Recherche d'informations sur l'adresse IP** : Fournit un outil pour interroger des informations sur n'importe quelle adresse IP.
* 📲 **Prise en charge de PWA** : Peut être ajouté en tant qu'application de bureau sur votre téléphone ainsi qu'en tant qu'application Chrome sur votre ordinateur.
* ⌨️ **Raccourcis clavier** : Prend en charge les raccourcis clavier pour toutes les fonctions, appuyez sur `?` pour afficher la liste des raccourcis.
* 🌍 Basé sur les résultats des tests de disponibilité, il indique si l'accès Internet mondial est actuellement réalisable.
* 🇺🇸 🇨🇳 🇫🇷 Prise en charge de l'anglais, du chinois et du français.

## 📕 Comment utiliser

### Déploiement dans un environnement Node

Assurez-vous d'avoir Node.js installé.

Clonez le code :

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Installer & Construire :

```bash
npm install && npm run build
```

Exécuter:

```bash
npm start
```

Le programme s'exécutera sur le port 18966.

### Using Docker

Cliquez sur le bouton 'Déployer sur Docker' en haut pour terminer le déploiement. Ou utilisez le shell suivant :

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📚 Variables d'environnement

Vous pouvez utiliser le programme sans ajouter de variables d'environnement, mais si vous souhaitez utiliser certaines fonctionnalités avancées, vous pouvez ajouter les variables d'environnement suivantes :

| Nom de la variable | Requis | Valeur par défaut | Description |
| --- | --- | --- | --- |
| `BACKEND_PORT` | Non | `"11966"` | Le port d'exécution de la partie backend du programme |
| `FRONTEND_PORT` | Non | `"18966"` | Le port d'exécution de la partie frontend du programme |
| `SECURITY_RATE_LIMIT` | Non | `"0"` | Contrôle le nombre de requêtes qu'une adresse IP peut faire au serveur backend toutes les 60 minutes (réglé sur 0 pour aucune limite) |
| `SECURITY_DELAY_AFTER` | Non | `"0"` | Contrôle les premières X requêtes d'une adresse IP toutes les 20 minutes qui ne sont pas soumises à des limites de vitesse, et après X requêtes, le délai augmentera |
| `SECURITY_BLACKLIST_LOG_FILE_PATH` | Non | `"logs/blacklist-ip.log"` | Paramètre de chemin. Enregistre la liste des adresses IP qui ont déclenché la limite après que `SECURITY_RATE_LIMIT` soit activé |
| `BING_MAP_API_KEY` | Non | `""` | Clé API pour Bing Maps, utilisée pour afficher l'emplacement de l'adresse IP sur une carte |
| `ALLOWED_DOMAINS` | Non | `""` | Domaines autorisés pour l'accès, séparés par des virgules, utilisés pour empêcher une utilisation abusive de l'API backend |
| `IPCHECKING_API_KEY` | Non | `""` | Clé API pour IPCheck.ing, utilisée pour obtenir des informations de géolocalisation précises sur l'adresse IP |
| `IPINFO_API_TOKEN` | Non | `""` | Jeton API pour IPInfo.io, utilisé pour obtenir des informations de géolocalisation sur l'adresse IP via IPInfo.io |
| `IPAPIIS_API_KEY` | Non | `""` | Clé API pour IPAPI.is, utilisée pour obtenir des informations de géolocalisation sur l'adresse IP via IPAPI.is |
| `KEYCDN_USER_AGENT` | Non | `""` | Le nom de domaine lorsque vous utilisez KeyCDN, doit contenir le préfixe https. Utilisé pour obtenir des informations sur l'adresse IP via KeyCDN |
| `CLOUDFLARE_API` | Non | `""` | Clé API pour Cloudflare, utilisée pour obtenir des informations sur le système AS via Cloudflare |
| `MAC_LOOKUP_API_KEY` | Non | `""` | Clé API pour MAC Lookup, utilisée pour obtenir des informations sur l'adresse MAC via MAC Lookup |
| `VITE_GOOGLE_ANALYTICS_ID` | **Oui** | `""` | Identifiant Google Analytics, utilisé pour l'analyse des utilisateurs |

### Utilisation des variables d'environnement dans un environnement Node

Créez les variables d'environnement :

```bash
cp .env.example .env
```

Modifiez le fichier `.env`, et par exemple, ajoutez ce qui suit :

```bash
BACKEND_PORT=11966
FRONTEND_PORT=18966
BING_MAP_API_KEY="YOUR_KEY_HERE"
ALLOWED_DOMAINS="example.com"
IPCHECKING_API="YOUR_KEY_HERE"
```

Ensuite, redémarrez le service backend.

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

## 😶‍🌫️ Explications supplémentaires

Lors de la sortie de la version 2.0, j'avais dit que 70% du code de ce programme n'était pas de moi, mais écrit par ChatGPT. Après environ 90 interactions, plus quelques ajustements manuels mineurs, tout le code a été complété.

Bien sûr, l'architecture et l'UI nécessitaient toujours ma propre conception.

Avec la sortie de la version 3.0 et des versions ultérieures, la proportion de code écrit avec l'aide de ChatGPT a progressivement diminué, maintenant estimée entre 40% et 50%. Au contraire, dans ce processus, je suis passé de ne rien savoir sur JavaScript et Vue à pouvoir comprendre la plupart des codes JS, et maintenant je peux même en écrire moi-même.

Merci à l'IA, qui m'a donné, à moi, un chef de produit au chômage, une opportunité rapide d'apprendre la programmation.

## 🌟 Historique des étoiles

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)
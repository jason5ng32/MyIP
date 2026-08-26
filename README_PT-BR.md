# 🧰 MyIP - Uma caixa de ferramentas de IP aprimorada

> [!NOTE]
> Esta é uma tradução mantida pela comunidade; o README em inglês é a fonte canônica e esta versão pode ficar desatualizada.

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

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH-TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md)

Uma caixa de ferramentas de IP completa e de código aberto: consulta de IP a partir de múltiplas fontes, testes de conectividade, detecção de WebRTC e de vazamento de DNS, teste de velocidade, MTR, verificação de censura, Whois e muito mais — auto-hospedável com um único comando Docker.

👉 Demonstração: [https://ipcheck.ing](https://ipcheck.ing)

Adicione a demonstração aos favoritos ou faça sua própria implantação.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Recursos

### 🪪 Seu IP e identidade

* 🛜 **Cartões de IP**: Detecta seus IPv4 e IPv6 a partir de várias fontes independentes, lado a lado — país, região, cidade, ASN, organização e o fuso horário local do IP.
* 🔍 **Verificação de IP**: Consulta as mesmas informações detalhadas de qualquer endereço IP que despertar sua curiosidade.
* 🧾 **Histórico de IP**: Mantém um registro local dos IPs com os quais você já foi visto, filtrável por tipo e país — armazenado apenas no seu navegador.
* 🖥️ **Impressão digital do navegador**: Calcula a impressão digital do seu navegador de várias formas e mostra o que torna você identificável.

### 🕵️ Vazamentos e privacidade

* 🚥 **Detecção de WebRTC**: Revela o endereço IP exposto durante conexões WebRTC — inclusive se as proteções de privacidade do seu navegador estão ativas.
* 🛑 **Teste de vazamento de DNS**: Mostra quais endpoints DNS resolvem suas consultas, para avaliar o risco de vazamentos de DNS ao usar VPNs ou proxies.
* 📋 **Checklist de segurança**: Um checklist pessoal de cibersegurança com 258 itens em 12 áreas, com progresso salvo no seu navegador.

### 📡 Testes de rede

* 🚦 **Conectividade de rede**: Testa a acessibilidade de até 60 sites da sua escolha, com resultados de latência mínima em múltiplas rodadas — além de listas de importação selecionadas, de pacotes por país a IA, redes sociais, streaming, jogos, desenvolvimento e mais. Com base nos resultados, indica se o acesso global à Internet está viável para você no momento.
* 🚀 **Teste de velocidade**: Mede seu download, upload e latência em redes de borda.
* ⏱️ **Teste de latência global**: Faz ping no seu alvo a partir de sondas espalhadas pelo mundo — escolha países entre todas as sondas Globalping disponíveis, agrupadas por continente.
* 🚉 **Teste MTR**: Executa MTR a partir de sondas distribuídas globalmente para ver a rota que os pacotes realmente percorrem.
* 🚧 **Verificação de censura**: Mostra onde um site está bloqueado no mundo — e por quais meios.
* 🚏 **Teste de regras de proxy**: Verifica se a configuração de regras do seu software de proxy funciona do jeito que você pretendia.

### 🔦 Consultas e infraestrutura

* 📟 **Resolução DNS**: Resolve um domínio por vários resolvedores de uma só vez, agrupados por país — um jeito fácil de detectar sequestro ou contaminação.
* 📓 **Pesquisa Whois**: Realiza consultas Whois para nomes de domínio e endereços IP.
* 🗄️ **Consulta de MAC**: Identifica o fabricante e os detalhes por trás de um endereço físico.
* 🛰️ **Informações de ASN e topologia de upstream**: Mostra detalhes do AS, anúncios históricos de um prefixo IP e os caminhos de upstream de um ASN até o backbone Tier 1.
* 📶 **Status dos serviços**: Disponibilidade em tempo real de serviços conhecidos — Claude, OpenAI, GitHub, Cloudflare e outros — a partir de suas páginas oficiais de status, com incidentes recentes.

### ✨ Plataforma

* 📤 **Relatórios compartilháveis**: Transforme seus resultados de teste em um relatório diagnóstico — um link somente leitura com expiração automática, Markdown pronto para IA ou JSON.
* ⌨️ **API de linha de comando**: Obtenha seu IP no terminal com um único comando `curl`.
* 🌍 **Earth Online**: Um painel que transmite eventos globais de indisponibilidade da Internet em tempo real.
* 🌗 **Modo escuro**: Acompanha automaticamente o sistema, com alternância manual.
* 📲 **PWA**: Instalável como aplicativo no celular e como app do Chrome no computador.
* ⚡ **Atalhos de teclado**: Toda função tem o seu — pressione `?` para ver a lista.
* 🔤 **Vários idiomas**: A interface é distribuída em 6 idiomas, e adicionar o seu exige apenas um pacote de locale.

## 📕 Como usar

### Usando Docker

Um comando e pronto:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

Ou clique no botão "Deploy with Docker" no topo desta página.

### Implantação em um ambiente Node

Certifique-se de que o Node.js esteja instalado e, em seguida, clone o código:

```bash
git clone https://github.com/jason5ng32/MyIP.git
```

Instale e compile. Este projeto usa pnpm — se você ainda não o tiver, instale-o primeiro (o npm acompanha o Node; portanto, este comando sempre funciona):

```bash
npm install -g pnpm
pnpm install && pnpm run build
```

Execute:

```bash
pnpm start
```

O programa será executado na porta 18966.

## ⚙️ Configuração

> [!IMPORTANT]
> **As credenciais do MaxMind GeoLite2 são obrigatórias.** Elas viabilizam a geolocalização de IP e as consultas ASN — sem elas, a fonte MaxMind retorna 503. Elas são gratuitas: → [Configuração do MaxMind](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)

> [!WARNING]
> **`ALLOWED_DOMAINS` é obrigatório em um domínio real.** É a lista de nomes de host permitidos para a API de backend — sem ela, toda solicitação proveniente de um domínio que não seja localhost recebe 403. → [Proxy reverso e domínios](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

```bash
docker run -d -p 18966:18966 \
  -e MAXMIND_ACCOUNT_ID="YOUR_ACCOUNT_ID" \
  -e MAXMIND_LICENSE_KEY="YOUR_LICENSE_KEY" \
  -e MAXMIND_AUTO_UPDATE="true" \
  -e ALLOWED_DOMAINS="your-domain.com" \
  --name myip --restart always \
  jason5ng32/myip:latest
```

Todo o restante — chaves de API opcionais, segurança e limitação de taxa, registros, Sentry e os domínios da API curl — está documentado na [referência de variáveis de ambiente](https://docs.ipcheck.ing/developer/reference/environment-variables).

## 📖 Documentação

Os guias completos estão no Centro de Documentação do MyIP: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Guia do desenvolvedor](https://docs.ipcheck.ing/developer) — implantação, configuração, arquitetura e contribuição
* [Base de conhecimento](https://docs.ipcheck.ing/knowledge-base) — como usar cada ferramenta, diagnóstico de rede passo a passo e conceitos de redes

## 🤝 Contribuições

As contribuições são bem-vindas! Mantemos uma seleção de tarefas adequadas para iniciantes — cada uma com caminhos de arquivo exatos, critérios de aceitação e testes que conduzem a uma compilação bem-sucedida:

* 🏷️ [Issues para iniciantes](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — adicione um resolvedor DNS do seu país, inclua listas de sites selecionadas, traduza o README para seu idioma, aprimore traduções e muito mais
* 🌐 [TRANSLATING.md](TRANSLATING.md) — leve a UI ao seu idioma: um pacote de locale e uma linha no registro; uma **tradução parcial é bem-vinda em uma primeira PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — instalação, convenções e o fluxo das PRs (direcione-as para a branch `dev`)

## 👩🏻‍💻 Uso avançado

<details>
<summary>Regras de proxy para verificar seu IP real e seu IP de proxy ao mesmo tempo</summary>

Se você usa um proxy para acessar a Internet, considere adicionar esta regra à configuração do proxy (adapte-a ao seu cliente). Essa configuração permite verificar tanto seu IP real quanto o IP usado com o proxy:

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

## 💖 Patrocinadores

Como projeto de código aberto, sou muito grato aos seguintes patrocinadores pelo apoio:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

## 📄 Licença

[MIT](LICENSE) © Jason Ng

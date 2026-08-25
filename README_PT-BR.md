# 🧰 MyIP - Uma caixa de ferramentas de IP aprimorada

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

[English](README.md) | [简体中文](README_ZH.md) | [繁體中文](README_ZH_TW.md) | [Русский](README_RU.md) | [Français](README_FR.md) | [Português (BR)](README_PT-BR.md)

👉 Demonstração: [https://ipcheck.ing](https://ipcheck.ing)

Adicione a demonstração aos favoritos ou faça sua própria implantação.

[![Deploy with Docker](https://raw.githubusercontent.com/jason5ng32/MyIP/main/public/github/Docker.svg)](https://hub.docker.com/r/jason5ng32/myip)

</div>

## 👀 Principais recursos

* 🛜 **Veja seus IPs**: Detecta e exibe seus IPs locais a partir de vários provedores IPv4 e IPv6.
* 🔍 **Consulte informações sobre IPs**: Fornece uma ferramenta para consultar informações sobre qualquer endereço IP.
* 🕵️ **Informações de IP**: Apresenta informações detalhadas de todos os endereços IP, incluindo país, região, ASN, localização geográfica e muito mais.
* 🛰️ **Histórico de ASN e topologia de upstream**: Visualize anúncios históricos de AS para um prefixo IP e os caminhos de upstream de um ASN até as redes de backbone Tier 1.
* 🚦 **Teste de disponibilidade**: Testa a acessibilidade de vários sites, como Google, GitHub, YouTube, ChatGPT e outros.
* 📡 **Status dos serviços**: Exibe a disponibilidade atual de serviços conhecidos, como Claude, OpenAI, GitHub e Cloudflare, a partir de suas páginas oficiais de status, com o status de cada serviço e incidentes recentes.
* 🚥 **Detecção de WebRTC**: Identifica o endereço IP usado durante conexões WebRTC.
* 🛑 **Teste de vazamento de DNS**: Exibe dados de endpoints DNS para avaliar o risco de vazamentos de DNS ao usar VPNs ou proxies.
* 🚀 **Teste de velocidade**: Testa a velocidade da sua rede com redes de borda.
* 🚏 **Teste de regras de proxy**: Testa as configurações de regras de software de proxy para assegurar que funcionem corretamente.
* ⏱️ **Teste global de latência**: Realiza testes de latência em servidores localizados em diferentes regiões do mundo.
* 🚉 **Teste MTR**: Realiza testes MTR em servidores localizados em diferentes regiões do mundo.
* 🔦 **Resolvedor DNS**: Resolve nomes de domínio a partir de diversas fontes e obtém resultados de resolução em tempo real que podem ser usados para determinar se há contaminação.
* 🚧 **Verificação de censura**: Verifica se um site está bloqueado em determinados países.
* 📓 **Consulta Whois**: Realiza consultas Whois para nomes de domínio ou endereços IP.
* 📀 **Consulta MAC**: Consulta informações sobre um endereço físico.
* 🖥️ **Impressões digitais do navegador**: Oferece várias formas de calcular a impressão digital do seu navegador.
* 📋 **Checklist de cibersegurança**: Um checklist abrangente de cibersegurança com um total de 258 itens.

## 💪 Também

* 🌗 **Modo escuro**: Alterna automaticamente entre os modos escuro e claro com base nas configurações do sistema, além de permitir a alteração manual.
* 📲 **Suporte a PWA**: Pode ser instalado como aplicativo no celular e como app do Chrome no computador.
* ⌨️ **Atalhos de teclado**: Oferece atalhos de teclado para todas as funções; pressione `?` para ver a lista de atalhos.
* 🌍 Com base nos resultados dos testes de disponibilidade, indica se o acesso global à Internet está viável no momento.
* 🔤 Compatível com diversos idiomas.

## 📕 Como usar

### Implantação em um ambiente Node

Certifique-se de que o Node.js esteja instalado.

Clone o código:

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

### Uso com Docker

Clique no botão “Deploy to Docker” no topo deste documento para concluir a implantação. Ou use o comando a seguir:

```bash
docker run -d -p 18966:18966 --name myip --restart always jason5ng32/myip:latest
```

## 📖 Documentação

Os guias completos estão no Centro de Documentação do MyIP: **[docs.ipcheck.ing](https://docs.ipcheck.ing)**

* [Guia do desenvolvedor](https://docs.ipcheck.ing/developer) — implantação, configuração, arquitetura e contribuição
* [Base de conhecimento](https://docs.ipcheck.ing/knowledge-base) — como usar cada ferramenta, diagnóstico de rede passo a passo e conceitos de redes

## 🤝 Contribuições

As contribuições são bem-vindas! Mantemos uma seleção de tarefas adequadas para iniciantes — cada uma com caminhos de arquivo exatos, critérios de aceitação e testes que conduzem a uma compilação bem-sucedida:

* 🏷️ [Issues para iniciantes](https://github.com/jason5ng32/MyIP/labels/good%20first%20issue) — adicione um resolvedor DNS do seu país, inclua listas de sites selecionadas, traduza o README para seu idioma, aprimore traduções e muito mais
* 🌐 [TRANSLATING.md](TRANSLATING.md) — leve a UI ao seu idioma: um pacote de locale e uma linha no registro; uma **tradução parcial é bem-vinda em uma primeira PR**
* 📄 [CONTRIBUTING.md](CONTRIBUTING.md) — instalação, convenções e o fluxo das PRs (direcione-as para a branch `dev`)

## ⚙️ Configuração

Dois ajustes são essenciais antes de qualquer outra coisa:

* **MaxMind GeoLite2 (obrigatório)** — credenciais gratuitas que viabilizam a geolocalização de IP e as consultas ASN. Sem elas, a fonte MaxMind retorna 503. → [Configuração do MaxMind](https://docs.ipcheck.ing/developer/getting-started/maxmind-setup)
* **`ALLOWED_DOMAINS` (obrigatório em um domínio real)** — lista de nomes de host permitidos para a API de backend. Sem ela, toda solicitação proveniente de um domínio que não seja localhost recebe 403. → [Proxy reverso e domínios](https://docs.ipcheck.ing/developer/getting-started/reverse-proxy-and-domains)

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


## 👩🏻‍💻 Uso avançado

Se você usa um proxy para acessar a Internet, considere adicionar esta regra à configuração do proxy e adaptá-la ao seu cliente. Essa configuração permite verificar tanto seu IP real quanto o IP usado com o proxy:

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

## 💖 Patrocinadores

Como projeto de código aberto, somos muito gratos aos seguintes patrocinadores pelo apoio:

<a href="https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://res.ipcheck.ing/img/digitalocean_logo.png" width="240px"  title="DigitalOcean" /></a>

<a href="https://www.1password.com"><img src="https://res.ipcheck.ing/img/1password_logo.png" alt="1Password" title="1Password" width="240px"  /></a>

<a href="https://www.greptile.com/"><img src="https://res.ipcheck.ing/img/greptile_logo.png" alt="Greptile" title="Greptile" width="240px"  /></a>

<a href="https://www.sentry.io"><img src="https://res.ipcheck.ing/img/sentry_logo.png" alt="Sentry" title="Sentry" width="240px" /></a>

<a href="https://www.gitbook.com"><img src="https://res.ipcheck.ing/img/gitbook_logo.png" alt="GitBook" title="GitBook" width="240px" /></a>

<a href="https://v.ps/?utm_source=ipcheck.ing&utm_medium=referral&utm_campaign=github_readme&utm_content=en"><img src="https://res.ipcheck.ing/img/vps_logo.png" alt="v.ps" title="v.ps" width="240px" /></a>

<a href="https://www.cloudflare.com/lp/project-alexandria/"><img src="https://res.ipcheck.ing/img/cloudflare_logo.png" alt="Cloudflare Project Alexandria" title="Cloudflare Project Alexandria" width="240px" /></a>

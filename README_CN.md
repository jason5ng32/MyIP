# IP 工具箱

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub](https://img.shields.io/github/license/jason5ng32/MyIP)
![GitHub contributors](https://img.shields.io/github/contributors/jason5ng32/MyIP)
![GitHub commit activity (branch)](https://img.shields.io/github/commit-activity/m/jason5ng32/MyIP)

[🇺🇸 English](README.md) | [🇨🇳 简体中文](README_CN.md)

在这里体验：[jason5ng32.github.io/MyIP](https://jason5ng32.github.io/MyIP/)

备注：体验地址的一些数据可能出不来，是因为最近用的人比较多……（我也实在没想到），自己部署一下就好。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&project-name=MyIP&repository-name=MyIP)

这是一个完全开源的 IP 信息查看器，可以查询本机 IP、查询任意 IP、查询国内外网站可用性等。这是我第一次用 Vue.js 练手的项目。我……只是一个普通的产品经理。

## 主要功能

1. **看自己的 IP**：从多个 IPv4 和 IPv6 来源检测显示本机的 IP
2. **看 IP 信息**：显示所有 IP 的相关信息，包括国家、地区、ASN、地理位置等
3. **可用性检测**：检测一些网站的可用性：Google, Github, Youtube, 网易, 百度等
4. **WebRTC 检测**：查看使用 WebRTC 连接时使用的 IP
5. **DNS 泄露检测**：查看 DNS 出口信息，以便查看在 VPN/代理的情况下，是否存在 DNS 泄露隐私的风险
6. **暗黑模式**：根据系统设置自动切换暗黑/白天模式，也可以手动切换
7. **简约模式**：为移动版提供的专门模式，缩短页面长度，快速查看最重要的信息
8. **查任意 IP 信息**：可以通过小工具查询任意 IP 的信息
9. **支持 PWA**：可以添加为手机桌面应用以及电脑里的 Chrome 应用
10. 根据可用性检测结果，返回目前是否可以访问全世界网络的提示
11. 支持中文和英文

## 如何使用

几乎开箱即用。直接下载所有代码，放到你本地或服务器上就行，没啥额外步骤。

如果你希望能够显示 IP 所在地的地图，有 2 个方法：

1. 在网页中点击地图显示按钮旁边的 + 号，填入 API KEY，这个 KEY 会一直在这个浏览器生效
2. 或者，直接修改源文件，在 `res/app.js` ，在 `data` 部分，找到：

```javascript
bingMapAPIKEY: '',
```

在这里添加你的 Bing Map API Key，添加后，首页的地图按钮就会自动变为可用状态，此时，你所有的用户都可以使用地图。

申请这个 API 是免费的，一年可以发起 12w 次免费请求，个人玩应该足够用了。如果真要搞大家伙的东西，就自己改一下程序吧，别把 key 放到前端代码里……

如果你连申请都懒得折腾，也可以考虑使用 Google Maps 的 iframe 嵌入。程序里已经注释了这部分的代码，你可以根据实际的情况进行反注释。不过，使用 iframe 实在有点脏脏的感觉。

如果你不打算增加地图功能，其实也可以在 Vercel 上一键部署。

## 高级用法

如果你在通过代理上网，可以考虑在你的代理配置里，增加下面的规则（请根据你使用的客户端进行修改），这样就可以实现同时查询真实 IP 和代理后的 IP：

```ini
# IP Testing
IP-CIDR,1.0.0.1/32,DIRECT,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,DIRECT,no-resolve
DOMAIN-SUFFIX,ipify.org,Proxy
```

## 额外说明

这个程序的 70% 的代码不是我写的，是通过 ChatGPT 写的。大概来回 50 个回合，外加一些细微的手动修改，完成了全部代码。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)
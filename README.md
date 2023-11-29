# IP Toolkit

![GitHub Repo stars](https://img.shields.io/github/stars/jason5ng32/MyIP)
![GitHub](https://img.shields.io/github/license/jason5ng32/MyIP)
![GitHub contributors](https://img.shields.io/github/contributors/jason5ng32/MyIP)
![GitHub commit activity (branch)](https://img.shields.io/github/commit-activity/m/jason5ng32/MyIP)

[🇺🇸 English](README.md) | [🇨🇳 简体中文](README_CN.md)


Demo: [jason5ng32.github.io/MyIP](https://jason5ng32.github.io/MyIP/)

Notes: Note: Some data on the demo site may not be displayed because it has been used frequently recently... (I didn't expect that either), just deploy it yourself.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjason5ng32%2FMyIP&project-name=MyIP&repository-name=MyIP)

## Main Features

1. **View Your IP**: Detects and displays the local IP from multiple IPv4 and IPv6 sources.
2. **IP Information**: Shows related information for all IPs, including country, region, ASN, geographical location, etc.
3. **Availability Check**: Tests the accessibility of various websites such as Google, Github, YouTube, NetEase, Baidu, etc.
4. **WebRTC Detection**: Identifies the IP used when connecting via WebRTC.
5. **DNS Leak Test**: Reveals DNS exit information to assess the risk of DNS leaks under VPN/proxy use.
6. **Dark Mode**: Automatically switches between dark/ daylight mode based on system settings, with a manual switch option.
7. **Minimalist Mode**: A specialized mode for mobile, reducing page length to quickly access the most crucial information.
8. **Arbitrary IP Information**: Utilize a tool to query information for any IP.
9. Based on the results of the availability test, provides indications on whether global internet access is currently possible.

## How to Use

It's almost ready to use out of the box. Simply download all the code and place it on your local machine or server, with no extra steps required.

If you want to display a map of the IP's location, you need to modify `app.js`. In the `data` section, find:

```javascript
bingMapAPIKEY: '',
```

Add your Bing Map API Key here. After adding it, the map button on the homepage will automatically become active.

Applying for this API is free, allowing up to 120,000 free requests per year, which should be sufficient for personal use. If you plan to use it for larger projects, consider modifying the program so as not to include the key in the frontend code.

If you're not planning to add map functionality, you can also deploy it with one click on Vercel.

## Advanced Usage

If you are using a proxy to access the internet, consider adding the following rule to your proxy configuration (please modify according to the client you are using). This will allow you to simultaneously query your real IP and the IP after proxying:

```ini
# IP Testing
IP-CIDR,1.0.0.1/32,DIRECT,no-resolve
IP-CIDR6,2606:4700:4700::1111/128,DIRECT,no-resolve
DOMAIN-SUFFIX,ipify.org,Proxy
```

## Additional Notes

80% of the code for this program was not written by me, but generated through ChatGPT. After about 50 rounds of back-and-forth and some minor manual adjustments, all the code was completed.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jason5ng32/MyIP&type=Date)](https://star-history.com/#jason5ng32/MyIP&Date)
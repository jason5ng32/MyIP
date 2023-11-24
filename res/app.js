new Vue({
    el: '#app',
    data: {
        ipDataCards: [
            { id: 'ipapi', ip: '', country_name: '', region: '', latitude: '', longitude: '', isp: '', asn: '', mapImage: 'map-placeholder.jpg', source: '' },
            { id: 'taobao', ip: '', country_name: '', region: '', latitude: '', longitude: '', isp: '', asn: '', mapImage: 'map-placeholder.jpg', source: '' },
            // 其他卡片数据...
        ],
        connectivityTests: [
            { id: 'netease', name: 'Netease', url: 'https://s2.music.126.net/style/web2/img/frame/topbar.png?', status: '待检测' },
            { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/img/flexible/logo/pc/peak-result.png?', status: '待检测' },
            { id: 'wechat', name: 'WeChat', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?', status: '待检测' },
            { id: 'google', name: 'Google', url: 'https://www.google.com/images/errors/robot.png?', status: '待检测' },
            { id: 'cloudflare', name: 'Cloudflare', url: 'https://www.cloudflare.com/favicon.ico?', status: '待检测' },
            { id: 'youtube', name: 'Youtube', url: 'https://i.ytimg.com/vi/GYkq9Rgoj8E/hq720.jpg?', status: '待检测' },
            { id: 'github', name: 'Github', url: 'https://raw.githubusercontent.com/jason5ng32/fulian4/master/background.jpg?', status: '待检测' },
            { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/favicon.ico?', status: '待检测' }

        ]
    },
    methods: {
        getIPFromIpapi() {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    var ip = response.ip;
                    this.ipDataCards[0].ip = ip; // 存储获取到的 IP 地址
                    this.ipDataCards[0].source = 'IPAPI.co';
                    this.fetchIPDetails(this.ipDataCards[0], ip);
                }
            };
            xhr.open('GET', 'https://ipapi.co/json/', true);
            xhr.send();
        },

        getIPFromTaobao() {
            window.ipCallback = (data) => {
                var ip = data.ip;
                this.ipDataCards[1].ip = ip; // 存储获取到的 IP 地址
                this.ipDataCards[1].source = 'TaoBao';
                this.fetchIPDetails(this.ipDataCards[1], ip);
                delete window.ipCallback; // 清理
            };
            var script = document.createElement('script');
            script.src = 'https://www.taobao.com/help/getip.php?callback=ipCallback';
            document.head.appendChild(script);
            // 清理
            document.head.removeChild(script);
        },
        async fetchIPDetails(card, ip) {
            try {
                const response = await fetch(`https://ipapi.co/${ip}/json/`);
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.reason);
                }
                card.ip = ip;
                card.country_name = data.country_name || '';
                card.country_code = data.country || '';
                card.region = data.region || '';
                card.latitude = data.latitude || '';
                card.longitude = data.longitude || '';
                card.isp = data.org || '';
                card.asn = data.asn || '';

                // 构造 Google Maps iframe 的 URL
                card.mapUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}&zoom=0&output=embed`;

            } catch (error) {
                console.error('获取 IP 详情时出错:', error);
                // 设置错误信息或保持字段为空
                card.mapUrl = ''; // 在错误情况下重置地图 URL
            }
        },
        refreshCard(card) {
            // 清空卡片数据
            this.clearCardData(card);

            // 根据来源重新加载数据
            if (card.source === 'Taobao') {
                this.getIPFromTaobao(card);
            } else if (card.source === 'Ipapi') {
                this.getIPFromIpapi(card);
            }
        },

        clearCardData(card) {
            card.ip = '';
            card.country_name = '';
            card.region = '';
            card.latitude = '';
            card.longitude = '';
            card.asn = '';
            card.mapUrl = '';
        },

        checkConnectivityHandler(test) {
            const beginTime = + new Date();
            test.status = "检查中...";
            var img = new Image();
            var timeout = setTimeout(() => {
                test.status = "超时或不可用";
            }, 3 * 1000);

            img.onload = () => {
                clearTimeout(timeout);
                test.status = `可用 ( ${+ new Date() - beginTime} ms )`;
            };

            img.onerror = () => {
                clearTimeout(timeout);
                test.status = "不可用";
            };

            img.src = `${test.url}${Date.now()}`;
        },

        checkAllConnectivity() {
            this.connectivityTests.forEach(test => {
                this.checkConnectivityHandler(test);
            });
        },
        async fetchCloudflareTrace() {
    try {
      const response = await fetch('https://cloudflare.com/cdn-cgi/trace');
      const data = await response.text();
      console.log('Cloudflare Trace Data:', data);
    } catch (error) {
      console.error('Error fetching Cloudflare trace data:', error);
    }
  },
    },
    mounted() {
        this.checkAllConnectivity();
        this.getIPFromIpapi();
        this.getIPFromTaobao();
    }


});

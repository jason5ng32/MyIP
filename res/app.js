new Vue({
    el: '#app',
    data: {
        // Enter your Bing Maps API key here
        bingMapAPIKEY: '',
        currentLanguage: 'en',
        currentTexts: {},

        textEN: {
            nav: {
                id: 'nav',
                Title: 'IP Toolbox',
                IPinfo: 'IP Infos',
                Connectivity: 'Connectivity',
                WebRTC: 'WebRTC Test',
                DNSLeakTest: 'DNS Leak Test',
            },
            ipInfos: {
                id: "ipinfos",
                Title: "IP Infos",
                Notes: "IP data will be checked from 6 sources. If there is only 1 IP stack currently, sources without data will show as empty.",
                Simple: "Simple",
                Map: "Map",
                MapUnavailable: "Map Unavailable",
                Source: "Source",
                IP: "IP Address",
                Country: "Country",
                Region: "Region",
                City: "City",
                ISP: "ISP",
                ASN: "ASN",
                IPv4Error: "Fetch Failed or No IPv4 Address",
                IPv6Error: "Fetch Failed or No IPv6 Address",
            },
            connectivity: {
                id: "connectivity",
                Title: "Network Connectivity",
                Note: "Testing is done by loading small images from corresponding websites. Delay values are for reference only and will be smaller in reality.",
                StatusWait: "Awaiting Test",
                StatusAvailable: "Available",
                StatusUnavailable: "Unavailable",
                StatusTimeout: "Timeout or Unavailable",
                checking: 'Checking...',
            },
            webrtc: {
                id: "webrtc",
                Title: "WebRTC Test",
                Note: "WebRTC often establishes connections directly via UDP. If the test returns your real IP, it means your proxy settings do not cover these connections.",
                StatusWait: "Awaiting Test or Connection Error",
                StatusError: "Test Error",
            },
            dnsleaktest: {
                id: "dnsleaktest",
                Name: "Test",
                Title: "DNS Leak Test",
                Note: "A DNS leak means that when you are connected to a VPN/proxy, your domain name resolutions are still done through your local ISP, thus posing a risk of DNS leaks.",
                Note2: "The leak test method involves accessing a newly generated domain name to detect which region's DNS is being used as per your VPN/proxy settings.",
                Endpoint: "DNS Endpoint",
                EndpointCountry: "Endpoint Region",
                StatusWait: "Awaiting Test",
                StatusError: "Test Error",
            },
            ipcheck: {
                id: "ipcheck",
                Title: "IP Check",
                Placeholder: "Please enter an IP address",
                Button: "Check",
                Error: "Please enter a valid IPv4 or IPv6 address.",
            },
            alert: {
                id: 'alert',
                OhNo: 'Oh No!',
                Congrats: 'Congrats!',
                OhNo_Message: 'You seem to be not connected to a VPN/proxy, some content may not be displayed.',
                Congrats_Message: 'You are now connected to a VPN/proxy, welcome to the new world.',
            },
            page: {
                title: "Check My IP Address | Check My IP Address and Geolocation | Check WebRTC Connection IP | DNS Leak Test | Jason Ng Open Source",
            },

        },
        textCN: {
            nav: {
                id: 'nav',
                Title: 'IP 工具箱',
                IPinfo: 'IP 信息',
                Connectivity: '网络连通性',
                WebRTC: 'WebRTC 测试',
                DNSLeakTest: 'DNS 泄漏测试',
            },
            ipInfos: {
                id: 'ipinfos',
                Title: 'IP 信息',
                Notes: '将会从 6 个来源检查 IP 数据，如果当前 IP 栈只有 1 个，则没有数据的来源会显示为空。',
                Simple: '简约',
                Map: '地图',
                MapUnavailable: '地图不可用',
                Source: '来源',
                IP: 'IP 地址',
                Country: '国家',
                Region: '地区',
                City: '城市',
                ISP: 'ISP',
                ASN: 'ASN',
                IPv4Error: '获取失败或不存在 IPv4 地址',
                IPv6Error: '获取失败或不存在 IPv6 地址',

            },
            connectivity: {
                id: 'connectivity',
                Title: '网络连通性',
                Note: '通过加载对应网站上的小图片进行测试，延迟值仅供参考，实际会更小。',
                StatusWait: '待检测',
                StatusAvailable: '可用',
                StatusUnavailable: '不可用',
                StatusTimeout: '超时或不可用',
                checking: '检查中...',
            },
            webrtc: {
                id: 'webrtc',
                Title: 'WebRTC 测试',
                Note: 'WebRTC 往往通过 UDP 直连进行建立，如果测试返回了真实 IP，则意味着你的代理设置没有覆盖这些连接。',
                StatusWait: '待检测或连接错误',
                StatusError: '测试出错',
            },
            dnsleaktest: {
                id: 'dnsleaktest',
                Name: '测试',
                Title: 'DNS 泄漏测试',
                Note: 'DNS 泄露（DNS Leaks）的意思是，当你挂上 VPN/代理后，你解析域名时，依然通过当地的运营商进行解析，这时就有 DNS泄露的风险。',
                Note2: '泄露测试的方法是通过访问新生成的域名，检测你是通过哪个地区的改你的 VPN/代理设置。',
                Endpoint: 'DNS 出口',
                EndpointCountry: '出口地区',
                StatusWait: '待检测',
                StatusError: '测试出错',
            },
            ipcheck: {
                id: 'ipcheck',
                Title: 'IP 查询',
                Placeholder: '请输入有 IP 地址',
                Button: '查询',
                Error: '请输入有效的 IPv4 或 IPv6 地址。',
            },
            alert: {
                id: 'alert',
                OhNo: '糟糕！',
                Congrats: '恭喜呀！',
                OhNo_Message: '你当前似乎没有翻墙，部分内容无法显示。',
                Congrats_Message: '你当前已经翻墙，欢迎来到新世界。',
            },
            page: {
                title: "查看我的 IP 地址 | 查询本机 IP 地址及归属地 | 查看 WebRTC 连接 IP ｜ DNS 泄露检测 | Jason Ng 阿禅开源作品",
            },
        },
        ipDataCards: [
            {
                id: 'upai',
                ip: '',
                country_name: '',
                region: '',
                city: '',
                latitude: '',
                longitude: '',
                isp: '',
                asn: '',
                asnlink: '',
                mapUrl: 'res/defaultMap.jpg',
                showMap: false,
                source: 'Upai'
            },
            {
                id: 'taobao',
                ip: '',
                country_name: '',
                region: '',
                city: '',
                latitude: '',
                longitude: '',
                isp: '',
                asn: '',
                asnlink: '',
                mapUrl: 'res/defaultMap.jpg',
                showMap: false,
                source: 'Taobao'
            },
            {
                id: 'cloudflare_v4',
                ip: '',
                country_name: '',
                region: '',
                city: '',
                latitude: '',
                longitude: '',
                isp: '',
                asn: '',
                asnlink: '',
                mapUrl: 'res/defaultMap.jpg',
                showMap: false,
                source: 'Cloudflare IPv4'
            },
            {
                id: 'cloudflare_v6',
                ip: '',
                country_name: '',
                region: '',
                city: '',
                latitude: '',
                longitude: '',
                isp: '',
                asn: '',
                asnlink: '',
                mapUrl: 'res/defaultMap.jpg',
                showMap: false,
                source: 'Cloudflare IPv6'
            },
            {
                id: 'ipify_v4',
                ip: '',
                country_name: '',
                region: '',
                city: '',
                latitude: '',
                longitude: '',
                isp: '',
                asn: '',
                asnlink: '',
                mapUrl: 'res/defaultMap.jpg',
                showMap: false,
                source: 'IPify IPv4'
            },
            {
                id: 'ipify_v6',
                ip: '',
                country_name: '',
                region: '',
                city: '',
                latitude: '',
                longitude: '',
                isp: '',
                asn: '',
                asnlink: '',
                mapUrl: 'res/defaultMap.jpg',
                showMap: false,
                source: 'IPify IPv6'
            },
        ],
        connectivityTests: [
            {
                id: 'netease',
                name: 'Netease',
                icon: 'globe-americas',
                url: 'https://s2.music.126.net/style/web2/img/frame/topbar.png?',
                status: ''
            },
            {
                id: 'baidu',
                name: 'Baidu',
                icon: 'globe-americas',
                url: 'https://www.baidu.com/img/flexible/logo/pc/peak-result.png?',
                status: ''
            },
            {
                id: 'wechat',
                name: 'WeChat',
                icon: 'wechat',
                url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?',
                status: ''
            },
            {
                id: 'google',
                name: 'Google',
                icon: 'google',
                url: 'https://www.google.com/images/errors/robot.png?',
                status: ''
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare',
                icon: 'cloud-fill',
                url: 'https://www.cloudflare.com/favicon.ico?',
                status: ''
            },
            {
                id: 'youtube',
                name: 'Youtube',
                icon: 'youtube',
                url: 'https://i.ytimg.com/vi/GYkq9Rgoj8E/hq720.jpg?',
                status: ''
            },
            {
                id: 'github',
                name: 'Github',
                icon: 'github',
                url: 'https://raw.githubusercontent.com/jason5ng32/fulian4/master/background.jpg?',
                status: ''
            },
            {
                id: 'chatgpt',
                name: 'ChatGPT',
                icon: 'chat-quote-fill',
                url: 'https://chat.openai.com/favicon.ico?',
                status: ''
            }
        ],
        stunServers: [
            {
                id: 'google',
                name: 'Google',
                url: 'stun:stun.l.google.com:19302',
                ip: ''
            },
            {
                id: 'nextcloud',
                name: 'NxtCld',
                url: 'stun:stun.nextcloud.com:443',
                ip: ''
            },
            {
                id: 'peerjs',
                name: 'PeerJS',
                url: 'stun:us-0.turn.peerjs.com',
                ip: ''
            },
            {
                id: 'twilio',
                name: 'Twilio',
                url: 'stun:global.stun.twilio.com',
                ip: ''
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare',
                url: 'stun:stun.cloudflare.com',
                ip: ''
            },
            {
                id: 'miwifi',
                name: 'MiWiFi',
                url: 'stun:stun.miwifi.com',
                ip: ''
            },
            {
                id: 'qq',
                name: 'QQ',
                url: 'stun:stun.qq.com',
                ip: ''
            },
            {
                id: 'stunprotocol',
                name: 'StnPtc',
                url: 'stun:stunserver.stunprotocol.org',
                ip: ''
            }
        ],
        leakTest: [
            {
                "id": "ipapi1",
                "name": "",
                "geo": "",
                "ip": ""
            },
            {
                "id": "ipapi2",
                "name": "",
                "geo": "",
                "ip": ""
            },
            {
                "id": "sfshark1",
                "name": "",
                "geo": "",
                "ip": ""
            },
            {
                "id": "sfshark2",
                "name": "",
                "geo": "",
                "ip": ""
            },
        ],
        alertMessage: '',
        alertStyle: '',
        alertTitle: '',
        alertToShow: false,
        inputIP: '',
        modalQueryResult: null,
        modalQueryError: '',
        isMapShown: false,
        isDarkMode: false,
        isMobile: false,
        isCardsCollapsed: false,
    },
    methods: {

        getIPFromUpai() {
            const unixTime = Date.now();
            const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${unixTime}`;

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    const ip = data.remote_addr;
                    this.ipDataCards[0].ip = ip;
                    this.fetchIPDetails(this.ipDataCards[0], ip);
                })
                .catch(error => {
                    console.error('Error fetching IP from Upai:', error);
                    this.ipDataCards[0].ip = this.currentTexts.ipInfos.IPv4Error;
                });
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

        getIPFromCloudflare_V4() {
            fetch('https://1.0.0.1/cdn-cgi/trace')
                .then(response => response.text())
                .then(data => {
                    const lines = data.split('\n');
                    const ipLine = lines.find(line => line.startsWith('ip='));
                    if (ipLine) {
                        const ip = ipLine.split('=')[1];
                        this.ipDataCards[2].ip = ip;
                        this.fetchIPDetails(this.ipDataCards[2], ip);
                    }
                })
                .catch(error => {
                    console.error('Error fetching IP from Cloudflare:', error);
                    this.ipDataCards[2].ip = this.currentTexts.ipInfos.IPv4Error;
                });
        },

        getIPFromCloudflare_V6() {
            fetch('https://[2606:4700:4700::1111]/cdn-cgi/trace')
                .then(response => response.text())
                .then(data => {
                    const lines = data.split('\n');
                    const ipLine = lines.find(line => line.startsWith('ip='));
                    if (ipLine) {
                        const ip = ipLine.split('=')[1];
                        this.ipDataCards[3].ip = ip;
                        this.fetchIPDetails(this.ipDataCards[3], ip);
                    }
                })
                .catch(error => {
                    console.error('Error fetching IP from Cloudflare:', error);
                    this.ipDataCards[3].ip = this.currentTexts.ipInfos.IPv6Error;
                });
        },
        getIPFromIpify_V4() {
            fetch('https://api4.ipify.org?format=json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    this.ipDataCards[4].ip = data.ip;
                    this.fetchIPDetails(this.ipDataCards[4], data.ip);
                })
                .catch(error => {
                    console.error('Error fetching IPv4 address from ipify:', error);
                    this.ipDataCards[4].ip = this.currentTexts.ipInfos.IPv4Error;
                });
        },
        getIPFromIpify_V6() {
            fetch('https://api6.ipify.org?format=json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    this.ipDataCards[5].ip = data.ip;
                    this.fetchIPDetails(this.ipDataCards[5], data.ip);
                })
                .catch(error => {
                    console.error('Error fetching IPv6 address from ipify:', error);
                    this.ipDataCards[5].ip = this.currentTexts.ipInfos.IPv6Error;
                });
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
                card.city = data.city || '';
                card.latitude = data.latitude || '';
                card.longitude = data.longitude || '';
                card.isp = data.org || '';
                card.asn = data.asn || '';

                bingMapAPIKEY = this.bingMapAPIKEY;

                // 构造 AS Number 的链接
                if (card.asn === '') {
                    card.asnlink = false;
                    card.mapUrl = '';
                } else {
                    card.asnlink = `https://radar.cloudflare.com/traffic/${card.asn}`;
                    card.mapUrl = `https://dev.virtualearth.net/REST/v1/Imagery/Map/Road/${card.latitude},${card.longitude}/5?mapSize=800,640&pp=${card.latitude},${card.longitude};66&key=${bingMapAPIKEY}&fmt=jpeg&dpi=Large`;

                    // 可选改成 Google Maps 内嵌 iFrame
                    // card.mapUrl = `https://www.google.com/maps?q=${card.latitude},${card.longitude}&z=2&output=embed`;
                }


            } catch (error) {
                console.error('Get IP error:', error);
                // 设置错误信息或保持字段为空
                card.mapUrl = '';
            }
        },
        refreshCard(card) {
            // 清空卡片数据
            this.clearCardData(card);
            switch (card.source) {
                case 'Cloudflare IPv4':
                    this.getIPFromCloudflare_V4(card);
                    break;
                case 'Cloudflare IPv6':
                    this.getIPFromCloudflare_V6(card);
                    break;
                case 'IPify IPv4':
                    this.getIPFromIpify_V4(card);
                    break;
                case 'IPify IPv6':
                    this.getIPFromIpify_V6(card);
                    break;
                case 'Upai':
                    this.getIPFromUpai(card);
                    break;
                case 'TaoBao':
                    this.getIPFromTaobao(card);
                    break;
                default:
                    console.error('Undefind Source:', card.source);
            }
        },

        clearCardData(card) {
            card.ip = '';
            card.country_name = '';
            card.country_code = '';
            card.region = '';
            card.city = '';
            card.latitude = '';
            card.longitude = '';
            card.asn = '';
            card.isp = '';
            card.mapUrl = 'res/defaultMap.jpg';
        },

        toggleMaps() {
            this.isMapShown = !this.isMapShown;
            this.ipDataCards.forEach(card => {
                card.showMap = this.isMapShown;
            });
        },

        checkAllIPs() {
            // 从所有来源获取 IP 地址
            setTimeout(() => {
                this.getIPFromCloudflare_V4();
                this.getIPFromCloudflare_V6();
            }, 1000);
            setTimeout(() => {
                this.getIPFromTaobao();
                this.getIPFromUpai();
            }, 100);
            setTimeout(() => {
                this.getIPFromIpify_V4();
                this.getIPFromIpify_V6();
            }, 2000);
        },

        checkConnectivityHandler(test) {
            const beginTime = + new Date();
            test.status = this.currentTexts.connectivity.checking;
            var img = new Image();
            var timeout = setTimeout(() => {
                test.status = this.currentTexts.connectivity.StatusUnavailable;
                if (test.id === 'google') {
                    this.alertStyle = "text-danger";
                    this.alertMessage = this.currentTexts.alert.OhNo_Message;
                    this.alertTitle = this.currentTexts.alert.OhNo;
                    this.alertToShow = true;
                }
            }, 3 * 1000);

            img.onload = () => {
                clearTimeout(timeout);
                test.status = this.currentTexts.connectivity.StatusAvailable + ` ( ${+ new Date() - beginTime} ms )`;
                if (test.id === 'google') {
                    this.alertStyle = "text-success";
                    this.alertMessage = this.currentTexts.alert.Congrats_Message;
                    this.alertTitle = this.currentTexts.alert.Congrats;
                    this.alertToShow = true;
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                test.status = this.currentTexts.connectivit.StatusUnavailable;
                if (test.id === 'google') {
                    this.alertStyle = "text-danger";
                    this.alertMessage = this.currentTexts.alert.OhNo_Message;
                    this.alertTitle = this.currentTexts.alert.OhNo;
                    this.alertToShow = true;
                }
            };

            img.src = `${test.url}${Date.now()}`;
        },

        checkAllConnectivity() {
            this.connectivityTests.forEach(test => {
                this.checkConnectivityHandler(test);
            });
        },
        showToast() {
            this.$nextTick(() => {
                const toastEl = this.$refs.toast;
                if (toastEl) {
                    const toast = new bootstrap.Toast(toastEl);
                    toast.show();
                } else {
                    console.error("Toast element not found");
                }
            });
        },
        async submitQuery() {
            if (this.isValidIP(this.inputIP)) {
                this.modalQueryError = '';
                this.modalQueryResult = null;
                await this.fetchIPForModal(this.inputIP);
            } else {
                this.modalQueryError = this.currentTexts.ipcheck.Error;
                this.modalQueryResult = null;
            }
        },
        isValidIP(ip) {
            const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;
            return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
        },
        async fetchIPForModal(ip) {
            try {
                const response = await fetch(`https://ipapi.co/${ip}/json/`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.reason);
                }

                // 更新 modalQueryResult
                this.modalQueryResult = {
                    ip,
                    country_name: data.country_name || '',
                    country_code: data.country_code || '',
                    region: data.region || '',
                    city: data.city || '',
                    latitude: data.latitude || '',
                    longitude: data.longitude || '',
                    isp: data.org || '',
                    asn: data.asn || '',
                    asnlink: data.asn ? `https://radar.cloudflare.com/traffic/${data.asn}` : false,
                    mapUrl: data.latitude && data.longitude ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=2&output=embed` : ''
                };
            } catch (error) {
                console.error('获取 IP 详情时出错:', error);
                this.modalQueryError = error.message;
            }
        },
        resetModalData() {
            this.inputIP = '';
            this.modalQueryResult = null;
            this.modalQueryError = '';
        },
        async checkSTUNServer(stun) {
            try {
                const servers = { iceServers: [{ urls: stun.url }] };
                const pc = new RTCPeerConnection(servers);
                let candidateReceived = false;

                pc.onicecandidate = event => {
                    if (event.candidate) {
                        candidateReceived = true;
                        const candidate = event.candidate.candidate;
                        const ipMatch = /(\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b)|([0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(candidate);
                        if (ipMatch) {
                            stun.ip = ipMatch[0];
                            pc.close();
                        }
                    }
                };

                pc.createDataChannel("");
                await pc.createOffer().then(offer => pc.setLocalDescription(offer));

                // 设置一个超时计时器
                await new Promise((resolve, reject) => {
                    setTimeout(() => {
                        if (!candidateReceived) {
                            reject(new Error("连接 STUN 服务器超时"));
                        } else {
                            resolve();
                        }
                    }, 5000);
                });
            } catch (error) {
                console.error('STUN Server Test Error:', error);
                stun.ip = '测试超时或数据出错';
            }
        },

        checkAllWebRTC() {
            this.stunServers.forEach(stun => {
                this.checkSTUNServer(stun);
            });
        },

        generate32DigitString() {
            const unixTime = Date.now().toString(); // 13 位 Unix 时间戳
            const fixedString = "jason5ng32"; // 固定字符串
            const randomString = Math.random().toString(36).substring(2, 11); // 随机 9 位字符串

            return unixTime + fixedString + randomString; // 拼接字符串
        },

        generate14DigitString() {
            const fixedString = "jn32"; // 固定字符串
            const randomString = Math.random().toString(36).substring(2, 11); // 随机 9 位字符串

            return fixedString + randomString; // 拼接字符串
        },

        fetchLeakTestIpApiCom(index) {
            const urlString = this.generate32DigitString();
            const url = `https://${urlString}.edns.ip-api.com/json`;

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.dns && 'geo' in data.dns && 'ip' in data.dns) {
                        const geoSplit = data.dns.geo.split(' - ');
                        this.leakTest[index].geo = geoSplit[0];
                        this.leakTest[index].ip = data.dns.ip;
                    } else {
                        console.error('Unexpected data structure:', data);
                    }
                })
                .catch(error => {
                    console.error('Error fetching leak test data:', error);
                    this.leakTest[index].geo = this.currentTexts.dnsleaktest.StatusError;
                    this.leakTest[index].ip = this.currentTexts.dnsleaktest.StatusError;
                });
        },

        fetchLeakTestSfSharkCom(index, key) {
            const urlString = this.generate14DigitString();
            const url = `https://${urlString}.ipv4.surfsharkdns.com`;

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // 获取 data 对象中的指定键
                    const getKey = Object.keys(data)[key];
                    const keyEntry = data[getKey];

                    if (keyEntry && keyEntry.Country && keyEntry.IP) {
                        this.leakTest[index].geo = keyEntry.Country;
                        this.leakTest[index].ip = keyEntry.IP;
                    } else {
                        console.error('Unexpected data structure:', data);
                    }
                })
                .catch(error => {
                    console.error('Error fetching leak test data:', error);
                    this.leakTest[index].geo = this.currentTexts.dnsleaktest.StatusError;
                    this.leakTest[index].ip = this.currentTexts.dnsleaktest.StatusError;
                });
        },


        checkAllDNSLeakTest() {
            setTimeout(() => {
                this.fetchLeakTestIpApiCom(0);
            }, 100);

            setTimeout(() => {
                this.fetchLeakTestIpApiCom(1);
            }, 1000);

            setTimeout(() => {
                this.fetchLeakTestSfSharkCom(2, 0);
            }, 100);

            setTimeout(() => {
                this.fetchLeakTestSfSharkCom(3, 0);
            }, 1000);
        },
        toggleDarkMode() {
            this.isDarkMode = !this.isDarkMode;
            this.updateBodyClass();
        },
        updateBodyClass() {
            if (this.isDarkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        },
        checkSystemDarkMode() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                this.isDarkMode = true;
                this.updateBodyClass();
            }
        },
        handleResize() {
            this.isMobile = window.innerWidth < 768; // 设置断点为 768px
        },
        toggleCollapse() {
            this.isCardsCollapsed = !this.isCardsCollapsed;
        },
        toggleLanguage() {
            this.currentLanguage = this.currentLanguage === 'en' ? 'cn' : 'en';
            this.updateTexts();
        },
        checkBrowserLanguage() {
            const browserLanguage = navigator.language || navigator.userLanguage;
            if (browserLanguage.includes('zh')) {
                this.currentLanguage = 'cn';
            } else {
                this.currentLanguage = 'en';
            }
        },
        updatePageTitle(lang) {
            document.title = this.currentTexts.page.title;
        },
        // 更新语言
        updateTexts() {
            this.currentTexts = this.currentLanguage === 'en' ? this.textEN : this.textCN;
        },
        // 语言补丁，弥补初始化时的翻译延迟
        langPatch() {
            this.connectivityTests.forEach(test => {
                test.status = this.currentTexts.connectivity.StatusWait;
            });
            this.stunServers.forEach(server => {
                server.ip = this.currentTexts.webrtc.StatusWait;
            });
            count = 1;
            this.leakTest.forEach(server => {
                server.name = this.currentTexts.dnsleaktest.Name + ' ' + count;
                count++;
                server.geo = this.currentTexts.dnsleaktest.StatusWait;
                server.ip = this.currentTexts.dnsleaktest.StatusWait;
            });
        }


    },

    created() {
        this.checkBrowserLanguage();
        this.updateTexts();
        this.langPatch();
        if (!this.bingMapAPIKEY) {
            this.isMapShown = false;
        } else if (localStorage.getItem('isMapShown')) {
            this.isMapShown = localStorage.getItem('isMapShown') === 'true';
        }
        this.isMobile = window.innerWidth < 768;
        this.isCardsCollapsed = this.isMobile;
        // this.handleResize();
        window.addEventListener('resize', this.handleResize);
    },
    destroyed() {
        window.removeEventListener('resize', this.handleResize);
    },
    watch: {
        isMapShown(newVal) {
            localStorage.setItem('isMapShown', newVal);
        }
    },
    mounted() {
        this.updatePageTitle(this.currentLanguage);
        this.checkSystemDarkMode();
        this.checkAllIPs();
        setTimeout(() => {
            this.checkAllConnectivity();
            this.showToast();
        }, 2500);
        setTimeout(() => {
            this.checkAllWebRTC();
        }, 4000);
        setTimeout(() => {
            this.checkAllDNSLeakTest();
        }, 2500);
        setTimeout(() => {
            this.checkAllConnectivity();
        }, 6000);
        const modalElement = document.getElementById('IPCheck');
        modalElement.addEventListener('hidden.bs.modal', this.resetModalData);
    }

});
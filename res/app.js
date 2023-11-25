new Vue({
    el: '#app',
    data: {
        ipDataCards: [
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
                source: 'IPify IPv6'
            },
            // {
            //     id: 'ipapi',
            //     ip: '',
            //     country_name: '',
            //     region: '',
            //     city: '',
            //     latitude: '',
            //     longitude: '',
            //     isp: '',
            //     asn: '',
            //     asnlink: '',
            //     source: ''
            // },
            // {
            //     id: 'taobao',
            //     ip: '',
            //     country_name: '',
            //     region: '',
            //     city: '',
            //     latitude: '',
            //     longitude: '',
            //     isp: '',
            //     asn: '',
            //     asnlink: '',
            //     source: ''
            // },
        ],
        connectivityTests: [
            {
                id: 'netease',
                name: 'Netease',
                icon: 'globe-americas',
                url: 'https://s2.music.126.net/style/web2/img/frame/topbar.png?',
                status: '待检测'
            },
            {
                id: 'baidu',
                name: 'Baidu',
                icon: 'globe-americas',
                url: 'https://www.baidu.com/img/flexible/logo/pc/peak-result.png?',
                status: '待检测'
            },
            {
                id: 'wechat',
                name: 'WeChat',
                icon: 'wechat',
                url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico?',
                status: '待检测'
            },
            {
                id: 'google',
                name: 'Google',
                icon: 'google',
                url: 'https://www.google.com/images/errors/robot.png?',
                status: '待检测'
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare',
                icon: 'cloud-fill',
                url: 'https://www.cloudflare.com/favicon.ico?',
                status: '待检测'
            },
            {
                id: 'youtube',
                name: 'Youtube',
                icon: 'youtube',
                url: 'https://i.ytimg.com/vi/GYkq9Rgoj8E/hq720.jpg?',
                status: '待检测'
            },
            {
                id: 'github',
                name: 'Github',
                icon: 'github',
                url: 'https://raw.githubusercontent.com/jason5ng32/fulian4/master/background.jpg?',
                status: '待检测'
            },
            {
                id: 'chatgpt',
                name: 'ChatGPT',
                icon: 'chat-quote-fill',
                url: 'https://chat.openai.com/favicon.ico?',
                status: '待检测'
            }
        ],
        stunServers: [
            {
                id: 'google',
                name: 'Google',
                url: 'stun:stun.l.google.com:19302',
                ip: '待检测'
            },
            {
                id: 'nextcloud',
                name: 'NextCloud',
                url: 'stun:stun.nextcloud.com:443',
                ip: '待检测'
            },
            {
                id: 'peerjs',
                name: 'PeerJS',
                url: 'stun:us-0.turn.peerjs.com',
                ip: '待检测'
            },
            {
                id: 'twilio',
                name: 'Twilio',
                url: 'stun:global.stun.twilio.com',
                ip: '待检测'
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare',
                url: 'stun:stun.cloudflare.com',
                ip: '待检测'
            },
            {
                id: 'miwifi',
                name: 'MiWiFi',
                url: 'stun:stun.miwifi.com',
                ip: '待检测'
            },
            {
                id: 'qq',
                name: 'QQ',
                url: 'stun:stun.qq.com',
                ip: '待检测'
            },
            {
                id: 'stunprotocol',
                name: 'StunProtocol',
                url: 'stun:stunserver.stunprotocol.org',
                ip: '待检测'
            }
        ],
        alertMessage: '',
        alertStyle: '',
        alertTitle: '',
        inputIP: '',
        // queryResult: null,
        // queryError: '',
        modalQueryResult: null,
        modalQueryError: '',
    },
    methods: {

        getIPFromCloudflare_V4() {
            fetch('https://1.0.0.1/cdn-cgi/trace')
                .then(response => response.text())
                .then(data => {
                    const lines = data.split('\n');
                    const ipLine = lines.find(line => line.startsWith('ip='));
                    if (ipLine) {
                        const ip = ipLine.split('=')[1];
                        this.ipDataCards[0].ip = ip;
                        this.fetchIPDetails(this.ipDataCards[0], ip);
                    }
                })
                .catch(error => {
                    console.error('Error fetching IP from Cloudflare:', error);
                    this.ipDataCards[0].ip = '获取失败或不存在 IPv4 地址';
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
                        this.ipDataCards[1].ip = ip;
                        this.fetchIPDetails(this.ipDataCards[1], ip);
                    }
                })
                .catch(error => {
                    console.error('Error fetching IP from Cloudflare:', error);
                    this.ipDataCards[1].ip = '获取失败或不存在 IPv6 地址';
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
                    this.ipDataCards[2].ip = data.ip;
                    this.fetchIPDetails(this.ipDataCards[2], data.ip);
                })
                .catch(error => {
                    console.error('Error fetching IPv4 address from ipify:', error);
                    this.ipDataCards[2].ip = '获取失败或不存在 IPv4 地址';
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
                    this.ipDataCards[3].ip = data.ip;
                    this.fetchIPDetails(this.ipDataCards[3], data.ip);
                })
                .catch(error => {
                    console.error('Error fetching IPv6 address from ipify:', error);
                    this.ipDataCards[3].ip = '获取失败或不存在 IPv6 地址';
                });
        },
        //   getIPFromIpapi() {
        //     var xhr = new XMLHttpRequest();
        //     xhr.onreadystatechange = () => {
        //         if (xhr.readyState === 4 && xhr.status === 200) {
        //             var response = JSON.parse(xhr.responseText);
        //             var ip = response.ip;
        //             this.ipDataCards[4].ip = ip; // 存储获取到的 IP 地址
        //             this.ipDataCards[4].source = 'IPAPI.co';
        //             this.fetchIPDetails(this.ipDataCards[4], ip);
        //         }
        //     };
        //     xhr.open('GET', 'https://ipapi.co/json/', true);
        //     xhr.send();
        // },

        // getIPFromTaobao() {
        //     window.ipCallback = (data) => {
        //         var ip = data.ip;
        //         this.ipDataCards[5].ip = ip; // 存储获取到的 IP 地址
        //         this.ipDataCards[5].source = 'TaoBao';
        //         this.fetchIPDetails(this.ipDataCards[5], ip);
        //         delete window.ipCallback; // 清理
        //     };
        //     var script = document.createElement('script');
        //     script.src = 'https://www.taobao.com/help/getip.php?callback=ipCallback';
        //     document.head.appendChild(script);
        //     // 清理
        //     document.head.removeChild(script);
        // },
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

                // 网上找到的 Bing Map API Key，不知道是谁的，先用着
                bingMapAPIKEY = 'Am27Bsy1tM3G4a6CQZ10Sva7FaKgzsg527w_RB1M0TtB288Fnc99KfCmAm3TAFr0';

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
                console.error('获取 IP 详情时出错:', error);
                // 设置错误信息或保持字段为空
                card.mapUrl = ''; // 在错误情况下重置地图 URL
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
                // case 'IPAPI.co':
                //     this.getIPFromIpapi(card);
                //     break;
                // case 'TaoBao':
                //     this.getIPFromTaobao(card);
                //     break;
                default:
                    console.error('未知来源:', card.source);
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
            card.mapUrl = '';
        },

        checkConnectivityHandler(test) {
            const beginTime = + new Date();
            test.status = "检查中...";
            var img = new Image();
            var timeout = setTimeout(() => {
                test.status = "不可用";
                if (test.id === 'google') {
                    this.alertStyle = "text-danger";
                    this.alertMessage = "你当前似乎没有翻墙，部分内容无法显示。";
                    this.alertTitle = "糟糕！";
                    this.showToast();
                }
            }, 3 * 1000);

            img.onload = () => {
                clearTimeout(timeout);
                test.status = `可用 ( ${+ new Date() - beginTime} ms )`;
                if (test.id === 'google') {
                    this.alertStyle = "text-success";
                    this.alertMessage = "你当前已经翻墙，欢迎来到新世界。";
                    this.alertTitle = "恭喜呀！";
                    this.showToast();
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                test.status = "不可用";
                if (test.id === 'google') {
                    this.alertStyle = "text-danger";
                    this.alertMessage = "你当前似乎没有翻墙，部分内容无法显示。";
                    this.alertTitle = "糟糕！";
                    this.showToast();
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
                this.modalQueryError = '请输入有效的 IPv4 或 IPv6 地址。';
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

                pc.onicecandidate = event => {
                    if (event.candidate) {
                        const candidate = event.candidate.candidate;
                        // 匹配 IPv6 和 IPv4 地址
                        const ipMatch = /(\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b)|([0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(candidate);
                        if (ipMatch) {
                            stun.ip = ipMatch[0]; // 更新服务器的 IP
                            pc.close();
                        }
                    }
                };

                pc.createDataChannel("");
                await pc.createOffer().then(offer => pc.setLocalDescription(offer));
            } catch (error) {
                console.error('STUN Server Test Error:', error);
                stun.ip = '测试出错'; // 设置出错信息
            }
        },


        checkAllWebRTC() {
            this.stunServers.forEach(stun => {
                this.checkSTUNServer(stun);
            });
        },

    },
    mounted() {
        this.checkAllConnectivity();
        this.checkAllWebRTC();
        this.getIPFromCloudflare_V4();
        this.getIPFromCloudflare_V6();
        this.getIPFromIpify_V4();
        this.getIPFromIpify_V6();
        // this.getIPFromIpapi();
        // this.getIPFromTaobao();
        const modalElement = document.getElementById('IPCheck');
        modalElement.addEventListener('hidden.bs.modal', this.resetModalData);
    }

});

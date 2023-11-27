new Vue({
    el: '#app',
    data: {
        // 请在此处填写 Bing Maps API Key，申请是免费的
        bingMapAPIKEY: '',
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
                ip: '待检测或连接错误'
            },
            {
                id: 'nextcloud',
                name: 'NxtCld',
                url: 'stun:stun.nextcloud.com:443',
                ip: '待检测或连接错误'
            },
            {
                id: 'peerjs',
                name: 'PeerJS',
                url: 'stun:us-0.turn.peerjs.com',
                ip: '待检测或连接错误'
            },
            {
                id: 'twilio',
                name: 'Twilio',
                url: 'stun:global.stun.twilio.com',
                ip: '待检测或连接错误'
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare',
                url: 'stun:stun.cloudflare.com',
                ip: '待检测或连接错误'
            },
            {
                id: 'miwifi',
                name: 'MiWiFi',
                url: 'stun:stun.miwifi.com',
                ip: '待检测或连接错误'
            },
            {
                id: 'qq',
                name: 'QQ',
                url: 'stun:stun.qq.com',
                ip: '待检测或连接错误'
            },
            {
                id: 'stunprotocol',
                name: 'StnPtc',
                url: 'stun:stunserver.stunprotocol.org',
                ip: '待检测或连接错误'
            }
        ],
        leakTest: [
            {
                "id": "ipapi1",
                "name": "检测 1",
                "geo": "待检测",
                "ip": "待检测"
            },
            {
                "id": "ipapi2",
                "name": "检测 2",
                "geo": "待检测",
                "ip": "待检测"
            },
            {
                "id": "sfshark1",
                "name": "检测 3",
                "geo": "待检测",
                "ip": "待检测"
            },
            {
                "id": "sfshark2",
                "name": "检测 4",
                "geo": "待检测",
                "ip": "待检测"
            },
        ],
        alertMessage: '',
        alertStyle: '',
        alertTitle: '',
        inputIP: '',
        // queryResult: null,
        // queryError: '',
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
                    this.ipDataCards[0].ip = '获取失败或不存在 IPv4 地址';
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
                    this.ipDataCards[2].ip = '获取失败或不存在 IPv4 地址';
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
                    this.ipDataCards[3].ip = '获取失败或不存在 IPv6 地址';
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
                    this.ipDataCards[4].ip = '获取失败或不存在 IPv4 地址';
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
                    this.ipDataCards[5].ip = '获取失败或不存在 IPv6 地址';
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
                console.error('获取 IP 详情时出错:', error);
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
                    this.leakTest[index].geo = '检查出错';
                    this.leakTest[index].ip = '检查出错';
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
                    this.leakTest[index].geo = '检查出错';
                    this.leakTest[index].ip = '检查出错';
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
                this.fetchLeakTestSfSharkCom(2, 1);
            }, 100);

            setTimeout(() => {
                this.fetchLeakTestSfSharkCom(3, 2);
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

    },

    created() {
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
        this.checkSystemDarkMode();
        setTimeout(() => {
            this.checkAllConnectivity();
        }, 2500);
        setTimeout(() => {
            this.checkAllWebRTC();
        }, 4000);
        setTimeout(() => {
            this.checkAllDNSLeakTest();
        }, 2500);
        this.checkAllIPs();
        const modalElement = document.getElementById('IPCheck');
        modalElement.addEventListener('hidden.bs.modal', this.resetModalData);
    }

});
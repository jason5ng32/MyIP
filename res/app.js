import textCN from "../contents/lang_cn.js";
import textEN from "../contents/lang_en.js";
import connectivityTests from "../contents/connectivityTests.js";
import stunServers from "../contents/stunServers.js";
import ipDataCards from "../contents/ipDataCards.js";
import leakTest from "../contents/leakTest.js";

new Vue({
  el: "#app",
  data: {
    // Enter your Bing Maps API key here
    bingMapAPIKEY: "",
    currentLanguage: "en",
    currentTexts: {},

    alertMessage: "",
    alertStyle: "",
    alertTitle: "",
    alertToShow: false,
    inputIP: "",
    inputBingMapAPIKEY: "",
    bingMapAPIKEYError: false,
    bingMapLanguage: "en",
    modalQueryResult: null,
    modalQueryError: "",
    isMapShown: false,
    isDarkMode: false,
    isMobile: false,
    isCardsCollapsed: false,
    isInfoMasked: false,
    isInfosLoaded: false,
    infoMaskLevel: 0,

    // from contents
    connectivityTests,
    originconnectivityTests: {},
    ipDataCards,
    originipDataCards: {},
    stunServers,
    originstunServers: {},
    leakTest,
    originleakTest: {},
  },
  methods: {
    getIPFromUpai() {
      const unixTime = Date.now();
      const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${unixTime}`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          const ip = data.remote_addr;
          this.fetchIPDetails(0, ip);
        })
        .catch((error) => {
          console.error("Error fetching IP from Upai:", error);
          this.ipDataCards[0].ip = this.currentTexts.ipInfos.IPv4Error;
        });
    },

    getIPFromTaobao() {
      window.ipCallback = (data) => {
        var ip = data.ip;
        this.ipDataCards[1].source = "TaoBao";
        this.fetchIPDetails(1, ip);
        delete window.ipCallback; // 清理
      };
      var script = document.createElement("script");
      script.src = "https://www.taobao.com/help/getip.php?callback=ipCallback";
      document.head.appendChild(script);
      // 清理
      document.head.removeChild(script);
    },

    getIPFromCloudflare_V4() {
      fetch("https://1.0.0.1/cdn-cgi/trace")
        .then((response) => response.text())
        .then((data) => {
          const lines = data.split("\n");
          const ipLine = lines.find((line) => line.startsWith("ip="));
          if (ipLine) {
            const ip = ipLine.split("=")[1];
            this.fetchIPDetails(2, ip);
          }
        })
        .catch((error) => {
          console.error("Error fetching IP from Cloudflare:", error);
          this.ipDataCards[2].ip = this.currentTexts.ipInfos.IPv4Error;
        });
    },

    getIPFromCloudflare_V6() {
      fetch("https://[2606:4700:4700::1111]/cdn-cgi/trace")
        .then((response) => response.text())
        .then((data) => {
          const lines = data.split("\n");
          const ipLine = lines.find((line) => line.startsWith("ip="));
          if (ipLine) {
            const ip = ipLine.split("=")[1];
            this.fetchIPDetails(3, ip);
          }
        })
        .catch((error) => {
          console.error("Error fetching IP from Cloudflare:", error);
          this.ipDataCards[3].ip = this.currentTexts.ipInfos.IPv6Error;
        });
    },
    getIPFromIpify_V4() {
      fetch("https://api4.ipify.org?format=json")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.fetchIPDetails(4, data.ip);
        })
        .catch((error) => {
          console.error("Error fetching IPv4 address from ipify:", error);
          this.ipDataCards[4].ip = this.currentTexts.ipInfos.IPv4Error;
        });
    },
    getIPFromIpify_V6() {
      fetch("https://api6.ipify.org?format=json")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.fetchIPDetails(5, data.ip);
        })
        .catch((error) => {
          console.error("Error fetching IPv6 address from ipify:", error);
          this.ipDataCards[5].ip = this.currentTexts.ipInfos.IPv6Error;
        });
    },
    async fetchIPDetails(cardIndex, ip) {
      const card = this.ipDataCards[cardIndex];
      try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await response.json();
        if (data.error) {
          throw new Error(data.reason);
        }
        card.ip = ip;
        card.country_name = data.country_name || "";
        card.country_code = data.country || "";
        card.region = data.region || "";
        card.city = data.city || "";
        card.latitude = data.latitude || "";
        card.longitude = data.longitude || "";
        card.isp = data.org || "";
        card.asn = data.asn || "";

        // 构造 AS Number 的链接
        if (card.asn === "") {
          card.asnlink = false;
          card.mapUrl = "";
        } else {
          card.asnlink = `https://radar.cloudflare.com/traffic/${card.asn}`;
          card.mapUrl = `https://dev.virtualearth.net/REST/v1/Imagery/Map/Road/${card.latitude},${card.longitude}/5?mapSize=800,640&pp=${card.latitude},${card.longitude};66&key=${this.bingMapAPIKEY}&fmt=jpeg&dpi=Large&c=${this.bingMapLanguage}`;

          // 可选改成 Google Maps 内嵌 iFrame
          // card.mapUrl = `https://www.google.com/maps?q=${card.latitude},${card.longitude}&z=2&output=embed`;
        }
      } catch (error) {
        console.error("Get IP error:", error);
        // 设置错误信息或保持字段为空
        card.mapUrl = "";
      }
    },
    refreshCard(card) {
      // 清空卡片数据
      this.clearCardData(card);
      switch (card.source) {
        case "Cloudflare IPv4":
          this.getIPFromCloudflare_V4(card);
          break;
        case "Cloudflare IPv6":
          this.getIPFromCloudflare_V6(card);
          break;
        case "IPify IPv4":
          this.getIPFromIpify_V4(card);
          break;
        case "IPify IPv6":
          this.getIPFromIpify_V6(card);
          break;
        case "Upai":
          this.getIPFromUpai(card);
          break;
        case "TaoBao":
          this.getIPFromTaobao(card);
          break;
        default:
          console.error("Undefind Source:", card.source);
      }
    },

    clearCardData(card) {
      card.ip = "";
      card.country_name = "";
      card.country_code = "";
      card.region = "";
      card.city = "";
      card.latitude = "";
      card.longitude = "";
      card.asn = "";
      card.isp = "";
      card.mapUrl = "res/defaultMap.jpg";
    },

    toggleMaps() {
      this.isMapShown = !this.isMapShown;
      this.ipDataCards.forEach((card) => {
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

    checkConnectivityHandler(test, isAlertToShow) {
      const beginTime = +new Date();
      test.status = this.currentTexts.connectivity.checking;
      var img = new Image();
      var timeout = setTimeout(() => {
        test.status = this.currentTexts.connectivity.StatusUnavailable;
        if (test.id === "google" && isAlertToShow) {
          this.alertStyle = "text-danger";
          this.alertMessage = this.currentTexts.alert.OhNo_Message;
          this.alertTitle = this.currentTexts.alert.OhNo;
          this.alertToShow = true;
        }
      }, 3 * 1000);

      img.onload = () => {
        clearTimeout(timeout);
        test.status =
          this.currentTexts.connectivity.StatusAvailable +
          ` ( ${+new Date() - beginTime} ms )`;
        if (test.id === "google" && isAlertToShow) {
          this.alertStyle = "text-success";
          this.alertMessage = this.currentTexts.alert.Congrats_Message;
          this.alertTitle = this.currentTexts.alert.Congrats;
          this.alertToShow = true;
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        test.status = this.currentTexts.connectivit.StatusUnavailable;
        if (test.id === "google" && isAlertToShow) {
          this.alertStyle = "text-danger";
          this.alertMessage = this.currentTexts.alert.OhNo_Message;
          this.alertTitle = this.currentTexts.alert.OhNo;
          this.alertToShow = true;
        }
      };

      img.src = `${test.url}${Date.now()}`;
    },

    checkAllConnectivity(isAlertToShow) {
      connectivityTests.forEach((test) => {
        this.checkConnectivityHandler(test, isAlertToShow);
      });
      if (isAlertToShow) {
        setTimeout(() => {
          this.showToast();
        }, 3500);
      }
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
        this.modalQueryError = "";
        this.modalQueryResult = null;
        await this.fetchIPForModal(this.inputIP);
      } else {
        this.modalQueryError = this.currentTexts.ipcheck.Error;
        this.modalQueryResult = null;
      }
    },
    isValidIP(ip) {
      const ipv4Pattern =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Pattern =
        /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;
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
          country_name: data.country_name || "",
          country_code: data.country_code || "",
          region: data.region || "",
          city: data.city || "",
          latitude: data.latitude || "",
          longitude: data.longitude || "",
          isp: data.org || "",
          asn: data.asn || "",
          asnlink: data.asn
            ? `https://radar.cloudflare.com/traffic/${data.asn}`
            : false,
          mapUrl:
            data.latitude && data.longitude
              ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=2&output=embed`
              : "",
        };
      } catch (error) {
        console.error("获取 IP 详情时出错:", error);
        this.modalQueryError = error.message;
      }
    },
    resetModalData() {
      this.inputIP = "";
      this.modalQueryResult = null;
      this.modalQueryError = "";
      if (this.bingMapAPIKEYError) {
        this.inputBingMapAPIKEY = "";
      }
      this.bingMapAPIKEYError = false;

    },
    async checkSTUNServer(stun) {
      try {
        const servers = { iceServers: [{ urls: stun.url }] };
        const pc = new RTCPeerConnection(servers);
        let candidateReceived = false;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidateReceived = true;
            const candidate = event.candidate.candidate;
            const ipMatch =
              /(\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b)|([0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(
                candidate
              );
            if (ipMatch) {
              stun.ip = ipMatch[0];
              pc.close();
            }
          }
        };

        pc.createDataChannel("");
        await pc.createOffer().then((offer) => pc.setLocalDescription(offer));

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
        console.error("STUN Server Test Error:", error);
        stun.ip = "测试超时或数据出错";
      }
    },

    checkAllWebRTC() {
      this.stunServers.forEach((stun) => {
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
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          if (data.dns && "geo" in data.dns && "ip" in data.dns) {
            const geoSplit = data.dns.geo.split(" - ");
            this.leakTest[index].geo = geoSplit[0];
            this.leakTest[index].ip = data.dns.ip;
          } else {
            console.error("Unexpected data structure:", data);
          }
        })
        .catch((error) => {
          console.error("Error fetching leak test data:", error);
          this.leakTest[index].geo = this.currentTexts.dnsleaktest.StatusError;
          this.leakTest[index].ip = this.currentTexts.dnsleaktest.StatusError;
        });
    },

    fetchLeakTestSfSharkCom(index, key) {
      const urlString = this.generate14DigitString();
      const url = `https://${urlString}.ipv4.surfsharkdns.com`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          // 获取 data 对象中的指定键
          const getKey = Object.keys(data)[key];
          const keyEntry = data[getKey];

          if (keyEntry && keyEntry.Country && keyEntry.IP) {
            this.leakTest[index].geo = keyEntry.Country;
            this.leakTest[index].ip = keyEntry.IP;
          } else {
            console.error("Unexpected data structure:", data);
          }
        })
        .catch((error) => {
          console.error("Error fetching leak test data:", error);
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
      this.PWAColor();
    },
    updateBodyClass() {
      if (this.isDarkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    },
    checkSystemDarkMode() {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
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
      this.currentLanguage = this.currentLanguage === "en" ? "cn" : "en";
      this.updateTexts();
    },
    checkBrowserLanguage() {
      const browserLanguage = navigator.language || navigator.userLanguage;
      if (browserLanguage.includes("zh")) {
        this.currentLanguage = "cn";
        this.bingMapLanguage = "zh";
      } else {
        this.currentLanguage = "en";
        this.bingMapLanguage = "en";
      }
    },
    updatePageTitle(lang) {
      document.title = this.currentTexts.page.title;
    },
    // 更新语言
    updateTexts() {
      this.currentTexts = this.currentLanguage === "en" ? textEN : textCN;
    },
    // 语言补丁，弥补初始化时的翻译延迟
    langPatch() {
      connectivityTests.forEach((test) => {
        test.status = this.currentTexts.connectivity.StatusWait;
      });
      this.stunServers.forEach((server) => {
        server.ip = this.currentTexts.webrtc.StatusWait;
      });
      let count = 1;
      this.leakTest.forEach((server) => {
        server.name = this.currentTexts.dnsleaktest.Name + " " + count;
        count++;
        server.geo = this.currentTexts.dnsleaktest.StatusWait;
        server.ip = this.currentTexts.dnsleaktest.StatusWait;
      });
    },
    // 信息遮罩
    toggleInfoMask() {
      // this.isInfoMasked = !this.isInfoMasked;
      if (this.infoMaskLevel === 0) {
        this.originipDataCards = JSON.parse(JSON.stringify(this.ipDataCards));
        this.originstunServers = JSON.parse(JSON.stringify(this.stunServers));
        this.originleakTest = JSON.parse(JSON.stringify(this.leakTest));
        this.infoMask();
        this.alertStyle = "text-warning";
        this.alertMessage = this.currentTexts.alert.maskedInfoMessage_1;
        this.alertTitle = this.currentTexts.alert.maskedInfoTitle_1;
        this.alertToShow = true;
        this.showToast();
        // this.isInfoMasked = true;
      } else if (this.infoMaskLevel === 1) {
        this.infoMask();
        this.alertStyle = "text-success";
        this.alertMessage = this.currentTexts.alert.maskedInfoMessage;
        this.alertTitle = this.currentTexts.alert.maskedInfoTitle;
        this.alertToShow = true;
        this.showToast();
        // this.isInfoMasked = true;
      } else {
        this.infoUnmask();
        this.alertStyle = "text-danger";
        this.alertMessage = this.currentTexts.alert.unmaskedInfoMessage;
        this.alertTitle = this.currentTexts.alert.unmaskedInfoTitle;
        this.alertToShow = true;
        this.showToast();
        // this.isInfoMasked = false;
      }
    },
    infoMask() {
      if (this.infoMaskLevel === 0) {
        this.ipDataCards.forEach((card) => {
          card.ip = "8.8.8.8";
        });
        this.stunServers.forEach((server) => {
          server.ip = "100.100.200.100";
        });
        this.leakTest.forEach((server) => {
          server.ip = "12.34.56.78";
        }
        );
        this.infoMaskLevel = 1;
      } else if (this.infoMaskLevel === 1) {
        this.ipDataCards.forEach((card) => {
          card.country_name = "United States";
          card.country_code = "US";
          card.region = "California";
          card.city = "Mountain View";
          card.latitude = "37.40599";
          card.longitude = "-122.078514";
          card.isp = "Google LLC";
          card.asn = "AS15169";
          card.mapUrl = "res/defaultMap.jpg";
        });
        this.leakTest.forEach((server) => {
          server.geo = "United States";
        });
        this.infoMaskLevel = 2;
      }
    },
    infoUnmask() {
      this.ipDataCards = JSON.parse(JSON.stringify(this.originipDataCards));
      this.stunServers = JSON.parse(JSON.stringify(this.originstunServers));
      this.leakTest = JSON.parse(JSON.stringify(this.originleakTest));
      this.infoMaskLevel = 0;
    },

    // Bing Map 相关
    addBingMapKey() {
      if (this.isValidKey(this.inputBingMapAPIKEY)) {
        this.bingMapAPIKEY = this.inputBingMapAPIKEY;
        this.ipDataCards.forEach((card) => {
          if (card.latitude && card.longitude) {
            card.mapUrl = `https://dev.virtualearth.net/REST/v1/Imagery/Map/Road/${card.latitude},${card.longitude}/5?mapSize=800,640&pp=${card.latitude},${card.longitude};66&key=${this.bingMapAPIKEY}&fmt=jpeg&dpi=Large&c=${this.bingMapLanguage}`;
          }
        }
        );
        const modalElement = document.getElementById('addBingMapKey');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
          modalInstance.hide();
        }
        this.isMapShown = true;
      } else {
        this.bingMapAPIKEYError = true;
      }
    },
    removeBingMapKey() {
      this.bingMapAPIKEY = "";
      this.inputBingMapAPIKEY = "";
      localStorage.removeItem("bingMapAPIKEY");
      const modalElement = document.getElementById('addBingMapKey');
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      if (modalInstance) {
        modalInstance.hide();
      }
      this.isMapShown = false;
    },
    isValidKey(key) {
      const keyPattern = /^[A-Za-z0-9_-]{64}$/;
      return keyPattern.test(key);
    },
    // PWA 颜色
    PWAColor() {
      if (this.isDarkMode) {
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#171a1d');
        document.querySelector('meta[name="background-color"]').setAttribute('content', '#212529');
      } else {
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#f8f9fa');
        document.querySelector('meta[name="background-color"]').setAttribute('content', '#ffffff');
      }
    },
    // Logo 点击事件
    handleLogoClick() {
      if (window.scrollY === 0) {
        this.refreshEverything();
        setTimeout(() => {
          this.alertStyle = "text-success";
          this.alertMessage = this.currentTexts.alert.refreshEverythingMessage;
          this.alertTitle = this.currentTexts.alert.refreshEverythingTitle;
          this.alertToShow = true;
          this.showToast();
        }, 500);
      }
    },
    refreshEverything() {
      this.checkAllIPs();
      setTimeout(() => {
        this.checkAllConnectivity(0);
      }, 2000);
      setTimeout(() => {
        this.checkAllWebRTC();
      }, 4000);
      setTimeout(() => {
        this.checkAllDNSLeakTest();
      }, 3000);
    }

  },

  created() {
    this.checkBrowserLanguage();
    this.updateTexts();
    this.langPatch();
    if (localStorage.getItem("bingMapAPIKEY") && this.bingMapAPIKEY === "") {
      this.bingMapAPIKEY = localStorage.getItem("bingMapAPIKEY");
    }

    if (this.bingMapAPIKEY) {
      this.inputBingMapAPIKEY = this.bingMapAPIKEY;
    }
    if (!this.bingMapAPIKEY) {
      this.isMapShown = false;
    } else if (localStorage.getItem("isMapShown")) {
      this.isMapShown = localStorage.getItem("isMapShown") === "true";
    }
    this.isMobile = window.innerWidth < 768;
    this.isCardsCollapsed = this.isMobile;
    // this.handleResize();
    window.addEventListener("resize", this.handleResize);
  },
  destroyed() {
    window.removeEventListener("resize", this.handleResize);
  },
  watch: {
    isMapShown(newVal) {
      localStorage.setItem("isMapShown", newVal);
    },
    bingMapAPIKEY(newVal) {
      localStorage.setItem("bingMapAPIKEY", newVal);
    },
  },
  mounted() {
    this.updatePageTitle(this.currentLanguage);
    this.checkSystemDarkMode();
    this.PWAColor();
    this.checkAllIPs();
    setTimeout(() => {
      this.checkAllConnectivity(1);
    }, 2500);
    setTimeout(() => {
      this.checkAllWebRTC();
    }, 4000);
    setTimeout(() => {
      this.checkAllDNSLeakTest();
    }, 2500);
    setTimeout(() => {
      this.checkAllConnectivity(0);
    }, 6000);
    setTimeout(() => {
      this.isInfosLoaded = true;
    }, 6000);
    const modalElement = document.getElementById("IPCheck");
    modalElement.addEventListener("hidden.bs.modal", this.resetModalData);
    const bingMapAPIKEYElement = document.getElementById("addBingMapKey");
    bingMapAPIKEYElement.addEventListener("hidden.bs.modal", this.resetModalData);
  },
});

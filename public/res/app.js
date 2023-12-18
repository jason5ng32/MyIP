import textCN from "../contents/lang_cn.js";
import textEN from "../contents/lang_en.js";
import connectivityTests from "../contents/connectivityTests.js";
import stunServers from "../contents/stunServers.js";
import ipDataCards from "../contents/ipDataCards.js";
import leakTest from "../contents/leakTest.js";
import speedTest from "../contents/speedTest.js";
import { triggerSpeedTest, resetSpeedTest, engine } from "../res/cfSpeedTest.js";
import { mappingKeys, navigateCards, keyMap } from "./shortcut.js";
import config from "../res/ga.js";

Vue.config.productionTip = false;

(function () {
  const scriptTag = document.createElement("script");
  scriptTag.async = true;
  scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${config.GOOGLE_ANALYTICS_ID}`;
  document.head.appendChild(scriptTag);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", config.GOOGLE_ANALYTICS_ID);
})();

new Vue({
  el: "#app",
  data: {

    isEnvBingMapKey: false,
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
    isCardsCollapsed: JSON.parse(localStorage.getItem('isCardsCollapsed')) || false,
    isInfoMasked: false,
    isInfosLoaded: false,
    infoMaskLevel: 0,
    ipDataCache: new Map(),
    speedTestStatus: "idle",
    copiedStatus: {},

    // from contents
    connectivityTests,
    originconnectivityTests: {},
    ipDataCards,
    originipDataCards: {},
    stunServers,
    originstunServers: {},
    leakTest,
    speedTest,
    originleakTest: {},

    // keyMap
    keyMap,
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
      card.ip = ip;

      // 检查缓存中是否已有该 IP 的数据
      if (this.ipDataCache.has(ip)) {
        // 使用缓存的数据填充卡片
        const cachedData = this.ipDataCache.get(ip);
        Object.assign(card, cachedData);
        return;
      }

      // 尝试从多个不同的源获取数据
      const sources = [
        { url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
        { url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
        { url: `https://api.ipcheck.ing/json/${ip}`, transform: this.transformDataFromIPcheck }
      ];

      for (const source of sources) {
        try {
          const response = await fetch(source.url);
          const data = await response.json();

          // 根据数据源进行数据转换
          const cardData = source.transform(data);

          if (cardData) {
            Object.assign(card, cardData);
            this.ipDataCache.set(ip, cardData);
            break;
          }
        } catch (error) {
          console.error("Error fetching IP details:", error);
        }
      }
    },

    transformDataFromIPapi(data) {
      if (data.error) {
        throw new Error(data.reason);
      }

      return {
        country_name: data.country_name || "",
        country_code: data.country || "",
        region: data.region || "",
        city: data.city || "",
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        isp: data.org || "",
        asn: data.asn || "",
        asnlink: data.asn ? `https://radar.cloudflare.com/traffic/${data.asn}` : false,
        mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}` : ""
      };
    },

    transformDataFromIPcheck(data) {
      if (data.status !== "success") {
        throw new Error("IP lookup failed");
      }

      return {
        country_name: data.country || "",
        country_code: data.countryCode || "",
        region: data.regionName || "",
        city: data.city || "",
        latitude: data.lat || "",
        longitude: data.lon || "",
        isp: data.isp || "",
        asn: data.as ? data.as.split(" ")[0] : "",
        asnlink: data.as ? `https://radar.cloudflare.com/traffic/${data.as.split(" ")[0]}` : false,
        mapUrl: data.lat && data.lon ? `/api/map?latitude=${data.lat}&longitude=${data.lon}&language=${this.bingMapLanguage}` : ""
      };
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
      card.mapUrl = "res/img/defaultMap.jpg";
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
        this.getIPFromUpai();
      }, 100);
      setTimeout(() => {
        this.getIPFromTaobao();
      }, 1000);
      setTimeout(() => {
        this.getIPFromCloudflare_V4();
      }, 2000);
      setTimeout(() => {
        this.getIPFromCloudflare_V6();
      }, 100);
      setTimeout(() => {
        this.getIPFromIpify_V4();
      }, 4000);
      setTimeout(() => {
        this.getIPFromIpify_V6();
      }, 1000);
    },

    // 检查网络连通性
    checkConnectivityHandler(test, isAlertToShow, onTestComplete) {
      const beginTime = +new Date();

      var img = new Image();
      var timeout = setTimeout(() => {
        test.status = this.currentTexts.connectivity.StatusUnavailable;
        onTestComplete(false);
      }, 3 * 1000);

      img.onload = () => {
        clearTimeout(timeout);
        test.status =
          this.currentTexts.connectivity.StatusAvailable +
          ` ( ${+new Date() - beginTime} ms )`;
        onTestComplete(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        test.status = this.currentTexts.connectivity.StatusUnavailable;
        onTestComplete(false);
      };

      img.src = `${test.url}${Date.now()}`;
    },

    checkAllConnectivity(isAlertToShow, isRefresh) {

      if (isRefresh) {
        connectivityTests.forEach((test) => {
          test.status = this.currentTexts.connectivity.StatusWait;
        });
      }
      let totalTests = connectivityTests.length;
      let successCount = 0;
      let completedCount = 0;

      const onTestComplete = (isSuccess) => {
        if (isSuccess) {
          successCount++;
        }
        completedCount++;

        // 只有当所有测试都完成时才做出最终判断
        if (completedCount === totalTests) {
          this.alertToShow = true;
          if (successCount === totalTests) {
            this.updateConnectivityAlert(true, "success");
          } else {
            this.updateConnectivityAlert(true, "error");
          }
        }
      };

      connectivityTests.forEach((test) => {
        this.checkConnectivityHandler(test, isAlertToShow, onTestComplete);
      });

      if (isAlertToShow) {
        setTimeout(() => {
          this.showToast();
        }, 3500);
      }
    },

    updateConnectivityAlert(show, type) {
      this.alertToShow = show;
      if (type === "success") {
        this.alertStyle = "text-success";
        this.alertMessage = this.currentTexts.alert.Congrats_Message;
        this.alertTitle = this.currentTexts.alert.Congrats;
      } else {
        this.alertStyle = "text-danger";
        this.alertMessage = this.currentTexts.alert.OhNo_Message;
        this.alertTitle = this.currentTexts.alert.OhNo;
      }
    },

    // 通知气泡
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

    // 查询 IP 信息
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
      const sources = [
        { url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
        { url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
        { url: `https://api.ipcheck.ing/json/${ip}`, transform: this.transformDataFromIPcheck }
      ];

      for (const source of sources) {
        try {
          const response = await fetch(source.url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (data.error) {
            throw new Error(data.reason || "IP lookup failed");
          }

          // 使用对应的转换函数更新 modalQueryResult
          this.modalQueryResult = source.transform(data);
          break;
        } catch (error) {
          console.error("Error fetching IP details:", error);
        }
      }
    },

    // 检查 WebRTC
    async checkSTUNServer(stun) {
      try {
        const servers = { iceServers: [{ urls: stun.url }] };
        const pc = new RTCPeerConnection(servers);
        let candidateReceived = false;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidateReceived = true;
            const candidate = event.candidate.candidate;
            const ipMatch = /([0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f]{0,4}(:[0-9a-f]{1,4}){0,6}::[0-9a-f]{0,4}|::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}|[0-9]{1,3}(\.[0-9]{1,3}){3})/i.exec(candidate);
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
              reject(new Error("Stun Server Test Timeout"));
            } else {
              resolve();
            }
          }, 5000);
        });
      } catch (error) {
        console.error("STUN Server Test Error:", error);
        stun.ip = this.currentTexts.webrtc.StatusError;
      }
    },

    checkAllWebRTC(isRefresh) {
      this.stunServers.forEach((server) => {
        if (isRefresh) {
          server.ip = this.currentTexts.webrtc.StatusWait;
        }
        this.checkSTUNServer(server);
      });
    },


    // DNS 泄漏测试
    generate32DigitString() {
      const unixTime = Date.now().toString();
      const fixedString = "jason5ng32";
      const randomString = Math.random().toString(36).substring(2, 11);

      return unixTime + fixedString + randomString;
    },

    generate14DigitString() {
      const fixedString = "jn32"; // 固定字符串
      const randomString = Math.random().toString(36).substring(2, 11);

      return fixedString + randomString;
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

    checkAllDNSLeakTest(isRefresh) {
      if (isRefresh) {
        this.leakTest.forEach((server) => {
          server.geo = this.currentTexts.dnsleaktest.StatusWait;
          server.ip = this.currentTexts.dnsleaktest.StatusWait;
        });
      }
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

    // 黑暗模式
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

    // 手机简洁模式
    handleResize() {
      this.isMobile = window.innerWidth < 768;
    },
    toggleCollapse() {
      this.isCardsCollapsed = !this.isCardsCollapsed;
    },

    // 更新语言
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

    // 手动设置语言
    getLanguageFromURL() {
      const urlParams = new URLSearchParams(window.location.search);
      const language = urlParams.get("hl");
      if (language === "zh" || language === "cn") {
        this.currentLanguage = "cn";
        this.updateTexts();
        return true;
      } else if (language === "en") {
        this.currentLanguage = "en";
        this.updateTexts();
        return true;
      }
      return false;
    },
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
      } else if (this.infoMaskLevel === 1) {
        this.infoMask();
        this.alertStyle = "text-success";
        this.alertMessage = this.currentTexts.alert.maskedInfoMessage;
        this.alertTitle = this.currentTexts.alert.maskedInfoTitle;
        this.alertToShow = true;
        this.showToast();
      } else {
        this.infoUnmask();
        this.alertStyle = "text-danger";
        this.alertMessage = this.currentTexts.alert.unmaskedInfoMessage;
        this.alertTitle = this.currentTexts.alert.unmaskedInfoTitle;
        this.alertToShow = true;
        this.showToast();
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
        });
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
          card.mapUrl = "res/img/defaultMap.jpg";
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
    validateBingMapKey() {
      fetch('/api/validate-map-key')
        .then(response => response.json())
        .then(data => {
          this.isEnvBingMapKey = data.isValid;
          if (!this.isEnvBingMapKey) {
            this.isMapShown = false;
          } else if (localStorage.getItem("isMapShown")) {
            this.isMapShown = localStorage.getItem("isMapShown") === "true";
          }
        })
        .catch(error => {
          console.error('Error validating Bing Map Key:', error);
          this.isEnvBingMapKey = false;
          this.isMapShown = false;
        });
    },

    // PWA 颜色
    PWAColor() {
      if (this.isDarkMode) {
        document
          .querySelector('meta[name="theme-color"]')
          .setAttribute("content", "#171a1d");
        document
          .querySelector('meta[name="background-color"]')
          .setAttribute("content", "#212529");
      } else {
        document
          .querySelector('meta[name="theme-color"]')
          .setAttribute("content", "#f8f9fa");
        document
          .querySelector('meta[name="background-color"]')
          .setAttribute("content", "#ffffff");
      }
    },

    // open or close modal
    openModal(id) {
      const modalElement = document.getElementById(id);
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      if (modalInstance) {
        modalInstance.show();
      }
    },
    closeModal(id) {
      const modalElement = document.getElementById(id);
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      if (modalInstance) {
        modalInstance.hide();
      }
    },

    setupModalFocus() {
      const modals = document.querySelectorAll(".modal");
      modals.forEach((modal) => {
        modal.addEventListener("shown.bs.modal", () => {
          this.$nextTick(() => {
            const inputElement = modal.querySelector(".form-control");
            if (inputElement) {
              inputElement.focus();
            }
          });
        });
      });
    },
    // scroll to element
    scrollToElement(el, offset = 0) {
      const element = typeof el === "string" ? document.getElementById(el) : el;
      const y = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    },
    // Logo 点击事件
    handleLogoClick() {
      if (window.scrollY === 0) {
        this.refreshEverything();
      }
    },
    refreshEverything() {
      this.checkAllIPs();
      setTimeout(() => {
        this.checkAllConnectivity(false, true);
      }, 2000);
      setTimeout(() => {
        this.checkAllWebRTC(true);
      }, 4000);
      setTimeout(() => {
        this.checkAllDNSLeakTest(true);
      }, 3000);
      setTimeout(() => {
        this.alertStyle = "text-success";
        this.alertMessage = this.currentTexts.alert.refreshEverythingMessage;
        this.alertTitle = this.currentTexts.alert.refreshEverythingTitle;
        this.alertToShow = true;
        this.showToast();
      }, 500);
      this.infoMaskLevel = 0;
    },
    hideLoading() {
      var loadingElement = document.getElementById("loading");
      if (loadingElement) {
        loadingElement.classList.add("hidden");
      }
    },

    // Speed Test
    updateSpeedTestResults(results) {
      const summary = results.getSummary();

      this.speedTest.downloadSpeed = parseFloat((summary.download / 1000000).toFixed(2));
      this.speedTest.uploadSpeed = parseFloat((summary.upload / 1000000).toFixed(2));
      this.speedTest.latency = parseFloat(summary.latency.toFixed(2));
      this.speedTest.jitter = parseFloat(summary.jitter.toFixed(2));
    },

    updateSpeedTestColor(status) {
      switch (status) {
        case 'idle':
          return 'text-secondary';
        case 'running':
          return 'text-info';
        case 'finished':
          return 'text-success';
        case 'error':
          return 'text-danger';
        default:
          return '';
      }
    },

    startSpeedTest() {
      const newEngine = resetSpeedTest();
      newEngine.onRunningChange = running => {
        this.speedTestStatus = "running";
        this.speedTest.downloadSpeed = 0;
        this.speedTest.uploadSpeed = 0;
        this.speedTest.latency = 0;
        this.speedTest.jitter = 0;
      };

      newEngine.onResultsChange = ({ type }) => {
        const rawData = newEngine.results.raw;

        // 进度条
        let progress = 0;
        const progressPerStage = 100 / 3;  // 将总进度平均分配到每个阶段

        if (rawData.download && rawData.download.started) {
          progress += rawData.download.finished ? progressPerStage : progressPerStage / 2;
        }
        if (rawData.upload && rawData.upload.started) {
          progress += rawData.upload.finished ? progressPerStage : progressPerStage / 2;
        }
        if (rawData.latency && rawData.latency.started) {
          progress += rawData.latency.finished ? progressPerStage : progressPerStage / 2;
        }

        // 确保进度不超过100%
        progress = Math.min(progress, 100);


        // 更新进度条
        const progressBar = document.getElementById('speedtest-progress');
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);

        // 更新下载速度
        if (rawData.download && rawData.download.results) {
          const downloadKeys = Object.keys(rawData.download.results);
          if (downloadKeys.length > 0) {
            const lastDownloadKey = downloadKeys[downloadKeys.length - 1];
            const downloadTimings = rawData.download.results[lastDownloadKey].timings;
            if (downloadTimings.length > 0) {
              const latestDownload = downloadTimings[downloadTimings.length - 1];
              const newDownloadSpeed = parseFloat((latestDownload.bps / 1000000).toFixed(2));
              if (newDownloadSpeed > this.speedTest.downloadSpeed) {
                this.speedTest.downloadSpeed = newDownloadSpeed;
              }
            }
          }
        }
        // 更新上传速度
        if (rawData.upload && rawData.upload.results) {
          const uploadKeys = Object.keys(rawData.upload.results);
          if (uploadKeys.length > 0) {
            const lastUploadKey = uploadKeys[uploadKeys.length - 1];
            const uploadTimings = rawData.upload.results[lastUploadKey].timings;
            if (uploadTimings.length > 0) {
              const latestUpload = uploadTimings[uploadTimings.length - 1];
              const newUploadSpeed = parseFloat((latestUpload.bps / 1000000).toFixed(2));
              if (newUploadSpeed > this.speedTest.uploadSpeed) {
                this.speedTest.uploadSpeed = newUploadSpeed;
              }
            }
          }
        }
        // 更新延迟
        if (rawData.latency && rawData.latency.results && rawData.latency.results.timings && rawData.latency.results.timings.length > 0) {
          const latencyTimings = rawData.latency.results.timings;
          const latestLatency = latencyTimings[latencyTimings.length - 1].ping;
          const newLatency = parseFloat(latestLatency.toFixed(2));
          if (newLatency < this.speedTest.latency || this.speedTest.latency === 0) {
            this.speedTest.latency = newLatency;
          }
        }
      };

      newEngine.onFinish = results => {
        this.speedTestStatus = "finished";
        this.updateSpeedTestResults(results);
        const scores = results.getScores();

        // 更新 Vue 实例的数据属性
        this.speedTest.streamingScore = scores.streaming.points;
        this.speedTest.gamingScore = scores.gaming.points;
        this.speedTest.rtcScore = scores.rtc.points;
      };

      newEngine.onError = (e) => {
        if (typeof e === 'string' && !e.includes("ICE")) {
          this.speedTestStatus = "error";
        }
        console.error('Speed Test Error: ', e);
      };

      triggerSpeedTest();
    },
    refreshstartSpeedTest() {
      if (this.speedTestStatus !== "running") {
        this.startSpeedTest();
      }
    },
    // 复制 IP 地址
    copyToClipboard(ip, id) {
      navigator.clipboard.writeText(ip).then(() => {
        this.$set(this.copiedStatus, id, true);
        // 设置定时器在 5 秒后重置状态
        setTimeout(() => {
          this.$set(this.copiedStatus, id, false);
        }, 5000);
      }).catch(err => {
        console.error('Copy error', err);
      });
    },
  },

  created() {
    const isLanguageSet = this.getLanguageFromURL();
    if (!isLanguageSet) {
      this.checkBrowserLanguage();
    }
    this.updateTexts();
    this.langPatch();
    this.validateBingMapKey();
    this.isMobile = window.innerWidth < 768;
    window.addEventListener("resize", this.handleResize);
  },
  destroyed() {
    window.removeEventListener("resize", this.handleResize);
  },
  watch: {
    isMapShown(newVal) {
      localStorage.setItem("isMapShown", JSON.stringify(newVal));
    },
    isCardsCollapsed(newVal) {
      localStorage.setItem('isCardsCollapsed', JSON.stringify(newVal));
    },
  },
  mounted() {
    this.updatePageTitle(this.currentLanguage);
    this.checkSystemDarkMode();
    this.PWAColor();
    this.checkAllIPs();
    this.hideLoading();
    this.setupModalFocus();
    mappingKeys(
      {
        keys: "g",
        action() {
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        description: this.currentTexts.shortcutKeys.GoToTop,
      },
      {
        keys: 'j',
        action: () => navigateCards('down'),
        description: this.currentTexts.shortcutKeys.GoNext
      },
      {
        keys: 'k',
        action: () => navigateCards('up'),
        description: this.currentTexts.shortcutKeys.GoPrevious
      },
      {
        keys: "G",
        action() {
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
        },
        description: this.currentTexts.shortcutKeys.GoToBottom,
      },
      {
        keys: "D",
        action: this.toggleDarkMode,
        description: this.currentTexts.shortcutKeys.ToggleDarkMode,
      },
      {
        keys: "R",
        action: this.refreshEverything,
        description: this.currentTexts.shortcutKeys.RefreshEverything,
      },
      {
        keys: "([1-6])",
        type: "regex",
        action: (num) => {
          const card = this.ipDataCards[num - 1];
          const [el] = this.$refs[card.id];
          this.scrollToElement(el, 60);
          this.refreshCard(card);
        },
        description: this.currentTexts.shortcutKeys.RefreshIPCard,
      },
      {
        keys: "c",
        action: () => {
          this.scrollToElement("Connectivity", 80);
          this.checkAllConnectivity(false, true);
        },
        description: this.currentTexts.shortcutKeys.RefreshConnectivityTests,
      },
      {
        keys: "w",
        action: () => {
          this.scrollToElement("WebRTC", 80);
          this.checkAllWebRTC(true);
        },
        description: this.currentTexts.shortcutKeys.RefreshWebRTC,
      },
      {
        keys: "d",
        action: () => {
          this.scrollToElement("DNSLeakTest", 80);
          this.checkAllDNSLeakTest(true);
        },
        description: this.currentTexts.shortcutKeys.RefreshDNSLeakTest,
      },
      {
        keys: "s",
        action: () => {
          this.scrollToElement("SpeedTest", 80);
          this.refreshstartSpeedTest();
        },
        description: this.currentTexts.shortcutKeys.StartSpeedTest,
      },
      {
        keys: "m",
        action: () => {
          if (this.isEnvBingMapKey) {
            window.scrollTo({ top: 0, behavior: "smooth" });
            this.toggleMaps();
          }
        },
        description: this.currentTexts.shortcutKeys.ToggleMaps,
      },
      {
        keys: "q",
        action: () => {
          this.openModal("IPCheck");
        },
        description: this.currentTexts.shortcutKeys.IPCheck,
      },
      {
        keys: "h",
        action: () => {
          this.isInfosLoaded && this.toggleInfoMask();
        },
        description: this.currentTexts.shortcutKeys.ToggleInfoMask,
      },

      // help
      {
        keys: "?",
        action: () => {
          this.openModal("helpModal");
        },
        description: this.currentTexts.shortcutKeys.Help,
      }
    );
    this.keyMap = keyMap;
    setTimeout(() => {
      this.checkAllConnectivity(true, false);
    }, 2500);
    setTimeout(() => {
      this.checkAllWebRTC(false);
    }, 4000);
    setTimeout(() => {
      this.checkAllDNSLeakTest(false);
    }, 2500);
    setTimeout(() => {
      this.checkAllConnectivity(false, false);
    }, 6000);
    setTimeout(() => {
      this.isInfosLoaded = true;
    }, 6000);
    const modalElement = document.getElementById("IPCheck");
    modalElement.addEventListener("hidden.bs.modal", this.resetModalData);
  },
});

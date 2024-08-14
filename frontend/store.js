// store.js
import { defineStore } from 'pinia';

export const useMainStore = defineStore('main', {

  state: () => ({
    lang: 'en',
    mountingStatus: {
      ipcheck: false,
      connectivity: false,
      webrtc: false,
      dnsleaktest: false,
      speedtest: false,
      advancedtools: false,
    },
    loadingStatus: {
      ipcheck: false,
      connectivity: false,
      webrtc: false,
      dnsleaktest: false,
    },
    isDarkMode: false,
    isMobile: false,
    shouldRefreshEveryThing: false,
    allIPs: [],
    configs: {},
    userPreferences: {},
    alert: {
      alertToShow: false,
      alertStyle: "",
      alertMessage: "",
      alertTitle: "",
    },
    ipDBs: [
      { id: 0, text: 'IPCheck.ing', url: '/api/ipchecking?ip={{ip}}&lang={{lang}}', enabled: true },
      { id: 1, text: 'IPinfo.io', url: '/api/ipinfo?ip={{ip}}', enabled: true },
      { id: 2, text: 'IP-API.com', url: '/api/ipapicom?ip={{ip}}&lang={{lang}}', enabled: true },
      { id: 3, text: 'IPAPI.co', url: 'https://ipapi.co/{{ip}}/json/', enabled: true },
      { id: 4, text: 'KeyCDN', url: '/api/keycdn?ip={{ip}}', enabled: true },
      { id: 5, text: 'IP.SB', url: '/api/ipsb?ip={{ip}}', enabled: true },
      { id: 6, text: 'IPAPI.is', url: '/api/ipapiis?ip={{ip}}', enabled: true },
      { id: 7, text: 'MaxMind', url: '/api/maxmind?ip={{ip}}&lang={{lang}}', enabled: true },
    ],
  }),

  getters: {
    activeSources: (state) => state.ipDBs.filter(db => db.enabled),
    allHasLoaded: (state) => {
      return Object.values(state.loadingStatus).every(status => status);
    },
  },

  actions: {
    // 获取数据库的URL
    getDbUrl(id, ip, lang) {
      const db = this.ipDBs.find(d => d.id === id);
      if (!db) return null;
      return db.url.replace('{{ip}}', ip).replace('{{lang}}', lang || 'en');
    },
    // 从每个组件返回启动状态
    setMountingStatus(key, value) {
      this.mountingStatus[key] = value;
    },
    // 从每个组件返回加载状态
    setLoadingStatus(key, value) {
      this.loadingStatus[key] = value;
    },
    // 设置 Toast
    setAlert(alertToShow, alertStyle, alertMessage, alertTitle) {
      this.alert = { alertToShow, alertStyle, alertMessage, alertTitle };
    },
    // 从不同的组件收集合并 IP 数据
    updateAllIPs(payload) {
      const uniqueIPs = new Set([...this.allIPs, ...payload]);
      this.allIPs = Array.from(uniqueIPs);
    },
    // 设置移动模式
    setIsMobile(payload) {
      this.isMobile = payload;
    },
    // App.vue 和 Nav.vue 的通信辅助函数
    setRefreshEveryThing(payload) {
      this.shouldRefreshEveryThing = payload;
    },
    // 设置黑暗模式
    setDarkMode(value) {
      this.isDarkMode = value;
    },
    // 设置 IP 数据库的使能状态
    updateIPDBs({ id, enabled }) {
      const index = this.ipDBs.findIndex(db => db.id === id);
      if (index !== -1) {
        this.ipDBs[index].enabled = enabled;
      }
    },
    // 用户偏好设置
    setPreferences(userPreferences) {
      this.userPreferences = userPreferences;
      localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    },
    // 更新用户偏好设置
    updatePreference(key, value) {
      this.userPreferences[key] = value;
      localStorage.setItem('userPreferences', JSON.stringify(this.userPreferences));
    },
    // 从本地存储加载用户偏好设置
    loadPreferences() {
      const defaultPreferences = {
        theme: 'auto', // auto, light, dark
        connectivityAutoRefresh: false,
        showMap: false,
        simpleMode: false,
        autoStart: true,
        hideUnavailableIPStack: false,
        popupConnectivityNotifications: true,
        ipCardsToShow: 6,
        ipGeoSource: 0,
      };
      const storedPreferences = localStorage.getItem('userPreferences');
      let preferencesToStore;

      if (storedPreferences) {
        const currentPreferences = JSON.parse(storedPreferences);
        preferencesToStore = { ...defaultPreferences, ...currentPreferences };
      } else {
        preferencesToStore = defaultPreferences;
      }

      localStorage.setItem('userPreferences', JSON.stringify(preferencesToStore));
      this.setPreferences(preferencesToStore);
    },
    // 从服务器获取配置
    fetchConfigs() {
      fetch('/api/configs')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          this.configs = data;
        })
        .catch(error => console.error('Fetching configs failed: ', error));
    },
  }
});
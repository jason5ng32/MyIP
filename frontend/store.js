// store.js
import { defineStore } from 'pinia';

export const useMainStore = defineStore('main', {

  state: () => ({
    lang: 'en',
    isDarkMode: false,
    isMobile: false,
    shouldRefreshEveryThing: false,
    Global_ipDataCards: [],
    configs: {},
    userPreferences: {},
    alert: {
      alertToShow: false,
      alertStyle: "",
      alertMessage: "",
      alertTitle: "",
    },
    ipDBs: [
      { id: 0, text: 'IPCheck.ing', enabled: true },
      { id: 1, text: 'IPinfo.io', enabled: true },
      { id: 2, text: 'IP-API.com', enabled: true },
      { id: 3, text: 'IPAPI.co', enabled: true },
      { id: 4, text: 'KeyCDN', enabled: true },
      { id: 5, text: 'IP.SB', enabled: true },
      { id: 6, text: 'IPAPI.is', enabled: true },
    ],
  }),

  actions: {
    setAlert(alertToShow, alertStyle, alertMessage, alertTitle ) {
      this.alert = { alertToShow, alertStyle, alertMessage, alertTitle };
    },
    updateGlobalIpDataCards(payload) {
      const uniqueIPs = new Set([...this.Global_ipDataCards, ...payload]);
      this.Global_ipDataCards = Array.from(uniqueIPs);
    },
    setIsMobile(payload) {
      this.isMobile = payload;
    },
    setRefreshEveryThing(payload) {
      this.shouldRefreshEveryThing = payload;
    },
    setDarkMode(value) {
      this.isDarkMode = value;
    },
    updateIPDBs({ id, enabled }) {
      const index = this.ipDBs.findIndex(db => db.id === id);
      if (index !== -1) {
        this.ipDBs[index].enabled = enabled;
      }
    },
    setConfigs(config) {
      this.configs = config;
    },
    setPreferences(userPreferences) {
      this.userPreferences = userPreferences;
      localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    },
    updatePreference(key, value) {
      this.userPreferences[key] = value;
      localStorage.setItem('userPreferences', JSON.stringify(this.userPreferences));
    },
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
    fetchConfigs() {
      fetch('/api/configs')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          this.setConfigs(data);
        })
        .catch(error => console.error('Fetching configs failed: ', error));
    },
  }
});
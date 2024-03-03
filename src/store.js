// store.js
import { createStore } from 'vuex';

const store = createStore({
  state() {
    return {
      // 定义全局共享的状态
      inputBingMapAPIKEY: "",
      bingMapAPIKEYError: false,
      bingMapLanguage: "en",
      isDarkMode: false,
      isMobile: false,
      siteValidate: true,

      // 全局变量
      shouldRefreshEveryThing: false,
      Global_ipDataCards: [],
      ipGeoSource: 0,
    };
  },
  mutations: {
    toggleDarkMode(state) {
      state.isDarkMode = !state.isDarkMode;
    },
    updateGlobalIpDataCards(state, payload) {
      const uniqueIPs = new Set([...state.Global_ipDataCards, ...payload]);
      state.Global_ipDataCards = Array.from(uniqueIPs);
    },
    updateGlobalSiteValidate(state, payload) {
      state.siteValidate = payload;
    },
    setIsMobile(state, payload) {
      state.isMobile = payload;
    },
    setRefreshEveryThing(state, payload) {
      state.shouldRefreshEveryThing = payload;
    },
    SET_DARK_MODE(state, value) {
      state.isDarkMode = value;
    },
    SET_IP_GEO_SOURCE(state, value) {
      state.ipGeoSource = value;
    }
  },

  actions: {
    checkDarkMode({ commit }) {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      commit('SET_DARK_MODE', prefersDarkMode);
    },
  },

  getters: {
    isMobile(state) {
      return state.isMobile;
    }
  },
});

export default store;

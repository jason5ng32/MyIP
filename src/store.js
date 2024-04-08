// store.js
import { createStore } from 'vuex';

const store = createStore({
  state() {
    return {
      // 开关
      isDarkMode: false,
      isMobile: false,
      shouldRefreshEveryThing: false,
      // 数据
      Global_ipDataCards: [],
      ipGeoSource: 0,
      // 功能
      configs: {},
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
    },
    SET_CONFIGS(state, config) {
      state.configs = config;
    }
  },

  actions: {
    checkDarkMode({ commit }) {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      commit('SET_DARK_MODE', prefersDarkMode);
    },
    fetchConfigs({ commit }) {
      fetch('/api/configs')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          commit('SET_CONFIGS', data);
        })
        .catch(error => console.error('Fetching configs failed: ', error));
    }
  },

  getters: {
    isMobile(state) {
      return state.isMobile;
    }
  },
});

export default store;

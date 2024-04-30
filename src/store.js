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
      userPreferences: {},
    };
  },
  mutations: {
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
    },
    SET_PREFERENCES(state, userPreferences) {
      state.userPreferences = userPreferences;
      localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    },
    UPDATE_PREFERENCE(state, { key, value }) {
      state.userPreferences[key] = value;
      localStorage.setItem('userPreferences', JSON.stringify(state.userPreferences));
    }
  },

  actions: {

    // 加载用户偏好
    loadPreferences({ commit }) {
      const defaultPreferences = {
        theme: 'auto', // auto, light, dark
        connectivityAutoRefresh: false,
        showMap: false,
        simpleMode: false,
        autoStart: true,
        hideUnavailableIPStack: false,
        popupConnectivityNotifications: true,
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
      commit('SET_PREFERENCES', preferencesToStore);
    },

    // 更新用户偏好
    updatePreference({ commit }, { key, value }) {
      commit('UPDATE_PREFERENCE', { key, value });
    },

    // 获取后端配置
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
    },
    preferences(state) {
      return state.userPreferences;
    }
  },
});

export default store;

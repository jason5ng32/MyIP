// store.js
import { defineStore } from 'pinia';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth } from './firebase-init.js';
import i18n from './locales/i18n.js';
// refactor/04：静态数据从 data/ 模块读取，不再在 state() 内硬编码
import { createInitialAchievementsState } from './data/achievements.js';
import { createInitialIpDBs, buildDbUrl } from './data/ip-databases.js';
import { createDefaultPreferences } from './data/default-preferences.js';
import { createMountingStatus, createLoadingStatus, DEFAULT_SECTION } from './data/sections.js';
const { t } = i18n.global;

export const useMainStore = defineStore('main', {

  state: () => ({
    lang: 'en',
    user: null,
    isSignedIn: false,
    triggerAchievements: false,
    triggerUserBenefits: false,
    triggerRemoteUserInfo: false,
    triggerUpdateAchievements: false,
    achievementToUpdate: '',
    // 成就定义在 data/achievements.js；state 通过工厂生成新对象，避免实例间共享引用
    userAchievements: createInitialAchievementsState(),
    remoteUserInfo: {},
    remoteUserInfoFetched: false,
    currentPath: {},
    mountingStatus: createMountingStatus(),
    curl: {
      ipv4Domain: import.meta.env?.VITE_CURL_IPV4_DOMAIN,
      ipv6Domain: import.meta.env?.VITE_CURL_IPV6_DOMAIN,
      ipv64Domain: import.meta.env?.VITE_CURL_IPV64_DOMAIN,
    },
    isFireBaseSet: false,
    // refactor/01 阶段 B：单字段协调所有 Sheet 开关，天然互斥
    // 取值：'preferences' | 'navMenu' | 'achievements' | 'about' | 'tools' | null
    openSheet: null,
    loadingStatus: createLoadingStatus(),
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
      alertDuration: 2000,
    },
    currentSection: DEFAULT_SECTION,
    ipDBs: createInitialIpDBs(),
  }),

  getters: {
    activeSources: (state) => state.ipDBs.filter(db => db.enabled),
    allHasLoaded: (state) => {
      return Object.values(state.loadingStatus).every(status => status);
    },
    curlDomainsHadSet: (state) => {
      return state.curl.ipv4Domain && state.curl.ipv6Domain && state.curl.ipv64Domain;
    }
  },

  actions: {
    // 设置当前 route 路径
    setCurrentPath(path, id) {
      this.currentPath = { path: path, id: id };
    },
    // 获取数据库的 URL（URL 模板替换逻辑已抽到 data/ip-databases.js 的 buildDbUrl 纯函数）
    getDbUrl(id, ip, lang) {
      const db = this.ipDBs.find(d => d.id === id);
      return buildDbUrl(db, ip, lang);
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
    setAlert(alertToShow, alertStyle, alertMessage, alertTitle, alertDuration) {
      this.alert = { alertToShow, alertStyle, alertMessage, alertTitle, alertDuration };
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
    // refactor/01 阶段 B：Sheet 开关协调
    setOpenSheet(name) {
      this.openSheet = name; // 传 null 关闭所有
    },
    toggleSheet(name) {
      this.openSheet = (this.openSheet === name) ? null : name;
    },
    // 设置黑暗模式
    // 同步 .dark class 到 <html>，让 Tailwind 的 dark: 变体生效（refactor/01）
    setDarkMode(value) {
      this.isDarkMode = value;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', !!value);
      }
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
      const defaultPreferences = createDefaultPreferences();
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
    // Change Section
    changeSection(section) {
      this.currentSection = section;
    },
    // 检查 Firebase 环境
    checkFirebaseEnv() {
      const env = import.meta.env ?? {};
      const envConfigs = {
        key: env.VITE_FIREBASE_API_KEY,
        domain: env.VITE_FIREBASE_AUTH_DOMAIN,
        project: env.VITE_FIREBASE_PROJECT_ID,
      }
      this.isFireBaseSet = !!envConfigs.key && !!envConfigs.domain && !!envConfigs.project;
    },
    // 通过 Google 登录
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      try {
        const result = await signInWithPopup(auth, provider);
        this.user = result.user;
        // 登录成功后刷新浏览器
        window.location.reload();
      } catch (error) {
        this.alert = { alertToShow: true, alertStyle: "text-danger", alertMessage: t('alert.SignInFailedReason') + ' : ' + error, alertTitle: t('alert.SignInFailed') };
        console.error("Google sign-in failed:", error);
      }
    },
    // 通过 GitHub 登录
    async signInWithGithub() {
      const provider = new GithubAuthProvider();
      provider.addScope('user:email');
      try {
        const result = await signInWithPopup(auth, provider);
        this.user = result.user;
        // 登录成功后刷新浏览器
        window.location.reload();
      } catch (error) {
        this.alert = { alertToShow: true, alertStyle: "text-danger", alertMessage: t('alert.SignInFailedReason') + ' : ' + error, alertTitle: t('alert.SignInFailed') };
        console.error("GitHub sign-in failed:", error);
      }
    },
    // 退出登录
    async signOut() {
      try {
        await firebaseSignOut(auth);
        this.user = null;
        this.isSignedIn = false;
      } catch (error) {
        console.error("Sign out failed:", error);
      }
    },
    // 初始化 Auth 监听
    initializeAuthListener() {
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          this.user = currentUser;
          if (currentUser) {
            this.isSignedIn = true;
          }
          unsubscribe(); // 获取到用户状态后立即取消订阅
          resolve();
        });
      });
    },
    // 触发打开成就
    setTriggerAchievements(value) {
      this.triggerAchievements = value;
    },
    // 触发打开用户权益
    setTriggerUserBenefits(value) {
      this.triggerUserBenefits = value;
    },
    // 触发远程获取用户信息
    setTriggerRemoteUserInfo(value) {
      if (value) {
        this.triggerRemoteUserInfo = value;
      }
    },
    // 触发更新成就
    setTriggerUpdateAchievements(achievement) {
      this.triggerUpdateAchievements = true;
      this.achievementToUpdate = achievement;
    }
  }
});
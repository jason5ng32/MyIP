// store.js
import { defineStore } from 'pinia';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth } from './firebase-init.js';
import i18n from './locales/i18n.js';
import { createInitialAchievementsState } from './data/achievements.js';
import { createInitialIpDBs, buildDbUrl } from './data/ip-databases.js';
import { createDefaultPreferences } from './data/default-preferences.js';
import { createMountingStatus, createLoadingStatus, DEFAULT_SECTION } from './data/sections.js';
const { t } = i18n.global;

// Versioned localStorage key for userPreferences.
//
// When a release changes a default in a way that would be disruptive if
// merged on top of older stored overrides (e.g. repurposing an option, or
// when we simply want everyone to see the freshly-tuned defaults), bump
// this suffix. The mismatch leaves old stored values "orphaned" — the
// loader below won't find anything at the new key, falls back to defaults,
// and removes the legacy key(s) so browsers don't accumulate dead data.
const PREFS_STORAGE_KEY = 'userPreferences_v6';
const LEGACY_PREFS_KEYS = ['userPreferences'];

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
    // achievements defined in data/achievements.js; state is created by factory to avoid shared references between instances
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
    // set current route path
    setCurrentPath(path, id) {
      this.currentPath = { path: path, id: id };
    },
    // get database URL (URL template replacement logic is extracted to buildDbUrl pure function in data/ip-databases.js)
    getDbUrl(id, ip, lang) {
      const db = this.ipDBs.find(d => d.id === id);
      return buildDbUrl(db, ip, lang);
    },
    // return starting status from each component
    setMountingStatus(key, value) {
      this.mountingStatus[key] = value;
    },
    // return loading status from each component
    setLoadingStatus(key, value) {
      this.loadingStatus[key] = value;
    },
    // set Toast
    setAlert(alertToShow, alertStyle, alertMessage, alertTitle, alertDuration) {
      this.alert = { alertToShow, alertStyle, alertMessage, alertTitle, alertDuration };
    },
    // collect and merge IP data from different components
    updateAllIPs(payload) {
      const uniqueIPs = new Set([...this.allIPs, ...payload]);
      this.allIPs = Array.from(uniqueIPs);
    },
    // set mobile mode
    setIsMobile(payload) {
      this.isMobile = payload;
    },
    // communication helper between App.vue and Nav.vue
    setRefreshEveryThing(payload) {
      this.shouldRefreshEveryThing = payload;
    },
    setOpenSheet(name) {
      this.openSheet = name; // pass null to close all
    },
    toggleSheet(name) {
      this.openSheet = (this.openSheet === name) ? null : name;
    },
    // set dark mode
    setDarkMode(value) {
      this.isDarkMode = value;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', !!value);
      }
    },
    // set IP database enable status
    updateIPDBs({ id, enabled }) {
      const index = this.ipDBs.findIndex(db => db.id === id);
      if (index !== -1) {
        this.ipDBs[index].enabled = enabled;
      }
    },
    // set user preferences
    setPreferences(userPreferences) {
      this.userPreferences = userPreferences;
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(userPreferences));
    },
    // update user preferences
    updatePreference(key, value) {
      this.userPreferences[key] = value;
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.userPreferences));
    },
    // load user preferences from local storage
    loadPreferences() {
      const defaultPreferences = createDefaultPreferences();
      const storedPreferences = localStorage.getItem(PREFS_STORAGE_KEY);
      let preferencesToStore;

      if (storedPreferences) {
        const currentPreferences = JSON.parse(storedPreferences);
        preferencesToStore = { ...defaultPreferences, ...currentPreferences };
      } else {
        preferencesToStore = defaultPreferences;
        // First load on the current schema version — purge any older keys
        // so we don't leave zombie entries in the browser forever. Running
        // this only in the "fresh install" branch avoids racing users who
        // have already migrated on another tab.
        for (const legacyKey of LEGACY_PREFS_KEYS) {
          if (localStorage.getItem(legacyKey) !== null) {
            localStorage.removeItem(legacyKey);
          }
        }
      }

      this.setPreferences(preferencesToStore);
    },
    // fetch configs from server
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
    // check Firebase environment
    checkFirebaseEnv() {
      const env = import.meta.env ?? {};
      const envConfigs = {
        key: env.VITE_FIREBASE_API_KEY,
        domain: env.VITE_FIREBASE_AUTH_DOMAIN,
        project: env.VITE_FIREBASE_PROJECT_ID,
      }
      this.isFireBaseSet = !!envConfigs.key && !!envConfigs.domain && !!envConfigs.project;
    },
    // sign in with Google
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      try {
        const result = await signInWithPopup(auth, provider);
        this.user = result.user;
        // refresh browser after successful login
        window.location.reload();
      } catch (error) {
        this.alert = { alertToShow: true, alertStyle: "text-danger", alertMessage: t('alert.SignInFailedReason') + ' : ' + error, alertTitle: t('alert.SignInFailed') };
        console.error("Google sign-in failed:", error);
      }
    },
    // sign in with GitHub
    async signInWithGithub() {
      const provider = new GithubAuthProvider();
      provider.addScope('user:email');
      try {
        const result = await signInWithPopup(auth, provider);
        this.user = result.user;
        // refresh browser after successful login
        window.location.reload();
      } catch (error) {
        this.alert = { alertToShow: true, alertStyle: "text-danger", alertMessage: t('alert.SignInFailedReason') + ' : ' + error, alertTitle: t('alert.SignInFailed') };
        console.error("GitHub sign-in failed:", error);
      }
    },
    // sign out
    async signOut() {
      try {
        await firebaseSignOut(auth);
        this.user = null;
        this.isSignedIn = false;
      } catch (error) {
        console.error("Sign out failed:", error);
      }
    },
    // initialize Auth listener
    initializeAuthListener() {
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          this.user = currentUser;
          if (currentUser) {
            this.isSignedIn = true;
          }
          unsubscribe(); // unsubscribe immediately after getting user state
          resolve();
        });
      });
    },
    // trigger open achievements
    setTriggerAchievements(value) {
      this.triggerAchievements = value;
    },
    // trigger open user benefits
    setTriggerUserBenefits(value) {
      this.triggerUserBenefits = value;
    },
    // trigger remote fetch user info
    setTriggerRemoteUserInfo(value) {
      if (value) {
        this.triggerRemoteUserInfo = value;
      }
    },
    // trigger update achievements
    setTriggerUpdateAchievements(achievement) {
      this.triggerUpdateAchievements = true;
      this.achievementToUpdate = achievement;
    }
  }
});
// store.js
import { defineStore } from 'pinia';
import { loadFirebaseAuth } from './firebase-init.js';
import { writeAuthHint } from './utils/auth-hint.js';
import i18n from './locales/i18n.js';
import { createInitialAchievementsState } from './data/achievements.js';
import { createInitialIpDBs, buildDbUrl, applyConfigAvailability, nearestEnabledId } from './data/ip-databases.js';
import { createDefaultPreferences, migrateLegacyPreferences, PREFS_STORAGE_KEY, LEGACY_PREFS_KEYS } from './data/default-preferences.js';
import { createMountingStatus, createLoadingStatus, DEFAULT_SECTION } from './data/sections.js';
import { fetchWithTimeout } from './utils/fetch-with-timeout.js';
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
    // achievements defined in data/achievements.js; state is created by factory to avoid shared references between instances
    userAchievements: createInitialAchievementsState(),
    remoteUserInfo: {},
    remoteUserInfoFetched: false,
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
    // Collected user IPs, consumed by the Globalping tools' picker and the
    // IP-history recorder. Shape: Array<{ ip, country, location, asn, org }>
    // — country is a 2-letter code; location / asn / org are display strings
    // ('' when unknown). Populated by IpInfos / WebRTC / RuleTest / SpeedTest.
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
    // Collect and merge IP data from different components. Entries are
    // { ip, country, location, asn, org } objects (bare strings are tolerated
    // for safety; detail fields are optional). Deduped by `ip`; a later source
    // can back-fill any field left empty by an earlier one.
    updateAllIPs(payload) {
      const detailFields = ['country', 'location', 'asn', 'org'];
      const byIp = new Map(this.allIPs.map((e) => [e.ip, { ...e }]));
      for (const raw of payload) {
        const entry = typeof raw === 'string' ? { ip: raw } : raw;
        if (!entry || !entry.ip) continue;
        const existing = byIp.get(entry.ip);
        if (!existing) {
          const fresh = { ip: entry.ip };
          for (const field of detailFields) fresh[field] = entry[field] || '';
          byIp.set(entry.ip, fresh);
        } else {
          for (const field of detailFields) {
            if (!existing[field] && entry[field]) existing[field] = entry[field];
          }
        }
      }
      this.allIPs = Array.from(byIp.values());
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
        // No prefs at the current key yet: carry over the newest legacy
        // snapshot (migrating retired keys), then purge the old keys. Purging
        // only here avoids racing a tab that already migrated.
        const legacyRaw = LEGACY_PREFS_KEYS
          .map((key) => localStorage.getItem(key))
          .find((value) => value !== null);
        let legacy = null;
        if (legacyRaw) {
          try { legacy = JSON.parse(legacyRaw); } catch { legacy = null; }
        }
        preferencesToStore = { ...defaultPreferences, ...migrateLegacyPreferences(legacy) };
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
      fetchWithTimeout('/api/configs')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          this.configs = data;
          // Configs flags are the only thing that flips ipDBs.enabled. If the
          // stored preference is no longer configured, migrate it to the
          // nearest available source (the one case that rewrites the user's
          // setting) and say so via toast. Failed fetch → all stay enabled.
          this.ipDBs = applyConfigAvailability(this.ipDBs, data);
          const preferred = this.userPreferences.ipGeoSource;
          const nearest = nearestEnabledId(preferred, this.ipDBs);
          if (nearest !== preferred) {
            const from = this.ipDBs.find(db => db.id === preferred)?.text || `#${preferred}`;
            const to = this.ipDBs.find(db => db.id === nearest)?.text || `#${nearest}`;
            this.updatePreference('ipGeoSource', nearest);
            this.setAlert(true, 'text-warning',
              t('alert.IpGeoSourceFallbackMessage', { from, to }),
              t('alert.IpGeoSourceFallbackTitle'), 5000);
          }
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
      try {
        const { auth, GoogleAuthProvider, signInWithPopup } = await loadFirebaseAuth();
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        const result = await signInWithPopup(auth, provider);
        this.user = result.user;
        writeAuthHint(true);
        // refresh browser after successful login
        window.location.reload();
      } catch (error) {
        this.setAlert(true, "text-danger", t('alert.SignInFailedReason') + ' : ' + error, t('alert.SignInFailed'));
        console.error("Google sign-in failed:", error);
      }
    },
    // sign in with GitHub
    async signInWithGithub() {
      try {
        const { auth, GithubAuthProvider, signInWithPopup } = await loadFirebaseAuth();
        const provider = new GithubAuthProvider();
        provider.addScope('user:email');
        const result = await signInWithPopup(auth, provider);
        this.user = result.user;
        writeAuthHint(true);
        // refresh browser after successful login
        window.location.reload();
      } catch (error) {
        this.setAlert(true, "text-danger", t('alert.SignInFailedReason') + ' : ' + error, t('alert.SignInFailed'));
        console.error("GitHub sign-in failed:", error);
      }
    },
    // sign out
    async signOut() {
      try {
        const { auth, signOut: firebaseSignOut } = await loadFirebaseAuth();
        await firebaseSignOut(auth);
        this.user = null;
        this.isSignedIn = false;
        writeAuthHint(false);
      } catch (error) {
        console.error("Sign out failed:", error);
      }
    },
    // Resolve the persisted auth state once, and keep the sign-in hint in
    // sync so the next boot picks the right path (see utils/auth-hint.js).
    async initializeAuthListener() {
      const fb = await loadFirebaseAuth();
      if (!fb) return;
      await new Promise((resolve) => {
        const unsubscribe = fb.onAuthStateChanged(fb.auth, (currentUser) => {
          this.user = currentUser;
          if (currentUser) {
            this.isSignedIn = true;
          }
          writeAuthHint(!!currentUser);
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
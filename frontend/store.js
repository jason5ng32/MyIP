// store.js
import { defineStore } from 'pinia';
import { isFireBaseSet, loadFirebaseAuth } from './firebase-init.js';
import { rememberAccountId, writeAuthHint } from './utils/auth-hint.js';
import { markPendingRedirectSignIn, shouldFallBackToRedirect, takePendingRedirectSignIn } from './utils/auth-redirect.js';
import { isRunningAsPwa } from './utils/pwa.js';
import i18n from './locales/i18n.js';
import { createInitialAchievementsState } from './data/achievements.js';
import { ACHIEVEMENT_NAMES } from './utils/codes/achievements.js';
import { createInitialIpDBs, buildDbUrl, applyConfigAvailability, nearestEnabledId } from './data/ip-databases.js';
import { createDefaultPreferences, PREFS_STORAGE_KEY } from './data/default-preferences.js';
import { sanitizeLists } from './utils/features/connectivity-lists.js';
import { createMountingStatus, createLoadingStatus, DEFAULT_SECTION } from './data/sections.js';
import { fetchWithTimeout } from './utils/fetch-with-timeout.js';
import { PROBE_CAPABILITIES } from './utils/probe-endpoints.js';
const { t } = i18n.global;

// The two sign-in buttons. `other` is the provider to point a visitor at when
// their email already owns an account through the other one;
const SIGN_IN_PROVIDERS = {
  google: {
    label: 'Google',
    other: 'GitHub',
    providerId: 'google.com',
    icon: 'ri:google-line',
    build: ({ GoogleAuthProvider }) => {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      return provider;
    },
  },
  github: {
    label: 'GitHub',
    other: 'Google',
    providerId: 'github.com',
    icon: 'ri:github-line',
    build: ({ GithubAuthProvider }) => {
      const provider = new GithubAuthProvider();
      provider.addScope('user:email');
      return provider;
    },
  },
};

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
    // One entry per achievement name (utils/codes/achievements.js), fresh per store instance.
    userAchievements: createInitialAchievementsState(ACHIEVEMENT_NAMES),
    // True once the /api/achievements snapshot has been applied to
    // userAchievements (User.vue applyAchievements). The achievement
    // engine holds rule evaluation until then — the all-false initial state
    // must never be mistaken for "nothing achieved yet".
    userAchievementsSynced: false,
    remoteUserInfo: {},
    remoteUserInfoFetched: false,
    mountingStatus: createMountingStatus(),
    curl: {
      ipv4Domain: import.meta.env?.VITE_CURL_IPV4_DOMAIN,
      ipv6Domain: import.meta.env?.VITE_CURL_IPV6_DOMAIN,
      ipv64Domain: import.meta.env?.VITE_CURL_IPV64_DOMAIN,
    },
    isFireBaseSet,
    // Build-time probe endpoints configured (utils/probe-endpoints.js).
    probeCapabilities: { ...PROBE_CAPABILITIES },
    openSheet: null,
    // Preferences section id to reveal once the panel shows; Preferences.vue clears it.
    preferencesFocus: null,
    loadingStatus: createLoadingStatus(),
    isDarkMode: false,
    isMobile: false,
    shouldRefreshEveryThing: false,
    // Collected user IPs, consumed by the Globalping tools' picker. Shape:
    // Array<{ ip, country, location, asn, org }> — country is a 2-letter code;
    // location / asn / org are display strings ('' when unknown). Populated
    // by IpInfos / WebRTC / RuleTest / SpeedTest.
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
    // Toasts that may wait or update in place, drained by Toast.vue
    // (composables/use-toast-queue.js has the request shape).
    toastRequests: [],
    currentSection: DEFAULT_SECTION,
    ipDBs: createInitialIpDBs(),
  }),

  getters: {
    activeSources: (state) => state.ipDBs.filter(db => db.enabled),
    allHasLoaded: (state) => {
      return Object.values(state.loadingStatus).every(status => status);
    },
    // What the deployment offers, for feature gates (utils/tool-availability.js):
    // the /api/configs flags plus the build-time facts — `accounts` (the
    // sign-in setup: can sign in) and the probe endpoints (`invisibilityProbe`,
    // `dnsLeakProbe`); `userStorage` (can store) is false until configs load.
    capabilities: (state) => ({
      ...state.configs, ...state.probeCapabilities,
      accounts: state.isFireBaseSet, userStorage: Boolean(state.configs.userStorage),
    }),
    // Achievements need sign-in and user storage; the user level and the
    // usage dialog need sign-in and the IPCheck.ing API. Each works without the other.
    achievementsAvailable() {
      return this.capabilities.accounts && this.capabilities.userStorage;
    },
    usageAvailable() {
      return this.capabilities.accounts && Boolean(this.capabilities.ipChecking);
    },
    curlDomainsHadSet: (state) => {
      return state.curl.ipv4Domain && state.curl.ipv6Domain && state.curl.ipv64Domain;
    },
    // How this account signs in, for display in the user menu. A provider the
    // app no longer offers still shows, under its raw id rather than hidden.
    linkedProviders: (state) => {
      const known = Object.values(SIGN_IN_PROVIDERS);
      return (state.user?.providerData || []).map((entry) => {
        const descriptor = known.find((item) => item.providerId === entry.providerId);
        return {
          providerId: entry.providerId,
          label: descriptor?.label || entry.providerId,
          icon: descriptor?.icon || null,
        };
      });
    },
    // quotaExceeded(quotaKey): whether a metered feature's monthly quota is
    // exhausted, from the /api/getuserinfo quota snapshot in remoteUserInfo.
    // Keys come from the registries (`quotaKey` in data/tools.js and
    // data/ip-databases.js). Frontend first line only — the backend enforces
    // the same limits; absent data (signed out, old backend, fetch pending)
    // reads as not exceeded. The tools use it as a pre-flight gate.
    quotaExceeded: (state) => (key) => state.remoteUserInfo?.quota?.features?.[key]?.exhausted === true,
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
    queueToast(request) {
      this.toastRequests.push(request);
    },
    cancelToast(id) {
      this.toastRequests.push({ id, cancel: true });
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
    // Opens Preferences scrolled to one section (its element id, e.g. 'Pref_ipGeoSource').
    openPreferencesAt(sectionId) {
      this.preferencesFocus = sectionId;
      this.openSheet = 'preferences';
    },
    clearPreferencesFocus() {
      this.preferencesFocus = null;
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
      // Current-key values merge over the defaults; anything older
      // (userPreferences_v6 / userPreferences) is deliberately ignored —
      // legacy migration was retired, those visitors restart from defaults.
      const defaultPreferences = createDefaultPreferences();
      const storedPreferences = localStorage.getItem(PREFS_STORAGE_KEY);
      const currentPreferences = storedPreferences ? JSON.parse(storedPreferences) : {};
      const merged = { ...defaultPreferences, ...currentPreferences };
      // The Connectivity multi-list model guards its structure: junk drops,
      // an absent/corrupted model migrates from the legacy flat keys (kept
      // for rollback, never written).
      merged.connectivityLists = sanitizeLists(
        merged.connectivityLists, merged.connectivityTargets, merged.customConnectivityTargets,
      );
      this.setPreferences(merged);
    },
    // Fetch configs from server. A longer timeout than the default: the boot
    // request competes with every other first-render fetch on slow links.
    fetchConfigs() {
      fetchWithTimeout('/api/configs', { timeoutMs: 10000 })
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
    // sign in with Google
    async signInWithGoogle() {
      await this.signInWithProvider('google');
    },
    // sign in with GitHub
    async signInWithGithub() {
      await this.signInWithProvider('github');
    },
    // Shared sign-in path for both buttons: popup in a browser tab, then
    // reload; redirect in the installed PWA or when the popup can't open
    // (utils/auth-redirect.js), finished at boot by completeRedirectSignIn.
    async signInWithProvider(providerKey) {
      const descriptor = SIGN_IN_PROVIDERS[providerKey];
      try {
        const fb = await loadFirebaseAuth();
        if (!isRunningAsPwa()) {
          try {
            const result = await fb.signInWithPopup(fb.auth, descriptor.build(fb));
            this.user = result.user;
            writeAuthHint(true);
            rememberAccountId(result.user?.uid);
            window.location.reload();
            return;
          } catch (error) {
            if (!shouldFallBackToRedirect(error?.code)) throw error;
          }
        }
        markPendingRedirectSignIn(providerKey);
        await fb.signInWithRedirect(fb.auth, descriptor.build(fb));
      } catch (error) {
        takePendingRedirectSignIn(); // a redirect that never left mustn't replay at boot
        this.handleSignInError(error, descriptor);
      }
    },
    // Boot half of the redirect flow: true when it signed the visitor in
    // (state set before mount, no reload).
    async completeRedirectSignIn() {
      const pending = takePendingRedirectSignIn();
      if (!pending) return false;
      const descriptor = SIGN_IN_PROVIDERS[pending.providerKey] ?? SIGN_IN_PROVIDERS.google;
      try {
        const fb = await loadFirebaseAuth();
        if (!fb) return false;
        const result = await fb.getRedirectResult(fb.auth);
        if (!result?.user) return false;
        this.user = result.user;
        this.isSignedIn = true;
        writeAuthHint(true);
        rememberAccountId(result.user.uid);
        return true;
      } catch (error) {
        this.handleSignInError(error, descriptor);
        return false;
      }
    },
    // Turns Firebase auth error codes into something a visitor can act on.
    handleSignInError(error, descriptor) {
      console.error(`${descriptor.label} sign-in failed:`, error);

      switch (error?.code) {
        // Closing the popup / backing out is normal, not a failure worth a red toast.
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
        case 'auth/user-cancelled':
          return;
        case 'auth/account-exists-with-different-credential':
        case 'auth/email-already-in-use':
        case 'auth/credential-already-in-use':
          this.setAlert(true, 'text-warning',
            t('alert.SignInEmailTakenMessage', { other: descriptor.other }),
            t('alert.SignInEmailTakenTitle'), 8000);
          return;

        default:
          this.setAlert(true, 'text-danger',
            t('alert.SignInFailedReason') + ' : ' + error,
            t('alert.SignInFailed'));
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
            rememberAccountId(currentUser.uid);
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
    // Backend answered with the quota code for a feature: pin the local snapshot
    // to exhausted so the quotaExceeded getter flips without a refetch.
    markQuotaExhausted(feature) {
      const quotaFeature = this.remoteUserInfo?.quota?.features?.[feature];
      if (quotaFeature) {
        quotaFeature.percent = 100;
        quotaFeature.exhausted = true;
      }
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
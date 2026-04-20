// Keyboard shortcut registration
//
// Input:
//   - refs: all components involved in the shortcut keys (see below for destructuring)
//   - store: main store
//   - t: i18n translation function
//   - configs: computed(() => store.configs)
//   - userPreferences: computed(() => store.userPreferences)
//   - isSignedIn: computed(() => store.isSignedIn)
//
// Output:
//   - loadShortcuts(): should be called onMounted, internally will delay 2s to wait for configs to load,
//     then register all mappings and pass keyMap to helpModalRef (for help modal)
//
// Note:
//   - all scrolling + navigation actions use scrollToElement + advancedToolsRef.navigateAndToggleOffcanvas
//   - `h` key infoMask switch only executes when isInfosLoaded is true

import { trackEvent } from '../utils/use-analytics.js';
import { mappingKeys, keyMap, navigateCards } from '../utils/shortcut.js';
import { scrollToElement } from './use-scroll-to.js';

function buildShortcutConfig({ refs, store, t, configs, userPreferences, isSignedIn }) {
    const {
        navBarRef,
        preferencesRef,
        queryIPRef,
        helpModalRef,
        additionalRef,
        footerRef,
        speedTestRef,
        advancedToolsRef,
        IPCheckRef,
        connectivityRef,
        webRTCRef,
        dnsLeaksRef,
        isInfosLoaded,
        openedCard,
        toggleInfoMask,
    } = refs;

    const goToAdvancedTool = (path, trackName) => {
        scrollToElement('AdvancedTools', 80);
        advancedToolsRef.value.navigateAndToggleOffcanvas(path);
        trackEvent('Nav', 'NavClick', trackName);
    };

    const config = [
        {
            keys: 'g',
            action: () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                trackEvent('ShortCut', 'ShortCut', 'GoToTop');
            },
            description: t('shortcutKeys.GoToTop'),
        },
        {
            keys: 'j',
            action: () => { navigateCards('down'); trackEvent('ShortCut', 'ShortCut', 'GoNext'); },
            description: t('shortcutKeys.GoNext'),
        },
        {
            keys: 'k',
            action: () => { navigateCards('up'); trackEvent('ShortCut', 'ShortCut', 'GoPrevious'); },
            description: t('shortcutKeys.GoPrevious'),
        },
        {
            // Open the currently J/K-highlighted card if it's an Advanced Tool
            // (those carry data-adv-path). No-op for any other card type —
            // IP cards, Connectivity, WebRTC, etc. have their own refresh
            // shortcuts rather than an "open" concept.
            keys: 'o',
            action: () => {
                const highlighted = document.querySelector(
                    '.keyboard-shortcut-card[data-keyboard-hover="true"]'
                );
                const path = highlighted?.getAttribute('data-adv-path');
                if (!path) return;
                advancedToolsRef.value.navigateAndToggleOffcanvas(path);
                trackEvent('ShortCut', 'ShortCut', 'OpenHighlightedTool');
            },
            description: t('shortcutKeys.OpenHighlightedTool'),
        },
        {
            keys: 'G',
            action: () => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                trackEvent('ShortCut', 'ShortCut', 'GoToBottom');
            },
            description: t('shortcutKeys.GoToBottom'),
        },
        {
            keys: 'R',
            action: () => {
                store.setRefreshEveryThing(true);
                trackEvent('ShortCut', 'ShortCut', 'RefreshEverything');
            },
            description: t('shortcutKeys.RefreshEverything'),
        },
        {
            keys: '([1-6])',
            type: 'regex',
            action: (num) => {
                if (num > userPreferences.value.ipCardsToShow) return;
                const card = IPCheckRef.value.ipDataCards[num - 1];
                scrollToElement('IPInfoCard-' + num, 70);
                IPCheckRef.value.refreshCard(card, num - 1);
                trackEvent('ShortCut', 'ShortCut', 'IPCheck');
            },
            description: t('shortcutKeys.RefreshIPCard'),
        },
        {
            keys: 'c',
            action: () => {
                scrollToElement('Connectivity', 80);
                connectivityRef.value.handelCheckStart(true);
                trackEvent('ShortCut', 'ShortCut', 'Connectivity');
            },
            description: t('shortcutKeys.RefreshConnectivityTests'),
        },
        {
            keys: 'w',
            action: () => {
                scrollToElement('WebRTC', 80);
                webRTCRef.value.checkAllWebRTC(false);
                trackEvent('ShortCut', 'ShortCut', 'WebRTC');
            },
            description: t('shortcutKeys.RefreshWebRTC'),
        },
        {
            keys: 'd',
            action: () => {
                scrollToElement('DNSLeakTest', 80);
                dnsLeaksRef.value.checkAllDNSLeakTest(true);
                trackEvent('ShortCut', 'ShortCut', 'DNSLeakTest');
            },
            description: t('shortcutKeys.RefreshDNSLeakTest'),
        },
        {
            keys: 's',
            action: () => {
                scrollToElement('SpeedTest', 80);
                speedTestRef.value.speedTestController();
                trackEvent('ShortCut', 'ShortCut', 'SpeedTest');
            },
            description: t('shortcutKeys.SpeedTestButton'),
        },
        { keys: 'l', action: () => goToAdvancedTool('/pingtest', 'PingTest'), description: t('shortcutKeys.PingTest') },
        { keys: 'M', action: () => goToAdvancedTool('/macchecker', 'MacChecker'), description: t('shortcutKeys.MacChecker') },
        { keys: 't', action: () => goToAdvancedTool('/mtrtest', 'MTRTest'), description: t('shortcutKeys.MTRTest') },
        { keys: 'S', action: () => goToAdvancedTool('/securitychecklist', 'SecurityChecklist'), description: t('shortcutKeys.SecurityChecklist') },
        { keys: 'r', action: () => goToAdvancedTool('/ruletest', 'RuleTest'), description: t('shortcutKeys.RuleTest') },
        { keys: 'n', action: () => goToAdvancedTool('/dnsresolver', 'DNSResolver'), description: t('shortcutKeys.DNSResolver') },
        { keys: 'C', action: () => goToAdvancedTool('/censorshipcheck', 'CensorshipCheck'), description: t('shortcutKeys.CensorshipCheck') },
        { keys: 'b', action: () => goToAdvancedTool('/browserinfo', 'BrowserInfo'), description: t('shortcutKeys.BrowserInfo') },
        { keys: 'W', action: () => goToAdvancedTool('/whois', 'Whois'), description: t('shortcutKeys.Whois') },
        {
            keys: 'f',
            action: () => {
                if (openedCard.value !== 0) {
                    advancedToolsRef.value.fullScreen();
                    trackEvent('ShortCut', 'ShortCut', 'FullScreen');
                }
            },
            description: t('shortcutKeys.fullScreenAdvancedTools'),
        },
        {
            keys: 'q',
            action: () => { queryIPRef.value.openModal(); trackEvent('ShortCut', 'ShortCut', 'QueryIP'); },
            description: t('shortcutKeys.IPCheck'),
        },
        {
            keys: 'h',
            action: () => {
                if (isInfosLoaded.value) toggleInfoMask();
                trackEvent('ShortCut', 'ShortCut', 'ToggleInfoMask');
            },
            description: t('shortcutKeys.ToggleInfoMask'),
        },
        {
            keys: 'p',
            action: () => { navBarRef.value.OpenPreferences(); trackEvent('ShortCut', 'ShortCut', 'Preferences'); },
            description: t('shortcutKeys.Preferences'),
        },
        {
            keys: 'a',
            action: () => { footerRef.value.openAbout(); trackEvent('ShortCut', 'ShortCut', 'About'); },
            description: t('shortcutKeys.About'),
        },
        {
            keys: 'x',
            action: () => { additionalRef.value.openCurlModal(); trackEvent('ShortCut', 'ShortCut', 'Curl'); },
            description: t('shortcutKeys.Curl'),
        },
        {
            keys: '?',
            action: () => {
                helpModalRef.value.openModal();
                trackEvent('ShortCut', 'ShortCut', 'Help');
                if (isSignedIn.value && !store.userAchievements.CleverTrickery.achieved) {
                    store.setTriggerUpdateAchievements('CleverTrickery');
                }
            },
            description: t('shortcutKeys.Help'),
        },
    ];

    if (configs.value.originalSite) {
        config.push({
            keys: 'i',
            action: () => goToAdvancedTool('/invisibilitytest', 'InvisibilityTest'),
            description: t('shortcutKeys.InvisibilityTest'),
        });
    }

    return config;
}

export function useShortcuts({ refs, store, t, configs, userPreferences, isSignedIn }) {
    const registerShortcutKeys = () => {
        const shortcuts = buildShortcutConfig({ refs, store, t, configs, userPreferences, isSignedIn });
        shortcuts.forEach((entry) => mappingKeys(entry));
    };

    const loadShortcuts = () => {
        setTimeout(() => {
            registerShortcutKeys();
            if (refs.helpModalRef.value) {
                refs.helpModalRef.value.keyMap = keyMap;
            }
        }, 2000);
    };

    return { loadShortcuts };
}

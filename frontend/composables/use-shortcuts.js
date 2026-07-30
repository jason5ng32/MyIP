// Keyboard shortcut registration
//
// Input:
//   - refs: all components involved in the shortcut keys (see below for destructuring)
//   - store: main store
//   - t: i18n translation function
//   - configs: computed(() => store.configs)
//   - userPreferences: computed(() => store.userPreferences)
//
// Output:
//   - loadShortcuts(): should be called onMounted, internally will delay 2s to wait for configs to load,
//     then register all mappings and pass keyMap to helpModalRef (for help modal)
//
// Note:
//   - all scrolling + navigation actions use scrollToElement + advancedToolsRef.openTool(slug)
//   - `h` key infoMask switch only executes when isInfosLoaded is true

import { watch } from 'vue';
import { trackEvent } from '../utils/analytics.js';
import { emitAppEvent } from '../utils/app-events.js';
import { mappingKeys, keyMap, navigateCards } from '../utils/shortcut.js';
import { scrollToElement } from '../utils/scroll-to.js';

function buildShortcutConfig({ refs, store, t, configs, userPreferences }) {
    const {
        queryIPRef,
        helpModalRef,
        shareReportRef,
        speedTestRef,
        advancedToolsRef,
        IPCheckRef,
        connectivityRef,
        webRTCRef,
        dnsLeaksRef,
        isInfosLoaded,
        isToolOpen,
        toggleInfoMask,
    } = refs;

    const goToAdvancedTool = (slug, trackName) => {
        scrollToElement('AdvancedTools', 80);
        advancedToolsRef.value.openTool(slug);
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
            // (those carry data-adv-slug). No-op for any other card type —
            // IP cards, Connectivity, WebRTC, etc. have their own refresh
            // shortcuts rather than an "open" concept.
            keys: 'o',
            action: () => {
                const highlighted = document.querySelector(
                    '.keyboard-shortcut-card[data-keyboard-hover="true"]'
                );
                const slug = highlighted?.getAttribute('data-adv-slug');
                if (!slug) return;
                advancedToolsRef.value.openTool(slug);
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
                connectivityRef.value.handelCheckStart('manual');
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
        { keys: 'l', action: () => goToAdvancedTool('pingtest', 'PingTest'), description: t('shortcutKeys.PingTest') },
        { keys: 'M', action: () => goToAdvancedTool('macchecker', 'MacChecker'), description: t('shortcutKeys.MacChecker') },
        { keys: 't', action: () => goToAdvancedTool('mtrtest', 'MTRTest'), description: t('shortcutKeys.MTRTest') },
        { keys: 'S', action: () => goToAdvancedTool('securitychecklist', 'SecurityChecklist'), description: t('shortcutKeys.SecurityChecklist') },
        { keys: 'r', action: () => goToAdvancedTool('ruletest', 'RuleTest'), description: t('shortcutKeys.RuleTest') },
        { keys: 'n', action: () => goToAdvancedTool('dnsresolver', 'DNSResolver'), description: t('shortcutKeys.DNSResolver') },
        { keys: 'C', action: () => goToAdvancedTool('censorshipcheck', 'CensorshipCheck'), description: t('shortcutKeys.CensorshipCheck') },
        { keys: 'b', action: () => goToAdvancedTool('browserinfo', 'BrowserInfo'), description: t('shortcutKeys.BrowserInfo') },
        { keys: 'W', action: () => goToAdvancedTool('whois', 'Whois'), description: t('shortcutKeys.Whois') },
        { keys: 'v', action: () => goToAdvancedTool('servicestatus', 'ServiceStatus'), description: t('shortcutKeys.ServiceStatus') },
        {
            keys: 'f',
            action: () => {
                if (isToolOpen.value) {
                    advancedToolsRef.value.fullScreen();
                    trackEvent('ShortCut', 'ShortCut', 'FullScreen');
                }
            },
            description: t('shortcutKeys.fullScreenAdvancedTools'),
        },
        {
            keys: 'q',
            // Async components (see Home.vue): ref is null until the chunk
            // lands, so these actions optional-chain instead of throwing.
            action: () => { queryIPRef.value?.openModal(); trackEvent('ShortCut', 'ShortCut', 'QueryIP'); },
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
            keys: 'H',
            action: () => {
                if (userPreferences.value.ipHistoryEnabled === false) return;
                store.toggleSheet('ipHistory');
                trackEvent('ShortCut', 'ShortCut', 'IPHistory');
            },
            description: t('shortcutKeys.IPHistory'),
        },
        {
            keys: 'e',
            action: () => { shareReportRef.value?.openDialog(); trackEvent('ShortCut', 'ShortCut', 'ShareReport'); },
            description: t('shortcutKeys.ShareReport'),
        },
        {
            keys: '?',
            action: () => {
                helpModalRef.value?.openModal();
                trackEvent('ShortCut', 'ShortCut', 'Help');
                // Achievement rule (CleverTrickery) lives in data/achievement-rules.js.
                emitAppEvent('shortcut:help-opened');
            },
            description: t('shortcutKeys.Help'),
        },
    ];

    if (configs.value.originalSite) {
        config.push({
            keys: 'i',
            action: () => goToAdvancedTool('invisibilitytest', 'InvisibilityTest'),
            description: t('shortcutKeys.InvisibilityTest'),
        });
        // Uppercase D mirrors lowercase `d` (refresh homepage DNS leak test) —
        // `D` opens the in-depth version of the same feature. Gated on
        // originalSite since the advanced card itself is gated the same way.
        config.push({
            keys: 'D',
            action: () => goToAdvancedTool('enhanceddnsleaktest', 'EnhancedDnsLeakTest'),
            description: t('shortcutKeys.EnhancedDnsLeakTest'),
        });
    }

    return config;
}

export function useShortcuts({ refs, store, t, configs, userPreferences }) {
    const registerShortcutKeys = () => {
        const shortcuts = buildShortcutConfig({ refs, store, t, configs, userPreferences });
        shortcuts.forEach((entry) => mappingKeys(entry));
    };

    const loadShortcuts = () => {
        setTimeout(() => {
            registerShortcutKeys();
            // Help is an async component (Home.vue): on slow networks its
            // chunk may land after this timer, so wait for the ref instead
            // of silently skipping the keyMap hand-off.
            if (refs.helpModalRef.value) {
                refs.helpModalRef.value.keyMap = keyMap;
            } else {
                const stop = watch(refs.helpModalRef, (help) => {
                    if (!help) return;
                    help.keyMap = keyMap;
                    stop();
                });
            }
        }, 2000);
    };

    return { loadShortcuts };
}

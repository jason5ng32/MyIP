// Keyboard shortcut registration
//
// Input:
//   - refs: UI chrome the shortcut keys drive (see below for destructuring) —
//     test sections aren't here, they're reached via the command bus
//   - store: main store
//   - t: i18n translation function
//   - configs: computed(() => store.configs)
//   - userPreferences: computed(() => store.userPreferences)
//
// Output:
//   - loadShortcuts(): should be called onMounted; registers all mappings
//     immediately and passes keyMap to helpModalRef (for help modal).
//     Config-gated keys fill in reactively when /api/configs lands
//
// Note:
//   - scrolling + navigation actions use scrollToElement + advancedToolsRef.openTool(slug);
//     test-running keys dispatch commands on utils/app-commands.js
//   - `h` key infoMask switch only executes when isInfosLoaded is true
//   - every entry here is a home-page action. Overlays (Dialog / Sheet /
//     Drawer) suspend the whole map while they are open — see
//     utils/shortcut.js — so nothing needs a per-key "is something covering
//     the page?" check.

import { getCurrentScope, onScopeDispose, watch } from 'vue';
import { trackEvent } from '../utils/analytics.js';
import { emitAppEvent } from '../utils/app-events.js';
import { dispatchAppCommand } from '../utils/app-commands.js';
import { registerShortcuts, keyMap, navigateCards } from '../utils/shortcut.js';
import { scrollToElement } from '../utils/scroll-to.js';
import { hasPulseBackend } from '../utils/pulse-beacon.js';

// A shortcut only kicks the run off — completion is the owner's business —
// so a failed dispatch just logs.
const runCommand = (name, payload) => {
    dispatchAppCommand(name, payload).catch((error) => {
        console.warn(`[shortcuts] ${name} failed:`, error);
    });
};

const buildShortcutConfig = ({ refs, store, t, configs, userPreferences }) => {
    const {
        queryIPRef,
        helpModalRef,
        shareReportRef,
        advancedToolsRef,
        isInfosLoaded,
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
                scrollToElement('IPInfoCard-' + num, 70);
                runCommand('ipinfo:refresh', { index: num - 1 });
                trackEvent('ShortCut', 'ShortCut', 'IPCheck');
            },
            description: t('shortcutKeys.RefreshIPCard'),
        },
        {
            keys: 'c',
            action: () => {
                scrollToElement('Connectivity', 80);
                runCommand('connectivity:run', { trigger: 'manual' });
                trackEvent('ShortCut', 'ShortCut', 'Connectivity');
            },
            description: t('shortcutKeys.RefreshConnectivityTests'),
        },
        {
            keys: 'w',
            action: () => {
                scrollToElement('WebRTC', 80);
                runCommand('webrtc:run', { isRefresh: false });
                trackEvent('ShortCut', 'ShortCut', 'WebRTC');
            },
            description: t('shortcutKeys.RefreshWebRTC'),
        },
        {
            keys: 'd',
            action: () => {
                scrollToElement('DNSLeakTest', 80);
                runCommand('dnsleak:run', { isRefresh: true });
                trackEvent('ShortCut', 'ShortCut', 'DNSLeakTest');
            },
            description: t('shortcutKeys.RefreshDNSLeakTest'),
        },
        {
            keys: 's',
            action: () => {
                scrollToElement('SpeedTest', 80);
                runCommand('speedtest:toggle');
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
        // Uppercase P: lowercase `p` belongs to Earth Online.
        config.push({
            keys: 'P',
            action: () => goToAdvancedTool('personacheck', 'PersonaCheck'),
            description: t('shortcutKeys.PersonaCheck'),
        });
    }

    // Mirrors the Earth Online entry's visibility (widgets/Pulse.vue).
    if (hasPulseBackend || configs.value.cloudFlare) {
        config.push({
            keys: 'p',
            action: () => {
                store.toggleSheet('pulse');
                trackEvent('ShortCut', 'ShortCut', 'Pulse');
            },
            description: t('shortcutKeys.Pulse'),
        });
    }

    return config;
};

export const useShortcuts = ({ refs, store, t, configs, userPreferences }) => {
    // Suspending the map behind an overlay is the primitives' job
    // (composables/use-overlay-shortcuts.js), so nothing is wired here.
    //
    // Home is the only route that registers shortcuts; drop them when it
    // unmounts, so keystrokes on /privacy or /r/:id can't reach refs that no
    // longer point at anything.
    let disposed = false;
    if (getCurrentScope()) {
        onScopeDispose(() => {
            disposed = true;
            registerShortcuts([]);
        });
    }

    const registerShortcutKeys = () => {
        registerShortcuts(buildShortcutConfig({ refs, store, t, configs, userPreferences }));
    };

    const loadShortcuts = () => {
        // Register immediately so the base keys work from the first paint;
        // config-gated keys (originalSite's i/D/P, pulse's p) fill in when
        // /api/configs lands (`{}` → data, once per page load) and the watcher
        // rebuilds the map. keyMap is mutated in place (utils/shortcut.js),
        // so the help modal's reference stays current across rebuilds.
        registerShortcutKeys();
        watch(configs, () => {
            if (!disposed) registerShortcutKeys();
        });
        // Help is an async component (Home.vue): on slow networks its chunk
        // may land later, so wait for the ref instead of silently skipping
        // the keyMap hand-off.
        if (refs.helpModalRef.value) {
            refs.helpModalRef.value.keyMap = keyMap;
        } else {
            const stop = watch(refs.helpModalRef, (help) => {
                if (!help) return;
                help.keyMap = keyMap;
                stop();
            });
        }
    };

    return { loadShortcuts };
};

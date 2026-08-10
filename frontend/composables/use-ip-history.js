// use-ip-history.js — records every IP the app detects (store.allIPs) into a
// localStorage history grouped by day, and exposes it reactively for the
// IPHistory panel. Local-only by design: the record never syncs to the user's
// account. Gated by user preferences: ipHistoryEnabled stops recording,
// ipHistoryDays (1–90) sets retention. Pure logic lives in utils/ip-history.js.
import { ref, computed, watch } from 'vue';
import { emitAppEvent } from '@/utils/app-events.js';
import {
    IP_HISTORY_STORAGE_KEY,
    parseHistory,
    mergeIntoHistory,
    pruneHistory,
    createEmptyHistory,
    sortedHistoryDays,
    localDayKey,
    clampRetentionDays,
    distinctCountryCount,
} from '@/utils/ip-history.js';

export const useIpHistory = ({ store }) => {
    const enabled = computed(() => store.userPreferences.ipHistoryEnabled !== false);
    const retentionDays = computed(() => clampRetentionDays(store.userPreferences.ipHistoryDays));

    const persist = (history) => {
        try {
            localStorage.setItem(IP_HISTORY_STORAGE_KEY, JSON.stringify(history));
        } catch {
            // Quota exceeded / privacy mode — the history is best-effort.
        }
    };

    const loadInitial = () => {
        const parsed = parseHistory(localStorage.getItem(IP_HISTORY_STORAGE_KEY));
        const { history, changed } = pruneHistory(parsed, localDayKey(), retentionDays.value);
        if (changed) persist(history);
        return history;
    };

    const history = ref(loadInitial());

    // Domain event for the achievement engine: distinct-country snapshot of
    // the whole history. Emitted once at mount (records accumulated in past
    // sessions count too) and again whenever a merge lands new entries.
    const emitSnapshot = (h) => {
        emitAppEvent('iphistory:updated', { countryCount: distinctCountryCount(h) });
    };
    emitSnapshot(history.value);

    // Fold newly detected IPs into today's bucket. `immediate` covers IPs that
    // landed in the store before this composable mounted.
    watch(() => store.allIPs, (ips) => {
        if (!enabled.value) return;
        const { history: next, changed } = mergeIntoHistory(history.value, ips, localDayKey());
        if (changed) {
            history.value = next;
            persist(next);
            emitSnapshot(next);
        }
    }, { immediate: true });

    // Re-prune when the user shrinks the retention window. Preferences commits
    // the slider value on release, so this never fires mid-drag.
    watch(retentionDays, (days) => {
        const { history: next, changed } = pruneHistory(history.value, localDayKey(), days);
        if (changed) {
            history.value = next;
            persist(next);
        }
    });

    const sortedDays = computed(() => sortedHistoryDays(history.value));
    const hasHistory = computed(() => sortedDays.value.length > 0);

    const clearHistory = () => {
        history.value = createEmptyHistory();
        try {
            localStorage.removeItem(IP_HISTORY_STORAGE_KEY);
        } catch {
            // Same best-effort stance as persist().
        }
    };

    return { enabled, sortedDays, hasHistory, clearHistory };
};

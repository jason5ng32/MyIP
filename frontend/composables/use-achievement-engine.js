// Achievement engine — subscribes to app events (utils/app-events.js),
// evaluates the rules from data/achievement-rules.js and feeds qualified
// unlocks into the store's single-slot update pipeline (watched by User.vue,
// which reports to the backend). Owns the cross-cutting guards so emitting
// components stay achievement-agnostic:
//   - signed-in check (store.isSignedIn)
//   - already-achieved check
//   - trigger spacing: the store slot holds one achievement at a time, so
//     simultaneous unlocks (e.g. one speed test crossing three thresholds)
//     are dispatched TRIGGER_SPACING_MS apart via a small queue.
// Call once from App.vue setup.

import { onScopeDispose, watch } from 'vue';
import { useMainStore } from '../store.js';
import { onAppEvent } from '../utils/app-events.js';
import { ACHIEVEMENT_RULES } from '../data/achievement-rules.js';

const TRIGGER_SPACING_MS = 2000;

export const useAchievementEngine = () => {
    const store = useMainStore();

    const queue = [];
    let draining = false;

    const drain = () => {
        const slug = queue.shift();
        if (!slug) {
            draining = false;
            return;
        }
        draining = true;
        // Re-check at dispatch time — the achievement may have been unlocked
        // while this entry waited in the queue.
        if (!store.userAchievements[slug]?.achieved) {
            store.setTriggerUpdateAchievements(slug);
        }
        setTimeout(drain, TRIGGER_SPACING_MS);
    };

    const enqueue = (slug) => {
        if (queue.includes(slug)) return;
        queue.push(slug);
        if (!draining) drain();
    };

    // Boot events (ipinfo:finished, iphistory:updated, …) can beat the remote
    // achievements snapshot (/api/getuserinfo). Evaluating the already-achieved
    // guard against the all-false initial state would re-toast and re-report
    // badges the account holds, so slugs whose rule fired pre-sync park here
    // and are re-checked once User.vue applies the snapshot.
    const pendingUntilSynced = new Set();
    watch(() => store.userAchievementsSynced, (synced) => {
        if (!synced) return;
        for (const slug of pendingUntilSynced) {
            const entry = store.userAchievements[slug];
            if (entry && !entry.achieved) enqueue(slug);
        }
        pendingUntilSynced.clear();
    }, { flush: 'sync' });

    const unsubscribes = ACHIEVEMENT_RULES.map((rule) =>
        onAppEvent(rule.event, (payload) => {
            if (!store.isSignedIn) return;
            if (rule.when && !rule.when(payload)) return;
            if (!store.userAchievementsSynced) {
                pendingUntilSynced.add(rule.slug);
                return;
            }
            const entry = store.userAchievements[rule.slug];
            if (!entry || entry.achieved) return;
            enqueue(rule.slug);
        }),
    );

    // App.vue never unmounts in production; this keeps HMR re-runs of setup
    // from stacking duplicate listeners in dev.
    onScopeDispose(() => unsubscribes.forEach((unsubscribe) => unsubscribe()));
};

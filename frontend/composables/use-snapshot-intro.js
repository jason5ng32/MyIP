// Snapshot intro: a first-visit toast saying this load's results were saved.
// Queued (store.queueToast) on the page load's first automatic
// `snapshot:created` when the browser held no snapshot at setup, the
// snapshots reach localStorage, and the change notice it promises is on
// (snapshotsNotifyOn); shown SNAPSHOT_INTRO_DELAY_MS after page entry,
// `once`, with a View action to the Snapshots page and a show event. Called
// once in App.vue after useSnapshotRecorder, which loads the stored list
// before any result can add to it.

import { onScopeDispose } from 'vue';
import { onAppEvent } from '../utils/app-events.js';
import { snapshotsNotifyOn } from '../utils/features/snapshots.js';
import { useSnapshots } from './use-snapshot-recorder.js';

export const SNAPSHOT_INTRO_ID = 'snapshot-intro';
export const SNAPSHOT_INTRO_DELAY_MS = 15 * 1000;

const defaultHadSnapshots = () => useSnapshots().snapshots.value.length > 0;
const defaultPersisting = () => useSnapshots().isPersisting();

export const useSnapshotIntro = ({
    store, t, now = () => Date.now(), hadSnapshots = defaultHadSnapshots, persisting = defaultPersisting,
}) => {
    const enteredAt = now();
    if (hadSnapshots()) return;

    // A manual save means the visitor already found Snapshots.
    const unsubscribe = onAppEvent('snapshot:created', (payload) => {
        if (!payload?.auto) return;
        unsubscribe();
        if (!snapshotsNotifyOn(store.userPreferences) || !persisting()) return;
        store.queueToast({
            id: SNAPSHOT_INTRO_ID,
            style: 'text-info',
            title: t('snapshots.IntroTitle'),
            message: t('snapshots.IntroNote'),
            duration: 10000,
            once: true,
            when: { delayMs: Math.max(0, SNAPSHOT_INTRO_DELAY_MS - (now() - enteredAt)) },
            action: {
                label: t('snapshots.ChangedView'),
                to: { name: 'tool', params: { slug: 'snapshots' } },
                track: ['Snapshots', 'IntroNoticeClick', 'View'],
            },
            track: ['Snapshots', 'IntroNotice', 'Show'],
        });
    });
    onScopeDispose(unsubscribe);
};

// Snapshot change notice: turns the recorder's `snapshot:changed` ({ id,
// sections }) into a queued toast (store.queueToast) while the notice is on
// (snapshotsNotifyOn: the `snapshotsNotify` preference, off whenever
// automatic recording is). One toast id for the page load, `once`, waiting
// for SNAPSHOT_NOTICE_WHEN — away from the IP cards' actions; turning the
// notice off cancels it. Called once in App.vue, with its `t` and `locale`.

import { watch, onScopeDispose } from 'vue';
import { onAppEvent } from '../utils/app-events.js';
import { snapshotsNotifyOn } from '../utils/features/snapshots.js';
import { SECTION_TITLE_KEYS } from '../utils/report/report-sections.js';

export const SNAPSHOT_NOTICE_ID = 'snapshot-changed';

// 50 s on the page, or the Speed Test section reached (its heading's id).
export const SNAPSHOT_NOTICE_WHEN = Object.freeze({ delayMs: 50 * 1000, reach: 'SpeedTest' });

export const useSnapshotNotice = ({ store, t, locale }) => {
    // Intl.ListFormat joins the section names the locale's way ("A, B and C");
    // nothing else formats lists.
    const listOf = (items) => new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(items);

    const unsubscribe = onAppEvent('snapshot:changed', (payload) => {
        if (!payload?.id || !payload.sections?.length) return;
        if (!snapshotsNotifyOn(store.userPreferences)) return;
        store.queueToast({
            id: SNAPSHOT_NOTICE_ID,
            style: 'text-info',
            title: t('snapshots.ChangedTitle'),
            message: t('snapshots.ChangedNote', { sections: listOf(payload.sections.map((id) => t(SECTION_TITLE_KEYS[id]))) }),
            duration: 10000,
            once: true,
            when: SNAPSHOT_NOTICE_WHEN,
            action: {
                label: t('snapshots.ChangedView'),
                to: { name: 'tool', params: { slug: 'snapshots' }, query: { q: payload.id } },
                track: ['Snapshots', 'ChangeNoticeClick', 'View'],
            },
        });
    });
    const stopWatch = watch(() => snapshotsNotifyOn(store.userPreferences), (on) => {
        if (!on) store.cancelToast(SNAPSHOT_NOTICE_ID);
    });
    onScopeDispose(() => {
        unsubscribe();
        stopWatch();
    });
};

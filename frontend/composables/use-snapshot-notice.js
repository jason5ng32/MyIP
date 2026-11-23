// Snapshot change notice: turns the recorder's `snapshot:changed` ({ id,
// sections }) into a queued toast (store.queueToast) while the notice is on
// (snapshotsNotifyOn: the `snapshotsNotify` preference, off whenever
// automatic recording is). One toast id for the page load, `once`, waiting
// for SNAPSHOT_NOTICE_WHEN — away from the IP cards' actions; its delay
// counts from page entry. The latest change is kept: turning the notice off
// cancels the toast and on again queues it; deleting its snapshot cancels it
// for good. Called once in App.vue, with its `t` and `locale`.

import { ref, watch, onScopeDispose } from 'vue';
import { onAppEvent } from '../utils/app-events.js';
import { snapshotsNotifyOn } from '../utils/features/snapshots.js';
import { SECTION_TITLE_KEYS } from '../utils/report/report-sections.js';
import { useSnapshots } from './use-snapshot-recorder.js';

export const SNAPSHOT_NOTICE_ID = 'snapshot-changed';

// 35 s on the page, or the Speed Test section reached (its heading's id).
export const SNAPSHOT_NOTICE_WHEN = Object.freeze({ delayMs: 35 * 1000, reach: 'SpeedTest' });

const defaultHasSnapshot = () => {
    const { snapshots } = useSnapshots();
    return (id) => snapshots.value.some((snapshot) => snapshot.id === id);
};

export const useSnapshotNotice = ({
    store, t, locale, now = () => Date.now(), hasSnapshot = defaultHasSnapshot(),
}) => {
    const enteredAt = now();
    const latest = ref(null); // the latest snapshot:changed payload
    const isOn = () => snapshotsNotifyOn(store.userPreferences);

    // Intl.ListFormat joins the section names the locale's way ("A, B and C");
    // nothing else formats lists.
    const listOf = (items) => new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(items);

    const queue = ({ id, sections }) => store.queueToast({
        id: SNAPSHOT_NOTICE_ID,
        style: 'text-info',
        title: t('snapshots.ChangedTitle'),
        message: t('snapshots.ChangedNote', { sections: listOf(sections.map((section) => t(SECTION_TITLE_KEYS[section]))) }),
        duration: 10000,
        once: true,
        when: { ...SNAPSHOT_NOTICE_WHEN, delayMs: Math.max(0, SNAPSHOT_NOTICE_WHEN.delayMs - (now() - enteredAt)) },
        action: {
            label: t('snapshots.ChangedView'),
            to: { name: 'tool', params: { slug: 'snapshots' }, query: { q: id } },
            track: ['Snapshots', 'ChangeNoticeClick', 'View'],
        },
    });

    const unsubscribe = onAppEvent('snapshot:changed', (payload) => {
        if (!payload?.id || !payload.sections?.length) return;
        latest.value = payload;
        if (isOn()) queue(payload);
    });
    const stopPref = watch(isOn, (on) => {
        if (!on) store.cancelToast(SNAPSHOT_NOTICE_ID);
        else if (latest.value) queue(latest.value);
    });
    // The latest change's snapshot id once it is gone, else null.
    const goneId = () => (latest.value && !hasSnapshot(latest.value.id) ? latest.value.id : null);
    const stopGone = watch(goneId, (gone) => {
        if (!gone) return;
        latest.value = null;
        store.cancelToast(SNAPSHOT_NOTICE_ID);
    });
    onScopeDispose(() => {
        unsubscribe();
        stopPref();
        stopGone();
    });
};

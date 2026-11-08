// "Save snapshot now" on the Snapshots page. With this visit's IP results in
// hand it files them (`takeSnapshot`). Without them it runs the homepage tests
// first, through the command bus like Persona Check: a mounted (cached) Home
// runs ipinfo plus the `autoRun*` sections in place (never the speed test);
// a Home that never mounted is visited — its own initial load runs them — and
// the page comes back to `/tools/snapshots?q=<id>` while still on Home.
// Either way the session's snapshot is the automatic one when the recorder
// resolved it (`snapshotsAuto`), else a manual one once the tests settle.
// One run at a time, app-wide.

import { ref } from 'vue';
import { dispatchAppCommand, hasAppCommand, waitForAppCommand } from '../utils/app-commands.js';
import { waitForAppEvent } from '../utils/app-events.js';
import { useSnapshots } from './use-snapshot-recorder.js';

export const SNAPSHOT_SAVE_TIMEOUT_MS = 60 * 1000;
export const SNAPSHOTS_PATH = '/tools/snapshots';

// The homepage sections besides ipinfo, as the initial load gates them.
const SECTION_RUNS = [
    { pref: 'autoRunConnectivity', command: 'connectivity:run', event: 'connectivity:finished', payload: { trigger: 'refresh' } },
    { pref: 'autoRunWebRTC', command: 'webrtc:run', event: 'webrtc:finished', payload: { isRefresh: true } },
    { pref: 'autoRunDnsLeak', command: 'dnsleak:run', event: 'dnsleak:finished', payload: { isRefresh: true } },
];

const DEFAULT_BUS = { hasAppCommand, dispatchAppCommand, waitForAppCommand, waitForAppEvent };

const running = ref(false);

export const useSnapshotSave = ({
    store, router, snapshots = useSnapshots(), bus = DEFAULT_BUS, timeoutMs = SNAPSHOT_SAVE_TIMEOUT_MS,
}) => {
    const { canTakeSnapshot, currentId, takeSnapshot } = snapshots;
    const sectionRuns = () => SECTION_RUNS.filter(({ pref }) => store.userPreferences?.[pref]);

    // The recorder's automatic snapshot if it resolved one, else a manual one
    // after the other sections settle (so it holds them too).
    const resolveSnapshot = async (rest) => {
        if (currentId.value) return currentId.value;
        await Promise.allSettled(rest);
        return takeSnapshot();
    };

    // Home cached: run its tests in place.
    const runInPlace = async () => {
        const options = { timeoutMs };
        const ipinfo = bus.dispatchAppCommand('ipinfo:refresh', {}, options);
        const rest = sectionRuns().map(({ command, payload }) => bus.dispatchAppCommand(command, payload, options));
        rest.forEach((promise) => promise.catch(() => {})); // settled below, or abandoned
        await ipinfo;
        return resolveSnapshot(rest);
    };

    // Home never mounted: its initial load runs the tests; listen first.
    const runViaHome = async () => {
        const options = { timeoutMs };
        const ipinfo = bus.waitForAppEvent('ipinfo:finished', options);
        const rest = sectionRuns().map(({ event }) => bus.waitForAppEvent(event, options));
        [ipinfo, ...rest].forEach((promise) => promise.catch(() => {})); // awaited below, or abandoned
        await router.push('/');
        await bus.waitForAppCommand('ipinfo:refresh', options);
        await ipinfo;
        return resolveSnapshot(rest);
    };

    // → { status: 'saved' | 'returned' | 'failed' | 'busy', id }
    const save = async () => {
        if (running.value) return { status: 'busy', id: null };
        if (canTakeSnapshot.value) {
            const id = takeSnapshot();
            return { status: id ? 'saved' : 'failed', id };
        }
        running.value = true;
        const viaHome = !bus.hasAppCommand('ipinfo:refresh');
        try {
            const id = await (viaHome ? runViaHome() : runInPlace());
            if (!id) return { status: 'failed', id: null };
            if (!viaHome) return { status: 'saved', id };
            // Back only while the visitor is still on Home.
            if (router.currentRoute.value.path === '/') await router.push({ path: SNAPSHOTS_PATH, query: { q: id } });
            return { status: 'returned', id };
        } catch {
            return { status: 'failed', id: null };
        } finally {
            running.value = false;
        }
    };

    return { saving: running, save };
};

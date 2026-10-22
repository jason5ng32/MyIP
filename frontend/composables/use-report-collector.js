// Report collector — subscribes to the test-completion events on the app bus
// (utils/app-events.js), runs each payload through its report builder
// (utils/report/report-builders.js) and keeps the latest schema-shaped snapshot per
// section. This is the data source for the share-report dialog; components
// stay report-agnostic, exactly like the achievement engine's pattern.
// Call once from App.vue setup.

import { reactive, computed, onScopeDispose } from 'vue';
import { onAppEvent } from '../utils/app-events.js';
import { REPORT_EVENT_BUILDERS } from '../utils/report/report-builders.js';

// Module-level so later consumers (share dialog) see the same snapshots the
// App.vue-mounted subscriber collected. Shape: sectionId → schema section
// object (testedAt included).
const collectedSections = reactive({});

// Latest-wins: every re-run of a test overwrites its section snapshot.
const ingest = (event, payload) => {
    const { section, build } = REPORT_EVENT_BUILDERS[event];
    const built = build(payload);
    if (built === null) return;
    collectedSections[section] = { testedAt: new Date().toISOString(), ...built };
};

export const useReportCollector = () => {
    const unsubscribes = Object.keys(REPORT_EVENT_BUILDERS).map((event) =>
        onAppEvent(event, (payload) => ingest(event, payload)),
    );

    // App.vue never unmounts in production; this keeps HMR re-runs of setup
    // from stacking duplicate listeners in dev.
    onScopeDispose(() => unsubscribes.forEach((unsubscribe) => unsubscribe()));
};

// Read-only access for the share dialog: the raw snapshots plus the list of
// sections that currently hold data (in no particular order — display order
// comes from REPORT_SECTION_IDS in the schema).
export const useCollectedReport = () => ({
    sections: collectedSections,
    availableSectionIds: computed(() => Object.keys(collectedSections)),
});

// Drop every collected snapshot (module state is shared — used by tests and
// available to a future "clear my data" control).
export const resetCollectedReport = () => {
    for (const key of Object.keys(collectedSections)) delete collectedSections[key];
};

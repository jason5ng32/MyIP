// Connectivity grid publisher: ConnectivityTest.vue's bookkeeping behind
// `connectivity:finished`. Every change to the grid's results publishes the
// whole grid; `settled` means no target request is in flight and the
// multi-round loop has no round left to start. A grid published unsettled
// is published again once it settles, unless a later publish came first.

// The event's target rows, in grid order.
export const connectivityTargets = (tests) => tests.map((test) => ({
    id: test.id,
    name: test.name,
    custom: test.id.startsWith('custom-'),
    statusCode: test.statusCode,
    time: test.time,
    mintime: test.mintime,
}));

export const isGridSettled = ({ inFlight, roundsLeft }) => inFlight === 0 && !roundsLeft;

// `readTests` returns the live grid; `emit` receives `{ settled, targets }`.
export const createGridPublisher = ({ readTests, emit }) => {
    let inFlight = 0;
    let roundsLeft = false;
    let lastSettled = true; // nothing published yet: nothing to settle

    const settled = () => isGridSettled({ inFlight, roundsLeft });

    const publish = () => {
        lastSettled = settled();
        emit({ settled: lastSettled, targets: connectivityTargets(readTests()) });
    };

    return {
        requestStarted: () => { inFlight += 1; },
        requestFinished: () => { inFlight = Math.max(0, inFlight - 1); },
        setRoundsLeft: (value) => { roundsLeft = value; },
        publish,
        // Publishes when the last published grid was unsettled and now is.
        settleIfIdle: () => { if (!lastSettled && settled()) publish(); },
        settled,
    };
};

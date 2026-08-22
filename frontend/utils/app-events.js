// Minimal app-wide event bus for domain events — components emit what
// happened ("speed test finished", "whois lookup ran") and decoupled modules
// react to it. Framework-agnostic on purpose: no Vue imports, usable from any
// util / composable / component. Consumed by the achievement engine
// (composables/use-achievement-engine.js) and the report collector
// (composables/use-report-collector.js).

const listeners = new Map(); // event name → Set<handler>

// Subscribe to an event. Returns an unsubscribe function.
export const onAppEvent = (event, handler) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => {
        const set = listeners.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) listeners.delete(event);
    };
};

// One-shot subscription: resolves with the next payload of the event. Safe
// to call before triggering the producer — subscribe first, then invoke.
// With timeoutMs, rejects (code 'timeout') and unsubscribes if the event
// never fires.
export const waitForAppEvent = (event, { timeoutMs } = {}) => new Promise((resolve, reject) => {
    let timer;
    const off = onAppEvent(event, (payload) => {
        clearTimeout(timer);
        off();
        resolve(payload);
    });
    if (timeoutMs) {
        timer = setTimeout(() => {
            off();
            reject(Object.assign(
                new Error(`[app-events] "${event}" did not fire within ${timeoutMs}ms`),
                { code: 'timeout' },
            ));
        }, timeoutMs);
    }
});

// Emit an event to all subscribers. Emitting is fire-and-forget: a throwing
// handler must not break the emitter or the remaining handlers.
export const emitAppEvent = (event, payload = {}) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
        try {
            handler(payload);
        } catch (error) {
            console.error(`[app-events] handler for "${event}" failed:`, error);
        }
    }
};

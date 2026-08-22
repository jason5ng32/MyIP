// App-wide command bus — the imperative sibling of app-events.js. Events say
// "this happened": any number of subscribers, no return value. Commands say
// "do this": exactly one owner, and dispatching returns a promise that
// resolves when the work is done, with the owner's result. Owner components
// register through composables/use-app-command.js; decoupled callers
// (shortcuts, the refresh orchestrator, Persona Check) dispatch by name.
// Framework-agnostic on purpose: no Vue imports.
//
// Payload contract: a payload is a single plain-JSON object whose shape the
// command's owner defines and documents at its registration site. Rejections
// carry `error.code` per the appCommandError vocabulary below, so callers can
// tell a gated or malformed run from a real failure programmatically.

const handlers = new Map(); // command name → handler
const registrationHooks = new Map(); // command name → Set<hook> (waitForAppCommand)

// Structured rejection for command owners: a real Error carrying a machine-
// readable `code`. Reserved codes —
//   bus-level (produced by the bus itself):
//     'unavailable' — no owner registered for the command
//     'timeout'     — the handler (or registration wait) exceeded timeoutMs
//   owner-level (produced by handlers, by convention):
//     'auth'  — sign-in required
//     'quota' — usage limit reached
//     'input' — payload missing or invalid
// Owners may add domain-specific codes, but these five names keep these
// meanings everywhere on the bus.
export const appCommandError = (code, message) => Object.assign(new Error(message), { code });

// Register the single owner of a command. A second registration wins the name
// (warned — two live owners is a wiring bug); the returned unregister only
// removes its own handler, so a stale owner can't evict its replacement.
export const registerAppCommand = (name, handler) => {
    if (handlers.has(name)) {
        console.warn(`[app-commands] "${name}" re-registered; replacing the previous owner`);
    }
    handlers.set(name, handler);
    const hooks = registrationHooks.get(name);
    if (hooks) {
        registrationHooks.delete(name);
        for (const hook of hooks) hook();
    }
    return () => {
        if (handlers.get(name) === handler) handlers.delete(name);
    };
};

export const hasAppCommand = (name) => handlers.has(name);

// Run a command. The handler is invoked synchronously; the promise resolves
// with its result once the work completes. Rejects with code 'unavailable'
// (no owner), 'timeout' (took longer than timeoutMs), or whatever the
// handler threw.
export const dispatchAppCommand = (name, payload = {}, { timeoutMs } = {}) => {
    const handler = handlers.get(name);
    if (!handler) {
        return Promise.reject(appCommandError('unavailable', `[app-commands] no handler registered for "${name}"`));
    }
    let result;
    try {
        result = Promise.resolve(handler(payload));
    } catch (error) {
        return Promise.reject(error);
    }
    if (!timeoutMs) return result;
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(appCommandError('timeout', `[app-commands] command "${name}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([result, timeout]).finally(() => clearTimeout(timer));
};

// Resolve once the command has an owner (immediately if it already does) —
// lets a caller dispatch right after navigating to the page that registers
// it. With timeoutMs, rejects with code 'timeout' if no owner appears.
export const waitForAppCommand = (name, { timeoutMs } = {}) => {
    if (handlers.has(name)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        let timer;
        const hook = () => {
            clearTimeout(timer);
            resolve();
        };
        if (!registrationHooks.has(name)) registrationHooks.set(name, new Set());
        registrationHooks.get(name).add(hook);
        if (timeoutMs) {
            timer = setTimeout(() => {
                registrationHooks.get(name)?.delete(hook);
                reject(appCommandError('timeout', `[app-commands] command "${name}" was not registered within ${timeoutMs}ms`));
            }, timeoutMs);
        }
    });
};

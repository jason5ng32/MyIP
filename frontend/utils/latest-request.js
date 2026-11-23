// Latest-wins sequencing for overlapping async requests: each start()
// supersedes the one before, which checks isCurrent() after every await and
// drops its outcome. pendingKey() names what is still in flight.

export const createLatestRequest = () => {
    let seq = 0;
    let pending = null;

    // → { isCurrent, done }; done() marks the request settled (if still current).
    const start = (key) => {
        const token = ++seq;
        pending = key;
        const isCurrent = () => token === seq;
        const done = () => {
            if (isCurrent()) pending = null;
        };
        return { isCurrent, done };
    };

    const cancel = () => {
        seq += 1;
        pending = null;
    };

    return { start, cancel, pendingKey: () => pending };
};

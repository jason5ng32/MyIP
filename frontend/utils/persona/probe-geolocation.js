// GPS position — where the device physically is, independent of the network.
//
// Strictly opt-in: nothing here runs until the visitor presses the button and
// grants the browser permission. Coordinates are rounded to two decimals
// (about a kilometre) before they leave the device — enough to name a
// country, which is all the check asks.

const POSITION_TIMEOUT_MS = 10000;

// Two decimals ≈ 1km — a precise position is more than the answer requires.
const COORDINATE_DECIMALS = 2;

const round = (value) => Number(value.toFixed(COORDINATE_DECIMALS));

// Permission state without triggering a prompt, where the API exists. Used to
// show the visitor what will happen before they commit to anything.
export const geolocationPermission = async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state;
    } catch {
        return 'unknown';
    }
};

const getPosition = () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: 0,
    });
});

/**
 * Ask for a position.
 * Returns { available: true, latitude, longitude, accuracyMetres } or
 * { available: false, reason } — a denied prompt is a normal outcome, not an
 * error, and leaves the check reporting "not measured".
 */
export const probeGeolocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return { available: false, reason: 'unsupported' };
    }

    let position;
    try {
        position = await getPosition();
    } catch (error) {
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        const reason = error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable';
        return { available: false, reason };
    }

    const { latitude, longitude, accuracy } = position.coords;
    return {
        available: true,
        latitude: round(latitude),
        longitude: round(longitude),
        accuracyMetres: Number.isFinite(accuracy) ? Math.round(accuracy) : undefined,
    };
};

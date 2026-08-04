import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

// Validate request legitimacy
function isValidRequest(req) {
    const isLatitudeValid = /^-?\d+(\.\d+)?$/.test(req.query.latitude);
    const isLongitudeValid = /^-?\d+(\.\d+)?$/.test(req.query.longitude);
    const isLanguageValid = /^[a-z]{2}$/.test(req.query.language);

    if (!isLatitudeValid || !isLongitudeValid || !isLanguageValid) {
        return false;
    } else {
        return true;
    }
}

// Define day and night mode style strings
const styles = {
    Dark: [
        "feature:all|element:geometry.fill|color:0x242f3e",
        "feature:all|element:labels.text.stroke|color:0x242f3e",
        "feature:all|element:labels.text.fill|color:0x746855",
        "feature:administrative.locality|element:labels.text.fill|color:0xd59563",
        "feature:poi|element:labels.text.fill|color:0xd59563",
        "feature:poi.park|element:geometry|color:0x263c3f",
        "feature:poi.park|element:labels.text.fill|color:0x6b9a76",
        "feature:road|element:geometry|color:0x38414e",
        "feature:road|element:geometry.stroke|color:0x212a37",
        "feature:road|element:labels.text.fill|color:0x9ca5b3",
        "feature:road.highway|element:geometry|color:0x746855",
        "feature:road.highway|element:geometry.stroke|color:0x1f2835",
        "feature:road.highway|element:labels.text.fill|color:0xf3d19c",
        "feature:transit|element:geometry|color:0x2f3948",
        "feature:transit.station|element:labels.text.fill|color:0xd59563",
        "feature:water|element:geometry|color:0x17263c",
        "feature:water|element:labels.text.fill|color:0x515c6d",
        "feature:all|element:labels.text.stroke|color:0x17263c"
    ]
};

const createRemainingBody = (reader) => {
    let readerReleased = false;
    const releaseReader = () => {
        if (readerReleased) return;
        reader.releaseLock();
        readerReleased = true;
    };

    return new ReadableStream({
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    releaseReader();
                    controller.close();
                    return;
                }
                controller.enqueue(value);
            } catch (e) {
                releaseReader();
                controller.error(e);
            }
        },
        async cancel(reason) {
            try {
                await reader.cancel(reason);
            } finally {
                releaseReader();
            }
        },
    });
};

export default async (req, res) => {
    // Check if request is legitimate
    if (!isValidRequest(req)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    // Use req.query to get parameters
    const { latitude, longitude, language, CanvasMode } = req.query;

    if (!latitude || !longitude || !language) {
        return res.status(400).json({ error: 'Missing latitude, longitude, or language' });
    }

    // Size targets the Dialog-based map viewer: aspect-2/1 at up to ~768px wide.
    // Standard Static Maps plan caps each dimension at 640, so 640x320 + scale=2
    // yields a 1280x640 effective image — sharp when downscaled into the Dialog.
    const mapSize = '640x320';
    const fmt = 'jpg';
    const scale = 2;
    const zoom = 3;

    const apiKeys = (process.env.GOOGLE_MAP_API_KEY || '').split(',');
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    let styleParam = '';
    if (CanvasMode === 'Dark') {
        styleParam = styles.Dark.join('&style=');
    }

    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&markers=color:blue%7C${latitude},${longitude}&scale=${scale}&zoom=${zoom}&maptype=roadmap&language=${language}&format=${fmt}&size=${mapSize}&style=${styleParam}&key=${apiKey}`;

    let bodyReader;
    try {
        const apiRes = await fetchUpstream(url);
        if (!apiRes.ok) {
            return res.status(apiRes.status).json({ error: `Upstream map API returned ${apiRes.status}` });
        }

        // Read one chunk before the response starts. An early upstream error can
        // then return JSON instead of closing the client connection.
        bodyReader = apiRes.body.getReader();
        let clientClosed = false;
        const cancelFirstRead = () => {
            clientClosed = true;
            void bodyReader.cancel(new Error('client disconnected')).catch(() => undefined);
        };
        res.once('close', cancelFirstRead);
        if (res.destroyed) cancelFirstRead();

        let firstChunk;
        try {
            firstChunk = await bodyReader.read();
        } finally {
            res.off('close', cancelFirstRead);
        }

        if (clientClosed || res.destroyed) {
            bodyReader.releaseLock();
            bodyReader = undefined;
            return;
        }

        res.setHeader('Content-Type', apiRes.headers.get('content-type') || 'image/jpeg');
        // Binary streams bypass the res.json hook in the cacheable() middleware,
        // so apply the cache value it stashed on res.locals here on the 2xx path.
        if (res.locals.cacheControl) {
            res.setHeader('Cache-Control', res.locals.cacheControl);
        }

        if (firstChunk.done) {
            bodyReader.releaseLock();
            bodyReader = undefined;
            return res.end();
        }

        res.write(firstChunk.value);
        const remainingBody = Readable.fromWeb(createRemainingBody(bodyReader));
        bodyReader = undefined;
        await pipeline(remainingBody, res);
    } catch (e) {
        if (bodyReader) {
            await bodyReader.cancel(e).catch(() => undefined);
            bodyReader.releaseLock();
        }
        logger.error({ err: e, latitude, longitude, language, CanvasMode }, 'google-map handler failed');
        if (res.headersSent || res.destroyed) {
            if (!res.destroyed) res.destroy();
            return;
        }
        return res.status(500).json({ error: e.message });
    }
};

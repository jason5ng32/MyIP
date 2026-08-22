import { lookupMaxMind } from '../common/maxmind-service.js';
import logger from '../common/logger.js';

export default (req, res) => {
    // Presence, validity and public routability guaranteed by the
    // requirePublicIP middleware — a reserved address never reaches here.
    const ip = req.query.ip;

    // The raw tag goes straight in: the service owns the language set and
    // normalizes onto it.
    const lang = req.query.lang;

    try {
        res.json(lookupMaxMind(ip, lang));
    } catch (e) {
        logger.error({ err: e, ip, lang }, 'maxmind handler failed');
        res.status(e.statusCode || 500).json({ error: e.message });
    }
}

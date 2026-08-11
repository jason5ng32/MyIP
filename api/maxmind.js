import { lookupMaxMind } from '../common/maxmind-service.js';
import logger from '../common/logger.js';
import { pickLang } from '../common/langs.js';

export default (req, res) => {
    // Presence, validity and public routability guaranteed by the
    // requirePublicIP middleware — a reserved address never reaches here.
    const ip = req.query.ip;

    // Get request language
    const lang = pickLang(req.query.lang, 'en');

    try {
        res.json(lookupMaxMind(ip, lang));
    } catch (e) {
        logger.error({ err: e, ip, lang }, 'maxmind handler failed');
        res.status(e.statusCode || 500).json({ error: e.message });
    }
}

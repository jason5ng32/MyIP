import { lookupMaxMind } from '../common/maxmind-service.js';

export default (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ip = req.query.ip;

    // Get request language
    const supportedLanguages = ['zh-CN', 'en', 'fr', 'tr'];
    const lang = supportedLanguages.includes(req.query.lang) ? req.query.lang : 'en';

    try {
        res.json(lookupMaxMind(ip, lang));
    } catch (e) {
        res.status(e.statusCode || 500).json({ error: e.message });
    }
}

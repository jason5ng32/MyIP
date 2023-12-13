const https = require('https');

module.exports = (req, res) => {
    // 限制只能从指定域名访问
    const allowedDomains = ['localhost', ...(process.env.ALLOWED_DOMAINS || '').split(',')];

    const referer = req.headers.referer;

    if (referer) {
        const domain = new URL(referer).hostname;
        if (!allowedDomains.includes(domain)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(403).json({ error: 'No referer header' });
    }

    // 使用 req.query 获取参数
    const { latitude, longitude, language } = req.query;

    if (!latitude || !longitude || !language) {
        return res.status(400).json({ error: 'Missing latitude, longitude, or language' });
    }

    const mapSize = '800,640';
    const pp = `${latitude},${longitude};66`;
    const fmt = 'jpeg';
    const dpi = 'Large';
    const apiKey = process.env.BING_MAP_API_KEY;

    const url = `https://dev.virtualearth.net/REST/v1/Imagery/Map/Road/${latitude},${longitude}/5?mapSize=${mapSize}&pp=${pp}&key=${apiKey}&fmt=${fmt}&dpi=${dpi}&c=${language}`;

    https.get(url, apiRes => {
        apiRes.pipe(res);
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};

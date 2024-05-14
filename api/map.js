import { get } from 'https';
import { refererCheck } from '../common/referer-check.js';

// 验证请求合法性

function isValidRequest(req) {

    const isLatitudeValid = /^-?\d+(\.\d+)?$/.test(req.query.latitude);
    const isLongitudeValid = /^-?\d+(\.\d+)?$/.test(req.query.longitude);
    const isLanguageValid = /^[a-z]{2}$/.test(req.query.language);
    const isCanvasModeValid = /^(CanvasLight|RoadDark)$/.test(req.query.CanvasMode);

    if (!isLatitudeValid || !isLongitudeValid || !isLanguageValid || !isCanvasModeValid) {
        return false;
    } else {
        return true;
    }
}

export default (req, res) => {
    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    // 检查请求是否合法
    if (!isValidRequest(req)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    // 使用 req.query 获取参数
    const { latitude, longitude, language, CanvasMode } = req.query;

    if (!latitude || !longitude || !language) {
        return res.status(400).json({ error: 'Missing latitude, longitude, or language' });
    }

    const mapSize = '800,640';
    const pp = `${latitude},${longitude};46`;
    const fmt = 'jpeg';
    const dpi = 'Large';

    const apiKeys = (process.env.BING_MAP_API_KEY || '').split(',');
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    const url = `https://dev.virtualearth.net/REST/v1/Imagery/Map/${CanvasMode}/${latitude},${longitude}/5?mapSize=${mapSize}&pp=${pp}&key=${apiKey}&fmt=${fmt}&dpi=${dpi}&c=${language}`;


    get(url, apiRes => {
        apiRes.pipe(res);
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};

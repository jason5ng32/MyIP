import { refererCheck } from '../common/referer-check.js';

// 验证环境变量是否存在，以进行前端功能的开启和关闭
export default (req, res) => {
    // 限制请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    const hostname = referer ? new URL(referer).hostname : '';
    const originalSite = hostname === 'ipcheck.ing' || hostname === 'www.ipcheck.ing' || hostname === 'localtest.ipcheck.ing';

    const envConfigs = {
        bingMap: process.env.BING_MAP_API_KEY,
        ipInfo: process.env.IPINFO_API_TOKEN,
        ipChecking: process.env.IPCHECKING_API_KEY,
        keyCDN: process.env.KEYCDN_USER_AGENT,
        originalSite,
        cloudFlare: process.env.CLOUDFLARE_API,
        ipapiis: process.env.IPAPIIS_API_KEY,
    };
    let result = {};
    for (const key in envConfigs) {
        result[key] = !!envConfigs[key];
    }
    res.status(200).json(result);
};
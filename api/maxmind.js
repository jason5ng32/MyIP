import maxmind from 'maxmind';
import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';

let cityLookup, asnLookup;

// 异步初始化数据库
async function initDatabases() {
    cityLookup = await maxmind.open('./common/maxmind-db/GeoLite2-City.mmdb');
    asnLookup = await maxmind.open('./common/maxmind-db/GeoLite2-ASN.mmdb');
}

initDatabases();

export default (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    const ip = req.query.ip;
    if (!ip) {
        return res.status(400).json({ error: 'No IP address provided' });
    }

    // 检查 IP 地址是否合法
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    // 获取请求语言
    const lang = req.query.lang === 'zh-CN' || req.query.lang === 'en' || req.query.lang === 'fr' ? req.query.lang : 'en';

    try {
        const city = cityLookup.get(ip);
        const asn = asnLookup.get(ip);
        let result = modifyJson(ip, lang, city, asn);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

function modifyJson(ip, lang, city, asn) {
    city = city || {};
    asn = asn || {};
    return {
        ip,
        city: city.city ? city.city.names[lang] || city.city.names.en : "N/A",
        region: city.subdivisions ? city.subdivisions[0].names[lang] || city.subdivisions[0].names.en : "N/A",
        country: city.country ? city.country.iso_code : "N/A",
        country_name: city.country ? city.country.names[lang] : "N/A",
        country_code: city.country ? city.country.iso_code : "N/A",
        latitude: city.location ? city.location.latitude : "N/A",
        longitude: city.location ? city.location.longitude : "N/A",
        asn: asn.autonomous_system_number ? "AS" + asn.autonomous_system_number : "N/A",
        org: asn.autonomous_system_organization ? asn.autonomous_system_organization : "N/A"
    };
};
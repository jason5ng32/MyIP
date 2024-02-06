import maxmind from 'maxmind';
import { readFileSync } from 'fs';
import path from 'path';

function isValidIP(ip) {
    const ipv4Pattern =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Pattern =
        /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
};

let cityLookup, asnLookup;

// 异步初始化数据库
async function initDatabases() {
    // cityLookup = await maxmind.open('./data/GeoLite2-City.mmdb');
    // asnLookup = await maxmind.open('./data/GeoLite2-ASN.mmdb');

    const cityFile = path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');
    const asnFile = path.join(process.cwd(), 'data' ,'GeoLite2-ASN.mmdb');

    cityLookup = await maxmind.open(cityFile);
    asnLookup = await maxmind.open(asnFile);


}

initDatabases();

const maxmindHandler = async (req, res) => {

    // 限制只能从指定域名访问
    const allowedDomains = ['localhost', ...(process.env.ALLOWED_DOMAINS || '').split(',')];
    const referer = req.headers.referer;

    if (referer) {
        const domain = new URL(referer).hostname;
        if (!allowedDomains.includes(domain)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(403).json({ error: 'What are you doing?' });
    }

    const ip = req.query.ip;
    const lang = req.query.lang;

    // 检查 IP 地址是否合法
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    // 确保IP地址参数已提供
    if (!ip) {
        return res.status(400).json({ error: 'No IP address provided' });
    }

    try {
        // 查询城市和ASN信息
        const city = cityLookup.get(ip);
        const asn = asnLookup.get(ip);

        const result = modifyJson(ip, lang, city, asn);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

function modifyJson(ip, lang, city, asn) {
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
}

export default maxmindHandler;

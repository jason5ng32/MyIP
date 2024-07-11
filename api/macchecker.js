import { get } from 'https';
import { refererCheck } from '../common/referer-check.js';

const isValidMAC = (address) => {
    const normalizedAddress = address.replace(/[:-]/g, '');
    return normalizedAddress.length >= 6 && normalizedAddress.length <= 12 && /^[0-9A-Fa-f]+$/.test(normalizedAddress);
}

export default async (req, res) => {
    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    // 从请求中获取 IP 地址
    let macAddress = req.query.mac;
    if (!macAddress) {
        return res.status(400).json({ error: 'No MAC address provided' });
    } else {
        macAddress = macAddress.replace(/:/g, '').replace(/-/g, '');
    }

    // 检查 IP 地址是否合法
    if (!isValidMAC(macAddress)) {
        return res.status(400).json({ error: 'Invalid MAC address' });
    }


    const token = process.env.MAC_LOOKUP_API_KEY || '';

    const url_hasToken = `https://api.maclookup.app/v2/macs/${macAddress}?apiKey=${token}`;
    const url_noToken = `https://api.maclookup.app/v2/macs/${macAddress}`;
    const url = token ? url_hasToken : url_noToken;

    get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', async () => {
            try {
                const originalJson = JSON.parse(data);
                if (originalJson.success !== true) {
                    return res.json({ success: false, error: originalJson.error || 'Data not found' });
                }
                const finalData = modifyData(originalJson);
                res.json(finalData);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};


const modifyData = (data) => {
    // 检查单播/多播以及本地/全球地址
    const firstByte = parseInt(data.macPrefix.substring(0, 2), 16);
    const isMulticast = (firstByte & 0x01) === 0x01;
    const isLocal = (firstByte & 0x02) === 0x02;

    data.isMulticast = isMulticast ? true : false;
    data.isLocal = isLocal ? true : false;
    data.isGlobal = !isLocal ? true : false;
    data.isUnicast = !isMulticast ? true : false;
    data.macPrefix = data.macPrefix ? data.macPrefix.match(/.{1,2}/g).join(':') : 'N/A';
    data.company = data.company ? data.company : 'N/A';
    data.country = data.country ? data.country : 'N/A';
    data.address = data.address ? data.address : 'N/A';
    data.updated = data.updated ? data.updated : 'N/A';
    data.blockStart = data.blockStart ? data.blockStart.match(/.{1,2}/g).join(':') : 'N/A';
    data.blockEnd = data.blockEnd ? data.blockEnd.match(/.{1,2}/g).join(':') : 'N/A';
    data.blockSize = data.blockSize ? data.blockSize : 'N/A';
    data.blockType = data.blockType ? data.blockType : 'N/A';

    return data;
}
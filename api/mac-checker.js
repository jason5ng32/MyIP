import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

// A canonical MAC address is 48 bits = 12 hex chars. Accepting shorter
// strings let the upstream API receive partial prefixes and return
// undefined behavior; tighten to exactly 12 hex chars.
const isValidMAC = (address) => {
    const normalizedAddress = address.replace(/[:-]/g, '');
    return normalizedAddress.length === 12 && /^[0-9A-Fa-f]+$/.test(normalizedAddress);
}

export default async (req, res) => {
    // Get IP address from request
    let macAddress = req.query.mac;
    if (!macAddress) {
        return res.status(400).json({ error: 'No MAC address provided' });
    } else {
        macAddress = macAddress.replace(/:/g, '').replace(/-/g, '');
    }

    // Check if address is valid
    if (!isValidMAC(macAddress)) {
        return res.status(400).json({ error: 'Invalid MAC address' });
    }


    const token = process.env.MAC_LOOKUP_API_KEY || '';

    const url_hasToken = `https://api.maclookup.app/v2/macs/${macAddress}?apiKey=${token}`;
    const url_noToken = `https://api.maclookup.app/v2/macs/${macAddress}`;
    const url = token ? url_hasToken : url_noToken;

    try {
        const apiRes = await fetchUpstream(url);
        const json = await apiRes.json();
        if (json.success !== true) {
            return res.json({ success: false, error: json.error || 'Data not found' });
        }
        res.json(modifyData(json));
    } catch (e) {
        logger.error({ err: e, mac: macAddress }, 'mac-checker handler failed');
        res.status(500).json({ error: e.message });
    }
};


const modifyData = (data) => {
    // Check if address is unicast/multicast and local/global
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
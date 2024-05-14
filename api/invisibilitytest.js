import { get } from 'https';
import { refererCheck } from '../common/referer-check.js';

// 如果长度不等于 28 且不是字母与数字的组合，则返回 false
function isValidUserID(userID) {
    if (typeof userID !== 'string') {
        console.error("Invalid type for userID");
        return false;
    }
    if (userID.length !== 28 || !/^[a-zA-Z0-9]+$/.test(userID)) {
        console.error("Invalid userID format");
        return false;
    }
    return true;
}

export default (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    const id = req.query.id;
    if (!id) {
        return res.status(400).json({ error: 'No ID provided' });
    }

    // 检查 IP 地址是否合法
    if (!isValidUserID(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    const apikey = process.env.IPCHECKING_API_KEY;
    
    if (!apikey) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const url = new URL(`https://api.ipcheck.ing/getpdresult/${id}?apikey=${apikey}`);

    get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const result = JSON.parse(data);
                res.json(result);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};
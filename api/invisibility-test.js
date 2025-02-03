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

export default async (req, res) => {

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

    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    const url = new URL(`${apiEndpoint}/getpdresult/${id}?apikey=${apikey}`);

    try {
        const apiResponse = await fetch(url, {
            headers: {
                ...req.headers,
            }
        });

        // 捕捉上游错误
        if (!apiResponse.ok) {
            let errorDetail = '';
            try {
                const errorData = await apiResponse.json();
                errorDetail = errorData.message || JSON.stringify(errorData);
            } catch {
                errorDetail = apiResponse.statusText;
            }
            throw new Error(`API responded with status: ${apiResponse.status} - ${errorDetail}`);
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Error during API request:", error);
        res.status(500).json({ error: error.message });
    }

};
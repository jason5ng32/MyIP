import { refererCheck } from '../common/referer-check.js';

export default async (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const key = process.env.IPCHECKING_API_KEY;

    if (!key) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const achievement = req.body;
    if (!achievement) {
        return res.status(400).json({ error: 'Achievement name is required' });
    }

    // 构建请求
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    const url = new URL(`${apiEndpoint}/updateuserachievements?key=${key}`);

    try {
        const apiResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                ...req.headers,
            },
            body: JSON.stringify(req.body),
        });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Error during API request:", error);
        res.status(500).json({ error: error.message });
    }

}
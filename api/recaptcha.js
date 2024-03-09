// 验证 reCAPTCHA token 

export default async (req, res) => {

    // 限制请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

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

    const token = req.query.token;

    // 检查是否提供了 reCAPTCHA token
    if (!token) {
        return res.status(400).json({ message: 'No reCAPTCHA token provided.' });
    }

    // 首先检查token是否为字符串
    if (typeof token !== 'string') {
        return res.status(400).json({ message: 'Token must be a string.' });
    }

    // 然后检查字符串长度
    if (token.length < 1000) {
        return res.status(400).json({ message: 'Invalid reCAPTCHA token.' });
    }

    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`;

    try {
        const recaptchaResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const recaptchaData = await recaptchaResponse.json();

        if (recaptchaData.success) {
            // 验证成功
            res.status(200).json({ success: true, score: recaptchaData.score });
        } else {
            // 验证失败
            res.status(400).json({ success: false, score: recaptchaData.score, errors: recaptchaData['error-codes'] });
        }
    } catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        res.status(500).json({ success: false, message: 'Server error during reCAPTCHA verification.' });
    }
};

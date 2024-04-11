
// 创建一个用于设置 headers 的通用函数
function createFetchOptions() {
    return {
        headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API}`,
            'Content-Type': 'application/json'
        }
    };
}

// ASN 信息
async function getASNInfo(asn) {
    try {
        const url = `https://api.cloudflare.com/client/v4/radar/entities/asns/${asn}`;
        const headers = createFetchOptions().headers;
        const options = { headers };
        const response = await fetch(url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN info');
    }
};

// IP 版本分布
async function getASNIPVersion(asn) {
    try {
        const url = `https://api.cloudflare.com/client/v4/radar/http/summary/ip_version?asn=${asn}&dateRange=7d`;
        const headers = createFetchOptions().headers;
        const options = { headers };
        const response = await fetch(url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN IP version');
    }
};

// HTTP 协议分布
async function getASNHTTPProtocol(asn) {
    try {
        const url = `https://api.cloudflare.com/client/v4/radar/http/summary/http_protocol?asn=${asn}&dateRange=7d`;
        const headers = createFetchOptions().headers;
        const options = { headers };
        const response = await fetch(url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN HTTP protocol');
    }
};

// 设备分布
async function getASNDeviceType(asn) {
    try {
        const url = `https://api.cloudflare.com/client/v4/radar/http/summary/device_type?asn=${asn}&dateRange=7d`;
        const headers = createFetchOptions().headers;
        const options = { headers };
        const response = await fetch(url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN device type');
    }
};

// 机器人分布
async function getASNBotType(asn) {
    try {
        const url = `https://api.cloudflare.com/client/v4/radar/http/summary/bot_class?asn=${asn}&dateRange=7d`;
        const headers = createFetchOptions().headers;
        const options = { headers };
        const response = await fetch(url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN bot type');
    }
};

// 验证 asn 是否合法
function isValidASN(asn) {
    return /^[0-9]+$/.test(asn);
};

// 导出函数
export default async (req, res) => {

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

    const asn = req.query.asn;
    if (!asn) {
        return res.status(400).json({ error: 'No ASN provided' });
    }
    if (!isValidASN(asn)) {
        return res.status(400).json({ error: 'Invalid ASN' });
    }

    try {
        const results = await Promise.allSettled([
            getASNInfo(asn),
            getASNIPVersion(asn),
            getASNHTTPProtocol(asn),
            getASNDeviceType(asn),
            getASNBotType(asn)
        ]);

        // 直接转换每个结果，如果状态是 'fulfilled' 则返回值，否则返回一个包含错误信息的对象
        const response = results.map(result => {
            return result.status === 'fulfilled' ? result.value : { error: 'Failed to fetch data' };
        });

        // 清洗数据
        function cleanUpResponseData(data) {
            return {
                asnName: data[0]?.result?.asn?.name,
                asnOrgName: data[0]?.result?.asn?.orgName,
                estimatedUsers: data[0]?.result?.asn?.estimatedUsers?.estimatedUsers,
                IPv4_Pct: data[1]?.result?.summary_0?.IPv4,
                IPv6_Pct: data[1]?.result?.summary_0?.IPv6,
                HTTP_Pct: data[2]?.result?.summary_0?.http,
                HTTPS_Pct: data[2]?.result?.summary_0?.https,
                Desktop_Pct: data[3]?.result?.summary_0?.desktop,
                Mobile_Pct: data[3]?.result?.summary_0?.mobile,
                Bot_Pct: data[4]?.result?.summary_0?.bot,
                Human_Pct: data[4]?.result?.summary_0?.human
            };
        }

        const cleanedResponse = cleanUpResponseData(response);

        res.json(cleanedResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
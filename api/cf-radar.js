import { parse } from 'dotenv';
import { refererCheck } from '../common/referer-check.js';

// 创建一个用于设置 headers 的通用函数
function createFetchOptions() {
    return {
        headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API}`,
            'Content-Type': 'application/json'
        }
    };
}

// 通用的 fetch 请求函数
async function fetchFromCloudflare(endpoint) {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    const headers = createFetchOptions().headers;
    const options = { headers };
    const response = await fetch(url, options);
    return response.json();
}

// ASN 信息
async function getASNInfo(asn) {
    try {
        return await fetchFromCloudflare(`/radar/entities/asns/${asn}`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN info');
    }
};

// IP 版本分布
async function getASNIPVersion(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/ip_version?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN IP version');
    }
};

// HTTP 协议分布
async function getASNHTTPProtocol(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/http_protocol?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN HTTP protocol');
    }
};

// 设备分布
async function getASNDeviceType(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/device_type?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN device type');
    }
};

// 机器人分布
async function getASNBotType(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/bot_class?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN bot type');
    }
};

// 使用 Promise.all 进行并行请求
async function getAllASNData(asn) {
    try {
        const [asnInfo, ipVersion, httpProtocol, deviceType, botType] = await Promise.all([
            getASNInfo(asn),
            getASNIPVersion(asn),
            getASNHTTPProtocol(asn),
            getASNDeviceType(asn),
            getASNBotType(asn)
        ]);
        return { asnInfo, ipVersion, httpProtocol, deviceType, botType };
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch all ASN data');
    }
}

// 验证 asn 是否合法
function isValidASN(asn) {
    return /^[0-9]+$/.test(asn);
};

// 格式化输出

function formatData(data) {
    const { asnName, asnOrgName, estimatedUsers, IPv4_Pct, IPv6_Pct, HTTP_Pct, HTTPS_Pct, Desktop_Pct, Mobile_Pct, Bot_Pct, Human_Pct } = data;
    const formattedData = {
        asnName,
        asnOrgName,
        estimatedUsers: parseFloat(estimatedUsers).toLocaleString(),
        IPv4_Pct: `${parseFloat(IPv4_Pct).toFixed(2)}%`,
        IPv6_Pct: `${parseFloat(IPv6_Pct).toFixed(2)}%`,
        HTTP_Pct: `${parseFloat(HTTP_Pct).toFixed(2)}%`,
        HTTPS_Pct: `${parseFloat(HTTPS_Pct).toFixed(2)}%`,
        Desktop_Pct: `${parseFloat(Desktop_Pct).toFixed(2)}%`,
        Mobile_Pct: `${parseFloat(Mobile_Pct).toFixed(2)}%`,
        Bot_Pct: `${parseFloat(Bot_Pct).toFixed(2)}%`,
        Human_Pct: `${parseFloat(Human_Pct).toFixed(2)}%`
    };

    return formattedData;

}

// 过滤不存在的字段
function filterData(data) {
    for (const key in data) {
        if (data[key] === 'NaN' || data[key] === 'NaN%') {
            delete data[key];
        }
    }
    return data;
}

// 导出函数
export default async (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    const asn = req.query.asn;
    if (!asn) {
        return res.status(400).json({ error: 'No ASN provided' });
    }
    if (!isValidASN(asn)) {
        return res.status(400).json({ error: 'Invalid ASN' });
    }

    try {
        const { asnInfo, ipVersion, httpProtocol, deviceType, botType } = await getAllASNData(asn);

        // 清洗数据
        function cleanUpResponseData(data) {
            return {
                asnName: data.asnInfo.result.asn.name,
                asnOrgName: data.asnInfo.result.asn.orgName,
                estimatedUsers: data.asnInfo.result.asn.estimatedUsers.estimatedUsers,
                IPv4_Pct: data.ipVersion.result.summary_0.IPv4,
                IPv6_Pct: data.ipVersion.result.summary_0.IPv6,
                HTTP_Pct: data.httpProtocol.result.summary_0.http,
                HTTPS_Pct: data.httpProtocol.result.summary_0.https,
                Desktop_Pct: data.deviceType.result.summary_0.desktop,
                Mobile_Pct: data.deviceType.result.summary_0.mobile,
                Bot_Pct: data.botType.result.summary_0.bot,
                Human_Pct: data.botType.result.summary_0.human
            };
        }

        const cleanedResponse = cleanUpResponseData({ asnInfo, ipVersion, httpProtocol, deviceType, botType });
        const finalResponse = formatData(cleanedResponse);
        filterData(finalResponse);

        res.json(finalResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
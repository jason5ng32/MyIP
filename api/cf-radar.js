import { fetchUpstream } from '../common/fetch-with-timeout.js';

// Common fetch request function
async function fetchFromCloudflare(endpoint) {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    const response = await fetchUpstream(url, {
        headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API}`,
            'Content-Type': 'application/json',
        },
    });
    return response.json();
}

// ASN information
async function getASNInfo(asn) {
    try {
        return await fetchFromCloudflare(`/radar/entities/asns/${asn}`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN info');
    }
};

// IP version distribution
async function getASNIPVersion(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/ip_version?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN IP version');
    }
};

// HTTP protocol distribution
async function getASNHTTPProtocol(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/http_protocol?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN HTTP protocol');
    }
};

// Device distribution
async function getASNDeviceType(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/device_type?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN device type');
    }
};

// Bot distribution
async function getASNBotType(asn) {
    try {
        return await fetchFromCloudflare(`/radar/http/summary/bot_class?asn=${asn}&dateRange=7d`);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch ASN bot type');
    }
};

// Use Promise.all to make parallel requests
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

// Validate asn is valid
function isValidASN(asn) {
    return /^[0-9]+$/.test(asn);
};

// Clean up Cloudflare Radar return data to uniform field names.
// Hoisted to module scope — was redefined inside the handler on every request.
function cleanUpResponseData(data) {
    return {
        asnName: data.asnInfo.result.asn.name,
        asnCountryCode: data.asnInfo.result.asn.country,
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

// Format output

function formatData(data) {
    const { asnName, asnCountryCode, asnOrgName, estimatedUsers, IPv4_Pct, IPv6_Pct, HTTP_Pct, HTTPS_Pct, Desktop_Pct, Mobile_Pct, Bot_Pct, Human_Pct } = data;
    const formattedData = {
        asnName,
        asnCountryCode,
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

// Filter out non-existent fields
function filterData(data) {
    for (const key in data) {
        if (data[key] === 'NaN' || data[key] === 'NaN%') {
            delete data[key];
        }
    }
    return data;
}

// Export function
export default async (req, res) => {
    const asn = req.query.asn;
    if (!asn) {
        return res.status(400).json({ error: 'No ASN provided' });
    }
    if (!isValidASN(asn)) {
        return res.status(400).json({ error: 'Invalid ASN' });
    }

    try {
        const { asnInfo, ipVersion, httpProtocol, deviceType, botType } = await getAllASNData(asn);

        const cleanedResponse = cleanUpResponseData({ asnInfo, ipVersion, httpProtocol, deviceType, botType });
        const finalResponse = formatData(cleanedResponse);
        filterData(finalResponse);

        res.json(finalResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
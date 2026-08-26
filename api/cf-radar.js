import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

// Common fetch request function, shared with cf-radar-traffic.
// CLOUDFLARE_API is the pre-rename spelling — keep reading it so existing
// deployments don't lose the key on upgrade.
export async function fetchFromCloudflare(endpoint) {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    const response = await fetchUpstream(url, {
        headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API}`,
            'Content-Type': 'application/json',
        },
    });
    // Outage pages come back as HTML — fail on status instead of JSON.parse.
    if (!response.ok) {
        throw new Error(`Cloudflare Radar responded ${response.status}`);
    }
    return response.json();
}

// The five Radar segments backing one /api/cfradar response, keyed by the
// field name cleanUpResponseData expects. (The country online-activity
// heatmap lives on its own route, cf-radar-traffic.)
const SEGMENTS = {
    asnInfo: (asn) => `/radar/entities/asns/${asn}`,
    ipVersion: (asn) => `/radar/http/summary/ip_version?asn=${asn}&dateRange=7d`,
    httpProtocol: (asn) => `/radar/http/summary/http_protocol?asn=${asn}&dateRange=7d`,
    deviceType: (asn) => `/radar/http/summary/device_type?asn=${asn}&dateRange=7d`,
    botType: (asn) => `/radar/http/summary/bot_class?asn=${asn}&dateRange=7d`,
};

// Fetch all segments in parallel. A failed segment is dropped rather than
// failing the whole response — cleanUpResponseData / filterData already
// tolerate sparse data (small ASNs), so partial results degrade to missing
// fields. Logging is the handler's job: it warns on partial failure and
// errors only when every segment failed.
const getAllASNData = async (asn) => {
    const names = Object.keys(SEGMENTS);
    const settled = await Promise.allSettled(names.map((name) => fetchFromCloudflare(SEGMENTS[name](asn))));
    const data = {};
    const failed = [];
    settled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            data[names[i]] = result.value;
        } else {
            failed.push({ name: names[i], reason: result.reason });
        }
    });
    return { data, failed };
};

// Validate asn is valid
function isValidASN(asn) {
    return /^[0-9]+$/.test(asn);
};

// Clean up Cloudflare Radar return data to uniform field names.
// Optional-chaining everywhere because CF Radar returns sparse data for
// small / private / new ASNs (e.g. AS64512 is in the RFC 6996 private range
// and has no info at all; many smaller ASNs have asn info but no traffic
// summaries). Missing fields fall through as undefined and get stripped
// downstream in filterData via the NaN check.
function cleanUpResponseData(data) {
    return {
        asnName: data.asnInfo?.result?.asn?.name,
        asnCountryCode: data.asnInfo?.result?.asn?.country,
        asnOrgName: data.asnInfo?.result?.asn?.orgName,
        estimatedUsers: data.asnInfo?.result?.asn?.estimatedUsers?.estimatedUsers,
        IPv4_Pct: data.ipVersion?.result?.summary_0?.IPv4,
        IPv6_Pct: data.ipVersion?.result?.summary_0?.IPv6,
        HTTP_Pct: data.httpProtocol?.result?.summary_0?.http,
        HTTPS_Pct: data.httpProtocol?.result?.summary_0?.https,
        Desktop_Pct: data.deviceType?.result?.summary_0?.desktop,
        Mobile_Pct: data.deviceType?.result?.summary_0?.mobile,
        Bot_Pct: data.botType?.result?.summary_0?.bot,
        Human_Pct: data.botType?.result?.summary_0?.human
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
        const { data, failed } = await getAllASNData(asn);

        // One log line per request: a full wipe-out is a real failure
        if (failed.length === Object.keys(SEGMENTS).length) {
            logger.error({ err: failed[0].reason, asn }, 'cf-radar: all Radar segments failed');
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (failed.length > 0) {
            logger.warn({ err: failed[0].reason, asn, segments: failed.map((f) => f.name) }, 'cf-radar: partial Radar segment failure');
        }

        const cleanedResponse = cleanUpResponseData(data);
        const finalResponse = formatData(cleanedResponse);
        filterData(finalResponse);

        res.json(finalResponse);
    } catch (error) {
        logger.error({ err: error, asn }, 'cf-radar handler failed');
        res.status(500).json({ error: 'Internal server error' });
    }
}
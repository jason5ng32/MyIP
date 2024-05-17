// 解析IP数据
function transformDataFromIPapi(data, ipGeoSource, t, bingMapLanguage) {
    if (data.error) {
        throw new Error(data.reason);
    }

    const baseData = {
        country_name: data.country_name || "",
        country_code: data.country || "",
        region: data.region || "",
        city: data.city || "",
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        isp: data.org || "",
        asn: data.asn || "",
        asnlink: data.asn ? `https://radar.cloudflare.com/${data.asn}` : false,
        mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${bingMapLanguage}&CanvasMode=CanvasLight` : "",
        mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${bingMapLanguage}&CanvasMode=RoadDark` : ""
    };

    if (ipGeoSource === 0) {
        const proxyDetails = extractProxyDetails(data.proxyDetect, t);
        return {
            ...baseData,
            ...proxyDetails,
        };
    }

    return baseData;
};

// 解析代理数据
function extractProxyDetails(proxyDetect = {}, t) {
    const isProxy = determineIsProxy(proxyDetect, t);
    const type = determineType(proxyDetect, t);
    const proxyProtocol = determineProtocol(proxyDetect, t);
    const proxyOperator = proxyDetect.operator || "";

    return { isProxy, type, proxyProtocol, proxyOperator };
}

// 判断是否代理
function determineIsProxy(proxyDetect, t) {
    if (proxyDetect.proxy === 'yes' && proxyDetect.protocol !== 'unknown') {
        return t('ipInfos.proxyDetect.yes');
    } else if (proxyDetect.proxy === 'yes') {
        return t('ipInfos.proxyDetect.maybe');
    } else if (proxyDetect.proxy === 'no') {
        return t('ipInfos.proxyDetect.no');
    } else {
        return t('ipInfos.proxyDetect.unknownProxyType');
    }
}

// 判断代理类型
function determineType(proxyDetect, t) {
    switch (proxyDetect.type) {
        case 'Business':
            return t('ipInfos.proxyDetect.type.Business');
        case 'Residential':
            return t('ipInfos.proxyDetect.type.Residential');
        case 'Wireless':
            return t('ipInfos.proxyDetect.type.Wireless');
        case 'Hosting':
            return t('ipInfos.proxyDetect.type.Hosting');
        case 'VPN':
            if (proxyDetect.protocol === 'unknown') {
                return t('ipInfos.proxyDetect.type.Hosting');
            }
        default:
            return proxyDetect.type || t('ipInfos.proxyDetect.type.unknownType');
    }
}

// 判断代理协议
function determineProtocol(proxyDetect, t) {
    if (proxyDetect.protocol === 'unknown' || !proxyDetect.protocol) {
        return t('ipInfos.proxyDetect.unknownProtocol');
    } else {
        return proxyDetect.protocol;
    }
}

export { transformDataFromIPapi, extractProxyDetails };
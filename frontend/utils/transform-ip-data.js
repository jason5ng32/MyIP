// 解析IP数据
function transformDataFromIPapi(data,ipGeoSource,t,bingMapLanguage) {
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
        const proxyDetails = extractProxyDetails(data.proxyDetect,t);
        return {
            ...baseData,
            ...proxyDetails,
        };
    }

    return baseData;
};

// 提取代理信息
function extractProxyDetails(proxyDetect = {},t) {
    const isProxy = proxyDetect.proxy === 'yes' ? t('ipInfos.proxyDetect.yes') :
        proxyDetect.proxy === 'no' ? t('ipInfos.proxyDetect.no') :
            t('ipInfos.proxyDetect.unknownProxyType');
    const type = proxyDetect.type === 'Business' ? t('ipInfos.proxyDetect.type.Business') :
        proxyDetect.type === 'Residential' ? t('ipInfos.proxyDetect.type.Residential') :
            proxyDetect.type === 'Wireless' ? t('ipInfos.proxyDetect.type.Wireless') :
                proxyDetect.type === 'Hosting' || proxyDetect.type === 'VPN' ? t('ipInfos.proxyDetect.type.Hosting') :
                    proxyDetect.type ? proxyDetect.type : t('ipInfos.proxyDetect.type.unknownType');
    const proxyProtocol = proxyDetect.protocol === 'unknown' ? t('ipInfos.proxyDetect.unknownProtocol') :
        proxyDetect.protocol ? proxyDetect.protocol : t('ipInfos.proxyDetect.unknownProtocol');
    const proxyOperator = proxyDetect.operator ? proxyDetect.operator : "";

    return { isProxy, type, proxyProtocol, proxyOperator };
};

export { transformDataFromIPapi, extractProxyDetails };
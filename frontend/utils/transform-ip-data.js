// 解析IP数据
function transformDataFromIPapi(data,ipGeoSource,vm) {
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
        mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${vm.bingMapLanguage}&CanvasMode=CanvasLight` : "",
        mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${vm.bingMapLanguage}&CanvasMode=RoadDark` : ""
    };

    if (ipGeoSource === 0) {
        const proxyDetails = extractProxyDetails(data.proxyDetect,vm);
        return {
            ...baseData,
            ...proxyDetails,
        };
    }

    return baseData;
};

// 提取代理信息
function extractProxyDetails(proxyDetect = {},vm) {
    const isProxy = proxyDetect.proxy === 'yes' ? vm.$t('ipInfos.proxyDetect.yes') :
        proxyDetect.proxy === 'no' ? vm.$t('ipInfos.proxyDetect.no') :
            vm.$t('ipInfos.proxyDetect.unknownProxyType');
    const type = proxyDetect.type === 'Business' ? vm.$t('ipInfos.proxyDetect.type.Business') :
        proxyDetect.type === 'Residential' ? vm.$t('ipInfos.proxyDetect.type.Residential') :
            proxyDetect.type === 'Wireless' ? vm.$t('ipInfos.proxyDetect.type.Wireless') :
                proxyDetect.type === 'Hosting' || proxyDetect.type === 'VPN' ? vm.$t('ipInfos.proxyDetect.type.Hosting') :
                    proxyDetect.type ? proxyDetect.type : vm.$t('ipInfos.proxyDetect.type.unknownType');
    const proxyProtocol = proxyDetect.protocol === 'unknown' ? vm.$t('ipInfos.proxyDetect.unknownProtocol') :
        proxyDetect.protocol ? proxyDetect.protocol : vm.$t('ipInfos.proxyDetect.unknownProtocol');
    const proxyOperator = proxyDetect.operator ? proxyDetect.operator : "";

    return { isProxy, type, proxyProtocol, proxyOperator };
};

export { transformDataFromIPapi, extractProxyDetails};
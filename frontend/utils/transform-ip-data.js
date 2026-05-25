// Parse IP data
function transformDataFromIPapi(data, ipGeoSource, t, mapLanguage) {
    if (data.error) {
        throw new Error(data.reason);
    }

    const baseData = {
        country_name: data.country_name || "",
        country_code: data.country === 'N/A' ? '' : data.country,
        region: data.region || "",
        city: data.city || "",
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        isp: data.org || "",
        asn: data.asn || "",
        asnlink: data.asn ? data.asn.startsWith('AS') ? `https://bgp.tools/as/${data.asn}` : false : false,
        mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${mapLanguage}` : "",
        mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${mapLanguage}&CanvasMode=Dark` : ""
    };

    if (ipGeoSource === 0) {
        const advancedData = extractAdvancedData(data.advancedData, t);
        return {
            ...baseData,
            ...advancedData,
        };
    }

    return baseData;
};

// Parse proxy data
function extractAdvancedData(advancedData = {}, t) {
    const isProxy = determineIsProxy(advancedData, t);
    const type = determineType(advancedData, t);
    const qualityScore = advancedData.score === 'sign_in_required' ? 'sign_in_required' : advancedData.score;
    const proxyProtocol = advancedData.proxyProtocol || "";
    const proxyProvider = advancedData.proxyProvider || "";
    const isNativeIP = advancedData.tags === 'sign_in_required' ? 'sign_in_required' : advancedData.tags.isNative;

    return { isProxy, type, qualityScore, proxyProtocol, proxyProvider, isNativeIP };
}

// Determine if it is a proxy
function determineIsProxy(advancedData, t) {

    if (advancedData.tags === 'sign_in_required') {
        return 'sign_in_required';
    } else if (advancedData.tags.isProxyOrVPN && advancedData.proxyProtocol !== 'unknown') {
        return t('ipInfos.advancedData.proxyYes');
    } else if (advancedData.tags.isProxyOrVPN) {
        return t('ipInfos.advancedData.proxyMaybe');
    } else if (!advancedData.tags.isProxyOrVPN) {
        return t('ipInfos.advancedData.proxyNo');
    } else {
        return t('ipInfos.advancedData.proxyUnknown');
    }
}

// Determine proxy type
function determineType(advancedData, t) {
    if (advancedData.operatorType === 'sign_in_required') {
        return 'sign_in_required';
    }
    switch (advancedData.operatorType) {
        case 'Business':
            return t('ipInfos.advancedData.type.Business');
        case 'Residential':
            return t('ipInfos.advancedData.type.Residential');
        case 'Wireless':
            return t('ipInfos.advancedData.type.Wireless');
        case 'Hosting':
            return t('ipInfos.advancedData.type.Hosting');
        default:
            return t('ipInfos.advancedData.type.unknownType');
    }
}

export { transformDataFromIPapi, extractAdvancedData };
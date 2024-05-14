function maskedInfo(t) {
  const fakecard = {};

    fakecard.ipv4 = "8.8.8.8",
    fakecard.ipv6 = "2001:4860:4860::8888",
    fakecard.dnsendpoints = "12.34.56.78",
    fakecard.webrtcip = "100.100.200.100",
    fakecard.country_name = "United States";
    fakecard.country_code = "US";
    fakecard.region = "California";
    fakecard.city = "Mountain View";
    fakecard.latitude = "37.40599";
    fakecard.longitude = "-122.078514";
    fakecard.isp = "Google LLC";
    fakecard.asn = "AS15169";
    fakecard.asnlink = "https://radar.cloudflare.com/AS15169",
    fakecard.mapUrl = '/res/defaultMap.webp';
    fakecard.mapUrl_dark = '/res/defaultMap_dark.webp';
    fakecard.showASNInfo = false;
    fakecard.isProxy = t('ipInfos.proxyDetect.no');
    fakecard.type = t('ipInfos.proxyDetect.type.Business');
    fakecard.proxyProtocol = t('ipInfos.proxyDetect.unknownProtocol');
    fakecard.proxyOperator = "unknown";

  return fakecard;
}

export { maskedInfo };
// Shared client-side MaxMind lookup for components that need to enrich a
// raw IP with country + ISP. 
// Returns `{ country_code, country, org }` on success. Returns `null` on
// every failure path (no MaxMind source, network error, malformed
// upstream payload) so callers don't have to disambiguate.
//
// Callers that don't need `org` (e.g. WebRtcTest) just destructure the
// fields they care about.

import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import getCountryName from '@/data/country-name.js';

export function useMaxmind() {
    const store = useMainStore();
    const { t } = useI18n();

    const lookupMaxmind = async (ip) => {
        const source = store.ipDBs.find((s) => s.text === 'MaxMind');
        if (!source) return null;

        const lang = store.lang;
        // ip-api.com style locale tag — same mapping the legacy call sites used.
        const apiLang = lang === 'zh' ? 'zh-CN' : lang;

        try {
            const url = store.getDbUrl(source.id, ip, apiLang);
            const response = await fetchWithTimeout(url);
            const data = await response.json();
            const ipData = transformDataFromIPapi(data, source.id, t, lang);
            if (!ipData) return null;
            const country_code = (ipData.country_code || '').toLowerCase();
            const country = country_code
                ? getCountryName(ipData.country_code, lang)
                : '';
            return { country_code, country, org: ipData.isp || '' };
        } catch (error) {
            console.error('useMaxmind lookup failed', error);
            return null;
        }
    };

    return { lookupMaxmind };
}

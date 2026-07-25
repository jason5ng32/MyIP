// Session-cached inventory of countries that currently have online
// Globalping probes, grouped into the five continent buckets the country
// pickers display. Served by our backend (/api/globalping-probes).

import { fetchWithTimeout } from './fetch-with-timeout.js';

let inventoryPromise = null;

// Resolves to { countries: Set<cc>, continents: [{ key, countries: [cc] }] }.
export const getProbeInventory = () => {
    if (!inventoryPromise) {
        inventoryPromise = (async () => {
            const response = await fetchWithTimeout('/api/globalping-probes');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return {
                countries: new Set(Array.isArray(data.countries) ? data.countries : []),
                continents: Array.isArray(data.continents) ? data.continents : [],
            };
        })().catch((err) => {
            inventoryPromise = null;
            throw err;
        });
    }
    return inventoryPromise;
};

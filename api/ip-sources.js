// The IP-geolocation sources: one row per /api/<key> route, from which the routes, the daily-limit keys and the /api/configs flags derive.

import { requireOfflineData } from '../server/offline-data.js';
import { isMaxMindReady } from '../server/datasets/maxmind-service.js';
import { isIpCheckingApiConfigured } from '../server/ipcheck-ing-api.js';
import ipinfoioHandler, { isConfigured as isIpinfoioConfigured } from './ipinfo-io.js';
import ipapicomHandler from './ipapi-com.js';
import ipsbHandler from './ip-sb.js';
import ipapiisHandler, { isConfigured as isIpapiisConfigured } from './ipapi-is.js';
import ip2locationioHandler, { isConfigured as isIp2locationioConfigured } from './ip2location-io.js';
import maxmindHandler from './maxmind.js';
import ipCheckingHandler from './ipcheck-ing.js';

const ONE_DAY = 24 * 60 * 60;

// Row: `key` (route segment and IP_SOURCE_DAILY_LIMITS name), `handler`,
// `isConfigured` (only on sources that need configuration; it adds a
// /api/configs flag, named `configFlag` when that differs from `key`),
// `gates` (middleware after requirePublicIP()), `cacheSeconds` (edge TTL).
export const IP_SOURCES = Object.freeze([
    { key: 'ipinfoio', handler: ipinfoioHandler, isConfigured: isIpinfoioConfigured, cacheSeconds: ONE_DAY },
    { key: 'ipapicom', handler: ipapicomHandler, cacheSeconds: ONE_DAY },
    { key: 'ipsb', handler: ipsbHandler, cacheSeconds: ONE_DAY },
    { key: 'ipapiis', handler: ipapiisHandler, isConfigured: isIpapiisConfigured, cacheSeconds: ONE_DAY },
    { key: 'ip2locationio', handler: ip2locationioHandler, isConfigured: isIp2locationioConfigured, cacheSeconds: ONE_DAY },
    { key: 'maxmind', handler: maxmindHandler, gates: [requireOfflineData([isMaxMindReady])], cacheSeconds: ONE_DAY },
    // No cacheSeconds: it answers per signed-in user, so it stays no-store.
    { key: 'ipchecking', handler: ipCheckingHandler, isConfigured: isIpCheckingApiConfigured, configFlag: 'ipChecking' },
].map((source) => Object.freeze(source)));

export const IP_SOURCE_KEYS = Object.freeze(IP_SOURCES.map((s) => s.key));

// The /api/configs flags of the sources that need configuration, read now.
export const ipSourceFlags = () => Object.fromEntries(IP_SOURCES
    .filter((s) => s.isConfigured)
    .map((s) => [s.configFlag ?? s.key, Boolean(s.isConfigured())]));

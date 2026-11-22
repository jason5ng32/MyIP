// The IP-geolocation sources: one row per /api/<key> route, from which the routes, the daily-limit keys and the /api/configs flags derive.

import { requireOfflineData } from '../server/offline-data.js';
import { isMaxMindReady } from '../server/datasets/maxmind-service.js';
import { isIpCheckingApiConfigured } from '../server/ipcheck-ing-api.js';
import { optionalUser } from '../server/guards.js';
import { FEATURE_USES } from '../server/db/feature-uses.js';
import iplocateHandler, { isConfigured as isIplocateConfigured } from './iplocate.js';
import ipapicomHandler from './ipapi-com.js';
import bigdatacloudHandler, { isConfigured as isBigdatacloudConfigured } from './bigdatacloud.js';
import ipapiisHandler, { isConfigured as isIpapiisConfigured } from './ipapi-is.js';
import ip2locationioHandler, { isConfigured as isIp2locationioConfigured } from './ip2location-io.js';
import maxmindHandler from './maxmind.js';
import ipCheckingHandler from './ipcheck-ing.js';

const ONE_DAY = 24 * 60 * 60;

// Row: `key` (route segment and IP_SOURCE_DAILY_LIMITS name), `handler`,
// `isConfigured` (only on sources that need configuration; it adds a
// /api/configs flag, named `configFlag` when that differs from `key`),
// `gates` (middleware after requirePublicIP()), `cacheSeconds` (edge TTL),
// `featureUse` (the signed-in use it counts, server/db/feature-uses.js).
export const IP_SOURCES = Object.freeze([
    { key: 'iplocate', handler: iplocateHandler, isConfigured: isIplocateConfigured, cacheSeconds: ONE_DAY },
    { key: 'ipapicom', handler: ipapicomHandler, cacheSeconds: ONE_DAY },
    { key: 'bigdatacloud', handler: bigdatacloudHandler, isConfigured: isBigdatacloudConfigured, cacheSeconds: ONE_DAY },
    { key: 'ipapiis', handler: ipapiisHandler, isConfigured: isIpapiisConfigured, cacheSeconds: ONE_DAY },
    { key: 'ip2locationio', handler: ip2locationioHandler, isConfigured: isIp2locationioConfigured, cacheSeconds: ONE_DAY },
    { key: 'maxmind', handler: maxmindHandler, gates: [requireOfflineData([isMaxMindReady])], cacheSeconds: ONE_DAY },
    // No cacheSeconds: it answers per signed-in user, so it stays no-store.
    {
        key: 'ipchecking', handler: ipCheckingHandler, isConfigured: isIpCheckingApiConfigured, configFlag: 'ipChecking',
        gates: [optionalUser()], featureUse: FEATURE_USES.ipchecking,
    },
].map((source) => Object.freeze(source)));

export const IP_SOURCE_KEYS = Object.freeze(IP_SOURCES.map((s) => s.key));

// The /api/configs flags of the sources that need configuration, read now.
export const ipSourceFlags = () => Object.fromEntries(IP_SOURCES
    .filter((s) => s.isConfigured)
    .map((s) => [s.configFlag ?? s.key, Boolean(s.isConfigured())]));

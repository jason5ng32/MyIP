// Static probe list for the Ad & Tracker Blocking Test (AdblockTest.vue).
//
// Groups render in this order, each a set of vendors:
//   kind 'domain'   — `targets` are hostnames, probed at https://<host>/ ; a
//                     hit here is what DNS / VPN / router filters catch too
//   kind 'script'   — `targets` are full URLs of well-known tag / pixel
//                     scripts, fetched (never executed)
//   kind 'cosmetic' — bait elements on the page itself; `targets` name the
//                     bait ids in utils/features/adblock-test.js
//
// Only widely used services make the list. Every target must resolve on
// public DNS and answer HTTPS with a valid certificate, without redirecting
// to http:// or in a loop: any of those fails like a block and reads as
// "blocked". Bump ADBLOCK_PROBES_VERSION whenever the list changes.

export const ADBLOCK_PROBES_VERSION = '2026-10-23';

export const ADBLOCK_PROBE_GROUPS = [
    {
        id: 'ads',
        kind: 'domain',
        vendors: [
            { id: 'google-ads', name: 'Google Ads', targets: ['pagead2.googlesyndication.com', 'adservice.google.com', 'googleads.g.doubleclick.net', 'tpc.googlesyndication.com'] },
            { id: 'doubleclick', name: 'DoubleClick', targets: ['ad.doubleclick.net', 'static.doubleclick.net', 'stats.g.doubleclick.net', 'securepubads.g.doubleclick.net'] },
            { id: 'amazon-ads', name: 'Amazon Ads', targets: ['aax.amazon-adsystem.com', 'c.amazon-adsystem.com', 's.amazon-adsystem.com'] },
            { id: 'microsoft-ads', name: 'Microsoft Advertising', targets: ['ads.microsoft.com'] },
            { id: 'criteo', name: 'Criteo', targets: ['static.criteo.net', 'bidder.criteo.com', 'gum.criteo.com'] },
            { id: 'taboola', name: 'Taboola', targets: ['cdn.taboola.com', 'trc.taboola.com'] },
            { id: 'outbrain', name: 'Outbrain', targets: ['widgets.outbrain.com', 'log.outbrain.com'] },
            { id: 'media-net', name: 'Media.net', targets: ['static.media.net', 'contextual.media.net'] },
            { id: 'trade-desk', name: 'The Trade Desk', targets: ['js.adsrvr.org', 'insight.adsrvr.org', 'match.adsrvr.org'] },
            { id: 'magnite', name: 'Magnite', targets: ['fastlane.rubiconproject.com', 'pixel.rubiconproject.com'] },
            { id: 'pubmatic', name: 'PubMatic', targets: ['ads.pubmatic.com', 'image6.pubmatic.com'] },
            { id: 'adroll', name: 'AdRoll', targets: ['d.adroll.com', 's.adroll.com'] },
            { id: 'yahoo', name: 'Yahoo', targets: ['ads.yahoo.com', 'analytics.yahoo.com', 'gemini.yahoo.com'] },
            { id: 'applovin', name: 'AppLovin', targets: ['d.applovin.com', 'ms.applovin.com', 'rt.applovin.com'] },
            { id: 'unity-ads', name: 'Unity Ads', targets: ['auction.unityads.unity3d.com', 'config.unityads.unity3d.com', 'adserver.unityads.unity3d.com'] },
            { id: 'ironsource', name: 'ironSource', targets: ['outcome-ssp.supersonicads.com', 'init.supersonicads.com'] },
            { id: 'pangle', name: 'Pangle', targets: ['api16-access-sg.pangle.io', 'pangolin16.isnssdk.com'] },
        ],
    },
    {
        id: 'analytics',
        kind: 'domain',
        vendors: [
            { id: 'google-analytics', name: 'Google Analytics', targets: ['www.google-analytics.com', 'ssl.google-analytics.com', 'region1.google-analytics.com', 'analytics.google.com'] },
            { id: 'gtm', name: 'Google Tag Manager', targets: ['www.googletagmanager.com'] },
            { id: 'firebase-analytics', name: 'Firebase Analytics', targets: ['app-measurement.com', 'firebaselogging-pa.googleapis.com'] },
            { id: 'clarity', name: 'Microsoft Clarity', targets: ['www.clarity.ms', 'c.clarity.ms'] },
            { id: 'hotjar', name: 'Hotjar', targets: ['static.hotjar.com', 'script.hotjar.com', 'insights.hotjar.com'] },
            { id: 'adobe-analytics', name: 'Adobe Analytics', targets: ['assets.adobedtm.com', 'dpm.demdex.net'] },
            { id: 'hubspot', name: 'HubSpot', targets: ['js.hs-analytics.net', 'track.hubspot.com'] },
            { id: 'mixpanel', name: 'Mixpanel', targets: ['api-js.mixpanel.com', 'cdn.mxpnl.com'] },
            { id: 'segment', name: 'Segment', targets: ['api.segment.io', 'cdn.segment.com'] },
            { id: 'amplitude', name: 'Amplitude', targets: ['api2.amplitude.com', 'cdn.amplitude.com'] },
            { id: 'fullstory', name: 'FullStory', targets: ['edge.fullstory.com', 'rs.fullstory.com'] },
            { id: 'posthog', name: 'PostHog', targets: ['us.i.posthog.com', 'eu.i.posthog.com'] },
            { id: 'plausible', name: 'Plausible', targets: ['plausible.io'] },
            { id: 'cloudflare-analytics', name: 'Cloudflare Web Analytics', targets: ['cloudflareinsights.com'] },
            { id: 'yandex-metrica', name: 'Yandex Metrica', targets: ['mc.yandex.ru', 'mc.yandex.com'] },
            { id: 'truehits', name: 'Truehits', targets: ['lvs.truehits.in.th', 'lvs2.truehits.in.th'] },
            { id: 'comscore', name: 'Comscore', targets: ['sb.scorecardresearch.com', 'b.scorecardresearch.com'] },
            { id: 'adjust', name: 'Adjust', targets: ['app.adjust.com'] },
            { id: 'appsflyer', name: 'AppsFlyer', targets: ['t.appsflyer.com', 'events.appsflyer.com'] },
            { id: 'branch', name: 'Branch', targets: ['api2.branch.io', 'cdn.branch.io'] },
        ],
    },
    {
        id: 'social',
        kind: 'domain',
        vendors: [
            { id: 'meta', name: 'Meta', targets: ['connect.facebook.net', 'pixel.facebook.com', 'an.facebook.com'] },
            { id: 'x', name: 'X (Twitter)', targets: ['static.ads-twitter.com', 'ads-api.twitter.com', 'analytics.twitter.com'] },
            { id: 'linkedin', name: 'LinkedIn', targets: ['px.ads.linkedin.com', 'snap.licdn.com'] },
            { id: 'pinterest', name: 'Pinterest', targets: ['ct.pinterest.com', 'log.pinterest.com', 'trk.pinterest.com'] },
            { id: 'reddit', name: 'Reddit', targets: ['events.redditmedia.com', 'alb.reddit.com'] },
            { id: 'tiktok', name: 'TikTok', targets: ['analytics.tiktok.com', 'analytics-sg.tiktok.com', 'ads.tiktok.com'] },
            { id: 'snapchat', name: 'Snapchat', targets: ['tr.snapchat.com', 'sc-static.net'] },
            { id: 'vk', name: 'VK / Mail.ru', targets: ['top-fwz1.mail.ru'] },
            { id: 'line', name: 'LINE', targets: ['tr.line.me', 'd.line-scdn.net'] },
        ],
    },
    {
        id: 'errors',
        kind: 'domain',
        vendors: [
            { id: 'sentry', name: 'Sentry', targets: ['browser.sentry-cdn.com', 'o1.ingest.sentry.io', 'js.sentry-cdn.com'] },
            { id: 'bugsnag', name: 'Bugsnag', targets: ['notify.bugsnag.com', 'sessions.bugsnag.com'] },
            { id: 'new-relic', name: 'New Relic', targets: ['js-agent.newrelic.com', 'bam.nr-data.net'] },
            { id: 'datadog', name: 'Datadog RUM', targets: ['browser-intake-datadoghq.com', 'www.datadoghq-browser-agent.com'] },
            { id: 'dynatrace', name: 'Dynatrace', targets: ['js-cdn.dynatrace.com'] },
            { id: 'rollbar', name: 'Rollbar', targets: ['api.rollbar.com', 'cdn.rollbar.com'] },
            { id: 'crashlytics', name: 'Firebase Crashlytics', targets: ['crashlyticsreports-pa.googleapis.com'] },
        ],
    },
    {
        id: 'oem',
        kind: 'domain',
        vendors: [
            { id: 'apple', name: 'Apple', targets: ['iadsdk.apple.com', 'metrics.icloud.com', 'api-adservices.apple.com', 'weather-analytics-events.apple.com'] },
            { id: 'windows', name: 'Microsoft Windows', targets: ['vortex.data.microsoft.com'] },
            { id: 'samsung', name: 'Samsung', targets: ['samsungads.com', 'smetrics.samsung.com', 'samsung-com.112.2o7.net', 'log-config.samsungacr.com'] },
            { id: 'xiaomi', name: 'Xiaomi', targets: ['api.ad.xiaomi.com', 'data.mistat.xiaomi.com', 'tracking.miui.com', 'data.mistat.intl.xiaomi.com'] },
            { id: 'huawei', name: 'Huawei', targets: ['metrics.data.hicloud.com', 'metrics2.data.hicloud.com', 'logservice.hicloud.com'] },
            { id: 'oppo', name: 'OPPO / realme', targets: ['adsfs.oppomobile.com', 'adx.ads.oppomobile.com', 'data.ads.oppomobile.com', 'bdapi-ads.realmemobile.com'] },
            { id: 'vivo', name: 'vivo', targets: ['adsdk.vivo.com.cn'] },
            { id: 'oneplus', name: 'OnePlus', targets: ['open.oneplus.net'] },
            { id: 'lg', name: 'LG', targets: ['ngfts.lge.com', 'us.ad.lgsmartad.com', 'us.info.lgsmartad.com', 'alphonso.tv'] },
            { id: 'roku', name: 'Roku', targets: ['ads.roku.com'] },
            { id: 'amazon-devices', name: 'Amazon devices', targets: ['device-metrics-us.amazon.com', 'device-metrics-us-2.amazon.com', 'mads-eu.amazon.com'] },
        ],
    },
    {
        id: 'scripts',
        kind: 'script',
        vendors: [
            { id: 'gtm', name: 'Google Tag Manager', targets: ['https://www.googletagmanager.com/gtag/js'] },
            { id: 'ga', name: 'Google Analytics', targets: ['https://www.google-analytics.com/analytics.js'] },
            { id: 'adsense', name: 'Google AdSense', targets: ['https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'] },
            { id: 'gpt', name: 'Google Publisher Tag', targets: ['https://securepubads.g.doubleclick.net/tag/js/gpt.js'] },
            { id: 'meta-pixel', name: 'Meta Pixel', targets: ['https://connect.facebook.net/en_US/fbevents.js'] },
            { id: 'clarity', name: 'Microsoft Clarity', targets: ['https://www.clarity.ms/tag/uet'] },
            { id: 'uet', name: 'Microsoft UET', targets: ['https://bat.bing.com/bat.js'] },
            { id: 'hotjar', name: 'Hotjar', targets: ['https://static.hotjar.com/c/hotjar-1.js'] },
            { id: 'linkedin-insight', name: 'LinkedIn Insight', targets: ['https://snap.licdn.com/li.lms-analytics/insight.min.js'] },
            { id: 'x-pixel', name: 'X Pixel', targets: ['https://static.ads-twitter.com/uwt.js'] },
            { id: 'pinterest-tag', name: 'Pinterest Tag', targets: ['https://s.pinimg.com/ct/core.js'] },
            { id: 'reddit-pixel', name: 'Reddit Pixel', targets: ['https://www.redditstatic.com/ads/pixel.js'] },
            { id: 'snap-pixel', name: 'Snap Pixel', targets: ['https://sc-static.net/scevent.min.js'] },
            { id: 'apstag', name: 'Amazon Publisher Services', targets: ['https://c.amazon-adsystem.com/aax2/apstag.js'] },
            { id: 'criteo', name: 'Criteo', targets: ['https://static.criteo.net/js/ld/publishertag.js'] },
            { id: 'taboola', name: 'Taboola', targets: ['https://cdn.taboola.com/libtrc/unip/loader.js'] },
            { id: 'outbrain', name: 'Outbrain', targets: ['https://widgets.outbrain.com/outbrain.js'] },
            { id: 'adroll', name: 'AdRoll', targets: ['https://s.adroll.com/j/roundtrip.js'] },
            { id: 'adobe', name: 'Adobe Analytics', targets: ['https://assets.adobedtm.com/extensions/x/AppMeasurement.min.js'] },
            { id: 'segment', name: 'Segment', targets: ['https://cdn.segment.com/analytics.js/v1/x/analytics.min.js'] },
            { id: 'mixpanel', name: 'Mixpanel', targets: ['https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js'] },
            { id: 'amplitude', name: 'Amplitude', targets: ['https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz'] },
            { id: 'fullstory', name: 'FullStory', targets: ['https://edge.fullstory.com/s/fs.js'] },
            { id: 'posthog', name: 'PostHog', targets: ['https://us-assets.i.posthog.com/static/array.js'] },
            { id: 'plausible', name: 'Plausible', targets: ['https://plausible.io/js/script.js'] },
            { id: 'cloudflare-analytics', name: 'Cloudflare Web Analytics', targets: ['https://static.cloudflareinsights.com/beacon.min.js'] },
            { id: 'yandex-metrica', name: 'Yandex Metrica', targets: ['https://mc.yandex.ru/metrika/tag.js'] },
            { id: 'comscore', name: 'Comscore', targets: ['https://sb.scorecardresearch.com/beacon.js'] },
            { id: 'sentry', name: 'Sentry', targets: ['https://browser.sentry-cdn.com/8.0.0/bundle.min.js'] },
            { id: 'bugsnag', name: 'Bugsnag', targets: ['https://d2wy8f7a9ursnm.cloudfront.net/v8/bugsnag.min.js'] },
            { id: 'new-relic', name: 'New Relic', targets: ['https://js-agent.newrelic.com/nr-loader-spa-current.min.js'] },
            { id: 'datadog', name: 'Datadog RUM', targets: ['https://www.datadoghq-browser-agent.com/us1/v5/datadog-rum.js'] },
        ],
    },
    {
        id: 'cosmetic',
        kind: 'cosmetic',
        vendors: [
            { id: 'ad-container', targets: ['ad-container'] },
            { id: 'adsense-slot', targets: ['adsense-slot'] },
        ],
    },
];

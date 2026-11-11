// Boot-time defaults, caps, and "Add Test" tile preview for the Connectivity
// section. Separated from the full curated import catalog so the homepage
// grid and preference sanitizer load only the default target set.

// Per-list cap on stored targets, defaults included; enforced at
// add/import time only, so an over-cap migrated set keeps working but
// can't grow.
export const CONNECTIVITY_TARGET_LIMIT = 60;

// How many lists a user can hold, the undeletable "Mine" list included.
export const CONNECTIVITY_LIST_LIMIT = 10;

// Max characters in a user-given list name; the UI truncates with an
// ellipsis where space is tight.
export const CONNECTIVITY_LIST_NAME_LIMIT = 40;

// Fixed id of the seeded "Mine" list — localized display name, can't be
// deleted or renamed.
export const MINE_LIST_ID = 'mine';

// Same-origin favicon path for a member id (fetched at dev time).
export const faviconPath = (id) => `/favicons/${id}.png`;

// Targets every fresh install starts with. `siteUrl` overrides the card's
// open-website link when the test URL's host isn't the right page to open.
// Cloudflare tests speed.cloudflare.com, not www: the marketing site
// attaches font-preload headers to every response, which then fail CORS.
export const DEFAULT_LIST_MEMBERS = [
    { id: 'google', name: 'Google', url: 'https://www.google.com/favicon.ico' },
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/favicon.ico' },
    { id: 'github', name: 'GitHub', url: 'https://github.com/favicon.ico' },
    { id: 'cloudflare', name: 'Cloudflare', url: 'https://speed.cloudflare.com/favicon.ico', iconDomain: 'www.cloudflare.com', siteUrl: 'https://www.cloudflare.com' },
    { id: 'claude', name: 'Claude', url: 'https://claude.com/favicon.ico' },
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/favicon.ico' },
    { id: 'wechat', name: 'WeChat', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico', iconDomain: 'weixin.qq.com', siteUrl: 'https://wx.qq.com' },
];

// Favicon-fetch targets for the committed scripts/fetch-favicons.js
// (`pnpm fetch-favicons`; the data test also auto-invokes it when icons
// are missing). `iconDomain` differs from the test URL's host where that
// host serves a poor or missing icon.
export const BUILTIN_FAVICONS = DEFAULT_LIST_MEMBERS.map((m) => ({
    id: m.id,
    iconDomain: m.iconDomain || new URL(m.url).hostname,
}));

// Icons shown stacked on the "Add Test" grid tile — a hand-picked mix of
// flag emoji and high-recognition brands that reads as "there are curated
// lists inside".
export const TILE_PREVIEW = [
    { type: 'favicon', id: 'reddit' },
    { type: 'favicon', id: 'yandex' },
    { type: 'favicon', id: 'zarinpal' },
    { type: 'favicon', id: 'xiaohongshu' },
    { type: 'favicon', id: 'nytimes' },
    { type: 'favicon', id: 'telegram' },
    { type: 'favicon', id: 'netflix' },
];

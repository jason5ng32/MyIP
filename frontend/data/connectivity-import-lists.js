// Curated importable target lists for the Connectivity section: country sets
// (domestic reachability) and theme sets (global services). Importing
// materializes members into a list in the connectivityLists preference, so
// imported cards behave exactly like hand-added ones. Display names live in
// the locale packs under `connectivity.importLists.<id>`; member names are
// brand names and stay untranslated. Every member ships a committed 64px
// PNG at public/favicons/<id>.png (the data test enforces it) —
// same-origin, so icons render even when the tested site is blocked for
// the visitor.

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

// The defaults as an importable list (shown last in the dialog) to bring
// deleted default sites back. Not in IMPORT_LISTS: below its size floor.
export const SYSTEM_IMPORT_LIST = {
    id: 'defaults',
    emoji: '🚦',
    members: DEFAULT_LIST_MEMBERS,
};

// Defaults that also belong in a themed list are referenced, not
// re-declared — themed lists stay complete on their own (AI ⊃ ChatGPT);
// hostname dedupe on import keeps cards unique. Throws on an unknown id so
// a renamed default fails at module load, not in some far-away template.
const builtinMember = (id) => {
    const member = DEFAULT_LIST_MEMBERS.find((m) => m.id === id);
    if (!member) throw new Error(`Unknown default member: ${id}`);
    return member;
};

// Every list is fronted by an emoji (flag emoji for country lists) — one
// uniform icon system, no icon-font dependency in this data.
// Member shape: { id, name, url } (+ optional `iconDomain` when the test
// URL's host would give the favicon fetcher a poor or missing icon, and
// optional `siteUrl` when that host isn't the right page to open either).
export const IMPORT_LISTS = [
    {
        id: 'iran',
        emoji: '🇮🇷',
        members: [
            { id: 'aparat', name: 'Aparat', url: 'https://www.aparat.com/favicon.ico' },
            { id: 'digikala', name: 'Digikala', url: 'https://www.digikala.com/favicon.ico' },
            { id: 'divar', name: 'Divar', url: 'https://divar.ir/favicon.ico' },
            { id: 'cafebazaar', name: 'Cafe Bazaar', url: 'https://cafebazaar.ir/favicon.ico' },
            { id: 'balad', name: 'Balad', url: 'https://balad.ir/favicon.ico' },
            { id: 'filimo', name: 'Filimo', url: 'https://www.filimo.com/favicon.ico' },
            { id: 'torob', name: 'Torob', url: 'https://torob.com/favicon.ico' },
            { id: 'zarinpal', name: 'Zarinpal', url: 'https://www.zarinpal.com/favicon.ico' },
            { id: 'rubika', name: 'Rubika', url: 'https://rubika.ir/favicon.ico' },
            { id: 'eitaa', name: 'Eitaa', url: 'https://eitaa.com/favicon.ico' },
        ],
    },
    {
        id: 'russia',
        emoji: '🇷🇺',
        members: [
            { id: 'yandex', name: 'Yandex', url: 'https://yandex.ru/favicon.ico' },
            { id: 'vk', name: 'VK', url: 'https://vk.com/favicon.ico' },
            { id: 'gosuslugi', name: 'Gosuslugi', url: 'https://www.gosuslugi.ru/favicon.ico' },
            { id: 'ozon', name: 'Ozon', url: 'https://www.ozon.ru/favicon.ico' },
            { id: 'mailru', name: 'Mail.ru', url: 'https://mail.ru/favicon.ico' },
            { id: 'rutube', name: 'Rutube', url: 'https://rutube.ru/favicon.ico' },
            { id: 'wildberries', name: 'Wildberries', url: 'https://www.wildberries.ru/favicon.ico' },
            { id: 'avito', name: 'Avito', url: 'https://www.avito.ru/favicon.ico' },
            { id: 'kinopoisk', name: 'Kinopoisk', url: 'https://www.kinopoisk.ru/favicon.ico' },
            { id: '2gis', name: '2GIS', url: 'https://2gis.ru/favicon.ico' },
            { id: 'dzen', name: 'Dzen', url: 'https://dzen.ru/favicon.ico' },
        ],
    },
    {
        id: 'india',
        emoji: '🇮🇳',
        members: [
            { id: 'cricbuzz', name: 'Cricbuzz', url: 'https://www.cricbuzz.com/favicon.ico' },
            { id: 'zomato', name: 'Zomato', url: 'https://www.zomato.com/favicon.ico' },
            { id: 'paytm', name: 'Paytm', url: 'https://paytm.com/favicon.ico' },
            { id: 'flipkart', name: 'Flipkart', url: 'https://www.flipkart.com/favicon.ico' },
            { id: 'bigbasket', name: 'BigBasket', url: 'https://www.bigbasket.com/favicon.ico' },
            { id: 'phonepe', name: 'PhonePe', url: 'https://www.phonepe.com/favicon.ico' },
            { id: 'policybazaar', name: 'Policybazaar', url: 'https://www.policybazaar.com/favicon.ico' },
            { id: 'nykaa', name: 'Nykaa', url: 'https://www.nykaa.com/favicon.ico' },
            { id: 'justdial', name: 'Justdial', url: 'https://www.justdial.com/favicon.ico' },
            { id: 'groww', name: 'Groww', url: 'https://groww.in/favicon.ico' },
        ],
    },
    {
        id: 'china',
        emoji: '🇨🇳',
        members: [
            builtinMember('wechat'),
            { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/favicon.ico' },
            { id: 'taobao', name: 'Taobao', url: 'https://www.taobao.com/favicon.ico' },
            { id: 'bilibili', name: 'Bilibili', url: 'https://www.bilibili.com/favicon.ico' },
            { id: 'qq', name: 'QQ', url: 'https://im.qq.com/favicon.ico', iconDomain: 'qq.com' },
            { id: 'douyin', name: 'Douyin', url: 'https://www.douyin.com/favicon.ico' },
            { id: 'zhihu', name: 'Zhihu', url: 'https://www.zhihu.com/favicon.ico' },
            { id: 'jd', name: 'JD', url: 'https://www.jd.com/favicon.ico' },
            { id: 'weibo', name: 'Weibo', url: 'https://weibo.com/favicon.ico' },
            { id: 'netease', name: 'NetEase', url: 'https://www.163.com/favicon.ico' },
            { id: 'xiaohongshu', name: 'Xiaohongshu', url: 'https://www.xiaohongshu.com/favicon.ico' },
            { id: 'douban', name: 'Douban', url: 'https://www.douban.com/favicon.ico' },
        ],
    },
    {
        id: 'brazil',
        emoji: '🇧🇷',
        members: [
            { id: 'globo', name: 'Globo', url: 'https://www.globo.com/favicon.ico' },
            { id: 'uol', name: 'UOL', url: 'https://www.uol.com.br/favicon.ico' },
            { id: 'govbr', name: 'gov.br', url: 'https://www.gov.br/favicon.ico' },
            { id: 'mercadolivre', name: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/favicon.ico' },
            { id: 'magalu', name: 'Magalu', url: 'https://www.magazineluiza.com.br/favicon.ico' },
            { id: 'americanas', name: 'Americanas', url: 'https://www.americanas.com.br/favicon.ico' },
            { id: 'ifood', name: 'iFood', url: 'https://www.ifood.com.br/favicon.ico' },
            { id: 'olx', name: 'OLX Brasil', url: 'https://www.olx.com.br/favicon.ico' },
            { id: 'nubank', name: 'Nubank', url: 'https://nubank.com.br/favicon.ico', iconDomain: 'blog.nubank.com.br' },
            { id: 'picpay', name: 'PicPay', url: 'https://picpay.com/favicon.ico' },
            { id: 'serasa', name: 'Serasa', url: 'https://www.serasa.com.br/favicon.ico' },
            { id: 'reclameaqui', name: 'Reclame Aqui', url: 'https://www.reclameaqui.com.br/favicon.ico' },
        ],
    },
    {
        id: 'germany',
        emoji: '🇩🇪',
        members: [
            { id: 'deutsche-bahn', name: 'Deutsche Bahn', url: 'https://www.bahn.de/favicon.ico' },
            { id: 'dhl-de', name: 'DHL', url: 'https://www.dhl.de/favicon.ico' },
            { id: 'otto', name: 'OTTO', url: 'https://www.otto.de/favicon.ico' },
            { id: 'spiegel', name: 'DER SPIEGEL', url: 'https://www.spiegel.de/favicon.ico' },
            { id: 'check24', name: 'CHECK24', url: 'https://www.check24.de/favicon.ico' },
            { id: 'bund-de', name: 'Bund.de', url: 'https://www.bund.de/favicon.ico' },
            { id: 'tagesschau', name: 'tagesschau', url: 'https://www.tagesschau.de/favicon.ico' },
            { id: 'kleinanzeigen', name: 'Kleinanzeigen', url: 'https://www.kleinanzeigen.de/favicon.ico' },
            { id: 'zdf', name: 'ZDF', url: 'https://www.zdf.de/favicon.ico' },
            { id: 'telekom-de', name: 'Deutsche Telekom', url: 'https://www.telekom.de/favicon.ico' },
            { id: 'amazon-de', name: 'Amazon.de', url: 'https://www.amazon.de/favicon.ico' },
            { id: 'google-de', name: 'Google.de', url: 'https://www.google.de/favicon.ico' },
        ],
    },
    {
        id: 'ai',
        emoji: '🤖',
        members: [
            builtinMember('claude'),
            builtinMember('chatgpt'),
            { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/favicon.ico' },
            { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/favicon.ico', iconDomain: 'www.deepseek.com' },
            { id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/favicon.ico' },
            { id: 'midjourney', name: 'Midjourney', url: 'https://www.midjourney.com/favicon.ico' },
            { id: 'suno', name: 'Suno', url: 'https://suno.com/favicon.ico' },
            { id: 'manus', name: 'Manus', url: 'https://manus.im/favicon.ico' },
            { id: 'mistral', name: 'Mistral', url: 'https://chat.mistral.ai/favicon.ico', iconDomain: 'mistral.ai' },
            { id: 'meta-ai', name: 'Meta AI', url: 'https://www.meta.ai/favicon.ico' },
            { id: 'qwen', name: 'Qwen', url: 'https://chat.qwen.ai/favicon.ico' },
            { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/favicon.ico' },
            { id: 'poe', name: 'Poe', url: 'https://poe.com/favicon.ico' },
            { id: 'characterai', name: 'Character.ai', url: 'https://character.ai/favicon.ico' },
        ],
    },
    {
        id: 'social',
        emoji: '💬',
        members: [
            { id: 'telegram', name: 'Telegram', url: 'https://telegram.org/favicon.ico' },
            { id: 'whatsapp', name: 'WhatsApp', url: 'https://whatsapp.com/favicon.ico' },
            { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/favicon.ico' },
            { id: 'x', name: 'X', url: 'https://x.com/favicon.ico' },
            { id: 'discord', name: 'Discord', url: 'https://discord.com/favicon.ico' },
            { id: 'signal', name: 'Signal', url: 'https://signal.org/favicon.ico' },
            { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/favicon.ico' },
            { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/favicon.ico' },
            { id: 'threads', name: 'Threads', url: 'https://www.threads.com/favicon.ico' },
            { id: 'line', name: 'LINE', url: 'https://line.me/favicon.ico' },
            { id: 'viber', name: 'Viber', url: 'https://www.viber.com/favicon.ico' },
            { id: 'snapchat', name: 'Snapchat', url: 'https://www.snapchat.com/favicon.ico' },
        ],
    },
    {
        id: 'productivity',
        emoji: '💼',
        members: [
            { id: 'notion', name: 'Notion', url: 'https://www.notion.so/front-static/favicon.ico' },
            { id: 'slack', name: 'Slack', url: 'https://slack.com/favicon.ico' },
            { id: 'zoom', name: 'Zoom', url: 'https://zoom.us/favicon.ico' },
            { id: 'figma', name: 'Figma', url: 'https://static.figma.com/app/icon/2/favicon.ico', iconDomain: 'www.figma.com' },
            { id: 'trello', name: 'Trello', url: 'https://trello.com/favicon.ico' },
            { id: 'asana', name: 'Asana', url: 'https://asana.com/favicon.ico' },
            { id: 'dropbox', name: 'Dropbox', url: 'https://cfl.dropboxstatic.com/static/metaserver/static/images/favicon.ico', iconDomain: 'www.dropbox.com' },
            { id: 'canva', name: 'Canva', url: 'https://www.canva.com/favicon.ico' },
            { id: 'miro', name: 'Miro', url: 'https://miro.com/favicon.ico' },
            { id: 'airtable', name: 'Airtable', url: 'https://airtable.com/favicon.ico' },
            { id: 'linear', name: 'Linear', url: 'https://linear.app/favicon.ico' },
            { id: 'clickup', name: 'ClickUp', url: 'https://clickup.com/favicon.ico' },
        ],
    },
    {
        id: 'education',
        emoji: '🎓',
        members: [
            { id: 'coursera', name: 'Coursera', url: 'https://www.coursera.org/favicon.ico' },
            { id: 'edx', name: 'edX', url: 'https://www.edx.org/favicon.ico' },
            { id: 'khan-academy', name: 'Khan Academy', url: 'https://www.khanacademy.org/favicon.ico' },
            { id: 'udemy', name: 'Udemy', url: 'https://www.udemy.com/staticx/udemy/images/v8/favicon-32x32.png' },
            { id: 'duolingo', name: 'Duolingo', url: 'https://www.duolingo.com/robots.txt' },
            { id: 'codecademy', name: 'Codecademy', url: 'https://www.codecademy.com/favicon.ico' },
            { id: 'brilliant', name: 'Brilliant', url: 'https://brilliant.org/favicon.ico' },
            { id: 'skillshare', name: 'Skillshare', url: 'https://www.skillshare.com/favicon.ico' },
            { id: 'futurelearn', name: 'FutureLearn', url: 'https://www.futurelearn.com/favicon.ico' },
            { id: 'masterclass', name: 'MasterClass', url: 'https://www.masterclass.com/favicon-32x32.png' },
            { id: 'leetcode', name: 'LeetCode', url: 'https://leetcode.com/favicon.ico', iconDomain: 'assets.leetcode.com' },
            { id: 'mit-ocw', name: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu/favicon.ico', iconDomain: 'mit.edu' },
        ],
    },
    {
        id: 'streaming',
        emoji: '🎬',
        members: [
            builtinMember('youtube'),
            { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/favicon.ico' },
            { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/favicon.ico' },
            { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/favicon.ico' },
            { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/favicon.ico' },
            { id: 'primevideo', name: 'Prime Video', url: 'https://www.primevideo.com/favicon.ico' },
            { id: 'disneyplus', name: 'Disney+', url: 'https://www.disneyplus.com/favicon.ico' },
            { id: 'hbomax', name: 'HBO Max', url: 'https://www.hbomax.com/favicon.ico' },
            { id: 'appletv', name: 'Apple TV+', url: 'https://tv.apple.com/favicon.ico' },
            { id: 'soundcloud', name: 'SoundCloud', url: 'https://soundcloud.com/favicon.ico' },
            { id: 'vimeo', name: 'Vimeo', url: 'https://vimeo.com/favicon.ico' },
            { id: 'dailymotion', name: 'Dailymotion', url: 'https://www.dailymotion.com/favicon.ico' },
        ],
    },
    {
        id: 'music',
        emoji: '🎵',
        members: [
            { id: 'tidal', name: 'TIDAL', url: 'https://tidal.com/favicon.ico' },
            { id: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/favicon.ico' },
            { id: 'tunein', name: 'TuneIn', url: 'https://tunein.com/favicon.ico' },
            { id: 'youtube-music', name: 'YouTube Music', url: 'https://music.youtube.com/favicon.ico' },
            { id: 'pandora', name: 'Pandora', url: 'https://www.pandora.com/favicon.ico' },
            { id: 'lastfm', name: 'Last.fm', url: 'https://www.last.fm/favicon.ico' },
            { id: 'audiomack', name: 'Audiomack', url: 'https://audiomack.com/favicon.ico' },
            { id: 'musixmatch', name: 'Musixmatch', url: 'https://www.musixmatch.com/favicon.ico' },
            { id: 'apple-music', name: 'Apple Music', url: 'https://music.apple.com/favicon.ico' },
            { id: 'mixcloud', name: 'Mixcloud', url: 'https://www.mixcloud.com/favicon.ico' },
            { id: 'qobuz', name: 'Qobuz', url: 'https://www.qobuz.com/favicon.ico' },
            { id: 'iheart', name: 'iHeartRadio', url: 'https://www.iheart.com/favicon.ico' },
        ],
    },
    {
        id: 'gaming',
        emoji: '🎮',
        members: [
            { id: 'steam', name: 'Steam', url: 'https://store.steampowered.com/favicon.ico' },
            { id: 'epicgames', name: 'Epic Games', url: 'https://store.epicgames.com/favicon.ico', iconDomain: 'www.epicgames.com' },
            { id: 'playstation', name: 'PlayStation', url: 'https://www.playstation.com/favicon.ico' },
            { id: 'xbox', name: 'Xbox', url: 'https://www.xbox.com/favicon.ico' },
            { id: 'riotgames', name: 'Riot Games', url: 'https://www.riotgames.com/favicon.ico' },
            { id: 'nintendo', name: 'Nintendo', url: 'https://www.nintendo.com/favicon.ico' },
            { id: 'ea', name: 'EA', url: 'https://www.ea.com/favicon.ico' },
            { id: 'ubisoft', name: 'Ubisoft', url: 'https://www.ubisoft.com/favicon.ico' },
            { id: 'battlenet', name: 'Battle.net', url: 'https://www.blizzard.com/favicon.ico' },
            { id: 'rockstar', name: 'Rockstar', url: 'https://www.rockstargames.com/favicon.ico' },
            { id: 'roblox', name: 'Roblox', url: 'https://www.roblox.com/favicon.ico' },
            { id: 'itchio', name: 'itch.io', url: 'https://itch.io/favicon.ico' },
        ],
    },
    {
        id: 'developer',
        emoji: '👨‍💻',
        members: [
            builtinMember('github'),
            { id: 'npm', name: 'npm', url: 'https://registry.npmjs.org/favicon.ico', iconDomain: 'www.npmjs.com', siteUrl: 'https://www.npmjs.com' },
            { id: 'dockerhub', name: 'Docker Hub', url: 'https://hub.docker.com/favicon.ico', iconDomain: 'www.docker.com' },
            { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/favicon.ico' },
            { id: 'pypi', name: 'PyPI', url: 'https://pypi.org/favicon.ico' },
            { id: 'gitlab', name: 'GitLab', url: 'https://gitlab.com/favicon.ico' },
            { id: 'bitbucket', name: 'Bitbucket', url: 'https://bitbucket.org/favicon.ico' },
            { id: 'crates', name: 'crates.io', url: 'https://crates.io/favicon.ico' },
            { id: 'maven', name: 'Maven Central', url: 'https://repo.maven.apache.org/favicon.ico', iconDomain: 'maven.apache.org', siteUrl: 'https://maven.apache.org' },
            { id: 'goproxy', name: 'Go Proxy', url: 'https://proxy.golang.org/favicon.ico', iconDomain: 'go.dev', siteUrl: 'https://go.dev' },
            { id: 'homebrew', name: 'Homebrew', url: 'https://brew.sh/favicon.ico' },
            { id: 'jetbrains', name: 'JetBrains', url: 'https://www.jetbrains.com/favicon.ico' },
            { id: 'vscode-marketplace', name: 'VS Code Marketplace', url: 'https://marketplace.visualstudio.com/favicon.ico', iconDomain: 'code.visualstudio.com' },
        ],
    },
    {
        id: 'cloud',
        emoji: '☁️',
        members: [
            builtinMember('cloudflare'),
            { id: 'aws', name: 'AWS', url: 'https://aws.amazon.com/favicon.ico' },
            { id: 'azure', name: 'Azure', url: 'https://azure.microsoft.com/favicon.ico' },
            { id: 'gcloud', name: 'Google Cloud', url: 'https://cloud.google.com/favicon.ico' },
            { id: 'vercel', name: 'Vercel', url: 'https://vercel.com/favicon.ico' },
            { id: 'netlify', name: 'Netlify', url: 'https://www.netlify.com/favicon.ico' },
            { id: 'digitalocean', name: 'DigitalOcean', url: 'https://www.digitalocean.com/favicon.ico' },
            { id: 'oraclecloud', name: 'Oracle Cloud', url: 'https://www.oracle.com/favicon.ico' },
            { id: 'akamai', name: 'Akamai', url: 'https://www.akamai.com/favicon.ico' },
            { id: 'fastly', name: 'Fastly', url: 'https://www.fastly.com/favicon.ico' },
            { id: 'jsdelivr', name: 'jsDelivr', url: 'https://cdn.jsdelivr.net/favicon.ico', iconDomain: 'www.jsdelivr.com', siteUrl: 'https://www.jsdelivr.com' },
            { id: 'unpkg', name: 'unpkg', url: 'https://unpkg.com/favicon.ico' },
            { id: 'heroku', name: 'Heroku', url: 'https://www.heroku.com/favicon.ico' },
        ],
    },
    {
        id: 'finance',
        emoji: '💳',
        members: [
            { id: 'paypal', name: 'PayPal', url: 'https://www.paypal.com/favicon.ico' },
            { id: 'wise', name: 'Wise', url: 'https://wise.com/robots.txt' },
            { id: 'revolut', name: 'Revolut', url: 'https://www.revolut.com/robots.txt' },
            { id: 'stripe', name: 'Stripe', url: 'https://stripe.com/favicon.ico' },
            { id: 'visa', name: 'Visa', url: 'https://www.visa.com/robots.txt' },
            { id: 'mastercard', name: 'Mastercard', url: 'https://developer.mastercard.com/favicon.ico', iconDomain: 'www.mastercard.com', siteUrl: 'https://www.mastercard.com' },
            { id: 'western-union', name: 'Western Union', url: 'https://www.westernunion.com/robots.txt' },
            { id: 'payoneer', name: 'Payoneer', url: 'https://www.payoneer.com/robots.txt' },
            { id: 'klarna', name: 'Klarna', url: 'https://docs.klarna.com/favicon.ico', iconDomain: 'www.klarna.com', siteUrl: 'https://www.klarna.com' },
            { id: 'monzo', name: 'Monzo', url: 'https://monzo.com/robots.txt' },
        ],
    },
    {
        id: 'crypto',
        emoji: '💰',
        members: [
            { id: 'binance', name: 'Binance', url: 'https://www.binance.com/favicon.ico' },
            { id: 'coinbase', name: 'Coinbase', url: 'https://www.coinbase.com/favicon.ico' },
            { id: 'okx', name: 'OKX', url: 'https://www.okx.com/favicon.ico' },
            { id: 'kraken', name: 'Kraken', url: 'https://www.kraken.com/favicon.ico' },
            { id: 'bybit', name: 'Bybit', url: 'https://www.bybit.com/favicon.ico' },
            { id: 'kucoin', name: 'KuCoin', url: 'https://www.kucoin.com/favicon.ico' },
            { id: 'gate', name: 'Gate', url: 'https://www.gate.io/favicon.ico' },
            { id: 'bitget', name: 'Bitget', url: 'https://www.bitget.com/favicon.ico' },
            { id: 'htx', name: 'HTX', url: 'https://www.htx.com/favicon.ico' },
            { id: 'mexc', name: 'MEXC', url: 'https://www.mexc.com/favicon.ico' },
            { id: 'coinmarketcap', name: 'CoinMarketCap', url: 'https://coinmarketcap.com/favicon.ico' },
            { id: 'coingecko', name: 'CoinGecko', url: 'https://www.coingecko.com/favicon.ico' },
        ],
    },
    {
        id: 'ecommerce',
        emoji: '🛒',
        members: [
            { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/favicon.ico' },
            { id: 'aliexpress', name: 'AliExpress', url: 'https://www.aliexpress.com/favicon.ico' },
            { id: 'temu', name: 'Temu', url: 'https://www.temu.com/favicon.ico' },
            { id: 'shein', name: 'SHEIN', url: 'https://www.shein.com/favicon.ico' },
            { id: 'alibaba', name: 'Alibaba.com', url: 'https://www.alibaba.com/favicon.ico' },
            { id: 'ebay', name: 'eBay', url: 'https://www.ebay.com/favicon.ico' },
            { id: 'etsy', name: 'Etsy', url: 'https://www.etsy.com/favicon.ico' },
            { id: 'shopify', name: 'Shopify', url: 'https://www.shopify.com/favicon.ico' },
            { id: 'walmart', name: 'Walmart', url: 'https://www.walmart.com/favicon.ico' },
            { id: 'shopee', name: 'Shopee', url: 'https://shopee.com/favicon.ico' },
            { id: 'mercadolibre', name: 'Mercado Libre', url: 'https://www.mercadolibre.com/favicon.ico' },
            { id: 'rakuten', name: 'Rakuten', url: 'https://www.rakuten.co.jp/favicon.ico' },
        ],
    },
    {
        id: 'news',
        emoji: '📰',
        members: [
            { id: 'bbc', name: 'BBC', url: 'https://www.bbc.com/favicon.ico' },
            { id: 'reuters', name: 'Reuters', url: 'https://www.reuters.com/favicon.ico' },
            { id: 'apnews', name: 'AP News', url: 'https://apnews.com/favicon.ico' },
            { id: 'cnn', name: 'CNN', url: 'https://edition.cnn.com/favicon.ico', iconDomain: 'www.cnn.com' },
            { id: 'nytimes', name: 'The New York Times', url: 'https://www.nytimes.com/favicon.ico' },
            { id: 'guardian', name: 'The Guardian', url: 'https://www.theguardian.com/favicon.ico' },
            { id: 'dw', name: 'DW', url: 'https://www.dw.com/favicon.ico' },
            { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/favicon.ico' },
            { id: 'france24', name: 'France 24', url: 'https://www.france24.com/favicon.ico' },
            { id: 'bloomberg', name: 'Bloomberg', url: 'https://www.bloomberg.com/favicon.ico' },
            { id: 'wikipedia', name: 'Wikipedia', url: 'https://www.wikipedia.org/favicon.ico' },
        ],
    },
];

// Icons shown stacked on the "Add Test" grid tile — a hand-picked mix of
// flag emoji and high-recognition brands that reads as "there are curated
// lists inside". Kept here so the tile and the lists stay in one file.
export const TILE_PREVIEW = [
    { type: 'favicon', id: 'reddit' },
    { type: 'favicon', id: 'yandex' },
    { type: 'favicon', id: 'zarinpal' },
    { type: 'favicon', id: 'xiaohongshu' },
    { type: 'favicon', id: 'nytimes' },
    { type: 'favicon', id: 'telegram' },
    { type: 'favicon', id: 'netflix' },
];

// IP 数据源定义（refactor/04）
//
// 每项：{ id, text, url, enabled }
// - id    数字标识，App 内其他地方通过 id 引用（例如 userPreferences.ipGeoSource）
// - text  UI 展示名，也是查找 key（例如 `WebRtcTest.vue` 找 "MaxMind"）
// - url   模板字符串，{{ip}} 与 {{lang}} 会被 buildDbUrl() 替换
// - enabled 初始使能状态（用户可在 Preferences 里切换，store 会写回这个字段）

export const IP_DATABASES = [
  { id: 0, text: 'IPCheck.ing', url: '/api/ipchecking?ip={{ip}}&lang={{lang}}', enabled: true },
  { id: 1, text: 'IPinfo.io', url: '/api/ipinfo?ip={{ip}}', enabled: true },
  { id: 2, text: 'IP-API.com', url: '/api/ipapicom?ip={{ip}}&lang={{lang}}', enabled: true },
  { id: 3, text: 'IPAPI.is', url: '/api/ipapiis?ip={{ip}}', enabled: true },
  { id: 4, text: 'IP2Location.io', url: '/api/ip2location?ip={{ip}}', enabled: true },
  { id: 5, text: 'IP.sb', url: '/api/ipsb?ip={{ip}}', enabled: true },
  { id: 6, text: 'MaxMind', url: '/api/maxmind?ip={{ip}}&lang={{lang}}', enabled: true },
];

/**
 * 返回一份全新的 ipDBs 数组（store state 初始值），不与导出的 IP_DATABASES 共享引用。
 * 每条记录也是新对象 —— 用户改 enabled 不会污染定义。
 */
export function createInitialIpDBs() {
  return IP_DATABASES.map((db) => ({ ...db }));
}

/**
 * 纯函数：根据数据源记录和 IP/lang 渲染最终请求 URL。
 * 提取到 data 层是为了方便单测，避免依赖 Pinia store。
 */
export function buildDbUrl(db, ip, lang) {
  if (!db || !db.url) return null;
  return db.url.replace('{{ip}}', ip).replace('{{lang}}', lang || 'en');
}

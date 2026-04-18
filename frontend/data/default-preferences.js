// 用户偏好默认值（refactor/04）
//
// 当 localStorage 里没有 userPreferences 键，或者缺失字段时，用这份默认值兜底。
// store.loadPreferences() 会合并 localStorage 覆盖值。

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'auto', // auto | light | dark
  connectivityAutoRefresh: false,
  simpleMode: false,
  autoStart: true,
  hideUnavailableIPStack: false,
  popupConnectivityNotifications: true,
  ipCardsToShow: 2,
  ipGeoSource: 0,
  lang: 'auto', // auto | zh | en | fr | tr
});

/**
 * 返回一份全新的默认偏好对象（可写副本）。
 * 避免调用方直接修改 DEFAULT_PREFERENCES（Object.freeze 也会阻止）。
 */
export function createDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES };
}

// 页面主要 section ID（refactor/04）
//
// 这组 ID 在多处被使用：
//   - store.mountingStatus / loadingStatus 的 key 集合
//   - composables/use-section-tracking.js 的 scroll 监听与 `store.changeSection()`
//   - App.vue 快捷键滚动目标
//   - Nav.vue 顶部导航项循环
//
// 以前每个消费方各自硬编码，容易漂移。统一到这里作为唯一真相源。

export const SECTION_IDS = [
  'IPInfo',
  'Connectivity',
  'WebRTC',
  'DNSLeakTest',
  'SpeedTest',
  'AdvancedTools',
];

export const DEFAULT_SECTION = 'IPInfo';

// store.mountingStatus key 映射（小写 snake-ish 形式，与历史命名兼容）
const MOUNTING_KEYS = [
  'ipcheck',
  'connectivity',
  'webrtc',
  'dnsleaktest',
  'speedtest',
  'advancedtools',
];

// store.loadingStatus key 映射（是 mounting 的子集：不含 speedtest / advancedtools）
const LOADING_KEYS = [
  'ipcheck',
  'connectivity',
  'webrtc',
  'dnsleaktest',
];

function createStatusObject(keys) {
  return keys.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

/** 返回一份全新的 mountingStatus 初始对象 */
export function createMountingStatus() {
  return createStatusObject(MOUNTING_KEYS);
}

/** 返回一份全新的 loadingStatus 初始对象 */
export function createLoadingStatus() {
  return createStatusObject(LOADING_KEYS);
}

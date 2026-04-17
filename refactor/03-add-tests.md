# 03 — 增加单元测试

**目标**：扩展现有 Node 内置 test runner 测试覆盖，给后续重构（特别是 01、02、04）提供安全网。

**状态**：✅ 完成

**测试栈**：**Node 内置 `node --test`**（不引入 Vitest / Jest，避免增加依赖）。
**位置**：根目录 `tests/`，文件命名 `xxx.test.js`，用 `node:test` + `node:assert/strict`。

---

## 已经完成（dev 分支已合入）

- [x] `package.json` 加 scripts：`"test": "node --test tests/*.test.js"`、`"check": "npm run test && npm run build"`
- [x] 根目录建立 `tests/` 目录
- [x] `common/valid-ip.js` + `frontend/utils/valid-ip.js` 测试（`tests/valid-ip.test.js`）
- [x] API smoke 测试（`tests/api-smoke.test.js`）：覆盖 referer 检查 + configs / map / maxmind / dns 早期校验路径，无网络调用

> 现状参考：跑 `npm test` 应全绿。新增测试请遵循同样的 ESM + `node:test` 风格，避免引入新依赖。

---

## 待办子任务

### 阶段 A — utils 纯函数补齐

- [x] `frontend/utils/transform-ip-data.js` — 各类 raw 输入到统一卡片数据的映射 / 边界
- [x] `frontend/utils/masked-info.js` — 遮罩输出格式（mock i18n t 函数）
- [x] `frontend/utils/country-name.js` — 国家代码 → 名称映射 + 兜底
- [x] `frontend/utils/timestamp-to-date.js` — 时区与格式
- [x] `frontend/utils/system-detect.js` — UA 模拟测试 OS / Mobile 判定
- [x] `frontend/utils/speedtest-colos.js` — 数据查询函数
- [ ] `frontend/utils/shortcut.js` — 跳过：模块加载时 `document.addEventListener('keydown', ...)` 有副作用，且 `navigateCards` 操作 DOM 高度依赖 CSS class/ref，Node 环境测成本高于收益。替代方案：02 拆分后 composables 里的 shortcut 编排行为走阶段 C 的 composable 测（更贴近真实使用）

### 阶段 B — API smoke 扩展 ✅

已覆盖所有后端 handler 的 referer / 方法 / 参数早期校验路径（tests/api-handlers.test.js）：

- [x] `api/get-user-info.js`
- [x] `api/get-whois.js`
- [x] `api/cf-radar.js`
- [x] `api/invisibility-test.js`
- [x] `api/ip-sb.js` / `api/ipapi-com.js` / `api/ipapi-is.js` / `api/ipcheck-ing.js` / `api/ipinfo-io.js` / `api/ip2location-io.js`
- [x] `api/mac-checker.js`
- [x] `api/update-user-achievement.js`
- [x] `api/dns-resolver.js` 的更多分支（hostname 非字符串 / hostname 不含 dot）

### 阶段 C — composables 测试 ✅

02 拆出的 4 个 composable 全部补齐（tests/composable-*.test.js）：

- [x] `use-scroll-to.js`
- [x] `use-info-mask.js` — 覆盖 level 0→1→2→0 完整流程 + allHasLoaded watch
- [x] `use-refresh-orchestrator.js` — loadingControl 两分支 + refresh watch + 递归重试
- [x] `use-shortcuts.js` — 注册行为 + 关键快捷键 action 逻辑（R / 数字 / ? / h 等）

为让 composables 能在 Node 环境下被 import，做了三处 portability 小修：
- `frontend/composables/use-info-mask.js` / `use-shortcuts.js` 的 `@/` 别名改为相对路径
- `frontend/utils/use-analytics.js` 的 `import.meta.env` 用可选链兜底

### 阶段 D — store 测试 ✅

- [x] `store.js` 所有关键 action 的契约测试（tests/store.test.js，27 用例覆盖
  setAlert / setLoadingStatus / setRefreshEveryThing / setCurrentPath / setDarkMode /
  toggleSheet / updateIPDBs / updateAllIPs / setPreferences / loadPreferences / trigger* 等）
- [x] getter 测试（allHasLoaded / activeSources / curlDomainsHadSet）
- [x] getDbUrl 委托 buildDbUrl 的间接契约
- [x] 04 任务的成就相关数据已在 tests/achievements.test.js 里覆盖

为让 store 能在 Node 环境下被 import，做了几处 portability 小修：
- `frontend/store.js` 的 `./locales/i18n` 补上 `.js` 后缀
- `frontend/locales/i18n.js` 的 JSON import 统一加 `with { type: 'json' }`（Vite + Node 都支持）
- `frontend/firebase-init.js` / `frontend/store.js` 的 `import.meta.env` 全部用可选链

### 阶段 E — 共享与后端 ✅

- [x] `common/referer-check.js` — 独立测试覆盖 localhost 兜底、多域配置、子域边界、畸形 URL（tests/referer-check.test.js）
- [x] `common/maxmind-service.js` — 路径 / ready 契约 + 真实 DB 端到端查询（仓库自带 GeoLite2 数据）

---

## Vue 组件测试（不在本阶段范围）

Node test runner 测 Vue SFC 需要额外编译/jsdom 配置，会破坏"零依赖"原则。**本阶段不做组件测试**，需要时单独评估方案。

---

## 完成前回顾清单 ✅

- [x] `npm run check` 通过（test + build 全绿）
- [x] 所有新测试文件遵循 `tests/*.test.js` 命名
- [x] 测试不依赖网络（外部 API 测试只覆盖 referer / 参数早 reject 路径）
- [x] 测试不引入新 npm 依赖（全部用 node:test + node:assert/strict + 既有 pinia/vue 运行时）
- [x] 02 任务完成后回头补了 composables 测试
- [x] 04 任务完成后回头补了成就解锁逻辑测试（achievements.test.js 已覆盖）
- [x] 副作用 utils 的处理决定：
  - `use-analytics.js` — 不测；全部依赖浏览器 GA/gtag 注入，Node 环境下逻辑无意义。已做 SSR 可选链修正以便测试其它依赖它的模块
  - `register-service-worker.js` — 不测；依赖 `navigator.serviceWorker`，无单测价值
  - `shortcut.js` — 不直接测；顶层 `document.addEventListener` 是不可避免的模块副作用。通过 `use-shortcuts.js` 的组合测试间接覆盖了 `mappingKeys` 行为

---

## 最终产出

新增测试文件（14 个）：

- tests/valid-ip.test.js（既有）
- tests/achievements.test.js（既有）
- tests/default-preferences.test.js（既有）
- tests/ip-databases.test.js（既有）
- tests/sections.test.js（既有）
- tests/api-smoke.test.js（既有）
- tests/country-name.test.js
- tests/masked-info.test.js
- tests/speedtest-colos.test.js
- tests/system-detect.test.js
- tests/timestamp-to-date.test.js
- tests/transform-ip-data.test.js
- tests/api-handlers.test.js
- tests/composable-scroll-to.test.js
- tests/composable-info-mask.test.js
- tests/composable-refresh-orchestrator.test.js
- tests/composable-shortcuts.test.js
- tests/store.test.js
- tests/referer-check.test.js
- tests/maxmind-service.test.js

总用例数：**211 个测试、52 个 suite，全绿**。

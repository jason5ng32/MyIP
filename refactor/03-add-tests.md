# 03 — 增加单元测试

**目标**：扩展现有 Node 内置 test runner 测试覆盖，给后续重构（特别是 01、02、04）提供安全网。

**状态**：🟢 进行中（基础设施 + 部分 utils + 部分 API smoke 已完成）

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

### 阶段 B — API smoke 扩展

> 已覆盖 4 个 handler（configs / map / maxmind / dns），剩余 handler 用同样风格补齐：

- [ ] `api/get-user-info.js`
- [ ] `api/get-whois.js`
- [ ] `api/cf-radar.js`
- [ ] `api/invisibility-test.js`
- [ ] `api/ip-sb.js` / `api/ipapi-com.js` / `api/ipapi-is.js` / `api/ipcheck-ing.js` / `api/ipinfo-io.js` / `api/ipapi-com.js` / `api/ip2location-io.js`（外部 IP 源，重点测 referer 校验和参数早期 reject 路径，**不要发真实请求**）
- [ ] `api/mac-checker.js`
- [ ] `api/update-user-achievement.js`
- [ ] `api/dns-resolver.js` 的更多分支（已有基础覆盖，可补错误路径）

### 阶段 C — composables 测试（依赖 02 任务）

> 02 拆出 composables 后回来补充：

- [ ] `useShortcuts.js`
- [ ] `useInfoMask.js`
- [ ] `useRefreshOrchestrator.js`

### 阶段 D — store 测试

- [ ] `store.js` 关键 action：`setAlert` / `setLoadingStatus` / `setRefreshEveryThing` / `setCurrentPath`
- [ ] 04 任务完成后，针对成就数据加载 / 解锁逻辑添加测试（`createInitialAchievementsState()` 等）

### 阶段 E — 共享与后端

- [ ] `common/referer-check.js` — 已被 api-smoke 间接覆盖，可补独立测试覆盖更多组合
- [ ] `common/maxmind-service.js` — 接口契约测试（mock fs / db）

---

## Vue 组件测试（不在本阶段范围）

Node test runner 测 Vue SFC 需要额外编译/jsdom 配置，会破坏"零依赖"原则。**本阶段不做组件测试**，需要时单独评估方案。

---

## 完成前回顾清单

- [ ] `npm run check` 通过
- [ ] 所有新测试文件遵循 `tests/*.test.js` 命名
- [ ] 测试不依赖网络（外部 API 测试只覆盖 referer / 参数早 reject 路径）
- [ ] 测试不引入新 npm 依赖
- [ ] 02 任务完成后是否回头补了 composables 测试
- [ ] 04 任务完成后是否回头补了成就解锁逻辑测试
- [ ] 是否有"看上去是纯函数但其实有副作用"的 utils 被遗漏（`use-analytics.js` / `register-service-worker.js` 这类带副作用的需要明确决定测不测，并在本文档登记决定）

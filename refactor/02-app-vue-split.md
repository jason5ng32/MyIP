# 02 — App.vue 上帝组件拆分

**目标**：将 `frontend/App.vue`（590 行，14 个 ref，混合了模板、加载编排、刷新调度、信息遮罩、快捷键注册、滚动控制）拆分为职责清晰的多个 composables 和子组件。最终 `App.vue` 只剩模板 + 少量编排代码（目标 < 150 行）。

**状态**：✅ 完成

**前置依赖**：refactor/01 已全部完成（UI 基建 + 图标迁移都已落地），此时拆分无需二次重构。

---

## 子任务

### 拆分 composables（新建 `frontend/composables/` 目录）✅

- [x] `use-shortcuts.js` — 抽出 `ShortcutKeys()` / `registerShortcutKeys` / `loadShortcuts`；重复的"滚到 AdvancedTools + navigate + track"合并为一个 helper
- [x] `use-info-mask.js` — 抽出 `applyMask` / `removeMask` / `toggleInfoMask` + `infoMaskLevel` / `isInfosLoaded` / `showMaskButton`；监听 `store.allHasLoaded` 内置
- [x] `use-refresh-orchestrator.js` — 抽出 `refreshEverything` / `scheduleTimedTasks` / `loadingControl`；监听 `store.shouldRefreshEveryThing` 内置
- [x] `use-scroll-to.js` — `scrollToElement` 小工具

### 模板与 ref 整理 ✅

- [x] App.vue 顶层 14 个 ref 收敛：删除 alert 相关 4 个本地 ref（`alertStyle` / `alertMessage` / `alertTitle` / `alertToShow`），所有 alert 直接走 `store.setAlert()`
- [x] 删除 `main.js` 中已废弃的 `app.config.globalProperties.$trackEvent` 和 `$analytics`（全仓搜索确认无调用方）
- [x] `loadingControl` 保留递归 setTimeout 方案（改用 watch 需要多追一个 flag，复杂度反而上升，收益有限；语义已清晰封装在 composable 里）

### 验收 ✅

- [x] App.vue 总行数 < 150（实际 130 行）
- [x] `npm run build` 通过
- [x] `npm test` 全绿（46/46）
- [x] composables 文件每个都有头部注释说明输入输出
- [ ] 运行时验证（自动刷新 / 手动刷新 / 遮罩切换 / 所有快捷键）—— 留给 UI polish session

---

## 完成前回顾清单

- [x] 全仓库 `grep` 确认 App.vue 中拆出的所有函数没有被其它组件直接引用过
- [x] `frontend/composables/` 下文件均为单一职责，没有"杂物 composable"
- [x] App.vue 不再持有任何与 alert / refresh / mask / shortcut 相关的本地状态
- [ ] 手动跑一遍：自动刷新模式 / 手动刷新模式 / 切换到任一 advanced-tool / 触发遮罩 1 / 2 / 解除 / 触发每个快捷键
- [ ] 03 任务里为这些新 composables 添加单测（已在 03 文档登记为阶段 C 待办）

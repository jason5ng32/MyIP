# 02 — App.vue 上帝组件拆分

**目标**：将 `frontend/App.vue`（590 行，14 个 ref，混合了模板、加载编排、刷新调度、信息遮罩、快捷键注册、滚动控制）拆分为职责清晰的多个 composables 和子组件。最终 `App.vue` 只剩模板 + 少量编排代码（目标 < 150 行）。

**状态**：🟡 未开始

**前置依赖**：阶段 A 不强制，但**强烈建议在 01 阶段 B 完成后**再做，以避免拆分后又因 UI 框架替换而再次重构。

---

## 子任务

### 拆分 composables（新建 `frontend/composables/` 目录）

- [ ] `useShortcuts.js` — 抽出 `ShortcutKeys()` 函数（约 270 行）和 `registerShortcutKeys` / `loadShortcuts`
  - 入参：各组件 ref 集合 + configs + i18n t 函数
  - 出参：`registerAll()` / `keyMap`
- [ ] `useInfoMask.js` — 抽出 `infoMask` / `infoUnmask` / `toggleInfoMask` + `infoMaskLevel` 状态
  - 入参：各组件 ref（IPCheck / webRTC / dnsLeaks）
  - 出参：`infoMaskLevel`、`toggleInfoMask`、`showMaskButton`
- [ ] `useRefreshOrchestrator.js` — 抽出 `refreshEverything` / `scheduleTimedTasks` / `loadingControl`
  - 与 store 的 `mountingStatus` / `loadingStatus` / `shouldRefreshEveryThing` 协作
- [ ] `useScrollTo.js` — 抽出 `scrollToElement`（小工具）

### Store 改造

- [ ] 将刷新编排（refreshTasks）从 App.vue 移入 store action `refreshEverything()`
- [ ] App.vue 只 watch `shouldRefreshEveryThing` 并触发 store action

### 模板与 ref 整理

- [ ] App.vue 顶层 14 个 ref 收敛：能用 store 状态替代的尽量替代（特别是 alert 相关的 4 个 ref，已经在 store 里有 `setAlert`）
- [ ] 删除 App.vue 中已废弃的 `app.config.globalProperties.$trackEvent`（如果确认 components 都已直接从 utils 导入 `trackEvent`）
- [ ] App.vue 顶部 `loadingControl` 的递归 setTimeout 改为基于 store getter 的 watch

### 验收

- [ ] App.vue 总行数 < 150
- [ ] 所有快捷键功能验证通过
- [ ] 信息遮罩 3 级切换正常
- [ ] 自动刷新 / 手动刷新行为不变
- [ ] composables 文件每个都有头部注释说明输入输出

---

## 完成前回顾清单

- [ ] 全仓库 `grep` 确认 App.vue 中拆出的所有函数没有被其它组件直接引用过
- [ ] `frontend/composables/` 下文件均为单一职责，没有"杂物 composable"
- [ ] App.vue 不再持有任何与 alert / refresh / mask / shortcut 相关的本地状态
- [ ] 手动跑一遍：自动刷新模式 / 手动刷新模式 / 切换到任一 advanced-tool / 触发遮罩 1 / 2 / 解除 / 触发每个快捷键
- [ ] 03 任务里有没有可以为这些新 composables 添加单测的位置（应该有，去补 03 的清单）

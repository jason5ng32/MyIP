# 04 — store.js 硬编码数据治理

**目标**：将 `frontend/store.js` 中硬编码的数据（主要是 21 条 `userAchievements`、可能还有其它常量）抽离到独立数据文件，store 只持有可变状态和 actions，便于维护、便于测试、便于未来本地化与扩展。

**状态**：✅ 已完成

---

## 子任务

### 阶段 A — 现状盘点 ✅

- [x] 通读 `frontend/store.js`，列出所有"硬编码常量数据"候选清单
- [x] 在本文件下方"盘点结果"小节登记发现项（5 类，其中 4 类可抽离）

### 阶段 B — achievements 抽离 ✅

- [x] 新建 `frontend/data/achievements.js`：`ACHIEVEMENTS_DEFINITIONS` 数组（name / img，不含状态）+ `createInitialAchievementsState()` 工厂
- [x] store 的 `state.userAchievements` 改为调用工厂初始化
- [x] 校验所有读取 `userAchievements` 的地方（`Achievements.vue` / `App.vue` / `User.vue` / `SpeedTest.vue` / `CensorshipCheck.vue` / `Whois.vue` / `SecurityChecklist.vue` / `RuleTest.vue` / `InvisibilityTest.vue` / `Preferences.vue`）形状未改，行为不变
- [x] `IAmHuman` 图片路径缺失的 leading `/` 修正，全部统一到 `/achievements/...`

### 阶段 C — 其它硬编码 ✅

- [x] **ipDBs** → `frontend/data/ip-databases.js`：导出 `IP_DATABASES`（定义）、`createInitialIpDBs()`（工厂）、`buildDbUrl(db, ip, lang)`（纯函数）。`store.getDbUrl()` 改为 find + buildDbUrl。
- [x] **defaultPreferences** → `frontend/data/default-preferences.js`：导出 `DEFAULT_PREFERENCES`（Object.freeze）+ `createDefaultPreferences()`。`store.loadPreferences()` 改用工厂。
- [x] **SECTION_IDS / mountingStatus / loadingStatus** → `frontend/data/sections.js`：导出 `SECTION_IDS`、`DEFAULT_SECTION`、`createMountingStatus()`、`createLoadingStatus()`。store 的三处初始化 + `Patch.vue` 里原先硬编码的 `sectionIds` 数组全部改用共享源。

### 阶段 D — 测试 ✅

- [x] `tests/achievements.test.js`：21 条定义、路径格式、工厂独立性、runtime shape
- [x] `tests/ip-databases.test.js`：7 条定义、工厂独立性、`buildDbUrl` 的模板替换 / 默认 lang / 无 {{lang}} 占位符 / 空输入
- [x] `tests/default-preferences.test.js`：freeze、shape、工厂独立性
- [x] `tests/sections.test.js`：SECTION_IDS 顺序、工厂独立性

---

## 盘点结果

| # | 项 | 所在行号 | 性质 | 归宿 |
|---|---|---|---|---|
| 1 | `userAchievements`（21 条 name+img 对象图） | 19–41 | 静态定义 + 运行时状态混合 | 抽离定义到 `data/achievements.js`，store state 由工厂函数生成。**同时修正** `IAmHuman` 图片路径缺失的 leading `/`。 |
| 2 | `ipDBs`（7 个 IP 数据源的 id/text/url/enabled） | 82–90 | 纯静态定义 | 抽到 `data/ip-databases.js`。URL 模板替换（`getDbUrl` action）同时抽成纯函数 `buildDbUrl(db, ip, lang)`。 |
| 3 | `defaultPreferences`（10 个用户偏好默认值） | 173–184 (action 内) | 纯静态定义 | 抽到 `data/default-preferences.js`。 |
| 4 | 段落 ID 列表（`mountingStatus`/`loadingStatus` 的 key + 初始 `currentSection`） | 45–52、62–67、81 | 跨文件共享常量（还被 `Patch.vue` 和 App.vue ShortcutKeys 使用） | 抽到 `data/sections.js`，导出 `SECTION_IDS` + `createMountingStatus()` + `createLoadingStatus()`；store、Patch.vue 都改用共享源。 |
| 5 | `alert` / `curl` / `configs` / `userPreferences` 初始对象 | 74–80、53–57、72、73 | 运行时 state 容器 | **保留在 store**，不是硬编码数据，只是 state 默认值结构。 |

---

## 完成前回顾清单

- [ ] `frontend/store.js` 中已无大段静态对象字面量
- [ ] `frontend/data/` 下文件均为纯数据 + 纯函数，无副作用、无 store 依赖
- [ ] 全仓库 grep 确认所有 `userAchievements` 的读写仍走 store，没有组件直接 import 数据文件硬编码
- [ ] 图片路径前缀问题已统一并验证渲染
- [ ] 任何新增导出都在文件顶部注释说明用途
- [ ] 已与 03 任务联动，补充必要的单测

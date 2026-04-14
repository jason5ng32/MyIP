# 04 — store.js 硬编码数据治理

**目标**：将 `frontend/store.js` 中硬编码的数据（主要是 21 条 `userAchievements`、可能还有其它常量）抽离到独立数据文件，store 只持有可变状态和 actions，便于维护、便于测试、便于未来本地化与扩展。

**状态**：🟡 未开始

---

## 子任务

### 阶段 A — 现状盘点

- [ ] 通读 `frontend/store.js`，列出所有"硬编码常量数据"候选清单（不仅仅是 achievements，可能还有默认偏好、curl 域名映射等）
- [ ] 在本文件下方"盘点结果"小节登记发现项

### 阶段 B — achievements 抽离

- [ ] 新建 `frontend/data/achievements.js`，导出形如 `export const ACHIEVEMENTS_DEFINITIONS = [...]` 的数组（定义：`name` / `img`），不含状态字段（`achieved` / `achievedTime` / `showDetails`）
- [ ] 新建工厂函数 `createInitialAchievementsState()`，根据定义生成初始状态对象
- [ ] store 的 `state.userAchievements` 改为调用工厂函数初始化
- [ ] 校验所有读取 `userAchievements` 的地方（`Achievements.vue` / `App.vue` / 触发解锁的 utils）行为不变
- [ ] 成就元数据（图片路径前缀不一致问题：`'achievements/iamhuman.webp'` vs `/achievements/...`）顺手统一

### 阶段 C — 其它硬编码

- [ ] 处理盘点中发现的其它项（具体子任务在阶段 A 完成后补齐到这里）

### 阶段 D — 测试

- [ ] 在 03 的覆盖范围里补：`createInitialAchievementsState()` 单测、关键解锁逻辑回归测试

---

## 盘点结果

> 阶段 A 完成后填写。每项注明：所在行号、内容性质、建议归宿（data/ 目录、constants 文件、保留在 store）。

- (待填写)

---

## 完成前回顾清单

- [ ] `frontend/store.js` 中已无大段静态对象字面量
- [ ] `frontend/data/` 下文件均为纯数据 + 纯函数，无副作用、无 store 依赖
- [ ] 全仓库 grep 确认所有 `userAchievements` 的读写仍走 store，没有组件直接 import 数据文件硬编码
- [ ] 图片路径前缀问题已统一并验证渲染
- [ ] 任何新增导出都在文件顶部注释说明用途
- [ ] 已与 03 任务联动，补充必要的单测

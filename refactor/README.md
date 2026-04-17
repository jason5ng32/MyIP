# 重构计划索引

> 本目录管理 MyIP 当前阶段的重构任务。每个文件对应一个独立子项目。

启动日期：2026-04-15

---

## 子任务总览

| # | 文件 | 主题 | 状态 |
|---|---|---|---|
| 01 | [01-bootstrap-to-tailwind.md](./01-bootstrap-to-tailwind.md) | Bootstrap → Tailwind + shadcn-vue（彻底替换） | 🟢 进行中（Bootstrap JS 已全部移除；Bootstrap CSS 仍保留，等 C.2 模板逐组件改写完成后再卸载） |
| 02 | [02-app-vue-split.md](./02-app-vue-split.md) | App.vue 上帝组件拆分 | 🟡 未开始 |
| 03 | [03-add-tests.md](./03-add-tests.md) | 增加单元测试（Node `node --test`） | 🟢 进行中（基建+部分用例已完成于 dev） |
| 04 | [04-store-hardcoded.md](./04-store-hardcoded.md) | store.js 硬编码数据治理 | ✅ 已完成 |

状态图例：🟡 未开始 / 🟢 进行中 / ✅ 已完成 / ⚪ 已取消

---

## 推荐顺序

虽然顺序不强制，但建议这样推进，理由是后一项依赖前一项的成果：

1. **先 01（Bootstrap → Tailwind）的基础设施部分**（装 Tailwind / shadcn-vue / Sheet 替换 Offcanvas），因为 02（App.vue 拆分）会动到大量模板和命令式 Bootstrap 调用，先有新 UI 基建可以避免做两次。
2. **同时启动 03（测试基建）**——给 utils/ 加 Vitest，这是后续重构的安全网。
3. **04（store 硬编码）** 可以独立穿插进行，影响面小。
4. **02（App.vue 拆分）** 放到 01 推进过半再做，拆出的 composables 会更干净。

---

## 完成纪律（重要）

**每次将子任务从 `[ ]` 改成 `[x]` 之前，必须执行以下检查：**

1. **全局搜索回扫**：用 grep / Glob 搜索该子任务相关的关键词（如某个被替换的 Bootstrap class、被移除的 import、被抽离的函数名），确认全仓库没有遗漏的引用。
2. **同类场景扫描**：思考"这个改动是否还有类似场景没处理"。比如替换了一个 Modal，确认其它 Modal 是否同样需要替换；抽出一个 composable，确认是否还有重复逻辑可以合并。
3. **运行时验证**：能跑就跑（`npm run dev` / `npm run build` / `npm test`），看构建/测试是否仍通过。
4. **更新本 README 的总览表**：状态从 🟡 / 🟢 改为 ✅。
5. **如果发现遗漏**：不要勾选，回到计划文件补充新子项后再继续。

每个计划文件末尾都有一个"完成前回顾清单"小节，列出该任务特定的检查点。

---

## 范围约束

当前阶段**只做**这 4 件事。其它建议（TypeScript 化、Biome 接入、依赖瘦身、circle-progress 替换、firebase 动态加载、vue-router 版本核对等）暂不进入计划，避免范围蔓延。

完成 4 项后再评估下一阶段做什么。

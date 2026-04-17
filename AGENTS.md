# AGENTS.md

> 本文件给 AI 协作者（Claude / Codex 等）阅读。说明项目结构、约定、当前重构状态。

---

## 项目简介

**MyIP** (IPCheck.ing) 是一个开源 IP 工具箱，提供 IP 查询、连通性测试、WebRTC 检测、DNS 泄漏检测、网速测试、Whois、MTR、安全检查等功能。前后端同仓，前端 SPA + Node 后端 API。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Vue 3 (Composition API, `<script setup>`) |
| 状态管理 | Pinia |
| 路由 | vue-router (hash mode) |
| 国际化 | vue-i18n（en / zh / fr / tr） |
| 构建 | Vite |
| UI（重构中） | Bootstrap 5 + bootstrap-icons → 正在迁移到 Tailwind + shadcn-vue |
| 后端 | Express 5 |
| Auth | Firebase Auth（可选，按环境变量启用） |
| PWA | Serwist |
| 测试 | **Node 内置 test runner**（`node --test`，无第三方测试框架） |
| 其它 | chart.js / svgmap / @cloudflare/speedtest / maxmind / whoiser |

---

## 语言与代码风格约定

- **必须使用 JavaScript，不要主动引入 TypeScript。**
  - 新文件用 `.js` / `.vue`，`<script setup>` 不带 `lang="ts"`
  - 不要把 `jsconfig.json` 改成 `tsconfig.json`
  - 用户明确要求 TS 时才使用
- Vue 组件统一 `<script setup>` 写法
- 路径别名 `@` → `frontend/`（见 `jsconfig.json` 与 `vite.config.js`）
- 注释可以写中文，提交信息按现有风格

---

## 目录结构

```
.
├── AGENTS.md                  ← 本文件
├── refactor/                  ← ⚠️ 重构进行中，所有 AI 改动前先看这里
│   ├── README.md              ← 重构索引与总进度
│   ├── 01-bootstrap-to-tailwind.md
│   ├── 02-app-vue-split.md
│   ├── 03-add-tests.md
│   └── 04-store-hardcoded.md
│
├── index.html
├── vite.config.js
├── jsconfig.json
├── package.json
│
├── frontend/                  ← 前端源码（Vite root 的别名 @）
│   ├── App.vue                ← 当前是上帝组件，待拆分（见 refactor/02）
│   ├── main.js                ← 入口、Pinia/i18n/router 装载、全局 tooltip 指令
│   ├── store.js               ← Pinia 主 store，含硬编码 achievements（见 refactor/04）
│   ├── firebase-init.js
│   ├── sw.js                  ← Service Worker 源文件（Serwist）
│   ├── router/                ← 路由（与 Bootstrap Offcanvas 强耦合，见 refactor/01）
│   ├── locales/               ← i18n 文案 + security-checklist 数据
│   ├── style/style.css        ← 全局样式（含 bootstrap import）
│   ├── utils/                 ← 工具函数（valid-ip / transform-ip-data / 快捷键 / 分析等）
│   │   └── getips/            ← 各家 IP 查询源的客户端封装
│   └── components/
│       ├── *.vue              ← 顶层功能区组件（IpInfos / SpeedTest / Advanced 等）
│       ├── ip-infos/          ← IP 卡片相关子组件
│       ├── advanced-tools/    ← MTR / Ping / Whois / Mac / 安全清单 等高级工具
│       ├── widgets/           ← Modal / Toast / Preferences / Help 等通用小部件
│       └── svgicons/          ← 内联 SVG 图标
│
├── api/                       ← 后端 API handlers（被 backend-server.js 装载）
├── common/                    ← 前后端共享：valid-ip、maxmind 服务、referer-check 等
├── public/                    ← 静态资源（logos / achievements 图）
├── tests/                     ← Node test runner 测试（已含 valid-ip / api-smoke）
├── backend-server.js          ← Express API 服务（默认端口 11966）
└── frontend-server.js         ← 仅用于 npm start 的静态文件服务
```

---

## 重构进行中 ⚠️

项目正在分阶段重构。**任何代码改动前，请先阅读 `refactor/README.md`**，确认改动是否落在某个进行中的重构子任务里、有没有冲突、有没有约定的迁移路径。

当前 4 个重构子项目（顺序非强制，但建议从 1 开始）：

1. `refactor/01-bootstrap-to-tailwind.md` — Bootstrap → Tailwind + shadcn-vue
2. `refactor/02-app-vue-split.md` — App.vue 上帝组件拆分
3. `refactor/03-add-tests.md` — 增加单元测试
4. `refactor/04-store-hardcoded.md` — store.js 硬编码治理

**勾选完成项前的纪律：** 每个子任务标记 `[x]` 之前，必须重新扫一遍当前计划文件相关代码，确认没有遗漏的引用、未迁移的同类调用、漏掉的边界场景。详见 `refactor/README.md` 里的"完成纪律"一节。

**shadcn-vue 优先原则（01 阶段 C.2 专用，但原则通用）：** 动手写任何 `<button>` / `<div>` / `<input>` / 表单元素 / 弹层 / 列表结构之前，先在 `frontend/components/ui/` 下查有没有现成 shadcn-vue 组件（Button / Card / Alert / Badge / Input / Select / Checkbox / Switch / Progress / Dialog / Sheet / Tooltip / DropdownMenu / Tabs / Accordion / Collapsible / Sonner …）。缺变体不是理由：`:class` 叠加足以覆盖绝大多数状态色需求，`as-child` 可以让触发器挂到自定义元素上。**只有在 shadcn 没有对应形状/行为时才自己写 Tailwind。** 曾因忽视这条在 C.2 首个组件上被用户纠正过，详见 `.learnings/LEARNINGS.md` 的 LRN-20260417-001。

**过渡期样式干扰原则（C.2 进行中生效）：** Bootstrap CSS 在完整移除前，会对新迁移的 shadcn 组件产生样式干扰（例如 Bootstrap Preflight 的 `button{border-radius:0}`、Bootstrap 的 `.shadow{...!important}` 会压制 Tailwind 对应的 utility）。**这些差异是过渡态的天然结果，不应该去 workaround**（不写 `!important`、不加 scoped 覆盖 CSS、不调 cascade layer 顺序）。最终 `@import 'bootstrap/dist/css/bootstrap.min.css'` 删除后，这些差异会**自动消失**。C.2 期间判断视觉差异的标准不是"跟当前的 Bootstrap 版本一致"，而是"跟 shadcn-vue 的目标原生样式一致"。详见 `.learnings/LEARNINGS.md` 的 LRN-20260417-002。

---

## 开发命令

```bash
npm run dev          # 同时启动 Vite + 后端（nodemon）
npm run build        # 前端构建
npm run preview      # Vite 预览构建产物
npm run start        # 启动构建后的前端 + 后端
npm test             # 跑 tests/*.test.js（Node 内置 test runner）
npm run check        # test + build，提交前自检
```

---

## 不要做的事

- 不要主动引入 TypeScript
- 不要在不属于当前 4 个重构子任务范围的代码上做"顺手优化"
- 不要在没看 `refactor/` 的情况下批量修改组件样式或 store 结构
- 不要改 `jsconfig.json` 的语言模式

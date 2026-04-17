# AGENTS.md

> 本文件给 AI 协作者（Claude / Codex 等）阅读。说明项目结构、约定、设计系统与本次 UI 重构后的状态。

---

## 项目简介

**MyIP**（IPCheck.ing）是一个开源 IP 工具箱：IP 查询、连通性测试、WebRTC 检测、DNS 泄漏检测、网速测试、MTR、Whois、安全检查清单、浏览器指纹、匿名性检测等。前后端同仓，前端 SPA + Node 后端 API。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | **Vue 3**（`<script setup>` 全家桶） |
| 状态 | **Pinia** |
| 路由 | **vue-router** (hash mode) |
| i18n | **vue-i18n**（en / zh / fr / tr） |
| 构建 | **Vite** + `@vitejs/plugin-vue` |
| **CSS** | **Tailwind CSS v4**（`@tailwindcss/vite`）+ `tw-animate-css` |
| **UI primitives** | **shadcn-vue 风格 copy-in**（基于 `reka-ui`，全部在 `frontend/components/ui/`） |
| **图标** | **`lucide-vue-next`**（一律 inline SVG 组件） |
| **国旗** | **`@iconify-json/circle-flags`** + `@iconify/vue` |
| **底部抽屉** | **`vaul-vue`**（仅 Advanced Tools 子页面使用） |
| **Toast** | **`vue-sonner`** |
| 后端 | **Express 5** |
| Auth | **Firebase Auth**（可选，按环境变量启用） |
| PWA | **Serwist** |
| 测试 | **Node 内置 test runner**（`node --test`，无第三方测试框架） |
| 其它运行时 | chart.js / svgmap / @cloudflare/speedtest / maxmind / whoiser / thumbmarkjs / ua-parser-js / detect-gpu / circle-progress.vue |

**明确不在栈里的**（历史遗留 / 已卸载）：

- ❌ **Bootstrap / bootstrap-icons** — 全部移除
- ❌ **flag-icons** — 全部移除（切到 circle-flags 圆形国旗）
- ❌ **TypeScript** — 项目用 JS，不要主动引入
- ❌ `bi-*` / `.fi fi-*` class 命名 — 全站清零

---

## 语言与代码风格

- **必须使用 JavaScript**：新文件用 `.js` / `.vue`，`<script setup>` **不带** `lang="ts"`；不要改 `jsconfig.json` 成 `tsconfig.json`
- Vue 组件统一 `<script setup>` + Composition API
- 路径别名 `@` → `frontend/`（见 `jsconfig.json` / `vite.config.js`）
- 注释 / commit message / 计划文档随意用中文；代码里命名走英文

---

## 目录结构

```
.
├── AGENTS.md                    ← 本文件（唯一真相源）
├── CLAUDE.md                    ← 只提示 Claude 读 AGENTS.md
├── refactor/                    ← 历史重构文档（已完成，保留作归档）
│   ├── README.md
│   ├── 01-bootstrap-to-tailwind.md   ✅
│   ├── 02-app-vue-split.md           ✅
│   ├── 03-add-tests.md               ✅
│   └── 04-store-hardcoded.md         ✅
│
├── index.html                   ← #app 挂 vaul-drawer-wrapper 属性
├── vite.config.js
├── jsconfig.json
├── package.json
│
├── frontend/                    ← 前端源码（Vite root，别名 @）
│   ├── App.vue                  ← 已瘦身（130 行上下），仅挂载顶层组件 + 调用 composables
│   ├── main.js
│   ├── store.js                 ← Pinia 主 store
│   ├── firebase-init.js
│   ├── sw.js                    ← Serwist service worker
│   ├── router/                  ← Advanced Tools 子页面路由（打开 Drawer）
│   ├── locales/                 ← i18n 文案（en/zh/fr/tr）+ security-checklist 数据
│   ├── style/style.css          ← Tailwind v4 + 设计 token + 极少量项目自定义 CSS
│   ├── lib/                     ← cn() 辅助（tailwind-merge + clsx）
│   ├── data/                    ← 静态配置（achievements / ip-databases / sections / default-preferences）
│   ├── utils/                   ← 纯函数工具（valid-ip / getips / transform-ip-data / 快捷键实现 / 等）
│   ├── composables/             ← 组合式复用逻辑
│   │   ├── use-info-mask.js
│   │   ├── use-refresh-orchestrator.js
│   │   ├── use-scroll-to.js
│   │   ├── use-section-tracking.js
│   │   ├── use-shortcuts.js
│   │   └── use-status-tone.js         ← 全站共享"4 档业务状态 → 视觉色"映射
│   └── components/
│       ├── *.vue                ← 顶层功能区（IpInfos / Connectivity / WebRTC / DnsLeaks / SpeedTest / Advanced / Footer / Nav / Achievements / User / Additional）
│       ├── ip-infos/            ← IP 卡片子组件（IPCard / ASNInfo / DataPairBar）
│       ├── advanced-tools/      ← 10 个工具子页（MtrTest / GlobalLatencyTest / RuleTest / DnsResolver / CensorshipCheck / Whois / MacChecker / BrowserInfo / InvisibilityTest / SecurityChecklist + Empty）
│       ├── widgets/             ← 复用小部件（QueryIP / Help / Preferences / InfoMask / PWA / Toast）
│       ├── svgicons/            ← 极少量内联 SVG
│       └── ui/                  ← shadcn-vue copy-in primitives（见下节"UI 基础设施"）
│
├── api/                         ← 后端 API handlers
├── common/                      ← 前后端共享（valid-ip / maxmind-db / ...）
├── public/                      ← 静态资源
├── tests/                       ← Node test runner 测试（211 项）
├── backend-server.js            ← Express API 服务（默认端口 11966）
└── frontend-server.js           ← npm start 用的静态文件服务
```

---

## UI 基础设施

### shadcn-vue primitives（`frontend/components/ui/`）

已 copy-in 的 primitive（21 个）：

`accordion` · `badge` · `button` · `button-group` · `card` · `collapsible` · `dialog`（含 `DialogHeader`）· `drawer`（vaul-vue）· `dropdown-menu` · `input` · `input-group` · `progress` · `select` · `separator` · `sheet` · `sonner` · `spinner` · `switch` · `tabs` · `toggle-group` · `tooltip`

**项目特有的 primitive**（shadcn-vue 官方没有，但已落地）：
- **`ButtonGroup`** — Button 视觉拼接容器
- **`InputGroup`** — Input + Button / Select 等子元素通过 `[&>input] / [&>button]` 透穿选择器扁平化，整条输入条由 group 自己承担 border/ring/shadow。**凡是"输入 + 触发按钮"场景都用它**，不要再手写 `rounded-r-none / -ml-px` 拼接
- **`Spinner`** — lucide `Loader2` + `animate-spin` + `role="status"`

### 设计系统 token（`frontend/style/style.css`）

shadcn 基础 token 外，项目扩展了 4 个**业务语义色**：

| token | 语义 | 亮色 | 暗色 |
|---|---|---|---|
| `--info` | 等待 / 进行中 | sky-500 | sky-400 |
| `--success` | 成功 / ok-fast | green-500 | green-400 |
| `--warning` | 警告 / ok-slow | amber-500 | amber-400 |
| `--action` | "run / 触发动作" 按钮品牌色 | blue-500 | blue-500（保留一致，不暗模式提亮） |

`--destructive` 继续走 shadcn 原生。每个都有 `-foreground` 配对，bg-* 用的地方不需要写 `dark:` 变体。

**业务状态 → 视觉映射** 统一走 `composables/use-status-tone.js` 的 4 档 tone（`wait / ok-fast / ok-slow / fail`）。任何新模块都应该复用这套 tone，不要自己 switch-case 色码。

### Button variant 一览

默认 shadcn 的 `default / destructive / outline / secondary / ghost / link` 之外新增了：
- `action` — "触发" 按钮专用（blue-500）

### Badge variant 一览

`default / secondary / destructive / outline / success`（success 是项目扩展）。

**Badge hover 已全局禁用**（shadcn 源码里的 `hover:bg-*/80` 已移除）——Badge 是展示元素不应响应 hover。需要交互效果的场景在外层 `<a>` / `<button>` 上挂 `hover:bg-muted` 等。

---

## UI 代码约定（本次 UI 重构总结）

1. **shadcn-first 原则**：写任何 `<button>` / `<input>` / 弹层 / 列表之前，先查 `frontend/components/ui/` 有没有现成 primitive。缺变体不是自己写的理由：`:class` 叠加 / `as-child` / tw-merge 足够覆盖绝大多数状态色需求。**只有形状/行为完全不存在时才自己写 Tailwind**。

2. **颜色命令**：
   - **优先语义 token**（`bg-info` / `bg-success` / `bg-warning` / `bg-destructive` / `bg-action` / `bg-muted` / `bg-card` / `bg-accent` / `text-foreground` / `text-muted-foreground` / `border` / …）
   - **绝不写 `dark:` 二元对偶**（`bg-neutral-50 dark:bg-neutral-900` 这种模式已全站清零）——语义 token 自动适配明暗
   - 4 档 tone 场景走 `useStatusTone()`，不要自己 map 色码

3. **触发按钮统一规范**：
   ```vue
   <Button variant="action" :disabled="isRunning" @click="run">
     <Spinner v-if="isRunning" />
     Run
   </Button>
   ```
   `variant="action"` + `<Spinner />` + `:disabled` 三件套是 QueryIP / MacChecker / DnsResolver / Whois / MtrTest / Ping / Censorship / Invisibility 等工具都在遵守的模式。

4. **输入条统一规范**：
   ```vue
   <InputGroup>
     <Input v-model="q" placeholder="..." />
     <Button variant="action" :disabled="running" @click="run">
       <Spinner v-if="running" /> Run
     </Button>
   </InputGroup>
   ```
   Select 替代 Input 也同样适用（SelectTrigger 渲染为 button，被 InputGroup 透穿扁平化）。

5. **表格 vs 列表**：
   - 2-3 列、表头有独立语义 → 用 `<table>` 配上 `thead text-xs uppercase tracking-wide text-muted-foreground` + `tbody divide-y` + 行 `hover:bg-muted/50` 的现代风
   - 移动端友好 / 每行结构不对称 / 无表头意义 → 用 `<ul class="rounded-lg border bg-card divide-y">` + `<li>` 布局

6. **卡片**：主页状态卡（Connectivity / WebRTC / DnsLeak / IPCard / RuleTest）用 `<Card class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5">`。`jn-card` 是项目保留 marker（走 `.jn-card` CSS 的 shadow + border + 键盘导航 outline 高亮）。`keyboard-shortcut-card` 是快捷键导航 J/K 识别标记（shortcut.js 里 querySelector 用）。

7. **国旗**：
   ```vue
   <Icon :icon="'circle-flags:' + code.toLowerCase()" class="size-4" />
   ```
   `@iconify-json/circle-flags` 已装、`@iconify/vue` 的 `Icon` 组件已可用。

8. **Dialog 头部**：用 `<DialogHeader :icon="SomeIcon" :title="..." />` primitive，自带图标 + 标题 + DialogClose，跟 Sheet/Drawer 的 header 观感对齐。

9. **Drawer 仅用于底部抽屉**（vaul-vue）：Advanced Tools 面板一处。right/left 侧边面板用 Sheet。Drawer 默认 `handleOnly: true`（只有顶部把手可拖拽）+ CSS 已覆盖 `user-select: text` 让正文可选中。

10. **动画 / 过渡**：
    - 卡片 hover 上浮：`transition-transform duration-300 ease-out hover:-translate-y-1.5`
    - 面板 fade-slide：scoped `.fade-slide-*` 模式已在多个组件里用
    - Loading 旋转：`<Spinner />`（不要手写 `animate-pulse` 色球）

---

## 开发命令

```bash
npm run dev          # 同时启动 Vite + 后端（nodemon），默认前端 5173 + 后端 11966
npm run build        # 前端构建
npm run preview      # Vite 预览构建产物
npm run start        # 构建后的前端 + 后端（静态文件服务）
npm test             # 跑 tests/*.test.js（Node 内置 test runner，211 项）
npm run check        # test + build，提交前自检
```

---

## 提交纪律

**未经用户明确授权，不要自动 commit**。用户的工作流是 "AI 改动 → 用户验收 → 用户说'提交' → AI commit"。

Commit message 风格参考 `git log` 最近 50 条：`refactor(xxx): ...` / `fix(ui): ...` / `feat(ui): ...` / `style: ...` / `chore: ...` 前缀 + 中文正文；每条 commit 末尾：

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 不要做的事

- 不要主动引入 TypeScript
- 不要未经用户验收就 commit
- 不要在语义 token 能表达的场景写 `dark:bg-neutral-*` 二元对偶
- 不要把重构里已清零的硬编码（`bg-blue-600` / `bg-green-600` / `bg-sky-50` / `bi-*` / `.fi fi-*`）再写回来
- 不要在主题色能表达的场景写 `!important`（shadcn 组件 primitives 的 `cn()` 已经处理好覆盖）
- 不要改 `jsconfig.json` 的语言模式

---

## 参考索引

- 历史重构文档：`refactor/`（4 个子任务全部 ✅）
- 设计 token 源：`frontend/style/style.css` 顶部
- 状态 tone 语义：`frontend/composables/use-status-tone.js`
- primitive 列表：`frontend/components/ui/`

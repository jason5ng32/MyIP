# 01 — Bootstrap → Tailwind + shadcn-vue

**目标**：彻底移除 Bootstrap，UI 层完全迁移到 Tailwind v4 + shadcn-vue，bootstrap-icons 替换为 lucide-vue-next。最终 `package.json` 不再依赖 `bootstrap` / `bootstrap-icons`。

**状态**：🟢 进行中（阶段 A 已完成）

**影响范围**：30+ Vue 文件、router/index.js 中的 DOM 操作、main.js 中的全局 tooltip 指令、style/style.css。

---

## 阶段 A — 基础设施搭建 ✅

- [x] 安装 Tailwind v4 (`tailwindcss@^4.2.2`、`@tailwindcss/vite@^4.2.2`)，在 `vite.config.js` 注入 `tailwindcss()` 插件
- [x] 安装 shadcn-vue 运行时依赖 (`reka-ui`、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-vue-next`)，建立 `components.json`，约定组件落在 `frontend/components/ui/`，工具函数在 `frontend/lib/utils.js`
- [x] 设计 design tokens（shadcn 标准 CSS 变量集 + neutral baseColor + oklch 色彩空间）写入 `style/style.css` 的 `@theme inline` 块
- [x] 暗色模式：`store.setDarkMode()` 同步切换 `<html>` 的 `.dark` class，`@custom-variant dark` 绑定该 class，Tailwind `dark:` 变体生效
- [x] Tailwind 与 Bootstrap 共存验证：`npm run build` 通过、`npm test` 23 全绿、Vite HMR 正常、CSS bundle 含 `--background` 等 tokens 与 `.dark { }` 规则
- [x] `tailwindcss` / `@tailwindcss/vite` 归入 devDependencies（保持 dev 分支 "chore: move dev tools out of production deps" 的约定）
- [x] 落地一个 shadcn `Button` 组件（`frontend/components/ui/button/`）作为后续替换的样板

## 阶段 B — 命令式 Bootstrap JS 替换（高 ROI 优先）

> 共 13 处 `import ... from 'bootstrap'`，每替一处都直接简化代码。

- [x] **Toast** → shadcn `sonner`（vue-sonner）：`components/widgets/Toast.vue`（保持 `store.setAlert()` 外部 API 不变）
- [ ] **Tooltip** → shadcn `Tooltip`：删除 `main.js` 里的 `app.directive('tooltip', ...)`，组件内改用 `<Tooltip>` 包裹
- [ ] **Modal** → shadcn `Dialog`：
  - [ ] `components/widgets/Help.vue`
  - [ ] `components/widgets/QueryIP.vue`
  - [ ] `components/User.vue`
  - [ ] `components/Additional.vue`
- [x] **Offcanvas** → shadcn `Sheet`（完整迁移，含 store 协调 + router 清理 + Patch.vue 互斥逻辑移除）：
  - [x] `components/Nav.vue`（移动端 Sheet + 桌面端 inline + OpenPreferences 改用 store）
  - [x] `components/Achievements.vue`
  - [x] `components/Footer.vue`
  - [x] `components/Advanced.vue`（fullscreen 改为响应式 class）
  - [x] `components/widgets/Preferences.vue`（新增，原本只被 Nav.vue 通过 DOM 控制）
  - [x] `components/widgets/Patch.vue`（listenOffcanvas 整个移除，互斥由 `store.openSheet` 单字段天然保证）
  - [x] 新增 `components/ui/sheet/`（Sheet / SheetContent / SheetClose）
  - [x] 新增 `store.openSheet` 单字段 + `setOpenSheet` / `toggleSheet` actions
  - [x] 安装 `tw-animate-css` 支持 Tailwind v4 的 animate-in/out 工具类
- [x] **删除 `router/index.js` 里对 `document.getElementById('offcanvasTools')` 的命令式操作**，改为 store 状态驱动 Sheet 开合
- [ ] 删除 `main.js` 里的 `import 'bootstrap'`

## 阶段 C — 视觉层批量重写

按以下顺序，每个组件做完后单独 commit：

- [ ] `components/Nav.vue`（含暗色模式样式收敛）
- [ ] `components/IpInfos.vue` + `components/ip-infos/` 子组件（IPCard / ASNInfo / DataPairBar）
- [ ] `components/ConnectivityTest.vue`
- [ ] `components/WebRtcTest.vue`
- [ ] `components/DnsLeaksTest.vue`
- [ ] `components/SpeedTest.vue`
- [ ] `components/Advanced.vue`
- [ ] `components/advanced-tools/` 全部 11 个组件
- [ ] `components/Achievements.vue`
- [ ] `components/Additional.vue`
- [ ] `components/Footer.vue`
- [ ] `components/widgets/Preferences.vue`
- [ ] `components/widgets/InfoMask.vue`
- [ ] `components/widgets/PWA.vue`
- [ ] `App.vue` 模板部分（注意：App.vue 大改要协调 02 任务）

## 阶段 D — 图标迁移

- [ ] 安装 `lucide-vue-next`
- [ ] 全仓库搜索 `bi bi-` 类名，逐一替换为对应的 lucide 组件
- [ ] 删除 `style/style.css` 里的 `bootstrap-icons` import

## 阶段 E — 卸载与清理

- [ ] 删除 `style/style.css` 里的 `@import 'bootstrap/dist/css/bootstrap.min.css'`
- [ ] 检查 `style/style.css` 自定义类是否还需要保留，能用 Tailwind 表达的删除
- [ ] `npm uninstall bootstrap bootstrap-icons`
- [ ] `npm run build` 通过，体积对比记录一下

---

## 完成前回顾清单

将本任务标记为 ✅ 之前必须确认：

- [ ] 全仓库 `grep -r "from 'bootstrap'"` 结果为 0
- [ ] 全仓库 `grep -rE "data-bs-|class=.*\b(btn-|navbar-|offcanvas|modal-|toast|tooltip|dropdown-|card-|row|col-|d-flex|text-(white|dark|muted|success|danger|warning|primary)|bg-(white|dark|body))"` 中 Bootstrap 残留为 0（注意区分自定义类）
- [ ] 全仓库 `grep -r "bi bi-"` 结果为 0
- [ ] `package.json` 不再含 `bootstrap` / `bootstrap-icons`
- [ ] `npm run build` 通过，`npm run dev` 启动后所有 Modal / Sheet / Tooltip / Toast 行为正常
- [ ] 暗色模式在所有页面表现一致
- [ ] 移动端布局未破坏（`store.isMobile` 路径手动验证一次）
- [ ] router 切换 advanced-tools 时 Sheet 正常开合

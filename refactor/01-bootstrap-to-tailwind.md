# 01 — Bootstrap → Tailwind + shadcn-vue

**目标**：彻底移除 Bootstrap，UI 层完全迁移到 Tailwind v4 + shadcn-vue，bootstrap-icons 替换为 lucide-vue-next。最终 `package.json` 不再依赖 `bootstrap` / `bootstrap-icons`。

**状态**：🟢 进行中

- 阶段 A（基建）：✅ 完成
- 阶段 B（命令式 Bootstrap JS 替换：Toast / Tooltip / Modal / Offcanvas）：✅ 完成
- 阶段 C 的"JS 部件收尾"部分（Dropdown / Collapse / Accordion / Tabs / ScrollSpy 换成 shadcn-vue 或删除）：✅ 完成
- **结果**：Bootstrap JS 已完全不需要；`import 'bootstrap'` 已从 `main.js` 删除；`bootstrap` 包保留在 `package.json`（因为 `bootstrap.min.css` 仍然作为视觉层的地基被加载）
- 阶段 C 的"视觉层改写"部分：⏸️ 暂停。曾尝试用 `@apply` compat shim 一次性代替 Bootstrap CSS（commit 254b081），造成大面积视觉回归，已 revert（commit 3c28014）。后续正确做法：**逐组件改写模板 class**，每个组件一个 commit、一次视觉验证，不再引入 shim 层
- 阶段 D（bootstrap-icons → lucide）和阶段 E（最终卸载）：🟡 未开始，不阻塞当前功能

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
- [x] **Tooltip** → shadcn-vue `Tooltip`（基于 reka-ui）：
  - 初版保留 `v-tooltip` 指令（自实现 DOM 方案）失败：tooltip 在实际页面上完全不显示，问题与项目历史上 Bootstrap Tooltip 也需要特殊处理一致。删除。
  - 最终方案：
    - 新建 `components/ui/tooltip/`（Tooltip / TooltipTrigger / TooltipContent / TooltipProvider + 便利组件 `JnTooltip`）
    - `App.vue` 根层包 `<TooltipProvider>`，所有子 tooltip 共享 provider
    - 11 处 `v-tooltip` 调用点全部替换为 `<JnTooltip :text :side>` 包裹，`store.isMobile` 时自动跳过（与旧行为一致）
    - 删除 `main.js` 的 `import { Tooltip } from 'bootstrap'` + 指令注册
    - `frontend/directives/` 目录已删除
- [x] **Modal** → shadcn `Dialog`：
  - [x] `components/widgets/Help.vue`（`openModal()` 对外 API 保留）
  - [x] `components/widgets/QueryIP.vue`（开启时自动 focus 输入框）
  - [x] `components/User.vue`
  - [x] `components/Additional.vue`
  - [x] 新增 `components/ui/dialog/`（Dialog / DialogContent / DialogClose）
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
- [x] 删除 `main.js` 里的 `import 'bootstrap'`（所有 Bootstrap JS 部件已迁完，JS 是死代码，安全删除；Bootstrap CSS 仍通过 `style.css` 加载）

## 阶段 C — 视觉层批量重写

### C.1（已完成）— 清掉 4 类剩余的 Bootstrap JS 部件 ✅

- [x] **Dropdown** (`data-bs-toggle="dropdown"`) → shadcn-vue `DropdownMenu`
  - [x] `components/Nav.vue`（用户菜单）
  - [x] `components/advanced-tools/DnsResolver.vue`
- [x] **Collapse / Accordion** (`data-bs-toggle="collapse"`) → shadcn-vue `Collapsible` 或 `Accordion`（新建 `components/ui/collapsible/` + `components/ui/accordion/`）
  - [x] `components/advanced-tools/Whois.vue`（Accordion 单选，默认展开第一项）
  - [x] `components/advanced-tools/SecurityChecklist.vue`（两处：分类 intro = Collapsible；每项 info = v-show 字典，因为 table row 结构不适合 Collapsible 包裹）
  - [x] `components/advanced-tools/MtrTest.vue`（Accordion 单选）
  - [x] `components/ip-infos/IPCard.vue`（ASN info = Collapsible；简化 per-card 状态为单 ref）
  - [x] 连带修了 Bootstrap Collapse 展开后内容变空白的 bug
- [x] **Tab** (`data-bs-toggle="tab"`) → shadcn-vue `Tabs`
  - [x] `components/Achievements.vue`（Get / NotGet 切换）
- [x] **ScrollSpy** (`data-bs-spy="scroll"`) → 删除（Patch.vue 的 `checkSectionsAndTrack` 已经在做同样的事，scrollspy 是冗余）
  - [x] `App.vue`

### C.2 — 模板层 Bootstrap class → Tailwind/shadcn-vue（进行中）

**教训**：曾在 commit 254b081 尝试"一次性写 @apply compat shim 替代整份 bootstrap.min.css"的偷懒做法，导致大面积视觉回归（~168 个 class 的 shim 映射值对不上 Bootstrap 精确色/间距，加上 Tailwind Preflight 干扰），已于 commit 3c28014 revert。

**迁移约定**（C.2 每个 commit 都遵守）：

1. **能用 shadcn-vue 现成组件就用**：`<Button>` 替 `.btn`，`<Card>` 替 `.card`，`<Alert>` 替 `.alert`，`<Badge>` 替 `.badge`，`<Input>` 替 `.form-control`，`<Select>` 替 `.form-select`，`<Checkbox>` / `<Switch>` 替 `.form-check-input`，`<Progress>` 替 `.progress`，`<Separator>` / `<Table>` / `<Skeleton>` / `<Avatar>` 等同理。用到时如果 `frontend/components/ui/` 下还没有，**先把它们从 shadcn-vue 源抄进来再用**（保持 copy-in 风格）
2. **shadcn 没有或视觉差距太大时才自己写 Tailwind**：例如状态驱动的多色按钮（success / warning / danger 同时存在）、浮动触发器这种特殊用法
3. **不引入任何 compat 中介层**：不写 `.btn { @apply ... }` 这种；所有样式直接在模板 class 里用 Tailwind 表达
4. **一次一个组件**：单 commit、改完人眼对比视觉再提交
5. **色彩映射**（粗略参考，实际以视觉对比为准）：
   - `text-success` / `bg-success` → `text-green-600` / `bg-green-600`
   - `text-warning` / `bg-warning` → `text-yellow-600` / `bg-yellow-500`
   - `text-danger` / `bg-danger` → `text-red-600` / `bg-red-600`
   - `text-info` / `bg-info` → `text-sky-600` / `bg-sky-500`
   - `text-secondary` / `bg-secondary` → `text-neutral-500` / `bg-neutral-500`
   - `bg-dark` → `bg-neutral-900`, `bg-light` → `bg-neutral-100`
   - `text-muted` → `text-neutral-500`
6. **间距 / 布局 class 大多 Tailwind 原生可用**：`mb-3` / `mt-5` / `px-3` / `py-2` / `text-center` / `flex-1` 等名字相同，直接保留即可
7. **要改名的布局 class**：
   - `d-flex` → `flex`
   - `d-none` → `hidden`
   - `align-items-center` → `items-center`
   - `justify-content-between` → `justify-between`
   - `flex-column` → `flex-col`
   - `w-100` / `h-100` → `w-full` / `h-full`
8. **暗色模式**：用 Tailwind 的 `dark:` 变体，不再用 `:class="{ 'dark-mode-*': isDarkMode }"` 模式（store.isDarkMode 已经通过 `setDarkMode` 同步到 `<html>.dark`）
- 所有组件 C.2 都改完之后，`style.css` 里的 bootstrap CSS import 才能删，bootstrap 包才能卸载

建议顺序（按视觉复杂度从低到高）：

- [x] `components/widgets/InfoMask.vue` — 用 shadcn `<Button size="icon">` + 状态色 :class 覆盖；浮动定位改 Tailwind；`document.querySelector` → ref；resize listener 补了 cleanup
- [x] `components/widgets/PWA.vue` — 无工作：模板只有 `<pwa-install>` 第三方 custom element，零 Bootstrap class
- [x] `components/widgets/Patch.vue` — 无工作：模板空
- [x] `components/svgicons/Brand.vue` / `IPError.vue` — 无工作：纯 SVG，仅 `me-1` 一处 Tailwind v4 原生兼容
- [x] `components/Footer.vue` — ToggleGroup（3 选一 radio 按钮组）+ Badge（changelog 条目类型）+ Separator（`<hr>`）+ 大量 link/text 颜色由 Bootstrap `link-*` / `text-*` 改为 Tailwind 直接表达；`showAbout/changelog/specialthanks` 三个 boolean 合并为单个 `content` ref + v-if；顺手修了原 `offcanvasBody.scrollTop = 0` 对 ref 对象直接操作的 bug（正确写法是 `sheetBody.value.scrollTop`）；新增 `components/ui/{badge,toggle-group,separator}/`
- [x] `components/Additional.vue` — 移除 `.container`/`.row`/`d-flex`/`.modal-*`/`.dark-mode-*` 等 Bootstrap class，改为 Tailwind；Curl dialog 内部结构用 Tailwind 表达；保留 `.jn-curl` / `.jn-comment` 自定义类（非 Bootstrap）
- [ ] `components/svgicons/*`（纯 SVG，可能无工作）
- [x] `components/widgets/Help.vue` — 两列快捷键表，`.row`/`.col`/`.col-8`/`.col-auto` → `flex` + `flex-1` + `shrink-0`；`<kbd>` 样式直接内联，替代 `.text-bg-light` + Bootstrap 默认 kbd 样式
- [x] `components/widgets/QueryIP.vue` — 浮动搜索按钮换 `<Button size="icon">` + 响应式 right-position；`.form-control` → `<Input>`；结果 `.list-group` → plain `<ul>` + Tailwind；`.progress`/`.progress-bar` → `<Progress>`；新增 `components/ui/{input,progress}/`
- [x] `components/User.vue` — Benefits Dialog：`.modal-content/header/body/footer` / `.table`/`.table-dark`/`.table-responsive` 改为 Tailwind table；dark-mode 全用 `dark:` 变体；移除 unused `isDarkMode` / `isMobile` computed
- [x] `components/ConnectivityTest.vue` — refresh 按钮用 `<Button size="icon" variant="outline">`；`.row`/`.col-6 col-md-3` → `flex flex-wrap -mx-2` + `w-1/2 md:w-1/4 px-2`；`.card` 改为 Tailwind；`text-info/success/warning/danger` 映射到 `text-sky/green/yellow/red-600`（保留 `.jn-text-warning` 自定义色）
- [x] `components/DnsLeaksTest.vue` — 相同模式：Button + flex/wrap grid + `.alert alert-info/success` → Tailwind 配色块 + dark: 变体
- [x] `components/WebRtcTest.vue` — 与 Connectivity/DnsLeaks 同模式
- [x] `components/advanced-tools/Empty.vue` — 无工作：只是空 div
- [x] `components/advanced-tools/BrowserInfo.vue` — row/col → flex/w-_；`.alert` → Tailwind 色块；`.badge text-bg-*` → shadcn `<Badge>` + 色彩覆盖；`.form-check form-switch` → shadcn `<Switch>`；`.spinner-grow` → `animate-pulse` 圆点；新增 `components/ui/switch/`
- [x] `components/advanced-tools/MacChecker.vue` — `.input-group` → flex + Input + Button；table 用 Tailwind；result card 结构改 Tailwind flex grid；text-success/secondary 图标色映射
- [x] `components/advanced-tools/RuleTest.vue` — 卡片网格 + .alert 色块 + RefreshAll 按钮全部改 Tailwind + shadcn Button
- [x] `components/advanced-tools/DnsResolver.vue` — input-group 三段 (Input + Type Dropdown + Run) 用 shadcn；table 改 Tailwind
- [x] `components/advanced-tools/Whois.vue` — input + Button；`.alert-success` → Tailwind 色块；raw 数据预览 `.card card-body bg-light/bg-black` → Tailwind
- [x] `components/advanced-tools/GlobalLatencyTest.vue` — `.form-select` → shadcn `<Select>`（新增 `components/ui/select/`）；table 改 Tailwind
- [x] `components/advanced-tools/CensorshipCheck.vue` — input/button、两列 table (test/control group) 用 Tailwind；`.alert alert-info/danger/success` 最终结果条 → Tailwind 色块条件分支
- [x] `components/advanced-tools/MtrTest.vue` — IP Select + Run Button；Accordion 已在 phase C.1 迁移过，这里只清 class；AS 徽章 → shadcn `<Badge>` + 色彩覆盖
- [x] `components/advanced-tools/SecurityChecklist.vue` — 最复杂组件：进度条、分类卡列表、filter ToggleGroup（替 btn-group radio hack）、checklist table + 优先级 Badge + Switch（替 form-check-input）；`.alert alert-success` 统计条 + `.progress progress-stacked` 多段进度 → Tailwind
- [x] `components/advanced-tools/InvisibilityTest.vue` — agreement checkbox + 运行按钮；score 总结 alert；14 行表格结果，全部改 Tailwind
- [x] `components/Advanced.vue` — 工具入口卡片网格 + Sheet 头部 + 全屏切换按钮，全部改 Tailwind；`.jn-icon-dark` 合并到 `:global(.dark) .jn-icon` 选择器
- [ ] `components/SpeedTest.vue`
- [x] `components/ip-infos/DataPairBar.vue` — .progress + .progress-bar 双色条 → Tailwind flex + 两个 div；label badges → shadcn Badge；fw-light/fw-bold → font-light/bold
- [x] `components/ip-infos/ASNInfo.vue` — .alert alert-light → Tailwind 色块；.badge text-bg-* → shadcn Badge；.placeholder col-N → inline width% 骨架
- [ ] `components/ip-infos/IPCard.vue`
- [ ] `components/IpInfos.vue`
- [ ] `components/Nav.vue`（含暗色模式样式收敛）
- [ ] `components/Achievements.vue`
- [ ] `components/widgets/Preferences.vue`
- [ ] `components/widgets/Toast.vue`（应该已经是纯 sonner，无模板）
- [ ] `App.vue` 模板部分（注意：App.vue 大改要协调 02 任务）

C.2 全部完成之后 → 进入阶段 E（卸载 bootstrap 和 CSS import）。

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

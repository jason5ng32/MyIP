# AGENTS.md

## Overview

**MyIP** (IPCheck.ing) is an open-source IP toolbox: IP lookup, connectivity tests, WebRTC / DNS-leak detection, speed test, MTR, Whois, security checklist, browser fingerprint, anonymity checks, and more.

Single repo, two halves: a Vue 3 SPA front-end and an Express 5 back-end API, served side by side.

## Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (`<script setup>`, Composition API) |
| State | Pinia |
| Router | vue-router (hash mode) |
| i18n | vue-i18n — `en` / `zh` / `fr` / `tr` |
| Build | Vite + `@vitejs/plugin-vue` |
| CSS | Tailwind CSS v4 (`@tailwindcss/vite`) + `tw-animate-css` |
| UI primitives | shadcn-vue copy-in style, built on `reka-ui` |
| Icons | `lucide-vue-next` (inline SVG components) |
| Flags | `@iconify-json/circle-flags` via `@iconify/vue` |
| Bottom drawer | `vaul-vue` |
| Toast | `vue-sonner` |
| Backend | Express 5 |
| Auth | Firebase Auth (optional, env-gated) |
| PWA | Serwist |
| Tests | Node built-in test runner (`node --test`) |
| Runtime libs | chart.js · svgmap · @cloudflare/speedtest · maxmind · whoiser · thumbmarkjs · ua-parser-js · detect-gpu · circle-progress.vue |

## Project layout

```
.
├── AGENTS.md                    ← this file (single source of truth)
├── CLAUDE.md                    ← pointer to AGENTS.md
├── refactor/                    ← archived design notes
│
├── index.html                   ← #app mounts vaul-drawer-wrapper
├── vite.config.js
├── jsconfig.json                ← JS project, alias @ → frontend/
├── package.json
│
├── frontend/                    ← Vite root
│   ├── App.vue                  ← thin shell, delegates to composables
│   ├── main.js
│   ├── store.js                 ← Pinia main store
│   ├── firebase-init.js
│   ├── sw.js                    ← Serwist service worker
│   ├── router/                  ← Advanced Tools subroutes (opens Drawer)
│   ├── locales/                 ← i18n copy (en / zh / fr / tr) + security-checklist data
│   ├── style/style.css          ← Tailwind v4 entry + design tokens
│   ├── lib/                     ← cn() helper (tailwind-merge + clsx)
│   ├── data/                    ← static config (achievements / ip-databases / sections / default-preferences)
│   ├── utils/                   ← pure helpers (valid-ip / getips / transform-ip-data / shortcut impls / …)
│   ├── composables/             ← reusable composition logic
│   │   ├── use-info-mask.js
│   │   ├── use-refresh-orchestrator.js
│   │   ├── use-scroll-to.js
│   │   ├── use-section-tracking.js
│   │   ├── use-shortcuts.js
│   │   └── use-status-tone.js   ← shared 4-tier business-state → visual-color mapping
│   └── components/
│       ├── *.vue                ← top-level sections (IpInfos / Connectivity / WebRTC / DnsLeaks / SpeedTest / Advanced / Footer / Nav / Achievements / User / Additional)
│       ├── ip-infos/            ← IP-card subcomponents (IPCard / ASNInfo / DataPairBar)
│       ├── advanced-tools/      ← 10 tool subpages (MtrTest / GlobalLatencyTest / RuleTest / DnsResolver / CensorshipCheck / Whois / MacChecker / BrowserInfo / InvisibilityTest / SecurityChecklist + Empty)
│       ├── widgets/             ← small reusables (QueryIP / Help / Preferences / InfoMask / PWA / Toast)
│       ├── svgicons/            ← a few inline SVGs
│       └── ui/                  ← shadcn-vue copy-in primitives (see UI system)
│
├── api/                         ← backend API handlers
├── common/                      ← code shared between front- and back-end (valid-ip / maxmind-db / …)
├── public/                      ← static assets
├── tests/                       ← Node test runner specs
├── backend-server.js            ← Express API (default port 11966)
└── frontend-server.js           ← static file server for `npm start`
```

## UI system

### Primitives

Located at `frontend/components/ui/`. 21 primitives are copied in:

`accordion` · `badge` · `button` · `button-group` · `card` · `collapsible` · `dialog` (with `DialogHeader`) · `drawer` (vaul-vue) · `dropdown-menu` · `input` · `input-group` · `progress` · `select` · `separator` · `sheet` · `sonner` · `spinner` · `switch` · `tabs` · `toggle-group` · `tooltip`

Three are project-specific, not in stock shadcn-vue:

- **`ButtonGroup`** — visual container for stitching buttons together
- **`InputGroup`** — flattens `Input + Button` (or `Input + Select`) into a single bordered control via `[&>input] / [&>button]` passthrough selectors. The group itself carries border / ring / shadow. Use this whenever an input is paired with a trigger button — never hand-roll `rounded-r-none / -ml-px`
- **`Spinner`** — lucide `Loader2` + `animate-spin` + `role="status"`

Rule: before authoring a `<button>`, `<input>`, popover, or list, check `frontend/components/ui/` first. Missing variants are not a reason to bypass the primitive — `:class` overrides, `as-child`, and tw-merge cover nearly every state-color need. Only drop to raw Tailwind when the shape or behavior does not exist.

### Design tokens

Tokens live at the top of `frontend/style/style.css`. On top of shadcn defaults, four business-semantic colors are defined:

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--info` | waiting / in-progress | sky-500 | sky-400 |
| `--success` | ok-fast / success | green-500 | green-400 |
| `--warning` | ok-slow / warning | amber-500 | amber-400 |
| `--action` | the "run / trigger" brand color | blue-500 | blue-500 |

`--destructive` uses the shadcn default. Every token has a paired `-foreground`; `bg-*` consumers do not need `dark:` variants.

Rule: use semantic tokens (`bg-info` / `bg-success` / `bg-warning` / `bg-destructive` / `bg-action` / `bg-muted` / `bg-card` / `bg-accent` / `text-foreground` / `text-muted-foreground` / `border` / …). Do not write `dark:` dual pairs like `bg-neutral-50 dark:bg-neutral-900` — that pattern does not exist in this codebase.

### Button and Badge variants

Button adds `action` (blue-500 trigger color) to the shadcn defaults (`default / destructive / outline / secondary / ghost / link`).

Badge adds `success` to the defaults. Badge hover is globally disabled — Badge is a display element, not an interactive one. Put `hover:bg-muted` etc. on an outer `<a>` / `<button>` when interactivity is needed.

### Status tones

All "business state → visual color" mapping goes through `frontend/composables/use-status-tone.js`. It exposes four tones: `wait` / `ok-fast` / `ok-slow` / `fail`.

Rule: any new module that surfaces a status reuses these tones. Do not hand-write `switch` statements that map states to hex codes or Tailwind classes.

### Canonical patterns

**Trigger button** — `variant="action"` + `<Spinner />` + `:disabled` is the three-piece pattern used by QueryIP, MacChecker, DnsResolver, Whois, MtrTest, Ping, Censorship, Invisibility, etc.

```vue
<Button variant="action" :disabled="isRunning" @click="run">
  <Spinner v-if="isRunning" />
  Run
</Button>
```

**Input with trigger** — `InputGroup` flattens the pair. `SelectTrigger` renders as a button, so `Select` can swap in for `Input` with no extra work.

```vue
<InputGroup>
  <Input v-model="q" placeholder="..." />
  <Button variant="action" :disabled="running" @click="run">
    <Spinner v-if="running" /> Run
  </Button>
</InputGroup>
```

**Status card** — homepage status cards (Connectivity / WebRTC / DnsLeak / IPCard / RuleTest) use:

```vue
<Card class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5">
```

`jn-card` is the project marker for shadow / border / keyboard-nav outline. `keyboard-shortcut-card` is the marker that the J/K keyboard-shortcut navigation queries for.

**Flag** — always use the iconify circle-flags set:

```vue
<Icon :icon="'circle-flags:' + code.toLowerCase()" class="size-4" />
```

**Tables vs lists** — two or three columns with independent header semantics → `<table>` with `thead text-xs uppercase tracking-wide text-muted-foreground` + `tbody divide-y` + row `hover:bg-muted/50`. Mobile-friendly rows or asymmetric content with no header meaning → `<ul class="rounded-lg border bg-card divide-y">` + `<li>`.

**Dialog header** — use the `<DialogHeader :icon="SomeIcon" :title="..." />` primitive to get an icon, title, and DialogClose in one element, matching the Sheet / Drawer header treatment.

**Drawer** — reserved for the bottom drawer (Advanced Tools panel), via `vaul-vue`. Side panels (right / left) use `Sheet`. The Drawer defaults to `handleOnly: true` (only the top handle is draggable) and CSS is set so body text remains selectable.

**Motion** — card hover lift: `transition-transform duration-300 ease-out hover:-translate-y-1.5`. Panel fade-slide: scoped `.fade-slide-*` transitions. Loading: `<Spinner />`, not hand-rolled `animate-pulse` dot clusters.

## Code conventions

- **JavaScript only.** New files are `.js` / `.vue`; `<script setup>` has no `lang="ts"`. Do not rename `jsconfig.json` to `tsconfig.json` or otherwise introduce TypeScript.
- **Composition API.** All components use `<script setup>`.
- **Path alias.** `@` → `frontend/` (defined in `jsconfig.json` and `vite.config.js`).
- **Comments are English by default.** Commit messages and planning docs can be Chinese; source-code comments stay English.
- **i18n coverage.** Any new feature that surfaces copy must land in all four locales at `frontend/locales/{en,zh,fr,tr}.json` in the same change. No English-only or Chinese-only keys.

## Testing

- **Test runner:** Node built-in (`node --test`), no third-party framework. Specs live in `tests/*.test.js`.
- **Coverage expectation:** any non-visual logic that can be exercised without a network call — pure functions, composables with mockable inputs, transform utilities, validators — ships with a test in `tests/` and is wired into `npm test`. UI rendering, real network behavior, and browser-API dependent code are out of scope.
- **When adding such logic, write the test in the same change.** Don't defer.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite + backend (nodemon) together — front-end 5173, back-end 11966 |
| `npm run build` | Front-end production build |
| `npm run preview` | Vite preview of the build output |
| `npm run start` | Built front-end + backend (static file server) |
| `npm test` | Run all `tests/*.test.js` specs |
| `npm run check` | `test` + `build`, the pre-commit self-check |

## Workflow

- **Do not commit without explicit user approval.** The flow is: AI edits → user reviews → user says "commit" → AI commits. Silent commits are a breach of trust.
- **Commit message style** follows recent `git log` — `refactor(xxx): …` / `fix(ui): …` / `feat(ui): …` / `style: …` / `chore: …` prefix, body can be Chinese.
- **Every commit ends with** the Co-Authored-By trailer:

  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

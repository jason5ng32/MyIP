# frontend/AGENTS.md

Conventions and patterns specific to the Vue 3 SPA under `frontend/`.
See ../AGENTS.md for universal project rules (language, i18n, commits, testing expectations).

## Overview

Vue 3 + Composition API single-page app. State in Pinia, routing via vue-router hash mode, styling via Tailwind CSS v4 on top of shadcn-vue primitives (copied in, not imported from a package). No TypeScript, no Bootstrap, no `dark:` dual-pair utilities.

## Project layout

```
frontend/
├── App.vue                      ← thin shell, delegates to composables
├── main.js                      ← app bootstrap + global init
├── store.js                     ← Pinia main store
├── firebase-init.js             ← Firebase Auth env-gated init
├── sw.js                        ← Serwist service worker
├── router/                      ← Advanced Tools subroutes (open inside a Drawer)
├── locales/                     ← i18n copy (en / zh / fr / tr) + security-checklist data
├── style/style.css              ← Tailwind v4 entry + design tokens
├── lib/                         ← cn() helper (tailwind-merge + clsx)
├── data/                        ← static config
│                                  (achievements / ip-databases / sections /
│                                   default-preferences / changelog)
├── utils/                       ← pure helpers
│                                  (valid-ip / getips / transform-ip-data /
│                                   hero-ip-size / fetch-with-timeout / …)
├── composables/                 ← reusable composition logic
│   ├── use-info-mask.js
│   ├── use-refresh-orchestrator.js
│   ├── use-scroll-to.js
│   ├── use-section-tracking.js
│   ├── use-shortcuts.js
│   └── use-status-tone.js       ← shared 4-tier business-state → visual-color mapping
└── components/
    ├── *.vue                    ← top-level sections (IpInfos / Connectivity / WebRTC / DnsLeaks
    │                              / SpeedTest / Advanced / Footer / Nav / Achievements / User /
    │                              Additional)
    ├── ip-infos/                ← IP-card subcomponents (IPCard / IpDetailPanel / ASNInfo / DataPairBar)
    ├── advanced-tools/          ← 10 tool subpages opened inside the bottom Drawer
    │                              (MtrTest / GlobalLatencyTest / RuleTest / DnsResolver /
    │                               CensorshipCheck / Whois / MacChecker / BrowserInfo /
    │                               InvisibilityTest / SecurityChecklist + Empty)
    ├── widgets/                 ← small reusables (QueryIP / Help / Preferences / InfoMask / PWA / Toast)
    ├── svgicons/                ← a few inline SVGs
    └── ui/                      ← shadcn-vue copy-in primitives (see "UI system" below)
```

## Conventions

- **Composition API.** All components use `<script setup>`; no Options API.
- **Path alias.** `@` → `frontend/` (defined in `jsconfig.json` and `vite.config.js`). Use `@/components/...`, `@/utils/...`, `@/composables/...`.
- **Shared-with-backend helpers live under `common/`.** Import them with a relative path, e.g. `../../common/valid-ip.js`. `common/valid-ip.js` is re-exported from `frontend/utils/valid-ip.js` so most consumers can keep using `@/utils/valid-ip.js`; follow that pattern when adding more shared helpers (see `frontend/utils/fetch-with-timeout.js` for the second example).

## shadcn-vue first

Before hand-rolling a UI component (button, dialog, popover, list, etc.):

1. **Check `frontend/components/ui/` first** — 21 primitives are already copied in (see below). Missing variants are almost never a reason to bypass a primitive; `:class` overrides, `as-child`, and tw-merge cover nearly every state-color need.
2. **If no local primitive fits, check https://www.shadcn-vue.com/docs/components** — shadcn-vue covers a lot more than what's in the repo. Copy one in if it's a good fit.
3. **Only fall back to hand-rolled Tailwind** when the shape or behavior genuinely doesn't exist in shadcn-vue.

## UI system

### Primitives

Located at `frontend/components/ui/`. 21 primitives copied in:

`accordion` · `badge` · `button` · `button-group` · `card` · `collapsible` · `dialog` (with `DialogHeader`) · `drawer` (vaul-vue) · `dropdown-menu` · `input` · `input-group` · `progress` · `select` · `separator` · `sheet` · `sonner` · `spinner` · `switch` · `tabs` · `toggle-group` · `tooltip`

Three are project-specific, not in stock shadcn-vue:

- **`ButtonGroup`** — visual container for stitching buttons together.
- **`InputGroup`** — flattens `Input + Button` (or `Input + Select`) into a single bordered control via `[&>input] / [&>button]` passthrough selectors. The group itself carries border / ring / shadow. Use this whenever an input is paired with a trigger button — never hand-roll `rounded-r-none / -ml-px`.
- **`Spinner`** — lucide `Loader2` + `animate-spin` + `role="status"`.

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

## Testing

- Composables and utils are the main target — covered by `tests/composable-*.test.js` and the various utility tests.
- Vue rendering / user interactions / browser APIs: out of scope for the Node test runner.
- For visual changes (layout, styling, animations), self-testing is not possible — explicitly ask the user to verify via `npm run dev`.

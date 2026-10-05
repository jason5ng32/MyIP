# frontend/AGENTS.md

Conventions specific to the Vue 3 SPA under `frontend/`. Universal rules
(language, i18n, commits, testing) live in ../AGENTS.md.

## Overview

Vue 3 `<script setup>` + Pinia + vue-router (HTML5 history) + Tailwind CSS v4
over copied-in shadcn-vue primitives. No TypeScript, no `dark:` dual pairs.

## Layout

```
frontend/
├── App.vue / main.js / store.js / router/ / locales/ / style/style.css
│                    (App.vue: the site Nav + User / Preferences, then the page)
├── firebase-init.js ← env-gated lazy Firebase Auth (boot path: utils/auth-hint.js)
├── sentry-init.js   ← env-gated Sentry (see "Error monitoring")
├── data/            ← static config (tools registry drives pages+cards+nav)
├── lib/ · utils/ · composables/  ← see "Helper placement"
└── components/      ← sections + ip-infos/ advanced-tools/ report/ widgets/ svgicons/ ui/
```

Every file opens with a header comment stating its purpose — read those.

## Conventions

- **Composition API** everywhere; no Options API. Alias `@` → `frontend/`.
- **Shared-with-backend helpers live in `common/`**, re-exported through a thin
  `utils/` bridge so consumers keep `@/utils/...` imports (`utils/ip/valid-ip.js`).
- **Helper placement:** Vue reactivity / lifecycle → `composables/` (`useXxx`);
  otherwise `utils/` (never `use-` prefixed). `lib/` stays shadcn-only. A pure
  function next to a composable exports from that composable's file.
- **Inside `utils/`:** app-wide plumbing at its root; IP / ASN data shaping
  and validation → `ip/`; the report pipeline → `report/`; the pure layer of
  one feature (a tool, a section, Pulse) → `features/`; per-source probe
  modules keep their own dirs (`getips/`, `dnsleaks/`, `persona/`).

### Achievements are event-driven

Components never touch achievements — they emit domain events unconditionally
(`emitAppEvent('speedtest:finished', {…})`); `data/achievement-rules.js` maps
events → slugs, `composables/use-achievement-engine.js` owns all guards (rules
wait for the remote snapshot; pre-sync hits parked). New achievement = entry +
rule + (only if no suitable event exists) a new event. The shareable report
rides the same bus: `<domain>:finished` → `use-report-collector.js` →
`utils/report/report-builders.js` → sections whitelisted by `common/report-schema.js`.
New reportable test = event + builder + schema entry in one change; new result
semantics = builder whitelist + schema enum too (builders fail soft, fixtures
are frozen: drift = quietly missing fields). Report links are public: the
builder, not the renderer, drops visitor-supplied data (Persona Check: id / axis
/ verdict, never `detail`; Invisibility: key + flag).

### Commands are the imperative twin of events

`utils/app-commands.js`: events say "this happened"; a command says "do this" —
one owner (`use-app-command.js`, scope-bound, setup-time), and
`dispatchAppCommand` resolves with its result. Payload = one plain JSON object
shaped at registration; rejections are `appCommandError(code, message)` with
reserved `auth` / `quota` / `input` (the bus adds `unavailable` / `timeout`).
Cross-component triggers use the bus, never template refs (refs stay for UI
chrome); tools register at setup, callers `waitForAppCommand` first.

### Advanced Tools are pages, kept alive

- Every tool is a page at `/tools/:slug` (`ToolPage.vue` over the
  `data/tools.js` registry), and every opener routes there: cards are real
  `<a href>` (a plain click `router.push`es, modifier clicks stay the
  browser's), Nav, shortcuts (`Advanced.vue`'s exposed
  `openTool`), in-app links. `/?tool=<slug>` survives only as a replace-redirect
  in the router's `beforeEach` (`utils/legacy-tool-link.js`). No tool opens as
  an overlay.
- Gates (`requiresOriginalSite`, `requiresConfig: '<configs key>'`, e.g. `asn` →
  `cloudFlare`) decide listing only, via `isToolAvailable()` / `listedTools()`
  (card grid, Nav); a `/tools/:slug` link is never gated.
- `App.vue` keeps Home and `ToolPage` alive (`KeepAlive`); `ToolPage` keeps up
  to 8 tools alive per slug, dropped on sign-out / account switch
  (`utils/tool-cache.js`). Back / forward is plain history; the breadcrumb's
  Home steps back when the previous entry is Home (`utils/back-target.js`), so
  Home returns as left, scroll included.
- A cached page never unmounts, so whatever acts on the route, the document
  head, window events or the store's one-shot triggers gates on
  `use-route-active.js` (`useRouteActive` / `useActiveValue` /
  `useActiveEventListener`), not on mount / unmount. Overlays on a page being
  left are closed by `use-overlay-shortcuts.js` — their portal would outlive it;
  App.vue's own (store `openSheet`, the `User` dialog) close on a path change.
- Homepage state reaches a tool page through the store, the app-events
  collectors and the command bus: a cached Home keeps its commands registered,
  so a caller dispatches in place and goes home first only when
  `hasAppCommand()` says Home never mounted (Persona Check).

### ASN Profile

- One `/api/asn-profile` request, one loading state, then the whole page; a
  section (reputation included — no `configs.originalSite` check) renders only
  when its `status` is `ok`. `ASNConnectivity.vue` gets `:expandable="false"
  :bordered="false"`; its defaults keep IPCard / QueryIP unchanged.
- `peeringdb` is operator self-reporting: vocabularies → locale keys
  (`PEERING_ENUMS`), names / cities as written. `ASN_PROFILE_TIMEOUT_MS` stays
  above the largest backend section deadline (tested).
- ASN Info's footer links `/tools/asn?q=AS<n>` (hidden when gated off); in
  QueryIP it emits `open-tool` via IpDetailPanel so the dialog closes first.

### Overlays take no keyboard shortcuts

One dispatcher (`utils/shortcut.js`) over the map `use-shortcuts.js` registers
(home route only; Home clears it when left; `registerShortcuts()` replaces it),
suspended while an overlay is open — keyed off form: the `ui/` roots `Dialog` /
`Sheet` / `Drawer` call `use-overlay-shortcuts.js`, so anything built on them
inherits it; overlays nest; Esc and native scrolling still work.

### Error monitoring (Sentry) is env-gated and invisible to app code

No `VITE_SENTRY_DSN_FRONTEND`, or a DEV build → no Sentry loaded (gated dynamic
import, like `firebase-init.js`; all config in `sentry-init.js`). **Never import
`@sentry/vue` in app code. Explicit signals go through the app-events bus**:
`ip-source:exhausted` (a card's whole source chain failed), only when another
card resolved a valid IP of that version. Traps: `console.error` is captured,
fingerprinted on its first argument — name the failure there; `utils/getips/`
failures stay `console.warn`. Replay shows page text unmasked by design (input
masked; in the privacy policy). No backend 5xx capture; envelopes: `/api/monitoring`.

## UI system

**shadcn-vue first:** `components/ui/`, then the shadcn-vue docs; hand-rolled
Tailwind only when neither fits. Keep on upstream syncs: `Spinner` +
`ToolLoadingSkeleton`, `toggle` / `toggle-group`'s `primary` pressed pair, the
overlay roots' shortcut suspension, `select`'s trigger geometry (`py-1` + flex
value span, not `-webkit-box` — Safari shifts it ~2px).

### Design tokens

`style/style.css`: `--info` (waiting) · `--success` (ok-fast) · `--warning`
(ok-slow) · `--action` (run), each with `-foreground`; semantic tokens only,
never `dark:` pairs. Button adds `action` / `success`; Badge adds `success`,
hover disabled (wrap it to interact). FAB colors: `action` trigger, `default`
stateless panel, `success` protective state on, `secondary` dock; ≤ 2 accents.

### Status tones

Every "business state → color" mapping goes through `use-status-tone.js`
(`wait` / `ok-fast` / `ok-slow` / `fail`), normally via `ipFieldTone()`.

### Canonical patterns — copy the named exemplar, don't re-invent

- **Trigger button** — `variant="action"` + `<Spinner v-if />` + `:disabled` (QueryIP, Whois).
- **Input + icon trigger** — flex row, compact icon Button, no text label (QueryIP).
- **AutoFill-proof inputs** — all six on every free-form Input: `autocomplete`
  / `autocorrect` / `autocapitalize="off"`, `spellcheck="false"`,
  `data-1p-ignore`, `data-lpignore="true"`; placeholders avoid "address / 地址
  / adresse / adresi" (iOS QuickType keys on the word).
- **Status card** — `keyboard-shortcut-card` (J/K target) `jn-card` (shadow /
  border / outline) + hover lift (IPCard).
- **Flag** — always `<Icon :icon="'circle-flags:' + code.toLowerCase()" />`.
- **Dates & times** — via `utils/time-utils.js` + the vue-i18n locale; no
  hand-rolled `Intl` / `toLocaleDateString` without a why-comment.
- **Fit-to-width tokens** — IP / MAC strings in `<FitText>` (`HERO_TIERS` /
  `INLINE_TIERS`; `:max-lines="2"` on heroes); no length-threshold helpers.
- **Filter tags** — `ToggleGroup :spacing="2"` of detached `h-7 rounded-full`
  pills, `w-full flex-wrap` (IPHistory, DnsResolver); never `spacing=0`.
- **Shareable tool input** — watch `useActiveValue(() => route.query.q, {
  pathOf: () => route.path })` (immediate, so mount, later changes and a `q`
  changed while cached all run; another page's `q` never does), `router.replace`
  it on every run (AsnProfile); the URL is `/tools/<slug>?q=`, which a legacy
  `/?tool=<slug>&q=` redirects to with `q` kept.
- **Fixed option sets** — a closed list wider than one line is a `Select`.
- **Qualifier + input + run** — `Select` + `Input` in one `ButtonGroup`, the run
  Button in a second (DnsResolver); trigger `w-auto shrink-0`; never wraps.
- **Tables vs lists** — real per-column header semantics → `<table>`;
  otherwise a bordered `<ul class="rounded-lg border bg-card divide-y">`.
- **Dialog header** — the `<DialogHeader :icon :title />` primitive.
- **Site navigation** — one `Nav.vue` in `App.vue` above every route (fixed;
  `index.html` pads the body for it), never per page; `User` / `Preferences`
  sit beside it, one each. Its sections and tools are peers: what a click
  does on the current route is `resolveNavTarget()` (`utils/nav-target.js`:
  scroll on Home, go home then scroll elsewhere, a tool → its page), carried
  out by `use-nav-target.js`; no section is highlighted off Home.
- **Page breadcrumb** — every page but Home opens its body with
  `<PageBreadcrumb :items />` above the `<h1>` (← Home / … / current page):
  real links, Home via `resolveBackTarget()`, section crumbs via the Nav's
  helper, the last crumb `aria-current="page"`.
- **Responsive hide** — `.hidden` is `!important` (`style/style.css`), so
  `hidden sm:flex` never shows: write `max-sm:hidden`.
- **Drawer vs Sheet** — bottom Drawer only for a full-bleed expansion of an
  inline visual (ASNConnectivity's graph); side panels use `Sheet`; a tool is a
  page, never either.
- **Motion** — hover lift `transition-transform duration-300 ease-out
  hover:-translate-y-1.5`; loading is `<Spinner />`, never pulse-dots.

## Testing

Composables and utils are the target (`tests/composable-*.test.js`); rendering /
browser APIs are out of scope — visual changes need the user in `pnpm dev`.

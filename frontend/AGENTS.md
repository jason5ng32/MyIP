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
├── firebase-init.js ← env-gated lazy Firebase Auth (boot path: utils/auth-hint.js)
├── sentry-init.js   ← env-gated Sentry (see "Error monitoring")
├── data/            ← static config (tools registry drives router+cards+drawer)
├── lib/ · utils/ · composables/  ← see "Helper placement"
└── components/      ← sections + ip-infos/ advanced-tools/ report/ widgets/ svgicons/ ui/
```

Every file opens with a header comment stating its purpose — read those.

## Conventions

- **Composition API** everywhere; no Options API. Alias `@` → `frontend/`.
- **Shared-with-backend helpers live in `common/`**, re-exported through a thin
  `utils/` bridge so consumers keep `@/utils/...` imports (`utils/valid-ip.js`).
- **Helper placement:** Vue reactivity / lifecycle → `composables/` (`useXxx`);
  otherwise `utils/` (never `use-` prefixed). `lib/` stays shadcn-only. A pure
  function next to a composable exports from that composable's file.

### Achievements are event-driven

Components never touch achievements — they emit domain events unconditionally
(`emitAppEvent('speedtest:finished', {…})`); `data/achievement-rules.js` maps
events → slugs, `composables/use-achievement-engine.js` owns all guards (rules
wait for the remote snapshot; pre-sync hits parked). New achievement = entry +
rule + (only if no suitable event exists) a new event. The shareable report
rides the same bus: `<domain>:finished` → `use-report-collector.js` →
`utils/report-builders.js` → sections whitelisted by `common/report-schema.js`.
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

### Advanced Tools gates decide listing only

`data/tools.js` gates (`requiresOriginalSite`, `requiresConfig: '<configs key>'`,
e.g. `asn` → `cloudFlare`) are read only via `isToolAvailable()`, by the card
grid and the nav; deep links (`?tool=`, `/tools/:slug`) are never gated.

### ASN Profile

- One `/api/asn-profile` request, one loading state, then the whole page; a
  section (reputation included — no `configs.originalSite` check) renders only
  when its `status` is `ok`. `ASNConnectivity.vue` gets `:expandable="false"
  :bordered="false"`; its defaults keep IPCard / QueryIP unchanged.
- ASN Info's footer links `/tools/asn?q=AS<n>` (hidden when gated off); in
  QueryIP it emits `open-tool` via IpDetailPanel so the dialog closes first.

### Overlays take no keyboard shortcuts

One dispatcher (`utils/shortcut.js`) over the map `use-shortcuts.js` registers
(home route only; Home clears it on unmount; `registerShortcuts()` replaces it),
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

### Canonical patterns

Copy the named exemplar instead of re-inventing:

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
- **Shareable tool input** — read `route.query.q` on mount, `router.replace` it
  on every run (IpCalculator, AsnProfile); both `/tools/` and `?tool=` URLs.
- **Fixed option sets** — a closed list wider than one line is a `Select`.
- **Qualifier + input + run** — `Select` + `Input` in one `ButtonGroup`, the run
  Button in a second (DnsResolver); trigger `w-auto shrink-0`; never wraps.
- **Tables vs lists** — real per-column header semantics → `<table>`;
  otherwise a bordered `<ul class="rounded-lg border bg-card divide-y">`.
- **Dialog header** — the `<DialogHeader :icon :title />` primitive.
- **Drawer vs Sheet** — bottom Drawer for Advanced Tools and full-bleed
  expansions of an inline visual; side panels use `Sheet`.
- **Motion** — hover lift `transition-transform duration-300 ease-out
  hover:-translate-y-1.5`; loading is `<Spinner />`, never pulse-dots.

## Testing

Composables and utils are the target (`tests/composable-*.test.js`); Vue rendering
and browser APIs are out of scope. Visual changes can't be self-tested — say so
and let the user verify in `pnpm dev`.

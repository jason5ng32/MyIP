# frontend/AGENTS.md

Conventions specific to the Vue 3 SPA under `frontend/`. Universal rules
(language, i18n, commits, testing) live in ../AGENTS.md.

## Overview

Vue 3 `<script setup>` + Pinia + vue-router (HTML5 history) + Tailwind CSS v4
over shadcn-vue primitives (copied in, not a package). No TypeScript, no
`dark:` dual-pair utilities.

## Layout

```
frontend/
├── App.vue          ← thin shell: global providers + <router-view>
├── main.js          ← bootstrap + env-gated dynamic init (Sentry, Firebase)
├── store.js         ← Pinia main store
├── firebase-init.js ← env-gated lazy Firebase Auth; boot path picked by the
│                      utils/auth-hint.js flag (signed-in → gate mount on
│                      auth; visitor → SDK never loads until sign-in)
├── sentry-init.js   ← env-gated Sentry (see "Error monitoring" below)
├── router/          ← `/` Home · `/tools/:slug` StandaloneTool · `/privacy`
│                      · `/r/:id` shared report (noindex)
│                      (advanced tools also open in-page via `?tool=<slug>`)
├── locales/         ← en / zh / fr / ru + on-demand sub-packs
├── style/style.css  ← Tailwind v4 entry + design tokens
├── lib/             ← cn() only (shadcn support layer)
├── data/            ← static config: achievements + achievement-rules /
│                      ip-databases / sections / changelog / tools registry
│                      (router + cards + drawer all derive from it)
├── utils/           ← framework-agnostic helpers + IO
│                      (app-events bus / getips/ / valid-ip / analytics / …)
├── composables/     ← Vue-aware `useXxx` logic
└── components/      ← Home / StandaloneTool / top-level sections, plus
                       ip-infos/ · advanced-tools/ · report/ · widgets/ ·
                       svgicons/ · ui/
```

Directory-level only — every file opens with a header comment stating its
purpose; read those for specifics.

## Conventions

- **Composition API.** `<script setup>` everywhere; no Options API.
- **Path alias.** `@` → `frontend/`.
- **Shared-with-backend helpers live in `common/`**, re-exported through a
  thin bridge in `utils/` so consumers keep `@/utils/...` imports (pattern:
  `utils/valid-ip.js`, `utils/fetch-with-timeout.js`).
- **Helper placement:** needs Vue reactivity / lifecycle → `composables/`
  (`useXxx`); otherwise → `utils/` (never `use-` prefixed). `lib/` stays
  shadcn-only. A pure function living next to a composable is exported from
  that composable's file, not promoted to its own.

### Achievements are event-driven

Components never touch the achievement system. They emit domain events
unconditionally — `emitAppEvent('speedtest:finished', {…})` on the
`utils/app-events.js` bus — and the pipeline downstream handles the rest:
`data/achievement-rules.js` maps events to achievement slugs (single place to
look for "what unlocks X"); `composables/use-achievement-engine.js` (init'd
once in App.vue) owns the signed-in / already-achieved / rate guards.
New achievement = entry in `data/achievements.js` + rule + (only if no
suitable event exists) a new domain event. Tests:
`tests/achievement-rules.test.js`, `tests/composable-achievement-engine.test.js`.

The shareable diagnostic report rides the same bus: every "my network" test
emits `<domain>:finished` with its full structured result;
`composables/use-report-collector.js` (init'd once in App.vue) normalizes
payloads through `utils/report-builders.js` into sections whitelisted by
`common/report-schema.js`, and `components/report/` consumes the snapshots
(share dialog + read-only /r/:id page). New reportable test = emit event +
builder + schema entry, in the same change. Changing a test's result
semantics or an upstream field means updating that test's builder whitelist
+ schema enum too — builders fail soft (unknown values silently drop the
field) and test fixtures are frozen, so drift shows up as quietly missing
report fields, not as errors.

### Error monitoring (Sentry) is env-gated and invisible to app code

`sentry-init.js` loads via a build-time-gated dynamic import: no
`VITE_SENTRY_DSN_FRONTEND` → no Sentry code in the bundle at all (same
philosophy as `firebase-init.js`). Two rules:

- **Never import `@sentry/vue` in app code** — a static import would drag the
  SDK back into the main bundle. All Sentry config lives in `sentry-init.js`.
- **Explicit signals go through the app-events bus**, like achievements: the
  component emits, `sentry-init.js` subscribes. One signal is captured:
  `ip-source:exhausted` (an IP card's whole source chain failed). Cards
  report only when the `ipinfo:finished` snapshot shows some card resolved a
  valid IP of the same version — otherwise "our chain failed" is
  indistinguishable from visitor-side conditions (no IPv6 / dead network),
  which is routine noise.

Capture surface: uncaught errors; `console.error` (fingerprinted per message
prefix so each source stays a distinct issue; individual `utils/getips/`
source failures are `console.warn` — invisible to Sentry by design, the
per-card exhaustion event above is the health signal); route-change traces;
error-only Replay, page text deliberately unmasked (the visitor's on-screen
network info IS the debugging context; typed input stays masked; disclosed
in the privacy policy). Third-party script errors (Cloudflare's RUM beacon)
are dropped via `denyUrls`.
Backend 5xx is deliberately NOT captured frontend-side — the backend SDK
reports its own failures. Envelopes ship through the first-party tunnel
`/api/monitoring` (`api/sentry-tunnel.js`) to beat ad blockers; source maps
upload at build, gated on `SENTRY_AUTH_TOKEN`.

## UI system

**shadcn-vue first.** Check `components/ui/` (21 copied-in primitives), then
https://www.shadcn-vue.com/docs/components for something to copy in;
hand-rolled Tailwind only when neither fits. Two local notes: `Spinner` is
project-specific (lucide `Loader2` + `role="status"`); `toggle` /
`toggle-group` deliberately use the `primary` pair for the pressed state —
don't revert that when syncing upstream.

### Design tokens

Top of `style/style.css`; four business-semantic colors on top of shadcn
defaults, each with a paired `-foreground`:

`--info` (waiting / in-progress) · `--success` (ok-fast) · `--warning`
(ok-slow) · `--action` (the "run / trigger" brand color)

Rule: semantic tokens only (`bg-info` / `bg-action` / `bg-muted` /
`text-muted-foreground` / …). Never write `dark:` dual pairs — tokens theme
themselves.

Button adds `action` and `success` variants to the shadcn set; Badge adds
`success` and has hover globally disabled (display element — wrap it for
interactivity). FAB colors express semantics, never decoration: `action` =
trigger, `default` = stateless panels, `success` = protective state active,
`secondary` = dock controls; at most two accents visible at once.

### Status tones

Every "business state → color" mapping goes through
`composables/use-status-tone.js` (`wait` / `ok-fast` / `ok-slow` / `fail`),
normally via its `ipFieldTone()` helper. No hand-rolled state→color switches.

### Canonical patterns

Copy from the named exemplar instead of re-inventing:

- **Trigger button** — `variant="action"` + `<Spinner v-if />` + `:disabled`
  (QueryIP, MacChecker, Whois, …).
- **Input + icon trigger** — flex row, compact icon Button (lucide `Search`),
  no text label (QueryIP / Whois / DnsResolver).
- **AutoFill-proof inputs** — every free-form Input carries all six:
  `autocomplete="off" autocorrect="off" autocapitalize="off"
  spellcheck="false" data-1p-ignore data-lpignore="true"`, and placeholder
  copy avoids "address / 地址 / adresse / adresi" — iOS QuickType keys on the
  word itself even with autocomplete off.
- **Status card** — `keyboard-shortcut-card jn-card` markers + hover-lift
  transition (Connectivity / WebRTC / IPCard). `jn-card` = shadow / border /
  keyboard outline; `keyboard-shortcut-card` = J/K navigation target.
- **Flag** — always `<Icon :icon="'circle-flags:' + code.toLowerCase()" />`.
- **Fit-to-width tokens** — IP / MAC strings render inside `<FitText>`
  (`HERO_TIERS` hero rows, `INLINE_TIERS` compact rows; `:max-lines="2"` on
  heroes). Never per-component length-threshold helpers (IPCard, QueryIP).
- **Tables vs lists** — real per-column header semantics → `<table>`;
  otherwise a bordered `<ul class="rounded-lg border bg-card divide-y">`.
- **Dialog header** — the `<DialogHeader :icon :title />` primitive.
- **Drawer vs Sheet** — the vaul-vue bottom Drawer is reserved for the
  Advanced Tools panel; side panels use `Sheet`.
- **Motion** — hover lift `transition-transform duration-300 ease-out
  hover:-translate-y-1.5`; loading is `<Spinner />`, never pulse-dot clusters.

## Testing

Composables and utils are the target (`tests/composable-*.test.js` and
friends). Vue rendering / browser APIs are out of scope for the Node runner.
Visual changes can't be self-tested — say so and let the user verify in
`pnpm dev`.

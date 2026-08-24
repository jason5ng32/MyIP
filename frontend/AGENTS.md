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

Components never touch the achievement system — they emit domain events
unconditionally (`emitAppEvent('speedtest:finished', {…})` on `utils/app-events.js`);
`data/achievement-rules.js` maps events → slugs, `composables/use-achievement-engine.js`
owns all guards (rules wait for the remote snapshot; pre-sync hits parked).
New achievement = entry + rule + (only if no suitable event exists) a new event.

The shareable report rides the same bus: tests emit `<domain>:finished`;
`composables/use-report-collector.js` normalizes via `utils/report-builders.js`
into sections whitelisted by `common/report-schema.js`. New reportable test =
event + builder + schema entry, same change; changing result semantics means
updating builder whitelist + schema enum too — builders fail soft and fixtures
are frozen, so drift shows up as quietly missing fields, not errors.

A report link is readable by anyone, so the builder — not the renderer — drops
anything the visitor supplied: Persona Check ships only id / axis / verdict
(never the per-check `detail`); Invisibility likewise key + flag only.

### Commands are the imperative twin of events

`utils/app-commands.js`: events say "this happened" (any subscribers); a command
says "do this" — exactly one owner, and `dispatchAppCommand` resolves when the
work is done, with the owner's result. Owners register via
`composables/use-app-command.js` (scope-bound, setup-time); payload = one plain
JSON object whose shape the owner defines at its registration site. Handlers
reject gated / invalid runs with `appCommandError(code, message)` and reserved
codes `auth` / `quota` / `input` (the bus produces `unavailable` / `timeout`),
so callers react programmatically. Cross-component triggers go through the bus —
never template refs (refs stay for UI chrome). Future advanced tools register
at setup (`?tool=` mount); callers `waitForAppCommand` + dispatch.

### Overlays take no keyboard shortcuts

One document-level dispatcher (`utils/shortcut.js`) over the map
`composables/use-shortcuts.js` registers — all home-page actions, suspended
while any overlay is open. The rule keys off form, not purpose: the `ui/`
roots (`Dialog` / `Sheet` / `Drawer`) call `composables/use-overlay-shortcuts.js`,
so anything built on them inherits it; overlays nest. Esc and native scrolling
keys still work (reka-ui / vaul / the browser own those). `registerShortcuts()`
replaces the map, and Home clears it on unmount — shortcuts are home-route only.

### Error monitoring (Sentry) is env-gated and invisible to app code

No `VITE_SENTRY_DSN_FRONTEND` → no Sentry code in the bundle at all
(build-time-gated dynamic import, like `firebase-init.js`). Rules:

- **Never import `@sentry/vue` in app code** — a static import drags the SDK
  into the main bundle. All config lives in `sentry-init.js`.
- **Explicit signals go through the app-events bus**: component emits,
  `sentry-init.js` subscribes. One signal: `ip-source:exhausted` (a card's whole
  source chain failed) — emitted only when another card resolved a valid IP of
  the same version; otherwise no-IPv6 / dead-network visitors = routine noise.

Traps: `console.error` is captured, fingerprinted on the first argument — name
the failure there; `utils/getips/` source failures stay `console.warn`,
invisible by design. Replay leaves page text unmasked deliberately (on-screen
network info IS the debugging context; typed input masked; in the privacy
policy). Backend 5xx is NOT captured frontend-side. Envelopes ship through the
first-party tunnel `/api/monitoring` to beat ad blockers.

## UI system

**shadcn-vue first.** Check `components/ui/`, then the shadcn-vue docs for
something to copy in; hand-rolled Tailwind only when neither fits. Keep when
syncing upstream: `Spinner` + `ToolLoadingSkeleton` (project-specific),
`toggle` / `toggle-group`'s deliberate `primary` pressed pair, the overlay
roots' shortcut suspension, and `select`'s trigger geometry — `py-1` plus a
flex (not `-webkit-box` line-clamp) value span, because Safari shifts button
content up ~2px once it overflows the trigger's content box.

### Design tokens

Top of `style/style.css`; four business-semantic colors with paired `-foreground`:
`--info` (waiting) · `--success` (ok-fast) · `--warning` (ok-slow) · `--action`
(run / trigger). Semantic tokens only; never `dark:` dual pairs — tokens theme
themselves. Button adds `action` / `success` variants; Badge adds `success`,
hover globally disabled (display element — wrap it for interactivity). FAB colors
are semantic, never decorative: `action` = trigger, `default` = stateless panel,
`success` = protective state active, `secondary` = dock; max two accents at once.

### Status tones

Every "business state → color" mapping goes through
`composables/use-status-tone.js` (`wait` / `ok-fast` / `ok-slow` / `fail`),
normally via `ipFieldTone()` — no hand-rolled state→color switches.

### Canonical patterns

Copy the named exemplar instead of re-inventing:

- **Trigger button** — `variant="action"` + `<Spinner v-if />` + `:disabled` (QueryIP, Whois).
- **Input + icon trigger** — flex row, compact icon Button, no text label (QueryIP).
- **AutoFill-proof inputs** — all six on every free-form Input:
  `autocomplete="off" autocorrect="off" autocapitalize="off"
  spellcheck="false" data-1p-ignore data-lpignore="true"`; placeholder copy
  avoids "address / 地址 / adresse / adresi" — iOS QuickType keys on the word.
- **Status card** — `keyboard-shortcut-card jn-card` + hover lift (IPCard):
  `jn-card` = shadow / border / outline; `keyboard-shortcut-card` = J/K target.
- **Flag** — always `<Icon :icon="'circle-flags:' + code.toLowerCase()" />`.
- **Dates & times** — every user-visible stamp renders through
  `utils/time-utils.js` with the vue-i18n locale; no hand-rolled
  `toLocaleDateString` / `Intl.DateTimeFormat` — deliberate exceptions carry a
  why-comment (ASNHistory ISO columns, report-export intro, ServiceStatus clock).
- **Fit-to-width tokens** — IP / MAC strings render in `<FitText>` (`HERO_TIERS` /
  `INLINE_TIERS`; `:max-lines="2"` on heroes); never length-threshold helpers.
- **Tables vs lists** — real per-column header semantics → `<table>`;
  otherwise a bordered `<ul class="rounded-lg border bg-card divide-y">`.
- **Dialog header** — the `<DialogHeader :icon :title />` primitive.
- **Drawer vs Sheet** — vaul-vue bottom Drawer for the Advanced Tools panel
  and full-bleed expansions of an inline visual; side panels use `Sheet`.
- **Motion** — hover lift `transition-transform duration-300 ease-out
  hover:-translate-y-1.5`; loading is `<Spinner />`, never pulse-dots.

## Testing

Composables and utils are the target (`tests/composable-*.test.js`). Vue
rendering / browser APIs are out of scope for the Node runner. Visual changes
can't be self-tested — say so and let the user verify in `pnpm dev`.

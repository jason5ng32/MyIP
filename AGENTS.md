# AGENTS.md

Single source of truth for anyone — human or AI — contributing to MyIP.
Area-specific details: @frontend/AGENTS.md (Vue SPA) · @api/AGENTS.md (Express API).

## Overview

**MyIP** (IPCheck.ing) is an open-source IP toolbox: IP lookup, connectivity
tests, WebRTC / DNS-leak detection, speed test, MTR, Whois, security
checklist, browser fingerprint, anonymity checks, and more. Single repo, two
halves: a Vue 3 SPA front-end and an Express 5 back-end API.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (`<script setup>`) · Pinia · vue-router (HTML5 history) · vue-i18n (`en`/`zh`/`fr`/`ru`) |
| Build | Vite + `@vitejs/plugin-vue`; Tailwind CSS v4 + `tw-animate-css` |
| UI | shadcn-vue copy-in primitives (reka-ui) · lucide icons · circle-flags via `@iconify/vue` · vaul-vue drawer · vue-sonner toast |
| Backend | Express 5 |
| Logger | `pino` singleton at `common/logger.js` (+ `pino-http`, opt-in) |
| Auth | Firebase Auth (optional, env-gated) |
| Error monitoring | Sentry — optional & env-gated on both halves: `@sentry/vue` (no `VITE_SENTRY_DSN_FRONTEND`, no Sentry in the build — see frontend/AGENTS.md) + `@sentry/node` (no `SENTRY_DSN_BACKEND`, never loaded — see api/AGENTS.md) |
| PWA | `manifest.webmanifest` only — installable but online-only, no service worker |
| Tests | Node built-in test runner (`node --test`) |
| Runtime libs | chart.js · svgmap · @cloudflare/speedtest · maxmind · whoiser · thumbmarkjs · ua-parser-js · detect-gpu · @vueuse/core |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Vite + backend (nodemon) together |
| `pnpm build` | Front-end production build |
| `pnpm preview` | Vite preview of the build output |
| `pnpm start` | Built front-end + backend |
| `pnpm test` | Run all `tests/*.test.js` specs |
| `pnpm check` | `test` + `build` — the pre-commit self-check |

**pnpm only** (pinned via `packageManager`); `pnpm-lock.yaml` is committed and
`pnpm-workspace.yaml` holds the `allowBuilds` install-script approvals. Never
use npm / yarn — they'd produce a competing lockfile.

## Project layout

```
.
├── AGENTS.md / CLAUDE.md        ← this file + Claude pointer to it
├── frontend/                    ← Vue 3 SPA (see frontend/AGENTS.md)
├── api/                         ← Express handlers (see api/AGENTS.md)
├── common/                      ← code shared by both halves (valid-ip /
│                                  fetch-with-timeout / guards / logger / …)
├── tests/                       ← Node test runner specs
├── backend-server.js            ← Express app (default port 11966)
├── sentry-instrument.js         ← backend Sentry bootstrap via `node --import`;
│                                  no-op without SENTRY_DSN_BACKEND
├── frontend-server.js           ← static server for `pnpm start` (+ SPA fallback)
├── ecosystem.config.cjs         ← pm2 definitions (carries the `--import` flag)
├── index.html                   ← Vite entry
├── vite.config.js / jsconfig.json (alias @ → frontend/) / package.json
```

## Conventions

### Language

- **JavaScript only.** New files are `.js` / `.vue`; no `lang="ts"`, no
  TypeScript migration.
- **English by default** for code comments, commit messages, and AGENTS.md.
  Locale packs obviously carry their own language; planning docs are free.

### Functions

- **New functions use `const` arrow syntax** (`const fn = async () => {}`),
  not `function` declarations. Object methods keep shorthand. Arrow consts
  aren't hoisted — declare before use. Applies to new / rewritten code only;
  don't mass-convert existing declarations.

### Comments

- **Every new file opens with a header comment** stating its purpose.
- **Large templates / functions carry block comments** per meaningful region.
- **Comments describe the code as it is now** — no changelog narration
  (`previously…`, `…fixes that`); git history covers the past. A comment
  stays shorter than the code it explains.

### i18n coverage

- Copy-surfacing features land in **all four locales** in the same change —
  including `frontend/data/changelog.json` entries
  (`tests/changelog.test.js` enforces it).

### Logging (backend)

- **Always the shared logger** (`common/logger.js`) in backend files; bare
  `console.*` is banned there (frontend keeps using `console.*`).
- Pino first-arg-is-context: `logger.error({ err, ip }, 'short message')`.
- Env knobs: `LOG_LEVEL` (default info), `LOG_FORMAT=json` for shippers,
  `LOG_HTTP=true` to mount `pino-http` on `/api` (off by default; handlers
  never log "received request" lines themselves). No `NODE_ENV` anywhere.
- Startup-only lines lead with an emoji (🚀 listening · 📦 ready ·
  📥 downloading · 🛡️ security · 🐢 throttling · 🗓️ schedule · ⚠️ recoverable
  · ❌ failure); per-request logs stay plain.

## Testing

- Any non-visual logic exercisable without a network call — pure functions,
  composables with mockable inputs, transforms, validators — ships with a
  spec in `tests/`, in the same change (don't defer; update affected tests
  when behavior shifts).
- UI rendering, real network behavior, and browser APIs are out of scope.
- **`pnpm check` must be green before handing off.**

## Security & Boundaries

Access control and timeouts live in shared middleware, not handlers
(details in @api/AGENTS.md):

- `requireReferer` is global on `/api/*`; `requireValidIP()` per-route —
  handlers never repeat these checks.
- Every upstream HTTP call goes through `fetchUpstream`
  (`common/fetch-with-timeout.js`, 8s timeout). Never a bare `fetch()` in `api/`.

## Workflow

- **Branch discipline — `dev` in, `dev` out.** `main` only moves via
  dev → main PRs. From a worktree, fast-forward dev with `git push . HEAD:dev`
  (repo has `receive.denyCurrentBranch=updateInstead`), not `git update-ref`.
- **No commits without explicit user approval** — AI edits → user reviews →
  user tests → user says "commit". Even with tests green, visual changes need
  user eyes before landing.
- **One concern per commit**, message style per `git log`
  (`Feat(xxx):` / `Fix(ui):` / `Refactor(xxx):` / `Style:` / `Chore:`),
  AI adds itself as co-author.
- **Self-test before handing off** (`pnpm check`); if a change is visual and
  headless-unverifiable, say so explicitly.
- **On every commit, scan AGENTS.md (root + relevant sub-file) for
  staleness** — conventions, renames, flipped rules, dead examples get fixed
  in the same commit. Doc drift is this file's main failure mode.

---

If [local-context.md](./local-context.md) exists in the workspace root, read
it too — it lists machine-local Knowledge Hub paths (not in git).

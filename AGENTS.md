# AGENTS.md

Single source of truth for anyone — human or AI — contributing to MyIP.

For area-specific details, see:

- Frontend (Vue 3 SPA): @frontend/AGENTS.md
- Backend API (Express): @api/AGENTS.md

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
| Logger | `pino` + `pino-pretty` (dev) + `pino-http` (request logs) — singleton at `common/logger.js` |
| Auth | Firebase Auth (optional, env-gated) |
| PWA | Serwist |
| Tests | Node built-in test runner (`node --test`) |
| Runtime libs | chart.js · svgmap · @cloudflare/speedtest · maxmind · whoiser · thumbmarkjs · ua-parser-js · detect-gpu · circle-progress.vue · @vueuse/core (used by shadcn-vue primitives) |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite + backend (nodemon) together — front-end 5173, back-end 11966 |
| `npm run build` | Front-end production build |
| `npm run preview` | Vite preview of the build output |
| `npm run start` | Built front-end + backend (static file server) |
| `npm test` | Run all `tests/*.test.js` specs |
| `npm run check` | `test` + `build`, the pre-commit self-check |

## Project layout

```
.
├── AGENTS.md                    ← this file
├── CLAUDE.md                    ← Claude-specific pointer to AGENTS.md
│
├── frontend/                    ← Vue 3 SPA (see frontend/AGENTS.md)
├── api/                         ← Express handlers (see api/AGENTS.md)
├── common/                      ← code shared between front- and back-end
│                                  (valid-ip / fetch-with-timeout / guards /
│                                   referer-check / maxmind-service / …)
├── tests/                       ← Node test runner specs
│
├── backend-server.js            ← Express app (default port 11966)
├── frontend-server.js           ← static file server for `npm start`
├── index.html                   ← Vite entry; #app mounts vaul-drawer-wrapper
├── vite.config.js
├── jsconfig.json                ← JS project, alias @ → frontend/
└── package.json
```

## Conventions

### Language

- **JavaScript only.** New files are `.js` / `.vue`; `<script setup>` has no `lang="ts"`. Do not rename `jsconfig.json` to `tsconfig.json` or otherwise introduce TypeScript.
- **English by default** for source-code comments , commit messages and AGENTS.md files. Planning docs can be in other languages. Locale packs are obviously the exception — they contain user-facing copy in their respective language.

### Comments

- **Every new file opens with a header comment** stating its purpose. One or two lines is usually enough; enough that a reader opening the file cold understands what it is.
- **Large templates or functions carry block comments** on each meaningful section — enough for a maintainer six months later to orient quickly. Not every line, but every region / branch / step.

### i18n coverage

- Any feature that surfaces copy must land in **all four locales** (`en` / `zh` / `fr` / `tr`) in the same change. No English-only or Chinese-only keys slipping through.
- Same rule applies to `frontend/data/changelog.json` — every entry's `change` object must have all four languages. `tests/changelog.test.js` enforces this.

### Logging (backend)

- **Use the shared logger from `common/logger.js`** in every backend file (`backend-server.js`, `frontend-server.js`, `api/*`, `common/*`). It's a `pino` singleton — pretty-printed via `pino-pretty` by default; set `LOG_FORMAT=json` in `.env` to emit raw JSON for log aggregators. Log level defaults to `warn`; override with `LOG_LEVEL` env in `.env` (`debug` / `info` / `warn` / `error`). At the default `warn`, pino-http's 2xx/3xx request lines are filtered out (they log at level `info`); 4xx become visible warns and 5xx errors. No `NODE_ENV` dependency — the project doesn't use that variable anywhere else.
- **Bare `console.*` is banned** in backend code — it bypasses level filtering and dumps unstructured text into the prod log stream. Frontend code (`frontend/`) is unaffected; browser code keeps using `console.*`.
- **Pino's first-arg-is-context convention.** Errors: `logger.error({ err: error, ip, ... }, 'short message')`. Pino has a built-in serializer for the `err` key that formats stack traces nicely.
- **Startup-only lines (called once at boot)** lead with an emoji for at-a-glance scanning when the dev terminal is busy: 🚀 listening, 📦 ready, 📥 downloading, 🛡️ security on, 🐢 throttling on, 🗓️ schedule, ⚠️ recoverable warning, ❌ failure. Per-request and per-handler logs stay plain.
- **HTTP request logging** is **off by default** to keep pm2 logs from bloating. Set `LOG_HTTP=true` in `.env` to mount `pino-http` on `/api`; when on, 2xx/3xx log as `info`, 4xx as `warn`, 5xx as `error`. Handlers never log incoming requests themselves — they log domain-specific events / errors only, regardless of this flag.

## Testing

- **Test runner:** Node built-in (`node --test`), no third-party framework. Specs live in `tests/*.test.js`.
- **Coverage expectation:** any non-visual logic that can be exercised without a network call — pure functions, composables with mockable inputs, transform utilities, validators — ships with a test in `tests/` and is wired into `npm test`. UI rendering, real network behavior, and browser-API-dependent code are out of scope.
- **Big new features:** write the tests in the same change. Don't defer.
- **Modifying a tested feature:** check the related tests; update them in the same change if behavior shifts.
- **Tests must pass locally before you hand off.** If `npm run check` is red, don't ask the user to review.

## Security & Boundaries

The backend enforces access control and timeouts through shared middleware rather than per-handler code. Full details live in @api/AGENTS.md; the rules that matter at the project level:

- `requireReferer` is mounted globally on `/api/*` — handlers must not repeat the referer check.
- `requireValidIP()` is attached per-route where `?ip` is a required param — handlers must not repeat the IP check.
- Every upstream HTTP call goes through `fetchUpstream` (`common/fetch-with-timeout.js`) with an 8s timeout. Never add a bare `fetch()` to an `api/` handler.

## Workflow

- **Branch discipline — `dev` in, `dev` out.** All work starts from `dev` and lands on `dev`. `main` is only updated via PRs that merge `dev` → `main`; never base a branch on `main`, never push directly to `main`. When an AI assistant operates from a worktree and needs to fast-forward `dev`, use `git push . HEAD:dev` (the repo has `receive.denyCurrentBranch=updateInstead` set, so git syncs the main worktree's files too when it's clean) rather than `git update-ref`, which leaves the main worktree's files out of sync with HEAD.
- **Do not commit without explicit user approval.** The flow is: AI edits → user reviews → user tests → user says "commit" → AI commits. Silent commits are a breach of trust.
- **One concern per commit.** Don't mix unrelated changes into a single commit. Split at the right seam.
- **Self-test before handing off.** Run `npm run check` (or at least `npm test`) for every change. If the change is visual (UI layout, styling, interactions) and can't be verified headless, say so explicitly so the user can test it in `npm run dev`.
- **Every commit is gated on user testing.** Even with tests green, a visual change needs the user to have looked at it before it lands.
- **Add yourself as a co-author to the commit.** If you are an AI.
- **Commit message style** follows recent `git log` — `Refactor(xxx): …` / `Fix(ui): …` / `Feat(xxx): …` / `Style: …` / `Chore: …` prefix.
- **On every commit, scan AGENTS.md (root + relevant sub-file) for staleness** — if the change adds a convention, renames a shared module, flips a rule, or invalidates an example, update the doc in the same commit. AGENTS.md drifting from reality is the main failure mode of this kind of document.

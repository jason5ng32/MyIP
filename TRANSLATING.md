# Translating MyIP

MyIP (demo: [IPCheck.ing](https://ipcheck.ing)) ships its UI in English, 简体中文, Français and
Русский. Adding a fifth — or a sixth — is a two-file change, and **a partial translation is
a welcome first PR**. You do not need to translate everything, and you do not need to know
Vue.

Anything you leave untranslated falls back to English, so a pack with a hundred strings in
it is genuinely useful on day one and can grow over several PRs. Untranslated strings stay
in your pack as `""`, which is what keeps a translation PR readable: every diff line is a
`""` becoming a sentence.

General contribution rules (fork, branch from `dev`, `pnpm check` before you open the PR)
live in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## The smallest useful PR

```bash
pnpm i18n-new pt-BR      # your language's code — see "Naming the code" below
```

That writes the two files a language needs and tells you what to do next:

1. **`frontend/locales/<code>.json`** — every key `en.json` has, every value `""`. Fill in
   what you like and leave the rest empty; starting with just the `page` and `nav` sections
   is fine.
2. **One line in `common/locale-registry.js`** with `status: 'beta'`. Read it over — the
   script guesses `nativeName`, `flag` and `apiTag` and can be wrong.

That's it. No backend change, no build config, no component edits. Everything else — the
language picker, `<html lang>`, the fallback chain, lazy-loading your pack — is derived
from that registry line.

**Leave the keys you skip in place with their `""`.** Deleting them fails the gate, and
keeping them is the whole point: `pnpm i18n-status` can count what's left, and a reviewer
can see at a glance which strings you actually wrote.

## Where the copy lives

| File | What it is | Required? |
|---|---|---|
| `frontend/locales/<code>.json` | The main pack — every string in the app UI (~1,150 keys) | **Yes** — all keys, values may be `""` |
| `frontend/locales/privacy/<code>.json` | Privacy policy copy (~50 keys) | No — but whole or not at all |
| `frontend/locales/security-checklist/<code>.json` | The Cybersecurity Checklist dataset (~1,080 keys, 258 items) | No — but whole or not at all |
| `frontend/data/changelog.json` | Release history, one string per language per entry (161 entries) | No — beta languages are exempt |

`en.json` is the reference for all of them: a translation may lag behind English, never
contradict it.

**The two optional files ship whole or not at all.** Unlike the main pack, they load as one
file each with no per-key fallback inside, so a half-finished one renders a half-English
page. The gate rejects a `""` in either.

- **Privacy copy** is short — translate it in one sitting, or leave it out. Partial privacy
  files don't ship.
- **The checklist** is long (258 items). Same rule: showing the full English checklist beats
  showing gaps, so leave the file out until it's done.

When you're ready to do one, scaffold it the same way you scaffolded the main pack:

```bash
pnpm i18n-new pt-BR --privacy --checklist    # either flag, or both
```

Both need the language registered already (the plain `pnpm i18n-new <code>` run). The
checklist skeleton keeps `slug` and `priority` filled in — those are data, not copy. Until
every other value is filled in, `pnpm test` stays red: finish the file before you commit
it, or delete it again.

## The registry line

`pnpm i18n-new` writes this for you; this is what to check it against.

`common/locale-registry.js`:

```js
{ code: 'pt-BR', nativeName: 'Português (Brasil)', flag: 'br', apiTag: 'pt-BR', htmlLang: 'pt-BR', status: 'beta' },
```

| Column | What to put in it |
|---|---|
| `code` | The UI code **and** your JSON file name. See the naming rule below. |
| `nativeName` | The language's name as its own speakers write it (`Français`, not `French`). |
| `flag` | A lowercase two-letter [circle-flags](https://github.com/HatScripts/circle-flags) code for the picker icon. |
| `apiTag` | The tag sent to upstream data sources. See below. |
| `htmlLang` | The BCP-47 tag written to `<html lang>`. Be precise where script matters: `zh` declares `zh-CN` so Han glyphs stay Simplified on Japanese systems. |
| `status` | `'beta'` for a new language. Maintainers flip it to `'full'` — see [From beta to full](#from-beta-to-full). |

Registry order is also the order the language picker renders, so add your entry where it
reads best rather than always at the end.

### Naming the code

- The **default variant of a language uses the bare code**: `zh` is Simplified Chinese,
  `pt` would be European Portuguese.
- **Variants that arrive later use the full region code**: `zh-TW`, `pt-BR`, `es-MX`.
- If you are translating a variant whose base language is already registered, use the
  region code — your pack then inherits the base as a fallback (see below).

### Picking `apiTag`

Geographic names (city, region names) come from upstream IP databases, which localize into
a fixed set of tags: `en`, `de`, `es`, `fr`, `ja`, `pt-BR`, `ru`, `zh-CN`. Put the closest
one of those in `apiTag`. If none is close, just repeat your own code — place names will
render in English, which is expected and not a bug.

Country names are unaffected: they come from the browser's own `Intl` data and localize
automatically for any language. Dates and times do too.

## What users see for keys you haven't translated

An untranslated string — `""` or a key that isn't there — walks a chain: **your locale →
its base language (if registered) → English**.

- `fr` → `en`
- `zh-TW` → `zh` → `en`

It applies per key in the main pack and per entry in the changelog; the privacy copy and
the checklist walk the same chain, but a whole file at a time. The app never renders a blank
or a raw key path, and it logs no warnings — an incomplete beta pack is a supported state,
not an error.

In the language picker, a `beta` language carries a small **Beta** badge (deliberately the
English word, in every language).

## Checking your work locally

```bash
pnpm install
pnpm test          # the hard gate — must be green
pnpm i18n-status   # progress report — never fails, just tells you where you are
pnpm dev           # then pick your language in Preferences
```

`?hl=<code>` also selects a language, but only before you've saved one in Preferences — a
stored preference wins over the query param.

### What `pnpm test` enforces

`tests/locale-packs.test.js` is the gate. Against English, your pack must:

- **Have exactly English's keys** — no more (a typo'd path is the usual cause), no fewer
  (`pnpm i18n-sync` re-adds any you dropped). Untranslated ones stay as `""`.
- **Use no placeholder English doesn't provide.** `{count}`, `{name}` and friends must be a
  subset of what the English string uses; keep them spelled exactly as-is, and move them
  around the sentence as your grammar needs. Empty values are skipped, naturally.
- **Keep `slug` and `priority` untranslated** in the security checklist — those are data
  (URLs and badge colors), not copy.
- **Contain no `""` in the two optional files.** The privacy copy and the checklist ship
  finished or not at all; only the main pack may carry untranslated values.
- **Translate everything, if the language is `full`.** A `""` left in a `full` locale's main
  pack fails the build, and all three files have to be there. `beta` locales are free to
  leave as many `""` as they like — in the main pack.

`tests/locale-registry.test.js` checks your registry line's shape, and
`tests/changelog.test.js` only requires changelog history for `full` languages.

### What `pnpm i18n-status` shows

Per language and per dataset: percentage translated, and the next keys to do. It also
counts values that are byte-identical to English — sometimes right (`MTR`, product names),
sometimes a copy-paste that never got translated.

```bash
pnpm i18n-status --locale pt-BR --limit 30
```

### When English changes under you

New keys appear in `en.json` all the time. Realign every pack with one command:

```bash
pnpm i18n-sync
```

It adds English's new keys to your main pack as `""`, drops the ones English no longer has,
and puts everything back in English's order. Run it whenever `pnpm test` says keys are
missing, and after a rebase. It never overwrites a translation.

For the privacy copy and the checklist it only *reports* what moved — writing `""` into
them would fail the gate on your behalf. Translate the new keys, or drop the file.

## Improving an existing language

Fixes and better phrasings for `en` / `zh` / `fr` / `ru` are just as welcome as new
languages — edit the JSON and open the PR. Two things to keep in mind:

- Prefer natural phrasing over literal translation; this is a networking tool, and the
  jargon most users know is often the English term.
- Free-form input fields are `autocomplete`-hardened, and their placeholder copy avoids the
  words "address / 地址 / adresse / adresi" on purpose — iOS QuickType keys on them and
  offers to autofill a postal address into an IP field. When translating a placeholder,
  pick a wording that avoids your language's equivalent word too.

## From beta to full

A `full` language is one every future copy change is required to land in, so promotion is a
maintainer decision, made when the language is actually complete:

- Main pack, privacy copy and security checklist all at 100% against `en` — not a single
  `""` left (`pnpm i18n-status` shows this).
- Changelog history back-filled — all 161 entries in `frontend/data/changelog.json`.
- Enough of a track record that copy changes will keep landing in it.

Once `status` flips to `'full'`, `tests/locale-packs.test.js` and `tests/changelog.test.js`
start failing on any gap, which is exactly the point. Until then, no pressure: a beta
language never breaks a build.

## Known limits

Things that will look "untranslated" no matter how complete your pack is. None of them are
bugs, and none of them block a PR:

- **Place names** (city, region) come from upstream IP databases and only exist in `de`,
  `en`, `es`, `fr`, `ja`, `pt-BR`, `ru`, `zh-CN`. Other languages get English place names
  next to a fully translated UI.
- **The pre-Vue loading screen** in `index.html` carries its own tiny set of strings —
  it runs before the app and its bundle exist. Beta languages fall back to English there;
  maintainers handle it at promotion time.
- **Some tool output is upstream data**, not UI copy: Whois records, DNS answers, ASN
  organization names, service-status incident text. Those arrive in whatever language the
  source publishes.
- **The backend needs no change for a new language** — it resolves whatever tag the UI
  sends onto the closest one its data sources actually have, so a translation PR never
  touches back-end code.
- **Documentation** at [docs.ipcheck.ing](https://docs.ipcheck.ing) and the README
  translations are separate efforts — see CONTRIBUTING.md for README translations.

## Questions

Open an issue. If you're planning a large translation, saying so up front is useful — it
avoids two people translating the same 1,000 keys in parallel.

# Getting help

Start with the docs, then pick the channel that matches what you need.

## Documentation first

The **[MyIP Docs Center](https://docs.ipcheck.ing)** covers most questions, in English,
中文, français and русский:

- **[Developer Guide](https://docs.ipcheck.ing/developer)** — deployment (Node, Docker,
  Vercel), MaxMind setup, reverse proxies and `ALLOWED_DOMAINS`, environment variables,
  architecture.
- **[Knowledge Base](https://docs.ipcheck.ing/knowledge-base)** — what each tool measures
  and how to read its results.

Two settings account for most self-hosting problems: MaxMind credentials (without them
the MaxMind source returns 503) and `ALLOWED_DOMAINS` (without it every request from a
non-localhost domain gets 403).

## Where to ask

| You want to… | Go to |
|---|---|
| Ask how to do something, or why a result looks odd | [Discussions → Q&A](https://github.com/jason5ng32/MyIP/discussions/categories/q-a) |
| Report a bug you can reproduce | [New issue → Bug report](https://github.com/jason5ng32/MyIP/issues/new?template=bug_report.md) |
| Suggest a feature | [New issue → Feature request](https://github.com/jason5ng32/MyIP/issues/new?template=feature_request.md) |
| Report a security vulnerability | [Private advisory](https://github.com/jason5ng32/MyIP/security/advisories/new) — see [SECURITY.md](SECURITY.md) |
| Contribute code or a translation | [CONTRIBUTING.md](CONTRIBUTING.md) · [TRANSLATING.md](TRANSLATING.md) |

There are no chat channels — everything happens on GitHub, in the open, so the next
person with the same question can find the answer.

## Making your question answerable

Deployment questions need: how you're running it (Docker / Node / Vercel), the version,
what you set for `ALLOWED_DOMAINS` and MaxMind, and the backend terminal output.
Page questions need: browser, what you saw versus what you expected, and any errors from
the browser console.

MyIP is maintained by one person in their spare time. Replies aren't instant, and a
question that already contains the details above gets answered a lot sooner.

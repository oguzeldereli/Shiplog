<div align="center">

# Shiplog

**Turn commits, PRs, and issues into release notes humans actually read.**

Paste a GitHub repo and get clean, categorized release notes in seconds — noise stripped, changes rewritten in plain English, grouped into Breaking / Added / Improved / Fixed.

[**Live demo →**](https://shiplog.guzeldereli.dev) · [Report a bug](https://github.com/oguzeldereli/shiplog/issues) · [Request a feature](https://github.com/oguzeldereli/shiplog/issues)

![MIT License](https://img.shields.io/badge/license-MIT-7cf2b0) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![BYOK](https://img.shields.io/badge/BYOK-Groq%20·%20OpenAI%20·%20Anthropic%20·%20Gemini-7cf2b0)

</div>

![Shiplog demo](docs/demo.gif)

---

## What it does

Writing changelogs is tedious, so they end up either skipped or copy-pasted from raw git logs that nobody outside the team can read. Shiplog does the boring part:

- **Reads your real history** — pull commits from any public GitHub repo, pick a branch, or select specific merged PRs / closed issues.
- **Throws away the noise** — merge commits, `wip`, `fix typo`, dependency bumps, lint runs, CI tweaks: gone.
- **Rewrites for humans** — each surviving change becomes a benefit-oriented line, not an echo of the commit subject.
- **Groups it sensibly** — Breaking → Added → Improved → Fixed.
- **Gives you a shareable page** — publish the result to a hosted URL you can link from your release, Slack, or docs.

Copy it as Markdown, download a `CHANGELOG.md`, or publish and share the link.

## Features

- 🔌 **Bring your own key** — Groq, OpenAI, Anthropic, or Gemini. Your key, your model, your spend.
- 🆓 **Free tier, no signup** — a keyless option runs on a shared, rate-limited backend so anyone can try it instantly.
- 🌿 **Real GitHub integration** — load any public repo, switch branches, and choose your source:
  - **Commits** over an optional date range
  - **Merged PRs** — multi-select from a paginated list; pulls every commit in each PR
  - **Closed issues** — walks each issue's timeline to gather commits from the PRs that closed it
- 🧠 **Judgment, not a wrapper** — see [below](#is-this-just-an-llm-wrapper).
- 🔒 **Privacy-first** — keys live in your browser; nothing is stored unless you explicitly publish.
- 🔗 **Self-hosted changelog pages** — publish to `/c/<id>` with proper share metadata.

## Is this just an LLM wrapper?

No — the value is in what happens around the model call:

- **Source resolution.** "Generate a changelog from these 5 PRs" means fetching each PR's commits, deduping by SHA, and grouping them under their PR. For issues — which have no commits of their own — it walks the GitHub timeline to find the PRs and commits that closed them. That's real plumbing the model never sees.
- **A constrained prompt that returns structured JSON**, not prose — which is why the output renders cleanly, exports to Markdown, and never invents a section format.
- **Editorial rules baked in**: drop noise, merge duplicate changes into one line, strip internal jargon and ticket IDs, keep refs (commit hashes / `#123`) for traceability, and return *nothing* when there's nothing user-facing — instead of inventing filler.

The model does the writing. Shiplog does the deciding.

## Privacy

- Your API key is stored **only in your browser** (`localStorage`) and sent per-request.
- Requests flow **browser → this app's server → provider → back**. The server is a thin proxy; it does not log or persist your key or your content.
- **Nothing is stored** unless you click **Publish & share**, which saves that one changelog so it can be served at a public URL.

Because it's open source, you can verify all of the above yourself — start at [`lib/providers.ts`](lib/providers.ts) and [`app/api/generate/route.ts`](app/api/generate/route.ts).

## Quickstart

Requires **Node 20+**.

```bash
git clone https://github.com/oguzeldereli/shiplog.git
cd shiplog
npm install
cp .env.example .env.local   # optional — see Configuration
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Hit **Generate** on the prefilled sample, or paste a repo like `vercel/swr` and load it.

You don't need any keys to *develop* — pick a provider and paste your own key in the UI, or set up the free tier below.

## Deploy

Shiplog runs anywhere Next.js does; it's built for Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/oguzeldereli/shiplog)

After deploying, add the environment variables below in your Vercel project settings, then **redeploy** (env changes only apply to new deployments).

## Configuration

All environment variables are optional — the app works with BYOK out of the box. Set these to enable the free tier, publishing, and abuse protection.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Lifts the GitHub API rate limit from 60 → 5,000 req/hr. Recommended; the issue-timeline feature makes several calls per issue. |
| `GROQ_FREE_KEY` | Powers the keyless **Free** provider. Recommended free backend — no credit card, so abuse can't cost you money. Get one at [console.groq.com/keys](https://console.groq.com/keys). |
| `GEMINI_FREE_KEY` | Fallback free backend, used only if `GROQ_FREE_KEY` is unset. ⚠️ A Gemini key with billing on is a *paid* key — don't expose it publicly without an API quota cap. |
| `UPSTASH_REDIS_REST_URL` | Enables durable rate limiting **and** published changelog pages. Free DB at [upstash.com](https://upstash.com). |
| `UPSTASH_REDIS_REST_TOKEN` | REST token for the same Upstash database. |

Without Upstash, rate limiting falls back to in-memory (fine for local dev, ineffective on serverless) and publishing is disabled.

## How it works

```
app/
  page.tsx                 the tool UI (provider, repo loader, picker, output)
  c/[slug]/page.tsx        public hosted changelog page (+ backlink)
  api/
    repo/                  GET  repo metadata + branches
    items/                 GET  paginated PR / issue list for the picker
    fetch/                 POST resolve a selection → aggregated commit text
    generate/              POST proxy to the chosen provider, returns JSON
    publish/               POST store a changelog, return a shareable id
lib/
  github.ts                all GitHub fetching + issue-timeline resolution
  providers.ts             one call site for Groq / OpenAI / Anthropic / Gemini
  prompt.ts                the system prompt + editorial rules
  ratelimit.ts             Upstash (durable) with in-memory fallback
  store.ts                 published-changelog persistence
```

The generation step always asks the model for strict JSON matching a fixed schema, then renders that — so the UI, Markdown export, and hosted page all read from the same structured result.

## Roadmap

- [ ] OAuth for private repos
- [ ] Diff-aware generation (read patches, not just commit subjects)
- [ ] Branded changelog pages at `yourname/repo`
- [ ] Webhook / scheduled changelog runs on release
- [ ] "Since last release" auto range from tags

## Contributing

Issues and PRs welcome. For anything non-trivial, open an issue first so we can agree on the approach. Run `npm run build` before submitting to make sure types and the production build pass.

## License

[MIT](LICENSE) © Ozgur Guzeldereli

---

<div align="center">
<sub>Built by a student who got tired of writing changelogs by hand.</sub>
</div>

<!--
TODO before publishing: add a ~15s screen-recording GIF at docs/demo.gif
(or delete the image line near the top until you have one).
-->

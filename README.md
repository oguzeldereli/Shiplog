# shiplog

Turn git commits into release notes humans actually read.

Bring-your-own-key. Your API key stays in your browser; requests proxy through this app to the provider and back. Nothing is stored.

## Stack

- Next.js 14 (App Router, Edge runtime)
- Tailwind CSS
- BYOK: Anthropic, OpenAI, or Gemini

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

1. Pick a provider, paste your key.
2. Either paste commits, or paste a public GitHub URL and click "fetch commits".
3. Generate. Copy or download the markdown.

## How it works

`/api/fetch-commits` — pulls the last 100 commits from a public GitHub repo via the REST API.

`/api/generate` — forwards `{commits, provider, apiKey, context}` to the chosen provider with a strict system prompt asking for structured JSON (categories: breaking / added / improved / fixed). The prompt drops noise (merges, wip, chores, dep bumps) and rewrites surviving commits as benefit-oriented lines.


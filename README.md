# substuff

Your writing, continued. A minimal article-to-Notes workspace for Anthony and Shiara's Buffer Commit entry.

## Run

Node 24 and pnpm 12.14.0 (versions pinned).

```sh
corepack pnpm install
corepack pnpm dev
```

Open `http://127.0.0.1:3100`. The server binds only to localhost. From another machine, use SSH forwarding; don't expose the development server publicly.

```sh
ssh -L 3100:127.0.0.1:3100 grotte
```

Then open `http://localhost:3100` on your Mac.

## First slice

- Sample article and a first-run onboarding without an account wall.
- Paste your own article, exact source excerpts without a provider, or real structured AI generation when configured.
- Edit, approve, inspect source passages, restore the draft with confirmation, copy, and export approved Notes.
- Browser-local persistence, explicit clear-data action, responsive layout, keyboard-accessible native dialogs.
- Mercury palette and restraint, using Inter as a licensed fallback; Emil interaction principles.

## AI configuration

Copy `.env.example` to `.env.local` yourself and set `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. No key is necessary to use sample/excerpt editing. The UI explicitly distinguishes exact excerpts from AI-generated Notes. The server validates output and rejects source references not found in the article. This does not prove every paraphrase is factual; human review remains necessary.

## Boundaries

This is a local-first prototype, not production-ready multi-user SaaS. AI generation uses a process-local hourly quota, not durable authenticated quotas. Add authentication, per-user limits, retention controls, and observability before public release. No arbitrary URL fetcher, feed polling, Buffer OAuth, or publishing is implemented yet. There is no fake publishing action; the review step offers export and explicitly says nothing is scheduled.

Article drafts live in browser localStorage, not a server database. Clearing browser data removes them. Content typed in an open import dialog is not persisted. Buffer credentials are placeholders for the next build phase and are not used yet.

## Checks

```sh
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

See [PLAN.md](PLAN.md) for the minimal journey and next build phases.

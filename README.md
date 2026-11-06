# substuff

Your writing, continued. Anthony and Shiara's minimal article-to-Notes workspace for Buffer Commit.

## Stack

Next.js 16 · TypeScript · Bun 1.3.14 · Drizzle · Neon Postgres · AI SDK 7 · Vercel AI Gateway · shadcn/ui (Radix) · Biome · Husky · Vercel.

Mercury's onyx/ivory palette and cobalt primary action, with licensed Inter as the typography fallback. Flat editing surfaces, no nested cards, restrained motion following Emil Kowalski's design engineering skill.

## Run

```sh
bun install --frozen-lockfile
bun run dev
```

Open `http://127.0.0.1:3100`. Node 24 is the Next.js runtime; Bun manages dependencies, scripts, tests, and tooling. The server binds only to localhost. From your Mac, use `ssh -L 3100:127.0.0.1:3100 grotte`, then open `http://localhost:3100`.

## Configuration

See `.env.example`. Keep real values in ignored `.env.local` (0600) and the matching Vercel project; never commit secrets.

- `DATABASE_URL`: restricted Neon application role. Drizzle schema and generated migrations are checked in. `bun run db:migrate` requires a separately held owner connection, never deployed.
- `AI_GATEWAY_API_KEY`: dedicated Gateway key. Default model `google/gemini-2.5-flash-lite`; configurable through `AI_MODEL`.
- `RATE_LIMIT_SALT`: random server-only salt for durable daily hashed-IP generation quotas.

No credentials are necessary for sample/excerpt editing. Actual AI generation requires Gateway + Neon configuration and a deliberate user action. Sources are validated against the article, but human editorial verification remains essential.

## Implemented

- Start without signup, paste an article, or explore a labeled sample.
- Source-linked AI drafts or explicitly labeled exact excerpts.
- Inline editing, approval invalidated on edit, copy, draft restore confirmation, approved-only export.
- Drizzle/Neon private guest workspace with browser-local backup, serialized autosave, optimistic revision conflicts, clear-data control.
- shadcn/Radix dialogs and button primitives with custom Mercury styling.
- Biome, pre-commit/pre-push checks, GitHub CI, Vercel Git integration.

## Privacy and boundaries

Guest access is a random HttpOnly cookie, not an account. Workspace access expires after 30 days; there is no cross-device login or recovery flow yet. An authorized daily cron deletes expired workspace and quota rows. Do not describe the current system as account-synced storage. Expired/missing cookies cannot recover old workspace data. Export important work.

Articles are sent through AI Gateway to the configured model only on Create Notes; the default is Gemini Flash Lite. Drafts are stored in Neon for the guest workspace and backed up in localStorage. Clearing the workspace overwrites its stored document. Don't paste private material without permission.

Public generation is limited to ten attempts per UTC day per hashed IP, with a separate dedicated key budget. Behind Vercel, only its trusted client-IP header is used; local runs share a local bucket. Missing quota configuration disables generation. Failed model attempts still consume quota. The AI Gateway budget is the final spend boundary, not application-level authentication.

**Not implemented:** Buffer OAuth/live publishing, feed/URL import, background article detection, account authentication, cross-device sync, billing. The review step explicitly offers export and never simulates scheduling.

## Checks

```sh
bun run check
bun run typecheck
bun test
bun run build
```

With the configured production-mode local server running:

```sh
bun scripts/verify-live.ts
bun scripts/verify-live.ts --ai # one real, metered generation using the sample article
```

See [PLAN.md](PLAN.md) and [QA.md](QA.md) for scope and verified acceptance evidence.

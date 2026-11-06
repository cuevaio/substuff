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
- `AI_GATEWAY_API_KEY`: dedicated Gateway key capped at $5/month. Default model `google/gemini-2.5-flash-lite`; configurable through `AI_MODEL`. One `openai/gpt-4.1-mini` fallback is allowed if generation or grounding fails. Both attempts share a 50-second deadline; provider retries are disabled.
- `RATE_LIMIT_SALT`: random server-only salt for durable daily hashed-IP generation quotas.
- `BUFFER_CLIENT_ID`, `BUFFER_CLIENT_SECRET`, `BUFFER_REDIRECT_URI`: confidential OAuth client with account-read and post-read/write scopes. Register the exact HTTPS callback and privacy URL in Buffer.
- `TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hexadecimal characters; server-only, used for context-bound AES-GCM token encryption.

No credentials are necessary for sample/excerpt editing. Actual AI generation requires Gateway + Neon configuration and a deliberate user action. Sources are validated against the article, but human editorial verification remains essential.

## Implemented

- Start without signup, import a published Substack post by link, or explore a labeled example. There is no article-creation or paste flow.
- Source-linked AI drafts or explicitly labeled exact excerpts.
- Inline editing, approval invalidated on edit, copy, draft restore confirmation, approved-only export.
- Drizzle/Neon private guest workspace with browser-local backup, serialized autosave, optimistic revision conflicts, clear-data control.
- shadcn/Radix dialogs and button primitives with custom Mercury styling.
- Biome, pre-commit/pre-push checks, GitHub CI, Vercel Git integration.
- Buffer OAuth/PKCE, encrypted credentials, serialized refresh, Substack channel discovery, explicit approved-version draft/schedule requests, persisted delivery receipts and cancellation.
- Canonical Buffer-account workspace recovery; reconnecting the same account in another browser restores its workspace.
- Collapsible shadcn sidebar, Select, Calendar/Popover date picker and minimal sharing/settings dialogs. TanStack Query caches shared server reads; publishing mutations never retry automatically.
- Safe post import through a fixed Substack API path: HTTPS publication hosts only, no redirects, bounded response size/deadline, no paywall bypass. Re-importing a canonical source opens its existing Notes without overwriting edits.
- Publication RSS import with a recent-post picker. Initial feed items are baselined, not silently imported/published; new posts are checked daily by the existing authenticated cron. Check now processes one pending import immediately.
- Opt-in immediate Auto-publish: select the Substack channel, choose up to 1–3 Notes per post, and explicitly consent to public AI-written Notes without individual review. Default is off. Consent is versioned and rechecked before each send. Existing imported posts and previously queued draft-only jobs are not retroactively published.
- Server-owned durable import jobs, exact original source passages resolved from model-selected passage IDs, safe interrupted-job handling, and protected sign-out/fresh-session workspace recovery.

## Privacy and boundaries

Guest access is a random HttpOnly cookie, not an account. Guest-only workspaces cannot be recovered after losing the cookie. Connecting Buffer binds a canonical workspace to that account, allowing recovery through OAuth in another browser while the workspace exists. Workspaces expire after 30 days of inactivity; daily cleanup removes expired workspace, session, OAuth-attempt and quota rows. Export important work.

Articles are sent through AI Gateway to Google Gemini (or OpenAI on fallback) only on Create Notes. Drafts are stored in Neon for the guest workspace and backed up in localStorage. Clearing the workspace overwrites its stored document. Don't paste private material without permission.

Public generation is limited to ten attempts per UTC day per hashed IP, with a separate dedicated key budget. Behind Vercel, only its trusted client-IP header is used; local runs share a local bucket. Missing quota configuration disables generation. Failed model attempts still consume quota. The AI Gateway budget is the final spend boundary, not application-level authentication.

By default publishing requires exact approved text and a selected Substack channel. Public scheduling also requires a deliberate final action and valid future times. Auto-publish is a separate, explicit opt-in for newly imported AI Notes. Samples can create private drafts only. Delivery keys prevent automatic resending of a recorded Note version, including uncertain requests. Editing here does not modify a version already in Buffer. Disconnecting Buffer or signing out does not cancel remote posts; signing out does not disable automation.

**Limits:** no custom-domain imports, real-time feed webhooks, standalone account provider or billing. The Hobby deployment checks feeds daily at 08:00 UTC, checks up to five publications and processes at most two import jobs per cron invocation. Imports are capped at ten model jobs per workspace/day and fifty globally/day, plus the dedicated $5/month provider-key cap. Failed generation needs a deliberate retry; uncertain sends never retry automatically. See [QA.md](QA.md) for live acceptance evidence and remaining gaps.

## Checks

```sh
bun run check
bun run typecheck
bun test
bun run build
```

Isolated real-database automation checks with external publishing mocked:

```sh
SUBSTUFF_QA_DATABASE=true bun scripts/verify-automation.ts
```

With the configured production-mode local server running:

```sh
bun scripts/verify-live.ts
bun scripts/verify-live.ts --ai # one real, metered generation using the sample article
```

See [PLAN.md](PLAN.md) and [QA.md](QA.md) for scope and verified acceptance evidence.

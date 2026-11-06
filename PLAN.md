# substuff

One article → a few good Notes → a quick edit → an approved week.

## Journey

1. **Start:** one sentence, paste an article, or try a clearly labeled sample. No account, questionnaire, or premature Buffer consent.
2. **Review:** article list, editable Notes, optional source passage. Autosave locally. Approve or skip. Undo changes.
3. **Schedule:** select approved Notes and dates. Connect Buffer here, not before value. Never call a local draft “scheduled.”
4. **Return:** resume the last article and edits. Later, a connected feed brings the next article into the same workflow.

## Design

- Mercury reference: onyx #171721, graphite #1e1e2a, ivory #ededf3, ash #c3c3cc, cobalt #5266eb.
- Flat, spacious workspace. Dividers instead of cards inside cards. One page title and one primary action.
- Inter fallback: Mercury's Arcadia fonts are proprietary and not bundled.
- Direct editing, visible focus, native undo, reduced-motion support, accessible dialogs and touch targets.
- Emil design engineering skill is installed and applied. No decorative motion or dashboard metrics.

## Build order

- [x] First slice: onboarding, pasted article, sample, editable source-linked Notes, approval, local persistence, export, responsive review workspace.
- [x] AI SDK + Vercel AI Gateway generation with exact source references; Gemini Flash Lite. Honest excerpt mode without credentials.
- [x] Bun, Biome, Husky, shadcn/Radix primitives, Drizzle schema + migrations, dedicated Neon database, GitHub and personal Vercel project.
- [x] Public first-slice deployment at https://substuff.vercel.app; Git-triggered releases, live storage/model smoke tests and desktop/mobile browser checks.
- [x] Buffer OAuth + PKCE, encrypted server-side tokens, channel selection, publishing ledger, explicit scheduling, reconciliation. Production private draft, duplicate prevention, draft cancellation, token renewal, reconnect and one approved public scheduled delivery verified.
- [ ] Feed detection, source versioning, duplicate protection, weekly review reminder.
- [ ] Real creator pilot, integration QA, public deployment and two-minute contest demo.

## First-slice boundaries

Guest-first workspace with optional Buffer OAuth account recovery. No silent public upload, fake AI progress, or simulated publishing. Article content is sent to the configured model only after an explicit generation action and privacy disclosure. Drizzle/Neon stores drafts behind a private HttpOnly cookie, with a local backup. Clear-data control overwrites the article document but does not cancel remote posts. No arbitrary URL fetching in this slice.

## Ship gate

Build/typecheck/tests pass. Browser-check first visit, sample, paste, edit, reload, approve, undo, export, keyboard dialog navigation, mobile and empty states. Production OAuth, private drafts and one approved public scheduled delivery pass, along with induced token renewal and same-account reconnect. Cross-browser recovery, scheduled cancellation and account-switch acceptance remain open; obtain approval before any additional public test post.

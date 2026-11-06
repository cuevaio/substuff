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

- [ ] First slice: onboarding, pasted article, sample, editable source-linked Notes, approval, local persistence, export, responsive review workspace.
- [ ] Optional real AI generation with strict structured output and exact source references. Honest excerpt mode without credentials.
- [ ] Buffer OAuth + PKCE, encrypted server-side tokens, channel selection, publishing ledger, explicit scheduling, reconciliation.
- [ ] Feed detection, source versioning, duplicate protection, weekly review reminder.
- [ ] Real creator pilot, integration QA, public deployment and two-minute contest demo.

## First-slice boundaries

Local-first prototype. Not multi-user production SaaS. No hidden account creation, silent public upload, fake AI progress, or simulated publishing. Article content is sent to the configured model only after an explicit generation action and privacy disclosure. Browser-local content has a clear-data action. No arbitrary URL fetching in this slice.

## Ship gate

Build/typecheck/tests pass. Browser-check first visit, sample, paste, edit, reload, approve, undo, export, keyboard dialog navigation, mobile and empty states. Live Buffer publishing remains blocked until the OAuth client is configured and tested.

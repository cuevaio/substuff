# substuff

One article → a few good Notes → a quick edit → an approved week.

## Journey

1. **Start:** Continue with Buffer and connect a Substack channel. Add a publication link; first-run onboarding reads the latest post, analyzes its ideas/voice and writes unapproved suggestions. No guest/demo entry, article creation or pasted-article editor.
2. **Review:** `/posts/[id]` shows feed-style plain-text Notes with the connected Substack avatar/name beside a hideable, formatted original. Show source in the three-dot menu highlights the supporting passage. To approve is editable; icon-only Approve/Edit actions have tooltips. Approved requires Edit; Posted is permanently read-only. Copy, restore and article-card preference also live in the menu. Article previews use the official Substack logo. No Note numbers. Autosave.
3. **Schedule:** select approved Notes and dates; `/schedule` provides list/calendar views with publishing timezone and automatically reconciled status. The optional original article is a separate attached card, not body text. Editing a queued Note first requires confirmed cancellation. Immediate automation remains a separate explicit opt-in, never part of onboarding.
4. **Return:** resume the last article and edits. Later, a connected feed brings the next article into the same workflow.

## Design

- Mercury reference: onyx #171721, graphite #1e1e2a, ivory #ededf3, ash #c3c3cc, cobalt #5266eb.
- Flat, spacious workspace without Note/sidebar/header separators. One page title and one primary action. Phosphor Light icons; short interruptible pointer transitions, instant keyboard toggles and reduced-motion support.
- Inter fallback: Mercury's Arcadia fonts are proprietary and not bundled.
- Direct editing, visible focus, native undo, reduced-motion support, accessible dialogs and touch targets.
- Emil design engineering skill is installed and applied. No decorative motion or dashboard metrics.
- Writers see only the next useful action. No provider names, storage explanations, slogans, redundant eyebrow labels or permanent publishing ledgers in the editing UI. Essential errors, public scheduling choices and destructive confirmations remain visible.
- Use shadcn Sidebar, Select and Calendar/Popover controls. TanStack Query caches connection, activity and imported-source reads; publishing mutations never retry automatically. Existing Buffer OAuth is enough for the current account model; Clerk is not required for this scope.

## Build order

- [x] First slice: onboarding, pasted article, sample, editable source-linked Notes, approval, local persistence, export, responsive review workspace.
- [x] AI SDK + Vercel AI Gateway generation with exact source references; Gemini Flash Lite. Honest excerpt mode without credentials.
- [x] Bun, Biome, Husky, shadcn/Radix primitives, Drizzle schema + migrations, dedicated Neon database, GitHub and personal Vercel project.
- [x] Public first-slice deployment at https://substuff.vercel.app; Git-triggered releases, live storage/model smoke tests and desktop/mobile browser checks.
- [x] Buffer OAuth + PKCE, encrypted server-side tokens, channel selection, publishing ledger, explicit scheduling, reconciliation. Production private draft, duplicate prevention, draft cancellation, token renewal, reconnect and one approved public scheduled delivery verified.
- [x] Published Substack post-link import, canonical source links and repeat-import protection that preserves edits.
- [x] Connected-feed discovery and safe daily background import. Initial backlog is opt-in; manual feed checks are available.
- [x] Explicit opt-in for immediate public AI Notes, versioned consent, channel/count selection, bounded jobs, opt-out checks and duplicate-send ledger.
- [x] Required Buffer sign-in and Substack channel, no demo entry point, streamed first-run content/style onboarding with real draft generation.
- [x] Next.js page/layout routing, compact unnumbered plain-text Notes, three read/edit states, sanitized source highlighting, optional article cards and schedule list/calendar.
- [ ] Source-change versioning, real-time feed ingestion and weekly review reminder.
- [ ] Real creator pilot, integration QA, public deployment and two-minute contest demo.

## First-slice boundaries

Buffer-authenticated workspace with account recovery and browser-session revocation. Temporary OAuth guest cookies are not account authentication. Default is private drafts and manual approval, including all first-run onboarding. Auto-publish is off until the writer explicitly authorizes immediate, public AI-written Notes for a chosen channel and count. Only publicly available posts on publication.substack.com/p/... are imported; paywalls and arbitrary URL fetching are rejected. Source references are resolved to exact original passages on the server. Clear-data control removes imported writing and resumable copies but does not cancel remote posts or disconnect the feed. Privacy details stay on the privacy page, not throughout the writing interface.

## Ship gate

Build/typecheck/tests pass. Browser-check required sign-in, channel gate, onboarding, edit, reload, approve, undo, export, keyboard dialogs, mobile and empty states. Production OAuth, private drafts, approved public delivery, scheduled cancellation and fresh-session recovery pass. Separate-device/browser and account-switch acceptance remain open; obtain approval before any additional public test post.

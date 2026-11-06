# Verification — November 6, 2026

## Plain-text workflow follow-up (supersedes rich-editor behavior below)

- Biome, 65 tests, typecheck, optimized build and isolated real-Neon automation fixtures passed. Fixtures verify opted-out payloads omit metadata, attachment snapshots stay null, stale approval fingerprints fail and already-posted Notes never resend. External publishing was mocked.
- Additive migration `0004_magenta_marrow.sql` applied: delivery attachment preference and URL snapshots. Existing documents and delivery keys are preserved.
- Local production build at `127.0.0.1:3101`: disposable account showed one editable To approve, two read-only Approved Notes with Edit, and a read-only Posted snapshot without Edit. Approved → Edit produced a textarea; reapproval returned it to read-only. Direct illegal posted update returned 409, “Posted Notes are read-only.”
- Three-dot menu exposed Copy text, Restore original and Include article card. Disabling the card removed its preview; an independent workspace API read confirmed `includeArticle:false` after autosave. External article links had `_blank`; no contenteditable or refresh controls remained. Desktop measurements found no horizontal overflow or textarea clipping.
- Source highlighted the exact saved passage in the original pane, with no hidden quote component. Unit coverage verifies cross-inline-markup and paragraph/whitespace ranges. The deliberately nonexistent fixture source exercised the saved-original fallback.
- Screenshot capture remained blocked by “Screenshot needs a visible tab” despite focus. Animation-frame sampling timed out with the hidden desktop window. No new screenshot/pixel, mobile or measured animation acceptance is claimed. Queued-cancellation logic has server/unit coverage; this pass did not cancel a real remote copy or publish any Note.
- Disposable fixture used a short-lived context-encrypted access-token copy only for read-only channel discovery. Synthetic receipts had no remote post IDs; no publishing/automation was enabled. The fixture root is deleted after checks.
- Production code `48c2f2d`, deployment `dpl_nyH5FYczck2R18bTf37sgaeSs5oc`, reached READY on canonical `https://substuff.vercel.app`; CI `42258200348` passed. Production HTTP auth/origin/guest-isolation smoke passed without model or publishing calls. Canonical four-article document fingerprint stayed `787ed54ca79b74e2105667411fb732ba45d5f057997ad2c617252508aa982fcc`; database independently confirmed automation off. The browser’s prior production session was unavailable; Continue with Buffer reached its login form, not a restored account. Authenticated production visual/state acceptance therefore remains open; no login bypass was used.

## Passed locally

- Bun unit suite: 35 tests covering source grounding, exact excerpts, duplicate removal, approved-only export, corrupt workspace validation, summary-voice guard, guest-token hashing, same-origin checks, bounded fallback, privacy-safe diagnostics, token encryption/context binding, exact approved delivery versions, shared browser/server scheduling boundaries, ambiguous GraphQL responses and safe published-post import.
- Biome and TypeScript checks; optimized Next.js build.
- Actual dedicated Neon database: write/read persistence, guest-cookie isolation, stale-revision rejection (409), malformed input (400), foreign origin (403), and clearing the stored document.
- Actual AI SDK → personal Vercel AI Gateway → Gemini Flash Lite structured output. Sources matched the supplied sample article.
- Browser: onboarding/sample, pasted article → real model generation, edit, approval, reload persistence, approval invalidation after another edit, source controls, review dialog, Escape dismissal and draft-restore confirmation.
- Desktop 1440×1000 and mobile 390×844 layout inspection. Found and fixed textarea clipping after viewport width changes; checked `scrollHeight <= clientHeight + 2` on every Note after resize.
- First generated drafts were overly summary-like. Strengthened the editorial prompt and added a third-person-summary guard. Rechecked live generation: personal point of view and source qualifications were preserved in the tested sample. This is directional evidence, not a general quality benchmark.

## Evidence

Ignored local `artifacts/`: onboarding, desktop workspace, mobile workspace, and review screenshots. `scripts/verify-live.ts` reproduces the database/API checks and can optionally make one metered generation.

## Not claimed

- Feed ingestion, subscriber outcomes, verified cross-browser account recovery, or comprehensive model evaluation.
- Broad publishing reliability or contest eligibility. One explicitly approved public Note completed actual scheduled delivery; this is not a reliability benchmark.
- Physical-device testing, broad browser coverage, or completed security review.

## Production

- Git-triggered deployment `1e08f59` reached READY at `https://substuff.vercel.app` in personal scope `thecave`. GitHub CI passed.
- Real production Neon/API persistence, cookie isolation, stale-revision, origin and malformed-input checks passed.
- First production model check returned a guarded 502. A later check on `528b86f` produced four grounded Notes successfully. The original failure cause was not captured; no claim is made that it was a provider outage.
- Added non-sensitive failure classification and a bounded fallback to GPT-4.1 mini. Grounding failure is never bypassed, and unverified drafts are never returned. Shared 50-second deadline and dedicated spend cap bound the retry.
- Live browser onboarding screenshot: `artifacts/live-onboarding-desktop.png`. This is an actual deployment, not a static design mockup.
- `8259dad` reached READY through Git integration; GitHub CI passed. Repeated live database/API checks and AI generation passed on this revision (five source-linked Notes).
- Live desktop/mobile sample approval flow passed; mobile measured no horizontal overflow and no clipped textareas. Screenshots: `artifacts/live-workspace-{desktop,mobile}.png`.
- Real browser file download verified: `artifacts/approved-notes.txt` contains exactly the two approved Notes, not the unapproved drafts.
- Cleanup endpoint rejects unauthenticated requests (401); an authorized call with the production-only secret returned 200.

## Production Buffer acceptance — `c55f77d`

- Deployment `dpl_GLcWDmMLtkoNN5Us95WF68kaUi6y` reached READY; production alias is `https://substuff.vercel.app`.
- Real OAuth/PKCE consent completed for the authorized personal Buffer account. Channel discovery found the newly connected Substack channel after reopening review.
- Edited sample Note 1; editing invalidated approval. Re-approved its exact labeled QA text and clicked Save in Buffer. The persisted receipt showed Draft in Buffer.
- Independently verified the exact text in Buffer's Substack Drafts tab: one unscheduled private draft and zero queued posts.
- Closed and reopened review, then submitted the same approved version again. Buffer still showed exactly one draft and zero queued posts after reload: no duplicate was created.
- Removed only the disposable QA draft through substuff's confirmation flow. Receipt changed to Cancelled; independently reloaded Buffer and verified Drafts 0, Queue 0 and No drafts.
- In-app browser keyboard/fill replacement was unreliable in this session. Used the native textarea value setter plus a bubbling input event for the test text; verified the controlled character count and saved text before approving. This is an automation limitation, not evidence of a manual editor bug.
- Explicit user approval was obtained for one exact public test Note. Created a separate non-sample article, generated two source-linked drafts, replaced Note 1 with only the approved text, approved it, selected 2026-11-06 01:36 America/Lima, confirmed publishing consent and scheduled. Substuff receipt and Buffer independently showed the scheduled post; actual delivery acceptance is recorded separately below.
- Exercised real token renewal by marking only this dedicated connection's stored access deadline expired (without changing its encrypted credentials), then calling the normal production connection-status route. It returned connected with one channel; database confirmed ready, version incremented from 0 to 1, a future expiry and cleared refresh claim. This is an induced expiry test, not a naturally elapsed token lifetime.
- Disconnected through Preferences confirmation. Independent database check found zero stored connections, one preserved account binding and the scheduled receipt intact. Reconnected through real OAuth consent; workspace and scheduled receipt returned. Cross-browser recovery is not implied by this same-browser reconnect test.
- Reproduced a UI bug without submitting: a past date had native validity false while Schedule 1 Note remained enabled after consent. Moved the publishing-window rule into a credential-free shared module; review now disables invalid/partially invalid batches and rechecks immediately before sending. Added boundary and multi-Note regression tests.
- Still untested: cancellation of a scheduled post, cross-browser workspace recovery and account-switch paths. Do not call these end-to-end verified based on the unit suite.

## Scheduling-validation fix — `463ae7e`

- Deployment `dpl_2HymKXxeVsAu8xQx6u8CsYVgfpQB` reached READY; GitHub Check run `42175138497` passed for exact SHA `463ae7ed3932af38da7cb65acd163186207dd9ff`.
- Reproduced the same past-date case on production after reload: consent true, native date invalid, Schedule 1 Note disabled. Also checked a beyond-90-day date stays disabled after consent. No extra publishing request was submitted for either check.
- `QA_ORIGIN=https://substuff.vercel.app bun scripts/verify-live.ts` passed again: actual Neon persistence, isolated guest cookies, origin protection, stale-revision rejection, malformed input and clearing only its own disposable workspace.
- Optimized build, Biome, TypeScript and all 28 tests passed.

## Actual public delivery — explicitly authorized

- Exact approved text: “Testing substuff: turning an article into a few editable Notes, with explicit approval before anything is published.” No other Note was approved for public publication.
- Buffer automatically moved the 01:36 America/Lima test from Queue to Sent. Queue count went from 1 to 0; Sent went from 3 to 4.
- Independent authenticated Buffer API read returned `status: sent`, due time `2026-11-06T06:36:00.000Z`, and public link `https://substack.com/note/c-380126546`.
- Followed Go to post in Buffer. Actual Substack page `https://substack.com/profile/304869265-anthony/note/c-380126546` opened; its title and rendered body contained the exact approved text.
- Clicked Refresh status in substuff: UI changed to Published. Independent database read confirmed one `sent` receipt, one `cancelled` receipt and no remaining scheduled receipt. Ignored UI evidence: `artifacts/substuff-published-receipt.jpeg`.
- Local ignored screenshot of the scheduled card: `artifacts/buffer-approved-scheduled-test.jpeg`. The public test Note was intentionally left published; deletion was not authorized.

## Minimal interface and post-link import — November 6, 2026

- Removed the pasted-article creation form, landing eyebrow/slogans/illustration, sidebar workspace status, editorial captions, angle labels, routine character counts and storage/model-provider explanations from the writing/settings UI. Existing saved posts and Notes are preserved.
- Added the official shadcn Sidebar, Select, Calendar, Popover and supporting primitives, with Tailwind 4 using the existing palette. Fixed the clipped mark with a shared square geometric mark; header, sidebar and privacy page now reuse the same Brand component.
- TanStack Query caches connection/activity and bounded imported-source reads. Mutation retries remain disabled. Existing Buffer OAuth is retained; no Clerk dependency or new auth provider was needed.
- All 35 unit tests and optimized build pass. Import regression tests cover URL canonicalization/host and protocol restrictions, unsafe saved source links, HTML extraction, paywalls/previews/unpublished content, manual redirect handling and bounded response streams.
- Local production build: imported the actual published post `https://cuevaio.substack.com/p/you-should-go-to-more-hackathons`, generated four grounded Notes, reloaded and independently read its persisted canonical source link and Notes. One earlier generation was rejected by the editorial guard; an explicit retry succeeded. The guard was not weakened.
- Approved then edited a local QA Note: approval cleared. Re-imported the same post with a trailing slash and tracking query; one post remained, with the edited text preserved. Restored only the disposable edit through confirmation.
- Desktop sidebar collapse freed the full workspace/footer width and made offscreen navigation inert. Reload preserved the collapsed state; reopening worked. No horizontal overflow or clipped Note editors in the measured desktop viewport.
- Local UI fixture only (outgoing publishing disabled): opened the multi-channel Select, selected a channel, opened Calendar, verified past days disabled, selected Nov 8 and confirmed the popover closed while preserving 10:00. This is component evidence, not new Buffer delivery evidence. Found and fixed a utility-style collision that squeezed the date button; kept time input width explicit.
- Independent server-side headless browser could not launch because the host has no usable Chromium sandbox. No sandbox/security restrictions were disabled. Mobile/device acceptance remains unverified in this pass; desktop in-app browser testing continued.
- No additional public post was authorized or published during this UI pass.

### Production acceptance — `3c17f3b`

- Deployment `dpl_21k8SBP1c6ARnEJhShgXyshz5wMu` reached READY; checked `https://substuff.vercel.app` in the existing signed-in in-app browser.
- Imported the actual published hackathons post through the new link-only dialog in production. Four Notes and the canonical source URL were persisted. Existing sample and delivery-test work remained intact.
- Actual Settings dialog shows only Buffer/account, connection action, Privacy and clear/done controls. Actual Share Notes dialog shows destination, draft/schedule choice, an expandable Note preview and final actions; activity stays collapsed when present.
- Opened the actual Calendar against the real Buffer connection. Date/time controls measured 296px/120px without wrapping. Escape closed the calendar but left sharing open. Selected today and a past time; Schedule 1 Note disabled and a concise validation message appeared. Did not click Save drafts or Schedule.
- Removed the temporary QA approval. Independent production reads confirmed the imported post has four unapproved Notes; delivery history remains exactly one earlier sent receipt and one earlier cancelled receipt. No new delivery was created in this pass.
- Production smoke script passed persistence, cookie isolation, origin checks, unsafe import-URL rejection, revision conflict, malformed input and clearing only its disposable workspace.
- Actual local production-build landing Lighthouse: Accessibility 100, Best Practices 100, SEO 100, no failed audits. This is not a physical-device or performance benchmark.
- Retained local ignored screenshots for landing, workspace, settings, sharing and calendar. Cleaned only the separate localhost QA document; the real imported production post is retained for the writer.
- Also verified production sidebar collapse: workspace/footer both reached left edge zero, hidden navigation was inert, and reload preserved the collapsed preference. GitHub Check run `42177667676` passed.

## Feed import and opt-in immediate publishing — implementation checks

- Additive migrations `0002_silent_toad` and `0003_easy_fallen_one` applied to the dedicated Neon database, with runtime grants only for the new application tables. No account was automatically opted in.
- 46 unit tests pass, including safe RSS parsing, foreign-link/entity rejection, initial-backlog selection, consent/version guards, canonical recovery merge, exact numbered source resolution and duplicate generated-Note removal.
- `SUBSTUFF_QA_DATABASE=true bun scripts/verify-automation.ts` passed against actual Neon using only disposable QA workspaces and mocked external Buffer calls. Covered draft default, concurrent claims, immediate `shareNow` payloads, duplicate prevention, mid-generation opt-out, mid-batch opt-out, lost confirmations, feed baselines, explicit generation retries, cleared jobs and exhausted budgets. QA roots were removed with cascading cleanup. This is not real public-delivery evidence.
- Local production-mode HTTP smoke passed real RSS listing/connect/disconnect, origin guards, consent rejection, stale setting versions and revoked-cookie rejection. `--feed` uses a separate QA session and disconnects it afterward.
- Local actual published-post import succeeded through the new durable job route: four unapproved Notes, canonical source persisted, job done, Auto-publish off. Earlier quote-copying failures were rejected, not bypassed. Generation now selects numbered source IDs; the server resolves exact original passages before applying the existing grounding/voice guard. A real writer check on “Actually building with AI” returned five grounded Notes.
- Local QA feed and writing were cleared after verification. User authorized the cancellation test and exactly one immediate AI Note from “Actually building with AI,” with automation disabled afterward. Completed live evidence follows.

### Production acceptance — `63c08c0`

- Production deployment `dpl_4sLspU6vNqT6vMW5ZdwC4Aa4N4VY` reached READY; GitHub check `42239713377` passed for the exact commit.
- Actual Settings → Sign out revoked access: workspace API returned null and the landing page rendered. Actual same-account Buffer OAuth consent restored all three posts with identical complete-document SHA-256 `bc8eff58b197bdb079096ae9f6e93df7a7c1a95c1ba591a1269406f366499285`. This proves fresh app-session recovery, not a separate physical browser/device. Canonical-source merge/edit preservation also has regression coverage.
- Scheduled exactly one labeled cancellation QA Note for November 7, 2026 at 10:00 America/Lima, then immediately removed it through Activity → Cancel → Remove. Activity and database receipt both became cancelled. Independent refreshed Buffer channel showed Queue 0, Drafts 0, Sent 4; direct post lookup no longer returned a post. Original Note text was restored afterward, invalidating its temporary approval.
- Enabled Auto-publish through the actual consent dialog, selected the existing Substack channel and **up to one Note**, then imported only “Actually building with AI.” Five grounded Notes were saved; exactly one delivery was recorded, mode `now`, status `sent`, with completed import job. No individual Note review/approval was performed. Immediately turned Auto-publish off through Settings; API and independent database both confirmed `enabled=false`, revision 2.
- Independent Buffer API confirmed the new delivery sent with public link https://substack.com/note/c-380410674. Opened the actual Substack page and verified its rendered Note: “Context is the most important thing for coding agents. Trash in, trash out. Even with large context windows advertised, quality degrades as context grows and noise increases. I try to keep context windows fresh.” The authorized public Note remains published. No other publication or deletion was performed.
- Remaining limits: fresh-session recovery is verified, but a separate physical browser/device and mobile layout are not. The scheduled daily cron has fixture/HTTP coverage, not elapsed overnight production evidence. Account switching is not tested.
- Connected the real production feed after disabling automation: picker listed four published posts; existing sources showed Open. Opening the hackathons post retained exactly one canonical copy, restored original text, and no approval. API confirmed the initial baseline jobs and Auto-publish off. The feed remains connected for draft-only daily imports.
- Production `QA_ORIGIN=https://substuff.vercel.app bun scripts/verify-live.ts` passed persistence, cookie isolation/revocation, origin/URL guards, revision conflict, consent/version guards and clearing in an isolated QA session. Screenshot capture was unavailable because the desktop tab was not visible; no screenshot acceptance is claimed for this unit.

## Required Buffer entry and first-run onboarding — November 6, 2026

- Removed the guest/demo entry point. First visit shows only Continue with Buffer; an active Substack channel is required before the workspace/onboarding renders. Historical sample documents and receipts are preserved in storage but hidden from navigation and editing.
- Added server-side account verification: an OAuth bootstrap guest cookie cannot read/save writing, import posts, change automation or call model generation. `scripts/verify-live.ts` now tests this boundary instead of the superseded guest-first workflow. Local HTTP checks passed for both cookieless and pre-OAuth-cookie requests, valid OAuth destination, origin rejection and sign-out.
- First-run onboarding uses a streamed response, not timed progress. It fetches the real feed/latest post, analyzes ideas and voice with the actual model, passes that analysis into grounded generation, then saves unapproved Notes through the durable job runner. The separate draft-only path cannot invoke automatic publishing, even under an enabled policy. Fixture coverage checks phase order, voice handoff and zero sends.
- Local production build browser acceptance used a clearly isolated account/session fixture with a temporary, context-encrypted copy of the existing access token only for real read-only Buffer channel discovery. It did not perform or claim new OAuth acceptance. Through the UI, connected the actual publication and observed the real loading screen, followed by five editable Notes from the latest hackathons post. Independent Neon read confirmed all five grounded/unapproved, one completed job, three baseline jobs and zero deliveries. Reload restored all five editors/source link without rerunning onboarding. The entire disposable workspace and temporary connection were removed afterward; the canonical account and public posts were untouched.
- Screenshot capture remained unavailable because the desktop browser was not visible. No pixel/mobile acceptance is claimed. Reduced-motion behavior is implemented; separate-device layout remains unverified.
- Release `959cb82`, production deployment `dpl_A4KZeWEb6psxF1WZyX29uiLnMoZV`, reached READY; CI `42244455270` passed all 49 tests, type checking and production build. The updated HTTP auth-boundary smoke also passed against the canonical production host.
- Actual production UI acceptance: sign-out showed Continue with Buffer, with no import/demo entry. Used that button, completed real same-account Buffer OAuth consent, and returned directly to the existing workspace without generation. Before/after full-document SHA-256 matched `787ed54ca79b74e2105667411fb732ba45d5f057997ad2c617252508aa982fcc`. All four stored posts survived; only the three non-sample posts rendered in the sidebar. Auto-publish remained off. No public post or remote draft was created in this unit.

## Routed compact editor, article cards and schedule — November 6, 2026

### Capability research

- Buffer's official `CreatePostInput`, `SubstackPostMetadataInput` and `LinkAttachmentInput` references support a separate `metadata.substack.linkAttachment` with URL/title. Live read-only GraphQL introspection confirmed `SubstackPostMetadataInput` has `linkAttachment`, and its input exposes `url`, `title`, `description`, `thumbnail`. Both manual and automatic send paths now attach the canonical source without appending a URL to body text. Existing delivery keys remain unchanged; already-published Notes are not altered or resent.
- Buffer's official [Substack guide](https://support.buffer.com/articles/using-substack-with-buffer-lDbUYyIq4R) explicitly says rich text is unsupported and Notes publish as plain text. Substack's [official formatting guide](https://support.substack.com/hc/en-us/articles/14742958406036-Can-I-format-text-on-Substack-Notes) confirms native bold/italic/strike/lists/quotes. Community `bodyJson` documentation describes an undocumented session-cookie API, not an authorized extension of Buffer OAuth. No private Substack publishing integration or credential collection was added.
- Rich editor formatting is preserved locally/server-side and can be copied as HTML. Buffer delivery is blocked for formatted Notes in both browser and server. Explicit plain-text conversion requires confirmation and invalidates approval; formatting is never silently stripped at send time. Native rich clipboard paste and live new link-card delivery are not claimed verified.

### Implementation and local acceptance

- Actual App Router pages/layouts now own `/posts/[id]`, `/schedule`, `/settings`, `/import` and `/onboarding`, with shared layout-level autosave, Link/router navigation, direct URLs, loading, errors and 404 states. The Next.js 16.4 error boundary uses the documented `retry` prop, not the older `reset` API.
- 59 tests pass, including separate attachment payloads, exact plain/rich text matching, formatting detection, safe rich HTML conversion, recursive-document bounds, imported HTML sanitization, publishing-zone date grouping/DST, complete month weeks and cancelled receipt filtering. Real-database automation fixtures also passed with external sending mocked and attachment payloads asserted.
- Used a disposable local account fixture with an encrypted temporary access-token copy solely for real read-only Buffer channel discovery. It contained one real publicly fetched formatted source, two explicitly disposable Note drafts, and four clearly labeled synthetic schedule receipts (`scheduled`, `sent`, `draft`, `cancelled`). These are not external posts or live delivery evidence.
- Browser acceptance: all eight WYSIWYG toolbar commands (bold, italic, strike, inline code, bullet/numbered list, quote and code block) activated in the real TipTap editor. A formatting-only edit invalidated approval; autosave persisted the rich document and reload preserved bold text. Formatted sharing showed its warning and disabled sending. An independent authenticated HTTP attempt with an approved formatted Note returned 409 before any remote send. Explicit Use plain text → Remove formatting preserved text and reset approval.
- Measured desktop viewport 1079px: header 52px, sidebar 208px, Notes 468px and formatted-original pane 403px, zero document horizontal overflow, zero visual Note-number elements, and five original-post images. Hide original expanded Notes from 468px to 871px; reload retained the hide preference. Screenshot capture remains blocked by the non-visible desktop tab, so pixel acceptance is not claimed.
- Actual Next Link transitions reached `/schedule` and `/schedule?view=list`, maintained the shared document, showed scheduled/sent cards at their stored times in America/Lima, kept an undated draft separate, and excluded the synthetic cancelled receipt. Browser navigation back to the editor retained formatting. History is paginated and explicitly requests loading additional pages rather than silently claiming completeness. Statuses are labeled last-confirmed; bounded refresh does not claim to reconcile the entire Buffer queue.
- Mobile/device acceptance remains unverified. An attempted same-origin narrow iframe was rejected by the existing `X-Frame-Options: DENY`; it was removed, and the security header was not weakened. No responsive-iframe or screenshot acceptance is claimed.
- Final local build passed the direct calendar deep link with 35 day cells for November (only required complete weeks), one synthetic scheduled card, one undated draft, no cancelled card and no page horizontal overflow. Confirmed plain-text conversion kept the Note text unchanged and approval false. Removed the disposable account, temporary encrypted connection, local writing and all four synthetic receipts after verifying none had a remote post ID. The canonical account was untouched.

### Production acceptance

- Release `ceff072`, deployment `dpl_FBND7RzJe1CfqEb5Wy1rvDdRT5Ux`, reached READY. CI `42253378226` passed all 59 tests, formatting/type checks and production build. Updated auth/page-redirect HTTP smoke passed against https://substuff.vercel.app.
- Reloading the canonical host redirected to `/posts/post-358d4158d3b10f5cd3aaf179`: five real WYSIWYG editors, five separate article cards, no visual Note numbers, formatted original visible with an image, no source-version warning and no horizontal overflow. Complete document SHA-256 remained `97cef7a8af925e1624e4202d9aa3d503623f7d2500f2fe041566bdb8f4a39b76`, exactly matching the pre-deployment fingerprint. All four stored articles remained, including the hidden historical sample; Auto-publish stayed off.
- Production Next Link navigation reached `/schedule` and `/schedule?view=list`. Calendar had 35 cells and the two actual published receipts; list had two rows. Independent schedule API returned exactly two sent and two cancelled receipts; cancelled items were absent from both views. America/Lima and last-confirmed status labeling were visible. Returned to the original post afterward without changing its Notes. No new public Note, private remote draft or live scheduled test was created.

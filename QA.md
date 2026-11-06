# Verification — November 6, 2026

## Passed locally

- Bun unit suite: 28 tests covering source grounding, exact excerpts, duplicate removal, approved-only export, corrupt workspace validation, summary-voice guard, guest-token hashing, same-origin checks, bounded fallback, privacy-safe diagnostics, token encryption/context binding, exact approved delivery versions, shared browser/server scheduling boundaries and ambiguous GraphQL responses.
- Biome and TypeScript checks; optimized Next.js build.
- Actual dedicated Neon database: write/read persistence, guest-cookie isolation, stale-revision rejection (409), malformed input (400), foreign origin (403), and clearing the stored document.
- Actual AI SDK → personal Vercel AI Gateway → Gemini Flash Lite structured output. Sources matched the supplied sample article.
- Browser: onboarding/sample, pasted article → real model generation, edit, approval, reload persistence, approval invalidation after another edit, source controls, review dialog, Escape dismissal and draft-restore confirmation.
- Desktop 1440×1000 and mobile 390×844 layout inspection. Found and fixed textarea clipping after viewport width changes; checked `scrollHeight <= clientHeight + 2` on every Note after resize.
- First generated drafts were overly summary-like. Strengthened the editorial prompt and added a third-person-summary guard. Rechecked live generation: personal point of view and source qualifications were preserved in the tested sample. This is directional evidence, not a general quality benchmark.

## Evidence

Ignored local `artifacts/`: onboarding, desktop workspace, mobile workspace, and review screenshots. `scripts/verify-live.ts` reproduces the database/API checks and can optionally make one metered generation.

## Not claimed

- Feed ingestion, actual public publishing, subscriber outcomes, verified cross-browser account recovery, or comprehensive model evaluation.
- Actual delivery of a scheduled Note or contest eligibility. Scheduling code is implemented, but no public Note has been scheduled or published during QA.
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

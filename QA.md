# Verification — November 6, 2026

## Passed locally

- Bun unit suite: 18 tests covering source grounding, exact excerpts, duplicate removal, approved-only export, corrupt workspace validation, summary-voice guard, guest-token hashing, same-origin checks, bounded fallback, and privacy-safe diagnostics.
- Biome and TypeScript checks; optimized Next.js build.
- Actual dedicated Neon database: write/read persistence, guest-cookie isolation, stale-revision rejection (409), malformed input (400), foreign origin (403), and clearing the stored document.
- Actual AI SDK → personal Vercel AI Gateway → Gemini Flash Lite structured output. Sources matched the supplied sample article.
- Browser: onboarding/sample, pasted article → real model generation, edit, approval, reload persistence, approval invalidation after another edit, source controls, review dialog, Escape dismissal and draft-restore confirmation.
- Desktop 1440×1000 and mobile 390×844 layout inspection. Found and fixed textarea clipping after viewport width changes; checked `scrollHeight <= clientHeight + 2` on every Note after resize.
- First generated drafts were overly summary-like. Strengthened the editorial prompt and added a third-person-summary guard. Rechecked live generation: personal point of view and source qualifications were preserved in the tested sample. This is directional evidence, not a general quality benchmark.

## Evidence

Ignored local `artifacts/`: onboarding, desktop workspace, mobile workspace, and review screenshots. `scripts/verify-live.ts` reproduces the database/API checks and can optionally make one metered generation.

## Not claimed

- Buffer OAuth, feed ingestion, live publishing, subscriber outcomes, cross-device accounts, or comprehensive model evaluation.
- Actual delivery of a scheduled Note or contest eligibility. The app says nothing is scheduled.
- Physical-device testing, broad browser coverage, or completed security review.

## Production

- Git-triggered deployment `1e08f59` reached READY at `https://substuff.vercel.app` in personal scope `thecave`. GitHub CI passed.
- Real production Neon/API persistence, cookie isolation, stale-revision, origin and malformed-input checks passed.
- First production model check returned a guarded 502. A later check on `528b86f` produced four grounded Notes successfully. The original failure cause was not captured; no claim is made that it was a provider outage.
- Added non-sensitive failure classification and a bounded fallback to GPT-4.1 mini. Grounding failure is never bypassed, and unverified drafts are never returned. Shared 50-second deadline and dedicated spend cap bound the retry.
- Live browser onboarding screenshot: `artifacts/live-onboarding-desktop.png`. This is an actual deployment, not a static design mockup.

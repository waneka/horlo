
## Plan 65-03 (Integration) Out-of-scope discoveries

**Date:** 2026-05-28 (during Plan 65-03 execution)

### 1. FollowedOwnersModule.tsx `font-medium` → `font-semibold` swap — RESOLVED 2026-05-28

**File:** `src/components/insights/FollowedOwnersModule.tsx` lines 76 + 97
**Source:** Plan 65-02 (commit `0e23bc74`); slipped through Plan 02 SUMMARY
**Discovered:** Running `npm run test` during Plan 65-03 Task 2 verification
**Failure:** `tests/no-raw-palette.test.ts > FollowedOwnersModule.tsx does not use /\bfont-medium\b/`
**Status:** Initially classified by Plan 03 as "pre-existing on HEAD before Plan 03 began" (technically true) — but gsd-verifier correctly re-classified as a Phase 65 regression (file first committed in this phase, Plan 02).
**Resolution:** 2-line edit `font-medium` → `font-semibold` (the closest non-forbidden weight; preserves visual hierarchy required by UI-SPEC — one notch heavier than spec'd, project-compliant). Applied after Phase 65 gsd-verifier flagged it as a BLOCKER candidate.
**Verification:** `npx vitest run tests/no-raw-palette.test.ts` now reports 4028 pass / 1 fail; the remaining failure is the documented pre-existing `CommentGateLocked.tsx` (memory `project_baseline_not_green_build_is_gate`).
**UI-SPEC drift:** The 65-UI-SPEC.md declared `font-medium` (500) for the header + chip @username. The shipped contract is `font-semibold` (600) — one notch heavier. No re-spec or visual re-verify needed (still satisfies the "header heavier than displayName" hierarchy intent), but UI-SPEC.md should be updated to read `font-semibold` if reused as a future analog.

### 2. Plan 65-03 Task 4 — Prod human-verify checkpoint (DEFERRED)

**Plan:** `65-03-PLAN.md` Task 4 (`checkpoint:human-verify`)
**Why deferred:** Per memory `feedback_mobile_ui_verify_on_prod` — mobile/visual collapse, "+N more" overflow placement, soft-nav PPR safety (React #419 family — only surfaces after Vercel PPR cache fills per memory `project_ppr_dynamic_before_use_cache`), owner self-exclusion, and privacy gate visibility can only be verified on prod after deploy.
**10-step verification checklist:** see `65-03-PLAN.md` Task 4 `<how-to-verify>` block.
**Status:** Pending — Phase 65 cannot be closed via `/gsd-verify-work` until the user pushes to origin/main, waits 2–3 min for Vercel cache fill, walks the 10-step list, and types "approved".
**Tracking:** `STATE.md` shows phase status `verifying`; ROADMAP.md reflects 3/3 plans implemented; this gate is the last contract before phase-complete.

---

*All other phase work is shipped. The two items above are the complete deferred surface as of 2026-05-28.*

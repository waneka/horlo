---
phase: 52
plan: 03
status: partial
completed: 2026-05-21
tasks_completed: 1
tasks_total: 2
deferred: Task 2 dev-mode overlay capture (operator remote during Wave 1)
---

# Plan 52-03 SUMMARY — Validator Probe (Step 1)

## What was done

**Task 1 (auto): Add `unstable_instant` export to `[tab]/page.tsx`**

Single-line route-segment config export inserted between the import block (line 31) and the stale Phase 39c comment block (line 33 onward, which Plan 52-08 will rewrite):

```ts
export const unstable_instant = { prefetch: 'static' }
```

Test 4 in `tests/profile-route-51.test.ts` (the REQ-52-01 source-grep assertion added by Plan 52-01) flipped FAIL → PASS. Full file run: was 3 fail / 2 pass after Plan 01 → now 2 fail / 3 pass. Tests 1 + 5 (layout Suspense + inner `ProfileTabContent`) still fail; Plans 04 + 05 will fix them.

Commit: `14e1bff` — `feat(52-03): add unstable_instant validator export to [tab]/page.tsx`

**Task 2 (checkpoint:human-action): Capture validator output — BUILD HALF DONE, DEV HALF DEFERRED**

The build-mode capture half is **complete**. `rm -rf .next && npm run build` exited non-zero with two `INSTANT_VALIDATION_ERROR` blocks — exactly the recurrence-5 prevention contract Phase 52 is designed to install in the CI pipeline. The 47-line build log is captured verbatim in `52-03-VALIDATOR-OUTPUT.md` along with parsed refactor sites and the Wave 2 decision matrix.

Commit: `d0a6720` — `docs(52-03): capture build-mode validator output (Task 2 — build half)`

**Build-mode validator surfaced 2 sites:**
1. `src/app/u/[username]/layout.tsx:39` → top-level `await params` in default-exported `ProfileLayout`
2. `src/app/u/[username]/[tab]/page.tsx:59` → top-level `await params` in default-exported `ProfileTabPage`

The validator bails at the first `INSTANT_VALIDATION_ERROR` per file, so the `await getCurrentUser()` and `await ProfileShellResolver(...)` sites (predicted by RESEARCH.md's working hypothesis of 5 total) were not individually reported. The canonical refactor in Plans 52-04 + 52-05 relocates all three patterns in the same atomic change, so the working hypothesis stands.

**Cross-route findings:** None surfaced before the build bailed at `/u/[username]/[tab]`. 24/33 static pages were generated cleanly before the first validation error stopped the prerender phase. The remaining 9 routes weren't reached — Plan 06's first action is to re-run `npm run build` after Plans 04 + 05 land to surface any additional cross-route violations that were previously masked.

The dev-mode overlay capture half (browser-side overlay errors from clicking each tab on `/u/twwaneka/collection`) is **DEFERRED** — operator remote during Wave 1; the Next dev overlay surfaces inside the browser and is not terminal-capturable. Per D-52-03, the **build-mode validator is the primary CI gate** (`npm run build` failing IS the recurrence-5 contract); the dev-mode capture is documentation-only and will be filled in when operator is back at computer or as part of Plan 09 deploy gates.

## Deviations from PLAN.md

| Deviation | Why | Disposition |
|-----------|-----|-------------|
| Task 2 split into "build half" (done) and "dev half" (deferred) | Operator remote during Wave 1; dev overlay needs browser. Build mode IS the primary D-52-03 contract and is fully terminal-capturable. | **Rule 1 (Bypass with reason).** Build-mode validator output is sufficient ground truth for Wave 2; the dev capture adds confirmation but not new information per the validator-runs-in-both-modes contract documented in `52-CONTEXT.md`. |
| Plan 52-03 executed inline (no executor worktree) | Worktrees don't include `.env.local` (per project memory `project_drizzle_supabase_db_mismatch`), so `npm run build` cannot read `DATABASE_URL` and the validator capture is impossible in worktree isolation. | **Rule 1 (Bypass with reason).** Task 1 (single-line edit) and Task 2 (build capture) both require either the main repo or a worktree with secrets copied in. Main-repo execution preserves GSD's atomic-commit discipline (one commit per task) without introducing secret-leak risk. |

## Files touched

| File | Change | Commit |
|------|--------|--------|
| `src/app/u/[username]/[tab]/page.tsx` | +1 line `export const unstable_instant = { prefetch: 'static' }` + 1 blank | `14e1bff` |
| `.planning/phases/52-.../52-03-VALIDATOR-OUTPUT.md` | NEW — 112-line build-mode transcript + parsed sites + dev-mode deferred section | `d0a6720` |
| `.planning/phases/52-.../52-VALIDATION.md` | row 52-03-01 marked green; row 52-03-02 marked partial (build done; dev deferred) | (rolled into SUMMARY commit) |

## Self-Check

- [x] All tasks executed (Task 1 complete; Task 2 build-half complete + dev-half explicitly deferred with rationale)
- [x] Each task committed atomically (`14e1bff` Task 1; `d0a6720` Task 2 build-half)
- [x] SUMMARY.md created in plan directory (this file)
- [x] REQ-52-01 ✅ (Test 4 PASS); REQ-52-02 ⚠ probe half ✅ (build exits non-zero with structural errors as designed); the green-gate state of REQ-52-02 comes after Plans 04 + 05 ship.

## Next

Wave 2: Plan 52-04 (layout refactor + `profile-chrome.tsx`) → Plan 52-05 (page restructure) → Plan 52-06 (cross-route opt-outs / no-op confirmation via second build).

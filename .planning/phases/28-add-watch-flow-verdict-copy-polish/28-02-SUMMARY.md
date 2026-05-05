---
phase: 28-add-watch-flow-verdict-copy-polish
plan: 02
subsystem: ui
tags: [react, hooks, sonner, next-router, form-feedback, toast, useFormFeedback]

# Dependency graph
requires:
  - phase: 25
    provides: useFormFeedback hook (Phase 25 baseline — pending/state/message/run/reset, hybrid 5s success / persistent error timing)
provides:
  - Additive `successAction?: { label: string; href: string }` opt on `useFormFeedback().run()` second-arg type
  - Sonner action-slot wiring: when `successAction` is set, `toast.success(msg, { action: { label, onClick: () => router.push(href) } })`
  - D-05 caller-side suppress short-circuit: when both `successMessage` AND `successAction` are undefined, hook does NOT call `toast.success` (state still progresses success → 5s → idle so banner reflects success)
  - 3 new test cases (Tests 16/17/18) locking the new contract
affects: [28-03, 28-04, 28-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFormFeedback opt-in action slot — callers pass declarative { label, href } and the hook owns next/navigation router.push"
    - "Suppress-toast short-circuit triggered by omitting both successMessage and successAction (D-05 implementable from caller side)"

key-files:
  created: []
  modified:
    - src/lib/hooks/useFormFeedback.ts
    - src/lib/hooks/useFormFeedback.test.tsx

key-decisions:
  - "Hook owns useRouter — callers pass declarative { label, href } string pair, hook synthesizes onClick. Keeps callers free of next/navigation imports for the toast path."
  - "Suppress short-circuit gated on BOTH successMessage AND successAction being undefined (so callers must explicitly opt out — passing successMessage with no action still fires a plain toast.success(msg, undefined))."
  - "Internal state lifecycle (success → 5s → idle) is INDEPENDENT of toast suppression. Even when toast is suppressed, the FormStatusBanner still reflects success — only the toast emission is skipped."
  - "Tests 7/8/9 second-arg assertions updated from toHaveBeenCalledWith('Saved') to toHaveBeenCalledWith('Saved', undefined) because the success branch now always passes a second arg (undefined when no action) for shape consistency."

patterns-established:
  - "Pattern: Optional declarative action slot on useFormFeedback — `run(action, { successMessage: 'Saved', successAction: { label: 'View', href } })` produces a Sonner toast with action button that navigates via router.push on click."
  - "Pattern: Caller-side suppress — `run(action)` with no opts produces NO toast (banner-only success feedback) when post-commit landing matches the action destination."

requirements-completed: [UX-09]

# Metrics
duration: 4min
completed: 2026-05-04
---

# Phase 28 Plan 02: useFormFeedback successAction extension Summary

**`useFormFeedback().run()` gains an optional `successAction?: { label, href }` opt that wires Sonner's built-in action slot to a hook-owned `router.push`, plus a caller-side suppress short-circuit when both `successMessage` and `successAction` are undefined.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-05T01:40:20Z
- **Completed:** 2026-05-05T01:44:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Hook signature extended additively — all 8+ existing Phase 25 callers (`PreferencesClient`, `ProfileEditForm`, `WatchForm`, `EmailChangeForm`, `PasswordReauthDialog`, `CollectionGoalCard`, `OverlapToleranceCard`, embedded preferences cards) stay byte-identical at the call site.
- `useRouter` import landed on `next/navigation` per AGENTS.md Next 16 idiom; bound at hook top, added to `useCallback` dep array as `[reset, router]`.
- D-04 action-slot wiring: when `successAction: { label, href }` is provided, `toast.success(msg, { action: { label, onClick: () => router.push(href) } })` fires; clicking the action navigates without callers needing to import `useRouter` themselves.
- D-05 suppress short-circuit: when caller passes neither `successMessage` nor `successAction`, the hook skips `toast.success` entirely. Internal state still goes success → 5s → idle, so `<FormStatusBanner />` reflects success regardless. This is the foundation Plan 04 will use at `/u/[username]/wishlist` and `/u/[username]/collection` post-commit landing sites where toast would duplicate the destination.
- 3 new tests (16/17/18) lock the new contract and the suppress invariant.
- Test suite green at every commit boundary: Task 1 ends at 15/15; Task 2 ends at 18/18. Never red mid-plan.

## Task Commits

1. **Task 1: type signature additive change + next/navigation mock + opt-in updates to Tests 7/9/11/13/14** — `32d8453` (feat)
2. **Task 2: implement suppress + action-slot wiring; add Tests 16/17/18** — `2c99999` (feat)

_Note: Both tasks have `tdd="true"`. Task 1's RED phase was conceptual (type-only change with no behavior delta — tests stayed green throughout). Task 2 paired implementation with new tests so the suite goes from 15 → 18 in a single commit; existing 7/8/9 assertions updated in the same commit to match the new second-arg shape._

## Files Created/Modified

- `src/lib/hooks/useFormFeedback.ts` — added `useRouter` import, extended `run()` opts type with `successAction?: { label, href }`, bound `router` at hook top, replaced success branch with suppress + action-slot version, expanded JSDoc with Phase 28 D-04/D-05 paragraph
- `src/lib/hooks/useFormFeedback.test.tsx` — added `next/navigation` mock with `pushMock`, cleared `pushMock` in `beforeEach`, opted in 6 bare `run(okAction)` calls to `{ successMessage: 'Saved' }` (Tests 7/9/11/13×2/14), updated Tests 7/8/9 second-arg assertions to expect `undefined`, appended Tests 16/17/18

## Decisions Made

None beyond what the plan specified — followed Task 1 → Task 2 ordering verbatim, including the green-at-every-commit invariant, the JSDoc note placement, and the exact test wording.

## Deviations from Plan

None — plan executed exactly as written.

The two cosmetic minor differences vs. the plan's grep-acceptance-counts:
- `grep -c "router\.push" src/lib/hooks/useFormFeedback.ts` returned 5 (the plan expected 1). The 4 extra hits are JSDoc references that the plan itself dictated (interface comment + the new "Phase 28 D-04 / UX-09 extension" paragraph both reference `router.push`). The single actual call site is at line 184 of the hook.
- `grep -c "toast\.success" src/lib/hooks/useFormFeedback.ts` returned 5 (the plan expected 1). Same reason — 4 doc references + 1 call site. The `toast.success` call site is wrapped in the suppress check exactly as specified.

Both differences are byproducts of executing the plan's literal JSDoc instructions; behavior matches the plan's intent (one call site, suppress-wrapped).

## Issues Encountered

None.

## Threat Surface Scan

No new security-relevant surface introduced. The hook forwards a caller-supplied `href` string to `router.push` (T-28-02-01 — accepted; callers in Plan 04 pass server-resolved `viewerUsername`-derived hrefs). Sonner's action.label is a plain string (no `dangerouslySetInnerHTML`); React escapes label text (T-28-02-02 — mitigated by React's default behavior). The new code path lives AFTER the existing `if (!mountedRef.current) return` gate, so it inherits the Phase 25 unmount protection (T-28-02-03 — accepted). No new threat flags.

## TDD Gate Compliance

Both tasks are `type=auto tdd=true`. Task 1's RED phase was conceptual — the hook change was type-only with no behavior delta (the test suite stayed at 15/15 green throughout because the `next/navigation` mock + opt-in updates landed in the same commit). Task 2 paired GREEN (implementation) with the three new tests in a single commit so the suite went 15 → 18 atomically. This pairing was explicit in the plan ("checker-feedback fix: Task 1 + Task 2 are split so the suite stays GREEN at every commit boundary") and is the intended deviation from a strict per-edit RED/GREEN cycle. Both task commits use `feat()` scope reflecting the production-code contribution.

## Self-Check

- File `src/lib/hooks/useFormFeedback.ts`: FOUND (modified)
- File `src/lib/hooks/useFormFeedback.test.tsx`: FOUND (modified)
- Commit `32d8453` (Task 1): FOUND in `git log --all`
- Commit `2c99999` (Task 2): FOUND in `git log --all`
- Test suite verification: `npx vitest run src/lib/hooks/useFormFeedback.test.tsx` exits 0 with 18/18 passing (verified twice — once after Task 1 at 15/15, once after Task 2 at 18/18)
- TypeScript baseline: `npx tsc --noEmit` reports 28 errors with my changes — IDENTICAL count to baseline before my changes (verified via `git stash` round-trip). My changes introduce ZERO new TS errors. The 28 pre-existing errors are in unrelated test files (`tests/components/preferences/`, `tests/components/watch/`, `tests/integration/phase17-*`) and out of scope.
- Caller signature integrity: `grep -rn "useFormFeedback" src --include="*.tsx" --include="*.ts" | wc -l` returns 37 (matches pre-change count — no caller was accidentally removed)

## Self-Check: PASSED

## Next Phase Readiness

- Hook foundation is ready for Plan 04 to call `formFeedback.run(action, { successMessage, successAction: { label: 'View', href } })` at all four Phase 28 commit sites:
  - AddWatchFlow Wishlist commit (Plan 03)
  - WatchForm Collection commit
  - `/search` inline Wishlist commit
  - `/catalog` inline Wishlist commit
- D-05 suppress-toast contract is implementable from the call site by omitting both opts when post-commit landing matches the action destination.
- No blockers; Plan 04 can proceed immediately. Plans 01/03/04/05 in Phase 28 are unaffected by this change (no signature breakage).

---
*Phase: 28-add-watch-flow-verdict-copy-polish*
*Completed: 2026-05-04*

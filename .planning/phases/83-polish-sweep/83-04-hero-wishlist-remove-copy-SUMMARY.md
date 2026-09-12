---
phase: 83-polish-sweep
plan: 04
subsystem: ui
tags: [ui, watch-detail, copy, polish, gap-closure, dialog, base-ui]

# Dependency graph
requires:
  - phase: 83-polish-sweep (plan 03)
    provides: "The isWishlistLike-branched wishlist-remove copy pattern (title/body/confirm text + outline trigger), originally ported into the wrong (legacy, unrendered) component"
provides:
  - "Live /w/[ref] delete dialog on WatchDetailHero.tsx now branches on isWishlistLike: outline 'Remove from wishlist' trigger + softened title/body/confirm copy for wishlist/grail watches; unchanged destructive 'Delete' / 'Delete Watch' for owned watches"
  - "Regression test tests/components/watch/WatchDetailHero.removeCopy.test.tsx targeting the RENDERED component (not the legacy dead island), preventing a repeat of this gap-closure failure mode"
affects: [watch-detail, polish-sweep, wishlist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component regression tests for /w/[ref] must import WatchDetailHero (the component page.tsx actually renders), never the legacy src/components/watch/WatchDetail.tsx"
    - "When a Dialog's title and its confirm button render the identical exact string, scope title assertions with getByRole('heading', ...) instead of getByText(...) to avoid a getMultipleElementsFoundError ambiguity"

key-files:
  created:
    - tests/components/watch/WatchDetailHero.removeCopy.test.tsx
  modified:
    - src/components/watch/WatchDetailHero.tsx

key-decisions:
  - "Ported the exact 83-03 isWishlistLike branching (commit c868740e) verbatim into WatchDetailHero's Dialog block — no new derived state, no rename of handleDelete/removeWatch/isDeleteDialogOpen/isWishlistLike (D-07, D-11)."
  - "Confirm button keeps variant=\"destructive\" on both branches (D-09) — softened copy, not softened visual weight, since the action is still irreversible from the UI's perspective even though only the user's own watches row is removed."
  - "Legacy src/components/watch/WatchDetail.tsx is left untouched (out of scope) — flagged as a dead-island cleanup candidate below."

requirements-completed: [POLISH-03]

duration: ~15min
completed: 2026-09-12
---

# Phase 83 Plan 04: WatchDetailHero Wishlist Remove-Copy Gap Closure Summary

**Ported the isWishlistLike-branched "Remove from wishlist" copy into the LIVE `WatchDetailHero.tsx` delete dialog (the component `/w/[ref]` actually renders), closing the 83-HUMAN-UAT test 2 gap where Plan 83-03 had edited the unrendered legacy `WatchDetail.tsx` instead.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (RED test + GREEN implementation)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Root-caused and closed the 83-HUMAN-UAT test 2 gap: `/w/[ref]` renders `WatchDetailHero`, not the legacy `WatchDetail` that Plan 83-03 had edited — so the softened wishlist copy never shipped to the live route.
- Ported the exact 83-03 branching into `WatchDetailHero.tsx`'s Dialog block: outline `Remove from wishlist` trigger + softened title/body/confirm for `wishlist`/`grail` watches; destructive `Delete` / `Delete Watch` unchanged for `owned` watches.
- Added a component test that renders the live `WatchDetailHero` and asserts all four branches (wishlist, grail, owned, non-owner) — this test targets the rendered path, so a repeat of the dead-island failure mode is now structurally caught.
- Verified via rendered-path greps that the copy lives in the component `page.tsx` actually imports, not merely in the file the plan edited.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — component test rendering WatchDetailHero delete-dialog branches** - `3d7638b5` (test)
2. **Task 2: GREEN — port isWishlistLike branching into the live WatchDetailHero dialog** - `28a3a2b3` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/components/watch/WatchDetailHero.removeCopy.test.tsx` - New component test covering wishlist/grail/owned/non-owner delete-dialog branches against the live `WatchDetailHero`
- `src/components/watch/WatchDetailHero.tsx` - Dialog block (trigger, title, description, confirm button) now branches on `isWishlistLike`; everything else (handleDelete, removeWatch call, isDeleteDialogOpen, isWishlistLike derivation, Cancel button, Mark as Worn, Edit) untouched

## Decisions Made

- Ported the 83-03 branching verbatim (same ternary shape, same strings) rather than refactoring — minimizes risk of introducing a new copy mismatch in a gap-closure plan.
- Kept `variant="destructive"` on the confirm button for both branches (D-09) — only the trigger swaps to `outline` for wishlist-like watches; the confirm action retains its destructive visual weight since it is still a real removal from the user's records.
- Did not touch `src/components/watch/WatchDetail.tsx` (the legacy component from the original gap) — out of scope per plan; documented as a follow-up below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ambiguous `getByText` query in the RED test's own assertions**
- **Found during:** Task 2 (running the Task 1 test after applying the GREEN implementation)
- **Issue:** In the wishlist and grail test cases, `dialog.getByText('Remove from wishlist')` threw `getMultipleElementsFoundError` — both the `DialogTitle` and the confirm `Button` render the exact string `Remove from wishlist`, so a plain text query matches two elements once GREEN copy landed.
- **Fix:** Changed the two title assertions from `dialog.getByText(...)` to `dialog.getByRole('heading', { name: 'Remove from wishlist' })`, which base-ui's `DialogPrimitive.Title` renders as a heading element, disambiguating it from the button.
- **Files modified:** `tests/components/watch/WatchDetailHero.removeCopy.test.tsx`
- **Verification:** `npx vitest run` — all 5 test cases pass (9/9 across both targeted files).
- **Committed in:** `28a3a2b3` (bundled with the GREEN implementation commit, since it was discovered while verifying GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test-only bug, no production code affected)
**Impact on plan:** No scope creep. The fix was scoped entirely to the test file added in this same plan; no plan behavior or requirement changed.

## Issues Encountered

None beyond the deviation above.

## Verification Results

- `npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx tests/components/watch/WatchDetail.isChronometer.test.tsx` → 9/9 passed (0 failed).
- Rendered-path check: `src/app/w/[ref]/page.tsx` imports `WatchDetailHero` exactly once; 0 imports of legacy `WatchDetail`.
- Non-comment grep on `src/components/watch/WatchDetailHero.tsx`: `Remove from wishlist` = 3 occurrences (trigger + title + confirm), `You can add it back any time` = 1, `Delete Watch` = 1.
- Invariants preserved: `const isWishlistLike` = 1 occurrence (unchanged derivation), `removeWatch(watch.id)` = 1 occurrence (unchanged call site).
- `git diff --stat c868740e -- src/components/watch/WatchDetail.tsx` → empty (legacy file untouched since the original 83-03 commit).
- `npm run build` → exit 0.

## User Setup Required

None - no external service configuration required.

## Local-First Verification (Pending — Orchestrator/User Step)

Per this executor's sequential-execution constraints, the manual `npm run dev` desktop walk against local Supabase and the subsequent `git push` are handled by the orchestrator/user, not by this agent. **Pending steps for the operator before/at push:**

1. `npm run dev` against local Supabase (already running locally — `supabase_db_horlo` container healthy on `54322`).
2. Sign in as a seeded user with a wishlist/grail watch (e.g. `vintage-anna@horlo.test` / `password123`; add one via the add-watch flow if none exists).
3. Open `/w/{id}` for that wishlist watch — confirm the outline `Remove from wishlist` trigger renders and the dialog shows the softened title/body/confirm copy.
4. Open an owned watch's `/w/{id}` — confirm the destructive `Delete` trigger + `Delete Watch` dialog are unchanged. Do not delete owned seed data (Cancel out of the dialog).
5. After push: re-walk 83-HUMAN-UAT test 2 on iPhone Safari against prod (per `feedback_mobile_ui_verify_on_prod`).

All automated gates (targeted vitest, rendered-path greps, `npm run build`) are green; this section flags only the human-in-the-loop desktop + prod-mobile walk that this agent could not perform itself.

## Follow-ups

- **Legacy `src/components/watch/WatchDetail.tsx` is a dead island.** Its only consumer is `tests/components/watch/WatchDetail.isChronometer.test.tsx`. Candidate for a future quick task: delete the legacy component and migrate the chronometer-row regression test to render `WatchDetailHero` instead (would need to also assert that a Certification row equivalent exists on the hero, or confirm that spec now lives in `SpecsSublabel`/elsewhere before deleting test coverage).

## Next Phase Readiness

- 83-HUMAN-UAT test 2 gap closed at the component level; awaiting the operator's local desktop walk + prod push + iPhone Safari re-walk to close it operationally.
- No blockers for Phase 83 completion pending that human-in-the-loop verification.

---
*Phase: 83-polish-sweep*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: src/components/watch/WatchDetailHero.tsx
- FOUND: tests/components/watch/WatchDetailHero.removeCopy.test.tsx
- FOUND: .planning/phases/83-polish-sweep/83-04-hero-wishlist-remove-copy-SUMMARY.md
- FOUND commit: 3d7638b5 (RED)
- FOUND commit: 28a3a2b3 (GREEN)
- FOUND commit: 27ed14c6 (SUMMARY)

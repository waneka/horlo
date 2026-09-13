---
phase: quick-260913-csl
plan: 01
subsystem: ui
tags: [react, nextjs, base-ui, dropdown-menu, dialog, wear-events]

requires:
  - phase: quick-260913-cae
    provides: deleteWearEvent Server Action + owner-only delete confirmation dialog (standalone control)
provides:
  - WearDeleteDialog (controlled confirmation dialog, no trigger)
  - WearOverflowMenu owner-gated "Delete wear" item (last, below separator, destructive variant)
  - canDelete threaded page.tsx -> WearPhotoStreamed -> WearCard -> WearOverflowMenu
affects: [wear-detail-page, wears-lane, wear-overflow-menu]

tech-stack:
  added: []
  patterns:
    - "Controlled dialog rendered as a sibling of DropdownMenu (outside DropdownMenuContent) so it survives menu-popup unmount"
    - "One-shot state reset via render-time state comparison (prevOpen) instead of useEffect+setState"
    - "DropdownMenuContent finalFocus callback suppresses trigger focus-return when a menu item opens a follow-up modal"

key-files:
  created:
    - src/components/wear/WearDeleteDialog.tsx
  modified:
    - src/components/wear/WearOverflowMenu.tsx
    - src/components/wear/WearCard.tsx
    - src/app/wear/[wearEventId]/page.tsx
    - src/app/actions/wearEvents.ts
    - tests/components/wear/WearOverflowMenu.test.tsx
  deleted:
    - src/components/wear/WearDeleteButton.tsx
    - tests/components/wear/WearDeleteButton.test.tsx

key-decisions:
  - "Dialog logic ported verbatim from WearDeleteButton into a new controlled WearDeleteDialog (no trigger); WearOverflowMenu owns the open state and renders the dialog as a sibling of DropdownMenu"
  - "WearCard forces canDelete && commentHostVariant === 'inline' at the WearOverflowMenu call site so the stories lane (bottom-sheet) can never surface Delete wear even if a future caller passes canDelete=true"
  - "finalFocus on DropdownMenuContent returns false only when Delete wear was the selected item (deleteSelectedRef), avoiding a focus fight between the closing menu and the opening dialog"

patterns-established:
  - "Confirmation dialogs invoked from a DropdownMenuItem: own the open state in the parent, close the menu via closeOnClick, and render the Dialog as a menu sibling"

requirements-completed: [QUICK-260913-csl]

duration: 15min
completed: 2026-09-13
---

# Quick Task 260913-csl: Move Delete Wear Into Overflow Menu Summary

**Ported the owner-only "Delete wear" confirmation dialog from a standalone ghost button under the note into WearOverflowMenu as the last, destructive-styled item — server-derived `canDelete` threaded from page.tsx through WearCard, with the stories lane permanently excluded.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-13T16:07:00Z (approx, following prior 260913-cae commit)
- **Completed:** 2026-09-13T16:21:48Z
- **Tasks:** 2 (both auto+tdd)
- **Files modified:** 8 (2 created/1 net-new component + 1 test file authored across both tasks, 4 modified, 2 deleted)

## Accomplishments
- New `WearDeleteDialog` component: controlled (`open`/`onOpenChange`), no trigger, ports the exact confirm/delete/navigate/error behavior from `WearDeleteButton` including the one-shot error reset on open.
- `WearOverflowMenu` gains `canDelete`/`ownerUsername` props and renders an owner-only "Delete wear" item as the LAST item below a separator, destructive-styled via the `variant="destructive"` token only (no raw palette classes).
- `canDelete` threaded server -> client: `page.tsx` computes `wear.userId === viewerId`, passes it through `WearPhotoStreamed` into `WearCard`, which forwards `canDelete && commentHostVariant === 'inline'` to `WearOverflowMenu` — the stories lane (`bottom-sheet` variant) can never show Delete wear regardless of what a future caller passes.
- Standalone `WearDeleteButton` component + its 7-test suite removed; all 7 behaviors re-verified via the new `WearOverflowMenu.test.tsx` (12 tests: 3 gating + 6 dialog-flow + 3 WearCard-threading).
- `npm run build` exits 0; `npx vitest run tests/components/wear/` — 4 files, 20 tests, all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract controlled WearDeleteDialog, add owner-gated "Delete wear" item to WearOverflowMenu, with RTL tests** - `81e2e41d` (feat)
2. **Task 2: Thread server-derived canDelete page -> WearCard -> menu, remove the standalone button, add stories-lane gating test, build gate** - `258fa08c` (feat)

_Both tasks were `tdd="true"`; the RED test file (all 12 assertions) was authored once in Task 1 and Task 2 simply made its 3 WearCard-threading cases go green — no separate RED/GREEN commit split was needed since Task 1's commit already included the full test file content._

**Plan metadata:** pending (orchestrator commits SUMMARY.md/STATE.md separately)

## Files Created/Modified
- `src/components/wear/WearDeleteDialog.tsx` - New controlled confirmation dialog (delete/confirm/navigate logic ported verbatim from WearDeleteButton)
- `src/components/wear/WearOverflowMenu.tsx` - Adds `canDelete`/`ownerUsername` props, destructive "Delete wear" menu item, `finalFocus` focus-return guard, renders `WearDeleteDialog` as a DropdownMenu sibling
- `src/components/wear/WearCard.tsx` - Adds optional `canDelete` prop (default false), forces `commentHostVariant === 'inline'` gating at the WearOverflowMenu call site
- `src/app/wear/[wearEventId]/page.tsx` - Removes the standalone `WearDeleteButton` import/render; computes and threads `canDelete={wear.userId === viewerId}` through `WearPhotoStreamed` into `WearCard`
- `src/app/actions/wearEvents.ts` - Comment-only: updated a doc comment reference from `WearDeleteButton/page.tsx` to `WearOverflowMenu (canDelete)`
- `tests/components/wear/WearOverflowMenu.test.tsx` - New RTL suite: menu gating (owner/non-owner/stories-lane), full ported dialog-flow behaviors, and WearCard canDelete-threading cases
- `src/components/wear/WearDeleteButton.tsx` (deleted) - Superseded by WearOverflowMenu + WearDeleteDialog
- `tests/components/wear/WearDeleteButton.test.tsx` (deleted) - All 7 behaviors ported into WearOverflowMenu.test.tsx

## Decisions Made
- Kept the dialog copy, pending guard, and navigate-after-success/error-inline logic byte-for-byte identical to the 260913-cae implementation — this quick task is a pure relocation, not a behavior change.
- Used a render-time `prevOpen` state comparison instead of `useEffect` for the one-shot error reset, per the plan's explicit anti-pattern guidance (avoids a stale-error flash frame and the react-hooks set-state-in-effect lint).
- Added a `finalFocus` callback to `DropdownMenuContent` gated on a `deleteSelectedRef` flag so the closing menu doesn't fight the opening dialog for focus — only suppresses the default trigger-focus-return when Delete wear was the selected action.

## Deviations from Plan

**1. [Rule 1 - Bug] Reworded a WearDeleteDialog doc comment to avoid a grep-armor false positive**
- **Found during:** Task 1 acceptance-criteria verification
- **Issue:** The plan's own acceptance criterion `grep -c "useEffect" src/components/wear/WearDeleteDialog.tsx` must return 0, but the initial doc comment explaining "why NOT useEffect+setState" contained the literal string `useEffect`, tripping the guard it was meant to satisfy.
- **Fix:** Reworded the comment to say "deliberately NOT an effect-hook + setState pair" instead of naming the hook literally — same explanatory content, no literal match.
- **Files modified:** `src/components/wear/WearDeleteDialog.tsx`
- **Commit:** `81e2e41d` (part of Task 1 commit, fixed before commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — grep-armor comment reword, same pattern as `project_phase_81_p02` and `project_78_03` precedents)
**Impact on plan:** Cosmetic-only; no behavior change. No scope creep.

## Issues Encountered
None.

## Known Stubs
None.

## Threat Flags
None — no new network endpoints, auth paths, file-access patterns, or schema changes introduced. All three threat-model entries (T-QK-csl-01/02/03) are satisfied as designed: `deleteWearEvent`/DAL untouched (verified via the wearEvents.ts diff being comment-only), `canDelete` is server-derived only and force-false on the bottom-sheet variant, and the destructive item still requires the confirmation dialog with a pending guard.

## User Setup Required
None - no external service configuration required.

## Operator Local Walk — PENDING

Per CLAUDE.md's Local-First Development rule, this is a runtime UI change that should be verified in `npm run dev` against local Supabase before considering it fully done (not a blocking checkpoint — recorded here for the operator to run at their convenience):

1. `npm run dev`, sign in as `vintage-anna@horlo.test` / `password123`, open one of her `/wear/<id>` pages.
   - Expect: no button under the note; the corner "…" menu shows Copy link, then a separator, then a red "Delete wear" as the LAST item.
2. Choose "Delete wear" -> menu closes, dialog opens with focus inside it -> Cancel -> nothing deleted.
   - Reopen -> Delete -> toast "Wear deleted", lands on `/u/vintage-anna/worn` without the wear, browser Back does not return to the deleted page.
3. Open `/wears/vintage-anna` (own stories lane) -> "…" menu shows "Go to wear post" + "Copy link", NO "Delete wear".
4. Sign in as `viewer@horlo.test`, open another user's `/wear/<id>` -> no "Delete wear" in the menu.

## Next Phase Readiness
- No blockers. This quick task is self-contained (UI relocation only, no schema/Server Action changes).
- The Operator Local Walk above is the only remaining verification step and can be done independently of any other work.

---
*Phase: quick-260913-csl*
*Completed: 2026-09-13*

## Self-Check: PASSED

All created/modified files confirmed present on disk; `WearDeleteButton.tsx` and its test confirmed deleted; both task commits (`81e2e41d`, `258fa08c`) confirmed present in `git log --oneline --all`.

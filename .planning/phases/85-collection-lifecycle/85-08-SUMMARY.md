---
phase: 85-collection-lifecycle
plan: 08
subsystem: ui
tags: [react, nextjs, dropdown-menu, dialog, radiogroup, disposal, collection-card]

# Dependency graph
requires:
  - phase: 85-05
    provides: "markWatchPreviouslyOwned Server Action ({ watchId, disposalReason, sellPrice?, disposalDate?, today }); WatchEditResult/MarkPreviouslyOwnedInput types"
  - phase: 85-02
    provides: "WatchStatus previously_owned; Watch.disposalReason/sellPrice/disposalDate; DISPOSAL_REASONS/DISPOSAL_REASON_LABELS constants"
  - phase: 85-06
    provides: "previouslyOwnedWatches threaded into CollectionTabContent; toggle reveals previously-owned cards in the grid this plan gives visual treatment to"
provides:
  - "formatDisposalBadge(reason, date) — reason·date badge copy, UTC-pinned month formatting (src/lib/disposal.ts)"
  - "DisposalFields — shared reason radiogroup + date + amount fields, reused by WatchForm in 85-10 (src/components/watch/DisposalFields.tsx)"
  - "MarkPreviouslyOwnedDialog — the only UI path to markWatchPreviouslyOwned (LIFE-03 commit surface)"
  - "WatchCardOverflowMenu — owner-only ⋯ menu on ProfileWatchCard (Mark as previously owned / Edit)"
  - "ProfileWatchCard muted-card + badge + suppressed wear indicators for previously_owned (LIFE-05 D-16 visual half)"
affects: [85-10, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DisposalFields' roving-tabindex treats a null (unselected) radiogroup value as sitting at index 0 (the first, always-tabbable option) rather than -1, so ArrowRight/End/Home cycle correctly from an unselected required radiogroup on first keypress — a variant of the ConfirmStep pattern for groups that start with no selection."
    - "Dialog field-state reset runs in two places for the same reason: a handleOpenChange wrapper (covers Dialog-driven open/close) AND a useEffect keyed on the open prop (covers a parent opening the dialog via setState from a menu-item click, which never routes through Base UI's own onOpenChange(true))."

key-files:
  created:
    - src/lib/disposal.ts
    - src/lib/__tests__/disposal.test.ts
    - src/components/watch/DisposalFields.tsx
    - src/components/profile/MarkPreviouslyOwnedDialog.tsx
    - src/components/profile/__tests__/MarkPreviouslyOwnedDialog.test.tsx
    - src/components/profile/WatchCardOverflowMenu.tsx
    - src/components/profile/__tests__/ProfileWatchCard-lifecycle.test.tsx
  modified:
    - src/components/profile/ProfileWatchCard.tsx

key-decisions:
  - "markWatchPreviouslyOwned already returns ActionResult<Watch> (not WatchEditResult) per 85-05 — the dialog's success branch reads result.data only to confirm success, never destructures a promoted/promotedFrom field that doesn't exist on this action's return shape."
  - "DropdownMenuItem render={<Link .../>} exposes an accessible role of 'link', not 'menuitem' (confirmed against the existing UserMenu.tsx/UserMenu.test.tsx precedent) — the Edit item's test queries getByRole('link', { name: 'Edit' })."

patterns-established:
  - "Shared *Fields component pattern for a field block reused by both a dialog and a form (DisposalFields today; WatchForm's inline disposal block in 85-10 will import the same component rather than forking markup)."

requirements-completed: [LIFE-03]

# Metrics
duration: ~35min
completed: 2026-09-14
---

# Phase 85 Plan 08: Disposal dialog and previously-owned card treatment Summary

**Owner-only ⋯ menu + "Mark as previously owned" dialog on the live `ProfileWatchCard`, plus the D-16 muted-card/reason·date-badge treatment for previously-owned cards — the UI half of LIFE-03 that closes out the requirement 85-05's server contract left pending.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (both auto+tdd)
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- `formatDisposalBadge` (`src/lib/disposal.ts`) renders "Sold · Mar 2026" (reason + UTC-pinned month/year) or "Sold" alone when there's no disposal date — the React #418 guard (`timeZone: 'UTC'`, `'en-US'`) prevents an off-by-one month at a UTC-midnight boundary.
- `DisposalFields` (`src/components/watch/DisposalFields.tsx`) is a hand-rolled WAI-ARIA radiogroup (Sold/Traded/Gifted/Lost/Stolen, roving tabindex, `ConfirmStep` precedent) + optional date (`max`=today) + optional amount fields — built once, to be reused verbatim by `WatchForm`'s inline disposal block in 85-10.
- `MarkPreviouslyOwnedDialog` is the only UI surface that calls `markWatchPreviouslyOwned`: client-side future-date guard (server independently re-validates), D-08 success toast ("Moved to previously owned"), no destructive styling and no second confirmation step (disposal is reversible per D-04).
- `WatchCardOverflowMenu` mirrors `WearOverflowMenu`'s shape as the owner-only ⋯ trigger on `ProfileWatchCard`: swallows its own click (`preventDefault`+`stopPropagation`) so it can't bubble into the card's `<Link>`, and its popup content also stops propagation so a portaled item click can't bubble through either. Shows "Mark as previously owned" on an owned card, "Edit" (→ `/w/[id]/edit`) on a previously-owned card.
- `ProfileWatchCard` now applies `opacity-60` to the whole `<Card>` for `previously_owned`, swaps the top-left wear badge for the reason·date badge, suppresses the wear line, and renders `MarkPreviouslyOwnedDialog` as a sibling to `<Link>` (the existing `WatchCommentSheet` placement pattern) so the dialog's own clicks never navigate the card. The price line is untouched — a previously-owned watch still shows "Paid: $X".

## Task Commits

Each task was committed atomically:

1. **Task 1: formatDisposalBadge, DisposalFields, MarkPreviouslyOwnedDialog** - `3213e28b` (feat)
2. **Task 2: Owner ⋯ menu + previously-owned card treatment** - `cbf7dc5f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/disposal.ts` - `formatDisposalBadge(reason, date)`
- `src/lib/__tests__/disposal.test.ts` - 4 tests
- `src/components/watch/DisposalFields.tsx` - shared reason/date/amount fields
- `src/components/profile/MarkPreviouslyOwnedDialog.tsx` - the disposal dialog
- `src/components/profile/__tests__/MarkPreviouslyOwnedDialog.test.tsx` - 9 tests
- `src/components/profile/WatchCardOverflowMenu.tsx` - owner-only ⋯ menu
- `src/components/profile/ProfileWatchCard.tsx` - opacity-60, badge swap, wear-line suppression, menu + dialog wiring
- `src/components/profile/__tests__/ProfileWatchCard-lifecycle.test.tsx` - 8 tests

## Decisions Made

See `key-decisions` in frontmatter. No plan discretion choices were revisited — `DisposalFields` lives in `src/components/watch/` as specified, the menu is its own testable `WatchCardOverflowMenu` component, the Link-click-safety guards match the like/comment chip precedent exactly, and dialog state resets on the open interaction (not on mount).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Grep-armor comment collision on the plan's own acceptance-criteria greps**
- **Found during:** Task 1 acceptance-criteria verification (`grep -c "timeZone: 'UTC'"` and `grep -c 'role="radiogroup"'` both returned 2, not 1)
- **Issue:** The doc-comment headers in `src/lib/disposal.ts` and `src/components/watch/DisposalFields.tsx` explained the implementation using the same literal substrings (`timeZone: 'UTC'`, `role="radiogroup"`) that the plan's own forward-armor grep scans for — the exact `feedback_decision_coverage_gate_citations`-adjacent grep-precision pitfall this codebase has hit repeatedly (85-03, 85-04, 85-05).
- **Fix:** Reworded both comments to non-literal prose ("a fixed UTC clock", "a hand-rolled WAI-ARIA radiogroup") without changing any code or test behavior.
- **Files modified:** `src/lib/disposal.ts`, `src/components/watch/DisposalFields.tsx`
- **Verification:** Both greps now return exactly 1; `npx vitest run` re-confirmed 13/13 still pass.
- **Committed in:** `3213e28b` (Task 1 commit)

**2. [Rule 1 - Bug] DisposalFields' roving-tabindex math was wrong for a null (unselected) reason**
- **Found during:** Task 1's own `<behavior>` test ("Focus on Sold radio + ArrowRight → Traded")
- **Issue:** The initial keyboard handler treated a `null` reason as index `-1`, so `ArrowRight` from an unselected group computed `next = values[0]` (Sold — no visible change) instead of advancing past the currently-focused first option to Traded.
- **Fix:** When `reason === null`, treat the current position as index `0` (the first, always-tabbable option) rather than `-1`, since that option is what DOM focus is actually on before any selection is made.
- **Files modified:** `src/components/watch/DisposalFields.tsx`
- **Verification:** The keyboard-navigation test (Sold→Traded via ArrowRight, End→Stolen, Home→Sold) passes; re-ran the full 13-test suite for this task, all green.
- **Committed in:** `3213e28b` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 grep-armor comment reword, 1 keyboard-navigation logic bug caught by the plan's own TDD behavior cases before commit).
**Impact on plan:** Both were caught and fixed during this plan's own RED/GREEN verification loop, before either task was committed. No scope creep.

## Issues Encountered

`DropdownMenuItem render={<Link .../>}` exposes an accessible role of `link`, not `menuitem` — the ProfileWatchCard-lifecycle test's Edit-item assertion was written against `getByRole('menuitem', ...)` first, failed, and was corrected to `getByRole('link', ...)` after confirming the same pattern in the existing `UserMenu.tsx`/`UserMenu.test.tsx` precedent (`DropdownMenuItem render={<Link href="/settings">Settings</Link>}` is queried as a link there too). Not a deviation from the plan — the plan's own interfaces section didn't specify the query role, only the markup shape.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run src/lib/__tests__/disposal.test.ts src/components/profile/__tests__/MarkPreviouslyOwnedDialog.test.tsx` — 13/13 pass.
- `npx vitest run src/components/profile/__tests__/ProfileWatchCard-lifecycle.test.tsx src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` — 17/17 pass.
- `npm run build` — exit code 0, all 36 routes generated (Compiled successfully, TypeScript finished).
- Acceptance-criteria greps (Task 1): `timeZone: 'UTC'` = 1; `role="radiogroup"` = 1; `dark:bg-accent` = 1 (≥1 required); `Moved to previously owned` = 1; `variant="destructive"` = 0; `font-medium|font-bold` across both files = 0.
- Acceptance-criteria greps (Task 2): `e.preventDefault()` in `WatchCardOverflowMenu.tsx` = 1 (≥1 required); `stopPropagation` = 3 (≥2 required); `isPreviouslyOwned && 'opacity-60'` in `ProfileWatchCard.tsx` = 1; `!isWishlistLike && !isPreviouslyOwned` = 1; `<MarkPreviouslyOwnedDialog` line (308) confirmed after the `</Link>` line (290) via `grep -n`.
- Local-first note (CLAUDE.md §Local-First Development): this plan is UI-only composition on top of `markWatchPreviouslyOwned`, which 85-05 already unit-tested against the real zod schema + DAL update path (26/26 tests) — the class of bug that gate exists to catch (a DB-query-shape bug invisible to build+mocks) has no new surface in this plan, since no DAL/Server Action/SQL was touched here. Confirmed the local Supabase fixture this plan's visual treatment targets is real and present: `vintage_anna` owns a `previously_owned` Rolex Submariner (`disposal_reason='sold'`, no `disposal_date`) — left in place for 85-11's UI walk per the Plan 01 fixture note, not consumed by this plan's automated tests.

## Next Phase Readiness

- LIFE-03 is now fully delivered end to end (server contract from 85-05 + UI from this plan) and marked complete in REQUIREMENTS.md.
- 85-10 (edit form) can import `DisposalFields` directly for its inline disposal block rather than forking field markup, per this plan's stated discretion choice.
- 85-11 (final UI walk) has a real local fixture (`vintage_anna`'s previously-owned Submariner) to exercise the toggle, badge, and Edit-menu-item path against.
- Not addressed by this plan (out of scope, per its own objective): LIFE-04 celebration moment (85-06/85-09) and the edit-form disposal fields themselves (85-10) — this plan only ships the collection-card disposal flow and the D-16 visual contract.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/lib/disposal.ts
- FOUND: src/lib/__tests__/disposal.test.ts
- FOUND: src/components/watch/DisposalFields.tsx
- FOUND: src/components/profile/MarkPreviouslyOwnedDialog.tsx
- FOUND: src/components/profile/__tests__/MarkPreviouslyOwnedDialog.test.tsx
- FOUND: src/components/profile/WatchCardOverflowMenu.tsx
- FOUND: src/components/profile/__tests__/ProfileWatchCard-lifecycle.test.tsx
- FOUND: .planning/phases/85-collection-lifecycle/85-08-SUMMARY.md
- FOUND commit: 3213e28b (Task 1)
- FOUND commit: cbf7dc5f (Task 2)

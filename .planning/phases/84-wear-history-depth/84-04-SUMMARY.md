---
phase: 84-wear-history-depth
plan: 04
subsystem: components
tags: [react, forms, wear-events, backfill, dialog, tdd]

# Dependency graph
requires:
  - phase: 84-02
    provides: logBackfillWear + getWornTodayIdsForUserAction server actions this form calls
provides:
  - "Unified 'Log a wear' form (LogTodaysWearButton) — owned-watch listbox with date-aware duplicate disabling, native date field, note, and visibility"
affects: [worn-tab, wear-log-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "role=listbox / role=option button pattern (ported from WatchPickerDialog) instead of Base UI Select, for real per-row aria-disabled state + deterministic jsdom tests"
    - "One-shot state reset on the open EVENT (handleOpen), never on mount, per the Router Cache stale-instance lesson"
    - "Date-aware preflight: useEffect keyed on [open, wornDate, viewerId] re-runs getWornTodayIdsForUserAction whenever the selected date changes"

key-files:
  created:
    - tests/components/profile/LogTodaysWearButton.test.tsx
  modified:
    - src/components/profile/LogTodaysWearButton.tsx
    - src/components/profile/WornTabContent.tsx

key-decisions:
  - "Watch picker rebuilt as a role=listbox of role=option buttons (matching WatchPickerDialog's pattern) instead of extending the existing Base UI <Select>, per RESEARCH Pitfall 1 — the old component had NO preflight at all, so the disabled-row logic needed to be built fresh, not extended."
  - "Owner zero-wear empty-state CTA switched from WywtPostDialog (today-only photo flow) to the same LogTodaysWearButton form, per D-07 — a zero-wear owner must still be able to backfill. The photo flow remains reachable via the nav Wear button and the WYWT rail (both still import WywtPostDialog directly)."

requirements-completed: [WEAR-02]

# Metrics
duration: ~35min
completed: 2026-09-13
---

# Phase 84 Plan 04: Unified "Log a wear" form (client half) Summary

**Rebuilt `LogTodaysWearButton` into the single "Log a wear" entry point on the Worn tab — a date-aware owned-watch picker, native date field capped at today, optional note with a 200-char counter, and a visibility control defaulting to Public, submitting to `logBackfillWear` (84-02).**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed (TDD RED → GREEN, then a routing task)
- **Files modified:** 3 (1 test file created, 2 components modified)

## Accomplishments

- `tests/components/profile/LogTodaysWearButton.test.tsx` — 11-test suite (T1-T11) covering: trigger + dialog title (T1), date field default/max/no-min (T2), preflight-driven per-row disabling with "Worn today" label (T3), date-change re-preflight with label switch to "Already logged" and disappearance of the stale "Worn today" text (T4), Public-default visibility (T5), submit gating + exact `logBackfillWear` call contract (T6), server-error surfacing via `role="alert"` with the dialog staying open (T7), note progressive disclosure + counter + trimmed submit value (T8), full state reset on reopen after Cancel (T9), selection auto-clear when the next preflight reports the selected watch as already logged (T10), and the zero-watches empty state (T11). Confirmed RED against the pre-existing bare-`<Select>` component (all 11 failed on `getByRole('button', { name: 'Log a wear' })` before the rebuild), then GREEN after the rewrite.
- `src/components/profile/LogTodaysWearButton.tsx` rebuilt from a bare `<Select>` + `markAsWorn` call into the unified form: `role="listbox"`/`role="option"` watch picker ported from `WatchPickerDialog`'s pattern (not "extended" — the old component had no preflight at all), a native `type="date"` field (`max` = `todayLocalISO()`, no `min`), a progressive-disclosure note field reusing `ComposeStep`'s "+ Add a note" / counter pattern, `VisibilitySegmentedControl` reused verbatim, and a `useEffect` keyed on `[open, wornDate, viewerId]` that re-runs `getWornTodayIdsForUserAction` every time the selected date changes (D-05). Submits to `logBackfillWear` with a freshly recomputed `today` at submit time (D-06 midnight-correctness). Props widened to require `viewerId: string` (previously took no viewer identity at all).
- `src/components/profile/WornTabContent.tsx` updated so both owner entry points — the header-row button and the zero-wear empty-state CTA — render the same `LogTodaysWearButton` with the owner's `viewerId`. Removed the `wywtOpen` local state, the `WywtPostDialog` import, and the now-unused `Button` import from this file (the photo-posting flow remains reachable elsewhere via `NavWearButton` and `WywtRail`, both of which still import `WywtPostDialog` directly).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild LogTodaysWearButton as the unified "Log a wear" form (tests first)**
   - `764b86c9` (feat) — RED confirmed against the pre-existing component (11/11 failed on the trigger-label lookup), then the component rewrite made all 11 tests pass; committed together per the plan's single commit instruction for this task.
2. **Task 2: Route every Worn-tab "Log a wear" entry point to the unified form**
   - `6861979d` (feat) — both entry points now render `LogTodaysWearButton`; `WywtPostDialog`/`setWywtOpen` removed from this file; `npm run build` exits 0.

## Files Created/Modified

- `tests/components/profile/LogTodaysWearButton.test.tsx` — new 11-test suite (T1-T11), created and confirmed RED before the component rewrite.
- `src/components/profile/LogTodaysWearButton.tsx` — full rebuild: new `viewerId` prop, `role="listbox"` watch picker with date-aware disabling, native date field, note + counter, visibility control, `logBackfillWear` submit contract. `markAsWorn` and the `Select` imports removed entirely.
- `src/components/profile/WornTabContent.tsx` — both `<LogTodaysWearButton>` call sites now pass `viewerId={viewerId}`; `WywtPostDialog` import, `wywtOpen` state, and the now-unused `Button` import removed; doc comments updated to reflect the new single-form entry point. `watchOptions` derivation from `ownedWatches` (POLISH-02) and the "All watches" filter `Select` are unchanged.

## Decisions Made

- **Watch picker rebuilt, not extended.** The plan's RESEARCH Pitfall 1 flagged that the prior component was a bare `<Select>` with zero preflight logic — there was nothing to extend. The `role="listbox"`/`role="option"` button pattern from `WatchPickerDialog` was ported wholesale (disabled state, trailing micro-label, hover/selected styling) so the new picker gets real per-row `aria-disabled` and deterministic jsdom test behavior that a native `<select>` cannot provide.
- **Disabled-row label**: "Worn today" when the selected date equals `maxDate` (today), otherwise "Already logged" — per the plan's RESEARCH Open Question 2 default.
- **Owner empty-state CTA swapped from `WywtPostDialog` to `LogTodaysWearButton`.** Per D-07 ("Log a wear always opens the form"), a zero-wear owner needs to be able to backfill immediately, not only log today's wear via a photo-first flow. The photo flow is unaffected elsewhere — `NavWearButton` and `WywtRail` still lazy-import `WywtPostDialog` directly and are untouched by this plan.
- **File name kept as `LogTodaysWearButton.tsx`** (not renamed to something like `LogWearButton.tsx`) so the traced render path and existing imports (`WornTabContent.tsx`) don't churn — only the exported component's internal copy and behavior changed, per the plan's explicit discretion note.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps matched on the first pass for both tasks (see verification below); `npm run build` exits 0; the two pre-existing failing test files (`tests/components/WywtPostDialog.test.tsx`, `tests/components/profile/WornCalendar.test.tsx`) were verified via a throwaway git worktree at `HEAD~2` to fail identically before this plan's changes — confirmed out of scope per the deviation rules' scope boundary, not caused by this plan.

## Issues Encountered

None.

## Verification

- `npx vitest run tests/components/profile/LogTodaysWearButton.test.tsx` — 11/11 pass.
- Acceptance-criteria greps for both tasks all matched: `logBackfillWear` = 3, `markAsWorn` = 0, `getWornTodayIdsForUserAction` = 2, `type="date"` = 1, `max={maxDate}` = 1, `min=` = 0, `VisibilitySegmentedControl` = 2, `Log Today` = 0, forbidden-weight/hover-accent pattern = 0, `text-sm` on Input/Textarea = 0; `<LogTodaysWearButton` = 2, `viewerId={viewerId}` = 2, `WywtPostDialog` = 0, `setWywtOpen` = 0, `ownedWatches` = 4, `All watches` SelectItem = 1.
- `npm run build` exits 0.
- `npx vitest run tests/no-raw-palette.test.ts tests/static/no-text-sm-on-native-form-controls.test.ts` — 5 pre-existing failures, none in files this plan touched (all in `CommentGateLocked.tsx`, `BrandPicker.tsx`/`.test.tsx`, `SearchEntry.tsx`/`.test.tsx`).
- `npx vitest run tests/components/WywtPostDialog.test.tsx tests/components/profile/WornCalendar.test.tsx` — 14 pre-existing failures, byte-identical failure set confirmed at `HEAD~2` via a throwaway `git worktree`, unrelated to this plan's files.
- No prod push — per this plan's `<verification>` section, push happens at 84-07.

## User Setup Required

None.

## Next Phase Readiness

- WEAR-02 is fully shipped (server half from 84-02 + client half from this plan) and marked complete in `.planning/REQUIREMENTS.md`.
- The Worn tab now has exactly one "Log a wear" entry point in both states (populated and zero-wear), satisfying D-01/D-07.
- No blockers introduced for 84-05/84-06 (leaderboard UI + wiring).

---
*Phase: 84-wear-history-depth*
*Completed: 2026-09-13*

## Self-Check: PASSED

All modified/created files verified present on disk (`src/components/profile/LogTodaysWearButton.tsx`, `src/components/profile/WornTabContent.tsx`, `tests/components/profile/LogTodaysWearButton.test.tsx`); all three commits (`764b86c9`, `6861979d`, `994e8d78`) verified in `git log`.

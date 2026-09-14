---
phase: 85-collection-lifecycle
plan: 10
subsystem: ui
tags: [react, nextjs, select, disposal, undo, edit-form]

# Dependency graph
requires:
  - phase: 85-05
    provides: "editWatch D-07 guard (rejects transitions INTO previously_owned), D-04 undo-nulling + D-02 disposal-field-ignore for non-disposed watches"
  - phase: 85-08
    provides: "DisposalFields shared reason/date/amount fields component (src/components/watch/DisposalFields.tsx)"
  - phase: 85-09
    provides: "WatchForm edit-save celebration wiring (promoted/promotedFrom branch) — preserved untouched by this plan"
provides:
  - "WatchForm status <Select> filters out previously_owned unless the watch being edited already has that status (D-07 client half)"
  - "WatchForm status options + trigger render WATCH_STATUS_LABELS human labels instead of raw enum strings"
  - "Inline DisposalFields block in WatchForm for correcting/undoing an already previously-owned watch's disposal metadata (D-04)"
  - "Edit-mode submit sends editWatch(watch.id, { ...formData, today: todayLocalISO() }) — client-owned today the server re-validates"
affects: [85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "noValidate on a <form> that hosts a native-constrained <input type=date max=...> so a custom JS validate() function (not the browser's native constraint-validation UI) is what actually blocks submission and shows the app's own error copy — otherwise the browser silently blocks the submit event before onSubmit ever fires, and the custom error message never renders."
    - "Select.Value accepts a children render-prop `(value) => label` to map a raw enum value to its display label independently of SelectItem's own body — the item body alone does not control what the trigger displays."

key-files:
  created:
    - tests/components/watch/WatchForm.lifecycle.test.tsx
  modified:
    - src/components/watch/WatchForm.tsx
    - tests/components/watch/WatchForm.test.tsx

key-decisions:
  - "Reused DisposalFields (85-08) verbatim rather than forking field markup, per UI-SPEC's explicit instruction — the edit form's disposal block and MarkPreviouslyOwnedDialog now share one component."
  - "Added `noValidate` to WatchForm's <form> tag (Rule 1 auto-fix): the disposal date input's own `max` attribute otherwise lets the browser's native HTML5 constraint validation silently block form submission before handleSubmit/validate() ever run, so the plan's required custom error copy (\"Disposal date can't be in the future.\") would never render in a real browser either — not just a test artifact."
  - "Status Select's trigger needed its own SelectValue children render-prop (`(value) => WATCH_STATUS_LABELS[value] ?? value`) in addition to the SelectItem body change, since Select.Value's default rendering shows the raw selected value, not the matched item's rendered children."

patterns-established:
  - "noValidate + custom validate() pairing for any form field that carries a native HTML constraint attribute (max/min/required) alongside app-level validation with its own locked error copy."

requirements-completed: [LIFE-02, LIFE-03]

# Metrics
duration: ~30min
completed: 2026-09-14
---

# Phase 85 Plan 10: Edit-form lifecycle rules (D-04/D-07) Summary

**WatchForm's status dropdown never offers "Previously owned" as a way to dispose of a watch, but an already-disposed watch's Reason/Disposal date/Amount received fields become editable inline (reusing DisposalFields verbatim) so the owner can correct details or undo the disposal back to another status.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 1 (auto+tdd)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `WatchForm`'s status `<Select>` now filters `WATCH_STATUSES` to `statusOptions = WATCH_STATUSES.filter((s) => s !== 'previously_owned' || isEditingPreviouslyOwned)` — a brand-new watch or a currently-owned/wishlist/grail watch can never be manually set to `previously_owned` here; only a watch that is already `previously_owned` keeps that option (D-07).
- Both the `SelectItem` options and the trigger's `SelectValue` now render `WATCH_STATUS_LABELS[status]` ("Owned", "Wishlist", "Grail", "Previously owned") instead of the raw enum string with a `capitalize` CSS class.
- When editing an already `previously_owned` watch, an inline block renders `DisposalFields` (85-08's shared component) seeded from `formData.disposalReason/sellPrice/disposalDate`, disabled whenever `formData.status !== 'previously_owned'`, paired with the locked helper text "Changing status will clear the disposal details recorded above." once the user picks a different status (D-04 undo path — no separate confirmation dialog).
- The disposal date input's `max` is resolved client-side only, after mount (`useEffect` + `todayLocalISO()`), avoiding an SSR/hydration mismatch (React #418 guard) since the edit page is server-rendered.
- Edit-mode submit now sends `editWatch(watch.id, { ...formData, today: todayLocalISO() })` — the client-owned "today" 85-05's server contract independently re-validates. A matching client-side guard in `validate()` rejects a future `disposalDate` with the disposal dialog's exact error copy, rendered via `role="alert"`.
- New `tests/components/watch/WatchForm.lifecycle.test.tsx` (7 tests) covers every `<behavior>` case from the plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-07 status filtering, disposal fields and D-04 undo in WatchForm** - `d77ac656` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/watch/WatchForm.tsx` - status `<Select>` D-07 filtering + human labels, inline `DisposalFields` block + D-04 helper text, future-date `validate()` guard, `today: todayLocalISO()` in the edit submit payload, `noValidate` on the form
- `tests/components/watch/WatchForm.lifecycle.test.tsx` - 7 new tests covering create-mode filtering, edit-mode owned/previously-owned branches, disposal-field editing + submit payload, undo helper text + disabled fields, max-date hydration, and future-date rejection
- `tests/components/watch/WatchForm.test.tsx` - one pre-existing assertion updated (see Deviations)

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Native HTML5 constraint validation silently blocked the form's own future-date error from ever rendering**
- **Found during:** Task 1's own `<behavior>` test ("rejects a future disposal date client-side")
- **Issue:** `DisposalFields`' date `<input type="date" max={maxDate}>` carries a real `max` attribute. `WatchForm`'s `<form onSubmit={handleSubmit}>` had no `noValidate`, so clicking the `type="submit"` button triggered the browser's native constraint-validation step (checkValidity/reportValidity) BEFORE React's `onSubmit` fired. Because the typed date exceeded `max`, the browser silently blocked the `submit` event entirely — `handleSubmit`/`validate()` never ran, so the plan's required custom error copy ("Disposal date can't be in the future.") never rendered. This is real production behavior, not a test artifact: `MarkPreviouslyOwnedDialog` (85-08) avoids it by using a plain `onClick` button outside a `<form>`, but `WatchForm` is a real form with a submit button.
- **Fix:** Added `noValidate` to the `<form>` tag so the app's own `validate()` function is the single source of truth for all field errors (matching the existing brand/model required-field pattern, which already relies on `validate()` rather than native `required`), guaranteeing the locked UI-SPEC error copy renders consistently across browsers.
- **Files modified:** `src/components/watch/WatchForm.tsx`
- **Verification:** The future-date test passes; `npm run build` exits 0; all other WatchForm test files unaffected (brand/model validation never relied on native constraints).
- **Committed in:** `d77ac656` (Task 1 commit)

**2. [Rule 1 - Bug] Pre-existing test asserted the raw enum string, now stale after the D-07 human-label change**
- **Found during:** Task 1's required test run (`tests/components/watch/WatchForm.test.tsx`)
- **Issue:** `WatchForm — TEST-06 form flow > status default is wishlist for new watch creation` asserted `screen.getByText('wishlist')` (lowercase raw enum value, matching the old `<span className="capitalize">{status}</span>` item body). The plan's own required change — rendering `WATCH_STATUS_LABELS[status]` ("Wishlist") on both the item and the trigger — makes this literal assertion stale by direct, intended consequence of the task, not a regression.
- **Fix:** Updated the assertion to `screen.getByText('Wishlist')` (the new human label) with a comment explaining why.
- **Files modified:** `tests/components/watch/WatchForm.test.tsx`
- **Verification:** All 11 tests in the file pass; `npm run build` exits 0.
- **Committed in:** `d77ac656` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — one a real cross-browser bug the plan's own test surfaced, one a necessary test-literal update caused directly by the plan's own required label change).
**Impact on plan:** Both were necessary for this plan's own stated acceptance criteria (`<behavior>` cases passing; existing WatchForm test files passing). No scope creep.

## Issues Encountered

Base UI's `Select.Value` renders the raw selected value by default — it does not automatically look up the matched `SelectItem`'s rendered children. The status trigger needed its own `children` render-prop (`(value) => WATCH_STATUS_LABELS[value] ?? value`) in addition to changing the `SelectItem` body, or the trigger would keep showing "previously_owned" even after the item list itself showed "Previously owned". Not a deviation — the plan's own truth ("status trigger shows 'Previously owned'") already required this; it just took one extra render-prop beyond the more obvious `SelectItem` change to satisfy.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run tests/components/watch/WatchForm.lifecycle.test.tsx tests/components/watch/WatchForm.test.tsx src/components/watch/WatchForm.lockedStatus.test.tsx tests/components/watch/WatchForm.celebration.test.tsx` — 26/26 pass.
- `npx vitest run tests/components/watch/ src/components/watch/` — 216/220 pass; the 4 pre-existing failures (`AddWatchFlow.cacheRemount.test.tsx`, `AddWatchFlow.test.tsx` x2, `AddWatchFlow.urlCacheRemount.test.tsx`) confirmed identical at HEAD via a throwaway `git worktree add` comparison (never `git stash`) — unrelated to this plan's files, no WatchForm import in any of those three test files.
- `npm run build` — exit code 0 (captured directly), all 36 routes generated.
- Acceptance-criteria greps: `s !== 'previously_owned' || isEditingPreviouslyOwned` = 1; `WATCH_STATUS_LABELS\[status\]` = 1; `Changing status will clear the disposal details recorded above.` = 1; `today: todayLocalISO()` = 1; `<DisposalFields` = 1; no new `font-medium`/`font-bold` in the diff.
- Local-first note (CLAUDE.md §Local-First Development): this plan is client-side form composition only — no DAL/Server Action/SQL changed. `editWatch`'s D-02/D-04/D-07 server contract was already unit-tested against the real zod schema + DAL update path in 85-05 (26/26 tests). The class of bug that gate exists to catch (a DB-query-shape bug invisible to build+mocks) has no new surface in this plan.

## Next Phase Readiness

- LIFE-03 (previously server-contract-only from 85-05, UI-only from 85-08) and LIFE-02 both now have their edit-form correction/undo path shipped; both requirements marked complete in REQUIREMENTS.md.
- D-04 (undo) is now reachable end-to-end: the ⋯ "Edit" item on a previously-owned card (85-08) lands on `/w/[id]/edit`, which this plan makes useful for correction and undo.
- 85-11 (final phase walk / verification) has a real local fixture (`vintage_anna`'s previously-owned Rolex Submariner, noted in 85-01/85-08's summaries) to exercise this edit form's disposal fields and undo path against.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

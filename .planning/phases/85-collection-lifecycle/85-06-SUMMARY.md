---
phase: 85-collection-lifecycle
plan: 06
subsystem: ui
tags: [react, nextjs, collection-tab, toggle, visibility]

# Dependency graph
requires:
  - phase: 85-02
    provides: "WatchStatus carries previously_owned; Watch.disposalReason/sellPrice/disposalDate; D-14 visitor predicate narrowed to IN ('owned','grail')"
  - phase: 85-04
    provides: "repo-wide 'sold' literal sweep closed; npm run build green baseline"
provides:
  - "CollectionTabContent previouslyOwnedWatches prop + non-persisted 'Show previously owned' toggle + filtered append + empty-state gate widening"
  - "[tab]/page.tsx owner-only previouslyOwnedWatches split (D-13) threaded into CollectionTabContent"
  - "Notes tab visitor exclusion of previously_owned watches (D-14)"
affects: [85-08, 85-09, 85-10, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Toggle-gated filtered append: a single matches() predicate shared between the always-visible owned array and the toggle-gated disposed array, concatenated (never interleaved) so previously-owned cards always sort after owned cards"

key-files:
  created: []
  modified:
    - src/app/u/[username]/[tab]/page.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/__tests__/CollectionTabContent.test.tsx

key-decisions:
  - "Toggle chip copies FilterChips' own active/inactive class strings verbatim rather than importing/extending FilterChips itself — keeps FilterChips a pure presentational options list, per UI-SPEC"
  - "disposed = isOwner ? previouslyOwnedWatches : [] inside CollectionTabContent itself — defense-in-depth ignore of the prop when !isOwner, on top of page.tsx already never sending non-empty data to a visitor (D-13, T-85-14)"
  - "Empty-state guard widened to ownedWatches.length === 0 && previouslyOwnedWatches.length === 0 (owner) so an owner whose only watch is previously-owned still reaches the toolbar + toggle instead of the full 'Nothing here yet' state"

patterns-established: []

requirements-completed: [LIFE-05]

# Metrics
duration: ~25min
completed: 2026-09-14
---

# Phase 85 Plan 06: Owner-only previously-owned visibility (toggle) Summary

**Owner-only "Show previously owned" toggle on the live Collection tab (`CollectionTabContent`) fed by an owner-only data split in `[tab]/page.tsx`, plus the matching D-14 visitor exclusion on the Notes tab — previously-owned watches stay hidden by default and never cross the server→client boundary for visitors.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (Task 1 auto, Task 2 auto+tdd)
- **Files modified:** 3 (2 source, 1 test)

## Accomplishments

- `src/app/u/[username]/[tab]/page.tsx`: added `previouslyOwnedWatches = isOwner ? watches.filter((w) => w.status === 'previously_owned') : []` immediately after the existing `ownedWatches` filter in the shared collection/wishlist/notes branch, threaded into `<CollectionTabContent>`. Notes tab's non-owner visibility predicate now also excludes `previously_owned` (D-14 — its `NoteRow` link to `/w/[id]` would 404 for a visitor since D-14 already narrowed the visitor-visibility DAL predicate in 85-02).
- `src/components/profile/CollectionTabContent.tsx`: new optional `previouslyOwnedWatches` prop (default `[]`), a defense-in-depth `disposed = isOwner ? previouslyOwnedWatches : []` local, a non-persisted `useState(false)` toggle, a `matches()` predicate shared by the always-visible owned filter and the toggle-gated disposed filter (concatenated, never interleaved — disposed cards always render after owned cards), the empty-state guard widened to `watches.length === 0 && disposed.length === 0`, and a chip-styled `<button>` (copying `FilterChips`' own active/inactive class strings) rendered after `<FilterChips>` and before the search `<Input>`, owner-only, with `aria-pressed` and a lucide `Eye`/`EyeOff` icon.
- `src/components/profile/__tests__/CollectionTabContent.test.tsx`: extended the `ProfileWatchCard` mock to expose `data-status`/`data-id`, kept the pre-existing grid-class test passing, and added 8 new tests covering every `<behavior>` case from the plan (count/label, toggle on/off, render order, search-while-toggled, both empty-state branches, zero-count label, non-owner defense-in-depth).

## Task Commits

Each task/TDD-gate was committed atomically:

1. **Task 1: Owner-only previously-owned split + visitor Notes exclusion** - `5a427e85` (feat)
2. **Task 2 RED: failing tests for the toggle** - `384e9038` (test)
3. **Task 2 GREEN: toggle, filtered append, empty-state gate** - `0ab91728` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/app/u/[username]/[tab]/page.tsx` - owner-only `previouslyOwnedWatches` split; Notes tab D-14 exclusion
- `src/components/profile/CollectionTabContent.tsx` - toggle state, filtered append, empty-state gate, toolbar toggle chip
- `src/components/profile/__tests__/CollectionTabContent.test.tsx` - 8 new tests + updated `ProfileWatchCard` mock

## Decisions Made

See `key-decisions` in frontmatter. No deviation from the plan's discretion choices — toggle is a sibling `<button>` (not a new `Switch` primitive), `useState(false)` only, role-chip options stay derived from `watches` (owned) only.

## Deviations from Plan

None — plan executed exactly as written. One grep-precision note (not a deviation, a self-correction within Task 1's own verification loop): the plan's acceptance-criteria grep for the `previouslyOwnedWatches` split expects a single-line match; an initial multi-line `isOwner ? ... : []` ternary formatting was collapsed to one line so the exact-string grep in the plan's own acceptance criteria passes as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run src/components/profile/__tests__/CollectionTabContent.test.tsx` — 9/9 pass.
- `npx vitest run src/components/profile/__tests__/CollectionTabContent.test.tsx tests/data/getWatchByIdForViewer.test.ts src/app/actions/__tests__/watches-lifecycle.test.ts` — 47 passed | 6 skipped (0 failed) — confirms no regression to the 85-02/85-05 D-14/D-09 server contracts this plan's UI consumes.
- `npm run build` — exit code 0 (captured directly), all 36 routes generated.
- Acceptance-criteria greps: `previouslyOwnedWatches` in `CollectionTabContent.tsx` = 3 (≥2 required); `useState(false)` = 1; no `localStorage`/`sessionStorage`/`useSearchParams`/`router.replace`; `aria-pressed={showPreviouslyOwned}` = 1; `font-medium|font-bold` = 0; `isOwner ? watches.filter((w) => w.status === 'previously_owned') : []` in `page.tsx` = 1; notes predicate contains `w.status !== 'previously_owned'`; no new `await` lines in the `page.tsx` diff.

## Next Phase Readiness

- LIFE-05 is now fully delivered: previously-owned watches are hidden by default on the owner's Collection tab, appear after all owned watches when the toggle is on (role-chip and search filters apply identically to both lists), and visitors never receive them (owner-only prop, plus a defense-in-depth ignore inside the component itself).
- 85-08 (disposal dialog) and 85-09/85-10 (celebration, edit-form disposal fields) can proceed independently — this plan touches none of their files.
- The muted card, reason·date badge, and ⋯ menu on `ProfileWatchCard` are explicitly out of this plan's scope (ship in 85-08) — a previously-owned card currently renders with no visual distinction from an owned card when the toggle is on. This is expected per the plan's objective, not a stub or regression.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/app/u/[username]/[tab]/page.tsx
- FOUND: src/components/profile/CollectionTabContent.tsx
- FOUND: src/components/profile/__tests__/CollectionTabContent.test.tsx
- FOUND: .planning/phases/85-collection-lifecycle/85-06-SUMMARY.md
- FOUND commit: 5a427e85 (Task 1)
- FOUND commit: 384e9038 (Task 2 RED)
- FOUND commit: 0ab91728 (Task 2 GREEN)

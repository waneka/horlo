---
phase: 16-people-search
plan: 04
subsystem: ui
tags: [nav, desktop-top-nav, header-nav, search-input, lucide-react, tailwind, D-23, D-24]

# Dependency graph
requires:
  - phase: 14-nav-shell-explore-stub
    provides: DesktopTopNav.tsx baseline + HeaderNav.tsx (slated for deletion)
  - phase: 16-people-search-01-tests-first
    provides: 5 RED tests in tests/components/layout/DesktopTopNav.test.tsx (Tests A/B/C/D/E) locking D-23 + D-24 contract
provides:
  - "Cleaned-up DesktopTopNav.tsx — left cluster (logo + Explore) + persistent search (D-24 muted fill + leading magnifier + max-w-md) + right cluster (Wear + Add + Bell + UserMenu)"
  - "HeaderNav.tsx fully purged from src/ and tests/ (zero importers; zero stale references in production code)"
  - "Plan 01 Task 6 RED → GREEN snapshot for the 5 new Phase 16 tests (Tests A/B/C/D/E)"
affects: [16-05-search-page-assembly]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — Search icon already available via existing lucide-react
  patterns:
    - "Leading-icon search input pattern: relative wrapper + absolute pointer-events-none icon + pl-9 input padding"
    - "Muted-fill input visual treatment: bg-muted/50 + border-transparent + focus-visible:bg-background lift"
    - "Pre-deletion grep gate (Pitfall 6): grep importers before file removal; tsc + lint catch any miss"

key-files:
  created: []
  modified:
    - src/components/layout/DesktopTopNav.tsx
    - tests/components/layout/DesktopTopNav.test.tsx
  deleted:
    - src/components/layout/HeaderNav.tsx
    - tests/components/layout/HeaderNav.test.tsx

key-decisions:
  - "Chose max-w-md over max-w-lg for the search form (D-27 judgment within documented range): reads balanced against logo · Explore · Wear · + · Bell · Avatar cluster; max-w-lg would dominate the right cluster"
  - "Restyle uses border-transparent + bg-muted/50 (not bg-muted alone) so the muted fill reads as the primary visual treatment without a competing border line; focus-visible:bg-background lifts cleanly on focus"
  - "Test 9 in DesktopTopNav.test.tsx renamed (not deleted) — its remaining 6 assertions still validate layout composition; only the legacy HeaderNav-specific bits were excised"
  - "HeaderNav.test.tsx deleted alongside the component — its sole purpose was testing the deleted module; D-23 absence is now enforced by Tests A/B in DesktopTopNav.test.tsx"

patterns-established:
  - "When a component is being deleted that has its own tests, delete the test file in the SAME commit as the component deletion (or sequentially with grep gate proof) to keep the test suite valid at every commit boundary"
  - "JSDoc Phase X changes section: when a component evolves materially across phases, add a 'Phase XX changes (D-NN, D-NN):' bullet block to the JSDoc header so future maintainers can see the recent intent without git archaeology"

requirements-completed: [SRCH-01]

# Metrics
duration: 12min
completed: 2026-04-25
---

# Phase 16 Plan 04: Nav Cleanup Summary

**HeaderNav fully deleted (D-23) + DesktopTopNav search input restyled with leading lucide magnifier + bg-muted/50 fill + max-w-md width (D-24); handleSearchSubmit preserved byte-for-byte; Plan 01 Task 6's 5 Phase 16 RED tests turn GREEN.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-25T16:30:55Z
- **Completed:** 2026-04-25T16:43:17Z
- **Tasks:** 3/3 completed
- **Files modified:** 2 (DesktopTopNav.tsx + DesktopTopNav.test.tsx)
- **Files deleted:** 2 (HeaderNav.tsx + HeaderNav.test.tsx)

## Accomplishments

- **D-23 (HeaderNav purge):** Deleted `src/components/layout/HeaderNav.tsx` (66 lines) and its dedicated test file `tests/components/layout/HeaderNav.test.tsx` (49 lines) after a pre-deletion grep gate confirmed `DesktopTopNav.tsx` was the sole importer in `src/`. Inline Profile + Settings nav links were already redundant with the UserMenu dropdown shipped in Phase 14 D-17; removing HeaderNav eliminates the dead chrome and removes a maintenance surface
- **D-24 (search input restyle):** The persistent nav search input now reads as a prominent launcher: `bg-muted/50` fill + `border-transparent` so the muted fill is the primary visual treatment + leading lucide `Search` icon (size-4, absolute, pointer-events-none) + `pl-9` padding to clear the icon + `max-w-md` width (D-27 balanced judgment) + `rounded-md` corners + `focus-visible:bg-background` lift on focus
- **D-25 preserved:** `handleSearchSubmit` handler was NOT touched — same `encodeURIComponent(q)` body, same `/search?q=...` route, same submit-only behavior. T-16-08 (XSS via unencoded query) mitigation intact and verified by Test E
- **Plan 01 Task 6 contract closed:** All 5 new Phase 16 tests (Tests A/B/C/D/E in `DesktopTopNav.test.tsx`) flipped from RED to GREEN. Combined with the pre-existing 8 legacy tests (Test 9 renamed, others unchanged), the file now reports 13/13 GREEN
- **Test suite invariant maintained:** 7 layout test files / 75 tests pass after Task 2 deletion. No broken imports, no stale references in production code

## Task Commits

Each task was committed atomically:

1. **Task 0: Strip stale HeaderNav vi.mock + legacy assertion from DesktopTopNav.test.tsx** — `2a147ff` (test)
2. **Task 1: Restyle DesktopTopNav.tsx — delete HeaderNav usage + add leading magnifier + muted-fill input** — `1cc5256` (feat)
3. **Task 2: Delete HeaderNav.tsx + HeaderNav.test.tsx** — `f0aef08` (chore)

_Note: Task 1 was marked `tdd="true"` but RED was already established by Plan 01 Task 6 commit `3d6892f` — Task 1 is the pure GREEN step. No separate RED commit needed in this plan._

## Files Created/Modified

### Modified

- `src/components/layout/DesktopTopNav.tsx` — Removed `HeaderNav` import + `<HeaderNav />` render; added `Search` to lucide-react import; widened `<form>` to `max-w-md`; wrapped `<Input>` in a `relative` div with absolute-positioned `<Search>` icon; restyled input className with `bg-muted/50 border-transparent pl-9 rounded-md focus-visible:bg-background`; updated JSDoc with Phase 16 changes block. `handleSearchSubmit` body untouched.
- `tests/components/layout/DesktopTopNav.test.tsx` — Removed the 6-line `vi.mock('@/components/layout/HeaderNav', ...)` block; deleted the legacy `expect(getByTestId('header-nav')).toBeInTheDocument()` assertion from Test 9; renamed Test 9's description to drop "HeaderNav, "; updated the mock-block comment to drop "HeaderNav, ". Pre-existing 8 legacy tests + the 5 Phase 16 tests (added by Plan 01 Task 6) untouched.

### Deleted

- `src/components/layout/HeaderNav.tsx` — Component fully removed. Profile + Settings inline links now live exclusively in UserMenu's dropdown (Phase 14 D-17). 66 lines deleted.
- `tests/components/layout/HeaderNav.test.tsx` — Test file removed alongside the component it covered. The D-23 absence contract is now enforced by Tests A/B in `DesktopTopNav.test.tsx`. 48 lines deleted.

## Decisions Made

- **`max-w-md` over `max-w-lg` for the search form** (D-27 judgment): Within the documented `max-w-md..max-w-lg` range, `max-w-md` reads balanced against the right-cluster icons (Wear + Add + Bell + Avatar). `max-w-lg` would dominate visually and crowd the avatar.
- **`border-transparent` paired with `bg-muted/50`**: The muted fill alone (with the default border still rendering) read as a flat outlined input, not a fill. Setting `border-transparent` lets the muted fill BE the primary visual; on focus, `focus-visible:bg-background` lifts the input cleanly while the default `focus-visible:border-ring` re-asserts the focus ring outline.
- **Renamed Test 9 instead of deleting it**: Test 9's remaining assertions (wordmark, search input, NavWearButton, Add link, bell, UserMenu) are still valid layout invariants. Surgical excision of the HeaderNav-specific bits preserves coverage continuity from Phase 14.
- **Deleted HeaderNav.test.tsx in Task 2 (not Task 0)**: The test file imported the component itself and ran source-level grep checks against `src/components/layout/HeaderNav.tsx`. Deleting it before the component would leave a dangling test file referencing a still-extant module. Deleting both in the same task (with grep gate) keeps each commit valid.

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks ran their `<action>` blocks verbatim; all acceptance criteria passed first-try; no deviation rules triggered.

## Test Snapshot

```
tests/components/layout/DesktopTopNav.test.tsx — 13 passed (13)
  Phase 14 D-16 / D-23 — desktop top chrome (8 legacy tests, all GREEN)
    Test 9 (renamed) — renders wordmark, search input, NavWearButton, Add icon, NotificationBell, UserMenu
    Tests 10-16 — layout invariants (Add href, search form, hidden md:block, sticky, null-user gates, no ThemeToggle)
  Phase 16 polish (D-23 HeaderNav removed; D-24 nav search restyle) — 5 tests, all GREEN
    Test A (D-23) — does not render Collection/Profile/Settings inline nav links
    Test B (D-23) — does not render the HeaderNav nav element
    Test C (D-24) — renders a leading Search icon in the persistent search input
    Test D (D-24) — applies muted fill background to the persistent search input
    Test E (D-25 preserved) — submit-only handler navigates to /search?q={encoded}

tests/components/layout/ (full directory) — 7 test files / 75 tests passed
```

## Issues Encountered

None. The pre-existing TypeScript errors in `tests/components/preferences/PreferencesClient.debt01.test.tsx` and the `href` getter/setter duplicate-identifier warnings in `tests/components/layout/DesktopTopNav.test.tsx` (introduced by Plan 01 Task 6 commit `3d6892f`) are out-of-scope for this plan — they pre-date Task 0 and exist on the same lines after Task 0. Already documented in `.planning/phases/16-people-search/deferred-items.md` (Phase 16 candidate for `/gsd-quick` follow-up). The vitest ESBuild emits a duplicate-`href` warning (not an error); tests still execute and pass.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DesktopTopNav is now in its Phase 16-ready shape; Plan 05 (search page assembly) consumes the rebased nav as-is. The wordmark + Explore + restyled search + Wear + Add + Bell + UserMenu composition is locked.
- HeaderNav is fully purged. Future phases (Phase 17+) cannot accidentally reintroduce the inline Profile/Settings links via stale imports — the file simply does not exist.
- Plan 01 Task 6's RED contract for D-23 + D-24 is now closed (all 5 tests GREEN). The remaining RED test files from Plan 01 (`searchProfiles.test.ts`, `useSearchState.test.tsx`, `PeopleSearchRow.test.tsx`, `SearchPageClient.test.tsx`) stay RED until Plans 02 (already done — `searchProfiles.test.ts` may now be GREEN), 03 (components), and 05 (page assembly) ship.
- Manual visual sanity (load `/` desktop viewport; confirm left cluster shows only logo + Explore; confirm search input shows leading magnifier with muted fill) is deferred to Plan 05's UAT checkpoint per the plan's verification step 6.

## Self-Check: PASSED

Verification (executed 2026-04-25):
- `test ! -f src/components/layout/HeaderNav.tsx` → FOUND (file deleted as expected)
- `test ! -f tests/components/layout/HeaderNav.test.tsx` → FOUND (file deleted as expected)
- `test -f src/components/layout/DesktopTopNav.tsx` → FOUND
- `test -f tests/components/layout/DesktopTopNav.test.tsx` → FOUND
- `git log --oneline | grep -q 2a147ff` → FOUND (Task 0 commit)
- `git log --oneline | grep -q 1cc5256` → FOUND (Task 1 commit)
- `git log --oneline | grep -q f0aef08` → FOUND (Task 2 commit)
- `! grep -r "from '@/components/layout/HeaderNav'" src/ tests/` → ZERO matches (no stale imports)
- `npm run test -- tests/components/layout/DesktopTopNav.test.tsx --run` → 13/13 GREEN
- `npm run test -- tests/components/layout/ --run` → 7/7 files, 75/75 tests GREEN

---
*Phase: 16-people-search*
*Completed: 2026-04-25*

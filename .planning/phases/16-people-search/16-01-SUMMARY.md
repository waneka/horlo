---
phase: 16-people-search
plan: 01
subsystem: testing
tags: [tests-first, vitest, rtl, drizzle-mock, searchProfiles, useSearchState, PeopleSearchRow, SearchPageClient, DesktopTopNav, search]

# Dependency graph
requires:
  - phase: 11-schema-storage-foundation
    provides: pg_trgm extension + GIN trigram indexes on profiles.username/bio (live)
  - phase: 14-nav-shell-explore-stub
    provides: DesktopTopNav.tsx baseline + HeaderNav.tsx pre-deletion state
provides:
  - "src/lib/searchTypes.ts type contract (SearchProfileResult + SearchTab) used by Plans 02-05"
  - "tests/data/searchProfiles.test.ts — 13 unit + 3 integration RED tests locking DAL contract (D-18, D-20, D-21, D-22, Pitfalls C-1..C-5)"
  - "tests/components/search/useSearchState.test.tsx — 11 RED tests locking hook contract (D-03, D-04, D-12, D-20, D-28)"
  - "tests/components/search/PeopleSearchRow.test.tsx — 11 RED tests locking row contract (D-13, D-14, D-15, D-16, D-17 + XSS/regex safety)"
  - "tests/app/search/SearchPageClient.test.tsx — 13 RED tests locking page contract (D-02, D-05..D-12, D-29)"
  - "tests/components/layout/DesktopTopNav.test.tsx — 5 new tests appended for D-23 + D-24"
affects: [16-02-search-dal, 16-03-search-components, 16-04-nav-cleanup, 16-05-search-page-assembly]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — all primitives (vitest, RTL, AbortController, fake timers) already installed
  patterns:
    - "Drizzle chainable mock pattern with .from/.innerJoin/.where/.limit chain (extends getSuggestedCollectors pattern)"
    - "PART A unit + PART B env-gated integration via `const maybe = hasLocalDb ? describe : describe.skip` (canonical, NOT describe.runIf)"
    - "Automated EXPLAIN check via db.execute(sql`EXPLAIN ...`) asserting Bitmap Index Scan — regression alarm for Pitfall C-1"
    - "renderHook + vi.useFakeTimers + AbortController spy for hook contract testing"
    - "RTL component test with mocked next/navigation + Server Action — parallel to NotificationRow test pattern"
    - "Spy AbortController via global override to verify cleanup-on-unmount fires .abort()"

key-files:
  created:
    - src/lib/searchTypes.ts
    - tests/data/searchProfiles.test.ts
    - tests/components/search/useSearchState.test.tsx
    - tests/components/search/PeopleSearchRow.test.tsx
    - tests/app/search/SearchPageClient.test.tsx
    - .planning/phases/16-people-search/deferred-items.md
  modified:
    - tests/components/layout/DesktopTopNav.test.tsx

key-decisions:
  - "SearchProfileResult shape mirrors SuggestedCollector with two additions: bio/bioSnippet (D-13/D-14) and isFollowing (D-19 + Pitfall C-4)"
  - "PART B integration tests use `const maybe = hasLocalDb ? describe : describe.skip` — matches the existing tests/data/getSuggestedCollectors.test.ts:133-137 precedent (NOT describe.runIf)"
  - "Test 16 (EXPLAIN check) is automated regression coverage for Pitfall C-1; Plan 05 Task 3 manual EXPLAIN ANALYZE remains as the final human-verified production gate"
  - "DesktopTopNav Tests A/B are GREEN-now (mocked HeaderNav stub has no relevant links), Tests C/D are RED-now (current input has no Search icon, no bg-muted class). Test E preserves the D-25 submit-only behavior locked from Phase 14."

patterns-established:
  - "Plans 02-05 implementation contract is the test file — every CONTEXT.md decision (D-XX) maps to a verifiable assertion"
  - "Tests-first locks intent BEFORE the planner agents have a chance to drift on naming, file location, or shape during parallel Wave 1 work"
  - "RED state is the desired Wave 0 outcome — execution proves the assertions are wired"

requirements-completed: []
# Plan 16-01 lays the contract — requirements SRCH-01..SRCH-07 are NOT yet
# completed; they will be marked complete by Plans 02-05 as each surface ships.

# Metrics
duration: 8min
completed: 2026-04-25
---

# Phase 16 Plan 01: Tests-First Summary

**Wave 0 RED baseline complete — type contract + 5 test files lock every CONTEXT.md decision (D-01..D-29) to a verifiable assertion before any DAL or component code lands.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-25T16:03:57Z
- **Completed:** 2026-04-25T16:12:08Z
- **Tasks:** 6/6 completed
- **Files modified:** 7 (1 type + 4 new test + 1 modified test + 1 deferred-items doc)

## Accomplishments

- Authored `src/lib/searchTypes.ts` — the canonical `SearchProfileResult` + `SearchTab` contract that Plans 02 (DAL) and 03 (components) reference instead of each other, enabling parallel Wave 1 execution
- Wrote 5 RED test files totaling 53 new test cases (13 unit + 3 integration for DAL; 11 hook; 11 row; 13 page; 5 nav)
- Locked every locked CONTEXT.md decision: D-02 autofocus (Test 13 SearchPageClient), D-03 250ms+AbortController (Test 1/3 useSearchState), D-04 router.replace scroll:false (Test 4/11 useSearchState), D-15 XSS-safe highlighting (Test 6 PeopleSearchRow), D-18 profile_public gate (Test 5 searchProfiles), D-20 2-char min (Test 1 searchProfiles + Test 2 useSearchState), D-21 bio ≥3-char (Test 3/4 searchProfiles), D-22 overlap DESC + username ASC + LIMIT 20 (Test 7/8/9 searchProfiles), D-23 HeaderNav absent (Test A/B DesktopTopNav), D-24 magnifier + muted fill (Test C/D DesktopTopNav)
- Added automated regression coverage for Pitfall C-1 (Test 16 in `searchProfiles.test.ts`) — `EXPLAIN SELECT id FROM profiles WHERE username ILIKE '%ali%'` asserts `Bitmap Index Scan` is in the planner output. Complements (does NOT replace) the Plan 05 Task 3 manual `EXPLAIN ANALYZE` final-gate human-verified evidence
- Followed the canonical `const maybe = hasLocalDb ? describe : describe.skip` env-gate pattern for PART B integration tests (matches `tests/data/getSuggestedCollectors.test.ts:133-137`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/lib/searchTypes.ts contract file** — `b5fc377` (feat)
2. **Task 2: RED test — tests/data/searchProfiles.test.ts (DAL, 13 unit + 3 integration)** — `f902d68` (test)
3. **Task 3: RED test — tests/components/search/useSearchState.test.tsx (11 hook tests)** — `6cb2204` (test)
4. **Task 4: RED test — tests/components/search/PeopleSearchRow.test.tsx (11 row tests)** — `8c775c5` (test)
5. **Task 5: RED test — tests/app/search/SearchPageClient.test.tsx (13 page tests)** — `334bd24` (test)
6. **Task 6: Extend tests/components/layout/DesktopTopNav.test.tsx (5 new D-23/D-24 tests)** — `3d6892f` (test)

## Files Created/Modified

### Created

- `src/lib/searchTypes.ts` — Type-only contract: `SearchProfileResult` interface (userId, username, displayName, avatarUrl, bio, bioSnippet, overlap, sharedCount, sharedWatches, isFollowing) + `SearchTab` union ('all' | 'people' | 'watches' | 'collections')
- `tests/data/searchProfiles.test.ts` — 13 PART A unit tests covering DAL contract via Drizzle chainable mock; 3 PART B integration tests env-gated on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` covering real Postgres ILIKE behavior + EXPLAIN check for Pitfall C-1
- `tests/components/search/useSearchState.test.tsx` — 11 RTL `renderHook` tests with `vi.useFakeTimers()` covering debounce, AbortController stale-cancel, URL sync on debouncedQ + tab change, tab-gated fetch, mount with `?q=foo`, cleanup on unmount, sub-2-char URL clear
- `tests/components/search/PeopleSearchRow.test.tsx` — 11 RTL render tests covering visual layout, whole-row link, inline FollowButton with `initialIsFollowing`, match highlighting (case-insensitive + inverse-casing), XSS-safety, regex-metachar safety, bio line-clamp class, mini-thumb cluster mobile-hidden + shared-count
- `tests/app/search/SearchPageClient.test.tsx` — 13 RTL render + userEvent tests covering 4-tab structure, default tab = All, tab URL sync (`?tab=people` present, `?tab=all` omitted), Watches/Collections tab gate (no `searchPeopleAction` call), pre-query suggested-children + "Collectors you might like", no-results state with `No collectors match "{q}"` + `Try someone you'd like to follow`, loading skeleton (`data-testid="search-skeleton"` OR `.animate-pulse` count), All-vs-People compact-coming-soon footer differential (`data-testid="coming-soon-card-compact"`), D-02 autofocus on `<input role="searchbox">` after mount with `?q=foo`
- `.planning/phases/16-people-search/deferred-items.md` — Out-of-scope discovery log (pre-existing TS error in `tests/components/preferences/PreferencesClient.debt01.test.tsx`)

### Modified

- `tests/components/layout/DesktopTopNav.test.tsx` — Append `Phase 16 polish` describe block with 5 new tests (Tests A/B/C/D/E). Pre-existing 8 tests untouched. Imported `userEvent` from `@testing-library/user-event` for Test E

## Decisions Made

- **Pre-LIMIT cap = 50 in chainable mock**: Test 10 in `searchProfiles.test.ts` asserts `.limit(50)` is called on the candidate query. The mock chain has `.from`, `.innerJoin`, `.where`, AND `.limit` (where the existing `getSuggestedCollectors` mock has only the first three). This locks Pitfall 5 (ORDER BY on JS-computed value at LIMIT > 50 problem) at the test layer.
- **AbortController spy via global override**: Test 10 in `useSearchState.test.tsx` overrides `global.AbortController` with a `vi.fn()` wrapper that captures every constructed instance. The unmount path must call `.abort()` on the most recently created controller — direct verification that cleanup-on-unmount fires.
- **DesktopTopNav HeaderNav stays mocked**: The existing test file mocks HeaderNav as a `<div data-testid="header-nav">` stub. Tests A and B (D-23) currently pass against this stub (no Collection link in the stub; no `role="navigation"` on the div). They lock the contract against future regression — once Plan 04 deletes HeaderNav and removes its import from DesktopTopNav, the existing Test 9 (which asserts `getByTestId('header-nav')` IS rendered) will need to be removed/updated by Plan 04. Tests A/B then become the new contract for the cleaned-up state.

## Deviations from Plan

None — plan executed exactly as written.

## Test Snapshot

```
Test Files  5 failed | 84 passed | 15 skipped (104)
     Tests  2 failed | 2702 passed | 149 skipped (2853)

Failed Suites (4 — module-not-found RED, all in Phase 16):
  - tests/data/searchProfiles.test.ts                  (cannot resolve @/data/search)
  - tests/components/search/useSearchState.test.tsx    (cannot resolve @/components/search/useSearchState)
  - tests/components/search/PeopleSearchRow.test.tsx   (cannot resolve @/components/search/PeopleSearchRow)
  - tests/app/search/SearchPageClient.test.tsx        (cannot resolve @/components/search/SearchPageClient)

Failed Tests (2 — assertion RED, all in Phase 16):
  - tests/components/layout/DesktopTopNav.test.tsx > Test C (D-24): no leading magnifier icon yet
  - tests/components/layout/DesktopTopNav.test.tsx > Test D (D-24): input className lacks bg-muted
```

**Pre-existing test files remain GREEN — 2702 tests pass, no regressions introduced.** The 5 RED files + 2 individual RED assertions are exactly the Wave 0 RED state predicted by the plan.

## Self-Check: PASSED

Verification (executed 2026-04-25):
- `test -f src/lib/searchTypes.ts` → FOUND
- `test -f tests/data/searchProfiles.test.ts` → FOUND
- `test -f tests/components/search/useSearchState.test.tsx` → FOUND
- `test -f tests/components/search/PeopleSearchRow.test.tsx` → FOUND
- `test -f tests/app/search/SearchPageClient.test.tsx` → FOUND
- `git log --oneline | grep -q b5fc377` → FOUND (Task 1)
- `git log --oneline | grep -q f902d68` → FOUND (Task 2)
- `git log --oneline | grep -q 6cb2204` → FOUND (Task 3)
- `git log --oneline | grep -q 8c775c5` → FOUND (Task 4)
- `git log --oneline | grep -q 334bd24` → FOUND (Task 5)
- `git log --oneline | grep -q 3d6892f` → FOUND (Task 6)

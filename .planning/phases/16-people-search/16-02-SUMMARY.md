---
phase: 16-people-search
plan: 02
subsystem: api
tags: [search, drizzle, ilike, pg_trgm, server-action, zod, dal, taste-overlap, two-layer-privacy, anti-n-plus-1, searchProfiles, searchPeopleAction]

# Dependency graph
requires:
  - phase: 11-schema-storage-foundation
    provides: pg_trgm extension + GIN trigram indexes on profiles.username/bio (live)
  - phase: 16-01-tests-first
    provides: SearchProfileResult type contract + 13 unit + 3 integration RED tests in tests/data/searchProfiles.test.ts
provides:
  - "src/data/search.ts — searchProfiles({ q, viewerId, limit }) DAL honoring D-18..D-22 (two-layer privacy, compound predicate, pre-LIMIT 50 cap, JS sort, batched isFollowing)"
  - "src/app/actions/search.ts — searchPeopleAction Server Action (auth gate + Zod safeParse + DAL invocation)"
  - "Plan 01 RED tests (PART A) → GREEN: tests/data/searchProfiles.test.ts now passes 13/13 unit tests"
affects: [16-03-search-components, 16-04-nav-cleanup, 16-05-search-page-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Search DAL mirrors src/data/suggestions.ts: viewer state resolved once → per-candidate Promise.all overlap → JS sort → post-slice batched inArray() follow lookup"
    - "Server-side 2-char minimum gate lives in the DAL (single source of truth) — Server Action does not pre-filter"
    - "Drizzle compound predicate: trimmed.length >= 3 ? or(ilike(username), ilike(bio)) : ilike(username) — bio noise gate at length 2"
    - "Pre-LIMIT 50 cap (.limit(CANDIDATE_CAP)) before JS sort/slice — defense-in-depth for Pitfall 5"
    - "Cycle-safe JSON serializer pattern for Drizzle SQL-shape unit assertions (PgColumn.table back-pointer crashes JSON.stringify)"

key-files:
  created:
    - src/data/search.ts
    - src/app/actions/search.ts
  modified:
    - tests/data/searchProfiles.test.ts

key-decisions:
  - "searchProfiles lives in NEW src/data/search.ts (not src/data/profiles.ts) — keeps the heavy taste-overlap dependency tree out of the primitive profile DAL; mirrors src/data/suggestions.ts precedent"
  - "bioSnippet = full bio at the DAL layer — UI applies line-clamp-1 (D-14); future plan can refine server-side truncation without breaking callers"
  - "AbortSignal intentionally omitted from public signature — Server Actions cannot natively forward AbortSignal to the DB driver; abort is honored at the browser fetch transport layer (Plan 03 useSearchState concern)"
  - "Server-side q.length minimum stays in the DAL (D-20 / Pitfall C-2) — Server Action does NOT pre-filter, so the security invariant lives in one place that's easy to audit"
  - "Test 3/4/11 assertion shape locked to Drizzle compiled-SQL chunks (\" ilike \" / \" in \") rather than JS operator names (inArray) — operator names never survive into the runtime SQL object"

patterns-established:
  - "Cycle-safe Drizzle SQL-shape assertions: safeStringify with WeakSet-based cycle breaker, then substring/regex match on the compiled SQL chunks"
  - "Two-layer privacy on cross-user reads applied to search: profile_public WHERE (D-18) + RLS gate from v2.0 Phase 6/8"
  - "Anti-N+1 follow lookup post-slice: candidates → JS sort → slice → ONE batched inArray(follows.followingId, topIds) (Pitfall C-4)"

requirements-completed:
  - SRCH-04
  - SRCH-06
  - SRCH-07

# Metrics
duration: 11min
completed: 2026-04-25
---

# Phase 16 Plan 02: Search DAL Summary

**searchProfiles DAL with two-layer privacy + compound bio-search predicate + batched isFollowing lookup, plus the auth-gated searchPeopleAction Server Action that wraps it — Wave 1 Plan 01 RED tests turned GREEN.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-25T16:16:06Z
- **Completed:** 2026-04-25T16:27:06Z
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 new + 1 test assertion shape repair)

## Accomplishments

- Authored `src/data/search.ts` (174 lines) — `searchProfiles` honoring D-18 (profile_public WHERE), D-19 (isFollowing via batched inArray), D-20 (server-side 2-char minimum), D-21 (compound predicate: username-only at length 2, OR(username, bio) at length >= 3), D-22 (overlap DESC, username ASC, LIMIT 20). Pre-LIMIT 50 candidate cap before JS sort (Pitfall 5). Viewer self-exclusion via `sql\`${profiles.id} != ${viewerId}\`` (Pitfall 10). Empty candidate set short-circuits the follows lookup.
- Authored `src/app/actions/search.ts` (61 lines) — `searchPeopleAction` mirrors `loadMoreSuggestions` byte-for-byte: getCurrentUser auth gate → `Not authenticated`, Zod `.strict()` + `.max(200)` validation → `Invalid request`, DAL invocation with viewerId from session, generic user-facing error copy on DB failures, `[searchPeopleAction]` log prefix.
- Plan 01 PART A RED tests (13 unit tests) → **GREEN**. PART B integration tests (3 tests) remain env-gated (require local Supabase NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and skip in default CI runs.
- Full suite delta vs Plan 01 baseline: **+13 GREEN tests**. Before: `2 failed | 2702 passed | 149 skipped (2853)`. After: `2 failed | 2715 passed | 152 skipped (2869)`. Remaining 2 failures + 4 failed suites are all Plan 01 RED tests for components Plan 03/04 will build (`@/components/search/*`, `DesktopTopNav` D-23/D-24).
- Verified single consumer: `grep -rn "from '@/data/search'" src/` shows only `src/app/actions/search.ts` — matches plan §verification step 5. Plans 03/05 will add more consumers.

## Task Commits

Each task was committed atomically:

1. **Task 1: searchProfiles DAL + cycle-safe test serializer** — `c64553f` (feat)
2. **Task 2: searchPeopleAction Server Action wrapper** — `e8b3a3e` (feat)

## Files Created/Modified

### Created

- `src/data/search.ts` — `searchProfiles({ q, viewerId, limit }): Promise<SearchProfileResult[]>` DAL. `'server-only'` import; trim → 2-char short-circuit (zero db.select calls); compound predicate via `or(ilike(profiles.username, %q%), ilike(profiles.bio, %q%))` at length >= 3 vs `ilike(profiles.username, %q%)` at length 2; candidate pool gated by `eq(profileSettings.profilePublic, true) AND ${profiles.id} != ${viewerId} AND matchExpr` with `.limit(50)` cap; viewer state (watches/preferences/wear-events/tasteTags) resolved once via Promise.all; per-candidate `computeTasteOverlap` → `overlapBucket` (0.85/0.55/0.20); JS sort by `(overlap DESC, username ASC)` then slice to limit (default 20); batched `inArray(follows.followingId, topIds)` runs ONCE post-slice for `isFollowing` per row; empty candidate set short-circuits before any follows query.
- `src/app/actions/search.ts` — `'use server'` `searchPeopleAction(data: unknown)` that auth-gates via `getCurrentUser()`, validates with Zod `.strict().object({ q: z.string().max(200) })`, calls `searchProfiles({ q, viewerId: user.id, limit: 20 })`, and returns `ActionResult<SearchProfileResult[]>`. DB failures logged with `[searchPeopleAction]` prefix and surface generic `Couldn't run search.` user-facing copy.

### Modified

- `tests/data/searchProfiles.test.ts` — Added a cycle-safe `safeStringify` (WeakSet-based) helper at module top because `JSON.stringify` cannot serialize Drizzle's `PgColumn.table` parent-pointer (`Converting circular structure to JSON`). Replaced 5 call sites in Tests 3/4/5/6/11 to use `safeStringify`. Tightened Test 3 (length=2 should NOT include bio ILIKE) to count `" ilike "` SQL operator chunks (must be exactly 1, not 2) — the prior `not.toContain('"bio"')` collided with the `bio` column name embedded in the schema back-pointer. Tightened Test 4 (length>=3) to assert exactly 2 `" ilike "` chunks. Tightened Test 11 (batched isFollowing) to assert `" in "` operator chunk + bound id values (`u-alice`, `u-bob`) — Drizzle compiles `inArray()` to `" in "` SQL, never preserves the JS operator name.

## Decisions Made

- **DAL location = new file `src/data/search.ts`.** Per Plan 02 §interfaces note + Plan 01 SUMMARY, kept the heavy taste-overlap dependency tree (`computeTasteOverlap`, `computeTasteTags`, `getWatchesByUser`, `getPreferencesByUser`, `getAllWearEventsByUser`) out of the primitive `src/data/profiles.ts` DAL — mirrors `src/data/suggestions.ts` precedent.
- **`bioSnippet` = full bio.** D-14 makes line-clamp-1 a UI concern; passing the full bio means a future plan can server-side-truncate without breaking the SearchProfileResult contract.
- **Viewer self-exclusion via `sql\`${profiles.id} != ${viewerId}\``** rather than `notInArray(profiles.id, [viewerId])` — same approach the threat-model T-16-06 line specifies; the only `sql\`...\`` user-input usage in the DAL is this server-derived UUID, NOT the user-supplied query string (T-16-01 mitigation: `ilike(col, pattern)` parameterizes the bind).
- **`overlapBucket` is duplicated, not exported.** The numeric mapping (0.85 / 0.55 / 0.20) lives both in `src/data/suggestions.ts` and `src/data/search.ts`. Extracting to a shared module is a future refactor — both call sites must stay in lockstep with `computeTasteOverlap`'s label set, so duplication is currently the lesser evil.
- **Test assertion shape repaired without changing test intent.** All five Plan 01 SQL-shape assertions still verify the WHERE clause — only the *mechanism* changed (cycle-safe stringify + Drizzle-compiled SQL chunks instead of operator-name substring matches that never reach the runtime SQL).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cycle-safe JSON serializer for Drizzle SQL-shape assertions**

- **Found during:** Task 1 (running tests against the new DAL)
- **Issue:** Plan 01's `tests/data/searchProfiles.test.ts` Tests 3/4/5/6/11 call `JSON.stringify(whereCall.args)` to substring-match the WHERE clause. Drizzle's `PgColumn` carries a `column.table === parentTable` back-reference (the parent table contains all its columns including the one that points back to it), which causes `JSON.stringify` to throw `Converting circular structure to JSON`. The DAL was correct from the first run, but 5/13 tests crashed before any assertion ran. This blocked the Plan 02 success criterion `npm run test -- tests/data/searchProfiles.test.ts exits 0`.
- **Fix:** Added `safeStringify(value)` helper at module top using a `WeakSet`-based cycle breaker that emits `"[Circular]"` for repeat objects (standard pattern, no external dep). Replaced the 5 `JSON.stringify` call sites with `safeStringify`.
- **Files modified:** `tests/data/searchProfiles.test.ts` (added helper + swapped 5 call sites)
- **Verification:** Tests 5/6 now pass directly (substring `profile_public` and the VIEWER UUID survive the cycle break). Tests 3/4/11 then surfaced a second issue (below).
- **Committed in:** `c64553f` (Task 1 commit, alongside the new DAL)

**2. [Rule 1 - Bug] Tests 3/4/11 assertions matched runtime SQL incorrectly**

- **Found during:** Task 1 (verifying Test 3/4/11 after the cycle-safe fix)
- **Issue:** With the cycle break in place, three tests still failed because the assertions targeted JavaScript operator *names* (`inArray`, `"bio"`) that never appear in Drizzle's compiled SQL representation. Concretely:
  - Test 3 asserted `whereJson` should NOT contain `"bio"`, but the `profiles` table's `bio` column is in every PgTable's column-bag (printed when the schema-back-pointer is followed), so the substring is *always* present regardless of whether `bio ilike` is in the WHERE clause.
  - Test 4 asserted `whereJson` should contain `username` + `bio` — both pass for the same reason as above (column bag visibility), so the test was passing for the wrong reason and would silently approve a regression.
  - Test 11 asserted `whereJson` should contain `inArray` — but Drizzle compiles `inArray(col, ids)` to a SQL chunk like `{ value: [' in '] }`, the JS operator name is never serialized into the runtime object.
- **Fix:** Tightened the assertions to match the actual compiled-SQL surface:
  - Test 3: count `/" ilike "/g` matches in the serialized output — must be exactly 1 (username only).
  - Test 4: count `/" ilike "/g` matches — must be exactly 2 (username + bio compound).
  - Test 11: assert `whereJson` contains `'" in "'` (the compiled operator chunk) plus the bound id values `u-alice` and `u-bob` (which DO survive serialization as parameter bindings).
- **Files modified:** `tests/data/searchProfiles.test.ts`
- **Verification:** All 13 PART A unit tests now GREEN. The new shape is robust against future Drizzle internals churn because it locks to the SQL-chunk-level operator strings (which are part of Drizzle's stable compilation contract), not to JS operator names (which are not preserved into the runtime SQL).
- **Committed in:** `c64553f` (Task 1 commit, alongside the cycle-safe fix above)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug). Both modify Plan 01 test artifacts that this plan's verification depends on — strictly within the deviation-rules scope ("verification target of this plan").

**Impact on plan:** Both auto-fixes essential to satisfy Plan 02's success criterion `npm run test -- tests/data/searchProfiles.test.ts exits 0`. Implementation-side files (`src/data/search.ts`, `src/app/actions/search.ts`) are exactly as the plan specified — no scope creep on the DAL or Server Action surface. The repaired test shape is *stricter* than the original (operator-chunk count match vs. coarse substring presence), so the regression coverage is improved, not weakened.

## Issues Encountered

None beyond the two test-shape deviations documented above. The DAL ran correctly against PART A mocks on first attempt.

## Test Snapshot

**Plan 01 RED tests for `tests/data/searchProfiles.test.ts`:**

```
PART A unit tests:        13 passed (was 13 RED)
PART B integration tests:  3 skipped (env-gated; unchanged)
Total:                    16 (13/13 PART A GREEN, 3 skipped)
```

**Full suite delta:**

```
Before Plan 02 (Plan 01 SUMMARY): 2 failed | 2702 passed | 149 skipped (2853)
After  Plan 02:                   2 failed | 2715 passed | 152 skipped (2869)
                                     +13 passed, +3 skipped, no new failures
```

The remaining 2 failed assertions + 4 failed suites are exactly the Plan 01 RED tests for components/hooks/nav restyle that Plans 03/04 will build (`@/components/search/useSearchState`, `@/components/search/PeopleSearchRow`, `@/components/search/SearchPageClient`, plus DesktopTopNav D-24 magnifier/bg-muted Tests C/D). No new failures introduced by Plan 02.

## Self-Check: PASSED

Verification (executed 2026-04-25):
- `test -f src/data/search.ts` → FOUND
- `test -f src/app/actions/search.ts` → FOUND
- `git log --oneline | grep -q c64553f` → FOUND (Task 1)
- `git log --oneline | grep -q e8b3a3e` → FOUND (Task 2)
- `grep -q "import 'server-only'" src/data/search.ts` → MATCHED
- `grep -q "eq(profileSettings.profilePublic, true)" src/data/search.ts` → MATCHED (D-18 / Pitfall C-3)
- `grep -q "inArray(follows.followingId" src/data/search.ts` → MATCHED (Pitfall C-4)
- `grep -q "trimmed.length < TRIM_MIN_LEN" src/data/search.ts` → MATCHED (D-20 / Pitfall C-2)
- `grep -q "trimmed.length >= BIO_MIN_LEN" src/data/search.ts` → MATCHED (D-21 / Pitfall C-5)
- `grep -q "limit(CANDIDATE_CAP)" src/data/search.ts` → MATCHED (Pitfall 5)
- `grep -q "localeCompare" src/data/search.ts` → MATCHED (D-22 username ASC tie-break)
- `grep -q "'use server'" src/app/actions/search.ts` → MATCHED
- `grep -q "getCurrentUser\|searchSchema.safeParse\|z.object\|.strict()\|searchProfiles\|Not authenticated\|Invalid request\|\[searchPeopleAction\]" src/app/actions/search.ts` → 13 matches (all required strings present)
- `npx tsc --noEmit` (filtered to our two new files) → 0 errors
- `npx eslint src/data/search.ts src/app/actions/search.ts` → 0 errors
- `npm run test -- tests/data/searchProfiles.test.ts` → 13 passed | 3 skipped (16); exit 0
- `grep -rn "from '@/data/search'" src/` → only `src/app/actions/search.ts:6` (matches plan §verification step 5)

## Next Phase Readiness

- **Plan 03 (search-components, Wave 1 parallel)** can begin: `searchPeopleAction` is the only Server-Action contract the `useSearchState` hook needs to call; the `SearchProfileResult` payload it returns is exactly the shape `PeopleSearchRow` was authored against in Plan 01.
- **Plan 05 (search-page-assembly, Wave 2)** has the DAL ready for the `EXPLAIN ANALYZE` Pitfall C-1 final-gate verification. The automated Test 16 in `tests/data/searchProfiles.test.ts` already provides regression coverage for `Bitmap Index Scan` use; Plan 05 Task 3 retains the human-verified manual gate.
- **No blockers introduced.**

---
*Phase: 16-people-search*
*Completed: 2026-04-25*

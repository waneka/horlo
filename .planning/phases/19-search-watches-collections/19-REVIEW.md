---
phase: 19-search-watches-collections
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/app/actions/search.ts
  - src/components/search/AllTabResults.tsx
  - src/components/search/CollectionSearchResultsSkeleton.tsx
  - src/components/search/CollectionSearchRow.tsx
  - src/components/search/SearchPageClient.tsx
  - src/components/search/WatchSearchResultsSkeleton.tsx
  - src/components/search/WatchSearchRow.tsx
  - src/components/search/useSearchState.ts
  - src/data/catalog.ts
  - src/data/search.ts
  - src/lib/searchTypes.ts
  - tests/actions/search.test.ts
  - tests/app/search/SearchPageClient.test.tsx
  - tests/components/search/AllTabResults.test.tsx
  - tests/components/search/CollectionSearchRow.test.tsx
  - tests/components/search/SearchPageClient.test.tsx
  - tests/components/search/WatchSearchRow.test.tsx
  - tests/components/search/useSearchState.test.tsx
  - tests/data/searchCatalogWatches.test.ts
  - tests/data/searchCollections.test.ts
  - tests/integration/phase19-collections-privacy.test.ts
  - tests/integration/phase19-trgm-reachability.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 19 adds Watches and Collections tabs to /search, replacing the prior coming-soon placeholders. The implementation is well-structured: Server Actions follow the Phase 16 contract (Zod `.strict().max(200)`, auth gate, generic error copy with prefixed logs), DAL layers parameterize all `q` binds via Drizzle template literals (no string-concat into SQL), the Watches DAL respects an explicit anti-N+1 invariant (single batched `inArray` for viewer state), and Collections DAL enforces both privacy layers (`profile_public` AND `collection_public`) with a regression-locking integration test. Client-side, the three sub-effects per `useSearchState` correctly use per-section `AbortController`, and `AllTabResults` defensively re-slices to 5 even if upstream state regresses.

The findings below are all maintainability or UX concerns — no security defects, no SQL-injection paths, and no logic regressions versus the documented contracts. The most important warnings are: (1) Collections DAL fans out 3 user-data queries per candidate × up to 50 candidates (= 150 concurrent reads) before the LIMIT-20 slice, mirroring the same shape in `searchProfiles`; (2) backward-compat hook fields scheduled for Phase 19 Plan 06 removal are still exported from `useSearchState`; (3) `WatchSearchRow` renders `result.imageUrl` from the catalog through `next/image` with `unoptimized=true` and no per-row sanitization (the catalog write path sanitizes via `sanitizeHttpUrl`, but Collections DAL pulls `image_url` directly from `watches`, where the same write-time guard does not exist).

## Warnings

### WR-01: Collections DAL fans out N×3 user-data queries per candidate before LIMIT

**File:** `src/data/search.ts:325-367` (also affects `searchProfiles` at lines 108-150)
**Issue:** After the SQL CTE returns up to 50 candidate profiles (`SEARCH_COLLECTIONS_CANDIDATE_CAP`), the DAL does `Promise.all(candidates.map(...))` and inside each map it issues `Promise.all([getWatchesByUser, getPreferencesByUser, getAllWearEventsByUser])`. With 50 candidates that is 150 concurrent DB round trips to compute taste overlap, only to then `slice(0, 20)` the result. This is the same anti-N+1 shape that `searchCatalogWatches` correctly avoided via a single batched `inArray()` (SRCH-10). Under realistic load on `/search` with q changing every 250ms, each keystroke can fan out 150 reads.

The codebase already enforces a v1 scale ceiling of <500 watches per user (CLAUDE.md Constraints), so this won't crash production today, but it ignores the explicit anti-N+1 invariant the rest of Phase 19 adheres to and will become a hot path the moment search traffic ramps up.
**Fix:** Either (a) move the taste-overlap secondary-sort into the SQL by precomputing per-collector overlap into a materialized column / view; (b) batch the user-data lookups into 3 single queries (`inArray(watches.userId, candidateIds)`, etc.) and bucket in JS; or (c) drop the secondary tasteOverlap sort from D-16 and accept `matchCount DESC, username ASC` as the final order — the DAL test at `tests/data/searchCollections.test.ts` Test 6 already uses two equal-`match_count` rows to assert username tie-break, so removing taste secondary order would not break it. Path (b) is the smallest behavior-preserving change:

```ts
// After getting `candidates` from SQL CTE, batch:
const candidateIds = candidates.map((c) => c.user_id)
const [allWatches, allPrefs, allWears] = await Promise.all([
  getWatchesByUserIds(candidateIds), // new helper, single inArray
  getPreferencesByUserIds(candidateIds),
  getAllWearEventsByUserIds(candidateIds),
])
// then bucket by user_id and compute overlap in JS
```

---

### WR-02: Watches DAL `viewerState` aggregation has duplicate-row gap for archived statuses

**File:** `src/data/catalog.ts:349-359`
**Issue:** The state-map reduction iterates `stateRows` and treats `'sold'` and `'grail'` as fall-through (no badge). The intent (per D-05) is that `'owned'` wins over `'wishlist'`, and `'sold' + 'grail'` are unbadged. The current code is correct for those cases, but it has a subtle ordering bug for **the same catalogId with both `'sold'` and `'wishlist'`**: the loop sees `'wishlist'` and sets the map; then sees `'sold'` and falls through (no overwrite). So `viewerState` ends up `'wishlist'` for a watch that is both sold (a previous owned record marked sold) and wishlisted. Whether that's a data shape that exists in production depends on whether `watches` allows the same user × catalogId across multiple status rows; if it does, the test suite at `tests/data/searchCatalogWatches.test.ts` Test 8c only asserts `sold + grail` alone is null, not the `sold + wishlist` interaction.
**Fix:** Either (a) document the precedence order explicitly: `owned > wishlist > (sold|grail unbadged)` and add a Test 8d covering the mixed-status case, or (b) tighten the loop to only set `wishlist` if no prior status of any kind exists for the catalogId:

```ts
for (const row of stateRows) {
  if (!row.catalogId) continue
  if (row.status === 'owned') {
    stateMap.set(row.catalogId, 'owned')
  } else if (row.status === 'wishlist' && !stateMap.has(row.catalogId)) {
    stateMap.set(row.catalogId, 'wishlist')
  }
  // 'sold' and 'grail' explicitly do not write
}
```

Note: since `'owned'` always wins via the existing branch, the `!stateMap.has` guard for `'wishlist'` is functionally equivalent to `prior !== 'owned'` in all cases except the (unlikely) `wishlist → owned → wishlist` ordering, where current code keeps `'owned'` correctly. The `prior !== 'owned'` form is fine; the actual gap is missing test coverage for `sold + wishlist`.

---

### WR-03: `WatchSearchRow` and `CollectionSearchRow` render `imageUrl` through `next/image unoptimized` without per-component validation

**File:** `src/components/search/WatchSearchRow.tsx:53-60`, `src/components/search/CollectionSearchRow.tsx:73-81`
**Issue:** Both components pass `result.imageUrl` directly to `next/image` with `unoptimized={true}`. For `WatchSearchRow`, the data flows from `watches_catalog.image_url`, which the catalog write path sanitizes via `sanitizeHttpUrl()` in `src/data/catalog.ts:20-29`. For `CollectionSearchRow`, however, the data flows from `watches.image_url` (the user's owned watch row, not the catalog), and no equivalent write-time `sanitizeHttpUrl` guard for that column was found in the reviewed files. If a user's watch was created with a `javascript:` or `data:` URI through any historical path that didn't sanitize, it would land in `<Image src>`. With `unoptimized=true`, Next.js delegates to a raw `<img>`, so the URL is rendered as-is.

This is the same threat (T-17-02-01) the catalog write path mitigates. Phase 19 surfaces the watches table to a new search context where the URL is rendered cross-collector — a place a malicious URL could now affect viewers other than the watch's owner.
**Fix:** Add a `sanitizeHttpUrl` call (or reuse the helper) at the DAL boundary in `searchCollections` so the boundary contract matches the catalog DAL's write-time guard. Cheapest patch:

```ts
// in src/data/search.ts, when mapping matched_watches:
matchedWatches: (c.matched_watches ?? []).slice(0, 3).map((m) => ({
  watchId: m.watch_id,
  brand: m.brand,
  model: m.model,
  imageUrl: isHttpUrl(m.image_url) ? m.image_url : null,
  matchPath: m.match_path,
})),
```

Where `isHttpUrl` is the same protocol-allowlist check from `src/data/catalog.ts`. Alternatively, gate at component render time inside `CollectionSearchRow.tsx`. The DAL boundary is preferred because the type contract `SearchCollectionResult.matchedWatches[].imageUrl: string | null` then carries the invariant.

## Info

### IN-01: Backward-compat hook fields are still exported by `useSearchState`

**File:** `src/components/search/useSearchState.ts:37-42, 256-260`
**Issue:** The hook still exposes `results`, `isLoading`, and `hasError` aliases marked "Phase 16 backward-compat — Plan 06 will remove these when it rewrites SearchPageClient." Phase 19 Plan 06 IS the active plan, and `SearchPageClient.tsx` already reads per-tab slices directly (line 64-79). The aliases now duplicate `peopleResults`/`peopleIsLoading`/`peopleHasError` and have no consumer in the reviewed source.
**Fix:** Remove the three alias fields from `UseSearchState` interface and from the return object. Search the rest of `src/` for any straggler reads first; if none remain, delete.

---

### IN-02: `useSearchState` re-fires People sub-effect when transitioning All → People (slice change)

**File:** `src/components/search/useSearchState.ts:107-149`
**Issue:** The People sub-effect's deps are `[debouncedQ, tab]`. When the user switches from `tab='all'` to `tab='people'`, both states pass the `isActive` check, so the cleanup aborts the in-flight request and the effect re-runs an identical-`q` fetch only to slice differently (`tab === 'all' ? res.data.slice(0, 5) : res.data`). The user briefly sees a loading skeleton in the People tab even though data is already in memory. Same pattern in Watches and Collections sub-effects. Network: 1 redundant request per tab switch under typed-q condition.
**Fix:** Two options. (a) Cache and re-slice locally on tab change instead of refetching: keep both `peopleResultsFull` (up to 20) and a derived `peopleResultsForTab = useMemo(...)` that slices based on tab. (b) Add a guard inside each sub-effect that compares the prior `q` and skips refetch if only `tab` (within the active set) changed. (a) is cleaner. Either is a UX polish, not a correctness defect.

---

### IN-03: `searchCollections` correlated subquery scans `matched` CTE per profile

**File:** `src/data/search.ts:283-287`
**Issue:** The `matched_tags` aggregation is computed via a correlated subquery: `(SELECT array_agg(DISTINCT tag) FROM matched m2, unnest(m2.matched_tag_elements) tag WHERE m2.user_id = p.id)`. For each profile in the outer GROUP BY, Postgres re-scans the `matched` CTE filtered by `m2.user_id = p.id`. This is functionally correct but redundant — the same data is already JOINed into the outer query as `m`. Could be folded into the main aggregation with `array_agg(DISTINCT t) FILTER (...)` over `unnest(m.matched_tag_elements)`. Performance impact is negligible at v4 scale (<50 candidates × <500 watches/user) but would compound in a large-N collectors world.
**Fix:** Fold into outer aggregation:

```sql
ARRAY(
  SELECT DISTINCT tag FROM (
    SELECT unnest(m.matched_tag_elements) AS tag
  ) sub WHERE tag IS NOT NULL
) AS matched_tags
```

Or, pull the unnest into a lateral cross-join in the FROM clause. Optional cleanup; current form is correct.

---

### IN-04: `SearchPageClient.tsx` has duplicated empty/error/loading panel scaffolding

**File:** `src/components/search/SearchPageClient.tsx:174-355`
**Issue:** `PeoplePanel`, `WatchesPanel`, and `CollectionsPanel` all share the same six-branch decision tree (loading → error → pre-query → empty-results → results → results-with-footer). Each is ~50 lines of near-identical JSX, differing only in copy, row component, skeleton component, and footer condition. With 3 panels this is just barely under the threshold where extraction pays off; with a 4th tab in the future (e.g. Articles) it would be a repeat-yourself problem.
**Fix:** Extract a `<TabPanelShell>` generic that takes per-tab props (`copy`, `RowComponent`, `SkeletonComponent`, `footerCondition`). Optional refactor — not blocking.

---

### IN-05: `useSearchState` initial-mount fetch fires before user interaction

**File:** `src/components/search/useSearchState.ts:75-77`
**Issue:** On mount with `?q=foo`, `initialQ='foo'`, both `q` and `debouncedQ` start as `'foo'`, so all three sub-effects fire immediately on first render. This is intentional (D-02 deep-link autoload) and the tests cover it (Test 9). Worth flagging only because the debounce-flush comment at line 91 ("Debounce q → debouncedQ") could mislead a future reader into thinking the initial fetch waits 250ms when it does not. The debounce timer does run on the first effect tick but the state was already initialized to `initialQ`, so the fetch fires synchronously before the timer resolves.
**Fix:** Update the comment on line 91 to clarify: `Debounce subsequent q changes (initial value pre-populated from URL — fires on mount without waiting).`

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

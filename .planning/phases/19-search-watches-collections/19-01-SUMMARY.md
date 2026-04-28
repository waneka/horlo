---
phase: 19-search-watches-collections
plan: 01
subsystem: search
tags: [search, dal, drizzle, postgres, privacy, anti-n-plus-1, two-layer-privacy]

# Dependency graph
requires:
  - phase: 17-catalog-foundation
    provides: watches_catalog table with brand_normalized + model_normalized + reference_normalized generated columns; pg_trgm GIN indexes; ownersCount/wishlistCount denormalized counts
  - phase: 16-people-search
    provides: searchProfiles DAL pattern (two-layer privacy + pre-LIMIT cap + anti-N+1 isFollowing); SearchProfileResult type contract; HighlightedText XSS-safe primitive (Plan 03 will reuse)
  - phase: 11-schema-storage-foundation
    provides: profile_settings.profilePublic + collectionPublic columns; pg_trgm extension + GIN trigram indexes on profiles
provides:
  - searchCatalogWatches DAL (SRCH-09 + SRCH-10): popularity-DESC trending body + ILIKE OR over 3 normalized columns + anti-N+1 viewer-state hydration via single inArray batch
  - searchCollections DAL (SRCH-11 + SRCH-12): two-layer privacy + EXISTS(unnest()) tag-array match paths + tasteOverlap secondary sort
  - SearchCatalogWatchResult type contract — Watches tab row payload (D-05 viewerState union)
  - SearchCollectionResult type contract — Collections tab row payload (D-11 matchedWatches + matchedTags)
  - Live-DB regression test for two-layer privacy (Pitfall 6 lock — Profile B collection_public=false MUST NOT surface)
  - Live-DB trgm reachability test on watches_catalog (I-11 INFO fix — seeds >=12 catalog rows so EXPLAIN has a real dataset)
affects: [19-02 search-actions, 19-03 watches-tab-ui, 19-04 collections-tab-ui, 19-05 unified-search-page, 19-06 highlighted-text-bio-snippet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anti-N+1 viewer-state hydration: candidate query → JS slice topIds → single inArray batch keyed by viewerId; D-05 owned-wins-over-wishlist resolution in JS Map; sold/grail not badged"
    - "Two-layer privacy AND idiom for cross-user collection reads: WHERE ps.profile_public = true AND ps.collection_public = true AND p.id != viewerId — both privacy clauses explicit (Pitfall 6)"
    - "Tag-array match via PostgreSQL EXISTS(SELECT 1 FROM unnest(arr) t WHERE t ILIKE pattern) — covers style_tags + role_tags + complications uniformly"
    - "Reference normalization mirror: JS-side regex strip /[^a-z0-9]+/g matches the GENERATED reference_normalized column expression (Pitfall 1)"
    - "Empty inArray length-guard: topIds.length === 0 short-circuits before the second SELECT (Pitfall 4)"
    - "Pre-LIMIT 50 candidates + final slice to 20: defense-in-depth bounded result set before JS post-sort"
    - "Reference-normalization fallback: when stripped query is empty (e.g. q='/-'), the reference branch falls back to sql\`false\` so the OR predicate stays valid"

key-files:
  created:
    - tests/data/searchCatalogWatches.test.ts (15 unit tests — SRCH-09 + SRCH-10 + D-01..D-06 contract; Drizzle chainable mocks)
    - tests/data/searchCollections.test.ts (13 unit tests — SRCH-11 + SRCH-12 + D-09..D-12 + D-16; SQL-shape substring assertions)
    - tests/integration/phase19-collections-privacy.test.ts (live-DB regression lock for two-layer privacy + self-exclusion)
    - tests/integration/phase19-trgm-reachability.test.ts (live-DB EXPLAIN ANALYZE — accepts trgm index OR <100ms Seq Scan)
  modified:
    - src/lib/searchTypes.ts (added SearchCatalogWatchResult + SearchCollectionResult; existing SearchProfileResult + SearchTab unchanged)
    - src/data/catalog.ts (appended searchCatalogWatches + new SEARCH_WATCHES_* constants; existing CAT-06/07/11 functions unchanged)
    - src/data/search.ts (appended searchCollections + new SEARCH_COLLECTIONS_* constants; existing searchProfiles unchanged)

key-decisions:
  - "Anti-N+1 viewer-state hydration via single inArray batch keyed by viewerId; D-05 owned-wins-over-wishlist resolution in JS"
  - "Two-layer privacy AND-locked: BOTH profile_public AND collection_public must be true; Pitfall 6 regression-locked by integration test seeding Profile B (collection_public=false)"
  - "design_traits intentionally EXCLUDED from Collections match predicate per D-09 — only style_tags + role_tags + complications + brand/model are searched"
  - "Reference normalization fallback: empty alpha-stripped query → sql\`false\` placeholder so OR predicate stays valid (q = '/-' would otherwise emit ILIKE %% matching everything)"
  - "Pre-LIMIT 50 + final 20: bounded result set before JS post-sort; matches searchProfiles + Phase 18 trending precedent"

patterns-established:
  - "Anti-N+1 batched viewer-state hydration on cross-user catalog reads — keyed by viewerId, length-guarded, deterministic resolution map"
  - "Two-layer privacy AND idiom for any future collection-spanning DAL — must explicitly AND profile_public + the relevant per-row visibility column"
  - "Tag-array search via EXISTS(unnest()) ILIKE — uniform across style_tags / role_tags / complications without separate UNION branches"

requirements-completed: [SRCH-09, SRCH-10, SRCH-11, SRCH-12, SRCH-15]

# Metrics
duration: ~13 min
completed: 2026-04-28
---

# Phase 19 Plan 01: Search DAL Foundation Summary

**Two server-only DAL readers — `searchCatalogWatches` (Watches tab, popularity-trending body + anti-N+1 owned/wishlist hydration) and `searchCollections` (Collections tab, two-layer privacy + tag-array unnest match) — wired with parameterized Drizzle binds and locked by live-DB regression tests.**

## Performance

- **Duration:** ~13 minutes
- **Tasks:** 4 of 4 completed
- **Files created:** 4
- **Files modified:** 3
- **Unit tests added:** 28 (15 + 13)
- **Integration tests added:** 2 (live-DB)

## Accomplishments

- `searchCatalogWatches` DAL exported from `src/data/catalog.ts` — popularity-DESC + score-zero exclusion + alphabetical tie-break, plus ILIKE OR over `brand_normalized` / `model_normalized` / `reference_normalized` and a single-batch `inArray(watches.catalogId, topIds)` viewer-state hydration that resolves D-05 (`'owned'` wins over `'wishlist'` for the same `catalogId`; `'sold'` and `'grail'` are NOT badged).
- `searchCollections` DAL exported from `src/data/search.ts` — single CTE-shaped `db.execute(sql\`...\`)` with two-layer privacy AND-locked (`profile_public = true AND collection_public = true AND p.id != viewerId`), four match paths (`brand` + `model` ILIKE plus `EXISTS(unnest(style_tags|role_tags|complications))` ILIKE), and a JS post-sort `matchCount DESC, tasteOverlap DESC, username ASC` with pre-LIMIT 50 + final slice to 20.
- Two new exported types — `SearchCatalogWatchResult` and `SearchCollectionResult` — with the exact `viewerState`, `matchedWatches`, and `matchedTags` shapes the downstream UI rows will consume; existing `SearchProfileResult` + `SearchTab` byte-identical.
- Pitfall 6 regression lock shipped: live-DB integration test seeds 4 profiles (V viewer, A public+public, B public+private collection, C private profile+public collection), all with one matching watch, and asserts that `searchCollections` returns EXACTLY 1 row whose userId is Profile A. Removing the `collection_public = true` clause from the DAL will fail this test.

## Task Commits

Each task was committed atomically with TDD red→green where applicable:

1. **Task 1: Extend search type contracts** — `92105e7` (feat: SearchCatalogWatchResult + SearchCollectionResult)
2. **Task 2: Build searchCatalogWatches DAL with anti-N+1 viewer-state hydration**
   - `cda9090` (test: add failing tests for searchCatalogWatches — 15 tests, RED)
   - `edba051` (feat: implement searchCatalogWatches — GREEN)
3. **Task 3: Build searchCollections DAL with two-layer privacy + tag-array unnest + tasteOverlap secondary sort**
   - `3099553` (test: add failing tests for searchCollections — 13 tests, RED)
   - `659ef2a` (feat: implement searchCollections — GREEN)
4. **Task 4: Live-DB integration tests for two-layer privacy + trgm reachability** — `2b79b4a` (test: 2 integration tests against live local Postgres)

## Files Created/Modified

### Created

- **`src/lib/searchTypes.ts`** — Added two new exported interfaces: `SearchCatalogWatchResult` (Watches tab row payload with `viewerState: 'owned' | 'wishlist' | null`) and `SearchCollectionResult` (Collections tab row payload with `matchedWatches: Array<{ matchPath: 'name' | 'tag' }>` and `matchedTags: string[]`). Existing `SearchProfileResult` + `SearchTab` exports unchanged.
- **`tests/data/searchCatalogWatches.test.ts`** — 15 Drizzle-chainable-mock unit tests covering SRCH-09 + SRCH-10. Captures `selectCount` for the anti-N+1 query-count assertion (Test 6 = exactly 2 select calls; Test 7 = exactly 1 when candidates resolve empty).
- **`tests/data/searchCollections.test.ts`** — 13 unit tests using `safeStringify` substring assertions on the `db.execute(sql\`...\`)` SQL chunks. Locks two-layer privacy AND, self-exclusion, the four match paths (and the `design_traits` exclusion per D-09), the D-16 sort comparator, the candidate cap, and the JS post-sort `matchCount → tasteOverlap → username` ordering.
- **`tests/integration/phase19-collections-privacy.test.ts`** — Live-DB integration test (skips when `DATABASE_URL` unset). Seeds V/A/B/C with a matching `Speedmaster-${TAG}` watch each, then asserts `searchCollections({ q, viewerId: V.id })` returns exactly Profile A.
- **`tests/integration/phase19-trgm-reachability.test.ts`** — Live-DB `EXPLAIN ANALYZE` test that seeds ≥12 catalog rows (I-11 INFO fix), `ANALYZE`s the table, then accepts EITHER trgm index reached OR Seq Scan <100ms.

### Modified

- **`src/data/catalog.ts`** — Appended `searchCatalogWatches` after `getCatalogById`. Added `and, asc, desc, ilike, inArray, or` to the drizzle-orm import line and `watches` to the schema import. Added `SearchCatalogWatchResult` type import. Added `SEARCH_WATCHES_TRIM_MIN_LEN`, `SEARCH_WATCHES_CANDIDATE_CAP`, `SEARCH_WATCHES_DEFAULT_LIMIT` constants. Existing `upsertCatalogFromUserInput`, `upsertCatalogFromExtractedUrl`, `getCatalogById`, sanitizers, and mappers unchanged.
- **`src/data/search.ts`** — Appended `searchCollections` after `searchProfiles`. Added `SearchCollectionResult` to the existing type import. Added `SEARCH_COLLECTIONS_TRIM_MIN_LEN`, `SEARCH_COLLECTIONS_CANDIDATE_CAP`, `SEARCH_COLLECTIONS_DEFAULT_LIMIT` constants. Existing `searchProfiles` and `overlapBucket` unchanged. Reused `getWatchesByUser`, `getPreferencesByUser`, `getAllWearEventsByUser`, `computeTasteOverlap`, `computeTasteTags`, and `overlapBucket` for the secondary `tasteOverlap` sort.

## Deviations from Plan

None — plan executed exactly as written. Each task's tests were written first (RED), implementation followed (GREEN), no refactor passes were needed, and all acceptance criteria + verification commands passed on the first GREEN run. No Rule 1/2/3 auto-fixes triggered. No Rule 4 architectural decisions surfaced.

## Threat Model Coverage (Plan 01 scope)

All threats listed in `19-01-PLAN.md` `<threat_model>` are mitigated:

- **T-19-01-01** (Tampering on `searchCatalogWatches.q`) — All `q` interpolations use Drizzle `or(ilike(brandNormalized, pattern), ...)` template binds. Reference normalization is JS-side `replace(/[^a-z0-9]+/g, '')` applied BEFORE the bind. No string concat into SQL — verified by Test 8 in the unit suite.
- **T-19-01-02** (Tampering on `searchCollections.q` raw `sql` template) — All five ILIKE binds and the `${viewerId}` self-exclusion bind use `${pattern}` / `${viewerId}` Drizzle template-tag interpolation. Test 8 asserts no `ILIKE '%rolex%'` literal appears in the SQL text fragments.
- **T-19-01-03** (Information Disclosure — collector with collection_public=false leaking) — DAL WHERE explicitly ANDs both privacy flags. Pitfall 6 regression-locked by `phase19-collections-privacy.test.ts` Profile B seed (collection_public=false MUST NOT surface).
- **T-19-01-04** (Information Disclosure — viewer's own profile in results) — `p.id != ${viewerId}` clause; locked by the integration test viewer-self seed and exactly-one-row assertion.
- **T-19-01-05** (Schema/column names leaking via DAL errors) — DAL throws plain `Error`; the Server Action layer (Plan 02) will catch and return generic copy. This plan's DAL never returns error strings to the client.
- **T-19-01-06** (Unbounded query-length DoS) — `.max(200)` enforced in the Server Action layer (Plan 02). DAL also gates `trim().length < 2 → []` early-return. Pre-LIMIT 50 + final 20 cap protects downstream stages.
- **T-19-01-07** (`inArray` empty degenerate IN clause) — `topIds.length` length-guard before the inArray; Test 7 verifies the short-circuit empties to a single `selectCount`.
- **T-19-01-08** (Anti-N+1 violation surfacing wrong viewer state) — Single-batch `inArray(watches.catalogId, topIds)` filtered by `viewerId`. Test 6 asserts exactly 2 `db.select()` calls regardless of N candidates.
- **T-19-01-09** (ReDoS via reference-normalization regex on q) — Accepted: `/[^a-z0-9]+/g` is linear in q length; q is bounded to 200 chars by the Server Action layer. No catastrophic backtracking pattern.

## Verification

- `npx vitest run tests/data/searchCatalogWatches.test.ts tests/data/searchCollections.test.ts --reporter=default` → **28 passed (15 + 13)**
- `npx vitest run tests/integration/phase19-collections-privacy.test.ts tests/integration/phase19-trgm-reachability.test.ts` → **2 passed (live-DB, with `.env.local` loaded)**
- `npx tsc --noEmit` → no diagnostics referencing `src/lib/searchTypes.ts`, `src/data/catalog.ts`, `src/data/search.ts`, or the four new test files
- `npm run lint` against the seven Plan 01 files → clean
- `npx vitest run tests/data/searchProfiles.test.ts` → **13 passed (no regression in Phase 16 People DAL)**

## Wave 1 Handoff

Plan 02 (Server Actions wave) consumes:

- `searchCatalogWatches({ q, viewerId, limit }) → Promise<SearchCatalogWatchResult[]>` — wrap with auth + Zod `.strict().max(200)` schema
- `searchCollections({ q, viewerId, limit }) → Promise<SearchCollectionResult[]>` — wrap with auth + Zod `.strict().max(200)` schema
- `SearchCatalogWatchResult` + `SearchCollectionResult` types from `@/lib/searchTypes` for action return shape

Plans 03 + 04 (UI waves) consume the same two types for `<WatchSearchRow>` and `<CollectionSearchRow>` rendering. The `viewerState` union (`'owned' | 'wishlist' | null`) drives the badge variant; `matchedWatches[].matchPath` (`'name' | 'tag'`) drives the highlight slot.

## Self-Check: PASSED

Created files exist:
- `src/lib/searchTypes.ts` — modified ✓
- `src/data/catalog.ts` — modified ✓
- `src/data/search.ts` — modified ✓
- `tests/data/searchCatalogWatches.test.ts` — created ✓
- `tests/data/searchCollections.test.ts` — created ✓
- `tests/integration/phase19-collections-privacy.test.ts` — created ✓
- `tests/integration/phase19-trgm-reachability.test.ts` — created ✓

Commits exist:
- `92105e7` — Task 1 feat ✓
- `cda9090` — Task 2 RED ✓
- `edba051` — Task 2 GREEN ✓
- `3099553` — Task 3 RED ✓
- `659ef2a` — Task 3 GREEN ✓
- `2b79b4a` — Task 4 ✓

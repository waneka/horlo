---
phase: 19-search-watches-collections
verified: 2026-04-28T21:08:22Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 19: /search Watches + Collections Verification Report

**Phase Goal:** The two stub tabs from v3.0 Phase 16 (`?tab=watches` and `?tab=collections`) are populated with real, debounced, anti-N+1, two-layer-privacy results — and the All tab unions all four sources.

**Verified:** 2026-04-28T21:08:22Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Typing a query into `/search?tab=watches` returns catalog matches with thumbnails, brand/model, owned/wishlist badges, and an inline "Evaluate" CTA per result.                                                                  | ✓ VERIFIED | `src/data/catalog.ts:277` `searchCatalogWatches` returns rows with `imageUrl`, `brand`, `model`, `viewerState`. `src/components/search/WatchSearchRow.tsx:43` renders `next/image` thumbnail + `<HighlightedText>` brand/model + Owned/Wishlist pill + raised `<Link>` to `/evaluate?catalogId={uuid}`. 11/11 RTL tests pass. |
| 2   | Owned/wishlist badge hydration uses a single batched `inArray` query (no per-row N+1) verified by query log/code.                                                                                                                | ✓ VERIFIED | `src/data/catalog.ts:332-345` — single `inArray(watches.catalogId, topIds)` batch keyed by viewerId. Test 6 in `tests/data/searchCatalogWatches.test.ts` asserts `selectCount === 2` regardless of N candidates. Test 7 asserts `selectCount === 1` when candidates is empty (Pitfall 4 length-guard at line 332).               |
| 3   | Typing a query into `/search?tab=collections` returns matches that satisfy BOTH `profile_public = true` AND `collection_public = true` (verified via two-layer privacy integration test) and excludes the viewer's own collection. | ✓ VERIFIED | `src/data/search.ts:257-259` — DAL WHERE explicitly ANDs both privacy flags + `p.id != ${viewerId}`. Live-DB integration test `tests/integration/phase19-collections-privacy.test.ts` seeds 4 profiles (V/A/B/C) and asserts only Profile A surfaces. **Test passes against live local Postgres.**                       |
| 4   | The `/search?tab=all` view surfaces People + Watches + Collections capped at 5 each.                                                                                                                                             | ✓ VERIFIED | Hook-side: `src/components/search/useSearchState.ts:133,177,221` — three `slice(0, ALL_TAB_SECTION_CAP=5)` calls (one per sub-effect). Composer-side defensive cap: `src/components/search/AllTabResults.tsx:65-67` — three internal `slice(0, ALL_TAB_SECTION_CAP)` calls; both row rendering AND See-all conditions reference capped variables (I-2 BLOCKER fix). Tests 6+7 in `AllTabResults.test.tsx` lock the over-cap regression. |
| 5   | Rapidly switching tabs while typing aborts in-flight requests for the previous tab (per-tab AbortController) and never displays results from the wrong tab.                                                                       | ✓ VERIFIED | `src/components/search/useSearchState.ts` — three independent `useEffect` blocks (lines 108, 152, 196), each owns its own `AbortController` (3 matches), each cleans up via `return () => controller.abort()` (3 matches), each guards with `if (controller.signal.aborted) return` after every await (9 matches across post-await + finally). Test 16 (`useSearchState.test.tsx`) verifies that switching `tab='watches' → tab='collections'` mid-flight then resolving the in-flight Watches fetch leaves `watchesResults` empty. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                              | Expected                                                                  | Status     | Details                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/searchTypes.ts`                                              | `SearchCatalogWatchResult` + `SearchCollectionResult` exported types     | ✓ VERIFIED | Both interfaces exported (lines 35, 51). Existing `SearchProfileResult` + `SearchTab` byte-identical.                                    |
| `src/data/catalog.ts`                                                 | `searchCatalogWatches({q, viewerId, limit})` async function              | ✓ VERIFIED | Exported at line 277. Anti-N+1 inArray batch confirmed at line 342.                                                                       |
| `src/data/search.ts`                                                  | `searchCollections({q, viewerId, limit})` async function                 | ✓ VERIFIED | Exported at line 205. Two-layer privacy AND-locked (lines 257-258); self-exclusion (line 259).                                            |
| `src/app/actions/search.ts`                                           | `searchWatchesAction` + `searchCollectionsAction` Server Actions          | ✓ VERIFIED | Both exported (lines 81, 117). `getCurrentUser()` auth gate + Zod `.strict().max(200)` + generic error copy. viewerId from session only. |
| `src/components/search/useSearchState.ts`                             | Per-tab slices + 3 independent sub-effects + per-section AbortController  | ✓ VERIFIED | 3 `useEffect` (3a/3b/3c) at lines 108/152/196; 3 `new AbortController()`; 3 `return () => controller.abort()`; 9 `signal.aborted` guards. |
| `src/components/search/SearchPageClient.tsx`                          | 4-tab shell with real result blocks (no `<ComingSoonCard>`)               | ✓ VERIFIED | 0 `ComingSoonCard` references; per-tab Input placeholder via `PLACEHOLDER_BY_TAB`; per-tab error/empty/footer copy verbatim per UI-SPEC.  |
| `src/components/search/AllTabResults.tsx`                             | Composer with 3 sections in D-13 order + defensive 5-cap                  | ✓ VERIFIED | 3 sections (People→Watches→Collections); 3 `slice(0, ALL_TAB_SECTION_CAP)` calls; See-all uses `setTab()`, never `router.push`.          |
| `src/components/search/WatchSearchRow.tsx`                            | Watches row with thumbnail + pill + Evaluate CTA                          | ✓ VERIFIED | Whole-row absolute-inset Link + raised inline Evaluate Link both target `/evaluate?catalogId={uuid}` (2 matches). Owned + Wishlist pill class strings both greppable. |
| `src/components/search/CollectionSearchRow.tsx`                       | Collections row with avatar + matched-watch cluster + tag pills           | ✓ VERIFIED | `/u/{username}/collection` Link; matched-watch cluster (cap 3 thumbs, aria-label brand+model); matched-tag pills conditional + capped to 3. Match-summary copy matrix (4 branches). |
| `tests/integration/phase19-collections-privacy.test.ts`                | Live-DB privacy regression lock (Pitfall 6)                               | ✓ VERIFIED | Test passes against local Postgres (with `DATABASE_URL` loaded). Seeds Profile B (collection_public=false) and asserts exclusion.        |

### Key Link Verification

| From                                                | To                                                                  | Via                                                              | Status   | Details                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `searchCatalogWatches` DAL                          | `watches_catalog.brand_normalized` + `model_normalized` + `reference_normalized` | Drizzle `or(ilike(...))` template binds                          | ✓ WIRED  | `src/data/catalog.ts:309-316` — three `ilike(watchesCatalog.{brand,model,reference}Normalized, pattern)` calls. |
| `searchCatalogWatches` DAL                          | `watches.catalogId` for viewer state                                | Single `inArray(watches.catalogId, topIds)` batch (SRCH-10)      | ✓ WIRED  | `src/data/catalog.ts:332-345` length-guarded; Test 6 asserts exactly 2 select calls.                          |
| `searchCollections` DAL                             | `profiles ⨝ profile_settings ⨝ watches`                            | Raw `sql` template with both privacy flags ANDed                  | ✓ WIRED  | `src/data/search.ts:254-259` `INNER JOIN profile_settings`+`INNER JOIN profiles` and AND of both privacy flags. |
| `searchWatchesAction` Server Action                 | `searchCatalogWatches` DAL                                          | direct call passing `viewerId: user.id`                          | ✓ WIRED  | `src/app/actions/search.ts:97-101`                                                                            |
| `searchCollectionsAction` Server Action             | `searchCollections` DAL                                             | direct call passing `viewerId: user.id`                          | ✓ WIRED  | `src/app/actions/search.ts:133-137`                                                                           |
| `useSearchState` 3 sub-effects                      | `searchPeopleAction` + `searchWatchesAction` + `searchCollectionsAction` | one effect per section, own AbortController, deps `[debouncedQ, tab]` | ✓ WIRED  | Lines 129, 173, 217 each call their respective action; per-tab abort on cleanup.                              |
| `AllTabResults` See-all link                        | `setTab(...)` handler from `useSearchState`                         | onClick via D-14 (no router.push)                                 | ✓ WIRED  | `setTab('people')`, `setTab('watches')`, `setTab('collections')` (one each); `router.push` count = 0.         |
| `SearchPageClient` Watches/Collections panels       | `WatchSearchRow` + `CollectionSearchRow`                            | `results.map((r) => <Row .../>)` after skeleton/error/empty branches | ✓ WIRED  | Lines 287-289 (Watches), 350-352 (Collections); Showing top 20 footer at line 290.                              |

### Data-Flow Trace (Level 4)

| Artifact                                       | Data Variable          | Source                                                 | Produces Real Data | Status      |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------ | ----------- |
| `WatchSearchRow`                               | `result.*`             | `searchCatalogWatches` DAL (real `watches_catalog` query) | Yes                | ✓ FLOWING   |
| `CollectionSearchRow`                          | `result.*`             | `searchCollections` DAL (real CTE-shaped `db.execute`)  | Yes                | ✓ FLOWING   |
| `useSearchState.peopleResults`                 | per-tab state slice    | `searchPeopleAction → searchProfiles` (Phase 16)         | Yes                | ✓ FLOWING   |
| `useSearchState.watchesResults`                | per-tab state slice    | `searchWatchesAction → searchCatalogWatches`             | Yes                | ✓ FLOWING   |
| `useSearchState.collectionsResults`            | per-tab state slice    | `searchCollectionsAction → searchCollections`            | Yes                | ✓ FLOWING   |
| `AllTabResults` rendered children              | capped per-section arrays | `useSearchState` slices passed via SearchPageClient     | Yes                | ✓ FLOWING   |
| `WatchSearchRow.viewerState` (Owned/Wishlist) | viewer-keyed badge     | DAL `inArray(watches.catalogId, topIds)` filtered by viewerId | Yes                | ✓ FLOWING   |
| `CollectionSearchRow.matchedWatches[]`         | per-row JSONB agg      | DAL `jsonb_agg` ORDER BY name-priority then brand        | Yes                | ✓ FLOWING   |

### Behavioral Spot-Checks

| Behavior                                                                                  | Command                                                                                                                                | Result          | Status   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- |
| All Phase 19 unit + RTL tests pass (DAL + actions + components)                           | `npx vitest run tests/components/search/ tests/data/searchCatalogWatches.test.ts tests/data/searchCollections.test.ts tests/actions/search.test.ts` | 116 passed (9 files) | ✓ PASS   |
| Live-DB two-layer privacy integration test passes against local Postgres                 | `set -a; source .env.local; set +a; npx vitest run tests/integration/phase19-collections-privacy.test.ts`                              | 1 passed         | ✓ PASS   |
| Live-DB trgm reachability test passes                                                     | `set -a; source .env.local; set +a; npx vitest run tests/integration/phase19-trgm-reachability.test.ts`                                | 1 passed         | ✓ PASS   |
| TypeScript clean for Phase 19 src files                                                   | `npx tsc --noEmit \| grep -E "src/(data\|app\|components)"`                                                                            | 0 errors         | ✓ PASS   |

The single remaining TS2578 diagnostic at `tests/components/search/useSearchState.test.tsx:261` is a pre-existing Phase 16 issue (unused `@ts-expect-error` directive) explicitly logged in `.planning/phases/19-search-watches-collections/deferred-items.md` — not caused by Phase 19.

### Requirements Coverage

| Requirement | Source Plan(s)        | Description                                                                                                                                       | Status      | Evidence                                                                                                                                                                                                                       |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SRCH-09     | 19-01, 19-02, 19-03, 19-06 | User can search canonical watch catalog with thumbnails, brand/model, owned/wishlist badges, inline "Evaluate" CTA                                | ✓ SATISFIED | `searchCatalogWatches` DAL → `searchWatchesAction` → `useSearchState.watchesResults` → `WatchSearchRow` renders all required UI elements; whole-row + inline Evaluate Link both target `/evaluate?catalogId={uuid}`.            |
| SRCH-10     | 19-01                 | Owned/wishlist badge hydration uses `inArray` batch query (anti-N+1)                                                                              | ✓ SATISFIED | Single `inArray(watches.catalogId, topIds)` query at `src/data/catalog.ts:342`. Test 6 in `searchCatalogWatches.test.ts` asserts exactly 2 `db.select` calls regardless of N candidates (1 candidates + 1 viewer-state batch). |
| SRCH-11     | 19-01, 19-02, 19-04, 19-06 | User can search across collections — by-watch-identity AND by-tag-profile                                                                         | ✓ SATISFIED | `searchCollections` DAL matches via brand/model ILIKE OR `EXISTS(unnest(style_tags\|role_tags\|complications))`; `CollectionSearchRow` renders matched-watch cluster + matched-tag pills + match-summary matrix (4 branches).  |
| SRCH-12     | 19-01                 | /search Collections gates on BOTH `profile_public` AND `collection_public` plus viewer self-exclusion                                             | ✓ SATISFIED | DAL WHERE clause at `src/data/search.ts:257-259`. Live-DB integration test (Pitfall 6 regression lock) seeds 4 profiles and asserts only the public+public profile (Profile A) surfaces — passes against local Postgres.      |
| SRCH-13     | 19-05, 19-06          | /search?tab=all unions People + Watches + Collections capped at 5 each                                                                            | ✓ SATISFIED | Hook caps each section at 5 (3 `slice(0, ALL_TAB_SECTION_CAP)` calls in `useSearchState`). `AllTabResults` defensively re-caps (3 more `slice(0, ALL_TAB_SECTION_CAP)` calls — I-2 BLOCKER fix). Tests 6 + 7 in `AllTabResults.test.tsx` lock the cap. |
| SRCH-14     | 19-05                 | `useSearchState` hook is extended with AbortController per `(tab, query)` pair for safe rapid-tab-switch behavior                                  | ✓ SATISFIED | Three sub-effects each with own `AbortController`, deps `[debouncedQ, tab]`, post-await + finally `signal.aborted` guards. Test 16 verifies tab-swap mid-flight does not leak; Test 17 verifies rapid q-change keeps only the latest. |
| SRCH-15     | 19-01, 19-03, 19-04   | XSS-safe `<HighlightedText>` reused across all v4.0 search surfaces                                                                                | ✓ SATISFIED | `<HighlightedText>` imported in `WatchSearchRow.tsx` (2 wraps: brand+model + reference) and `CollectionSearchRow.tsx` (1 wrap: displayName + matched-cluster aria-label brand+model). Zero `dangerouslySetInnerHTML` references in `src/components/search/`. |

All 7 declared Phase 19 requirements satisfied. No orphaned requirements (REQUIREMENTS.md table maps SRCH-09..15 exclusively to Phase 19, all covered by plans).

### Anti-Patterns Found

| File                                                | Line   | Pattern                                                                                                                                                                | Severity   | Impact                                                                                                                                                                  |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/search.ts`                                | 325-367 | WR-01 from REVIEW: Collections DAL fans out 3 user-data queries per candidate × up to 50 candidates = 150 concurrent reads before LIMIT-20 slice (mirrors searchProfiles) | ⚠️ Warning | Same shape as Phase 16 `searchProfiles`. Code review classified as Warning, not Critical. Below v4.0 single-user MVP scale (<500 watches/user constraint).             |
| `src/components/search/CollectionSearchRow.tsx`    | 73-81  | WR-03 from REVIEW: `result.imageUrl` rendered through `next/image unoptimized` without per-component validation; `watches.image_url` lacks write-time `sanitizeHttpUrl` guard analogous to catalog | ⚠️ Warning | Mitigated by `next.config.ts` `images.unoptimized: true` (no SSRF surface — browser fetches directly). `getSafeImageUrl` exists in `src/lib/images.ts` but is not invoked here. Hardening gap inherited from Phase 11+, not introduced by Phase 19. |
| `src/components/search/useSearchState.ts`          | 39-41, 257-259 | IN-01 from REVIEW: backward-compat hook fields (`results`, `isLoading`, `hasError`) are still exported even though `SearchPageClient` now reads per-tab slices directly | ℹ️ Info    | Plan 06 SUMMARY explicitly defers alias removal to a "future quick-task". Does not affect goal achievement.                                                           |
| `src/components/search/useSearchState.ts`          | 107-149 (and equivalents) | IN-02 from REVIEW: People sub-effect refetches when transitioning All → People (slice changes from `slice(0, 5)` to full `res.data`)                                   | ℹ️ Info    | UX polish, not a correctness defect. Documented as deferred.                                                                                                          |
| `src/data/search.ts`                                | 283-287 | IN-03 from REVIEW: `matched_tags` aggregation uses correlated subquery instead of folding into outer aggregation                                                       | ℹ️ Info    | Functionally correct; performance impact negligible at v4.0 scale.                                                                                                    |

All findings from `19-REVIEW.md` are at Warning / Info severity (review reports `critical: 0, warning: 3, info: 5`). None block Phase 19's goal achievement.

### Human Verification Required

None. Phase 19 is exhaustively covered by automated tests:
- 116 unit + RTL tests across 9 files (DAL, actions, hook, rows, composer, page) — all passing.
- 2 live-DB integration tests (privacy + trgm reachability) — all passing against local Postgres.
- TypeScript + lint clean for all Phase 19 source files.

The Plan 06 SUMMARY documents two manual UAT smoke tests (visit `/search?tab=watches&q=Rolex` and rapid tab-switching) as deferred per VALIDATION.md "Manual-Only Verifications" — explicitly listed as deferred human-verification items, NOT as a verification gate. The behaviors they would confirm (per-section paint independence, AbortController abort granularity) are already locked in by `useSearchState.test.tsx` Tests 16-19.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria pass; all 7 requirements satisfied; all 10 plan-frontmatter artifacts exist and are wired; all 7 key links connect end-to-end with real data flowing; all 4 behavioral spot-checks pass.

Phase 19 achieves its goal: **the two stub tabs from v3.0 Phase 16 are populated with real, debounced, anti-N+1, two-layer-privacy results, and the All tab unions People + Watches + Collections capped at 5 each with per-section AbortController-gated fetches that abort cleanly on rapid tab/query switches.**

---

_Verified: 2026-04-28T21:08:22Z_
_Verifier: Claude (gsd-verifier)_

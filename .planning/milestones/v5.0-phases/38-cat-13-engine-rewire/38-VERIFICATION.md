---
phase: 38-cat-13-engine-rewire
verified: 2026-05-11T23:55:00Z
status: approved
milestone_close_approval: "2026-05-16 — operator approved at v5.0 milestone close; D-07 test-fixture gap closed by Plan 38-04 (re-verified PASSED 2026-05-12), accepted"
score: 5/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "D-07 fixture sweep fully covered all createWatch callsites in test layer"
    status: partial
    reason: "Phase 38 Plan A D-07 sweep updated tests/integration/phase*.test.ts and tests/data/getWearEventsCountByUser.test.ts but missed 8 additional test files that call createWatch with the old 2-arg signature: tests/data/{getRecommendationsForViewer,getSuggestedCollectors,getWatchByIdForViewer,getWearRailForViewer,isolation}.test.ts (7 tsc TS2554 errors) and tests/actions/{watches,watches.notesPublic,wishlist,addwatch-catalog-resilience}.test.ts (13 vitest failures). Production code is correct. No ROADMAP success criterion is failed — this is a test-layer regression introduced by the D-07 sweep scope gap."
    artifacts:
      - path: "tests/data/getRecommendationsForViewer.test.ts"
        issue: "Expected 3 args, got 2 (tsc TS2554 x2)"
      - path: "tests/data/getSuggestedCollectors.test.ts"
        issue: "Expected 3 args, got 2 (tsc TS2554 x1)"
      - path: "tests/data/getWatchByIdForViewer.test.ts"
        issue: "Expected 3 args, got 2 (tsc TS2554 x2)"
      - path: "tests/data/getWearRailForViewer.test.ts"
        issue: "Expected 3 args, got 2 (tsc TS2554 x1)"
      - path: "tests/data/isolation.test.ts"
        issue: "Expected 3 args, got 2 (tsc TS2554 x1)"
      - path: "tests/actions/watches.test.ts"
        issue: "4 vitest failures — mocks use 2-arg createWatch; also expects old 2-arg editWatch call form"
      - path: "tests/actions/watches.notesPublic.test.ts"
        issue: "3 vitest failures — createWatch 2-arg mock + stale signature expectations"
      - path: "tests/actions/wishlist.test.ts"
        issue: "5 vitest failures — createWatch 2-arg mock throughout"
      - path: "tests/actions/addwatch-catalog-resilience.test.ts"
        issue: "1 vitest failure — tests old fire-and-forget behavior; Phase 38 changed addWatch to fail-loud (success=false when upsert returns null)"
    missing:
      - "Update tests/data/{getRecommendationsForViewer,getSuggestedCollectors,getWatchByIdForViewer,getWearRailForViewer,isolation}.test.ts createWatch callsites to 3-arg IDIOM A"
      - "Update tests/actions/watches.test.ts mocks to 3-arg createWatch and update addWatch/editWatch expectations"
      - "Update tests/actions/watches.notesPublic.test.ts to reflect 3-arg createWatch signature"
      - "Update tests/actions/wishlist.test.ts mocks to 3-arg createWatch"
      - "Rewrite tests/actions/addwatch-catalog-resilience.test.ts to test fail-loud behavior (addWatch returns success=false + throws when upsert returns null) instead of fire-and-forget"
---

# Phase 38: CAT-13 Engine Rewire Verification Report

**Phase Goal:** Wire `analyzeSimilarity()` to consume catalog taste columns as an additive 9th scoring dimension gated on confidence, making the Phase 19.1 LLM-enrichment investment visible in collection fit verdicts for the first time.
**Verified:** 2026-05-11T23:55:00Z
**Status:** approved (operator-approved at v5.0 milestone close, 2026-05-16; gap closed by Plan 38-04, re-verified PASSED — see Re-Verification section below)
**Re-verification:** Yes — Plan 38-04 gap closure re-verified PASSED 2026-05-12

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `similarity.taste-null.test.ts` written AND passes BEFORE similarity.ts modified | VERIFIED | Commit 7054176 (null test) precedes commit 8a2fcf0 (engine rewire); `git merge-base --is-ancestor` confirms ordering; vitest run: 3/3 PASS |
| 2 | `similarity.taste-present.test.ts` written AND passes BEFORE similarity.ts modified | VERIFIED | Commit 3cfc45b (taste-present) precedes commit 8a2fcf0 (engine rewire) — D-13 PASS confirmed via merge-base; vitest run: 2/2 PASS |
| 3 | Both static guards continue passing AFTER similarity.ts modified | VERIFIED | `npx vitest run tests/static/similarity.taste-null.test.ts tests/static/similarity.taste-present.test.ts` exits 0 — 5/5 PASS |
| 4 | `Watch.catalogTaste` field exists; `getWatchesByUser` LEFT JOINs `watches_catalog` | VERIFIED | `src/lib/types.ts` line 86: `catalogTaste?: CatalogTasteAttributes \| null`; `src/data/watches.ts` lines 141–143: `.leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))`; DAL observability test `src/data/__tests__/watches-leftjoin.test.ts` 2/2 PASS |
| 5 | `CollectionFitCard.no-engine.test.ts` unchanged + passing; `src/lib/extractors/llm.ts` byte-locked | VERIFIED | `CollectionFitCard.no-engine.test.ts` 3/3 PASS; `git diff HEAD~12..HEAD -- src/lib/extractors/llm.ts` returns 0 lines (byte-locked); `GOAL_THRESHOLDS` diff = 0 lines; `SimilarityResult`/`SimilarityLabel` diff = 0 lines |

**Score:** 5/5 truths verified

---

## Engine Math Verification

### D-01/D-05 — WEIGHTS constant transformation (no magic numbers)

`EXISTING_WEIGHTS_BASE` contains the original 1.00-sum values. `TASTE_WEIGHT = 0.20`, `EXISTING_SCALE = 1.0 - TASTE_WEIGHT`. `WEIGHTS` computed via `Object.fromEntries(Object.entries(EXISTING_WEIGHTS_BASE).map(([k, v]) => [k, v * EXISTING_SCALE]))`. Grep for hardcoded rescaled values returns 0 matches — D-05 compliant.

### D-02 — Confidence gate strictly >= 0.5 (binary, not gradient)

`tasteSimilarityRaw01()` at lines 106–108: `if (!t1 || !t2) return 0; if (t1.confidence === null || t2.confidence === null) return 0; if (t1.confidence < 0.5 || t2.confidence < 0.5) return 0`. Binary, no gradient. Edge case `confidence = 0.499` tested and PASS; `confidence = 0.5` tested and PASS.

### D-03 — Internal split (0.08 + 0.04 + 0.04 + 0.04)

`TASTE_SUB_WEIGHTS`: `numericTrioCosine: 0.40, archetypeMatch: 0.20, eraMatch: 0.20, motifsJaccard: 0.20`. Effective weights = sub-weight × `TASTE_WEIGHT` (0.20) = 0.08 + 0.04 + 0.04 + 0.04 = 0.20. Sums to 1.00 within taste budget.

### GOAL_THRESHOLDS — unchanged (parity gate)

Diff against HEAD~12 returns 0 lines. Current values match pre-Phase-38 constants.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/similarity.ts` | 9th taste dimension at 0.20 with D-05 no-magic-numbers pattern | VERIFIED | `EXISTING_WEIGHTS_BASE` + `TASTE_WEIGHT` + `EXISTING_SCALE` transformation present; `tasteSimilarityRaw01()` + `cosine3D()` helpers implemented; line 204: `score += WEIGHTS.taste * tasteSimilarityRaw01(...)` |
| `src/lib/types.ts` | `Watch.catalogTaste?: CatalogTasteAttributes \| null` field | VERIFIED | Line 86 present; `CatalogTasteAttributes` interface unchanged at lines 220–229 |
| `src/data/watches.ts` | LEFT JOIN + numeric coercion at mapper boundary | VERIFIED | Lines 126–163: `leftJoin(watchesCatalog, ...)` + `Number()` coercions for `formality`, `sportiness`, `heritageScore`, `confidence` |
| `src/db/schema.ts` | `catalogId` `.notNull()` at line 146 | VERIFIED | Line 146: `uuid('catalog_id').notNull().references(...)` |
| `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql` | Idempotent DO $$ IF block | VERIFIED | File exists; DO $$ block gates on `pg_attribute.attnotnull = false` |
| `drizzle/0011_phase38_catalog_id_notnull.sql` | Drizzle migration twin | VERIFIED | File exists |
| `drizzle/meta/_journal.json` | idx=11 entry with tag `0011_phase38_catalog_id_notnull` | VERIFIED | `{idx: 11, tag: '0011_phase38_catalog_id_notnull', ...}` confirmed |
| `tests/static/similarity.taste-null.test.ts` | 3 test cases: null + low-conf + 0.499 | VERIFIED | 3/3 PASS |
| `tests/static/similarity.taste-present.test.ts` | Directional assertion: compatible > incompatible | VERIFIED | 2/2 PASS |
| `tests/static/composer-engine-alignment.test.ts` | 11 D-15 scenarios | VERIFIED | 11/11 PASS |
| `tests/fixtures/catalogTaste.ts` | Shared fixtures: sub/datejust/speedy/tank/lowConf/exactlyHalf/justBelow/emptyMotifs/nullNumerics | VERIFIED | All 9 named exports present with realistic prod-data-derived values |
| `src/data/__tests__/watches-leftjoin.test.ts` | DAL observability test (optional per ROADMAP) | VERIFIED | 2/2 PASS (mock-based, no DB needed) |
| `src/app/actions/watches.ts` | upsertCatalogFromUserInput BEFORE createWatch (fail-loud) | VERIFIED | Lines 121–141: upsert fires first; `if (!catalogIdResult) throw Error(...)` |
| `src/app/actions/wishlist.ts` | upsertCatalogFromUserInput BEFORE createWatch | VERIFIED | Lines 121–137: upsert then 3-arg createWatch |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `getWatchesByUser` | `watches_catalog` taste columns | Drizzle `leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))` | WIRED | 8 taste fields selected; numeric coercion at mapper boundary |
| `Watch.catalogTaste` | `analyzeSimilarity()` | `score += WEIGHTS.taste * tasteSimilarityRaw01(watch1.catalogTaste, watch2.catalogTaste)` at line 204 | WIRED | `calculatePairSimilarity` calls `tasteSimilarityRaw01` with both watches' `catalogTaste` |
| `tasteSimilarityRaw01` | confidence gate | `if (confidence < 0.5) return 0` | WIRED | Verified against D-02; binary gate confirmed |
| `EXISTING_WEIGHTS_BASE` | `WEIGHTS` | `Object.fromEntries(...map(([k, v]) => [k, v * EXISTING_SCALE]))` | WIRED | D-05 pattern confirmed; no magic numbers |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `analyzeSimilarity` | `watch1.catalogTaste` / `watch2.catalogTaste` | `getWatchesByUser` LEFT JOIN on `watches_catalog` | Yes — DB query with 8 numeric/categorical columns; numeric coercion applied at mapper | FLOWING |
| `tasteSimilarityRaw01` | `formality`, `sportiness`, `heritageScore`, `confidence` | Coerced from postgres-js numeric strings via `Number()` in `getWatchesByUser` | Yes — guarded against string/NaN by `Number()` and null checks | FLOWING |

---

## D-13 Audit-Trail (Test-First Ordering)

```
taste-null test commit:    7054176 — "test(static): add similarity.taste-null guard test"
taste-present test commit: 3cfc45b — "test(static): add similarity.taste-present guard test — RED baseline"
engine rewire commit:      8a2fcf0 — "feat(similarity): rewire analyzeSimilarity with 9th taste dimension"

git merge-base --is-ancestor 3cfc45b 8a2fcf0 → D-13 PASS
```

Both test files were committed before the engine rewire. ROADMAP success criteria #1 and #2 require this ordering — confirmed.

---

## CAT-13 #5 Parity Gates

| Gate | Check | Status |
|------|-------|--------|
| `src/lib/extractors/llm.ts` byte-locked | `git diff HEAD~12..HEAD -- src/lib/extractors/llm.ts \| wc -l` = 0 | PASS |
| `GOAL_THRESHOLDS` unchanged | `git diff HEAD~12..HEAD -- src/lib/similarity.ts \| grep GOAL_THRESHOLDS` = empty | PASS |
| `SimilarityResult` shape unchanged | `git diff HEAD~12..HEAD -- src/lib/types.ts \| grep SimilarityResult` = empty | PASS |
| `SimilarityLabel` enum unchanged | `git diff HEAD~12..HEAD -- src/lib/types.ts \| grep "SimilarityLabel\b"` = empty | PASS |
| `CollectionFitCard.no-engine.test.ts` passing | vitest run: 3/3 PASS | PASS |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| taste-null returns same score as legacy | `npx vitest run tests/static/similarity.taste-null.test.ts` | 3/3 PASS | PASS |
| taste-present produces higher score for compatible pair | `npx vitest run tests/static/similarity.taste-present.test.ts` | 2/2 PASS | PASS |
| composer and engine agree at tier level | `npx vitest run tests/static/composer-engine-alignment.test.ts` | 11/11 PASS | PASS |
| CollectionFitCard import boundary preserved | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | 3/3 PASS | PASS |
| DAL LEFT JOIN populates catalogTaste with numeric coercion | `npx vitest run src/data/__tests__/watches-leftjoin.test.ts` | 2/2 PASS | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| CAT-13 | 38-01, 38-02, 38-03 | Wire `analyzeSimilarity()` with 9th taste dimension at 0.20, confidence >= 0.5 gate, test-first guards, Watch.catalogTaste + DAL JOIN | SATISFIED | All 5 ROADMAP success criteria verified; all static tests pass |

---

## TypeScript Error Assessment

**Pre-Phase-38 baseline (documented in CONTEXT.md):** ~27 tsc errors  
**Current count:** 35 tsc errors  
**Net Phase 38 regressions:** +8

Breakdown of new errors introduced by Phase 38:
- `tests/data/*.test.ts` (5 files, 7 errors) — `createWatch` called with 2 args; Phase 38 D-07 fixture sweep covered `tests/integration/phase*.test.ts` but missed these files. vitest SKIPS these (require live DB), so they do not cause runtime failures.
- Phase 17 integration wiring (`tests/integration/phase17-extract-route-wiring.test.ts`, 3 errors) — nullability mismatch (`null` vs `string | undefined`); pre-existing from Phase 20.1 modification, in the 27-error pre-Phase-38 count.

The 7 `tests/data/` errors are genuine Phase 38 regressions. The Plan 01 must_have check stated "exits 0 (no NEW errors beyond 27-error baseline)" — that check was not satisfied.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `tests/actions/addwatch-catalog-resilience.test.ts` | Tests pre-Phase-38 fire-and-forget behavior (returns success=true when upsert throws) — contradicts Phase 38 fail-loud semantics | WARNING | Test failure (1 test); production code is correct; stale test documents removed behavior |
| `tests/actions/watches.test.ts` | 4 tests mock 2-arg `createWatch`; Phase 38 changed to 3-arg IDIOM A | WARNING | 4 test failures; production code is correct |
| `tests/actions/watches.notesPublic.test.ts` | 3 tests using stale createWatch mock/expectations | WARNING | 3 test failures; production code is correct |
| `tests/actions/wishlist.test.ts` | 5 tests mock 2-arg `createWatch` | WARNING | 5 test failures; production code is correct |

All anti-patterns are test-layer only. Production code (watches.ts, wishlist.ts) is correct.

---

## Human Verification Required

None. All 5 ROADMAP success criteria are verifiable programmatically and all passed. Phase 38 does not ship UI changes — no visual/UX verification needed.

---

## Gaps Summary

**All 5 ROADMAP success criteria are VERIFIED.** The phase goal — wiring `analyzeSimilarity()` to consume catalog taste columns as an additive 9th scoring dimension — is achieved in the codebase.

The single gap is a test-layer regression from the D-07 fixture sweep scope gap:

- **Plan A D-07 scope was `tests/integration/phase*.test.ts`** — this is what the plan's `files_modified` list declares. However, `tests/actions/*.test.ts` (4 files) and `tests/data/*.test.ts` (5 files beyond the 1 that was updated) also call `createWatch` and were not updated when the signature changed to 3-arg.
- **Impact:** 13 vitest failures (action tests) + 7 tsc errors (data tests). These test failures expose stale test code, not broken production logic. The production paths (addWatch, addWishlistWatch) both correctly upsert catalog before 3-arg createWatch.
- **Not a ROADMAP criterion failure** — none of the 5 success criteria references tests/actions/ or full tsc clean as a deliverable. The pre-Phase-38 baseline already had ~27 tsc errors; Phase 38 added 7 new ones in files outside D-07's declared scope.

The gap is classified as `partial` (not `failed`) because: production code is correct, the ROADMAP goal is achieved, and the missing work is fixture maintenance not logic.

---

_Verified: 2026-05-11T23:55:00Z_
_Verifier: Claude (gsd-verifier)_

---

## Re-Verification 2026-05-12

**Plan 38-04 gap closure verified.**
**Re-verified:** 2026-05-12T09:41:00Z
**Previous status:** gaps_found
**Re-verification status:** PASSED

### Gap Closure Summary

| Prior Gap Item | Closed? | Evidence |
|----------------|---------|----------|
| 7 tsc TS2554 errors in tests/data/{getRecommendationsForViewer,getSuggestedCollectors,getWatchByIdForViewer,getWearRailForViewer,isolation}.test.ts | YES | `npx tsc --noEmit` grep for those 5 files returns 0 errors. Total tsc count dropped from 35 → 27 (back to pre-Phase-38 baseline — actually 1 better than the tolerance of 28). |
| 13 vitest failures in tests/actions/{watches,watches.notesPublic,wishlist,addwatch-catalog-resilience}.test.ts | YES | `npx vitest run` on all 4 files: 44/44 PASS. watches: 22/22, watches.notesPublic: 4/4, wishlist: 11/11, addwatch-catalog-resilience: 7/7. |
| addwatch-catalog-resilience.test.ts asserting old fire-and-forget contract | YES | File fully rewritten. No `fire.and.forget` or `success.*true.*upsert.*null` patterns. Fail-loud contract asserted in 2 scenarios (upsert throws + upsert returns null). 2 `createWatch.not.toHaveBeenCalled` assertions confirm fail-loud reorder. |

### CAT-13 Static Guards — Parity Re-Check (Plan 38-04 must not have regressed production)

| Test | Before | After |
|------|--------|-------|
| tests/static/similarity.taste-null.test.ts | 3/3 PASS | 3/3 PASS |
| tests/static/similarity.taste-present.test.ts | 2/2 PASS | 2/2 PASS |
| tests/static/composer-engine-alignment.test.ts | 11/11 PASS | 11/11 PASS |
| tests/static/CollectionFitCard.no-engine.test.ts | 3/3 PASS | 3/3 PASS |

All 19/19 static tests pass. No regression.

### Production Code Parity Gate

`git diff 87738eb..HEAD -- src/ supabase/ drizzle/ src/db/` returns **0 lines**. Plan 38-04 is confirmed test-only. No production files were touched across any of the 4 task commits (912e7b6, 6c56d2d, e0a0057, 48f6854).

### Auto-Deviation Assessment (Plan 38-04 SUMMARY Deviations 1 and 2)

Both deviations are mock drift fixes, not scope creep:

1. **`getWatchById` + `getMaxWishlistSortOrder` added to `@/data/watches` mock** — Phase 37 added these calls to `editWatch`; the mock had not been updated in watches.test.ts and watches.notesPublic.test.ts. Fixing mock drift to match production is correct behavior under Rule 1. No production code change.

2. **`upsertCatalogFromUserInput` mock in watches.notesPublic.test.ts changed from `null` → `'cat-id-1'`** — Post-Phase-38 fail-loud semantics mean a null return from the upsert causes `addWatch` to throw, which would block the tests that assert `success: true`. Changing the mock to return a valid string is the correct test-layer fix to match the production behavior that was already verified in the initial pass. No production code change.

Neither deviation touches files outside the 9 declared in 38-04-PLAN.md `files_modified`. Neither introduces new behavior in production.

### IDIOM A Cascade Confirmation

All 7 `createWatch` callsites in the 5 `tests/data/` files are now 3-arg IDIOM A (`userId`, `catalogId`, `data`). No callsite has `catalogId` inside the data object. Pattern confirmed by grep.

### Commits Verified

| Commit | Description | Files |
|--------|-------------|-------|
| 912e7b6 | test(fixtures): cascade IDIOM A 3-arg createWatch to tests/data/* | 5 |
| 6c56d2d | test(actions): update watches + notesPublic mocks to 3-arg createWatch IDIOM A | 2 |
| e0a0057 | test(actions/wishlist): cascade IDIOM A 3-arg createWatch destructure to wishlist.test.ts | 1 |
| 48f6854 | test(actions): rewrite addwatch-catalog-resilience for Phase 38 fail-loud contract (CAT-13 D-06) | 1 |
| 443e6ae | docs(38-04): record test-fixture gap closure summary (Phase 38 D-07 closeout) | 1 |

### Final Status

All 3 items from the prior `gaps:` block are CLOSED. All 5 ROADMAP success criteria remain VERIFIED (unchanged from initial pass). Production code is byte-identical to pre-wave-4 HEAD (87738eb). tsc total error count at 27 — at the pre-Phase-38 baseline.

_Re-verified: 2026-05-12T09:41:00Z_
_Verifier: Claude (gsd-verifier)_

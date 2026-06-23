---
phase: 260623-mn3
plan: 01
type: quick-task
subsystem: discovery / recommendations
tags: [discovery, recommendations, sparse-pool, taste-aware, top-up, catalog]
dependency_graph:
  requires: ["Phase 75 D-10/D-11/D-12/D-13/D-14 — sparse-pool top-up infrastructure"]
  provides: ["Taste-aware top-up ranking on the home rail when the peer-collector pool collapses below 8 unique watches"]
  affects: ["src/data/recommendations.ts top-up branch", "/api home-rail surface (data shape unchanged; ordering improved)"]
tech_stack:
  added: []
  patterns:
    - "Two-arg ranking helper (topBrandOf, dominantStyleOf) derived ONCE in caller + passed into the pure top-up function — keeps top-up unit-testable without DB mocks for the helpers."
    - "In-memory score formula with sub-1 popularity additive (ownersCount/1000) — a deterministic tiebreaker that never crosses a +50/+100 step."
key_files:
  created: []
  modified:
    - "src/lib/recommendations.ts (+2 chars — added `export` to topBrandOf + dominantStyleOf; no body changes)"
    - "src/data/recommendations.ts (~120 line diff — import extended, viewer signal derivation, rewritten topUpFromCatalogPopularity body, expanded JSDoc)"
    - "src/data/__tests__/recommendations.test.ts (~117 line diff — Case 3 body replaced; catalogTopUpResolver row shape + watchesCatalog mock + getPreferencesByUser mock extended)"
decisions:
  - "D-1: Tiebreak in the OUTER getRecommendationsForViewer re-sort wins for community-fallback rows. The top-up's internal ownersCount/1000 additive distinguishes 0.080 (Omega) from 0.060 (Cartier) so they leave the top-up in popularity order, but the outer re-sort collapses both to score=0 (community-fallback bucket) and alpha-tiebreaks by brand → Cartier < Omega. This is the actual two-level sort semantic; test assertion pins it explicitly."
  - "D-2: getPreferencesByUser test mock was missing required UserPreferences fields (preferredStyles, dislikedStyles, etc.). Worked previously because Case 3's viewer fixture had styleTags=[] so analyzeSimilarity's .some() short-circuited. New Case 3 fixture owns 3 'sport'-tagged Rolex watches, which triggered the deref. Rule 3 (auto-fix blocking issue): extended the mock to return a fully-formed UserPreferences."
metrics:
  duration_seconds: 353
  completed_date: "2026-06-23"
---

# Quick Task 260623-mn3: Taste-Aware Sparse-Pool Top-Up Summary

Taste-aware ranking for the sparse-pool catalog top-up in
`getRecommendationsForViewer` + styleTags projection onto synthetic Watch rows
so the existing rule-based rationale loop can fire `Fans of {brand} love this`
and `Matches your {style} collection` on top-up cards.

## What Changed

### `src/lib/recommendations.ts` (+2 chars)
- Added `export` to `topBrandOf` and `dominantStyleOf` function declarations
  (lines 96, 108). Bodies untouched. `topRoleOf` stays private.
- `rationaleFor`'s behavior is byte-identical — it still calls the helpers via
  lexical scope; the export is just additional visibility for the DAL.

### `src/data/recommendations.ts` (~120 line diff)

**Imports:** extended `@/lib/recommendations` import to include the two newly-
exported helpers:
```ts
import { rationaleFor, topBrandOf, dominantStyleOf } from '@/lib/recommendations'
```

**`getRecommendationsForViewer`:** after the empty-collection early-return,
derive viewer taste signals ONCE:
```ts
const viewerTopBrand = topBrandOf(viewerWatches)
const viewerDominantStyleLabel = dominantStyleOf(viewerWatches)?.label ?? null
```
Pass both into the sparse-pool branch:
```ts
await topUpFromCatalogPopularity(
  candidateMap, excluded, needed,
  viewerTopBrand, viewerDominantStyleLabel,
)
```

**`topUpFromCatalogPopularity`:** signature gains 4th + 5th params:
```ts
viewerTopBrand: string | null,
viewerDominantStyleLabel: string | null,
```
- Catalog `SELECT` projection adds `styleTags: watchesCatalog.styleTags`.
- `.limit(20)` → `.limit(60)` — broader candidate pool for the new in-memory
  scoring step (catalog is ~200 rows on prod, ~160 locally — well within
  daily-cron'd size).
- New in-memory scoring (case-insensitive on brand + style):
  ```
  score = (brand-match ? 100 : 0)
        + (style-overlap ? 50 : 0)
        + (row.ownersCount ?? 0) / 1000
  ```
- Sort: `b.score - a.score || a.row.brand.localeCompare(b.row.brand) || a.row.model.localeCompare(b.row.model)`.
  Deterministic; no PRNG; preserves the 6h rotation-window determinism property
  end-to-end.
- Synthetic Watch: `styleTags: row.styleTags ?? []` (was `[]`). `roleTags`
  stays `[]` (catalog `role_tags` is empirically 0%-populated locally).
- JSDoc rewritten to describe the new formula, the styleTags-projection
  rationale-enablement side-effect, and the two deferred items.

### `src/data/__tests__/recommendations.test.ts` (~117 line diff)
- `catalogTopUpResolver` row shape extended with `styleTags: string[]`.
- `watchesCatalog` mock factory entry extended with `styleTags`.
- `getPreferencesByUser` mock now returns a fully-formed `UserPreferences`
  (was missing `preferredStyles` et al — Rule 3 auto-fix, see Deviations).
- Case 3 body REPLACED with 6 assertions:
  1. brand-match (Rolex Datejust) ranks ahead of style-match (Seiko SKX007)
  2. style-match ranks ahead of pure-popularity (Omega, Cartier)
  3. within community-fallback bucket: Cartier < Omega (alpha)
  4. Rolex top-up rationale: `'Fans of Rolex love this'`
  5. Seiko top-up rationale: `'Matches your sport collection'` (requires
     viewer's dominant-style share > 0.5, which 3/3 'sport' Rolex fixture gives)
  6. Omega + Cartier rationale: `'Popular in the community'` (back-compat)
- Cases 1, 2, 4 and the pure-function suites (`seedFor`, `mulberry32`) are
  UNCHANGED.

## Scoring Formula (as actually implemented)

```
score = (brand-match  ? 100 : 0)   // viewer.topBrand == row.brand (case-insensitive)
      + (style-match  ? 50  : 0)   // viewer.dominantStyleLabel ∈ row.styleTags (case-insensitive)
      + (row.ownersCount ?? 0) / 1000   // sub-1 popularity additive (cannot cross +50/+100 steps)
```

Tiebreaker within the top-up function (when score is identical): brand ASC,
then model ASC. Deterministic — no PRNG.

The outer `getRecommendationsForViewer` re-sort then re-ranks the full rec
array by `c.count * 100 + RULE_MATCH_BONUS`, which flattens all
community-fallback rows to score=0 and alpha-tiebreaks by brand. This is why
test assertion 3 (Cartier < Omega) is the correct final-output ordering even
though Omega left the top-up first (0.080 > 0.060).

## Catalog Fetch LIMIT

`60` — bumped from the prior `20`. Justification: a broader candidate pool
gives the new scoring step a real chance of finding a brand-match + style-
match row even on smaller per-brand slices. The watches_catalog table is
~200 rows on prod and ~160 locally (daily pg_cron-refreshed `ownersCount`),
so 60 is 3× the prior cap and well within cost budget. The outer
`'use cache'` boundary amortizes the wider read across cache lifetime.

## Verification

| Gate | Result |
|------|--------|
| `npm run build` | exit 0 |
| `npx vitest run src/data/__tests__/recommendations.test.ts` | 10/10 pass (Cases 1/2/3/4 + 6 pure-function tests) |
| `rg "topUpFromCatalogPopularity(" src/` | 1 call site with 5 args + 1 export definition + 3 JSDoc refs |
| `rg "styleTags: row\.styleTags" src/data/recommendations.ts` | 1 hit (regression guard) |
| `rg "^export function (topBrandOf|dominantStyleOf)" src/lib/recommendations.ts` | 2 hits |
| Name collision check (`rg "function topBrandOf\|function dominantStyleOf" src/ tests/`) | Only the canonical definitions — no clashes |

## Deviations from Plan

**1. [Rule 3 - Blocking issue] `getPreferencesByUser` mock missing `UserPreferences` fields**
- **Found during:** Task 2 RED run (`npx vitest`)
- **Issue:** The existing mock returned `{ movementPreferences: [], styleTolerance: 0.5, sizeTolerance: 0.5, rolePriorities: [] }` — none of which are real `UserPreferences` fields. The real shape requires `preferredStyles`, `dislikedStyles`, `preferredDesignTraits`, `dislikedDesignTraits`, `preferredComplications`, `complicationExceptions`, `preferredDialColors`, `dislikedDialColors`, `overlapTolerance`. Worked previously because Case 3's viewer fixture had `styleTags: []` so `analyzeSimilarity`'s `watch.styleTags.some(...)` short-circuited without dereferencing the missing `preferences.preferredStyles`. The new Case 3 fixture owns three `styleTags: ['sport']` watches, which causes the `.some` callback to execute and `preferences.preferredStyles.includes(tag)` throws.
- **Fix:** Extended the `vi.mock('@/data/preferences')` factory to return a fully-formed `UserPreferences` with all required arrays empty + `overlapTolerance: 'medium'`. Added an inline comment explaining the reason.
- **Files modified:** `src/data/__tests__/recommendations.test.ts`
- **Commit:** `cd3c2efb` (folded into the RED commit — the fix is part of "make the new test runnable")

**2. [Plan intent clarification] Cartier-vs-Omega tiebreak: BOTH levels of the two-level sort matter**
- **Found during:** Task 2 GREEN verification
- **Issue:** I initially read the plan's `<behavior>` block (Cartier BEFORE Omega) as contradicting the implementation spec (`b.score - a.score || ...` with Omega.score=0.080 > Cartier.score=0.060). On first pass I wrote the test to assert Omega-before-Cartier, then traced the full flow: the top-up's internal sort DOES emit Omega first (0.080 > 0.060), but the OUTER `getRecommendationsForViewer` re-sort (`b.score - a.score || a.brand.localeCompare(b.brand)`) flattens both rows to `score = 0` (community-fallback bucket, no `RULE_MATCH_BONUS`) and the alpha tiebreaker decides — Cartier wins. The plan was correct end-to-end; my mid-analysis was wrong. Restored the assertion to match the plan's intent and added a multi-line comment in the test explaining the two-level sort semantics so a future reader doesn't repeat my confusion.
- **Resolution:** No code change; test comment expanded.
- **Files modified:** `src/data/__tests__/recommendations.test.ts`
- **Commit:** `cd3c2efb` (folded into the RED commit)

No other deviations. JSDoc updated per plan. No new imports beyond the two named helpers. No cache tag touched. No new DB join. No PRNG added. `SPARSE_POOL_THRESHOLD`, `REC_CAP`, and other constants untouched.

## Deferred (documented in the new JSDoc)

- **Role-based scoring.** Would parallel the brand/style components against
  the viewer's top role (a third `topRoleOf` helper, easily exportable).
  Intentionally omitted because `watches_catalog.role_tags` is empirically
  0%-populated locally — scoring on it is dead-on-arrival until a future
  catalog-enrichment phase backfills role_tags from the watches table.
- **`designMotifs` Jaccard against viewer's aggregated motifs.** Adds a DB
  join + per-row computation not justified at this rail's cost ceiling.
  Re-evaluate when SEED-002 hybrid recommender lands.

## Commits

| Hash | Type | Message |
|------|------|---------|
| `cd3c2efb` | test | RED — Case 3 sparse-pool top-up asserts brand>style>popularity + rationale projection |
| `9f754300` | feat | GREEN — taste-aware sparse-pool top-up + styleTags projection |

## TDD Gate Compliance

- RED commit (`test:`) present: `cd3c2efb` ✓
- GREEN commit (`feat:`) present after RED: `9f754300` ✓
- REFACTOR commit: none needed (implementation was clean on first GREEN).

## Self-Check: PASSED

- `src/lib/recommendations.ts` — modified (export added to two functions) ✓
- `src/data/recommendations.ts` — modified (new params, scoring, styleTags projection, JSDoc) ✓
- `src/data/__tests__/recommendations.test.ts` — modified (Case 3 rewritten, mocks extended) ✓
- Commit `cd3c2efb` — exists in `git log` ✓
- Commit `9f754300` — exists in `git log` ✓
- `npm run build` — exit 0 ✓
- `npx vitest run src/data/__tests__/recommendations.test.ts` — 10/10 pass ✓

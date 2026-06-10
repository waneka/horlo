---
phase: 75
plan: 02
subsystem: discovery-recommendations
tags: [recommendations, prng, rotation, sparse-pool, catalog-popularity, deterministic-sampling, next-16]
dependency_graph:
  requires: []
  provides:
    - per-viewer 6h-window deterministic sampling of the top-30 collector pool (gentle bias toward overlap quality, strong bias toward rotation)
    - exported pure helpers seedFor + mulberry32 for unit-test consumption + future-seed reuse (e.g., other personalized rail rotations)
    - exported topUpFromCatalogPopularity helper that fills the home rail to at least 8 cards on sparse pools (synthetic rows with representativeOwnerId:null + community-fallback rationale)
    - widened Recommendation.representativeOwnerId (string -> string | null) to carry the synthetic-row marker through to UI consumers
  affects:
    - src/data/recommendations.ts (algorithm body + 2 new exported helpers + 1 new mutating helper)
    - src/lib/discoveryTypes.ts (non-breaking type widening — current single consumer RecommendationCard does not deref the field)
tech_stack:
  added:
    - "mulberry32 — inline 32-bit PRNG (5 LOC, no external dependency)"
    - "deterministic-per-time-window seeded sampling — novel pattern in this codebase; reusable for other personalized-rail rotations"
    - "catalog-popularity sparse-pool fallback — novel pattern; reusable for other sparse-collection-state UX"
  patterns:
    - per-viewer + per-window PRNG seed (viewerId + floor(Date.now() / ROTATION_WINDOW_MS)) for cache-stable rotation
    - Fisher-Yates shuffle of a ranked pool followed by .slice() to bias selection toward rank while still rotating
    - Synthetic CandidateRow injection (ownerId:null) routed through the existing community-fallback rationale path — no new copy surface
key_files:
  created:
    - src/data/__tests__/recommendations.test.ts
  modified:
    - src/lib/discoveryTypes.ts
    - src/data/recommendations.ts
decisions:
  - D-06 SEED_POOL_SIZE bumped 15 -> 30 — doubles rotation surface area; Postgres cost unchanged
  - D-07 ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000 — rail rotates 4x daily; cache-stable within window
  - D-08 inline mulberry32 + seedFor (exported, no new external dep)
  - D-09 Fisher-Yates shuffle of top-30 then take first SAMPLED_SEED_SIZE (15)
  - D-10 topUpFromCatalogPopularity fires when candidateMap.size < SPARSE_POOL_THRESHOLD (8); LIMIT 20
  - D-11 top-up uses watchesCatalog.ownersCount ONLY (not + wishlistCount) — ownership matches the rail title
  - D-12 Recommendation.representativeOwnerId widened to string | null; synthetic rows emit null
  - D-13 synthetic rows route through existing community-fallback rationale 'Popular in the community' (no new template)
  - D-14 top-up determinism comes from daily pg_cron refresh of ownersCount (03:00 UTC) — no PRNG needed
  - D-16 NEW test file with 4 D-16 cases + 6 pure-function smoke tests (10 total)
  - D-17 jsdom default — no vitest environment-override directive
metrics:
  duration: ~8min
  completed: 2026-05-30
  tasks_completed: 3
  files_changed: 3
  commits: 3
---

# Phase 75 Plan 02: Recommendations Rotation + Sparse-Pool Top-Up Summary

Closed the DISC-RECS-VARIATION gap: `getRecommendationsForViewer` now samples 15 collectors from a top-30 pool using a viewerId+6h-window-seeded `mulberry32` PRNG (same window = same recs cache-stable; next window = different recs = rail rotates 4× daily) and falls back to catalog-popularity rows when post-exclusion candidate pool drops below 8 — eliminating the "same two watches always" symptom on small user bases.

## What Built

1. **Type widening — `Recommendation.representativeOwnerId: string | null`** (`src/lib/discoveryTypes.ts`)
   - Changed line 16 from `representativeOwnerId: string` to `representativeOwnerId: string | null` with a JSDoc block citing Phase 75 D-12, naming the synthetic-row source (`topUpFromCatalogPopularity()`), and reminding consumers to null-guard if they ever render owner-attribution UI.
   - `RecommendationCard.tsx` inspection-verified: does NOT dereference `rec.representativeOwnerId` anywhere in JSX — only `rec.representativeWatchId` (link href), `rec.brand`, `rec.model`, `rec.imageUrl`, `rec.rationale`. No card change required.
   - Non-breaking widening — all existing call sites populating with a string still compile.

2. **Rotation + sparse-pool top-up in `getRecommendationsForViewer`** (`src/data/recommendations.ts`)
   - **D-06 (SEED_POOL_SIZE 15→30)** with updated JSDoc explaining the pool/sample split.
   - **D-07 (ROTATION_WINDOW_MS)** new constant `6 * 60 * 60 * 1000` with JSDoc explaining the rotation cadence + cache-stability rationale.
   - **D-09 / sampling block** new constants `SAMPLED_SEED_SIZE = 15` + `SPARSE_POOL_THRESHOLD = 8`. After the existing `.sort + .slice(0, SEED_POOL_SIZE)` produces the ranked top-30, compute `const windowBucket = Math.floor(Date.now() / ROTATION_WINDOW_MS)`, instantiate `const rng = mulberry32(seedFor(viewerId, windowBucket))`, Fisher-Yates shuffle the 30-entry array in place, then take `seeds = rankedTop30.slice(0, SAMPLED_SEED_SIZE)` — the highest-overlap collectors still bias toward selection (~50% of top-15 by rank hit the post-shuffle first-15 on average) but rotation surfaces collectors 16–30 too.
   - **D-08 (exported helpers)** appended at file bottom:
     - `export function seedFor(viewerId: string, windowBucket: number): number` — djb2-style cheap deterministic 32-bit hash (`((h << 5) - h + charCode) >>> 0`).
     - `export function mulberry32(seed: number): () => number` — canonical 5-line implementation; pure (state lives in returned closure).
   - **D-10 / D-11 / D-12 / D-13 / D-14 (top-up)** appended at file bottom:
     - `export async function topUpFromCatalogPopularity(candidateMap, excluded, needed)` — mutates `candidateMap` in place; queries `db.select({...}).from(watchesCatalog).orderBy(desc(watchesCatalog.ownersCount), asc(watchesCatalog.brand)).limit(20)`; filters out rows whose normalized `(brand|model)` key is in `excluded` or already in `candidateMap`; appends up to `needed` synthetic `{ key, watch, ownerId: null, count: 0 }` entries.
     - Synthetic Watch shape uses `id: row.id` (catalog row id), empty tag arrays (so no rule-template fires in `rationaleFor`), and `imageUrl: row.imageUrl ?? undefined` (coalesces nullable DB column to optional type-field).
   - **CandidateRow type widening** — `ownerId: string` → `ownerId: string | null` with inline JSDoc explaining the synthetic-row use case. The downstream map step that builds the `Recommendation` array reads `c.ownerId` directly into `representativeOwnerId`, so the synthetic-row marker flows through without further changes.
   - **Sparse-pool guard insertion** — between the candidate-build loop and the `// 7. Score + rationale per candidate.` block: `if (candidateMap.size < SPARSE_POOL_THRESHOLD) { const needed = SPARSE_POOL_THRESHOLD - candidateMap.size; await topUpFromCatalogPopularity(candidateMap, excluded, needed); }`.
   - **Imports extended** — `drizzle-orm` now also imports `asc, desc`; `@/db/schema` now also imports `watchesCatalog`.
   - **Public contract preserved** — `getRecommendationsForViewer(viewerId: string): Promise<Recommendation[]>` signature unchanged; REC_CAP=12 final-slice preserved; sort-by-score DESC preserved; existing rationale path unchanged.

3. **Regression test file — `src/data/__tests__/recommendations.test.ts`** (NEW, 413 LOC, 10 tests)
   - **Pure-function group A — `seedFor` (3 tests):** same (viewerId, windowBucket) → same output; different viewerId → different output; different windowBucket → different output.
   - **Pure-function group B — `mulberry32` (3 tests):** same seed → same emitted sequence; different seed → different first emission; emissions land in `[0, 1)`.
   - **Integration group — `getRecommendationsForViewer` (4 D-16 cases):**
     1. **window-determinism** — two calls at different times within the same 6h bucket return identical ordered rec ids.
     2. **cross-window-rotation** — two calls in different 6h buckets produce a different ordering or set (proxy for "rotation happened").
     3. **sparse-pool top-up** — 2 peers + 7 catalog rows → recs.length ≥ 8; ≥1 rec has `representativeOwnerId === null`; all null-owner recs have `rationale === 'Popular in the community'` (D-13 enforcement).
     4. **no-regression-on-full-pool** — 30 peers each owning unique watches → recs.length === REC_CAP (12); no rec has `representativeOwnerId === null`; defensive call-count assertion that the catalog top-up resolver was NOT invoked.
   - **Mock surface:** Single `vi.mock('@/db')` exposes a fluent-chain factory that routes the terminal await by which schema symbol was passed to `.from()` (profiles → publicProfilesResolver; watchesCatalog → catalogTopUpResolver). `vi.mock('@/db/schema')` provides tagged shells so the chain factory can identify the table. Per-user DALs (`@/data/watches`, `@/data/preferences`, `@/data/wearEvents`) are mocked to control the seed pool's owned-watches lists deterministically. `vi.useFakeTimers()` + `vi.setSystemTime(new Date(bucket * ROTATION_WINDOW_MS + 100))` controls the 6h windowBucket.
   - **D-17 compliance:** No vitest environment-override directive — jsdom default. No filesystem walking (distinct from Phase 74 D-11/D-12 static guards).

## Deviations from Plan

### Auto-fixed Issues

None. The plan executed exactly as written. The plan's `<verify>` for Task 3 contained a regex (`! grep -q "@vitest-environment node"`) that would false-positive against doc-comments that document the *absence* of the pragma; I rephrased the doc-comment to say "no vitest environment-override directive" so the verify regex passes cleanly. The semantic — D-17 jsdom-default with no env-override — is unchanged.

### Plan verify-spec observations (informational, not deviations)

- Plan Task 1's automated chain `! grep -q "rec\.representativeOwnerId" /Users/.../RecommendationCard.tsx || grep -qE "rec\.representativeOwnerId\s*(\?\??|&&)" ...` correctly hit the first branch (the file does not reference the field at all, so no edit was needed).
- Plan Task 2's `grep -vE "^\s*//|^\s*\*" ... | grep -qE "wishlistCount"` D-11 enforcement passes — the only references to `wishlist`/`grail` in the code body are inside the existing `excluded` Set construction (`v.status === 'wishlist'`), which is unrelated to D-11 (D-11 is about the top-up popularity score using `ownersCount` only, not viewer-exclusion logic).
- Plan Task 3's expected ≥4 case-keyword matches resolved to 27 — comments inside the test file mention the case names multiple times.

## Verification

- `npm run build` exits 0 (the gate per `project_baseline_not_green_build_is_gate` memory). Confirmed after Task 1, Task 2, Task 3, and final preflight.
- `npx vitest run src/data/__tests__/recommendations.test.ts` → `Test Files 1 passed (1) / Tests 10 passed (10) / Duration ~440ms`.
- `npx vitest run tests/lib/recommendations.test.ts` → 8 passed (no regression in the rationale templates that D-13 reuses).
- D-NN grep markers (all PASS):
  - `grep -q "const SEED_POOL_SIZE = 30" src/data/recommendations.ts` — D-06
  - `grep -q "ROTATION_WINDOW_MS = 6 \* 60 \* 60 \* 1000" src/data/recommendations.ts` — D-07
  - `grep -q "export function mulberry32" src/data/recommendations.ts` — D-08
  - `grep -q "export function seedFor" src/data/recommendations.ts` — D-08
  - `grep -q "topUpFromCatalogPopularity" src/data/recommendations.ts` — D-10
  - `grep -q "desc(watchesCatalog.ownersCount)" src/data/recommendations.ts` — D-11
  - `grep -vE "^\s*//|^\s*\*" src/data/recommendations.ts | grep -q "wishlistCount"` → no match — D-11 enforcement
  - `grep -q "representativeOwnerId: string | null" src/lib/discoveryTypes.ts` — D-12
  - `! grep -q "rec\.representativeOwnerId" src/components/home/RecommendationCard.tsx` — D-12 verification (no consumer dereference)
  - `! grep -q "@vitest-environment node" src/data/__tests__/recommendations.test.ts` — D-17
- `git diff HEAD~3 HEAD -- tests/data/getRecommendationsForViewer.test.ts | wc -l` → 0 (existing DB-integration test file untouched).
- `grep -n font-medium` across the 3 modified files + the new test file → 0 matches (font-semibold > font-medium guardrail per `project_phase_68_complete` upheld).

## Success Criteria

- **DISC-RECS-VARIATION requirement satisfied:** `getRecommendationsForViewer` samples 15 from the top-30 deterministically per `(viewerId, 6h windowBucket)` — same window same recs, next window different recs.
- **Sparse-pool top-up activates** when `candidateMap.size < SPARSE_POOL_THRESHOLD` and appends synthetic catalog-popularity recs with `representativeOwnerId: null` + rationale `"Popular in the community"` (existing community-fallback per D-13).
- **D-12 type widening completed non-breakingly;** `RecommendationCard.tsx` already handles `null` (does not deref the field).
- **D-16 regression test file (10 tests, 4 D-16 cases) green** via targeted `npx vitest run src/data/__tests__/recommendations.test.ts`.
- **Build green;** targeted test green; no font-medium introductions; no destructive git operations; no `git clean`/`git rm`/blanket-reset usage.

## Known Stubs

None. The top-up rows are synthetic by design (Phase 75 D-12), not stubs — they carry real catalog data (brand, model, imageUrl, id) with a deliberate `ownerId: null` marker that the type system surfaces and consumers null-guard against. The synthetic Watch's empty tag arrays (`styleTags: []`, `roleTags: []`, etc.) are NOT stubs either — they intentionally route through the existing community-fallback rationale per D-13, which is the desired UX for catalog-popularity rows ("we're showing this because it's popular generally").

## Threat Flags

None. The new `topUpFromCatalogPopularity` query reads from `watches_catalog` which is service-role-write / public-read RLS (per D-11) — same data already exposed via `/explore` and existing Trending rails. No new trust-boundary surface; threat register entries T-75-02-01 through T-75-02-04 from the PLAN remain accurate.

## Self-Check: PASSED

**Files exist:**
- `/Users/tylerwaneka/Documents/horlo/src/lib/discoveryTypes.ts` — FOUND
- `/Users/tylerwaneka/Documents/horlo/src/data/recommendations.ts` — FOUND
- `/Users/tylerwaneka/Documents/horlo/src/data/__tests__/recommendations.test.ts` — FOUND

**Commits exist:**
- `cf7ac0e1` — FOUND (Task 1: widen representativeOwnerId)
- `40630748` — FOUND (Task 2: rotation + top-up)
- `896a0d9c` — FOUND (Task 3: regression test file)

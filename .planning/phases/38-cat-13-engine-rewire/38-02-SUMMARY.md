---
phase: 38-cat-13-engine-rewire
plan: 02
subsystem: similarity-engine
tags: [engine, similarity, taste, dal, leftjoin, tdd, test-first, cat-13]
dependency_graph:
  requires: [38-01]
  provides: [taste-aware-similarity-engine, getWatchesByUser-with-catalogTaste]
  affects: [src/lib/similarity.ts, src/data/watches.ts, src/lib/types.ts]
tech_stack:
  added: []
  patterns: [D-05-constant-transformation, D-13-test-first-ordering, drizzle-leftjoin, cosine3D]
key_files:
  created:
    - tests/fixtures/catalogTaste.ts
    - tests/static/similarity.taste-null.test.ts
    - tests/static/similarity.taste-present.test.ts
    - src/data/__tests__/watches-leftjoin.test.ts
  modified:
    - src/lib/types.ts
    - src/data/watches.ts
    - src/lib/similarity.ts
decisions:
  - "D-05 transformation pattern: EXISTING_WEIGHTS_BASE * EXISTING_SCALE — no hardcoded rescaled values"
  - "D-13 test-first ordering: taste-null (passes before rewire) + taste-present (fails RED before rewire, GREEN after)"
  - "D-02 binary gate: confidence < 0.5 on either watch → taste contribution = 0 (byte-identical to pre-rewire)"
  - "D-11 LEFT JOIN (not INNER): graceful degradation if catalog row deleted mid-flight"
  - "taste == null guard: Drizzle LEFT JOIN miss returns null for entire taste object, not just null fields"
metrics:
  duration: "8 minutes"
  completed: "2026-05-12"
  tasks_completed: 6
  files_modified: 3
  files_created: 4
  commits: 6
---

# Phase 38 Plan 02: Engine Rewire Summary

**One-liner:** Taste-aware similarity scoring: analyzeSimilarity gains a 9th dimension (confidence-gated cosine3D + archetype + era + Jaccard motifs at outer weight 0.20) with D-05 constant transformation, D-13 test-first audit trail, and DAL LEFT JOIN populating `catalogTaste` on every `Watch`.

## What Was Built

Phase 19.1's LLM-derived taste columns on `watches_catalog` (formality, sportiness, heritageScore, primaryArchetype, eraSignal, designMotifs, confidence) stopped being silent infrastructure and now produce observable behavior in collection fit verdicts for the first time.

**Practical result:** Two watches with identical user-applied tags (e.g., a Speedy and a Submariner both tagged "dive") will now score differently based on their catalog taste profiles — the Speedy's chrono archetype and vintage-leaning era diverges from the Sub's dive archetype and modern era, producing a lower compatibility score.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 0 | `508f59e` | feat(types,data): add Watch.catalogTaste + getWatchesByUser LEFT JOIN (Phase 38 D-10/D-11) |
| Task 1 | `31a192a` | test(fixtures): add catalogTaste fixtures for Phase 38 static guards (D-14) |
| Task 2 | `7054176` | test(static): add similarity.taste-null guard test (Phase 38 CAT-13 #1, D-13 RED-baseline) |
| Task 3 | `3cfc45b` | test(static): add similarity.taste-present guard test — RED baseline (Phase 38 CAT-13 #2, D-13) |
| Task 4 | `8a2fcf0` | feat(similarity): rewire analyzeSimilarity with 9th taste dimension (Phase 38 CAT-13 #2/#3) |
| Task 5 | `4134e1c` | test(data): add getWatchesByUser LEFT JOIN observability test (Phase 38 CAT-13 #4) |

## D-13 Audit Trail

| Test File | Commit | Relative to Engine Rewire |
|-----------|--------|--------------------------|
| tests/static/similarity.taste-null.test.ts | `7054176` | precedes `8a2fcf0` (ancestor) |
| tests/static/similarity.taste-present.test.ts | `3cfc45b` | precedes `8a2fcf0` (ancestor) |
| src/lib/similarity.ts rewire | `8a2fcf0` | engine rewire |

Verified: `git merge-base --is-ancestor <taste-present-commit> <engine-rewire-commit>` exits 0.

**RED→GREEN transition:** taste-present test committed in RED state (both it() blocks fail with `expected 0.199... to be greater than 0.199...` — pre-rewire engine ignores catalogTaste so compatible/incompatible pairs score identically). After Task 4, both pass because cosine3D + archetype match produce higher contrib for compatible pairs.

## Must-Have Truths Verification

| Truth | Status |
|-------|--------|
| Watch.catalogTaste: CatalogTasteAttributes | null field exists in src/lib/types.ts (D-10) | PASS — line 86 |
| getWatchesByUser LEFT JOINs watches_catalog and populates catalogTaste (D-11) | PASS — leftJoin at line 142 of watches.ts |
| Numeric columns coerced via Number() at DAL mapper boundary (RESEARCH Pitfall 2) | PASS — 4 Number() calls (formality, sportiness, heritageScore, confidence) |
| tests/fixtures/catalogTaste.ts exists with 9 typed fixtures (D-14) | PASS — 9 named exports verified |
| similarity.taste-null.test.ts committed BEFORE engine rewire, passes against pre-rewire | PASS — commit 7054176 precedes 8a2fcf0 |
| similarity.taste-present.test.ts committed BEFORE engine rewire, FAILS RED against pre-rewire | PASS — commit 3cfc45b precedes 8a2fcf0; confirmed RED on pre-rewire run |
| WEIGHTS uses D-05 transformation pattern — no magic numbers | PASS — EXISTING_WEIGHTS_BASE + TASTE_WEIGHT + EXISTING_SCALE pattern; grep anti-pattern empty |
| analyzeSimilarity adds 9th taste dimension at 0.20, internally split 0.40/0.20/0.20/0.20 | PASS — TASTE_SUB_WEIGHTS constant; cosine3D + archetype + era + motifs |
| Taste gates at confidence >= 0.5 on BOTH sides (D-02 binary gate) | PASS — line 108 of similarity.ts |
| arrayOverlap REUSED for motifs Jaccard (D-03) | PASS — 8 total arrayOverlap usages; no second Jaccard helper |
| Both static tests pass AFTER engine rewire (CAT-13 #3) | PASS — 7/7 tests green |

## Key Decisions

1. **D-05 transformation, not hardcoding:** EXISTING_WEIGHTS_BASE × EXISTING_SCALE rescales all 8 legacy weights to 0.80 sum, then `taste: TASTE_WEIGHT` adds the 9th at 0.20. The anti-pattern check (`grep -E "0\.20.*styleTags|styleTags.*0\.20"`) returns empty.

2. **`taste == null` guard for LEFT JOIN miss:** Drizzle returns the entire `taste` projection as `null` when a LEFT JOIN finds no matching row (not just the individual fields as null). The mapper guards with `taste == null ||` before accessing taste fields.

3. **All-null numeric coercion preserves NULL semantics:** When postgres-js returns `null` for a numeric column, `Number(null) = 0` would be incorrect. The mapper pattern `taste.formality !== null ? Number(taste.formality) : null` correctly preserves null for unset numeric columns while coercing string-numeric to number.

4. **Null-null check for "empty catalog row":** `taste.confidence === null && taste.formality === null` detects a catalog row that exists but has no taste data populated yet. Returning `null` (not `{ formality: null, ... }`) for this case means the engine's `if (!t1 || !t2) return 0` gate fires correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LEFT JOIN null object guard**
- **Found during:** Task 0 verification (TypeScript errors in watches.ts)
- **Issue:** Plan's drop-in code used `taste?.confidence === null && taste?.formality === null` which doesn't handle the case where `taste` itself is `null` (not just its fields). TypeScript correctly flagged 12 `TS18047: 'taste' is possibly 'null'` errors.
- **Fix:** Changed condition to `taste == null || (taste.confidence === null && taste.formality === null)` — the `taste == null` check short-circuits for LEFT JOIN misses before accessing any fields.
- **Files modified:** src/data/watches.ts (line 151)
- **Commit:** 508f59e

## Known Stubs

None — all taste data flows from real catalog rows via the LEFT JOIN; no hardcoded placeholder values introduced.

## Threat Flags

No new trust boundaries introduced. LEFT JOIN reads `watches_catalog` (existing public-read RLS per Phase 17 D-06). No new RPCs, no SECURITY DEFINER, no new auth surface.

## Plan C Dependency

Engine is now taste-aware. `analyzeSimilarity` produces higher scores for taste-compatible pairs (verified by tests/static/similarity.taste-present.test.ts). Plan 38-03 (composer-engine alignment / verdict bundle integration) can now test the full taste → score → label pipeline.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| tests/fixtures/catalogTaste.ts | FOUND |
| tests/static/similarity.taste-null.test.ts | FOUND |
| tests/static/similarity.taste-present.test.ts | FOUND |
| src/data/__tests__/watches-leftjoin.test.ts | FOUND |
| 38-02-SUMMARY.md | FOUND |
| Commit 508f59e | FOUND |
| Commit 31a192a | FOUND |
| Commit 7054176 | FOUND |
| Commit 3cfc45b | FOUND |
| Commit 8a2fcf0 | FOUND |
| Commit 4134e1c | FOUND |

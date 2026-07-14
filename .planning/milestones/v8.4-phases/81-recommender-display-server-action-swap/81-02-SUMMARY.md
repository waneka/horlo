---
phase: 81-recommender-display-server-action-swap
plan: 02
subsystem: recommender read path / DAL / lib
tags:
  - phase-81
  - recommender
  - read-path
  - canonical-identity
  - inner-join
  - fk-keyed-exclusion
dependency-graph:
  requires:
    - Plan 01 Watch.brandId?/familyId? projection + brands/watch_families schema availability
  provides:
    - topBrandOf widened signature (brandNameLookup: Map<string, string>) → { brandId, brandName } | null
    - RationaleContext.viewerTopBrand pre-computed field
    - Recommender exclusion set + candidateMap + synthetic top-up all key on brand_id/family_id
    - topUpFromCatalogPopularity INNER JOINs brands + watch_families; synthetic Watch carries brandId/familyId
    - Owned-brand IN clause switched to watches_catalog.brand_id (canonical FK)
  affects:
    - Plan 03 (Server Action canonical overwrite) — orthogonal; Plan 03 changes writes, Plan 02 changes reads
    - Plan 04 (local-first drift-fixture UAT) — Phase 81's silent-bug gate lands here
tech-stack:
  added: []
  patterns:
    - Module-scope `excludeKey(w)` shared helper for three-site keying identity (Pitfall 5 mitigation)
    - brandNameLookup Map built inside function scope (T-81-P02-01 cross-viewer poisoning mitigation)
    - `IN (sql.join(arr.map(id => sql\`${id}\`), sql\`, \`))` for brandId array (anti-pitfall correct per [[drizzle-sql-any-array-pitfall]])
    - Empty-array guard on sql.join (Pitfall 2 mitigation)
    - INNER JOIN brands + watch_families safe under Phase 80 NOT NULL guarantee (T-81-P02-06 accepted)
    - Pre-computed viewerTopBrand threaded through rationaleFor ctx (avoids N² per-candidate re-derivation)
key-files:
  created:
    - .planning/phases/81-recommender-display-server-action-swap/81-02-SUMMARY.md
  modified:
    - src/lib/recommendations.ts
    - src/data/recommendations.ts
    - tests/lib/recommendations.test.ts
    - src/data/__tests__/recommendations.test.ts
decisions:
  - Extracted `excludeKey(w)` to a module-scope helper (rather than inlining at three sites) — Pitfall 5 identity property is guaranteed by construction; grep audit tracks 7 sites (helper def + `norm = excludeKey` alias + 3 call sites + `excludeKey(row)` inside top-up + JSDoc).
  - `viewerTopBrand` pre-computed once in DAL and threaded through RationaleContext (Option b per RESEARCH § "Simpler recommendation"); avoids threading brandNameLookup through the pure rationaleFor function's ctx and removes N² per-candidate re-derivation.
  - Kept the `${brand}|${model}` lowercase-trim exclusion-key fallback (belt-and-suspenders per D-81-02 Deferred Idea §Stripping fallback) — post-Phase-80 all catalog rows have FKs, but Phase 17 `onDelete: 'set null'` legacy watches still yield brandId=undefined via LEFT JOIN.
  - brandCount variety cap keys on canonical brand_id (fallback to lowercased-brand-string for legacy peer-pool watches) — closes the "Hamilton + Hamilton Watch counted as separate brands under the cap" corner case implicit in RECO-02.
  - Popularity SELECT tiebreak switched from `watchesCatalog.brand` (drift-prone denorm) to `brands.name` (canonical, JOIN-derived) — minor deterministic-ordering drift acknowledged, aligns with the phase's intent.
  - Task 1 committed a minimal glue-line in src/data/recommendations.ts (passing `new Map<string, string>()` into topBrandOf) so `npm run build` exits 0 at the Task 1 boundary; Task 2 replaced the glue with the real brandNameLookup wire-up.
metrics:
  duration: 17m
  completed: 2026-07-12
  tasks_completed: 2/2
  files_modified: 4
  commits: 2
---

# Phase 81 Plan 02: Recommender Read-Path Swap Summary

**One-liner:** Swapped recommender exclusion + scoring keys from free-text `brand|model` strings to canonical `brandId|familyId` FK identity — closes RECO-01/02/03/04 by keying on `watches_catalog.brand_id` (owned-brand IN clause), pre-computing `viewerTopBrand: { brandId, brandName }` once per request via a per-request-scoped `brandNameLookup` Map, and adding INNER JOINs on `brands` + `watch_families` inside `topUpFromCatalogPopularity` so synthetic top-up rows surface canonical display strings AND carry FK identity for Pitfall-5-proof exclusion-set matching.

## Tasks Executed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Widen topBrandOf + restructure RationaleContext (viewerTopBrand) + tests/lib/recommendations.test.ts fixtures + 3 new topBrandOf cases | 95e090e3 | ✓ |
| 2 | Swap exclusion + brandNameLookup + INNER JOINs + brand_id IN clause + synthetic Watch FK propagation + src/data/__tests__/recommendations.test.ts extensions | a28a6615 | ✓ |

## File Diff Shape

| File | Before (approx LOC) | After (approx LOC) | Change |
|------|--------------------:|-------------------:|:------:|
| src/lib/recommendations.ts | 134 | 195 | +61 — RationaleContext.viewerTopBrand, topBrandOf(brandNameLookup) signature + Pitfall 6 defensive null-return, JSDoc tripled for D-81-05 |
| src/data/recommendations.ts | 533 | 636 | +103 — excludeKey helper, brandNameLookup + viewerOwnedBrandIds (Set<uuid>) construction, INNER JOINs × 2, synthetic Watch brandId/familyId, `IN (sql.join(...))` on brand_id, threaded viewerTopBrand through rationaleFor ctx |
| tests/lib/recommendations.test.ts | 156 | 215 | +59 — mkWatch factory absorbs brandId, 8 rationaleFor tests updated with viewerTopBrand ctx, 3 new topBrandOf(watches, lookup) cases |
| src/data/__tests__/recommendations.test.ts | 572 | 807 | +235 — schema mock gains brandId/familyId + brands/watchFamilies tags, fluent-chain routes brands SELECTs to brandNameLookupResolver, catalogTopUpResolver row shape gains brandId/familyId (10 rows updated), Case 3 viewer fixture updated with brandIds, 3 new Phase 81 describe cases (Pitfall 5 identity + FK propagation + Pitfall 2 empty guard) |

## Interface Contracts Emitted

**src/lib/recommendations.ts** (consumed by Plan 03's editWatch/addWatch overwrite paths):
- `interface RationaleContext { …; viewerTopBrand: { brandId: string; brandName: string } | null }` — caller (DAL) pre-computes.
- `function topBrandOf(watches, brandNameLookup): { brandId: string; brandName: string } | null` — widened; filters `w.status === 'owned' && w.brandId`, counts by `w.brandId!`, resolves brandName via lookup with defensive `?? ''` tiebreak + null-return-on-miss (Pitfall 6).

**src/data/recommendations.ts** (module-internal — no exports change):
- `function excludeKey(w: { brandId?; familyId?; brand; model }): string` — private module-scope, called at 3 sites for Pitfall 5 identity guarantee.
- `getRecommendationsForViewer(viewerId)` return shape UNCHANGED — Plan 02 is a read-path internal swap.
- `topUpFromCatalogPopularity` signature widened: `viewerTopBrand: { brandId, brandName } | null` (was `string | null`); `viewerOwnedBrandIds: Set<string>` (was `viewerOwnedBrandsLower: Set<string>`).

## Verification

- **`npm run build` → exits 0** — 7.3s (7.6s at first pass, 7.3s post grep-armor reword). Authoritative gate per `[[baseline-not-green-build-is-gate]]`.
- **`npm run test -- src/data/__tests__/recommendations.test.ts tests/lib/recommendations.test.ts` → 24/24 pass** (13 DAL + 11 lib) in 819ms. Phase 75 D-16 4-case suite (window-determinism, cross-window-rotation, sparse-pool top-up with all 260623-mn3 + 260623-pzz assertions, no-regression-on-full-pool) fully preserved; Phase 81 adds 3 new DAL cases + 3 new lib cases.
- **Forward-armor grep counts (final):**
  - `grep -c "= ANY(" src/data/recommendations.ts src/lib/recommendations.ts` → **0** (drizzle SQL anti-pattern intentionally NOT introduced; false-positive comment reworded — same recurrence handled in Plan 01 Task 2).
  - `grep -c "sql.join" src/data/recommendations.ts` → **5** (was 2 pre-Phase-81 — the popularity path's owned-brand-in path + new brandNameLookup IN clause; ≥ 2 required).
  - `grep -n "innerJoin.*brands\|innerJoin.*watchFamilies" src/data/recommendations.ts` → **4 matches** (2 per SELECT × 2 SELECTs, ≥ 4 required).
  - `grep -c "excludeKey\|norm(" src/data/recommendations.ts` → **7** (helper def + `norm = excludeKey` alias + 3 call sites + inline `excludeKey(row)` in top-up + JSDoc references; ≥ 3 required).
- **Threat register verified in code:**
  - T-81-P02-01 (cross-viewer poisoning): brandNameLookup Map construction inspection — `new Map<string, string>(` appears INSIDE `getRecommendationsForViewer` body at L124, never at module scope. Confirmed by `grep -n "new Map<string, string>(" src/data/recommendations.ts` → 1 match, inside the function.
  - T-81-P02-02 (`= ANY(${arr})` reintroduction): 0 grep matches.
  - T-81-P02-03 (empty sql.join): guarded by `viewerBrandIds.length === 0 ? [] : await db.select(...)` (brandNameLookup path) + `viewerOwnedBrandIds.size > 0` (owned-brand IN clause path). Test Case 7 exercises the brandNameLookup guard.
  - T-81-P02-04 (Pitfall 5 self-in-own-rail): single `excludeKey(w)` helper called at all three sites — identity guarantee by construction. Test Case 5 exercises with a canonical Hamilton drift fixture.
  - T-81-P02-05 (brandNameLookup miss): defensive `?? ''` in topBrandOf tiebreak + null-return when winner's brandName is undefined — inspected in src/lib/recommendations.ts L166-168.
  - T-81-P02-06 (INNER JOIN row loss): Post-Phase-80 NOT NULL FKs — accepted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 boundary requires `npm run build` exit 0; caller in src/data/recommendations.ts breaks under new topBrandOf sig**

- **Found during:** Task 1, first `npm run build` after widening topBrandOf signature.
- **Issue:** Task 1's PLAN says `<done>` includes `npm run build` exits 0. The Task 1 change to `topBrandOf(watches, brandNameLookup)` breaks the existing L111 caller `topBrandOf(viewerWatches)` (1-arg call site). Task 2 replaces the caller with the real brandNameLookup wire-up — but Task 1 must independently satisfy build.
- **Fix:** Added minimal glue in src/data/recommendations.ts at Task 1: passes `new Map<string, string>()` into `topBrandOf(viewerWatches, new Map(...))` + widened `topUpFromCatalogPopularity` param type to `{ brandId; brandName } | null` + threaded `viewerTopBrand` through the L262 rationaleFor ctx. Task 2 replaced the glue with the real brandNameLookup construction + `viewerOwnedBrandIds` (Set<uuid>) wire-up. Same commit-boundary pattern as Plan 01 Task 1's Watch-type-widening → DAL projection sequencing.
- **Files modified:** src/data/recommendations.ts (Task 1 glue lines 111 + widened topUpFromCatalogPopularity signature + rationaleFor ctx field).
- **Commit:** 95e090e3

**2. [Rule 1 - Bug] In-file comment strings matched grep armor as false positives**

- **Found during:** Task 2 verify step (`grep -c "= ANY(" src/data/recommendations.ts` returned 2).
- **Issue:** Two Phase 81 comments in `src/data/recommendations.ts` (added to explicitly declare that the anti-pattern is NOT introduced) used the literal string `` `= ANY(${arr})` `` in prose. The plan's verify step `grep -c "= ANY(" src/data/recommendations.ts` returned 2 (both from comments), which violates the "grep armor holds" contract even though semantics were safe. Same recurrence as Plan 01 Task 2 Rule 1 deviation #3.
- **Fix:** Reworded the offending comment to `Drizzle sql-ANY-array anti-pattern intentionally NOT introduced` + `forward-armor grep for the anti-pattern returns 0` — same intent, no literal-substring hit. Post-reword grep-armor returns 0 across both src/data + src/lib files.
- **Files modified:** src/data/recommendations.ts
- **Commit:** a28a6615 (in same task's commit — reword before final grep)

## Runtime Observations

- **Test durations:** src/data/__tests__/recommendations.test.ts (13 tests) 17ms; tests/lib/recommendations.test.ts (11 tests) 3ms. Combined 24 tests in 819ms including transform + setup + environment overhead — no perceptible slowdown vs pre-Phase-81 baseline.
- **Build durations:** Task 1 boundary build 6.6s; Task 2 pre-reword build 7.6s; Task 2 post-reword final build 7.3s. Within noise of Plan 01's 7.8s. No perceptible TypeScript-pass regression from the added INNER JOINs / helper additions.
- **brandNameLookup construction confirmed inside function body:** `grep -n "new Map<string, string>(" src/data/recommendations.ts` returns 1 match at L124 (inside `getRecommendationsForViewer` body). No module-scope Map instantiation. T-81-P02-01 satisfied structurally.
- **Local-First Development gate:** Per D-81-04, the drift-fixture walkthrough is milestone-close verification (Plan 04's responsibility). Plan 02 is code-only + fully unit-test-covered; no schema change to migrate. Local Supabase running (verified `docker ps` shows `supabase_db_horlo` healthy on port 54322) — bundled walkthrough will land at Plan 04.

## Requirements Marked Complete

**RECO-01, RECO-02, RECO-03, RECO-04** — the recommender read path now keys on canonical FK identity. Ratified by:
- RECO-01: exclusion set keys on `brandId|familyId` with fallback (excludeKey helper, 3-site identity).
- RECO-02: owned-brand IN clause switches to `watches_catalog.brand_id` via `sql.join(brandArr.map(id => sql\`${id}\`), sql\`, \`)` — Hamilton + Hamilton Watch both trigger +100 boost against canonical Hamilton brand_id.
- RECO-03: topBrandOf counts by `w.brandId` with brandNameLookup wiring; legacy `brandId=undefined` rows excluded from counting.
- RECO-04: rationaleFor's brand-match template renders canonical `brandName` via viewerTopBrand.brandName (pre-computed by DAL from brands.name).

## Self-Check: PASSED

- File `.planning/phases/81-recommender-display-server-action-swap/81-02-SUMMARY.md` created (this file).
- Commit `95e090e3` exists in git log (Task 1 — topBrandOf + RationaleContext widening).
- Commit `a28a6615` exists in git log (Task 2 — recommender read-path canonical FK swap).
- `npm run build` last run exits 0 in 7.3s.
- 24/24 targeted vitest tests pass (11 lib + 13 DAL).
- Forward-armor `= ANY(` returns 0 across both src/data/recommendations.ts + src/lib/recommendations.ts.
- Grep-verified: `innerJoin.*brands|watchFamilies` returns 4 matches; `sql.join` returns 5 matches; `excludeKey|norm(` returns 7 matches.
- brandNameLookup construction verified inside `getRecommendationsForViewer` function body (T-81-P02-01 satisfied by construction + inspection).
- Plans 03 + 04 can consume the widened topBrandOf + RationaleContext.viewerTopBrand contracts without further lib/DAL work.

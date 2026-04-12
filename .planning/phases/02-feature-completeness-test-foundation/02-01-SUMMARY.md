---
phase: "02"
plan: "01"
subsystem: types-schema
tags: [types, schema, uuid, feat-06]
requirements: [FEAT-06]
dependency_graph:
  requires: []
  provides:
    - "Watch.productionYear field"
    - "Watch.isFlaggedDeal field"
    - "CollectionGoal = 'brand-loyalist'"
    - "crypto.randomUUID-based ID generation"
  affects:
    - "02-02 (collection goals)"
    - "02-03 (gap-fill uses CollectionGoal)"
    - "02-04 (isFlaggedDeal consumers)"
    - "02-05 (productionYear form + display)"
tech_stack:
  added: []
  patterns:
    - "crypto.randomUUID() for new watch IDs (browser + Node 19+ global)"
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - src/store/watchStore.ts
decisions:
  - "Widen CollectionGoal union (brand-loyalist); heritage-only + value-hunter deferred"
  - "productionYear + isFlaggedDeal added as optional fields; no data migration"
  - "No migration of existing Date.now()-based IDs — only new watches use UUID v4"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-04-11"
  tasks_completed: 2
---

# Phase 02 Plan 01: Type + ID Foundation Summary

One-liner: Widened Watch/CollectionGoal types and swapped `generateId` to `crypto.randomUUID()` so Phase 2 downstream plans have the schema shapes + UUID IDs they need.

## What Was Built

**Task 1 — types.ts extensions** (commit `7a6114a`)
- `CollectionGoal` union widened to include `'brand-loyalist'` (formatted as multi-line union).
- `Watch` interface gained two optional fields inserted before `notes?`:
  - `productionYear?: number` — 4-digit year, manual entry only in Phase 2, not consumed by similarity engine yet.
  - `isFlaggedDeal?: boolean` — wishlist-only manual good-deal override (FEAT-04).
- `UserPreferences` untouched — `collectionGoal` is already `CollectionGoal` so the widened union propagates automatically.
- `SimilarityResult` untouched (gap-fill types land in 02-03).

**Task 2 — generateId → crypto.randomUUID** (commit `59aad5e`)
- `generateId()` in `src/store/watchStore.ts` now returns `crypto.randomUUID()`.
- No other files in `src/` use `Date.now()` (grep confirmed — zero matches).
- Existing persisted watch IDs are untouched per CONTEXT.md decision; only new watches created via `addWatch` get UUID v4.

## Files Modified

| File | Change |
|---|---|
| `src/lib/types.ts` | Widened `CollectionGoal`; added `productionYear?` and `isFlaggedDeal?` to `Watch` |
| `src/store/watchStore.ts` | `generateId` body replaced with `crypto.randomUUID()` |

## Verification

- `grep "'brand-loyalist'" src/lib/types.ts` → match
- `grep -E "productionYear\?:\s*number" src/lib/types.ts` → match
- `grep -E "isFlaggedDeal\?:\s*boolean" src/lib/types.ts` → match
- `grep -c "export type CollectionGoal" src/lib/types.ts` → 1 (no duplicate)
- `grep "crypto.randomUUID()" src/store/watchStore.ts` → match inside `generateId`
- `grep -rn "Date.now()" src/` → 0 matches
- `npm test -- --run` → 7 files, 397 tests passed

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

- **Pre-existing test-only TS error:** `tests/balance-chart.test.tsx:11` reports `TS2578: Unused '@ts-expect-error' directive` under `npx tsc --noEmit`. This is in `tests/`, not `src/`, and is unrelated to the type or ID changes in this plan — the `@ts-expect-error` stopped being needed after some earlier fix. Out of scope per the plan's scope boundary rule; `npm test` still passes. Should be swept in a later Phase 2 test-hardening plan or by the plan that touches balance-chart tests.

## Key Decisions

- Only `brand-loyalist` added to `CollectionGoal`; `heritage-only` and `value-hunter` remain deferred per 02-CONTEXT.md.
- No ID migration for existing watches — avoids breaking bookmarked watch detail URLs.
- `UserPreferences.collectionGoal` needed no edit because it was already typed as `CollectionGoal`; widening the alias cascades.

## Downstream Enablement

Plans 02-02..02-05 can now freely reference:
- `Watch.productionYear` (number | undefined)
- `Watch.isFlaggedDeal` (boolean | undefined)
- `CollectionGoal = 'brand-loyalist'`
- UUID v4 IDs on any newly added watches

## Commits

| Hash | Task | Message |
|---|---|---|
| `7a6114a` | 1 | feat(02-01): extend Watch + CollectionGoal types |
| `59aad5e` | 2 | feat(02-01): swap generateId to crypto.randomUUID (FEAT-06) |

## Self-Check: PASSED

- FOUND: src/lib/types.ts (modified)
- FOUND: src/store/watchStore.ts (modified)
- FOUND commit: 7a6114a
- FOUND commit: 59aad5e

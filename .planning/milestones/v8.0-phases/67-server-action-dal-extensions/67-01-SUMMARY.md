---
phase: 67
plan: 01
subsystem: dal
tags:
  - dal
  - drizzle
  - watches
  - dupe-detection
dependency_graph:
  requires: []
  provides:
    - findViewerWatchByCatalogId with statuses param and status field (DUPE-01/03 DAL primitive)
  affects:
    - src/app/w/[ref]/page.tsx (caller — structural-superset; zero change needed)
tech_stack:
  added: []
  patterns:
    - inArray with runtime string array on pgEnum column (confirmed working — assumption A2 resolved)
    - CASE expression in Drizzle asc(sql`CASE ... END`) for multi-tier ORDER BY
key_files:
  created:
    - tests/data/findViewerWatchByCatalogId.test.ts
  modified:
    - src/data/watches.ts
decisions:
  - D-06: statuses parameter default ['owned'] preserves BUG-01 for existing caller
  - D-07: return type widened to { id; status } — structural superset; caller untouched
  - D-08: CASE ORDER BY puts owned before wishlist; desc(createdAt) for deterministic pick within status tier
  - A2 resolved: inArray(watches.status, statuses) where statuses is a runtime string array compiles and works correctly against pgEnum column without sql template fallback
  - Test (e) assertion: uses pattern '"value":"wishlist"' not '.toContain("wishlist")' — Drizzle column objects carry enumValues metadata that includes all enum strings; bound values serialize as {"value":"X"} objects
metrics:
  duration: ~8 minutes
  completed: 2026-05-29
  tasks: 2
  files_created: 1
  files_modified: 1
---

# Phase 67 Plan 01: findViewerWatchByCatalogId Extension Summary

**One-liner:** Extended `findViewerWatchByCatalogId` with `statuses` param + `status` return field via `inArray` + CASE ORDER BY so Phase 70 can branch DUPE-01 vs DUPE-03 from one DAL call.

## What Was Built

Extended `findViewerWatchByCatalogId` (`src/data/watches.ts:295-319`) in-place per CONTEXT.md decisions D-06, D-07, D-08:

### Signature Change (D-06)

```typescript
// Before:
export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string } | null>

// After:
export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
  statuses: ('owned' | 'wishlist')[] = ['owned'],  // D-06: backward-compat default
): Promise<{ id: string; status: 'owned' | 'wishlist' } | null>  // D-07: widened
```

### SELECT Projection Widening (RESEARCH Pitfall 2)

Added `status: watches.status` to the `.select()` call alongside `id: watches.id`. Without this, the widened return type would have `status: undefined` at runtime despite the TypeScript type claiming otherwise.

### WHERE Predicate Change

`eq(watches.status, 'owned')` → `inArray(watches.status, statuses)`. The `inArray` function works correctly with a runtime string array against a pgEnum column — assumption A2 from RESEARCH.md is confirmed resolved.

### ORDER BY Change (D-08 + D-05)

```typescript
.orderBy(
  asc(sql`CASE ${watches.status} WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END`),
  desc(watches.createdAt),
)
```

When both an owned and wishlist row exist for the same `(userId, catalogId)`, owned wins (CASE puts it at position 0). Within each status tier, most-recently acquired wins (D-05 carry-forward).

### Return Statement

```typescript
return { id: row.id, status: row.status as 'owned' | 'wishlist' }
```

The `as` cast narrows the pgEnum row type to the caller-constrained union.

## inArray vs sql`= ANY()` Decision (Assumption A2)

Used `inArray(watches.status, statuses)` directly. The Drizzle `inArray` function accepts a runtime string array against pgEnum columns correctly — it emits `WHERE status IN (...)` with bound parameter values. No `sql` template fallback was needed.

## Caller Audit Result

`grep -rn "findViewerWatchByCatalogId" src/` returns exactly 2 lines:
1. `src/data/watches.ts` — the function definition
2. `src/app/w/[ref]/page.tsx:439` — the one existing caller

The existing caller reads only `viewerOwnedRow.id` at lines 473 and 497. The widened return type `{ id: string; status: 'owned' | 'wishlist' } | null` is a structural superset of the old `{ id: string } | null`. Zero caller changes required.

## Test Outcomes — 5/5 Green

| Test | Description | Result |
|------|-------------|--------|
| (a) | statuses=['owned'], owned row → { id, status: 'owned' } | PASS |
| (b) | statuses=['owned','wishlist'], wishlist-only → { id, status: 'wishlist' } | PASS |
| (c) | statuses=['owned','wishlist'], both rows → owned row (D-08) | PASS |
| (d) | no matching rows → null | PASS |
| (e) | default invocation → owned-only WHERE (BUG-01 backward compat) | PASS |

Test (e) assertion deviation: The plan specified `.not.toContain('wishlist')` on `safeStringify(whereCall.args)`. This failed because Drizzle column objects embed `enumValues: ["owned","wishlist","sold","grail"]` as schema metadata in the serialized args. Fixed by asserting `.not.toContain('"value":"wishlist"')` — the pattern specifically checks bound IN-clause values (which serialize as `{"value":"X",...}`) rather than the entire column schema definition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test (e) assertion pattern too broad — Drizzle enum metadata false-positive**

- **Found during:** Task 2 GREEN phase verification
- **Issue:** `safeStringify(whereCall.args).not.toContain('wishlist')` failed because Drizzle column objects carry `enumValues: ["owned","wishlist","sold","grail"]` as schema metadata embedded in serialized WHERE args. This is present even with `eq(watches.status, 'owned')` (no 'wishlist' in the WHERE intent).
- **Fix:** Changed assertion to `.not.toContain('"value":"wishlist"')` which targets specifically the bound IN-clause values (serialized as `{"value":"X","encoder":...}`) rather than the full column schema object.
- **Files modified:** `tests/data/findViewerWatchByCatalogId.test.ts`
- **Commit:** 9e31bbec (included with Task 2 GREEN commit)

## Known Stubs

None — this plan has no UI components or data bindings that could be stubs.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The function already existed and was user-scoped (T-20-06-01 pattern preserved: `eq(watches.userId, userId)` remains in the WHERE clause).

## Self-Check: PASSED

- `tests/data/findViewerWatchByCatalogId.test.ts` — FOUND
- `src/data/watches.ts` (modified) — FOUND
- Commit `bea16e29` (test scaffold) — FOUND
- Commit `9e31bbec` (implementation + test fix) — FOUND
- 5/5 tests passing — VERIFIED
- Build exits 0 — VERIFIED

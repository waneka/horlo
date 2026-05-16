---
phase: 35
plan: 04
subsystem: dal
tags:
  - dal
  - recursive-cte
  - postgres15
  - cycle-clause
  - phase35
dependency_graph:
  requires:
    - 35-01  # static guard test (Wave 0)
    - 35-02  # schema.ts with watchLineageEdges table definition
  provides:
    - src/data/hierarchy.ts getLineageForReference DAL function
  affects:
    - Phase 39 lineage browse UI (consumer of this function)
tech_stack:
  added: []
  patterns:
    - "WITH RECURSIVE + CYCLE id SET is_cycle USING path (Postgres 15 syntax in raw sql template)"
    - "db.execute(sql`...`) without generic type param + result as unknown as Array<T> cast"
key_files:
  created:
    - src/data/hierarchy.ts
  modified: []
decisions:
  - "Used db.execute(sql`...`) without generic type param to avoid Drizzle Record<string,unknown> constraint — cast via result as unknown as LineageRow[] instead"
  - "Kept exact SQL structure from plan spec (verbatim copy), including CASE...WHEN logic for direction and CYCLE clause positioning"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-10T05:48:01Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 35 Plan 04: DAL hierarchy.ts — getLineageForReference — Summary

**One-liner:** Recursive CTE DAL walking `watch_lineage_edges` bidirectionally with Postgres 15 `CYCLE id SET is_cycle USING path` + `WHERE depth < 10` bounded safety guards.

## What Was Built

Created `src/data/hierarchy.ts` — the only new file for this plan. It provides:

- `export interface LineageRow` — return shape with `id`, `brand`, `model`, `reference`, `predecessor_catalog_id`, `successor_catalog_id`, `relationship_type`, `depth: number`, `direction: 'forward' | 'backward'`, `is_cycle: boolean`
- `export async function getLineageForReference(catalogId: string): Promise<LineageRow[]>` — recursive CTE that seeds from edges where the input `catalogId` appears in either direction, then recursively follows connected edges up to depth 10, joining `watches_catalog` for display metadata

**SQL structure:**
- Seed arm: `WHERE e.predecessor_catalog_id = $1 OR e.successor_catalog_id = $1` — picks up both forward and backward edges from the anchor
- Recursive arm: joins `watch_lineage_edges e ON e.predecessor_catalog_id = c.id OR e.successor_catalog_id = c.id` with `WHERE c.depth < 10`
- `CYCLE id SET is_cycle USING path` clause immediately after the CTE body
- Outer `SELECT ... WHERE NOT is_cycle ORDER BY depth ASC`

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/data/hierarchy.ts with getLineageForReference | 1d9ce67 | src/data/hierarchy.ts |

## Verification Results

- `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts`: **5/5 PASS** (Plan 01 vacuous-pass flipped to load-bearing-pass)
- `grep -c "import 'server-only'" src/data/hierarchy.ts`: **1** (G3)
- `grep -c "export async function getLineageForReference" src/data/hierarchy.ts`: **1** (G2)
- `grep -E "CYCLE\s+id\s+SET\s+is_cycle\s+USING\s+path"`: **present** (G1)
- `grep -E "depth\s*<\s*10"`: **present** (G1)
- `grep -c "watch_lineage_edges" src/data/hierarchy.ts`: **3** (seed + recursive arm + comment)
- `grep -c "watches_catalog" src/data/hierarchy.ts`: **5** (seed JOIN + recursive arm JOIN + comments)
- No TypeScript errors in hierarchy.ts itself

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed generic type param from db.execute() to resolve TypeScript constraint error**

- **Found during:** TypeScript type check after file creation
- **Issue:** `db.execute<LineageRow>(sql\`...\`)` failed with `error TS2344: Type 'LineageRow' does not satisfy the constraint 'Record<string, unknown>'. Index signature for type 'string' is missing in type 'LineageRow'.` — Drizzle's execute method requires the generic type to be indexable by string, but `LineageRow` has literal types for `direction` and `boolean` for `is_cycle`.
- **Fix:** Changed `db.execute<LineageRow>(sql\`...\`)` to `db.execute(sql\`...\`)` and kept the `result as unknown as LineageRow[]` cast at return. This matches the exact pattern in catalog.ts where the result is cast via `result as unknown as Array<{...}>`. The static guard test assertions are pattern-based (regex matching source text) so they are unaffected.
- **Files modified:** `src/data/hierarchy.ts` line 41
- **Commit:** 1d9ce67

**2. [Rule 3 - Blocking] Merged main into worktree branch to get Plan 01 test file and Plan 02 schema changes**

- **Found during:** Running test — worktree branch was at Phase 30 (pre-Phase 35); the static guard test file and schema.ts changes from Plans 01-03 only existed on main.
- **Fix:** `git merge main --no-edit` — fast-forward merge brought all Phase 35 preceding work into the worktree branch. This is the correct resolution for a parallel executor worktree that was spawned before Phase 35 plans 01-03 landed on main.
- **Files modified:** N/A — merge operation
- **Commit:** The merge itself updated the branch HEAD to `ce5fccb` (main tip) before adding `1d9ce67`

## Known Stubs

None. `getLineageForReference` is a complete function. It executes against a real DB table once the Phase 35 migration (Plan 05) creates `watch_lineage_edges`. The function is not called by any UI in Phase 35 (lineage browse UI is deferred to Phase 39).

## Threat Flags

None. `hierarchy.ts` exposes no new network surface — it's a server-only DAL function with no API route. The `catalogId` parameter is bound via Drizzle's parameterized `sql` template (not string interpolation) and cast `::uuid` to surface non-UUID input as a Postgres error (T-35-DAL-01 mitigated). Cycle safety is two-layered: `CYCLE` clause + `depth < 10` guard (T-35-DAL-02 mitigated).

## Self-Check: PASSED

- [x] `src/data/hierarchy.ts` exists: `ls src/data/hierarchy.ts` → found
- [x] Commit `1d9ce67` exists: `git log --oneline | grep 1d9ce67` → found
- [x] 5/5 static guard tests pass
- [x] No TypeScript errors in hierarchy.ts

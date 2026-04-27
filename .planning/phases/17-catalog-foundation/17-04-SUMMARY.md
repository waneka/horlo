---
phase: 17
plan: 04
subsystem: catalog
tags: [backfill, idempotency, migration, script, integration-test]
one-liner: "Idempotent batched backfill script linking existing watches to catalog rows via single-CTE upsert-or-find pattern"
dependency-graph:
  requires: [17-01, 17-02]
  provides: [CAT-05]
  affects: [watches.catalog_id, watches_catalog]
tech-stack:
  added: []
  patterns:
    - "Single-CTE atomic upsert+link per row (INSERT ON CONFLICT DO NOTHING + COALESCE SELECT fallback)"
    - "process.exit(0/1) required to terminate postgres.js connection pool"
    - "inArray() from drizzle-orm for batch ID filtering (postgres.js cannot cast JS array → uuid[])"
key-files:
  created:
    - scripts/backfill-catalog.ts
    - tests/integration/phase17-backfill-idempotency.test.ts
  modified:
    - package.json
decisions:
  - "Used relative imports in script (tsx does not resolve @/* path aliases from scripts/ dir)"
  - "Added process.exit(0) on success — postgres.js holds connection pool open preventing clean exit"
  - "Inline single-CTE approach chosen over calling catalog.ts helpers (catalog.ts has server-only guard)"
  - "Used inArray() Drizzle helper instead of raw ANY(::uuid[]) — postgres.js passes JS arrays as record type"
  - "Constraint name confirmed as watches_catalog_natural_key (not _idx suffix)"
metrics:
  duration: "~30 minutes"
  completed: "2026-04-27"
  tasks: 2
  files: 3
requirements: [CAT-05]
---

# Phase 17 Plan 04: Catalog Backfill Script Summary

Idempotent batched backfill script linking existing `watches` rows to `watches_catalog` via a single-CTE pattern. After Plans 03 and 04 land in prod, `catalog_id` is non-null for ALL watches.

## What Was Built

### scripts/backfill-catalog.ts

Standalone TypeScript script invoked via `npm run db:backfill-catalog`:

- Reads batches of 100 watches `WHERE catalog_id IS NULL`
- For each row: executes a single CTE that INSERTs into `watches_catalog` (`ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING`) and UPDATEs `watches.catalog_id` using `COALESCE(ins.id, existing.id)`
- Loop terminates when batch is empty (idempotent by design — filter shrinks to zero on re-run)
- Final assertion: `SELECT count(*) FROM watches WHERE catalog_id IS NULL` — exits 1 with `console.table` per-row dump if non-zero (Pitfall 1 / CAT-05 mitigation)
- Calls `process.exit(0)` on success to terminate the postgres.js connection pool

Sample run output (5 seeded watches → 3 unique catalog rows):
```
[backfill] pass 1: linked 5 (cumulative 5)
[backfill] OK — total linked: 5, unlinked remaining: 0, elapsed: 66ms
```

Idempotent re-run:
```
[backfill] OK — total linked: 0, unlinked remaining: 0, elapsed: 21ms
```

### package.json

Added `"db:backfill-catalog": "tsx scripts/backfill-catalog.ts"` after `test:watch`.

### tests/integration/phase17-backfill-idempotency.test.ts

3 integration tests (all GREEN):

| Test | Result | Notes |
|------|--------|-------|
| first run links unlinked rows | PASS | 5 seeded watches → 3 catalog rows (2 pairs collapsed via NULLS NOT DISTINCT) |
| second run is a no-op | PASS | total linked: 0, catalog count unchanged |
| zero-unlinked assertion fires when a row remains unlinked | PASS | late-arriving watch picked up on next invocation |

## Test Results

```
Tests  3 passed (3)
Phase 17 overall: 39 passed (39) across 6 test files
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] postgres.js connection pool prevents clean subprocess exit**
- **Found during:** Task 2 (test ran indefinitely via execFileSync)
- **Issue:** Script had no `process.exit(0)` on success; postgres.js keeps connection pool alive
- **Fix:** Added `process.exit(0)` at end of `main()` success path
- **Files modified:** scripts/backfill-catalog.ts
- **Commit:** b1f777a

**2. [Rule 1 - Bug] JS array cannot be cast to uuid[] via raw SQL in postgres.js**
- **Found during:** Task 2 first test run
- **Issue:** `sql\`id = ANY(${seededWatchIds}::uuid[])\`` causes "cannot cast type record to uuid[]" — postgres.js passes JS arrays as record type
- **Fix:** Replaced with `inArray(watches.id, seededWatchIds)` Drizzle helper throughout test
- **Files modified:** tests/integration/phase17-backfill-idempotency.test.ts
- **Commit:** b1f777a

**3. [Rule 3 - Import path] Script uses relative imports instead of @/* alias**
- **Found during:** Task 1 design
- **Issue:** tsx does not resolve tsconfig `@/*` path aliases from `scripts/` directory; `catalog.ts` also has `server-only` guard
- **Fix:** Used `../src/db` and `../src/db/schema` relative imports; inlined CTE logic instead of importing from catalog.ts
- **Files modified:** scripts/backfill-catalog.ts

## Notes for Downstream Plans

**Plan 05 (refresh-counts script):** Model the dotenv + service-role DATABASE_URL pattern from this script. Also add `process.exit(0)` on success to avoid the postgres.js connection pool hang.

**Plan 06 (prod operator runbook):** The prod run sequence is:
1. `DATABASE_URL=<service-role-url> npm run db:backfill-catalog`
2. Verify output ends with `unlinked remaining: 0`
3. Re-run to confirm idempotency (`total linked: 0`)

## Self-Check: PASSED

---
phase: 38
plan: "01"
subsystem: catalog-dal
tags: [catalog, dal, schema, migration, fixtures, notNull, drizzle]
dependency_graph:
  requires: [phase-36-layer-c-variants, phase-17-catalog-fk]
  provides: [watches-catalogId-notNull-drizzle, createWatch-3arg-IDIOM-A]
  affects: [src/data/watches, src/app/actions/watches, src/app/actions/wishlist, all-integration-fixtures]
tech_stack:
  added: []
  patterns: [IDIOM-A-createWatch-3arg, fail-loud-catalog-upsert, D-08-schema-flip-last]
key_files:
  created:
    - drizzle/0011_phase38_catalog_id_notnull.sql
    - supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql
  modified:
    - src/db/schema.ts
    - src/data/watches.ts
    - src/app/actions/watches.ts
    - src/app/actions/wishlist.ts
    - tests/integration/phase11-schema.test.ts
    - tests/integration/phase11-storage-rls.test.ts
    - tests/integration/phase12-visibility-matrix.test.ts
    - tests/integration/phase15-wear-detail-gating.test.ts
    - tests/integration/phase15-wywt-photo-flow.test.ts
    - tests/integration/phase17-join-shape.test.ts
    - tests/integration/phase17-backfill-idempotency.test.ts
    - tests/integration/phase19-collections-privacy.test.ts
    - tests/integration/phase27-backfill.test.ts
    - tests/integration/phase27-bulk-reorder.test.ts
    - tests/integration/phase27-getwatchesbyuser-order.test.ts
    - tests/integration/home-privacy.test.ts
    - tests/integration/debt02-rls-audit.test.ts
    - tests/data/getWearEventsCountByUser.test.ts
    - drizzle/meta/_journal.json
decisions:
  - "D-08 ordering enforced: schema .notNull() flip committed last (after all fixture cascades)"
  - "IDIOM A adopted: createWatch(userId, catalogId, data) 3-arg signature"
  - "Fail-loud semantics: null catalog upsert result throws Error, blocks createWatch"
  - "Idempotent migrations: DO $$ IF attnotnull=false guards for both supabase + drizzle SQL"
  - "Phase 17 join-shape test updated: second watch scenario reframed from null-catalog to always-linked post-Phase-38"
  - "Phase 17 backfill idempotency test updated: all watches pre-linked post-Phase-38 so backfill is a no-op"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-11"
  tasks_completed: 7
  files_modified: 19
---

# Phase 38 Plan 01: watches.catalogId .notNull() Drizzle Catch-up + DAL Rewire Summary

**One-liner:** Drizzle `catalogId.notNull()` catch-up after Phase 36 DB-level flip — 3-arg `createWatch(userId, catalogId, data)` IDIOM A + 3 production callsite refactors + 17 integration fixture cascades + idempotent supabase/drizzle migrations.

## Objective

Align Drizzle's TypeScript types with the production DB reality that `watches.catalog_id` has been `NOT NULL` since Phase 36. The prerequisite work for CAT-13 engine rewire (Phase 38 plans 02+) that requires catalog linkage to be type-safe at the DAL boundary.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | DAL signature: `createWatch` → 3-arg IDIOM A | 96807c8 | src/data/watches.ts |
| 2 | Callsite: `src/app/actions/watches.ts` fail-loud upsert | bbf356f | src/app/actions/watches.ts |
| 3 | Callsite: `src/app/actions/wishlist.ts` upsert before create | a5b2ffe | src/app/actions/wishlist.ts |
| 4 | Fixture cascade phase11/12/15 (3 commits → 1) | 5fde45c | 6 test files |
| 5 | Fixture cascade phase17/phase19 (2 commits) | ef99d54, 76d47d4 | 5 test files |
| 6 | Fixture cascade phase27/cross-cutting/tests-data (3 commits) | 41e0f4d, 67221e3, 822dead | 7 test files |
| 7 | [BLOCKING] Schema flip + migrations + drizzle push | ddf1d0e | schema.ts, 2 SQL files, journal |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 17 join-shape test: second watch insert would fail with NOT NULL violation**
- **Found during:** Task 5
- **Issue:** `phase17-join-shape.test.ts` intentionally inserted a watch with `catalogId: null` to test "LEFT JOIN doesn't drop rows when catalog_id IS NULL". Post-Phase-38 the DB enforces NOT NULL so the insert would fail at runtime.
- **Fix:** Added a second `watchesCatalog` row for the second watch and updated test name + assertions from "null catalog columns" to "returns catalog columns for second watch". The LEFT JOIN behavior being tested (row not dropped) is still verified.
- **Files modified:** `tests/integration/phase17-join-shape.test.ts`
- **Commit:** ef99d54

**2. [Rule 1 - Bug] Phase 17 backfill-idempotency test: regex `total linked: [1-9]` would fail post-Phase-38**
- **Found during:** Task 5
- **Issue:** The test expected the backfill script to link at least 1 previously-unlinked watch. Post-Phase-38 all test watches are pre-linked (catalogId NOT NULL means we seed catalogs first), so the backfill finds 0 to link — a valid no-op.
- **Fix:** Changed assertion from `/total linked: [1-9]/` to `/total linked: \d+/` (accepts 0). Also pre-seeded catalog rows for the "late-arriving row" scenario that previously tested null→linked.
- **Files modified:** `tests/integration/phase17-backfill-idempotency.test.ts`
- **Commit:** ef99d54

**3. [Rule 1 - Bug] `upsertCatalogFromUserInput` returns `string | null` — not directly assignable to `string`**
- **Found during:** Task 2 (`src/app/actions/watches.ts`)
- **Issue:** `let catalogId: string = await upsertCatalogFromUserInput(...)` caused a TypeScript error because the return type includes `null`.
- **Fix:** Used intermediate variable pattern: `let catalogIdResult: string | null = await ...; if (!catalogIdResult) { throw new Error(...) }; const catalogId: string = catalogIdResult`.
- **Files modified:** `src/app/actions/watches.ts`
- **Commit:** bbf356f

## Migrations

### supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql
Idempotent DO block: queries `pg_attribute.attnotnull` before running `SET NOT NULL`. No-op in prod (Phase 36 already applied SET NOT NULL). Required for fresh-clone dev environments.

### drizzle/0011_phase38_catalog_id_notnull.sql
Drizzle-kit companion SQL with identical idempotent DO block. Journal entry idx=11 appended with `when: 1778632000000`.

### drizzle-kit push
`drizzle-kit push --force` executed against local DB — `[✓] Changes applied`. NOTICE warnings about truncated FK identifier names are benign and pre-existing.

## Known Stubs

None. All production callsites properly upsert catalog before createWatch. The Phase 19.1 taste enrichment block in `src/app/actions/watches.ts` still reads `if (catalogId)` — post-Phase-38 this is always truthy (intentional, reads naturally).

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check

### Files exist
- `drizzle/0011_phase38_catalog_id_notnull.sql` — created
- `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql` — created
- `src/db/schema.ts` — modified (`.notNull()` on catalogId line 150)
- `src/data/watches.ts` — modified (3-arg createWatch)
- `src/app/actions/watches.ts` — modified
- `src/app/actions/wishlist.ts` — modified

### Commits exist (all on worktree-agent-adb6c87fb08316b95)
- 96807c8 — DAL signature
- bbf356f — watches actions callsite
- a5b2ffe — wishlist actions callsite
- 5fde45c — phase11/12/15 fixtures
- ef99d54 — phase17 fixtures
- 76d47d4 — phase19 fixtures
- 41e0f4d — phase27 fixtures
- 67221e3 — cross-cutting fixtures
- 822dead — tests/data fixture
- ddf1d0e — [BLOCKING] schema flip + migrations

## Self-Check: PASSED

---
phase: 35
plan: 02
subsystem: schema
tags:
  - schema
  - drizzle
  - pgenum
  - types
  - constants
  - seed-data
  - phase35
dependency_graph:
  requires:
    - "Phase 34: brands + watchFamilies tables (CAT-15)"
  provides:
    - "movementTypeEnum pgEnum (movement_type_enum)"
    - "lineageRelationshipTypeEnum pgEnum (lineage_relationship_type)"
    - "watchEraEnum pgEnum (watch_era)"
    - "watchLineageEdges Drizzle table definition"
    - "MovementType TS type (4 DB-canonical values)"
    - "WatchEra TS type (13 decade values)"
    - "MOVEMENT_TYPES / MOVEMENT_LABELS / CASE_MATERIALS_SUGGESTED / BRACELET_CONFIGS_SUGGESTED constants"
    - "scripts/seed-data/families.json (10 anchor families)"
    - "scripts/seed-data/lineage-edges.json (2 anchor edges)"
  affects:
    - "Plan 03: consumer sweep (type errors created here are fixed there)"
    - "Plan 04: hierarchy DAL (reads watchLineageEdges schema)"
    - "Plan 05: Supabase migration (uses enum names from schema.ts)"
    - "Plan 06: backfill scripts (read JSON seed files)"
    - "Plan 07: deploy runbook"
tech_stack:
  added:
    - "3 new Drizzle pgEnum declarations"
    - "watchLineageEdges pgTable"
    - "scripts/seed-data/ directory"
  patterns:
    - "pgEnum('name', [...] as const) pattern — first true pgEnums in this project"
    - "watchLineageEdges uses same ON DELETE RESTRICT FK convention as Phase 34"
key_files:
  created:
    - "scripts/seed-data/families.json"
    - "scripts/seed-data/lineage-edges.json"
  modified:
    - "src/db/schema.ts"
    - "src/lib/types.ts"
    - "src/lib/constants.ts"
decisions:
  - "D-01: movementTypeEnum = (auto, manual, quartz, spring_drive) — 4 values, no 'other'"
  - "D-03 Q1 resolution: keep Watch.movement field name, retype to optional MovementType"
  - "D-09: watchEraEnum = 13 decade values 1900-1910 through 2020-2030"
  - "D-10/D-11: case_material + bracelet_config are free TEXT (no CHECK constraint) — suggested lists in TS only"
  - "D-13: anchor seed = exactly 10 families + 2 Submariner edges (5513->14060->124060)"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-10"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 3
  files_created: 2
---

# Phase 35 Plan 02: Layer B — TS Source-of-Truth Foundation Summary

**One-liner:** Drizzle schema with 3 new pgEnums (movement_type_enum/lineage_relationship_type/watch_era), watchLineageEdges junction table, 7 new catalog+watch columns, MovementType realigned to 4 DB-canonical values with WatchEra added, and 10+2 anchor seed JSON files.

## What Was Built

This plan established the complete TypeScript source-of-truth for Phase 35's schema contracts across 5 files. It deliberately produces TypeScript errors in consumer files — those are fixed in Plan 03.

### Task 1 — schema.ts (3 pgEnums + watchLineageEdges + column edits)

Added three new `pgEnum` exports immediately after `notificationTypeEnum`:
- `movementTypeEnum` (`movement_type_enum`): `auto`, `manual`, `quartz`, `spring_drive`
- `lineageRelationshipTypeEnum` (`lineage_relationship_type`): `successor`, `predecessor`, `remake`, `tribute`, `homage`
- `watchEraEnum` (`watch_era`): 13 decade values from `1900-1910` through `2020-2030`

In `watches` table: replaced the `movement` text column (5 legacy enum values) with `movementType` (movementTypeEnum) + `movementCaliber` (text, nullable).

In `watchesCatalog` table: replaced the `movement` text column with 5 new columns: `movementType`, `movementCaliber`, `era` (watchEraEnum), `caseMaterial` (text, nullable), `braceletConfig` (text, nullable).

Added `watchLineageEdges` pgTable after `watchFamilies` with:
- `predecessorCatalogId` + `successorCatalogId`: uuid FKs to `watchesCatalog.id` with `ON DELETE RESTRICT`
- `relationshipType`: `lineageRelationshipTypeEnum`, NOT NULL
- `metadata`: jsonb, NOT NULL, default `'{}'::jsonb`
- 2 indexes (predecessor, successor)
- 1 unique constraint `lineage_edges_unique_triple` on (predecessor, successor, relationshipType)

Note: CHECK constraint (`predecessor <> successor`) and cycle trigger are NOT in Drizzle — they live in the Supabase migration (Plan 05), consistent with the notifications table pattern.

### Task 2 — types.ts (MovementType realigned + WatchEra added + Watch.movement optional)

- `MovementType` rewritten from 5 legacy values to `'auto' | 'manual' | 'quartz' | 'spring_drive'`
- `WatchEra` type added with 13 decade string literal union values
- `Watch.movement` changed from required `movement: MovementType` to optional `movement?: MovementType` (resolved Q1 — kept field name, lower-impact approach)

### Task 3 — constants.ts (MOVEMENT_TYPES rewritten + 3 new exports)

- Added `import type { MovementType }` at top of file
- `MOVEMENT_TYPES` rewritten to `['auto', 'manual', 'quartz', 'spring_drive'] as const`
- `MOVEMENT_LABELS` map added: `Record<MovementType, string>` for UI display labels
- `CASE_MATERIALS_SUGGESTED` list added (10 values)
- `BRACELET_CONFIGS_SUGGESTED` list added (7 values)

### Task 4 — JSON seed files created

- `scripts/seed-data/families.json`: 10 anchor families across Rolex/Omega/Tudor/Audemars Piguet/Patek Philippe/Grand Seiko
- `scripts/seed-data/lineage-edges.json`: 2 edges forming the Submariner 3-node chain (5513 → 14060 → 124060), both `relationship_type: 'successor'`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `ab9150d` | feat(35-02): add 3 pgEnums + watchLineageEdges table + structured movement columns |
| 2 | `c1acbb9` | feat(35-02): realign MovementType + add WatchEra + make Watch.movement optional |
| 3 | `0a6a41a` | feat(35-02): rewrite MOVEMENT_TYPES + add MOVEMENT_LABELS/CASE_MATERIALS_SUGGESTED/BRACELET_CONFIGS_SUGGESTED |
| 4 | `9edb2d8` | feat(35-02): create anchor JSON seed files (10 families + 2 Submariner lineage edges) |

## Deviations from Plan

### Auto-fixed Setup Issue

**Worktree was 103 commits behind main** — the worktree branch was created at Phase 30's commit and had not been rebased. Phase 34's brands/watchFamilies tables (required context for Phase 35's watchLineageEdges FKs) were absent. Fast-forward merge from `main` was performed before beginning task execution. No conflicts; clean fast-forward.

No functional code deviations. All 4 tasks executed exactly as specified in the plan.

## Known Stubs

None. This plan creates schema/type/constant definitions and seed data — no UI rendering stubs.

## Threat Flags

None. The files modified are:
- `src/db/schema.ts`: Drizzle TS definitions only (no runtime DDL until Plan 05 migration runs)
- `src/lib/types.ts`: type definitions
- `src/lib/constants.ts`: constant arrays
- `scripts/seed-data/*.json`: git-tracked curator data, no runtime ingestion until Plan 06 scripts run

The `watchLineageEdges` table has no RLS in this plan (T-35-SCHEMA-01 disposition: accept). RLS lands in Plan 05's Supabase migration.

## Self-Check: PASSED

Files exist:
- [x] `src/db/schema.ts` — modified
- [x] `src/lib/types.ts` — modified
- [x] `src/lib/constants.ts` — modified
- [x] `scripts/seed-data/families.json` — created
- [x] `scripts/seed-data/lineage-edges.json` — created

Commits exist:
- [x] `ab9150d` — schema.ts changes
- [x] `c1acbb9` — types.ts changes
- [x] `0a6a41a` — constants.ts changes
- [x] `9edb2d8` — seed JSON files

Key content verified:
- [x] `grep -c "pgEnum('movement_type_enum'" src/db/schema.ts` = 1
- [x] `grep -c "export const watchLineageEdges = pgTable(" src/db/schema.ts` = 1
- [x] `grep -c "export type MovementType = 'auto' | 'manual' | 'quartz' | 'spring_drive'" src/lib/types.ts` = 1
- [x] `grep -c "MOVEMENT_TYPES = ['auto', 'manual', 'quartz', 'spring_drive']" src/lib/constants.ts` = 1
- [x] families.json: 10 rows; lineage-edges.json: 2 rows

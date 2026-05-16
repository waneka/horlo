---
phase: 35-layer-b-lineage-edges-structured-movement-era-material
verified: 2026-05-10T00:25:00Z
status: approved
milestone_close_approval: "2026-05-16 — operator approved at v5.0 milestone close; human-verification items (cycle-trigger smoke, G6 backfill counts) accepted, not deferred"
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cycle trigger runtime smoke — after loading >=3 catalog rows that form a Submariner chain (5513 -> 14060 -> 124060), attempt INSERT of a cycle-completing edge (e.g., 124060 -> 5513 relationship_type='successor') directly via psql with service-role credentials"
    expected: "PostgreSQL raises 'Lineage cycle detected: <124060-uuid> -> <5513-uuid>' exception; INSERT rolls back"
    why_human: "No anchor catalog rows exist in prod (DEV-35-07-02 Option A — backfill chain deferred). Trigger existence and wiring were verified via schema introspection (Task 8 §7/§8) but runtime behavior requires at least two connected edges in the table to exercise the recursive CTE walk. Cannot test without prod DB access."
  - test: "G6 smoke counts — SELECT COUNT(*) FROM watch_families; SELECT COUNT(*) FROM watch_lineage_edges after the backfill chain has been run once with real watch data present"
    expected: "watch_families = 10, watch_lineage_edges = 2 (for the anchor Submariner seed set)"
    why_human: "Both tables are currently empty (DEV-35-07-02). Counts will only reflect the anchor seed data after db:backfill-catalog produces catalog rows that the family and lineage scripts can resolve against. Re-running db:backfill-catalog-families + db:backfill-catalog-lineage once real watches exist will exercise idempotent ON CONFLICT DO NOTHING logic and validate the ref-triple resolver."
---

# Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material Verification Report

**Phase Goal:** Add the watch_lineage_edges junction table with cycle-safety guarantees, replace the free-text movement column with a structured pgEnum on BOTH watches_catalog AND watches, add lineage_relationship_type pgEnum, add watch_era pgEnum, and add three first-class catalog descriptor columns (era, case_material, bracelet_config) — unblocking SRCH-16's movement facet while staying schema-only (no UI).
**Verified:** 2026-05-10T00:25:00Z
**Status:** approved (operator-approved at v5.0 milestone close, 2026-05-16)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | watch_lineage_edges table exists with (predecessor_catalog_id, successor_catalog_id, relationship_type, metadata) and a BEFORE INSERT trigger that runs a bounded cycle-check query | VERIFIED | `supabase/migrations/20260510000001_phase35_layer_b.sql` lines 57–111: CREATE TABLE + CHECK no_self_loop + CREATE FUNCTION check_lineage_cycle() + CREATE TRIGGER trg_check_lineage_cycle BEFORE INSERT. Prod deploy confirmed (Task 3 exit 0 + Task 8 schema introspection §1,§7,§8,§9 all pass). Schema.ts watchLineageEdges pgTable at line 420 with correct FK shape + unique constraint. |
| 2 | Every recursive CTE in src/data/hierarchy.ts includes both the Postgres 15 CYCLE clause AND a depth guard of 10 | VERIFIED | hierarchy.ts line 95: `CYCLE id SET is_cycle USING path`. Line 91: `WHERE c.depth < 10`. Both patterns confirmed by static guard tests (5/5 PASS confirmed by live vitest run during verification). |
| 3 | getLineageForReference(catalogId) DAL function exists in src/data/hierarchy.ts and returns correct results for a 3-node lineage chain | VERIFIED (compile-time scope) | Function exported at line 40 of hierarchy.ts. Recursive CTE walks both forward and backward directions. Operator-accepted limitation: runtime 3-node validation is deferred (DEV-35-07-02 Option A — no anchor catalog rows exist post-TRUNCATE). Compile-time evidence via static guard test G2 + CYCLE/depth guards (G1). |
| 4 | watches_catalog.movement_type pgEnum (auto, manual, quartz, spring_drive) and movement_caliber TEXT columns exist; old free-text movement column is removed | VERIFIED | Migration DROP COLUMN IF EXISTS movement on both tables; ADD COLUMN movement_type movement_type_enum + movement_caliber TEXT on both tables. Prod Task 8 §4 (3 pgEnums exist), §5 (5 new catalog columns with correct udt_name), §6 (movement column absent from both tables). Drizzle schema.ts: movementTypeEnum at line 37, no text('movement') anywhere. types.ts MovementType = 'auto' \| 'manual' \| 'quartz' \| 'spring_drive'. |
| 5 | era (text), case_material (text), bracelet_config (text) columns exist on watches_catalog; all existing DAL queries return correct results unchanged | VERIFIED | Migration ADD COLUMN era watch_era NULL, case_material TEXT NULL, bracelet_config TEXT NULL on watches_catalog. Schema.ts watchesCatalog has all 3 columns at lines 328–330. Plan 03 ran full vitest suite (173 tests pass across src/components + src/lib) confirming DAL parity. No pre-existing tests broken by new nullable additive columns. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/static/hierarchy.lineage-3-node.test.ts` | Wave 0 static guard for G1/G2/G3 | VERIFIED | Exists. 5/5 tests pass (confirmed by live vitest run — all load-bearing after hierarchy.ts created by Plan 04). |
| `src/data/hierarchy.ts` | getLineageForReference DAL with CYCLE + depth<10 | VERIFIED | Exists. Imports 'server-only'. Exports getLineageForReference. Contains CYCLE id SET is_cycle USING path at line 95. Contains WHERE c.depth < 10 at line 91. |
| `src/db/schema.ts` | 3 pgEnum exports + watchLineageEdges + 5 catalog cols + 2 watch cols | VERIFIED | movementTypeEnum (line 37), lineageRelationshipTypeEnum (line 42), watchEraEnum (line 47). watchLineageEdges pgTable (line 420). watchesCatalog has movementType, movementCaliber, era, caseMaterial, braceletConfig (lines 326–330). watches has movementType, movementCaliber (lines 82–83). No text('movement') column on either table. |
| `src/lib/types.ts` | MovementType = 4 DB-canonical values; WatchEra = 13 decade values; Watch.movement optional | VERIFIED | MovementType = 'auto' \| 'manual' \| 'quartz' \| 'spring_drive' (line 3). WatchEra = 13 decade values 1900-1910 through 2020-2030 (lines 6–9). Watch.movement?: MovementType (line 36). CatalogEntry.movementType: MovementType \| null + movementCaliber: string \| null (lines 136–137). |
| `src/lib/constants.ts` | MOVEMENT_TYPES + MOVEMENT_LABELS + CASE_MATERIALS_SUGGESTED + BRACELET_CONFIGS_SUGGESTED | VERIFIED | MOVEMENT_TYPES = ['auto','manual','quartz','spring_drive'] as const (line 76). MOVEMENT_LABELS Record (line 80). CASE_MATERIALS_SUGGESTED (line 90). BRACELET_CONFIGS_SUGGESTED (line 105). |
| `src/lib/verdict/shims.ts` | KNOWN_MOVEMENTS 4-value set + coerceMovement returns MovementType \| undefined | VERIFIED | KNOWN_MOVEMENTS (line 18). coerceMovement: string \| null \| undefined -> MovementType \| undefined (line 33). catalogEntryToSimilarityInput reads entry.movementType (line 50). |
| `src/lib/extractors/llm.ts` | EXTRACTION_PROMPT uses 4-value movement enum; cleanWatch validates against MOVEMENT_TYPES | VERIFIED | Prompt at line 22: `"movement": "auto\|manual\|quartz\|spring_drive"`. cleanWatch validation at lines 138–139 uses MOVEMENT_TYPES.includes(). |
| `src/components/watch/WatchForm.tsx` | Dropdown uses MOVEMENT_LABELS[type] for display; default 'auto' | VERIFIED | Imports MOVEMENT_LABELS (line 26). Default movement: 'auto' (line 68). Dropdown renders MOVEMENT_LABELS[type] at line 431. |
| `supabase/migrations/20260510000001_phase35_layer_b.sql` | Full DDL with TRUNCATE + 4 CREATE TYPE + ALTER TABLE x2 + CREATE TABLE + cycle trigger + RLS + DO $$ assertions | VERIFIED | File exists. TRUNCATE watches CASCADE + TRUNCATE watches_catalog CASCADE (lines 20–21). 3 CREATE TYPE statements (lines 27–36). DROP + ADD movement columns on both tables (lines 38–54). CREATE TABLE watch_lineage_edges (lines 60–70). check_lineage_cycle function + trigger (lines 87–111). RLS + GRANT SELECT (lines 118–121). 16 RAISE EXCEPTION guards in DO $$ block. |
| `drizzle/0008_phase35_layer_b.sql` | Structural idempotent twin | VERIFIED | Exists. movement_type_enum, watch_era CREATE TYPE IF NOT EXISTS. DROP COLUMN IF EXISTS movement on both tables. ADD COLUMN IF NOT EXISTS for all 7 new columns. CREATE TABLE IF NOT EXISTS watch_lineage_edges. No RLS/trigger/CHECK (correctly absent per plan). |
| `drizzle/meta/_journal.json` | idx=8 entry for phase35_layer_b | VERIFIED | 9 entries (idx 0–8). Last entry idx=8. Filename: 0008_phase35_layer_b. |
| `scripts/backfill-catalog-families.ts` | Two-pass idempotent family inserter with ON CONFLICT DO NOTHING | VERIFIED | Exists. Pass A: INSERT ON CONFLICT (brand_id, name_normalized) DO NOTHING. Pass B: UPDATE watches_catalog WHERE family_id IS NULL. Warns on unresolved brand_slug, does not exit 1. Final assertion exits 1 if watch_families empty. |
| `scripts/backfill-catalog-lineage.ts` | Ref-triple resolver + ON CONFLICT DO NOTHING edge inserter | VERIFIED | Exists. resolveRef helper (line 39). ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING (line 80). Warns and skips on unresolvable refs. |
| `scripts/seed-data/families.json` | 10 anchor families | VERIFIED | 10 entries: Submariner, GMT-Master, Datejust, Daytona, Speedmaster, Seamaster, Black Bay, Royal Oak, Nautilus, Snowflake. |
| `scripts/seed-data/lineage-edges.json` | 2 anchor Submariner edges | VERIFIED | 2 entries: rolex/submariner/5513->14060 + 14060->124060, both relationship_type='successor'. |
| `package.json` | db:backfill-catalog-families + db:backfill-catalog-lineage npm scripts | VERIFIED | Both scripts wired at lines 18–19 with `tsx --env-file=.env.local` prefix. |
| `docs/deploy-db-setup.md` | Phase 35 section with TRUNCATE warning + 6-step deploy order + smoke tests | VERIFIED | Phase 35 section appended starting at "## Phase 35 — Layer B". Bold TRUNCATE WARNING present. Steps 35.0–35.8 documented. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| hierarchy.ts | watch_lineage_edges (DB) | db.execute(sql`WITH RECURSIVE...`) | VERIFIED | SQL template references watch_lineage_edges in seed arm and recursive arm. Parameterized with ${catalogId}::uuid (no string interpolation). |
| WatchForm.tsx | MOVEMENT_LABELS | import + dropdown render | VERIFIED | Imports MOVEMENT_LABELS from constants.ts. Renders MOVEMENT_LABELS[type] in dropdown options. |
| catalog.ts upsert | movement_type_enum (DB) | `${input.movementType ?? null}::movement_type_enum` | VERIFIED | catalog.ts line 204: explicit ::movement_type_enum cast in INSERT VALUES. COALESCE on UPDATE (lines 219–220). |
| watches.ts mapRowToWatch | movementType column | row.movementType | VERIFIED | watches.ts line 27: `movement: row.movementType ?? undefined`. Line 66: writes movementType. Line 189: createWatch uses movementType column. |
| shims.ts | CatalogEntry.movementType | entry.movementType | VERIFIED | shims.ts line 50: `movement: coerceMovement(entry.movementType ?? null)`. |
| schema.ts watchLineageEdges | watchesCatalog | .references(() => watchesCatalog.id, { onDelete: 'restrict' }) | VERIFIED | Both FK columns (predecessorCatalogId, successorCatalogId) reference watchesCatalog.id with onDelete: 'restrict' per D-06. |
| Migration | supabase db push --linked | 20260510000001_phase35_layer_b.sql | VERIFIED | Migration applied atomically (Task 3 exit 0, Task 8 schema introspection all pass). `supabase migration list --linked` confirms 20260510000001_phase35_layer_b synced on remote. |

### Data-Flow Trace (Level 4)

Not applicable. Phase 35 is schema-only. No new UI components or data-rendering paths were introduced. getLineageForReference exists but has no UI consumer (Phase 39 deferred). The artifacts that were modified (WatchForm, WatchCard, WatchDetail, etc.) had their movement display paths updated but these are existing flows — not new data pipelines introduced by this phase.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Static guard tests for hierarchy.ts CTE invariants (G1/G2/G3) | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` | 5/5 PASS (verified live during verification run) | PASS |
| No legacy movement string literals in production src/ | `grep -rn "'automatic'\|'spring-drive'" src/ --include="*.ts" --include="*.tsx" (excluding .test.)` | Zero results | PASS |
| No text('movement') column in schema.ts | `grep -n "text('movement')" src/db/schema.ts` | Zero results | PASS |
| MOVEMENT_TYPES exact 4-value match | grep on constants.ts | `['auto', 'manual', 'quartz', 'spring_drive'] as const` | PASS |
| Drizzle journal idx=8 entry present | Parse drizzle/meta/_journal.json | 9 entries, last idx=8, filename 0008_phase35_layer_b | PASS |
| Migration filename format | ls supabase/migrations/ | 20260510000001_phase35_layer_b.sql (14 digits + correct suffix) | PASS |
| CYCLE clause exact text in hierarchy.ts | grep hierarchy.ts | Line 95: `CYCLE id SET is_cycle USING path` | PASS |
| depth < 10 guard in hierarchy.ts | grep -c | 3 occurrences (comment x2 + actual guard) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAT-16 | All 7 plans | watch_lineage_edges junction table with M:N relationships and relationship_type in {successor, predecessor, remake, tribute, homage}; BEFORE INSERT cycle-detection trigger plus CYCLE clause on every recursive CTE; getLineageForReference DAL; movement column replaced by movement_caliber + movement_type ENUM; era, case_material, bracelet_config columns; manual curation only | SATISFIED | All 5 ROADMAP success criteria verified. Schema deployed to prod (Task 3/8 in Plan 07). TS consumer sweep complete (173 tests pass). Static guard tests 5/5 pass. No automated lineage inference added (CAT-16 requirement honored). |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| src/data/hierarchy.ts | getLineageForReference called only by static test, no UI consumer | INFO | Intentional per plan (Phase 39 deferred). Not a stub — function is complete with real SQL. |
| scripts/backfill-catalog-families.ts (assertion block) | Exits 1 if watch_families empty after Pass A | INFO | This is a guard, not a stub. By design — fires when brands aren't yet seeded (expected post-TRUNCATE state until catalog grows organically). DEV-35-07-02 explicitly accepts this. |

No BLOCKER or WARNING anti-patterns found. The "empty tables" post-deploy state is not a stub pattern — it is the documented and operator-accepted consequence of the TRUNCATE-first strategy combined with the Phase 17 backfill-catalog dependency on watches table. All scripts are substantive implementations.

### Human Verification Required

#### 1. Cycle Trigger Runtime Validation

**Test:** Connect to prod DB via psql with service-role credentials. Insert at least 3 catalog rows (e.g., three Submariner variants — or run db:backfill-catalog once a real watch is added). Insert two edges forming a chain: A->B (successor), B->C (successor). Then attempt: `INSERT INTO watch_lineage_edges (predecessor_catalog_id, successor_catalog_id, relationship_type) VALUES ('<C-uuid>', '<A-uuid>', 'successor');`

**Expected:** PostgreSQL raises exception `Lineage cycle detected: <C-uuid> -> <A-uuid>` and INSERT rolls back.

**Why human:** No anchor catalog rows exist in prod post-TRUNCATE (DEV-35-07-02 Option A). The trigger exists and is wired (confirmed by schema introspection Task 8 §7/§8), but the recursive CTE walk inside check_lineage_cycle() requires at least 2 existing edges to traverse. This cannot be tested without live DB access and seeded data.

#### 2. G6 Smoke Counts After Backfill Chain

**Test:** After the first real watch is added via /watch/new and db:backfill-catalog runs, execute the backfill chain: `npm run db:backfill-catalog-brands` then `npm run db:backfill-catalog-families` then `npm run db:backfill-catalog-lineage`. Then run:
```sql
SELECT COUNT(*) FROM watch_families;       -- expect: 10
SELECT COUNT(*) FROM watch_lineage_edges;  -- expect: 2
SELECT has_table_privilege('anon', 'public.watch_lineage_edges', 'SELECT');  -- expect: t
SELECT pg_typeof(movement_type) FROM watches_catalog LIMIT 1;  -- expect: movement_type_enum
SELECT pg_typeof(era) FROM watches_catalog LIMIT 1;            -- expect: watch_era
```

**Expected:** All 5 queries return expected values. watch_families = 10 (anchor families inserted). watch_lineage_edges = 2 (Submariner 3-node chain). anon SELECT = t. Both enum types reported correctly.

**Why human:** Tables are currently empty (DEV-35-07-02). The backfill scripts' idempotent ON CONFLICT DO NOTHING logic and the ref-triple resolver in backfill-catalog-lineage.ts have not been exercised against real data. Requires a real watch in the catalog to kick off the dependency chain.

### Gaps Summary

No gaps blocking phase goal achievement. All 5 ROADMAP success criteria are satisfied at the schema level. The two human verification items are runtime operational checks that require live DB state (anchor catalog rows) which do not yet exist due to the accepted DEV-35-07-02 deviation (Option A: ship schema only, defer data seeding until catalog grows organically).

The phase contract is explicitly schema-only per CONTEXT.md and confirmed by the 35-07-SUMMARY ROADMAP disposition table. Deferred data seeding is tractable — all backfill scripts are idempotent and re-runnable once watches exist.

**Documented accepted deviations (operator-acknowledged, not blockers):**
- DEV-35-07-01: 12 auth.users at deploy time (D-02 single-user assumption); all confirmed test data; CASCADE blast radius accepted.
- DEV-35-07-02: Backfill chain vacuous (Phase 17 derives catalog from watches; post-TRUNCATE watches=0). Option A accepted: schema deployed; data seeding deferred.
- DEV-35-07-03: pg_depend query had cross-table attnum collision bug; corrected query confirmed zero true dependents.

---

_Verified: 2026-05-10T00:25:00Z_
_Verifier: Claude (gsd-verifier)_

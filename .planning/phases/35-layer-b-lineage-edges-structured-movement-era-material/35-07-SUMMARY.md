---
phase: 35-layer-b-lineage-edges-structured-movement-era-material
plan: 07
status: complete-with-deviations
type: execute
wave: 4
completed: 2026-05-10
requirements:
  - CAT-16
threats_addressed:
  - T-35-01
  - T-35-02
  - T-35-03
  - T-35-04
  - T-35-05
deviations:
  - id: DEV-35-07-01
    locked_decision: D-02 (single-user prod assumption)
    actual: "auth.users count = 12 at deploy time"
    operator_acknowledgment: "All 12 accounts confirmed test data; full CASCADE blast radius accepted (2026-05-10)"
    follow_up: "Memory record project_db_wipeable_2026_05_09.md must be updated to reflect 12-user state"
  - id: DEV-35-07-02
    locked_decision: D-14 step 3 (db:backfill-catalog reseeds canonical References post-TRUNCATE)
    actual: "Phase 17 backfill-catalog.ts derives catalog rows FROM watches (not a standalone seed). Post-TRUNCATE, watches=0 → catalog can't be derived → 0 rows reseeded"
    cascade: "Tasks 5, 6, 7 also vacuous: brands derived from catalog → 0 brands; families need brands → 0 inserted (10 skipped); lineage needs catalog refs → no test possible"
    operator_acknowledgment: "Option A selected: ship schema only; defer data seeding until catalog grows organically via /watch/new flow"
    follow_up: "Phase 35 plan author missed this dependency in D-14. Options for future: (a) accept current state — re-running backfills is idempotent once watches exist, (b) write standalone scripts/seed-data/brands.json + scripts/backfill-anchor-brands.ts to provide a brands-without-watches seed path, (c) derive seed catalog refs directly from scripts/seed-data/families.json. Tracked as informational, not a Phase 35 blocker."
  - id: DEV-35-07-03
    locked_decision: pg_depend pre-flight query (D-03b) returns true zero dependents
    actual: "Original query had a UNION-without-table-correlation bug — falsely matched watches_catalog_image_source_url_protocol_check (CHECK constraint on column attnum=10 = image_source_url, not movement). Corrected query (joining pg_attribute by attrelid+attnum to confirm column name = 'movement') returned zero rows."
    operator_acknowledgment: "False positive resolved; safe to proceed (2026-05-10)"
    follow_up: "Update memory rule project_drizzle_supabase_db_mismatch.md rule 4 with the corrected query; update docs/deploy-db-setup.md §35 pg_depend section."
---

# Phase 35 Plan 07 — Production Deploy Summary

> **Plan type:** [BLOCKING] operator-driven prod deploy
> **Outcome:** Schema fully deployed; data seeding deferred per Option A (Issue B)
> **Production state:** Phase 35 migration applied atomically; 0 RAISE EXCEPTION; transaction committed

## Task Outcomes

### Task 1 — Single-user assumption check
**Result:** `auth.users count = 12` (NOT 1)
**Disposition:** Operator confirmed all 12 accounts are test data, full CASCADE blast radius accepted. Logged as DEV-35-07-01. Approved.

### Task 2 — pg_depend pre-flight on movement column
**Result (corrected query):** Zero rows. Initial query produced 2 false-positive rows due to a cross-table attnum collision (`watches.movement` and `watches_catalog.image_source_url` both = attnum 10).
**Disposition:** Approved after running corrected query. Logged as DEV-35-07-03. Documentation update required.

### Task 3 — supabase db push --linked
**Result:**
```
Applying migration 20260510000001_phase35_layer_b.sql...
NOTICE: truncate cascades to table "activities"
NOTICE: truncate cascades to table "wear_events"
NOTICE: truncate cascades to table "watches"
NOTICE: truncate cascades to table "watches_catalog_daily_snapshots"
[etc — 6 cascade notices]
NOTICE: trigger "watch_lineage_edges_set_updated_at_trg" for relation "watch_lineage_edges" does not exist, skipping
NOTICE: policy "lineage_edges_select_all" for relation "watch_lineage_edges" does not exist, skipping
Finished supabase db push.
```
**Exit code:** 0
**CASCADE chain confirmed:** `TRUNCATE watches` cascaded to `activities` + `wear_events`. `TRUNCATE watches_catalog` cascaded to `watches_catalog_daily_snapshots` + `watches` (then transitively the same). All wiped atomically.
**DO $$ assertions:** All passed (no RAISE EXCEPTION in output).
**Migration table:** `20260510000001_phase35_layer_b` synced on remote (verified via `supabase migration list --linked`).

### Task 4 — db:backfill-catalog
**Result:** `[backfill] OK — total linked: 0, unlinked remaining: 0, elapsed: 5458ms`
**Disposition:** Vacuous run — Phase 17 script derives catalog from `watches`; post-TRUNCATE `watches=0` so 0 rows derived. This is the root of Issue B (DEV-35-07-02).

### Task 5 — db:backfill-catalog-brands
**Result:** `[backfill-catalog-brands] OK — inserted=0 patched=0 linked=0 unlinked=0 elapsedMs=9301`
**Disposition:** Vacuous — brands derived from `watches_catalog`, which is empty. Cascade of Issue B.

### Task 6 — db:backfill-catalog-families
**Result:** All 10 entries skipped with `WARN — brand_slug not resolved`. Script asserted `FAILED — watch_families is empty after passA`.
**Disposition:** Operator-acknowledged stop per Option A. Cascade of Issue B (no brands to resolve against). Script behavior was correct per Q4 design (warn-on-skip) — the assertion failure is the script protecting downstream consumers.

### Task 7 — db:backfill-catalog-lineage
**Result:** Not executed. Operator stopped at Task 6 failure.
**Disposition:** N/A per Option A. Lineage edges deferred.

### Task 8 — Schema-shape smoke (re-scoped from data-volume smoke)
Replaced the planned 6 data-volume SELECTs with 9 schema-introspection SELECTs since Tasks 4–7 produced no data. All 9 returned expected results:

| # | Query | Result |
|---|---|---|
| 1 | `to_regclass('public.watch_lineage_edges') IS NOT NULL` | `true` |
| 2 | `has_table_privilege('anon', ..., 'SELECT')` | `true` |
| 3 | `has_table_privilege('authenticated', ..., 'SELECT')` | `true` |
| 4 | 3 new pgEnums exist | `lineage_relationship_type`, `movement_type_enum`, `watch_era` (3 rows) |
| 5 | 5 new columns on `watches_catalog` | All 5 with correct `udt_name` (`movement_type_enum`, `text`, `watch_era`, `text`, `text`) |
| 6 | Old `movement` column dropped | Zero rows (column removed from both `watches` and `watches_catalog`) |
| 7 | `check_lineage_cycle` function exists | `proname=check_lineage_cycle`, `has_body=true` |
| 8 | Cycle trigger wired (after correction query) | `trg_check_lineage_cycle` BEFORE INSERT firing `check_lineage_cycle` |
| 9 | `watch_lineage_edges` constraints | 5 constraints: `lineage_edges_unique_triple` (UNIQUE), `no_self_loop` (CHECK), PK, 2× FK with ON DELETE RESTRICT |

**Approved.**

### Task 9 — Cycle trigger smoke test
**Result:** N/A. Task 7 inserted 0 anchor edges (cascade of Issue B), so the cycle-completing INSERT smoke test has no edge graph to test against. The trigger is verified to exist and be wired correctly (Task 8 query 8). Runtime cycle behavior remains untested in prod until catalog has at least 3 lineage-related rows.

**Disposition:** Documented N/A; deferred until catalog grows. Compile-time evidence (Plan 01 static guard test, 5/5 pass) covers SC#2.

## ROADMAP Success Criteria Disposition

| SC# | Criterion | Disposition |
|---|---|---|
| 1 | watch_lineage_edges table + cycle trigger | ✅ Schema deployed (Task 3 + Task 8 §1 + §8). Edges seeded = 0 (Issue B). |
| 2 | CYCLE clause + depth<10 in every WITH RECURSIVE | ✅ Plan 01 static guard test (5/5 pass) — load-bearing post-Plan 04. |
| 3 | getLineageForReference returns 3-node chain | ⚠ Compile-time only via Plan 01. Runtime smoke deferred (Issue B — anchor refs not in re-seeded catalog). |
| 4 | movement_type pgEnum + movement_caliber + old movement removed | ✅ Schema deployed (Task 8 §4 + §5 + §6). |
| 5 | era + case_material + bracelet_config columns; existing DAL queries unchanged | ✅ Schema deployed (Task 8 §5). DAL parity verified during Wave 2 vitest run (4212 pass). |

**Phase 35 contract = SCHEMA, not data.** All schema criteria green. Data seeding deferred is documented and tractable.

## STRIDE Threat Disposition

| Threat | Mitigation Verified |
|---|---|
| T-35-01 (anon write to lineage edges) | ✅ RLS public-read-only verified (Task 8 §2 + §3); writes restricted to service_role |
| T-35-02 (TRUNCATE collateral damage) | ✅ DEV-35-07-01 acknowledged; atomic transaction confirmed (Task 3 single `Finished supabase db push`); no rollback |
| T-35-03 (cycle trigger bypass) | ⚠ Trigger wired (Task 8 §8); runtime smoke (Task 9) deferred. CHECK constraint covers self-loop case (Task 8 §9). |
| T-35-04 (movement column drop dependents) | ✅ DEV-35-07-03 corrected pg_depend query confirmed zero true dependents; migration's `DROP COLUMN movement` succeeded without rollback |
| T-35-05 (lineage edge orphan via catalog DELETE) | ✅ ON DELETE RESTRICT FKs verified (Task 8 §9); attempting catalog DELETE while edges exist will raise FK violation |

## Follow-up Actions

1. **Update memory `project_db_wipeable_2026_05_09.md`** — replace single-user assumption with current 12-user (all-test) state. Move re-check trigger to "13th user signs up" or "first non-test user signs up". DEV-35-07-01.
2. **Update `docs/deploy-db-setup.md` §35** — replace the original pg_depend query with the corrected version (DEV-35-07-03). Add a footgun note about cross-table attnum collisions.
3. **Update memory `project_drizzle_supabase_db_mismatch.md` rule 4** — same correction.
4. **Once a real watch is added via `/watch/new`** — re-run the backfill chain to populate brands, families, and lineage:
   ```bash
   DATABASE_URL="<prod>" npm run db:backfill-catalog
   DATABASE_URL="<prod>" npm run db:backfill-catalog-brands -- --patch-country=scripts/country.json
   DATABASE_URL="<prod>" npm run db:backfill-catalog-families
   DATABASE_URL="<prod>" npm run db:backfill-catalog-lineage
   ```
   All scripts are idempotent (`ON CONFLICT DO NOTHING` + `WHERE x IS NULL`); safe to re-run any time.
5. **Optional Phase 35.x or v5.1 follow-up** — write `scripts/seed-data/brands.json` + `scripts/backfill-anchor-brands.ts` to provide a brands-without-watches seed path. Closes Issue B at the architectural level. Out of Phase 35 scope; tracked as informational.
6. **Runtime cycle trigger validation** — execute Task 9 once Submariner refs (5513, 14060, 124060) exist in prod catalog. Cheap to do post-hoc; not blocking.

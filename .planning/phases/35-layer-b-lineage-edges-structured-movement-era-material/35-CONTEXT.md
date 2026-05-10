# Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the `watch_lineage_edges` junction table with cycle-safety guarantees, replace the free-text `movement` column with a structured pgEnum on BOTH `watches_catalog` AND `watches`, add the `lineage_relationship_type` pgEnum, add the `watch_era` pgEnum, and add three first-class catalog descriptor columns (`era`, `case_material`, `bracelet_config`) — unblocking SRCH-16's movement facet while staying schema-only (no UI).

Phase 35 ships:

1. New table `watch_lineage_edges` with `(predecessor_catalog_id, successor_catalog_id, relationship_type, metadata jsonb)`, public-read RLS + service-role-write policies co-located in the migration file, BEFORE INSERT cycle-detection trigger, CHECK constraint preventing self-loops, UNIQUE constraint on `(pred, succ, relationship_type)`.
2. New pgEnum `lineage_relationship_type` with values `('successor', 'predecessor', 'remake', 'tribute', 'homage')`.
3. New pgEnum `movement_type_enum` with values `('auto', 'manual', 'quartz', 'spring_drive')`. Replaces existing free-text `movement` column on BOTH `watches_catalog` and `watches`.
4. New pgEnum `watch_era` with 13 decade values from `'1900-1910'` through `'2020-2030'`.
5. New columns on `watches_catalog`: `movement_type` (pgEnum, nullable), `movement_caliber` (text, nullable), `era` (pgEnum, nullable), `case_material` (text, nullable, no DB constraint), `bracelet_config` (text, nullable, no DB constraint).
6. Parallel `movement_type` + `movement_caliber` columns on `watches`. Old `movement` text column dropped from BOTH tables.
7. New DAL file `src/data/hierarchy.ts` with `getLineageForReference(catalogId)` recursive CTE — `CYCLE` clause AND depth-guard 10 on every `WITH RECURSIVE` query.
8. New cycle-check trigger function `check_lineage_cycle()` — bounded recursive CTE with depth 10, `RAISE EXCEPTION` with offending edge IDs in the message.
9. TS-side realignment: `MOVEMENT_TYPES` constant in `src/lib/constants.ts` matches DB enum exactly (4 values, dropping `'automatic'`/`'spring-drive'`/`'other'`); new `MOVEMENT_LABELS` map for display strings; `Watch.movement` type updated; `WatchForm` dropdown rebuilt; `src/lib/extractors/llm.ts` cleaning logic realigned; similarity engine reads adjusted.
10. Three new TS suggested-label constants: `CASE_MATERIALS_SUGGESTED`, `BRACELET_CONFIGS_SUGGESTED`, era values surfaced via Drizzle inference.
11. Family seeding via `scripts/seed-data/families.json` + `scripts/backfill-catalog-families.ts` (idempotent: `WHERE family_id IS NULL`).
12. Lineage edge seeding via `scripts/seed-data/lineage-edges.json` + `scripts/backfill-catalog-lineage.ts` (idempotent: skip-on-missing-ref with warning log).
13. Phase 35 migration begins with `TRUNCATE watches CASCADE; TRUNCATE watches_catalog CASCADE;` — explicit data wipe (single-user prod, agreed). Re-seed runbook: push migration → `db:backfill-catalog` (existing Phase 17 script) → `db:backfill-catalog-brands` (existing Phase 34 script, idempotent re-run) → `db:backfill-catalog-families` (NEW) → `db:backfill-catalog-lineage` (NEW).
14. Small anchor seed data: ~10 families across Rolex / Omega / Tudor / Audemars Piguet / Patek Philippe / Grand Seiko, plus ONE 3-node Submariner lineage chain to validate `getLineageForReference` against ROADMAP success #3.
15. Deploy runbook update at `docs/deploy-db-setup.md` with the Phase 35 section (migration push, TRUNCATE warning, the 4 backfill script invocations, smoke-test SELECTs).
16. `pg_depend` pre-flight check documented in the migration runbook before dropping the `movement` column from either table (memory rule 4).

**In scope:** Schema DDL for the 4 new pgEnums, 1 new junction table with cycle trigger, 5 new columns on `watches_catalog`, 2 new columns on `watches`, 1 new DAL file (`src/data/hierarchy.ts`), 2 new backfill scripts, 2 JSON seed files (anchor set), TRUNCATE wipe, TS-side `MOVEMENT_TYPES` realignment + form/extractor/similarity wiring updates, deploy runbook update.

**Not in scope:** Lineage browse UI (DEFERRED to Phase 39 by Phase 33b Q2 verdict); `/family/{id}` route (Phase 39 / v5.x); `/brand/{id}` route (Phase 39 / v5.x); admin UI for family/lineage CRUD (no admin UI in any v5.0 phase per ROADMAP); `case_size_mm` enum/category restructuring (out of scope — kept as `real`); SRCH-16 facet UI (separate Phase 40 work); CAT-13 engine rewire reading new columns (Phase 38); variant-level material/bracelet variation (Phase 36 `watch_variants`); reciprocal-pair edge insertion (rejected — directional only); LLM auto-inference of lineage edges (REQUIREMENTS line 27 forbids — manual curation only); `era` ↔ `era_signal` coupling (independent columns serving different surfaces).

**ROADMAP success criteria coverage (verbatim from `.planning/ROADMAP.md` §Phase 35 lines 218–223):**
1. `watch_lineage_edges` table with `(predecessor_catalog_id, successor_catalog_id, relationship_type, metadata)` and BEFORE INSERT cycle trigger — covered by D-04 + D-06.
2. Every recursive CTE in `src/data/hierarchy.ts` has `CYCLE` clause AND depth-guard 10 — covered by D-08.
3. `getLineageForReference(catalogId)` returns correct results for a 3-node chain — covered by D-08 + D-13 anchor seed (Submariner 5513 → 14060 → 124060).
4. `movement_type` pgEnum `(auto, manual, quartz, spring_drive)` + `movement_caliber TEXT`; old `movement` removed; SRCH-16 sources facet from `movement_type` — covered by D-01 + D-02 + D-03.
5. `era` (text), `case_material` (text), `bracelet_config` (text) on `watches_catalog`; existing DAL queries return correct results unchanged — covered by D-09 + D-10 + D-11. (Note: post-wipe, "unchanged DAL results" applies to the SHAPE of returned rows, not their COUNT — the wipe means catalog row count drops to 0 then re-seeds via existing scripts.)

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 35 uses the `D-NN` prefix.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 17 D-02 / D-03 — GENERATED normalization columns:** Any new `*_normalized` column MUST be `GENERATED ALWAYS AS (...)`. Phase 35 doesn't add new normalized columns but inherits the discipline (e.g., the family seed script does NOT compute slug normalization in app code).
- **Phase 17 D-04 / D-06 — RLS pattern:** Public-read SELECT for `anon` and `authenticated`; INSERT/UPDATE/DELETE restricted to `service_role` only. Co-located in the same Supabase migration file as the `CREATE TABLE`. Applies to `watch_lineage_edges`.
- **Phase 19.1 / Phase 17 — drizzle vs supabase migration split:** Drizzle is the type source of truth; the Supabase migration is authoritative for DDL (RLS, CHECK, GENERATED, pgEnum DEFINITIONS, FK clauses, the cycle trigger function). Phase 35 emits both files; the Supabase migration carries the trigger + RLS + the 4 `CREATE TYPE` statements; the Drizzle migration mirrors structural shape but does NOT duplicate the trigger or RLS.
- **Phase 33b Q2 verdict (DEFERRED) — lineage browse UI:** Phase 35 ships SCHEMA-ONLY. Lineage browse UI / `/family/{id}` page / catalog walk-affordance are deferred to Phase 39 or v5.x per `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §Decision Q2. Phase 35 ships ZERO user-facing UI affordances.
- **Phase 34 D-02 — `ON DELETE RESTRICT` for catalog FKs:** `watch_lineage_edges.predecessor_catalog_id` and `.successor_catalog_id` both use `ON DELETE RESTRICT`. Service-role-only writes mean no app-flow risk; orphan-detection signal at delete time is the value.
- **Phase 34 D-03 — family seeding deferred to here:** Phase 35 owns `watch_families` row population (was deferred from Phase 34). Deferred → addressed via D-12 + D-13.
- **REQUIREMENTS CAT-16 line 27 — manual lineage curation only:** Automated/algorithmic lineage inference is FORBIDDEN (false-positive risk across unrelated families). All lineage rows enter via the JSON seed file + backfill script path.
- **Memory `project_drizzle_supabase_db_mismatch.md` — all 4 prod-push gotchas live this phase:** (1) 14-digit timestamp filename; (2) no insertion between adjacent integers; (3) `extensions.gin_trgm_ops` schema-qualified opclass — N/A unless GIN indexes are added (Phase 35 plans none); (4) `pg_depend` query BEFORE writing the `DROP COLUMN movement` clause to surface any dependents (indexes, views, functions). MANDATORY pre-migration step in the Phase 35 runbook.
- **Memory `project_db_wipeable_2026_05_09.md`:** Production DB is wipeable; user is sole occupant. TRUNCATE is on the table for Phase 35 — already chosen (D-02 wipe at start). Re-check this memory before assuming for any FUTURE phase.

### Movement enum migration & TS-side alignment (Area 1)

- **D-01:** Create pgEnum `movement_type_enum` with values `('auto', 'manual', 'quartz', 'spring_drive')` — DB-canonical, snake_case, 4 values. No `'other'` slot.
- **D-02:** Phase 35 migration begins with `TRUNCATE watches CASCADE; TRUNCATE watches_catalog CASCADE;` inside the migration transaction (single-user prod, user-agreed). Then DROP old `movement` text column from both tables, ADD `movement_type movement_type_enum NULL` and `movement_caliber TEXT NULL` on both tables. Skips all value-mapping logic / 'other' handling / audit CSV — no rows to map.
- **D-03:** Migration applies to BOTH tables (not just `watches_catalog`). User explicitly chose to mirror the migration on `watches` despite expanded scope. Phase 35 also rewrites: `Watch.movement` type in `src/lib/types.ts`, `MOVEMENT_TYPES` constant in `src/lib/constants.ts`, the `WatchForm` movement dropdown, `cleanWatch` logic in `src/lib/extractors/llm.ts`, any `similarity.ts` / engine references reading `movement`.
- **D-03a — TS-side `MOVEMENT_TYPES` exact-match:**
  ```typescript
  // src/lib/constants.ts
  export const MOVEMENT_TYPES = ['auto', 'manual', 'quartz', 'spring_drive'] as const

  // Display labels (UI rendering only — never persisted)
  export const MOVEMENT_LABELS: Record<MovementType, string> = {
    auto:         'Automatic',
    manual:       'Manual',
    quartz:       'Quartz',
    spring_drive: 'Spring Drive',
  }
  ```
  `WatchForm` dropdown shows display labels (`MOVEMENT_LABELS[v]`) but persists raw enum values. The extractor's `cleanWatch` validates against the 4-value list and silently drops values that don't match (no longer maps `'automatic'` to a TS-only sentinel — there is no `'other'` enum slot).
- **D-03b — pre-migration `pg_depend` check:** The migration runbook MUST include this query BEFORE the migration is committed to the file:
  ```sql
  SELECT classid::regclass, objid::regclass, refobjid::regclass, refobjsubid
    FROM pg_depend
   WHERE refobjid IN ('watches'::regclass, 'watches_catalog'::regclass)
     AND refobjsubid IN (
       SELECT attnum FROM pg_attribute
        WHERE attrelid = 'watches'::regclass AND attname = 'movement'
       UNION ALL
       SELECT attnum FROM pg_attribute
        WHERE attrelid = 'watches_catalog'::regclass AND attname = 'movement'
     );
  ```
  Output drives whether additional `DROP INDEX` / `DROP VIEW` clauses are needed in the migration. Documented as the FIRST step in the Phase 35 deploy runbook (per memory rule 4 and Phase 19.1 D-04 precedent).

### Lineage edge storage shape (Area 2)

- **D-04:** Create pgEnum `lineage_relationship_type` with values `('successor', 'predecessor', 'remake', 'tribute', 'homage')` (REQUIREMENTS line 27 lock — values cannot be re-litigated). Stored on `watch_lineage_edges.relationship_type` as `lineage_relationship_type NOT NULL`.
- **D-05 — Directional-only storage:** One edge row per fact. `(predecessor_catalog_id=A, successor_catalog_id=B, relationship_type='successor')` means "B is the successor of A". The DAL UNIONs both directions in its recursive CTE — the schema does NOT auto-insert reciprocal pairs. No AFTER INSERT trigger writes inverse rows. Single source of truth; no sync risk.
- **D-06 — Cycle prevention is two-layered:**
  - **Self-loop prevention:** CHECK constraint at the column level — `CHECK (predecessor_catalog_id <> successor_catalog_id)`. Cheapest path; rejects before the trigger fires.
  - **Deeper-cycle prevention:** BEFORE INSERT trigger function `check_lineage_cycle()` runs a bounded recursive CTE with depth limit 10 (matches read CTE depth from ROADMAP success #2). On detected cycle, `RAISE EXCEPTION 'Lineage cycle detected: % -> %', NEW.predecessor_catalog_id, NEW.successor_catalog_id;` — error message includes both endpoints for downstream debug.
- **D-07 — Edge uniqueness:** `UNIQUE (predecessor_catalog_id, successor_catalog_id, relationship_type)`. A given pair `(A, B)` can carry MULTIPLE relationship_type rows (e.g., a watch can be both 'remake' AND 'tribute' of another). Loosest reasonable constraint that still prevents accidental duplicates.
- **D-08 — `getLineageForReference(catalogId)` shape:** Recursive CTE that walks BOTH directions from the input catalog ID using a `UNION` of `predecessor_catalog_id = $1 OR successor_catalog_id = $1`, then recurses joining `e.predecessor_catalog_id = c.successor_catalog_id OR e.successor_catalog_id = c.predecessor_catalog_id`. Includes Postgres 15 `CYCLE id SET is_cycle USING path` clause AND a `WHERE depth < 10` guard inside the recursive arm. Returns rows joined to `watches_catalog` for the displayed metadata. Planner figures out the exact return shape — must include enough fields for the future Phase 39 lineage browse UI to render walk affordances.

### Era / case_material / bracelet_config column shape (Area 3)

- **D-09 — `era` is a NEW pgEnum independent of existing `era_signal`:**
  Two different columns serving two different purposes coexist on `watches_catalog`:
  - `era` (Phase 35, NEW) = curator-set FACTUAL classification of the watch's design/release decade. pgEnum values:
    ```
    '1900-1910', '1910-1920', '1920-1930', '1930-1940', '1940-1950',
    '1950-1960', '1960-1970', '1970-1980', '1980-1990', '1990-2000',
    '2000-2010', '2010-2020', '2020-2030'
    ```
    (13 decade values — cadence is one ALTER TYPE ADD VALUE migration per decade, with pg_depend ritual per memory rule 4.)
  - `era_signal` (Phase 19.1, EXISTING) = LLM-derived TASTE signal for the recommender. Values: `'vintage-leaning' | 'modern' | 'contemporary'`. Stays untouched.
  No coupling; no auto-population from one to the other; no drop. `era` serves filtering/grouping ('show me 1960s watches'); `era_signal` serves taste matching (CAT-13 engine future).
- **D-10 — `case_material` is free text + suggested-label list:**
  ```sql
  ALTER TABLE watches_catalog ADD COLUMN case_material TEXT NULL;
  -- No CHECK constraint — freeform values like 'ceramic-titanium-hybrid'
  -- (IWC) flow through cleanly.
  ```
  TS canonical list lives in `src/lib/constants.ts`:
  ```typescript
  export const CASE_MATERIALS_SUGGESTED = [
    'steel',
    'gold-yellow',
    'gold-rose',
    'gold-white',
    'two-tone-steel-gold',
    'titanium',
    'ceramic',
    'bronze',
    'platinum',
    'carbon-fiber',
  ] as const
  ```
  Suggested list covers ~98% of cases; specialty alloys go in as freeform strings. Single text value (NOT array) — composite alloys are a single composite material, not multiple materials in different parts. Two-tone gets a dedicated compound label (`'two-tone-steel-gold'`). Variant-level material variation (e.g., Submariner steel vs gold) is Phase 36 `watch_variants` concern — catalog row holds the canonical/primary material.
- **D-11 — `bracelet_config` mirrors `case_material`:**
  ```sql
  ALTER TABLE watches_catalog ADD COLUMN bracelet_config TEXT NULL;
  -- No CHECK constraint.
  ```
  TS canonical list:
  ```typescript
  export const BRACELET_CONFIGS_SUGGESTED = [
    'integrated-bracelet',  // AP Royal Oak, PP Nautilus
    'bracelet-only',        // Sub on Oyster only
    'leather-strap-only',   // Speedy Pro on leather
    'rubber-strap-only',    // Daytona Oysterflex variant
    'bracelet-and-strap',   // Ships with both
    'nato-strap',
    'bund-strap',
  ] as const
  ```
  Multi-bracelet variants (Daytona Oysterflex vs Oyster, Speedmaster on bracelet vs strap) belong on Phase 36 `watch_variants`. Catalog row holds the canonical/primary config.

### Family seeding + lineage curation strategy (Area 4)

- **D-12 — Curation lives in two git-tracked JSON files + two idempotent backfill scripts:**
  - `scripts/seed-data/families.json` — array of `{ brand_slug, name, slug? }`. Read by `scripts/backfill-catalog-families.ts` (NEW). The script performs both inserts (`INSERT ... ON CONFLICT DO NOTHING` keyed on `(brand_id, name_normalized)`) AND `watches_catalog.family_id` linking (`UPDATE watches_catalog SET family_id = ... WHERE family_id IS NULL AND ...` — idempotent).
  - `scripts/seed-data/lineage-edges.json` — array of `{ predecessor_ref, successor_ref, relationship_type }` where `predecessor_ref` and `successor_ref` are `"<brand_slug>/<family_slug>/<reference>"` triples. Read by `scripts/backfill-catalog-lineage.ts` (NEW). The script resolves each triple to a `watches_catalog.id` and INSERTs the edge — `INSERT ... ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING` per D-07. Edges whose triples don't resolve to existing catalog rows log a warning and skip (no placeholder catalog inserts — preserves SEED-001 catalog provenance).
  - Both scripts mirror the Phase 17 `scripts/backfill-catalog.ts` pattern: `--env-file=.env.local` env loading, BATCH_SIZE = 100 (overkill at anchor scale, but sets the discipline), service-role `DATABASE_URL`.
  - `package.json` adds `"db:backfill-catalog-families": "tsx --env-file=.env.local scripts/backfill-catalog-families.ts"` and `"db:backfill-catalog-lineage": "tsx --env-file=.env.local scripts/backfill-catalog-lineage.ts"`.
- **D-13 — Anchor seed data shipped in Phase 35:**
  - `scripts/seed-data/families.json` ships ~10 rows: Rolex Submariner, GMT-Master, Datejust, Daytona; Omega Speedmaster, Seamaster; Tudor Black Bay; Audemars Piguet Royal Oak; Patek Philippe Nautilus; Grand Seiko Snowflake.
  - `scripts/seed-data/lineage-edges.json` ships ONE 3-node Submariner chain: `5513 → 14060 → 124060` (two edges, both `relationship_type='successor'`). Validates `getLineageForReference(catalogId)` returns the full 3-node chain in unit tests — directly satisfies ROADMAP success #3.
  - The user extends both files post-deploy by editing JSON + re-running the scripts (idempotent — re-runs are no-ops on existing rows).
- **D-14 — Operational order in the Phase 35 deploy runbook:**
  1. Run pg_depend pre-flight check (D-03b) — abort if unexpected dependents found.
  2. `supabase db push --linked` — runs the migration (TRUNCATE → DROP movement → ADD enums + columns → CREATE TABLE watch_lineage_edges + cycle trigger + RLS, all in one transaction).
  3. `npm run db:backfill-catalog` — re-seeds canonical Reference rows (existing Phase 17 script; provides the catalog rows that family/lineage seeding will reference).
  4. `npm run db:backfill-catalog-brands` — re-seeds brands (existing Phase 34 script; idempotent re-run after the wipe re-populates `watches_catalog.brand_id`).
  5. `npm run db:backfill-catalog-families` — NEW. Inserts 10 family rows; links `watches_catalog.family_id` for the seeded refs.
  6. `npm run db:backfill-catalog-lineage` — NEW. Inserts 2 lineage edges (Submariner chain). Logs warnings for any seed entries whose refs aren't in catalog yet (none expected at anchor scale).
  7. Smoke-test SELECTs:
     ```sql
     SELECT COUNT(*) FROM watch_families;             -- expect 10
     SELECT COUNT(*) FROM watch_lineage_edges;        -- expect 2
     SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NULL;
       -- expect 0 for seeded family refs; > 0 for catalog rows whose
       -- family isn't in the anchor seed (expected behavior)
     ```

### Claude's Discretion

User selected the recommended option on every question across all 4 areas, with two clarifications:
- Area 1 Q2 (`watches` table parity): user chose to MIRROR the migration on `watches` rather than the recommended catalog-only scope, expanding Phase 35's scope to include the WatchForm + extractor + similarity engine wiring updates.
- Area 3 Q2 (era values): user specified the decade format and range (1900-1910 through 2020-2030, 13 values).
- Area 3 Q3 (case_material): user clarified the freeform-text-with-suggested-list pattern for specialty alloys (IWC ceramic-titanium hybrid).

No areas were left for Claude's free discretion. D-01 through D-14 are all user-confirmed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material" lines 214–224 — phase goal + 5 success criteria. Source of all "MUST" wording.
- `.planning/REQUIREMENTS.md` §CAT-16 (line 27) — full requirement text (lineage table shape, cycle trigger, recursive CTE depth-guard 10 + CYCLE clause, getLineageForReference DAL function, movement_caliber + movement_type pgEnum, era/case_material/bracelet_config columns, manual curation only — NO automated inference).
- `.planning/STATE.md` §"Current Position" — Phase 35 next-up after Phase 34 close (2026-05-09).
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — original catalog hierarchy proposal; lineage edges + movement enum + era/material/bracelet are Layer B of the 5-level hierarchy.

### Phase 33b inheritance (locked verdict)
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §"Decision Q2: Lineage browse priority" — DEFERRED verdict; Phase 35 ships schema-only; lineage browse UI moves to Phase 39 (preferred) or v5.x. Phase 35 ships ZERO UI surface.
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §NSV-02, NSV-09, NSV-16 — same-family/lineage missing-vector rows that Phase 35 schema unblocks but does NOT close (UI close is Phase 39).
- `.planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md` §"Decisions" — full Phase 33b decision shape; NSD-12 leverage-informs-but-does-not-force-verdict rule.

### Phase 34 inheritance (load-bearing precedents)
- `.planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` — D-02 ON DELETE RESTRICT FK convention (Phase 35 watch_lineage_edges inherits), D-03 family-seeding-deferred-to-here, D-05 three-step migration discipline (Phase 35 is mid-stream — Step 2 of the family_id migration).
- `supabase/migrations/<14-digit>_phase34_brands_families.sql` — RLS policy shape for `brands` and `watch_families`; Phase 35 mirrors the public-read + service-role-write pattern verbatim for `watch_lineage_edges`.
- `scripts/backfill-catalog-brands.ts` — direct template for `scripts/backfill-catalog-families.ts` (env loading, batch loop, ON CONFLICT pattern, package.json script entry).

### Phase 17 patterns (load-bearing precedents)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — D-04 / D-06 RLS pattern, D-09 array column shape (Phase 35's `case_material` / `bracelet_config` are SCALAR text not arrays — divergence noted).
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` — RLS policy shape; check constraint examples; pgEnum CREATE TYPE precedent.
- `scripts/backfill-catalog.ts` — direct pattern template for both new scripts.
- `src/db/schema.ts` lines 282–347 — `watchesCatalog` definition; Phase 35 ADDs `movement_type`, `movement_caliber`, `era`, `case_material`, `bracelet_config` columns and DROPs `movement` text column. Lines 349+ — `brands` and `watchFamilies` definitions (Phase 34 — `watchFamilies` was schema-only, gets populated via D-12 seeding here).

### Phase 19.1 inheritance (era_signal coexistence)
- `.planning/phases/19.1-catalog-taste-enrichment/19.1-CONTEXT.md` §D-01 — `era_signal` LLM-derived taste attribute; values `'vintage-leaning' | 'modern' | 'contemporary'`; Phase 35's NEW `era` column is independent (D-09).
- `src/lib/types.ts` line 177 — `EraSignal` type; stays untouched.
- `src/db/schema.ts` line 333 — `eraSignal` column on `watches_catalog`; stays untouched.
- `src/lib/extractors/llm.ts` — D-07 byte-lock survives Phase 35 untouched (similar to Phase 34); the `cleanWatch` movement-validation logic is the only function changed.

### TS-side files Phase 35 modifies
- `src/lib/types.ts` — `MovementType` realigned to 4 DB-canonical values (`'auto' | 'manual' | 'quartz' | 'spring_drive'`); `Watch.movement` retyped; new `WatchEra` type from Drizzle inference.
- `src/lib/constants.ts` lines 72–78 — `MOVEMENT_TYPES` rewritten (drops `'automatic'`/`'spring-drive'`/`'other'`); add `MOVEMENT_LABELS` map; add `CASE_MATERIALS_SUGGESTED`; add `BRACELET_CONFIGS_SUGGESTED`.
- `src/lib/extractors/llm.ts` line 138 — `cleanWatch` movement validation logic realigned to the new 4-value list (silently drops unmatched values per D-03a).
- `src/components/watch/WatchForm.tsx` — movement dropdown rebuilt to use `MOVEMENT_LABELS[v]` for display, `MOVEMENT_TYPES[i]` for persisted value.
- `src/components/watch/AddWatchFlow.tsx` line 638 — default `movement` value updated from `'automatic'` to `'auto'` (keeps the same semantic default).
- `src/lib/similarity.ts` — any reads of `Watch.movement` continue working with the new enum values (planner verifies no string-literal comparisons need updating).
- `src/lib/stats.ts`, `src/components/insights/CollectionFitCard.test.tsx`, `src/components/profile/InsightsTabContent.tsx`, `src/components/watch/VerdictStep.tsx`, `src/components/watch/WatchCard.tsx`, `src/components/watch/WatchDetail.tsx`, `src/components/watch/CatalogPageActions.tsx`, `src/components/profile/__tests__/CollectionTabContent.test.tsx`, `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx`, `src/components/profile/WishlistTabContent.test.tsx`, `src/lib/verdict/viewerTasteProfile.test.ts`, `src/components/search/WatchSearchRowsAccordion.tsx` — every file with a string-literal comparison to `'automatic'` / `'spring-drive'` / `'other'` needs an audit pass.

### Existing DAL surface (read-path parity post-wipe)
- `src/data/catalog.ts` — 31 `watchesCatalog` references including movement reads (lines 61, 103, 194, 201, 215). Movement reads must continue working with the new column shape post-rewire.
- `src/data/watches.ts` — `getWatchesByUser` and friends; reads `movement` (lines 27, 66, 189) → reads `movement_type` + `movement_caliber` post-rewire.
- `src/data/discovery.ts`, `src/data/search.ts`, `src/data/recommendations.ts`, `src/data/suggestions.ts` — auxiliary DAL paths; verify with grep that none compare movement to a string literal that's been deprecated.

### NEW Phase 35 files
- `src/data/hierarchy.ts` — NEW DAL. `getLineageForReference(catalogId)` recursive CTE function. CYCLE clause + depth-guard 10 in every WITH RECURSIVE.
- `scripts/backfill-catalog-families.ts` — NEW. Reads `scripts/seed-data/families.json`; inserts families; links `watches_catalog.family_id`.
- `scripts/backfill-catalog-lineage.ts` — NEW. Reads `scripts/seed-data/lineage-edges.json`; resolves refs to catalog IDs; inserts edges via `ON CONFLICT DO NOTHING`.
- `scripts/seed-data/families.json` — NEW. ~10 anchor families.
- `scripts/seed-data/lineage-edges.json` — NEW. 2 anchor edges (Submariner 3-node chain).
- `supabase/migrations/<14-digit>_phase35_layer_b.sql` — NEW migration. Filename per memory rule 1 (14 digits + `_phase35_layer_b.sql`); timestamp must be greater than the highest existing migration filename.
- `drizzle/<NNNN>_phase35_layer_b.sql` — NEW Drizzle migration; structural twin (no RLS, no trigger, no CHECK — those go in the Supabase migration).
- `tests/static/hierarchy.lineage-3-node.test.ts` — NEW. Asserts `getLineageForReference(submariner_5513_id)` returns the full 3-node chain (ROADMAP success #3).

### Deploy runbook
- `docs/deploy-db-setup.md` — existing deploy runbook with footgun list and Phase 34 section. Phase 35 appends a new section: pg_depend pre-check (D-03b), TRUNCATE warning, the 6-step deploy order (D-14), smoke-test SELECTs.

### DB migration discipline (memory anchors)
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — ALL 4 prod-push gotchas live this phase. Rule 4 (pg_depend) is mandatory before DROP COLUMN movement.
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_db_wipeable_2026_05_09.md` — Phase 35 DECISION D-02 wipes; future phases must re-check `SELECT COUNT(*) FROM auth.users` before assuming wipeability.
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_local_db_reset.md` — Local dev re-sync after Phase 35 needs `supabase db reset` + drizzle push + selective supabase migrations via docker exec psql.
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` does not block anon; explicit `GRANT SELECT` to anon/authenticated still required for `watch_lineage_edges`.

### Future-phase consumers of Phase 35's schema
- `.planning/ROADMAP.md` §"Phase 36: Layer C" line 226–236 — variant split + clean-slate wipe + CAT-14 NOT NULL flip. Phase 36's wipe is REDUNDANT for tables Phase 35 already wiped, but Phase 36's variant split + re-link work proceeds as planned.
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" line 251–261 — CAT-13 reads catalog taste columns (formality, sportiness, etc.); does NOT need the new Phase 35 columns directly. New `era` column COULD inform a future taste dimension; out of Phase 38 scope.
- `.planning/ROADMAP.md` §"Phase 40: SRCH-16 Search Facets" — reads `watches_catalog.movement_type` enum directly for the Movement Type facet. Hard-blocked on Phase 35's enum landing.
- `.planning/ROADMAP.md` §"Phase 39: Audit-Driven Discovery Polish" — implements the lineage browse UI Phase 33b Q2 deferred. Reads from Phase 35's `watch_lineage_edges` + `watch_families`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`scripts/backfill-catalog-brands.ts` (Phase 34)** — direct template for `scripts/backfill-catalog-families.ts`. Reuse the env loading, idempotent INSERT…ON CONFLICT pattern, brand_normalized JOIN-back-to-catalog linking step.
- **`scripts/backfill-catalog.ts` (Phase 17)** — broader pattern reference for both new backfill scripts; specifically the BATCH_SIZE = 100 + `WHERE x IS NULL` idempotent loop.
- **`watchesCatalog` Drizzle definition (`src/db/schema.ts` lines 282–347)** — direct edit target. ADD 5 new columns; DROP `movement` text column; new pgEnum types declared via `pgEnum(...)` exports above the table definition.
- **`watches` Drizzle definition (`src/db/schema.ts` line 60+)** — secondary edit target. ADD 2 new columns (`movement_type`, `movement_caliber`); DROP `movement` text column.
- **Phase 17 + Phase 34 RLS migration shape** — verbatim template for `watch_lineage_edges` RLS (public-read SELECT for anon/authenticated; INSERT/UPDATE/DELETE service_role only).
- **`pgEnum` precedent in `src/db/schema.ts`** — Phase 17 / Phase 19.1 already define enum-like text columns via TS unions; Phase 35 introduces the FIRST true `pgEnum(...)` exports in the project. Drizzle 0.45.2 supports `pgEnum`. The migration's `CREATE TYPE` statements are authoritative DDL; the Drizzle definition mirrors via `pgEnum('movement_type_enum', [...])`.

### Established Patterns

- **Drizzle definition vs Supabase migration split** — Drizzle = TS source of truth; Supabase migration = authoritative DDL (RLS, CHECK, GENERATED, pgEnum CREATE TYPE statements, FK clauses, the trigger function). Phase 35 maintains this split.
- **Migration filename convention** — exactly 14 digits + `_phase35_layer_b.sql`. Per memory rule 1, never decorate timestamps with suffix letters. Per memory rule 2, no insertion between adjacent integers — use a timestamp greater than the highest existing.
- **Service-role-only writes via RLS** — applies to `watch_lineage_edges` (curator scripts run as service-role; no user write path).
- **Idempotent backfill via `WHERE x IS NULL` and `ON CONFLICT DO NOTHING`** — both new backfill scripts mirror this; re-runs are no-ops.
- **TS canonical lists in `src/lib/constants.ts`** — `MOVEMENT_TYPES`, `STRAP_TYPES`, `CRYSTAL_TYPES`, `WATCH_STATUSES` (existing pattern). Phase 35 extends with `MOVEMENT_LABELS`, `CASE_MATERIALS_SUGGESTED`, `BRACELET_CONFIGS_SUGGESTED`.

### Integration Points

- **Wipe + re-seed runbook** — Phase 35 deploy runbook is the FIRST deploy in the project history that explicitly TRUNCATEs prod data. `docs/deploy-db-setup.md` Phase 35 section MUST be unambiguous about this — bold warning at the top of the section.
- **`pg_depend` pre-check** — first phase to drop a column from `watches` since Phase 19.1's notes_public addition and Phase 27's sort_order addition (both ADDs, not DROPs). The runbook query MUST run BEFORE the migration is committed.
- **WatchForm dropdown migration** — the form currently shows `MOVEMENT_TYPES.map(t => <option value={t}>{t}</option>)`. Post-Phase-35 it shows `MOVEMENT_TYPES.map(t => <option value={t}>{MOVEMENT_LABELS[t]}</option>)`. Net 1-line change in the form; ~12 files need a string-literal audit (full list in canonical_refs above).
- **No app/UI integration for lineage** — `watch_lineage_edges` has no UI consumer in Phase 35. The `getLineageForReference` DAL function exists but is called only by the unit test. Phase 39 will wire it to UI.
- **No tests required by ROADMAP except success #3** — the 3-node lineage chain unit test is the load-bearing test for Phase 35. Other tests (movement enum migration sanity, era pgEnum CREATE TYPE survives `pg_depend` check, JSON seed file schema validation) are nice-to-have insurance — planner decides.

</code_context>

<specifics>
## Specific Ideas

- **Migration filename:** `supabase/migrations/<14-digit-greater-than-Phase-34>_phase35_layer_b.sql`. Single migration file containing: 4 `CREATE TYPE` statements (`movement_type_enum`, `lineage_relationship_type`, `watch_era`, plus `lineage_relationship_type`), 2 TRUNCATE statements, 2 `DROP COLUMN movement` statements, 5 `ADD COLUMN` statements on `watches_catalog`, 2 `ADD COLUMN` statements on `watches`, 1 `CREATE TABLE watch_lineage_edges` with all constraints, 1 `CREATE FUNCTION check_lineage_cycle()`, 1 `CREATE TRIGGER` BEFORE INSERT, all RLS policies for `watch_lineage_edges`, all `GRANT SELECT` statements.
- **Drizzle migration:** `drizzle/<next-sequential>_phase35_layer_b.sql` — structural twin (CREATE TYPE statements + table + columns), without RLS / trigger / CHECK clauses. Drizzle migration emits the schema shape for type inference; Supabase migration carries the safety mechanisms.
- **`scripts/seed-data/families.json` shape:**
  ```json
  [
    { "brand_slug": "rolex",  "name": "Submariner",   "slug": "submariner" },
    { "brand_slug": "rolex",  "name": "GMT-Master",   "slug": "gmt-master" },
    { "brand_slug": "rolex",  "name": "Datejust",     "slug": "datejust" },
    { "brand_slug": "rolex",  "name": "Daytona",      "slug": "daytona" },
    { "brand_slug": "omega",  "name": "Speedmaster",  "slug": "speedmaster" },
    { "brand_slug": "omega",  "name": "Seamaster",    "slug": "seamaster" },
    { "brand_slug": "tudor",  "name": "Black Bay",    "slug": "black-bay" },
    { "brand_slug": "audemars-piguet", "name": "Royal Oak", "slug": "royal-oak" },
    { "brand_slug": "patek-philippe",  "name": "Nautilus",  "slug": "nautilus" },
    { "brand_slug": "grand-seiko",     "name": "Snowflake", "slug": "snowflake" }
  ]
  ```
- **`scripts/seed-data/lineage-edges.json` shape:**
  ```json
  [
    { "predecessor_ref": "rolex/submariner/5513",  "successor_ref": "rolex/submariner/14060", "relationship_type": "successor" },
    { "predecessor_ref": "rolex/submariner/14060", "successor_ref": "rolex/submariner/124060", "relationship_type": "successor" }
  ]
  ```
- **`watch_lineage_edges` table shape:**
  ```sql
  CREATE TABLE watch_lineage_edges (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_catalog_id uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
    successor_catalog_id   uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
    relationship_type      lineage_relationship_type NOT NULL,
    metadata               jsonb NOT NULL DEFAULT '{}',
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_self_loop CHECK (predecessor_catalog_id <> successor_catalog_id),
    CONSTRAINT lineage_edges_unique_triple UNIQUE (predecessor_catalog_id, successor_catalog_id, relationship_type)
  );
  ```
- **Cycle-check trigger function** (full body, planner can refine):
  ```sql
  CREATE OR REPLACE FUNCTION check_lineage_cycle() RETURNS TRIGGER AS $$
  BEGIN
    IF EXISTS (
      WITH RECURSIVE walk AS (
        SELECT successor_catalog_id, 1 AS depth
          FROM watch_lineage_edges
         WHERE predecessor_catalog_id = NEW.successor_catalog_id
        UNION ALL
        SELECT e.successor_catalog_id, w.depth + 1
          FROM watch_lineage_edges e
          JOIN walk w ON e.predecessor_catalog_id = w.successor_catalog_id
         WHERE w.depth < 10
      )
      SELECT 1 FROM walk WHERE successor_catalog_id = NEW.predecessor_catalog_id
    ) THEN
      RAISE EXCEPTION 'Lineage cycle detected: % -> %',
        NEW.predecessor_catalog_id, NEW.successor_catalog_id;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_check_lineage_cycle
    BEFORE INSERT ON watch_lineage_edges
    FOR EACH ROW EXECUTE FUNCTION check_lineage_cycle();
  ```
- **Smoke-test runbook entries:**
  ```sql
  -- After supabase db push --linked + all 4 backfill scripts:
  SELECT has_table_privilege('anon', 'public.watch_lineage_edges', 'SELECT');  -- expect: t
  SELECT COUNT(*) FROM watch_families;             -- expect: 10
  SELECT COUNT(*) FROM watch_lineage_edges;        -- expect: 2
  SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NULL;
    -- expect: 0 for seeded family refs; > 0 for orphan rows is fine
  SELECT pg_typeof(movement_type) FROM watches_catalog LIMIT 1;
    -- expect: movement_type_enum
  SELECT pg_typeof(era) FROM watches_catalog LIMIT 1;
    -- expect: watch_era

  -- Cycle trigger smoke test (intentional failure):
  -- Setup: catalog A, B, C with edges A->B, B->C (both 'successor')
  -- Attempt: INSERT C->A 'successor' — must RAISE EXCEPTION
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Lineage browse UI / `/family/{id}` / catalog walk affordance** — DEFERRED to Phase 39 by Phase 33b Q2 verdict. Phase 35 ships the schema; Phase 39 wires the UI.
- **`/brand/{id}` browse page** — Phase 39 / v5.x per Phase 33b Q2 verdict (and Phase 34 deferred).
- **Comprehensive family seed data (~30+ families)** — Phase 35 ships ~10 anchors. User extends by editing JSON post-deploy.
- **Comprehensive lineage edge seed (multiple chains across brands)** — Phase 35 ships ONE 3-node Submariner chain. User extends post-deploy as curation interest grows.
- **Admin UI for family / lineage curation** — locked out by ROADMAP for v5.0; SEED-001 sketches the curation discipline argument. JSON-file editing is the curation surface for the foreseeable future.
- **`era_signal` deprecation in favor of `era`** — explicitly NOT scheduled. They serve different surfaces (era = factual filter; era_signal = LLM taste signal). Coexist indefinitely.
- **`watches` table parity for `era` / `case_material` / `bracelet_config`** — out of Phase 35 scope. The Watch domain type doesn't carry these (only catalog rows do). If a future phase wants per-instance era override (e.g., user owns a vintage Submariner with replacement bracelet — different bracelet_config than catalog default), that's a separate phase.
- **Variant-level material/bracelet/dial-color variation** — Phase 36 `watch_variants` concern. Catalog row holds canonical/primary values; variants override per row.
- **NOT NULL flip on `family_id` / `brand_id` / `movement_type` / `era` / etc.** — formally deferred per Phase 34 D-05 three-step discipline. Conditional on full coverage AND growth-path discipline. No current target phase.
- **Reciprocal-pair lineage edges (auto-insert inverse)** — explicitly REJECTED per D-05. If a future phase wants single-direction-query convenience, the right answer is a SQL VIEW that UNIONs both directions, not a write-side trigger.
- **GIN trigram indexes on `case_material` / `bracelet_config` for fuzzy match** — not scheduled. If a future search facet needs fuzzy material matching, add `extensions.gin_trgm_ops` index then; remember the schema-qualified opclass rule (memory rule 3).
- **JSONB schema validation on `watch_lineage_edges.metadata`** — column ships as `jsonb DEFAULT '{}'` with no schema constraint. If future use needs structured metadata (e.g., `{ "year_replaced": 1989, "reason": "quartz crisis pivot" }`), add a CHECK constraint then.
- **LLM auto-inference of lineage edges** — REQUIREMENTS line 27 explicitly forbids. Manual curation only, indefinitely.
- **Movement caliber enum / lookup table** — `movement_caliber` ships as free text. Most calibers are alphanumeric strings (Rolex 3235, ETA 2824, Sellita SW200, Seiko 9SA5) — too open-ended for an enum. Future v6.x might add a `calibers` lookup table if movement-caliber discovery becomes a feature; not in v5.0 scope.

</deferred>

---

*Phase: 35-Layer B — Lineage Edges + Structured Movement + Era/Material*
*Context gathered: 2026-05-09*

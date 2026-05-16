# Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the third catalog hierarchy layer — `watch_variants` — and lock down the user-watch ↔ catalog relationship by flipping `watches.catalog_id` to `NOT NULL`. Phase 36 is **schema-only** (no UI, no admin tooling) and **lighter than the original ROADMAP scope** because Phase 35 D-02 already executed the underlying TRUNCATE wipe. Phase 36 ships:

1. New `watch_variants` table with `(id, catalog_id FK NOT NULL, name, slug, dial_color, bezel, bracelet_variant, image_url, timestamps)`. UNIQUE on `(catalog_id, slug)`. ON DELETE RESTRICT on `catalog_id`. Public-read RLS for anon/authenticated; INSERT/UPDATE/DELETE service-role only. Co-located in same Supabase migration as the table DDL (Phase 17 / 34 / 35 pattern).
2. New nullable `watches.variant_id` FK column with `ON DELETE SET NULL` (Phase 17 D-04 precedent for `watches.catalog_id`).
3. CAT-14 NOT NULL flip on `watches.catalog_id` — same migration file. First statement is a `DO $$ BEGIN ... END $$` pre-flight assertion: `IF EXISTS (SELECT 1 FROM watches WHERE catalog_id IS NULL) THEN RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows have NULL catalog_id', orphan_count; END IF;`. The exception aborts the transaction before `ALTER COLUMN SET NOT NULL` executes.
4. Shrunken deploy runbook in `docs/deploy-db-setup.md` covering: (d) idempotent safety re-run of `npm run db:backfill-catalog` BEFORE the migration push, (e) `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` verification (must return 0), (f) `supabase db push --linked` runs the migration (variant table + variant_id FK + NOT NULL flip in one transaction), smoke-test SELECTs after.
5. `pg_depend` pre-flight check documented in the runbook BEFORE the migration is written (memory rule 4) — surfaces any unexpected dependents on `watches.catalog_id` before the NOT NULL flip touches it.

**In scope:** `watch_variants` table DDL + RLS + UNIQUE + FK constraints; `watches.variant_id` ADD COLUMN; `watches.catalog_id` NOT NULL flip with DO $$ pre-flight; Drizzle definitions for both new columns/table; shrunken deploy runbook section; manual-recovery flow documentation; `pg_depend` pre-check on `watches.catalog_id`.

**Not in scope:** Variant population / seed data / backfill script (DEFERRED to Phase 39 per D-06 + Phase 33b Q2 verdict); variant browse UI / `/watch/{ref}/{variant}` route (Phase 39 / v5.x); admin UI for variant CRUD (locked out by ROADMAP for v5.0); reading variant data in `analyzeSimilarity()` (Phase 38, CAT-13); auto-decomposing fragmented catalog rows into Reference + Variant (moot per D-01 — Phase 35 D-02 already wiped); `watches.dial_color` derivation from variant (out of scope — `watches.dialColor` remains an independent per-instance attribute); steps (a) (b) (c) of original ROADMAP success #2 6-step runbook (export-to-CSV / DELETE catalog rows / re-seed canonical refs — all absorbed by Phase 35 D-02).

**ROADMAP success criteria coverage (verbatim from `.planning/ROADMAP.md` §Phase 36 lines 251–261):**
1. `watch_variants` table exists with `(catalog_id FK, dial_color, bezel, bracelet_variant)` columns; `watches.variant_id` optional FK added — covered by D-02 + D-03 + D-04 + D-05.
2. 6-step clean-slate runbook executed and verified — covered by D-01 (steps a-c inherited from Phase 35 D-02; steps d-f executed in Phase 36).
3. CAT-14 migration begins with `DO $$` pre-flight asserting zero NULLs as FIRST statement — covered by D-07.
4. `watches.catalog_id` is NOT NULL in production schema after this phase — covered by D-07 (CAT-14).
5. All existing collection-browsing/profile/verdict flows return correct watch data post-migration — covered by Phase 35 D-02 precedent (no DAL shape changes; `variant_id` is nullable additive; NOT NULL flip is a constraint-only change).

**Why this phase matters (user-facing value):**
- Owner-count rollups (`watchesCatalog.owners_count`) stop fragmenting across visually-distinct Variants of the same Reference. Once Variant population lands in Phase 39, "how many people own a 16610 Submariner?" returns one unified count instead of one count per dial/bezel combination.
- Lineage browser (Phase 39) can render "this Reference has N known variants" — variants become first-class children of References, not sibling References.
- Similarity engine (Phase 38) can score "you both own a Submariner" without docking the score because each collector's specific variant differs.
- After CAT-14, every watch in the user's collection is provably anchored to a canonical Reference. No more orphans. The recommender (SEED-002, future) and the taste-aware engine (Phase 38) both depend on this guarantee.

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 36 uses the `D-NN` prefix.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 17 D-04 — `watches.catalog_id` ON DELETE semantics:** `ON DELETE SET NULL`. Phase 36 keeps this (it does NOT change to RESTRICT or CASCADE during the NOT NULL flip — the migration changes only the nullability, not the cascade behavior).
- **Phase 17 D-04 / D-06 — RLS pattern:** Public-read SELECT for `anon` and `authenticated`; INSERT/UPDATE/DELETE restricted to `service_role` only. Co-located in the same Supabase migration file as `CREATE TABLE watch_variants`. Applies to `watch_variants` verbatim.
- **Phase 17 D-02 / D-03 — GENERATED normalization columns:** Phase 36 doesn't add new normalized columns. `watch_variants.slug` is set explicitly by the seed/curation path (Phase 39), NOT generated — slug is URL-public and must be stable across name edits. Mirrors Phase 34 D-01b.
- **Phase 19.1 / Phase 17 — drizzle vs supabase migration split:** Drizzle is the type source of truth; the Supabase migration is authoritative for DDL (RLS, GENERATED, FK clauses, the DO $$ pre-flight block). Phase 36 emits both files; the Supabase migration carries RLS + the DO $$ block + GRANT statements; the Drizzle migration mirrors structural shape only.
- **Phase 34 D-02 — `ON DELETE RESTRICT` for entity FKs:** `watch_variants.catalog_id` uses `ON DELETE RESTRICT` (mirrors `brands.id` ← `watches_catalog.brand_id`, `watch_families.id` ← `watches_catalog.family_id`, `watches_catalog.id` ← `watch_lineage_edges.predecessor/successor`). Service-role-only writes mean no app-flow risk; orphan-detection at delete time is the value.
- **Phase 34 D-03 / D-05 — "ship table empty, seed in later phase":** Phase 34 shipped `watch_families` empty (seeding deferred to Phase 35). Phase 36 ships `watch_variants` empty (seeding deferred to Phase 39). Mirrors the established discipline: ship the schema, defer the curation work to the phase that actually consumes the data (Phase 39 lineage browse UI per Phase 33b Q2 verdict).
- **Phase 33b Q2 verdict (DEFERRED) — lineage/variant browse UI:** Phase 36 ships SCHEMA-ONLY. Variant browse UI / `/watch/{ref}/{variant}` route / catalog walk-affordance for variants are deferred to Phase 39 or v5.x per `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §Decision Q2. Phase 36 ships ZERO user-facing UI affordances.
- **Phase 35 D-02 — TRUNCATE already executed:** Phase 35 ran `TRUNCATE watches CASCADE; TRUNCATE watches_catalog CASCADE;` as the first statements of its migration. Phase 36 inherits the post-wipe state and does NOT re-execute the wipe. Steps (a) (b) (c) of original ROADMAP success #2 6-step runbook are documented as inherited.
- **Memory `project_drizzle_supabase_db_mismatch.md` — all 4 prod-push gotchas live this phase:** (1) 14-digit timestamp filename; (2) no insertion between adjacent integers; (3) `extensions.gin_trgm_ops` schema-qualified opclass — N/A unless GIN indexes are added (Phase 36 plans none); (4) `pg_depend` query BEFORE the NOT NULL flip touches `watches.catalog_id` to surface any dependents (indexes, views, functions). MANDATORY pre-migration step in the Phase 36 runbook.
- **Memory `project_db_wipeable_2026_05_09.md`:** Production DB was wipeable in Phase 35 (sole-user state). Phase 36 does NOT re-wipe — but the memory rule "re-check before assuming for any FUTURE phase" still applies if a future scope shift wants additional wipes. Currently single-user (twwaneka@gmail.com).
- **REQUIREMENTS CAT-17 line 29 — "User's collection survives the wipe":** Phase 35 D-02 was the wipe; user's collection survived (was empty at the time per single-user state). Phase 36 does NOT re-execute the wipe; the requirement's "survives the wipe" clause is honored by inheritance.

### Wipe-runbook scope after Phase 35 (Area 1)

- **D-01:** Shrink the ROADMAP-specified 6-step runbook. Drop steps (a) export-to-CSV, (b) DELETE fragmented rows, (c) re-seed canonical Reference rows — all absorbed by Phase 35 D-02. Keep:
  - **(d) idempotent re-link safety re-run** — `npm run db:backfill-catalog` runs immediately BEFORE the migration push. The script is idempotent (`WHERE catalog_id IS NULL` shrink-to-empty filter from Phase 17), so re-runs against a fully-linked collection are no-ops. This is the safety net for any watch added since 2026-05-10 that may have ended up with NULL catalog_id.
  - **(e) zero-NULL verification** — `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` must return 0 BEFORE the migration push. If non-zero, the deploy runbook documents the manual recovery flow (see D-07).
  - **(f) CAT-14 NOT NULL flip** — executed as part of the same Phase 36 migration transaction (see D-07).
  CONTEXT.md and SUMMARY.md will explicitly state that steps (a)(b)(c) are "inherited from Phase 35 D-02 — runbook trimmed". This preserves the audit trail without bloating the deploy docs with no-op steps.

### `watch_variants` table shape (Area 2 — D-02 through D-05)

- **D-02 — Column shape (ROADMAP-3 + name/slug + image_url):**
  ```sql
  CREATE TABLE watch_variants (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id        uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
    name              text NOT NULL,           -- 'Kermit', 'Hulk', 'Pepsi'
    slug              text NOT NULL,           -- URL-stable: 'kermit', 'hulk', 'pepsi'
    dial_color        text,                    -- nullable, no CHECK (mirrors Phase 35 D-10)
    bezel             text,                    -- nullable, no CHECK
    bracelet_variant  text,                    -- nullable, no CHECK (distinct from catalog.bracelet_config — see Phase 35 D-11)
    image_url         text,                    -- per-variant image; nullable
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (catalog_id, slug)
  );
  ```
  - `name` and `slug` are NOT in the ROADMAP-specified column set but are required because variants need human-readable identity. The Kermit isn't "green bezel" — it's "Kermit". The URL-stable `slug` enables the future Phase 39 `/watch/{ref}/{slug}` route.
  - `slug` is NOT a GENERATED column — set explicitly by curation/seeding (mirrors Phase 34 D-01b rationale: URL stability across name edits).
  - `dial_color`, `bezel`, `bracelet_variant` are FREE TEXT with NO CHECK constraints. Matches Phase 35 D-10 (`case_material`) and D-11 (`bracelet_config`) — specialty values (e.g., "meteor", "lapis dial", "diamond bezel") flow through cleanly.
  - Phase 19.1 LLM enrichment columns (`formality`, `sportiness`, `heritage_score`, `primary_archetype`, `era_signal`, `design_motifs`, `confidence`) stay on `watches_catalog` only — per-Reference taste, not per-Variant taste. Phase 38 CAT-13 reads these from the catalog row, not the variant row.

- **D-03 — `watch_variants.catalog_id` `ON DELETE RESTRICT`:** Mirrors Phase 34 D-02 (entity FK pattern), Phase 35 D-04 (lineage edges). If a catalog row has variants, Postgres blocks the DELETE until variants are cleared. Service-role-only writes mean no app-flow risk; orphan-detection at delete time is the value.

- **D-04 — `watches.variant_id` `ON DELETE SET NULL`, nullable, no NOT NULL flip planned:**
  ```sql
  ALTER TABLE watches
    ADD COLUMN variant_id uuid NULL
      REFERENCES watch_variants(id) ON DELETE SET NULL;
  ```
  Mirrors `watches.catalog_id` precedent (Phase 17 D-04). User never loses their watch due to admin curation. Variant_id stays nullable indefinitely — variants will likely never hit 100% coverage (many References have only one canonical Variant, or none at all), so a future NOT NULL flip is NOT scheduled.

- **D-05 — RLS pattern same as Phase 34/35:** Public-read SELECT for `anon` and `authenticated`; INSERT/UPDATE/DELETE restricted to `service_role` only. Co-located in the same Supabase migration file as the `CREATE TABLE watch_variants`. Verbatim mirror of `brands` and `watch_families` policies.

### Variant population strategy (Area 3)

- **D-06 — Ship `watch_variants` empty; defer all population to Phase 39:**
  No `scripts/seed-data/variants.json` shipped. No `scripts/backfill-catalog-variants.ts` shipped. No anchor variant rows inserted. Phase 36 SUMMARY.md will note that the post-deploy state has `SELECT COUNT(*) FROM watch_variants` returning 0.
  Rationale:
  1. Phase 36 has no ROADMAP success criterion requiring variant data — variants are schema-only here.
  2. Phase 39 will need variant data to make the lineage browse UI useful — folding seeding into Phase 39 keeps the curation work close to its consumer.
  3. Phase 35 demonstrated that anchor-seeding runs vacuously against an empty catalog (per `35-HUMAN-UAT.md` deferred status). Variant anchor seeding would face the same problem until the catalog grows beyond a handful of rows.
  4. Mirrors Phase 34 D-03 precedent (ship `watch_families` empty, seed in next phase).
  Phase 39 will own:
  - `scripts/seed-data/variants.json` curation file
  - `scripts/backfill-catalog-variants.ts` (skip-on-missing-ref with warning logs, same pattern as Phase 35 lineage seeding D-12)
  - `package.json db:backfill-catalog-variants` script entry
  - Anchor seed (e.g., Submariner 16610LV "Kermit", 116610LV "Hulk", 126610LV "Cermit", GMT-Master II "Pepsi", "Batman")

### CAT-14 NOT NULL flip safety net (Area 4)

- **D-07 — Hard-fail pre-flight + manual recovery via runbook:**
  The Phase 36 migration's FIRST statement is:
  ```sql
  DO $$
  DECLARE
    orphan_count int;
  BEGIN
    SELECT COUNT(*) INTO orphan_count FROM watches WHERE catalog_id IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows have NULL catalog_id. Run db:backfill-catalog or inspect manually before retry.', orphan_count;
    END IF;
  END $$;
  ```
  If the assertion fires, the transaction aborts before `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` executes. Recovery flow (documented in `docs/deploy-db-setup.md` Phase 36 section):
  1. `SELECT id, user_id, brand, model, reference FROM watches WHERE catalog_id IS NULL;` — inspect each orphan.
  2. For each orphan: either (a) re-run `npm run db:backfill-catalog` if the orphan matches an existing canonical Reference (the script's `WHERE catalog_id IS NULL` idempotent filter will pick it up), or (b) manually upsert via `catalogDAL.upsertCatalogFromUserInput()` if the orphan is genuinely user-promoted with no canonical match.
  3. Re-verify `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` returns 0.
  4. Retry the migration push.
  Rationale: preserves Phase 17 + Phase 35's "every catalog row was deliberately canonical" invariant. Auto-creating user_promoted rows inside the migration transaction (the alternative we discussed) would silently create low-quality catalog rows the user never reviewed — loses curation discipline.

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion. D-01 through D-07 are all user-confirmed.

The framing/value explainer in `<domain>` was added at user request before option discussion began — context only, not a decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL" lines 251–261 — phase goal + 5 success criteria. Source of all "MUST" wording. Note: success #2 is reinterpreted by D-01 (steps a-c inherited from Phase 35).
- `.planning/REQUIREMENTS.md` §CAT-17 (line 29) — full requirement text (watch_variants table, fragmented-row consolidation, 6-step runbook). Reinterpreted by D-01 + D-06.
- `.planning/REQUIREMENTS.md` §CAT-14 (line 37) — full requirement text (SET NOT NULL on watches.catalog_id, DO $$ pre-flight). Honored verbatim by D-07.
- `.planning/STATE.md` §"Current Position" — Phase 36 next-up after Phase 35 close (2026-05-10).
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — original catalog hierarchy proposal; Variants are Layer 3 (Brand → Family → Reference → Variant) of the 5-level hierarchy. Lines 36–38 cite the user-preferred incremental path.

### Phase 33b inheritance (locked verdict)
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §"Decision Q2: Lineage browse priority" — DEFERRED verdict; Phase 36 ships schema-only; lineage/variant browse UI moves to Phase 39 (preferred) or v5.x. Phase 36 ships ZERO UI surface.
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §NSV-02, NSV-09, NSV-16 — same-family/lineage/variant missing-vector rows that Phase 36 schema unblocks but does NOT close (UI close is Phase 39).

### Phase 35 inheritance (load-bearing precedents)
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-CONTEXT.md` — D-02 TRUNCATE precedent (Phase 36 inherits post-wipe state, does NOT re-execute); D-04 lineage_edges ON DELETE RESTRICT (Phase 36 mirrors for watch_variants.catalog_id); D-10 case_material text + no-CHECK pattern (Phase 36 mirrors for dial_color/bezel/bracelet_variant); D-11 bracelet_config vs Phase 36 bracelet_variant naming distinction (catalog = canonical, variant = override).
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-HUMAN-UAT.md` — vacuous-backfill pattern that informed D-06 (defer variant seeding).
- `supabase/migrations/<14-digit-phase-35>_phase35_layer_b.sql` — RLS policy shape for `watch_lineage_edges`; Phase 36 mirrors verbatim for `watch_variants`.

### Phase 34 inheritance (load-bearing precedents)
- `.planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` — D-01 entity-table shape (PK + name + slug + timestamps + UNIQUE); D-01b slug-is-NOT-generated rationale (URL stability); D-02 ON DELETE RESTRICT for entity FKs; D-03 "ship empty, seed in next phase" pattern (Phase 36 D-06 mirrors).
- `supabase/migrations/<14-digit-phase-34>_phase34_brands_families.sql` — RLS policy shape; CREATE TABLE pattern; GRANT statements.

### Phase 17 patterns (load-bearing precedents)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — D-04 watches.catalog_id ON DELETE SET NULL (Phase 36 preserves); D-04 / D-06 RLS pattern (Phase 36 mirrors).
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` — RLS policy shape; pgEnum precedent (none added in Phase 36); GRANT SELECT shape.
- `src/db/schema.ts` lines 65–134 — `watches` definition; Phase 36 ADDs `variantId` column. Lines 298–369 — `watchesCatalog` definition; no changes in Phase 36. Lines 377+ — `brands` and `watchFamilies` precedent for `watch_variants`.

### Existing DAL surface (parity gate, ROADMAP success #5)
- `src/data/watches.ts` — `getWatchesByUser` and friends. After Phase 36, queries that SELECT * from watches pick up the new `variant_id` column (nullable additive — no breakage). Queries that JOIN to catalog continue working because `catalog_id` becomes NOT NULL (constraint-only change, not a shape change).
- `src/data/catalog.ts` — 31 `watchesCatalog` references. No changes; `watches_catalog` schema is unchanged by Phase 36.
- `src/data/discovery.ts`, `src/data/search.ts`, `src/data/recommendations.ts`, `src/data/suggestions.ts` — auxiliary DAL paths; verify with grep that none reference `variant_id` (none should — variants are not consumed in Phase 36).
- `src/app/actions/watches.ts` line 119+ — `addWatch` flow uses `catalogDAL.upsertCatalogFromUserInput()` which always populates catalog_id. This is the SAFETY GUARANTEE behind D-07 (hard-fail pre-flight): orphans should be impossible in normal app flow.

### NEW Phase 36 files
- `src/db/schema.ts` — ADD `watchVariants` Drizzle definition; ADD `variantId` column to `watches`. No `watches_catalog` changes.
- `supabase/migrations/<14-digit-greater-than-Phase-35>_phase36_layer_c_variants.sql` — single migration file containing: DO $$ pre-flight assertion (D-07), CREATE TABLE watch_variants + RLS + GRANTs (D-02 + D-05), ALTER TABLE watches ADD COLUMN variant_id (D-04), ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL (CAT-14).
- `drizzle/<NNNN>_phase36_layer_c_variants.sql` — Drizzle migration; structural twin (no RLS, no DO $$, no GRANT). Drizzle definitions for `variantId` on watches + `watchVariants` table emit a deterministic shape.
- `docs/deploy-db-setup.md` — append Phase 36 section: pg_depend pre-check on `watches.catalog_id`, shrunken runbook (d/e/f), CAT-14 hard-fail recovery flow (D-07 step-by-step), smoke-test SELECTs.

### Deploy runbook
- `docs/deploy-db-setup.md` — existing deploy runbook with Phase 17/34/35 sections. Phase 36 appends a new section per D-01 + D-07.

### DB migration discipline (memory anchors)
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — Rules 1 (14-digit filename), 2 (no insertion between adjacent integers), 4 (pg_depend check BEFORE writing the migration — surfaces dependents on `watches.catalog_id` like the existing `watches_catalog_id_idx`). Rule 3 not applicable (no GIN indexes added).
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_db_wipeable_2026_05_09.md` — Phase 36 does NOT wipe; the wipe decision was Phase 35's. Future phases must re-check `SELECT COUNT(*) FROM auth.users` before assuming wipeability.
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_local_db_reset.md` — Local dev re-sync after Phase 36: `supabase db reset` + drizzle push + selective supabase migrations via docker exec psql.
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` does not block anon; explicit `GRANT SELECT` to anon/authenticated still required for `watch_variants`.

### Future-phase consumers of Phase 36's schema
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" — does NOT read `watch_variants` directly (taste is per-Reference, not per-Variant). After CAT-14, `analyzeSimilarity()` can rely on `watches.catalog_id` being NOT NULL — no defensive null-check needed in the JOIN.
- `.planning/ROADMAP.md` §"Phase 39: Audit-Driven Discovery Polish" — owns the variant population work D-06 deferred. Ships `scripts/seed-data/variants.json` + `scripts/backfill-catalog-variants.ts` + anchor seed (Submariner Kermit/Hulk/Cermit, GMT Pepsi/Batman). Lineage browse UI reads `watch_variants` to render "this Reference has N known variants".
- `.planning/ROADMAP.md` §"Phase 40: SRCH-16 Search Facets" — does NOT need variants in v5.0; faceted search remains at the Reference level.
- Future v5.x / v6 recommender (SEED-002) — assumes `watches.catalog_id` NOT NULL. CAT-14 unblocks the recommender's "every owned watch is a vector with a canonical Reference embedding" assumption.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`watches_catalog` Drizzle definition (`src/db/schema.ts` lines 298–369)** — direct read target; no edits. Phase 36 references it only via FK.
- **`brands` and `watchFamilies` Drizzle definitions (`src/db/schema.ts` lines 377–414)** — direct template for `watch_variants`. Same shape: PK + name + slug + timestamps + UNIQUE on natural key. Same RLS pattern. Same `ON DELETE RESTRICT` FK semantics.
- **`watch_lineage_edges` Drizzle definition (`src/db/schema.ts` lines 420–444)** — direct template for `watch_variants` FK semantics + UNIQUE constraint shape. `lineage_edges_unique_triple` UNIQUE on `(predecessor, successor, relationship_type)` mirrors the `(catalog_id, slug)` UNIQUE on `watch_variants`.
- **`watches` Drizzle definition (`src/db/schema.ts` lines 65–134)** — direct edit target. ADD `variantId` column with `references(() => watchVariants.id, { onDelete: 'set null' })`. CAT-14 NOT NULL flip applies to `catalogId` only; no other column changes.
- **Phase 35 migration `supabase/migrations/<phase-35>_phase35_layer_b.sql`** — template for the DO $$ block pattern (Phase 35 didn't ship a pre-flight DO $$ but the syntactic precedent for `CREATE OR REPLACE FUNCTION ... LANGUAGE plpgsql` is there). Phase 36 also reads the GRANT SELECT + RLS POLICY shape.
- **`scripts/backfill-catalog.ts` (Phase 17)** — referenced in the deploy runbook (step d), not modified. Idempotent `WHERE catalog_id IS NULL` filter is the safety net.

### Established Patterns

- **Drizzle definition vs Supabase migration split** — Drizzle = TS source of truth; Supabase migration = authoritative DDL (RLS, CHECK, GENERATED, FK clauses, DO $$ blocks, GRANT statements). Phase 36 maintains this split.
- **Migration filename convention** — exactly 14 digits + `_phase36_layer_c_variants.sql`. Per memory rule 1. Per memory rule 2, timestamp must be strictly greater than the highest existing migration filename (currently the Phase 35 file).
- **Service-role-only writes via RLS** — applies to `watch_variants`. Mirrors `brands`, `watch_families`, `watch_lineage_edges`, `watches_catalog`.
- **Idempotent backfill via `WHERE x IS NULL`** — Phase 36 does NOT ship a new backfill script. The existing `npm run db:backfill-catalog` (Phase 17) is the safety re-run before the migration push (D-01 step d).
- **NULL pre-flight via DO $$** — first appearance of this pattern in the project. The cycle-check trigger function from Phase 35 (`check_lineage_cycle()`) used `RAISE EXCEPTION` with formatted arguments; Phase 36 uses the same syntax inside a one-shot DO $$ block.

### Integration Points

- **No DAL changes in Phase 36** — every existing `watches` and `watchesCatalog` query path must return identical results. The new `watches.variant_id` column is nullable additive; SELECT-* queries pick it up without breaking. The NOT NULL constraint on `watches.catalog_id` is a metadata-only change — query plans don't change.
- **New Drizzle exports** — `watchVariants` table added to `src/db/schema.ts`. Type inference (`InferSelectModel<typeof watchVariants>`) ships in Phase 36 but no consumer reads it yet (Phase 39 will).
- **No package.json script entries** — Phase 36 does NOT add `db:backfill-catalog-variants` (deferred to Phase 39 per D-06).
- **No app/UI integration** — zero changes to `src/app/`, `src/components/`, `src/lib/`. Phase 36 is purely DB schema + migration + runbook.
- **`pg_depend` query before NOT NULL flip** — surface any unexpected dependents on `watches.catalog_id`. Current known dependents (from grep): `watches_catalog_id_idx` index on `(catalog_id)`. The index is unaffected by a nullability change. The pg_depend query should confirm no other surprises (e.g., a stale materialized view referencing the column).
- **No tests required by ROADMAP** — the schema-only nature means no business-logic test surface. A static smoke test asserting `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` returns 0 post-migration is the de-facto verification; the migration itself contains the assertion (D-07).

</code_context>

<specifics>
## Specific Ideas

- **Migration filename:** `supabase/migrations/<14-digit-greater-than-Phase-35>_phase36_layer_c_variants.sql`. Single migration file containing: DO $$ pre-flight (D-07), `CREATE TABLE watch_variants` with FK + UNIQUE constraints, RLS policies, `GRANT SELECT` to anon/authenticated, `ALTER TABLE watches ADD COLUMN variant_id`, `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL`, all in one transaction. The DO $$ pre-flight MUST be the FIRST statement (per CAT-14 ROADMAP success #3).
- **Drizzle migration:** `drizzle/<next-sequential>_phase36_layer_c_variants.sql`. Structural twin (CREATE TABLE + columns + FK + UNIQUE), without RLS / DO $$ / GRANT clauses.
- **`watch_variants` table shape:**
  ```sql
  CREATE TABLE watch_variants (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id        uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
    name              text NOT NULL,
    slug              text NOT NULL,
    dial_color        text,
    bezel             text,
    bracelet_variant  text,
    image_url         text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT watch_variants_catalog_slug_unique UNIQUE (catalog_id, slug)
  );

  CREATE INDEX watch_variants_catalog_id_idx ON watch_variants(catalog_id);

  ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "watch_variants public read"
    ON watch_variants FOR SELECT
    TO anon, authenticated USING (true);
  CREATE POLICY "watch_variants service write"
    ON watch_variants FOR ALL
    TO service_role USING (true) WITH CHECK (true);

  GRANT SELECT ON watch_variants TO anon, authenticated;
  GRANT ALL    ON watch_variants TO service_role;
  ```
- **`watches.variant_id` column add:**
  ```sql
  ALTER TABLE watches
    ADD COLUMN variant_id uuid NULL
      REFERENCES watch_variants(id) ON DELETE SET NULL;
  -- Optional: index if Phase 39 query patterns need it
  -- CREATE INDEX watches_variant_id_idx ON watches(variant_id);
  ```
- **CAT-14 DO $$ pre-flight (FIRST statement of the migration):**
  ```sql
  DO $$
  DECLARE
    orphan_count int;
  BEGIN
    SELECT COUNT(*) INTO orphan_count FROM watches WHERE catalog_id IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows in watches have NULL catalog_id. Run npm run db:backfill-catalog or inspect manually (see docs/deploy-db-setup.md Phase 36 recovery flow), then retry the migration.', orphan_count;
    END IF;
  END $$;

  -- ... rest of migration ...

  ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;
  ```
- **pg_depend pre-check query (runbook step, BEFORE writing the migration):**
  ```sql
  SELECT classid::regclass, objid::regclass, refobjid::regclass, refobjsubid, deptype
    FROM pg_depend
   WHERE refobjid = 'watches'::regclass
     AND refobjsubid = (
       SELECT attnum FROM pg_attribute
        WHERE attrelid = 'watches'::regclass AND attname = 'catalog_id'
     );
  -- Expected result: `watches_catalog_id_idx` only.
  -- Any surprise dependents (views, materialized views, functions) must be
  -- inspected before the NOT NULL flip ships.
  ```
- **Smoke-test runbook entries (post-deploy):**
  ```sql
  -- After supabase db push --linked:
  SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT');  -- expect: t

  -- After CAT-14 flip:
  SELECT is_nullable FROM information_schema.columns
   WHERE table_name = 'watches' AND column_name = 'catalog_id';            -- expect: 'NO'

  -- Parity check (should match pre-migration counts):
  SELECT COUNT(*) FROM watches;                                            -- expect: same as pre-migration
  SELECT COUNT(*) FROM watches_catalog;                                    -- expect: same as pre-migration
  SELECT COUNT(*) FROM watch_variants;                                     -- expect: 0 (deferred to Phase 39)
  SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL;               -- expect: 0
  ```
- **CAT-14 hard-fail recovery flow (runbook entry, for if D-07 fires):**
  ```
  If `supabase db push --linked` fails with:
    "CAT-14 pre-flight failed: N rows in watches have NULL catalog_id"

  1. Inspect orphans:
     SELECT id, user_id, brand, model, reference, created_at
       FROM watches WHERE catalog_id IS NULL ORDER BY created_at;

  2. For each orphan, either:
     (a) Re-run safety re-link:
         npm run db:backfill-catalog
         # Idempotent. Picks up any orphan whose (brand, model, reference)
         # matches an existing canonical Reference.
     (b) Manual upsert via DAL helper (if no canonical match exists):
         # In a tsx repl or one-shot script:
         await catalogDAL.upsertCatalogFromUserInput({
           userId: '<orphan user_id>',
           brand: '<orphan brand>', model: '<orphan model>',
           reference: '<orphan reference>',
         })
         # Then re-run db:backfill-catalog to link.

  3. Re-verify zero NULLs:
     SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL;  -- expect: 0

  4. Retry: supabase db push --linked
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Variant population (seed file + backfill script + anchor data)** — DEFERRED to Phase 39 per D-06. Phase 39 ships `scripts/seed-data/variants.json` + `scripts/backfill-catalog-variants.ts` + anchor variants (Submariner Kermit/Hulk/Cermit, GMT Pepsi/Batman, Speedmaster reduced/non-reduced, etc.) alongside the lineage/variant browse UI.
- **Variant browse UI / `/watch/{ref}/{slug}` route** — DEFERRED to Phase 39 by Phase 33b Q2 verdict. Phase 36 ships the schema; Phase 39 wires the UI.
- **Admin UI for variant CRUD** — locked out by ROADMAP for v5.0. JSON-file curation is the surface for the foreseeable future (mirrors family + lineage curation discipline).
- **`watches.variant_id` NOT NULL flip** — explicitly NOT scheduled. Variants will likely never hit 100% coverage (many References have one canonical Variant or none). If a future phase wants the constraint, it'd need a "default variant" concept first.
- **Auto-decompose fragmented catalog rows into Reference + Variants** — moot per D-01 (Phase 35 D-02 already wiped; current catalog is canonical). If a future phase finds drift (e.g., URL-extract creates fragmented rows again), revisit then.
- **Per-variant LLM taste enrichment** — `formality`, `sportiness`, etc. stay on `watches_catalog` only. Variants inherit taste from their parent Reference. If a future phase wants per-variant taste signals (e.g., "Kermit reads sportier than the black-dial Sub"), that's a separate enrichment phase.
- **`watch_variants.production_year_start` / `production_year_end`** — discussed and rejected in D-02 (kept ROADMAP-3 + name/slug). The "Kermit was 2003–2010" temporal data lives in curator notes or future v5.x columns, not Phase 36.
- **GIN trigram indexes on variant names** — not in Phase 36. If variant-search becomes a feature (search facet expansion), add `extensions.gin_trgm_ops` index then; remember the schema-qualified opclass rule (memory rule 3).
- **CAT-14 NOT NULL flip on `watches.variant_id`** — explicitly NOT scheduled per D-04 rationale (variants will never hit 100% coverage).
- **Auto-backfill orphan watches inside the migration transaction** — discussed and rejected per D-07. Loses Phase 17/35 curation discipline. Hard-fail + manual recovery is the safer path.
- **`watches_catalog.is_canonical` boolean** — discussed indirectly via "fragmented Reference rows". Not needed because Phase 35 D-02 already wiped + re-seeded only canonical rows. If drift re-emerges, revisit.

</deferred>

---

*Phase: 36-Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL*
*Context gathered: 2026-05-11*

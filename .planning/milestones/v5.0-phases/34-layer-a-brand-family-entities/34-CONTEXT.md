# Phase 34: Layer A — Brand + Family Entities - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `brands` and `watch_families` as first-class catalog entities, and add nullable `brand_id` / `family_id` foreign-key columns on the existing `watches_catalog` table. Schema-only — no admin UI, no automated migration, no `NOT NULL` flip. Phase 34 ships:

1. New tables `brands` and `watch_families` with public-read RLS + service-role-write policies co-located in the migration file.
2. Nullable `watches_catalog.brand_id` and `watches_catalog.family_id` FK columns.
3. A service-role backfill script at `scripts/backfill-catalog-brands.ts` that auto-derives brands from existing `watches_catalog.brand_normalized` values, supports manual `country_of_origin` patching, and links `watches_catalog.brand_id` via `brand_normalized` match.
4. Phase 34 actually RUNS the brand backfill on production — `watches_catalog.brand_id` ends Phase 34 populated on most rows. `family_id` stays NULL on every row; `watch_families` table stays empty (family seeding belongs in Phase 35 alongside lineage edges).
5. CONTEXT.md documents the three-step migration discipline (nullable add → backfill → deferred NOT NULL flip) and explicitly defers the NOT NULL flip beyond Phase 34.

**In scope:** New `brands` + `watch_families` tables (minimal+ shape per D-01); FK columns on `watches_catalog` with `ON DELETE RESTRICT` (D-02); RLS policies (public-read, service-role-write) co-located in the same migration file; `scripts/backfill-catalog-brands.ts` script + production execution against the brand layer (D-03); deploy runbook update at `docs/deploy-db-setup.md`; verification that all existing DAL queries (31 `watchesCatalog` references) return identical results.

**Not in scope:** Family table population (deferred to Phase 35); `family_id` linking on `watches_catalog` (deferred to Phase 35); `NOT NULL` flip on `brand_id` / `family_id` (formally deferred — three-step discipline); admin UI for brand/family CRUD (locked out by ROADMAP success #4); browse UI on `/brand/{id}` or `/family/{id}` (deferred to Phase 39 / v5.x per Phase 33b Q2 verdict); dropping `watches_catalog.brand` text column (permanent denormalization per D-04); lineage edges (Phase 35); structured movement / era / material columns (Phase 35); variant split (Phase 36); CAT-13 engine rewire (Phase 38).

**ROADMAP success criteria fully covered (verbatim from `.planning/ROADMAP.md` §Phase 34 lines 171–181):**
1. `brands` and `watch_families` tables exist in production with public-read RLS and service-role-write policies co-located in the migration file
2. `watches_catalog.brand_id` (nullable FK) and `watches_catalog.family_id` (nullable FK) columns exist; all existing DAL queries return correct results without modification
3. `has_table_privilege('anon', 'public.brands', 'SELECT')` and `has_table_privilege('anon', 'public.watch_families', 'SELECT')` both return true in production — RLS verified in the deploy runbook
4. A service-role backfill script exists at `scripts/backfill-catalog-brands.ts` for manual brand/family assignment (no automated migration; no admin UI in this phase)
5. Three-step migration discipline (nullable column add → backfill → NOT NULL flip) is documented in phase CONTEXT.md; the NOT NULL flip is explicitly deferred

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 34 uses the `D-NN` prefix.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 17 D-02 / D-03 — GENERATED normalization columns:** `brands.name_normalized` and `watch_families.name_normalized` MUST be `GENERATED ALWAYS AS (lower(trim(name)))` (mirrors `watchesCatalog.brandNormalized` / `modelNormalized`). Do NOT compute normalization in app code; do NOT use a trigger.
- **Phase 17 D-04 / D-06 — RLS pattern:** Public-read SELECT for `anon` and `authenticated`; INSERT/UPDATE/DELETE restricted to `service_role` only. Co-located in the same Supabase migration file as the `CREATE TABLE` (Phase 17 §`20260427000000_phase17_catalog_schema.sql` precedent). Verified in `docs/deploy-db-setup.md`.
- **Phase 17 D-15 — denormalized counts:** No new denormalized counts on brands/families in Phase 34. (`watch_count`, `owners_count` rollups belong in a future phase if/when family/brand pages need them.)
- **Phase 19.1 (existing) — drizzle vs supabase migration split:** Drizzle definition is source of truth for column types and TypeScript inference; the Supabase migration file (`supabase/migrations/<14-digit-timestamp>_phase34_brands_families.sql`) carries authoritative DDL — RLS, CHECK constraints, GENERATED columns, FK clauses. Mirror Phase 17's split exactly.
- **Phase 33b Q2 verdict (DEFERRED) — lineage browse UI:** Phase 34 (and Phase 35) ship schema-only. Lineage browse UI / `/family/{id}` page deferred to Phase 39 or v5.x per `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §Decisions Q2. Phase 34 does NOT ship any user-facing affordance referencing brands or families.
- **Memory: project_drizzle_supabase_db_mismatch.md (Rules 1–4):** Migration filename MUST be exactly 14 digits + `_name.sql`; production push uses `supabase db push --linked` (NEVER `drizzle-kit push` for prod); query `pg_depend` BEFORE any structural change touching catalog (no enums in Phase 34, but the discipline applies if FK additions touch GENERATED column dependents); `WITH SCHEMA extensions` opclass references (e.g., `extensions.gin_trgm_ops`) only relevant if Phase 34 adds GIN indexes — currently no plan to.

### Table column shape (Area 1)

- **D-01:** Minimal+ table shape with `country_of_origin` on brands.
  ```
  brands
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
    name            text NOT NULL
    name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED
    slug            text UNIQUE NOT NULL
    country_of_origin text NULL
    created_at      timestamptz NOT NULL DEFAULT now()
    updated_at      timestamptz NOT NULL DEFAULT now()
    UNIQUE (name_normalized)

  watch_families
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
    brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT
    name            text NOT NULL
    name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED
    slug            text NULL
    created_at      timestamptz NOT NULL DEFAULT now()
    updated_at      timestamptz NOT NULL DEFAULT now()
    UNIQUE (brand_id, name_normalized)
  ```
  Rationale: every other "rich" column candidate (`founding_year`, `logo_url`, `parent_brand_id`, family `era_start`/`era_end`, `parent_family_id`) has zero v5.0 phase consumer. They are additive nullable columns later via `ALTER TABLE ADD COLUMN` — adding them now means committing to backfill curation work for data no phase reads. `country_of_origin` is the explicit user exception — locked in for v6.0 / future taste-signal use even though no current phase reads it.

- **D-01a (slug uniqueness):** `brands.slug` is `UNIQUE NOT NULL` (URL-stable identifier — `/brand/rolex` is part of the future routing surface). `watch_families.slug` is nullable for now (multiple brands can have a "Submariner" but only Rolex's exists today; the `(brand_id, name_normalized)` UNIQUE handles intra-brand uniqueness without forcing a global slug-uniqueness constraint).

- **D-01b (slug derivation):** Slug is NOT a GENERATED column — it's set explicitly by the backfill script (and any future admin tooling). Reason: slug is URL-public and must be stable across `name` edits; a GENERATED slug would mutate when someone fixes capitalization on `name`, breaking external links. The backfill script generates slugs as `lower(replace(trim(name), ' ', '-'))` with manual review.

### FK ON DELETE semantics (Area 2)

- **D-02:** `watches_catalog.brand_id` and `watches_catalog.family_id` both use `ON DELETE RESTRICT`.
  ```sql
  ALTER TABLE watches_catalog
    ADD COLUMN brand_id uuid NULL
      REFERENCES brands(id) ON DELETE RESTRICT,
    ADD COLUMN family_id uuid NULL
      REFERENCES watch_families(id) ON DELETE RESTRICT;
  ```
  Rationale: there is no app flow that deletes brands/families (no admin UI, locked by ROADMAP success #4). Deletes happen only via service-role tooling. `RESTRICT` surfaces orphan-detection signals at delete time — if a brand has 50 catalog rows pointing to it, Postgres raises rather than silently nulling 50 FKs. This is most valuable during the manual curation phase where backfill script invocations might mistakenly reference deleted brands. `SET NULL` (the `watches.catalog_id` pattern) is intentionally a different choice for that table because Phase 36 plans a clean-slate wipe of catalog rows; brands/families have no analogous wipe planned. `CASCADE` is unsafe and ruled out.

### Backfill source & seed strategy (Area 3)

- **D-03:** Hybrid brands populated + production-run; families empty in Phase 34.
  - **Brands derivation:** `scripts/backfill-catalog-brands.ts` runs `SELECT DISTINCT brand_normalized FROM watches_catalog WHERE brand_normalized IS NOT NULL` and inserts one `brands` row per distinct value with `name = original_brand_string` (de-duplicated by lowest-id catalog row's `brand` text), `slug = lower(replace(trim(name), ' ', '-'))`, `country_of_origin = NULL` initially.
  - **Manual `country_of_origin` patch:** After the auto-insert, the script supports a CLI flag (e.g., `--patch-country`) that interactively prompts for country per brand (or accepts a `country.json` map). The user runs this once; output is committed for repeatability.
  - **`watches_catalog.brand_id` linking:** Same script joins `watches_catalog.brand_normalized = brands.name_normalized` and updates `brand_id`. Idempotent on `WHERE brand_id IS NULL`.
  - **`watch_families` table stays empty.** No family auto-extraction in Phase 34. `watches_catalog.family_id` stays NULL on every row.
  - **Family seeding deferred to Phase 35** alongside lineage_edges work — Phase 35 will populate `watch_families` rows during the manual lineage-edge curation pass since families are needed to anchor lineage edges anyway.
  Rationale: brands have a clean existing source (`brand_normalized` distinct values; a small DB at single-user scale → ~10–30 brands max). Families have no existing source and require manual curation regardless of phase — folding family seeding into Phase 34 doubles the manual effort while delivering nothing Phase 34 actually needs. Running the backfill in Phase 34 (rather than just shipping the script) gives downstream phases (35, 38) real `brand_id` data to query against, validating the schema end-to-end before Phase 35 writes lineage code on top of it.

### `watches_catalog.brand` text retention (Area 4)

- **D-04:** Permanent denormalization. Both `watches_catalog.brand` (text NOT NULL) and `watches_catalog.brand_id` (FK nullable) coexist indefinitely.
  Rationale: `watches_catalog.brand_normalized` is `GENERATED ALWAYS AS (lower(trim(brand)))` and is the load-bearing column for the natural-key UNIQUE index that catalog upserts depend on (Phase 17 CAT-03). Dropping `brand` text would force re-deriving `brand_normalized` via JOIN to `brands.name`, rewriting the natural-key index, and rewriting all 31 DAL `watchesCatalog` references. The cost is high; the benefit (storage savings on a small DB) is negligible. Denormalization is also the safer pattern for fast read paths (trending queries already aggregate by `brand_normalized` without a JOIN). The drift risk (someone updates `brands.name` without re-syncing catalog rows) is mitigated by service-role-only writes on both tables. CONTEXT.md and phase SUMMARY explicitly state: no future drop scheduled.
  - **Implication for Phase 38 (CAT-13):** `analyzeSimilarity()` continues to read `brand` text directly; CAT-13 does not need to JOIN brands. `brand_id` is purely the relational link for joins/lineage/family entities (Phase 35+ work).

### Three-step migration discipline (covers ROADMAP success #5)

- **D-05:** Three-step migration discipline for `brand_id` / `family_id`:
  1. **Step 1 (Phase 34):** Add columns as `NULL` allowed; ship migration; populate `brand_id` via backfill (D-03). `family_id` stays all NULL.
  2. **Step 2 (Phase 35):** Populate `family_id` via second backfill pass during lineage-edges work; populate `watch_families` rows.
  3. **Step 3 (DEFERRED):** Flip `brand_id` and `family_id` to `NOT NULL`. Explicitly NOT scheduled. Conditional on (a) every `watches_catalog` row having both FKs populated AND (b) the catalog growth path (URL-extract / user-promoted creates) reliably setting `brand_id` / `family_id` on insert. The NOT NULL flip is a future v5.x or v6 concern; Phase 34 does NOT plan it. Pre-flight assertion would be a `DO $$ BEGIN IF EXISTS (SELECT 1 FROM watches_catalog WHERE brand_id IS NULL) THEN RAISE EXCEPTION ...; END IF; END $$` block at the top of the future flip migration.

### Deploy runbook update (covers ROADMAP success #3)

- **D-06:** Append a Phase 34 section to `docs/deploy-db-setup.md` covering:
  - The `supabase db push --linked` invocation for the Phase 34 migration
  - The two `has_table_privilege('anon', 'public.brands' / 'public.watch_families', 'SELECT')` smoke-test queries
  - The `npm run db:backfill-catalog-brands` script invocation for the brand backfill (or the explicit `tsx --env-file=.env.local scripts/backfill-catalog-brands.ts` form, mirroring Phase 17's `db:backfill-catalog`)
  - The two-step prod sequence: (1) push migration, (2) run script, (3) verify `SELECT COUNT(*) FROM watches_catalog WHERE brand_id IS NULL`

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion; D-01 through D-04 are user-confirmed selections. D-05 and D-06 are derived from ROADMAP success criteria #3 and #5 (no choice; ROADMAP-locked).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 34: Layer A — Brand + Family Entities" lines 171–181 — phase goal + 5 success criteria. Source of all "MUST" wording.
- `.planning/REQUIREMENTS.md` §CAT-15 — full requirement text (tables, RLS, nullable FKs, manual backfill, three-step migration discipline).
- `.planning/STATE.md` §"Current Position" — Phase 34 next-up after Phase 33b close (2026-05-09); 4 D-17 verdicts published.
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — original catalog hierarchy proposal; brands/families are Layers 1 and 2 of the 5-level hierarchy. Lines 36–38 cite the user-preferred incremental path (introduce brands + watch_families first as nullable additive columns, backfill, then split Variants).

### Phase 33b inheritance (locked verdicts)
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` §"Decision Q2" — DEFERRED verdict; lineage browse UI moves to Phase 39 / v5.x; Phase 34 (and Phase 35) ship schema-only.
- `.planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md` §"Decisions" NSV-02, NSV-09, NSV-16 — same-family/lineage missing-vector rows that Phase 35 schema unblocks but Phase 34 does NOT close.

### Phase 17 patterns (load-bearing precedents)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — D-02 / D-03 GENERATED `*_normalized`, D-04 / D-06 RLS pattern, D-09 array column shape, D-15 denormalized count refresh. Phase 34 inherits the GENERATED + RLS + drizzle-vs-supabase split discipline.
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` — RLS policy shape for `watches_catalog`. Phase 34 mirrors the public-read + service-role-write pattern verbatim for `brands` + `watch_families`.
- `drizzle/0004_phase17_catalog.sql` — Drizzle migration shape for catalog table; Phase 34's drizzle migration mirrors this structure.
- `src/db/schema.ts` lines 282–340 — `watchesCatalog` definition with GENERATED columns and array defaults. Phase 34 adds `brandId` and `familyId` to this definition + new `brands` and `watchFamilies` exports.

### Existing DAL surface that must remain unchanged (ROADMAP success #2)
- `src/data/catalog.ts` — 31 `watchesCatalog` references; trending sort uses `brandNormalized` ASC tie-break.
- `src/data/discovery.ts` — `watchesCatalog` reads in trending/popular queries.
- `src/data/search.ts` — catalog search by `brand_normalized` / `model_normalized`.
- `src/data/recommendations.ts`, `src/data/suggestions.ts` — read paths that join via catalog_id.
- All of the above MUST return identical results after Phase 34's migration. The Phase 34 plan should include a static test or smoke check that asserts no DAL query path changes output for any existing catalog row.

### Backfill script precedent
- `scripts/backfill-catalog.ts` — Phase 17 idempotent backfill pattern (`WHERE catalog_id IS NULL` shrink-to-empty, batch size 100, service-role DATABASE_URL via `--env-file=.env.local`). Phase 34's `scripts/backfill-catalog-brands.ts` mirrors this structure — same env loading, same batch idempotence, same `npm run` script entry pattern.

### Deploy runbook
- `docs/deploy-db-setup.md` — existing deploy runbook with footgun list. Phase 34 appends a section per D-06 (migration push + RLS smoke-test queries + backfill script invocation).

### DB migration discipline (memory anchors)
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — Rules 1 (14-digit filename), 2 (no insertion between adjacent integers), 4 (pg_depend check before structural changes). Rule 3 (extension-schema opclasses) is not relevant unless Phase 34 adds GIN indexes (currently no plan to).
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` does not block anon; rely on RLS policies + explicit `GRANT SELECT` to anon/authenticated.

### Future-phase consumers of Phase 34's schema
- `.planning/ROADMAP.md` §"Phase 35: Layer B" lines 183–193 — populates `watch_families` rows during lineage_edges curation; adds `family_id` linking on `watches_catalog`.
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" lines 220–230 — does NOT need `brand_id` JOIN; reads `brand` text directly per D-04. Phase 34's denormalization decision means CAT-13 plan is unaffected by Phase 34 work.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`scripts/backfill-catalog.ts`** — exact pattern template for `scripts/backfill-catalog-brands.ts`. Reuse the `--env-file=.env.local` env loading, the BATCH_SIZE = 100 + `WHERE x IS NULL` idempotent loop, the inline CTE upsert pattern with `ON CONFLICT` targeting the natural-key UNIQUE constraint, the service-role DATABASE_URL path. The new script is a structural twin with different SELECT/INSERT targets.
- **`watchesCatalog` Drizzle definition (`src/db/schema.ts` lines 282–340)** — direct template for `brands` and `watchFamilies` definitions. `defaultRandom()` UUID PK, `text(...).notNull()` and `text(...)` patterns, `generatedAlwaysAs(sql\`lower(trim(name))\`)` for normalization, `timestamp(...).defaultNow().notNull()` for timestamps, `unique` index for natural-key.
- **Phase 17 `supabase/migrations/20260427000000_phase17_catalog_schema.sql`** — RLS policy template. Replace `watches_catalog` table name + adjust column list; policy shape (public-read SELECT for anon/authenticated, service-role-only INSERT/UPDATE/DELETE) is verbatim.
- **`src/data/catalog.ts:146` `WHERE brand_normalized = lower(trim(${brand}))`** — pattern for matching brand input to catalog rows; Phase 34 backfill script reuses this matching against `brands.name_normalized`.

### Established Patterns

- **GENERATED `*_normalized` columns** are the project's de facto normalization pattern (Phase 17 D-02 / D-03). Phase 34 follows this for both `brands.name_normalized` and `watch_families.name_normalized`.
- **Drizzle definition vs Supabase migration split** — Drizzle is type-source-of-truth; Supabase migration is authoritative DDL (RLS, CHECK, GENERATED, FK). Phase 34 maintains this split: emit drizzle migration via `drizzle-kit generate`, hand-author the Supabase migration with RLS + GENERATED columns, ship both.
- **Service-role-only writes via RLS** is the existing access-control pattern for catalog-level tables (Phase 17). Phase 34's backfill script uses the service-role DATABASE_URL — there is no anon/authenticated write path.
- **Idempotent backfill via `WHERE x IS NULL`** is the existing pattern (Phase 17 `scripts/backfill-catalog.ts`). Phase 34's brand backfill mirrors this — re-runs after success are no-ops because the `WHERE brand_id IS NULL` filter shrinks to empty.
- **Migration filename convention** — exactly 14 digits + `_phaseNN_descriptive_name.sql` (e.g., `20260510000000_phase34_brands_families.sql`). Per memory rule, never decorate timestamps with suffix letters.

### Integration Points

- **No DAL changes in Phase 34** — every existing `watchesCatalog` query path must return identical results. The new `brand_id` / `family_id` columns are nullable additive; SELECT-* queries pick them up without breaking. This is verified by ROADMAP success #2.
- **New Drizzle exports** — `brands` and `watchFamilies` tables added to `src/db/schema.ts`. Type inference (`InferSelectModel<typeof brands>`, etc.) ships in Phase 34 but no consumer reads it yet (Phase 35 will).
- **package.json `npm run db:backfill-catalog-brands`** — new script entry pointing to `tsx --env-file=.env.local scripts/backfill-catalog-brands.ts`, mirroring the existing `db:backfill-catalog` and `db:refresh-counts` entries.
- **No app/UI integration** — zero changes to `src/app/`, `src/components/`, `src/lib/`. Phase 34 is purely DB schema + script + migration + runbook.
- **No tests required by ROADMAP success criteria** — but a static smoke test asserting "all 31 DAL `watchesCatalog` queries return same row counts before and after migration" would be valuable insurance. Decision deferred to planning.

</code_context>

<specifics>
## Specific Ideas

- **Migration filename:** `supabase/migrations/20260510000000_phase34_brands_families.sql` (or whatever 14-digit timestamp is greater than the highest existing — currently `20260504120000_phase27_sort_order.sql`). Single migration file containing: `CREATE TABLE brands`, `CREATE TABLE watch_families`, `ALTER TABLE watches_catalog ADD COLUMN brand_id`, `ALTER TABLE watches_catalog ADD COLUMN family_id`, all RLS policies, all GRANT statements.
- **Drizzle migration:** `drizzle/0007_phase34_brands_families.sql` (next sequential after `0006_phase27_sort_order.sql`). Structural twin of the Supabase migration but without RLS / GENERATED clauses (drizzle's emitted DDL is sometimes malformed for these — the Supabase migration is authoritative, per Phase 17 convention).
- **`scripts/backfill-catalog-brands.ts` shape:**
  ```typescript
  // Phase 34 backfill script — CAT-15.
  // Usage: npm run db:backfill-catalog-brands [--patch-country=country.json]
  //
  // Step 1: INSERT INTO brands SELECT DISTINCT brand_normalized FROM watches_catalog
  // Step 2: (optional) Apply country_of_origin map from country.json
  // Step 3: UPDATE watches_catalog SET brand_id = b.id FROM brands b
  //         WHERE watches_catalog.brand_normalized = b.name_normalized
  //           AND watches_catalog.brand_id IS NULL
  ```
- **`country.json` shape (committed alongside script):**
  ```json
  {
    "rolex": "Switzerland",
    "omega": "Switzerland",
    "casio": "Japan",
    "...": "..."
  }
  ```
  Keys are `name_normalized` values; values are ISO country names. The script reads this on `--patch-country` and updates `brands.country_of_origin` where `name_normalized` matches a key.
- **Smoke-test runbook entries (D-06):**
  ```sql
  -- After supabase db push --linked:
  SELECT has_table_privilege('anon', 'public.brands', 'SELECT');         -- expect: t
  SELECT has_table_privilege('anon', 'public.watch_families', 'SELECT'); -- expect: t

  -- After running the backfill script:
  SELECT COUNT(*) FROM brands;                                            -- expect: ~10–30
  SELECT COUNT(*) FROM watches_catalog WHERE brand_id IS NULL;            -- expect: 0 (or low)
  SELECT COUNT(*) FROM watch_families;                                    -- expect: 0 (deferred to Phase 35)
  SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NULL;           -- expect: total catalog count
  ```
- **DAL parity smoke test (planning-time decision):** A static-import-style test asserting `(SELECT COUNT(*) FROM watches_catalog)` and `(SELECT brand, COUNT(*) FROM watches_catalog GROUP BY brand ORDER BY 1)` produce identical results before and after migration would catch any accidental DAL drift. Whether to ship this is a planning-time call.

</specifics>

<deferred>
## Deferred Ideas

- **Rich brand columns (`founding_year`, `logo_url`, `display_name`, `parent_brand_id`)** — discussed and dropped per D-01. Add via `ALTER TABLE` in any future phase that needs them. Most likely candidates: Phase 39 polish (`logo_url` for brand chips on `/catalog/{id}`); v6 Market Value (group prices by brand, but `name` alone suffices); v5.x lineage browse (could leverage `founding_year` for era headers).
- **Rich family columns (`era_start`, `era_end`, `parent_family_id`)** — discussed and dropped per D-01. Most likely candidate: Phase 39 / v5.x lineage browse UI. Sub-family chains (Datejust → Datejust 36 → Datejust II) belong in `parent_family_id` if/when sub-family browse ships.
- **`watch_families` table seeding** — formally deferred to Phase 35 alongside lineage_edges work per D-03. Phase 34 ships the empty table.
- **`brand_id` / `family_id` `NOT NULL` flip** — formally deferred per D-05 step 3. Conditional on full coverage and growth-path discipline. Schedule when both conditions hold; no current target phase.
- **`watches_catalog.brand` text column drop** — explicitly NOT scheduled per D-04 (permanent denormalization). Reconsider only if a future phase rewrites the natural-key UNIQUE index for an unrelated reason and the JOIN cost becomes negligible.
- **Auto-extract families from `model` text in Phase 34** — discussed and dropped per D-03. Heuristic family extraction belongs in Phase 35 alongside lineage curation, where the manual review is happening anyway.
- **Hand-curated brand seed list (~30–50 canonical brands)** — discussed and dropped per D-03. Auto-derive from existing `brand_normalized` is faster and matches the actual user collection state. The hand-curated list approach is the right pattern if/when v6+ adds brands not yet in any catalog row (e.g., for a brand-discovery surface).
- **Admin UI for brand/family CRUD** — locked out by ROADMAP success #4. If the user later wants in-app curation (vs script-only), it's a separate v5.x / v6 phase. SEED-001 lines 60–66 sketch the curation discipline argument; that's the reference if the topic resurfaces.
- **`/brand/{id}` and `/family/{id}` browse pages** — deferred to Phase 39 (preferred, alongside Q3 dead-end closures) or v5.x per Phase 33b Q2 verdict. Phase 34 has zero UI surface.
- **Denormalized counts on brands / watch_families (e.g., `brand_watch_count`, `family_owners_count`)** — not in Phase 34 (Phase 17 D-15 patterns would apply). Add when a brand/family page actually needs them; until then the JOIN-then-count path is cheap at single-user scale.
- **GIN indexes on `brands.name_normalized` for trigram search** — not in Phase 34. If brand-search becomes a feature (search facet expansion), add `extensions.gin_trgm_ops` index then; remember the schema-qualified opclass rule (memory rule 3).

</deferred>

---

*Phase: 34-layer-a-brand-family-entities*
*Context gathered: 2026-05-08*

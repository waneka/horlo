# Phase 17: Catalog Foundation - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A canonical `watches_catalog` table is laid silently underneath per-user `watches`. Populated from manual entry (natural-key only) and URL extraction (full enrichment via COALESCE). Daily-refreshed denormalized counts via `pg_cron` (prod) and a manual script (local). `analyzeSimilarity()` is **NOT modified** — catalog is silent infrastructure unblocking /search Watches, /explore Trending, /search Collections, and `/evaluate?catalogId=` deep-link in subsequent phases.

**Out of scope for this phase:**
- Modifying `analyzeSimilarity()` to read from catalog (deferred to v5+)
- `SET NOT NULL` on `watches.catalog_id` (nullable indefinitely in v4.0)
- Admin curation tooling (deferred to v5+)
- Tag taxonomy audit (deferred to its own future phase)
- Brand-domain allowlist + smart image-replace logic (columns added now, logic deferred)

</domain>

<decisions>
## Implementation Decisions

### Identity & Normalization

- **D-01: Natural-key UNIQUE uses `NULLS NOT DISTINCT`** (PG 15+). `UNIQUE (brand_normalized, model_normalized, reference_normalized) NULLS NOT DISTINCT`. Two `(Rolex, Submariner, NULL)` rows collide and dedup. Validate Drizzle 0.45.2 introspection during planning; index defined in raw SQL regardless.

- **D-02: Postgres generated columns for normalization.** Source columns preserve display casing; `_normalized` columns are DB-enforced. Pattern:
  ```sql
  brand text NOT NULL,
  brand_normalized text GENERATED ALWAYS AS (lower(trim(brand))) STORED,
  model text NOT NULL,
  model_normalized text GENERATED ALWAYS AS (lower(trim(model))) STORED,
  reference text,
  reference_normalized text GENERATED ALWAYS AS (
    /* see D-03 for reference-specific normalization shape */
  ) STORED
  ```
  Impossible to bypass — even raw INSERTs work correctly.

- **D-03: Reference normalization is `lower + trim + strip whitespace/punctuation`** (medium aggressiveness). `116610LN`, `116610 LN`, `116610-LN`, `116610.LN` all collapse to `116610ln`. Trades small risk of merging punctuation-distinct refs (Patek `5711/1A`) for much higher dedup rate on real-world sloppy input. **Claude's Discretion:** the exact regex/character set for "punctuation" in the GENERATED expression — research and pin during plan-time. Likely `regexp_replace(lower(trim(reference)), '[\s\W_]+', '', 'g')` or similar.

- **D-04: `source` is a CHECK constraint on a text column**, NOT a Drizzle `pgEnum`. Schema:
  ```sql
  source text NOT NULL DEFAULT 'user_promoted'
    CHECK (source IN ('user_promoted', 'url_extracted', 'admin_curated'))
  ```
  Avoids the Phase 24-style rename+recreate dance if values evolve. Add the TS literal union manually in `src/lib/types.ts`.

### Catalog Field Scope & Image Provenance

- **D-05: `upsertCatalogFromUserInput` writes natural key only.** Helper inserts `(brand, model, reference, source='user_promoted')` and uses `ON CONFLICT DO NOTHING`. Spec columns (caseSizeMm, movement, complications, year, tags, etc.) start NULL. URL extraction enriches them later via COALESCE. **Trade-off accepted:** until a URL extract fires for the same watch, /search Watches has no spec data to filter on for that row.

- **D-06: imageUrl lives at the catalog level with provenance tracking.** Three columns added in this phase:
  ```sql
  image_url text,
  image_source_url text,           -- where the image came from
  image_source_quality text        -- 'official' | 'retailer' | 'unknown' (Claude's Discretion: CHECK or free-text v4.0)
  ```
  URL extraction populates via COALESCE. Per-user `watches.image_url` overrides catalog for that user's own display. Smart-replace logic (only upgrade if new quality > stored quality) is **deferred to v5+**; columns are added now to avoid a migration later.

- **D-07: `dialColor` is a catalog SPEC field.** Different references = different catalog rows (`116610LN` black vs `116610LB` blue), matching real SKU reality. dialColor lives on the catalog row. Enables /search Watches dial-color filtering and aligns with how watches actually ship.

- **D-08: `productionYear` is a single integer matching existing `watches.productionYear` shape**, plus a new `production_year_is_estimate boolean DEFAULT false` flag for vintage pieces without exact dates. Lightest-touch precision modeling; back-port to per-user `watches` is a deferred idea.

- **D-09: Tag columns mirror current `watches` shape exactly.** `style_tags text[]`, `design_traits text[]`, `role_tags text[]`, `complications text[]` — all `NOT NULL DEFAULT '{}'`. **No taxonomy changes in Phase 17.** A future "Tag Taxonomy Audit" phase will pare down overlap and migrate both `watches` + `watches_catalog` together (see Deferred Ideas).

### Source Provenance & Enrichment

- **D-10: `source` upgrades `user_promoted` → `url_extracted` on any successful URL-extract write.** `source` reflects the *highest-trust write the row has seen*, not just creation. Never downgrades (typed input doesn't reset). `admin_curated` is the terminal lockdown state.

- **D-11: No code path writes `admin_curated` in v4.0.** The CHECK constraint allows the value, but admin tooling is deferred to v5+. All catalog rows are `user_promoted` or `url_extracted` until then. The CAT-07 "URL-extracted enrichment never overwrites `admin_curated` rows" guard is implemented but never triggers in v4.0.

- **D-12: Audit trail is `updated_at timestamptz NOT NULL DEFAULT now()` only.** No per-field tracking, no audit log table, no `enrichment_count`. Matches existing conventions on `watches`/`profiles`/`profile_settings`. Trigger updates `updated_at` on every write.

- **D-13: Conflict resolution is COALESCE-only — first non-null write wins.** Matches CAT-07 spec exactly. URL #1 sets `case_size_mm = 40`. URL #2 says `41`. COALESCE keeps 40. The data is durable until manual admin intervention. Conflicts surface as future admin-tooling work, not as silent flapping rows.

### Backfill & Cron Operations

- **D-14: Backfill runs as `npm run db:backfill-catalog`, a standalone TS script.** Located at `scripts/backfill-catalog.ts`. Documented as a manual step in `docs/deploy-db-setup.md` after the Phase 17 schema migration applies. Idempotent: `WHERE catalog_id IS NULL` short-circuit + final `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` zero-unlinked assertion. Re-running after success is a no-op.

- **D-15: pg_cron daily refresh runs at 03:00 UTC.** Off-peak for US/EU/Asia. The job invokes a SECURITY DEFINER function that:
  1. Refreshes `watches_catalog.owners_count` and `wishlist_count` via `UPDATE … FROM (SELECT catalog_id, COUNT(*) … GROUP BY catalog_id)`
  2. Writes a row into `watches_catalog_daily_snapshots` `(catalog_id, date, owners_count, wishlist_count)` with `ON CONFLICT (catalog_id, date) DO UPDATE` (idempotent if cron retriggers)

- **D-16: Local `npm run db:refresh-counts` mirrors prod behavior — refreshes counts AND writes a snapshot row.** Same code path as pg_cron, just invoked manually. Lets the dev develop and test /explore Gaining Traction end-to-end without pg_cron available locally. Snapshot date = current date in UTC; idempotent on `UNIQUE (catalog_id, date)`.

- **D-17: Snapshots are retained indefinitely in v4.0** — no purge job. At ~5K catalog rows × 365 days = ~1.8M rows/year, well within Supabase free tier. Future phase can add a purge cron if storage becomes a concern.

### Claude's Discretion

The plan can decide:
- Exact regex/character set for "strip whitespace/punctuation" in `reference_normalized` GENERATED expression (D-03)
- Whether `image_source_quality` ships as a CHECK enum or free-text in v4.0 (D-06)
- Snake-case column naming details (snake_case throughout, mirroring existing conventions)
- Backfill script logging format
- pg_cron job naming (`refresh_watches_catalog_counts_daily` or similar)
- Migration filename ordering relative to existing v3.0 migrations
- Exact SECURITY DEFINER + REVOKE PUBLIC/anon/authenticated grants on the cron function (mirror Phase 11 pattern)

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Key Decisions table (especially the catalog-related entries: nullable indefinitely, silent infrastructure, two-layer privacy departure)
- `.planning/REQUIREMENTS.md` — CAT-01 through CAT-12 (the requirements this phase delivers)
- `.planning/ROADMAP.md` Phase 17 entry — goal + 5 success criteria

### Research artifacts (Phase 17 specifically)
- `.planning/research/SUMMARY.md` — Recommended Stack, Architecture Approach, Critical Pitfalls sections
- `.planning/research/ARCHITECTURE.md` §"Feature 1: Canonical `watches_catalog` Table" — full data flow, JOIN topology, integration points
- `.planning/research/PITFALLS.md` — Critical pitfalls #1 (migration backfill safety), #2 (`ON CONFLICT DO NOTHING` discards enrichment), #3 (RLS-default-on / catalog anon-invisible), and identity fragmentation (Pitfall 3 sibling)
- `.planning/research/STACK.md` §"Canonical Watch Catalog" — natural-key UNIQUE design, `NULLS NOT DISTINCT` reference, generated-column pattern

### Code patterns to mirror
- `supabase/migrations/20260423000005_phase11_debt02_audit.sql` — RLS-on + policy pattern for new tables
- `supabase/migrations/20260423000045_phase11_storage_rls_secdef_fix.sql` — SECURITY DEFINER + REVOKE PUBLIC/anon/authenticated grants pattern (mirror for the pg_cron refresh function)
- `supabase/migrations/20260423000003_phase11_pg_trgm.sql` — pg_trgm GIN index pattern
- `src/data/profiles.ts` — DAL conventions + `searchProfiles` anti-N+1 `inArray` pattern (mirror for `searchCatalogWatches` in Phase 19)
- `src/data/watches.ts` — `mapRowToWatch` / `mapDomainToRow` conventions (mirror for catalog DAL)
- `src/app/actions/watches.ts` `addWatch` Server Action — extension point for catalog wiring (D-05)
- `src/lib/extractors/index.ts` `extractWatchData` — extension point for `upsertCatalogFromExtractedUrl` (CAT-07)

### Memory references
- MEMORY: `project_drizzle_supabase_db_mismatch.md` — drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`
- MEMORY: `project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` alone does NOT block anon; must explicitly REVOKE FROM anon + authenticated
- MEMORY: `project_local_db_reset.md` — supabase db reset workflow (drizzle push + selective supabase migrations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Drizzle schema patterns** in `src/db/schema.ts` — `pgTable`, `text().array().notNull().default(sql\`'{}'::text[]\`)` for tag arrays, `index()`, `unique()`, `pgEnum()` (avoid for `source`; D-04). Mirror for `watchesCatalog` table.
- **DAL `'server-only'` import + viewer-aware shape** in `src/data/profiles.ts`, `src/data/watches.ts` — extend pattern for new `src/data/catalog.ts` module.
- **`mapRowToWatch` / `mapDomainToRow` conventions** in `src/data/watches.ts` — same shape needed for `mapCatalogRowToCatalogEntry` and reverse.
- **`searchProfiles` anti-N+1 pattern** with `pg_trgm` ILIKE + `inArray` batch query in `src/data/profiles.ts` — direct template for `searchCatalogWatches` in Phase 19, but the index lives in this phase.
- **`logActivity` / `logNotification` fire-and-forget pattern** with internal try/catch + non-fatal failure — direct template for catalog wiring failure semantics in `addWatch` (D-05 / CAT-08).
- **Server Action structure** with Zod `.strict()` schema + auth gate + try/catch + `revalidateTag` — extend `addWatch` and `/api/extract-watch` route to call catalog upsert helpers (CAT-08).

### Established Patterns

- **Drizzle for column shapes + raw SQL Supabase migrations for RLS / partial indexes / GIN / CHECK** — strictly enforced. Phase 17 will have BOTH a Drizzle migration (`drizzle/migrations/XXXX_phase17_*.sql` for column shape) AND a sibling `supabase/migrations/YYYY_phase17_*.sql` for RLS + GIN + CHECK + generated columns + pg_cron. Both committed in the same commit.
- **Two-layer privacy (RLS + DAL WHERE)** is the project default — Phase 17 deliberately departs from this: catalog is public-read RLS-only; writes funnel through service-role Drizzle client. The asymmetry is the point. Document as a Key Decision in PROJECT.md when v4.0 ships.
- **RLS-default-on for every new table** (audited in Phase 11 DEBT-02). New tables with no policies = no rows visible to non-service-role. Plan must include `ALTER TABLE … ENABLE RLS` + `CREATE POLICY … FOR SELECT USING (true)` in the SAME commit as the table creation. Add `tests/integration/catalog-rls.test.ts` opening anon connection asserting >0 rows after seed (Pitfall #3 mitigation).
- **SECURITY DEFINER + REVOKE FROM PUBLIC/anon/authenticated/service_role THEN GRANT TO service_role only** for the pg_cron refresh function — Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions, so REVOKE FROM PUBLIC alone is insufficient (per memory `project_supabase_secdef_grants.md`).

### Integration Points

- **`addWatch` Server Action** (`src/app/actions/watches.ts`) — wires `catalog_id` after `createWatch` returns. Fire-and-forget catalog upsert; failure is non-fatal (CAT-08).
- **`/api/extract-watch` route handler** (`src/app/api/extract-watch/route.ts`) — calls `upsertCatalogFromExtractedUrl` with extracted spec data; returns extracted data unchanged to client (CAT-08).
- **`src/lib/extractors/index.ts`** — `extractWatchData()` provides the spec input for `upsertCatalogFromExtractedUrl`. No extractor logic changes.
- **`src/data/watches.ts` `createWatch`** — accept optional `catalogId` parameter OR add a separate `linkWatchToCatalog(watchId, catalogId)` function (plan-time decision; both work).
- **Local dev `package.json` scripts** — add `db:backfill-catalog` and `db:refresh-counts` (D-14, D-16).
- **`docs/deploy-db-setup.md`** — add post-deploy backfill step + pg_cron verification step.

</code_context>

<specifics>
## Specific Ideas

- **Image quality tiering inspired by user vision:** "I think we should have a system where the image can be updated if the imageUrl is coming from a more reliable source, as in the watch brand's website." Phase 17 ships the `image_source_url` + `image_source_quality` columns to support this; the actual brand-domain allowlist + tier-aware COALESCE smart-replace is deferred to v5+ admin tooling.

- **Vintage piece reality:** "Lots of vintage pieces won't have an exact date." `production_year_is_estimate` boolean addresses this. Distinct from `production_year` itself being NULL (year unknown) — this flag means "year is approximate but known."

- **Tag taxonomy concern:** User flagged that complications/style/role/design fields on `watches` have overlap and unclear UX value. Captured as deferred work (own phase, before v5.0 catalog→similarity rewire). Phase 17 catalog tag columns mirror current `watches` shape exactly to keep this deferral cheap (lockstep migration when the audit phase lands).

</specifics>

<deferred>
## Deferred Ideas

- **Admin tooling for catalog curation** — image override, spec corrections, source promotion to `admin_curated`, conflict resolution. v5+ phase.
- **Brand-domain allowlist + tier-aware image COALESCE smart-replace logic** — `image_url` upgrades only if new source is higher-quality than stored. Columns added in v4.0 Phase 17; logic in v5+.
- **Back-port `production_year_is_estimate` flag to per-user `watches` table** — v4.x or v5+. Probably worth bundling with a watch-form UX pass.
- **Tag taxonomy audit & rewire** — complications / style / role / design tags on `watches` have overlap and unclear UX value. Future phase audits, pares down, migrates both `watches` + `watches_catalog` in lockstep, updates `analyzeSimilarity()` weights. Should land BEFORE v5.0 catalog→similarity rewire. Phase 17 mirrors current shape exactly to keep this deferral cheap.
- **Snapshot purge job** — if `watches_catalog_daily_snapshots` storage becomes a concern, add a second pg_cron job to DELETE rows older than N days. Deferred from v4.0; revisit in a future ops/maintenance phase.

### Reviewed Todos (not folded)

None — `todo match-phase 17` returned zero matches.

</deferred>

---

*Phase: 17-catalog-foundation*
*Context gathered: 2026-04-27*

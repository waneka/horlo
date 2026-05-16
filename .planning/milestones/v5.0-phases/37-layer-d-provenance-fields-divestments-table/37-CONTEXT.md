# Phase 37: Layer D — Provenance Fields + Divestments Table - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship Layer D of the v5.0 catalog hierarchy serial: collector-diary provenance columns on `watches` + a new `divestments` table that records every sale with timestamp / price / replacement / notes. Replaces the insufficient `watches.status = 'sold'` single-bit signal with a structured sold record the future recommender (SEED-002) can use for temporal decay.

**In scope (locked by ROADMAP §Phase 37 + this discussion):**

1. **7 new nullable columns on `watches`:**
   - `serial` (text)
   - `year_of_acquisition` (int) — coexists with existing `acquisition_date` per D-01
   - `condition` (pgEnum: 6 industry grades per D-06)
   - `box_papers` (pgEnum: 4 values per D-08, ROADMAP-locked)
   - `service_history` (text, free-form, mirrors `notes` per D-07)
   - `paid_currency` (pgEnum: 10 common watch-collecting currencies per D-03)
   - `purchase_date` (date) — exact-date companion to `year_of_acquisition`

2. **`divestments` table** with `(id, catalog_id NOT NULL FK, user_id NOT NULL FK, divested_at NOT NULL timestamptz, replaced_by_catalog_id nullable FK, sale_price real, sale_currency pgEnum, notes text, created_at, updated_at)`. RLS mirrors `watches`: SELECT/INSERT/UPDATE/DELETE all gated on `auth.uid() = user_id`.

3. **Server Action `recordDivestment(watchId, divestmentData)`** — called when status flips `owned → sold`. Writes a row to `divestments` with `divested_at = NOW()`. Mirrors existing `updateWatch` action pattern in `src/app/actions/watches.ts`. `watches.status = 'sold'` is set in the SAME server action (dual-write — both status flag AND divestment row).

4. **WatchForm "Collector's Record" disclosure** — base-ui Accordion (`@base-ui/react/accordion`; see D-15 CORRECTION). Edit page only (not create page per ROADMAP). Collapsed by default with no visual regression on the non-expanded state. Exposes all 7 provenance fields.

5. **Sold watches in `/collection`** — stay visible with a sold badge/treatment. Existing status filter chip group (owned/wishlist/sold/grail) controls visibility. No new surface required (per D-02). DAL `getWatchesByUser` already returns all statuses; UI filter chips handle the rest.

6. **Single supabase migration** containing 2 new pgEnum types (condition_grade, currency_code; box_papers is the 3rd if we don't reuse an existing pattern), 7 ALTER TABLE ADD COLUMN statements on `watches`, CREATE TABLE `divestments`, RLS policies, GRANT statements, indexes. Drizzle migration twin (idempotent structural shape, no RLS/GRANT) + journal idx=10.

**Not in scope (deferred):**

- **Divestment dialog UI** ("I just sold this watch" post-status-flip flow) — ROADMAP-locked deferred to v5.x. Server Action exists in Phase 37; UI to call it doesn't.
- **`replaced_by_catalog_id` capture in WatchForm** — depends on the deferred dialog. Column ships nullable; future v5.x phase populates it.
- **v6.0 market-value math consuming `divestments`** — Phase 37 ships the data; v6.0 (SEED-005) consumes it.
- **Phase 38 CAT-13 engine rewire** — separate phase; Phase 37 does NOT modify `analyzeSimilarity()`.
- **Drizzle-side `watches.catalogId .notNull()` tightening** — explicitly DEFERRED to Phase 38 per Phase 36 Plan 01 Rule 4 (cascading 18 tsc errors require DAL flow rewrite). Phase 37 does NOT fix it either; Phase 38 owns the DAL flow rewrite that unblocks the type tightening.
- **Soft-delete / hard-archive for sold watches** — not needed per D-02 (sold watches stay in `watches` with `status='sold'`; visibility controlled by filter chips).

**ROADMAP success criteria coverage** (verbatim from `.planning/ROADMAP.md` §Phase 37 lines 283–294):

1. ✓ `watches` gains 7 nullable provenance columns — covered by Plan 01 (Drizzle schema) + Plan 02 (Supabase migration)
2. ✓ `divestments` table with shape + RLS — covered by Plan 02 (schema) + Plan 02 (RLS)
3. ✓ Status `owned → sold` writes a row via Server Action — covered by Plan 04 (action + WatchForm wire-up)
4. ✓ WatchForm gains collapsed "Collector's Record" disclosure — covered by Plan 04 (base-ui Accordion + provenance fields)
5. ✓ Divestment dialog UI explicitly deferred — documented in this CONTEXT.md `<deferred>` section and to be re-cited in Phase 37 SUMMARY.md

**Why this phase matters (user-facing value):**

- A watch isn't just a model — it's THIS specific watch with THIS specific history. A 1985 Sub with original box/papers ≠ a 2020 Sub that's been serviced twice. Same catalog row; different collector reality. Provenance columns capture that.
- Sold watches become part of the collector's story, not silent deletions. The future recommender (SEED-002) reads `divestments.divested_at` for temporal decay: "sold this 2 years ago — your taste may have shifted; weight recent acquisitions higher."
- Sets up v6.0 market-value math (SEED-005). Real "what's this worth now" needs paid_price + paid_currency + purchase_date + condition + box_papers, not just catalog defaults. Phase 37 ships the data; v6.0 consumes it.
- After Phase 37, every owned watch has a complete data shape ready for the recommender + market-value engines that follow.

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 37 uses the `D-NN` prefix.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 35 D-03 / D-10 / D-11 precedent — pgEnum vs free text:** Use pgEnum for finite-known sets (movement_type, box_papers in Phase 37); use free text for collector-subjective values (case_material, bracelet_variant from Phase 35; service_history in Phase 37). Phase 37 D-06 + D-08 follow this precedent for `condition` (finite — 6 industry grades) and `box_papers` (finite — 4 values).
- **Phase 17 D-04 / D-06 — RLS pattern:** Per-user resources use `auth.uid() = user_id` policies (not public-read). `divestments` mirrors `watches` RLS verbatim: SELECT/INSERT/UPDATE/DELETE all gated on the user owning the row.
- **Phase 19.1 / 17 — drizzle/supabase migration split:** Drizzle is the TS type source of truth. Supabase migration is authoritative DDL (RLS policies, pgEnum CREATE TYPE, CHECK constraints, GRANT statements). Drizzle migration is a structural twin (no RLS, no GRANT, no DO $$ blocks).
- **Phase 34 D-02 — `ON DELETE RESTRICT` for entity FKs:** `divestments.catalog_id` uses `ON DELETE RESTRICT` (mirrors brands ← watches_catalog, watch_families ← watches_catalog, watches_catalog ← watch_lineage_edges, watches_catalog ← watch_variants). `divestments.user_id` uses `ON DELETE CASCADE` (mirrors `watches.user_id`). `divestments.replaced_by_catalog_id` uses `ON DELETE SET NULL` (lifecycle hint — losing the canonical reference doesn't invalidate the historical divestment).
- **Phase 34 / 35 / 36 — migration filename + idempotent Drizzle twin:** 14-digit timestamp strictly greater than the highest existing supabase migration (20260511000000 from Phase 36). Drizzle migration ships idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, FK guards via DO $$ pg_constraint). Drizzle journal append (idx=10) is MANDATORY (Phase 34 Plan 01 lesson — without journal append drizzle-kit migrate silently skips).
- **Phase 36 Plan 01 Rule 4 deferral — Drizzle `watches.catalogId .notNull()` is DEFERRED to Phase 38:** Phase 37 does NOT fix this either. Cascading 18 tsc errors require DAL flow rewrite (createWatch must accept catalogId as required parameter; two production call sites must upsert catalog BEFORE createWatch) plus 17 integration test fixture updates. Phase 38 owns this work. Phase 37 ships its own changes with the existing nullable catalogId Drizzle definition unchanged.
- **Memory `project_drizzle_supabase_db_mismatch.md` all 4 rules apply:** (1) 14-digit timestamp filename, (2) no insertion between adjacent integers, (3) extension schema qualification (N/A — no GIN indexes added in Phase 37), (4) pg_depend pre-check before any column drop/type-change touching existing columns. Phase 37 only ADDs columns to `watches` — no drops/type-changes — so rule 4 surfaces only IF a future change wants to drop/restructure an existing column.
- **Memory `project_db_wipeable_2026_05_09.md`:** Prod has 12 seed `auth.users` accounts from prior Claude sessions, user-confirmed as trash. Phase 37 does NOT wipe. Phase 37 is fully user-count-independent (schema-only changes + Server Action that operates on the authenticated user's own rows via RLS).

### Provenance columns (Area 1 — D-01 through D-08)

- **D-01 — `year_of_acquisition` and existing `acquisition_date` coexist (no migration of acquisition_date):**
  Existing `watches.acquisition_date` is `text` (free-form, set by users since v1.0). Phase 37 adds `year_of_acquisition` as a nullable int. They are complementary, not redundant. UI logic:
  - If `purchase_date` (the new exact-date field per D-09b) is populated → show it
  - Else if `acquisition_date` (legacy text) is populated → show it
  - Else if `year_of_acquisition` is populated → show as "Acquired ~{year}"
  - User CAN fill any combination; no validation cross-link required
  Rationale: zero migration risk on existing `acquisition_date` data; supports "I only remember the year I got this 90s watch" use case; respects user-entered exact dates.

- **D-02 — `condition` is a strict pgEnum with 6 industry-standard grades:**
  Create pgEnum `condition_grade` with values `mint`, `near_mint`, `excellent`, `good`, `fair`, `poor`. UI shows chip selector with these 6 options. Mirrors Phase 35 D-03 movement_type pgEnum pattern.
  Rationale: industry standard (Chrono24, WatchUSeek, dealer listings use these terms); v6.0 market-value math (SEED-005) needs structured condition as a price driver — pgEnum guarantees this. Adding new grades later requires a migration (acceptable per single-user state).

- **D-03 — `paid_currency` is a strict pgEnum with 10 common watch-collecting currencies:**
  Create pgEnum `currency_code` with values `USD`, `EUR`, `GBP`, `JPY`, `CHF`, `AUD`, `CAD`, `HKD`, `SGD`, `CNY`. UI shows chip selector when `price_paid` is set. Mirrors Phase 35 D-03 pattern.
  Rationale: schema-enforced determinism for v6.0 market-value math; covers Swiss/Japanese/UK/EU/major-Asian-market origins (which cover 99%+ of watch-collecting transactions); pgEnum extension via ALTER TYPE ADD VALUE in a future phase is straightforward if needed.

- **D-04 — `divestments.sale_currency` added (additive beyond ROADMAP letter) using the same `currency_code` pgEnum:**
  ROADMAP §Phase 37 lists `(catalog_id, user_id, divested_at, replaced_by_catalog_id, sale_price, notes)` without a sale_currency. This decision adds `sale_currency` as a nullable column using the same `currency_code` pgEnum. Reason: a watch bought in USD and sold in EUR records the EUR price honestly. Assumption-based currency (sale_currency = paid_currency at sell-time) would lie about realized currency.
  Rationale: provenance accuracy. Nullable for cases where the user doesn't remember/care; future v5.x sell-dialog will prompt for it.

- **D-05 — `box_papers` is a pgEnum with 4 ROADMAP-locked values:**
  Create pgEnum `box_papers_status` with values `none`, `box_only`, `papers_only`, `full_set` (verbatim from ROADMAP §Phase 37 success #1). UI shows chip selector with these 4 options.
  Rationale: ROADMAP-locked.

- **D-06 — `service_history` is free text (mirrors `watches.notes`):**
  Single nullable text column. UI exposes as multiline textarea. No structured shape (no list of {date, service_type, provider} JSON), no length limit beyond existing Postgres text behavior.
  Rationale: service notes are subjective/narrative ("polished case 2018 by Rolex Service Center NYC; movement service 2022 by independent watchmaker XYZ"). Mirrors Phase 35 D-10/D-11 free-text precedent. If v6.0 needs structured service signals, a future enrichment phase can parse this column.

- **D-07 — `serial` is free text, no validation:**
  Single nullable text column. No length constraint, no format validation. Some watches have alphanumeric serials, some have just numbers, some have prefixes (Rolex W-, K-, L-, F-, V-, M-, Z- series); validation is out of scope.
  Rationale: serial format varies wildly by brand and era; validation would block legitimate inputs.

- **D-08 — `purchase_date` is `date` (Postgres native type):**
  Per-day precision. Nullable. Separate from `year_of_acquisition` (int year) and `acquisition_date` (legacy text). UI exposes as date picker.
  Rationale: structured exact-date input for purchases the user remembers precisely; complements the year-only fallback (D-01).

### Divestments table shape (Area 2 — D-09 through D-13)

- **D-09 — `divestments` table shape:**
  ```sql
  CREATE TABLE divestments (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id               uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
    user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    divested_at              timestamptz NOT NULL DEFAULT now(),
    replaced_by_catalog_id   uuid REFERENCES watches_catalog(id) ON DELETE SET NULL,
    sale_price               real,
    sale_currency            currency_code,
    notes                    text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX divestments_user_id_idx ON divestments(user_id);
  CREATE INDEX divestments_catalog_id_idx ON divestments(catalog_id);
  CREATE INDEX divestments_user_divested_at_idx ON divestments(user_id, divested_at DESC);
  ```
  Includes `id` PK (matches every other Horlo table). `divested_at` defaults to `now()` so the Server Action doesn't have to pass it. Cardinality: 1 user can have many divestments; 1 catalog row can be divested by N users (cross-collector); replaced_by_catalog_id is a soft hint (collector's "I sold this Sub and bought THIS one").

- **D-10 — RLS mirrors `watches`:**
  `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE. No service-role-only policy.
  ```sql
  ALTER TABLE divestments ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "divestments_owner_select" ON divestments FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "divestments_owner_insert" ON divestments FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "divestments_owner_update" ON divestments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "divestments_owner_delete" ON divestments FOR DELETE USING (auth.uid() = user_id);
  GRANT SELECT, INSERT, UPDATE, DELETE ON divestments TO authenticated;
  ```
  Rationale: divestments are personal data (sale prices, notes). Public-read-RLS does NOT apply — this is opposite of `watch_variants` / `watches_catalog` which are catalog-tier.

- **D-11 — `recordDivestment(watchId, divestmentData)` Server Action:**
  New action in `src/app/actions/watches.ts` (or `src/app/actions/divestments.ts` — researcher decides):
  - Input: `{ watchId: string, salePrice?: number, saleCurrency?: CurrencyCode, replacedByCatalogId?: string, notes?: string }` (and `divestedAt` defaults to `now()` server-side)
  - Behavior:
    1. Verify user owns the watch (RLS check via DAL `getWatchById(userId, watchId)`)
    2. Verify `watches.catalog_id IS NOT NULL` (post-CAT-14 invariant — must be true)
    3. Insert into `divestments` with `catalog_id = watch.catalog_id`, `user_id = user.id`, `divested_at = NOW()` plus the optional fields
    4. UPDATE `watches.status = 'sold'` (dual-write per ROADMAP success #3)
    5. `revalidatePath('/collection')` + `revalidatePath('/profile/...')` (existing pattern in updateWatch)
  - Return: `{ ok: true, divestmentId: string } | { ok: false, error: string }`
  Rationale: mirrors existing addWatch/updateWatch/deleteWatch action shape. Dual-write keeps the existing UI (status filter chips) working without DAL changes.

- **D-12 — Status transition trigger point: status chip click on WatchForm or watch row:**
  Phase 37 wires the Server Action but does NOT yet ship the sell-dialog UI (deferred per ROADMAP success #5). The status chip / dropdown that flips `owned → sold` in the existing UI (StatusToggle component or status select in WatchForm) calls `recordDivestment(watchId, {})` with no extra metadata in Phase 37 — divestments row gets `sale_price=NULL`, `sale_currency=NULL`, `replaced_by_catalog_id=NULL`, `notes=NULL`. The future v5.x sell-dialog phase populates these.
  Rationale: ROADMAP success #3 says status transition writes a row — it doesn't say the row is fully populated in Phase 37. Empty-metadata divestment rows are valid (RLS-tagged, timestamped) and the dialog phase backfills them.

- **D-13 — `divestments` is 1:1 with the sold watch (not 1:N historical record across re-buys):**
  A watch can only be sold once per its lifetime in the user's collection. If the user re-acquires a previously-sold watch (rare but possible: "I sold my Sub and bought it back from the same dealer"), they would need to delete the old divestment row or treat the re-buy as a NEW watches row. Phase 37 does NOT enforce a UNIQUE constraint on `(user_id, watch_id)` because there's no `watch_id` column on divestments — the link is via `catalog_id` (which can repeat across users and re-buys). 1:1 is a soft convention, not a schema constraint.
  Rationale: collectors rarely re-buy the same watch; if they do, the data shape is intentionally flexible. Future v5.x may add a `watches.divestment_id` FK if hard 1:1 becomes important.

### Sold-watch visibility (Area 3 — D-14)

- **D-14 — Sold watches stay visible in `/collection` with sold badge; existing status filter chip controls visibility:**
  No new surface. No DAL change. Sold watches continue to appear in `getWatchesByUser` results. UI changes:
  - WatchCard renders with a "Sold" badge/treatment when `status === 'sold'` (visual treatment TBD — researcher will look at existing badge patterns in `src/components/watch/WatchCard.tsx`)
  - FilterBar's status chip group already includes 'sold' as an option (verify via grep — D-14a)
  - Default filter chip selection MAY exclude 'sold' so the default view hides sold watches; user toggles the 'sold' chip to include them
  Rationale: matches the "sold watches are part of your story" vision; zero new surfaces; reuses existing filter chip infrastructure.

  **D-14a — Default filter chip selection:** Researcher to verify the current default state of the status filter chip group (in `src/store/watchStore.ts` or `src/components/filters/FilterBar.tsx`). If default is "all statuses visible", changing it to "owned + wishlist + grail (sold off-by-default)" is a UX preference question for Phase 39 polish, NOT a Phase 37 blocker. Phase 37 only adds the sold badge; the chip default question is deferred to either Phase 39 polish or v5.x.

### Disclosure UI primitive (Area 4 — D-15)

- **D-15 — "Collector's Record" disclosure uses base-ui Accordion:**
  Single-section accordion (not multi-section). Collapsed by default. Header text: "Collector's Record" (or researcher's call — final copy in Plan 04). Body contains all 7 provenance field inputs in a logical grouping (acquisition info → condition+box_papers → financials → service_history).
  Use `@base-ui/react/accordion` (mirror `src/components/search/WatchSearchRowsAccordion.tsx` — the only accordion in the codebase).
  Rationale: matches the existing accordion pattern in WatchSearchRowsAccordion; full keyboard a11y; consistent dark-mode visual treatment via Tailwind 4 `data-[open]:` selectors + `tw-animate-css` chain.

  **CORRECTION 2026-05-11** (post-RESEARCH §10 / L-07): the original wording of this decision referenced `@/components/ui/accordion` and "CollectionFitCard accordion pattern." Both claims are factually wrong — there is no `src/components/ui/accordion.tsx` file in the codebase, and CollectionFitCard does not use an accordion. RESEARCH §10 corrects this: the only accordion in the project is `@base-ui/react/accordion` in `WatchSearchRowsAccordion.tsx`. The plans (37-04, 37-05) use the corrected import path.

### Plan structure preview (informational — planner has latitude)

Likely 4-5 plans, 3 waves:

- **Wave 1 (parallel):**
  - Plan 01 — Drizzle schema: 3 new pgEnums (currency_code, condition_grade, box_papers_status), 7 new columns on `watches`, new `divestments` table definition in `src/db/schema.ts`
  - Plan 02 — Supabase migration: single file `<14-digit>_phase37_layer_d.sql` with pgEnum CREATE TYPEs, 7 ADD COLUMNs, CREATE TABLE divestments, RLS policies, GRANTs, indexes (no DO $$ pre-flight needed — Phase 37 is purely additive)
  - Plan 03 — Drizzle migration twin: `drizzle/0010_phase37_layer_d.sql` + journal idx=10 (idempotent structural shape)
- **Wave 2 (sequential, depends on Wave 1):**
  - Plan 04 — Server Action `recordDivestment` + WatchForm "Collector's Record" disclosure (base-ui Accordion + 7 field inputs) + WatchCard sold-badge treatment + editWatch transition-detection wire-up (no StatusToggle component exists; see RESEARCH §4)
- **Wave 3 (sequential, depends on Wave 2):**
  - Plan 05 — Integration test (mirror `tests/integration/phase36-rls.test.ts` shape) + local schema push (docker exec psql + drizzle-kit push) + docs/deploy-db-setup.md append §37.0..§37.5 + checkpoint:human-action for prod deploy (`supabase db push --linked` against linked horlo project)

### Claude's Discretion

- **Plan structure** above is informational only; planner has latitude to split, merge, or reorder plans within these constraints: 3 waves max (matches Phase 36 cadence); Wave 1 plans must have non-overlapping `files_modified`; Wave 2 wires the action+UI together; Wave 3 covers tests + deploy.
- **Migration filename**: timestamp strictly greater than `20260511000000` (Phase 36) — exact filename TBD by planner based on the date when Plan 02 is executed.
- **Drizzle migration filename**: `drizzle/0010_phase37_layer_d.sql` + journal idx=10 (Plan 03).
- **pgEnum naming**: `condition_grade`, `currency_code`, `box_papers_status` — researcher/planner may rename if a clearer convention emerges (e.g., `watch_condition` if `condition_grade` collides with another future enum).
- **Server Action location**: `src/app/actions/watches.ts` (existing file) OR new `src/app/actions/divestments.ts` — researcher decides based on grep of existing patterns.
- **Server Action input shape**: per D-11 above, but exact TypeScript shape and zod schema decided by planner.
- **WatchCard sold badge visual treatment**: planner reads existing badge patterns in WatchCard and chooses (likely a small chip in the top-right or a strikethrough on title; researcher confirms).
- **`replaced_by_catalog_id` capture UI**: NOT shipped in Phase 37 (column ships nullable; backfill UI is the deferred v5.x sell-dialog phase's responsibility).
- **`condition` UI**: shadcn chip group with the 6 industry grades, mirroring existing chip-group patterns in WatchForm. Researcher confirms shadcn primitive name.
- **D-14a default filter chip selection**: Phase 37 ships the sold badge but does NOT change the default filter chip state. Default chip selection is a UX decision deferred to Phase 39 polish or v5.x.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 37: Layer D — Provenance Fields + Divestments Table" lines 283–294 — phase goal + 5 success criteria. Source of all "MUST" wording.
- `.planning/REQUIREMENTS.md` §CAT-18 (line 31) — full requirement text. All 7 provenance columns + divestments table shape + Server Action wire + WatchForm disclosure + divestment-dialog-deferred clause locked here.
- `.planning/STATE.md` §"Current Position" — Phase 37 next-up after Phase 36 close (2026-05-11).
- `.planning/PROJECT.md` — Horlo core value: taste-aware watch collection intelligence for personal collectors.
- `.planning/seeds/SEED-002-hybrid-recommender.md` (if exists) — recommender consumes `divestments.divested_at` for temporal decay.
- `.planning/seeds/SEED-005-market-value.md` (if exists) — v6.0 consumes `watches.paid_currency` + `watches.paid_price` + `divestments.sale_price` + `divestments.sale_currency` for market-value math.

### Phase 36 inheritance (load-bearing precedents)
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-CONTEXT.md` — D-02 column-shape pattern (10-col table + UNIQUE + FK RESTRICT); D-05 RLS pattern; D-07 DO $$ pattern (Phase 37 doesn't need pre-flight since it's additive); D-04 cascade behavior precedent.
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-RESEARCH.md` §"RLS + GRANT Template" — verbatim template for per-user RLS (Phase 36 used public-read; Phase 37 must invert to `auth.uid() = user_id`).
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/deferred-items.md` Item 1 — Drizzle `catalogId .notNull()` deferred to Phase 38; Phase 37 does NOT fix it.
- `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` — RLS POLICY shape, GRANT shape, CREATE TABLE pattern.
- `drizzle/0009_phase36_layer_c_variants.sql` — idempotent CREATE TABLE IF NOT EXISTS + DO $$ FK guards pattern.
- `tests/integration/phase36-rls.test.ts` — vitest integration test template (localhost guard + describe.skip pattern + .cause.code assertion pattern for drizzle-wrapped postgres-js errors).
- `docs/deploy-db-setup.md` Phase 36 section (§36.0..§36.7) — heading hierarchy + 7 sub-section pattern.

### Phase 35 inheritance
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-CONTEXT.md` — D-03 pgEnum movement_type pattern (verbatim mirror for condition_grade + currency_code + box_papers_status); D-10/D-11 free-text precedent (verbatim mirror for service_history + serial); D-04 ON DELETE RESTRICT for entity FKs.

### Phase 17 inheritance
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — D-04 watches.catalog_id ON DELETE SET NULL (Phase 37 preserves; `divestments.catalog_id` uses ON DELETE RESTRICT per Phase 34 D-02 instead); D-06 RLS pattern for per-user resources (`auth.uid() = user_id`).
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` — per-user RLS POLICY shape for `watches` (verbatim mirror for `divestments`).
- `src/db/schema.ts` lines 65–134 — `watches` Drizzle definition (Phase 37 ADDs 7 columns to this table).

### Existing DAL + UI surface (touched by Phase 37)
- `src/data/watches.ts` — `getWatchesByUser` returns all statuses; Phase 37 does NOT change this. Sold watches continue to be returned; UI controls visibility per D-14.
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` ensures catalog_id is populated on watch creation (load-bearing for D-11 step 2 invariant).
- `src/app/actions/watches.ts` — existing addWatch/updateWatch/deleteWatch action patterns (Phase 37 mirrors for `recordDivestment` per D-11).
- `src/components/watch/WatchForm.tsx` — 737 lines; Phase 37 adds a base-ui Accordion section for provenance fields (D-15 CORRECTION: `@base-ui/react/accordion`).
- `src/components/watch/WatchCard.tsx` — Phase 37 adds sold-badge treatment (D-14).
- `src/components/filters/FilterBar.tsx` — existing status filter chip group (researcher verifies the current chip default state per D-14a).
- `src/lib/types.ts` line 30 `status: WatchStatus` — `WatchStatus` already includes 'sold'; Phase 37 does NOT modify this type.

### Existing primitives (reused by Phase 37)
- `@base-ui/react/accordion` (npm package, already installed) — base-ui Accordion. Mirror `src/components/search/WatchSearchRowsAccordion.tsx`. Phase 37 D-15 reuses this primitive for "Collector's Record" disclosure. **There is NO `src/components/ui/accordion.tsx`** — D-15 CORRECTION 2026-05-11.
- Existing chip-group primitives in WatchForm — for condition, box_papers, paid_currency selectors (researcher confirms primitive names).

### NEW Phase 37 files (informational — planner finalizes)
- `src/db/schema.ts` — ADD 3 pgEnums + 7 columns on watches + new divestments pgTable
- `supabase/migrations/<14-digit>_phase37_layer_d.sql` — single migration with CREATE TYPE + ALTER TABLE ADDs + CREATE TABLE + RLS + GRANTs + indexes
- `drizzle/0010_phase37_layer_d.sql` + `drizzle/meta/_journal.json` idx=10
- `src/app/actions/watches.ts` OR `src/app/actions/divestments.ts` — recordDivestment Server Action
- `src/components/watch/WatchForm.tsx` — base-ui Accordion (`@base-ui/react/accordion`) + 7 field inputs
- `src/components/watch/WatchCard.tsx` — sold badge
- `tests/integration/phase37-rls.test.ts` — vitest integration mirror of phase36-rls.test.ts
- `docs/deploy-db-setup.md` — append §37.0..§37.5 section

### DB migration discipline (memory anchors)
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — Rules 1 (14-digit filename), 2 (no insertion), 3 (extension schema — N/A), 4 (pg_depend — N/A since Phase 37 only ADDs columns). Drizzle migration MUST be idempotent.
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_local_db_reset.md` — local re-sync flow: `supabase db reset` + drizzle push + docker exec psql apply.
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` does NOT block anon; explicit `GRANT` to authenticated mandatory (applies to divestments).
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_db_wipeable_2026_05_09.md` — Phase 37 does NOT wipe; 12 seed auth.users are user-confirmed trash; Phase 37 user-count-independent.

### Future-phase consumers
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" — Phase 38 reads catalog taste; does NOT read provenance fields directly (taste is per-Reference, not per-instance). Phase 38 ALSO owns the Drizzle `catalogId .notNull()` tightening deferred from Phase 36.
- v5.x sell-dialog phase (TBD) — consumes `divestments` write path from Phase 37; backfills `sale_price` / `sale_currency` / `replaced_by_catalog_id` / `notes` via dialog UI.
- v6.0 SEED-005 market-value (future) — consumes `watches.price_paid` + `watches.paid_currency` + `watches.purchase_date` + `watches.condition` + `watches.box_papers` + `divestments.sale_price` + `divestments.sale_currency` + `divestments.divested_at`.
- Future SEED-002 hybrid recommender — consumes `divestments.divested_at` for temporal decay weighting.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`watches` Drizzle definition (`src/db/schema.ts` lines 65–134)** — direct edit target. ADD 7 columns: `serial` (text), `yearOfAcquisition` (integer), `condition` (conditionGradeEnum), `boxPapers` (boxPapersStatusEnum), `serviceHistory` (text), `paidCurrency` (currencyCodeEnum), `purchaseDate` (date). NO existing column changes.
- **`watches_catalog` Drizzle definition (`src/db/schema.ts` lines 298–369)** — direct read target. `divestments.catalog_id FK` + `divestments.replaced_by_catalog_id FK` both reference this table; no edits.
- **`users` Drizzle definition** (Supabase auth schema mirror) — `divestments.user_id` FK target. No edits.
- **`movementTypeEnum` Drizzle definition (Phase 35 D-03)** — direct template for `conditionGradeEnum`, `currencyCodeEnum`, `boxPapersStatusEnum`. pgEnum pattern verbatim.
- **`watch_variants` Drizzle definition (`src/db/schema.ts` ~lines 458–488)** — direct template for `divestments` pgTable structural shape (PK + FKs + timestamps + UNIQUE + indexes).
- **`watches` RLS policies** (Phase 17 supabase migration) — direct template for `divestments` policies. `auth.uid() = user_id` pattern verbatim across SELECT/INSERT/UPDATE/DELETE.
- **`updateWatch` Server Action (`src/app/actions/watches.ts:301-341`)** — direct template for `recordDivestment` shape (zod validate input → verify user owns row via DAL → mutate DB → revalidatePath).
- **`upsertCatalogFromUserInput` (`src/data/catalog.ts`)** — load-bearing for D-11 step 2 (post-CAT-14 invariant: `watches.catalog_id IS NOT NULL` always true).
- **`@base-ui/react/accordion` (npm package)** — direct primitive for D-15 "Collector's Record" disclosure. Mirror `src/components/search/WatchSearchRowsAccordion.tsx`. **No `src/components/ui/accordion.tsx` exists** — D-15 CORRECTION 2026-05-11.
- **Existing chip-group patterns in `src/components/watch/WatchForm.tsx`** — direct template for condition / box_papers / paid_currency chip selectors.
- **Existing date input patterns in `src/components/watch/WatchForm.tsx`** — direct template for purchase_date date picker.
- **`tests/integration/phase36-rls.test.ts`** — direct template for `phase37-rls.test.ts` (Phase 37 swaps RLS test from public-read to per-user `auth.uid() = user_id`; pgEnum existence assertions; column nullability assertions).
- **`docs/deploy-db-setup.md` §36.0..§36.7** — heading hierarchy template for §37.0..§37.5 (Phase 37 needs FEWER subsections — no pg_depend pre-check, no CAT-14 hard-fail recovery flow, since Phase 37 is additive).

### Established Patterns

- **Drizzle definition vs Supabase migration split** — Drizzle = TS source of truth (column shapes only); Supabase = authoritative DDL (RLS, GRANT, CREATE TYPE, CHECK, DO $$). Phase 37 maintains this split.
- **Migration filename convention** — exactly 14 digits + `_phase37_layer_d.sql`. Per memory rule 1.
- **Idempotent Drizzle migration** — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, FK guards via DO $$ pg_constraint.
- **Per-user RLS** — `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE. GRANT to authenticated (NOT anon).
- **Server Action shape** — zod validate input → DAL ownership check → mutate → revalidatePath → return `{ ok: true | false, ... }`.
- **base-ui Accordion for disclosures** — `@base-ui/react/accordion` package; single-section or multi-section composition pattern; mirror `WatchSearchRowsAccordion.tsx`. (D-15 CORRECTION 2026-05-11: original "shadcn Accordion" wording was factually incorrect.)
- **pgEnum for finite-known sets** — `condition_grade`, `currency_code`, `box_papers_status` mirror `movement_type`.

### Integration Points

- **DAL changes:** ONE new function `recordDivestment` (or however planner names it). Existing `getWatchesByUser` continues to work — sold watches stay included.
- **UI changes:** WatchForm gains Accordion + 7 inputs (D-15); WatchCard gains sold badge (D-14); StatusToggle (or wherever status flips) wires the recordDivestment action call.
- **Type changes:** `Watch` type in `src/lib/types.ts` gains 7 optional fields. New `Divestment` type. `CurrencyCode`, `ConditionGrade`, `BoxPapersStatus` types from pgEnums.
- **No app/page changes:** No route additions. No new pages. `/collection` and watch edit page already exist; Phase 37 augments their content.
- **Test changes:** New integration test file. Existing tests SHOULD continue passing (Phase 37 only ADDs columns / tables / actions; nothing removed).

### Parity gate (ROADMAP success #1 "all existing rows unaffected" + zero regressions in current flows)

- All 7 new columns on watches are nullable — existing rows get NULL by default — no migration of existing data needed
- `divestments` is empty post-migration — no orphan risk
- `getWatchesByUser` unchanged — DAL surface stable
- `WatchForm` create page does NOT show provenance fields (ROADMAP success #4: edit page only)
- pgEnum CREATE TYPE adds new types; doesn't modify existing types

</code_context>

<specifics>
## Specific Ideas

- **Plan structure (informational — planner has latitude):**
  - Wave 1 parallel: 01 Drizzle schema, 02 Supabase migration, 03 Drizzle migration twin + journal
  - Wave 2: 04 Server Action + UI wire-up (WatchForm accordion + WatchCard sold badge + StatusToggle wire)
  - Wave 3: 05 integration test + local schema push + docs/deploy-db-setup.md §37 append + checkpoint:human-action for prod deploy

- **Migration filename:** `supabase/migrations/<14-digit>_phase37_layer_d.sql` where `<14-digit>` is strictly greater than `20260511000000` (Phase 36's filename).

- **`divestments` table DDL (D-09):**
  ```sql
  CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY');
  CREATE TYPE condition_grade AS ENUM ('mint', 'near_mint', 'excellent', 'good', 'fair', 'poor');
  CREATE TYPE box_papers_status AS ENUM ('none', 'box_only', 'papers_only', 'full_set');

  CREATE TABLE divestments (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id               uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
    user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    divested_at              timestamptz NOT NULL DEFAULT now(),
    replaced_by_catalog_id   uuid REFERENCES watches_catalog(id) ON DELETE SET NULL,
    sale_price               real,
    sale_currency            currency_code,
    notes                    text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX divestments_user_id_idx ON divestments(user_id);
  CREATE INDEX divestments_catalog_id_idx ON divestments(catalog_id);
  CREATE INDEX divestments_user_divested_at_idx ON divestments(user_id, divested_at DESC);

  ALTER TABLE divestments ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "divestments_owner_select" ON divestments FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "divestments_owner_insert" ON divestments FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "divestments_owner_update" ON divestments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "divestments_owner_delete" ON divestments FOR DELETE USING (auth.uid() = user_id);

  GRANT SELECT, INSERT, UPDATE, DELETE ON divestments TO authenticated;
  ```

- **`watches` ADD COLUMN block:**
  ```sql
  ALTER TABLE watches
    ADD COLUMN serial text,
    ADD COLUMN year_of_acquisition int,
    ADD COLUMN condition condition_grade,
    ADD COLUMN box_papers box_papers_status,
    ADD COLUMN service_history text,
    ADD COLUMN paid_currency currency_code,
    ADD COLUMN purchase_date date;
  ```

- **Drizzle schema additions (informational):**
  ```typescript
  export const conditionGradeEnum = pgEnum('condition_grade', ['mint', 'near_mint', 'excellent', 'good', 'fair', 'poor']);
  export const currencyCodeEnum = pgEnum('currency_code', ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY']);
  export const boxPapersStatusEnum = pgEnum('box_papers_status', ['none', 'box_only', 'papers_only', 'full_set']);

  // watches table additions (in existing definition):
  serial: text('serial'),
  yearOfAcquisition: integer('year_of_acquisition'),
  condition: conditionGradeEnum('condition'),
  boxPapers: boxPapersStatusEnum('box_papers'),
  serviceHistory: text('service_history'),
  paidCurrency: currencyCodeEnum('paid_currency'),
  purchaseDate: date('purchase_date'),

  // new divestments table:
  export const divestments = pgTable('divestments', { ... });
  ```

- **Server Action signature (D-11):**
  ```typescript
  export async function recordDivestment(
    watchId: string,
    data?: {
      salePrice?: number;
      saleCurrency?: CurrencyCode;
      replacedByCatalogId?: string;
      notes?: string;
    }
  ): Promise<{ ok: true; divestmentId: string } | { ok: false; error: string }>;
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Divestment dialog UI** — ROADMAP-locked deferred to v5.x. Phase 37 ships the Server Action but no UI to invoke it with rich metadata.
- **`replaced_by_catalog_id` UI capture** — depends on the deferred dialog; column ships nullable; future v5.x backfills.
- **v6.0 market-value math** — SEED-005 future; consumes Phase 37's data shape.
- **SEED-002 hybrid recommender consuming `divestments.divested_at`** — future; data shape ready in Phase 37.
- **Drizzle `watches.catalogId .notNull()` tightening** — Phase 38 owns this (Phase 36 Plan 01 Rule 4 deferral). Phase 37 inherits the nullable Drizzle definition unchanged.
- **Default filter chip selection** ("show sold by default" toggle) — D-14a deferred to Phase 39 polish or v5.x.
- **`divestments.watch_id` FK + UNIQUE on `(user_id, watch_id)`** — Phase 37 keeps `divestments` linked to `watches_catalog` (not `watches`) because the canonical relationship is collector-decoupled (cross-collector queries: "how many people have sold this Sub?"). If a future phase wants per-watch-instance 1:1 enforcement, add `watches.divestment_id` FK then.
- **Structured `service_history`** — JSON list of `{date, service_type, provider}` records. Phase 37 ships free text per D-06; future enrichment phase can parse if needed.
- **`serial` validation** — brand-specific format check (Rolex W-/K-/L-/F-/V-/M-/Z- series, Omega vintage prefix conventions). Phase 37 ships free text per D-07.
- **Soft-delete / archive for sold watches** — explicitly NOT needed per D-02 (sold watches stay in `watches` with `status='sold'`).
- **Sold-watch read-only edit page** — sold watches remain fully editable per D-14 (collectors may update provenance / notes / serial after the sale). If read-only behavior becomes desired, future polish phase can add it.

</deferred>

---

*Phase: 37-Layer D — Provenance Fields + Divestments Table*
*Context gathered: 2026-05-11*

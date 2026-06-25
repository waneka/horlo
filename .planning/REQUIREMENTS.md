# Requirements: Horlo v8.4 Catalog Brand+Model Canonicalization

**Defined:** 2026-06-24
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Milestone goal:** Wire the existing `brands` and `watch_families` FKs as the canonical identity for every `watches` + `watches_catalog` row so the recommender, add-watch flow, and future catalog-volume + market-value work all key off `brand_id` / `family_id` instead of free-text brand and model strings.

**Inputs:**
- [`SEED-021`](./seeds/SEED-021-catalog-brand-model-canonicalization.md) — surfaced 2026-06-24 from 260623-mn3 / 260623-pzz / `bfecb529` image-filter follow-up; medium scope.
- Existing schema (Phase 34): `brands` table + `watch_families` table + nullable `watches_catalog.brand_id` / `family_id` FKs already in place — work is wiring, backfill, and ingest hardening, not new schema.

## Locked Decisions

Resolved during kickoff (`/gsd-new-milestone`) on 2026-06-24:

- **D-01 — Canonical source of truth:** `brands.name` is the canonical brand string; `watch_families.name` is the canonical model/family string. `watches_catalog.brand`, `watches_catalog.model`, `watches.brand`, `watches.model` become denormalized display copies — sourced from the FK targets on every write.
- **D-02 — Display-vs-storage:** On every `addWatch` / `editWatch` / catalog upsert, the denormalized brand and model strings are auto-overwritten from the resolved `brands.name` / `watch_families.name`. The user always sees canonical display strings; no free-text drift on display surfaces.
- **D-03 — Model-canon scope:** Wire `watch_families.id` FK on `watches_catalog` and add `watch_families.aliases text[]` for typo/abbreviation cases (e.g. `Brut Date` → `Brut Datejust`). NO new `models` table — `watch_families` already plays that role (Phase 34 D-01). SEED-001's Variant + Individual layers stay future work.
- **D-04 — Backfill conflict resolution:** Operator-resolve queue at `.planning/v8.4-brand-merge-decisions.md`. Auto-map exact-normalized matches (`lower(trim(name))`); ambiguous cases (`Hamilton` vs `Hamilton Watch`, `Omega` vs `OMEGA`, `Héron` vs `Héron Watches`) queued for manual operator decision before the data migration runs.
- **D-05 — Ingest fuzzy-match-then-create:** `/api/extract-watch` looks up the extracted brand string against `brands.name_normalized` first (exact), then against `brands.name_normalized` via `pg_trgm` `similarity > 0.6` (threshold tunable); attaches the matched `brand_id` on hit; on miss, auto-creates a new `brands` row with `needs_review: true`. Same lookup path for `watch_families` (including `aliases` array). Operator periodically walks the `needs_review` queue.
- **D-06 — Recommender swap path:** Recommender exclusion key + multi-brand-match scoring read `brand_id` via JOIN through `watches.catalogId → watches_catalog.brand_id`. No new column on `watches`. Display string in rationale templates reads from joined `brands.name`, not from `watches.brand` or `watches_catalog.brand`.
- **D-07 — Operator-review surface:** `needs_review` queue surfaces in a minimal `/admin/brands` + `/admin/families` view (reusing the v5.1 admin CMS pattern from Phase 47). Operator can rename, merge into existing brand, or confirm. No CLI required.
- **D-08 — Reversibility:** Backfill migration is reversible in dry-run mode (writes proposed mappings to a `.md` artifact for operator review BEFORE the data UPDATE runs). Post-flight assertion verifies 100% FK coverage (no NULL `brand_id` on `watches_catalog`) per the post-flight-predicate lesson from `project_post_flight_assertion_predicate_divergence`.

## v8.4 Requirements

### Schema (CANON)

The brand + family FKs become canonical identity for every catalog row.

- [ ] **CANON-01**: `watches_catalog.brand_id` is `NOT NULL` after the backfill data migration completes (was nullable since Phase 34).
- [ ] **CANON-02**: `watches_catalog.family_id` is `NOT NULL` after the backfill data migration completes — every catalog row resolves to a family (one-row-per-family fallback for catalogs where no family exists yet; e.g. "Other Casio" pattern).
- [x] **CANON-03**: `watch_families.aliases text[] NOT NULL DEFAULT '{}'` column added, indexed for GIN containment lookup, populated from the operator-resolve queue for known typo/abbreviation cases.
- [x] **CANON-04**: `brands.needs_review boolean NOT NULL DEFAULT false` and `watch_families.needs_review boolean NOT NULL DEFAULT false` columns added; INSERT-from-ingest sets `true`; operator confirms via `/admin/brands` and `/admin/families` flips to `false`.

### Migration (MIG)

Data migration backfills every existing watch and catalog row to canonical brand + family.

- [ ] **MIG-01**: Backfill script (`scripts/v8.4-brand-canonicalization.ts`) generates a proposed mapping for every distinct `lower(trim(watches_catalog.brand))` value → existing `brands.id` (exact match) OR a "needs operator decision" marker (ambiguous). Output written to `.planning/v8.4-brand-merge-decisions.md` for operator review BEFORE any UPDATE runs.
- [ ] **MIG-02**: After operator approves the `.md` artifact (writes decisions inline as YAML frontmatter or per-row markers), running `scripts/v8.4-brand-canonicalization.ts --apply` executes the data UPDATE atomically: `watches_catalog.brand_id` populated, ambiguous cases resolved per operator decision, new `brands` rows created where needed.
- [ ] **MIG-03**: Equivalent `--apply` path for `watch_families` backfill — distinct `watches_catalog.model` strings mapped to `watch_families.id` (with brand-scoped uniqueness via existing `watch_families_brand_name_unique` constraint); typo cases routed into the new `aliases` column.
- [ ] **MIG-04**: Post-flight assertion (NOT reusing the same WHERE-clause as the operation — per `project_post_flight_assertion_predicate_divergence`) verifies zero rows with `brand_id IS NULL` AND zero rows with `family_id IS NULL` on `watches_catalog` AFTER the migration completes.
- [ ] **MIG-05**: Migration is portable across local Supabase + prod Supabase per `[[drizzle-supabase-db-mismatch]]` rules — uses `extensions.unaccent` / `extensions.similarity` with pinned `SET search_path` on any functions, and the migration filename + ordering follow the project's `supabase/migrations/` naming convention.

### Ingest (INGEST)

`/api/extract-watch` cannot create new drift after this milestone.

- [ ] **INGEST-01**: On extract success, `/api/extract-watch` looks up the extracted brand string against `brands.name_normalized` (exact) first; attaches the matched `brand_id` to the upserted `watches_catalog` row.
- [ ] **INGEST-02**: On exact-match miss, `/api/extract-watch` runs a `pg_trgm` `similarity > 0.6` fuzzy lookup against `brands.name_normalized`; if a single match exceeds threshold, attaches that `brand_id` and logs a structured `fuzzy_brand_match` event (no user-visible delay).
- [ ] **INGEST-03**: On fuzzy-match miss, `/api/extract-watch` auto-creates a new `brands` row with `needs_review: true` and attaches its `brand_id` to the catalog row. User flow never blocks; operator surfaces the row later via `/admin/brands`.
- [ ] **INGEST-04**: Same lookup pattern (INGEST-01 → INGEST-02 → INGEST-03) applies to model → `watch_families` resolution, with the additional step of checking `watch_families.aliases` containment (`@>`) alongside `name_normalized`.

### Recommender (RECO)

The home rail's exclusion key + multi-brand-match scoring + rationale templates read brand/family from canonical FKs.

- [ ] **RECO-01**: `getRecommendationsForViewer` exclusion key in `src/data/recommendations.ts` switches from `lower(trim(watches.brand)) | lower(trim(watches.model))` to `watches_catalog.brand_id | watches_catalog.family_id` (joined via `watches.catalogId`). `Brut Date` vs `Brut Datejust` and `Héron` vs `Héron Watches` no longer surface a user's own watch in the rail.
- [ ] **RECO-02**: `topUpFromCatalogPopularity` multi-brand match in `src/data/recommendations.ts` switches from `lower(trim(watches_catalog.brand)) IN (...)` to `brand_id IN (...)`. Multi-brand `+100` fires reliably for every owned brand regardless of free-text spelling.
- [ ] **RECO-03**: `topBrandOf` in `src/lib/recommendations.ts` operates on resolved `brand_id` (counted from joined catalog rows), not on free-text `watches.brand`. Returns canonical `brands.name` string for downstream rationale template substitution.
- [ ] **RECO-04**: Rationale templates (`Fans of {brand} love this`, `Matches your {style} collection`) read `{brand}` from joined `brands.name`, not `watches.brand` or `watches_catalog.brand`. Display drift across the rail is eliminated.

### Display (DISP)

Personal `watches` rows show canonical brand + model on every read, even for legacy free-text data.

- [ ] **DISP-01**: `addWatch` Server Action auto-overwrites the persisted `watches.brand` and `watches.model` with `brands.name` and `watch_families.name` (resolved via the canonical `catalogId`) before INSERT, regardless of what the user typed.
- [ ] **DISP-02**: `editWatch` Server Action runs the same auto-overwrite path on UPDATE — if the user edits brand/model in the WatchForm, the resolved canonical name wins on save.
- [ ] **DISP-03**: Existing `watches` rows that already point to a canonical `catalogId` get their `brand` / `model` columns auto-overwritten in a one-shot data migration alongside MIG-02/MIG-03 — no UI surface still renders stale free-text variants after v8.4 ships.

### UI (UI)

Add-watch flow surfaces a brand-picker autocomplete locked to canonical brands.

- [ ] **UI-01**: `StructuredEntryPanel` (no-URL add-watch path) Brand field becomes a typeahead autocomplete sourced from `brands.name` (cached in the existing `catalogBrands` SSR prop pipeline). User types → matching brands surface as a dropdown; selection sets `brand_id` on the eventual catalog upsert.
- [ ] **UI-02**: If user types a brand string that doesn't match any existing `brands.name` (after typing-ahead settles), a "Couldn't find that brand — add as '{typed}'" affordance appears, routing through the INGEST-03 auto-create path with `needs_review: true` on submit.
- [ ] **UI-03**: `WatchForm` (edit existing watch) renders the canonical `brands.name` / `watch_families.name` resolved from `catalogId` as read-only display strings (with an "Edit catalog mapping" admin link visible only to the watch owner) — user cannot edit brand/model into a non-canonical string after v8.4.

### Operator (OPS)

A minimal operator UI surfaces the `needs_review` queue.

- [ ] **OPS-01**: `/admin/brands` view (reusing v5.1 admin CMS pattern from Phase 47) lists all brands ordered by `needs_review DESC, name ASC`. Each `needs_review: true` row exposes three actions: confirm-as-new (flips flag), rename (edits `name`), merge-into-existing (UPDATEs all referencing catalog rows to the target `brand_id`, deletes the source row).
- [ ] **OPS-02**: `/admin/families` view mirrors OPS-01 for `watch_families`, plus an "Add alias" action that appends to the `aliases text[]` column.

## v2 Requirements (deferred)

Things considered for v8.4 but explicitly deferred:

- **CANON-V2-01**: Denormalize `brand_id` onto `watches` itself (vs JOIN-through-catalogId per D-06). Defer rationale: JOIN cost is acceptable per Phase 19.1 baselines; denormalization adds a trigger and a migration. Revisit if recommender p95 regresses.
- **CANON-V2-02**: Add a `brand_aliases text[]` column on `brands` parallel to `watch_families.aliases`. Defer rationale: brand-level typos are rarer than family-level (`Submariner` → `Sub`); brand-level fuzzy-match-then-create already covers most cases. Surface as needed.
- **MODEL-V2-01**: A separate `models` table parallel to `brands` (the original SEED-021 Q3 option). Defer rationale: `watch_families` already plays this role per Phase 34 D-01. Reconciling two tables would be net negative.
- **HIERARCHY-V2-01**: Wire SEED-001's full 5-level Brand/Family/Reference/Variant/Individual hierarchy into the recommender (`watch_variants` consumption + `watch_lineage_edges` traversal). Defer rationale: Brand + Family alone closes the SEED-021 bug surface; Variant/Individual is a separate recommender-quality push.

## Out of Scope

Explicitly excluded from v8.4:

| Feature | Reason |
|---------|--------|
| Catalog volume expansion (SEED-009) | v9.0 milestone work; v8.4 deliberately ships first so v9.0 lands on canonical foundations |
| Variant + Individual layers of SEED-001 | Brand + Family closes the SEED-021 bug surface; Variant + Individual is recommender-quality work, future milestone |
| Market-value pricing on canonical brands (SEED-005) | Future milestone after SEED-007 pricing API spike; v8.4 only delivers the canonical-FK substrate it needs |
| Brand logos / brand-detail page | Pure display polish; not on the canonicalization critical path. Plant a follow-up seed if desired |
| Cross-language brand normalization (e.g. `精工` ↔ `Seiko`) | Off-table for English-only catalog; revisit if catalog goes multilingual |
| Brand-merge undo / audit trail | One-shot operator-confirmed merges; if a wrong merge ships, fix forward via another merge. Full audit log is over-engineering for v8.4 |
| Recommender hybrid (SEED-002) — collaborative filtering on `brand_id` | Future paid-feature candidate per `[[project_monetization_stance_2026_05_06]]`; v8.4 only delivers the substrate it would consume |
| Removal of `watches.brand` / `watches.model` columns entirely | Keeps a personal-display column on personal rows for free-text edge cases (e.g. user adds a watch from a brand not yet in catalog — pre-canonical state still renders); see DISP-01/02 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CANON-01 | Phase 80 | Pending |
| CANON-02 | Phase 80 | Pending |
| CANON-03 | Phase 78 | Complete |
| CANON-04 | Phase 78 | Complete |
| MIG-01 | Phase 78 | Pending |
| MIG-02 | Phase 79 | Pending |
| MIG-03 | Phase 79 | Pending |
| MIG-04 | Phase 79 | Pending |
| MIG-05 | Phase 79 | Pending |
| INGEST-01 | Phase 80 | Pending |
| INGEST-02 | Phase 80 | Pending |
| INGEST-03 | Phase 80 | Pending |
| INGEST-04 | Phase 80 | Pending |
| RECO-01 | Phase 81 | Pending |
| RECO-02 | Phase 81 | Pending |
| RECO-03 | Phase 81 | Pending |
| RECO-04 | Phase 81 | Pending |
| DISP-01 | Phase 81 | Pending |
| DISP-02 | Phase 81 | Pending |
| DISP-03 | Phase 79 | Pending |
| UI-01 | Phase 82 | Pending |
| UI-02 | Phase 82 | Pending |
| UI-03 | Phase 82 | Pending |
| OPS-01 | Phase 82 | Pending |
| OPS-02 | Phase 82 | Pending |

**Coverage:**
- v8.4 requirements: 25 total
- Mapped to phases: 25 (100%)
- Unmapped: 0
- Phase distribution: P78 (3), P79 (5), P80 (6), P81 (6), P82 (5)

---
*Requirements defined: 2026-06-24*
*Last updated: 2026-06-25 — traceability filled by roadmapper; 25/25 requirements mapped across Phases 78-82*

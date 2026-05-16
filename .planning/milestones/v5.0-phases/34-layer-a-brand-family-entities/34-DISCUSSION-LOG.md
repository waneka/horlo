# Phase 34: Layer A — Brand + Family Entities - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 34-layer-a-brand-family-entities
**Areas discussed:** Table column shape, FK ON DELETE semantics, Backfill source & seed strategy, watches_catalog.brand text retention

---

## Pre-Discussion Locks (carried forward, not re-asked)

- **Phase 33b Q2 verdict (DEFERRED):** lineage browse UI is NOT in Phase 34 or Phase 35. Phase 34 ships schema-only.
- **No admin UI in Phase 34** — locked by ROADMAP success #4.
- **Backfill is a service-role script, not an automated migration** — locked by ROADMAP success #4.
- **Three-step migration discipline (nullable add → backfill → NOT NULL flip)** — locked by ROADMAP success #5; NOT NULL flip explicitly deferred.
- **DB migration rules** — `supabase db push --linked` for prod; 14-digit filename; co-locate RLS in same migration; pg_depend check before structural changes.
- **Phase 17 patterns** — GENERATED `*_normalized`; UNIQUE NULLS NOT DISTINCT natural-key index; service-role-only writes via RLS; Drizzle vs Supabase migration split.

---

## Area 1: Table column shape

**Initial frame (rejected by user — wanted clarification):** Minimal+ vs Minimal vs Rich vs Rich + parent_brand_id. User asked what "rich" means concretely with examples and whether it could be leveraged eventually.

**Reframed:** After Claude explained each candidate column with concrete future-leverage scenarios, user locked in `country_of_origin` and asked for a reframe.

| Option | Description | Selected |
|--------|-------------|----------|
| Just country_of_origin | brands: id, name, name_normalized, slug, country_of_origin, timestamps. watch_families: id, brand_id FK, name, name_normalized, slug, timestamps. Defer all other rich cols. | ✓ |
| + founding_year | Adds brands.founding_year integer. ~30-50 brands need a year backfilled. | |
| + founding_year + logo_url | Above plus brands.logo_url text. Requires asset sourcing (~30-50 SVG logos). | |
| + founding_year + logo_url + family era cols | Above plus watch_families.era_start, era_end. Closer to Phase 35/39 needs. Risk: families empty until Phase 35. | |

**User's choice:** Just country_of_origin (Recommended).
**Notes:** User explicitly named `country_of_origin` as required even without v5.0 UI consumer. Reasoning was future-leverage acceptable. Other rich cols are additive `ALTER TABLE` candidates for whatever phase actually needs them.

---

## Area 2: FK ON DELETE semantics

| Option | Description | Selected |
|--------|-------------|----------|
| RESTRICT | Postgres blocks delete if any catalog row still references the brand/family. Forces explicit re-link before deletion. Catches manual-curation mistakes loudly. | ✓ |
| SET NULL | Mirrors watches.catalog_id pattern. Auto-nulls catalog FK on brand/family delete. Loses orphan-detect signal. | |
| Mixed: brands RESTRICT, families SET NULL | Asymmetric — brand identity matters more. Trade-off: two policies to remember. | |

**User's choice:** RESTRICT (Recommended).
**Notes:** No app flow deletes brands/families (no admin UI). All deletes are service-role manual tooling. RESTRICT is the safer guard for the manual curation phase. `watches.catalog_id` SET NULL is intentionally different because Phase 36 plans clean-slate wipe; brands/families have no analogous wipe.

---

## Area 3: Backfill source & seed strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid brands + run; families empty | Auto-derive brands from DISTINCT brand_normalized; manual country patch. Run in Phase 34. Families empty; family seeding deferred to Phase 35. | ✓ |
| Hybrid brands only, script ships unrun | Same hybrid logic but Phase 34 does NOT run the script in prod. Phase 35 inherits the running-it work. | |
| Auto-derive brands + auto-extract families | Adds heuristic family extraction from model text. Risk: heuristic noise becomes data debt. | |
| Hand-curated brands seed list | User authors literal brand list in TS (~30-50 rows). Higher fidelity but slower; misses any brand not on the list. | |

**User's choice:** Hybrid brands + run; families empty (Recommended).
**Notes:** Brands have a clean existing source (DISTINCT `brand_normalized`). Families have no source and require manual curation regardless. Folding family seeding into Phase 34 doubles work for no Phase 34 deliverable. Running the backfill in Phase 34 (vs ship-script-only) gives Phase 35 real `brand_id` data to query against.

---

## Area 4: watches_catalog.brand text retention

| Option | Description | Selected |
|--------|-------------|----------|
| Permanent denormalization | brand text + brand_id FK both stay forever. brand_normalized GENERATED stays load-bearing for natural-key UNIQUE index. CAT-13 reads brand text directly. | ✓ |
| Defer drop to Phase 36 clean-slate | Phase 34 keeps brand text; Phase 36 absorbs the column-drop work + DAL JOIN rewrite. | |
| Defer drop to a later v5.x / v6 phase | No specific phase commitment. Most flexible, least committal. | |

**User's choice:** Permanent denormalization (Recommended).
**Notes:** ROADMAP success #2 already locks "all existing DAL queries return correct results without modification" — dropping in Phase 34 is off the table. The real question was the long-term plan. Permanent denormalization preserves the natural-key UNIQUE + 31 DAL refs without rewrite work and accepts the small storage cost.

---

## Claude's Discretion

None. User selected the recommended option on all 4 areas. Decisions D-05 (three-step migration discipline) and D-06 (deploy runbook update) are derived from ROADMAP success criteria #3 and #5, not free choice.

---

## Deferred Ideas

See CONTEXT.md `<deferred>` section — 11 items captured (rich brand cols, rich family cols, watch_families seeding, NOT NULL flip, brand text drop, family auto-extract, hand-curated brand list, admin UI, browse pages, denormalized counts, GIN trigram indexes).

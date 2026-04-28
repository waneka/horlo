---
id: SEED-001
status: dormant
planted: 2026-04-27
planted_during: v4.0 / Phase 18
trigger_when: planning a milestone that touches catalog model, recommender, or search facets — specifically when adding lineage/successor relations, family/brand entities, or richer structured attributes
scope: large
related_phases: [Phase 17 (catalog foundation, shipped), Phase 18 (/explore — uses watchesCatalog as-is), Phase 20 (/evaluate?catalogId=), future recommender milestone]
---

# SEED-001: Catalog hierarchy — Brand / Family / Reference / Variant / Individual

## The Idea

The current `watches_catalog` is a flat table keyed (effectively) by `(brand_normalized, model_normalized, reference_normalized)`. The proposed model is a 5-level hierarchy:

```
Brand
  └── Family            (Submariner, Royal Oak, Speedmaster)
        └── Reference   (16610, 15202ST, 145.022)
              └── Variant   (dial color, bezel, bracelet config, year range)
                    └── Individual   (a specific watch a user owns: serial/photos/provenance)
```

**Reference is the canonical unit for the social graph and recommender.** Not Variant, not Individual. Otherwise the taste graph fragments across "blue dial 16610" vs "black dial 16610" when they're the same taste signal.

## Why This Matters

- **Recommender quality**: A Reference-level taste graph carries strong collaborative-filtering signal. Variant-level fragments it, Individual-level destroys it. Right granularity = tractable downstream.
- **Lineage discovery**: 5513 → 1680 → 16800 → 16610 → 116610 is a real edge in collector consciousness. Modeling it as graph edges between References unlocks "if you like this, you might like its predecessor" without ML.
- **Search & filter facets**: Structured attributes (case size, movement caliber + type, complications, water resistance, lug-to-lug, case material, crystal, country of origin, era/decade, price tier) power both filtering UX and the content-based side of the recommender. Free-text/tag-only loses precision.
- **Provenance signal**: Per-Individual fields (serial, year, box/papers, service history, condition notes, private purchase price) make the "sold" signal meaningful later — it's specifically *that* Individual leaving *that* user's collection, not just an abstract reference being de-listed.

## Current State (as of Phase 17/18)

Already in `watches_catalog`:
- Brand (text), model (text), reference (text, nullable) — flat
- caseSize, lugToLug, waterResistance, crystalType, dialColor, isChronometer, productionYear, movement (free text)
- styleTags, designTraits, roleTags, complications (text arrays)

**Implicit: catalog rows ARE at the Reference level today** (dial color is a column, not a separate row), so Phase 18's Trending sort on `watches_catalog` aggregates Reference-level signal correctly. Good baseline.

**Gaps vs proposed model:**
- No Family or Brand entities (just normalized strings)
- No lineage/successor edges between References
- No Variant table — variants today are squashed into Reference rows (a Submariner "16610LV Kermit" likely has its own row distinct from "16610 black", which IS variant-level fragmentation creeping in)
- No Individual table — `watches` table is per-user-instance but lacks provenance fields (serial, box/papers, service history, condition, purchase price)
- Movement is free-text — needs structured `(caliber, type)` where type ∈ {auto, manual, quartz, spring_drive}
- No era/decade, country_of_origin, case_material, bracelet_config, price_tier as first-class

## When to Surface

**Trigger:** When planning a milestone that proposes any of:
- A real recommender (collaborative filtering, content-based embeddings, or hybrid)
- Lineage browse / "see predecessors" UX
- Family-level browse (e.g., "all Submariners")
- Search facets beyond brand/model/style tags
- Provenance UX (sold signal, service history, year-of-acquisition)

Likely milestones: v5.0+ (recommender + social graph maturity), or any "watch detail page deepens" effort.

## Scope Estimate

**Large** — this is a schema migration touching catalog, watches, and any DAL that reads them. Plan for:
- New tables: `brands`, `watch_families`, `watch_variants`, `watch_lineage_edges`
- Refactor: `watches_catalog.brand` → `brand_id`, add `family_id`; split Variant fields off Reference rows
- Backfill migration from current flat catalog (manual curation needed for Family assignment)
- DAL rewrite for everything that joins on catalog
- The user's preferred path is **incremental**: introduce `brands` and `watch_families` first as nullable additive columns, backfill, then split Variants.

## Seeding Strategy (from the conversation)

> "Start with ~500 references covering the canonical collector landscape (the usual suspects across Rolex, Omega, AP, Patek, JLC, Grand Seiko, Tudor, plus 30-40 indies and micros), then expand. WatchBase and Watch Wiki are reference points for structure, but you'll want to curate manually for quality. Don't try to be comprehensive on day one — be correct on a focused slice."

## Breadcrumbs

- `src/db/schema.ts` lines 276–326 — current `watchesCatalog` definition
- `src/db/schema.ts` lines 331+ — `watchesCatalogDailySnapshots` (snapshot model survives a hierarchy refactor unchanged — keep keying on catalog_id)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — Phase 17 catalog decisions (CAT-09 denormalized counts, CAT-11 source-of-truth rules, CAT-12 daily snapshots)
- `src/data/catalog.ts` — DAL surface that would need rewrite
- `src/lib/similarity.ts` — current insight engine; structured attributes feed this directly

## Notes

- **Does not block Phase 18.** Phase 18 ships with the current flat catalog and is correct against today's model. The Trending sort `owners_count + wishlist_count * 0.5` aggregates at Reference granularity already (because dial color is a column on the row), so the social signal is right.
- **Watch out for Variant creep**: as catalog grows via user-promoted entries (Phase 17 `source = 'user_promoted'`), the same Reference can be ingested twice with slightly different model strings (e.g., "Submariner Date" vs "Submariner Date 16610"). Dedup discipline matters more than ever once the recommender is live, because every duplicate Reference row fragments the taste graph.
- **Negative signals in the same table** — a future "sold" event is an Individual-level signal, not a Reference-level one. Keep the recommender's signal-extraction layer aware of which level each event lives at.

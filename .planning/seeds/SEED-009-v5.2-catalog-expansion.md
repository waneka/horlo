---
id: SEED-009
status: dormant
planted: 2026-05-16
planted_during: 2026-05-16 bug/feature triage review — "enrich then expand" catalog-data decision
trigger_when: starting milestone v5.2, after v5.1 closes. Also surface if any phase proposes a large catalog data import or external catalog sourcing.
scope: large
related_phases: [v5.0 catalog bootstrap (scripts/seed-bootstrap-2026-05-13.sql, 100 rows), v5.1 catalog enrichment phase (SEED-008 "Additional v5.1 Scope"), SEED-001 catalog hierarchy]
---

# SEED-009: v5.2 Catalog Expansion — grow catalog breadth past the bootstrap

## The Idea

v5.2 is the **"expand"** half of an enrich-then-expand catalog-data decision (the "enrich" half is a v5.1 phase — see SEED-008). v5.1 makes the *existing* ~100 `watches_catalog` rows complete and well-formed; v5.2 grows the catalog **breadth** well past that bootstrap so search, browse, and downstream features have real depth to work with.

Scope to settle during roadmapping:
- **Breadth target** — how many references, across which brands/families. v5.0 deliberately shipped no pre-seeded ~500-reference editorial catalog (organic-growth stance); v5.2 revisits that.
- **Photo coverage** — every catalog row should have a usable image. Sourcing + hosting + transformation strategy.
- **Sourcing approach** — curated authored seed vs external dataset/API vs LLM-assisted generation vs a mix. The 2026-05-16 triage chose "enrich then expand" but did not lock the *expand* sourcing method; that is a roadmap-time (or `/gsd-spike`) decision.

## Why This Matters

- **Search and Browse are only as good as the catalog.** v5.1's `/explore` Browse module (brand/era/genre/price-band indices) and the `/search` facets surface catalog data directly. A thin catalog makes both feel empty.
- **Gates the Add-Watch Redesign (SEED-010 / v5.3).** A search-first add flow is pointless against a sparse catalog — the user searches and finds nothing. v5.2 must land before v5.3.
- **Gates v6.0 Market Value (SEED-005).** Market pricing needs catalog references to price against and to identity-match to external APIs. More catalog depth = more of the user's collection gets real market data.

## When to Surface

**Trigger:** `/gsd-new-milestone` for v5.2, OR any phase proposing a bulk catalog import / external catalog sourcing.

**Hard prerequisites before v5.2 locks:**
1. v5.1 ships (catalog enrichment phase complete — the existing 100 rows are clean before breadth is added).
2. Sourcing-method decision (curated / external / LLM-assisted / mix) — likely a short `/gsd-spike`.

## Open Questions

- Breadth target — does v5.2 reverse the v5.0 "organic growth only" stance? By how much (a few hundred references? a curated ~500?).
- Sourcing — authored seed, external dataset/API, LLM-assisted, or a blend? Cost, licensing, and data-quality tradeoffs differ sharply.
- Photo sourcing + hosting + transformation — where do images come from, and where do they live (Supabase Storage bucket, CDN)?
- Identity dedup — expansion must not create duplicate references against the existing 100 rows or `user_promoted` entries. Normalization rules (`brandNormalized` / `modelNormalized` / `referenceNormalized` generated columns) help; confirm coverage.
- Catalog hierarchy fit — new rows must slot into the Layer A/B/C structure (`brands`, `watch_families`, `watch_lineage_edges`). Does bulk expansion need a families/lineage backfill pass too?

## Breadcrumbs

- `scripts/seed-bootstrap-2026-05-13.sql` — the v5.0 100-row / 11-brand / 32-family / 52-edge bootstrap; the pattern v5.2 expansion extends.
- `scripts/watch-seed-data.md` — the human-readable seed source the bootstrap SQL was generated from.
- `scripts/backfill-catalog*.ts`, `scripts/seed-lineage.ts` — existing catalog/brand/family/lineage backfill scripts.
- `.planning/PROJECT.md` "Standing context" — the original "catalog seeding is organic" stance that v5.2 revisits.
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — catalog hierarchy/attribute model expansion must respect.
- `src/db/schema.ts` `watches_catalog` — target table; note GENERATED normalized columns and denormalized `ownersCount` / `wishlistCount`.

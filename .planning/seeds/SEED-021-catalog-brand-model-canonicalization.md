---
id: SEED-021
status: dormant
planted: 2026-06-24
planted_during: 2026-06-23/24 home-rail iteration on quick tasks 260623-mn3, 260623-pzz, and the bfecb529 image-filter follow-up. Two prod bugs traced back to the same root cause (free-text brand/model strings vs catalog canonical strings); we routed around the symptoms but the underlying canonicalization is unaddressed.
trigger_when: any future home-rail / recommender phase that needs strong viewer↔catalog linking, OR a /gsd-new-milestone explicitly scoped to catalog hygiene, OR when SEED-010 (search-first add-watch) is picked up (it depends on canonical brand/model strings to surface accurate matches).
scope: medium (data migration + ingest hardening + a recommender swap to use the FK + a UI brand-picker on add-watch)
related_phases: [SEED-009 v5.2 Catalog Expansion (data-volume work), SEED-010 v8.0 Add-Watch Redesign (search-first add — depends on canonical strings for accurate matching), quick task 260623-pzz (surfaced both bugs)]
---

# SEED-021: Catalog brand + model canonicalization

## The Idea

User-facing `watches.brand` and `watches.model` are **free-text** today, while `watches_catalog.brand` and `watches_catalog.model` carry **canonical strings** that may differ from what users actually type. The two strings are matched by `lower(trim(...))` equality in several places (most visibly the home rail's exclusion key and the multi-brand-match scoring), which silently misses any string that diverges by suffix, punctuation, or word order.

Real examples surfaced during home-rail iteration (2026-06-23):

| User typed | Catalog has | Consequence |
|---|---|---|
| `Héron` | `Héron Watches` | Multi-brand `+100` never fires for Héron — the owned-brand SET miss |
| `Hamilton` | `Hamilton Watch` | Same — also splits the catalog (1 "Hamilton" row + many "Hamilton Watch" rows) |
| `Brut Date` | `Brut Datejust` | Exclusion key `brut\|date` ≠ `brut\|datejust` → user's own watch surfaces in the rail with the wrong model name |
| `Omega` (catalog) | `OMEGA` (catalog) | Catalog has the same brand in two casings — different normalized values, two separate "brands" to downstream consumers |

The schema already has the right pieces to solve this — they're just **not wired up to the recommender**:

- `watches_catalog.brand_normalized` — GENERATED column (lowercased, trimmed)
- `watches_catalog.brand_id` — FK to a `brands` table (canonical-brand lookup)
- `watches_catalog.family_id` — FK to a `watch_families` table (sub-brand grouping)
- The natural-key UNIQUE constraint already uses the normalized columns

The recommender (`src/data/recommendations.ts`) still string-matches on the raw `brand` column. The add-watch flow (`src/app/api/extract-watch`) writes the raw brand the user/LLM produces, without consulting the `brands` table.

## Why This Matters

- **Recommender accuracy.** Today's home rail silently misses every owned-brand whose user-typed string doesn't match the catalog string verbatim. The work to fix it has been "filter around the symptom" (image-URL filter, quick rationale tweaks). Each new symptom is a separate quick task. The underlying mismatch keeps re-surfacing.
- **Catalog data quality.** Free-text on add means every new user's spelling becomes a new catalog row. Drift accumulates. Operator hygiene work (de-duping by hand, normalizing on ingest) is intermittent and unverifiable.
- **Search-first add (SEED-010) is gated on this.** "Search the catalog" only works if "Hamilton" and "Hamilton Watch" resolve to the same brand. Without canonicalization, the search-first flow ships with a confusing matching experience and undermines its own premise.
- **Future cross-user signal (SEED-002 hybrid recommender, SEED-005 market value).** Both depend on rolling up data per canonical brand+model. The recommender can't compute "X users own this watch" reliably when "this watch" exists under two different brand strings.

## When to Surface

**Trigger:** `/gsd-new-milestone` for catalog hygiene, OR any phase that:
- proposes substantial home-rail / recommender accuracy work
- starts on SEED-010 (search-first add)
- backfills any data signal across watches (market price, ownership rollups, etc.)

**Prerequisite for:** SEED-010 (search-first add benefits massively from canonical strings), SEED-002 (hybrid recommender needs reliable brand/model rollups).

**Not blocked by:** anything currently — schema is already in place; the work is data + DAL + UI rewiring.

## Open Questions

- **Canonical source of truth for brand strings.** Adopt `brands.name` as canon (and treat `watches.brand` as a denormalized display copy with `brand_id` FK as the link)? Or migrate `watches_catalog.brand` to always match `brands.name` and treat the FK as documentation only?
- **Backfill strategy.** Map every existing `watches.brand` and `watches_catalog.brand` to a `brand_id`. Includes:
  - Auto-mapping the obvious cases (`lower(trim(...))` exact match against `brands.normalized_name`)
  - Operator-resolving the ambiguous cases (`Hamilton` vs `Hamilton Watch` — same? merge?)
  - A "needs review" queue for truly unmappable rows
- **Model-name canonicalization** — separate-but-related (`Brut Date` vs `Brut Datejust`). Add a `models` table parallel to `brands`? Or rely on `watch_families` + reference numbers (most authoritative when present)?
- **Ingest behavior.** When `/api/extract-watch` produces a new `brand` string that doesn't match any existing `brands.normalized_name`, do we:
  - Auto-create a new `brands` row (drift accumulates)?
  - Match to the nearest existing brand via fuzzy match (could mis-attribute)?
  - Block + surface to operator for manual mapping (slows ingest)?
- **Display vs storage.** Once `brand_id` is canonical, do we still let users edit `watches.brand` as free-text (for personal-collection display)? Or auto-overwrite from `brands.name` on save?
- **UI on add-watch.** Brand-picker autocomplete that locks to `brands.name` (and offers "request new brand" for misses)? Or keep free-text but show a "Did you mean …?" suggestion when typing partially matches an existing brand?
- **Recommender swap.** Once `brand_id` is reliable, the exclusion key + multi-brand-match scoring switch from `lower(brand)` to `brand_id`. Same for the `topBrandOf` / `dominantStyleOf` derivations. Estimate: ~50 LOC change.

## Breadcrumbs

- `src/data/recommendations.ts` — `topUpFromCatalogPopularity` (multi-brand match), `getRecommendationsForViewer` (exclusion key). Both use `lower(trim(brand))`.
- `src/lib/recommendations.ts` — `topBrandOf`, `dominantStyleOf` (free-text brand string aggregation).
- `src/db/schema.ts` — `watches_catalog.brand_normalized` (GENERATED), `brandId`, `familyId`, `brands` table.
- `src/app/api/extract-watch/route.ts` — catalog ingest path; writes raw extracted brand/model.
- `src/components/watch/AddWatchFlow.tsx` + `WatchForm.tsx` — UI surfaces where users type/edit brand+model.
- `project_catalog-id-divergence.md` (memory) — related: catalog ids differ between local + prod because the seed omits id; canonicalization would let cross-DB migrations key by canonical brand/model instead.
- Past memory `project_local_catalog_natural_key_drift.md` — natural-key constraint also depends on normalized columns being correct.
- The 260623-mn3 / 260623-pzz quick tasks (and bfecb529 image-filter follow-up) — each is a route-around of the underlying canonicalization gap.

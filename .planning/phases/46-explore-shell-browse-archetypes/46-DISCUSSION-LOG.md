# Phase 46: Explore Shell + Browse + Archetypes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 46-explore-shell-browse-archetypes
**Areas discussed:** Old /explore fate, Browse module layout, Prefiltered results target, Archetypes + taxonomy

---

## Old /explore fate

### Q1 — Disposition of the 3 Phase 18 rails

| Option | Description | Selected |
|--------|-------------|----------|
| Retire entirely | Delete the 3 rail components + DAL readers; Explore is editorial/structural with 5 modules, none a trending rail | ✓ |
| Move global rails to Home | Trending + Gaining Traction relocate to Home; retire Popular Collectors | |
| Keep behind a sub-route | Park old rails at /explore/trending | |

**User's choice:** Retire entirely

### Q2 — The Phase 18 sparse-network welcome hero

| Option | Description | Selected |
|--------|-------------|----------|
| Retire it | New /explore has its own editorial Hero (Phase 47); two heroes is incoherent | ✓ |
| Keep as a fallback | Render sparse-network hero when no editorial Hero content exists | |

**User's choice:** Retire it

**Notes:** The `/explore/collectors` and `/explore/watches` see-all routes that fed the old rails are also retired (captured as D-03). Planner flagged to check Home for shared discovery components before deleting (D-04).

---

## Browse module layout

### Q1 — How the Browse module presents its 4 indices

| Option | Description | Selected |
|--------|-------------|----------|
| 4 entry tiles → full index pages | Compact tiles on /explore → dedicated /explore/brands etc. pages | ✓ |
| Short lists inline, Brands routed | Eras/Genres/Price-bands inline; only Brands routed | |
| All 4 fully inline | Every index inline on /explore | |

**User's choice:** 4 entry tiles → full index pages

### Q2 — A–Z jump navigation placement

| Option | Description | Selected |
|--------|-------------|----------|
| On the full Brands page | A–Z bar on /explore/brands alongside the full list | ✓ |
| Inline in the Browse module | A–Z bar within the Browse module on /explore | |

**User's choice:** On the full Brands page

**Notes:** Mid-area, the user paused to ask for a full top-to-bottom recap of the Explore page composition before answering — provided, then questions re-asked unchanged.

---

## Prefiltered results target

### Q1 — What the prefiltered /search view feels like

| Option | Description | Selected |
|--------|-------------|----------|
| Composable filter — refinable | Normal /search Watches tab, facet as a removable filter chip; user can refine | ✓ |
| Focused results view | Cleaner category-page landing; facet fixed, search box hidden | |

**User's choice:** Composable filter — refinable

### Q2 — Archetype editorial header content

| Option | Description | Selected |
|--------|-------------|----------|
| Name + one-line description | Archetype title + a short editorial sentence | |
| Name + description + count | Adds a result-count line | ✓ |
| Name only | Just the archetype title, no editorial copy | |

**User's choice:** Name + description + count

---

## Archetypes + taxonomy

### Q1 — How archetype chips map to catalog data

| Option | Description | Selected |
|--------|-------------|----------|
| 1 chip = 1 catalog facet | Each chip maps to a single primary_archetype value + config name/description | ✓ |
| Composite identity filters | 8 hand-authored archetypes combining columns (era, brand country, style) | |

**User's choice:** 1 chip = 1 catalog facet

### Q2 — Browse Eras index data source

| Option | Description | Selected |
|--------|-------------|----------|
| eraSignal (3 buckets) | Vintage-leaning / Modern / Contemporary — fully enriched | ✓ |
| era decades (13 buckets) | 1900-1910 ... 2020-2030 — granular but sparsely populated | |
| Both as separate sub-sections | era-signal + decade buckets on one page | |

**User's choice:** eraSignal — but only due to lack of vintage data right now. Logged as a TODO: revisit to the decade-based index when the catalog has a fuller vintage data set.

### Q3 — Browse Genres index data source

| Option | Description | Selected |
|--------|-------------|----------|
| primary_archetype | 10 functional categories, one value per watch → clean counts | ✓ |
| styleTags | 8 style tags, multi-value array | |

**User's choice:** primary_archetype

### Q4 — Price-bands index data source

| Option | Description | Selected |
|--------|-------------|----------|
| Add a human-reviewed price column | New nullable price column populated via a Phase-44-style review flow | |
| Defer Price-bands index to v6.0 | Ship 3 of 4 Browse indices; price-bands waits for v6.0 market_prices | ✓ |
| Derive from owned-watch prices | Aggregate per-user watches prices by catalog_id — thin coverage | |

**User's choice:** Defer Price-bands index to v6.0

### Q5 (follow-up) — Archetype chip count (8 vs 10)

| Option | Description | Selected |
|--------|-------------|----------|
| All 10 — one per vocab value | Rail shows all 10 primary_archetype values; roadmap "8" treated as stale (Phase 44 D-16) | ✓ |
| Curate to 8 | Drop/merge 2 of the 10 | |

**User's choice:** All 10 — one per vocab value. Roadmap criterion #4 and EXPL-05 amended 8 → 10.

---

## Claude's Discretion

- Desktop responsive grid layout for the 5 modules (side-by-side vs full-width).
- Whether the Browse module shows 3 tiles or a disabled 4th Price-bands tile.
- Cache tag names and `cacheLife` windows for Browse counts.
- How the three Phase-47 editorial module slots render in Phase 46 (hidden vs placeholder).
- Route segment naming and `/search` facet query-param naming.
- Display names + descriptions for the 10 archetype chips (editorial content, owner finalizes at planning).

## Deferred Ideas

- **Price-bands Browse index → v6.0 Market Value (SEED-005)** — no catalog price column today; v6.0 adds `market_prices` keyed on `catalog_id`. EXPL-03's price-band clause dropped from Phase 46.
- **Eras index by decade — TODO** — ships on `eraSignal` (3 buckets) for now; revisit to the 13-bucket `era` decade enum when the catalog has fuller vintage data (e.g. post-v5.2 catalog expansion).

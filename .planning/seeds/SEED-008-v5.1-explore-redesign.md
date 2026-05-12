---
id: SEED-008
status: active
planted: 2026-05-12
planted_during: Phase 39 discuss-phase — DISC-09 reframed from a single editorial slot into a 5-module Explore redesign; promoted to its own milestone
trigger_when: AFTER v5.0 closes — v5.1 milestone scope. Phase 39's original DISC-09 slot is superseded by this spec.
scope: large
related_phases: [v5.0 Phase 39 (DISC-09 dropped; this seed replaces it), v5.1 (this seed IS the milestone scope)]
supersedes:
  - DISC-09 (REQUIREMENTS.md §Audit-Driven Discovery Polish) — original "single editorial slot, hardcoded ref + blurb" framing is replaced by the Hero module below, which sources from the Curated Lists Rail rather than a hardcoded constant
---

# SEED-008: v5.1 Explore Page Redesign — Editorial / Structured / Taste-Driven Rabbit Hole

## Product Framing

> Home = the daily check-in. Recency-driven, personal, social graph in motion. The reason to come back every day.
>
> Explore = the rabbit hole. Evergreen, structured, taste-driven. The reason to spend 40 minutes on a Sunday afternoon.

This framing is sharper than Phase 33b Q1's "complementary, not redundant" verdict but lands at the same answer. Home and Explore have different ranking, freshness, and pacing requirements; keeping them separate is a deliberate product decision.

## Purpose

A top-level surface for **evergreen, taste-driven discovery** — distinct from Home, which serves daily recency-driven social-graph activity.

## Success Conditions

- A user with zero follows finds at least 3 meaningful entry points within 10 seconds of landing on `/explore`.
- A user can traverse from `/explore` → reference detail → curated list → another reference in 3 taps without dead ends.
- Every module has a clear answer to "why is this here, and why should the user tap it?"
- Baseline content stays current for at least 7 days without admin intervention.
- Modules with missing data degrade gracefully — never empty.

## Out of Scope

- Personalization based on the viewing user's collection (Home's job — `CollectorsLikeYou`, `PersonalInsightsGrid`).
- Search UI (global header peer, not an Explore module).
- Marketplace, listings, or transactional surfaces.
- UGC list submission. Revisit when ~500 active users and ~50 quality user-authored lists exist.

## Page Composition

Top to bottom on mobile (stacked), responsive grid on desktop:

1. **Hero** — single rotating editorial feature
2. **Collector Archetypes** — chip rail
3. **Curated Lists Rail** — horizontally scrollable, editorial only
4. **Where Collections Go** — collection paths
5. **Browse the Catalog** — brand / era / genre / price band indices

Order is intentional: hero earns attention, archetypes provide the broadest mental-model entry, curated lists deliver editorial voice, paths provide a differentiated discovery primitive, browse serves high-intent users who scrolled past curation.

## Modules

### Hero

Single rotating spotlight that draws from existing on-page content. Sets the page's first impression without ongoing editorial work — the taste signal comes from the underlying content, not from hero-specific writing.

**Source:** Auto-selected from published curated lists. Featured collector is a planned secondary format; data shape must accept both from the start.

**Behavior:**
- Renders one featured item per page load.
- Auto-rotates on a weekly cadence. Default selection rule: most recently published curated list from a quality-gated pool (minimum watch count, has cover image, has intro copy).
- Admin can manually pin a specific list to override auto-selection.
- Tap-through goes to the underlying item's detail page (list detail page for featured lists; collector profile for featured collectors).
- Visually distinct from the rail below: full-bleed image, larger type, no rail-card framing.

**Acceptance:**
- Hero renders correctly when at least one quality-gated list exists.
- Hero hides itself gracefully (module absent, not empty) if no eligible content exists.
- Manual pin can be set, cleared, and overrides auto-selection while active.
- Data shape (`HeroFeature`) accepts both `featured_list` and `featured_collector` formats via discriminated union on `format` — even though only `featured_list` is wired up initially.
- LCP < 2.5s on 4G.
- Loading skeleton and error state present.

---

### Collector Archetypes

Identity-based catalog entry points ("I'm a dive watch person").

**Source:** Hardcoded archetype config. Six to eight archetypes:
- Vintage enthusiast
- Modern sport
- Dive watch devotee
- Dress watch aficionado
- Microbrand explorer
- Swiss purist
- *Two more TBD*

**Behavior:**
- Tap an archetype → prefilled search results page with the archetype's filter applied and a short editorial header.
- Archetype-to-filter mappings live in config (no admin UI).

**Acceptance:**
- All archetypes render without horizontal overflow on mobile.
- Every archetype produces a non-empty results page (validate at build time).
- Archetype-specific header copy renders above results.
- Shareable via URL (filter state in query string).

---

### Curated Lists Rail

Editorial themed lists. The Hodinkee-but-actually-useful play.

**Source:** Admin-authored via CMS.

**Behavior:**
- Horizontally scrollable rail on mobile; grid on desktop.
- Each card shows: cover image, list title, curator name, watch count, optional 1-line description.
- Tap → list detail page with intro copy and per-item commentary.
- Rail shows up to 12 most-recent lists; "View all" links to `/explore/lists`.

**Acceptance:**
- List can be authored, published, and unpublished.
- A list with zero watches cannot be published.
- Rail renders correctly with 1, 5, and 12 lists. Empty state hides the module.
- Per-watch commentary is distinct from the watch's own reference page.

---

### Where Collections Go

Emergent patterns in how collections evolve. "If you own X, collectors often add Y next." One of the differentiated discovery primitives.

**Source:** Hand-curated seed paths to start — roughly 10 seed references × 3-4 follow-on watches each. Data model must support later transition to computed paths.

**Behavior:**
- Module displays 3 paths at a time, rotated server-side per session.
- Each path renders as a horizontal sequence: `[seed watch] → [next 1] → [next 2] → [next 3]`.
- Tap any watch → reference detail page.
- "Explore all paths" links to `/explore/paths`.

**Acceptance:**
- Data model has a `source` field (`manual` | `computed`).
- Path display renders correctly down to 360px wide (consider stacking on narrow screens).
- A path with a deleted or unpublished reference does not break the page.
- Visually distinct from curated lists.

---

### Browse the Catalog

Utility entry points for users with specific intent. Highest-conversion-to-detail-page traffic source.

**Source:** Generated from catalog data. No editorial.

**Behavior:**
- Four index pages: **Brands**, **Eras**, **Genres**, **Price bands**.
- Each shows groupings with counts (e.g., "Rolex (42)", "Omega (28)").
- Tap a grouping → search results filtered by that facet.
- Independently routable: `/explore/brands`, `/explore/eras`, etc.

**Acceptance:**
- All four indices render correctly with the current catalog.
- Counts are accurate; cache invalidation strategy decided during planning.
- Empty groupings are hidden.

---

## Implementation Order

The page shell is a hard prerequisite. Beyond that, suggested order — reshuffle if dependencies dictate:

1. **Page shell** — `/explore` route, responsive layout grid, nav integration, placeholder slots for all five modules.
2. **Browse the Catalog** — most utility-shaped; validates catalog faceting.
3. **Collector Archetypes** — requires search results page to accept an archetype header slot.
4. **Curated Lists Rail** — requires CMS decision and list data model. Must exist before Hero.
5. **Hero** — pulls from published curated lists; requires the quality-gating rules and the auto-rotation logic.
6. **Where Collections Go** — requires path data model and seed content.

## Open Questions

- Final two archetype names.
- CMS approach for curated lists: minimal in-app admin route, or third-party (Sanity, Contentlayer, etc.)?
- Hero quality-gating thresholds: minimum watch count for an eligible list, image dimension requirements, intro copy length minimum.
- Hero rotation cadence: strict weekly cron, or "oldest eligible item not shown in last N weeks"?
- Era taxonomy: by decade, by named era (neo-vintage, modern, etc.), or both as cross-cutting facets?
- Price band ranges: fixed buckets, or dynamic quantiles based on catalog distribution?
- Caching strategy for catalog-derived counts in Browse indices: static at build, ISR, or live?
- Image hosting and transformation for hero.

## Non-Goals

- No personalization — two different logged-in users see roughly the same page (modulo hero rotation timing).
- No algorithmic ranking — all ordering is editorial or structural.
- Not for new releases or news — those belong on Home or a future News surface.

---

## v5.0 → v5.1 Hand-off Notes

- **DISC-09 in REQUIREMENTS.md** (Phase 39 single editorial slot, hardcoded const + blurb) is **superseded** by the Hero module in this seed. Phase 39 ships **without** DISC-09 — the throwaway hardcoded-ref slot would be replaced as soon as Curated Lists machinery lands.
- **Phase 33b Q1 verdict** (NO — keep home and explore distinct) is the load-bearing audit anchor for this spec's existence. The "Home = daily / Explore = rabbit hole" framing extends Q1's "complementary, not redundant" finding.
- **Phase 33b Q3 dead-end backlog** does NOT include /explore items — /explore scored well on its canonical vectors (NSV-32 other-owners ship, NSV-35 see-more-like-this ship). v5.0 Phase 39 still ships dead-end closures on `/watch`, `/catalog`, `/u/{user}`; those are orthogonal to this redesign.
- **Pre-requisite Layer A/B/C/D catalog work** (Phases 34/35/36/37) is mostly relevant to the Browse the Catalog module (brand/era/genre indices read `watches_catalog` + `brands` + `watch_families` directly) and to Where Collections Go (uses `catalog_id` FKs as path nodes).
- **No conflict with Phase 38 CAT-13 engine rewire** — Explore modules are editorial / structural, not similarity-driven (per Phase 33b NSV-29 finding that /explore is raw-popularity, not personalized).
- **No conflict with Phase 40 SRCH-16** — actually synergistic: Collector Archetypes deep-link to prefiltered search, and SRCH-16 facets are exactly the filter primitives those deep-links use.

## Open milestone-level questions for v5.1 roadmapping

- Phase count: 3-4 phases looks right (page shell + browse + archetypes ; curated lists + hero ; paths). Roadmap will refine.
- CMS decision (in-app admin vs Sanity vs Contentlayer) is the biggest pre-roadmap research item. Run a `/gsd-spike` before milestone planning?
- v5.1 sequencing against v6.0 Market Value (SEED-005) + SEED-007 pricing API spike — does v5.1 come BEFORE the pricing spike, or run in parallel? User intent in this discuss-phase: v5.1 comes AFTER v5.0 closes, no parallel work assumed.

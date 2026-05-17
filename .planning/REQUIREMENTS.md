# Requirements: Horlo — v5.1 Explore Page Redesign

**Defined:** 2026-05-16
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

**Milestone goal:** Build `/explore` as a top-level evergreen, taste-driven discovery surface (the "rabbit hole" — distinct from Home's daily check-in), preceded by a polish pass and a catalog-data enrichment pass.

**Scope posture:** In-app admin CMS — no third-party CMS (decided 2026-05-16). Catalog *enrichment* only (the existing ~100 rows); breadth *expansion* is v5.2 (SEED-009). No personalization on Explore — Home's job (Phase 33b Q1 verdict). Ships fully free (no paywall, SEED-006). One new runtime dependency: `react-markdown`.

---

## v5.1 Requirements

### Polish (PLSH)

- [ ] **PLSH-01**: The `/search` filter bottom-sheet can be dismissed (tap-outside or close control) while a filtered query is still loading — close is never blocked by pending state.
- [ ] **PLSH-02**: The `/search` filter bottom-sheet can be dismissed with a downward swipe gesture.
- [ ] **PLSH-03**: Wishlist watch cards render no wear details — "Never worn", wear badges, and the last-worn line appear only on owned watches.
- [ ] **PLSH-04**: Watch cards in the collection and wishlist grids have a consistent height regardless of a watch's metadata or photo.
- [ ] **PLSH-05**: The add-to-collection / add-to-wishlist action is a button above the watch grid rather than a card at the end of the grid.
- [ ] **PLSH-06**: User can upload a profile photo from their device; it is stored in Supabase Storage and served on profile surfaces, replacing the avatar-URL text field.
- [ ] **PLSH-07**: The watch-extraction LLM integration uses a current, non-deprecated Claude model ID.

### Catalog Enrichment (ENRH)

- [ ] **ENRH-01**: The catalog-enrichment script retries rate-limited requests with backoff and paces requests so a full ~100-row run completes without silent failures.
- [ ] **ENRH-02**: The enrichment script logs per-row (`catalog_id`) success and failure so a partial run is diagnosable and resumable.
- [ ] **ENRH-03**: Re-running enrichment cannot downgrade a high-confidence (vision-derived) catalog row — a confidence-threshold and photo-existence guard protect force re-enrichment.
- [ ] **ENRH-04**: After the production run, all ~100 `watches_catalog` rows have populated LLM-derived taste attributes (`primary_archetype`, `era_signal`, taste columns); LLM output writes taste columns only.
- [ ] **ENRH-05**: Every `/search` filter dimension (movement type, case size, style tags) is populated for all catalog rows, and missing cover photos are backfilled where a usable image can be sourced; factual fields are human-reviewed, never auto-written from LLM output.
- [ ] **ENRH-06**: Archetype coverage is verified — every Collector Archetype resolves to at least one catalog row — before the Archetypes module ships.

### In-App Admin CMS (CMS)

- [ ] **CMS-01**: Five new tables (`curated_lists`, `curated_list_items`, `collection_paths`, `collection_path_nodes`, `cms_settings`) exist with RLS that exposes only published content to non-owners.
- [ ] **CMS-02**: The admin routes (`/admin/lists`, `/admin/paths`) are reachable only by the owner, enforced by both a route guard and an owner assertion at the start of every CMS Server Action.
- [ ] **CMS-03**: Owner can create, edit, and delete a curated list with title, curator name, cover image, and markdown intro copy.
- [ ] **CMS-04**: Owner can add catalog watches to a curated list and write per-item editorial commentary.
- [ ] **CMS-05**: Owner can hand-order the curated lists shown in the rail.
- [ ] **CMS-06**: Owner can save a curated list as a draft and publish or unpublish it; a list with zero watches cannot be published, and unpublished lists are never publicly visible.
- [ ] **CMS-07**: Owner can create, edit, and delete a collection path — a seed watch plus up to three follow-on watches, an editorial rationale, and a path-type label.
- [ ] **CMS-08**: Owner can pin a curated list as the hero feature, optionally with an expiry date, and can clear the pin.
- [ ] **CMS-09**: Deleting a catalog watch that is referenced by a published list or path is blocked, and the admin UI warns before such a delete.
- [ ] **CMS-10**: Ten seed collection paths are authored through the admin UI.

### Explore Page (EXPL)

- [ ] **EXPL-01**: `/explore` renders a five-module page (Hero, Collector Archetypes, Curated Lists Rail, Where Collections Go, Browse the Catalog) — stacked on mobile, grid on desktop.
- [ ] **EXPL-02**: Any Explore module with no available content hides itself (absent, never an empty container).
- [ ] **EXPL-03**: Browse the Catalog presents brand, era, genre, and price-band indices with accurate counts (fixed price-band buckets: Under $500 / $500–2K / $2K–10K / $10K–50K / $50K+); counts are cached with tag-based invalidation; tapping a grouping opens `/search` prefiltered by that facet.
- [ ] **EXPL-04**: The Brands index provides A–Z jump navigation.
- [ ] **EXPL-05**: Collector Archetypes renders a chip rail of eight archetypes, each with a watch-count badge; tapping a chip opens prefiltered search results with an archetype header.
- [ ] **EXPL-06**: The Curated Lists Rail shows up to 12 published lists (cover, title, curator, watch count, freshness), with "View all" linking to `/explore/lists`.
- [ ] **EXPL-07**: A curated list detail page renders the list's intro copy and per-item editorial commentary.
- [ ] **EXPL-08**: The Hero shows one quality-gated featured list per page load (full-bleed image, title, curator), auto-selected from published lists unless a manual pin overrides it, and hides gracefully when no eligible content exists; its data shape accepts both featured-list and featured-collector formats.
- [ ] **EXPL-09**: Where Collections Go shows rotating collection paths (seed watch plus follow-on watches, each with rationale and a path-type label); tapping any watch opens its detail page, and "Explore all paths" links to `/explore/paths`.

---

## Future Requirements

Deferred to a future milestone. Tracked but not in the v5.1 roadmap.

### Explore / CMS (v5.x)

- **UGC list submission** — user-authored curated lists. SEED-008 defers until ~500 active users and ~50 quality lists exist (moderation overhead).
- **Featured-collector hero format** — the Hero data shape accepts it (EXPL-08), but only featured-list is wired up in v5.1.
- **Computed collection paths** — v5.1 paths are hand-curated; the data model supports a later `manual | computed` transition.
- **Markdown live-preview** in the CMS editor — plain textarea + render ships in v5.1.
- **Brand logos** in the Brands index — depends on brand imagery not yet sourced.
- **Inline "add to wishlist"** on curated-list items — interaction design untested in this context.

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Personalization on `/explore` | Home's job (recency-driven, social-graph). Explore is evergreen and structural by design — Phase 33b Q1 verdict. |
| Catalog breadth expansion | v5.2 milestone (SEED-009). v5.1 enriches the existing ~100 rows only. |
| Third-party CMS (Sanity, Contentlayer) | In-app admin route chosen 2026-05-16 — no external dependency, fits single-user / free / personal-first stance. |
| Auto-writing factual specs from LLM output | Hallucination would corrupt catalog data. Factual fields (movement, case size) stay human-reviewed. |
| Search UI redesign | `/search` is a global surface, not an Explore module. v5.1 touches only the filter-sheet polish (PLSH-01/02). |
| Auto-rotating hero carousel | Anti-pattern — users see slide 1 only (NNG/Baymard). Hero rotates between sessions, not within one. |
| Social-proof path stats ("42% of owners…") | Misleading at current single-user / low-data scale. |

---

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLSH-01 | Phase 43 | Pending |
| PLSH-02 | Phase 43 | Pending |
| PLSH-03 | Phase 43 | Pending |
| PLSH-04 | Phase 43 | Pending |
| PLSH-05 | Phase 43 | Pending |
| PLSH-06 | Phase 43 | Pending |
| PLSH-07 | Phase 43 | Pending |
| ENRH-01 | Phase 44 | Pending |
| ENRH-02 | Phase 44 | Pending |
| ENRH-03 | Phase 44 | Pending |
| ENRH-04 | Phase 44 | Pending |
| ENRH-05 | Phase 44 | Pending |
| ENRH-06 | Phase 44 | Pending |
| CMS-01 | Phase 45 | Pending |
| CMS-02 | Phase 45 | Pending |
| CMS-03 | Phase 45 | Pending |
| CMS-04 | Phase 45 | Pending |
| CMS-05 | Phase 45 | Pending |
| CMS-06 | Phase 45 | Pending |
| CMS-07 | Phase 45 | Pending |
| CMS-08 | Phase 45 | Pending |
| CMS-09 | Phase 45 | Pending |
| CMS-10 | Phase 45 | Pending |
| EXPL-01 | Phase 46 | Pending |
| EXPL-02 | Phase 46 | Pending |
| EXPL-03 | Phase 46 | Pending |
| EXPL-04 | Phase 46 | Pending |
| EXPL-05 | Phase 46 | Pending |
| EXPL-06 | Phase 47 | Pending |
| EXPL-07 | Phase 47 | Pending |
| EXPL-08 | Phase 47 | Pending |
| EXPL-09 | Phase 47 | Pending |

**Coverage:**
- v5.1 requirements: 32 total
- Mapped to phases: 32 (complete)
- Unmapped: 0 — full coverage

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-16 — traceability populated after roadmap creation*

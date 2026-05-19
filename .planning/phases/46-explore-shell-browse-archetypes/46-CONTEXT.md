# Phase 46: Explore Shell + Browse + Archetypes - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the new `/explore` 5-module shell and ship two of its modules live:
**Browse the Catalog** and **Collector Archetypes**. In scope (EXPL-01 through
EXPL-05):

- The `/explore` route is rebuilt as a five-module page (Hero, Collector
  Archetypes, Curated Lists Rail, Where Collections Go, Browse the Catalog) —
  stacked on mobile, grid on desktop; any module with no content hides itself
  entirely (no empty containers).
- **Browse the Catalog** module: 4 entry tiles → dedicated index pages for
  Brands, Eras, and Genres, each grouping showing accurate counts; tapping a
  grouping deep-links to `/search` prefiltered by that facet. The Brands index
  page carries A–Z jump navigation. Counts cached with tag-based invalidation.
- **Collector Archetypes** module: a chip rail of one chip per
  `primary_archetype` value (10 chips), each with a watch-count badge; tapping
  a chip opens `/search` prefiltered with an editorial archetype header.
- `/search`'s Watches tab is extended to accept brand / era / genre /
  archetype facets and run query-free (no typed query required).

Out of scope: the **editorial content** of three modules — the Curated Lists
Rail, Hero, and Where Collections Go (EXPL-06..09) are Phase 47. Phase 46
ships those three modules' shell *slots* only; with no wired content they hide
per EXPL-02. Also out of scope: the **Price-bands** Browse index (deferred —
see Deferred Ideas) and any `/explore` personalization (Home's job — Phase 33b
Q1 verdict).

</domain>

<decisions>
## Implementation Decisions

### Old `/explore` Disposition

- **D-01:** The three Phase 18 discovery rails — `PopularCollectors`,
  `TrendingWatches`, `GainingTraction` — are **retired entirely**. Delete the
  rail components and their dedicated DAL readers. SEED-008 defines Explore as
  editorial/structural with exactly five modules; none is a "trending watches"
  rail, and Home already owns recency-driven popularity surfaces.
- **D-02:** The Phase 18 sparse-network welcome hero (`ExploreHero`, gated on
  `followingCount < 3 && wearEventsCount < 1`) is **retired** along with its
  count-gate fetch. The new `/explore` has its own editorial Hero module
  (Phase 47); two heroes on one route is incoherent.
- **D-03:** The see-all routes that fed the old rails — `/explore/collectors`
  and `/explore/watches` — are **also retired** (routes + their page
  components). They have no consumer once D-01 lands. Planner: audit for any
  inbound links and remove/repoint them.
- **D-04 [note for planner]:** D-01–D-03 delete code touching `src/data/`
  discovery readers, `src/data/wearEvents.ts` count helpers, and possibly
  `src/components/explore/`. Check whether any retired DAL reader or component
  is still imported by Home (`src/app/page.tsx`) before deleting — Home and
  Explore historically shared discovery components. Retire only what is
  Explore-exclusive.

### Browse the Catalog — Module Shape (EXPL-03, EXPL-04)

- **D-05:** The Browse module on `/explore` renders **4 compact entry tiles**
  (Brands, Eras, Genres, Price bands), each tapping into a **dedicated full
  index page**: `/explore/brands`, `/explore/eras`, `/explore/genres`. The
  indices are independently routable per SEED-008. Keeps `/explore` short on
  mobile.
- **D-06:** The full per-grouping list (with counts) lives on each index
  page — not inline on `/explore`. The `/explore` tile is a summary
  entry-point; the index page is the full faceted list.
- **D-07:** A–Z jump navigation lives **on the full `/explore/brands` index
  page**, alongside the alphabetized brand list with counts — the standard
  pattern for a long A–Z index. It does not appear on `/explore`.
- **D-08 [scope]:** Only **3 of the 4** index tiles ship a working page in
  Phase 46 — Brands, Eras, Genres. The Price-bands tile/index is deferred
  (D-16). Whether the Browse module shows 3 tiles or shows a disabled/
  "coming soon" 4th tile is planner discretion; absent-not-empty (EXPL-02) is
  the safe default.

### Prefiltered Results — Deep-Link Target (EXPL-03, EXPL-05)

- **D-09:** Tapping a Browse grouping or an archetype chip deep-links to the
  **`/search` Watches tab** (locked by roadmap success criteria). The Watches
  tab is **extended** to accept the new facets — it currently filters only
  movement / size / style and requires a typed query.
- **D-10:** The arriving facet is applied as a **visible, removable filter
  chip** — the prefiltered view is the normal `/search` Watches tab, fully
  **composable and refinable**. The user can clear the facet, type a text
  query on top, or layer movement/size/style filters. Browse/Archetypes are
  entry points *into* the full search tool, not a separate locked category
  view.
- **D-11:** `/search`'s Watches tab must support a **query-free run** — a
  facet with no typed query returns the full faceted catalog slice. Today the
  Watches search only fires at `q.length >= 2`; that gate must be lifted when
  a facet is present.
- **D-12:** New facet dimensions to thread through the search layer: **brand,
  era, genre, archetype** (in addition to existing movement/size/style). They
  arrive as URL query params and surface as removable filter chips.
- **D-13:** The archetype editorial header (shown when `/search` is entered
  via an archetype chip) contains **archetype name + a one-line editorial
  description + a result count**. The count is the number of catalog watches
  matching that archetype facet.

### Collector Archetypes — Config & Mapping (EXPL-05)

- **D-14:** Each archetype chip maps to **a single catalog facet value** —
  `primary_archetype`. A chip is a friendly display name + editorial
  description in config, deep-linking as one clean removable filter chip
  (D-10). No composite multi-column filters.
- **D-15:** The rail shows **all 10 `primary_archetype` values** (dress, dive,
  field, pilot, chrono, gmt, racing, sport, tool, hybrid) — one chip each.
  This **amends the roadmap's "8 archetypes"** (criterion #4) and **EXPL-05's
  "eight archetypes"**: the "8" is the stale figure Phase 44 D-16 already
  flagged; the live `PRIMARY_ARCHETYPES` vocab is 10. Phase 44 verified
  coverage for all 10, so every chip resolves to ≥1 result. Planner/roadmap
  housekeeping: amend criterion #4 and EXPL-05 from 8 → 10.
- **D-16 [note]:** Display names + one-line descriptions for the 10 archetype
  chips are editorial content the owner finalizes at planning time. The
  `primary_archetype` raw values (`chrono`, `gmt`, etc.) are not user-facing
  copy — each needs a curated label and a short identity sentence.

### Browse Taxonomy — Index Data Sources (EXPL-03)

- **D-17:** The **Genres** index groups by the `primary_archetype` column (10
  functional categories — one value per watch → clean, non-overlapping
  counts). This deliberately shares the underlying column with the Collector
  Archetypes chips (D-14). The two modules serve different intents — identity
  entry vs. utility facet — and must be made visually/editorially distinct so
  the page does not read as redundant.
- **D-18:** The **Eras** index groups by `eraSignal` (3 buckets:
  vintage-leaning / modern / contemporary) — the fully-enriched, low-cardinality
  column. Chosen *for now* because the catalog lacks broad vintage data; the
  13-bucket `era` decade enum is sparsely populated. See Deferred Ideas for the
  decade-based Eras index TODO.
- **D-19:** Browse counts are **cached with tag-based invalidation** (EXPL-03
  lock) — `'use cache'` + `cacheTag` + a catalog-mutation invalidation tag.
  Tag naming and revalidation wiring is planner discretion; follow the
  established `revalidateTag('explore', ...)` family.

### Claude's Discretion

- The responsive grid layout for the 5 modules on desktop (which modules sit
  side-by-side vs. full-width) — within EXPL-01's "stacked on mobile, grid on
  desktop".
- Whether the Browse module shows 3 tiles or a disabled 4th Price-bands tile
  (D-08).
- Exact cache tag names and `cacheLife` windows for Browse counts (D-19).
- How the three Phase-47 editorial module slots render in Phase 46 — empty
  (hidden via EXPL-02) vs. lightweight placeholder. Note Phase 45 already
  authored 6 published collection paths and the CMS schema exists, so the
  Where-Collections-Go / Curated-Lists data *may* be queryable; whether Phase
  46 wires any read is planner's call (the modules' full render is Phase 47).
- The exact route segment for the genres index (`/explore/genres`) and any
  facet query-param naming on `/search`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 46: Explore Shell + Browse + Archetypes" —
  phase goal, EXPL-01..05, four success criteria. NOTE: criterion #4's "8
  archetypes" is stale — amended to 10 by D-15.
- `.planning/REQUIREMENTS.md` § "Explore Page (EXPL)" — EXPL-01..05 text
  (Phase 46) and EXPL-06..09 (Phase 47, for module-slot awareness). NOTE:
  EXPL-05's "eight archetypes" amended to 10 by D-15; EXPL-03's price-band
  clause deferred per D-16/Deferred Ideas.

### Product Spec
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` § "Page Composition",
  § "Modules" (Hero / Collector Archetypes / Curated Lists Rail / Where
  Collections Go / Browse the Catalog), § "Implementation Order",
  § "Open Questions" — the authoritative module-by-module spec for the
  `/explore` redesign.

### Prior Phase Context (locked decisions to respect)
- `.planning/phases/45-cms-data-model-admin-routes/45-CONTEXT.md` — the CMS
  data model (`curated_lists`, `collection_paths`, `cms_settings`, etc.) and
  hero-pin machinery that the Phase-47 editorial modules consume; relevant
  here only for module-slot shape.
- `.planning/phases/44-catalog-enrichment/44-CONTEXT.md` § D-16 — the
  `primary_archetype` vocab is **10** values, not 8 (drove D-15); Phase 44
  verified archetype coverage so every chip resolves.

### Catalog Taxonomy (code ground truth)
- `src/lib/taste/vocab.ts` — `PRIMARY_ARCHETYPES` (10 values, drives the
  archetype chips D-14/D-15 and the Genres index D-17), `ERA_SIGNALS` (3
  values, drives the Eras index D-18), `DESIGN_MOTIFS`.
- `src/db/schema.ts` — `watchesCatalog` table (`primaryArchetype`, `eraSignal`,
  `era` enum, `brandId`, tag arrays — no price column); `brands` table
  (`name`, `nameNormalized`, `slug` — drives the Brands index + A–Z nav).
- `src/lib/constants.ts` — `STYLE_TAGS`, `ROLE_TAGS`, `DESIGN_TRAITS` (not
  used for the indices per D-17/D-18, but the existing `/search` style filter).

### Search Surface (extension target)
- `src/app/search/page.tsx` + `src/components/search/SearchPageClient.tsx` +
  `src/components/search/useSearchState.ts` — the `/search` Watches tab,
  extended by D-09..D-13 to accept brand/era/genre/archetype facets and run
  query-free.
- `src/data/catalog.ts` § `searchCatalogWatches` / `CatalogSearchFilters` —
  the catalog search DAL; `CatalogSearchFilters` gains brand/era/genre/
  archetype dimensions, and the `q.length >= 2` gate is lifted for facet-only
  runs (D-11).

### Existing Explore (to be replaced/retired)
- `src/app/explore/page.tsx`, `src/app/explore/collectors/page.tsx`,
  `src/app/explore/watches/page.tsx`, `src/components/explore/*` — the Phase 18
  surface retired by D-01..D-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/catalog.ts` — `searchCatalogWatches`, `CatalogSearchFilters`,
  `SIZE_BAND_MAP`, `getTopStyleTags`. The catalog search layer extended for
  facet deep-links (D-09..D-13).
- `src/data/hierarchy.ts` — catalog hierarchy readers (`brands`,
  `watch_families`); a starting point for the Brands/Genres index counts.
- `src/components/search/` — `FilterDrawer`, `FilterSheet`, `MovementChips`,
  `CaseSizeChips`, `StyleChips`, `useSearchState` — the existing facet-chip
  pattern that brand/era/genre/archetype filter chips (D-10/D-12) follow.
- `src/components/explore/DiscoveryWatchCard.tsx` — a catalog watch card that
  may be reusable in Browse index pages (audit before deleting per D-04).
- The `revalidateTag('explore', 'max')` invalidation family — the established
  pattern Browse count caching (D-19) plugs into.

### Established Patterns
- Server Components by default; `/explore` and index pages are Server
  Components. `'use client'` only where filter state is needed (mirror
  `SearchPageClient`).
- `/explore` is auth-gated by `src/proxy.ts` before render; `getCurrentUser()`
  in the page body, let `UnauthorizedError` propagate (matches home + the
  retired Phase 18 page).
- Cache Components (`cacheComponents: true`): per-module `'use cache'` scopes;
  per-viewer/viewer-dependent reads stay OUTSIDE cache scope. Browse is
  catalog-derived and viewer-independent → fully cacheable (D-19).
- Catalog reads use public-read RLS; no per-user privacy layer on catalog
  identity.

### Integration Points
- `/explore` route — rebuilt; old page + `/explore/collectors` +
  `/explore/watches` deleted (D-01..D-03).
- New routes: `/explore/brands`, `/explore/eras`, `/explore/genres` (D-05).
- `/search` Watches tab + `searchCatalogWatches` — extended for new facets
  (D-09..D-13); this is the most cross-cutting change. Regression-check the
  existing movement/size/style filters and the typed-query path.
- Browse count caching hooks into the catalog-mutation invalidation tag
  family (D-19).

</code_context>

<specifics>
## Specific Ideas

- The Collector Archetypes module (D-14) and the Browse Genres index (D-17)
  read the **same** `primary_archetype` column. This is intentional but a
  redundancy risk — the planner must make them clearly distinct: Archetypes is
  the identity rail (curated names, editorial descriptions, header on the
  results page); Genres is the plain utility facet list with counts. If they
  end up looking like the same thing twice, the design has failed.
- The prefiltered `/search` view is deliberately the *full search tool* with a
  removable facet chip (D-10) — NOT a locked "category page." The user
  explicitly wants Browse/Archetypes to drop the user into a refinable search,
  so they can keep exploring rather than hit a dead end.
- Retiring the old rails (D-01) is a clean delete, not a soft-hide — but D-04
  flags that Home may share discovery components, so the delete must be
  Explore-exclusive code only.

</specifics>

<deferred>
## Deferred Ideas

- **Price-bands Browse index → v6.0 Market Value (SEED-005).** EXPL-03
  mandates a Price-bands index with fixed buckets (Under $500 / $500–2K /
  $2K–10K / $10K–50K / $50K+), but `watches_catalog` has no price column and
  deriving price from per-user `watches` data gives near-zero coverage at
  single-user scale. Phase 46 ships 3 of 4 Browse indices (Brands/Eras/Genres);
  the Price-bands index waits for v6.0, which adds `market_prices` keyed on
  `catalog_id` (SEED-005). EXPL-03's price-band clause is dropped from Phase 46
  scope — roadmap/requirements housekeeping should reflect this.
- **Eras index by decade — TODO when catalog vintage data is fuller.** The
  Eras index ships on `eraSignal` (3 buckets) for now (D-18). When the catalog
  carries a broader vintage data set (e.g. after v5.2 catalog expansion /
  SEED-009), revisit the Eras index to use the 13-bucket `era` decade enum —
  either replacing or sub-sectioning the era-signal buckets.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

</deferred>

---

*Phase: 46-Explore Shell + Browse + Archetypes*
*Context gathered: 2026-05-18*

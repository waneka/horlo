# Phase 39b: Audit-Driven Discovery Polish — Heavier UX - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

**Phase 39b closes the heavier-tier Phase 33b Q3 sorted dead-end backlog + the Q2 lineage browse UI deferral** — surfaces that require new components, aggregation queries, or operator-curation data work. Phase 39 (cheap patches: NSV-01+15 Link wraps, NSV-08 verify-and-patch, NSV-12 common-ground 404 fallback) shipped 2026-05-12 with verifier PHASE_PASSED 5/5; Phase 39b now shapes after observing 39 in production.

### In scope (Phase 39b — 4 closures)

1. **NSV-06 + NSV-20 — Fresh-account `ReferenceIdentityCard`** on `/watch/{id}` + `/catalog/{id}` when `collection.length === 0` and `catalogTaste.confidence >= 0.5`. New component at `src/components/insights/ReferenceIdentityCard.tsx`. Renders all 6 CAT-13 taste fields (era + primary archetype headline; formality/sportiness/heritage sparkline-pill scales; design motifs chip cluster). Existing 3-CTA block (Add to Wishlist / Add to Collection / Skip) renders BELOW the card. Below threshold (or `catalogTaste === null`) → suppress card, fall back to CTA-only render with optional caption. **Backing rows:** DISC-AUDIT-81, DISC-AUDIT-131 (NSV-06); DISC-AUDIT-70, DISC-AUDIT-130 (NSV-20).

2. **NSV-14 — Collector Profile 8-row dead-end sub-cluster.** Three sub-cells:
   - **LockedTabCard** (`src/components/profile/LockedTabCard.tsx`) — adds inline FollowButton + caption "Follow @{username} to see their {label}." Logged-in viewers follow inline; unauthenticated viewers see "Sign in to follow" link to `/signin?returnTo={currentPath}`. Applied to all 4 locked variants (collection/wishlist/notes/stats).
   - **WornCalendar** (`src/components/profile/WornCalendar.tsx`) — day-cell onClick adds `selectedDate` state; renders a wear-detail panel BELOW the calendar grid showing the day's wear events (watch image + brand + model + notes). First day with events selected on mount. No new route.
   - **StatsTabContent** (`src/components/profile/StatsTabContent.tsx:50-86`) — wrap each `<li>` in `WornList` (Most Worn + Least Worn) with `<Link href="/watch/${watch.id}">`. Style/Role HorizontalBarChart bars stay non-clickable.

   **Backing rows:** DISC-AUDIT-97, DISC-AUDIT-102, DISC-AUDIT-111, DISC-AUDIT-122, DISC-AUDIT-123, DISC-AUDIT-124. DISC-AUDIT-127 common-ground 404 closed in Phase 39. DISC-AUDIT-99 wishlist drag-handle silent no-op is "wired-but-broken" per Phase 33b A2 — own bugfix, not part of NSV-14.

3. **NSV-18 — Catalog other-owners roster** on `/catalog/{id}`. Top 5 public collectors sorted by most-recent-added (`ORDER BY watches.created_at DESC` on the catalog-matching row); aggregation over `watches × profiles × profile_settings` with two-layer privacy (`profile_public = true` + `collection_public = true` + viewer self-exclusion). Visual: horizontal avatar+username chip row, click → `/u/{username}/collection`. Hide count label when total <= 5; show "X collectors own this" label when total > 5. Hide entire section when total === 0. **Backing rows:** DISC-AUDIT-70, DISC-AUDIT-72.

4. **NSV-02 + NSV-16 — Inline lineage rails** on `/watch/{id}` and `/catalog/{id}`. Two rails per surface: "Same family" + "Lineage". Sources: "Same family" from `watches_catalog` rows with matching `family_id` excluding current ref, ORDER BY ownership count DESC then alphabetical, cap 6 cards. "Lineage" from Phase 35 `getLineageForReference(catalogId)` recursive CTE (depth-guard 10), cap 6 cards. Cards: `DiscoveryWatchCard` (same as `/explore` Trending/Gaining rails); click → `/catalog/{id}`. Relationship-type chip per Lineage card. Hide-rail-if-empty (module absent, no empty state). NO `/family/{familyId}` page. **Includes operator-curation seed pass via `scripts/seed-lineage.ts` Wave 0 plan** (~20 high-signal `family_id` updates + ~15 manual `watch_lineage_edges` rows). **Backing rows:** DISC-AUDIT-130 (NSV-16); NSV-02 absence anchored to Phase 33b NSD-15 rule 3.

### Out of scope (deferred)

- **`/family/{familyId}` dedicated page** → v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module
- **Admin UI for lineage edge curation** → v5.x (39b uses operator script only)
- **`/catalog/{id}` explicit predecessor/successor chain visualization** → v5.x polish
- **WishlistRail drag-handle silent no-op (DISC-AUDIT-99 / NSV-14 sub-cell)** → own bugfix ticket
- **NSV-41 search inline-expand fresh-account verdict** → v5.x (Phase 33b partial med)
- **All 21 med/low-leverage Phase 33b cells** (NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41) → v5.x

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 39b continues from D-39b-01..08 captured in `39-CONTEXT.md`. New decisions here are D-39b-09..D-39b-17.

### Carried forward from 39-CONTEXT.md (locked — do NOT re-litigate)

- **D-39b-01 — ReferenceIdentityCard is a NEW component**, sibling to CollectionFitCard at `src/components/insights/ReferenceIdentityCard.tsx`. Renders catalog taste signature with no fit-judgment.
- **D-39b-02 — Card content:** era + primary archetype headline; formality/sportiness/heritage sparkline-pill scales; design motifs chip cluster. Confidence shown only as muted subtitle ("Inferred taste signature").
- **D-39b-03 — Confidence gate:** `catalogTaste === null || catalogTaste.confidence < 0.5` → suppress card. Matches project-wide 0.5 gate (Phase 19.1 D-13, Phase 20 viewerTasteProfile, Phase 38 D-02).
- **D-39b-04 — Identical rendering on `/watch/{id}` and `/catalog/{id}`.** One component, two callsites. CTAs render BELOW the card.
- **D-39b-05 — Inline rails only, no `/family/{familyId}` page.**
- **D-39b-06 — Two rails per surface: "Same family" + "Lineage".** Sourced from Phase 34 `family_id` (Same family) and Phase 35 `getLineageForReference()` recursive CTE (Lineage).
- **D-39b-07 — Hide-rail-if-empty graceful degradation.** Module absent, never empty state.
- **D-39b-08 — Operator-curation seed pass ships INSIDE Phase 39b** via `scripts/seed-lineage.ts`. No admin UI.

### NSV-18 catalog roster (D-39b-09 through D-39b-11)

- **D-39b-09 — Roster size: top 5, no pagination.** Cap at 5 public collectors. If total > 5, display "X collectors own this" count label above the chip row; if total <= 5, hide the count label. If total === 0, hide entire roster section (matches D-39b-07 hide-if-empty pattern).
- **D-39b-10 — Sort: most-recent-added.** `ORDER BY watches.created_at DESC` on the row where the collector added this catalog. Liveness signal preferred over influence (alphabetical tiebreaker only on tie). Lowest aggregation cost — no follower-count subquery.
- **D-39b-11 — Layout: horizontal avatar + username chip row.** Reuses `/explore` PopularCollectors visual vocabulary. Avatar + @username under each chip; scrolls horizontally on mobile if needed. Click → `/u/{username}/collection`.

### NSV-14 sub-cluster (D-39b-12 through D-39b-14)

- **D-39b-12 — LockedTabCard CTA:** inline `FollowButton` (`src/components/profile/FollowButton.tsx`) below the lock icon + caption text "Follow @{username} to see their {label}." Logged-in viewers follow inline. Unauthenticated viewers see a "Sign in to follow" button linking to `/signin?returnTo={currentPath}`. Applied to all 4 locked tab variants (collection / wishlist / notes / stats). LockedTabCard returns null for `tab === 'common-ground'` unchanged (Phase 39 closure D-09 still owns that branch).
- **D-39b-13 — WornCalendar day-cell onClick:** add `selectedDate` client state to the calendar wrapper. Tap a day with wear events → renders a wear-detail panel BELOW the calendar grid showing all wear events for that day (watch image + brand + model + notes). First day with events selected on mount (deterministic initial render). No new route, no modal. Server-component-rendered outer page, `'use client'` boundary at the calendar wrapper.
- **D-39b-14 — StatsTabContent Link wraps:** wrap each `<li>` in `WornList` (Most Worn + Least Worn lists, `StatsTabContent.tsx:59-82`) with `<Link href="/watch/${watch.id}">`. Style/Role `HorizontalBarChart` bars stay non-clickable — they aggregate over multiple watches with no single-watch click destination. Matches NSV-14 DISC-AUDIT-123 anchor scope.

### Lineage rails (D-39b-15 through D-39b-17)

- **D-39b-15 — "Same family" rail sort: collector-popularity.** `ORDER BY COUNT(watches.catalog_id) DESC, brand ASC, model ASC` (alphabetical tiebreaker). Adds a small subquery — surfaces most-encountered family siblings as highest-utility Rdio drift targets. "Lineage" rail orders by Phase 35 CTE traversal order (depth-first, predecessor before successor) unchanged.
- **D-39b-16 — Lineage rail relationship_type display labels:** directional. Phase 35 enum maps as:
  - `predecessor` → "Predecessor"
  - `successor` → "Successor"
  - `remake` → "Modern remake"
  - `tribute` → "Tribute to"
  - `homage` → "Homage to"

  Each Lineage card renders a small chip below the watch identity carrying its relationship label. "Same family" rail has no per-card chip (the rail header carries the relation).
- **D-39b-17 — Cap 6 cards per rail, scrollable horizontally on overflow.** If the "Same family" query returns > 6 rows, show 6 + a small "See all in family" link (disabled / hidden in 39b — points to deferred `/catalog?family={id}` surface that v5.x or SEED-008 v5.1 Browse the Catalog absorbs). If "Lineage" CTE returns > 6 rows, show 6 only. Both rails hide entirely when their query returns 0 rows (D-39b-07).

### Curation seed pass (D-39b-18 through D-39b-20)

- **D-39b-18 — Operator authors seed list during plan execution.** Planner ships `scripts/seed-lineage.ts` with a TODO block listing target family categories (Submariner, Speedmaster, Royal Oak, Sub homages, etc.); operator writes actual catalog_id + family_id + edge-row values when the curation plan runs. CONTEXT.md captures category guidance, NOT literal data — keeps discuss-phase short and preserves operator flexibility on which families to seed when.
- **D-39b-19 — Curation plan is Wave 0 — ships BEFORE UI plans.** Phase 39b execution order:
  - **Wave 0 (BLOCKING):** curation plan — operator commits ~20 `family_id` updates + ~15 `watch_lineage_edges` rows to prod DB via the seed script.
  - **Wave 1 (after Wave 0):** UI plans for ReferenceIdentityCard / NSV-14 sub-cluster / NSV-18 roster / lineage rails — ship against a prod DB that has curation data, so hide-if-empty verification surfaces real sparse data rather than empty-everywhere. Adds prod-deploy checkpoint at end of Wave 0 (autonomous: false on curation plan).
- **D-39b-20 — Seed script idempotency contract:** `UPDATE watches_catalog SET family_id = X WHERE catalog_id = Y AND family_id IS NULL` (never overwrite existing family_id assignments) + `INSERT INTO watch_lineage_edges (...) VALUES (...) ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING`. Operator can safely re-run the script after partial commits. Matches Phase 34 `scripts/backfill-catalog-brands.ts` pattern.

### Claude's Discretion

- **ReferenceIdentityCard visual treatment** — sparkline-pill style vs horizontal bar style vs concentric dot pattern for formality/sportiness/heritage scales. Phase 39b UI-SPEC shapes this; design tokens already in the project. Planner / UI-researcher picks cleanest interpretation of D-39b-02.
- **Import-boundary static guard for ReferenceIdentityCard** — planner discretion whether to add `tests/static/ReferenceIdentityCard.no-engine.test.ts` analog to `tests/static/CollectionFitCard.no-engine.test.ts`. Defensible either direction — the card renders catalog taste fields directly, no similarity engine import is structurally required, but a guard would mirror the established pattern.
- **Plan packaging / wave structure beyond Wave 0** — Wave 0 is the curation plan (D-39b-19). Wave 1 packaging is planner discretion: likely 4 UI plans (ReferenceIdentityCard / NSV-14 sub-cluster / NSV-18 roster / lineage rails) but planner may consolidate where files don't conflict. Total estimate 4-5 plans + 1 curation plan, matching ROADMAP guidance.
- **WornCalendar wear-detail panel content density** — exact fields surfaced in the below-calendar panel (D-39b-13). At minimum: watch image + brand + model + notes. Photos / wear time / additional metadata at UI-SPEC discretion.
- **NSV-18 chip styling** — pill vs circular avatar, exact font weight, hover/focus treatment. UI-SPEC owns this; reuse `/explore` PopularCollectors vocabulary as starting point.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 39b: Audit-Driven Discovery Polish — Heavier UX" — phase goal + 6 success criteria + dependencies (Phase 39, 38, 34, 35).
- `.planning/REQUIREMENTS.md` §DISC-11 — umbrella requirement for Phase 39 + 39b dead-end closures.
- `.planning/PROJECT.md` — v5.0 milestone trajectory + post-v5.0 (v5.1 Explore redesign per SEED-008).

### Phase 39 carry-forward (load-bearing)
- `.planning/phases/39-audit-driven-discovery-polish/39-CONTEXT.md` — D-39b-01 through D-39b-08 inherited; carry-forward scope; canonical refs accumulated during Phase 39 discuss-phase.
- `.planning/phases/39-audit-driven-discovery-polish/39-VERIFICATION.md` — Phase 39 ship report (PHASE_PASSED 5/5, 2026-05-12). Confirms NSV-01/15/08/12 transitions to ship before 39b begins.
- `.planning/phases/39-audit-driven-discovery-polish/39-UI-SPEC.md` — Phase 39 UI design contract; 39b should mirror tokens/patterns where applicable.

### Audit substrate (load-bearing)
- `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — IMMUTABLE Phase 33 click-path table. 39b plans cite DISC-AUDIT-70, -72, -81, -97, -102, -111, -122, -123, -124, -130, -131.
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` — Phase 33b north-star audit. NSV-02, -06, -14, -16, -18, -20 cited by 39b plans. Q3 sorted backlog § Decisions Q3 is the load-bearing input.

### CAT-13 / catalog taste inheritance (load-bearing for ReferenceIdentityCard)
- `.planning/phases/38-cat-13-engine-rewire/38-CONTEXT.md` — D-02 (confidence ≥ 0.5 gate) + D-10 (`Watch.catalogTaste` LEFT JOIN) are load-bearing for D-39b-03 + D-39b-04.
- `src/lib/types.ts` §`CatalogTasteAttributes` interface — ReferenceIdentityCard consumes this shape directly.
- `src/lib/taste/vocab.ts` — Phase 19.1 closed vocab for `primaryArchetype` + `eraSignal` + `designMotifs`. ReferenceIdentityCard renders these values; UI-SPEC defines short display labels.

### Catalog hierarchy schema (load-bearing for lineage rails)
- `.planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` — CAT-15 brands + watch_families decisions; `family_id` FK semantics + indexes.
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-CONTEXT.md` — CAT-16 lineage edges + `getLineageForReference()` recursive CTE; depth-guard 10; CYCLE clause.
- `src/data/hierarchy.ts` — Phase 35 DAL with `getLineageForReference(catalogId)`. D-39b-06 sources from this.
- `src/db/schema.ts` §`watchLineageEdges`, §`watchFamilies`, §`watchesCatalog.familyId` — schema shape for 39b queries.

### NSV-18 roster sources
- `src/db/schema.ts` §`watches`, §`profiles`, §`profileSettings` — two-layer privacy gate schema.
- `src/components/explore/PopularCollectorsRail.tsx` or analog — visual vocabulary reuse target for D-39b-11.

### NSV-14 sub-cluster anchors
- `src/components/profile/LockedTabCard.tsx` — D-39b-12 patch site. Current 53-line component takes `tab`, `displayName`, `username` props; CTA addition extends.
- `src/components/profile/WornCalendar.tsx` — D-39b-13 patch site. 181 lines; grid renders day cells at lines 131-160. Currently no onClick on day cells.
- `src/components/profile/StatsTabContent.tsx:50-86` — D-39b-14 patch site. `WornList` internal component renders `<li>` rows with watch image + name + count.
- `src/components/profile/FollowButton.tsx` — D-39b-12 reuse target.

### Discovery rail / card reuse
- `src/components/explore/DiscoveryWatchCard.tsx` — reused by 39b lineage rails on `/watch/{id}` + `/catalog/{id}`. Same card shape as `/explore` Trending/Gaining rails.
- `src/app/explore/page.tsx` — current /explore layout; vocabulary baseline for NSV-18 + lineage rails.

### v5.1 deferred surface (DO NOT build in 39b)
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` — v5.1 Browse the Catalog module absorbs `/family/{familyId}` surface; ReferenceIdentityCard COULD be reused on /search inline-expand later (NSV-41) if leverage rerates.

### Code-context anchors for Phase 39b
- `src/app/watch/[id]/page.tsx` — fresh-account verdict suppression site (G-6 branch). ReferenceIdentityCard + CTAs mount here when collection.length === 0.
- `src/app/catalog/[catalogId]/page.tsx:79-113` — fresh-account verdict suppression site (G-4 branch). Lines 112-113 comment ("verdict stays null AND actionsSpec stays null — no card, no CTAs") is the explicit reshape target; also the surface for NSV-18 roster + lineage rails.
- `src/components/insights/CollectionFitCard.tsx` — sibling to new ReferenceIdentityCard; reference for component-shape patterns + Phase 20 D-04 import-boundary guard analog.
- `tests/static/CollectionFitCard.no-engine.test.ts` — established import-boundary pattern; planner may add ReferenceIdentityCard.no-engine analog.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`Watch.catalogTaste` field (Phase 38 D-10)** — LEFT JOIN already populates this on every Watch returned by `getWatchesByUser`. `/watch/{id}` reads `watch.catalogTaste` without new DAL work. `/catalog/{id}` reads from `catalogEntry` directly.
- **`getLineageForReference(catalogId)` (`src/data/hierarchy.ts`)** — Phase 35 ships this with depth-guard 10 + CYCLE clause. 39b lineage rail consumes it directly with no DAL changes.
- **`DiscoveryWatchCard` (`src/components/explore/DiscoveryWatchCard.tsx`)** — reused by 39b lineage rails on both surfaces. Same card shape as /explore Trending/Gaining rails.
- **`FollowButton` (`src/components/profile/FollowButton.tsx`)** — D-39b-12 reuses inline inside LockedTabCard.
- **`computeViewerTasteProfile` (`src/lib/verdict/viewerTasteProfile.ts`)** — Phase 20 pattern for confidence ≥ 0.5 gate; reference for ReferenceIdentityCard's gate semantics (D-39b-03).
- **`CatalogTasteAttributes` interface (`src/lib/types.ts`)** — ReferenceIdentityCard consumes this shape directly; no new types.
- **LockedTabCard's existing tab label map** (`TAB_LABELS` const) — D-39b-12 caption "Follow @{username} to see their {label}" reuses this for grammatical consistency.

### Established Patterns

- **Two-layer privacy on cross-user reads** — D-39b-09 NSV-18 catalog roster MUST follow `profile_public = true` AND `collection_public = true` AND viewer-self-exclusion (Phase 19 SRCH-12 / Phase 18 D-09 / Phase 38 patterns).
- **Module-absent-not-empty pattern** — D-39b-07 / D-39b-09 / D-39b-17 all rely on this; SEED-008 also follows. Hide modules with no data instead of rendering empty-state cards.
- **Static guard tests for import boundaries** — `tests/static/CollectionFitCard.no-engine.test.ts` enforces verdict card has no engine imports. Planner discretion (Claude's Discretion §) whether to mirror for ReferenceIdentityCard.
- **`'use client'` directive only when needed** — ReferenceIdentityCard is pure presentation: server component. WornCalendar wear-detail panel (D-39b-13) requires `'use client'` for `selectedDate` state.
- **`/signin?returnTo=` round-trip** — Phase 22 + Phase 28 pattern. D-39b-12 unauthenticated CTA reuses this with validated regex from `src/lib/auth/returnTo.ts` or analog (planner verifies actual util path).
- **Plan-internal "verify before patch"** — D-08 pattern from Phase 39 generalizes: any audit-row patch should grep the current codebase first because audit snapshots are dated 2026-05-08.

### Integration Points

- **`/watch/{id}` + `/catalog/{id}`** — both surfaces gain ReferenceIdentityCard (NSV-06/20), inline lineage rails (NSV-02/16). `/catalog/{id}` additionally gains the NSV-18 other-owners roster.
- **`/u/{username}/{tab}` profile surfaces** — collection/wishlist/notes/stats locked branches all gain the inline FollowButton CTA via LockedTabCard. Worn tab gains the day-cell wear-detail panel.
- **Wave 0 prod-DB curation seed** — `scripts/seed-lineage.ts` operator script writes to `watches_catalog.family_id` + `watch_lineage_edges`. Requires prod DB connection via `DATABASE_URL` override pattern (Phase 34 footgun T-34-04 inheritance).

</code_context>

<specifics>
## Specific Ideas

- **NSV-18 chip row vocabulary** — match `/explore` PopularCollectors. Avatar circle + @username text under each chip; chip click = whole-chip Link. Horizontal scroll on overflow at narrow viewports. Count label "X collectors own this" above the chip row when total > 5; suppressed when total <= 5.
- **NSV-14 LockedTabCard CTA caption** — "Follow @{username} to see their {label}." for logged-in viewers. "Sign in to follow" button (links to `/signin?returnTo={currentPath}`) for unauthenticated viewers. Label inherits the existing LockedTabCard `TAB_LABELS` map (`collection` / `wishlist` / `worn history` / `notes` / `stats`).
- **WornCalendar wear-detail panel** — renders below the day-grid. Each event shows: watch image (using `getSafeImageUrl`), brand + model line, notes (if present). First day with events selected on mount so the panel is non-empty on initial render. Empty-day selection state: show "No wear events on {date}." muted caption (rather than hiding panel) so the click affordance feels responsive.
- **Lineage rail labels** — header per rail: "Same family" / "Lineage". Lineage card chip below identity: "Predecessor" / "Successor" / "Modern remake" / "Tribute to" / "Homage to" per D-39b-16. Same family cards carry no per-card chip — the rail header carries the relation.
- **Curation seed script TODO scaffold** — planner ships `scripts/seed-lineage.ts` with a structured TODO block listing target family categories (Submariner / Sea-Dweller / GMT family; Speedmaster Moonwatch family; Royal Oak family; Submariner homages; Speedy chain) so operator has clear authoring targets. Script is idempotent (D-39b-20) and prints a summary of "X family_id updates + Y lineage_edges inserted" on completion.
- **ReferenceIdentityCard fallback caption** — when card is suppressed (D-39b-03), the CTA-only render may include an optional one-line caption like "Add a few watches to see how this one fits." Planner / UI-SPEC discretion on copy.

</specifics>

<deferred>
## Deferred Ideas

- **`/family/{familyId}` dedicated page** — deferred to v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module. D-39b-17 hides the "See all in family" link in 39b.
- **`/catalog/{id}` explicit predecessor/successor chain visualization** ("Replaced by → X / Tribute to ← Y") — 39b ships rails only; chain visualization is v5.x polish if it adds value beyond inline Lineage rail.
- **Admin UI for lineage edge curation** (`/admin/lineage` form) — 39b uses `scripts/seed-lineage.ts` operator script (D-39b-20). Admin UI is v5.x; warrants only when the seed list outgrows what's comfortable in code.
- **NSV-41 search inline-expand fresh-account verdict** — Phase 33b partial med. NOT in 39 or 39b. ReferenceIdentityCard (D-39b-01) COULD be reused on `/search` inline-expand later if leverage rerates upward.
- **All 21 med/low-leverage Phase 33b cells** (NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41) — explicitly DEFERRED to v5.x per Phase 33b Q3 verdict.
- **WishlistRail drag-handle silent no-op** (DISC-AUDIT-99 / NSV-14 sub-cell) — Phase 33b A2 classified "wired-but-broken" not "missing dead-end." Belongs in its own bugfix ticket, not NSV-14's add-affordance scope.
- **Confidence numeric percentage display** on ReferenceIdentityCard — D-39b-02 explicitly chose no numeric percentage (muted subtitle only). Reconsider if user feedback indicates the audience wants more transparency on inference quality.
- **Style/Role HorizontalBarChart bar Link wraps** — D-39b-14 explicitly excluded these; they aggregate over multiple watches with no single-watch click destination. SRCH-16 facet integration would enable bar → `/search?style=tag` wraps, but that ships in Phase 40 not 39b.
- **WornCalendar day-cell modal/sheet overlay** — D-39b-13 chose below-calendar panel pattern; modal pattern not used elsewhere on profile surfaces. Modal could be reconsidered if panel scroll experience suffers on mobile.
- **Roster pagination / "See all owners" sub-route** — D-39b-09 hard-capped at top 5. If real-world rosters exceed 5 frequently, a `/catalog/{id}/owners` sub-route or modal could land in v5.x.

</deferred>

---

*Phase: 39b-Audit-Driven Discovery Polish — Heavier UX*
*Context gathered: 2026-05-13*

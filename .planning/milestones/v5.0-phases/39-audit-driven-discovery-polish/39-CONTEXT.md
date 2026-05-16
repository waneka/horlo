# Phase 39: Audit-Driven Discovery Polish - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

**Phase 39 closes the cheapest tier of the Phase 33b Q3 sorted dead-end backlog: one-component or one-route patches that turn audit-flagged dead-end affordances into clickable Rdio drift directions.** No new data models, no new admin surfaces, no taste-engine changes. Phase 38 (CAT-13) already shipped; Phase 39 spends its scope on the dead-ends Phase 33b sorted by patch-cost ascending.

### In scope (Phase 39)

1. **NSV-01 + NSV-15 — mostSimilar Link wraps** in `src/components/insights/CollectionFitCard.tsx:62-81`. Each `<li>` in the mostSimilar list gets a `<Link href="/watch/${watch.id}">` wrap. Single component, affects both `/watch/{id}` (NSV-01) and `/catalog/{id}` (NSV-15) since the same component renders on both surfaces. **Backing rows:** DISC-AUDIT-82 (NSV-01), DISC-AUDIT-71 (NSV-15).

2. **NSV-08 — InsightsTabContent Link wraps** in `src/components/profile/InsightsTabContent.tsx`. **Verify-before-patch step required** — `SleepingBeautiesSection.tsx:43-51` ALREADY renders Link wraps (codebase drifted since the Phase 33b 2026-05-08 snapshot). Plan must inspect `GoodDealsSection.tsx` (and any other `*Section` mounted in InsightsTabContent) and patch only what is actually missing. If the entire NSV-08 row is already closed, the plan should explicitly close the audit row as "shipped before Phase 39 began" rather than fabricating a patch. **Backing row:** DISC-AUDIT-129.

3. **NSV-12 — common-ground 404 → walk-back fallback page.** Currently `src/app/u/[username]/[tab]/page.tsx:87` calls `notFound()` when the common-ground `overlap.hasAny` is false. Replace with a soft fallback render: a card with profile context ("You and @{username} don't share any watches yet"), with walk-back CTAs to `/explore` (discover other collectors) and `/u/{username}/collection` (see what they own). No 404; the route stays valid. **Backing row:** DISC-AUDIT-127. The other two common-ground gate failures (not-public-collection + viewer-not-following) keep their current behavior; only the no-overlap branch reshapes.

### Out of scope — Phase 39 (DEFERRED, see Phase 39b carry-forward below)

- **DISC-09 Editorial Featured Collection slot** — DROPPED. Superseded by v5.1 milestone (SEED-008). Throwaway hardcoded-ref slot would be replaced as soon as Curated Lists machinery lands. See `<deferred>` below.
- **NSV-06 / NSV-20 fresh-account verdict reshape** → Phase 39b
- **NSV-14 8-row Collector Profile sub-cluster** (LockedTabCard CTAs, WornCalendar onClick, StatsTabContent Link wraps) → Phase 39b
- **NSV-18 catalog other-owners roster** → Phase 39b
- **NSV-02 + NSV-16 lineage browse rails** → Phase 39b
- **All medium- and low-leverage cells** from Phase 33b (NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41) → v5.x per Phase 33b § Decisions Q3
- **Home/explore consolidation** → out of v5.0 per Phase 33b Q1 verdict NO

### Phase 39b carry-forward (decisions captured here; re-confirm during /gsd-discuss-phase 39b)

Phase 39b is the heavier-UX sibling phase to Phase 39. It does NOT exist in ROADMAP.md yet — operator must run `/gsd-phase` to insert it after this discuss-phase commits. Decisions made in this discussion that apply to Phase 39b are recorded here so downstream planning has the complete picture rather than rediscovering it.

**Phase 39b scope:**

1. **NSV-06 + NSV-20 — Reference Identity card on fresh-account viewers** — a new `<ReferenceIdentityCard>` component renders on `/watch/{id}` and `/catalog/{id}` when `collection.length === 0` and the catalog's `confidence >= 0.5`. Card content: era + primary archetype as headline row; formality / sportiness / heritage as three sparkline-pill numeric scales; design motifs as small chip cluster. PLUS the existing 3-CTA block (Add to Wishlist / Add to Collection / Skip) that currently only renders for owner-populated viewers — extend its gate to also render in the empty-collection branch when card is shown. When `confidence < 0.5` OR `catalog_taste` is null → suppress the Reference Identity card, fall back to CTA-only render with optional one-line "Start your collection to see how this fits" caption. Identical component on both surfaces. **Backing rows:** DISC-AUDIT-81, DISC-AUDIT-131 (NSV-06); DISC-AUDIT-70, DISC-AUDIT-130 (NSV-20).

2. **NSV-14 — Collector Profile 8-row dead-end sub-cluster.** Multi-component scope: LockedTabCard CTAs (Connect/Follow CTA for fresh-account viewers across collection/wishlist/notes/stats locked variants), WornCalendar day-cell onClick (drill into wear event detail), StatsTabContent Link wraps (stats rows click through to `/watch/{id}`). **Backing rows:** DISC-AUDIT-97, DISC-AUDIT-102, DISC-AUDIT-111, DISC-AUDIT-122, DISC-AUDIT-123, DISC-AUDIT-124. (DISC-AUDIT-127 common-ground 404 is closed in Phase 39 instead — see NSV-12.) DISC-AUDIT-99 wishlist drag-handle silent no-op is "wired-but-broken" not "missing dead-end" per Phase 33b A2 — handle as its own bugfix, not part of NSV-14's add-affordance work.

3. **NSV-18 — Catalog other-owners roster on `/catalog/{id}`.** New section ("X collectors own this") with a small roster of public collector avatars + name pills. Requires aggregation query work over `watches` × `profiles` × `profile_settings` (two-layer privacy: `profile_public = true` + `collection_public = true` + viewer self-exclusion). Card size TBD during 39b discuss-phase — top 3 / top 5 / paginated. **Backing rows:** DISC-AUDIT-70, DISC-AUDIT-72. Phase 33b ranks NSV-18 lowest-priority among Q3 high-leverage cells due to aggregation cost.

4. **NSV-02 + NSV-16 — Lineage browse rails** on `/watch/{id}` and `/catalog/{id}`. Two inline horizontal rails ("Same family" + "Lineage"), 4-6 catalog refs each as DiscoveryWatchCards clicking through to `/catalog/{id}`. **No new `/family/{familyId}` page** — the dedicated family browse surface defers to v5.x (or to SEED-008 v5.1 Explore redesign Browse the Catalog module). Hide-rail-if-empty graceful degradation (module absent, not empty). **Includes operator-curation seed pass during plan execution**: ~20 high-signal families (Submariner, Speedmaster, Royal Oak, Sub clones, Speedy chain, etc.) get `family_id` set, plus ~15 manual `watch_lineage_edges` rows (1675→1680→16610 reference chain, Speedy ref chain, etc.). Operator-author writes the seed list when the curation plan executes. **Backing rows:** DISC-AUDIT-130 (NSV-16); NSV-02 has no DISC-AUDIT row (Phase 33 enumerated existing affordances; NSV-02 absence anchored to Phase 33b NSD-15 rule 3).

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 39 uses the `D-NN` prefix. Phase 39b decisions are labeled `D-39b-NN` for cross-phase clarity.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 33b Q1 NO** — Home and Explore stay distinct surfaces. No consolidation in v5.0. **Reinforced** by SEED-008 framing ("Home = daily check-in; Explore = rabbit hole — different ranking/freshness/pacing").
- **Phase 33b Q2 DEFERRED → Phase 39b** — lineage browse UI lands in Phase 39b per Q2's "preferred" routing.
- **Phase 33b Q3 YES** — sorted dead-end backlog split: cheap items in Phase 39, heavier items in Phase 39b.
- **Phase 33b Q4 YES** — CAT-13 framed as discovery improvement (already shipped Phase 38 2026-05-12); Phase 39b NSV-06/20 closure now possible because the engine produces taste-aware verdicts.
- **Phase 19.1 D-13 / Phase 20 viewerTasteProfile / Phase 38 D-02 — `confidence >= 0.5` is the project-wide taste consumption gate.** Phase 39b D-39b-03 inherits this for the Reference Identity card.
- **Phase 38 D-10 — `Watch.catalogTaste` already populated via `getWatchesByUser` LEFT JOIN.** Phase 39b Reference Identity card on `/watch/{id}` reads `watch.catalogTaste` without any new DAL work. `/catalog/{id}` reads from `catalogEntry` directly (already in scope of the page's data).
- **Med/low-leverage Phase 33b cells (21 rows) — DEFERRED to v5.x.** NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41 are explicitly NOT touched in Phase 39 or Phase 39b.

### Scope split (Area 1 — D-01 through D-04)

- **D-01 — Two phases (Phase 39 + Phase 39b), not one mega-phase.** Mirrors the Phase 33 → 33b pattern that shipped successfully 2026-05-09. Phase 39 ships first (cheap patches, momentum win, observable in prod); Phase 39b shapes after observing 39 in production. Downstream Phase 40+ ROADMAP dependencies update from "depends on Phase 39" to "depends on Phase 39b" where appropriate (audit-conditional polish is the load-bearing dependency, not just the cheap patches).
- **D-02 — Phase 39 = 3 items.** NSV-01+15 mostSimilar Link wraps + NSV-08 Insights Link wraps (verify-before-patch) + NSV-12 common-ground 404 fallback.
- **D-03 — Phase 39b = 4 items.** NSV-06+20 fresh-account verdict + NSV-14 sub-cluster + NSV-18 catalog roster + NSV-02+16 lineage rails (with operator-curation seed pass).
- **D-04 — Each plan in either phase MUST cite ≥1 NSV-NN or DISC-AUDIT-NN row id in its CONTEXT or SUMMARY.** Per ROADMAP §Phase 39 success criterion #1. Audit-conditional citation rule survives the split unchanged.

### DISC-09 → v5.1 reshape (Area 2 — D-05 through D-06)

- **D-05 — DISC-09 DROPPED from Phase 39.** The original hardcoded-ref single-slot framing would be throwaway because the user's v5.1 spec (SEED-008) replaces it with a Hero module sourced from a curated lists pool. Shipping the throwaway in Phase 39 wastes the surface design.
- **D-06 — 5-module /explore redesign promoted to v5.1 milestone.** Captured at `.planning/seeds/SEED-008-v5.1-explore-redesign.md`. v5.0 ships `/explore` unchanged from Phase 18 (3-rail layout: PopularCollectors / TrendingWatches / GainingTractionWatches + conditional ExploreHero). v5.1 milestone starts AFTER v5.0 closes; pre-roadmap research item identified (CMS approach decision — in-app admin vs Sanity vs Contentlayer — may warrant a `/gsd-spike` before v5.1 roadmap).

### Phase 39 implementation specifics (Area 1 cont'd — D-07 through D-10)

- **D-07 — NSV-01+15 patch shape.** Wrap each `<li>` in `CollectionFitCard.tsx:69-78` with `<Link href={\`/watch/${watch.id}\`} className="block hover:bg-accent rounded-md p-1">`. Keep the existing flex layout inside the Link. Phase 20 D-04 import-boundary guard (`tests/static/CollectionFitCard.no-engine.test.ts`) unchanged — `next/link` is not an engine import.
- **D-08 — NSV-08 verify-before-patch protocol.** Plan must `grep -nE "<Link|<a " src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx` BEFORE writing any code. If both already wrap, the plan closes the audit row as "already shipped" and the plan exits. If only one wraps, patch the other. If neither wraps, patch both. Do NOT fabricate work to fill the plan.
- **D-09 — NSV-12 fallback page implementation site.** Replace the `notFound()` call at `src/app/u/[username]/[tab]/page.tsx:87` (the `if (!overlap || !overlap.hasAny) notFound()` line) with a render branch that returns a soft fallback Card. The other two common-ground gate failures (`!isOwner` line 101 and the upstream `!profile` line 54) keep `notFound()` — only the no-overlap branch reshapes. Test coverage: integration test asserting that `/u/{user}/common-ground` returns 200 with walk-back CTAs when overlap is empty and the viewer follows the owner.
- **D-10 — NSV-12 fallback page copy.** Card title: "No shared watches yet." Body (rendered with profile context): "You and @{username} don't share any watches in your collections. That doesn't mean you don't share taste — try one of these:" followed by two CTAs: "Browse {displayName}'s collection →" (links to `/u/{username}/collection`) and "Find collectors with shared watches →" (links to `/explore` PopularCollectors anchor or just `/explore`).

### Phase 39b carry-forward decisions (Area 3 + Area 4 — D-39b-01 through D-39b-08)

**Reference Identity card (NSV-06/20):**

- **D-39b-01 — Reference Identity card is a NEW component, not a CollectionFitCard variant.** Lives at `src/components/insights/ReferenceIdentityCard.tsx` (sibling to CollectionFitCard). Renders the catalog taste signature with no fit-judgment. Reuses no engine code; reads CAT-13 taste fields directly as props.
- **D-39b-02 — Card content (all 6 CAT-13 taste fields, structured).** Top row: era (e.g., "Modern era, c. 2000-2020") + primary archetype (e.g., "Heritage tool dive") as text headline. Middle row: three sparkline-pill scales for formality (0-1), sportiness (0-1), heritageScore (0-1) with low/mid/high tick marks. Bottom row: design motifs (Phase 19.1 closed-vocab string array) as small chip cluster. Confidence shown ONLY as a muted subtitle ("Inferred taste signature") when confidence >= 0.5 — no numeric confidence percentage displayed.
- **D-39b-03 — Confidence gate.** `if (catalogTaste === null || catalogTaste.confidence < 0.5)` → suppress ReferenceIdentityCard, fall back to CTA-only render. Matches the project-wide 0.5 gate (Phase 19.1 D-13, Phase 20 viewerTasteProfile, Phase 38 D-02). Honest about data quality.
- **D-39b-04 — Identical rendering on `/watch/{id}` and `/catalog/{id}`.** One component, two callsites. `/catalog/{id}` passes catalogEntry's taste fields directly; `/watch/{id}` reads via `watch.catalogTaste` (already populated by Phase 38 D-10 LEFT JOIN). Visual placement on both pages: where CollectionFitCard currently sits (which is currently blank in the empty-collection branch). CTAs render BELOW the ReferenceIdentityCard.

**Lineage browse rails (NSV-02/16):**

- **D-39b-05 — Inline rails only, no `/family/{familyId}` page.** `/family/{id}` deferred to v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module. Phase 39b ships ONLY the inline rails on `/watch/{id}` and `/catalog/{id}`.
- **D-39b-06 — Two rails per surface: "Same family" + "Lineage".** "Same family" sources from `watches_catalog` rows with matching `family_id` (excluding the current ref), capped at 6, sorted by some heuristic TBD (collector-popularity? alphabetical?). "Lineage" sources from `watch_lineage_edges` via the Phase 35 `getLineageForReference()` recursive CTE (depth-guard 10), labeled by `relationship_type` (predecessor / successor / remake / tribute / homage). Cards: DiscoveryWatchCard pattern reused from `/explore` Trending/Gaining rails.
- **D-39b-07 — Hide-rail-if-empty graceful degradation.** No "No siblings yet" empty state — the module is absent if it has no data. Matches SEED-008 "modules with missing data degrade gracefully — never empty." Reduces visual dead-ends from sparse curation data.
- **D-39b-08 — Operator-curation seed pass ships INSIDE Phase 39b.** Phase 39b plan list includes a dedicated curation plan (could be Wave 0 or a sidecar plan) that seeds ~20 high-signal `family_id` values + ~15 manual lineage edges. Operator-author writes the seed list during plan execution. Without this, the rails would be permanently absent at v5.0 ship on most catalog refs. NO admin UI in Phase 39b — direct DB writes via a `scripts/seed-lineage.ts` operator script with idempotent ON CONFLICT semantics. Admin UI is v5.x territory.

### Claude's Discretion

- **Phase 39 wave packaging** — three Phase 39 items (NSV-01+15, NSV-08 verify-and-patch, NSV-12 fallback) can ship in 1-3 plans. NSV-01+15 and NSV-08 are component-level patches; NSV-12 is a route-level reshape. Planner discretion to package as one omnibus plan or three small plans.
- **NSV-12 fallback page copy refinement** — the D-10 copy is a starting point; planner can refine the prose during plan authoring as long as the structural decision (Card with profile context + 2 walk-back CTAs) holds.
- **Reference Identity card visual treatment** (Phase 39b) — sparkline-pill style vs horizontal bar style vs concentric dot pattern. UI-SPEC for Phase 39b shapes this; design tokens already exist in the project. Planner picks the cleanest interpretation of D-39b-02.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 39: Audit-Driven Discovery Polish" — phase goal + 5 success criteria. **Requires update after this discuss-phase**: drop SC#3 (DISC-09 editorial slot), insert Phase 39b, update Phase 40 dependency from "depends on Phase 39" to "depends on Phase 39b" where appropriate.
- `.planning/REQUIREMENTS.md` §DISC-09 §DISC-11 — DISC-09 to be moved out of v5.0 active list per D-05; DISC-11 stays as the umbrella requirement for Phases 39 + 39b dead-end closures.
- `.planning/PROJECT.md` — v5.0 milestone trajectory; **requires v5.1 milestone insertion** after this discuss-phase (between v5.0 and SEED-007 pricing spike).

### Audit substrate (load-bearing)
- `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — IMMUTABLE Phase 33 click-path table (136 rows). Phase 39 + 39b plans cite DISC-AUDIT-NN row ids from this file.
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` — Phase 33b north-star audit. Q1/Q2/Q3/Q4 verdicts at `## Decisions`. NSV-NN row ids cited by Phase 39 + 39b plans. Phase 33b Q3 § Decisions delivers the sorted patch-cost-ascending backlog this discussion consumed.

### CAT-13 / catalog taste inheritance (load-bearing for Phase 39b)
- `.planning/phases/38-cat-13-engine-rewire/38-CONTEXT.md` — CAT-13 implementation decisions. D-02 (confidence ≥ 0.5 gate) and D-10 (Watch.catalogTaste LEFT JOIN) are load-bearing for Phase 39b D-39b-03 + D-39b-04.
- `src/lib/types.ts:214-223` — `CatalogTasteAttributes` interface. Phase 39b ReferenceIdentityCard consumes this shape directly.
- `src/lib/taste/vocab.ts` — Phase 19.1 closed vocab for `primaryArchetype` + `eraSignal` + `designMotifs`. ReferenceIdentityCard renders these values; UI may need short display labels per enum value (TBD during Phase 39b UI-SPEC).

### Catalog hierarchy schema (load-bearing for Phase 39b lineage rails)
- `.planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` — CAT-15 brands + watch_families schema decisions. `family_id` FK semantics + indexes.
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-CONTEXT.md` — CAT-16 lineage edges + `getLineageForReference()` recursive CTE. D-39b-06 sources from this.
- `src/data/hierarchy.ts` — Phase 35 DAL with `getLineageForReference(catalogId)` recursive CTE (depth-guard 10). Reused by Phase 39b lineage rails.

### Phase 18 /explore current state (Phase 39 does NOT touch /explore but planner needs awareness)
- `src/app/explore/page.tsx` — current 3-rail layout (PopularCollectors + TrendingWatches + GainingTractionWatches + conditional ExploreHero). DISC-09 was scoped for this surface but is now deferred to v5.1.

### v5.1 milestone seed (new — captures DISC-09 successor scope)
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` — 5-module Explore redesign promoted from DISC-09. SUPERSEDES DISC-09. Reference for v5.1 milestone planning post-v5.0.

### Code-context anchors for Phase 39 patches
- `src/components/insights/CollectionFitCard.tsx:62-81` — NSV-01+15 mostSimilar Link wrap site.
- `src/components/insights/SleepingBeautiesSection.tsx:43-51` — NSV-08 verification site (already wraps).
- `src/components/insights/GoodDealsSection.tsx` — NSV-08 verification site (status unknown — plan checks).
- `src/app/u/[username]/[tab]/page.tsx:80-101` — NSV-12 common-ground gate logic. Line 87 (`if (!overlap || !overlap.hasAny) notFound()`) is the reshape target.
- `src/app/u/[username]/common-ground-gate.ts` — common-ground resolution helper; check whether the fallback render can reuse the gate's existing return shape or needs an extended one.

### Code-context anchors for Phase 39b (carry-forward)
- `src/app/watch/[id]/page.tsx` — fresh-account verdict suppression site (G-6 branch).
- `src/app/catalog/[catalogId]/page.tsx:79-113` — fresh-account verdict suppression site (G-4 branch). Lines 112-113 comment ("verdict stays null AND actionsSpec stays null — no card, no CTAs") is the explicit reshape target.
- `src/components/profile/LockedTabCard.tsx` — NSV-14 sub-cell #1 (Connect/Follow CTA addition target).
- `src/components/profile/WornCalendar.tsx` — NSV-14 sub-cell #2 (day-cell onClick addition target).
- `src/components/profile/StatsTabContent.tsx` — NSV-14 sub-cell #3 (Link wrap target).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`CollectionFitCard.tsx` mostSimilar list at lines 63-81** — direct edit target for NSV-01+15. The `<li>` rows are already flex-layout containers; wrapping the inner content in `<Link>` preserves the layout. Phase 20 import-boundary guard does not block `next/link`.
- **`SleepingBeautiesSection.tsx:43-51`** — REFERENCE PATTERN for what a Link-wrapped section looks like. Already shipped. Plan should mirror this shape if `GoodDealsSection.tsx` needs the same treatment.
- **`src/app/u/[username]/[tab]/page.tsx`** — has a clean branching structure with `notFound()` calls at distinct gate failures. The no-overlap branch (line 87) can be cleanly extracted into a fallback render without affecting the other two gate failures.
- **`computeViewerTasteProfile` (`src/lib/verdict/viewerTasteProfile.ts`)** — Phase 20 aggregate pattern that consumes `catalogTaste` at confidence ≥ 0.5. Phase 39b ReferenceIdentityCard does NOT use this (it renders one catalog's taste, not an aggregate) but the gate semantics are identical.
- **`Watch.catalogTaste` field (Phase 38 D-10)** — LEFT JOIN already populates this on every Watch returned by `getWatchesByUser`. Phase 39b ReferenceIdentityCard on `/watch/{id}` reads it without new DAL work.
- **`getLineageForReference(catalogId)` recursive CTE (`src/data/hierarchy.ts`)** — Phase 35 ships this with depth-guard 10. Phase 39b lineage rails consume it directly.
- **`DiscoveryWatchCard` (`src/components/explore/DiscoveryWatchCard.tsx`)** — reused by Phase 39b lineage rails on `/watch` + `/catalog`. Same card shape as `/explore` Trending/Gaining rails.

### Established Patterns

- **Two-layer privacy on cross-user reads** — Phase 39b NSV-18 catalog roster MUST follow the established `profile_public = true` AND `collection_public = true` AND viewer-self-exclusion pattern (Phase 19 SRCH-12 / Phase 18 D-09).
- **Module-absent-not-empty pattern** — Phase 39b lineage rails (D-39b-07) and SEED-008 modules both follow this. Hide modules with no data instead of rendering empty-state cards.
- **Static guard tests for import boundaries** — `tests/static/CollectionFitCard.no-engine.test.ts` enforces that the verdict card has no engine imports. Phase 39b ReferenceIdentityCard is a NEW component; planner should consider whether an analogous import-boundary guard applies (probably yes — taste rendering should not import similarity.ts).
- **`'use client'` directive only when needed** — Phase 39 NSV-12 fallback page is rendered server-side; do not add `'use client'`. Phase 39b ReferenceIdentityCard is also a pure presentation component — server component unless a CTA needs client interactivity.
- **Plan-internal "verify before patch"** — D-08 codifies this for NSV-08. Pattern generalizes: any audit-row patch should grep the current codebase first because the 33-DISCOVERY-AUDIT.md snapshot is dated 2026-05-08.

### Integration Points

- **`/watch/{id}` + `/catalog/{id}`** — both surfaces gain (Phase 39b) Reference Identity card + (Phase 39b) Lineage rails. Phase 39 does NOT touch these surfaces except via the shared CollectionFitCard component edit (NSV-01+15).
- **`/u/{username}/common-ground` route** — Phase 39 reshapes the no-overlap branch to a soft fallback. Other gates unchanged.
- **`/u/{username}/{tab}` profile surfaces** — Phase 39b LockedTabCard / WornCalendar / StatsTabContent get NSV-14 sub-cluster patches. Phase 39 does NOT touch these.

</code_context>

<specifics>
## Specific Ideas

- **Reference Identity card visual spec** (Phase 39b): three sparkline-pill scales for formality / sportiness / heritage. "Sparkline-pill" = pill-shape (rounded-full) with a filled-bar interior representing the 0-1 value. Tick marks at 0 / 0.5 / 1. Color tokens from existing palette (foreground/muted-foreground/accent). Design motifs render as small `Badge` variants from `src/components/ui/badge.tsx`.
- **NSV-12 fallback page voice** (Phase 39): "You and @{username} don't share any watches in your collections" — explicitly two-collector framing. CTAs are walk-back affordances (Rdio principle: never let the viewer feel lost). Avoid apologetic tone ("Sorry, no overlap"); the page state is informational, not error.
- **Lineage rail labels** (Phase 39b): "Same family" + "Lineage" as the two rail headers. Inside the Lineage rail, each card's `relationship_type` shows as a small chip below the watch ID (e.g., "Predecessor of this watch" / "Tribute to this watch"). The Phase 35 enum {successor, predecessor, remake, tribute, homage} maps to display labels TBD during Phase 39b UI-SPEC.
- **Curation seed list shape** (Phase 39b): operator-author writes ~20 `family_id` updates + ~15 `watch_lineage_edges` rows as a `scripts/seed-lineage.ts` operator script. Idempotent via `INSERT ... ON CONFLICT DO NOTHING` on edges and `UPDATE ... WHERE family_id IS NULL` on family assignments. Operator targets families they actually browse (Submariner, Speedmaster, Royal Oak, Sub homages) so the rails populate where collector encounters are most frequent.

</specifics>

<deferred>
## Deferred Ideas

- **v5.1 milestone — 5-module /explore redesign** per `.planning/seeds/SEED-008-v5.1-explore-redesign.md`. SUPERSEDES original DISC-09. Modules: Hero (rotating, curated-list-sourced) / Collector Archetypes (chip rail) / Curated Lists Rail (CMS-authored) / Where Collections Go (collection paths) / Browse the Catalog (brand/era/genre/price-band indices). Pre-roadmap research: CMS approach decision (in-app admin vs Sanity vs Contentlayer). Phase count estimate: 3-4 phases. v5.1 starts AFTER v5.0 closes; runs BEFORE SEED-007 pricing API spike and v6.0 Market Value per user intent.
- **`/family/{familyId}` dedicated page** — deferred to v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module (which already includes a Brands + Genres index pattern that would extend cleanly to Families).
- **`/catalog/{id}` explicit predecessor/successor chain visualization** ("Replaced by → X / Tribute to ← Y") — Phase 39b ships rails only; chain visualization is a v5.x polish item if it adds value beyond the inline Lineage rail.
- **Admin UI for lineage edge curation** (`/admin/lineage` form) — Phase 39b uses a `scripts/seed-lineage.ts` operator script instead. Admin UI is v5.x; warrant only when the seed list outgrows what's comfortable in code.
- **NSV-41 search inline-expand fresh-account verdict** — Phase 33b marked NSV-41 as partial med (lower leverage than NSV-06/NSV-20). NOT in Phase 39 or 39b. ReferenceIdentityCard component (Phase 39b D-39b-01) COULD be reused on `/search` inline-expand later if the leverage rerates upward.
- **All 21 med/low-leverage Phase 33b cells** (NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41) — explicitly DEFERRED to v5.x per Phase 33b Q3 verdict.
- **WishlistRail drag-handle silent no-op** (DISC-AUDIT-99 / NSV-14 sub-cell) — Phase 33b A2 classified this as "wired-but-broken" not "missing dead-end." Belongs in its own bugfix ticket, not NSV-14's add-affordance scope.
- **Confidence numeric percentage display** on Reference Identity card — D-39b-02 explicitly chose no numeric percentage (subtitle only). Reconsider if user feedback indicates the audience wants more transparency on inference quality.

</deferred>

---

## Required follow-up paperwork (outside this discuss-phase)

These updates need to happen BEFORE Phase 39 planning starts (or Phase 39b discuss-phase runs). Cleanest order:

1. **`/gsd-phase`** — insert Phase 39b in ROADMAP.md right after Phase 39. Phase 39b inherits 4 success criteria mapped from D-39b-01..08. Phase 40+ dependency lines update to "depends on Phase 39b" where the audit-conditional polish is the load-bearing dependency.
2. **`REQUIREMENTS.md` edit** — strike DISC-09 from v5.0 active list; add v5.1 milestone reference pointing to SEED-008. Update Phase 39 success criteria to drop the DISC-09 line.
3. **`PROJECT.md` edit** — insert v5.1 Explore Redesign milestone in the v4.1 → v5 → v6 trajectory section.
4. **Memory update** — add a memory note for the v5.0 → v5.1 reshape + SEED-008 promotion so future conversations don't re-litigate the DISC-09 question.
5. **`/gsd-plan-phase 39`** — kick off Phase 39 planning with the now-final Phase 39 scope (3 items, no DISC-09).

---

*Phase: 39-Audit-Driven Discovery Polish*
*Context gathered: 2026-05-12*

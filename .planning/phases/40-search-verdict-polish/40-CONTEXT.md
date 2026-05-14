# Phase 40: Search & Verdict Polish - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

**Phase 40 ships two distinct UX additions over already-populated catalog data:** (1) three faceted filters on the `/search` Watches tab (SRCH-16) — Movement Type, Case Size, Style — with a mobile-first bottom-sheet trigger and URL-shareable state, and (2) a pairwise drill-down section in `CollectionFitCard` (FIT-05) that renders a 2-column side-by-side compare against the viewer's closest owned watch using only CAT-13 taste dimensions.

**No new data models, no engine changes, no new schema.** Phase 35 (`movement_type` enum), Phase 36 (clean-slate + variant split), and Phase 38 (CAT-13 engine rewire + `Watch.catalogTaste` LEFT JOIN) all shipped. SRCH-16 + FIT-05 are reads-only consumers of that work.

### In scope (Phase 40)

1. **SRCH-16 — Three faceted filters on `/search` Watches tab.**
   - Movement Type chip group sourcing from `watches_catalog.movement_type` enum (`auto` / `manual` / `quartz` / `spring_drive`)
   - Case Size chip group with 5 pre-defined bands: `<36` / `36-39` / `40-42` / `43-45` / `46+` (sourced from `watches_catalog.case_size_mm`)
   - Style multi-select chip group with top 8 chips by frequency from `watches_catalog.style_tags` (OR-logic within facet)
   - Browse mode: facets work without `q` — clicking any facet triggers a fetch even with empty query (lifts the 2-char DAL gate)
   - URL params: `?q=&movement=auto&size=40-42&style=tool,diver` — comma-joined multi
   - Filter trigger: inline button above results on all widths, opens single bottom-sheet `Sheet` (already at `src/components/ui/sheet.tsx`)
   - DAL: `searchCatalogWatches` extends with `movement_type`, `case_size_mm`, `style_tags` predicates — test asserts `movement_type` enum column reference (not deprecated `movement` free-text)

2. **FIT-05 — CollectionFitCard pairwise drill-down section.**
   - Always-visible 2-column section below the existing `mostSimilar` list (no accordion, no chevron)
   - Auto-targets the top-1 mostSimilar match — `verdict.mostSimilar[0]` is the comparison
   - Renders 6 CAT-13 taste fields: `formality`, `sportiness`, `heritageScore`, `primaryArchetype`, `eraSignal`, `designMotifs`
   - Delta row at bottom — single highest-delta dimension as one plain-language phrase ("This is more formal" / "Different archetype: heritage tool vs dress")
   - Confidence gate: if `verdict.mostSimilar[0]` or candidate has `catalogTaste === null` or `confidence < 0.5`, the entire drill-down section hides (module-absent-not-empty)
   - Pure-render — must NOT import `@/lib/similarity` or `@/lib/verdict/composer`; existing `tests/static/CollectionFitCard.no-engine.test.ts` guard remains green

### Out of scope (Phase 40)

- Range slider for Case Size — chip bands only (REQUIREMENTS.md says "numeric range slider" but ROADMAP says "chip group"; chip group wins per discussion D-05)
- Search filters on People / Collections / All tabs — Watches tab only
- Apply button inside the sheet — chips commit on tap, matching the no-debounce contract
- Active facet count badge logic beyond a simple integer count
- Picker to swap which owned watch is compared in FIT-05 — always top-1 mostSimilar
- Spec rows (case size, movement, dial color) in the FIT-05 compare table — taste fields only
- New `/family/{familyId}` page — already deferred per Phase 39 D-39b-05
- NSV-41 search inline-expand fresh-account verdict — deferred per Phase 39 backlog

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 40 uses the `D-NN` prefix. Decisions group by the four discussion areas.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 35 D-03 — `movement_type` is the pgEnum column at `watches_catalog.movement_type`.** SRCH-16 Movement Type chip MUST query this column, not the deprecated free-text `movement`. ROADMAP §Phase 40 SC#4 enforces this with a test assertion.
- **Phase 38 D-10 — `Watch.catalogTaste` populated via `getWatchesByUser` LEFT JOIN.** FIT-05 drill-down reads CAT-13 taste fields from `verdict.mostSimilar[i].watch.catalogTaste` and the candidate's own `catalogTaste` (already in the verdict bundle). No new DAL work needed.
- **Phase 19.1 D-13 / Phase 20 viewerTasteProfile / Phase 38 D-02 — `confidence >= 0.5` is the project-wide taste consumption gate.** FIT-05 D-15 inherits this for the drill-down's hide-if-either-side-low-confidence rule.
- **Phase 20 D-04 — `CollectionFitCard.tsx` is a pure renderer.** No engine imports. FIT-05 extension keeps this invariant; `tests/static/CollectionFitCard.no-engine.test.ts` stays green.
- **Phase 39 D-07 — `mostSimilar` rows are `<Link>`-wrapped.** FIT-05 sits BELOW that list, not inside individual rows. Phase 39 work survives.
- **Phase 19 SRCH-09 search DAL idiom — `searchCatalogWatches` uses ILIKE on brand/model/reference + pre-LIMIT 50 candidate cap + popularity-DESC + alphabetical tie-break (`src/data/catalog.ts:293`).** Phase 40 extends the WHERE clause with facet predicates while preserving the existing candidate-cap + ranking shape.
- **Phase 19 D-03 — 250ms `q` debounce + 2-char minimum.** Phase 40 D-02 carves out facets as instant (no debounce); the 2-char `q` minimum is lifted only when `q` is empty AND ≥1 facet is active (browse mode).

### Area 1 — Facet URL contract + interaction with `q` (D-01 through D-04)

- **D-01 — Browse mode: facets work without `q`.** Selecting any facet with empty `q` triggers a fetch. DAL: `searchCatalogWatches` lifts the `trimmed.length < 2` early-return when at least one facet predicate is active. Empty result + no facets + empty q still returns `[]` (pre-query state preserved). The "Search by brand, model, or reference number" pre-query empty-state copy is shown only when q is empty AND no facets active.
- **D-02 — Facets fire instantly, no debounce.** Chip click → URL update + immediate `searchWatchesAction` call. Separate code path from the 250ms `q` debounce in `useSearchState`. Rationale: facets are discrete intent (one click = one decision); typing has intermediate keystrokes that benefit from debouncing.
- **D-03 — URL params: separate per facet, comma-joined for multi.** `?q=sub&movement=auto&size=40-42&style=tool,diver`. Single-value facets (`movement`, `size`) are scalar; `style` is comma-joined since multi-select. Decode via `URLSearchParams.get('style')?.split(',') ?? []` (empty string filtered). Round-trips through browser back/forward + share-link paste.
- **D-04 — Watches tab only.** Facets render only on Watches tab. URL params survive tab switches (so user can navigate Watches → People → Watches and keep filters), but they do NOT influence People / Collections / All DAL paths. `useSearchState` reads facet params unconditionally; the Watches sub-effect is the only consumer.

### Area 2 — Case Size buckets + Style vocab source (D-05 through D-08)

- **D-05 — Case Size = 5 chip bands.** Exactly `<36` / `36-39` / `40-42` / `43-45` / `46+`. Each chip maps to a DAL `between()` predicate. URL value uses kebab band: `?size=36-39`. `<36` URL value is `?size=lt36`; `46+` is `?size=46plus` (avoid URL-unsafe `<` and `+`). **Note:** REQUIREMENTS.md SRCH-16 says "numeric range slider"; ROADMAP §Phase 40 SC#1 says "Case Size chip group". This decision resolves the contradiction in favor of chip group — simpler, matches Movement / Style chip-group idiom, single component pattern. REQUIREMENTS.md must be updated to reflect this resolution.
- **D-06 — Style chip vocab: top 8 by frequency from `watches_catalog.style_tags`.** A new DAL function (or extension of existing) computes top 8 distinct tags ordered by frequency DESC. The chip set is computed once per request (or cached) — not per keystroke. No overflow expander; long-tail tags accessible via the `q` text query path.
- **D-07 — Style multi-select uses OR-logic within facet.** Selecting "tool" + "diver" returns watches tagged with EITHER. DAL: `style_tags && ARRAY['tool','diver']` (Postgres `&&` overlap operator). Across facets, predicates AND-narrow (movement AND size AND style). This is the standard faceted-search interpretation.
- **D-08 — NULL rows excluded when their facet is active.** Catalog rows with `movement_type IS NULL` are filtered out when Movement Type chip is selected; same for `case_size_mm IS NULL` when Case Size chip is active. DAL adds `IS NOT NULL` predicates to each active facet. Style is array-typed (default `'{}'`) so empty array fails the `&&` overlap naturally — no special handling. Honest about data quality; matches Phase 19.1 / 38 confidence-gate philosophy.

### Area 3 — Mobile bottom-sheet UX placement (D-09 through D-11)

- **D-09 — Filter trigger: inline button above results, active-count badge.** Renders between the `<Tabs>` row and the `WatchSearchRowsAccordion`. Scrolls with the page (NOT sticky). Badge shows total active facet count as integer — e.g., `Filter` → `Filter (1)` → `Filter (3)`. Count includes each style chip individually (so `style=tool,diver` adds 2). Single button = single discoverable affordance.
- **D-10 — Same bottom-sheet on all widths.** `Sheet` primitive (`src/components/ui/sheet.tsx`) with `side='bottom'`. Renders identically on mobile and desktop. Single component path, single UI-SPEC. `/search` page max-width is `max-w-3xl` (mobile-shaped) anyway. Avoids responsive-branch complexity.
- **D-11 — Commit on chip-tap inside the sheet, no Apply button.** Tap a chip → URL updates → results update behind the sheet. User can leave sheet open and see live URL state (and via results count outside the sheet) or dismiss it. Footer has only "Clear all" affordance + drag-handle close. Matches the no-debounce contract from D-02 — facets are discrete intent everywhere.

### Area 4 — FIT-05 drill-down trigger + taste dimensions (D-12 through D-16)

- **D-12 — Drill-down placement: always-visible section below `mostSimilar`.** No accordion, no chevron, no expand state. New section title: "Compare with the [Brand Model] you own" (where `[Brand Model]` = `verdict.mostSimilar[0].watch.brand + ' ' + .model`). Auto-targets the TOP mostSimilar match. Falls back to hidden when `mostSimilar.length === 0` (which already implies viewer collection.length === 0 → CollectionFitCard itself hidden by caller per Phase 20 D-07).
- **D-13 — 2-column layout, max 2 items on mobile per NN/Group.** Left column = candidate (the watch being viewed/searched); right column = `mostSimilar[0].watch`. Mobile (`< sm`) stacks vertically OR shows 2-col compressed — UI-SPEC decides. ROADMAP SC#3 says "max 2 items mobile" — interpreted as: still 2 columns side-by-side, but no third column ever.
- **D-14 — Compare dimensions: 6 CAT-13 taste fields only.** Rows: `formality` (scalar 0–1) / `sportiness` (scalar 0–1) / `heritageScore` (scalar 0–1) / `primaryArchetype` (enum string) / `eraSignal` (enum string) / `designMotifs` (chip cluster). Both columns read from `catalogTaste`. NO `case_size_mm`, NO `movement_type`, NO `dialColor`, NO `style_tags`, NO `role_tags`. Matches ROADMAP SC#3 "only taste-relevant dimensions" literally.
- **D-15 — Confidence gate: hide entire section when either side is low-confidence.** `if (candidate.catalogTaste === null || candidate.catalogTaste.confidence < 0.5 || mostSimilar[0].watch.catalogTaste === null || mostSimilar[0].watch.catalogTaste.confidence < 0.5)` → render nothing. Other CollectionFitCard sections (headline, mostSimilar, role overlap) still render. Module-absent-not-empty pattern (Phase 39 D-39b-07 / SEED-008).
- **D-16 — Delta row: single highest-delta dimension as plain-language phrase.** Algorithm:
   1. For each scalar dimension (formality / sportiness / heritageScore), compute `|candidate - mostSimilar|`.
   2. For categorical dimensions (primaryArchetype / eraSignal), score is `0` if equal, `1` if different.
   3. For designMotifs (string[]), score is `1 - jaccard(a, b)`.
   4. Pick the dimension with the largest delta; if all scalar deltas < 0.1 AND all categoricals match AND motifs jaccard ≥ 0.8 → render "Very similar across all taste dimensions" fallback.
   5. Otherwise emit one phrase per dimension type (templates in UI-SPEC):
      - scalar: "This is more {dim}" / "This is less {dim}" with display labels ("formal" / "sport" / "heritage")
      - archetype: "Different archetype: {candidate} vs {mostSimilar}"
      - era: "Different era: {candidate} vs {mostSimilar}"
      - motifs: "Different design motifs"

### Claude's Discretion

- **Sheet internal layout** — exact arrangement of the 3 chip groups inside the bottom-sheet (vertical stack? collapsible sub-sections? section headers?) is for UI-SPEC. Decisions D-09 through D-11 lock the trigger + commit semantics; the internal panel is open.
- **Top-N caching strategy for style vocab** (D-06) — the Top-8 distinct style tags query: planner picks whether to use a Server Component fetch on `/search` page mount, a cache-tagged DAL function with TTL, or a client-side hydrated constant from a separate endpoint. Tradeoffs explored during planning.
- **FIT-05 column header** — "This watch" + "Your [Brand Model]" vs "Reference" + "You own" vs another framing. UI-SPEC picks the cleanest voice.
- **Delta row scalar threshold** (D-16) — `0.1` is the suggested floor for "very similar"; planner may calibrate against actual catalog data during UI-SPEC if 0.1 produces too many "Very similar" fallbacks or too few.
- **Case Size band labels in chip UI** — chip text could be `40-42mm` / `40-42` / `40 to 42mm`. UI-SPEC picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 40: Search & Verdict Polish" — phase goal + 5 success criteria. Note: SC#1 says "chip group" for Case Size while REQUIREMENTS.md SRCH-16 says "numeric range slider" — Phase 40 D-05 resolves in favor of chip group; **REQUIREMENTS.md must be updated post-discuss to remove the contradiction**.
- `.planning/REQUIREMENTS.md` §SRCH-16 §FIT-05 — both gated to Phase 40. SRCH-16 hard-blocked on CAT-16 Layer B `movement_type` enum (Phase 35 shipped 2026-05-10) — dependency satisfied.
- `.planning/PROJECT.md` — v5.0 milestone trajectory (lines 32–34 list SRCH-16 + FIT-05 as Phase 40 target features).

### Catalog hierarchy schema (load-bearing for SRCH-16 DAL)
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-CONTEXT.md` — CAT-16 lineage edges + `movement_type` enum. D-03 establishes `movementTypeEnum` at `watches_catalog.movement_type`; SRCH-16 facet sources from this column.
- `src/db/schema.ts:38` — `movementTypeEnum` pgEnum definition (auto/manual/quartz/spring_drive).
- `src/db/schema.ts:97-103` — `watches_catalog.movement_type` + `case_size_mm` + `style_tags` column shape.

### CAT-13 / catalog taste inheritance (load-bearing for FIT-05)
- `.planning/phases/38-cat-13-engine-rewire/38-CONTEXT.md` — CAT-13 implementation decisions. D-02 (`confidence ≥ 0.5` gate) and D-10 (`Watch.catalogTaste` LEFT JOIN already populated by `getWatchesByUser`) are load-bearing for FIT-05 D-14 + D-15.
- `src/lib/types.ts:214-223` — `CatalogTasteAttributes` interface. FIT-05 compare table consumes this shape directly (6 fields: `formality`, `sportiness`, `heritageScore`, `primaryArchetype`, `eraSignal`, `designMotifs`, plus the `confidence` gate field).
- `src/lib/taste/vocab.ts` — Phase 19.1 closed vocab for `primaryArchetype` + `eraSignal` + `designMotifs`. FIT-05 renders these values; UI-SPEC may need short display labels per enum value.

### Search infrastructure (load-bearing for SRCH-16)
- `.planning/phases/19-search/19-CONTEXT.md` and related Phase 19 artifacts — search foundation: `useSearchState` hook contract, 250ms debounce, 2-char min, URL sync via `router.replace`. SRCH-16 extends this.
- `src/app/search/page.tsx` — Server Component wrapper resolving `viewerId` + `viewerCollection` + `viewerUsername`. Phase 40 may need to thread top-8 style vocab here.
- `src/components/search/SearchPageClient.tsx:247-316` — `WatchesPanel` is the SRCH-16 render target. Filter button + sheet mount here.
- `src/components/search/useSearchState.ts:69-261` — Phase 40 extends this hook with facet state + URL sync + new sub-effect trigger for the Watches sub-effect.
- `src/components/search/WatchSearchRowsAccordion.tsx` — FIT-04 verdict accordion. Not changed by Phase 40 (FIT-05 lives in CollectionFitCard, not the accordion shell).
- `src/app/actions/search.ts:81-107` — `searchWatchesAction` Server Action. Extend with optional facet params (Zod `.strict()` schema needs new optional fields).
- `src/data/catalog.ts:257-389` — `searchCatalogWatches` DAL. Phase 40 extends WHERE clause + lifts 2-char guard when facets present.

### Verdict + CollectionFitCard (load-bearing for FIT-05)
- `src/components/insights/CollectionFitCard.tsx:62-86` — `mostSimilar` list. FIT-05 section renders BELOW this (after line 86, before role-overlap warning at line 89). Already `<Link>`-wrapped per Phase 39 D-07.
- `src/lib/verdict/types.ts:17-35` — `VerdictMostSimilar` and `VerdictBundleFull`. FIT-05 reads `mostSimilar[0].watch` and the candidate watch's `catalogTaste` (already JSON-serializable per Pitfall 3).
- `src/lib/verdict/composer.ts` — `mostSimilar` is computed here; Phase 40 does NOT change composer logic. FIT-05 is purely the renderer-side consumer.
- `tests/static/CollectionFitCard.no-engine.test.ts` — import-boundary guard. FIT-05 work must keep this green (no `@/lib/similarity` or `@/lib/verdict/composer` imports inside CollectionFitCard.tsx).

### UI primitives
- `src/components/ui/sheet.tsx` — `Sheet` / `SheetContent` / `SheetHeader` / `SheetFooter` primitives. `side='bottom'` is the SRCH-16 trigger target.
- `src/components/ui/badge.tsx` — chip render for active facet count + designMotifs cluster.
- `src/components/ui/button.tsx` — filter trigger button + clear-all button inside sheet.

### Phase 39 carry-forward (component shared with FIT-05 site)
- `.planning/phases/39-audit-driven-discovery-polish/39-CONTEXT.md` D-07 — `mostSimilar` rows are `<Link>`-wrapped; FIT-05 must NOT break this.
- `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md` D-39b-07 — module-absent-not-empty pattern. FIT-05 D-15 inherits this for the confidence-gate hide.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`Sheet` primitive (`src/components/ui/sheet.tsx`)** — ready for SRCH-16 mobile bottom-sheet (`side='bottom'`). No new dependency needed.
- **`useSearchState` hook (`src/components/search/useSearchState.ts`)** — already manages `q` + `debouncedQ` + `tab` + 3 result slices with URL round-trip via `router.replace({ scroll: false })`. Phase 40 extends with `movement` / `size` / `style[]` state + facet-instant sub-effect.
- **`searchCatalogWatches` DAL (`src/data/catalog.ts:293`)** — existing ILIKE OR shape with pre-LIMIT 50 candidate cap, popularity-DESC ranking, anti-N+1 viewer-state hydration. Phase 40 extends WHERE with facet predicates while keeping ranking + viewer-state hydration intact. The 260513-hvu hotfix (score-zero predicate moved OUT of WHERE) is preserved.
- **`CollectionFitCard.tsx`** — pure-render contract from Phase 20 D-04. FIT-05 extension keeps it pure-render; new section reads from existing `verdict.mostSimilar[0]` + caller-provided candidate `catalogTaste`. **VerdictBundleFull may need extension to include candidate's own catalogTaste** if not already threaded through — verifier should confirm during planning.
- **`Watch.catalogTaste` field (Phase 38 D-10)** — populated by `getWatchesByUser` LEFT JOIN. FIT-05 reads `mostSimilar[i].watch.catalogTaste` without new DAL.
- **Phase 19 SRCH-13 / D-13 5-cap pattern in `useSearchState`** — already shows how to differentially slice per-tab. SRCH-16 facets are tab-scoped (Watches only) so this pattern doesn't apply directly, but the per-tab sub-effect shape generalizes.

### Established Patterns

- **Pure-renderer + static import-boundary guard** — Phase 20 D-04 pattern. FIT-05 extension must keep `tests/static/CollectionFitCard.no-engine.test.ts` green.
- **Two-layer privacy for cross-user reads** — Phase 19 SRCH-12 / Phase 18 D-09 / Phase 39b D-39b-09. SRCH-16 is single-user (catalog read, not user-data read), so this pattern doesn't apply. Confirmed not load-bearing for Phase 40.
- **URL round-trip via `router.replace({ scroll: false })`** — `useSearchState:99-105`. Phase 40 facet sub-effect uses identical pattern; just adds `movement` / `size` / `style` to the `URLSearchParams` build.
- **`AbortController` per sub-effect** — `useSearchState:148, 192, 236`. Phase 40 Watches sub-effect already has one; the new facet inputs are added to its dep array, so existing abort wiring covers facet changes too.
- **Zod `.strict().max(200)` for Server Action input** — `src/app/actions/search.ts:18-22`. Phase 40 extends the schema with optional facet fields; `.strict()` preserved to block mass-assignment.
- **Module-absent-not-empty** — Phase 39 D-39b-07. FIT-05 D-15 confidence-gate hide follows this pattern.
- **Confidence ≥ 0.5 taste gate** — Phase 19.1 / 20 / 38 / 39b establish this as the project-wide floor. FIT-05 D-15 inherits.

### Integration Points

- **`/search` page** (Server Component) — may need to thread Top-8 style vocab as a prop into `<SearchPageClient>` if computed server-side. Currently threads `viewerId` + `collectionRevision` + `viewerUsername`.
- **`SearchPageClient.tsx` WatchesPanel (lines 247-316)** — single render target for the Filter button + sheet mount.
- **`useSearchState` hook** — single state container for facet values + URL sync. New sub-effect (or new dep on existing Watches sub-effect) handles facet-instant fetches.
- **`searchWatchesAction` Server Action** — new optional facet params; Zod schema extended.
- **`searchCatalogWatches` DAL** — new optional `filters` argument; WHERE predicate composition; 2-char guard lifted when filters present.
- **`CollectionFitCard.tsx`** — new section inserted between `mostSimilar` list (line 86) and role-overlap warning (line 89). Compare table renders inline.
- **`VerdictBundleFull` shape** — possibly extended with `candidateCatalogTaste: CatalogTasteAttributes | null` if not already threaded. Verifier confirms during planning.

</code_context>

<specifics>
## Specific Ideas

- **Case Size chip labels (D-05 / Claude's discretion)** — final label format TBD by UI-SPEC. Options: `<36mm` / `36–39mm` (en-dash) / `40–42mm` / `43–45mm` / `46mm+` is the leading suggestion. URL values stay ASCII-safe: `lt36` / `36-39` / `40-42` / `43-45` / `46plus`.
- **Filter button copy + badge (D-09)** — leading suggestion: `Filter` (no chips active) / `Filter (3)` (3 chips active). Style chip selection counts as N chips, not 1. Single integer in parens, no separate per-facet badges.
- **FIT-05 column header voice (Claude's discretion)** — leading suggestion: left header = "This watch" (the candidate); right header = "Your {brand} {model}" where the owned watch's brand+model substitute in. Mirrors the section title "Compare with the [Brand Model] you own" voice.
- **Delta row "Very similar" fallback (D-16)** — leading copy: "Very similar across all taste dimensions". Voice matches Horlo verdict-card register (calm + analytical, not promotional). Plain text, no emoji.
- **Scalar delta phrasing (D-16)** — `formality` direction labels: "more formal" / "more casual". `sportiness`: "more sport" / "more dressy" (or "less sport"). `heritageScore`: "more heritage" / "more modern". UI-SPEC picks final wording.
- **Browse-mode empty-state copy (D-01)** — when `q` is empty AND ≥1 facet active AND results.length === 0: render "No watches match these filters. Try removing one." (replaces the existing pre-query state copy for the filtered case.)

</specifics>

<deferred>
## Deferred Ideas

- **Range slider variant of Case Size** — D-05 chose chip bands. If user feedback indicates collectors want precise min/max (e.g., 38–41mm range), revisit in v5.x or v6.0 polish. REQUIREMENTS.md SRCH-16 originally specified a range slider; chip group wins for v5.0.
- **Filter on People + Collections + All tabs** — Phase 40 D-04 scopes facets to Watches tab only. Cross-tab faceting could be a v5.x or v6.0 enhancement if usage signals demand.
- **Apply button + staged preview count inside sheet** — D-11 chose chip-tap-commit. If usability tests show users prefer batch-edit semantics, revisit with a "Apply" footer + live count.
- **Picker to swap which owned watch is compared in FIT-05** — D-12 chose top-1 mostSimilar automatically. A dropdown / chip selector to compare against mostSimilar[1] or [2] could come later if mostSimilar list grows or user feedback demands.
- **Spec rows in FIT-05 compare table (case size, movement, dial color)** — D-14 chose 6 taste fields only. Adding visible specs is a v5.x option if collectors say taste-only comparison feels too abstract.
- **NSV-41 — Search inline-expand fresh-account verdict reshape** — Phase 33b / Phase 39 backlog item. NOT in Phase 40. May reuse the Phase 39b `ReferenceIdentityCard` component on `/search` row expand in a future phase.
- **Active facet chip strip above results** (option D in Area 3 question) — alternative to the simple Filter button. Could be added later if discoverability of active filters becomes a usability issue.
- **Sticky filter button on scroll** — D-09 chose inline-scrolls-with-page. Sticky variant deferred unless mobile UAT surfaces a need.
- **Right-side drawer on desktop** (Sheet `side='right'`) — D-10 chose same-bottom-sheet for both widths. Drawer variant available if desktop usage signals indicate left-edge content benefits.

</deferred>

---

## Required follow-up paperwork (outside this discuss-phase)

These should happen before planning starts or during plan execution:

1. **REQUIREMENTS.md edit** — strike "numeric range slider" from SRCH-16 description; replace with "chip group with 5 pre-defined size bands" per D-05. Removes the contradiction with ROADMAP §Phase 40 SC#1.
2. **`VerdictBundleFull` shape audit** — confirm whether the bundle currently includes the candidate watch's own `catalogTaste` (FIT-05 D-14 reads it). If not, extend the type + composer in the same plan that builds the compare table.
3. **/gsd-plan-phase 40** — kick off Phase 40 planning with this CONTEXT.md as primary input.

---

*Phase: 40-Search-Verdict-Polish*
*Context gathered: 2026-05-14*

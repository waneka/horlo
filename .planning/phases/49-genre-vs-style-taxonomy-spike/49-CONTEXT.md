# Phase 49: Genre vs Style Taxonomy Spike - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 49 is a **decision-only spike**. It produces ONE written deliverable — `49-SPIKE.md` — that:

1. Maps every consumer of the `genre` and `style` surfaces in the codebase.
2. Identifies overlap, divergence, and redundancy across those consumers.
3. Recommends one of: consolidate the two, remove one, or keep both — with rationale strong enough to act on.

The spike covers both `genre↔style` AND the genre-internal `genre↔archetype` redundancy surfaced during discussion (see D-04 below). The recommendation may therefore name an "archetype surface unification" path as a sub-recommendation.

**In scope:** the audit; the recommendation document; live-catalog SELECT queries for evidence; reading code across all ~9 consumers identified during scouting.

**Out of scope:** any consolidation, removal, or schema change implementation. Per ROADMAP success criterion #4 + REQUIREMENTS.md "Out of Scope," an implementation ships in v5.2 ONLY if the spike specifically flags a path as cheap AND strongly favored — and only after a new requirement is added mid-milestone (separate flow, not this phase).

**Not in this spike:** the watch-detail architecture decision (Phase 50 / ARCH-01).
</domain>

<decisions>
## Implementation Decisions

### Audit breadth — D-01
- **D-01:** Sweep every consumer of `genre` or `style`, not just the 4 named in TAX-01. A recommendation that misses a hidden callsite ships a regression later. The audit covers, at minimum:
  - `/search` FilterDrawer chips (`GenreChips`, `ArchetypeChips`, `StyleChips`)
  - `searchCatalogWatches({ filters: { genre, archetype, style[] } })` in `src/data/catalog.ts`
  - Similarity engine `src/lib/similarity.ts` — `styleTags` weight (~0.20) + `primaryArchetype` categorical-match (~0.04 of taste budget)
  - `/explore` Browse module (`src/components/explore/BrowseModule.tsx`, `src/data/browse.ts`)
  - `/explore/genres` index page (`src/app/explore/genres/page.tsx` → `getBrowseGenreCounts`)
  - Watch cards (`WatchCard.tsx`, `ProfileWatchCard.tsx`) — display `styleTags[0..2]`
  - `/collection` `FilterBar` (`src/components/filters/FilterBar.tsx`) — multi-select on `styleTags`
  - Preferences UI (`src/components/preferences/PreferencesClient.tsx`) — `preferredStyles`, `dislikedStyles`
  - Profile insights (`src/components/profile/InsightsTabContent.tsx`) — aggregates `styleTags`
  - Add-watch / WatchForm (`src/components/watch/WatchForm.tsx`, `AddWatchFlow.tsx`) — `styleTags` assignment
- The spike doc table must list every consumer with file, callsite line, the field it touches, and what it does at that callsite.

### Genre vs Archetype redundancy — D-02
- **D-02:** Fold the `genre↔archetype` overlap into the spike. `GenreChips` and `ArchetypeChips` both filter `watches_catalog.primary_archetype` with the same 10 values from `PRIMARY_ARCHETYPES`; `src/data/catalog.ts:444-450` uses `primaryArchetypeFilter = filters?.archetype ?? filters?.genre` (archetype wins). This is a genre-side redundancy that the audit cannot honestly omit when answering "should genre be consolidated."
- **D-03:** The spike doc may produce two recommendations — one for `genre↔style` (the original TAX-01 ask) and a sub-recommendation for `genre↔archetype`. If the genre↔archetype unification is "cheap and strongly favored" per ROADMAP criterion #4, it becomes a candidate for the v5.2 mid-milestone requirement addition.

### Spike deliverable — D-04
- **D-04:** Deliverable lives at `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md`. NOT `.planning/research/`. Phase-co-located, same pattern as `48-CONTEXT.md` / future plan/verification artifacts.
- **D-05:** The doc must contain these sections (skeleton — exact ordering and headings are the planner's call, but every section must be present):
  1. **Domain** — restate what the spike is deciding
  2. **Consumer Map** — table with columns: File · Line · Field used · What it does · UI label visible to users
  3. **Overlap & Divergence Matrix** — where the same conceptual axis is expressed twice; where the two fields actually carry different signal
  4. **Live-Catalog Evidence** — embedded numbers from D-07 queries
  5. **Options** — for each of: consolidate, remove genre, remove style, unify archetype/genre surface, keep all as-is. Per option: schema change, UX change, migration needed, irreversibility.
  6. **Decision Matrix** — criteria (UX clarity, schema simplicity, expressive power preserved, migration cost, irreversibility) scored per option
  7. **Recommendation** — primary recommendation (genre↔style) + sub-recommendation (genre↔archetype)
  8. **Cost Estimate per option** — files touched, migrations needed (drizzle + supabase), data backfill required, test surface
  9. **Ship-now eligibility check** — for each recommendation, evaluate "cheap AND strongly favored" against ROADMAP criterion #4. Output: YES / NO / NEEDS-DISCUSSION, with the gate that would trip a mid-milestone requirement add.

### Evidence — D-06, D-07
- **D-06:** Live-catalog SELECTs are part of the spike, not an optional follow-up. "Keep both" vs "consolidate" is a data question — code analysis alone cannot answer how often the two axes actually carry different signal in real data.
- **D-07:** Minimum query set (researcher may add more):
  1. Agreement count: rows where `primary_archetype = X AND X = ANY(style_tags)` (e.g. archetype='dive' AND 'dive' ∈ styleTags) — i.e. does style restate genre?
  2. Divergence count: rows where `primary_archetype IS NOT NULL` but `style_tags` is `'{}'`, and the inverse
  3. Per-archetype top 3 `styleTags` (GROUP BY `primary_archetype`, unnest `style_tags`, COUNT) — tells us whether each genre has a distinctive style fingerprint or whether the same tags appear across all 10
  4. Null coverage: how many catalog rows have `primary_archetype IS NULL` vs how many have `style_tags = '{}'`
  5. Watch-level disagreement examples: 3-5 representative rows where genre and style say different things (or where one is empty and the other isn't)
- Queries are read-only `SELECT` against either prod (single-user, ~100 catalog rows + the user's ~few dozen watches) or the local mirror. Anonymized examples may be embedded inline in the spike doc.

### Hard guardrail (from ROADMAP/REQUIREMENTS) — D-08
- **D-08:** No implementation in this phase. If the spike concludes a path is cheap and strongly favored, that triggers a `/gsd-phase` requirement-add flow — NOT direct execution. The spike output must be the **only** artifact written under `.planning/phases/49-*/` other than the standard plan/verification artifacts.

### Claude's Discretion
- Exact ordering of sections within `49-SPIKE.md` (skeleton in D-05 is mandatory; sequencing is the planner's call).
- Format of the Decision Matrix (numeric scores vs ✓/✗ vs prose) — planner picks whatever reads clearest for the data on hand.
- Whether to break the live-catalog queries into a separate appendix or inline them per finding. Either is fine.
- Whether to query prod or local mirror for D-07. Prefer prod unless the local mirror is known-current; either is safe since the queries are read-only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — TAX-01 (line 17), v5.2 Out of Scope table (lines 43-49 — note row 1 explicitly forbids implementation in this phase), Traceability table
- `.planning/ROADMAP.md` §"Phase 49" (lines 185-194) — phase goal + 4 success criteria, including the cheap-and-strongly-favored escape hatch in SC#4
- `.planning/PROJECT.md` §"Current Milestone: v5.2 Polish + Taxonomy" — spike framing, milestone shape

### Genre / archetype surface (single-value, primary_archetype column)
- `src/db/schema.ts:390` — `primary_archetype: text('primary_archetype')` column definition on `watches_catalog`
- `src/lib/taste/vocab.ts:14-22` — `PRIMARY_ARCHETYPES` const (the 10-value closed vocab)
- `src/lib/archetype-config.ts` — identity copy used by `ArchetypeChips` (e.g. line 67 "Genre Crosser")
- `src/components/search/GenreChips.tsx` — toggle chip with plain display names
- `src/components/search/ArchetypeChips.tsx` — toggle chip with identity copy, SAME 10 values
- `src/components/search/FilterDrawer.tsx:11,86` — hosts BOTH GenreChips and ArchetypeChips
- `src/app/explore/genres/page.tsx` — `/explore/genres` index, plain utility labels
- `src/data/browse.ts:82-105` — `getBrowseGenreCounts()` — `SELECT primary_archetype AS genre, COUNT(*)`
- `src/data/catalog.ts:283-286` — `CatalogSearchFilters.genre` and `.archetype` interface
- `src/data/catalog.ts:444-450` — archetype-wins-over-genre tiebreaker

### Style surface (multi-value, style_tags array)
- `src/db/schema.ts:116` — `styleTags` on `watches` table
- `src/db/schema.ts:377` — `styleTags` on `watches_catalog` table
- `src/db/schema.ts:181-182` — `preferredStyles`, `dislikedStyles` on `user_preferences`
- `src/components/search/StyleChips.tsx` — multi-select chip
- `src/components/filters/FilterBar.tsx:96-147` — collection-page styleTags filter
- `src/components/preferences/PreferencesClient.tsx:109-111` — preferences toggle
- `src/components/watch/WatchCard.tsx:93-105` — displays `styleTags[0..2]`
- `src/components/profile/ProfileWatchCard.tsx:39` — `roleTags?.[0] ?? styleTags?.[0]` fallback
- `src/components/profile/InsightsTabContent.tsx:168` — aggregates `styleTags` for insights
- `src/components/watch/WatchForm.tsx:83,135,270` — assigns `styleTags` on create/edit
- `src/components/watch/AddWatchFlow.tsx:654,688` — propagates `styleTags` through add flow
- `src/lib/similarity.ts:14,170` — `styleTags` weight (`0.25 × 0.80 = 0.20` effective)
- `src/lib/similarity.ts:222-228` — `preferredStyles` / `dislikedStyles` preference adjustment

### Taste enrichment (LLM-derived genre / archetype data)
- `src/lib/taste/vocab.ts` — full closed-vocab definitions + `validateAndCleanTaste`
- `src/lib/types.ts` — `CatalogTasteAttributes`, `PrimaryArchetype`, `EraSignal` types

### Prior context (carry-forward signals)
- `.planning/phases/48-user-facing-bug-fixes/48-CONTEXT.md` — shared `Chip` primitive (D-07/D-08); GenreChips/ArchetypeChips/StyleChips all consume it. ANY recommendation that adds/removes a chip surface lives downstream of the unified primitive.
- `.planning/STATE.md` §"v5.2 Phase Structure" — milestone shape
- MEMORY: `feedback_ui_spec_css_chain_blind_spot` — token-driven theming reminder (not directly load-bearing here, but the spike may surface "GenreChips visually identical to ArchetypeChips" as evidence)
- MEMORY: `project_taste_enrichment_arch_2026_04_29` — Phase 19.5 inserts the LLM-derived structured taste attrs (formality, sportiness, heritage_score, primary_archetype, era_signal, design_motifs); the spike's genre side IS this layer's `primary_archetype`

### Schema / migration ground truth
- `src/db/schema.ts:334-405` — full `watches_catalog` table definition
- `src/db/schema.ts:81-167` — full `watches` table definition
- `src/db/schema.ts:172-214` — `userPreferences` table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 48's unified `Chip` primitive (`src/components/ui/chip.tsx`, per `48-CONTEXT.md` D-07/D-08) — already consumed by GenreChips/ArchetypeChips/StyleChips. Removing any one of these chip components is a clean delete; the primitive stays.
- `PRIMARY_ARCHETYPES` const + `validateAndCleanTaste()` (`src/lib/taste/vocab.ts`) — a single source of truth for the closed vocab. Removing genre means removing `GenreChips` and the `filters.genre` interface field, NOT touching the vocab list (archetype still uses it).
- `searchCatalogWatches` already has the archetype-wins-over-genre tiebreaker — so removing `filters.genre` is a localized DAL change, not a SQL surgery.

### Established Patterns
- The taste/archetype enrichment pipeline is Phase 19.x-shaped: LLM produces a structured object, vocab filter cleans it, columns persist on `watches_catalog`. Removing the `primary_archetype` column would cascade into the enricher, the similarity taste budget (`TASTE_SUB_WEIGHTS.archetypeMatch`), and the `getBrowseGenreCounts` DAL — flagged here so the cost estimate accounts for it.
- `style_tags` is hand-tagged on watches AND extractor/LLM-tagged on catalog rows — two write paths. Any "remove style" recommendation has to account for both.
- Verdict / similarity stays separate from the chip surface — `similarity.ts` reads the field, not the UI label. A UI-only consolidation (e.g. drop `GenreChips`, keep `ArchetypeChips`) doesn't touch similarity.

### Integration Points
- Genre-side: the column is read by similarity, browse counts, the genres index page, and (twice) the FilterDrawer. Five callsites.
- Style-side: the array is read by similarity, the collection FilterBar, the search StyleChips, watch cards (display), profile insights (aggregate), preferences (preferredStyles), and written by WatchForm / AddWatchFlow / extractors. Nine+ callsites.
- The asymmetry matters: removing genre is cheap; removing style is not.

</code_context>

<specifics>
## Specific Ideas

- The user's framing ("genre vs style") originates from a triage observation, not a hard-edge confusion — the spike should test the assumption that these ARE overlapping before concluding they need consolidation. The decision matrix in D-05 §6 must score "keep both" honestly, not as a strawman.
- The `genre↔archetype` finding (D-02) is the surprise of this discussion. If the spike concludes archetype-surface unification is the cheap-and-strongly-favored path, that becomes the v5.2 mid-milestone requirement add — and TAX-01's genre↔style answer may end up being "keep both, but unify the genre side first."
- Live-catalog queries (D-07) should be embedded with raw counts in the spike doc, not paraphrased — downstream readers should be able to re-run them and see the same numbers.
- Per MEMORY `project_db_wipeable_2026_05_09`: prod is currently a single-user DB and TRUNCATE is on the table per-phase. The cost-estimate column in D-05 §8 should distinguish "needs backfill" vs "wipe and re-enrich is acceptable" — the latter is much cheaper here.

</specifics>

<deferred>
## Deferred Ideas

- **Implementing any consolidation/removal in this phase** — explicitly forbidden by ROADMAP SC#4 + REQUIREMENTS Out of Scope. If the spike strongly favors a cheap path, it triggers a new requirement (separate `/gsd-phase` add), not direct execution.
- **Watch-detail architecture (`/catalog/[catalogId]` vs `/watch/[id]`)** — Phase 50 / ARCH-01.
- **Style vocab governance** (open vocab → closed enum, taxonomy of style tags) — a possible v6.0+ follow-up if the spike recommends "keep style but tighten it." Not in scope here.
- **Adding `preferredArchetypes` / `dislikedArchetypes` to userPreferences** to make the genre side preference-aware (currently only style is) — out of scope; would be its own phase if the spike recommends keeping genre.

None of the discussion strayed beyond phase scope otherwise.

</deferred>

---

*Phase: 49-genre-vs-style-taxonomy-spike*
*Context gathered: 2026-05-19*

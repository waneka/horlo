# Phase 19: /search Watches + Collections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 19-search-watches-collections
**Areas discussed:** Watches tab — query + ranking, Watches tab — row UX + Evaluate CTA, Collections tab — search semantics, All tab — composition + order

---

## Watches Tab — Query + Ranking

### Q1: Which catalog fields should participate in the Watches search query?

| Option | Description | Selected |
|--------|-------------|----------|
| Brand + Model (Recommended) | ILIKE against brand + model only; matches Phase 17 GIN footprint exactly | |
| Brand + Model + Reference | Adds reference_normalized; lets users paste '5711/1A' or '116610LN' | ✓ |
| Brand + Model + Reference + Tags | Adds tag-array predicates; risk of noisy matches; better suited to Collections tab | |

**User's choice:** Brand + Model + Reference

### Q2: How should Watches tab results be ranked?

| Option | Description | Selected |
|--------|-------------|----------|
| Popularity score DESC (Recommended) | owners + 0.5*wishlist DESC; mirrors Phase 18 Trending | ✓ |
| pg_trgm relevance DESC | similarity() ranking; classic search behavior | |
| Hybrid: relevance > threshold, then popularity | Best-of-both with more SQL complexity | |
| Alphabetical | Predictable but no signal lift | |

**User's choice:** Popularity score DESC

### Q3: Minimum query length for Watches tab?

| Option | Description | Selected |
|--------|-------------|----------|
| 2 chars (Recommended) | Matches Phase 16 People D-20 consistency | ✓ |
| 3 chars | Slightly tighter; breaks consistency | |

**User's choice:** 2 chars

### Q4: Result cap for /search?tab=watches?

| Option | Description | Selected |
|--------|-------------|----------|
| 20 (Recommended) | Matches Phase 16 People D-22 rhythm | ✓ |
| 50 | More browsable; risk of long scroll on weak signal | |
| 30 | Middle ground | |

**User's choice:** 20

---

## Watches Tab — Row UX + Evaluate CTA

### Q1: How should owned/wishlist state appear on Watches result rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Single contextual pill (Recommended) | Show 'Owned' or 'Wishlist' or nothing; minimal noise | ✓ |
| Dual pills when both apply | Both labels for variant-of-grail edge cases | |
| Subtle inline icon, no text | Tiny check / bookmark; relies on icon literacy | |

**User's choice:** Single contextual pill

### Q2: How should already-owned watches behave in results?

| Option | Description | Selected |
|--------|-------------|----------|
| Show + badge inline (Recommended) | Owned watches stay; user may want to identify/compare | ✓ |
| Push to bottom in 'In your collection' section | Two sub-sections per page; more structure, more scroll | |
| Filter out entirely | Hides own watches from search | |

**User's choice:** Show + badge inline

### Q3: What should be clickable on each Watches result row?

| Option | Description | Selected |
|--------|-------------|----------|
| Whole row + raised CTA (Recommended) | Absolute-inset Link; CTA z-10 raise; mirror PeopleSearchRow | ✓ |
| Button only — row is display-only | Only Evaluate button clickable | |
| Image-area + CTA, name area is non-interactive | Hybrid; less common | |

**User's choice:** Whole row + raised CTA

### Q4: Where does the inline 'Evaluate' CTA point in Phase 19?

| Option | Description | Selected |
|--------|-------------|----------|
| /evaluate?catalogId={uuid} — ship interlocked (Recommended) | Phase 19 + Phase 20 ship close together; brief 404 risk | ✓ |
| Phase 20-aware feature flag | Render CTA only when Phase 20 ships | |
| Stub /evaluate page that says 'coming soon' | Throwaway placeholder | |

**User's choice:** /evaluate?catalogId={uuid} — ship interlocked

---

## Collections Tab — Search Semantics

### Q1: How should by-watch-identity and by-tag-profile compose in the Collections tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Unified query (Recommended) | One query against brand + model + style_tags + role_tags + complications | ✓ |
| Split sub-results: 'By watch' then 'By tag' | Two stacked sections per result page | |
| Mode toggle (segmented control) | User picks Watch or Tag mode before query | |

**User's choice:** Unified query

### Q2: How should tag matching work in the unified query?

| Option | Description | Selected |
|--------|-------------|----------|
| Substring ILIKE on tag elements (Recommended) | EXISTS(SELECT FROM unnest(...) t WHERE t ILIKE %q%) | ✓ |
| Exact case-insensitive match only | Precise but requires user to know tag taxonomy | |
| Tags participate only when q matches a known tag value | Server-side vocabulary lookup; needs Phase 17 deferred audit | |

**User's choice:** Substring ILIKE on tag elements

### Q3: How should each Collections row signal WHY this collector matched?

| Option | Description | Selected |
|--------|-------------|----------|
| Matched-watch mini-thumbs + count (Recommended) | Mirror Phase 16 PeopleSearchRow shared-watch cluster but show matched watches | ✓ |
| Plain count + descriptor | 'Tyler owns 3 Speedmasters'; text only | |
| Same row shape as People tab + match count footer | Maximum consistency with overlap pct + bio | |

**User's choice:** Matched-watch mini-thumbs + count

### Q4: Minimum query length for Collections tab?

| Option | Description | Selected |
|--------|-------------|----------|
| 2 chars (Recommended) | Consistent with People + Watches tabs | ✓ |
| 3 chars | Tighter; breaks tab consistency | |

**User's choice:** 2 chars

---

## All Tab — Composition + Order

### Q1: Section order top-to-bottom on /search?tab=all?

| Option | Description | Selected |
|--------|-------------|----------|
| People → Watches → Collections (Recommended) | People-first per project vision | ✓ |
| Watches → People → Collections | Object-first; surfaces catalog row before collectors | |
| People → Collections → Watches | Social signals grouped; catalog row last | |

**User's choice:** People → Watches → Collections

### Q2: Per-section headers + 'See all' links inside the All tab?

> Note: User asked a clarifying question between Q1 and Q2 about the difference
> between People and Collections tabs. Reformulated answer was provided
> (People = match identity; Collections = match what they own) before re-asking
> Q2-Q4.

| Option | Description | Selected |
|--------|-------------|----------|
| Header + 'See all' link per section (Recommended) | Heading per section; See-all link when capped at 5 with more available | ✓ |
| Header only, no See-all link | Plain heading; manual tab switch | |
| No headers, three blocks of 5 stacked | Visually unified; loses structural cue | |

**User's choice:** Header + 'See all' link per section

### Q3: How should the three sections render while results stream in?

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel fetch + per-section skeletons (Recommended) | 3 server actions in parallel; each section paints when ready | ✓ |
| Sequential: people first, then others | Visible progress; longer time-to-first-paint of full page | |
| Wait-for-all-three skeleton | Single skeleton until all 3 resolve; cleanest visual but worst latency | |

**User's choice:** Parallel fetch + per-section skeletons

### Q4: How should Collections results be ranked?

| Option | Description | Selected |
|--------|-------------|----------|
| Match count DESC, then taste overlap DESC (Recommended) | Primary: match count; secondary: viewer↔collector overlap; tie-break username | ✓ |
| Taste overlap DESC, match count DESC | Primary: overlap; secondary: match count; surfaces 'most like you' first | |
| Match count DESC, then username ASC | No overlap computation; simpler but loses signal | |

**User's choice:** Match count DESC, then taste overlap DESC

---

## Claude's Discretion

The following decisions were left for the planner to make:

- ILIKE substring vs `pg_trgm.similarity()` ranking for Watches query (default: ILIKE substring + popularity ORDER BY)
- Whether to add a `reference_normalized` GIN trigram index in this phase (acceptable Seq Scan at v4.0 scale)
- DAL function placement (`src/data/catalog.ts` vs `src/data/search.ts` for `searchCatalogWatches`; extend `src/data/search.ts` vs new `src/data/collectionsSearch.ts` for `searchCollections`)
- Server Action contract surface (single `searchAllAction` with discriminated union vs 3 separate actions)
- 'See all' link mechanism (`setTab()` client-side vs `<Link href="?tab=...">` router push)
- Empty-state copy per tab (UI-SPEC owns final copy)
- Skeleton row dimensions for Watches + Collections
- Whether to wire `revalidateTag('search-watches', 'max')` on watches mutations
- Watches tab fallback when score === 0 across the board (early v4.0 deploy with sparse catalog)

## Deferred Ideas

- Filter facets on /search Watches (movement / case size / style) — SRCH-16, v4.x
- Within-collection search via `/u/{user}?q=...` URL param — SRCH-17, v4.x
- Faceted Collections search — out of scope per REQUIREMENTS.md
- `pg_trgm.similarity()` relevance ranking on Watches tab — revisit if popularity-DESC ranking proves wrong-for-query
- Tag taxonomy audit + migration (Phase 17 Deferred Idea)
- `reference_normalized` GIN trigram index on `watches_catalog`
- `searchAllAction` fan-out vs 3 separate Server Actions consolidation refactor
- Cache strategy for Watches tab catalog reads (short-TTL `'use cache'`)

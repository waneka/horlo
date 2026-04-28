# Phase 19: /search Watches + Collections - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the two stub tabs (`?tab=watches` and `?tab=collections`) on the existing 4-tab `/search` shell with real, debounced, two-layer-privacy results. The All tab unions People + Watches + Collections capped at 5 each. Reuse the Phase 16 `SearchPageClient`, `useSearchState`, `<HighlightedText>`, and `<PeopleSearchRow>` shapes unchanged at the contract level — extend `useSearchState` with per-(tab, query) AbortController gating so rapid tab/query switches never display results from the wrong (tab, q) pair.

People tab (existing) matches a collector's **identity** (username + bio). Collections tab (new) matches a collector by **what's in their collection** (watch brand/model + tag elements). Same row shape, different match path.

**Out of scope for this phase:**
- Filter facets on Watches (movement / case size / style) — SRCH-16, v4.x
- Within-collection search via `/u/{user}?q=...` URL param — SRCH-17, v4.x
- Faceted Collections search (filter by tag/role/dial-color) — explicitly excluded per REQUIREMENTS.md
- `/evaluate` route + verdict UI — Phase 20 owns; Phase 19 ships the inline CTA pointing at `/evaluate?catalogId={uuid}` interlocked with Phase 20
- `/watch/{catalogId}` detail page — does not exist; not creating
- Pagination / infinite scroll — capped result lists per project constraint
- Realtime updates / WebSocket subscriptions — free-tier WebSocket cap (project-wide)
- Modifying `analyzeSimilarity()` — catalog remains silent infrastructure (Phase 17 D-12)
- Tag taxonomy audit / migration — deferred future phase before v5.0 catalog→similarity rewire

</domain>

<decisions>
## Implementation Decisions

### Watches Tab — Query + Ranking

- **D-01: Match fields = `brand` + `model` + `reference`.** ILIKE OR predicate against all three. The `brand_normalized` + `model_normalized` GIN trigram indexes from Phase 17 CAT-03 cover the brand/model path. `reference_normalized` matches via the same generated-column normalization (`'5711/1A'`, `'5711-1A'`, `'5711 1A'` collapse to the same key per Phase 17 D-03). Reference search may fall back to Seq Scan at v4.0 scale; acceptable. Tag arrays do NOT participate in Watches tab — too noisy for object search; tags belong to the Collections tab.

- **D-02: Ranking = popularity score DESC + alphabetical tie-break.** `ORDER BY (owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC`. Mirrors Phase 18 Trending Watches. Familiar grail watches (Submariner, Speedmaster) surface above obscure imports for the same query. Exclude rows with score === 0 to keep the rail clean (mirror Phase 18 RESEARCH Pattern 5 noise filter).

- **D-03: Min query length = 2 chars.** Consistent with Phase 16 People D-20. `'Ro'` surfaces Rolex; `'GS'` surfaces Grand Seiko. Server-side gate (DAL trim/length check) is authoritative; client-side gate in `useSearchState` is defense-in-depth.

- **D-04: Result cap = 20.** Mirrors Phase 16 People D-22. Show `Showing top 20` footer when `results.length === 20`. No pagination v4.0 (project constraint).

### Watches Tab — Row UX + Evaluate CTA

- **D-05: Single contextual pill for collection state.** Show `'Owned'` if any of viewer's `watches` has `catalog_id = row.id AND status = 'owned'`; else `'Wishlist'` if `catalog_id = row.id AND status = 'wishlist'`; else no pill. Avoids visual noise on rows the viewer hasn't engaged with. Sold + grail are NOT badged in this surface (sold is gone; grail is wishlist-adjacent — keep the surface scannable). Hydration via single `inArray(watches.catalogId, topIds)` batch (SRCH-10 anti-N+1).

- **D-06: Already-owned watches stay in results, badged inline.** No filter, no separate "In your collection" section. User may want to look up their own watches via /search to identify or compare. Matches Phase 18 "this surface is alive" philosophy.

- **D-07: Whole row is clickable; raised CTA pattern.** Absolute-inset `<Link>` wraps the whole row → `/evaluate?catalogId={uuid}`. Inline `'Evaluate'` button raised with `relative z-10` so its click does not bubble. Same pattern as `PeopleSearchRow` + `SuggestedCollectorRow` (one consistent click-target convention across /search).

- **D-08: Inline 'Evaluate' CTA targets `/evaluate?catalogId={uuid}` — ship interlocked with Phase 20.** Phase 19 + Phase 20 ship close together. If Phase 20 lags, the link 404s briefly; project posture is single-user MVP so the risk is small. No feature flag, no stub /evaluate page. Honors SRCH-09 + EVAL-06 with one decision.

### Collections Tab — Search Semantics

- **D-09: Unified query — single ILIKE OR predicate.** One Server Action / DAL function searches against (per-user `watches.brand`, `watches.model`, `watches.style_tags` elements, `watches.role_tags` elements, `watches.complications` elements). A collector matches if ANY of their watches matches. `'Speedmaster'` matches by brand; `'tool'` matches by tag; same fetch. No mode toggle. No split sub-results.

- **D-10: Tag matching via substring ILIKE on each tag element.** SQL pattern: `EXISTS(SELECT 1 FROM unnest(watches.style_tags) t WHERE t ILIKE %q%)` (and similarly for `role_tags`, `complications`). `'tool'` matches `'tool'`; `'sport'` matches `'sport-watch'` if that variant exists. Forgiving but predictable — doesn't depend on the tag-vocabulary lookup table that the deferred tag-taxonomy phase would introduce.

- **D-11: Row signals match via matched-watch mini-thumb cluster.** Mirror `PeopleSearchRow` shared-watch cluster shape (Phase 16), but show the WATCHES that matched the query rather than shared-with-viewer. `<HighlightedText>` wraps the matched watch's brand/model. Sub-line: `'Tyler — 3 matches'` or `'Tyler — owns Speedmaster + 2 more'`. Tag matches surface as small inline pills next to the matched-watch cluster (planner Discretion: when the match was tag-only, the cluster shows the matched-tag's watches; when both watch-name and tag matched, cluster shows watch-name matches).

- **D-12: Min query length = 2 chars.** Consistent across all tabs.

### All Tab — Composition + Order

- **D-13: Section order top-to-bottom = People → Watches → Collections.** People-first reflects Phase 18 D-09 + project vision ("taste-aware collection intelligence"). Narrative arc: who collects, what they collect, how it composes.

- **D-14: Per-section header + 'See all in [tab] →' link.** Each section has a heading (`'People'`, `'Watches'`, `'Collections'`) and a 'See all' link when capped at 5 with more available (link switches the active tab via `setTab(...)` inside `SearchPageClient` — preserves debounce + query state and feels snappier than a router push). Empty sections render a brief `'No matches'` line, not a hidden section.

- **D-15: Render strategy = parallel fetch + per-section skeletons.** All tab fires 3 fetches in parallel (People, Watches, Collections); each section shows its own skeleton until its fetch resolves. Independent timing — fast sections paint immediately. Mirrors Phase 18 `Promise.all` outside-cache-scope rails philosophy. Whether this ships as 3 separate Server Actions called from the client or 1 `searchAllAction` that fans out internally is Claude's Discretion (planner choice; both honor D-15).

- **D-16: Collections ranking = match count DESC, taste overlap DESC, username ASC.** Primary sort: how many of the collector's watches matched the query (raw count). Secondary: viewer↔collector taste overlap from `computeTasteOverlap` (reuse Phase 16 / `src/lib/tasteOverlap.ts`). Tie-break: `username ASC`. Surfaces "this person owns 5 Speedmasters" before "1 Speedmaster", then frames ties by relevance-to-viewer. Applies to both `/search?tab=collections` AND the Collections section inside the All tab.

### Carry-Forward (locked, not re-decided)

The following decisions from Phase 16 / Phase 17 / Phase 18 are inherited as-is. They will not be revisited at planning time unless this phase exposes a concrete conflict:

- **4-tab shell + `useSearchState` hook** (Phase 16): 250ms debounce, 2-char client minimum, URL sync via `router.replace({scroll: false})`, `'all'` default + `'all'` omitted from URL (D-03/D-04/D-12/D-20)
- **Per-(tab, query) AbortController** (SRCH-14): the existing single-controller pattern in `useSearchState` extends to gate by both `(tab, query)`. Switching tabs while a fetch is in flight aborts the prior controller. Stale-result guard via `signal.aborted` after each `await`.
- **`<HighlightedText>` reuse across all v4.0 search surfaces** (SRCH-15). XSS-safe regex-escape + React text children only.
- **Two-layer privacy on Collections** (SRCH-12): `profileSettings.profilePublic = true AND profileSettings.collectionPublic = true AND profiles.id != viewerId`. Both conditions in the DAL WHERE; RLS on `profiles` is the second layer.
- **Anti-N+1 `inArray` batch hydration** (SRCH-10) for owned/wishlist badges on Watches tab; mirror pattern for any per-row state on Collections tab (e.g., `isFollowing` if added).
- **Server Action shape** (Phase 16 D-25): Zod `.strict().max(200)` schema; auth gate via `getCurrentUser()`; generic error copy ("Couldn't run search.").
- **Cache Components**: `'use cache'` + `cacheTag` + `cacheLife` patterns from Phase 13 / Phase 18. Per-viewer fetches stay outside cache scope; catalog-only fetches (Watches tab popularity sort) MAY cache at the Server Action layer with short TTL — planner Discretion.

### Claude's Discretion

The plan can decide:

- **ILIKE `%q%` substring vs `pg_trgm.similarity()` ranking** for the Watches query. Substring is simpler and the brand+model GIN index covers it. `similarity()` ranking would change interpretation of D-02 (relevance-then-popularity hybrid). Default: ILIKE substring + popularity ORDER BY (D-02). Reopen if real query results feel wrong.
- **Whether to add a `reference_normalized` GIN trigram index in this phase** (small migration) or accept Seq Scan on reference-only queries at v4.0 scale (acceptable; reference queries are rare).
- **DAL function placement**: `searchCatalogWatches` in `src/data/catalog.ts` (next to `getTrendingCatalogWatches`) or `src/data/search.ts` (next to `searchProfiles`). Either is fine; pick whichever keeps the most cohesion.
- **`searchCollections` placement**: extend `src/data/search.ts` or new `src/data/collectionsSearch.ts`. The query joins `watches` × `profiles` × `profileSettings` with tag-array unnest — substantial enough to warrant its own module if `src/data/search.ts` grows past ~400 lines.
- **Server Action contract surface**: single `searchAllAction({q, tab})` with discriminated-union response, OR three separate actions (`searchPeopleAction` already exists; add `searchWatchesAction` + `searchCollectionsAction`). Either honors D-15.
- **Whether the All-tab 'See all' link uses `setTab()` (client-only) or `<Link href="?tab=...&q=...">` (router push).** D-14 prefers `setTab()` for snappier feel; planner can pick either.
- **Empty-state copy per tab** ("No catalog matches for `'{q}'`" vs "No collectors have `'{q}'` in their collection"). UI-SPEC owns the final copy.
- **Skeleton row shapes** for Watches + Collections — mirror existing `SearchResultsSkeleton.tsx` rhythm; planner picks dimensions.
- **Whether to wire `revalidateTag('catalog')` on `addWatch`/`editWatch`/`removeWatch`** so newly-imported catalog rows surface within their next cache window. Phase 18 already wires `revalidateTag('explore', 'max')` on the same Server Actions; an additional `'search-watches'` tag fan-out is cheap. Planner Discretion whether to bundle.
- **Watches tab — what to show when score === 0 across the board** (very early v4.0 deploy with sparse catalog). Default: empty-state copy. Planner may add a "Showing all catalog rows alphabetically" fallback if the experience feels broken at deploy.

### Folded Todos

None — `todo match-phase 19` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Key Decisions table (catalog silent infrastructure, two-layer privacy, no-Realtime, Cache Components inline-theme-script pattern)
- `.planning/REQUIREMENTS.md` — SRCH-09 through SRCH-15 (the requirements this phase delivers)
- `.planning/ROADMAP.md` Phase 19 entry — goal + 5 success criteria

### Prior-phase artifacts
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — catalog data shapes, source-of-truth rules (CAT-11), denormalized counts, generated-column normalization
- `.planning/phases/17-catalog-foundation/17-VERIFICATION.md` — confirms `brand_normalized` + `model_normalized` GIN reachability and natural-key UNIQUE behavior
- `.planning/phases/18-explore-discovery-surface/18-CONTEXT.md` — Phase 18 D-13/D-15 watch-card sublabel pattern + tie-break SQL idiom; D-08 `revalidateTag` fan-out matrix on watches mutations
- `.planning/codebase/CONVENTIONS.md` — `'server-only'` DAL discipline, snake_case DB / camelCase TS row mapping, anti-N+1 `inArray` batch pattern
- `.planning/codebase/ARCHITECTURE.md` — Server Components by default, Server Actions for mutations, two-layer privacy, Cache Components canonical layout

### Code patterns to mirror
- `src/components/search/SearchPageClient.tsx` — 4-tab shell + tab gate; this phase replaces the two `<ComingSoonCard>` panels with real result blocks
- `src/components/search/useSearchState.ts` — q ↔ URL ↔ fetch trifecta; this phase extends the fetch effect to gate by `(tab, q)` and dispatch per-tab fetchers (or one fan-out action per D-15 Discretion)
- `src/components/search/PeopleSearchRow.tsx` — direct template for a Watches result row (replace avatar with image + brand/model + pill + Evaluate CTA) and for a Collections result row (collector card + matched-watch cluster + matched-tag pills, mirror sharedWatches cluster)
- `src/components/search/HighlightedText.tsx` — XSS-safe match highlighting; reuse unchanged across Watches + Collections rows (SRCH-15)
- `src/components/search/SearchResultsSkeleton.tsx` — skeleton template for the new tabs' loading states
- `src/data/search.ts` `searchProfiles` — anti-N+1 `inArray` pattern, `pg_trgm` ILIKE compound predicate, two-layer privacy via `profileSettings` JOIN, pre-LIMIT-then-JS-sort cap. Direct template for `searchCollections` (extend predicate to JOIN through `watches` + tag-array unnest).
- `src/data/discovery.ts` `getTrendingCatalogWatches` — popularity-DESC + alphabetical tie-break + score-zero exclusion. Direct template for the Watches tab `searchCatalogWatches` query body (add ILIKE WHERE clause).
- `src/data/catalog.ts` `getCatalogById` — DAL conventions for catalog reads
- `src/app/actions/search.ts` `searchPeopleAction` — Server Action shape with Zod `.strict().max(200)` + auth gate + generic error copy. Template for new actions if D-15 splits into 3.
- `src/lib/tasteOverlap.ts` `computeTasteOverlap` — taste overlap computation reused for Collections D-16 secondary sort
- `src/components/home/SuggestedCollectorRow.tsx` — absolute-inset Link + raised-button pattern for Whole-row click area (D-07)

### Schema / data sources
- `src/db/schema.ts` — `watchesCatalog`, `watches` (with `catalogId` FK), `profiles`, `profileSettings` (`profilePublic` + `collectionPublic` gates), `follows`
- `supabase/migrations/...phase17_catalog_foundation.sql` — public-read RLS on `watches_catalog`; verified reachable from authed session

### Memory references
- MEMORY: `project_drizzle_supabase_db_mismatch.md` — `drizzle-kit push` is LOCAL ONLY; prod uses `supabase db push --linked`. Phase 19 adds NO migrations unless planner picks the optional `reference_normalized` GIN index work.
- MEMORY: `project_supabase_secdef_grants.md` — Phase 19 adds no SECURITY DEFINER functions; reference for any future read-side function work.
- MEMORY: `project_seeds_strategic_2026_04_27.md` — SEED-002 (hybrid recommender) intersects with /search ranking; not v4.0 but informs why D-02 + D-16 keep ranking signals separable for future fold-in.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SearchPageClient.tsx` 4-tab shell** — already wires the Tabs control + page-level input + autofocus + tab gate that prevents Watches/Collections tabs from firing the People search action. Phase 19 replaces the two `<ComingSoonCard>` panels with real result blocks; the shell stays.
- **`useSearchState` hook** — q/debouncedQ/tab state + URL sync + AbortController already wired. Phase 19 extends the fetch effect to dispatch per-tab fetchers and gate by `(tab, q)` so prior-tab results never leak into the active tab. The 250ms debounce + 2-char client minimum + URL omission of `tab=all` all carry forward.
- **`PeopleSearchRow.tsx`** — direct template for both Watches and Collections result rows. Whole-row absolute-inset Link + raised inline action button + `<HighlightedText>`. The Watches row swaps avatar→image and overlap→pill. The Collections row reshapes the shared-watch cluster to the matched-watch cluster.
- **`HighlightedText.tsx`** — drop-in across Watches + Collections (SRCH-15). XSS-safe; works with any `text` + `q` props.
- **`SearchResultsSkeleton.tsx`** — skeleton template; planner picks the row dimensions for the new tabs.
- **`searchProfiles` DAL pattern (`src/data/search.ts`)** — pre-LIMIT 50 + JS sort + `inArray` batch hydration + two-layer privacy via `profileSettings` JOIN. Direct template for both `searchCatalogWatches` (Watches tab) and `searchCollections` (Collections tab).
- **`getTrendingCatalogWatches` (`src/data/discovery.ts`)** — popularity-DESC sort + alphabetical tie-break + score-zero exclusion. Watches tab adds an ILIKE WHERE clause to the same query body.
- **`computeTasteOverlap` (`src/lib/tasteOverlap.ts`)** — reused for Collections D-16 secondary sort. Already memoized through the existing People search flow.
- **`searchPeopleAction` Server Action shape** — Zod `.strict().max(200)` + auth gate + generic error copy. Template for any new Server Actions.

### Established Patterns

- **Two-layer privacy (RLS + DAL WHERE)** — Collections must filter `profilePublic = true AND collectionPublic = true` in the DAL even though RLS on `profiles` enforces public-profile reads. Mirror the Phase 16 `searchProfiles` pattern (innerJoin `profileSettings` + WHERE both flags true).
- **Anti-N+1 `inArray` batch hydration** — owned/wishlist badge on Watches rows = single `inArray(watches.catalogId, topIds)` query (SRCH-10). `isFollowing` on Collections rows (if added) = single `inArray(follows.followingId, topCollectorIds)` query.
- **`'server-only'` DAL discipline** — every new DAL file imports `'server-only'`.
- **Cache Components (`cacheComponents: true`) layout** — root layout configured. Search Server Actions are per-viewer (auth-gated) → keep result fetches outside `'use cache'` unless the planner decides catalog-only Watches results can cache at short TTL (D-15 Discretion).
- **`updateTag` for read-your-own-writes; `revalidateTag` for cross-user fan-out** — Phase 18 already wires `revalidateTag('explore', 'max')` on `addWatch` / `editWatch` / `removeWatch`. Planner may add `revalidateTag('search-watches', 'max')` if catalog freshness on /search Watches matters; otherwise the next `cacheLife` window resolves naturally.
- **DAL viewer-aware reads** — both `searchCatalogWatches` and `searchCollections` take `viewerId` for self-exclusion + owned/wishlist badge hydration.

### Integration Points

- **`src/components/search/useSearchState.ts`** — fetch effect rewritten to dispatch per-tab fetchers (or one fan-out action) and gate by `(tab, q)`. The `tab !== 'all' && tab !== 'people'` early-return at line 76 disappears — Watches and Collections both fire now.
- **`src/components/search/SearchPageClient.tsx`** — replace the two `<ComingSoonCard>` panels (Watches + Collections TabsContent) with real result blocks. Replace the two compact footer ComingSoonCards in the All tab with two real result sections (Watches + Collections, each capped at 5 with a See-all link).
- **`src/data/catalog.ts`** OR `src/data/search.ts` — add `searchCatalogWatches({ q, viewerId, limit })`. Returns rows with hydrated `viewerOwnsIt` / `viewerWishlistedIt` flags via `inArray` batch.
- **`src/data/search.ts`** OR new `src/data/collectionsSearch.ts` — add `searchCollections({ q, viewerId, limit })`. Returns rows with `userId, username, displayName, avatarUrl, matchCount, tasteOverlap, matchedWatches[], matchedTags[]`.
- **`src/app/actions/search.ts`** — extend with `searchWatchesAction` + `searchCollectionsAction` (and optionally `searchAllAction` per D-15 Discretion). All keep the `searchPeopleAction` shape.
- **`src/lib/searchTypes.ts`** — add `SearchCatalogWatchResult` + `SearchCollectionResult` types alongside `SearchProfileResult`. Discriminated by `kind: 'profile' | 'watch' | 'collection'` if a single fan-out action is chosen; flat types if 3 actions.
- **`src/components/search/`** — new components: `WatchSearchRow.tsx`, `CollectionSearchRow.tsx` (or one shared row with discriminated props per planner Discretion). UI-SPEC pins the visual shape.
- **`src/components/search/SearchPageClient.tsx`** — new All-tab section component(s) wiring the 3 result blocks with per-section skeletons + headers + See-all links.
- **`src/app/actions/watches.ts`** (optional, planner Discretion) — add `revalidateTag('search-watches', 'max')` on `addWatch` / `editWatch` / `removeWatch` if Watches tab freshness matters within the same session.

</code_context>

<specifics>
## Specific Ideas

- **People vs Collections distinction matters**: People = "find this person by who they are" (username/bio). Collections = "find people by what they own" (watch identity + tags). Same row shape OK; different match path. The All tab surfaces both; section headers (D-14) make the difference legible.
- **People-first across All tab + match-count-then-overlap within Collections**: Reflects the project's "taste-aware collection intelligence" identity. People up top across tabs; signal-matched collections framed by relevance-to-viewer within the section.
- **Inline Evaluate CTA + whole-row click both target `/evaluate?catalogId={uuid}`**: One destination for two interactions. Phase 19 + Phase 20 ship close together; brief 404 risk is acceptable at single-user MVP scale.
- **Tag matching is forgiving substring ILIKE**, not exact-match against a tag vocabulary. The deferred tag-taxonomy phase (Phase 17 Deferred Idea) will introduce the controlled vocabulary; until then, substring ILIKE keeps the experience predictable without depending on infrastructure that doesn't exist.
- **Already-owned watches stay in results**: User may want to look up their own watches on /search to identify or compare. Filtering them out hides discovery; pushing to a separate section adds complexity. Just badge them.
- **Per-(tab, query) AbortController gates rapid switches**: Switching from `?tab=watches&q=Speed` to `?tab=collections&q=Speed` aborts the in-flight Watches fetch and dispatches the Collections fetch. Phase 16's single-controller pattern extends naturally — the dependency array on the fetch effect simply gains `tab`.

</specifics>

<deferred>
## Deferred Ideas

- **Filter facets on /search Watches** (movement / case size / style) — SRCH-16, v4.x. Catalog has the data; UI surface is the deferred work.
- **Within-collection search via `/u/{user}?q=...`** — SRCH-17, v4.x. Reuses similar DAL shapes scoped to a single user.
- **Faceted Collections search** (filter Collections results by tag/role/dial-color) — explicitly out of scope per REQUIREMENTS.md; v4.x.
- **`pg_trgm.similarity()` relevance ranking on Watches tab** — D-02 ships popularity-DESC; if real-world queries surface obscure-but-most-collected results above the user's intent, revisit and add a relevance-threshold filter in front of the popularity sort.
- **Tag taxonomy audit + migration** (Phase 17 Deferred Idea) — pares down style/role/design/complications overlap, migrates `watches` + `watches_catalog` in lockstep, updates `analyzeSimilarity()` weights. Should land BEFORE v5.0 catalog→similarity rewire. Phase 19 substring ILIKE on tags is forgiving by design so this deferral stays cheap.
- **`reference_normalized` GIN trigram index** on `watches_catalog` — Phase 17 shipped GIN on brand+model only. If reference-based queries become hot, add a third GIN. Acceptable seq-scan fallback at v4.0 scale.
- **`searchAllAction` fan-out vs 3 separate Server Actions** — planner Discretion (D-15). Both honor parallel render. If the codebase ends up with `searchPeopleAction` + `searchWatchesAction` + `searchCollectionsAction` as 3 separate symbols, a future refactor could fold them into one if the contracts converge.
- **Cache strategy for Watches tab catalog reads** — popularity-DESC is global, not per-viewer. Could cache at short TTL (5 min) with `revalidateTag('search-watches', 'max')` fan-out from `addWatch` / `editWatch` / `removeWatch`. Planner Discretion.

### Reviewed Todos (not folded)

None — `todo match-phase 19` returned zero matches.

</deferred>

---

*Phase: 19-search-watches-collections*
*Context gathered: 2026-04-28*

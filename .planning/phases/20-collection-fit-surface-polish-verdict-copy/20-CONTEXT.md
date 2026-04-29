# Phase 20: Collection Fit Surface Polish + Verdict Copy — Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The similarity engine is reframed as "Collection Fit" with richer contextual phrasings and lands cleanly at two organic surfaces: cross-user `/watch/[id]` (reached via `/u/{username}/collection` → click) and `/search?tab=watches` row preview (Phase 19's `WatchSearchRow`). `/evaluate` does NOT exist as a route — URL-paste capability moves to Phase 20.1 (Add-Watch Flow Rethink). No verdict A/B testing; no LLM-generated copy; no `analyzeSimilarity()` engine body changes.

**In scope (FIT-01..04):**
- Extract `<CollectionFitCard>` as a pure-renderer component; computation moves to caller
- Expand verdict copy beyond the 6 fixed `SimilarityLabel` values into contextual phrasings
- Cross-user `/watch/[id]` renders fit framed for "viewer doesn't own this"
- `WatchSearchRow` "Evaluate" CTA → inline-expand verdict (no nav)
- `/evaluate` route remains nonexistent; all dangling references remediated

**Out of scope (deferred):**
- LLM-generated verdict copy (FIT-06, v5+)
- A/B testing infra for phrasings (v5+)
- `analyzeSimilarity()` engine body changes (v5+ — caller shims handle type unification)
- URL-paste evaluate flow (Phase 20.1 ADD-01..07)
- WYWT, photo upload, or any non-fit surface

</domain>

<decisions>
## Implementation Decisions

### Verdict Copy Generation (FIT-02)

- **D-01:** Verdict phrasings are produced by a **template library with slot substitution**. A pure composer function picks the right template(s) from a curated library based on `SimilarityResult` + viewer collection's aggregate taste profile + candidate watch's taste row, then fills named slots (`dominant_style`, `contrast`, `specific_watch`, etc.). Deterministic, free, testable, no LLM. Template library is the single source of truth for the FIT-02 phrasings — including the four roadmap examples (*"fills a hole in your collection"*, *"aligns with your heritage-driven taste"*, *"your collection skews [dominant] — this is a [contrast]"*, *"overlaps strongly with [specific watch]"*).

- **D-02:** Viewer collection's aggregate taste profile is computed by a **pure function on every render**: join viewer watches → `watches_catalog.taste_*` → `mean(formality)`, `mean(sportiness)`, `mean(heritage_score)`, `mode(primary_archetype)`, `mode(era_signal)`, top-K `design_motifs`. **Null-tolerant** — taste columns may be NULL for catalog rows the Phase 19.1 enrichment hasn't reached yet (graceful: skip nulls in mean/mode). No persistence layer, no materialized view. O(N) over collection size (target N < 500 per CLAUDE.md).

### Compute Placement (FIT-01)

- **D-03:** Two computation paths optimized per surface:
  - **Server Component** for static surfaces: `src/components/watch/WatchDetail.tsx` (existing — same-user) and the new cross-user `/watch/[id]`. Server reads viewer's collection + candidate + computes `VerdictBundle`, ships it as props. Zero client-side similarity engine on these surfaces.
  - **Client Component** for `WatchSearchRow` inline-expand. Lazy compute on first expand via Server Action (see D-06). Avoids shipping the engine + composer in the search-page bundle.

- **D-04:** `<CollectionFitCard>` is a **pure renderer**. Props: `{ verdict: VerdictBundle }` where `VerdictBundle = { label, headlinePhrasing, contextualPhrasings: string[], mostSimilar: Array<{watch, score}>, roleOverlap: boolean, framing: 'same-user' | 'cross-user' | 'self-via-cross-user' }`. Card has no logic — caller (server or client) runs `analyzeSimilarity` + `composeVerdictCopy` and hands the finished bundle. Swap to LLM-generated copy in v5+ by changing the composer, not the card.

### `/search` Inline-Expand UX (FIT-04)

- **D-05:** Click-to-expand-below-row, **accordion** behavior. Click row's "Evaluate" affordance → row stays in place, `<CollectionFitCard>` slides down underneath. Opening another row's evaluate auto-collapses the previous one (one open at a time). ESC collapses. Tab/keyboard accessible.

- **D-06:** **Lazy compute via Server Action** on first expand:
  - Server Action: `getVerdictForCatalogWatch(catalogId)` → returns `VerdictBundle` for the authenticated viewer's collection.
  - **In-memory session cache** by `catalogId` in the SearchPageClient component state — re-expanding the same row is instant.
  - Cache invalidates if the viewer mutates their collection (subscribe to a Zustand collection-revision counter, or simply key the cache by collection-revision so a new revision drops stale entries).
  - Idle search rows pay zero verdict cost.

### Cross-User Framing + Edge Cases (FIT-03)

- **D-07:** When viewer's collection has 0 watches, the cross-user `/watch/[id]` page **hides `<CollectionFitCard>` entirely**. No empty-state copy, no onboarding nudge — fit is meaningless without a collection signal. Other detail-page sections render normally.

- **D-08:** When viewer reaches the cross-user route on a watch they already own (`viewer.id === watch_owner.id`), the card **swaps body to a "You own this" framing**: small callout with "You own this watch — added {date}" plus a link to the owner's `WatchDetail`. No verdict computed, no contextual phrasings. Detection at the page level (single read of the watch row's `userId`).

### Engine Lock + Type Unification

- **D-09:** `analyzeSimilarity()` body remains **byte-identical** in this phase. Engine changes are deferred to v5+. Type mismatch (search rows are `CatalogEntry`, cross-user collection clicks are someone else's `Watch`, `analyzeSimilarity()` takes `Watch`) is resolved by **caller shims at the boundary**: each call site converts whatever shape it has into the `Watch`-compatible input the engine expects. Shim is a small pure mapper (e.g. `catalogEntryToSimilarityInput()`) co-located with the similarity module. No engine signature change.

### `/explore` Cleanup

- **D-10:** `src/components/explore/DiscoveryWatchCard.tsx:14` currently links to dangling `/evaluate?catalogId=`. **Repoint** to cross-user `/watch/[catalogId]` (the new CollectionFitCard surface from FIT-03). Single change per card. Mirrors the rest of v4.0 — catalog watches now have a real detail page.

### Claude's Discretion

- Exact set of templates in the library (composer's curated phrasing pool) — Claude proposes a starting set covering the four roadmap examples plus 8-12 supporting phrasings, user reviews in PR.
- ESC key handling implementation detail (KeyboardEvent listener vs `useEffect` cleanup) for accordion collapse.
- Server Action caching layer (if any beyond in-memory client cache) — none required by D-06 but acceptable if it falls out naturally from RSC patterns already in use.
- Animation/transition for accordion expand (Framer Motion, CSS transition, or instant) — Claude picks consistent with existing patterns.
- VerdictBundle field naming and exact shape — keep it minimal and pure-render-friendly.

</decisions>

<specifics>
## Specific Ideas

- The four roadmap example phrasings are the FIT-02 ground truth — composer must produce all four kinds.
- "Collection Fit" is the user-facing label — replaces "Similarity" in copy. The engine is still `analyzeSimilarity` internally (byte-identical lock); the framing is purely at the renderer/composer layer.
- Phase 19.1's taste columns (`formality`, `sportiness`, `heritage_score`, `primary_archetype`, `era_signal`, `design_motifs`, `confidence`, `extracted_from_photo`) are the substrate for slot values. NULL-tolerant computation is critical because backfill (Plan 19.1-06) may not have run yet on a fresh dev DB.
- Inline-expand on /search is the only surface that gets the accordion pattern in this phase. WatchDetail and cross-user /watch/[id] render the card statically (always visible).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 20 scope
- `.planning/ROADMAP.md` §"Phase 20: Collection Fit Surface Polish + Verdict Copy" — goal, dependencies, 5 success criteria
- `.planning/REQUIREMENTS.md` FIT-01..04 — requirement-level acceptance

### Substrate from prior phases
- `.planning/phases/19.1-catalog-taste-enrichment/19.1-CONTEXT.md` — locked taste schema (D-01..D-22 from 19.1) the composer reads from
- `.planning/phases/19.1-catalog-taste-enrichment/19.1-04-dal-and-storage-helpers-SUMMARY.md` — `updateCatalogTaste`, `applyUserUploadedPhoto` DAL contracts
- `.planning/phases/19-search-watches-collections/19-CONTEXT.md` — WatchSearchRow contract + Phase 19 search infrastructure (debounce, abort, viewer-state hydration)
- `.planning/phases/17-catalog-foundation/` — catalog identity model

### Existing code consumers
- `src/lib/similarity.ts` — `analyzeSimilarity()` (BYTE-IDENTICAL LOCK), `getSimilarityLabelDisplay()`, `SimilarityResult` type
- `src/lib/types.ts` — `Watch`, `CatalogEntry`, `UserPreferences`, `SimilarityLabel`, `CatalogTasteAttributes` (Phase 19.1)
- `src/components/insights/SimilarityBadge.tsx` — current Client Component to be split into `<CollectionFitCard>` (renderer) + composer + caller-side compute
- `src/components/watch/WatchDetail.tsx:425` — existing consumer; will switch from `<SimilarityBadge>` to `<CollectionFitCard>`
- `src/components/search/WatchSearchRow.tsx:43` — `/evaluate?catalogId=` href; becomes inline-expand affordance (FIT-04)
- `src/components/explore/DiscoveryWatchCard.tsx:14` — `/evaluate?catalogId=` reference; repoint to `/watch/[catalogId]` (D-10)
- `src/app/u/[username]/` — username route entry point; cross-user `/watch/[id]` is reached from here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`analyzeSimilarity()` in `src/lib/similarity.ts`** — engine stays byte-identical (D-09). All compute callers run it through the existing API.
- **`SimilarityBadge.tsx`** — body becomes the seed for `<CollectionFitCard>`. Strip the `analyzeSimilarity()` call; accept `VerdictBundle` props instead.
- **Phase 19's WatchSearchRow contract** — already has the pre-existing "Evaluate" affordance pattern. Wrap the row in an accordion-aware component; replace the `<Link>` with a button + expansion state.
- **Phase 19.1 `getCurrentUser()` + auth helpers** — used by Server Action in D-06.
- **Phase 17 `mapRowToCatalogEntry()` + Phase 19.1 taste columns** — already mapped on `CatalogEntry`. Composer reads `entry.formality`, etc. directly.

### Patterns to Mirror

- **Server Action + Client cache** — Phase 19's `searchCatalogWatches` Server Action with debounced calls is the closest pattern. D-06 mirrors this for `getVerdictForCatalogWatch`.
- **Accordion / disclosure component** — base-ui or shadcn `Disclosure` if present; otherwise hand-rolled `useState<openId | null>` with one-at-a-time semantics.
- **Two-path compute (server static + client lazy)** — Phase 18's discovery surface uses this exact split (server for rails, client for interactions).

### Anti-Patterns to Avoid

- Do NOT touch `analyzeSimilarity()` body (D-09 — v3.0 silent-infrastructure lock still in force; v5+ unlock).
- Do NOT introduce a new `/evaluate` route (success criterion 5).
- Do NOT compose verdict copy inside `<CollectionFitCard>` (D-04 — pure renderer; composer is upstream).
- Do NOT pre-compute verdicts for all visible search rows on result render (D-06 — lazy on first expand only).
- Do NOT add a materialized view or persistent cache for viewer aggregate taste (D-02 — pure function per render is sufficient at v4.0 scale).

</code_context>

<deferred>
## Deferred Ideas

- **LLM-generated verdict copy** (FIT-06 — v5+): When the template library hits its expressive limit, route low-confidence cases or premium phrasings through claude-haiku-4-5. Requires caching layer + cost monitoring.
- **A/B testing infra for FIT-02 phrasings** (v5+): Random template selection from equivalent variants, measure CTR or downstream "added to wishlist" rate.
- **`analyzeSimilarity()` engine refactor to accept discriminated union `Watch | CatalogEntry`** (v5+): Removes the caller shim layer. Currently locked.
- **Hover-peek verdict on desktop** (v5+ polish): Tiny pill on row hover before full expand.
- **Multi-row simultaneous expand on /search** (v5+ polish): If users want to compare verdicts side-by-side. Currently accordion (D-05).
- **Dominant-style detection enhancement using design_motifs frequency** (v5+): Top-K design motifs across collection as a higher-fidelity dominance signal beyond `primary_archetype` mode.

</deferred>

<open_questions>
## Open Questions for Research

1. Is there an existing `Disclosure` / `Collapsible` primitive in `@base-ui/react` or `src/components/ui/` we can reuse for the accordion expand, or do we hand-roll? (Search: `Collapsible`, `Disclosure`, `Accordion` in node_modules/@base-ui and src/components/ui)
2. Can the Server Action for `getVerdictForCatalogWatch(catalogId)` reuse Phase 19's `searchCatalogWatches` auth/getCurrentUser pattern? Confirm session is available.
3. What happens when `WatchDetail.tsx` is rendered for a same-user watch after this change? Today it's a Client Component (uses Zustand). Either keep it Client (compute happens in-page) or migrate to Server (consistent with cross-user). Researcher confirms feasibility.
4. Cross-user `/watch/[id]` may not yet exist as a separate route. Does it route through the same `/watch/[id]/page.tsx` as same-user, or do we need `/u/[username]/watch/[id]/page.tsx`? Researcher determines current routing shape.
5. Is `getCatalogPhotoSignedUrl` from Phase 19.1 needed here (for cross-user catalog watch images)? Confirm whether `<CollectionFitCard>` displays the watch image at all (current `<SimilarityBadge>` does not — it's verdict-only).

</open_questions>
</content>
</invoke>
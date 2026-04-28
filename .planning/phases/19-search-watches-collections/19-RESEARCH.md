# Phase 19: /search Watches + Collections - Research

**Researched:** 2026-04-28
**Domain:** Server-side search over Postgres catalog + cross-user collections; Next.js 16 App Router + Drizzle ORM 0.45.2 + Supabase RLS + Cache Components
**Confidence:** HIGH

## Summary

Phase 19 populates the two stub tabs of the existing 4-tab `/search` shell with real, debounced, two-layer-privacy results, and unions all four sources on the All tab. Every architectural decision (debounce, URL sync, AbortController, two-layer privacy, anti-N+1, Server Action shape, HighlightedText reuse) is locked by Phase 16 / Phase 17 / Phase 18 context. The remaining decisions are mechanical: (1) Drizzle expression shapes for ILIKE OR + tag-array unnest; (2) DAL placement (extend `src/data/search.ts` vs new file); (3) one fan-out Server Action vs three; (4) AbortController dependency-array extension.

The Watches tab inherits the body of `getTrendingCatalogWatches` from Phase 18 (popularity-DESC + alphabetical tie-break + score-zero exclusion) and adds an ILIKE OR WHERE clause across `brand_normalized`, `model_normalized`, `reference_normalized`. The owned/wishlist badge hydrates via a single batched `inArray(watches.catalogId, topIds)` query keyed by `viewerId` — anti-N+1 by construction (SRCH-10).

The Collections tab is the most complex piece. A single ILIKE OR predicate spans per-user `watches.brand`, `watches.model`, and `EXISTS(SELECT 1 FROM unnest(...) t WHERE t ILIKE %q%)` over the three text[] tag columns (`style_tags`, `role_tags`, `complications`). Two-layer privacy gates `profileSettings.profilePublic = true AND profileSettings.collectionPublic = true AND profiles.id != viewerId`. Group by profileId with `count(*) AS matchCount`; pre-LIMIT 50; sort in Node by matchCount DESC, then `computeTasteOverlap` DESC, username ASC; final cap 20.

The All tab fans out three parallel fetches with per-section skeletons. **Recommendation: three separate Server Actions** (`searchWatchesAction`, `searchCollectionsAction`, plus existing `searchPeopleAction`) called from the client in parallel — gives error isolation, lets each section paint independently, mirrors the existing `searchPeopleAction` shape exactly. Defer a `searchAllAction` fan-out to a future refactor only if the contracts converge.

`useSearchState`'s fetch effect is rewritten to dispatch a per-tab fetcher inside a single AbortController whose dependency array is `[debouncedQ, tab]`. One controller is sufficient even on the All tab — `controller.abort()` cancels every in-flight `Promise.all` child fetch atomically.

**Primary recommendation:** Three Server Actions + one tab-aware AbortController in `useSearchState`. Build the Watches DAL in `src/data/catalog.ts` (cohesion with `getTrendingCatalogWatches`); build the Collections DAL in `src/data/search.ts` (cohesion with `searchProfiles` two-layer-privacy + tasteOverlap pattern). Skip the optional `reference_normalized` GIN trigram index for v4.0 — accept Seq Scan on reference-only queries at <5K catalog rows.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Watches Tab — Query + Ranking**
- **D-01: Match fields = `brand` + `model` + `reference`.** ILIKE OR predicate against all three. Phase 17 GIN trigram on `brand_normalized` + `model_normalized` covers brand/model. Reference-only queries may Seq Scan; acceptable at v4.0 scale. Tag arrays do NOT participate in Watches tab — too noisy for object search; tags belong to Collections tab.
- **D-02: Ranking = popularity score DESC + alphabetical tie-break.** `ORDER BY (owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC`. Mirror Phase 18 Trending. Exclude rows with score === 0.
- **D-03: Min query length = 2 chars.** Server-side gate (DAL trim/length check) is authoritative; client gate in `useSearchState` is defense-in-depth.
- **D-04: Result cap = 20.** Show "Showing top 20" footer when `results.length === 20`. No pagination v4.0.

**Watches Tab — Row UX + Evaluate CTA**
- **D-05: Single contextual pill for collection state.** `'Owned'` if any of viewer's `watches` has `catalog_id = row.id AND status = 'owned'`; else `'Wishlist'` if `catalog_id = row.id AND status = 'wishlist'`; else no pill. Sold + grail are NOT badged. Hydration via single `inArray(watches.catalogId, topIds)` batch (SRCH-10).
- **D-06: Already-owned watches stay in results, badged inline.** No filter, no separate section.
- **D-07: Whole row clickable; raised CTA pattern.** Absolute-inset `<Link>` wraps the whole row → `/evaluate?catalogId={uuid}`. Inline `'Evaluate'` button raised with `relative z-10`. Same pattern as `PeopleSearchRow` + `SuggestedCollectorRow`.
- **D-08: Inline 'Evaluate' CTA targets `/evaluate?catalogId={uuid}` — ship interlocked with Phase 20.** No feature flag, no stub /evaluate page. Honors SRCH-09 + EVAL-06 with one decision.

**Collections Tab — Search Semantics**
- **D-09: Unified query — single ILIKE OR predicate.** One DAL function searches against per-user `watches.brand`, `watches.model`, `watches.style_tags` elements, `watches.role_tags` elements, `watches.complications` elements. A collector matches if ANY of their watches matches. No mode toggle. No split sub-results.
- **D-10: Tag matching via substring ILIKE on each tag element.** SQL pattern: `EXISTS(SELECT 1 FROM unnest(watches.style_tags) t WHERE t ILIKE %q%)`. Forgiving but predictable.
- **D-11: Row signals match via matched-watch mini-thumb cluster.** Mirror `PeopleSearchRow` shared-watch cluster shape, but show the WATCHES that matched the query rather than shared-with-viewer. `<HighlightedText>` wraps the matched watch's brand/model. Sub-line: `'Tyler — 3 matches'` or `'Tyler — owns Speedmaster + 2 more'`. Tag matches surface as small inline pills.
- **D-12: Min query length = 2 chars.** Consistent across all tabs.

**All Tab — Composition + Order**
- **D-13: Section order top-to-bottom = People → Watches → Collections.**
- **D-14: Per-section header + 'See all in [tab] →' link.** 'See all' switches the active tab via `setTab(...)` (preserves debounce + query state).
- **D-15: Render strategy = parallel fetch + per-section skeletons.** All tab fires 3 fetches in parallel. Each section shows its own skeleton until its fetch resolves. Implementation as 3 Server Actions vs 1 fan-out is Claude's Discretion.
- **D-16: Collections ranking = match count DESC, taste overlap DESC, username ASC.** Reuses Phase 16 `computeTasteOverlap`.

**Carry-forward (locked, not re-decided):**
- 4-tab shell + `useSearchState` hook (Phase 16): 250ms debounce, 2-char client minimum, URL sync via `router.replace({scroll: false})`, `'all'` default + `'all'` omitted from URL.
- Per-(tab, query) AbortController (SRCH-14): existing single-controller pattern extends to gate by both `(tab, query)`. Switching tabs while a fetch is in flight aborts the prior controller.
- `<HighlightedText>` reuse (SRCH-15). XSS-safe regex-escape + React text children only.
- Two-layer privacy on Collections (SRCH-12): `profileSettings.profilePublic = true AND profileSettings.collectionPublic = true AND profiles.id != viewerId`.
- Anti-N+1 `inArray` batch hydration (SRCH-10) for owned/wishlist badges.
- Server Action shape (Phase 16 D-25): Zod `.strict().max(200)` schema; auth gate via `getCurrentUser()`; generic error copy ("Couldn't run search.").
- Cache Components: per-viewer fetches outside cache scope; catalog-only Watches MAY cache at the Server Action layer with short TTL (planner Discretion).

### Claude's Discretion

- ILIKE `%q%` substring vs `pg_trgm.similarity()` ranking on Watches — default substring + popularity ORDER BY (D-02).
- Whether to add a `reference_normalized` GIN trigram index in this phase — accept Seq Scan at v4.0 scale.
- DAL function placement: `searchCatalogWatches` in `src/data/catalog.ts` (next to `getTrendingCatalogWatches`) or `src/data/search.ts` (next to `searchProfiles`).
- `searchCollections` placement: extend `src/data/search.ts` or new `src/data/collectionsSearch.ts`.
- Server Action contract surface: single `searchAllAction({q, tab})` with discriminated-union response, OR three separate actions.
- All-tab 'See all' link: `setTab()` (client-only) or `<Link href="?tab=...&q=...">` (router push).
- Empty-state copy per tab.
- Skeleton row shapes for Watches + Collections.
- Whether to wire `revalidateTag('search-watches', 'max')` on `addWatch`/`editWatch`/`removeWatch`.
- Watches tab — what to show when score === 0 across the board.

### Deferred Ideas (OUT OF SCOPE)

- Filter facets on /search Watches (movement / case size / style) — SRCH-16, v4.x.
- Within-collection search via `/u/{user}?q=…` — SRCH-17, v4.x.
- Faceted Collections search — explicitly out of scope per REQUIREMENTS.md.
- `pg_trgm.similarity()` relevance ranking on Watches.
- Tag taxonomy audit + migration.
- `reference_normalized` GIN trigram index.
- `searchAllAction` fan-out vs 3 separate Server Actions — planner Discretion (D-15).
- Cache strategy for Watches tab catalog reads — planner Discretion.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-09 | Watches tab — catalog matches with thumbnails, brand/model, owned/wishlist badges, inline Evaluate CTA | §"Watches Query Mechanics" + §"Owned/Wishlist Badge Hydration" + §"Row UX Patterns" |
| SRCH-10 | Anti-N+1 inArray batch hydration for owned/wishlist badges | §"Owned/Wishlist Badge Hydration" — single `inArray(watches.catalogId, topIds)` filtered by `viewerId` |
| SRCH-11 | Collections tab — match collectors by what's in their collection | §"Collections Query Mechanics" — JOIN profiles ↔ profileSettings ↔ watches with ILIKE OR over (brand, model, unnest tag arrays) |
| SRCH-12 | Two-layer privacy on Collections | §"Collections Query Mechanics" — profileSettings.profilePublic AND profileSettings.collectionPublic AND profiles.id != viewerId |
| SRCH-13 | All tab unions People + Watches + Collections capped at 5 each | §"All-Tab Fan-Out Architecture" — three Server Actions, parallel from client, per-section skeleton + header + See-all |
| SRCH-14 | Per-(tab, query) AbortController gating | §"Per-(tab, q) AbortController Extension" — extend dependency array to `[debouncedQ, tab]` |
| SRCH-15 | HighlightedText reuse — XSS-safe match highlighting | §"Code Examples" — drop-in across Watches + Collections rows |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16 with breaking changes:** AGENTS.md mandates reading `node_modules/next/dist/docs/` for any unfamiliar API before writing code. Heed deprecation notices.
- **App Router only.** No `pages/` directory.
- **Tech stack locked:** Next.js 16.2.3 + React 19.2.4 + TypeScript 5 + Drizzle 0.45.2 + Supabase + Tailwind 4. No rewrites.
- **Data model:** `Watch` and `UserPreferences` types are established — extend, don't break.
- **`server-only` DAL discipline:** every new DAL file must `import 'server-only'` at the top.
- **Snake_case DB / camelCase TS row mapping** via Drizzle.
- **Naming:** PascalCase components, camelCase non-component files, kebab-case route segments. Type-only imports use `import type { ... }`.
- **Path alias:** `@/*` → `./src/*`.
- **No barrel files;** components imported directly.
- **Tailwind 4 utility classes inline;** `cn()` helper for conditional composition.
- **GSD workflow enforcement:** all repo edits go through a GSD command.
- **MEMORY: drizzle-kit push is LOCAL ONLY.** Phase 19 adds NO migrations unless planner picks the optional `reference_normalized` GIN index work; in that case the Drizzle column shape change must be paired with a `supabase/migrations/...phase19_*.sql` file applied via `supabase db push --linked`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 (locked) | SQL builder for Postgres | Already used in `src/data/*`; supports `ilike`, `or`, `and`, `inArray`, raw `sql` template tag for unnest predicates [VERIFIED: package.json] |
| `next` | 16.2.3 (locked) | App Router + Server Actions + Cache Components | Phase 16/17/18 baseline [VERIFIED: package.json] |
| `react` | 19.2.4 (locked) | Server + Client Components | [VERIFIED: package.json] |
| `zod` | (transitive via existing actions) | Server Action input validation | `searchPeopleAction` already uses `z.object().strict()` [VERIFIED: src/app/actions/search.ts] |
| `postgres` | 3.4.9 (locked) | Postgres driver under Drizzle | [VERIFIED: package.json] |
| `lucide-react` | ^1.8.0 (locked) | Icon set (BadgeCheck for Owned, Bookmark for Wishlist, ChevronRight for See-all) | [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `<HighlightedText>` | n/a | XSS-safe match highlighting | Reuse unchanged across all v4.0 search rows (SRCH-15) [VERIFIED: src/components/search/HighlightedText.tsx] |
| Existing `<SearchResultsSkeleton>` | n/a | Skeleton template | Mirror dimensions for new tabs' loading states [VERIFIED: src/components/search/SearchResultsSkeleton.tsx] |
| Existing `computeTasteOverlap` | n/a | Per-pair taste overlap | D-16 secondary sort on Collections [VERIFIED: src/lib/tasteOverlap.ts:51] |
| Existing `next/image` | n/a | Image rendering | Watch thumbnails in Watches + Collections rows; `unoptimized` per Phase 16 + 18 precedent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ILIKE substring on Watches | `pg_trgm.similarity() >= threshold` | Relevance ranking instead of popularity. Rejected per D-02 — popularity ranking is the desired UX for "Submariner" → familiar grail at top. Reopen if real queries surface obscure-but-popular results above intent. |
| Three separate Server Actions | Single `searchAllAction` with discriminated-union response | One symbol vs three; centralizes Zod parsing. Rejected for v4.0 because: (1) error isolation across sections is easier with three independent fetches; (2) the existing `searchPeopleAction` already exists as a separate symbol — three actions is the natural extension; (3) refactoring later if contracts converge is cheap. |
| Adding `reference_normalized` GIN trigram index | Skip the index; accept Seq Scan | At <5K catalog rows the cost is sub-50ms (Phase 18 already validates this for unsorted Seq Scan + sort on `watches_catalog`). Rejected for v4.0 unless reference queries become hot. |
| One Server Action with `searchAllAction({q})` returning `{people, watches, collections}` | Three actions, three independent `useEffect`s in client | Fan-out adds a single network round-trip vs three. But: error isolation is worse (one section throwing fails the whole response unless the action catches per-section), and the All tab still needs to render per-section skeletons separately, so the client must hold three loading slices regardless. The simplification is shallow. |

**Installation:** No new packages. Phase 19 reuses the existing stack 100%.

**Version verification:**
- Drizzle 0.45.2: pinned in package.json; supports `ilike`, `or`, `and`, `inArray`, `sql` template tag — used throughout `src/data/search.ts` and `src/data/discovery.ts` [VERIFIED: codebase grep]
- Next 16.2.3: Server Actions + `revalidateTag` already wired in `src/app/actions/watches.ts:177` [VERIFIED: codebase grep]
- React 19.2.4: `useEffect` + AbortController pattern in `useSearchState.ts:90-114` [VERIFIED: codebase grep]
- Zod: existing `searchSchema = z.object({ q: z.string().max(200) }).strict()` in `src/app/actions/search.ts:13-17` [VERIFIED: codebase grep]

## Architecture Patterns

### Recommended Project Structure

```
src/
├── data/
│   ├── catalog.ts                    # ADD: searchCatalogWatches({q, viewerId, limit})
│   │                                  #      + getViewerWatchStatesForCatalogIds (helper)
│   ├── search.ts                     # ADD: searchCollections({q, viewerId, limit})
│   └── ... (unchanged)
├── app/
│   └── actions/
│       └── search.ts                 # EXTEND: searchWatchesAction + searchCollectionsAction
│                                     #         (alongside existing searchPeopleAction)
├── components/
│   └── search/
│       ├── SearchPageClient.tsx      # EDIT: replace 2 ComingSoonCards with real result blocks
│       │                              #       + replace All-tab compact footer cards with sections
│       ├── useSearchState.ts         # EDIT: extend fetch effect to dispatch per-tab fetcher;
│       │                              #       add results slices for watches + collections;
│       │                              #       deps array becomes [debouncedQ, tab]
│       ├── WatchSearchRow.tsx        # NEW: Watches tab row (image + brand/model + pill + Evaluate)
│       ├── CollectionSearchRow.tsx   # NEW: Collections tab row (avatar + matched-watch cluster + pills)
│       ├── AllTabResults.tsx         # NEW (optional): wraps the 3 sections + headers + See-all
│       └── ... (HighlightedText, SearchResultsSkeleton, PeopleSearchRow, ComingSoonCard unchanged)
└── lib/
    └── searchTypes.ts                # EXTEND: SearchCatalogWatchResult + SearchCollectionResult
```

### Pattern 1: Watches DAL — popularity-DESC + ILIKE OR + score-zero exclusion

**What:** Add an ILIKE OR WHERE clause to the body of `getTrendingCatalogWatches` (Phase 18) and bolt on the viewer-state hydration step.

**When to use:** Every Watches-tab Server Action call.

**Drizzle expression for ILIKE OR across normalized columns:**

```typescript
// Source: extends pattern from src/data/discovery.ts:135-160 (getTrendingCatalogWatches)
//         and ILIKE-OR pattern from src/data/search.ts:68-71 (searchProfiles)
import 'server-only'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { watchesCatalog, watches } from '@/db/schema'

const TRIM_MIN_LEN = 2
const CANDIDATE_CAP = 50  // pre-LIMIT cap before final slice
const DEFAULT_LIMIT = 20  // D-04

export async function searchCatalogWatches({
  q,
  viewerId,
  limit = DEFAULT_LIMIT,
}: { q: string; viewerId: string; limit?: number }): Promise<SearchCatalogWatchResult[]> {
  const trimmed = q.trim()
  if (trimmed.length < TRIM_MIN_LEN) return []

  // Normalize the query the same way Phase 17 normalizes brand_normalized /
  // model_normalized: lower(trim(...)). For reference, also strip non-alphanumeric.
  // The ILIKE pattern itself is the user-facing trimmed string wrapped in %; the
  // GIN trigram index handles the substring fuzz on lowercased generated columns.
  const lowerQ = trimmed.toLowerCase()
  const pattern = `%${lowerQ}%`
  const refNormalized = lowerQ.replace(/[^a-z0-9]+/g, '')
  const refPattern = refNormalized.length > 0 ? `%${refNormalized}%` : null

  // Score-zero exclusion + popularity DESC + alphabetical tie-break — Phase 18 D-15 idiom
  const candidates = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      wishlistCount: watchesCatalog.wishlistCount,
    })
    .from(watchesCatalog)
    .where(
      and(
        // Score-zero exclusion (D-02 / Phase 18 RESEARCH Pattern 5)
        sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount}) > 0`,
        // ILIKE OR on the three normalized columns (D-01)
        or(
          ilike(watchesCatalog.brandNormalized, pattern),
          ilike(watchesCatalog.modelNormalized, pattern),
          refPattern
            ? ilike(watchesCatalog.referenceNormalized, refPattern)
            : sql`false`,
        ),
      ),
    )
    .orderBy(
      desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
      asc(watchesCatalog.brandNormalized),
      asc(watchesCatalog.modelNormalized),
    )
    .limit(CANDIDATE_CAP)

  if (candidates.length === 0) return []

  // Top N by SQL order; slice to limit.
  const top = candidates.slice(0, limit)

  // Anti-N+1 hydration: single inArray batch query keyed by viewerId.
  const topIds = top.map((r) => r.id)
  const stateRows = await db
    .select({
      catalogId: watches.catalogId,
      status: watches.status,
    })
    .from(watches)
    .where(
      and(
        eq(watches.userId, viewerId),
        inArray(watches.catalogId, topIds),
      ),
    )

  // Resolve to single pill per catalogId — 'owned' wins over 'wishlist'
  // (D-05; sold + grail are NOT badged on this surface).
  const stateMap = new Map<string, 'owned' | 'wishlist'>()
  for (const row of stateRows) {
    if (!row.catalogId) continue
    const prior = stateMap.get(row.catalogId)
    if (row.status === 'owned') stateMap.set(row.catalogId, 'owned')
    else if (row.status === 'wishlist' && prior !== 'owned')
      stateMap.set(row.catalogId, 'wishlist')
  }

  return top.map((r) => ({
    catalogId: r.id,
    brand: r.brand,
    model: r.model,
    reference: r.reference,
    imageUrl: r.imageUrl,
    ownersCount: r.ownersCount,
    wishlistCount: r.wishlistCount,
    viewerState: stateMap.get(r.id) ?? null,  // 'owned' | 'wishlist' | null
  }))
}
```

**Notes on normalization:**
- The Watches query string normalization mirrors Phase 17 D-03 generated-column normalization: `lower(trim(...))` for brand/model, plus `regexp_replace('[^a-z0-9]+', '', 'g')` for reference. The catalog already stores normalized values in the generated columns; ILIKE against those normalized columns + a normalized pattern guarantees `'5711-1A'` and `'5711 1A'` and `'57111A'` all hit the same row [CITED: Phase 17 D-03 + Phase 17 schema migration].
- The GIN trigram index on `brand_normalized` + `model_normalized` is reachable for `ilike(col, '%X%')` patterns when X is ≥3 chars [VERIFIED: Phase 17 17-VERIFICATION.md "trgm planner reachability" line 91]. For 2-char queries the planner may fall back to Seq Scan; this is acceptable and consistent with `searchProfiles` D-21 behavior.
- Reference is unindexed (`reference_normalized` has no GIN). At <5K rows the Seq Scan cost is negligible.

### Pattern 2: Collections DAL — JOIN with unnest predicate + JS-side overlap sort

**What:** A single SQL query against `profiles ⨝ profileSettings ⨝ watches` with an ILIKE OR predicate that includes `EXISTS(SELECT 1 FROM unnest(...) t WHERE t ILIKE %q%)` over each text[] tag column. GROUP BY profileId with `count(*) AS matchCount` and an `array_agg` of matched watches/tags. Then JS-side `computeTasteOverlap` for the secondary sort.

**When to use:** Every Collections-tab Server Action call.

**Drizzle expression:**

```typescript
// Source: extends pattern from src/data/search.ts:74-91 (searchProfiles candidates query)
//         + EXISTS(unnest) tag-array predicate is new for Phase 19
import 'server-only'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { db } from '@/db'
import { profiles, profileSettings, watches } from '@/db/schema'

const TRIM_MIN_LEN = 2
const CANDIDATE_CAP = 50  // pre-LIMIT cap before JS-side overlap sort
const DEFAULT_LIMIT = 20

export async function searchCollections({
  q,
  viewerId,
  limit = DEFAULT_LIMIT,
}: { q: string; viewerId: string; limit?: number }): Promise<SearchCollectionResult[]> {
  const trimmed = q.trim()
  if (trimmed.length < TRIM_MIN_LEN) return []

  const pattern = `%${trimmed}%`

  // Single-query candidate pool: every (profileId, watchId) pair where the watch
  // matches the query AND the profile is publicly searchable AND the viewer is
  // not the profile owner. GROUP BY profileId, count matches, aggregate matched
  // watches into a JSON array for the row UI.
  //
  // Note on unnest(): Drizzle has no first-class `EXISTS(SELECT 1 FROM unnest(...))`
  // helper, so we use the raw `sql` template tag. Drizzle's parameterization keeps
  // the pattern variable safe — no string concatenation.
  const candidates = await db.execute<{
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    match_count: number
    matched_watches: Array<{
      watch_id: string
      brand: string
      model: string
      image_url: string | null
      match_path: 'name' | 'tag'
    }>
    matched_tags: string[]
  }>(sql`
    WITH matched AS (
      SELECT
        w.id AS watch_id,
        w.user_id,
        w.brand,
        w.model,
        w.image_url,
        CASE
          WHEN ${watches.brand} ILIKE ${pattern}
            OR ${watches.model} ILIKE ${pattern}
          THEN 'name'
          ELSE 'tag'
        END AS match_path,
        -- Capture which tag elements matched, for D-11 tag pills
        ARRAY(
          SELECT t FROM unnest(w.style_tags || w.role_tags || w.complications) t
           WHERE t ILIKE ${pattern}
        ) AS matched_tag_elements
      FROM watches w
      INNER JOIN profile_settings ps ON ps.user_id = w.user_id
      INNER JOIN profiles p ON p.id = w.user_id
      WHERE
        ps.profile_public = true
        AND ps.collection_public = true
        AND p.id != ${viewerId}
        AND (
          w.brand ILIKE ${pattern}
          OR w.model ILIKE ${pattern}
          OR EXISTS (SELECT 1 FROM unnest(w.style_tags) t WHERE t ILIKE ${pattern})
          OR EXISTS (SELECT 1 FROM unnest(w.role_tags) t WHERE t ILIKE ${pattern})
          OR EXISTS (SELECT 1 FROM unnest(w.complications) t WHERE t ILIKE ${pattern})
        )
    )
    SELECT
      p.id AS user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      COUNT(*)::int AS match_count,
      jsonb_agg(
        jsonb_build_object(
          'watch_id', m.watch_id,
          'brand', m.brand,
          'model', m.model,
          'image_url', m.image_url,
          'match_path', m.match_path
        ) ORDER BY m.match_path ASC, m.brand ASC
      ) FILTER (WHERE m.watch_id IS NOT NULL) AS matched_watches,
      -- Distinct tag elements matched across this user's collection (for D-11 tag pills)
      ARRAY(
        SELECT DISTINCT unnest(m.matched_tag_elements)
        FROM matched m2
        WHERE m2.user_id = p.id
      ) AS matched_tags
    FROM profiles p
    JOIN matched m ON m.user_id = p.id
    GROUP BY p.id, p.username, p.display_name, p.avatar_url
    ORDER BY match_count DESC, p.username ASC
    LIMIT ${CANDIDATE_CAP}
  `)

  // ... cast result to typed array, hydrate viewer + per-candidate watches +
  // computeTasteOverlap, sort by (matchCount DESC, overlap DESC, username ASC),
  // slice to limit. Mirror src/data/search.ts:96-156 for the overlap loop.
}
```

**Notes:**
- The `EXISTS(SELECT 1 FROM unnest(...) t WHERE t ILIKE %q%)` predicate works on Postgres `text[]` columns. `style_tags`, `role_tags`, and `complications` are all `text[] NOT NULL DEFAULT '{}'` per the schema [VERIFIED: src/db/schema.ts:85-87, 70].
- `design_traits` is intentionally excluded per CONTEXT D-09 (which lists style_tags, role_tags, complications — NOT design_traits). This matches the schema's `watches.design_traits` column existing but not being part of the search predicate.
- The `ORDER BY match_count DESC, p.username ASC LIMIT CANDIDATE_CAP` in SQL is the primary sort; the secondary `computeTasteOverlap`-based sort happens in Node after pre-LIMIT 50, mirroring the `searchProfiles` D-22 pattern [CITED: src/data/search.ts:152-156].
- `computeTasteOverlap` is per-pair; for 50 candidates the loop is 50 iterations, each fetching the candidate's watches + preferences + wear events. Phase 16 already validated this scale; no new concerns.

### Pattern 3: All-Tab Fan-Out — three Server Actions, parallel from client

**What:** The All tab fires three independent `useEffect` flows (or one `useEffect` running `Promise.all` of three Server Actions). Each section has its own loading + results slice in `useSearchState`.

**When to use:** When `tab === 'all'`.

**Recommended shape — single `useEffect` with `Promise.all`, single AbortController:**

```typescript
// Source: extends src/components/search/useSearchState.ts:74-114
// Inside the fetch effect, when tab === 'all':
useEffect(() => {
  if (tab !== 'all' && tab !== 'people' && tab !== 'watches' && tab !== 'collections') {
    return
  }
  if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
    setPeopleResults([]); setWatchesResults([]); setCollectionsResults([])
    setIsLoading(false); setHasError(false)
    return
  }

  const controller = new AbortController()
  setIsLoading(true)
  setHasError(false)

  void (async () => {
    try {
      if (tab === 'all') {
        // Per-section skeletons via independent Promise resolution; we still
        // dispatch all three at once so they race in parallel.
        const [people, watches, collections] = await Promise.all([
          searchPeopleAction({ q: debouncedQ }),
          searchWatchesAction({ q: debouncedQ }),
          searchCollectionsAction({ q: debouncedQ }),
        ])
        if (controller.signal.aborted) return
        setPeopleResults(people.success ? people.data.slice(0, 5) : [])
        setWatchesResults(watches.success ? watches.data.slice(0, 5) : [])
        setCollectionsResults(collections.success ? collections.data.slice(0, 5) : [])
      } else if (tab === 'people') {
        const result = await searchPeopleAction({ q: debouncedQ })
        if (controller.signal.aborted) return
        setPeopleResults(result.success ? result.data : [])
      } else if (tab === 'watches') {
        const result = await searchWatchesAction({ q: debouncedQ })
        if (controller.signal.aborted) return
        setWatchesResults(result.success ? result.data : [])
      } else {
        const result = await searchCollectionsAction({ q: debouncedQ })
        if (controller.signal.aborted) return
        setCollectionsResults(result.success ? result.data : [])
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      if (controller.signal.aborted) return
      setHasError(true)
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  })()

  return () => controller.abort()
}, [debouncedQ, tab])
```

**Why one controller is sufficient on All tab:**
- `controller.abort()` is signal-based; calling it sets `signal.aborted = true` immediately and triggers the abort listener on every fetch transport.
- The browser fetch transport (used by Server Action POSTs under the hood) honors abort: requests in flight are cancelled at the network layer.
- Each Promise inside `Promise.all` resolves independently, but the `controller.signal.aborted` check after `await Promise.all([...])` is the stale-result guard.
- Per-section skeleton paint: if the user wants Watches to paint as soon as it resolves (before People), the cleaner shape is **three independent `useEffect` blocks**, each with its own AbortController, each writing to its own results slice. This is also viable; the code is slightly more verbose but each section paints independently. **Recommendation:** start with the single-effect `Promise.all` shape (simpler) and only fork to three effects if per-section paint timing becomes an observable UX problem.

**Alternative (3 independent effects) — worth considering for D-15 "fast sections paint immediately":**

```typescript
// Each tab path runs in its own useEffect with its own AbortController.
// All three depend on [debouncedQ, tab] but only fire when tab === 'all' || tab === '<their tab>'.
// Trade-off: three controllers = three abort calls per tab/q change; cleaner per-section paint.
```

**Recommendation:** **Three independent effects** for the All tab path specifically. D-15 explicitly says "fast sections paint immediately" — that's a per-section state slice with per-section loading flag. The single `Promise.all` shape blocks the slowest section. Three effects is ~30 more lines of code but materially better UX.

### Pattern 4: HighlightedText reuse (SRCH-15)

**What:** Wrap brand+model on Watches rows and matched-watch brand+model on Collections rows in `<HighlightedText text={...} q={trimmed} />`. The component is XSS-safe by construction (regex-escape + React text children only) [VERIFIED: src/components/search/HighlightedText.tsx:23-46].

**When to use:** Every visible matched substring on every search row.

**Pattern from PeopleSearchRow:**

```tsx
// Source: src/components/search/PeopleSearchRow.tsx:60
<p className="text-sm font-semibold truncate">
  <HighlightedText text={name} q={q} />
</p>
```

For Watches rows, concatenate brand + model into a single highlighted span:

```tsx
<p className="text-sm font-semibold truncate">
  <HighlightedText text={`${result.brand} ${result.model}`} q={q} />
</p>
{result.reference && (
  <p className="text-xs text-muted-foreground">
    <HighlightedText text={result.reference} q={q} />
  </p>
)}
```

### Anti-Patterns to Avoid

- **Per-row owned/wishlist query:** Iterating over result rows and firing a `db.select().from(watches).where(...)` per row is the SRCH-10 anti-N+1 pitfall. Always use `inArray(watches.catalogId, topIds)` once.
- **String concatenation of user input into raw SQL:** Use `${pattern}` Drizzle template-tag interpolation everywhere. Never `sql\`... ILIKE '%${pattern}%' ...\`` because that bypasses parameterization.
- **`design_traits` in the Collections WHERE predicate:** D-09 lists style_tags, role_tags, complications — not design_traits. Including design_traits would surface noise.
- **Fetching the catalog row again for the Evaluate CTA target:** The `catalogId` is already on the row payload. The `<Link href={`/evaluate?catalogId=${row.catalogId}`}>` resolves at render time.
- **Caching per-viewer fetches under `'use cache'`:** Owned/wishlist hydration depends on `viewerId`; collection-search results depend on `viewerId` (self-exclusion + tasteOverlap). Both must stay outside `'use cache'` scope. Catalog-only Watches results MAY cache, but only the unhydrated half — see §"Cache Strategy" below.
- **Using `mark` element for HighlightedText:** Rejected in Phase 16 because UA-default yellow background fights theme tokens. Stick with `<strong className="font-semibold text-foreground">` [CITED: src/components/search/HighlightedText.tsx:18-22].
- **Aborting via mutating fetch dispatch state instead of AbortController:** The signal-based pattern is the only reliable way to drop stale results across React re-renders.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ILIKE OR across multiple columns | Custom SQL string concat | `or(ilike(col1, p), ilike(col2, p), ilike(col3, p))` from drizzle-orm | Parameterized; type-safe; matches `searchProfiles` precedent |
| Tag-array substring match | `LIKE ANY(array)` or per-tag JS filter | `EXISTS(SELECT 1 FROM unnest(col) t WHERE t ILIKE %q%)` via raw `sql` | Postgres-native; works on text[] DEFAULT '{}'; single SQL pass |
| Owned/wishlist badge hydration | Per-row query loop | Single `inArray(watches.catalogId, topIds)` filtered by `viewerId` | SRCH-10 mandate; <500 watches/user means <500-element IN list which is well within Postgres limits |
| Match highlighting | Custom regex builder + dangerouslySetInnerHTML | `<HighlightedText text q />` (existing) | XSS-safe by construction; reused across every search surface (SRCH-15) |
| Per-pair taste overlap | Reimplement scoring weights | `computeTasteOverlap(viewer, owner)` from `src/lib/tasteOverlap.ts` | Already shipped Phase 16; D-16 explicitly reuses |
| Stale-fetch guarding | Manual epoch counter / mutation flag | `AbortController` + `signal.aborted` post-await check | Browser-native; cancels at the network layer; matches `useSearchState` v3.0 pattern |
| URL sync with debounced query + tab | Direct `history.pushState` | `router.replace(qs ? '/search?'+qs : '/search', { scroll: false })` | Already wired in `useSearchState.ts:65-71`; preserve unchanged |
| Server Action input validation | Hand-rolled type guards | `z.object({ q: z.string().max(200) }).strict()` | Already established in `src/app/actions/search.ts:13-17`; rejects mass-assignment |
| Auth gate | Manual session probe | `getCurrentUser()` from `@/lib/auth` | Throws `UnauthorizedError`; established Server Action shape |

**Key insight:** Every primitive Phase 19 needs already exists in the codebase. The phase is a careful composition of Phase 16 (search shell + HighlightedText + searchProfiles + AbortController) + Phase 17 (catalog schema + GIN trigram + generated columns) + Phase 18 (popularity-DESC ranking + revalidateTag fan-out). The plan should resist the urge to introduce new primitives.

## Common Pitfalls

### Pitfall 1: Reference normalization mismatch
**What goes wrong:** User types `'5711-1A'`, but `reference_normalized` stores `'57111a'` (per Phase 17 D-03 generated column). ILIKE against `reference_normalized` with pattern `%5711-1A%` returns zero rows.
**Why it happens:** The query is normalized differently from the stored value.
**How to avoid:** Apply the same normalization to the user's query string before constructing the ILIKE pattern. Pseudocode:
```typescript
const refNormalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')
const refPattern = refNormalized.length > 0 ? `%${refNormalized}%` : null
```
Then ILIKE `reference_normalized` against `refPattern` (only if non-empty). For brand/model, simple `lower(trim(...))` is sufficient and the `%${lowerQ}%` pattern works against `brand_normalized` / `model_normalized`.
**Warning signs:** Queries containing punctuation (`5711/1A`, `116610-LN`) return zero hits when known matches exist.

### Pitfall 2: postgres.js empty array literal
**What goes wrong:** When Drizzle compiles `${pattern}` and pattern is an empty string or array, postgres.js may emit invalid SQL (`()::text[]`).
**Why it happens:** Already documented in `src/data/catalog.ts:174-180` — empty JS arrays render as invalid SQL.
**How to avoid:** Guard with `pattern.length === 0` checks; use `sql\`'{}'::text[]\`` for empty literals or skip the predicate entirely.
**Warning signs:** `syntax error at or near ")"` from Postgres on edge-case queries.

### Pitfall 3: AbortController not actually cancelling Server Action
**What goes wrong:** The browser fetch transport honors abort, but server-side execution may continue. If the Server Action takes 800ms and the user types a 4th character at 250ms, the first action's response will still arrive — and overwrite the new state.
**Why it happens:** `controller.abort()` cancels the network request, but the post-`await` resolution still runs the `setResults(...)` in the original async closure.
**How to avoid:** **Always check `if (controller.signal.aborted) return` after every `await`** before mutating state. Already established in `useSearchState.ts:97`.
**Warning signs:** Stale results flicker into view briefly during fast typing.

### Pitfall 4: `inArray(col, [])` builds a degenerate query
**What goes wrong:** If `topIds` is empty, `inArray(watches.catalogId, [])` compiles to `WHERE col IN ()` which Postgres rejects.
**Why it happens:** Drizzle does not auto-skip empty `IN` clauses.
**How to avoid:** Length-guard: `if (topIds.length === 0) return []` before the inArray call. Mirror `src/data/search.ts:160-170`.
**Warning signs:** Postgres `syntax error at or near ")"` on no-results queries.

### Pitfall 5: Self-exclusion via `profiles.id != viewerId` not `eq(profiles.id, viewerId, '!=')`
**What goes wrong:** Drizzle has no `ne` import shorthand by default; `eq` is the equality helper.
**Why it happens:** Cargo-culted `eq` patterns.
**How to avoid:** Use `sql\`${profiles.id} != ${viewerId}\`` — same idiom as `src/data/search.ts:87`. (Drizzle exports `ne` from `drizzle-orm`, but the existing codebase uses `sql` template; consistency wins.)
**Warning signs:** Viewer's own profile appears in their own Collections search results.

### Pitfall 6: Two-layer privacy missing the AND on collectionPublic
**What goes wrong:** SRCH-12 requires BOTH `profile_public = true` AND `collection_public = true`. Forgetting the second AND surfaces collectors whose profile is public but whose collection is private — a subtle leak.
**Why it happens:** Copy-paste from `searchProfiles` (which only checks `profilePublic`).
**How to avoid:** Explicit two-line WHERE:
```typescript
eq(profileSettings.profilePublic, true),
eq(profileSettings.collectionPublic, true),
```
Both clauses appear together. Add a regression test (see §Validation Architecture) that toggles `collectionPublic = false` and asserts the collector is excluded.
**Warning signs:** Beta tester reports "I disabled my collection but I'm still showing up in /search/collections".

### Pitfall 7: HighlightedText regex meta-characters
**What goes wrong:** User query containing `(`, `.`, `*`, `\`, `[` would crash the regex constructor or trigger ReDoS.
**Why it happens:** Naive `new RegExp(q)` without escape.
**How to avoid:** Already mitigated in `HighlightedText.tsx:28` — `escapedQ = trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. **Reuse the component unchanged.** Do NOT reimplement.
**Warning signs:** Search input with `.*` or unmatched brackets crashes the page.

### Pitfall 8: `revalidateTag('search-watches', 'max')` cascading invalidation
**What goes wrong:** If the planner adds a `'search-watches'` tag to cached Watches results, fan-out from `addWatch`/`editWatch`/`removeWatch` is fine in principle but adds another tag to every relevant Server Action. Phase 18 already wires `revalidateTag('explore', 'max')` on those actions; adding `'search-watches'` is cheap but easy to forget on one of the three paths.
**Why it happens:** Three Server Actions need the same fan-out; one is missed.
**How to avoid:** If caching is opted in, add `'search-watches'` to all three watches Server Actions in the same commit. Phase 18 RESEARCH precedent suggests "Phase 18 RESEARCH already wires `revalidateTag('explore', 'max')` on the same Server Actions; an additional `'search-watches'` tag fan-out is cheap" [CITED: 19-CONTEXT.md line 93].
**Warning signs:** Newly-added catalog rows appear in /explore Trending but not /search Watches.

### Pitfall 9: Tab gate forgotten in `useSearchState`
**What goes wrong:** The current `useSearchState.ts:75-81` has a tab-gate that returns early when `tab !== 'all' && tab !== 'people'`. Phase 19 must REMOVE this early-return — Watches and Collections both need to fire fetches now.
**Why it happens:** Cargo-cult preservation of Phase 16 logic.
**How to avoid:** Replace the early-return with a tab-dispatcher that calls the right Server Action(s). The `tab !== 'all' && tab !== 'people'` predicate disappears entirely.
**Warning signs:** Watches tab shows skeleton forever; no network request fires.

### Pitfall 10: Catalog-only Watches caching breaks viewer-state badges
**What goes wrong:** Caching the entire Watches Server Action result with `'use cache'` would freeze the viewer's owned/wishlist badges across users.
**Why it happens:** Naive caching of Server Action output.
**How to avoid:** Two-step pattern — cache the catalog-only candidate query (`searchCatalogWatchesUnhydrated({q})`) at short TTL, but execute the `inArray(watches.catalogId, topIds)` viewer-state hydration outside cache scope. The Server Action wraps both: cached fetch + uncached hydration + merge. Mirror Phase 18's per-rail caching philosophy.
**Warning signs:** User A sees "Owned" pill on a watch User A doesn't own.

## Code Examples

Verified patterns from official sources / existing codebase:

### Drizzle ILIKE OR with parameterized pattern
```typescript
// Source: src/data/search.ts:67-71 (searchProfiles)
const matchExpr =
  trimmed.length >= BIO_MIN_LEN
    ? or(ilike(profiles.username, pattern), ilike(profiles.bio, pattern))
    : ilike(profiles.username, pattern)
```

### Drizzle inArray + Map for badge hydration
```typescript
// Source: src/data/search.ts:159-173 (searchProfiles isFollowing)
const topIds = top.map((r) => r.userId)
const followingRows = topIds.length
  ? await db
      .select({ id: follows.followingId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerId),
          inArray(follows.followingId, topIds),
        ),
      )
  : []
const followingSet = new Set(followingRows.map((r) => r.id))
return top.map((r) => ({ ...r, isFollowing: followingSet.has(r.userId) }))
```

### Two-layer privacy (innerJoin + WHERE both flags)
```typescript
// Source: src/data/search.ts:82-90 (searchProfiles candidate query)
.from(profiles)
.innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
.where(
  and(
    eq(profileSettings.profilePublic, true), // Layer 1
    sql`${profiles.id} != ${viewerId}`,       // Layer 2: viewer self-exclusion
    matchExpr,
  ),
)
// For Phase 19 Collections, ADD: eq(profileSettings.collectionPublic, true)
```

### Score-zero exclusion + popularity-DESC + tie-break
```typescript
// Source: src/data/discovery.ts:139-159 (getTrendingCatalogWatches)
.where(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount}) > 0`)
.orderBy(
  desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
  asc(watchesCatalog.brandNormalized),
  asc(watchesCatalog.modelNormalized),
)
.limit(limit)
```

### Whole-row absolute-inset Link + raised inline button (D-07)
```tsx
// Source: src/components/home/SuggestedCollectorRow.tsx:34-95 — Phase 19 Watches row mirrors this exactly
<div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
  <Link
    href={`/evaluate?catalogId=${result.catalogId}`}
    aria-label={`Evaluate ${result.brand} ${result.model}`}
    className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  />
  {/* Image */}
  <div className="size-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
    {result.imageUrl ? (
      <Image src={result.imageUrl} alt="" width={48} height={48} className="object-cover" unoptimized />
    ) : (
      <WatchIcon className="size-5 text-muted-foreground" aria-hidden />
    )}
  </div>
  {/* Brand + model + reference, all highlighted */}
  <div className="relative flex-1 min-w-0 pointer-events-none">
    <p className="text-sm font-semibold truncate">
      <HighlightedText text={`${result.brand} ${result.model}`} q={q} />
    </p>
    {result.reference && (
      <p className="text-xs text-muted-foreground truncate">
        <HighlightedText text={result.reference} q={q} />
      </p>
    )}
  </div>
  {/* Single contextual pill (D-05) */}
  {result.viewerState === 'owned' && (
    <span className="relative text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary pointer-events-none">Owned</span>
  )}
  {result.viewerState === 'wishlist' && (
    <span className="relative text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground pointer-events-none">Wishlist</span>
  )}
  {/* Raised Evaluate CTA (z-10) — duplicates the parent Link target so screen readers and click semantics agree */}
  <div className="relative z-10">
    <Link
      href={`/evaluate?catalogId=${result.catalogId}`}
      className="text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
    >
      Evaluate
    </Link>
  </div>
</div>
```

### AbortController + signal.aborted post-await guard
```typescript
// Source: src/components/search/useSearchState.ts:90-114
const controller = new AbortController()
void (async () => {
  try {
    const result = await searchPeopleAction({ q: debouncedQ })
    if (controller.signal.aborted) return  // stale-result guard
    if (!result.success) { setHasError(true); setResults([]) }
    else setResults(result.data)
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return
    if (controller.signal.aborted) return
    setHasError(true)
  } finally {
    if (!controller.signal.aborted) setIsLoading(false)
  }
})()
return () => controller.abort()
```

### Server Action shape with Zod .strict() + auth gate
```typescript
// Source: src/app/actions/search.ts:13-61 (searchPeopleAction)
const searchSchema = z.object({ q: z.string().max(200) }).strict()

export async function searchWatchesAction(
  data: unknown,
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
  let user
  try { user = await getCurrentUser() }
  catch { return { success: false, error: 'Not authenticated' } }

  const parsed = searchSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }

  try {
    const results = await searchCatalogWatches({
      q: parsed.data.q,
      viewerId: user.id,
      limit: 20,
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchWatchesAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
```

## Q&A: Specific Research Questions

### Q1: Watches query mechanics

**Drizzle expression:** See §Pattern 1 above. `or(ilike(brandNormalized, p), ilike(modelNormalized, p), ilike(referenceNormalized, refP))` with the reference branch guarded against empty refP.

**Normalization of user query:** Apply `lower(trim(...))` for brand/model patterns. Apply `lower(trim(...)) → regexp_replace('[^a-z0-9]+', '', 'g')` for reference. Pattern: `%${lowerQ}%` and `%${refNormalized}%`. The GIN trigram index handles the substring fuzz on lowercased generated columns; no need for `pg_trgm.similarity()` ranking (D-02 explicitly rejects it).

**Pre-LIMIT cap:** 50 (matches `searchProfiles` `CANDIDATE_CAP`). Final slice to 20 (D-04).

**Score-zero exclusion:** WHERE clause (`(owners_count + 0.5 * wishlist_count) > 0`) — same idiom as Phase 18 `getTrendingCatalogWatches` line 151. Cleaner than post-filter.

**Reference-only Seq Scan cost:** At <5K catalog rows, a Seq Scan on `reference_normalized` is sub-50ms (Phase 18 RESEARCH validated this for the unsorted ORDER BY case at the same table size). Reference-only queries are rare; v4.0 acceptable. If reference queries become hot post-launch, add a `CREATE INDEX watches_catalog_reference_normalized_trgm_idx ON watches_catalog USING gin (reference_normalized gin_trgm_ops);` migration.

### Q2: Owned/Wishlist badge hydration (SRCH-10)

**Where to put it:** **Inside `searchCatalogWatches` DAL.** Reasons: (1) keeps the Server Action a pure mapper from DAL output to ActionResult; (2) the `viewerId` flows naturally into the DAL signature; (3) testing is easier — one DAL fn returning the fully-hydrated row shape.

**Resolution priority when same `catalogId` appears in both 'owned' and 'wishlist':** D-05 explicitly states `'owned' > 'wishlist'`. Phase 17/18 do NOT enforce uniqueness — a user could legitimately have an `'owned'` Submariner and a `'wishlist'` Submariner (e.g., a second one, or grail-tracking). The Map merge in §Pattern 1 handles this:
```typescript
if (row.status === 'owned') stateMap.set(row.catalogId, 'owned')
else if (row.status === 'wishlist' && prior !== 'owned') stateMap.set(row.catalogId, 'wishlist')
```
This is client-side resolution. No schema change needed.

### Q3: Collections query mechanics (SRCH-11)

**Drizzle expression for `EXISTS(SELECT 1 FROM unnest(...) t WHERE t ILIKE %q%)` on text[]:** Use raw `sql` template tag — Drizzle has no first-class helper. Pattern shown in §Pattern 2. Parameterization is preserved through `${pattern}` — no string concatenation.

**Single-query strategy:** A CTE (`WITH matched AS ...`) that selects matching watches with their owners + match path, then GROUP BY profile_id with `COUNT(*) AS match_count` and `jsonb_agg(...)` of matched watches. Two-layer privacy + self-exclusion enforced inside the CTE's WHERE. The pattern is cleaner than two queries because it's one round-trip and the matched-watches array comes back already grouped.

**Pre-LIMIT:** 50 candidates by `match_count DESC, username ASC` in SQL → JS sort by `match_count DESC, computeTasteOverlap DESC, username ASC` → final slice to 20 (D-04).

**`computeTasteOverlap` call site:** In the JS sort step, after the SQL candidates resolve. For each of the 50 candidates, fetch `getWatchesByUser(candidateId) + getPreferencesByUser(candidateId) + getAllWearEventsByUser(candidateId)`, compute overlap. **Memoization:** Phase 16 `searchProfiles` already does this same loop (`src/data/search.ts:108-150`); the per-candidate fetches are not memoized across calls — but inside one Server Action invocation, the viewer's data is fetched once (lines 96-100). Pattern is N=50 candidates × ~3 DB round-trips per candidate = 150 round-trips per Collections search. Acceptable at v4.0 scale; if it becomes a bottleneck, batch via `inArray` (deferred optimization).

### Q4: All-tab fan-out architecture (SRCH-13, D-15)

**Recommended:** **Three separate Server Actions called from three independent `useEffect`s.** Each tab path has its own results slice + loading slice + AbortController.

**Why not one fan-out action:**
- Error isolation: if one section throws, others keep painting. Single action would have to catch internally per section.
- Per-section paint timing: D-15 says "fast sections paint immediately" — three independent fetches let Watches paint at 80ms even if Collections takes 400ms.
- Cache opportunity: catalog-only Watches MAY cache; per-viewer People + Collections cannot. A single fan-out action couldn't cleanly opt-in per section.
- AbortController granularity: three sub-controllers gracefully cancel just the sections that need cancelling on tab switch.

**One AbortController vs three:** **Three** — one per section. On tab change, all three abort. On query change, all three abort. The implementation cost is small (one `useEffect` per section; each declares its own `controller`). The UX win is that the Watches section can paint immediately even while Collections is still loading.

**Caveat:** the existing `useSearchState` is already a fairly tight 119 lines. Splitting into three sub-effects is the right call but should be explicitly planned — not a one-line edit.

### Q5: Per-(tab, q) AbortController extension (SRCH-14)

**Stale-result guard pattern:** `if (controller.signal.aborted) return` after every `await`, before mutating state. Established in `useSearchState.ts:97`.

**Tab switch with same q:** User switches `?tab=watches&q=Speed` → `?tab=collections&q=Speed`. `debouncedQ` doesn't change but `tab` does. The fetch effect's dependency array `[debouncedQ, tab]` triggers cleanup → `controller.abort()` → new effect runs → dispatches the right tab fetcher. **Confirmed correct.**

**One AbortController for All-tab fan-out vs three:** Per Q4 recommendation: **three sub-controllers (one per section).** Cleaner per-section paint, cleaner per-section abort. Tab-switching the All tab off aborts all three.

### Q6: Row UX patterns (D-05, D-07)

**Evaluate button structure:** Both the absolute-inset Link AND the inline raised button target `/evaluate?catalogId={uuid}`. The inner button is `<Link>` (not `<button>`) to ensure right-click → Open in New Tab works for power users. The `relative z-10` lifts it above the absolute-inset; clicks on the button reach the button's Link, not the parent's. Both Links target the same URL — no JS-level event-stop needed.

**Single contextual pill:** Render based on `result.viewerState`:
- `'owned'` → `<span class="bg-primary/10 text-primary">Owned</span>`
- `'wishlist'` → `<span class="bg-muted text-muted-foreground">Wishlist</span>`
- `null` → no pill rendered

**Color/style hint for UI-SPEC:** Use semantic tokens (primary tinted for Owned to feel affirmative; muted for Wishlist to feel passive). Rounded-full + small text + tight padding (`px-2 py-0.5 rounded-full text-xs`).

**HighlightedText wrap:** `<HighlightedText text={`${result.brand} ${result.model}`} q={q} />` — single match pass over the concatenated string. Reference rendered separately if present.

### Q7: Schema additions

**Confirmed text[]:** `style_tags`, `role_tags`, `complications` are all `text('...').array().notNull().default(sql\`'{}'::text[]\`)` on the `watches` table [VERIFIED: src/db/schema.ts:70, 85-87].

**Optional `reference_normalized` GIN index:** **Skip for v4.0.** At <5K catalog rows the Seq Scan cost is sub-50ms. Reference-only queries are rare. If post-launch metrics show reference search latency degrading, add a Phase 19.x or v4.x patch migration:
```sql
-- supabase/migrations/202604xxxxxxxx_phase19_reference_trgm.sql
CREATE INDEX IF NOT EXISTS watches_catalog_reference_normalized_trgm_idx
  ON watches_catalog USING gin (reference_normalized gin_trgm_ops);
```

### Q8: Server Action contracts

**Recommendation: three actions, no fan-out action.** Existing file `src/app/actions/search.ts` is 62 lines; adding two more actions of ~30 lines each keeps the file under ~150 lines and cohesive. No new file needed.

**Return type shapes:**

```typescript
// src/lib/searchTypes.ts — extend
export interface SearchCatalogWatchResult {
  catalogId: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
  viewerState: 'owned' | 'wishlist' | null
}

export interface SearchCollectionResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchCount: number
  tasteOverlap: number  // 0..1
  matchedWatches: Array<{
    watchId: string
    brand: string
    model: string
    imageUrl: string | null
    matchPath: 'name' | 'tag'
  }>
  matchedTags: string[]
}
```

### Q9: Cache strategy

**Two-step pattern for Watches tab (Discretion-recommended):**

```typescript
// src/data/catalog.ts
'use cache'  // Or use `cacheTag` + `cacheLife` per-fn
export async function searchCatalogWatchesUnhydrated({ q, limit }): Promise<UnhydratedRow[]> {
  // catalog-only candidate query — no viewerId
  // cacheTag('search-watches', `q:${normalize(q)}`)
  // cacheLife({ revalidate: 300 }) — 5 min
}

// Server Action layer (NOT cached)
export async function searchWatchesAction(data) {
  const candidates = await searchCatalogWatchesUnhydrated({ q, limit: 20 })  // cacheable
  const stateMap = await getViewerWatchStatesForCatalogIds(viewerId, candidates.map(c => c.catalogId))  // not cached
  return { success: true, data: candidates.map((c) => ({ ...c, viewerState: stateMap.get(c.catalogId) ?? null })) }
}
```

**`revalidateTag('search-watches', 'max')` fan-out:** Recommended. Phase 18 already wires `revalidateTag('explore', 'max')` on `addWatch`/`editWatch`/`removeWatch` (`src/app/actions/watches.ts:177, 218, 248`). Add `'search-watches'` to those same three call sites. Cheap; keeps cache fresh within session window.

**Collections tab caching:** No caching candidate. Per-viewer (self-exclusion + tasteOverlap). Live fetch every time.

**Recommendation for v4.0:** Ship Watches WITHOUT caching first. The Watches DAL is fast (single SQL + single inArray). Add caching as a follow-up if observed latency justifies it. Keeping the v4.0 plan simple > shaving 50ms off a sub-200ms surface.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 16 `useSearchState` with single AbortController + tab-gate early-return for Watches/Collections | Phase 19 `useSearchState` with extended `[debouncedQ, tab]` deps + per-tab dispatcher (or three sub-effects) | Phase 19 | Watches and Collections tabs both fire fetches; tab switch correctly aborts prior in-flight fetches |
| Phase 16 `searchProfiles` two-layer privacy via `profilePublic` only | Phase 19 `searchCollections` two-layer privacy via `profilePublic AND collectionPublic` | Phase 19 | Stricter gate — collectors with private collections excluded from cross-user collection search |
| Phase 18 `getTrendingCatalogWatches` (no WHERE filter) | Phase 19 `searchCatalogWatches` (adds ILIKE OR WHERE) | Phase 19 | Same body, adds query predicate |
| Phase 16 single search action (`searchPeopleAction`) | Phase 19 three search actions (people, watches, collections) | Phase 19 | One symbol per surface; All tab fans out client-side |

**Deprecated/outdated:**
- The two `<ComingSoonCard>` panels in `SearchPageClient.tsx` (Watches + Collections TabsContent) are removed — replaced with real result blocks.
- The two compact footer `<ComingSoonCard>` components in the All tab are removed — replaced with the Watches + Collections sections.
- The `tab !== 'all' && tab !== 'people'` early-return in `useSearchState.ts:75-81` is removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Watches Server Action does NOT need `'use cache'` for v4.0 — observed latency will be sub-200ms without caching | Q9 | If real-world Watches latency exceeds 500ms, planner adds the two-step cache pattern. Backout: easy. |
| A2 | Three independent `useEffect` blocks for All-tab sections is the right shape for D-15 "fast sections paint immediately" | Q4 | Single `Promise.all` with one controller is also viable. If the planner chooses the simpler shape, D-15 is still satisfied — just with synchronized paint timing. |
| A3 | Reference-only queries at v4.0 scale (<5K catalog rows) Seq Scan in <50ms | Q1, Q7 | If catalog grows fast and reference search becomes hot, add the GIN trigram index in a v4.x patch. |
| A4 | The CTE-based Collections query (`WITH matched AS ...` + `GROUP BY profile_id`) hits sub-300ms at <500 watches/user × <100 public profiles | Q3 | If query times out, fall back to two-query pattern: (1) filter watches → user_ids; (2) fetch profiles + counts. Easy refactor. |
| A5 | `computeTasteOverlap` per-candidate loop (50 iterations) at v4.0 scale fits within Server Action latency budget | Q3 | Phase 16 `searchProfiles` already validated this exact pattern. Risk is low. |
| A6 | The `<HighlightedText>` component is XSS-safe under React 19.2.4's text-children rules | Pattern 4 | Component is unchanged from Phase 16; risk is zero unless React 19.2.4 changed text-escaping behavior (unlikely). |
| A7 | Drizzle 0.45.2 `sql` template tag preserves parameterization for `${pattern}` interpolations inside `EXISTS(SELECT 1 FROM unnest(...) t WHERE t ILIKE ${pattern})` | Pattern 2 | Validated by `src/data/discovery.ts:212-216` (existing `db.execute<...>(sql\`...\`)` usage). |
| A8 | The `inArray(watches.catalogId, topIds)` predicate works correctly when `catalogId` is nullable (some user watches have null catalogId) | Pattern 1, Q2 | `inArray` skips null entries naturally; the WHERE filters to rows where `catalogId IN (...)`, and nulls don't satisfy that. Risk is zero. |

**These assumptions are LOW-MEDIUM risk and surface for user/discuss-phase confirmation only if the planner reaches a point where decisions hinge on them.**

## Open Questions (RESOLVED)

1. **All-tab single-effect-with-Promise.all vs three independent effects in `useSearchState`?**
   - What we know: D-15 says "parallel fetch + per-section skeletons" and "fast sections paint immediately". Both shapes honor D-15; the three-effect shape paints sections independently.
   - What's unclear: whether the user wants strict per-section paint (three effects) or accepts the simpler single-effect with synchronized paint (Promise.all).
   - Recommendation: start with three independent effects per recommendation in §Pattern 3. If the implementation cost is observed to be too high relative to the UX win, downgrade to Promise.all and revisit if users report "Watches feels sluggish on All tab."
   - **RESOLVED:** Path A chosen — three independent sub-effects, one AbortController per section. Lands in Plan 05 (Task 1) — `src/components/search/useSearchState.ts` ships three useEffect blocks (people / watches / collections), each with its own `AbortController`. Per-section paint independence regression-locked by Plan 05 Test 16. Plan 06 (composer + page wiring, split off from the prior single Plan 05 per checker iteration 1) consumes the resulting per-tab slices.

2. **Should the planner ship the optional `revalidateTag('search-watches', 'max')` fan-out in Phase 19?**
   - What we know: the fan-out is "cheap" (per CONTEXT.md). Phase 18 already wires `revalidateTag('explore', 'max')` on the same three actions.
   - What's unclear: whether the user wants two-tag vs one-tag granularity.
   - Recommendation: ship the two-tag fan-out. Three call-site edits, ~3 lines total.
   - **RESOLVED:** NOT shipped in Phase 19. Deferral rationale: Phase 19 already touches 6 plans across DAL + Server Actions + 3 row components + hook + composer + page. The `revalidateTag('search-watches', 'max')` fan-out is genuinely cheap (~3 lines) but it requires touching `src/app/actions/watches.ts` (a non-search-related file already covered by Phase 18's `revalidateTag('explore', 'max')` call sites) and adds a new tag namespace whose value is observable only after Watches catalog rows mutate within a session. v4.0 single-user MVP scale: catalog mutations are infrequent and cache windows resolve naturally. Reopen if real usage surfaces stale Watches results within a session. Tracked as a future enhancement; not a Phase 19 deliverable.

3. **Does the `'Evaluate'` button copy stay literally "Evaluate" or should the planner align with Phase 20's verdict-card UX language?**
   - What we know: D-08 says the CTA targets `/evaluate?catalogId={uuid}`. The button text is UI-SPEC's call.
   - What's unclear: whether Phase 20 ships with verdict-card buttons that say "Evaluate" or some variant.
   - Recommendation: "Evaluate" is the obvious default and matches the route name. UI-SPEC owns the final copy.
   - **RESOLVED:** "Evaluate" stays per `19-UI-SPEC.md` line 199 ("Watches tab — 'Evaluate' button label" → "Evaluate") and Plan 03 Task 1 acceptance criteria (`grep -n "Evaluate" src/components/search/WatchSearchRow.tsx`). Aligns with the route name `/evaluate?catalogId={uuid}` and the EVAL-06 requirement language. Phase 20 may revisit verdict-card button copy without breaking this contract.

## Environment Availability

This phase is purely code/config — no new external dependencies. Skipping detailed audit per Step 2.6 condition.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres + pg_trgm extension | Watches GIN trigram index | ✓ | Phase 17 verified | — |
| Drizzle ORM | DAL queries | ✓ | 0.45.2 (locked in package.json) | — |
| Next.js Server Actions | Watch + Collection actions | ✓ | 16.2.3 (locked) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 with `vitest run` (unit) + `vitest --run integration` (integration; live-DB tests in `tests/integration/`) |
| Config file | `vitest.config.ts` (existing) + `tests/setup.ts` |
| Quick run command | `npm test` (full vitest run, ~3-4s for the existing 56-test Phase 17 suite) |
| Full suite command | `npm test` (unit + integration unified) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-09 | Watches tab returns catalog matches with brand/model/owned-wishlist badges + Evaluate CTA | integration | `npx vitest run tests/data/searchCatalogWatches.test.ts -t "Watches tab"` | ❌ Wave 0 |
| SRCH-09 | WatchSearchRow renders thumbnail + brand/model + correct pill + Evaluate Link | unit (RTL) | `npx vitest run tests/components/search/WatchSearchRow.test.tsx -t "row UX"` | ❌ Wave 0 |
| SRCH-10 | Owned/wishlist hydration is single batched inArray query (anti-N+1) | integration | `npx vitest run tests/data/searchCatalogWatches.test.ts -t "anti-N+1 query log"` | ❌ Wave 0 — query-log assertion via Drizzle chainable mock + inArray-call counter |
| SRCH-11 | Collections matches by brand+model+tag elements (style/role/complications); design_traits NOT included | integration | `npx vitest run tests/data/searchCollections.test.ts -t "match paths"` | ❌ Wave 0 |
| SRCH-11 | Tag matching surfaces matched-tag pills; substring ILIKE on tag elements ('tool' matches 'tool-watch') | integration | `npx vitest run tests/data/searchCollections.test.ts -t "tag substring"` | ❌ Wave 0 |
| SRCH-12 | profile_public=false → excluded from Collections | integration | `npx vitest run tests/data/searchCollections.test.ts -t "profile_public gate"` | ❌ Wave 0 |
| SRCH-12 | collection_public=false → excluded from Collections | integration | `npx vitest run tests/data/searchCollections.test.ts -t "collection_public gate"` | ❌ Wave 0 |
| SRCH-12 | Viewer's own profile excluded from Collections | integration | `npx vitest run tests/data/searchCollections.test.ts -t "self-exclusion"` | ❌ Wave 0 |
| SRCH-13 | All tab fans out 3 actions in parallel; each section caps at 5 | unit (RTL) + integration | `npx vitest run tests/components/search/SearchPageClient.test.tsx -t "All tab fan-out"` + `npx vitest run tests/app/search/SearchPageClient.test.tsx -t "section caps"` | ❌ Wave 0 |
| SRCH-13 | Per-section header + 'See all' link routes via setTab() preserving query | unit (RTL) | `npx vitest run tests/components/search/SearchPageClient.test.tsx -t "See all setTab"` | ❌ Wave 0 |
| SRCH-14 | Rapid tab switch aborts prior fetch; no stale results render | unit (RTL) | `npx vitest run tests/components/search/useSearchState.test.tsx -t "tab switch abort"` | ⚠️ extends existing — file exists |
| SRCH-14 | Switching tab=watches→collections with same q triggers new fetch (deps array includes tab) | unit (RTL) | `npx vitest run tests/components/search/useSearchState.test.tsx -t "tab change re-fires"` | ⚠️ extends existing |
| SRCH-15 | HighlightedText XSS-safe — `<script>` in matched text renders as literal text | unit | `npx vitest run tests/components/search/HighlightedText.test.tsx -t "XSS safe"` | ⚠️ may exist; if not Wave 0 |
| SRCH-15 | HighlightedText regex-escape — query containing `(` `.` `*` does not crash | unit | `npx vitest run tests/components/search/HighlightedText.test.tsx -t "regex meta"` | ⚠️ may exist; if not Wave 0 |
| All | DB-level: GIN trigram reachability for ILIKE queries on brand_normalized/model_normalized | integration (EXPLAIN) | `npx vitest run tests/integration/phase19-trgm-reachability.test.ts` | ❌ Wave 0 — extends Phase 17 pattern from `tests/integration/phase17-schema.test.ts` |
| Cross-cutting | Server Action input validation: `z.string().max(200).strict()` rejects oversized + extra-key inputs | unit | `npx vitest run tests/actions/search.test.ts -t "Zod schema"` | ❌ Wave 0 |
| Cross-cutting | Server Action auth gate: unauth caller → success:false, error:'Not authenticated' | integration | `npx vitest run tests/actions/search.test.ts -t "auth gate"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- {targeted file}` for the file under change
- **Per wave merge:** `npm test` (full suite, currently ~4s)
- **Phase gate:** Full suite green before `/gsd-verify-work`; live-DB integration tests included in same `npm test` run (already configured for Phase 17)

### Wave 0 Gaps

Test files needed before implementation:
- [ ] `tests/data/searchCatalogWatches.test.ts` — covers SRCH-09, SRCH-10 (DAL contract + Drizzle chainable mock + inArray call-count assertion + viewer-state Map merge)
- [ ] `tests/data/searchCollections.test.ts` — covers SRCH-11, SRCH-12 (CTE structure mocked or live-DB; two-layer-privacy gate; self-exclusion; match path classification)
- [ ] `tests/integration/phase19-trgm-reachability.test.ts` — EXPLAIN ANALYZE on the actual ILIKE query against seeded catalog data; assert GIN index used for `brand_normalized` + `model_normalized` (mirrors `tests/integration/phase17-schema.test.ts` "trgm planner reachability")
- [ ] `tests/integration/phase19-collections-privacy.test.ts` — live-DB seed of 3 profiles (one private, one collection-private, one valid) and assert only the valid one surfaces
- [ ] `tests/components/search/WatchSearchRow.test.tsx` — covers SRCH-09 row UX (image, pill rendering matrix, Evaluate Link target, HighlightedText wrap)
- [ ] `tests/components/search/CollectionSearchRow.test.tsx` — covers SRCH-11 row UX (matched-watch cluster, matched-tag pills)
- [ ] `tests/actions/search.test.ts` — covers Server Action shape (Zod, auth gate, generic error copy) for both new actions
- [ ] Extend `tests/components/search/useSearchState.test.tsx` — covers SRCH-14 (tab-aware AbortController; tab switch with same q re-fires; per-tab results slices)
- [ ] Extend `tests/app/search/SearchPageClient.test.tsx` — covers SRCH-13 (All tab fan-out section caps + 'See all' setTab + per-section skeletons)

Framework install: none needed (Vitest already configured).

## Security Domain

Security enforcement: enabled (no `security_enforcement: false` in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` Server Action gate; throws `UnauthorizedError`; tested in `tests/actions/search.test.ts` |
| V3 Session Management | no (delegated to Supabase Auth + RLS) | n/a — Phase 19 reads only |
| V4 Access Control | yes | Two-layer privacy: `profilePublic AND collectionPublic AND profiles.id != viewerId` in DAL WHERE + RLS on `profiles` is the second layer |
| V5 Input Validation | yes | Zod `.strict().max(200)` on Server Action input; trim + 2-char minimum in DAL; reference normalization regex `[^a-z0-9]+` is server-controlled |
| V6 Cryptography | no | n/a |
| V8 Logging | yes (light) | `console.error('[searchWatchesAction] unexpected error:', err)` — generic copy returned to client; details logged server-side only |
| V11 Output Encoding | yes | `<HighlightedText>` is XSS-safe by construction (regex-escape + React text children); never `dangerouslySetInnerHTML` |
| V13 API & Web Service | yes | Server Actions are POST endpoints; CSRF protected by Next.js Server Action token; Zod input validation rejects mass-assignment via `.strict()` |

### Known Threat Patterns for {Next 16 + Drizzle + Supabase RLS} stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via user query | Tampering | Drizzle `${pattern}` parameterization; raw `sql` template tag preserves parameterization for unnest predicates |
| Stored XSS via username/bio/brand/model rendered with highlight | Tampering | `<HighlightedText>` regex-escapes query AND emits React text children only — never bypasses React text-escaping |
| Information disclosure: collector with `collection_public=false` surfacing in Collections search | Information Disclosure | DAL WHERE: `eq(profileSettings.collectionPublic, true)` — explicit AND clause; integration test toggles flag and asserts exclusion |
| Information disclosure: viewer's own profile in Collections results | Information Disclosure | `sql\`${profiles.id} != ${viewerId}\`` — integration test seeds viewer + asserts self-exclusion |
| ReDoS via `<HighlightedText>` regex on user query | DoS | Already mitigated (Phase 16) — query metachars escaped before `new RegExp(...)` |
| Mass-assignment via Server Action input | Tampering | Zod `.strict()` rejects unknown keys; `.max(200)` bounds query length |
| CSRF on POST Server Actions | Tampering | Next.js Server Action token (built-in) |
| Unauthenticated Server Action call | Spoofing | `getCurrentUser()` throws `UnauthorizedError` → action returns `{ success: false, error: 'Not authenticated' }` |
| Cross-tab result leakage from prior in-flight fetch | Information Disclosure (UX) | `if (controller.signal.aborted) return` post-await; `[debouncedQ, tab]` deps array re-runs cleanup on tab change |
| Catalog row ID enumeration via `/evaluate?catalogId=...` | Information Disclosure | catalog rows are public-readable per Phase 17 RLS — IDs are not secrets; no mitigation needed |

## Sources

### Primary (HIGH confidence)
- `src/components/search/SearchPageClient.tsx` (existing 4-tab shell)
- `src/components/search/useSearchState.ts:1-119` (q ↔ URL ↔ fetch trifecta with single AbortController)
- `src/components/search/PeopleSearchRow.tsx:1-112` (whole-row Link + raised inline button + HighlightedText)
- `src/components/search/HighlightedText.tsx:23-46` (XSS-safe + regex-escape)
- `src/components/search/SearchResultsSkeleton.tsx:1-37` (skeleton template)
- `src/data/search.ts:14-174` (searchProfiles: 2-char minimum, two-layer privacy, pre-LIMIT 50, JS sort, anti-N+1 inArray batch)
- `src/data/discovery.ts:135-160` (getTrendingCatalogWatches: popularity-DESC + alphabetical tie-break + score-zero exclusion)
- `src/data/catalog.ts:122-148` (upsertCatalogFromUserInput; reference-normalization regex `[^a-z0-9]+`)
- `src/app/actions/search.ts:13-61` (Server Action shape with Zod .strict().max(200) + auth gate)
- `src/lib/tasteOverlap.ts:51-115` (computeTasteOverlap pure function, server-safe)
- `src/components/home/SuggestedCollectorRow.tsx:34-95` (absolute-inset Link + raised button z-10)
- `src/db/schema.ts:50-112` (watches table: text[] tag columns)
- `src/db/schema.ts:276-326` (watchesCatalog: generated normalized columns + ownersCount/wishlistCount)
- `src/lib/searchTypes.ts:1-30` (existing SearchProfileResult + SearchTab types)
- `.planning/phases/19-search-watches-collections/19-CONTEXT.md` (phase decisions D-01 through D-16)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` (D-02/D-03 catalog normalization)
- `.planning/phases/17-catalog-foundation/17-VERIFICATION.md` (GIN trigram reachability confirmed)
- `.planning/phases/18-explore-discovery-surface/18-CONTEXT.md` (D-13/D-15 watch-card pattern + D-08 revalidateTag fan-out)
- `package.json:24-30` (drizzle-orm 0.45.2, next 16.2.3, react 19.2.4)

### Secondary (MEDIUM confidence)
- Phase 16 search precedents informing the AbortController + Zod + auth-gate patterns (verified live in `src/components/search/useSearchState.ts` and `src/app/actions/search.ts`)
- `src/app/actions/watches.ts:177, 218, 248` (existing `revalidateTag('explore', 'max')` fan-out to extend with `'search-watches'`)

### Tertiary (LOW confidence)
- None — all critical claims verified against the live codebase or locked CONTEXT.md decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already locked in package.json; no new packages
- Architecture: HIGH — three-action fan-out + tab-aware AbortController are direct compositions of Phase 16/17/18 patterns
- DAL query shapes: HIGH — Drizzle `or(ilike, ilike, ilike)` + `inArray` batch are byte-for-byte mirrors of `searchProfiles`; CTE + unnest predicate is Postgres-standard, validated mentally against the schema
- Caching strategy: MEDIUM — recommended approach (skip caching for v4.0; opt-in two-step pattern only if observed latency justifies) is conservative; planner has Discretion
- All-tab fan-out shape: MEDIUM — three independent effects vs single Promise.all is a UX taste call; both honor D-15
- Pitfalls: HIGH — every pitfall is grounded in an existing precedent (Phase 16 stale-result guard, Phase 17 generated-column normalization, Phase 18 score-zero exclusion)

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days; stack is stable, libraries pinned, decisions locked in CONTEXT.md)

---

*Research complete. Planner can now create PLAN.md files for Phase 19.*

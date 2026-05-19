# Phase 46: Explore Shell + Browse + Archetypes — Research

**Researched:** 2026-05-18
**Domain:** Next.js 16 App Router `'use cache'` + Drizzle ORM catalog queries + `/search` Watches tab extension
**Confidence:** HIGH

---

## Summary

Phase 46 has four distinct work streams: (1) deleting the old Phase 18 Explore surface cleanly, (2) building the new 5-module `/explore` shell with two live modules and three hidden slots, (3) adding three new index pages (`/explore/brands`, `/explore/eras`, `/explore/genres`) with tag-cached counts, and (4) extending `/search` to accept brand/era/genre/archetype facets and run without a typed query.

The `/search` Watches tab extension is the most cross-cutting change. Phase 40 already lifted the query-free gate for movement/size/style facets — the pattern is fully established. The four new facet dimensions (brand, era, genre, archetype) follow the identical wire path: URL param → `useSearchState` state → `searchWatchesAction` Zod schema → `CatalogSearchFilters` → `searchCatalogWatches` WHERE predicates → removable chip in `FilterDrawer`. This is mechanical extension, not a new pattern.

Browse count caching uses the established `'use cache'` + `cacheTag` + `cacheLife` pattern already used by `TrendingWatches`, `PopularCollectors`, and `getTopStyleTags`. Browse counts are viewer-independent (public-read RLS, no per-user data) so they are safe to cache globally. The existing `revalidateTag('explore', 'max')` calls in watches Server Actions cover catalog-mutation invalidation without any new wiring.

The old Phase 18 retire scope is clean: `ExploreHero`, `PopularCollectors`, `TrendingWatches`, `GainingTractionWatches`, their backing DAL readers in `src/data/discovery.ts`, and the two see-all routes. Home's `src/app/page.tsx` does NOT import anything from `src/components/explore/` — the entire explore component folder is Explore-exclusive. `DiscoveryWatchCard` is also exclusive to the old explore surface and can be retired with the rails.

**Primary recommendation:** Implement the four facet dimensions (brand/era/genre/archetype) as direct extensions of the Phase 40 movement/size/style pattern: new fields in `CatalogSearchFilters`, new Zod fields in `searchSchema`, new URL params in `useSearchState`, new WHERE predicates in `searchCatalogWatches`, new chip components in FilterDrawer.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Old `/explore` Disposition**
- D-01: `PopularCollectors`, `TrendingWatches`, `GainingTractionWatches` are retired entirely. Delete components and their DAL readers.
- D-02: `ExploreHero` (sparse-network welcome hero with count-gate) is retired.
- D-03: `/explore/collectors` and `/explore/watches` routes are retired.
- D-04: Before deleting, audit for Home imports. Home does NOT use any explore components (verified in research).

**Browse the Catalog — Module Shape (EXPL-03, EXPL-04)**
- D-05: 4 entry tiles on `/explore` → dedicated full index pages.
- D-06: Full per-grouping list with counts lives on the index page.
- D-07: A–Z jump navigation lives on `/explore/brands`, not on `/explore`.
- D-08: Only 3 of 4 index tiles ship a working page in Phase 46 (Brands, Eras, Genres). Price-bands deferred.

**Prefiltered Results — Deep-Link Target (EXPL-03, EXPL-05)**
- D-09: Deep-links go to `/search` Watches tab.
- D-10: Arriving facet is a visible, removable filter chip. Composable, refinable.
- D-11: `/search` Watches tab must support query-free run when a facet is present.
- D-12: New facet dimensions: brand, era, genre, archetype (URL query params + removable chips).
- D-13: Archetype editorial header: archetype name + one-line editorial description + result count.

**Collector Archetypes — Config & Mapping (EXPL-05)**
- D-14: Each chip maps to a single `primary_archetype` value.
- D-15: Rail shows all 10 `primary_archetype` values (amends "8" in roadmap/EXPL-05).
- D-16: Display names + one-line descriptions for 10 chips are editorial content finalized by owner.

**Browse Taxonomy — Index Data Sources (EXPL-03)**
- D-17: Genres index groups by `primary_archetype` column.
- D-18: Eras index groups by `eraSignal` (3 buckets: vintage-leaning / modern / contemporary).
- D-19: Browse counts cached with `'use cache'` + `cacheTag` + catalog-mutation invalidation tag.

### Claude's Discretion
- Responsive grid layout for 5 modules on desktop.
- Whether Browse module shows 3 tiles or a disabled 4th Price-bands tile (D-08).
- Exact cache tag names and `cacheLife` windows for Browse counts (D-19).
- How Phase-47 editorial module slots render in Phase 46 (empty → hidden via EXPL-02, or lightweight placeholder).
- Exact route segment for genres index (`/explore/genres`) and query-param naming on `/search`.

### Deferred Ideas (OUT OF SCOPE)
- Price-bands Browse index → v6.0 Market Value (SEED-005).
- Eras index by decade — revisit when catalog vintage data is fuller (post v5.2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPL-01 | `/explore` renders a 5-module page (Hero, Collector Archetypes, Curated Lists Rail, Where Collections Go, Browse the Catalog) — stacked on mobile, grid on desktop | New Server Component page replacing old Phase 18 page; module grid via CSS grid/flex; auth gate via existing proxy.ts pattern |
| EXPL-02 | Any module with no content hides itself (absent, not empty container) | Each module async Server Component returns `null` when its data is empty — same pattern as `TrendingWatches` and `PopularCollectors` |
| EXPL-03 | Browse the Catalog: brand/era/genre indices with accurate counts, cached with tag-based invalidation; tapping opens `/search` prefiltered | New DAL readers for brand/eraSignal/archetype GROUP BY counts; `'use cache'` + `cacheTag('explore:browse')` + `cacheLife('hours')` on index pages; deep-links as `/search?tab=watches&brand=rolex` etc. |
| EXPL-04 | Brands index provides A–Z jump navigation | Client-side scroll-to-letter anchors on `/explore/brands`; anchor IDs on letter-group headings |
| EXPL-05 | Collector Archetypes chip rail: 10 chips (amended from 8), each with count badge; tapping opens prefiltered search with archetype header | `PRIMARY_ARCHETYPES` (10 values) from `src/lib/taste/vocab.ts`; archetype config object with display name + editorial description; archetype header rendered in `/search` when `archetype` URL param is present |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/explore` shell render | API / Backend (Server Component) | — | Viewer-gated via `getCurrentUser()`; auth + page assembly server-side |
| Browse count queries | API / Backend (Server DAL) | — | Database aggregation; viewer-independent; cacheable globally |
| Browse count caching | API / Backend (`'use cache'`) | — | `cacheTag` + `cacheLife` scoped to catalog counts; no per-user data |
| Index page A–Z nav | Browser / Client | Frontend Server | Jump links can be pure anchor hrefs; only needs JS for smooth-scroll enhancement |
| Archetype chip rail | API / Backend (Server Component) | — | Counts from DB; rendered as static chips; no client interaction until tap |
| Facet deep-link (`/search?archetype=dive`) | Browser / Client (`useSearchState`) | — | URL param hydrated on mount; filter chip state managed client-side |
| `/search` Watches tab extension | Browser / Client (`useSearchState`) | API / Backend (`searchCatalogWatches`) | Client state → Server Action → DAL — exactly Phase 40 pattern |
| Archetype editorial header | Browser / Client | — | Rendered in `SearchPageClient` when `archetype` URL param is present; text from hardcoded config |
| Browse index result count | API / Backend (DAL cache) | — | `GROUP BY` query on `watches_catalog`; no per-user data |

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router, Server Components, `'use cache'` directive | Established project framework |
| Drizzle ORM | current | Catalog GROUP BY count queries | Project ORM; `sql` template for raw aggregations |
| `next/cache` | 16.2.3 | `cacheTag`, `cacheLife`, `revalidateTag` | Cache Components (`cacheComponents: true` in `next.config.ts`) |
| `src/lib/taste/vocab.ts` | — | `PRIMARY_ARCHETYPES` (10 values), `ERA_SIGNALS` (3 values) | Ground-truth vocabulary for Browse indices and chip rail |

No new dependencies needed.

**Version verification:** All packages verified from `package.json` and `node_modules/next/dist/docs/`. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
/explore (Server Component)
  ├── getCurrentUser()  ← auth gate (proxy.ts already enforces; UnauthorizedError propagates)
  ├── [Hero slot]           → returns null (EXPL-02 hide) ← Phase 47 wires
  ├── [ArchetypesModule]    → 'use cache' + cacheTag('explore:archetypes') ← LIVE
  │     ├── getBrowseArchetypeCounts() → GROUP BY primary_archetype
  │     └── renders 10 chip cards → /search?tab=watches&archetype={value}
  ├── [CuratedListsRail]    → returns null (EXPL-02 hide) ← Phase 47 wires
  ├── [WhereCollectionsGo]  → returns null (EXPL-02 hide) ← Phase 47 wires
  └── [BrowseModule]        → 'use cache' + cacheTag('explore:browse') ← LIVE
        └── 3–4 entry tiles → /explore/brands, /explore/eras, /explore/genres

/explore/brands (Server Component, 'use cache')
  ├── getBrowseBrandCounts() → SELECT brands.name, brands.slug, COUNT(*) FROM watches_catalog JOIN brands GROUP BY brands.id ORDER BY brands.name
  └── AlphaNav (client) + grouped brand list → each taps /search?tab=watches&brand={slug}

/explore/eras (Server Component, 'use cache')
  ├── getBrowseEraCounts() → SELECT era_signal, COUNT(*) FROM watches_catalog GROUP BY era_signal
  └── era list → each taps /search?tab=watches&era={value}

/explore/genres (Server Component, 'use cache')
  ├── getBrowseGenreCounts() → SELECT primary_archetype, COUNT(*) FROM watches_catalog GROUP BY primary_archetype
  └── genre list → each taps /search?tab=watches&genre={value}

/search?tab=watches&archetype=dive (or &brand=rolex, &era=vintage-leaning, &genre=dive)
  ├── useSearchState → reads new URL params (brand/era/genre/archetype) on mount
  ├── searchWatchesAction → new Zod fields → CatalogSearchFilters (extended)
  ├── searchCatalogWatches → new WHERE predicates for brand/era/genre/archetype
  └── FilterDrawer → new removable chips for brand/era/genre/archetype
       + ArchetypeHeader → rendered when archetype param present (name + description + count)
```

### Recommended Project Structure

```
src/
├── app/explore/
│   ├── page.tsx               # REPLACED (new 5-module shell)
│   ├── brands/page.tsx        # NEW: Brands index + A–Z nav
│   ├── eras/page.tsx          # NEW: Eras index
│   ├── genres/page.tsx        # NEW: Genres index
│   ├── collectors/page.tsx    # DELETED (D-03)
│   └── watches/page.tsx       # DELETED (D-03)
├── components/explore/
│   ├── ExploreHero.tsx        # DELETED (D-02)
│   ├── PopularCollectors.tsx  # DELETED (D-01)
│   ├── PopularCollectorRow.tsx# DELETED (D-01)
│   ├── TrendingWatches.tsx    # DELETED (D-01)
│   ├── GainingTractionWatches.tsx # DELETED (D-01)
│   ├── DiscoveryWatchCard.tsx # DELETED (Explore-exclusive, not used by Home)
│   ├── CollectorArchetypes.tsx # NEW: chip rail
│   ├── BrowseModule.tsx       # NEW: 4-tile entry point
│   └── [slot components for Hero/Lists/Paths — return null Phase 46]
├── data/
│   ├── discovery.ts           # DAL readers DELETED or stubbed empty after D-01 retire
│   └── browse.ts              # NEW: getBrowseBrandCounts, getBrowseEraCounts, getBrowseGenreCounts, getBrowseArchetypeCounts
├── components/search/
│   ├── useSearchState.ts      # EXTENDED: brand/era/genre/archetype state + URL sync
│   └── FilterDrawer.tsx       # EXTENDED: new facet chip groups
└── app/actions/search.ts      # EXTENDED: searchSchema gains brand/era/genre/archetype fields
src/data/catalog.ts            # EXTENDED: CatalogSearchFilters gains brand/era/genre/archetype; searchCatalogWatches gains WHERE predicates
src/lib/archetype-config.ts    # NEW: 10-entry config { value, displayName, description }
```

### Pattern 1: Viewer-Independent `'use cache'` for Browse Counts

Browse counts are safe to cache globally (no per-viewer data, public-read RLS). Pattern confirmed from `TrendingWatches` and `getTopStyleTags`.

```typescript
// Source: src/components/explore/TrendingWatches.tsx (verified in codebase)
// and node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md

import { cacheLife, cacheTag } from 'next/cache'

export async function BrowseArchetypeCounts() {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours') // catalog counts change only on enrichment runs
  
  const counts = await getBrowseArchetypeCounts()
  if (counts.length === 0) return null
  // render chips...
}
```

Key rule: `getCurrentUser()` must be called OUTSIDE any `'use cache'` scope. Browse modules take no viewerId prop — they are globally shared. [VERIFIED: codebase pattern + Next.js 16 docs]

### Pattern 2: Extending `searchCatalogWatches` with New Facets

Phase 40 already implemented the query-free lift for movement/size/style. The brand/era/genre/archetype facets follow the identical predicate composition pattern.

```typescript
// Source: src/data/catalog.ts — Phase 40 pattern (verified in codebase)

// 1. Extend CatalogSearchFilters
export interface CatalogSearchFilters {
  movement?: 'auto' | 'manual' | 'quartz' | 'spring_drive'
  size?: 'lt36' | '36-39' | '40-42' | '43-45' | '46plus'
  style?: string[]
  // Phase 46 additions:
  brand?: string       // brand slug from brands.slug
  era?: string         // eraSignal value: 'vintage-leaning' | 'modern' | 'contemporary'
  genre?: string       // primary_archetype value
  archetype?: string   // primary_archetype value (same column as genre; different UI intent)
}

// 2. New WHERE predicates (inside the existing predicate array builder):
if (filters?.brand) {
  // Join brands table and filter by slug
  // OR: if brand slug stored in watchesCatalog, use eq directly
  // See: watchesCatalog.brandId FK → brands.slug
}

if (filters?.era) {
  predicates.push(isNotNull(watchesCatalog.eraSignal)!)
  predicates.push(eq(watchesCatalog.eraSignal, filters.era)!)
}

if (filters?.genre) {
  predicates.push(isNotNull(watchesCatalog.primaryArchetype)!)
  predicates.push(eq(watchesCatalog.primaryArchetype, filters.genre)!)
}

if (filters?.archetype) {
  predicates.push(isNotNull(watchesCatalog.primaryArchetype)!)
  predicates.push(eq(watchesCatalog.primaryArchetype, filters.archetype)!)
}
```

Note on brand: `watchesCatalog.brandId` is a FK to `brands.id`, not `brands.slug`. The deep-link must carry either the brand UUID or slug, and the DAL must join. Using slug is better for URL readability. The predicate requires a JOIN with brands or a subquery. [VERIFIED: schema.ts]

### Pattern 3: Query-Free Gate Already Lifted (D-11 is Done for Existing Facets)

Phase 40 already lifted the `q.length >= 2` gate for active facets in both the DAL (`hasActiveFacet` check) and `useSearchState` (3b sub-effect). Phase 46 must extend `hasActiveFacet` to include the four new dimensions.

```typescript
// Source: src/components/search/useSearchState.ts line 189 (verified)
const hasActiveFacet = !!(movement || size || styleArr.length)

// Phase 46 extension:
const hasActiveFacet = !!(movement || size || styleArr.length || brand || era || genre || archetype)
```

### Pattern 4: Browse Index GROUP BY Queries

```typescript
// New DAL in src/data/browse.ts
// Source: Drizzle sql template pattern from src/data/catalog.ts (verified)

export async function getBrowseArchetypeCounts(): Promise<Array<{ archetype: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT primary_archetype AS archetype, COUNT(*)::int AS count
        FROM watches_catalog
        WHERE primary_archetype IS NOT NULL
        GROUP BY primary_archetype
        ORDER BY count DESC`
  )
  return rows as unknown as Array<{ archetype: string; count: number }>
}

export async function getBrowseBrandCounts(): Promise<Array<{ brandId: string; name: string; slug: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT b.id AS "brandId", b.name, b.slug, COUNT(wc.id)::int AS count
        FROM brands b
        JOIN watches_catalog wc ON wc.brand_id = b.id
        GROUP BY b.id, b.name, b.slug
        ORDER BY b.name_normalized ASC`
  )
  return rows as unknown as Array<{ brandId: string; name: string; slug: string; count: number }>
}

export async function getBrowseEraCounts(): Promise<Array<{ era: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT era_signal AS era, COUNT(*)::int AS count
        FROM watches_catalog
        WHERE era_signal IS NOT NULL
        GROUP BY era_signal`
  )
  return rows as unknown as Array<{ era: string; count: number }>
}

export async function getBrowseGenreCounts(): Promise<Array<{ genre: string; count: number }>> {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  // Same column as archetype (primary_archetype) — different UI intent
  const rows = await db.execute(
    sql`SELECT primary_archetype AS genre, COUNT(*)::int AS count
        FROM watches_catalog
        WHERE primary_archetype IS NOT NULL
        GROUP BY primary_archetype
        ORDER BY count DESC`
  )
  return rows as unknown as Array<{ genre: string; count: number }>
}
```

### Anti-Patterns to Avoid

- **`getCurrentUser()` inside `'use cache'`:** Request-time APIs cannot be accessed inside a cached scope. The old `PopularCollectors` passes `viewerId` as a prop — that pattern only applies when the result differs per viewer. Browse counts are viewer-independent; no viewerId prop needed. [VERIFIED: Next.js 16 docs]
- **Per-viewer cache scope on globally-shared data:** Browse counts and archetype counts do not depend on the viewer. Adding a viewerId tag (`explore:browse:viewer:{id}`) creates N cache entries unnecessarily. Use global tags only.
- **Calling `revalidateTag('explore:browse', 'max')` in watch mutations:** The existing `revalidateTag('explore', 'max')` calls in `watches.ts`, `account.ts`, and `divestments.ts` already cover the `explore` tag. Because `cacheTag('explore', 'explore:browse')` registers BOTH tags, any call to `revalidateTag('explore', ...)` will also bust Browse caches. No new revalidation wiring needed for Browse counts. [VERIFIED: codebase grep + cacheTag docs]
- **Brand filter without JOIN:** `watchesCatalog.brandId` is a UUID FK. Filtering by brand slug requires a JOIN with `brands` or a subquery to resolve slug→id. Do not assume `brand` column text matches `brands.slug`.
- **`archetype` vs `genre` filter collision:** Both map to `primary_archetype`. The `searchCatalogWatches` predicate should treat `archetype` and `genre` as OR-able alternatives pointing at the same column, or simply apply whichever is present (they won't coexist in practice — one comes from Browse Genres, the other from Collector Archetypes).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browse count cache invalidation | Custom cron or event system | `cacheTag('explore')` + existing `revalidateTag('explore', 'max')` in watch actions | Already wired; `cacheTag` accepts multiple tags; `explore` tag covers all browse caches |
| Alphabetic grouping for brands index | Custom sort + group algorithm | `ORDER BY b.name_normalized ASC` in SQL + JS `reduce` by first letter | SQL ordering is authoritative; letter grouping in JS on the ~100-brand result is trivial |
| Query-free search gate | New condition logic | Extend existing `hasActiveFacet` in `useSearchState.ts` | Phase 40 already solved this; just add new facet dimensions to the same boolean |
| Archetype display names | Database table | Hardcoded config object in `src/lib/archetype-config.ts` | 10 values, never changes without a code deploy (vocab is TS constants); config colocation is simpler |

---

## Old Explore Retire Scope (D-01..D-04)

### What Is Explore-Exclusive (Safe to Delete)

Verified by grepping all imports across `src/app/` — Home (`src/app/page.tsx`) does NOT import any of these:

| File | Verdict | Evidence |
|------|---------|---------|
| `src/components/explore/ExploreHero.tsx` | DELETE | Only imported by `src/app/explore/page.tsx` [VERIFIED: codebase grep] |
| `src/components/explore/PopularCollectors.tsx` | DELETE | Only imported by `src/app/explore/page.tsx` [VERIFIED: codebase grep] |
| `src/components/explore/PopularCollectorRow.tsx` | DELETE | Only imported by `PopularCollectors.tsx` and `src/app/explore/collectors/page.tsx` [VERIFIED: codebase grep] |
| `src/components/explore/TrendingWatches.tsx` | DELETE | Only imported by `src/app/explore/page.tsx` [VERIFIED: codebase grep] |
| `src/components/explore/GainingTractionWatches.tsx` | DELETE | Only imported by `src/app/explore/page.tsx` [VERIFIED: codebase grep] |
| `src/components/explore/DiscoveryWatchCard.tsx` | DELETE | Only imported by `TrendingWatches.tsx`, `GainingTractionWatches.tsx`, and `src/app/explore/watches/page.tsx` — all retiring [VERIFIED: codebase grep] |
| `src/app/explore/collectors/page.tsx` | DELETE | Route retiring (D-03) |
| `src/app/explore/watches/page.tsx` | DELETE | Route retiring (D-03) |
| `src/data/discovery.ts` readers | DELETE | `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches`, `getMostFollowedCollectors` — only consumed by retiring files |

### Check Before Deleting

- `src/data/wearEvents.ts` → `getWearEventsCountByUser` is imported by `src/app/explore/page.tsx` (old page) for the hero gate. Home imports `getWearRailForViewer` (different function). Verify `getWearEventsCountByUser` has no other callers before deleting. [VERIFIED: old explore/page.tsx line 5; Home imports different function]
- `src/data/profiles.ts` → `getFollowerCounts` is imported by the old explore page. May have other callers. Do NOT delete — only remove the import from the new explore page.

### Inbound Links to Retiring Routes

The old components link to `/explore/collectors` and `/explore/watches`:
- `ExploreHero.tsx` → `href="/explore/collectors"` (file deleting)
- `PopularCollectors.tsx` → `href="/explore/collectors"` (file deleting)
- `TrendingWatches.tsx` → `href="/explore/watches"` (file deleting)
- `GainingTractionWatches.tsx` → `href="/explore/watches"` (file deleting)

All inbound links live in retiring files. No other pages link to these routes. [VERIFIED: codebase grep]

---

## The `/search` Extension Detail (D-09..D-13)

### Current State (Phase 40 baseline)

The search pipeline already has a complete facet extension pattern. State flows through these layers:

```
URL params
  → useSearchState (useState, URL sync effect)
  → searchWatchesAction (Zod validated)
  → searchCatalogWatches (WHERE predicate builder)
  → FilterDrawer (chip UI, removable)
```

Current facets: `movement` (enum), `size` (band key), `style` (string[]).

### Phase 46 Extension Points — One per Layer

**Layer 1: `CatalogSearchFilters` in `src/data/catalog.ts`**
Add: `brand?: string`, `era?: string`, `genre?: string`, `archetype?: string`

**Layer 2: `searchCatalogWatches` WHERE predicates**
- `era`: `eq(watchesCatalog.eraSignal, filters.era)` + `isNotNull`
- `genre`: `eq(watchesCatalog.primaryArchetype, filters.genre)` + `isNotNull`
- `archetype`: `eq(watchesCatalog.primaryArchetype, filters.archetype)` + `isNotNull`
- `brand`: requires JOIN with `brands` table on `brandId = brands.id` and `brands.slug = filters.brand`. Cannot use `eq` on `watchesCatalog` directly — brand text column is raw brand name, not slug.

Also extend `hasActiveFacet`: `!!(filters?.movement || filters?.size || filters?.style?.length || filters?.brand || filters?.era || filters?.genre || filters?.archetype)`

**Layer 3: Zod `searchSchema` in `src/app/actions/search.ts`**
```typescript
const searchSchema = z.object({
  q: z.string().max(200),
  movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional(),
  size: z.enum(['lt36', '36-39', '40-42', '43-45', '46plus']).optional(),
  style: z.string().max(500).optional(),
  // Phase 46 additions:
  brand: z.string().max(100).optional(),
  era: z.string().max(50).optional(),
  genre: z.string().max(50).optional(),
  archetype: z.string().max(50).optional(),
}).strict()
```

**Layer 4: `useSearchState.ts`**
- New state: `brand`, `era`, `genre`, `archetype` (string | null each)
- New setters
- URL sync: `if (brand) params.set('brand', brand)` etc.
- Passes to `searchWatchesAction` call
- `hasActiveFacet` extended

**Layer 5: `SearchPageClient.tsx`**
- New props: `initialBrand`, `initialEra`, `initialGenre`, `initialArchetype` extracted from `useSearchState` return
- Archetype editorial header: rendered above watch results when `archetype` is set
- New removable chips in the filter area for the four new dimensions

**Layer 6: FilterDrawer (or separate chips above results)**
Per D-10, the arriving facet is a visible removable chip. The existing `FilterDrawer` shows movement/size/style. Options:
1. Add brand/era/genre/archetype as additional FilterDrawer sections
2. Show them as inline chips above the results (not inside the drawer)

Option 2 is better UX for deep-linked facets: the user arrives at `/search?archetype=dive` and immediately sees "dive ×" as an inline chip above results, without opening the drawer. The drawer still manages movement/size/style.

**Layer 7: Archetype editorial header (D-13)**
When arriving from an archetype chip, render above results:
```tsx
// In WatchesPanel or SearchPageClient:
{archetype && archetypeConfig[archetype] && (
  <section className="space-y-1 mb-4">
    <h2 className="text-xl font-semibold">{archetypeConfig[archetype].displayName}</h2>
    <p className="text-sm text-muted-foreground">{archetypeConfig[archetype].description}</p>
    <p className="text-xs text-muted-foreground">{results.length} watches</p>
  </section>
)}
```

### Brand Facet — JOIN Requirement

`watchesCatalog.brandId` → `brands.id`. The deep-link carries `brands.slug` (URL-friendly). The `searchCatalogWatches` query must resolve slug to catalogId FK. Two approaches:

**Option A (subquery in WHERE):**
```sql
brand_id = (SELECT id FROM brands WHERE slug = $brandSlug LIMIT 1)
```

**Option B (extend the Drizzle query to join brands):**
Join brands on `watchesCatalog.brandId = brands.id` and add `eq(brands.slug, filters.brand)` to predicates.

Option A is simpler given the current single-table `db.select().from(watchesCatalog)` structure. It avoids restructuring the entire query. Option B is cleaner Drizzle idiom. Either works; planner decides.

Note: some watches may have `brandId = NULL` (catalog rows where the FK wasn't populated). Brand filtering only applies to watches with a populated `brandId`. This is acceptable — the brand index page only shows brands with counts > 0.

---

## Browse Index — Count Query Design

### Brands Index

Data source: `brands` JOIN `watches_catalog` on `brandId`. Only brands with ≥1 catalog watch appear.

```sql
SELECT b.id, b.name, b.slug, COUNT(wc.id)::int AS count
FROM brands b
JOIN watches_catalog wc ON wc.brand_id = b.id
WHERE wc.brand_id IS NOT NULL
GROUP BY b.id, b.name, b.slug
ORDER BY b.name_normalized ASC
```

A–Z navigation: after fetching the sorted list, group by `name[0].toUpperCase()` in JS. Render `<section id="letter-A">`, etc. The A–Z jump bar links to `#letter-A` etc. — pure anchor navigation, no client JS required beyond the browser's native scroll.

### Eras Index

Data source: `watches_catalog.eraSignal`. Three buckets.

```sql
SELECT era_signal, COUNT(*)::int AS count
FROM watches_catalog
WHERE era_signal IS NOT NULL
GROUP BY era_signal
```

Display names for era signals: `'vintage-leaning'` → "Vintage Leaning", `'modern'` → "Modern", `'contemporary'` → "Contemporary".

### Genres Index

Data source: `watches_catalog.primaryArchetype`. Same 10 values as archetype rail.

Planner note on visual distinction from Collector Archetypes (D-17 / SPECIFICS): the Genres index shows counts as the primary data point ("Dress — 18 watches"), while the Archetypes module shows identity-based copy + editorial descriptions. The `/explore` page layout must make this distinction obvious — e.g., Archetypes at top with names like "The Dress Watch Devotee", Genres index further down labeled plainly as "Browse by Category."

---

## `'use cache'` — What the Next.js 16 Docs Say

Key facts verified from `node_modules/next/dist/docs/`: [VERIFIED: official docs]

1. **`'use cache'` is a Cache Components feature, enabled by `cacheComponents: true`** in `next.config.ts`. This project already has it: `experimental: { cacheComponents: true }`.

2. **Cache key** = Build ID + Function ID + serialized arguments (props/params). For viewer-independent functions (no arguments), all users share the same cache entry.

3. **`cacheTag(tag1, tag2, ...)`** registers multiple tags on the same entry. `revalidateTag('explore')` busts ALL entries tagged `'explore'`.

4. **`cacheLife` profiles**: `'hours'` = stale 5min / revalidate 1h / expire 1day. Appropriate for Browse counts that change only on enrichment runs.

5. **`revalidateTag` from Server Actions** immediately clears the **entire client cache** too, not just server-side. Existing `revalidateTag('explore', 'max')` calls in watch mutation actions therefore bust Browse count caches as a side effect of any watch add/remove.

6. **Request-time APIs** (`cookies()`, `headers()`) cannot be called inside `'use cache'`. `getCurrentUser()` must be outside. Browse modules require no auth context — they are viewer-independent by design.

7. **`cacheLife` must be called inside the `'use cache'` scope.** One call per function invocation.

8. **`cacheComponents` is in `experimental`** in this project's `next.config.ts`. This matches v16.2.3 — the docs show it was promoted to stable at v16.0.0, but the project's config uses `experimental: { cacheComponents: true }` which is the backward-compat path. [VERIFIED: next.config.ts]

---

## Common Pitfalls

### Pitfall 1: Brand filter assumes text match instead of slug join
**What goes wrong:** `eq(watchesCatalog.brand, filters.brand)` matches raw brand text ("Rolex"), but the deep-link uses `brands.slug` ("rolex"). The values differ in casing and formatting.
**Why it happens:** `watchesCatalog.brand` is a free-text field. `brands.slug` is normalized lowercase. They don't match.
**How to avoid:** Always resolve slug → `brands.id` subquery then filter by `watchesCatalog.brandId`.

### Pitfall 2: `getCurrentUser()` inside `'use cache'` scope
**What goes wrong:** Build-time error or runtime panic — request-time APIs are forbidden inside cached scopes.
**Why it happens:** The old `PopularCollectors` takes `viewerId` as a prop. Browse modules have no per-viewer data — the temptation is to omit the prop but still call `getCurrentUser()` inside.
**How to avoid:** Browse count components take no viewerId prop. Auth stays in the page Server Component scope, outside all cache boundaries.

### Pitfall 3: Forgetting to extend `hasActiveFacet` in `useSearchState`
**What goes wrong:** Arriving at `/search?archetype=dive` with an empty query returns no results because the query-free gate isn't lifted.
**Why it happens:** Phase 40's `hasActiveFacet` only checks `movement || size || styleArr.length`. New facets are not included.
**How to avoid:** Extend `hasActiveFacet` in `useSearchState` 3b effect AND in `searchCatalogWatches` DAL.

### Pitfall 4: `genre` and `archetype` predicates applied simultaneously
**What goes wrong:** A URL that somehow carries both `genre=dive&archetype=dive` applies two AND-ed `primary_archetype` predicates — functionally equivalent but wasteful; a conflict on different values would return 0 results.
**Why it happens:** Both map to `primary_archetype`. Deep-links from Browse Genres use `genre`; deep-links from Collector Archetypes use `archetype`. They shouldn't coexist, but defensive handling matters.
**How to avoid:** In `searchCatalogWatches`, treat `genre` and `archetype` as mutually exclusive — apply `archetype` first; if not present, apply `genre`. Or merge them: `const primaryArchetypeFilter = filters?.archetype ?? filters?.genre`.

### Pitfall 5: Archetype chip rail and Browse Genres look redundant
**What goes wrong:** User sees the same 10 watch types twice on the same page and loses trust.
**Why it happens:** Both read `primary_archetype`. Design decisions that distinguish them must be intentional, not assumed.
**How to avoid:** The Archetypes module must use identity copy ("The Dive Watch Devotee") not genre labels. Genres must show plain utility copy with counts. Visual treatment must differ (e.g., Archetypes uses icon/illustration chips; Genres uses a compact list with counts).

### Pitfall 6: `cacheTag` called outside `'use cache'` scope
**What goes wrong:** Silently ignored at runtime; cache entry is untagged and cannot be invalidated by `revalidateTag`.
**Why it happens:** Forgetting the `'use cache'` directive at the function level.
**How to avoid:** Every function calling `cacheTag` must have `'use cache'` at its top.

### Pitfall 7: Old route links survive in navigation components
**What goes wrong:** `/explore/collectors` and `/explore/watches` are retired (D-03), but if BottomNav or SlimTopNav links to them, users hit 404.
**Why it happens:** The explore nav item itself points to `/explore` which is safe, but breadcrumbs or internal links may reference the sub-routes.
**How to avoid:** Grep for `explore/collectors` and `explore/watches` across `src/` and remove/repoint all references before deleting the route files.

---

## Code Examples

### Archetype Config (hardcoded, not DB)
```typescript
// Source: ASSUMED pattern; display names are editorial content (D-16)
// src/lib/archetype-config.ts

import type { PrimaryArchetype } from '@/lib/types'

export interface ArchetypeConfig {
  value: PrimaryArchetype
  displayName: string        // user-facing label
  description: string        // one-line editorial description
}

export const ARCHETYPE_CONFIG: Record<PrimaryArchetype, ArchetypeConfig> = {
  dress:   { value: 'dress',   displayName: 'Dress',   description: '...' },
  dive:    { value: 'dive',    displayName: 'Dive',    description: '...' },
  field:   { value: 'field',   displayName: 'Field',   description: '...' },
  pilot:   { value: 'pilot',   displayName: 'Pilot',   description: '...' },
  chrono:  { value: 'chrono',  displayName: 'Chrono',  description: '...' },
  gmt:     { value: 'gmt',     displayName: 'GMT',     description: '...' },
  racing:  { value: 'racing',  displayName: 'Racing',  description: '...' },
  sport:   { value: 'sport',   displayName: 'Sport',   description: '...' },
  tool:    { value: 'tool',    displayName: 'Tool',    description: '...' },
  hybrid:  { value: 'hybrid',  displayName: 'Hybrid',  description: '...' },
}
```

The actual `displayName` and `description` strings are editorial content the owner (D-16) finalizes at planning time.

### Cache Tag Pattern (Browse)
```typescript
// Source: src/components/explore/TrendingWatches.tsx (verified in codebase) + Next.js 16 docs
import { cacheLife, cacheTag } from 'next/cache'

export async function BrowseModule() {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')
  // ...
}
```

### Removable Facet Chip (inline, not in drawer)
```tsx
// Source: ASSUMED — following Phase 40 FilterDrawer chip pattern
// Inline chip above results, dismissible:
{archetype && (
  <button
    onClick={() => setArchetype(null)}
    className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-sm"
  >
    {archetypeConfig[archetype]?.displayName ?? archetype}
    <X className="size-3" aria-hidden />
    <span className="sr-only">Remove archetype filter</span>
  </button>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `TrendingWatches` + `PopularCollectors` rails | 5-module editorial shell | Phase 46 (this phase) | Old rails deleted; new shell is structural |
| `q.length >= 2` hard gate on Watches tab | Query-free when facet active | Phase 40 (done) | Browse deep-links work without typing |
| 8 archetype chips (SEED-008 draft) | 10 archetype chips (Phase 44 D-16 verified) | Phase 44 | EXPL-05 text of "eight" is stale — 10 is correct |
| Explore sub-routes `/explore/collectors` + `/explore/watches` | `/explore/brands` + `/explore/eras` + `/explore/genres` | Phase 46 | Old routes deleted; new index routes added |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/data/discovery.ts` readers are only consumed by retiring explore files and have no other callers | Retire Scope | If a non-explore page imports these, deleting discovery.ts would break that page |
| A2 | `getWearEventsCountByUser` in `src/data/wearEvents.ts` has no callers besides the old explore/page.tsx (after deletion of that file it becomes safe to remove the import) | Retire Scope | If another page imports `getWearEventsCountByUser`, the function itself stays; only the explore page's call is removed |
| A3 | Brand filter via `brands.slug` in the deep-link URL works because the Brands index page generates links using `brands.slug` from the GROUP BY query | Browse + Search Extension | If brands don't have slugs populated (FK was optional), brand filtering will silently return 0 results |
| A4 | `genre` and `archetype` URL params will never coexist in a real user session (they come from different entry points) | Search Extension | If they do coexist, the precedence rule (archetype wins) must be applied consistently |

---

## Open Questions (RESOLVED)

> All four questions below were resolved during planning (Phase 46 plans + UI-SPEC):
> Q1 — archetype display names: resolved via 46-UI-SPEC.md (proposed defaults, owner corrects at UAT);
> Q2 — brand slug vs UUID: resolved as slug subquery (Plan 46-02);
> Q3 — Phase-47 module slots: resolved as `return null` stubs (Plan 46-03);
> Q4 — Browse 3 vs 4 tiles: resolved as 3 tiles (Plan 46-03).

1. **Archetype chip display names (D-16)**
   - What we know: 10 raw values: `dress`, `dive`, `field`, `pilot`, `chrono`, `gmt`, `racing`, `sport`, `tool`, `hybrid`
   - What's unclear: The owner-curated display names and one-line editorial descriptions for each
   - Recommendation: Plan should include a Wave 0 task where the owner provides these 10 label/description pairs before the component is built

2. **Brand filter — slug vs UUID in URL param**
   - What we know: `brands.slug` is unique and URL-friendly; `brands.id` is UUID
   - What's unclear: Whether all brand rows have slugs populated in prod
   - Recommendation: Verify `SELECT COUNT(*) FROM brands WHERE slug IS NULL` before coding the brand filter. If any nulls exist, use UUID as the filter key instead.

3. **Phase-47 editorial module slots in Phase 46**
   - What we know: Hero, Curated Lists Rail, Where Collections Go have no wired content in Phase 46; EXPL-02 says hide if no content
   - What's unclear: Whether to render a placeholder or simply return null from the module component
   - Recommendation: Return null from each unimplemented module (simplest path; satisfies EXPL-02 automatically). Context notes Phase 45 authored 6 collection paths and CMS schema exists — planner may choose to wire a read-only Where-Collections-Go slot if the DAL already exists from Phase 45.

4. **Browse module: 3 tiles or disabled 4th tile (D-08)**
   - What we know: Price-bands deferred; D-08 says planner discretion; absent-not-empty is the safe default
   - What's unclear: Whether a "coming soon" tile is better UX than just 3 tiles
   - Recommendation: 3 tiles only — "coming soon" tiles add UI noise and break EXPL-02's absent-not-empty principle.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 46 is a code/DB-read-only change with no new external dependencies. All dependencies (Supabase, Drizzle, Next.js) are already operational.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPL-01 | `/explore` renders 5-module shell; modules with no content hide | manual-only | — | ❌ |
| EXPL-02 | Each module returns null when no content | unit | `npm test -- --reporter=verbose src/components/explore` | ❌ Wave 0 |
| EXPL-03 | `getBrowseBrandCounts`, `getBrowseEraCounts`, `getBrowseGenreCounts` return correct shape; Browse count cache tag wiring | unit | `npm test -- --reporter=verbose src/data/browse.test.ts` | ❌ Wave 0 |
| EXPL-04 | Brand index A–Z navigation renders letter anchors | manual-only | — | ❌ |
| EXPL-05 | All 10 archetypes have config entries; archetype header renders when param present | unit | `npm test -- --reporter=verbose src/lib/archetype-config.test.ts` | ❌ Wave 0 |
| D-11 | `searchCatalogWatches` with `archetype` facet and `q=''` returns results | unit | `npm test -- --reporter=verbose src/data/catalog.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/data/browse.test.ts` — covers EXPL-03 count query shapes
- [ ] `src/lib/archetype-config.test.ts` — verifies all 10 `PRIMARY_ARCHETYPES` values have config entries
- [ ] `src/data/catalog.test.ts` (new test cases) — covers archetype/era/genre/brand predicate extension
- [ ] `src/components/explore/CollectorArchetypes.test.ts` — EXPL-02 null return when counts empty

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` in Server Component page scope; proxy.ts gate already active for `/explore` |
| V3 Session Management | no | No new session state |
| V4 Access Control | no | Browse data is public-read (catalog RLS); no per-user data in Browse |
| V5 Input Validation | yes | New Zod fields in `searchSchema`: `brand`, `era`, `genre`, `archetype` — `.string().max(N)` bounds required |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unvalidated facet values flowing into SQL | Tampering | Zod `.string().max(100)` on new params + Drizzle parameterized queries (already in place for existing facets) |
| Per-viewer data leak via shared Browse cache | Information Disclosure | Browse components are viewer-independent; no `getCurrentUser()` inside cache scope |
| Archetype header injection via URL | Tampering | `archetype` value looked up in `ARCHETYPE_CONFIG` before render; arbitrary strings produce no header (config lookup returns undefined) |

---

## Sources

### Primary (HIGH confidence)
- `src/components/search/useSearchState.ts` — Phase 40 facet state + query-free gate pattern
- `src/data/catalog.ts` — `CatalogSearchFilters`, `searchCatalogWatches`, `hasActiveFacet` implementation
- `src/app/actions/search.ts` — `searchSchema` Zod shape + action wiring
- `src/components/explore/TrendingWatches.tsx` — established `'use cache'` + `cacheTag` + `cacheLife` pattern
- `src/db/schema.ts` — `watchesCatalog` (`primaryArchetype`, `eraSignal`, `brandId`), `brands` (`slug`)
- `src/lib/taste/vocab.ts` — `PRIMARY_ARCHETYPES` (10 values), `ERA_SIGNALS` (3 values)
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — cache key, constraints, request-time API rules
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — multi-tag, invalidation
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` — preset profiles table, nesting rules
- `next.config.ts` — confirms `cacheComponents: true` (under `experimental`)
- Codebase grep for `revalidateTag.*explore` — existing invalidation wiring

### Secondary (MEDIUM confidence)
- Import trace for D-04 retire scope — manual grep confirming Home does not import explore components

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture: HIGH — code fully read; patterns established from Phase 40
- Retire scope: HIGH — import grep confirmed
- Cache pattern: HIGH — verified from official Next.js 16 docs in `node_modules`
- Brand filter join: MEDIUM — schema verified; exact Drizzle idiom for slug subquery not verified in codebase

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable stack; catalog schema won't change within this milestone)

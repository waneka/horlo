# Phase 46: Explore Shell + Browse + Archetypes - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/explore/page.tsx` | page (Server Component) | request-response | `src/app/explore/page.tsx` (old) | exact — replace in place |
| `src/app/explore/brands/page.tsx` | page (Server Component) | request-response | `src/app/explore/collectors/page.tsx` | exact-role |
| `src/app/explore/eras/page.tsx` | page (Server Component) | request-response | `src/app/explore/collectors/page.tsx` | exact-role |
| `src/app/explore/genres/page.tsx` | page (Server Component) | request-response | `src/app/explore/collectors/page.tsx` | exact-role |
| `src/components/explore/CollectorArchetypes.tsx` | component (Server Component) | request-response | `src/components/explore/TrendingWatches.tsx` | exact — `'use cache'` + null-hide |
| `src/components/explore/BrowseModule.tsx` | component (Server Component) | request-response | `src/components/explore/TrendingWatches.tsx` | exact — `'use cache'` + null-hide |
| `src/components/explore/HeroModule.tsx` | component (Server Component) | none | `src/components/explore/TrendingWatches.tsx` | role-match (returns null in Phase 46) |
| `src/components/explore/CuratedListsRail.tsx` | component (Server Component) | none | `src/components/explore/TrendingWatches.tsx` | role-match (returns null in Phase 46) |
| `src/components/explore/WhereCollectionsGo.tsx` | component (Server Component) | none | `src/components/explore/TrendingWatches.tsx` | role-match (returns null in Phase 46) |
| `src/data/browse.ts` | DAL (service) | CRUD / batch | `src/data/catalog.ts` § `getTopStyleTags` | exact — `'use cache'` + `db.execute(sql\`...\`)` |
| `src/lib/archetype-config.ts` | config / utility | transform | `src/lib/taste/vocab.ts` § `PRIMARY_ARCHETYPES` | role-match — config colocation |
| `src/data/catalog.ts` | DAL (service) | CRUD | self (extended) | self-extension |
| `src/app/actions/search.ts` | server action | request-response | self (extended) | self-extension |
| `src/components/search/useSearchState.ts` | hook (client) | event-driven | self (extended) | self-extension |
| `src/components/search/SearchPageClient.tsx` | component (client) | event-driven | self (extended) | self-extension |
| `src/components/search/FilterDrawer.tsx` | component (client) | event-driven | self (extended) | self-extension |

---

## Pattern Assignments

### `src/app/explore/page.tsx` (page, Server Component — REPLACED)

**Analog:** `src/app/explore/page.tsx` (current file, lines 1–48)

**Imports pattern** (lines 1–7):
```typescript
import { getCurrentUser } from '@/lib/auth'
import { getFollowerCounts } from '@/data/profiles'
import { getWearEventsCountByUser } from '@/data/wearEvents'
import { ExploreHero } from '@/components/explore/ExploreHero'
import { PopularCollectors } from '@/components/explore/PopularCollectors'
import { TrendingWatches } from '@/components/explore/TrendingWatches'
import { GainingTractionWatches } from '@/components/explore/GainingTractionWatches'
```
Phase 46 replaces these imports with the five new module components. `getCurrentUser` stays; the per-viewer count fetches are dropped.

**Auth + metadata pattern** (lines 9–11, 30–31):
```typescript
export const metadata = {
  title: 'Explore — Horlo',
}

export default async function ExplorePage() {
  const user = await getCurrentUser()
  // NOTE: getCurrentUser() stays OUTSIDE any 'use cache' scope — per-viewer
  // data must never enter a globally-shared cache boundary.
```

**Module composition pattern** (lines 33–47) — phase 46 adapts this to 5-module grid:
```typescript
  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-8 md:space-y-12 max-w-6xl">
      {showHero && <ExploreHero />}
      <PopularCollectors viewerId={user.id} />
      <TrendingWatches />
      <GainingTractionWatches />
    </main>
  )
```
Phase 46 replaces with a 2-column grid shell:
```typescript
  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8">
        {/* Phase-47 slots return null in Phase 46 */}
        <HeroModule />           {/* md:col-span-2, returns null */}
        <CollectorArchetypes />  {/* md:col-span-1 */}
        <BrowseModule />         {/* md:col-span-1 */}
        <CuratedListsRail />     {/* md:col-span-2, returns null */}
        <WhereCollectionsGo />   {/* md:col-span-2, returns null */}
      </div>
    </main>
  )
```

---

### `src/app/explore/brands/page.tsx` (page, Server Component — NEW)

**Analog:** `src/app/explore/collectors/page.tsx` (lines 1–48)

**Auth + metadata pattern** (lines 1–17):
```typescript
import { getCurrentUser } from '@/lib/auth'
import { getMostFollowedCollectors } from '@/data/discovery'
import { PopularCollectorRow } from '@/components/explore/PopularCollectorRow'

export const metadata = {
  title: 'Popular collectors — Horlo',
}

export default async function CollectorsSeeAllPage() {
  const user = await getCurrentUser()
  const collectors = await getMostFollowedCollectors(user.id, { limit: 50 })
```
Phase 46 analog: replace `getCurrentUser()` call (auth check only — no viewerId passed to Browse DAL); call `getBrowseBrandCounts()` from `@/data/browse`.

**Page layout pattern** (lines 22–47):
```typescript
  return (
    <main className="container mx-auto px-4 md:px-8 py-8 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold leading-tight text-foreground">
        Popular collectors
      </h1>
      {collectors.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-base font-semibold">No collectors to suggest right now.</p>
          <p className="text-sm text-muted-foreground">...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collectors.map((c) => (
            <PopularCollectorRow key={c.userId} collector={c} viewerId={user.id} />
          ))}
        </div>
      )}
    </main>
  )
```
Phase 46: replaces `max-w-3xl` with `max-w-2xl` (per UI-SPEC index page layout); adds back-link `<Link href="/explore">` with `ChevronLeft`; inserts A–Z sticky nav above the letter-grouped brand list. Letter sections carry `id="letter-A"` + `className="scroll-mt-12"`.

**Back-link pattern** (from `src/app/explore/watches/page.tsx` note and UI-SPEC):
```tsx
<Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
  <ChevronLeft className="size-4" aria-hidden />
  Explore
</Link>
```

---

### `src/app/explore/eras/page.tsx` and `src/app/explore/genres/page.tsx` (pages, Server Component — NEW)

**Analog:** `src/app/explore/collectors/page.tsx` — same layout as brands page without A–Z nav.

Same auth check (`getCurrentUser()`), same `max-w-2xl` container, same back-link, same row pattern linking to `/search?tab=watches&era={value}` or `/search?tab=watches&genre={value}`. No A–Z nav — low cardinality (3 rows for eras, 10 for genres).

---

### `src/components/explore/CollectorArchetypes.tsx` (component, Server Component — NEW)

**Analog:** `src/components/explore/TrendingWatches.tsx` (lines 1–55) — exact pattern

**Full pattern** (all 55 lines):
```typescript
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { Flame } from 'lucide-react'

import { getTrendingCatalogWatches } from '@/data/discovery'
import { DiscoveryWatchCard } from '@/components/explore/DiscoveryWatchCard'

export async function TrendingWatches() {
  'use cache'
  cacheTag('explore', 'explore:trending-watches')
  cacheLife({ revalidate: 300 })

  const watches = await getTrendingCatalogWatches({ limit: 5 })
  if (watches.length === 0) return null

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-2">
          ...
        </h2>
      </header>
      <div className="flex gap-3 ...">
        {watches.map(...)}
      </div>
    </section>
  )
}
```

**Phase 46 substitutions:**
- `'explore:trending-watches'` → `'explore:archetypes'`
- `cacheLife({ revalidate: 300 })` → `cacheLife('hours')`
- Data fetch: `getBrowseArchetypeCounts()` from `@/data/browse`
- Null-hide guard: `if (counts.length === 0) return null`
- `<h2>`: "Collector Archetypes"
- Content: `<div className="flex flex-wrap gap-2">` with 10 `<button type="button">` chips, each navigating to `/search?tab=watches&archetype={value}`
- No `getCurrentUser()` — Browse is viewer-independent; no viewerId prop

**PopularCollectors analog** (lines 1–50 of `src/components/explore/PopularCollectors.tsx`) shows the per-viewer cache tag pattern (`cacheTag('explore', 'explore:popular-collectors:viewer:{viewerId}')`) that Browse must NOT follow — Browse is globally cached, not per-viewer.

---

### `src/components/explore/BrowseModule.tsx` (component, Server Component — NEW)

**Analog:** `src/components/explore/TrendingWatches.tsx` — same `'use cache'` + null-hide shell

**Core pattern** (adapting lines 17–55):
```typescript
export async function BrowseModule() {
  'use cache'
  cacheTag('explore', 'explore:browse')
  cacheLife('hours')

  // Tiles are static links — no DB call needed here; counts live on index pages.
  // If we want to validate non-empty catalog, we could do a quick count check.
  // But per EXPL-02: module returns null only when no content. Tiles are always
  // available (catalog always has brands/eras/genres), so this never returns null.

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold leading-tight text-foreground">Browse the Catalog</h2>
      <div className="grid grid-cols-3 gap-3">
        {/* 3 tiles: Brands, Eras, Genres */}
      </div>
    </section>
  )
}
```

**Tile pattern** (from UI-SPEC Component Inventory):
```tsx
<Link href="/explore/brands">
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-card border border-border p-4 min-h-12 hover:bg-muted transition-colors text-center">
    <Building2 className="size-5 text-muted-foreground" aria-hidden />
    <span className="text-sm font-semibold text-foreground">Brands</span>
  </div>
</Link>
```

---

### Phase-47 null stubs: `HeroModule.tsx`, `CuratedListsRail.tsx`, `WhereCollectionsGo.tsx`

**Analog:** `src/components/explore/TrendingWatches.tsx` shell — body returns null immediately.

```typescript
// Pattern: minimal async Server Component returning null
export async function HeroModule() {
  // Phase 47 wires this. Per EXPL-02: absent is correct — no empty container.
  return null
}
```
No `'use cache'` needed on null-return stubs (caching an unconditional null is pointless overhead).

---

### `src/data/browse.ts` (DAL, server-only — NEW)

**Analog:** `src/data/catalog.ts` lines 473–485 (`getTopStyleTags`) — exact `'use cache'` + `db.execute(sql`...`)` + cast-to-array pattern

**Core pattern to copy** (lines 473–485 of `src/data/catalog.ts`):
```typescript
export async function getTopStyleTags(limit = 8): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT tag, COUNT(*) AS freq
        FROM watches_catalog, unnest(style_tags) AS tag
        GROUP BY tag
        ORDER BY freq DESC
        LIMIT ${limit}`,
  )
  return (rows as unknown as Array<{ tag: string }>).map((r) => r.tag)
}
```

**Phase 46 browse.ts functions follow this pattern exactly:**
- `'server-only'` at top of file (matches `src/data/catalog.ts` line 1)
- `import 'server-only'` before any other imports
- `import { cacheLife, cacheTag } from 'next/cache'`
- `import { db } from '@/db'`
- `import { sql } from 'drizzle-orm'`
- Each function: `'use cache'` directive, `cacheTag('explore', 'explore:browse')`, `cacheLife('hours')`, `db.execute(sql\`...\`)`, `as unknown as Array<{...}>`

**`getTopStyleTags` difference:** it uses only `cacheLife`, not `cacheTag`. Browse functions must add `cacheTag('explore', 'explore:browse')` so the existing `revalidateTag('explore', 'max')` calls in watch Server Actions bust the cache on catalog mutation.

---

### `src/lib/archetype-config.ts` (config, utility — NEW)

**Analog:** `src/lib/taste/vocab.ts` — colocation of closed vocabulary as TS constants

**Imports pattern** (lines 1–13 of `src/lib/taste/vocab.ts`):
```typescript
// src/lib/taste/vocab.ts
import { z } from 'zod'
import type { CatalogTasteAttributes, PrimaryArchetype, EraSignal } from '@/lib/types'

export type { CatalogTasteAttributes, PrimaryArchetype, EraSignal }

export const PRIMARY_ARCHETYPES = [
  'dress', 'dive', 'field', 'pilot', 'chrono',
  'gmt', 'racing', 'sport', 'tool', 'hybrid',
] as const
```

**Phase 46 config file follows this colocation model:**
```typescript
// src/lib/archetype-config.ts
import type { PrimaryArchetype } from '@/lib/types'

export interface ArchetypeConfig {
  value: PrimaryArchetype
  displayName: string
  description: string
}

export const ARCHETYPE_CONFIG: Record<PrimaryArchetype, ArchetypeConfig> = {
  dress:   { value: 'dress',   displayName: 'Dress Watch Devotee',   description: 'Minimal dials, precious metals, and movements worth showing off' },
  dive:    { value: 'dive',    displayName: 'Dive Watch Devotee',    description: 'Built for depth, worn everywhere' },
  // ... all 10
}
```
No zod schema needed here (vocab.ts uses zod for LLM wire format validation; archetype-config is a static lookup only).

---

### `src/data/catalog.ts` — `CatalogSearchFilters` and `searchCatalogWatches` (EXTENDED)

**Analog:** self (lines 274–278, 337–403)

**`CatalogSearchFilters` extension** (lines 274–278, current):
```typescript
export interface CatalogSearchFilters {
  movement?: 'auto' | 'manual' | 'quartz' | 'spring_drive'
  size?: 'lt36' | '36-39' | '40-42' | '43-45' | '46plus'
  style?: string[]
}
```
Phase 46 adds: `brand?: string`, `era?: string`, `genre?: string`, `archetype?: string`

**`hasActiveFacet` extension** (line 337):
```typescript
// Current:
const hasActiveFacet = !!(filters?.movement || filters?.size || filters?.style?.length)

// Phase 46:
const hasActiveFacet = !!(filters?.movement || filters?.size || filters?.style?.length
  || filters?.brand || filters?.era || filters?.genre || filters?.archetype)
```

**WHERE predicate builder pattern** (lines 365–403) — copy this pattern for new facets:
```typescript
.where((() => {
  const predicates = []

  // ILIKE text query
  if (trimmed.length >= SEARCH_WATCHES_TRIM_MIN_LEN) {
    predicates.push(or(...))
  }

  // Movement Type facet
  if (filters?.movement) {
    predicates.push(isNotNull(watchesCatalog.movementType)!)
    predicates.push(eq(watchesCatalog.movementType, filters.movement)!)
  }

  // Case Size facet
  if (filters?.size) {
    const [min, max] = SIZE_BAND_MAP[filters.size]
    predicates.push(isNotNull(watchesCatalog.caseSizeMm)!)
    predicates.push(between(watchesCatalog.caseSizeMm, min, max)!)
  }

  // Style facet
  if (filters?.style?.length) {
    predicates.push(arrayOverlaps(watchesCatalog.styleTags, filters.style)!)
  }

  // Pitfall 1: and() with 0 args → undefined → Drizzle omits WHERE clause.
  return predicates.length > 0 ? and(...predicates) : undefined
})())
```

**Phase 46 new predicates (appended to the same array):**
```typescript
// Era facet — eraSignal column
if (filters?.era) {
  predicates.push(isNotNull(watchesCatalog.eraSignal)!)
  predicates.push(eq(watchesCatalog.eraSignal, filters.era)!)
}

// Genre OR Archetype — both map to primaryArchetype; archetype wins (Pitfall 4)
const primaryArchetypeFilter = filters?.archetype ?? filters?.genre
if (primaryArchetypeFilter) {
  predicates.push(isNotNull(watchesCatalog.primaryArchetype)!)
  predicates.push(eq(watchesCatalog.primaryArchetype, primaryArchetypeFilter)!)
}

// Brand facet — requires subquery because URL carries brands.slug, not brands.id
if (filters?.brand) {
  predicates.push(
    sql`${watchesCatalog.brandId} = (SELECT id FROM brands WHERE slug = ${filters.brand} LIMIT 1)`
  )
}
```

New Drizzle imports needed: `brands` from `@/db/schema` (or use raw sql subquery — raw sql is safer given existing single-table query structure).

---

### `src/app/actions/search.ts` — `searchSchema` and `searchWatchesAction` (EXTENDED)

**Analog:** self (lines 19–26, 85–117)

**`searchSchema` extension** (lines 19–26, current):
```typescript
const searchSchema = z
  .object({
    q: z.string().max(200),
    movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional(),
    size: z.enum(['lt36', '36-39', '40-42', '43-45', '46plus']).optional(),
    style: z.string().max(500).optional(),
  })
  .strict()
```
Phase 46 adds:
```typescript
    brand:     z.string().max(100).optional(),
    era:       z.string().max(50).optional(),
    genre:     z.string().max(50).optional(),
    archetype: z.string().max(50).optional(),
```

**`searchWatchesAction` filters pass-through** (lines 101–110) — extend to pass new fields:
```typescript
    filters: {
      movement: parsed.data.movement,
      size: parsed.data.size,
      style: parsed.data.style?.split(',').map((s) => s.trim()).filter(Boolean),
      // Phase 46:
      brand:     parsed.data.brand,
      era:       parsed.data.era,
      genre:     parsed.data.genre,
      archetype: parsed.data.archetype,
    },
```

**Auth + error pattern** (lines 85–117) — unchanged; copy exactly:
```typescript
export async function searchWatchesAction(
  data: unknown,
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = searchSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const results = await searchCatalogWatches({ ... })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchWatchesAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
```

---

### `src/components/search/useSearchState.ts` (EXTENDED)

**Analog:** self — extend Phase 40 facet state pattern

**State initialization pattern** (lines 86–96) — copy for new facets:
```typescript
// Current Phase 40 facet state initialization from URL:
const [movement, setMovement] = useState<string | null>(
  searchParams.get('movement') ?? null
)
const [size, setSize] = useState<string | null>(
  searchParams.get('size') ?? null
)
const [styleArr, setStyleArr] = useState<string[]>(
  searchParams.get('style')?.split(',').filter(Boolean) ?? []
)
```
Phase 46 adds (same pattern, scalar string for each):
```typescript
const [brand,     setBrand]     = useState<string | null>(searchParams.get('brand')     ?? null)
const [era,       setEra]       = useState<string | null>(searchParams.get('era')       ?? null)
const [genre,     setGenre]     = useState<string | null>(searchParams.get('genre')     ?? null)
const [archetype, setArchetype] = useState<string | null>(searchParams.get('archetype') ?? null)
```

**URL sync pattern** (lines 119–128) — extend Phase 40 block:
```typescript
// Current:
if (movement) params.set('movement', movement)
if (size) params.set('size', size)
if (styleArr.length > 0) params.set('style', styleArr.join(','))

// Phase 46 additions — same conditional set pattern:
if (brand)     params.set('brand',     brand)
if (era)       params.set('era',       era)
if (genre)     params.set('genre',     genre)
if (archetype) params.set('archetype', archetype)
```

**`hasActiveFacet` in 3b Watches sub-effect** (line 189):
```typescript
// Current:
const hasActiveFacet = !!(movement || size || styleArr.length)

// Phase 46:
const hasActiveFacet = !!(movement || size || styleArr.length || brand || era || genre || archetype)
```

**`searchWatchesAction` call extension** (lines 203–209):
```typescript
const res = await searchWatchesAction({
  q: debouncedQ,
  movement: movement ?? undefined,
  size: size ?? undefined,
  style: styleArr.length > 0 ? styleArr.join(',') : undefined,
  // Phase 46:
  brand:     brand     ?? undefined,
  era:       era       ?? undefined,
  genre:     genre     ?? undefined,
  archetype: archetype ?? undefined,
})
```

**Effect dependency array** (line 229) — extend `[debouncedQ, tab, movement, size, styleArr]`:
```typescript
  }, [debouncedQ, tab, movement, size, styleArr, brand, era, genre, archetype])
```

**`UseSearchState` interface** (lines 22–49) and return object (lines 277–305) — add new fields and setters.

---

### `src/components/search/SearchPageClient.tsx` (EXTENDED)

**Analog:** self — extend per UI-SPEC inline removable facet chip pattern

**Destructure hook additions** (lines 79–97) — add to existing destructure:
```typescript
const {
  // ... existing fields ...
  movement, setMovement,
  size, setSize,
  styleArr, setStyleArr,
  // Phase 46:
  brand,     setBrand,
  era,       setEra,
  genre,     setGenre,
  archetype, setArchetype,
  // ...
} = useSearchState()
```

**`activeCount` badge** (line 102) — extend:
```typescript
// Current:
const activeCount = (movement ? 1 : 0) + (size ? 1 : 0) + styleArr.length

// Phase 46:
const activeCount = (movement ? 1 : 0) + (size ? 1 : 0) + styleArr.length
  + (brand ? 1 : 0) + (era ? 1 : 0) + (genre ? 1 : 0) + (archetype ? 1 : 0)
```

**WatchesPanel call** (lines 174–182) — add new props:
```typescript
<WatchesPanel
  q={trimmed}
  results={watchesResults}
  isLoading={watchesIsLoading}
  hasError={watchesHasError}
  collectionRevision={collectionRevision}
  viewerUsername={viewerUsername}
  hasActiveFacet={activeCount > 0}
  // Phase 46:
  archetype={archetype}
  brand={brand}
  era={era}
  genre={genre}
  onClearBrand={() => setBrand(null)}
  onClearEra={() => setEra(null)}
  onClearGenre={() => setGenre(null)}
  onClearArchetype={() => setArchetype(null)}
/>
```

**Inline removable facet chip pattern** (from UI-SPEC, inside WatchesPanel):
```tsx
{/* Inline chips above results — rendered from active facets */}
{(brand || era || genre || archetype) && (
  <div className="flex flex-wrap gap-2 mb-4">
    {archetype && (
      <button
        type="button"
        onClick={() => setArchetype(null)}
        className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-3 py-1 text-sm font-medium text-accent-foreground hover:bg-accent/20 transition-colors"
      >
        <span>{ARCHETYPE_CONFIG[archetype]?.displayName ?? archetype}</span>
        <X className="size-3" aria-hidden />
        <span className="sr-only">Remove {ARCHETYPE_CONFIG[archetype]?.displayName ?? archetype} filter</span>
      </button>
    )}
    {/* brand, era, genre chips follow same pattern */}
  </div>
)}
```

**Archetype editorial header** (rendered in WatchesPanel above chips, from UI-SPEC):
```tsx
{archetype && ARCHETYPE_CONFIG[archetype] && (
  <section className="space-y-1 mb-4">
    <h2 className="text-xl font-semibold leading-tight text-foreground">
      {ARCHETYPE_CONFIG[archetype].displayName}
    </h2>
    <p className="text-sm text-muted-foreground">
      {ARCHETYPE_CONFIG[archetype].description}
    </p>
    <p className="text-xs text-muted-foreground">{results.length} watches</p>
  </section>
)}
```

**Error panel pattern** (lines 239–250) — copy unchanged for new no-results states:
```tsx
<div
  role="alert"
  className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3"
>
  <p className="text-sm text-destructive">
    Couldn&apos;t run watch search. Try again.
  </p>
</div>
```

---

### `src/components/search/FilterDrawer.tsx` (EXTENDED)

**Analog:** self — the drawer owns movement/size/style only. Phase 46 does NOT add brand/era/genre/archetype to the drawer (per UI-SPEC: arriving facets are inline chips above results, not in the drawer). No change to FilterDrawer needed — inline chips live in SearchPageClient/WatchesPanel.

If a Clear All button in the drawer should also clear the new facets, extend `handleClearAll` (lines 32–36):
```typescript
function handleClearAll() {
  onMovementChange(null)
  onSizeChange(null)
  onStyleChange([])
  // Phase 46: pass through if added to props:
  // onBrandChange?.(null)
  // onEraChange?.(null)
  // etc.
}
```
Recommendation: keep FilterDrawer managing only movement/size/style; inline chips have their own dismiss buttons. Clear All in the drawer clears drawer filters only.

---

## Shared Patterns

### `'use cache'` for Viewer-Independent Server Components

**Source:** `src/components/explore/TrendingWatches.tsx` lines 17–20
**Apply to:** `CollectorArchetypes.tsx`, `BrowseModule.tsx`, all three browse DAL functions in `browse.ts`

```typescript
export async function TrendingWatches() {
  'use cache'
  cacheTag('explore', 'explore:trending-watches')
  cacheLife({ revalidate: 300 })
```

**Phase 46 substitution rules:**
- `CollectorArchetypes`: `cacheTag('explore', 'explore:archetypes')`, `cacheLife('hours')`
- `BrowseModule`: `cacheTag('explore', 'explore:browse')`, `cacheLife('hours')`
- `browse.ts` functions: `cacheTag('explore', 'explore:browse')`, `cacheLife('hours')`
- NEVER call `getCurrentUser()` inside any `'use cache'` scope
- Browse is viewer-independent → no `viewer:{id}` suffix on cache tags (contrast with `PopularCollectors` line 24: `cacheTag('explore', 'explore:popular-collectors:viewer:${viewerId}')`)

### Auth Gate Pattern (Server Component pages)

**Source:** `src/app/explore/page.tsx` lines 30–31 and `src/app/explore/collectors/page.tsx` lines 17–18
**Apply to:** `src/app/explore/page.tsx` (rebuilt), `src/app/explore/brands/page.tsx`, `src/app/explore/eras/page.tsx`, `src/app/explore/genres/page.tsx`

```typescript
export default async function ExplorePage() {
  const user = await getCurrentUser()
  // proxy.ts already redirects unauth — getCurrentUser() throws UnauthorizedError
  // on rare race; let it propagate to framework error UI.
```
Browse index pages call `await getCurrentUser()` as an auth assertion only — the returned `user.id` is NOT passed to Browse DAL functions (viewer-independent).

### Module Heading Pattern

**Source:** `src/components/explore/TrendingWatches.tsx` line 27 and `src/app/explore/watches/page.tsx` line 63
**Apply to:** `CollectorArchetypes.tsx`, `BrowseModule.tsx`, all three index page h1s

```tsx
<h2 className="text-xl font-semibold leading-tight text-foreground">
```
For index page h1: same classes but `<h1>` element.

### Module null-hide Pattern (EXPL-02)

**Source:** `src/components/explore/TrendingWatches.tsx` line 22
**Apply to:** `CollectorArchetypes.tsx`, `BrowseModule.tsx`, Phase-47 slot stubs

```typescript
const watches = await getTrendingCatalogWatches({ limit: 5 })
if (watches.length === 0) return null
```
Phase 46: `if (counts.length === 0) return null` after each Browse DAL fetch.

### Error Handling in Server Actions

**Source:** `src/app/actions/search.ts` lines 86–117
**Apply to:** `searchWatchesAction` extension (self)

```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}

const parsed = searchSchema.safeParse(data)
if (!parsed.success) {
  return { success: false, error: 'Invalid request' }
}

try {
  const results = await searchCatalogWatches({ ... })
  return { success: true, data: results }
} catch (err) {
  console.error('[searchWatchesAction] unexpected error:', err)
  return { success: false, error: "Couldn't run search." }
}
```

### `db.execute(sql`...`) + `as unknown as Array<{...}>` pattern

**Source:** `src/data/catalog.ts` lines 477–485 (`getTopStyleTags`) and lines 141–161 (`upsertCatalogFromUserInput`)
**Apply to:** All four functions in `src/data/browse.ts`

```typescript
const rows = await db.execute(
  sql`SELECT tag, COUNT(*) AS freq
      FROM ...
      GROUP BY tag
      ORDER BY freq DESC
      LIMIT ${limit}`,
)
return (rows as unknown as Array<{ tag: string }>).map((r) => r.tag)
```

### Removable Filter Chip Pattern (existing drawer toggle → inline dismiss)

**Source:** `src/components/search/MovementChips.tsx` lines 25–40 (selected state classes)
**Apply to:** Inline facet chips in `SearchPageClient.tsx` WatchesPanel

```typescript
// Existing selected chip classes (MovementChips.tsx lines 33–34):
isSelected
  ? 'bg-accent text-accent-foreground border-accent font-semibold'
  : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
```
Inline dismiss chips use `bg-accent/10` instead of full `bg-accent` (per UI-SPEC: lighter since it's a removable tag not a toggle). Add `<X className="size-3" aria-hidden />` + `<span className="sr-only">Remove ... filter</span>`.

---

## No Analog Found

All Phase 46 files have close analogs in the codebase. No file requires falling back to RESEARCH.md patterns without codebase backing.

---

## Metadata

**Analog search scope:** `src/components/explore/`, `src/components/search/`, `src/data/`, `src/app/explore/`, `src/app/search/`, `src/app/actions/`, `src/lib/`
**Files scanned:** 22
**Pattern extraction date:** 2026-05-18

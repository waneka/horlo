# Phase 47: Curated Lists Rail + Hero + Where Collections Go — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 15 new/modified files
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/explore/CuratedListsRail.tsx` | component | request-response | `src/components/explore/CollectorArchetypes.tsx` | exact |
| `src/components/explore/RailListCard.tsx` | component | request-response | `src/components/explore/DiscoveryWatchCard.tsx` | exact |
| `src/components/explore/HeroModule.tsx` | component | request-response | `src/components/explore/CollectorArchetypes.tsx` | role-match |
| `src/components/explore/WhereCollectionsGo.tsx` | component | request-response | `src/components/explore/CollectorArchetypes.tsx` | exact |
| `src/components/explore/PathCard.tsx` | component | request-response | `src/components/explore/DiscoveryWatchCard.tsx` | role-match |
| `src/components/explore/ListSortFilterControls.tsx` | component | request-response | `src/components/filters/StatusToggle.tsx` | role-match |
| `src/app/explore/lists/page.tsx` | route | request-response | `src/app/explore/brands/page.tsx` | exact |
| `src/app/explore/lists/[id]/page.tsx` | route | request-response | `src/app/explore/genres/page.tsx` | role-match |
| `src/app/explore/paths/page.tsx` | route | request-response | `src/app/explore/brands/page.tsx` | exact |
| `src/lib/weekIndex.ts` | utility | transform | `src/lib/archetype-config.ts` | role-match |
| `src/lib/pathTypes.ts` | utility | transform | `src/lib/archetype-config.ts` | exact |
| `src/data/curatedLists.ts` (extend `setListStatus` + `getListItems`) | service | CRUD | self (existing) | exact |
| `src/data/collectionPaths.ts` (extend `getPathNodes` + `getPathWithNodes`) | service | CRUD | self (existing) | exact |
| `src/db/schema.ts` (add `publishedAt` column to `curatedLists`) | model | CRUD | self (existing) | exact |
| `supabase/migrations/20260519000000_phase47_published_at.sql` | migration | CRUD | `supabase/migrations/20260518200000_phase45_cms_tables.sql` | exact |

---

## Pattern Assignments

### `src/components/explore/CuratedListsRail.tsx` (component, request-response)

**Analog:** `src/components/explore/CollectorArchetypes.tsx`

**Imports pattern** (CollectorArchetypes.tsx lines 18-24):
```typescript
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getBrowseArchetypeCounts } from '@/data/browse'
import { ARCHETYPE_CONFIG } from '@/lib/archetype-config'
import type { PrimaryArchetype } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
```

**Core `'use cache'` pattern** (CollectorArchetypes.tsx lines 35-41):
```typescript
export async function CollectorArchetypes({ counts: propCounts }: Props = {}) {
  'use cache'
  cacheTag('explore', 'explore:archetypes')
  cacheLife('hours')

  const counts = propCounts ?? (await getBrowseArchetypeCounts())
  if (counts.length === 0) return null
```
For CuratedListsRail: substitute `cacheTag('explore', 'explore:lists')`, call `getPublishedLists(12)`, and check `lists.length === 0` for EXPL-02 null-hide.

**Section/h2 skeleton** (CollectorArchetypes.tsx lines 54-63):
```typescript
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Collector Archetypes
        </h2>
        ...
      </div>
      ...
    </section>
  )
```
For CuratedListsRail: the section heading is "Curated Lists" and it adds a `<div className="flex items-center justify-between">` wrapper to put the "View all" link on the right.

**Scrollable rail container** (BrowseModule.tsx lines 29-30 pattern + UI-SPEC):
```typescript
<div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth">
  {/* RailListCard × up to 12 — each must be shrink-0 */}
</div>
```

**Critical rules:**
- `'use cache'` is the FIRST statement in the function body
- `cacheTag` and `cacheLife` immediately follow
- Do NOT call `getCurrentUser()` inside this component — auth is handled in `src/app/explore/page.tsx` line 29

---

### `src/components/explore/RailListCard.tsx` (component, request-response)

**Analog:** `src/components/explore/DiscoveryWatchCard.tsx`

**Full component pattern** (DiscoveryWatchCard.tsx lines 21-51):
```typescript
export function DiscoveryWatchCard({
  watch,
  sublabel,
}: {
  watch: DiscoveryWatchCardWatch
  sublabel: ReactNode
}) {
  return (
    <Link
      href={`/catalog/${watch.id}`}
      className="block w-44 md:w-52 space-y-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${watch.brand} ${watch.model} — view details`}
    >
      <div className="aspect-square rounded-md bg-muted overflow-hidden">
        {watch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={watch.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground truncate">{watch.brand}</p>
        <p className="text-sm text-muted-foreground truncate">{watch.model}</p>
        <p className="text-sm text-muted-foreground">{sublabel}</p>
      </div>
    </Link>
  )
}
```
For RailListCard: href is `/explore/lists/${list.id}`, width is `w-44 md:w-52 shrink-0`, add absolute-positioned "New" badge over the cover image (`absolute top-2 left-2 rounded-full bg-accent text-accent-foreground text-xs font-semibold px-2 py-0.5`), show curator name + watch count + relative timestamp in the metadata block.

**CSS chain for cover image** (DiscoveryWatchCard.tsx lines 34-43 — verified working):
```typescript
<div className="aspect-square rounded-md bg-muted overflow-hidden">
  {watch.imageUrl ? (
    <img
      src={watch.imageUrl}
      alt=""
      className="w-full h-full object-cover"
    />
  ) : null}
</div>
```
Container must keep `overflow-hidden` and `aspect-square`; image must keep `w-full h-full object-cover` — this chain is verified in production.

---

### `src/components/explore/HeroModule.tsx` (component, request-response)

**Analog:** `src/components/explore/CollectorArchetypes.tsx` (same `'use cache'` module pattern)

**Imports pattern** (CollectorArchetypes.tsx lines 18-19 + cmsSettings.ts lines 1-4):
```typescript
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import 'server-only'

import { getCmsSettings } from '@/data/cmsSettings'
import { getPublishedLists, getListItemCount } from '@/data/curatedLists'
```

**Cache scope with locked tag** (from D-09 — tag `explore:hero` is pre-wired in Phase 45 write paths):
```typescript
export async function HeroModule() {
  'use cache'
  cacheTag('explore:hero')
  cacheLife('hours')
```
Note: `explore:hero` only — NOT `cacheTag('explore', 'explore:hero')` — because the Hero revalidates on editorial pin changes, not on generic explore cache invalidation.

**Hero full-bleed CSS chain** (UI-SPEC § CSS Chain Assertions — must assert explicitly per `feedback_ui_spec_css_chain_blind_spot` memory):
```typescript
<Link href={`/explore/lists/${list.id}`} className="block focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
  <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-muted min-h-[200px]">
    <img
      src={list.coverUrl}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
      <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">{list.curatorName}</p>
      <h2 className="text-2xl font-semibold text-white leading-tight">{list.title}</h2>
    </div>
  </div>
</Link>
```
Failure mode if `overflow-hidden` is missing OR image lacks `absolute inset-0`: image escapes container or does not fill. Failure mode if container lacks `aspect-video` or `min-h-[200px]`: height collapses to 0.

**HeroFeature discriminated union** (D-10 — must NOT be hardcoded, forward-compat for `featured_collector`):
```typescript
// Define inline in HeroModule.tsx or src/lib/types.ts
type HeroFeature =
  | { format: 'featured_list'; list: CuratedList }
  | { format: 'featured_collector' /* future shape */ }
```

**Pin override + quality gate + weekly rotation** (D-07/D-08/D-09):
```typescript
  const [settings, allPublished] = await Promise.all([
    getCmsSettings(),
    getPublishedLists(50),
  ])

  // D-08: apply quality gate (≥3 items requires getListItemCount per list)
  const withCounts = await Promise.all(
    allPublished.map(async (l) => ({ ...l, itemCount: await getListItemCount(l.id) }))
  )
  const eligible = withCounts.filter(
    (l) => l.itemCount >= 3 && !!l.coverUrl && !!l.introMarkdown
  )
  if (eligible.length === 0) return null  // EXPL-02

  // D-09: manual pin override
  let featured = null
  if (settings.pinnedListId && (!settings.pinExpiresAt || settings.pinExpiresAt > new Date())) {
    featured = eligible.find((l) => l.id === settings.pinnedListId) ?? null
  }

  // D-07: weekly rotation fallback
  if (!featured) {
    const week = getWeekIndex(new Date())
    const sorted = [...eligible].sort((a, b) =>
      (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0) || a.id.localeCompare(b.id)
    )
    featured = sorted[week % sorted.length]
  }
```

---

### `src/components/explore/WhereCollectionsGo.tsx` (component, request-response)

**Analog:** `src/components/explore/CollectorArchetypes.tsx`

**Cache scope** (same pattern as CollectorArchetypes, different tag per Claude's Discretion resolution):
```typescript
export async function WhereCollectionsGo() {
  'use cache'
  cacheTag('explore', 'explore:paths')
  cacheLife('hours')

  const allPaths = await getPublishedPaths()
  if (allPaths.length === 0) return null  // EXPL-02
```

**Weekly rotation slice** (D-13 — same mechanism as Hero D-07):
```typescript
  const week = getWeekIndex(new Date())
  const threePaths = allPaths.slice(week % allPaths.length, (week % allPaths.length) + 3)
  // Handle wrap-around: if slice < 3 items, prepend from start
```

**Section/h2 + "Explore all paths" link** (mirroring CollectorArchetypes.tsx lines 54-58 pattern):
```typescript
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground">Where Collections Go</h2>
        <Link href="/explore/paths" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          Explore all paths
        </Link>
      </div>
      ...
    </section>
  )
```

---

### `src/components/explore/PathCard.tsx` (component, request-response)

**Analog:** `src/components/explore/DiscoveryWatchCard.tsx` (image + label pattern) + UI-SPEC D-11/D-12

**Mobile vertical stack** (D-11 — new pattern, no direct analog; copy connector structure from UI-SPEC):
```typescript
{/* Mobile — flex-col md:hidden */}
<div className="flex flex-col gap-3 md:hidden">
  {allNodes.map((node, i) => (
    <div key={node.id} className="flex gap-3 items-start">
      <div className="flex flex-col items-center gap-1">
        <span className="flex items-center justify-center size-6 rounded-full bg-accent text-accent-foreground text-xs font-semibold shrink-0">
          {i + 1}
        </span>
        {i < allNodes.length - 1 && (
          <div className="w-px flex-1 bg-border min-h-[24px]" />
        )}
      </div>
      <div className="flex-1 pb-2">
        <Link href={`/catalog/${node.catalogId}`}>
          <p className="text-sm font-semibold text-foreground">{node.brand} {node.model}</p>
        </Link>
        {node.rationale && <p className="text-sm text-muted-foreground">{node.rationale}</p>}
      </div>
    </div>
  ))}
</div>
```

**Desktop horizontal sequence** (D-12):
```typescript
{/* Desktop — hidden md:flex */}
<div className="hidden md:flex gap-4 items-start">
  {allNodes.map((node, i) => (
    <Fragment key={node.id}>
      <div className="w-44 space-y-2">
        {/* watch image — reuse DiscoveryWatchCard CSS chain */}
        <div className="aspect-square rounded-md bg-muted overflow-hidden">
          {node.imageUrl && <img src={node.imageUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <Link href={`/catalog/${node.catalogId}`}>
          <p className="text-sm font-semibold text-foreground truncate">{node.brand} {node.model}</p>
        </Link>
        {node.rationale && <p className="text-sm text-muted-foreground">{node.rationale}</p>}
      </div>
      {i < allNodes.length - 1 && (
        <ChevronRight className="size-5 text-muted-foreground mt-10 shrink-0" />
      )}
    </Fragment>
  ))}
</div>
```

**Path-type chip** (D-14 — uses existing `Badge` component):
```typescript
import { Badge } from '@/components/ui/badge'
// ...
<Badge variant="secondary" className="text-xs">{path.pathType}</Badge>
```

---

### `src/components/explore/ListSortFilterControls.tsx` (component — `'use client'`)

**Analog:** `src/components/filters/StatusToggle.tsx`

**Client directive + local state pattern** (StatusToggle.tsx lines 1-18):
```typescript
'use client'

import { useState } from 'react'
```
StatusToggle uses Zustand store state; ListSortFilterControls uses local `useState` (D-04 Claude's Discretion: local state, not URL params or store).

**Local state sort** (D-04 pattern — no existing exact analog; closest is StatusToggle's controlled value pattern):
```typescript
'use client'

import { useState, useMemo } from 'react'

type SortKey = 'newest' | 'most-watches'

export function ListSortFilterControls({ lists }: { lists: ListWithCount[] }) {
  const [sort, setSort] = useState<SortKey>('newest')

  const sorted = useMemo(() => {
    if (sort === 'newest') return [...lists].sort((a, b) => /* publishedAt desc */)
    return [...lists].sort((a, b) => b.itemCount - a.itemCount)
  }, [lists, sort])

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-sm rounded-md border border-border bg-background px-3 py-1.5"
        >
          <option value="newest">Newest</option>
          <option value="most-watches">Most watches</option>
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {sorted.map(list => <RailListCard key={list.id} list={list} />)}
      </div>
    </>
  )
}
```

---

### `src/app/explore/lists/page.tsx` (route, request-response)

**Analog:** `src/app/explore/brands/page.tsx`

**Full page structure** (brands/page.tsx lines 1-32):
```typescript
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import { getBrowseBrandCounts } from '@/data/browse'

export const metadata = {
  title: 'Brands — Horlo',
}

export default async function BrandsPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  const brands = await getBrowseBrandCounts()
  // ...

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      {/* Back link */}
      <Link
        href="/explore"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Explore
      </Link>
      <h1 className="text-xl font-semibold leading-tight text-foreground mt-2 mb-6">
```
For `/explore/lists`: `getCurrentUser()` first (outside any cache scope), `getPublishedLists()` for data, `max-w-6xl` container, back nav `← Explore`, `h1` "Curated Lists" at `text-2xl`. Pass all list data into `ListSortFilterControls` client component.

---

### `src/app/explore/lists/[id]/page.tsx` (route, request-response)

**Analog:** `src/app/explore/genres/page.tsx` (same auth + data fetch + render structure)

**Auth + data fetch pattern** (genres/page.tsx lines 39-43):
```typescript
export default async function GenresPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  const genres = await getBrowseGenreCounts()
```
For list detail: `await getCurrentUser()`, then `const list = await getListWithItems(params.id)`, then `if (!list) notFound()`.

**`react-markdown` + `rehypeSanitize` + `prose` wrapper** (from RESEARCH.md Pattern 6 — source: `src/components/admin/MarkdownEditor.tsx` verified pattern):
```typescript
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

// REQUIRED: prose wrapper + rehypeSanitize — both are non-negotiable (CR-02)
{introMarkdown && (
  <div className="prose prose-sm dark:prose-invert max-w-none mb-10">
    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{introMarkdown}</ReactMarkdown>
  </div>
)}
```

**Editorial row CSS chain** (UI-SPEC § Editorial row image chain):
```typescript
{/* Mobile: flex-col; Desktop: flex-row */}
<div className="flex flex-col md:flex-row gap-4 py-6">
  <Link href={`/catalog/${item.catalogId}`} className="shrink-0">
    <div className="w-full md:w-40 aspect-square rounded-md bg-muted overflow-hidden">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={`${item.brand} ${item.model}`} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-xs text-muted-foreground">No image</span>
        </div>
      )}
    </div>
  </Link>
  <div className="flex-1 min-w-0">...</div>
</div>
```
Max content width: `max-w-3xl` (narrower than other pages — editorial prose).

---

### `src/app/explore/paths/page.tsx` (route, request-response)

**Analog:** `src/app/explore/brands/page.tsx`

Same `getCurrentUser()` + data fetch + main container pattern. Groups paths by `PATH_TYPES` order. Imports `PATH_TYPES` from `src/lib/pathTypes.ts` (not from `'use server'` file). Sections with zero entries are omitted (EXPL-02 pattern). Uses `PathCard` sub-component. Container `max-w-6xl`.

---

### `src/lib/weekIndex.ts` (utility, transform)

**Analog:** `src/lib/archetype-config.ts` (shared config/constant file pattern — pure TS, no framework deps)

**Pattern** (RESEARCH.md Pattern 3 + Claude's Discretion resolution):
```typescript
// src/lib/weekIndex.ts
// Returns a monotonically increasing integer that advances every 7 days.
// Deterministic: same value for all callers on the same week.
// Used as an implicit cache-key input for HeroModule and WhereCollectionsGo rotation.
// Epoch-days ÷ 7 — simpler than ISO week; avoids year-boundary edge cases (D-07, D-13).
export function getWeekIndex(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
}
```
No imports. Pure function. Consumed by HeroModule and WhereCollectionsGo — single source.

---

### `src/lib/pathTypes.ts` (utility, transform)

**Analog:** `src/lib/archetype-config.ts` (shared constant extraction pattern)

**Pattern** (extracted from `src/app/actions/cms/collectionPaths.ts` line 33):
```typescript
// src/lib/pathTypes.ts
// Extracted from src/app/actions/cms/collectionPaths.ts:33
// Three consumers: collectionPaths.ts action, PathEditorClient.tsx, /explore/paths page.
// Extracted to avoid importing a 'use server' file from a Server Component page.
export const PATH_TYPES = [
  'Going Deeper',
  'Branching Out',
  'Trading Up',
  'Filling a Gap',
] as const

export type PathType = (typeof PATH_TYPES)[number]
```

---

### `src/data/curatedLists.ts` — extend `setListStatus` + `getListItems` (service, CRUD)

**Analog:** Self (existing file) — extends two functions.

**Current `setListStatus`** (curatedLists.ts lines 102-107):
```typescript
export async function setListStatus(id: string, status: 'draft' | 'published') {
  await db
    .update(curatedLists)
    .set({ status, updatedAt: new Date() })
    .where(eq(curatedLists.id, id))
}
```

**Extended pattern** (D-03 — stamp `published_at` only on first transition; use Drizzle `sql` template for COALESCE):
```typescript
import { sql } from 'drizzle-orm'

export async function setListStatus(id: string, status: 'draft' | 'published') {
  const set: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'published') {
    // D-03: stamp published_at on first draft→published transition only.
    // COALESCE keeps existing value on re-publish (re-publishing after unpublish
    // must NOT reset published_at).
    set.publishedAt = sql`COALESCE(${curatedLists.publishedAt}, NOW())`
  }
  await db
    .update(curatedLists)
    .set(set as Parameters<typeof db.update>[0] extends { set: infer S } ? S : never)
    .where(eq(curatedLists.id, id))
}
```

**Current `getListItems` SELECT** (curatedLists.ts lines 150-165 — MISSING `imageUrl`):
```typescript
  return db
    .select({
      id: curatedListItems.id,
      listId: curatedListItems.listId,
      catalogId: curatedListItems.catalogId,
      commentary: curatedListItems.commentary,
      sortOrder: curatedListItems.sortOrder,
      createdAt: curatedListItems.createdAt,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      // PHASE 47: add imageUrl here for D-06 editorial rows
    })
```
Add `imageUrl: watchesCatalog.imageUrl` to the select object. The `innerJoin` on `watchesCatalog` is already present — this is a one-line addition.

---

### `src/data/collectionPaths.ts` — extend `getPathNodes` + seed query in `getPathWithNodes` (service, CRUD)

**Analog:** Self (existing file).

**Current `getPathNodes` SELECT** (collectionPaths.ts lines 83-99 — MISSING `imageUrl`):
```typescript
  return db
    .select({
      id: collectionPathNodes.id,
      pathId: collectionPathNodes.pathId,
      catalogId: collectionPathNodes.catalogId,
      rationale: collectionPathNodes.rationale,
      sortOrder: collectionPathNodes.sortOrder,
      createdAt: collectionPathNodes.createdAt,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      // PHASE 47: add imageUrl here for D-11/D-12 path renderer
    })
```
Add `imageUrl: watchesCatalog.imageUrl`. Same as `getListItems` fix.

**Current seed watch SELECT in `getPathWithNodes`** (collectionPaths.ts lines 61-68 — also MISSING `imageUrl`):
```typescript
    db
      .select({
        brand: watchesCatalog.brand,
        model: watchesCatalog.model,
        reference: watchesCatalog.reference,
        // PHASE 47: add imageUrl here
      })
      .from(watchesCatalog)
      .where(eq(watchesCatalog.id, path.seedCatalogId))
```
Add `imageUrl: watchesCatalog.imageUrl` to both queries.

---

### `src/db/schema.ts` — add `publishedAt` column to `curatedLists` (model, CRUD)

**Analog:** Self (existing file — existing timestamp column pattern at schema.ts lines 580-581).

**Existing timestamp pattern** (schema.ts lines 580-581):
```typescript
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

**New column** (D-02 — nullable, no default, placed after `sortOrder` before `createdAt`):
```typescript
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),  // nullable — set on first publish
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
```

---

### `supabase/migrations/20260519000000_phase47_published_at.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260518200000_phase45_cms_tables.sql` (SQL style and structure)

**Migration pattern** (RESEARCH.md § Schema Change + memory `project_drizzle_supabase_db_mismatch`):
```sql
-- Phase 47 D-02: add published_at to curated_lists
ALTER TABLE public.curated_lists
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- D-03: backfill — existing published lists get published_at = created_at
-- so they show a sensible date rather than null on the rail freshness indicator.
UPDATE public.curated_lists
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;
```
Filename must be newer than `20260518210000_phase45_cms_covers_bucket.sql`. Push commands: local `npx drizzle-kit push`; prod `supabase db push --linked`.

---

## Shared Patterns

### `'use cache'` Viewer-Independent Module
**Source:** `src/components/explore/CollectorArchetypes.tsx` lines 35-41
**Apply to:** `CuratedListsRail.tsx`, `HeroModule.tsx`, `WhereCollectionsGo.tsx`
```typescript
export async function ModuleName() {
  'use cache'                         // FIRST statement in function body
  cacheTag('explore', 'explore:tag')  // Hero uses cacheTag('explore:hero') only
  cacheLife('hours')

  const data = await getDALFunction()
  if (data.length === 0) return null  // EXPL-02: absent-not-empty
```

### Auth Assertion Outside Cache Scope
**Source:** `src/app/explore/page.tsx` line 29; `src/app/explore/brands/page.tsx` line 29
**Apply to:** All three new route pages (`/explore/lists`, `/explore/lists/[id]`, `/explore/paths`)
```typescript
export default async function PageName() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()
  // data fetches follow
```

### EXPL-02 Absent-Not-Empty
**Source:** `src/components/explore/CollectorArchetypes.tsx` line 41; `src/components/explore/HeroModule.tsx` (stub pattern)
**Apply to:** `CuratedListsRail`, `HeroModule`, `WhereCollectionsGo`; also per-section in `/explore/paths`
```typescript
if (data.length === 0) return null  // not an empty <section> or <div>
```

### Route Page Container
**Source:** `src/app/explore/brands/page.tsx` lines 47-56 and `src/app/explore/genres/page.tsx` line 47
**Apply to:** `/explore/lists`, `/explore/lists/[id]`, `/explore/paths`
```typescript
return (
  <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
    <Link
      href="/explore"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Explore
    </Link>
    <h1 className="text-xl font-semibold leading-tight text-foreground mt-2 mb-6">
```
List detail uses `max-w-3xl` (narrower measure for prose). List detail back nav points to `/explore/lists`, not `/explore`.

### DAL Select Pattern (Drizzle)
**Source:** `src/data/curatedLists.ts` lines 149-165; `src/data/collectionPaths.ts` lines 83-99
**Apply to:** Both DAL imageUrl extension tasks
```typescript
return db
  .select({
    id: table.id,
    // ... existing columns ...
    brand: watchesCatalog.brand,
    model: watchesCatalog.model,
    reference: watchesCatalog.reference,
    imageUrl: watchesCatalog.imageUrl,  // ADD THIS
  })
  .from(table)
  .innerJoin(watchesCatalog, eq(table.catalogId, watchesCatalog.id))
```
The `innerJoin` is already present in both DAL functions — `imageUrl` is a one-line addition per function.

### react-markdown + rehypeSanitize (Security-Critical)
**Source:** `src/components/admin/MarkdownEditor.tsx` lines 15, 26 (CR-02 note)
**Apply to:** `/explore/lists/[id]` detail page only
```typescript
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

<div className="prose prose-sm dark:prose-invert max-w-none">
  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{introMarkdown}</ReactMarkdown>
</div>
```
Both `rehypeSanitize` and the `prose` wrapper are required — omitting either is a security (XSS) or visual regression.

### DAL Test Mock Pattern
**Source:** `src/data/__tests__/collectionPaths.test.ts` lines 17-85
**Apply to:** New test files for DAL extensions (`curatedLists.test.ts` extension, `collectionPaths.test.ts` extension)
```typescript
const mocks = vi.hoisted(() => {
  const capturedWhereArgs: unknown[] = []
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  return { capturedWhereArgs, mockSelect, mockUpdate }
})

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}))
```
`vi.hoisted` is required because `vi.mock` is hoisted to file top — module-scope variables are not yet initialized.

---

## No Analog Found

No files in this phase lack a close analog — all patterns are well-covered by Phase 45/46 code. The closest to "no analog" cases are:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `PathCard.tsx` D-11 mobile vertical stack with connector line | component | request-response | The numbered-stack + connector-line visual is new. No existing component does this layout. Build from UI-SPEC § WhereCollectionsGo and the `DiscoveryWatchCard` image-chain pattern. |
| `ListSortFilterControls.tsx` local sort state | component | request-response | `StatusToggle` uses Zustand store, not local state; `FilterBar` also uses store. The client component shell is identical but the state mechanism is `useState` + `useMemo`. |

---

## Metadata

**Analog search scope:** `src/components/explore/`, `src/app/explore/`, `src/data/`, `src/db/schema.ts`, `src/components/filters/`, `src/lib/`, `supabase/migrations/`
**Files read:** 17
**Pattern extraction date:** 2026-05-19

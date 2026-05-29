# Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 22 (8 new, 14 modified/test)
**Analogs found:** 22 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/watch/SearchEntry.tsx` | component | request-response (typeahead) | `src/components/search/WatchSearchRowsAccordion.tsx` (base-ui Accordion → base-ui Combobox) + `src/components/search/WatchSearchRow.tsx` (row visual) | role-match |
| `src/components/watch/SearchEntry.test.tsx` | test | — | `src/components/watch/ConfirmStep.test.tsx` | exact |
| `src/components/watch/StructuredEntryPanel.tsx` | component | request-response | `src/components/watch/WatchForm.tsx` (4-field grid) + `src/components/watch/AddWatchFlow.tsx` (extract-error + VerdictSkeleton pattern) | role-match |
| `src/components/watch/StructuredEntryPanel.test.tsx` | test | — | `src/components/watch/ConfirmStep.test.tsx` | exact |
| `src/components/watch/useCatalogSearchCache.ts` | hook/cache | in-memory | `src/components/watch/useUrlExtractCache.ts` | exact |
| `src/components/watch/useCatalogSearchCache.test.ts` | test | — | `src/components/watch/AddWatchFlow.test.tsx` cache-reset block | role-match |
| `src/components/watch/useStructuredExtractCache.ts` | hook/cache | in-memory | `src/components/watch/useUrlExtractCache.ts` | exact |
| `src/components/watch/useStructuredExtractCache.test.ts` | test | — | `src/components/watch/AddWatchFlow.test.tsx` cache-reset block | role-match |
| `src/lib/searchEntry/parseSearchQuery.ts` | pure helper | transform | none (net-new pattern) | no analog |
| `src/lib/searchEntry/parseSearchQuery.test.ts` | test | — | `src/components/watch/ExtractErrorCard.test.tsx` (CASES array + it.each) | role-match |
| `src/components/watch/useUrlExtractCache.ts` (MODIFY) | hook/cache retrofit | in-memory | self — add `viewerUserId` arg mirroring `useWatchSearchVerdictCache.ts:42-45` | self-extend |
| `src/components/search/useWatchSearchVerdictCache.ts` (MODIFY) | hook/cache retrofit | in-memory | self — add `viewerUserId` required arg + `moduleUserId` var | self-extend |
| `src/components/watch/AddWatchFlow.tsx` (MODIFY) | component retrofit | request-response | self — extend `AddWatchFlowProps` + update 2 cache call sites | self-extend |
| `src/components/search/WatchSearchRowsAccordion.tsx` (MODIFY) | component retrofit | request-response | self — add `viewerUserId` prop + thread to cache call | self-extend |
| `src/components/search/SearchPageClient.tsx` (MODIFY) | component retrofit | request-response | self — 3-layer thread: `SearchPageClient` → `WatchesPanel` → `WatchSearchRowsAccordion` | self-extend |
| `src/components/watch/ExtractErrorCard.tsx` (MODIFY) | component retrofit | request-response | self — add `mode?` prop; branch `structured-data-missing` body only | self-extend |
| `src/components/watch/ExtractErrorCard.test.tsx` (MODIFY) | test retrofit | — | self — extend existing CASES + describe blocks | self-extend |
| `src/data/catalog.ts` (MODIFY) | DAL | CRUD (read) | `src/data/catalog.ts:662` — `getTopStyleTags` (no `'use cache'` version; plain Drizzle ORM query) | role-match |
| `src/app/watch/new/page.tsx` (MODIFY) | page retrofit | request-response | self — extend `Promise.all` block at L90 + pass new prop to AddWatchFlow at L121 | self-extend |
| `src/components/watch/AddWatchFlow.test.tsx` (MODIFY) | test retrofit | — | self — add Phase 69 cache-hygiene `describe` block using `import()` pattern at L70 | self-extend |
| `src/components/watch/useUrlExtractCache.test.ts` (NEW — if needed) | test | — | `src/components/watch/AddWatchFlow.test.tsx` cache-reset pattern | role-match |
| `src/components/search/useWatchSearchVerdictCache.test.ts` (NEW — if needed) | test | — | `src/components/watch/AddWatchFlow.test.tsx` cache-reset pattern | role-match |

---

## Pattern Assignments

### `src/components/watch/useCatalogSearchCache.ts` (NEW hook/cache — DIRECT analog)

**Analog:** `src/components/watch/useUrlExtractCache.ts` (entire file, 51 lines)

**Mirror this entire file shape.** The only structural change is:
1. Add `let moduleUserId = ''` alongside `let moduleCache`
2. Add `viewerUserId: string` as required positional arg to the hook
3. Add `if (moduleUserId !== viewerUserId)` reset block (D-06 pattern)
4. Add stale-write guard inside `set()` (mirrors `useWatchSearchVerdictCache.ts:52-54`)
5. Export a `__resetCatalogSearchCacheForTests()` that resets BOTH `moduleCache` and `moduleUserId`
6. Value type is `SearchCatalogWatchResult[]`; key is `query.trim().toLowerCase()`

**Full analog file** (`src/components/watch/useUrlExtractCache.ts` lines 1-51):
```typescript
'use client'

import type { ExtractedWatchData } from '@/lib/extractors'

// [JSDoc block — mirror with updated cache purpose]

export type ExtractCacheEntry = {
  catalogId: string
  extracted: ExtractedWatchData
  catalogIdError: string | null
}

let moduleCache: Map<string, ExtractCacheEntry> = new Map()

export function __resetUrlExtractCacheForTests(): void {
  moduleCache = new Map()
}

export function useUrlExtractCache() {
  return {
    get: (url: string): ExtractCacheEntry | undefined => moduleCache.get(url),
    set: (url: string, entry: ExtractCacheEntry): void => {
      moduleCache.set(url, entry)
    },
  }
}
```

**In-render reset block to add** (from `src/components/search/useWatchSearchVerdictCache.ts` lines 38-45):
```typescript
// Drop cache when userId changes. Intentional sync mutation in render (NOT setState)
// — module state has no React-tracked subscribers, so this is a deterministic
// same-render reset.
if (moduleUserId !== viewerUserId) {
  moduleCache = new Map()
  moduleUserId = viewerUserId
}
```

**Stale-write guard in `set()`** (from `src/components/search/useWatchSearchVerdictCache.ts` lines 51-54):
```typescript
set: (key: string, results: SearchCatalogWatchResult[]): void => {
  if (moduleUserId !== viewerUserId) return  // stale-write guard
  moduleCache.set(key, results)
},
```

---

### `src/components/watch/useStructuredExtractCache.ts` (NEW hook/cache — DIRECT analog)

**Analog:** `src/components/watch/useUrlExtractCache.ts` (entire file — same shape as `useCatalogSearchCache`)

**Mirror identical shape as `useCatalogSearchCache` with two differences:**
1. Value type: `ExtractCacheEntry` (import from `useUrlExtractCache.ts` OR re-declare — same shape: `{ catalogId, extracted, catalogIdError }`)
2. Cache key: D-18 JSON tuple — `JSON.stringify({ brand: brand.trim().toLowerCase(), model: model.trim().toLowerCase(), reference: (reference ?? '').trim().toLowerCase(), year: year ?? null })`
3. Export name: `__resetStructuredExtractCacheForTests()`
4. Hook name: `useStructuredExtractCache(viewerUserId: string)`

The `get(key: string)` / `set(key: string, entry: ExtractCacheEntry)` API shape is identical to `useUrlExtractCache`.

---

### `src/components/watch/useUrlExtractCache.ts` (MODIFY — retrofit)

**Analog:** `src/components/search/useWatchSearchVerdictCache.ts` lines 38-45 (reset block) + `src/components/watch/useUrlExtractCache.ts` (current file, extend in-place)

**Current file** (`src/components/watch/useUrlExtractCache.ts` lines 33-51):
```typescript
let moduleCache: Map<string, ExtractCacheEntry> = new Map()

export function __resetUrlExtractCacheForTests(): void {
  moduleCache = new Map()
}

export function useUrlExtractCache() {
  return {
    get: (url: string): ExtractCacheEntry | undefined => moduleCache.get(url),
    set: (url: string, entry: ExtractCacheEntry): void => {
      moduleCache.set(url, entry)
    },
  }
}
```

**After retrofit** — add `let moduleUserId = ''`; update `__resetUrlExtractCacheForTests` to also reset it; add `viewerUserId: string` required arg; add reset block at top of hook body:
```typescript
let moduleCache: Map<string, ExtractCacheEntry> = new Map()
let moduleUserId = ''                        // NEW

export function __resetUrlExtractCacheForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''                          // NEW — also reset
}

export function useUrlExtractCache(viewerUserId: string) {  // NEW required arg
  if (moduleUserId !== viewerUserId) {       // NEW in-render reset block
    moduleCache = new Map()
    moduleUserId = viewerUserId
  }
  return {
    get: (url: string): ExtractCacheEntry | undefined => moduleCache.get(url),
    set: (url: string, entry: ExtractCacheEntry): void => {
      if (moduleUserId !== viewerUserId) return  // stale-write guard (already present concept; make explicit)
      moduleCache.set(url, entry)
    },
  }
}
```

**Call site to update:** `src/components/watch/AddWatchFlow.tsx` line 127 — `useUrlExtractCache()` → `useUrlExtractCache(viewerUserId)`.

---

### `src/components/search/useWatchSearchVerdictCache.ts` (MODIFY — retrofit)

**Analog:** self (`src/components/search/useWatchSearchVerdictCache.ts` entire file, 57 lines)

**Current hook signature** (line 38):
```typescript
export function useWatchSearchVerdictCache(collectionRevision: number) {
```

**Current in-render reset block** (lines 39-45):
```typescript
  if (moduleRevision !== collectionRevision) {
    moduleCache = new Map()
    moduleRevision = collectionRevision
  }
```

**Current `__resetVerdictCacheForTests`** (lines 33-36):
```typescript
export function __resetVerdictCacheForTests(): void {
  moduleCache = new Map()
  moduleRevision = 0
}
```

**After retrofit** — add `let moduleUserId = ''` at module level; add `viewerUserId: string` as second required positional arg; add outer user-switch guard BEFORE the existing revision guard; update reset fn to also clear `moduleUserId`:
```typescript
let moduleCache: Map<string, VerdictBundle> = new Map()
let moduleRevision = 0
let moduleUserId = ''               // NEW

export function __resetVerdictCacheForTests(): void {
  moduleCache = new Map()
  moduleRevision = 0
  moduleUserId = ''                 // NEW — also reset
}

export function useWatchSearchVerdictCache(
  collectionRevision: number,
  viewerUserId: string,             // NEW — required positional arg
) {
  // User-switch check FIRST (outer guard — clears cache and resets revision
  // so the inner revision check fires fresh for the new user)
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
    moduleRevision = 0              // reset so inner check also fires
  }
  // Existing revision check (inner guard — unchanged semantics)
  if (moduleRevision !== collectionRevision) {
    moduleCache = new Map()
    moduleRevision = collectionRevision
  }
  // ... rest of hook unchanged ...
}
```

**Call sites to update:**
- `src/components/watch/AddWatchFlow.tsx` line 123: `useWatchSearchVerdictCache(collectionRevision)` → `useWatchSearchVerdictCache(collectionRevision, viewerUserId)`
- `src/components/search/WatchSearchRowsAccordion.tsx` line 47: `useWatchSearchVerdictCache(collectionRevision)` → `useWatchSearchVerdictCache(collectionRevision, viewerUserId)`

---

### `src/components/watch/SearchEntry.tsx` (NEW component)

**Analog 1 (base-ui primitive pattern):** `src/components/search/WatchSearchRowsAccordion.tsx` lines 1-50 (base-ui import pattern + cache hook wiring)
**Analog 2 (row visual):** `src/components/search/WatchSearchRow.tsx` lines 28-70 (full row composition)
**Analog 3 (debounce + AbortController):** `src/components/search/useSearchState.ts` lines 129-133 (debounce) + lines 228-253 (AbortController)

**Imports pattern** (from `WatchSearchRowsAccordion.tsx` lines 1-16, adapted):
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Search, Watch as WatchIcon, Loader2 } from 'lucide-react'
import { Combobox } from '@base-ui/react/combobox'
import Image from 'next/image'

import { HighlightedText } from '@/components/search/HighlightedText'
import { StructuredEntryPanel } from '@/components/watch/StructuredEntryPanel'
import { useCatalogSearchCache } from '@/components/watch/useCatalogSearchCache'
import { searchCatalogForAddFlow } from '@/app/actions/search'
import { parseSearchQuery } from '@/lib/searchEntry/parseSearchQuery'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
import type { ExtractedWatchData } from '@/lib/extractors/types'
```

**Debounce pattern** (from `useSearchState.ts` lines 129-133 — D-04 copy verbatim):
```typescript
useEffect(() => {
  const t = setTimeout(() => setDebouncedQuery(query), 250)
  return () => clearTimeout(t)
}, [query])
```

**AbortController + Server Action pattern** (from `useSearchState.ts` lines 228-253 — D-04 copy verbatim, adapted for `searchCatalogForAddFlow`):
```typescript
useEffect(() => {
  if (debouncedQuery.trim().length < 2) {
    setResults([])
    return
  }
  const cacheKey = debouncedQuery.trim().toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached) {
    setResults(cached)
    return
  }
  const controller = new AbortController()
  setIsLoading(true)
  void (async () => {
    try {
      const res = await searchCatalogForAddFlow({ q: debouncedQuery })
      if (controller.signal.aborted) return
      if (res.success) {
        cache.set(cacheKey, res.data)
        setResults(res.data)
      } else {
        setResults([])
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      if (controller.signal.aborted) return
      setResults([])
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  })()
  return () => controller.abort()
}, [debouncedQuery])
```

**Row visual pattern** (from `WatchSearchRow.tsx` lines 28-70 — mirror exactly, without `<Link>` wrapper, use `Combobox.Item`):
```typescript
// Cover photo circle (WatchSearchRow.tsx:34-46)
<div className="relative size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center shrink-0">
  {result.imageUrl ? (
    <Image src={result.imageUrl} alt="" fill className="object-cover" unoptimized />
  ) : (
    <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
  )}
</div>

// Text block (WatchSearchRow.tsx:47-55)
<div className="flex-1 min-w-0">
  <p className="text-sm font-semibold truncate">
    <HighlightedText text={`${result.brand} ${result.model}`} q={query} />
  </p>
  <p className="text-sm text-muted-foreground truncate">
    {result.reference && (
      <><HighlightedText text={result.reference} q={query} />{' · '}</>
    )}
    {result.ownersCount} collectors
  </p>
</div>

// viewerState pills — spec copy wins over WatchSearchRow "Owned"/"Wishlist"
// (WatchSearchRow.tsx:57-66 — same tokens, different copy per SRCH-19)
{result.viewerState === 'owned' && (
  <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
    In collection
  </span>
)}
{result.viewerState === 'wishlist' && (
  <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
    On wishlist
  </span>
)}
```

**base-ui Combobox wiring** (from RESEARCH.md API Reference — no codebase analog for Combobox; use Accordion wiring from `WatchSearchRowsAccordion.tsx` lines 44-47 as structural reference):
```typescript
// From WatchSearchRowsAccordion.tsx:44-47 (Accordion → adapt to Combobox shape)
const cache = useCatalogSearchCache(viewerUserId)  // same hook-call pattern

// Combobox Root (D-02 controlled query + uncontrolled selection):
<Combobox.Root<SearchCatalogWatchResult>
  inputValue={query}
  onInputValueChange={(val) => setQuery(val)}
  filteredItems={results}
  filter={null}
  itemToStringLabel={(r) => `${r.brand} ${r.model}`}
  itemToStringValue={(r) => r.catalogId}
  onValueChange={(picked) => { if (picked) onPick(picked) }}
  open={forceClose ? false : undefined}
>
```

---

### `src/components/watch/StructuredEntryPanel.tsx` (NEW component)

**Analog 1 (4-field grid):** `src/components/watch/WatchForm.tsx` lines 307-360 (Basic Information block, `grid gap-6 sm:grid-cols-2`)
**Analog 2 (VerdictSkeleton + ExtractErrorCard in-flow):** `src/components/watch/AddWatchFlow.tsx` lines 521-540 + lines 647-660

**Imports pattern** (from `WatchForm.tsx` lines 1-40 + `AddWatchFlow.tsx` lines 1-25):
```typescript
'use client'

import { useState } from 'react'
import { Loader2, Link2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CatalogPhotoUploader } from '@/components/watch/CatalogPhotoUploader'
import { VerdictSkeleton } from '@/components/insights/VerdictSkeleton'
import { ExtractErrorCard, type ExtractErrorCategory } from '@/components/watch/ExtractErrorCard'
import { useStructuredExtractCache } from '@/components/watch/useStructuredExtractCache'
import type { ExtractedWatchData } from '@/lib/extractors/types'
```

**4-field grid layout** (from `WatchForm.tsx` lines 312-360 — mirror structure; D-15 uses `gap-3` not `gap-6`):
```typescript
// WatchForm.tsx:313 uses gap-6 sm:grid-cols-2; StructuredEntryPanel uses gap-3
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <div className="space-y-2">
    <Label htmlFor="se-brand">Brand <span className="text-muted-foreground" aria-hidden>*</span></Label>
    <Input id="se-brand" value={brand} onChange={(e) => setBrand(e.target.value)}
           required aria-required="true" />
  </div>
  <div className="space-y-2">
    <Label htmlFor="se-model">Model <span className="text-muted-foreground" aria-hidden>*</span></Label>
    <Input id="se-model" value={model} onChange={(e) => setModel(e.target.value)}
           required aria-required="true" />
  </div>
  <div className="space-y-2">
    <Label htmlFor="se-reference">Reference</Label>
    <Input id="se-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
  </div>
  <div className="space-y-2">
    <Label htmlFor="se-year">Year</Label>
    <Input id="se-year" type="number" value={year ?? ''}
           onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)} />
  </div>
</div>
```

**VerdictSkeleton in-flow pattern** (from `AddWatchFlow.tsx` lines 521-540):
```typescript
// AddWatchFlow.tsx:535-538 — VerdictSkeleton below loading copy
{state.kind === 'extracting' && (
  ...
  <VerdictSkeleton />
)}

// StructuredEntryPanel version — in-place below "Find specs" button:
{isExtracting && <VerdictSkeleton />}
```

**ExtractErrorCard pattern** (from `AddWatchFlow.tsx` lines 647-660 — with `mode="structured"` added):
```typescript
// AddWatchFlow.tsx:653-660 — existing error card pattern
{state.kind === 'extraction-failed' && (
  <ExtractErrorCard
    category={state.category}
    message={state.reason}
    retryAction={retryAction}
    manualAction={manualAction}
  />
)}

// StructuredEntryPanel version — add mode="structured":
{extractError && !isExtracting && (
  <ExtractErrorCard
    category={extractError}
    mode="structured"
    retryAction={() => setExtractError(null)}
    manualAction={onSwitchToUrl}
  />
)}
```

**Loading CTA pattern** (from `WatchSearchRowsAccordion.tsx` lines 177-183 — Loader2 + disabled pattern):
```typescript
// WatchSearchRowsAccordion.tsx:177-183
{committingId === r.catalogId && committingTarget === 'wishlist' ? (
  <>
    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
    Saving...
  </>
) : 'Add to Wishlist'}

// StructuredEntryPanel "Find specs" version:
{isExtracting ? (
  <>
    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
    Finding specs…
  </>
) : 'Find specs'}
```

---

### `src/components/watch/ExtractErrorCard.tsx` (MODIFY — mode-branched copy)

**Analog:** self (entire file, 133 lines) — minimal retrofit

**Current props interface** (`src/components/watch/ExtractErrorCard.tsx` lines 42-61):
```typescript
export interface ExtractErrorCardProps {
  category: ExtractErrorCategory
  message?: string
  retryAction: () => void
  manualAction: () => void
}
```

**After retrofit** — add `mode?: 'url' | 'structured'` to the props interface, then override body for one row:
```typescript
export interface ExtractErrorCardProps {
  category: ExtractErrorCategory
  mode?: 'url' | 'structured'    // NEW — defaults to 'url' behavior
  message?: string
  retryAction: () => void
  manualAction: () => void
}
```

**Body override in component body** (after line 105 `const { Icon, heading, body } = CONTRACT_BY_CATEGORY[category]`):
```typescript
// Phase 69 — Phase 66 D-06 unlock: one-row mode variant for structured-data-missing.
// CONTRACT_BY_CATEGORY body is LOCKED per D-15 for all other cases and for mode='url'.
const { Icon, heading, body: rawBody } = CONTRACT_BY_CATEGORY[category]
const body =
  category === 'structured-data-missing' && mode === 'structured'
    ? "Couldn't find specs for that watch. Try adding a reference number, or enter manually."
    : rawBody
```

Then replace `{body}` at line 118 with the derived `body` variable.

---

### `src/components/watch/ExtractErrorCard.test.tsx` (MODIFY — extend)

**Analog:** self (entire file, 165 lines) — extend with two new test cases

**Pattern to extend** (from `ExtractErrorCard.test.tsx` lines 47-61 — the `it.each(CASES)` pattern):
```typescript
describe('ExtractErrorCard — category branches (D-14 + D-15 LOCKED)', () => {
  it.each(CASES)(
    'renders %s category with locked heading and body',
    (category, heading, body) => {
      render(
        <ExtractErrorCard
          category={category}
          retryAction={vi.fn()}
          manualAction={vi.fn()}
        />,
      )
      expect(screen.getByText(heading)).toBeInTheDocument()
      expect(screen.getByText(body)).toBeInTheDocument()
    },
  )
})
```

**New describe block to ADD** (mirror the same `it.each` structure):
```typescript
describe('ExtractErrorCard — mode branch (Phase 69, Phase 66 D-06)', () => {
  it('mode="structured" renders structured-mode copy for structured-data-missing', () => {
    render(
      <ExtractErrorCard
        category="structured-data-missing"
        mode="structured"
        retryAction={vi.fn()}
        manualAction={vi.fn()}
      />,
    )
    expect(screen.getByText(
      "Couldn't find specs for that watch. Try adding a reference number, or enter manually."
    )).toBeInTheDocument()
  })

  it('mode="url" (explicit) preserves D-15 LOCKED URL-mode body for structured-data-missing', () => {
    render(
      <ExtractErrorCard
        category="structured-data-missing"
        mode="url"
        retryAction={vi.fn()}
        manualAction={vi.fn()}
      />,
    )
    expect(screen.getByText(
      "Couldn't find watch info on this page. Try the original product page or enter manually."
    )).toBeInTheDocument()
  })

  it('mode="structured" does NOT change body for other categories (only structured-data-missing varies)', () => {
    render(
      <ExtractErrorCard
        category="host-403"
        mode="structured"
        retryAction={vi.fn()}
        manualAction={vi.fn()}
      />,
    )
    // Phase 25 D-15 LOCKED copy — unchanged in structured mode:
    expect(screen.getByText(
      "This site doesn't allow data extraction. Try entering manually."
    )).toBeInTheDocument()
  })
})
```

---

### `src/data/catalog.ts` (MODIFY — new DAL fn)

**Analog:** `src/data/catalog.ts` lines 662-673 (`getTopStyleTags`) — same file, different fn shape

**Existing analog** (lines 647-673):
```typescript
// Phase 40 D-06: getTopStyleTags — cached top-N style tag vocabulary
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

**New fn to ADD** (at end of DAL — D-13: NO `'use cache'`, plain Drizzle ORM, per-request SSR fetch):
```typescript
// Phase 69 D-13: listCatalogBrands — SSR-fetched brand list for parseSearchQuery pre-seed.
// No 'use cache' / cacheLife — brand list is fetched per-request at /watch/new SSR.
// Staleness is navigation-cadence; cheap SELECT DISTINCT (~100 rows).
// Public-read RLS on watches_catalog already allows this without viewer identity.
export async function listCatalogBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: watchesCatalog.brand })
    .from(watchesCatalog)
    .orderBy(asc(watchesCatalog.brand))
  return rows.map((r) => r.brand)
}
```

**Imports to add:** `asc` from `drizzle-orm` (check if already imported; add if not). `watchesCatalog` is already imported in `catalog.ts`.

---

### `src/app/watch/new/page.tsx` (MODIFY — prop addition)

**Analog:** self (`src/app/watch/new/page.tsx` lines 90-94 + 121-131)

**Current Promise.all** (lines 90-94):
```typescript
const [collection, catalogPrefill, viewerProfile] = await Promise.all([
  getWatchesByUser(user.id),
  catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
  getProfileById(user.id),
])
```

**After retrofit** (extend to 4-destructure):
```typescript
const [collection, catalogPrefill, viewerProfile, catalogBrands] = await Promise.all([
  getWatchesByUser(user.id),
  catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
  getProfileById(user.id),
  listCatalogBrands(),    // NEW — Phase 69 D-13; cheap SELECT DISTINCT ~100 rows
])
```

**Current AddWatchFlow JSX** (lines 121-131):
```typescript
<AddWatchFlow
  collectionRevision={collection.length}
  initialCatalogId={catalogId}
  ...
  viewerUserId={user.id}
/>
```

**After retrofit** (add `catalogBrands` alongside `viewerUserId`):
```typescript
<AddWatchFlow
  collectionRevision={collection.length}
  ...
  viewerUserId={user.id}
  catalogBrands={catalogBrands}    // NEW — Phase 69 D-13
/>
```

**Import to add:** `listCatalogBrands` from `@/data/catalog` at the top of the file.

---

### `src/components/watch/AddWatchFlow.tsx` (MODIFY — props + cache call sites)

**Analog:** self (lines 52-85 props interface; lines 123, 127 cache call sites)

**Current `AddWatchFlowProps`** (lines 52-85) — excerpt showing last field before adding:
```typescript
interface AddWatchFlowProps {
  ...
  /**
   * WR-03 fix: viewer's user id resolved server-side ...
   */
  viewerUserId: string
}
```

**After retrofit** — add `catalogBrands: string[]` as a new required prop alongside `viewerUserId`:
```typescript
interface AddWatchFlowProps {
  ...
  viewerUserId: string
  /** Phase 69 D-13: catalog brand list SSR-fetched by /watch/new.
   *  Prop-drilled to SearchEntry → parseSearchQuery for SRCH-26 pre-seed.
   *  Empty array is a safe default (parseSearchQuery falls back to naive split). */
  catalogBrands: string[]   // NEW
}
```

**Cache call sites to update** (lines 123, 127):
```typescript
// Line 123 — BEFORE:
const cache = useWatchSearchVerdictCache(collectionRevision)
// Line 123 — AFTER:
const cache = useWatchSearchVerdictCache(collectionRevision, viewerUserId)

// Line 127 — BEFORE:
const urlCache = useUrlExtractCache()
// Line 127 — AFTER:
const urlCache = useUrlExtractCache(viewerUserId)
```

---

### `src/components/search/WatchSearchRowsAccordion.tsx` (MODIFY — viewerUserId prop)

**Analog:** self (lines 31-47)

**Current props** (lines 31-43):
```typescript
export function WatchSearchRowsAccordion({
  results,
  q,
  collectionRevision,
  viewerUsername,
}: {
  results: SearchCatalogWatchResult[]
  q: string
  collectionRevision: number
  viewerUsername: string | null
}) {
```

**After retrofit** — add `viewerUserId: string` as a required prop:
```typescript
export function WatchSearchRowsAccordion({
  results,
  q,
  collectionRevision,
  viewerUsername,
  viewerUserId,           // NEW — required, threads to verdict cache
}: {
  results: SearchCatalogWatchResult[]
  q: string
  collectionRevision: number
  viewerUsername: string | null
  viewerUserId: string    // NEW
}) {
```

**Cache call site** (line 47 — already shown in CONTEXT.md):
```typescript
// BEFORE:
const cache = useWatchSearchVerdictCache(collectionRevision)
// AFTER:
const cache = useWatchSearchVerdictCache(collectionRevision, viewerUserId)
```

---

### `src/components/search/SearchPageClient.tsx` (MODIFY — 3-layer thread)

**Analog:** self (lines 317-350 `WatchesPanel` function; lines 189-201 call site; lines 455-461 `WatchSearchRowsAccordion` call inside `WatchesPanel`)

**Layer 1 — `WatchesPanel` props interface** (lines 317-348): add `viewerId: string` to the existing destructure and type block:
```typescript
// BEFORE (line 317-348 excerpt):
function WatchesPanel({
  q,
  results,
  ...
  onClearEra,
}: {
  ...
  onClearEra: () => void
}) {

// AFTER: add viewerId:
function WatchesPanel({
  q,
  results,
  ...
  onClearEra,
  viewerId,              // NEW
}: {
  ...
  onClearEra: () => void
  viewerId: string       // NEW — threaded from SearchPageClient.viewerId
}) {
```

**Layer 2 — `WatchesPanel` call site** (lines 189-201): `SearchPageClient` already has `viewerId` in its own props (line 31 of `SearchPageClientProps`); pass it through:
```typescript
// BEFORE (line 189-201):
<WatchesPanel
  q={trimmed}
  results={watchesResults}
  ...
  onClearEra={() => setEra(null)}
/>

// AFTER: add viewerId prop:
<WatchesPanel
  q={trimmed}
  results={watchesResults}
  ...
  onClearEra={() => setEra(null)}
  viewerId={viewerId}     // NEW — already in SearchPageClient props
/>
```

**Layer 3 — `WatchSearchRowsAccordion` call inside `WatchesPanel`** (lines 455-461):
```typescript
// BEFORE:
<WatchSearchRowsAccordion
  results={results}
  q={q}
  collectionRevision={collectionRevision}
  viewerUsername={viewerUsername}
/>

// AFTER: add viewerUserId (note: prop is viewerUserId on Accordion, viewerId on WatchesPanel):
<WatchSearchRowsAccordion
  results={results}
  q={q}
  collectionRevision={collectionRevision}
  viewerUsername={viewerUsername}
  viewerUserId={viewerId}    // NEW — maps WatchesPanel.viewerId → Accordion.viewerUserId
/>
```

---

### `src/lib/searchEntry/parseSearchQuery.ts` (NEW pure helper — no codebase analog)

**Analog:** none (net-new pattern)

**Closest structural reference (string-transform shape):** `src/components/watch/AddWatchFlow.tsx` lines 681-706 (`extractedToPartialWatch` pure function — same file-level pure helper pattern, camelCase file, no `'use client'`, exported named function).

**Export shape** (from CONTEXT.md D-12 + RESEARCH.md Parser section):
```typescript
// src/lib/searchEntry/parseSearchQuery.ts
// NO 'use client' directive — pure function, no React imports

export function parseSearchQuery(
  query: string,
  catalogBrands: string[],
): { brand: string; model: string; reference: string } {
  // 1. Normalize query: trim + collapse whitespace + lowercase
  // 2. Normalize each catalogBrand: same
  // 3. Sort catalog brands by normalized length DESC
  // 4. Find first brand that is a whitespace-bounded prefix of normalized query
  // 5. On hit: brand = original-case catalog value; split remainder into model + reference
  // 6. On miss: naive split (first token = brand, last digit-bearing = reference, middle = model)
  // 7. year is always empty (not returned — caller adds from year field)
}
```

**Algorithm specifics** (from CONTEXT.md D-12):
- "Whitespace-bounded prefix" means the matched brand (normalized) is followed by whitespace OR end-of-string in the normalized query
- Original-case preservation: when a brand matches, return `catalogBrands[matchedIndex]` (original casing), not the user's input
- On miss: naive — first token is brand (user's casing), last token with a digit is reference, middle is model
- Empty query returns `{ brand: '', model: '', reference: '' }`

---

### `src/lib/searchEntry/parseSearchQuery.test.ts` (NEW test — pure unit)

**Analog:** `src/components/watch/ExtractErrorCard.test.tsx` lines 19-45 (`CASES` array + `it.each` pattern)

**Test structure to mirror:**
```typescript
// ExtractErrorCard.test.tsx:11 — import structure
import { describe, it, expect } from 'vitest'
// (no render/screen — pure function tests use no @testing-library/react)

import { parseSearchQuery } from '@/lib/searchEntry/parseSearchQuery'
```

**it.each pattern** (from `ExtractErrorCard.test.tsx` lines 47-61 — adapt to tuple shape):
```typescript
const BRANDS = ['Omega', 'Tag Heuer', 'Rolex', 'A. Lange & Söhne']

const CASES: Array<[string, string, string, string, string[]]> = [
  // [description, query, expectedBrand, expectedModel, expectedReference, brands]
  // Use a 5-tuple or separate it() calls per D-12's 6+2 canonical cases
]

it.each(CASES)('%s', (_, query, brand, model, reference) => {
  const result = parseSearchQuery(query, BRANDS)
  expect(result.brand).toBe(brand)
  expect(result.model).toBe(model)
  expect(result.reference).toBe(reference)
})
```

**6 canonical test cases** (from CONTEXT.md D-12 + RESEARCH.md Parser Test Matrix):
1. `"omega speedmaster 3135"` → `{ brand: 'Omega', model: 'Speedmaster', reference: '3135' }`
2. `"tag heuer monaco 1133b"` → `{ brand: 'Tag Heuer', model: 'Monaco', reference: '1133b' }` (multi-word brand)
3. `"rolex datejust"` → `{ brand: 'Rolex', model: 'Datejust', reference: '' }`
4. `"omega"` → `{ brand: 'Omega', model: '', reference: '' }`
5. `"cartier 4329xx"` (not in brands list) → `{ brand: 'cartier', model: '', reference: '4329xx' }` (naive fallback)
6. `"speedmaster"` alone → `{ brand: 'speedmaster', model: '', reference: '' }` (no prefix match)
7. `""` (empty) → `{ brand: '', model: '', reference: '' }`
8. Multi-word brand length-DESC sort: when both `"Tag"` and `"Tag Heuer"` are in the list, `"tag heuer monaco"` must produce `brand='Tag Heuer'` not `brand='Tag'`

---

### `src/components/watch/AddWatchFlow.test.tsx` (MODIFY — cache-hygiene describe block)

**Analog:** self (lines 63-72 — existing `beforeEach` cache-reset pattern)

**Existing pattern to extend** (lines 63-72):
```typescript
beforeEach(async () => {
  vi.clearAllMocks()
  global.fetch = vi.fn() as unknown as typeof fetch
  const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
  __resetUrlExtractCacheForTests()
})
```

**New describe block to ADD** (from RESEARCH.md Integration Test Extension section):
```typescript
describe('Phase 69 — cache hygiene integration (CLNP-07)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
    const { __resetVerdictCacheForTests } = await import('@/components/search/useWatchSearchVerdictCache')
    const { __resetCatalogSearchCacheForTests } = await import('./useCatalogSearchCache')
    const { __resetStructuredExtractCacheForTests } = await import('./useStructuredExtractCache')
    __resetUrlExtractCacheForTests()
    __resetVerdictCacheForTests()
    __resetCatalogSearchCacheForTests()
    __resetStructuredExtractCacheForTests()
  })

  it('switching viewerUserId clears all 4 caches — no stale entry surfaces after rerender', async () => {
    // Seed caches for user 'a' (render <AddWatchFlow viewerUserId='a' catalogBrands={[]} ...>)
    // Re-render with viewerUserId='b'
    // Assert all 4 cache.get(key) === undefined after the rerender
  })
})
```

**Important:** All existing `render(<AddWatchFlow ...>)` calls in the file need `catalogBrands={[]}` added once `catalogBrands: string[]` is added to `AddWatchFlowProps`. Check all call sites in the file before adding the new describe block.

---

### `src/components/watch/SearchEntry.test.tsx` (NEW test)

**Analog:** `src/components/watch/ConfirmStep.test.tsx` lines 1-60 (mock setup + BASE_PROPS pattern + describe structure)

**Mock pattern** (from `ConfirmStep.test.tsx` lines 33-35):
```typescript
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))
```

**Additional mocks needed for SearchEntry:**
```typescript
vi.mock('@/app/actions/search', () => ({
  searchCatalogForAddFlow: vi.fn(),
}))
vi.mock('@/components/watch/useCatalogSearchCache', () => ({
  useCatalogSearchCache: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))
```

**Test scope (SRCH-18, SRCH-20, SRCH-22 from RESEARCH.md):**
- SRCH-18: debounce fires after 250ms (use `vi.useFakeTimers()` + `vi.advanceTimersByTime(250)`)
- SRCH-20: ARIA roles — query for `role="combobox"` on input; `role="option"` on items (base-ui provides automatically)
- SRCH-22: `HighlightedText` renders inside result rows

---

### `src/components/watch/StructuredEntryPanel.test.tsx` (NEW test)

**Analog:** `src/components/watch/ConfirmStep.test.tsx` lines 1-60 (mock setup + BASE_PROPS + describe structure)

**Test scope (EXTR-05 from RESEARCH.md):**
- EXTR-05: `<VerdictSkeleton>` renders during extract round-trip (mock `fetch` to hang; assert skeleton present)
- D-16: CatalogPhotoUploader always-rendered (assert present on mount without user interaction)
- Button disabled when brand or model empty; enabled when both have values

---

### `src/components/watch/useCatalogSearchCache.test.ts` (NEW test)

**Analog:** `src/components/watch/AddWatchFlow.test.tsx` lines 63-72 (`__resetUrlExtractCacheForTests` import + reset pattern)

**Core test shape** (D-09 pattern — render hook, switch userId, assert cache cleared):
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useCatalogSearchCache,
  __resetCatalogSearchCacheForTests,
} from '@/components/watch/useCatalogSearchCache'

beforeEach(() => {
  __resetCatalogSearchCacheForTests()
})

describe('useCatalogSearchCache — CLNP-07 user-switch invalidation', () => {
  it('set() then get() returns the cached entry for the same user', () => { ... })
  it('switching viewerUserId clears the cache — get() returns undefined', () => {
    const { rerender } = renderHook(({ uid }) => useCatalogSearchCache(uid), {
      initialProps: { uid: 'user-a' },
    })
    const cacheA = useCatalogSearchCache('user-a')
    cacheA.set('omega speedmaster', [])
    rerender({ uid: 'user-b' })
    expect(useCatalogSearchCache('user-b').get('omega speedmaster')).toBeUndefined()
  })
})
```

---

### `src/components/watch/useStructuredExtractCache.test.ts` (NEW test)

**Analog:** same as `useCatalogSearchCache.test.ts` above — identical structure, different hook import + D-18 JSON key format

```typescript
import { useStructuredExtractCache, __resetStructuredExtractCacheForTests } from '@/components/watch/useStructuredExtractCache'

// Cache key shape per D-18:
const key = JSON.stringify({ brand: 'omega', model: 'speedmaster', reference: '3135', year: null })
```

---

### `src/components/watch/useUrlExtractCache.test.ts` (NEW — verify file doesn't already exist)

**Status:** File does NOT exist at this path. Create it.

**Analog:** `src/components/watch/AddWatchFlow.test.tsx` lines 63-72 (existing `__resetUrlExtractCacheForTests` usage pattern — same import dance)

**Core test cases:**
- User-switch clears cache: same `renderHook` pattern as `useCatalogSearchCache.test.ts`
- Stale-write guard: set from user-a, switch to user-b mid-render, attempt set from stale closure — assert user-b cache is empty

---

### `src/components/search/useWatchSearchVerdictCache.test.ts` (NEW — verify file doesn't already exist)

**Status:** File does NOT exist at this path. Create it.

**Analog:** `src/components/watch/AddWatchFlow.test.tsx` lines 63-72 (existing `__resetVerdictCacheForTests` usage pattern)

**Core test cases:**
- User-switch resets both `moduleUserId` AND `moduleRevision` (inner guard fires on next revision check)
- Existing revision-change behavior is PRESERVED (switching revision still clears cache for same user)
- User-switch then revision-change: both guards fire in sequence correctly

---

## Shared Patterns

### Module-scope Map Cache Shape
**Source:** `src/components/watch/useUrlExtractCache.ts` (entire file, 51 lines)
**Apply to:** `useCatalogSearchCache.ts`, `useStructuredExtractCache.ts`, and both retrofit hooks

Core invariants all 4 caches share:
```typescript
// 3 module-level variables (verdict cache has 2; new caches have 2 each)
let moduleCache: Map<K, V> = new Map()
let moduleUserId = ''    // Phase 69 addition (all 4 caches)
// let moduleRevision = 0  // verdict cache only

// __resetForTests always resets ALL module vars
export function __reset___ForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''
}

// In-render reset at top of hook body — BEFORE any read:
if (moduleUserId !== viewerUserId) {
  moduleCache = new Map()
  moduleUserId = viewerUserId
}
```

### In-Render Module Reset (D-06 mechanism)
**Source:** `src/components/search/useWatchSearchVerdictCache.ts` lines 39-45
**Apply to:** All 4 cache hooks
```typescript
// Intentional sync mutation in render (NOT setState) —
// module state has no React-tracked subscribers, so this is a
// deterministic same-render reset.
if (moduleUserId !== viewerUserId) {
  moduleCache = new Map()
  moduleUserId = viewerUserId
}
```

### Stale-Write Guard
**Source:** `src/components/search/useWatchSearchVerdictCache.ts` lines 51-54
**Apply to:** `useCatalogSearchCache.ts`, `useStructuredExtractCache.ts`, `useUrlExtractCache.ts` (retrofit)
```typescript
set: (key, value) => {
  if (moduleUserId !== viewerUserId) return  // stale-write guard
  moduleCache.set(key, value)
},
```

### base-ui Import Pattern
**Source:** `src/components/search/WatchSearchRowsAccordion.tsx` lines 5-6
**Apply to:** `SearchEntry.tsx`
```typescript
import { Accordion } from '@base-ui/react/accordion'   // existing pattern
// → SearchEntry uses:
import { Combobox } from '@base-ui/react/combobox'
```

### `'use client'` + named export component
**Source:** `src/components/watch/ExtractErrorCard.tsx` lines 1 + 99
**Apply to:** `SearchEntry.tsx`, `StructuredEntryPanel.tsx`
```typescript
'use client'
// ... imports ...
export function ComponentName({ ...props }: Props) { ... }
```

### Required asterisk + `aria-hidden` pattern
**Source:** `src/components/watch/WatchForm.tsx` line 315
**Apply to:** `StructuredEntryPanel.tsx` brand and model labels
```typescript
<Label htmlFor="brand">Brand *</Label>  // WatchForm.tsx
// StructuredEntryPanel version:
<Label htmlFor="se-brand">Brand <span className="text-muted-foreground" aria-hidden>*</span></Label>
// (aria-hidden on asterisk because required is communicated via aria-required on the Input)
```

### Drizzle `selectDistinct` DAL pattern
**Source:** `src/data/catalog.ts` lines 662-673 (`getTopStyleTags` — raw sql version)
**Apply to:** `listCatalogBrands()` in `src/data/catalog.ts` (ORM version, no `'use cache'`)
```typescript
// getTopStyleTags uses raw sql — listCatalogBrands uses Drizzle ORM:
const rows = await db
  .selectDistinct({ brand: watchesCatalog.brand })
  .from(watchesCatalog)
  .orderBy(asc(watchesCatalog.brand))
return rows.map((r) => r.brand)
```

### `Promise.all` SSR fetch extension
**Source:** `src/app/watch/new/page.tsx` lines 90-94
**Apply to:** `src/app/watch/new/page.tsx` itself (D-13 retrofit)
```typescript
// Extend from 3-destructure to 4-destructure:
const [collection, catalogPrefill, viewerProfile, catalogBrands] = await Promise.all([...])
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/searchEntry/parseSearchQuery.ts` | pure helper | transform | No pure string-parsing helpers exist in `src/lib/`; all lib files are either hooks, type definitions, or algorithm engines (similarity scoring). The file-level structure mirrors `extractedToPartialWatch` in `AddWatchFlow.tsx` (file-level pure function, camelCase, no React), but the parsing algorithm itself is net-new. |

---

## Metadata

**Analog search scope:** `src/components/watch/`, `src/components/search/`, `src/data/`, `src/app/watch/new/`, `src/lib/`
**Files scanned:** 14 source files read in full
**Pattern extraction date:** 2026-05-28

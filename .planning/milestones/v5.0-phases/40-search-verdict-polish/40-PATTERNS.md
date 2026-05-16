# Phase 40: Search & Verdict Polish — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 17 (9 modified, 8 new)
**Analogs found:** 17 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/data/catalog.ts` | DAL / service | CRUD (read) | `src/data/catalog.ts` (itself, `searchCatalogWatches`) | self |
| `src/app/actions/search.ts` | server action | request-response | `src/app/actions/search.ts` (itself, `searchPeopleAction`) | self |
| `src/components/search/useSearchState.ts` | hook | event-driven | `src/components/search/useSearchState.ts` (itself) | self |
| `src/components/search/SearchPageClient.tsx` | component | request-response | `src/components/search/SearchPageClient.tsx` (itself, `WatchesPanel`) | self |
| `src/app/search/page.tsx` | page (Server Component) | request-response | `src/app/search/page.tsx` (itself) | self |
| `src/components/insights/CollectionFitCard.tsx` | component (pure renderer) | request-response | `src/components/insights/CollectionFitCard.tsx` (itself) | self |
| `src/lib/verdict/types.ts` | type module | — | `src/lib/verdict/types.ts` (itself) | self |
| `src/lib/verdict/composer.ts` | service (pure) | transform | `src/lib/verdict/composer.ts` (itself) | self |
| `.planning/REQUIREMENTS.md` | docs | — | — | paperwork only |
| `src/components/search/FilterSheet.tsx` (NEW) | component | event-driven | `src/components/ui/sheet.tsx` + `src/components/search/SearchPageClient.tsx` | role-match |
| `src/components/search/MovementChips.tsx` (NEW) | component | event-driven | `src/components/search/SearchPageClient.tsx` chip-button pattern | partial |
| `src/components/search/CaseSizeChips.tsx` (NEW) | component | event-driven | `src/components/search/MovementChips.tsx` (sibling, same pattern) | exact |
| `src/components/search/StyleChips.tsx` (NEW) | component | event-driven | `src/components/search/MovementChips.tsx` (sibling, same pattern) | exact |
| `src/components/insights/CollectionFitCompareTable.tsx` (NEW) | component (pure renderer) | transform | `src/components/insights/CollectionFitCard.tsx` | role-match |
| `src/lib/verdict/fit-delta.ts` (NEW) | utility (pure) | transform | `src/lib/verdict/composer.ts` candidateTaste block | partial |
| `tests/static/search-dal.movement-type.test.ts` (NEW) | test (static) | — | `tests/static/CollectionFitCard.no-engine.test.ts` | exact |
| `tests/unit/lib/verdict/fit-delta.test.ts` (NEW) | test (unit) | — | `tests/actions/search.test.ts` (vitest unit pattern) | role-match |

---

## Pattern Assignments

### `src/data/catalog.ts` — extend `searchCatalogWatches` + add `getTopStyleTags`

**Analog:** `src/data/catalog.ts` — the existing `searchCatalogWatches` function (lines 293–389).

**Imports pattern to add** — current imports at line 6; add 3 operators:
```typescript
// Current line 6:
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
// Change to:
import { and, arrayOverlaps, asc, between, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'
```

**Caching import to add** (for `getTopStyleTags`):
```typescript
import { cacheLife } from 'next/cache'
```

**DAL signature extension pattern** (modify lines 293–303):
```typescript
// Add optional second param; current signature:
export async function searchCatalogWatches({
  q,
  viewerId,
  limit = SEARCH_WATCHES_DEFAULT_LIMIT,
}: {
  q: string
  viewerId: string
  limit?: number
}): Promise<SearchCatalogWatchResult[]>
// Extend to:
export async function searchCatalogWatches({
  q,
  viewerId,
  limit = SEARCH_WATCHES_DEFAULT_LIMIT,
  filters,
}: {
  q: string
  viewerId: string
  limit?: number
  filters?: CatalogSearchFilters
}): Promise<SearchCatalogWatchResult[]>
```

**Browse-mode guard pattern** — replace the early-return at line 303:
```typescript
// Current (line 303):
if (trimmed.length < SEARCH_WATCHES_TRIM_MIN_LEN) return []
// Replace with:
const hasActiveFacet = !!(filters?.movement || filters?.size || filters?.style?.length)
if (trimmed.length < SEARCH_WATCHES_TRIM_MIN_LEN && !hasActiveFacet) return []
```

**Predicate composition pattern** — replace the `.where(or(...))` block (lines 327–336):
```typescript
const predicates: ReturnType<typeof and>[] = []

if (trimmed.length >= SEARCH_WATCHES_TRIM_MIN_LEN) {
  predicates.push(
    or(
      ilike(watchesCatalog.brandNormalized, pattern),
      ilike(watchesCatalog.modelNormalized, pattern),
      refPattern ? ilike(watchesCatalog.referenceNormalized, refPattern) : sql`false`,
    )!,
  )
}

if (filters?.movement) {
  predicates.push(isNotNull(watchesCatalog.movementType)!)  // D-08 NULL exclusion
  predicates.push(eq(watchesCatalog.movementType, filters.movement)!)
}

if (filters?.size) {
  const [min, max] = SIZE_BAND_MAP[filters.size]
  predicates.push(isNotNull(watchesCatalog.caseSizeMm)!)
  predicates.push(between(watchesCatalog.caseSizeMm, min, max)!)
}

if (filters?.style?.length) {
  predicates.push(arrayOverlaps(watchesCatalog.styleTags, filters.style)!)
}

.where(predicates.length > 0 ? and(...predicates) : undefined)
```

**New supporting types + constants to add** (before `searchCatalogWatches`):
```typescript
export interface CatalogSearchFilters {
  movement?: 'auto' | 'manual' | 'quartz' | 'spring_drive'
  size?: 'lt36' | '36-39' | '40-42' | '43-45' | '46plus'
  style?: string[]
}

const SIZE_BAND_MAP: Record<string, [number, number]> = {
  'lt36':   [0, 35.9],
  '36-39':  [36, 39],
  '40-42':  [40, 42],
  '43-45':  [43, 45],
  '46plus': [46, 999],
}
```

**New `getTopStyleTags` function** — add after `searchCatalogWatches`:
```typescript
// Phase 40 D-06 — top-N distinct style tags by catalog frequency.
// 'use cache' directive + cacheLife('hours') — appropriate for catalog metadata
// that changes only on enrichment runs. Threaded as styleVocab prop from
// /search Server Component into SearchPageClient.
export async function getTopStyleTags(limit = 8): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT tag, COUNT(*) AS freq
        FROM watches_catalog, unnest(style_tags) AS tag
        GROUP BY tag
        ORDER BY freq DESC
        LIMIT ${limit}`
  )
  return (rows as Array<{ tag: string }>).map((r) => r.tag)
}
```

**Numeric coercion pattern** (for reference — existing at `src/data/watches.ts:154–161`):
```typescript
// Canonical coercion pattern for postgres-js numeric() string returns:
formality: taste.formality !== null ? Number(taste.formality) : null,
sportiness: taste.sportiness !== null ? Number(taste.sportiness) : null,
heritageScore: taste.heritageScore !== null ? Number(taste.heritageScore) : null,
confidence: taste.confidence !== null ? Number(taste.confidence) : null,
```

---

### `src/app/actions/search.ts` — extend `searchWatchesAction` Zod schema

**Analog:** `src/app/actions/search.ts` lines 1–107 (the file itself).

**Current schema** (lines 18–22):
```typescript
const searchSchema = z
  .object({
    q: z.string().max(200),
  })
  .strict()
```

**Extended schema** — add optional facet fields, preserve `.strict()`:
```typescript
const searchSchema = z
  .object({
    q: z.string().max(200),
    movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional(),
    size: z.enum(['lt36', '36-39', '40-42', '43-45', '46plus']).optional(),
    style: z.string().max(500).optional(), // comma-joined; DAL splits
  })
  .strict()
```

**Pass filters to DAL** — modify `searchWatchesAction` body (lines 97–101):
```typescript
const results = await searchCatalogWatches({
  q: parsed.data.q,
  viewerId: user.id,
  limit: 20,
  filters: {
    movement: parsed.data.movement,
    size: parsed.data.size,
    style: parsed.data.style?.split(',').filter(Boolean),
  },
})
```

**Error handling pattern** — unchanged; copy from lines 103–106:
```typescript
} catch (err) {
  console.error('[searchWatchesAction] unexpected error:', err)
  return { success: false, error: "Couldn't run search." }
}
```

---

### `src/components/search/useSearchState.ts` — add facet state + URL sync

**Analog:** `src/components/search/useSearchState.ts` lines 1–261 (the file itself).

**New state slices** — add after line 77 (`setTabState`):
```typescript
// Phase 40 SRCH-16 facet state — initialized from URL on mount (D-03/D-04).
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

**URL sync extension** — modify effect 2 (lines 99–105) to include facet params:
```typescript
useEffect(() => {
  const params = new URLSearchParams()
  if (debouncedQ.trim().length >= CLIENT_MIN_CHARS) params.set('q', debouncedQ)
  if (tab !== 'all') params.set('tab', tab)
  // Phase 40: facet params written unconditionally (D-04 — survive tab switches)
  if (movement) params.set('movement', movement)
  if (size) params.set('size', size)
  if (styleArr.length) params.set('style', styleArr.join(','))
  const qs = params.toString()
  router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
}, [debouncedQ, tab, movement, size, styleArr, router])
```

**Browse-mode guard + dep array** — modify the Watches sub-effect (3b) — existing guard at line 160:
```typescript
// Replace:
if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
// With:
const hasActiveFacet = !!(movement || size || styleArr.length)
if (debouncedQ.trim().length < CLIENT_MIN_CHARS && !hasActiveFacet) {
```

Add facet state to dep array (line 193) — replace `[debouncedQ, tab]`:
```typescript
// Replace dep array [debouncedQ, tab] with:
}, [debouncedQ, tab, movement, size, styleArr])
```

Pass facets to action call (line 173):
```typescript
// Replace:
const res = await searchWatchesAction({ q: debouncedQ })
// With:
const res = await searchWatchesAction({
  q: debouncedQ,
  movement: movement ?? undefined,
  size: size ?? undefined,
  style: styleArr.length ? styleArr.join(',') : undefined,
})
```

**Return shape extension** — add to the returned object:
```typescript
movement,
setMovement,
size,
setSize,
styleArr,
setStyleArr,
```

**AbortController:** No changes — existing pattern at line 167 (`const controller = new AbortController()`) + cleanup at line 192 (`return () => controller.abort()`) covers the extended dep array automatically.

---

### `src/app/search/page.tsx` — thread `styleVocab` prop

**Analog:** `src/app/search/page.tsx` lines 29–60 (the file itself).

**Promise.all extension** (lines 42–45):
```typescript
// Current:
const [viewerCollection, viewerProfile] = await Promise.all([
  getWatchesByUser(user.id),
  getProfileById(user.id),
])
// Extend:
const [viewerCollection, viewerProfile, styleVocab] = await Promise.all([
  getWatchesByUser(user.id),
  getProfileById(user.id),
  getTopStyleTags(8),
])
```

**Import addition**:
```typescript
import { getTopStyleTags } from '@/data/catalog'
```

**Prop threading** (lines 49–53):
```typescript
<SearchPageClient
  viewerId={user.id}
  collectionRevision={viewerCollection.length}
  viewerUsername={viewerUsername}
  styleVocab={styleVocab}   // ADD
>
```

---

### `src/components/search/SearchPageClient.tsx` — mount Filter button + Sheet

**Analog:** `src/components/search/SearchPageClient.tsx` lines 247–316 (`WatchesPanel`).

**Imports to add**:
```typescript
import { SlidersHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WatchFacetSheet } from '@/components/search/FilterSheet'
import { useState } from 'react'
```

**Filter button row** — insert above `<WatchSearchRowsAccordion>` in the Watches tab content block (not inside `WatchesPanel` — see CONTEXT.md Q2):
```typescript
// Sheet open state lives in SearchPageClient (pure UI, not URL-dependent)
const [sheetOpen, setSheetOpen] = useState(false)
const activeCount = [movement, size].filter(Boolean).length + styleArr.length

// Render above WatchesPanel:
<div className="flex items-center gap-2 py-3">
  <Button
    variant="outline"
    size="sm"
    className="min-h-11 gap-1.5"
    onClick={() => setSheetOpen(true)}
    aria-expanded={sheetOpen}
  >
    <SlidersHorizontalIcon className="size-3.5" aria-hidden />
    {activeCount > 0 ? `Filter (${activeCount})` : 'Filter'}
  </Button>
</div>

<WatchFacetSheet
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  movement={movement}
  size={size}
  styleArr={styleArr}
  onMovementChange={setMovement}
  onSizeChange={setSize}
  onStyleChange={setStyleArr}
  styleVocab={styleVocab}
/>
```

**Empty-state copy guard** — modify `WatchesPanel` pre-query state at line 275:
```typescript
// Replace:
if (q.length < CLIENT_MIN_CHARS) {
// With:
const hasActiveFacet = !!(movement || size || styleArr.length)
if (q.length < CLIENT_MIN_CHARS && !hasActiveFacet) {
  // existing pre-query copy unchanged
}
// Add browse-mode empty state:
if (q.length < CLIENT_MIN_CHARS && hasActiveFacet && results.length === 0) {
  return (
    <section className="space-y-1">
      <h2 className="text-xl font-semibold leading-tight text-foreground">
        No watches match these filters.
      </h2>
      <p className="text-sm text-muted-foreground">Try removing one.</p>
    </section>
  )
}
```

---

### `src/components/search/FilterSheet.tsx` (NEW)

**Analog:** `src/components/ui/sheet.tsx` (Sheet primitive) + `src/components/search/SearchPageClient.tsx` (WatchesPanel component structure).

**Core component pattern** — imports from the Sheet primitive:
```typescript
'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MovementChips } from '@/components/search/MovementChips'
import { CaseSizeChips } from '@/components/search/CaseSizeChips'
import { StyleChips } from '@/components/search/StyleChips'
```

**Sheet structure** (per UI-SPEC lines 218–250):
```typescript
export function WatchFacetSheet({ open, onOpenChange, movement, size, styleArr,
  onMovementChange, onSizeChange, onStyleChange, styleVocab }: WatchFacetSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[80vh] overflow-y-auto pb-safe"
      >
        {/* Drag handle — standard mobile bottom-sheet affordance */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30 shrink-0" />

        <SheetHeader className="pt-2">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-2">
          <MovementChips selected={movement} onSelect={onMovementChange} />
          <CaseSizeChips selected={size} onSelect={onSizeChange} />
          <StyleChips selected={styleArr} onSelect={onStyleChange} vocab={styleVocab} />
        </div>

        <SheetFooter className="border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive w-full"
            onClick={() => {
              onMovementChange(null)
              onSizeChange(null)
              onStyleChange([])
            }}
          >
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

**`side="bottom"` CSS chain** — already handled by `SheetContent` at `src/components/ui/sheet.tsx:56`:
```
data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto
data-[side=bottom]:border-t data-[side=bottom]:data-starting-style:translate-y-[2.5rem]
data-[side=bottom]:data-ending-style:translate-y-[2.5rem]
```

---

### `src/components/search/MovementChips.tsx` (NEW)

**Analog:** `src/components/search/SearchPageClient.tsx` — button patterns (tab controls); `src/components/ui/badge.tsx` chip rendering; UI-SPEC §Chip Groups (lines 258–291).

**No dedicated analog exists.** Use the chip button pattern from UI-SPEC and `cn()` from `src/lib/utils.ts`.

**Core pattern** — single-select chip group:
```typescript
'use client'

import { cn } from '@/lib/utils'

const MOVEMENT_OPTIONS = [
  { label: 'Automatic', value: 'auto' },
  { label: 'Manual Wind', value: 'manual' },
  { label: 'Quartz', value: 'quartz' },
  { label: 'Spring Drive', value: 'spring_drive' },
] as const

interface MovementChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
}

export function MovementChips({ selected, onSelect }: MovementChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Movement Type</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Movement Type">
        {MOVEMENT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-accent text-accent-foreground border-accent font-semibold'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
              )}
              onClick={() => onSelect(isSelected ? null : opt.value)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Single-select deselect pattern:** clicking a selected chip passes `null` to clear the facet (see `onClick` above). This differs from `StyleChips` which is multi-select.

**font-medium is FORBIDDEN** — use `font-semibold` on selected state; unselected chips use implicit `font-normal`.

---

### `src/components/search/CaseSizeChips.tsx` (NEW)

**Analog:** `src/components/search/MovementChips.tsx` — identical single-select chip group structure with different options.

**Core pattern** — copy `MovementChips.tsx` replacing options and label:
```typescript
const CASE_SIZE_OPTIONS = [
  { label: '<36mm', value: 'lt36' },
  { label: '36–39mm', value: '36-39' },
  { label: '40–42mm', value: '40-42' },
  { label: '43–45mm', value: '43-45' },
  { label: '46mm+', value: '46plus' },
] as const
```

Label uses en-dash (`–`) per UI-SPEC line 314. URL values stay ASCII-safe (hyphen, no `<` or `+`).

Everything else is byte-identical to `MovementChips.tsx` — same chip button pattern, same `cn()` conditional, same `aria-pressed`, same single-select deselect on re-click.

---

### `src/components/search/StyleChips.tsx` (NEW)

**Analog:** `src/components/search/MovementChips.tsx` — chip group structure. Key difference: multi-select (toggle in/out of array) instead of single-select.

**Multi-select toggle pattern:**
```typescript
interface StyleChipsProps {
  selected: string[]
  onSelect: (value: string[]) => void
  vocab: string[]  // top-8 from getTopStyleTags
}

onClick={() => {
  const isSelected = selected.includes(opt)
  onSelect(
    isSelected ? selected.filter((s) => s !== opt) : [...selected, opt]
  )
}}
```

**Display label capitalization** (per UI-SPEC line 318):
```typescript
label.charAt(0).toUpperCase() + label.slice(1)
```

---

### `src/components/insights/CollectionFitCard.tsx` — insert FIT-05 section

**Analog:** `src/components/insights/CollectionFitCard.tsx` lines 62–86 (`mostSimilar` div) — the existing section structure to insert below.

**Import addition** (no forbidden imports — `CollectionFitCompareTable` is not `@/lib/similarity` or `@/lib/verdict/composer`):
```typescript
import { CollectionFitCompareTable } from '@/components/insights/CollectionFitCompareTable'
```

**Insertion site** — after line 86 (close of `mostSimilar` div), before line 88 (`{/* Role-overlap warning */}`):
```typescript
{/* FIT-05 — Pairwise taste drill-down (D-12 through D-16; D-15 module-absent-not-empty) */}
{/* NOTE: owned-side uses LOOSE `!= null` because Watch.catalogTaste is optional (CatalogTasteAttributes | null | undefined). */}
{/* The candidate-side stays STRICT `!== null` because post-40-02 typing locks it to exactly (CatalogTasteAttributes | null). */}
{verdict.mostSimilar.length > 0 &&
  verdict.candidateCatalogTaste !== null &&
  verdict.candidateCatalogTaste.confidence !== null &&
  verdict.candidateCatalogTaste.confidence >= 0.5 &&
  verdict.mostSimilar[0].watch.catalogTaste != null &&
  verdict.mostSimilar[0].watch.catalogTaste.confidence !== null &&
  verdict.mostSimilar[0].watch.catalogTaste.confidence >= 0.5 && (
  <CollectionFitCompareTable
    candidate={verdict.candidateCatalogTaste}
    owned={verdict.mostSimilar[0].watch.catalogTaste}
    ownedBrand={verdict.mostSimilar[0].watch.brand}
    ownedModel={verdict.mostSimilar[0].watch.model}
  />
)}
```

**Props type update** — `VerdictBundle` imported at line 5 will now include `candidateCatalogTaste` via `VerdictBundleFull`. No extra import needed (already importing from `@/lib/verdict/types`).

**MUST NOT add:** `@/lib/similarity`, `@/lib/verdict/composer`, `server-only`, `@/lib/verdict/viewerTasteProfile` — these are all forbidden by `tests/static/CollectionFitCard.no-engine.test.ts`.

---

### `src/lib/verdict/types.ts` — extend `VerdictBundleFull`

**Analog:** `src/lib/verdict/types.ts` lines 22–35 (itself).

**Import addition** (line 3 currently has `import type { Watch, SimilarityLabel, PrimaryArchetype, EraSignal } from '@/lib/types'`):
```typescript
// Add CatalogTasteAttributes to the import:
import type { Watch, SimilarityLabel, PrimaryArchetype, EraSignal, CatalogTasteAttributes } from '@/lib/types'
```

**Field addition to `VerdictBundleFull`** — add after `roleOverlap: boolean`:
```typescript
export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  headlinePhrasing: string
  contextualPhrasings: string[]
  rationalePhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
  /** Phase 40 FIT-05 D-14/D-15 — candidate's taste from catalogEntry.
   *  null when catalogEntry is null or confidence < 0.5 guard applied upstream. */
  candidateCatalogTaste: CatalogTasteAttributes | null  // ADD THIS
}
```

---

### `src/lib/verdict/composer.ts` — thread `candidateCatalogTaste` into bundle

**Analog:** `src/lib/verdict/composer.ts` lines 43–97 (the `computeVerdictBundle` function).

**Existing `candidateTaste` block** (lines 47–53) already reads from `catalogEntry` — extend it to build the full `CatalogTasteAttributes` shape:
```typescript
// After the existing candidateTaste block (line 53), add:
const candidateCatalogTaste: CatalogTasteAttributes | null = catalogEntry
  ? {
      formality: catalogEntry.formality !== null ? Number(catalogEntry.formality) : null,
      sportiness: catalogEntry.sportiness !== null ? Number(catalogEntry.sportiness) : null,
      heritageScore: catalogEntry.heritageScore !== null ? Number(catalogEntry.heritageScore) : null,
      primaryArchetype: catalogEntry.primaryArchetype,
      eraSignal: catalogEntry.eraSignal,
      designMotifs: catalogEntry.designMotifs ?? [],
      confidence: catalogEntry.confidence !== null ? Number(catalogEntry.confidence) : null,
      extractedFromPhoto: catalogEntry.extractedFromPhoto ?? false,
    }
  : null
```

**Return statement extension** — add field to the return at lines 85–96:
```typescript
return {
  framing,
  label: result.label,
  headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
  contextualPhrasings,
  rationalePhrasings,
  mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({ watch, score })),
  roleOverlap: result.roleOverlap,
  candidateCatalogTaste,  // ADD THIS
}
```

**Numeric coercion is load-bearing** — `getCatalogById` may return `numeric()` fields as strings (postgres-js boundary). The `Number()` coercions above match the established pattern from `src/data/watches.ts:154–161`.

**3 call sites** already pass `catalogEntry` — no new arguments required at `src/app/catalog/[catalogId]/page.tsx:117`, `src/app/watch/[id]/page.tsx:52`, `src/app/actions/verdict.ts:63`.

---

### `src/components/insights/CollectionFitCompareTable.tsx` (NEW)

**Analog:** `src/components/insights/CollectionFitCard.tsx` — pure-renderer component, same module-absent-not-empty pattern. Uses `Badge` from `src/components/ui/badge.tsx` (already imported in `CollectionFitCard`).

**Imports pattern** (matches pure-renderer boundary):
```typescript
import { Badge } from '@/components/ui/badge'
import type { CatalogTasteAttributes } from '@/lib/types'
import { computeDeltaPhrase } from '@/lib/verdict/fit-delta'
import { cn } from '@/lib/utils'
```

**No forbidden imports** — `@/lib/similarity` and `@/lib/verdict/composer` must never appear.

**Core table pattern** (from UI-SPEC lines 382–405):
```typescript
interface CollectionFitCompareTableProps {
  candidate: CatalogTasteAttributes
  owned: CatalogTasteAttributes
  ownedBrand: string
  ownedModel: string
}

export function CollectionFitCompareTable({
  candidate, owned, ownedBrand, ownedModel,
}: CollectionFitCompareTableProps) {
  const deltaPhrase = computeDeltaPhrase(candidate, owned)
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-base font-semibold text-foreground">
        Compare with the {ownedBrand} {ownedModel} you own
      </h4>
      <table className="grid grid-cols-2 gap-px bg-border rounded-md overflow-hidden text-sm">
        <tbody>
          {/* Column headers row */}
          <tr>
            <th className="bg-muted px-2 py-2 font-semibold text-foreground text-xs uppercase tracking-wide text-left">
              This watch
            </th>
            <th className="bg-muted px-2 py-2 font-semibold text-foreground text-xs uppercase tracking-wide text-left">
              Your {ownedBrand} {ownedModel}
            </th>
          </tr>
          {/* 6 taste dimension rows — see rendering rules below */}
          <ScalarRow label="Formality" candidateVal={candidate.formality} ownedVal={owned.formality} />
          <ScalarRow label="Sportiness" candidateVal={candidate.sportiness} ownedVal={owned.sportiness} />
          <ScalarRow label="Heritage" candidateVal={candidate.heritageScore} ownedVal={owned.heritageScore} />
          <EnumRow label="Archetype" candidateVal={candidate.primaryArchetype} ownedVal={owned.primaryArchetype} />
          <EnumRow label="Era" candidateVal={candidate.eraSignal} ownedVal={owned.eraSignal} />
          <MotifsRow candidateMotifs={candidate.designMotifs} ownedMotifs={owned.designMotifs} />
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">{deltaPhrase}</p>
    </div>
  )
}
```

**Scalar cell rendering** (from UI-SPEC lines 424–436):
```typescript
function ScalarCell({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full bg-border flex-1 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{ width: `${Math.round((value ?? 0) * 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
        {value !== null ? `${Math.round(value * 100)}%` : '—'}
      </span>
    </div>
  )
}
```

**Enum display transform** (from UI-SPEC line 440):
```typescript
function displayEnum(val: string | null): string {
  if (!val) return '—'
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
```

**Motifs chip cluster** (from UI-SPEC lines 444–451):
```typescript
function MotifsCell({ motifs }: { motifs: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {motifs.map((m) => (
        <Badge key={m} variant="outline" className="text-xs px-1.5 py-0">
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </Badge>
      ))}
      {motifs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
    </div>
  )
}
```

**Grid uses `grid-cols-2` with no responsive variant** — D-13 explicitly keeps 2-col on mobile.

---

### `src/lib/verdict/fit-delta.ts` (NEW)

**Analog:** `src/lib/verdict/composer.ts` — pure utility with no forbidden imports. The `CandidateTasteSnapshot` / delta logic pattern (lines 47–53) is the closest data-flow match. For the algorithm shape, `tests/static/composer-engine-alignment.test.ts` shows the Jaccard pattern already used in tests.

**Imports** (zero forbidden imports):
```typescript
import type { CatalogTasteAttributes } from '@/lib/types'
```

**Core algorithm** (from CONTEXT.md D-16 + RESEARCH.md Pattern 4):
```typescript
export function computeDeltaPhrase(
  candidate: CatalogTasteAttributes,
  owned: CatalogTasteAttributes,
): string {
  const SCALAR_THRESHOLD = 0.1
  const MOTIF_THRESHOLD = 0.8

  // Step 1–3: compute deltas per dimension
  const formalityDelta = candidate.formality !== null && owned.formality !== null
    ? Math.abs(candidate.formality - owned.formality) : null
  const sportinessDelta = candidate.sportiness !== null && owned.sportiness !== null
    ? Math.abs(candidate.sportiness - owned.sportiness) : null
  const heritageDelta = candidate.heritageScore !== null && owned.heritageScore !== null
    ? Math.abs(candidate.heritageScore - owned.heritageScore) : null

  const archetypeDelta = candidate.primaryArchetype === owned.primaryArchetype ? 0 : 1
  const eraDelta = candidate.eraSignal === owned.eraSignal ? 0 : 1

  const motifJaccard = jaccardSimilarity(candidate.designMotifs, owned.designMotifs)
  const motifDelta = 1 - motifJaccard

  // Step 4: "very similar" fallback
  const allScalarsSmall = [formalityDelta, sportinessDelta, heritageDelta]
    .every((d) => d === null || d < SCALAR_THRESHOLD)
  if (allScalarsSmall && archetypeDelta === 0 && eraDelta === 0 && motifJaccard >= MOTIF_THRESHOLD) {
    return 'Very similar across all taste dimensions'
  }

  // Step 5: pick highest delta + emit phrase
  // ... compare all deltas, return templated phrase for winner per UI-SPEC copy table
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const setA = new Set(a)
  const intersection = b.filter((x) => setA.has(x)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 1 : intersection / union
}
```

**Copy templates** (from UI-SPEC lines 483–498):
```typescript
// Dimension winner → phrase lookup:
// formality: candidate > owned  → 'This is more formal'
// formality: candidate < owned  → 'This is more casual'
// sportiness: candidate > owned → 'This is more sport'
// sportiness: candidate < owned → 'This is less sport'
// heritageScore: candidate > owned → 'More heritage-leaning'
// heritageScore: candidate < owned → 'More modern in character'
// primaryArchetype: different   → `Different archetype: ${displayEnum(candidate)} vs ${displayEnum(owned)}`
// eraSignal: different          → `Different era: ${displayEnum(candidate)} vs ${displayEnum(owned)}`
// designMotifs: jaccard < 0.8   → 'Different design motifs'
```

**No imports of `@/lib/similarity` or `@/lib/verdict/composer`** — this file is safe to import from `CollectionFitCompareTable.tsx` (static guard does not forbid it).

---

### `tests/static/search-dal.movement-type.test.ts` (NEW)

**Analog:** `tests/static/CollectionFitCard.no-engine.test.ts` — exact same structure (`readFileSync` + `expect(src).toMatch`). Lines 1–41 are the complete template.

**Core pattern** — copy verbatim from `CollectionFitCard.no-engine.test.ts` with different path and assertions:
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Phase 40 SC#4 — searchCatalogWatches references movement_type', () => {
  const dalSrc = readFileSync('src/data/catalog.ts', 'utf8')

  it('references watchesCatalog.movementType (movement_type column)', () => {
    expect(dalSrc).toMatch(/movementType/)
  })

  it('does NOT reference deprecated free-text movement column directly', () => {
    // watchesCatalog.movement (no suffix) would be the old free-text column.
    // movementType and movementCaliber are acceptable.
    expect(dalSrc).not.toMatch(/watchesCatalog\.movement[^TCa]/)
  })
})
```

**File path:** `tests/static/search-dal.movement-type.test.ts`

**Run command:** `npx vitest run tests/static/search-dal.movement-type.test.ts`

---

### `tests/unit/lib/verdict/fit-delta.test.ts` (NEW)

**Analog:** `tests/actions/search.test.ts` — vitest unit test with `describe`/`it`/`expect` and explicit scenario matrix. Also reference `tests/static/composer-engine-alignment.test.ts` for the CatalogTasteAttributes fixture pattern.

**Directory:** `tests/unit/lib/verdict/` — create this directory (does not yet exist).

**Core pattern** — 5 scenarios covering D-16 algorithm (from RESEARCH.md Q8):
```typescript
import { describe, it, expect } from 'vitest'
import { computeDeltaPhrase } from '@/lib/verdict/fit-delta'
import type { CatalogTasteAttributes } from '@/lib/types'

// Minimal fixture builder
function taste(overrides: Partial<CatalogTasteAttributes>): CatalogTasteAttributes {
  return {
    formality: 0.5,
    sportiness: 0.5,
    heritageScore: 0.5,
    primaryArchetype: 'dive',
    eraSignal: 'modern',
    designMotifs: ['brushed'],
    confidence: 0.9,
    extractedFromPhoto: false,
    ...overrides,
  }
}

describe('computeDeltaPhrase — D-16 delta algorithm', () => {
  it('returns "Very similar" fallback when all deltas below threshold', () => { ... })
  it('formality-dominant scalar emits directional phrase', () => { ... })
  it('archetype mismatch emits "Different archetype: X vs Y"', () => { ... })
  it('motif mismatch emits "Different design motifs"', () => { ... })
  it('null scalar gracefully excluded from comparison', () => { ... })
})
```

---

## Shared Patterns

### `cn()` conditional class composition
**Source:** `src/lib/utils.ts`
**Apply to:** All new component files (FilterSheet, MovementChips, CaseSizeChips, StyleChips, CollectionFitCompareTable)
```typescript
import { cn } from '@/lib/utils'
// Usage:
className={cn(
  'base classes',
  isSelected && 'selected-classes',
  !isSelected && 'unselected-classes',
)}
```

### `'use client'` directive
**Source:** `src/components/search/useSearchState.ts` (line 1), `src/components/ui/sheet.tsx` (line 1)
**Apply to:** All new components in `src/components/search/` and the extended `CollectionFitCard.tsx` (already has it)
```typescript
'use client'
```

### font-medium prohibition
**Source:** `tests/no-raw-palette.test.ts:20` — `\bfont-medium\b` is blocked for all files in `src/components/`
**Apply to:** All new and modified component files
```
Use font-semibold for all heading-weight text. Never use font-medium.
```

### Module-absent-not-empty confidence gate
**Source:** `src/components/insights/CollectionFitCard.tsx` (roleOverlap conditional at line 88) + Phase 39b D-39b-07
**Apply to:** FIT-05 section in `CollectionFitCard.tsx`, `CollectionFitCompareTable.tsx`
```typescript
// Pattern: section is ABSENT when gate fails — no placeholder, no empty div, render null
{gateConditions && <Component ... />}
// NOT: <Component ... /> // with internal empty state
```

### Vitest static source-text assertion
**Source:** `tests/static/CollectionFitCard.no-engine.test.ts` lines 1–41
**Apply to:** `tests/static/search-dal.movement-type.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
// Read source file; assert .toMatch() / .not.toMatch() on string content
```

### `'use cache'` + `cacheLife` for server-only DAL functions
**Source:** `next.config.ts` (`cacheComponents: true` already enabled); pattern from RESEARCH.md §Pattern 5
**Apply to:** `getTopStyleTags` in `src/data/catalog.ts`
```typescript
export async function getTopStyleTags(limit = 8): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  // ...db query
}
```

### Numeric coercion at postgres-js boundary
**Source:** `src/data/watches.ts:154–161`
**Apply to:** `candidateCatalogTaste` construction in `src/lib/verdict/composer.ts`
```typescript
Number(value) // for numeric() columns; idempotent if already a number
```

---

## No Analog Found

All files have at least a partial analog. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `src/data/`, `src/app/actions/`, `src/app/search/`, `src/components/search/`, `src/components/insights/`, `src/components/ui/`, `src/lib/verdict/`, `tests/static/`, `tests/actions/`, `src/data/watches.ts`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-14

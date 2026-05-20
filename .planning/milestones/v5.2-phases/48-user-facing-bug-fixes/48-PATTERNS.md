# Phase 48: User-Facing Bug Fixes — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 11 (1 new, 10 modified)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ui/chip.tsx` | component (primitive) | request-response (stateless) | `src/components/ui/badge.tsx` | exact (same CVA + `cn()` pattern) |
| `src/components/search/BrandChips.tsx` | component | request-response | `src/components/search/EraChips.tsx` | exact (identical pattern, external vocab prop) |
| `src/components/search/EraChips.tsx` | component | request-response | `src/components/search/BrandChips.tsx` | exact |
| `src/components/search/GenreChips.tsx` | component | request-response | `src/components/search/BrandChips.tsx` | exact |
| `src/components/search/ArchetypeChips.tsx` | component | request-response | `src/components/search/BrandChips.tsx` | exact |
| `src/components/search/MovementChips.tsx` | component | request-response | `src/components/search/BrandChips.tsx` | exact |
| `src/components/search/CaseSizeChips.tsx` | component | request-response | `src/components/search/BrandChips.tsx` | exact |
| `src/components/search/StyleChips.tsx` | component | request-response | `src/components/search/StyleChips.tsx` | self (multi-select divergence documented below) |
| `src/components/search/SearchPageClient.tsx` | component (client) | request-response | `src/components/search/SearchPageClient.tsx` | self (removable chip block, 2 occurrences) |
| `src/app/catalog/[catalogId]/page.tsx` | route (RSC) | CRUD | `src/app/catalog/[catalogId]/page.tsx` | self (one-line query change) |
| `tests/app/catalog-page.test.ts` | test | CRUD | `tests/app/watch-new-page.test.ts` | role-match (vi.mock + vi.hoisted vitest pattern) |

---

## Pattern Assignments

### `src/components/ui/chip.tsx` (NEW — component primitive, request-response)

**Primary analog:** `src/components/ui/badge.tsx`
**Secondary analog:** `src/components/ui/button.tsx`

**Imports pattern — badge.tsx lines 1-5 (copy exactly):**
```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
```

Note: `badge.tsx` also imports `@base-ui/react/merge-props` and `@base-ui/react/use-render` for its `useRender` composition pattern. The chip primitive does NOT need these — it renders a plain `<button>` element (the chip is a `type="button"` interactive element, not a polymorphic span). Copy only the CVA + `cn` imports.

**CVA variant declaration pattern — badge.tsx lines 7-28 (structure to copy):**
```typescript
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground ...",
        secondary: "bg-secondary text-secondary-foreground ...",
        // ...
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

**Component function pattern — badge.tsx lines 30-50 (adapt for button element):**
```typescript
function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({ ... })
}
export { Badge, badgeVariants }
```

For `chip.tsx`, the function signature changes to accept `<button>` props + chip-specific props (`selected`, `onRemove`, `removeLabel`, `children`). The CVA call and `cn()` merge follow the same pattern.

**Concrete chip variant classes (from UI-SPEC.md §Chip Primitive Visual Contract and RESEARCH.md §BUG-02 Fix):**

Shared base (both variants):
```
rounded-full border px-3 py-1 text-sm transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
```

`toggle` unselected:
```
bg-secondary text-secondary-foreground border-border hover:bg-muted font-normal
```

`toggle` selected (applied when `selected={true}` — use compound variant or conditional `cn()` in caller):
```
bg-accent text-accent-foreground border-accent font-semibold
```

`removable` (BUG-02 fix — `text-foreground` replaces broken `text-accent-foreground`):
```
gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20
```

**Export pattern — badge.tsx line 52:**
```typescript
export { Chip, chipVariants }
export type ChipVariants = VariantProps<typeof chipVariants>
```

**`'use client'` directive:** chip.tsx requires `'use client'` because it is consumed by `FilterDrawer` chips and `SearchPageClient.tsx` — both client components. badge.tsx does not have this directive because it is a display-only span; chip.tsx renders interactive `<button>` elements. Follow the BrandChips.tsx pattern: place `'use client'` on line 1.

---

### `src/components/search/BrandChips.tsx` (MODIFY — refactor to use chip primitive)

**Analog:** `src/components/search/BrandChips.tsx` lines 1-39 (self — the existing file is the pattern; the change is replacing the inline `<button>` with `<Chip>`)

**Current import block — lines 1-3:**
```typescript
'use client'

import { cn } from '@/lib/utils'
```

**After refactor — replace `cn` import with `Chip` import:**
```typescript
'use client'

import { Chip } from '@/components/ui/chip'
```

**Current button pattern — lines 19-33:**
```typescript
<button
  key={entry.slug}
  type="button"
  aria-pressed={isSelected}
  className={cn(
    'rounded-full border px-3 py-1 text-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    isSelected
      ? 'bg-accent text-accent-foreground border-accent font-semibold'
      : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
  )}
  onClick={() => onSelect(isSelected ? null : entry.slug)}
>
  {entry.name}
</button>
```

**After refactor — replace with `<Chip>` primitive:**
```typescript
<Chip
  key={entry.slug}
  variant="toggle"
  selected={isSelected}
  aria-pressed={isSelected}
  onClick={() => onSelect(isSelected ? null : entry.slug)}
>
  {entry.name}
</Chip>
```

The `selected` prop drives the conditional class application inside the primitive (compound variant or `cn()` in the primitive). All 6 single-select drawer chip components (BrandChips, EraChips, GenreChips, ArchetypeChips, MovementChips, CaseSizeChips) follow this identical refactor pattern.

---

### `src/components/search/EraChips.tsx` (MODIFY — same refactor as BrandChips)

**Analog:** `src/components/search/EraChips.tsx` lines 1-46 (self)

**Current import — line 3:**
```typescript
import { cn } from '@/lib/utils'
```

**After refactor:** Replace `import { cn }` with `import { Chip }` from chip primitive. The ERA_SIGNALS import and ERA_DISPLAY_LABELS local constant remain unchanged.

**Current button pattern — lines 27-39:** Identical className structure to BrandChips. Replace with `<Chip variant="toggle" selected={isSelected} ...>` following BrandChips refactor above.

---

### `src/components/search/StyleChips.tsx` (MODIFY — multi-select variant)

**Analog:** `src/components/search/StyleChips.tsx` lines 1-46 (self)

**Multi-select divergence:** `selected` prop is `string[]` not `string | null`. The `isSelected` computation on line 17 is `selected.includes(tag)` — this computes a `boolean`, which is the value passed to the `<Chip selected={isSelected}>` prop. The primitive remains stateless; StyleChips continues to own array membership logic.

**Current onClick — line 31-36:**
```typescript
onClick={() =>
  onSelect(
    isSelected
      ? selected.filter((s) => s !== tag)
      : [...selected, tag],
  )
}
```

This toggle-array logic stays in StyleChips, unchanged. Only the `<button>` → `<Chip variant="toggle" selected={isSelected}>` swap occurs.

---

### `src/components/search/SearchPageClient.tsx` (MODIFY — replace both chip block instances)

**Analog:** `src/components/search/SearchPageClient.tsx` lines 408-537 (self — the two existing chip blocks)

**Two occurrences to replace:**
- Lines ~408-454: zero-results branch chip block
- Lines ~491-537: results branch chip block

Both occurrences are byte-identical in structure. Both must be replaced.

**Current single chip button — lines 411-419 (representative instance):**
```typescript
<button
  type="button"
  onClick={onClearArchetype}
  className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-foreground hover:bg-accent/20 transition-colors"
>
  <span>{archetypeConfig?.displayName ?? archetype}</span>
  <X className="size-3" aria-hidden />
  <span className="sr-only">Remove {archetypeConfig?.displayName ?? archetype} filter</span>
</button>
```

**After refactor — replace with `<Chip variant="removable">`:**
```typescript
<Chip
  variant="removable"
  onClick={onClearArchetype}
  removeLabel={`Remove ${archetypeConfig?.displayName ?? archetype} filter`}
>
  {archetypeConfig?.displayName ?? archetype}
</Chip>
```

The `<X>` icon and `<span className="sr-only">` move inside the primitive (chip.tsx renders them when `variant="removable"`). SearchPageClient only passes `onClick`, label text as `children`, and the `removeLabel` sr-only string.

**Import addition for SearchPageClient.tsx:** Add `import { Chip } from '@/components/ui/chip'` to the existing import block (lines 1-26). The `X` import from `lucide-react` on line 4 can be removed once both chip blocks are replaced if no other `X` usage remains — verify with grep first.

---

### `src/app/catalog/[catalogId]/page.tsx` (MODIFY — BUG-01 one-line query fix)

**Analog:** `src/app/catalog/[catalogId]/page.tsx` lines 279-301 (self)

**Exact location of the fix — line 290:**
```typescript
// BEFORE (line 290):
.where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))

// AFTER:
.where(and(
  eq(watchesTable.userId, userId),
  eq(watchesTable.catalogId, catalogId),
  eq(watchesTable.status, 'owned'),
))
```

**No import changes needed.** `and`, `eq`, and `watchesTable` are all already imported (lines 3 and 22). The `status` column is defined in the schema (`watches as watchesTable`) and is already available on the table object.

**Drizzle filter pattern — existing `and()` usage at line 290 is the exact pattern to extend.** The `eq(watchesTable.status, 'owned')` call follows the identical Drizzle type-safe filter idiom already used for `userId` and `catalogId`.

**Context: the `findViewerWatchByCatalogId` function — lines 279-301:**
```typescript
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; acquisitionDate: string | null } | null> {
  const rows = await db
    .select({
      id: watchesTable.id,
      acquisitionDate: watchesTable.acquisitionDate,
      createdAt: watchesTable.createdAt,
    })
    .from(watchesTable)
    .where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))
    //          ^--- add: eq(watchesTable.status, 'owned')
    .limit(1)
  // ... null-handling + ISO date normalization below unchanged
}
```

---

### `tests/app/catalog-page.test.ts` (MODIFY — BUG-01 regression tests)

**Primary analog:** `tests/app/catalog-page.test.ts` lines 1-219 (self — extend, do not start a new file)

**Mock infrastructure pattern — lines 1-97 (established; do not change):**

The `vi.hoisted` block (lines 3-28) declares all mock functions. The `vi.mock('@/db', ...)` chain (lines 31-41) is how the Drizzle query is intercepted — `mockDbLimit` controls what `findViewerWatchByCatalogId` returns for all tests.

**The `@/data/profiles` mock gap — CONFIRMED ISSUE:**

`catalog-page.test.ts` calls `getProfileById(user.id)` inside `Promise.all` (page.tsx line 67) but does NOT mock `@/data/profiles`. The setup file (`tests/setup.tsx`) does NOT provide a default mock for this module. The reason existing tests pass is that vitest's module resolution for `@/data/profiles` either auto-returns a working module or the test environment satisfies the import.

**Resolution:** Before adding new tests, add `@/data/profiles` to the `vi.hoisted` block and `vi.mock` section. Pattern from `tests/app/watch-new-page.test.ts` line 34:

```typescript
// In vi.hoisted block (add to the existing object):
mockGetProfileById: vi.fn(),

// In vi.mock section (add after existing mocks):
vi.mock('@/data/profiles', () => ({ getProfileById: mockGetProfileById }))

// In beforeEach (add to existing setup):
mockGetProfileById.mockResolvedValue(null)
```

**Existing test structure pattern — lines 116-219 (the `describe` block):**

New regression tests follow the exact same `it(...)` shape as lines 140-147 (cross-user path test). Each test:
1. Sets up `mockGetCatalogById`, `mockGetWatchesByUser`, `mockDbLimit`
2. Calls `await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })`
3. Asserts on mock call counts or stringified result

**BUG-01 regression test patterns (from RESEARCH.md §Code Examples):**

```typescript
it('BUG-01 — wishlist watch does NOT trigger "You own this watch" callout', async () => {
  mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
  mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
  mockDbLimit.mockResolvedValue([])  // fixed query returns [] for non-owned status
  await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
  expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
  expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
})

it('BUG-01 — grail watch does NOT trigger "You own this watch" callout', async () => {
  // identical mock setup — mockDbLimit.mockResolvedValue([]) is the key
  mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
  mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
  mockDbLimit.mockResolvedValue([])
  await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
  expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
})

it('BUG-01 — sold watch does NOT trigger "You own this watch" callout', async () => {
  // same pattern — mock represents the fixed DB behavior, not the watch status
  mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
  mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
  mockDbLimit.mockResolvedValue([])
  await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
  expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
})
```

**Key insight:** The mock bypasses the Drizzle `where()` chain entirely. `mockDbLimit.mockResolvedValue([])` simulates the FIXED query returning empty for non-owned rows. The existing positive owned-path test (line 157) uses `mockDbLimit.mockResolvedValue([{ id: 'mine-1', ... }])` and must NOT be changed.

**Analog for mock pattern — `tests/app/watch-new-page.test.ts` lines 31-34:**
```typescript
// profiles mock pattern used in other app-level tests:
const { mockGetProfileById } = vi.hoisted(() => ({
  mockGetProfileById: vi.fn(),
}))
vi.mock('@/data/profiles', () => ({ getProfileById: mockGetProfileById }))
```

---

## Shared Patterns

### CVA + `cn()` Composition (chip primitive base)
**Source:** `src/components/ui/badge.tsx` lines 1-5 and 7-28
**Apply to:** `src/components/ui/chip.tsx` (new file)
```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const chipVariants = cva(
  /* base classes */,
  {
    variants: { variant: { ... } },
    defaultVariants: { variant: "toggle" },
  }
)
```

### `'use client'` + named export pattern (drawer chip components)
**Source:** `src/components/search/BrandChips.tsx` lines 1-2, 11, 39
**Apply to:** All 7 drawer chip components (retain; do not remove directive)
```typescript
'use client'
// ...
export function BrandChips(...) { ... }
```

### Drizzle `and()` + `eq()` filter chain
**Source:** `src/app/catalog/[catalogId]/page.tsx` line 290
**Apply to:** `findViewerWatchByCatalogId` — add third `eq()` condition
```typescript
.where(and(
  eq(watchesTable.userId, userId),
  eq(watchesTable.catalogId, catalogId),
  eq(watchesTable.status, 'owned'),  // BUG-01 fix
))
```

### `vi.hoisted` + `vi.mock` test mock pattern
**Source:** `tests/app/catalog-page.test.ts` lines 3-41
**Apply to:** New test cases in same file — follow existing `mockDbLimit` mock chain; add `mockGetProfileById` to the hoisted block and mock registry
```typescript
const { mockGetProfileById } = vi.hoisted(() => ({ mockGetProfileById: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: mockGetProfileById }))
// In beforeEach:
mockGetProfileById.mockResolvedValue(null)
```

### Removable chip anatomy (SearchPageClient internal pattern)
**Source:** `src/components/search/SearchPageClient.tsx` lines 411-419
**Apply to:** chip.tsx `removable` variant internal render — the primitive replicates this structure but with corrected `text-foreground` token
```typescript
// Current (broken) anatomy — captured for reference:
<button type="button" onClick={onClear}
  className="... text-accent-foreground ...">   // ← broken token
  <span>{label}</span>
  <X className="size-3" aria-hidden />
  <span className="sr-only">Remove {label} filter</span>
</button>
// The primitive encapsulates this; callers use:
<Chip variant="removable" onClick={onClear} removeLabel="Remove X filter">label</Chip>
```

---

## No Analog Found

All files have close matches. No entries in this section.

---

## Key Pattern Notes for Planner

### Chip primitive API shape (Claude's Discretion — D-07/D-08)
The primitive must handle two interaction shapes:
- `toggle` variant: accepts `selected: boolean` (caller computes); renders plain label text as children; no icon
- `removable` variant: accepts `onRemove?: () => void` or uses `onClick`; renders `<X className="size-3" aria-hidden />` + `<span className="sr-only">{removeLabel}</span>` internally; caller passes label as `children` and sr-only text as `removeLabel` prop

Stateless primitive — all selection state lives in parent chip components (StyleChips array, BrandChips single-select null toggle, etc.).

### `X` icon import in SearchPageClient.tsx
After both chip blocks are replaced, verify whether `X` from `lucide-react` has other usages in SearchPageClient before removing its import. Current import at line 4: `import { Search, SlidersHorizontalIcon, X } from 'lucide-react'`. The `X` moves to `chip.tsx` internals.

### Both removable chip blocks must be replaced
Lines ~408-454 (zero-results branch) AND lines ~491-537 (results branch) are byte-identical. Fixing only one leaves BUG-02 alive on the other code path. Both must use `<Chip variant="removable">`.

### `movementType` field naming in catalog page
The `findViewerWatchByCatalogId` fix (adding `eq(watchesTable.status, 'owned')`) is the ONLY change to `catalog/[catalogId]/page.tsx`. No other logic in the file is touched. The framing system, VerdictBundle shapes, and CollectionFitCard props are all unchanged.

---

## Metadata

**Analog search scope:** `src/components/ui/`, `src/components/search/`, `src/app/catalog/`, `tests/app/`, `tests/components/search/`
**Files read:** 14 (badge.tsx, button.tsx, BrandChips.tsx, EraChips.tsx, StyleChips.tsx, SearchPageClient.tsx, catalog/[catalogId]/page.tsx, catalog-page.test.ts, setup.tsx, utils.ts, 48-CONTEXT.md, 48-RESEARCH.md, 48-UI-SPEC.md, watch-new-page.test.ts via grep)
**Pattern extraction date:** 2026-05-19

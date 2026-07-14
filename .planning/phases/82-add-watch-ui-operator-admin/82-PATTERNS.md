# Phase 82: Add-Watch UI + Operator Admin - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 18 (11 new, 7 modified)
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/watch/BrandPicker.tsx` | component | request-response | `src/components/watch/SearchEntry.tsx` L207–338 | exact |
| `src/components/watch/BrandPicker.test.tsx` | test | — | `src/components/watch/SearchEntry.test.tsx` | exact |
| `src/app/admin/brands/page.tsx` | page (Server Component) | request-response | `src/app/admin/lists/page.tsx` | exact |
| `src/components/admin/BrandsQueue.tsx` | component (client) | CRUD | `src/components/admin/ListIndexClient.tsx` L145–220 | exact |
| `src/app/admin/families/page.tsx` | page (Server Component) | request-response | `src/app/admin/lists/page.tsx` | exact |
| `src/components/admin/FamiliesQueue.tsx` | component (client) | CRUD | `src/components/admin/ListIndexClient.tsx` L145–220 | exact |
| `src/app/actions/cms/brands.ts` | service (Server Actions) | CRUD | `src/app/actions/cms/collectionPaths.ts` L1–80 | exact |
| `src/app/actions/cms/families.ts` | service (Server Actions) | CRUD | `src/app/actions/cms/collectionPaths.ts` L1–80 | exact |
| `src/app/actions/__tests__/cms-brands.test.ts` | test | — | `src/app/actions/__tests__/cms-curatedLists.test.ts` | exact |
| `src/app/actions/__tests__/cms-families.test.ts` | test | — | `src/app/actions/__tests__/cms-curatedLists.test.ts` | exact |
| `src/components/watch/WatchForm.test.tsx` | test | — | `src/components/watch/SearchEntry.test.tsx` | role-match |
| `src/components/watch/StructuredEntryPanel.tsx` | component (modified) | request-response | self (L220–228) | exact |
| `src/components/watch/StructuredEntryPanel.test.tsx` | test (extended) | — | self | exact |
| `src/components/watch/WatchForm.tsx` | component (modified) | request-response | self (L370–380 status chip) | exact |
| `src/components/watch/AddWatchFlow.tsx` | component (modified) | request-response | self (L70–92, L639) | exact |
| `src/app/watch/new/page.tsx` | page (modified) | request-response | self (L95–104 Promise.all) | exact |
| `src/app/w/[ref]/edit/page.tsx` | page (modified) | request-response | `src/app/watch/new/page.tsx` L94–104 | exact |
| `src/components/admin/AdminSubNav.tsx` | component (modified) | — | self (L12–15 NAV_LINKS) | exact |
| `src/data/catalog.ts` | utility/DAL (modified) | CRUD | self (L1075–1081 listCatalogBrands) | exact |

---

## Pattern Assignments

### `src/components/watch/BrandPicker.tsx` (component, request-response)

**Analog:** `src/components/watch/SearchEntry.tsx` L207–338

**Imports pattern** (SearchEntry.tsx L1–10 area):
```typescript
'use client'
import { useState, useMemo } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { cn } from '@/lib/utils'
```

**Controlled-open combobox root** (SearchEntry.tsx L207–233):
```typescript
<Combobox.Root<SearchCatalogWatchResult>
  inputValue={query}
  onInputValueChange={(val, details) => {
    // ignore non-input-change reasons (e.g. inputClear on popup close, triggerPress)
    // that would clobber the user's typed query before the next render
    if (details.reason !== 'input-change') return
    setQuery(val)
  }}
  filteredItems={results}
  filter={null}                       // disable base-ui's internal string-match
  itemToStringLabel={(r) => `${r.brand} ${r.model}`}
  itemToStringValue={(r) => r.catalogId}
  isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}
  onValueChange={(picked) => {
    if (picked) onPick(picked)
  }}
  open={isPopupOpen}
  onOpenChange={(next) => setIsPopupOpen(next)}
>
```

**`filter={null}` + `filteredItems` — critical pair** (SearchEntry.tsx L219–220):
```typescript
  filteredItems={results}
  filter={null}
```
Both must be set together. Without `filter={null}`, base-ui applies its own filter ON TOP of `filteredItems`, producing incorrect results (verified from `ComboboxRoot.d.ts`).

**Footer affordance — OUTSIDE Combobox.List** (SearchEntry.tsx L320–334):
```typescript
{/* SRCH-03: rendered as sibling of <Combobox.List> — listbox-internal
    placement swallowed clicks in real browsers (jsdom-tolerant but
    prod-broken). Placed OUTSIDE the listbox so native click semantics apply. */}
{!isLoading && results.length > 0 && (
  <button
    type="button"
    onClick={() => { setShowPanel(true); setIsPopupOpen(false); }}
    className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
  >
    Not finding it? Add manually
  </button>
)}
```

For `BrandPicker`'s UI-02 affordance: gate is `filteredBrands.length === 0 && inputValue.trim().length > 0` (not `results.length > 0`); copy is `Couldn't find that brand — add as "{typed}"`. Same button className, same sibling position inside `Combobox.Popup`. Never use `Combobox.Empty` — it renders inside the listbox context and swallows clicks.

**Portal + Positioner + Popup shell** (SearchEntry.tsx L246–248):
```typescript
<Combobox.Portal>
  <Combobox.Positioner sideOffset={4} align="start">
    <Combobox.Popup className="z-50 w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
```

**Item highlight class** (SearchEntry.tsx L262):
```typescript
className="group flex items-center gap-4 min-w-0 rounded-md pl-2 pr-3 py-2 cursor-default data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
```
Per `[[accent-is-active-token]]`: use `bg-accent` not `bg-primary` for selected/highlighted states.

---

### `src/components/watch/BrandPicker.test.tsx` (test)

**Analog:** `src/components/watch/SearchEntry.test.tsx`

**Test file structure** (SearchEntry.test.tsx L33–80):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock heavy sub-components to keep test focused
vi.mock('@/components/watch/StructuredEntryPanel', () => ({
  StructuredEntryPanel: (props: { ... }) => (
    <div data-testid="structured-panel-mock" data-brand={props.initialBrand ?? ''}>
      ...
    </div>
  ),
}))
```

**Assert-disappearance-too pattern** — per `[[assert-disappearance-too]]` memory. When affordance button is clicked:
1. Assert popup is closed (e.g., `expect(screen.queryByRole('listbox')).not.toBeInTheDocument()`)
2. Assert `onCouldntFind` was called with the typed string

Both mount AND unmount assertions are required. A click that closes the popup should fail the test if the popup stays open.

**Selection + open state test structure** (SearchEntry.test.tsx case 7):
- ArrowDown then Enter on a highlighted item fires the callback
- Assert role="combobox" on input + role="listbox" / role="option" on popup

---

### `src/app/admin/brands/page.tsx` (Server Component, request-response)

**Analog:** `src/app/admin/lists/page.tsx` (entire file, 19 lines):
```typescript
// /admin/lists — server component. Layout.tsx already guards this segment.
// Fetches all lists (owner-read, includes drafts) and passes to ListIndexClient.

import { getAllListsForOwner } from '@/data/curatedLists'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { ListIndexClient } from '@/components/admin/ListIndexClient'

export default async function AdminListsPage() {
  const lists = await getAllListsForOwner()

  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Curated Lists</h1>
      <ListIndexClient lists={lists} />
    </>
  )
}
```

Copy this pattern verbatim: Server Component, no `'use client'`, no `await connection()` (admin pages have no `'use cache'` wrapper — standard dynamic Server Component, auth-gated via layout). Replace: `getAllListsForOwner()` → new `listBrandsForQueue()` DAL; `ListIndexClient` → `BrandsQueue`.

For `/admin/families/page.tsx`, additionally read `?brandId` from `searchParams` (Next.js 16 pattern — `searchParams` is a `Promise<{brandId?: string}>`):
```typescript
interface FamiliesPageProps {
  searchParams: Promise<{ brandId?: string }>
}
export default async function AdminFamiliesPage({ searchParams }: FamiliesPageProps) {
  const sp = await searchParams
  const brandIdFilter = sp.brandId ?? null
  const families = await listFamiliesForQueue(brandIdFilter)
  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Families</h1>
      <FamiliesQueue families={families} brandIdFilter={brandIdFilter} />
    </>
  )
}
```

---

### `src/components/admin/BrandsQueue.tsx` and `src/components/admin/FamiliesQueue.tsx` (client, CRUD)

**Analog:** `src/components/admin/ListIndexClient.tsx` L145–220

**Card + inline actions row structure** (ListIndexClient.tsx L145–219):
```typescript
<div className="space-y-3">
  {lists.map((list, idx) => {
    return (
      <Card key={list.id}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold truncate">{list.title}</span>
                <Badge variant={list.status === 'published' ? 'default' : 'secondary'}>
                  {list.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{list.curatorName}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" render={<Link href={`/admin/lists/${list.id}`} />}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(list)}>
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  })}
</div>
```

For `BrandsQueue` / `FamiliesQueue`: keep the `<Card><CardContent className="pt-4"><div className="flex items-start gap-3">` shell verbatim. Remove the reorder-button column (brands/families don't sort by user). Swap `list.title` + status badge for `brand.name` + `needs_review` badge. Swap Edit/Delete for Confirm / Rename / Merge (brands) or Confirm / Rename / Add alias (families).

**Dialog pattern** (ListIndexClient.tsx L223–250):
```typescript
<Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Delete this list?</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />} onClick={() => setDeleteTarget(null)}>
        Cancel
      </DialogClose>
      <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? <><Loader2 className="animate-spin" aria-hidden="true" />Deleting…</> : 'Delete List'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Use `showCloseButton={false}` on confirmation dialogs. `DialogClose` wraps the Cancel button.

**Do NOT copy the `useState` list pattern from ListIndexClient.** Per RESEARCH Pitfall 7: `ListIndexClient` copies the list to `useState` for optimistic reordering — queue clients should NOT. Let `router.refresh()` drive re-render from the Server Component; `BrandsQueue`/`FamiliesQueue` receive `brands`/`families` as direct props (no local copy).

**router.refresh() after Server Action** (ListIndexClient.tsx pattern):
```typescript
const router = useRouter()

async function handleConfirm(id: string) {
  const result = await confirmBrandAsNew({ id })
  if (!result.success) {
    toast.error(result.error ?? 'Failed')
    return
  }
  toast.success('Confirmed')
  router.refresh()
}
```

**Deep-link scroll-to for BrandsQueue** (Claude's Discretion — recommended):
```typescript
useEffect(() => {
  const hash = window.location.hash  // '#brand-{id}'
  if (!hash.startsWith('#brand-')) return
  const id = hash.slice('#brand-'.length)
  const el = document.getElementById(`brand-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.dataset.highlighted = 'true'
    const timer = setTimeout(() => { delete el.dataset.highlighted }, 1000)
    return () => clearTimeout(timer)
  }
}, [])  // empty deps — runs once on mount
// Row Card gets id="brand-{brand.id}" for targeting
// Tailwind: data-[highlighted=true]:bg-accent/30 transition-colors duration-300
```

---

### `src/app/actions/cms/brands.ts` and `src/app/actions/cms/families.ts` (Server Actions, CRUD)

**Analog:** `src/app/actions/cms/collectionPaths.ts` L1–80

**File header + imports** (collectionPaths.ts L1–23):
```typescript
'use server'

// CRITICAL: assertOwner() is the SOLE enforced security gate for every CMS Server Action.
// The admin layout redirect is UX only — Server Actions are HTTP-callable and bypass
// layout guards. The CMS DAL runs through the Drizzle `db` client (direct Postgres
// connection), which BYPASSES RLS. D-06.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import { db } from '@/db'
import { brands, watchFamilies } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { slugifyWithRandomSuffix } from '@/lib/slug'
import type { ActionResult } from '@/lib/actionTypes'
```

`slugifyWithRandomSuffix` is `server-only` (verified: `slug.ts` L3 has `import 'server-only'`). Only import in Server Action files, never in client components.

**Zod `.strict()` schema pattern** (collectionPaths.ts L36–43):
```typescript
const createPathSchema = z
  .object({
    seedCatalogId: z.string().uuid(),
    pathType: z.enum(PATH_TYPES),
    rationale: z.string().max(2000).optional(),
  })
  .strict()  // mass-assignment protection — rejects unknown keys
```

**`assertOwner()` first-statement pattern** (collectionPaths.ts L65–80):
```typescript
export async function confirmBrandAsNew(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = confirmBrandSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await db.update(brands).set({ needsReview: false }).where(eq(brands.id, parsed.data.id))
    revalidatePath('/admin/brands')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[confirmBrandAsNew] unexpected error:', err)
    return { success: false, error: "Couldn't confirm brand. Try again." }
  }
}
```

Pattern: assertOwner() → Zod parse → DAL call → revalidatePath → return success. `console.error` on unexpected errors. Never throw across the boundary — always return `ActionResult<T>`.

**`assertOwner()` return value** — only `{ id: string; email: string }` (verified: `src/lib/auth.ts` L70). Do not destructure any other fields. CMS Server Actions only need `await assertOwner()` and ignore the return value.

**`revalidatePath` for admin queues** (not `updateTag`) — admin pages have no `'use cache'` wrapper. `revalidatePath('/admin/brands')` is the correct invalidation primitive. `updateTag` is only for read-your-own-writes inside Server Actions (different semantics, not applicable).

**Drizzle transaction for brand merge** (curatedLists.ts L138–141 / collectionPaths.ts L189–200):
```typescript
await db.transaction(async (tx) => {
  // Step 1: Move watches_catalog rows to target
  await tx.execute(sql`
    UPDATE watches_catalog SET brand_id = ${targetId} WHERE brand_id = ${sourceId}
  `)
  // Step 2 (conditional): Move watch_families rows to target
  if (moveFamilies) {
    await tx.execute(sql`
      UPDATE watch_families SET brand_id = ${targetId} WHERE brand_id = ${sourceId}
    `)
  }
  // Step 3: Delete source brand
  // MUST come AFTER step 2 — watch_families.brand_id has onDelete: 'restrict'
  await tx.execute(sql`DELETE FROM brands WHERE id = ${sourceId}`)
})
```

Transaction ordering is critical: `watch_families.brand_id` has `onDelete: 'restrict'` (verified: `schema.ts` L545). Families must be moved BEFORE the DELETE.

**Alias array SQL** (verified against `catalog-resolver.ts` L243–249):
```typescript
// Add alias (atomic dedup via WHERE NOT):
await db.execute(sql`
  UPDATE watch_families
  SET aliases = aliases || ARRAY[${normalizedAlias}]::text[]
  WHERE id = ${familyId}
    AND NOT (aliases @> ARRAY[${normalizedAlias}]::text[])
`)
// where normalizedAlias = alias.trim().toLowerCase()

// Remove alias:
await db.execute(sql`
  UPDATE watch_families
  SET aliases = array_remove(aliases, ${aliasToRemove})
  WHERE id = ${familyId}
`)
```

Normalization `trim().toLowerCase()` must match the resolver's `lower(trim($1))` in its alias lookup query (resolver tier 2). Store pre-normalized.

---

### `src/app/actions/__tests__/cms-brands.test.ts` and `src/app/actions/__tests__/cms-families.test.ts` (tests)

**Analog:** `src/app/actions/__tests__/cms-curatedLists.test.ts` L1–130

**Mock setup block** (cms-curatedLists.test.ts L16–61):
```typescript
vi.mock('@/lib/auth', () => {
  class UnauthorizedError extends Error {
    constructor(message = 'Not authenticated') {
      super(message)
      this.name = 'UnauthorizedError'
    }
  }
  return {
    UnauthorizedError,
    getCurrentUser: vi.fn(),
    assertOwner: vi.fn(),
  }
})

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

// Mock the DAL (brands.ts / families.ts)
vi.mock('@/data/brands', () => ({
  confirmBrand: vi.fn(),
  renameBrand: vi.fn(),
  mergeBrandInDb: vi.fn(),
}))
```

**beforeEach default + auth-failure override** (cms-curatedLists.test.ts L86–97):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  // Default: assertOwner succeeds (authenticated admin)
  vi.mocked(assertOwner).mockResolvedValue({ id: 'user-1', email: 'admin@example.com' })
})

describe('Behavior 1: every action returns Not authorized when assertOwner throws', () => {
  beforeEach(() => {
    vi.mocked(assertOwner).mockRejectedValue(new UnauthorizedError('Not an admin'))
  })

  it('confirmBrandAsNew: returns { success:false, error:"Not authorized" }', async () => {
    const result = await confirmBrandAsNew({ id: VALID_UUID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authorized')
  })
```

Every action must have one unauth test case. Also add Zod `.strict()` rejection test: call action with an extra unknown key, assert `{ success: false, error: 'Invalid data' }`.

---

### `src/components/watch/WatchForm.test.tsx` (test, new)

**Analog:** `src/components/watch/StructuredEntryPanel.test.tsx` (jsdom + render + props gate) and `src/components/watch/SearchEntry.test.tsx` (assertion patterns)

**Test file shape** (StructuredEntryPanel.test.tsx L31–60):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock heavy sub-components to avoid pulling EXIF / canvas workers into jsdom
vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: (props: { ... }) => (
    <div data-testid="catalog-photo-uploader" ...>...</div>
  ),
}))
```

Four required test cases for `WatchForm.test.tsx`:
1. `catalogId != null` → renders read-only chip (div with `aria-readonly="true"`), NOT an `<input>` for brand/model
2. `viewerIsAdmin=false` → no admin link cluster in DOM
3. `viewerIsAdmin=true && mode='edit' && catalogId != null` → "Edit brand" + "Edit family" links rendered
4. `catalogId = null` → `<input>` fields still editable (not chip)

---

### `src/components/watch/WatchForm.tsx` (modified — UI-03 read-only chips + admin link cluster)

**Analog (status-chip pattern):** `src/components/watch/WatchForm.tsx` L370–380 (self-reference)

**Status chip read-only pattern** (WatchForm.tsx L371–380):
```typescript
{lockedStatus ? (
  // Phase 20.1 D-12: status decision was made in the verdict step;
  // render a read-only chip rather than a Select.
  <div
    id="status"
    aria-readonly="true"
    className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize"
  >
    {lockedStatus}
  </div>
) : (
  <Select ...>
```

**Apply this SAME chip pattern** to brand (L329) and model (L344) fields when `watch.catalogId != null`:
```typescript
{watch.catalogId != null ? (
  <div
    aria-readonly="true"
    className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize"
  >
    {canonicalBrand ?? watch.brand}
  </div>
) : (
  <Input id="brand" value={formData.brand} onChange={...} placeholder="e.g., Omega" />
)}
```

**New `viewerIsAdmin` prop** — sourced server-side from `supabase.from('profiles').select('is_admin')` at the edit page. WatchForm gates the admin link cluster render on:
```typescript
{mode === 'edit' && watch.catalogId != null && viewerIsAdmin && (
  <div className="flex gap-2 mt-1">
    <Button variant="ghost" size="sm" render={<Link href={`/admin/brands#brand-${watch.brandId}`} />}>
      Edit brand
    </Button>
    <Button variant="ghost" size="sm" render={<Link href={`/admin/families?brandId=${watch.brandId}`} />}>
      Edit family
    </Button>
  </div>
)}
```

**RESEARCH Pitfall 4 recommendation:** Extend `getWatchById` to LEFT JOIN `brands` and `watchFamilies` and project `canonicalBrand: string | undefined` / `canonicalFamily: string | undefined`. Pass both as new props to `WatchForm`. Chip renders `canonicalBrand ?? watch.brand` for legacy-row safety.

---

### `src/components/watch/StructuredEntryPanel.tsx` (modified — brand Input → BrandPicker)

**Analog:** self at L220–228

**Existing brand Input to replace** (StructuredEntryPanel.tsx L220–228):
```typescript
<Input
  id="se-brand"
  value={brand}
  onChange={(e) => setBrand(e.target.value)}
  required
  aria-required="true"
  disabled={isExtracting}
/>
```

Replace with `<BrandPicker brands={brands} value={selectedBrand} onChange={...} onCouldntFind={...} />`. Panel gains a new prop: `brands: { id: string; name: string }[]`. The panel's `brand` string state (used in POST body) derives from `selectedBrand?.name ?? ''` or the typed value locked by `onCouldntFind`. POST body construction (`brand: brand.trim()`) is UNCHANGED — picker constrains what the user types, doesn't change what gets sent.

---

### `src/components/watch/AddWatchFlow.tsx` (modified — prop threading)

**Analog:** self at L70–92 (props interface) and L639 (StructuredEntryPanel mount)

**Current props interface** (AddWatchFlow.tsx L70–78):
```typescript
interface AddWatchFlowProps {
  // ...other props...
  /** Phase 69 D-13 — SSR-fetched catalog brand list for SearchEntry / parseSearchQuery SRCH-26 pre-seed. */
  catalogBrands: string[]
  /** SEED-018 — resolved server-side from profiles.is_admin; gates the catalog-only save option. */
  isAdmin: boolean
}
```

Add `brandsWithIds: { id: string; name: string }[]` alongside `catalogBrands`. Both flow from page SSR. Thread `brandsWithIds` down to the `<StructuredEntryPanel>` mount at L639 region.

**StructuredEntryPanel mount** (AddWatchFlow.tsx L637–643):
```typescript
<SearchEntry
  viewerUserId={viewerUserId}
  catalogBrands={catalogBrands}
  onPick={handleSearchPick}
  onSubmitStructured={handleStructuredSubmit}
  onSwitchToUrl={handleSwitchToUrl}
/>
```
`StructuredEntryPanel` is mounted from within `SearchEntry`'s no-match path (L344 area). The `brands` prop must be threaded through `SearchEntry` → `StructuredEntryPanel`, OR through `AddWatchFlow` → `SearchEntry` → `StructuredEntryPanel`. Planner picks the exact drill path based on current `SearchEntry` → `StructuredEntryPanel` prop surface.

---

### `src/app/watch/new/page.tsx` (modified — extend Promise.all)

**Analog:** self at L94–104

**Current Promise.all block** (watch/new/page.tsx L95–102):
```typescript
const supabase = await createSupabaseServerClient()
const [collection, catalogPrefill, viewerProfile, catalogBrands, profileAdminRow] =
  await Promise.all([
    getWatchesByUser(user.id),
    catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
    getProfileById(user.id),
    listCatalogBrands(),
    supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
  ])
const viewerUsername = viewerProfile?.username ?? null
const isAdmin = Boolean(profileAdminRow?.data?.is_admin)
```

Extend with `listBrands()` in the same `Promise.all(...)`. After rename, `listCatalogBrands()` becomes `listCatalogBrandNames()` (keeps string[] shape for `parseSearchQuery`). Both `catalogBrandNames` and `brandsWithIds` are prop-drilled through `<AddWatchFlow>`.

---

### `src/app/w/[ref]/edit/page.tsx` (modified — add isAdmin fetch)

**Analog:** `src/app/watch/new/page.tsx` L94–104 (isAdmin fetch pattern)

**Current edit page** (edit/page.tsx L1–34 — entire file):
```typescript
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById } from '@/data/watches'
import { WatchForm } from '@/components/watch/WatchForm'

export default async function EditWatchPage({ params }: EditWatchPageProps) {
  const { ref } = await params
  const user = await getCurrentUser()
  const watch = await getWatchById(user.id, ref)

  if (!watch) { notFound() }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Edit Watch</h1>
      <WatchForm watch={watch} mode="edit" />
    </div>
  )
}
```

Add `supabase.from('profiles').select('is_admin')` mirroring watch/new/page.tsx L94–104 pattern:
```typescript
const supabase = await createSupabaseServerClient()
const [watch, profileAdminRow] = await Promise.all([
  getWatchById(user.id, ref),
  supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
])
const isAdmin = Boolean(profileAdminRow?.data?.is_admin)
// ...
<WatchForm watch={watch} mode="edit" viewerIsAdmin={isAdmin} />
```

---

### `src/components/admin/AdminSubNav.tsx` (modified — 4 links)

**Analog:** self L12–15 (entire file, 40 lines)

**Current NAV_LINKS** (AdminSubNav.tsx L12–15):
```typescript
const NAV_LINKS = [
  { href: '/admin/lists', label: 'Curated Lists' },
  { href: '/admin/paths', label: 'Collection Paths' },
]
```

**Active state class** (AdminSubNav.tsx L30–32):
```typescript
className={cn(
  isActive && 'underline underline-offset-4 font-semibold text-foreground',
)}
```

Add two entries. Preserve the exact active state class verbatim:
```typescript
const NAV_LINKS = [
  { href: '/admin/lists', label: 'Curated Lists' },
  { href: '/admin/paths', label: 'Collection Paths' },
  { href: '/admin/brands', label: 'Brands' },    // NEW
  { href: '/admin/families', label: 'Families' }, // NEW
]
```
No other changes to the component. `pathname.startsWith(href)` active detection already works for the new paths.

---

### `src/data/catalog.ts` (modified — rename + new sibling)

**Analog:** self L1075–1081

**Existing function to rename** (catalog.ts L1075–1081):
```typescript
export async function listCatalogBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: watchesCatalog.brand })
    .from(watchesCatalog)
    .orderBy(asc(watchesCatalog.brand))
  return rows.map((r) => r.brand)
}
```

Rename to `listCatalogBrandNames()`. Keep signature and implementation identical — `parseSearchQuery` and `SearchEntry`'s `catalogBrands` prop consume the string[].

**New sibling `listBrands()`** (shape from `src/data/recommendations.ts` L164–165):
```typescript
export async function listBrands(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .orderBy(asc(brands.name))
  return rows
}
// No 'use cache' — same rationale as listCatalogBrandNames (cheap, per-request fresh)
```

Per `[[reexport-only-doesnt-bind-locally]]`: if `brands` table is imported from `@/db/schema`, verify the import is a direct `import { brands } from '@/db/schema'` (not a re-export-only pattern that would fail to bind locally). `npm run build` catches this; tests alone do not.

---

## Shared Patterns

### Authentication Gate
**Source:** `src/app/actions/cms/collectionPaths.ts` L65–80
**Apply to:** `src/app/actions/cms/brands.ts`, `src/app/actions/cms/families.ts` — every exported action

```typescript
try {
  await assertOwner()
} catch {
  return { success: false, error: 'Not authorized' }
}
```

This is the FIRST statement in every action, before Zod parse and before any DAL call. Never re-check inside DAL; assertOwner() is the sole gate (D-06).

### ActionResult Return Type
**Source:** `src/lib/actionTypes.ts` (via `@/lib/actionTypes` import in collectionPaths.ts L23)
**Apply to:** All new Server Action return types

```typescript
import type { ActionResult } from '@/lib/actionTypes'
// ActionResult<T> = { success: true; data: T } | { success: false; error: string }
```

Never throw across the Server Action boundary. Always return `ActionResult<T>`.

### Error Handling in Server Actions
**Source:** `src/app/actions/cms/collectionPaths.ts` L73–80
**Apply to:** `brands.ts`, `families.ts` — the inner try/catch after Zod parse

```typescript
try {
  // DAL call
  revalidatePath('/admin/brands')
  return { success: true, data: undefined }
} catch (err) {
  console.error('[actionName] unexpected error:', err)
  return { success: false, error: "Couldn't do X. Try again." }
}
```

### Toast Feedback Pattern
**Source:** `src/components/admin/ListIndexClient.tsx` L108–113 area (sonner `toast`)
**Apply to:** `BrandsQueue.tsx`, `FamiliesQueue.tsx`

```typescript
import { toast } from 'sonner'
// On success:
toast.success('Brand confirmed')
router.refresh()
// On failure:
toast.error(result.error ?? 'Something went wrong')
```

### Tailwind Dark-Mode Pairing
**Source:** Memory `[[button-outline-dark-override]]`
**Apply to:** Any `Button variant="outline"` or explicit `bg-*` override in new components

Pair every override: `<tw> dark:<tw>`. For selected/highlighted states, use `bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground` (not `bg-primary`).

### font-semibold Guardrail
**Source:** Memory `[[button-medium-guardrail]]`; `SearchEntry.tsx` L285 comment
**Apply to:** All new components — ALL text weight specifiers

No raw `font-medium`. Use `font-semibold` for label text, headings, and badge content. The `<Label>` primitive ships its own baseline weight internally.

### Alias Chip Stack
**Source:** Memory `[[space-y-inline-block-siblings]]`
**Apply to:** `FamiliesQueue.tsx` alias chip list in Add-Alias dialog

```typescript
// Use flex flex-wrap on parent, not space-y-*:
<div className="flex flex-wrap gap-2">
  {aliases.map((alias) => (
    <Badge key={alias} variant="secondary">
      {alias}
      <Button size="icon-sm" variant="ghost" onClick={() => handleRemove(alias)}>
        <X className="size-3" aria-hidden />
      </Button>
    </Badge>
  ))}
</div>
```

---

## No Analog Found

All 18 files/modifications have a close analog in the codebase. No files require fallback to RESEARCH.md patterns alone.

---

## Metadata

**Analog search scope:** `src/components/watch/`, `src/components/admin/`, `src/app/actions/cms/`, `src/app/admin/`, `src/app/watch/`, `src/app/w/`, `src/data/`
**Files read:** 18 source files + test files
**Pattern extraction date:** 2026-07-13

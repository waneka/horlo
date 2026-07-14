# Phase 82: Add-Watch UI + Operator Admin - Research

**Researched:** 2026-07-13
**Domain:** Next.js 16 App Router / @base-ui/react combobox / Drizzle transactions / CMS Server Actions
**Confidence:** HIGH

## Summary

Phase 82 is the final v8.4 phase. Its scope is well-defined in an exceptionally thorough CONTEXT.md. Research focused on verifying every file/line anchor, extracting the concrete `@base-ui/react/combobox` API surface `BrandPicker` must mirror from `SearchEntry`, confirming the Drizzle transaction pattern for brand merge, resolving the cache invalidation strategy for the new Server Actions, and surfacing two gaps CONTEXT left implicit: (1) the canonical brand name source for UI-03's read-only chip display (should the edit page add a JOIN or trust `watch.brand` post-DISP-02?), and (2) whether the `/admin/brands` and `/admin/families` pages need `await connection()` for PPR safety.

The existing admin pages (`/admin/lists`, `/admin/paths`) have NO `'use cache'` wrappers, no PPR opt-in, and use the simple Server Component + `router.refresh()` pattern. Phase 82's new pages inherit this same pattern — no `await connection()` needed. Cache invalidation for the new brand/family Server Actions is `revalidatePath('/admin/brands')` + `revalidatePath('/admin/families')` only — no tag surface (nothing consumes a `'admin:brands'` tag in the codebase). `updateTag` is not appropriate here (admin mutations are not read-your-own-writes per the 50ms router.refresh() delivery model).

**Primary recommendation:** Follow the ListIndexClient + collectionPaths Server Action patterns verbatim. Every anchor in CONTEXT.md was verified correct. The one non-trivial decision left to the planner: whether UI-03's read-only chip reads `watch.brand` (already canonical post-DISP-02) or adds a `brands.name` LEFT JOIN projection to `getWatchById` for legacy-row belt-and-suspenders.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-82-01: New `src/components/watch/BrandPicker.tsx`, ~120 lines, `@base-ui/react/combobox` primitive, same controlled-open pattern as SearchEntry. Props: `brands: { id: string; name: string }[]`, `value: { id: string; name: string } | null`, `onChange(next)`, `onCouldntFind(typed: string)` (optional — merge dialog omits it).
- D-82-02: SSR-fetch full `{ id, name }` brand list once per `/watch/new` request via new DAL function `listBrands()`. Client filters by substring. Rename existing `listCatalogBrands()` → `listCatalogBrandNames()` (keeps string[] shape). No per-keystroke round-trip.
- D-82-03: UI-02 auto-create fires on "Find specs" click via existing `/api/extract-watch` route — affordance click is UX-only (locks typed string, closes popup). Zero new route surface.
- D-82-04: Silent — no toast/hint/envelope field for the UI-02 auto-create path. Mirrors Phase 80 D-80-04.
- D-82-05: Affordance copy: `Couldn't find that brand — add as "{typed}"`. Placed as sibling of `Combobox.List` inside Popup (OUTSIDE the List). Gate: `filteredBrands.length === 0 && typed.trim().length > 0`. Ghost variant, min-h-[44px].
- D-82-06: UI-03 read-only chip gates on `watch.catalogId != null`. Chip className: `flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize`. Legacy `catalogId = null` rows keep editable Inputs.
- D-82-07: "Edit catalog mapping" link cluster gates on `mode === 'edit' && watch.catalogId != null && viewerIsAdmin`. Thread via new `viewerIsAdmin: boolean` prop on WatchForm. Source: `supabase.from('profiles').select('is_admin')` at edit page, mirroring `/watch/new` page L101 pattern.
- D-82-08: Two-link cluster: `<Button variant="ghost" size="sm" render={<Link .../>}>Edit brand</Button>` → `/admin/brands#brand-{brandId}`, "Edit family" → `/admin/families?brandId={brandId}`. Deep-link mechanics left to Claude's Discretion.
- D-82-09: Per-row Card + inline actions + Dialog for merge/rename. Mirrors `ListIndexClient.tsx` L145–220. `ORDER BY needs_review DESC, name ASC`. "Confirm as new": flip flag, `router.refresh()`. "Rename" + "Merge into…": Dialog. `AdminSubNav` grows to 4 links: adds `Brands` → `/admin/brands`, `Families` → `/admin/families`.
- D-82-10: Merge-target picker reuses `<BrandPicker>` verbatim (filter out source row client-side). OPS-02 does NOT include family-merge (roadmap language: rename + alias + confirm only).
- D-82-11: "Add alias" Dialog: existing aliases as removable `<Badge variant="secondary">` chips + `×` button + `<Input>` for new alias. Append: `UPDATE watch_families SET aliases = aliases || ARRAY[$1]::text[] WHERE id = $2 AND NOT (aliases @> ARRAY[$1]::text[])`. Remove: `array_remove`. Normalize: `trim().toLowerCase()`. Silent dedup no-op.
- D-82-12: Merge pre-flight: count families with `brand_id = source.id`. If > 0, Dialog asks: "Move all N families to target" (radio, default) or "Cancel". Transaction: `UPDATE watches_catalog SET brand_id=target WHERE brand_id=source; UPDATE watch_families SET brand_id=target WHERE brand_id=source; DELETE FROM brands WHERE id=source`. All in `db.transaction()`. If source has 0 families: skip prompt, single-step merge.
- D-82-13: `src/app/actions/cms/brands.ts` + `src/app/actions/cms/families.ts`, mirroring `collectionPaths.ts` structure. `assertOwner()` first, Zod `.strict()`, `ActionResult<T>`, `revalidatePath`, `console.error`. Actions: `confirmBrandAsNew`, `renameBrand`, `mergeBrand`; `confirmFamilyAsNew`, `renameFamily`, `addFamilyAlias`, `removeFamilyAlias`.
- D-82-14: Slug regeneration on rename via `slugifyWithRandomSuffix(name)`. Same for `watch_families.slug` (nullable).

### Claude's Discretion

- Exact scroll-to + highlight implementation for `/admin/brands#brand-{brandId}` deep-link
- Whether `AdminSubNav` becomes 4 flat links vs nested structure (recommendation: flat 4)
- Whether OPS-02 gains family-merge as opportunistic scope (recommendation: omit)
- Whether `SearchEntry` switches to `listBrands()` or keeps `listCatalogBrandNames()`
- Test surface split: unit tests (BrandPicker, WatchForm) vs local-fixture integration tests (Server Actions)
- Whether to add a `SlugField` primitive in rename dialogs (recommendation: omit)
- Alias normalization: `trim().toLowerCase()` must match resolver's `lower(trim($1))` SQL

### Deferred Ideas (OUT OF SCOPE)

- Family-merge (mergeFamilyIntoFamily)
- Bulk multi-select queue actions
- `/admin/brands/{id}` deep-page
- `<Typeahead>` primitive extracted from SearchEntry + BrandPicker
- Non-admin owner "request a canonical fix" surface
- Auto-suggest merge targets in queue
- Undo for merge / delete-source
- Alias search/sort inside Add-Alias dialog
- Highlight-flash animation on deep-link (scroll-into-view alone may suffice)
- `/admin/families?brandId=` filter chip UI "showing families of Brand X" banner

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | `StructuredEntryPanel` Brand field becomes typeahead autocomplete sourced from `brands.name` | Verified: `BrandPicker.tsx` mirrors SearchEntry's `@base-ui/react/combobox` 1.3.0 controlled-open pattern. Prop-drill path confirmed: page → AddWatchFlow → StructuredEntryPanel (L220). |
| UI-02 | "Couldn't find that brand — add as '{typed}'" affordance routes through INGEST-03 auto-create path | Verified: zero new backend surface; affordance fires via existing `/api/extract-watch` → `resolveBrandId` tier 3. Footer placement OUTSIDE `Combobox.List` required per SRCH-03 lesson. |
| UI-03 | `WatchForm` renders canonical brand/model as read-only chips when `catalogId != null`; admin-only "Edit catalog mapping" link | Verified: chip pattern mirrors status chip at L373–380. GAP: chip display source — see Open Questions. Edit page (`/w/[ref]/edit/page.tsx`) confirmed: does not yet fetch `isAdmin`. |
| OPS-01 | `/admin/brands` needs_review queue with Confirm / Rename / Merge | Verified: mirrors `ListIndexClient.tsx` L145–220 exactly. Transaction pattern confirmed via `db.transaction()` in `curatedLists.ts` L138, `collectionPaths.ts` L190. |
| OPS-02 | `/admin/families` needs_review queue with Confirm / Rename / Add-alias / Remove-alias | Verified: alias SQL shape confirmed via resolver Tier 2 (L249). `array_remove` idiom confirmed in resolver's family auto-create (L304). |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BrandPicker typeahead (UI-01) | Browser / Client | Frontend Server (SSR fetch) | Client filters from SSR-fetched brand list; no per-keystroke round-trip |
| UI-02 "Couldn't find" affordance | Browser / Client | API / Backend | Affordance is pure UX; auto-create fires server-side inside existing `/api/extract-watch` |
| UI-03 read-only chip + admin link | Browser / Client | Frontend Server (SSR) | WatchForm is a Client Component; `viewerIsAdmin` resolved server-side on edit page |
| /admin/brands queue rendering | Frontend Server (SSR) | — | Server Component fetches brands; client shell (`BrandsQueue`) owns interaction |
| /admin/families queue rendering | Frontend Server (SSR) | — | Same pattern as /admin/brands |
| Brand/family Server Actions | API / Backend | — | `assertOwner()` gate + Drizzle `db` client (bypasses RLS) |
| Brand merge transaction | Database / Storage | — | Multi-table atomic UPDATE + DELETE via `db.transaction()` |

## Standard Stack

### Core (all VERIFIED from codebase inspection)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react/combobox` | 1.3.0 [VERIFIED: package.json] | BrandPicker typeahead primitive | Already used in SearchEntry; identical API surface |
| `drizzle-orm` | installed [VERIFIED: codebase] | Drizzle `db.transaction()` for merge | All existing multi-step mutations use this pattern |
| `next/cache` (`revalidatePath`) | Next.js 16.2.3 | Invalidate admin queue pages after mutations | All existing CMS actions use `revalidatePath` only (no tag cache on admin pages) |
| `zod` | installed [VERIFIED: codebase] | `.strict()` schemas in Server Actions | Required by D-06 mass-assignment protection |
| `sonner` (`toast`) | installed [VERIFIED: codebase] | Success/error feedback in queue client | Used by `ListIndexClient.tsx` L108 |
| `@/lib/auth` (`assertOwner`) | local [VERIFIED: L70-79] | Auth gate on every CMS Server Action | Throws `UnauthorizedError`; caller wraps in try/catch |
| `@/lib/slug` (`slugifyWithRandomSuffix`) | local [VERIFIED: slug.ts] | Slug regeneration on rename | Used by resolver; guarantees no UNIQUE collision via random suffix |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` (`X`) | installed | Chip-remove icon in alias dialog | Alias remove button; `size="icon-sm"` Button wrapper |
| `next/navigation` (`useRouter`, `useSearchParams`) | Next.js 16 | `router.refresh()` after mutation; `?brandId=` filter read | All admin client shells use `useRouter().refresh()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `revalidatePath` for admin actions | `updateTag` | `updateTag` is only for Server Action read-your-own-writes (SA origin required); `revalidatePath` is the correct primitive for admin queue pages which have no `'use cache'` wrapper |
| Client-side substring filter | Server-side `/api/brands?q=` | ~100 brands, client filter is 0 round-trips; server only if list grows past 500 (D-82-02) |
| `Combobox.Empty` for affordance | Sibling button outside List | SRCH-03 lesson: Combobox.Empty is inside the list; clicks get swallowed; sibling placement is the only safe option |

## Architecture Patterns

### System Architecture Diagram

```
/watch/new (SSR page)
  └── Promise.all([listCatalogBrandNames(), listBrands(), ...])
      └── AddWatchFlow props: catalogBrands: string[], brandsWithIds: {id,name}[]
          └── StructuredEntryPanel props: brands: {id,name}[]
              └── BrandPicker (client)
                  ├── Combobox.Root (controlled open + filteredItems)
                  │   ├── Combobox.List (matches)
                  │   └── [sibling] "Couldn't find" button (zero-match gate)
                  │       └── onCouldntFind(typed) → panel locks typed, value.id=null
                  └── "Find specs" → POST /api/extract-watch
                                      └── resolveBrandId(brand) tier 3 auto-create
                                          └── brands row {needs_review: true}

/w/[ref]/edit (SSR page) [MODIFIED]
  └── getWatchById(user.id, ref) + supabase.from('profiles').select('is_admin')
      └── WatchForm mode="edit" watch={...} viewerIsAdmin={isAdmin}
          ├── catalogId != null → read-only chip (watch.brand)
          └── mode='edit' && catalogId && viewerIsAdmin → "Edit catalog mapping" cluster
              ├── <Link href="/admin/brands#brand-{watch.brandId}">Edit brand</Link>
              └── <Link href="/admin/families?brandId={watch.brandId}">Edit family</Link>

/admin/brands (SSR page)
  └── DAL: SELECT * FROM brands ORDER BY needs_review DESC, name ASC
      └── BrandsQueue (client)
          ├── Card per row (needs_review badge + name + country)
          ├── [Confirm] → confirmBrandAsNew(id) → revalidatePath('/admin/brands')
          ├── [Rename] → Dialog → renameBrand(id, name) → slug regen → revalidatePath
          └── [Merge into…] → Dialog
              ├── BrandPicker (target) — brands list minus source
              ├── Pre-flight: count families where brand_id=source
              │   ├── 0 families → single-step merge
              │   └── N families → radio: "Move all" | "Cancel"
              └── mergeBrand(sourceId, targetId, moveFamilies) → db.transaction()
                  → revalidatePath('/admin/brands') + revalidatePath('/admin/families')

/admin/families (SSR page)
  └── DAL: SELECT * FROM watch_families ORDER BY needs_review DESC, name ASC
      ├── optional ?brandId= param → filter to that brand's families
      └── FamiliesQueue (client)
          ├── Card per row (needs_review badge + name + brand + aliases[])
          ├── [Confirm] → confirmFamilyAsNew(id) → revalidatePath('/admin/families')
          ├── [Rename] → Dialog → renameFamily(id, name) → revalidatePath
          └── [Add alias] → Dialog
              ├── existing aliases as removable Badge chips (each calls removeFamilyAlias)
              └── Input + [Add alias] → addFamilyAlias(id, alias) → revalidatePath
```

### Recommended Project Structure

```
src/
├── components/
│   └── watch/
│       ├── BrandPicker.tsx          # NEW — UI-01/02 + OPS-01 merge target
│       └── StructuredEntryPanel.tsx # MODIFIED — brands prop + BrandPicker swap
├── app/
│   ├── admin/
│   │   ├── brands/
│   │   │   └── page.tsx             # NEW — OPS-01 server component
│   │   └── families/
│   │       └── page.tsx             # NEW — OPS-02 server component
│   ├── actions/
│   │   └── cms/
│   │       ├── brands.ts            # NEW — confirmBrandAsNew, renameBrand, mergeBrand
│   │       └── families.ts          # NEW — confirmFamilyAsNew, renameFamily, addFamilyAlias, removeFamilyAlias
│   └── w/[ref]/edit/
│       └── page.tsx                 # MODIFIED — add isAdmin fetch
├── components/
│   ├── admin/
│   │   ├── AdminSubNav.tsx          # MODIFIED — 4 links
│   │   ├── BrandsQueue.tsx          # NEW — client shell for /admin/brands
│   │   └── FamiliesQueue.tsx        # NEW — client shell for /admin/families
│   └── watch/
│       └── WatchForm.tsx            # MODIFIED — viewerIsAdmin prop + read-only chips
└── data/
    └── catalog.ts                   # MODIFIED — listCatalogBrands→listCatalogBrandNames + new listBrands()
```

### Pattern 1: Controlled-Open Combobox (BrandPicker)

`SearchEntry.tsx` is the canonical pattern source. `BrandPicker` copies this structure with client-side filtering instead of server-side fetching.

```typescript
// Source: src/components/watch/SearchEntry.tsx L207–338 [VERIFIED]
// BrandPicker.tsx adaptation:

'use client'
import { useState, useMemo } from 'react'
import { Combobox } from '@base-ui/react/combobox'

interface Brand { id: string; name: string }

interface BrandPickerProps {
  brands: Brand[]
  value: Brand | null
  onChange: (next: Brand) => void
  onCouldntFind?: (typed: string) => void  // optional — merge dialog omits
}

export function BrandPicker({ brands, value, onChange, onCouldntFind }: BrandPickerProps) {
  const [inputValue, setInputValue] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)

  // Client-side substring filter (D-82-02)
  const filteredBrands = useMemo(() =>
    brands.filter(b => b.name.toLowerCase().includes(inputValue.toLowerCase().trim())),
    [brands, inputValue]
  )

  return (
    <Combobox.Root<Brand>
      inputValue={inputValue}
      onInputValueChange={(val, details) => {
        // Mirror SearchEntry L216 — ignore non-input-change reasons
        if (details.reason !== 'input-change') return
        setInputValue(val)
      }}
      filteredItems={filteredBrands}
      filter={null}                       // disable internal string-match
      itemToStringLabel={(b) => b.name}
      itemToStringValue={(b) => b.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      onValueChange={(picked) => {
        if (picked) onChange(picked)
      }}
      open={open}
      onOpenChange={(next) => setOpen(next)}
      value={value}
    >
      <Combobox.Input
        value={inputValue}
        // ... className per design system
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup>
            {filteredBrands.length > 0 && (
              <Combobox.List>
                {filteredBrands.map((b) => (
                  <Combobox.Item key={b.id} value={b}
                    className="... data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    {b.name}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            )}

            {/* UI-02 affordance: SIBLING of List — OUTSIDE listbox per SRCH-03 [VERIFIED]
                SearchEntry L326-334: button placed as sibling to prevent click swallowing */}
            {filteredBrands.length === 0 && inputValue.trim().length > 0 && onCouldntFind && (
              <button
                type="button"
                onClick={() => {
                  onCouldntFind(inputValue.trim())
                  setOpen(false)
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm
                           text-muted-foreground hover:bg-muted hover:text-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           min-h-[44px]"
              >
                Couldn&apos;t find that brand — add as &ldquo;{inputValue.trim()}&rdquo;
              </button>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
```

**Key @base-ui/react/combobox 1.3.0 API facts [VERIFIED: node_modules/@base-ui/react/combobox/root/ComboboxRoot.d.ts]:**
- `filteredItems?: readonly any[]` — bypasses internal filter when provided
- `filter?: null | ((itemValue, query, itemToString?) => boolean)` — `null` disables internal match
- `open?: boolean` — controlled open state
- `onOpenChange?: (open: boolean, eventDetails) => void`
- `onInputValueChange?: (inputValue: string, eventDetails) => void` — `eventDetails.reason` values include `'input-change'`
- `value` — controlled selected value
- `onValueChange?: (value, eventDetails) => void`
- `itemToStringLabel`, `itemToStringValue`, `isItemEqualToValue` — object value helpers
- `Combobox.Empty` EXISTS in installed package but is NOT used by `SearchEntry` (empty state is handled manually with conditional rendering — the SRCH-03 lesson is why)

### Pattern 2: CMS Server Action File

```typescript
// Source: src/app/actions/cms/collectionPaths.ts L1-80 [VERIFIED]
'use server'

// CRITICAL: assertOwner() is the SOLE enforced security gate. See collectionPaths.ts L2-8 for full rationale.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import { db } from '@/db'
import { brands } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'
import { slugifyWithRandomSuffix } from '@/lib/slug'
import type { ActionResult } from '@/lib/actionTypes'

const confirmBrandSchema = z.object({ id: z.string().uuid() }).strict()

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

**Key: `revalidatePath` is the correct primitive for admin queue pages** [VERIFIED: Next.js 16 docs + codebase]. The admin pages have no `'use cache'` wrapper — they are standard dynamic Server Components. `revalidatePath` triggers a fresh render on next visit. `updateTag` is only valid inside Server Actions for read-your-own-writes (different semantics; not applicable here per Next.js 16 `updateTag.md`). `revalidateTag(tag, 'max')` is SWR for globally cached content — not applicable.

### Pattern 3: Drizzle Transaction for Brand Merge

```typescript
// Source: src/data/curatedLists.ts L138 + src/data/collectionPaths.ts L190 [VERIFIED]
// db.transaction(async (tx) => { tx.update(...).set(...).where(...) })

export async function mergeBrandInDb(sourceId: string, targetId: string, moveFamilies: boolean) {
  await db.transaction(async (tx) => {
    // Step 1: Move all watches_catalog rows
    await tx.execute(sql`
      UPDATE watches_catalog
      SET brand_id = ${targetId}
      WHERE brand_id = ${sourceId}
    `)

    // Step 2 (conditional): Move all watch_families rows
    if (moveFamilies) {
      await tx.execute(sql`
        UPDATE watch_families
        SET brand_id = ${targetId}
        WHERE brand_id = ${sourceId}
      `)
    }

    // Step 3: Delete the source brand
    // RESTRICT FK from watch_families.brand_id — must move families FIRST
    await tx.execute(sql`
      DELETE FROM brands WHERE id = ${sourceId}
    `)
  })
}
```

**Critical ordering note:** `watch_families.brand_id` has `onDelete: 'restrict'` [VERIFIED: schema.ts L545]. The DELETE in step 3 will fail if any watch_families rows still reference `sourceId`. When `moveFamilies=false` (operator chose "Cancel"), the action returns `{ success: false, error: ... }` before entering the transaction. When `moveFamilies=true`, step 2 runs before step 3 — safe. When source has 0 families, step 3 runs directly without step 2.

**The `[[drizzle-sql-any-array-pitfall]]` does NOT apply here** — this merge uses `WHERE brand_id = ${sourceId}` (single value binding, not array spread). No `= ANY(...)` pattern.

### Pattern 4: Alias Array SQL

```typescript
// Verified against catalog-resolver.ts Tier 2 L243-249 [VERIFIED]
// The alias lookup in the resolver is:
//   WHERE aliases @> ARRAY[lower(trim(${effectiveModel}))]::text[]
// The add-alias must produce entries that this WHERE clause can match.

// Add alias (dedup guard built into WHERE):
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

**Normalization consistency:** D-82-11 chose `trim().toLowerCase()`. The resolver Tier 2 uses `lower(trim(${effectiveModel}))` [VERIFIED: catalog-resolver.ts L249]. These are equivalent. Aliases added via the admin UI must be pre-normalized before storage, otherwise the containment query won't match on fuzzy inputs (the resolver normalizes at query time, not at storage time).

**The `[[drizzle-sql-any-array-pitfall]]` does NOT apply here** — this is a single-element `ARRAY[value]::text[]` literal, not `= ANY(${arr})` spread. Same safety note as resolver L243 comment.

### Pattern 5: Admin Layout Inheritance + PPR Safety

```typescript
// Source: src/app/admin/layout.tsx [VERIFIED — full file read]
// Phase 82's /admin/brands and /admin/families inherit this layout automatically.
// No modification needed.

export default async function AdminLayout({ children }) {
  try {
    await assertOwner()
  } catch {
    redirect('/')
  }
  return <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
}
```

**PPR / `await connection()` question:** The existing `/admin/lists` and `/admin/paths` pages do NOT use `await connection()` [VERIFIED: codebase search]. They are standard dynamic Server Components — auth-gated via `assertOwner()` in the layout. The `await connection()` opt-out pattern is only needed for routes that are also wrapped with `'use cache'` or that have PPR-prerendered static shells that would serve stale content. Admin pages are NOT PPR-wrapped. Phase 82's new `/admin/brands` and `/admin/families` pages do NOT need `await connection()`.

### Pattern 6: AdminSubNav Extension

```typescript
// Source: src/components/admin/AdminSubNav.tsx L12-15 [VERIFIED]
// Current NAV_LINKS array — flat 4-link extension:

const NAV_LINKS = [
  { href: '/admin/lists', label: 'Curated Lists' },
  { href: '/admin/paths', label: 'Collection Paths' },
  { href: '/admin/brands', label: 'Brands' },      // NEW
  { href: '/admin/families', label: 'Families' },   // NEW
]
// Active state: pathname.startsWith(href) → 'underline underline-offset-4 font-semibold text-foreground'
// Inactive: ghost variant Button, size="sm"
```

### Pattern 7: Deep-Link Scroll + Highlight

```typescript
// Recommended pattern for /admin/brands page client shell (BrandsQueue):
// useEffect on mount reads window.location.hash; scrollIntoView if found.

'use client'
import { useEffect, useRef } from 'react'

// In BrandsQueue component:
useEffect(() => {
  const hash = window.location.hash  // '#brand-{id}'
  if (!hash.startsWith('#brand-')) return
  const id = hash.slice('#brand-'.length)
  const el = document.getElementById(`brand-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Brief bg-accent flash — data-attribute approach (Deferred/Discretion per CONTEXT)
    el.dataset.highlighted = 'true'
    const timer = setTimeout(() => { delete el.dataset.highlighted }, 1000)
    return () => clearTimeout(timer)
  }
}, [])  // empty deps — runs once on mount; hash is stable

// Row Card gets id="brand-{brand.id}" for targeting
// Tailwind: data-[highlighted=true]:bg-accent/30 data-[highlighted=true]:dark:bg-accent/20
// transition-colors duration-300 on the Card
```

**`[[router-cache-stale-instance]]` consideration:** The deep-link effect runs on mount. On revisit via soft-nav, the Router Cache may restore the same client component instance without remounting. The `useEffect` with empty deps fires only on true mount. For the deep-link use case this is acceptable — a revisit from a different URL will still mount fresh. The operator workflow (WatchForm "Edit brand" click → new navigation → /admin/brands) always fires a fresh mount.

### Pattern 8: `/admin/families?brandId=` Filter

```typescript
// Source: src/components/search/useSearchState.ts L87-88 [VERIFIED]
// useSearchParams() requires <Suspense> boundary when used in a page.
// The existing /search page wraps SearchPageClient in <Suspense> per the pattern.

// /admin/families/page.tsx (Server Component):
// searchParams is a Promise in Next.js 16
interface FamiliesPageProps {
  searchParams: Promise<{ brandId?: string }>
}
export default async function AdminFamiliesPage({ searchParams }: FamiliesPageProps) {
  const sp = await searchParams
  const brandIdFilter = sp.brandId ?? null
  const families = await listFamiliesForQueue(brandIdFilter)  // new DAL function
  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Families</h1>
      <FamiliesQueue families={families} brandIdFilter={brandIdFilter} />
    </>
  )
}
// No useSearchParams() needed in the Server Component — searchParams prop is the pattern.
// FamiliesQueue client shell does NOT need useSearchParams() for the initial filter value
// because it's passed as a prop from SSR.
```

### Pattern 9: UI-03 Read-Only Chip

```typescript
// Source: WatchForm.tsx L370-380 [VERIFIED — status chip pattern]
// The exact chip className from the existing status chip:
//   aria-readonly="true" className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize"

// UI-03 application in WatchForm:
{watch.catalogId != null ? (
  <div aria-readonly="true"
    className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize">
    {watch.brand}
  </div>
) : (
  <Input id="brand" value={formData.brand} onChange={...} placeholder="e.g., Omega" />
)}
```

### Anti-Patterns to Avoid

- **Placing the UI-02 affordance INSIDE `Combobox.List`:** SRCH-03 lesson: listbox-internal placement swallows clicks in real browsers (jsdom-tolerant but prod-broken). Must be a sibling of `Combobox.List` inside `Combobox.Popup`.
- **Using `Combobox.Empty` for the affordance:** `Combobox.Empty` renders inside the list context (same swallowed-click risk); the affordance needs a `<button type="button">` sibling, not `Combobox.Empty`.
- **Using `updateTag` for /admin/brands queue invalidation:** `updateTag` is Server Action only, for read-your-own-writes scenarios. Admin mutations don't need immediate RSC payload refresh via `updateTag` — `revalidatePath` triggers a fresh fetch on the next navigation, which `router.refresh()` triggers immediately.
- **Forgetting to move watch_families rows before DELETE FROM brands:** `watch_families.brand_id` has `onDelete: 'restrict'`. Transaction step order matters: UPDATE watch_families THEN DELETE brands (when moveFamilies=true).
- **Regex-unsafe brand names in the alias array:** Aliases are stored lowercased plain strings — no regex. The resolver uses `@>` containment, not regexp.
- **`export { x } from 'X'` without local import:** `[[reexport-only-doesnt-bind-locally]]` — if any new helper is re-exported from `catalog.ts` or `slug.ts`, in-file callers still need their own `import`. `npm run build` catches this.
- **`bg-primary` for selected state in merge radio:** `[[accent-is-active-token]]` — use `bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground` for the pre-flight radio selected state.
- **Unpaired Button outline override in dark mode:** `[[button-outline-dark-override]]` — any explicit `bg-*` override on a Button needs a paired `dark:bg-*`.
- **`space-y-*` on inline chip list:** `[[space-y-inline-block-siblings]]` — alias chip list needs `flex flex-wrap gap-2` on the parent, not `space-y-*`.
- **`font-medium` in new components:** `[[button-medium-guardrail]]` — use `font-semibold`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug uniqueness on rename | Retry-on-conflict loop | `slugifyWithRandomSuffix(name)` | Already handles UNIQUE collision via 6-char random suffix; no retry needed |
| Admin auth check | Custom session check in Server Action | `assertOwner()` from `@/lib/auth` | Sole enforced gate; layout guard is UX-only |
| Atomic multi-table mutation | Manual BEGIN/COMMIT SQL | `db.transaction(async (tx) => { ... })` | Existing pattern in curatedLists + collectionPaths |
| Array dedup in Postgres | Application-side dedup | `WHERE NOT (aliases @> ARRAY[value]::text[])` | Single-statement atomic dedup |
| Alias removal | Custom array filter | `array_remove(aliases, value)` | Postgres native; no drizzle-sql-any-array risk |

## Common Pitfalls

### Pitfall 1: Combobox.Empty vs footer button
**What goes wrong:** Using `Combobox.Empty` for the UI-02 affordance works in jsdom tests but swallows clicks in real browsers (listbox context intercepts pointer events).
**Why it happens:** `Combobox.Empty` renders inside the listbox role; native click semantics are intercepted by the combobox's keyboard/pointer management.
**How to avoid:** Render affordance as a `<button type="button">` sibling of `Combobox.List` inside `Combobox.Popup`, gated by `filteredBrands.length === 0 && inputValue.trim().length > 0`. Mirror SearchEntry L326–334 exactly.
**Warning signs:** Test passes in vitest/jsdom but affordance click does nothing on prod.

### Pitfall 2: brand merge RESTRICT FK violation
**What goes wrong:** `DELETE FROM brands WHERE id=sourceId` throws a FK violation if any `watch_families.brand_id = sourceId` remains.
**Why it happens:** `watch_families.brand_id` has `onDelete: 'restrict'` [VERIFIED: schema.ts L545].
**How to avoid:** Transaction order: `UPDATE watch_families SET brand_id=targetId WHERE brand_id=sourceId` BEFORE `DELETE FROM brands`. Pre-flight count is UX safeguard; the transaction ordering is the actual safety net.
**Warning signs:** `mergeBrand` returns `{ success: false, error: "Couldn't merge brand" }` with a FK violation in `console.error`.

### Pitfall 3: Alias normalization mismatch
**What goes wrong:** Operator adds alias `"Submariner"` (mixed case) via UI. The resolver's Tier 2 query uses `ARRAY[lower(trim(${effectiveModel}))]::text[]`, which sends `"submariner"` — no match against stored `"Submariner"`.
**Why it happens:** Aliases are stored as-is; the resolver normalizes at query time only on the search input, not the stored values.
**How to avoid:** Server Action normalizes before storage: `alias.trim().toLowerCase()`. D-82-11 already specifies this. The `updateTag` D-82-11 SQL uses `${normalizedAlias}` which is the pre-lowercased value. The family auto-create also stores `'{}'::text[]` empty — future adds go through the Server Action which normalizes.
**Warning signs:** Operator adds alias, subsequent ingests don't resolve via alias tier despite exact string match (differs in case).

### Pitfall 4: watch.brand vs canonical JOIN for UI-03 chip display
**What goes wrong:** `WatchForm` shows `watch.brand` in the read-only chip. For a legacy watch where Phase 81's DISP-02 overwrite hasn't run (e.g. pre-Phase-81 edit that didn't touch brand), `watch.brand` may be a non-canonical spelling.
**Why it happens:** `getWatchById` projects `brandId`/`familyId` but NOT `brands.name` [VERIFIED: watches.ts L208–228]. The canonical name is only in the `brands` table.
**Planner decision required:** Two options:
  - (A) Trust `watch.brand` — it is canonical for all writes post-Phase-81; legacy rows are rare and will normalize on next edit. Simpler, no DAL change needed.
  - (B) Extend `getWatchById` to LEFT JOIN `brands` and project `brandName`, pass it to WatchForm as a separate prop. Belt-and-suspenders per CONTEXT guidance. Adds ~5 lines to DAL + 1 WatchForm prop.
CONTEXT explicitly says "display should not depend on Phase 81's write-time overwrite having landed". **Recommendation: Option B** — add `brandName: brands.name` and `familyName: watchFamilies.name` projections to `getWatchById`, pass as `canonicalBrand: string | undefined` / `canonicalFamily: string | undefined` to `WatchForm`. WatchForm chip renders `canonicalBrand ?? watch.brand`.

### Pitfall 5: assertOwner() return value shape
**What goes wrong:** Code destructures a field from `assertOwner()` that doesn't exist, causing a type error.
**Why it happens:** `assertOwner()` returns `Promise<{ id: string; email: string }>` [VERIFIED: auth.ts L70]. Only `id` and `email` are available.
**How to avoid:** The CMS Server Actions don't need to use the return value — just `await assertOwner()` and ignore the return. Never attempt to read `is_admin` or `username` from it.
**Warning signs:** TypeScript error `Property 'X' does not exist on type '{ id: string; email: string }'`.

### Pitfall 6: `slugifyWithRandomSuffix` is server-only
**What goes wrong:** Importing `slugifyWithRandomSuffix` in a client component throws a build error.
**Why it happens:** `src/lib/slug.ts` has `import 'server-only'` [VERIFIED: slug.ts L3] + uses `node:crypto`.
**How to avoid:** Call `slugifyWithRandomSuffix` only inside Server Actions (`brands.ts` / `families.ts`). The `BrandPicker` client component NEVER imports from `@/lib/slug`.
**Warning signs:** `Module not found: Can't resolve 'server-only'` at build time.

### Pitfall 7: router.refresh() after Server Action does not use `useState`-mirrored lists
**What goes wrong:** Admin queue shows stale list after Confirm/Rename because local `useState` list is not updated.
**Why it happens:** `router.refresh()` updates the Server Component's RSC payload (re-runs the DAL fetch), but client components that copied the list to `useState` won't re-read the updated prop automatically (mirrors ListEditorClient L125 comment pattern).
**How to avoid:** For queue client shells (`BrandsQueue`, `FamiliesQueue`), do NOT copy the `brands`/`families` prop to `useState`. Let the Server Component re-fetch drive the list (via `router.refresh()` which triggers RSC refresh). The component re-renders with fresh `brands` prop. This differs from `ListIndexClient` which DOES copy to `useState` for optimistic reorder — the queue doesn't need optimistic updates.

## Code Examples

### assertOwner() first-statement pattern
```typescript
// Source: src/app/actions/cms/collectionPaths.ts L65-69 [VERIFIED]
export async function confirmBrandAsNew(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  // ... Zod parse, then DAL call
}
```

### Drizzle ORM update with Drizzle query builder (vs raw sql``)
```typescript
// Source: src/data/curatedLists.ts L138-141 [VERIFIED]
// For simple single-table updates, prefer Drizzle query builder over sql``:
await db.update(brands).set({ needsReview: false }).where(eq(brands.id, id))
await db.update(brands).set({ name: newName, slug: slugifyWithRandomSuffix(newName) }).where(eq(brands.id, id))
// For the merge (multi-table + DELETE), use db.transaction with sql`` execute
```

### listBrands() new DAL function
```typescript
// Source: src/data/catalog.ts L1075-1081 [VERIFIED — listCatalogBrands pattern]
// New sibling function:
export async function listBrands(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .orderBy(asc(brands.name))
  return rows
}
// No 'use cache' — same rationale as listCatalogBrands (cheap, per-request fresh)
// Source of "SELECT id, name FROM brands" shape: src/data/recommendations.ts L164-165 [VERIFIED]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidateTag(tag)` single-arg | `revalidateTag(tag, 'max')` or `updateTag(tag)` | Next.js 16 | Single-arg deprecated; admin actions use `revalidatePath` (no tag cache) |
| watch.brand as display source | canonical `brands.name` via JOIN | Phase 81/82 | Read-only chips should source from JOIN for legacy-row safety |
| `listCatalogBrands(): string[]` | + new `listBrands(): {id,name}[]` | Phase 82 | Both coexist; `parseSearchQuery` keeps string[]; BrandPicker uses {id,name}[] |

**Deprecated/outdated:**
- `Combobox.Empty` for affordance rendering: produces click-swallow in prod; use sibling button pattern.
- `filteredItems` without `filter={null}`: base-ui applies its own filter ON TOP of `filteredItems` unless `filter={null}` is set explicitly [VERIFIED: AriaCombobox.d.ts L141, L145].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `watch.brand` is sufficiently canonical for UI-03 display for all post-Phase-81 writes | Pitfall 4 | Minor: pre-Phase-81 legacy rows may show non-canonical spelling in chip. Option B mitigates. |
| A2 | `/admin/brands` and `/admin/families` do not need `await connection()` because they have no `'use cache'` wrapper and are not PPR-prerendered | Pattern 5 | If PPR is added later, this would need revisiting. Currently safe. |

**All other claims in this research were verified via direct codebase inspection or official Next.js 16 docs.**

## Open Questions

1. **Canonical display source for UI-03 chip (Pitfall 4)**
   - What we know: `getWatchById` does NOT project `brands.name`; `watch.brand` is canonical for all post-Phase-81 writes but may be stale for older rows.
   - What's unclear: Whether extending `getWatchById` to LEFT JOIN `brands`/`watch_families` for canonical names is worth the DAL change vs. trusting `watch.brand`.
   - Recommendation: Extend `getWatchById` (Option B). The edit page already has a `leftJoin(watchesCatalog, ...)` — adding two more LEFT JOINs on `brands` and `watchFamilies` is minimal cost and eliminates the legacy-row ambiguity CONTEXT explicitly flagged.

2. **`watch_families.slug` regeneration on rename**
   - What we know: `watch_families.slug` is nullable [VERIFIED: schema.ts L551]. The resolver does NOT use family slug for any lookup. No route references family slug.
   - What's unclear: Whether to regenerate family slug on rename (adds complexity) or leave it null/stale.
   - Recommendation: Leave family slug unchanged on rename (or set to `slugify(newName)` without random suffix since the nullable column has no UNIQUE constraint). Resolver doesn't need it; skip `slugifyWithRandomSuffix` overhead for families.

3. **FamiliesQueue DAL: scope to `brandId` filter**
   - What we know: OPS-02 page receives `?brandId=` from WatchForm "Edit family" link.
   - What's unclear: Whether to add a `listFamiliesForQueue(brandIdFilter?: string)` DAL function that optionally filters by `brand_id`, or fetch all families and let the client filter.
   - Recommendation: Server-side filter — with ~200+ families, fetching all and client-filtering is fine at current scale, but a WHERE clause is cleaner. Add optional `brandIdFilter` param to the DAL function.

## Environment Availability

This phase is UI + Server Action only. No schema migrations, no new services, no external tools beyond what's already used by the project.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase | Local-first verification | ✓ | running per CLAUDE.md | — |
| `@base-ui/react` | BrandPicker | ✓ | 1.3.0 [VERIFIED] | — |
| `next/cache` `revalidatePath` | Server Actions | ✓ | Next.js 16.2.3 | — |
| Seeded needs_review row | Manual OPS-01/02 verification | Seedable | — | Seed via direct SQL or trigger via UI-02 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (configured, existing test suite) |
| Config file | vitest.config.ts (inferred from existing tests) |
| Quick run command | `npx vitest run src/components/watch/BrandPicker.test.tsx src/app/actions/__tests__/cms-brands.test.ts src/app/actions/__tests__/cms-families.test.ts --reporter=verbose` |
| Full suite command | `npx vitest run` then `npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | BrandPicker renders with brands list; filters by substring; selecting a brand calls onChange | unit/jsdom | `npx vitest run src/components/watch/BrandPicker.test.tsx` | ❌ Wave 0 |
| UI-01 | BrandPicker popup opens on input focus; closes on selection | unit/jsdom | same | ❌ Wave 0 |
| UI-02 | Affordance button renders when filteredBrands.length=0 && typed.length>0; hidden when matches exist | unit/jsdom | `npx vitest run src/components/watch/BrandPicker.test.tsx` | ❌ Wave 0 |
| UI-02 | Affordance click calls onCouldntFind(typed) AND popup closes (assert-disappearance-too) | unit/jsdom | same | ❌ Wave 0 |
| UI-03 | WatchForm with catalogId!=null renders read-only chip, not Input, for brand/model | unit/jsdom | `npx vitest run src/components/watch/WatchForm.test.tsx` | ❌ Wave 0 |
| UI-03 | viewerIsAdmin=false: no admin link cluster rendered | unit/jsdom | same | ❌ Wave 0 |
| UI-03 | viewerIsAdmin=true + mode='edit' + catalogId!=null: admin link cluster renders | unit/jsdom | same | ❌ Wave 0 |
| UI-03 | catalogId=null: Input fields still editable | unit/jsdom | same | ❌ Wave 0 |
| OPS-01 | confirmBrandAsNew: unauth returns { success:false, error:'Not authorized' } | unit | `npx vitest run src/app/actions/__tests__/cms-brands.test.ts` | ❌ Wave 0 |
| OPS-01 | renameBrand: unknown key rejected by Zod .strict() | unit | same | ❌ Wave 0 |
| OPS-01 | mergeBrand: unauth returns { success:false, error:'Not authorized' } | unit | same | ❌ Wave 0 |
| OPS-02 | addFamilyAlias: unauth returns { success:false, error:'Not authorized' } | unit | `npx vitest run src/app/actions/__tests__/cms-families.test.ts` | ❌ Wave 0 |
| OPS-02 | removeFamilyAlias: unauth returns { success:false, error:'Not authorized' } | unit | same | ❌ Wave 0 |
| OPS-01 | StructuredEntryPanel: brands prop threads to BrandPicker | unit/jsdom | `npx vitest run src/components/watch/StructuredEntryPanel.test.tsx` | ⚠️ extend existing |
| OPS-01 | Merge transaction: source brand + 1 family + 1 catalog row → after mergeBrand: target has both refs, source deleted | integration | local Supabase fixture test | ❌ Wave 0 (optional) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/watch/BrandPicker.test.tsx src/app/actions/__tests__/cms-brands.test.ts src/app/actions/__tests__/cms-families.test.ts` + `npm run build`
- **Per wave merge:** `npx vitest run` + `npm run build`
- **Phase gate:** `npm run build` exit 0 + local-first walkthrough (CLAUDE.md §Local-First Development)

### Wave 0 Gaps

- [ ] `src/components/watch/BrandPicker.test.tsx` — covers UI-01/02: filter rendering, selection, affordance mount+close, assert-disappearance-too per `[[assert-disappearance-too]]`
- [ ] `src/components/watch/WatchForm.test.tsx` — covers UI-03: chip render, admin link visibility gate (4 test cases above)
- [ ] `src/app/actions/__tests__/cms-brands.test.ts` — covers OPS-01: unauth gate, Zod .strict() rejection for all 3 actions
- [ ] `src/app/actions/__tests__/cms-families.test.ts` — covers OPS-02: unauth gate, Zod .strict() rejection for all 4 actions
- [ ] Extend `src/components/watch/StructuredEntryPanel.test.tsx` — add test for `brands` prop threading to BrandPicker

**Note:** Integration test for merge transaction atomicity is recommended but optional at MVP scale. The unit test mocking `db` covers the auth gate; the local-first walkthrough covers the actual SQL correctness.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `assertOwner()` — sole gate on every Server Action; throws `UnauthorizedError` on non-admin |
| V3 Session Management | no | Session managed by Supabase SSR client; no new session surface |
| V4 Access Control | yes | `assertOwner()` + admin layout redirect (UX) + Drizzle `db` client (bypasses RLS, auth is the gate) |
| V5 Input Validation | yes | Zod `.strict()` schemas on all Server Actions; Zod uuid() on brand/family IDs |
| V6 Cryptography | no | No new crypto; slug uses `node:crypto.randomUUID()` (existing, safe) |

### Known Threat Patterns for Phase 82

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized brand merge (attacker calls Server Action directly) | Elevation of Privilege | `assertOwner()` as FIRST statement — returns `{ success:false, error:'Not authorized' }` before any DAL call |
| Mass-assignment (extra keys in rename/merge payload) | Tampering | Zod `.strict()` rejects unknown keys |
| Brand/family ID confusion (wrong UUID targets) | Tampering | Zod `z.string().uuid()` validates IDs; DB FK constraints catch referential errors |
| Admin link exposure to non-admin editors | Information Disclosure | `viewerIsAdmin` prop sourced server-side at page render; WatchForm gates render on prop value |

## Sources

### Primary (HIGH confidence)
- `src/components/watch/SearchEntry.tsx` L202–338 — `@base-ui/react/combobox` controlled-open pattern (directly verified)
- `src/components/watch/StructuredEntryPanel.tsx` L210–228 — Brand Input anchor (verified: correct)
- `src/components/watch/WatchForm.tsx` L328–380 — Brand/model fields + status chip pattern (verified: correct)
- `src/components/admin/ListIndexClient.tsx` L145–220 — Card + actions pattern (verified)
- `src/app/actions/cms/collectionPaths.ts` L1–80 — Server Action canonical pattern (verified)
- `src/lib/auth.ts` L70–79 — `assertOwner()` return shape `{ id: string; email: string }` (verified)
- `src/data/catalog.ts` L1075–1081 — `listCatalogBrands()` shape (verified; rename target)
- `src/data/catalog-resolver.ts` L54–204 — Brand resolver 3-tier (verified; alias tier L243–249)
- `src/lib/slug.ts` — `slugifyWithRandomSuffix` (verified: server-only, `${slugify(name)}-${6hexchars}`)
- `src/db/schema.ts` L519–564 — `brands` + `watchFamilies` table shapes (verified)
- `src/data/watches.ts` L201–230 — `getWatchById` does NOT project `brands.name` (verified; GAP)
- `src/components/admin/AdminSubNav.tsx` — 2-link NAV_LINKS (verified; extension anchor)
- `src/app/admin/layout.tsx` — `assertOwner()` layout guard (verified; no modification needed)
- `node_modules/@base-ui/react/combobox/root/ComboboxRoot.d.ts` — `filteredItems`, `filter`, `open`, `onOpenChange`, `onInputValueChange`, `value`, `onValueChange`, `itemToStringLabel` API (verified)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — `revalidateTag(tag, 'max')` is SWR; single-arg deprecated (verified)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — `updateTag` is SA-only for read-your-own-writes (verified)
- `src/data/curatedLists.ts` L138, `src/data/collectionPaths.ts` L190 — `db.transaction(async (tx) => { ... })` pattern (verified)
- `src/app/actions/__tests__/cms-curatedLists.test.ts` — canonical CMS test mock pattern (verified)

### Secondary (MEDIUM confidence)
- Context7 `@base-ui/react` docs — Combobox controlled-open + filteredItems conceptual overview (confirmed by installed d.ts files)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from installed node_modules + codebase
- Architecture: HIGH — all file/line anchors confirmed by direct read
- Pitfalls: HIGH — all verified from codebase evidence (SRCH-03 comment in SearchEntry, schema FK definition, etc.)

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (Next.js 16 / @base-ui 1.x — stable APIs; 30-day window)

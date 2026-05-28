# Phase 59: Unified Route (Variant C) - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 6 new/modified files + 26 link-literal sites across 21 files
**Analogs found:** 5 / 6 (package.json has no close analog — it is a script field edit)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/w/[ref]/page.tsx` | page (RSC) | request-response | `src/app/watch/[id]/page.tsx` + `src/app/catalog/[catalogId]/page.tsx` | exact merge |
| `src/app/w/[ref]/edit/page.tsx` | page (RSC) | request-response | `src/app/watch/[id]/edit/page.tsx` | exact copy |
| `src/data/watches.ts` (add function) | DAL / service | CRUD | `src/data/watches.ts` itself (`getWatchByIdForViewer`) | same-file extension |
| `tests/static/legacy-watch-routes.test.ts` | test (static scan) | batch | `tests/no-evaluate-route.test.ts` + `tests/static/CollectionFitCard.no-engine.test.ts` + `tests/profile-route-51.test.ts` | role-match |
| `package.json` (add `prebuild` script) | config | — | no codebase analog | none |
| 26 link-literal sites (ROUTE-04) | component/page | request-response | `src/components/watch/WatchCard.tsx` (pattern) | role-match |

---

## Pattern Assignments

---

### `src/app/w/[ref]/page.tsx` (page RSC, request-response)

**Primary analog:** `src/app/watch/[id]/page.tsx` (full read above)
**Secondary analog:** `src/app/catalog/[catalogId]/page.tsx` (full read above)

The unified page is a merge of both legacy pages. Copy the `/watch/[id]/page.tsx` structure verbatim for the per-user branch (Branch 1); copy the `/catalog/[catalogId]/page.tsx` structure for the cross-user catalog branch (Branch 2). The framing dispatch and RSC-sibling composition pattern come from the per-user page.

**Imports pattern** (`src/app/watch/[id]/page.tsx` lines 1-23 + `src/app/catalog/[catalogId]/page.tsx` lines 1-24):

All imports from both legacy pages are needed in the unified page. The unified page adds `findViewerWatchByCatalogId` from `@/data/watches` (moved from the catalog page). It does NOT import `redirect` from `next/navigation` (D-02/D-08 — zero redirects).

```typescript
// From /watch/[id]/page.tsx lines 1-23
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getCatalogById } from '@/data/catalog'
import { getMostRecentWearDate } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { getProfileById } from '@/data/profiles'
import { canViewerCommentOnTarget, getCommentsForTarget } from '@/data/comments'
import { isFollowing } from '@/data/follows'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import type { VerdictBundle } from '@/lib/verdict/types'
import { WatchDetail } from '@/components/watch/WatchDetail'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { CommentThread } from '@/components/comment/CommentThread'
import { CommentThreadSkeleton } from '@/components/comment/CommentThreadSkeleton'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
import { Button } from '@/components/ui/button'
// Additional imports from catalog page (lines 13-20):
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { OtherOwnersRoster } from '@/components/insights/OtherOwnersRoster'
import { CatalogPageActions, type CatalogActionsSpec } from '@/components/watch/CatalogPageActions'
import { getCollectorsForCatalog } from '@/data/discovery'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import { findViewerWatchByCatalogId, getWatchById } from '@/data/watches'  // findViewerWatchByCatalogId moved to DAL
import type { Watch, MovementType, CrystalType, CatalogTasteAttributes } from '@/lib/types'
```

**Async params pattern** (`src/app/watch/[id]/page.tsx` lines 25-31):

```typescript
// Next.js 16 requires params as a Promise — both legacy pages confirm this.
interface WatchPageProps {
  params: Promise<{ id: string }>
}
export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
```

For the unified page, rename to `{ ref: string }` and `UnifiedWatchPage`.

**UUID format guard** (`src/app/catalog/[catalogId]/page.tsx` lines 53-56):

```typescript
// Defense-in-depth: validate UUID format before any DB query so malformed
// URLs collapse cleanly to 404 instead of bubbling up Postgres "invalid input
// syntax for uuid" as a 500 error boundary.
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catalogId)) {
  notFound()
}
```

Copy this pattern verbatim to the unified page, replacing `catalogId` with `ref`.

**Branch 1 — per-user resolution** (`src/app/watch/[id]/page.tsx` lines 32-108):

```typescript
// Copy the entire per-user branch from /watch/[id]/page.tsx lines 32-108.
const user = await getCurrentUser()
const [result, collection, preferences] = await Promise.all([
  getWatchByIdForViewer(user.id, id),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
])

if (!result) {
  notFound()
}

const { watch, isOwner, ownerUserId } = result
const target = { type: 'watch' as const, id }
const [likeState, canComment] = await Promise.all([
  getLikesForTargetCached(user.id, target),
  canViewerCommentOnTarget(user.id, target),
])
// ... canCommentDisplay, ownerFollowsViewer, viewerIsFollowing, commentCount,
//     ownerProfile, lastWornDate, verdict (framing: isOwner ? 'same-user' : 'cross-user'),
//     sameFamily, lineage — all mirror /watch/[id]/page.tsx lines 59-117 exactly.
```

In the unified page: replace `id` with `ref` in the per-user branch. The `target = { type: 'watch' as const, id: ref }` uses the param directly (watches.id was the linker).

**Framing dispatch** (`src/app/watch/[id]/page.tsx` lines 104-107):

```typescript
verdict = computeVerdictBundle({
  candidate: watch,
  catalogEntry,
  collection,
  preferences,
  profile,
  framing: isOwner ? 'same-user' : 'cross-user',
})
```

This `isOwner ? 'same-user' : 'cross-user'` dispatch is the canonical pattern. Both resolution branches converge on it (D-07).

**B1 invariant — RSC sibling composition** (`src/app/watch/[id]/page.tsx` lines 119-199):

```typescript
// CRITICAL: RSCs are siblings at the server tree level, NOT imported inside the
// 'use client' WatchDetail island. See comment at line 113-115:
// "Both rails render as Server-Component siblings of <WatchDetail/> below
// (B1 invariant — RSCs CANNOT be imported into the 'use client' WatchDetail island)."
return (
  <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
    <WatchDetail
      watch={watch}
      collection={collection}
      preferences={preferences}
      lastWornDate={lastWornDate}
      viewerCanEdit={isOwner}
      verdict={verdict}
      viewerId={user.id}
      initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
      commentCount={commentCount}
    />
    {/* RSC siblings — NOT inside WatchDetail */}
    {collection.length === 0 && watch.catalogTaste &&
      watch.catalogTaste.confidence !== null && watch.catalogTaste.confidence >= 0.5 && (
        <ReferenceIdentityCard taste={watch.catalogTaste} />
    )}
    <SameFamilyRail rows={sameFamily} />
    <LineageRail rows={lineage} />
    <Suspense fallback={<CommentThreadSkeleton />}>
      <CommentThread
        viewerId={user.id}
        target={target}
        canComment={canCommentDisplay}
        ownerFollowsViewer={ownerFollowsViewer}
        viewerIsFollowing={viewerIsFollowing}
        ownerUserId={ownerUserId}
        ownerUsername={ownerProfile?.username ?? ''}
        suppressCompose={isOwner}
      />
    </Suspense>
  </div>
)
```

**Branch 2 — catalog resolution** (`src/app/catalog/[catalogId]/page.tsx` lines 64-258):

```typescript
// Catalog branch parallel fetch — mirror lines 64-82.
// findViewerWatchByCatalogId will be imported from @/data/watches after extraction.
const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
  getCatalogById(catalogId),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  findViewerWatchByCatalogId(user.id, catalogId),
  getProfileById(user.id),
  getCollectorsForCatalog(catalogId, user.id, { limit: 5 }),
  getSameFamilyForCatalog(catalogId),
  getLineageForReference(catalogId),
])
// Then: D-06 ownership detection replaces the old redirect() at line 112.
// viewerOwnedRow → load full Watch via getWatchById → render same-user framing.
// !viewerOwnedRow + collection → cross-user verdict → CatalogPageActions + OtherOwnersRoster.
```

**CatalogTaste projection** (`src/app/catalog/[catalogId]/page.tsx` lines 96-104):

```typescript
// Copy this projection verbatim — it adapts CatalogEntry top-level taste fields
// into the CatalogTasteAttributes shape for ReferenceIdentityCard.
const catalogTaste: CatalogTasteAttributes | null = {
  formality: catalogEntry.formality,
  sportiness: catalogEntry.sportiness,
  heritageScore: catalogEntry.heritageScore,
  eraSignal: catalogEntry.eraSignal,
  designMotifs: catalogEntry.designMotifs,
  confidence: catalogEntry.confidence,
  extractedFromPhoto: catalogEntry.extractedFromPhoto,
}
```

**CatalogActionsSpec builder** (`src/app/catalog/[catalogId]/page.tsx` lines 127-145):

```typescript
actionsSpec = {
  brand: catalogEntry.brand,
  model: catalogEntry.model,
  reference: catalogEntry.reference,
  movement: catalogEntry.movementType,
  caseSizeMm: catalogEntry.caseSizeMm,
  lugToLugMm: catalogEntry.lugToLugMm,
  waterResistanceM: catalogEntry.waterResistanceM,
  strapType: null,
  crystalType: catalogEntry.crystalType as CrystalType | null,
  dialColor: catalogEntry.dialColor,
  isChronometer: catalogEntry.isChronometer,
  complications: catalogEntry.complications ?? [],
  styleTags: catalogEntry.styleTags ?? [],
  designTraits: catalogEntry.designTraits ?? [],
  imageUrl: catalogEntry.imageUrl,
}
```

**OtherOwnersRoster + CatalogPageActions render conditions** (`src/app/catalog/[catalogId]/page.tsx` lines 223-255):

```typescript
// Catalog-branch render: OtherOwnersRoster and CatalogPageActions are cross-user-only.
// On the unified page, gate both on !isOwner (D-15; spike §4.D).
<OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />
{actionsSpec && (
  <CatalogPageActions
    catalogId={catalogId}
    spec={actionsSpec}
    framing="cross-user"
    viewerUsername={viewerUsername}
  />
)}
```

---

### `src/app/w/[ref]/edit/page.tsx` (page RSC, request-response)

**Analog:** `src/app/watch/[id]/edit/page.tsx` (full read above — 25 lines)

This is a near-exact copy. Only the interface param name changes (`id` → `ref`; the ref on the edit form is always `watches.id`, as only owners reach this form). The `getWatchById(user.id, id)` call is unchanged — `ref` is passed as the `watchId` arg.

**Full pattern** (`src/app/watch/[id]/edit/page.tsx` lines 1-25):

```typescript
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById } from '@/data/watches'
import { WatchForm } from '@/components/watch/WatchForm'

interface EditWatchPageProps {
  params: Promise<{ id: string }>   // rename to { ref: string } in the new file
}

export default async function EditWatchPage({ params }: EditWatchPageProps) {
  const { id } = await params      // rename to: const { ref } = await params
  const user = await getCurrentUser()
  const watch = await getWatchById(user.id, id)   // pass ref as watchId arg

  if (!watch) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Edit Watch</h1>
      <WatchForm watch={watch} mode="edit" />
    </div>
  )
}
```

---

### `src/data/watches.ts` — add `findViewerWatchByCatalogId` (DAL, CRUD)

**Analog:** `src/data/watches.ts` itself — the existing `getWatchByIdForViewer` function (lines 193-235) and `getWatchById` (lines 172-178) show the DAL pattern. The function to extract lives in `src/app/catalog/[catalogId]/page.tsx` lines 286-304.

**Function to move** (source: `src/app/catalog/[catalogId]/page.tsx` lines 286-304):

```typescript
/**
 * ARCH-02 detection — does the viewer already own a row in `watches` with this
 * catalogId? If yes, return the row (we need its id to build the owned-view).
 * If no, return null.
 *
 * T-20-06-01: query is scoped by BOTH userId AND catalogId — the viewer can
 * never read another user's watches.id even if catalogIds collide across users.
 */
export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({
      id: watchesTable.id,
    })
    .from(watchesTable)
    .where(and(
      eq(watchesTable.userId, userId),
      eq(watchesTable.catalogId, catalogId),
      eq(watchesTable.status, 'owned'),  // BUG-01 fix: only 'owned' rows are "truly owned"
    ))
    .limit(1)
  if (rows.length === 0) return null
  const row = rows[0]
  return { id: row.id }
}
```

**DAL file header** (`src/data/watches.ts` lines 1-8):

```typescript
// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { watches, profileSettings, watchesCatalog } from '@/db/schema'
import { eq, and, or, asc, desc, inArray, sql, type SQL } from 'drizzle-orm'
import type { Watch, EraSignal } from '@/lib/types'
```

The moved function uses `watches as watchesTable` (aliased in the catalog page) — in `watches.ts` the table is imported as `watches` (not aliased). The moved function must use `watches` (not `watchesTable`) and use `and`, `eq` already imported. The `db` import is already present. No new imports are needed.

**Placement note:** Add after `getWatchByIdForViewer` (line 235). The function is already self-contained and depends only on `db`, `watches`, `and`, `eq` — all already imported in the DAL file.

---

### `tests/static/legacy-watch-routes.test.ts` (static scan test)

**Primary analog:** `tests/no-evaluate-route.test.ts` (full read above — 16 lines) — uses `existsSync` for path-absence assertions.

**Secondary analog:** `tests/static/CollectionFitCard.no-engine.test.ts` (full read above — 41 lines) — uses `readFileSync` + regex on source content; uses `existsSync` vacuous-pass guard.

**Tertiary analog:** `tests/profile-route-51.test.ts` (full read above) — uses `readFileSync` + regex assertions across multiple files; uses `resolve(process.cwd(), ...)` for absolute path resolution; shows the multi-assertion per-file pattern for structural contracts.

**File-absence sub-test pattern** (from `tests/no-evaluate-route.test.ts` lines 1-16):

```typescript
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'

describe('Phase X — /evaluate route does not exist', () => {
  it('src/app/evaluate/ directory does not exist', () => {
    expect(existsSync('src/app/evaluate')).toBe(false)
  })
  it('src/app/evaluate/page.tsx does not exist', () => {
    expect(existsSync('src/app/evaluate/page.tsx')).toBe(false)
  })
})
```

**Source-content scan pattern** (from `tests/static/CollectionFitCard.no-engine.test.ts` lines 1-11):

```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('Phase 20 D-04 — invariant', () => {
  const cardPath = 'src/components/insights/CollectionFitCard.tsx'

  it('does not import X', () => {
    if (!existsSync(cardPath)) {
      return  // vacuous pass until file is created
    }
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
  })
})
```

**Multi-file recursive scan pattern** (from `tests/profile-route-51.test.ts` lines 1-4 + `readFileSync(resolve(process.cwd(), ...)` pattern at line 36):

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// ...
const source = readFileSync(
  resolve(process.cwd(), 'src/app/u/[username]/layout.tsx'),
  'utf8',
)
```

**The new guard combines all three patterns.** The recursive collector `collectSourceFiles` and the per-file iteration inside a `for ... it(...)` loop are described in RESEARCH.md §CI Guard and are not present in existing tests. Use `readdirSync` + `statSync` from `node:fs` (same imports used in the existing static tests) and `join` from `node:path`.

**Guard imports + structure** (derived from all three analogs):

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Part 1: File-absence assertions (mirrors no-evaluate-route.test.ts)
describe('ROUTE-02: legacy watch-detail route files are deleted', () => {
  it('src/app/watch/[id]/page.tsx does not exist', () => {
    expect(existsSync('src/app/watch/[id]/page.tsx')).toBe(false)
  })
  it('src/app/watch/[id]/edit/page.tsx does not exist', () => {
    expect(existsSync('src/app/watch/[id]/edit/page.tsx')).toBe(false)
  })
  it('src/app/catalog/[catalogId]/page.tsx does not exist', () => {
    expect(existsSync('src/app/catalog/[catalogId]/page.tsx')).toBe(false)
  })
})

// Part 2: Link-literal scan (mirrors CollectionFitCard.no-engine.test.ts + profile-route-51.test.ts)
describe('ROUTE-03: no internal links to legacy watch-detail paths', () => {
  // collectSourceFiles returns all .ts/.tsx under src/ (excluding .test. files)
  // FORBIDDEN patterns and ALLOWLIST patterns from RESEARCH.md §CI Guard
  // Per-file: for (const file of srcFiles) { it(`${file} has no legacy links`, () => { ... }) }
})
```

---

### 26 link-literal sites (ROUTE-04)

**Pattern:** All 26 link literals are `href={\`/watch/${...}\`}`, `href={\`/catalog/${...}\`}`, `router.push(\`/watch/${...}\`)`, or `return \`/watch/${...}\`` template literals. The rewrite is mechanical: change the path prefix from `/watch/` or `/catalog/` to `/w/`. The ID variable (watches.id or catalogId) is preserved; only the path segment changes.

**Example — per-user ownership surface** (`src/components/watch/WatchCard.tsx` line 35, inferred):

```tsx
// Before:
href={`/watch/${watch.id}`}
// After:
href={`/w/${watch.id}`}
```

**Example — discovery surface** (`src/components/explore/DiscoveryWatchCard.tsx` line 30, from RESEARCH table):

```tsx
// Before (note: variable is watch.id but it IS catalogId per RESEARCH.md §C):
href={`/catalog/${watch.id}`}
// After:
href={`/w/${watch.id}`}
```

**Example — computed deep-link** (`src/components/notifications/NotificationRow.tsx` line 142):

```typescript
// Before (D-12: the CI guard must catch this return-statement form):
return `/watch/${watchId}`
// After:
return `/w/${watchId}`
```

**Example — router.push** (`src/components/profile/NotesEmptyOwnerActions.tsx` line 53):

```typescript
// Before:
router.push(`/watch/${watchId}/edit#notes`)
// After:
router.push(`/w/${watchId}/edit#notes`)
```

**Example — edit links inside the deleted page** (`src/app/watch/[id]/page.tsx` lines 187, 190 — move to new unified page):

```tsx
// Before (in deleted file; replicated in unified page with /w/):
href={`/watch/${watch.id}/edit?status=wishlist`}
href={`/watch/${watch.id}/edit?status=owned`}
// After (in src/app/w/[ref]/page.tsx):
href={`/w/${watch.id}/edit?status=wishlist`}
href={`/w/${watch.id}/edit?status=owned`}
```

**ID type discipline** (from RESEARCH.md §B and §C):
- Ownership/per-user surfaces: emit `watches.id` → `/w/${watch.id}`, `/w/${watchId}`, etc.
- Discovery surfaces (Explore, Search): emit `catalogId` → `/w/${watch.catalogId}`, `/w/${result.catalogId}`, etc.

---

## Shared Patterns

### Auth / User Resolution
**Source:** `src/app/watch/[id]/page.tsx` line 31; `src/app/catalog/[catalogId]/page.tsx` line 57
**Apply to:** `src/app/w/[ref]/page.tsx`, `src/app/w/[ref]/edit/page.tsx`

```typescript
const user = await getCurrentUser()
```

`getCurrentUser()` throws for unauthenticated users — the proxy handles the redirect to `/login` before the page renders. No explicit auth check needed inside the page.

### DAL Null-Is-Not-Found Pattern
**Source:** `src/data/watches.ts` lines 168-170 (docstring) + line 177
**Apply to:** `src/data/watches.ts` (the extracted `findViewerWatchByCatalogId`)

```typescript
// Not-found is an expected outcome, not a thrown error.
return rows[0] ? mapRowToWatch(rows[0]) : null
// (findViewerWatchByCatalogId analog:)
if (rows.length === 0) return null
return { id: row.id }
```

### notFound() Early Exit
**Source:** `src/app/watch/[id]/page.tsx` lines 38-40; `src/app/catalog/[catalogId]/page.tsx` lines 85-85; `src/app/watch/[id]/edit/page.tsx` lines 15-17
**Apply to:** `src/app/w/[ref]/page.tsx`, `src/app/w/[ref]/edit/page.tsx`

```typescript
if (!result) {
  notFound()
}
```

Used after each DB resolution step that can return null. Call `notFound()` (not `throw`; not `redirect()`).

### Parallel Data Fetching with Promise.all
**Source:** `src/app/watch/[id]/page.tsx` lines 32-36; `src/app/catalog/[catalogId]/page.tsx` lines 64-82
**Apply to:** `src/app/w/[ref]/page.tsx` (both branches)

```typescript
// Per-user branch (watch/[id] lines 32-36):
const [result, collection, preferences] = await Promise.all([
  getWatchByIdForViewer(user.id, id),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
])
// Catalog branch (catalog/[catalogId] lines 64-82):
const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([...])
```

### Vitest Static-Scan Test Shape
**Source:** `tests/no-evaluate-route.test.ts`; `tests/static/CollectionFitCard.no-engine.test.ts`; `tests/profile-route-51.test.ts`
**Apply to:** `tests/static/legacy-watch-routes.test.ts`

All three analogs share:
- `import { describe, it, expect } from 'vitest'`
- `import { readFileSync, existsSync } from 'node:fs'`
- `describe(..., () => { it(..., () => { expect(...).toBe(false) }) })`
- No DOM, no component import, no server spin-up
- Relative paths from `process.cwd()` (project root), or bare relative paths like `'src/...'`

### `server-only` Guard in DAL Files
**Source:** `src/data/watches.ts` lines 1-2
**Apply to:** `src/data/watches.ts` (already present — preserve when adding the new function)

```typescript
import 'server-only'
```

This top-of-file import is already in `watches.ts`. The extracted `findViewerWatchByCatalogId` inherits it automatically — no action needed beyond placing the function in the DAL file.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json` `"prebuild"` script | config | — | No analogous npm lifecycle hook in the codebase; pattern is standard npm (`"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts"`). Current `"build"` is `"next build"` (line 7); add `"prebuild"` as a separate key. |

---

## Key Constraints (load-bearing for planner)

1. **B1 invariant** — `WatchDetail.tsx` is `'use client'`. `CommentThread`, `SameFamilyRail`, `LineageRail`, `OtherOwnersRoster`, `CatalogPageActions`, `CollectionFitCard`, `ReferenceIdentityCard` are RSCs and MUST be siblings of `<WatchDetail />` in the server page's JSX tree, never imported inside the island. The comment at `src/app/watch/[id]/page.tsx` lines 113-115 is the canonical statement of this invariant.

2. **Zero redirects** — The unified page imports `notFound` from `next/navigation` but NOT `redirect`. Any `redirect()` call on a watch route triggers the Router Cache poisoning bug (MEMORY `feedback_proxy_router_cache_poisoning`). The D-08 unwind removes the last `redirect()` from `catalog/[catalogId]/page.tsx:112`.

3. **BUG-01 fix must survive** — `findViewerWatchByCatalogId` at `catalog/[catalogId]/page.tsx:298` has `eq(watchesTable.status, 'owned')`. This line is the BUG-01 fix and must be preserved verbatim in the moved function.

4. **`findViewerWatchByCatalogId` extraction is a prerequisite** — the catalog page file is deleted as part of Phase 59. The function must land in `src/data/watches.ts` before or in the same commit as the deletion. It uses `watches` (not aliased), `and`, `eq`, `db` — all already imported in that file. The alias `watches as watchesTable` used in the catalog page does NOT apply in the DAL file.

5. **Link ID type discipline** — Discovery surfaces must emit `catalogId` (not `watch.id`) to `/w/[ref]`. Ownership surfaces must emit `watches.id`. The RESEARCH.md §B and §C table specifies which ID type each of the 26 literals uses.

---

## Metadata

**Analog search scope:** `src/app/watch/`, `src/app/catalog/`, `src/data/watches.ts`, `src/data/catalog.ts`, `tests/static/`, `tests/no-evaluate-route.test.ts`, `tests/profile-route-51.test.ts`, `package.json`
**Files scanned:** 9 files read in full
**Pattern extraction date:** 2026-05-25

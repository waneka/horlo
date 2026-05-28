# Phase 64: Detail Page IA Redesign - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/watch/WatchDetailHero.tsx` | component (client island) | request-response | `src/components/watch/WatchDetail.tsx` lines 1–333 | exact (extracted subset) |
| `src/components/watch/WatchDetailTrailing.tsx` | component (RSC) | request-response | `src/components/watch/WatchDetail.tsx` lines 336–564 + `src/components/insights/OtherOwnersRoster.tsx` | exact (extracted subset + RSC shell) |
| `src/components/watch/SpecsSublabel.tsx` | component (RSC-compatible utility) | transform | `src/app/w/[ref]/page.tsx` lines 752–768 | exact (file extraction) |
| `src/app/w/[ref]/page.tsx` | route (server, all three branches) | request-response | itself — child re-ordering only | self |
| `src/components/watch/WatchDetail.tsx` | component (client island — being split/retired) | request-response | itself | self |
| `src/components/comment/CommentThread.tsx` | component (uncached async RSC) | request-response | itself — one-attribute addition | self |
| `tests/static/watch-detail-ia-order.test.ts` | test (static guard) | — | `tests/static/ppr-dynamic-before-use-cache.test.ts` | exact |
| `tests/static/comment-thread-no-client.test.ts` | test (static guard) | — | `tests/static/legacy-watch-routes.test.ts` | exact |

---

## Pattern Assignments

---

### `src/components/watch/WatchDetailHero.tsx` (component, `'use client'`)

**Analog:** `src/components/watch/WatchDetail.tsx` (lines 1–333)

This is the hero island extracted from `WatchDetail.tsx`. Copy the imports block, hooks, handlers, and the JSX from the left column (photo section, title, badge, like/comment, last-worn, flag-deal, owner actions) plus the new right-column verdict slot. Strip everything after line 333 (spec cards, gap-fill, notes — those go to `WatchDetailTrailing`).

**Imports pattern** (`WatchDetail.tsx` lines 1–34):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Check, MessageCircle, Watch as WatchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getSafeImageUrl } from '@/lib/images'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LikeButton } from '@/components/shared/LikeButton'
import { editWatch, removeWatch } from '@/app/actions/watches'
import { markAsWorn } from '@/app/actions/wearEvents'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { WatchPhotoSection } from '@/components/watch/WatchPhotoSection'
import type { SignedWearPic } from '@/components/watch/WatchPhotoSection'
import type { CommentAuthor } from '@/components/comment/types'
import { MOVEMENT_LABELS } from '@/lib/constants'
import { daysSince } from '@/lib/wear'
import type { Watch, UserPreferences } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'
// NEW: also import SpecsSublabel from the shared file (not page.tsx)
import { SpecsSublabel } from '@/components/watch/SpecsSublabel'
// NEW: also import ReferenceIdentityCard as a passthrough slot for empty verdict state
```

**CRITICAL — do NOT import `CommentThread`** (`WatchDetail.tsx` lines 1–34, absence):
`CommentThread` must NOT appear in any import statement in this file. Its `commentCount` is a plain `number` prop. Importing `CommentThread` into a `'use client'` module converts it to a client component and destroys the privacy guarantee.

**Handler pattern** (`WatchDetail.tsx` lines 130–168):
```typescript
export function WatchDetailHero({ watch, collection, preferences, lastWornDate,
  viewerCanEdit = true, verdict = null, viewerId, initialLikeState,
  commentCount, signedPhotos, userId, wearPics, ownerUserId, ownerUsername,
  viewerAuthor, canCommentOnWears, ownerFollowsViewerForWears,
  viewerIsFollowingForWears }: WatchDetailHeroProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = () => {
    startTransition(async () => {
      const result = await removeWatch(watch.id)
      if (result.success) { router.push('/') }
    })
  }

  const handleMarkAsWorn = () => {
    startTransition(async () => {
      const result = await markAsWorn(watch.id)
      if (result.success) { router.refresh() }
    })
  }

  const handleFlagDealChange = (checked: boolean) => {
    startTransition(async () => {
      const result = await editWatch(watch.id, { isFlaggedDeal: checked })
      if (result.success) { router.refresh() }
    })
  }
```

**Hero layout pattern — new 2-col grid** (replacing `WatchDetail.tsx` line 173 `grid gap-8 lg:grid-cols-[2fr_1fr]`):
```typescript
  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      {/* Left column: WatchPhotoSection */}
      <div>
        {/* ...WatchPhotoSection or fallback image — copy from WatchDetail.tsx:179-212 */}
      </div>

      {/* Right column: title → verdict → like/comment-jump → last-worn → flag-deal → actions */}
      <div className="space-y-6">
        {/* Title & Status — copy from WatchDetail.tsx:214-226 */}
        <div>
          <Badge className="mb-2" variant="outline">{watch.status}</Badge>
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground">{watch.brand}</h1>
          <p className="text-lg sm:text-xl text-muted-foreground">{watch.model}</p>
          {watch.reference && (
            <p className="text-sm text-muted-foreground mt-1">Ref. {watch.reference}</p>
          )}
          {/* D-03: condensed spec strip (extracted SpecsSublabel) */}
          <SpecsSublabel
            movement={watch.movement}
            caseSizeMm={watch.caseSizeMm ?? null}
            dialColor={watch.dialColor ?? null}
          />
        </div>

        {/* D-09: CollectionFitCard elevated into hero */}
        {verdict && <CollectionFitCard verdict={verdict} />}

        {/* D-10: empty verdict states */}
        {!verdict && collection.length === 0 && watch.catalogTaste &&
          watch.catalogTaste.confidence !== null &&
          watch.catalogTaste.confidence >= 0.5 && (
            <ReferenceIdentityCard taste={watch.catalogTaste} />
          )}
        {!verdict && collection.length === 0 &&
          (!watch.catalogTaste || /* confidence below threshold */) && (
            <p className="text-sm text-muted-foreground">
              Add a few watches to see how this one fits your collection.
            </p>
          )}

        {/* Like + D-06 jump-to-comments anchor */}
        {viewerId !== undefined && initialLikeState !== undefined && (
          <div className="flex items-center gap-2 mt-3">
            <LikeButton
              viewerId={viewerId}
              target={{ type: 'watch', id: watch.id }}
              initialLiked={initialLikeState.liked}
              initialCount={initialLikeState.count}
            />
            {(commentCount ?? 0) > 0 && (
              <a
                href="#comments"
                aria-label="Jump to comments"
                className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground px-2 min-h-[44px] hover:text-foreground transition-colors"
              >
                <MessageCircle className="size-5" aria-hidden />
                {commentCount}
                <span className="sr-only">comments</span>
              </a>
            )}
          </div>
        )}

        {/* Last-worn, flag-deal, owner actions — copy from WatchDetail.tsx:247-332 */}
      </div>
    </div>
  )
}
```

**Delete dialog pattern** (`WatchDetail.tsx` lines 301–331):
```typescript
<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
  <DialogTrigger render={<Button variant="destructive" />}>Delete</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete Watch</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete {watch.brand} {watch.model}?
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isPending}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Props to REMOVE from hero (moved to `WatchDetailTrailing`):** `computeGapFill`, `gapFill`. The `collection` and `preferences` props can be dropped from the hero if gap-fill stays in trailing and neither `CollectionFitCard` nor any hero element needs them. Pass them only if `ReferenceIdentityCard` or verdict computation is done at this level (per RESEARCH: verdict is precomputed in `page.tsx` and passed as prop — so `collection`/`preferences` can be stripped from the hero).

---

### `src/components/watch/WatchDetailTrailing.tsx` (component, RSC — no `'use client'`)

**Analog 1:** `src/components/watch/WatchDetail.tsx` lines 336–564 (the trailing spec cards and gap-fill section)
**Analog 2:** `src/components/insights/OtherOwnersRoster.tsx` (RSC shell with no `'use client'`, named export, typed props interface)

This is a pure-render RSC. No hooks, no event handlers, no `'use client'`. Copy the four spec card blocks (Specifications, Pricing, Classification, Tracking), the gap-fill card, and the Notes card verbatim from `WatchDetail.tsx`, then wrap in an RSC function signature.

**RSC shell pattern** (from `OtherOwnersRoster.tsx` lines 41–50):
```typescript
// NO 'use client' — pure RSC; no hooks, no event handlers.
// formatDate and computeGapFill are pure functions; safe to call in RSC.

import { computeGapFill } from '@/lib/gapFill'
import { daysSince } from '@/lib/wear'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MOVEMENT_LABELS } from '@/lib/constants'
import type { Watch, UserPreferences } from '@/lib/types'

interface WatchDetailTrailingProps {
  watch: Watch
  collection: Watch[]
  preferences: UserPreferences
  lastWornDate?: string | null
}

export function WatchDetailTrailing({ watch, collection, preferences, lastWornDate }: WatchDetailTrailingProps) {
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const gapFill = isWishlistLike ? computeGapFill(watch, collection, preferences) : null
  const daysSinceWorn = daysSince(lastWornDate ?? undefined)

  return (
    <div className="space-y-6">
      {/* Specifications card — copy from WatchDetail.tsx:338-416 */}
      {/* Pricing card — copy from WatchDetail.tsx:418-443 */}
      {/* Classification/Tags card — copy from WatchDetail.tsx:445-484 */}
      {/* Tracking card — copy from WatchDetail.tsx:486-512 */}
      {/* Gap-fill card — copy from WatchDetail.tsx:516-544 */}
      {/* Notes card — copy from WatchDetail.tsx:549-562 */}
    </div>
  )
}
```

**`formatDate` pattern — MUST preserve `timeZone: 'UTC'`** (`WatchDetail.tsx` lines 106–119):
```typescript
// Defined locally in this file (pure function; safe to duplicate or import from a shared util)
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  // timeZone: 'UTC' is REQUIRED for hydration safety (React #418).
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
```

**Specs card pattern** (`WatchDetail.tsx` lines 338–416):
```typescript
<Card>
  <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
  <CardContent>
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt className="text-muted-foreground">Movement</dt>
        <dd className="font-semibold">{watch.movement ? MOVEMENT_LABELS[watch.movement] : null}</dd>
      </div>
      {watch.caseSizeMm && (
        <div>
          <dt className="text-muted-foreground">Case Size</dt>
          <dd className="font-semibold">{watch.caseSizeMm}mm</dd>
        </div>
      )}
      {/* ...remaining fields at WatchDetail.tsx:351-415 */}
    </dl>
  </CardContent>
</Card>
```

**Gap-fill card pattern** (`WatchDetail.tsx` lines 517–544):
```typescript
{gapFill && (
  <Card>
    <CardHeader>
      <CardTitle>Gap-fill</CardTitle>
      <CardDescription>
        {gapFill.kind === 'numeric' && `Fills ${gapFill.newTuples.length} new combo...`}
        {gapFill.kind === 'first-watch' && 'First watch in your collection — no comparison yet.'}
        {/* ...other kinds */}
      </CardDescription>
    </CardHeader>
    {gapFill.kind === 'numeric' && gapFill.newTuples.length > 0 && (
      <CardContent>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {gapFill.newTuples.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </CardContent>
    )}
  </Card>
)}
```

---

### `src/components/watch/SpecsSublabel.tsx` (component, RSC-compatible — no `'use client'`)

**Analog:** `src/app/w/[ref]/page.tsx` lines 752–768 (the unexported module-level function)

This is a direct extraction. Copy the function body verbatim, add an `export` keyword, and save as a standalone file. No `'use client'` — it is a pure function with no hooks or browser APIs, legal to import from both RSC and client contexts.

**Complete source to copy** (`page.tsx` lines 752–768):
```typescript
// src/components/watch/SpecsSublabel.tsx
// NO 'use client' — pure render; safe to import from both RSC and 'use client' components.

export function SpecsSublabel({
  movement,
  caseSizeMm,
  dialColor,
}: {
  movement: string | null
  caseSizeMm: number | null
  dialColor: string | null
}) {
  const parts = [
    movement,
    caseSizeMm ? `${caseSizeMm}mm` : null,
    dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}
```

After extracting, remove the original function from `page.tsx` and replace any usages in Branch 3 of `page.tsx` with `import { SpecsSublabel } from '@/components/watch/SpecsSublabel'`.

---

### `src/app/w/[ref]/page.tsx` (route, modified — child re-ordering only)

**Analog:** itself — no new pattern needed; only the JSX child order changes within each branch.

**Load-bearing lines — DO NOT MOVE** (`page.tsx` lines 47, 80–99):
```typescript
// Line 47 — module scope, must stay here
export const unstable_instant = false

// Lines 80–99 — default export body; await connection() MUST be FIRST
export default async function UnifiedWatchPage({ params }: UnifiedWatchPageProps) {
  await connection()
  return (
    <Suspense fallback={<WatchPageSkeleton />}>
      <UnifiedWatchContent params={params} />
    </Suspense>
  )
}
```

**Branch 1 — current child order** (`page.tsx` lines 304–391, current):
```
<WatchDetail>                        ← monolithic client island
[ReferenceIdentityCard or caption]
<SameFamilyRail>
<LineageRail>
<Suspense><CommentThread></Suspense>  ← currently LAST
[3-CTA buttons]
```

**Branch 1 — new child order** (D-02):
```typescript
// Replace <WatchDetail> with <WatchDetailHero>; add <WatchDetailTrailing> AFTER CommentThread
<WatchDetailHero
  watch={watch}
  verdict={verdict}
  viewerCanEdit={isOwner}
  viewerId={user.id}
  initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
  commentCount={commentCount}
  signedPhotos={signedPhotos}
  userId={isOwner ? user.id : undefined}
  wearPics={signedWearPics}
  ownerUserId={ownerUserId}
  ownerUsername={ownerProfile?.username ?? ''}
  viewerAuthor={viewerAuthorForWears}
  canCommentOnWears={!isOwner && canComment}
  ownerFollowsViewerForWears={ownerFollowsViewer}
  viewerIsFollowingForWears={viewerIsFollowing}
/>

{/* CommentThread MOVED UP — position 2, immediately after hero */}
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

{/* Trailing spec cards — RSC sibling AFTER CommentThread (D-07) */}
<WatchDetailTrailing
  watch={watch}
  collection={collection}
  preferences={preferences}
  lastWornDate={lastWornDate}
/>

{/* Rails moved BELOW trailing */}
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />

{/* fresh-account CTAs stay at bottom */}
{collection.length === 0 && ( /* ...3-CTA block unchanged */ )}
```

**Branch 3 — current order** (`page.tsx` lines 656–725, current):
```
[div: image + h1 + reference + SpecsSublabel]
<CollectionFitCard>
[ReferenceIdentityCard or caption]
<OtherOwnersRoster>
<SameFamilyRail>
<LineageRail>
<CatalogPageActions>   ← currently LAST
```

**Branch 3 — new order** (D-12/D-13):
```typescript
// Container: change space-y-6 → space-y-8 for visual parity with Branches 1 & 2 (D-14)
<div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">

  {/* Catalog hero shell — stays RSC inline div (no client island needed) */}
  <div className="flex items-start gap-4">
    {/* ...existing image thumbnail + title/ref/SpecsSublabel block */}
    <SpecsSublabel  {/* import from @/components/watch/SpecsSublabel */}
      movement={catalogEntry.movement}
      caseSizeMm={catalogEntry.caseSizeMm ?? null}
      dialColor={catalogEntry.dialColor ?? null}
    />
  </div>
  {verdict && <CollectionFitCard verdict={verdict} />}
  {/* ...empty-state ReferenceIdentityCard or caption */}

  {/* D-13: OtherOwnersRoster MOVED UP, near verdict */}
  <OtherOwnersRoster collectors={roster} totalCount={totalCount} />

  {/* D-13: CatalogPageActions MOVED UP, near verdict */}
  <CatalogPageActions ... />

  {/* Rails stay below */}
  <SameFamilyRail rows={sameFamily} />
  <LineageRail rows={lineage} />
</div>
```

**`WatchPageSkeleton` update** (`page.tsx` lines 103–114 — update to mirror new IA):
```typescript
function WatchPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8" aria-hidden>
      {/* Hero grid */}
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="aspect-[3/4] w-full rounded-lg" />  {/* carousel */}
        <div className="space-y-4">
          <Skeleton className="h-7 w-3/4" />   {/* brand */}
          <Skeleton className="h-5 w-1/2" />   {/* model */}
          <Skeleton className="h-4 w-1/3" />   {/* spec strip */}
          <Skeleton className="h-40 w-full rounded-lg" />  {/* verdict card */}
          <Skeleton className="h-9 w-24" />    {/* like button */}
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />   {/* comments */}
      <Skeleton className="h-40 w-full rounded-lg" />   {/* spec cards */}
    </div>
  )
}
```

---

### `src/components/comment/CommentThread.tsx` (component, modified — one attribute addition)

**Analog:** itself — only `id="comments"` added to the `<section>` element.

**Current** (`CommentThread.tsx` line 66):
```typescript
<section className="mt-6">
```

**New** (D-06 anchor target):
```typescript
<section id="comments" className="mt-6">
```

The CRITICAL comment at the top of the file (lines 1–3) must remain untouched:
```typescript
// CRITICAL: NO 'use client' AND NO 'use cache' on this component.
// This is an uncached async Server Component — the absence of 'use cache' is
// the privacy guarantee for comments (src/data/comments.ts PRIVACY LAYER NOTE).
```

---

### `tests/static/watch-detail-ia-order.test.ts` (new static guard)

**Analog:** `tests/static/ppr-dynamic-before-use-cache.test.ts` (full file — copy the `// @vitest-environment node` header, `readFileSync` + `activeLineNumbers` helper, and test structure exactly)

**File header — MUST include** (`ppr-dynamic-before-use-cache.test.ts` lines 1–8):
```typescript
// @vitest-environment node
//
// This guard reads source files from the filesystem (readFileSync).
// It MUST run in the node environment — under jsdom (the default), vite
// externalizes node:fs and readFileSync becomes undefined. That difference is
// environment-dependent: passes locally under jsdom but FAILS the Vercel
// prebuild build.
// See MEMORY project_vitest_static_node_env.
```

**Imports pattern** (`ppr-dynamic-before-use-cache.test.ts` lines 27–29):
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
```

**`activeLineNumbers` helper** (copy verbatim from `ppr-dynamic-before-use-cache.test.ts` lines 37–53):
```typescript
function activeLineNumbers(lines: string[], pattern: RegExp): number[] {
  return lines.reduce<number[]>((acc, line, idx) => {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed === ''
    ) {
      return acc
    }
    if (pattern.test(trimmed)) {
      acc.push(idx + 1)  // 1-indexed line number
    }
    return acc
  }, [])
}
```

**New assertions to implement** (PAGE-01 / PAGE-02 / PAGE-03 / PAGE-04):
```typescript
const PAGE_TSX = join('src', 'app', 'w', '[ref]', 'page.tsx')
const HERO_TSX = join('src', 'components', 'watch', 'WatchDetailHero.tsx')

describe('PAGE-01/02: watch-detail IA child order in page.tsx', () => {
  const content = readFileSync(PAGE_TSX, 'utf8')
  const lines = content.split('\n')

  it('WatchDetailHero renders before CommentThread', () => {
    const heroLines = activeLineNumbers(lines, /WatchDetailHero/)
    const commentLines = activeLineNumbers(lines, /CommentThread/)
    expect(heroLines.length).toBeGreaterThan(0)
    expect(commentLines.length).toBeGreaterThan(0)
    expect(heroLines[0]).toBeLessThan(commentLines[0])
  })

  it('CommentThread renders before WatchDetailTrailing', () => {
    const commentLines = activeLineNumbers(lines, /CommentThread/)
    const trailingLines = activeLineNumbers(lines, /WatchDetailTrailing/)
    expect(trailingLines.length).toBeGreaterThan(0)
    expect(commentLines[0]).toBeLessThan(trailingLines[0])
  })

  it('WatchDetailTrailing renders before SameFamilyRail', () => {
    const trailingLines = activeLineNumbers(lines, /WatchDetailTrailing/)
    const railLines = activeLineNumbers(lines, /SameFamilyRail/)
    expect(railLines.length).toBeGreaterThan(0)
    expect(trailingLines[0]).toBeLessThan(railLines[0])
  })
})

describe('PAGE-03: WatchDetailHero does not import CommentThread', () => {
  const content = readFileSync(HERO_TSX, 'utf8')

  it('WatchDetailHero.tsx has no import of CommentThread', () => {
    expect(content).not.toMatch(/import.*CommentThread/)
  })
})

describe('PAGE-04: WatchDetailHero includes WatchPhotoSection', () => {
  const content = readFileSync(HERO_TSX, 'utf8')

  it('WatchDetailHero.tsx imports or renders WatchPhotoSection', () => {
    expect(content).toMatch(/WatchPhotoSection/)
  })
})
```

---

### `tests/static/comment-thread-no-client.test.ts` (new static guard)

**Analog:** `tests/static/legacy-watch-routes.test.ts` (copy the `// @vitest-environment node` header, `readFileSync` imports, and describe/it structure)

**File header and imports** (from `legacy-watch-routes.test.ts` lines 1–36):
```typescript
// @vitest-environment node
//
// Filesystem guard — must run in node environment (see MEMORY project_vitest_static_node_env).
//
// PAGE-03 guard: CommentThread must never have 'use client' or 'use cache'.
// The absence of 'use cache' is the privacy guarantee for comments
// (src/data/comments.ts PRIVACY LAYER NOTE). A developer refactor must not
// accidentally add either directive.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
```

**Guard assertions** (PAGE-03):
```typescript
describe('PAGE-03: CommentThread.tsx privacy invariants', () => {
  const COMMENT_THREAD = join('src', 'components', 'comment', 'CommentThread.tsx')
  const content = readFileSync(COMMENT_THREAD, 'utf8')

  it('does not contain "use client"', () => {
    // Check only top of file (first 5 lines) to avoid matching string literals in comments
    const top = content.split('\n').slice(0, 5).join('\n')
    expect(top).not.toMatch(/'use client'/)
  })

  it('does not contain "use cache"', () => {
    const top = content.split('\n').slice(0, 5).join('\n')
    expect(top).not.toMatch(/'use cache'/)
  })

  it('is an async function (RSC)', () => {
    expect(content).toMatch(/export async function CommentThread/)
  })
})
```

**Note on scope of the `'use client'` check:** Check only the first 5 lines. The CRITICAL comment at the top of `CommentThread.tsx` (lines 1–3) mentions `'use client'` in prose — a full-file `includes()` check would false-positive. Slice to the directive zone only.

---

## Shared Patterns

### Cache Components Preservation (PAGE-03 — D-08)

**Source:** `src/app/w/[ref]/page.tsx` lines 47, 80–99
**Apply to:** `page.tsx` only (do NOT replicate in component files)
```typescript
// Module scope — must stay here
export const unstable_instant = false

// Default export — await connection() must be FIRST line in body
export default async function UnifiedWatchPage({ params }: UnifiedWatchPageProps) {
  await connection()
  return (
    <Suspense fallback={<WatchPageSkeleton />}>
      <UnifiedWatchContent params={params} />
    </Suspense>
  )
}
```

### B1 Sibling Composition — RSC around Client Island

**Source:** `src/app/w/[ref]/page.tsx` lines 304–391 (current Branch 1 server tree)
**Apply to:** All three branches in `page.tsx`

The pattern: client islands (`WatchDetailHero`, `CatalogPageActions`) are siblings in the server tree, never imported into each other. RSC siblings (`CommentThread`, `WatchDetailTrailing`, rails, roster) compose around them. Props flow down from the async RSC (`UnifiedWatchContent`) to each component.

```typescript
// Server tree (UnifiedWatchContent — async RSC):
<WatchDetailHero {...heroProps} />         // client island
<Suspense fallback={<CommentThreadSkeleton />}>
  <CommentThread {...commentProps} />      // uncached RSC sibling
</Suspense>
<WatchDetailTrailing {...trailingProps} /> // RSC sibling
<SameFamilyRail rows={sameFamily} />      // RSC sibling (self-hiding)
<LineageRail rows={lineage} />            // RSC sibling (self-hiding)
```

### Date Formatting — `timeZone: 'UTC'` Required

**Source:** `src/components/watch/WatchDetail.tsx` lines 106–119
**Apply to:** `WatchDetailTrailing.tsx` (the Tracking card uses `formatDate`); also preserved in `WatchDetailHero.tsx` for the last-worn hero line

```typescript
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  // timeZone: 'UTC' is REQUIRED — React #418 hydration fix. Do not remove.
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
```

### Owner-Only Gate Pattern

**Source:** `src/components/watch/WatchDetail.tsx` lines 247–332
**Apply to:** `WatchDetailHero.tsx` (preserve exactly — `viewerCanEdit` prop gates all owner UI)

```typescript
{viewerCanEdit && (watch.status === 'owned' || watch.status === 'grail') && (
  // last-worn line
)}
{isWishlistLike && viewerCanEdit && (
  // flag-deal checkbox
)}
{viewerCanEdit && (
  // Mark as Worn / Edit / Delete actions
)}
```

### Static Guard Node-Environment Header

**Source:** `tests/static/ppr-dynamic-before-use-cache.test.ts` lines 1–8
**Apply to:** Both new test files (`watch-detail-ia-order.test.ts`, `comment-thread-no-client.test.ts`)

```typescript
// @vitest-environment node
//
// This guard reads source files from the filesystem (readFileSync).
// It MUST run in the node environment — under jsdom (the default), vite
// externalizes node:fs and readFileSync becomes undefined.
// See MEMORY project_vitest_static_node_env.
```

---

## No Analog Found

All files in scope have strong analogs in the codebase. No files require falling back to RESEARCH.md patterns as a primary source.

---

## Metadata

**Analog search scope:** `src/components/watch/`, `src/components/comment/`, `src/components/insights/`, `src/app/w/[ref]/`, `tests/static/`
**Files scanned:** 8 analog files read directly
**Pattern extraction date:** 2026-05-27

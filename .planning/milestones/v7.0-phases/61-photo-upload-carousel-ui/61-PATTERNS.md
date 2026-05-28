# Phase 61: Photo Upload + Carousel UI — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/watch/WatchPhotoSection.tsx` | component | event-driven + request-response | `src/components/profile/WishlistTabContent.tsx` (OwnerWishlistGrid branch) | role-match |
| `src/components/watch/SortablePhotoThumb.tsx` | component | event-driven | `src/components/profile/SortableProfileWatchCard.tsx` | exact |
| `src/components/watch/PhotoDropzone.tsx` | component | file-I/O | `src/components/watch/CatalogPhotoUploader.tsx` | role-match |
| `src/components/watch/WatchPhotoStep.tsx` | component | file-I/O + request-response | `src/components/watch/CatalogPhotoUploader.tsx` | role-match |
| `src/app/actions/watchPhotos.ts` | server action | request-response | `src/app/actions/wishlist.ts` (`reorderWishlist`) | exact |
| `src/data/watches.ts` (extend: `getWatchPhotosForWatch`) | DAL | CRUD | `src/data/watches.ts` (`addWatchPhoto`, lines 567–605) | exact |
| `src/app/w/[ref]/page.tsx` (modify: signed URL fetch) | RSC page | request-response | `src/app/wears/[username]/page.tsx` (lines 130–139) | exact |
| `src/components/watch/WatchDetail.tsx` (modify: image block) | component | request-response | `src/components/watch/WatchDetail.tsx` (lines 128–143, the block being replaced) | self |
| `src/components/watch/AddWatchFlow.tsx` (modify: photos-pending state) | component | event-driven + request-response | `src/components/watch/AddWatchFlow.tsx` (wishlist-rationale-open branch, lines 537–558) | self |
| `src/components/watch/flowTypes.ts` (modify: add photos-pending) | types | — | `src/components/watch/flowTypes.ts` (existing union, lines 17–29) | self |

---

## Pattern Assignments

### `src/components/watch/WatchPhotoSection.tsx` (component, event-driven + request-response)

**Analog:** `src/components/profile/WishlistTabContent.tsx` — `OwnerWishlistGrid` sub-component (lines 148–294)

**This is the central new component.** It owns the embla carousel, always-on filmstrip, edit toggle, and the dnd-kit context when edit mode is on. It composes `SortablePhotoThumb` for each thumbnail. The `OwnerWishlistGrid` pattern provides the complete `useOptimistic` + `useTransition` + `DndContext` + `SortableContext` + `DragOverlay` shell.

**Key deviation from analog:** Use `horizontalListSortingStrategy` (not `rectSortingStrategy`) — filmstrip is a single horizontal row. Add `embla-carousel-react` above the filmstrip. Disable embla `draggable` when edit mode is ON via `emblaApi?.reInit({ draggable: false })`.

**Imports pattern** (`WishlistTabContent.tsx` lines 1–29):
```typescript
'use client'

import { useOptimistic, useTransition, useState, useMemo, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, MouseSensor, TouchSensor,
  DragOverlay, useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import useEmblaCarousel from 'embla-carousel-react'
// NOTE: use horizontalListSortingStrategy (not rectSortingStrategy used in WishlistTabContent)
```

**Sensor configuration pattern** (`WishlistTabContent.tsx` lines 173–183):
```typescript
// CONTEXT D-04 (desktop 150ms / mobile 250ms) — mutually exclusive activation
// constraints require separate Mouse + Touch sensors (RESEARCH Anti-Patterns).
const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  }),
)
```

**Optimistic reorder state pattern** (`WishlistTabContent.tsx` lines 157–167):
```typescript
const photosById = useMemo(
  () => Object.fromEntries(photos.map((p) => [p.id, p])),
  [photos],
)
const initialIds = useMemo(() => photos.map((p) => p.id), [photos])

const [optimisticIds, setOptimistic] = useOptimistic<string[], string[]>(
  initialIds,
  (_state, newOrder) => newOrder,
)
const [, startTransition] = useTransition()
const [activeId, setActiveId] = useState<string | null>(null)
```

**Drag-end handler pattern** (`WishlistTabContent.tsx` lines 185–218):
```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) {
    setActiveId(null)
    return
  }
  const oldIdx = optimisticIds.indexOf(active.id as string)
  const newIdx = optimisticIds.indexOf(over.id as string)
  if (oldIdx < 0 || newIdx < 0) {
    setActiveId(null)
    return
  }
  const newOrder = arrayMove(optimisticIds, oldIdx, newIdx)
  startTransition(async () => {
    setOptimistic(newOrder)
    setActiveId(null)
    const result = await reorderWatchPhotos({ watchId, orderedIds: newOrder })
    if (!result.success) {
      toast.error("Couldn't save new order. Reverted.")
    }
    // On failure: no revalidatePath in action on error path → optimistic auto-reverts
  })
}
```

**DndContext + SortableContext shell** (`WishlistTabContent.tsx` lines 220–293):
```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={(e: DragStartEvent) => { setActiveId(e.active.id as string) }}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={optimisticIds.filter((id) => photosById[id])}
    strategy={horizontalListSortingStrategy}  // NOTE: horizontal, not rectSortingStrategy
  >
    <div className="flex overflow-x-auto gap-2">
      {optimisticIds
        .filter((id) => photosById[id])
        .map((id) => (
          <SortablePhotoThumb
            key={id}
            id={id}
            photo={photosById[id]}
            isCover={optimisticIds[0] === id}
            editMode={editMode}
            onDelete={() => handleDelete(id)}
          />
        ))}
      {/* +Add tile at end (edit mode only, below cap) */}
    </div>
  </SortableContext>
  <DragOverlay>
    {activeId && photosById[activeId] ? (
      <div className="scale-105 shadow-xl">
        {/* thumbnail clone at pointer */}
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
```

**Embla + edit-mode conflict resolution** (RESEARCH.md Pattern 4):
```typescript
// Reset embla draggable on edit mode toggle — prevents carousel swipe from
// competing with dnd-kit touch events during filmstrip drag (RESEARCH Pitfall 7).
useEffect(() => {
  emblaApi?.reInit({ draggable: !editMode })
}, [editMode, emblaApi])

// Stale-instance reset: edit toggle state reset on onPointerDown, not mount
// (MEMORY project_router_cache_stale_instance — Next 16 restores same client
// component instance on revisited dynamic /w/[ref] URLs).
const handleEditTogglePointerDown = () => {
  setEditMode(prev => !prev)
}
```

---

### `src/components/watch/SortablePhotoThumb.tsx` (component, event-driven)

**Analog:** `src/components/profile/SortableProfileWatchCard.tsx` (all 114 lines — read in full)

This is a near-exact mirror of `SortableProfileWatchCard`. The only differences: (a) it renders a 64×64px thumbnail image instead of a watch card, (b) it has a Cover badge at index [0], (c) it has a delete × badge in edit mode, and (d) dnd-kit listeners attach to the drag-handle icon only (not the full card) to avoid conflict with × tap.

**Full `useSortable` + style pattern** (`SortableProfileWatchCard.tsx` lines 46–63):
```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const {
  attributes, listeners, setNodeRef,
  transform, transition, isDragging, isOver, activeIndex, overIndex,
} = useSortable({ id })

const style: React.CSSProperties = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.3 : 1,
  touchAction: 'manipulation',  // REQUIRED — without it iOS Safari claims the
                                 // long-press as scroll (SortableProfileWatchCard comment, line 22)
}
```

**Drop indicator pattern** (`SortableProfileWatchCard.tsx` lines 66–112) — adapt for horizontal (left/right gap lines instead of top/bottom):
```typescript
// For horizontal filmstrip: left indicator when moving right (activeIndex < overIndex)
// right indicator when moving left (activeIndex > overIndex)
// Mirror the symmetry fix from SortableProfileWatchCard.tsx lines 70–79
const showDropIndicatorBefore = isOver && activeIndex >= 0 && activeIndex > overIndex
const showDropIndicatorAfter = isOver && activeIndex >= 0 && activeIndex < overIndex

return (
  <>
    {showDropIndicatorBefore && (
      <div className="w-0.5 h-full bg-ring rounded-full" aria-hidden="true" />
    )}
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      // NOTE: attach listeners to drag-handle icon only, not the full div
      // This prevents × badge click from triggering drag (RESEARCH Pitfall 3)
      aria-roledescription="Photo, grab to reorder"
      aria-label={`Photo ${index + 1}. ${isCover ? 'Cover. ' : ''}Press and hold to drag.`}
      className="relative w-16 h-16 flex-none rounded-md overflow-hidden"
    >
      {/* thumbnail image */}
      {isCover && <span className="absolute top-0 left-0 text-xs font-semibold bg-background/80 text-foreground px-1 py-0.5" aria-label="Cover photo">Cover</span>}
      {editMode && (
        <>
          {/* × badge — onClick only (no drag listeners here) */}
          <button onClick={onDelete} aria-label={`Delete photo ${index + 1}`} className="absolute top-1 right-1 size-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">×</button>
          {/* drag handle icon — THIS gets {...listeners} spread */}
          <div {...listeners} className="absolute bottom-1 left-1 cursor-grab active:cursor-grabbing">
            <GripVertical className="size-3 text-white/70" aria-hidden />
          </div>
        </>
      )}
    </div>
    {showDropIndicatorAfter && (
      <div className="w-0.5 h-full bg-ring rounded-full" aria-hidden="true" />
    )}
  </>
)
```

---

### `src/components/watch/PhotoDropzone.tsx` (component, file-I/O)

**Analog:** `src/components/watch/CatalogPhotoUploader.tsx` (lines 1–258, read in full)

Extends the single-file pattern to `multiple` files and adds an HTML5 desktop drop zone. The HEIC detection and conversion functions (`isHeicFile`, `convertHeic`) are copied verbatim from `CatalogPhotoUploader.tsx` (lines 58–84). `stripAndResize` import pattern is copied from `CatalogPhotoUploader.tsx` line 154 (lazy import).

**Hidden file input pattern** (`CatalogPhotoUploader.tsx` lines 185–193):
```typescript
const inputRef = useRef<HTMLInputElement | null>(null)

<input
  ref={inputRef}
  type="file"
  multiple                           // ADD: multiple for batch selection
  accept="image/*,.heic,.heif"       // COPY verbatim — matches both uploaders
  onChange={handleChange}
  disabled={busy || disabled}
  className="sr-only"
  aria-label="Upload photos from device"
/>
// Trigger programmatically from user-gesture handler:
function openPicker() { inputRef.current?.click() }
```

**Input reset after batch** (`CatalogPhotoUploader.tsx` line 132, `PhotoUploader.tsx` line 103):
```typescript
// CRITICAL: reset input value so same files can be re-selected after Remove
e.target.value = ''
```

**HEIC detection + conversion — copy verbatim** (`CatalogPhotoUploader.tsx` lines 58–84):
```typescript
function isHeicFile(file: File): boolean {
  const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
  const ext = file.name.toLowerCase()
  return mimeOk || ext.endsWith('.heic') || ext.endsWith('.heif')
}

async function convertHeic(file: File): Promise<Blob> {
  const worker = new Worker(
    new URL('../../lib/exif/heic-worker.ts', import.meta.url),
    { type: 'module' },
  )
  const buffer = await file.arrayBuffer()
  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const { buffer: ab, type } = e.data as { buffer: ArrayBuffer; type: string }
      worker.terminate()
      resolve(new Blob([ab], { type }))
    }
    worker.onerror = (err) => { worker.terminate(); reject(err) }
    worker.postMessage({ buffer, toType: 'image/jpeg', quality: 0.85 }, [buffer])
  })
}
```

**stripAndResize — lazy import pattern** (`CatalogPhotoUploader.tsx` line 154):
```typescript
// Lazy-import to keep canvas worker out of initial bundle
const { stripAndResize } = await import('@/lib/exif/strip')
const result = await stripAndResize(blob)
```

**Multi-file batch processing + cap check** (RESEARCH.md Pattern 5 — new pattern, no direct codebase analog):
```typescript
async function handleFiles(files: File[]) {
  const remaining = MAX_PHOTOS - currentPhotoCount
  const batch = files.slice(0, remaining)
  const rejected = files.slice(remaining)
  if (rejected.length > 0) {
    toast.warning(`Added ${batch.length} photo${batch.length !== 1 ? 's' : ''}. ${rejected.length} skipped — you've reached the 10-photo limit.`)
  }
  // Process SEQUENTIALLY — parallel causes sort_order race in addWatchPhoto
  // (RESEARCH Pitfall 4: DAL computes nextSort = max(sortOrder)+1; parallel uploads
  // may both compute the same nextSort)
  for (const file of batch) {
    await processSingleFile(file)
  }
}
```

**Desktop drop zone pattern** (RESEARCH.md Pattern 5):
```typescript
const [isDragging, setIsDragging] = useState(false)

<div
  role="button"
  tabIndex={0}
  aria-label="Upload photos — drop files here or press Enter to browse"
  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
  onDragLeave={() => setIsDragging(false)}
  onDrop={e => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }}
  className={cn(
    'border-dashed border-2 rounded-lg p-4 text-center min-h-[64px] bg-muted transition-colors',
    isDragging && 'ring-2 ring-ring',
    atCap && 'opacity-50 cursor-not-allowed',
  )}
>
  {/* Camera icon + "Drop photos here or tap to choose" */}
</div>
```

---

### `src/components/watch/WatchPhotoStep.tsx` (component, file-I/O + request-response)

**Analog:** `src/components/watch/CatalogPhotoUploader.tsx` for the upload mechanics; `src/components/watch/AddWatchFlow.tsx` for the step framing pattern.

This is the leaner add-flow variant (Claude's Discretion). It reuses the upload mechanics from `PhotoDropzone` but without the filmstrip/carousel — just a drop zone + per-file progress grid + primary/secondary CTAs.

**Step framing pattern** (mirrors `AddWatchFlow.tsx` manual-entry branch, lines 581–601):
```typescript
// Same "back link + content" structure as the manual-entry branch in AddWatchFlow
<div className="space-y-4">
  {/* Skip link — same styling as "← Cancel" in AddWatchFlow manual-entry */}
  <button
    type="button"
    onClick={() => onSkip()}
    className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
  >
    Skip for now
  </button>

  {/* Main content: heading + dropzone + per-file progress */}
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Add your photos</h2>
      <p className="text-sm text-muted-foreground">Show how it looks in person.</p>
    </div>
    {/* PhotoDropzone reused here */}
    {/* Per-file progress thumbnails in 3-column grid */}
    {/* Primary CTA */}
    <Button
      variant="default"
      className="w-full"
      onClick={uploadedCount >= 1 ? onDone : handleSelectFiles}
    >
      {uploadedCount >= 1 ? 'Continue' : 'Add photos'}
    </Button>
  </div>
</div>
```

**Skip-with-friction copy contract** (UI-SPEC.md lines 173, 271–272):
```typescript
// "Skip for now" is a plain <button> styled as text link — NOT a Button component.
// Smaller, lower-contrast: text-sm text-muted-foreground
// Primary CTA uses Button variant="default"
// Never blocks save (onSkip calls router.push(destination) directly)
```

---

### `src/app/actions/watchPhotos.ts` (server action, request-response)

**Analog:** `src/app/actions/wishlist.ts` — `reorderWishlist` (lines 183–253, read in full)

This is the most direct copy target in the codebase. Three actions needed: `reorderWatchPhotosAction`, `deleteWatchPhotoAction`, `addWatchPhotoAction`. All follow the same structure.

**File header + imports pattern** (`wishlist.ts` lines 1–19):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import {
  bulkReorderPhotos,
  addWatchPhoto,
  deleteWatchPhoto,
  PhotoCapExceededError,
  OwnerMismatchError,
  SetMismatchError,
} from '@/data/watches'
import type { ActionResult } from '@/lib/actionTypes'
```

**Zod schema + auth guard pattern** (`wishlist.ts` lines 202–221):
```typescript
// Mass-assignment protection: .strict() rejects any extra payload key
// userId NEVER taken from the client — always from getCurrentUser() (session)
const schema = z.object({
  watchId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1).max(10),  // cap = 10, not 500
}).strict()

export async function reorderWatchPhotosAction(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }
  // ... try/catch DAL call + revalidatePath
}
```

**revalidatePath pattern** (`wishlist.ts` line 233 + RESEARCH.md Pitfall 8):
```typescript
// BR-02 pattern: use route TEMPLATE, not concrete URL
// wishlist uses: revalidatePath('/u/[username]/[tab]', 'page')
// watch photos uses:
revalidatePath('/w/[ref]', 'page')
// This invalidates ALL pages matching the route pattern (acceptable at v7.0 scale)
```

**instanceof error discrimination** (`wishlist.ts` lines 238–252):
```typescript
try {
  await bulkReorderPhotos(user.id, parsed.data.watchId, parsed.data.orderedIds)
  revalidatePath('/w/[ref]', 'page')
  return { success: true, data: undefined }
} catch (err) {
  console.error('[reorderWatchPhotosAction] unexpected error:', err)
  if (err instanceof OwnerMismatchError) {
    return { success: false, error: 'Some photos do not belong to you.' }
  }
  if (err instanceof SetMismatchError) {
    return { success: false, error: 'Photos changed in another tab. Refresh and try again.' }
  }
  return { success: false, error: "Couldn't save new order." }
}
```

**deleteWatchPhotoAction Zod schema** (different shape — two UUIDs):
```typescript
const deleteSchema = z.object({
  watchId: z.string().uuid(),
  photoId: z.string().uuid(),
}).strict()
```

**addWatchPhotoAction Zod schema** (`watches.ts` insertWatchSchema style, simpler):
```typescript
const addSchema = z.object({
  watchId: z.string().uuid(),
  storagePath: z.string().min(1),  // already uploaded by client; record the path
}).strict()
// PhotoCapExceededError from DAL is the authoritative backstop
```

---

### `src/data/watches.ts` — extend: `getWatchPhotosForWatch` (DAL, CRUD)

**Analog:** `src/data/watches.ts` — `addWatchPhoto` (lines 567–605, read in full)

`addWatchPhoto` shows the Drizzle select/where/orderBy pattern for the `watchPhotos` table. `getWatchPhotosForWatch` is a pure SELECT with no mutation — mirror the select shape.

**Drizzle select pattern for `watchPhotos` table** (`watches.ts` `addWatchPhoto` ownership check query, lines 573–579):
```typescript
// Pattern: db.select({ fields }).from(table).where(conditions).orderBy(...)
import { asc, eq } from 'drizzle-orm'
import { watchPhotos } from '@/db/schema'

export async function getWatchPhotosForWatch(
  watchId: string,
): Promise<{ id: string; storagePath: string; sortOrder: number }[]> {
  const rows = await db
    .select({
      id: watchPhotos.id,
      storagePath: watchPhotos.storagePath,
      sortOrder: watchPhotos.sortOrder,
    })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
    .orderBy(asc(watchPhotos.sortOrder))
  return rows
}
// NOTE: No userId param — ownership is implicitly enforced because watchId
// resolves from a watch the RSC already confirmed the viewer can see.
// The RSC handles the ownership framing; this is a pure read by watchId.
```

---

### `src/app/w/[ref]/page.tsx` — modify: signed URL fetch (RSC page, request-response)

**Analog:** `src/app/wears/[username]/page.tsx` (lines 130–139, read in full)

The wear-photos page signs storage paths into HTTPS URLs using `createSupabaseServerClient().storage.from(bucket).createSignedUrl()`. Watch photos need the same pattern against the `watch-photos` bucket.

**Signed URL pattern — copy verbatim, adapt bucket** (`wears/[username]/page.tsx` lines 130–139):
```typescript
// COPY PATTERN: per-request sign at page level — Pitfall F-2 equivalent
// "never in a DAL function or 'use cache' scope" (wears/[username]/page.tsx line 28)
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getWatchPhotosForWatch } from '@/data/watches'

const rawPhotos = await getWatchPhotosForWatch(watch.id)
const supabase = await createSupabaseServerClient()
const signedPhotos = await Promise.all(
  rawPhotos.map(async (p) => {
    const { data } = await supabase.storage
      .from('watch-photos')   // bucket name — different from 'wear-photos'
      .createSignedUrl(p.storagePath, 60 * 60)  // 60-min TTL, matches wear-photos pattern
    return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
  })
)
// Pass signedPhotos to WatchDetail as a new prop → WatchPhotoSection
```

**Where in the RSC to insert** (`page.tsx` lines 66–153 — Branch 1 per-user path):
```typescript
// INSERT AFTER: const perUserResult = await getWatchByIdForViewer(user.id, ref)
// BEFORE: the return() block that renders <WatchDetail ...>
// The rawPhotos fetch + sign happens alongside the existing parallel fetches.
// signedPhotos: Array<{ id: string; signedUrl: string | null; sortOrder: number }>
// is a new prop on WatchDetail (and threaded to WatchPhotoSection).
```

---

### `src/components/watch/WatchDetail.tsx` — modify: image block replacement (component, request-response)

**Analog:** `src/components/watch/WatchDetail.tsx` — the exact block being replaced (lines 128–143, read in full)

The block to replace:

```typescript
// LINES 128–143 — REPLACE THIS ENTIRE BLOCK:
<div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg bg-muted">
  {safeUrl ? (
    <Image
      src={safeUrl}
      alt={`${watch.brand} ${watch.model}`}
      fill
      sizes="(max-width: 1024px) 100vw, 50vw"
      className="object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <WatchIcon className="h-16 w-16 text-muted-foreground/40" />
    </div>
  )}
</div>
```

**Replace with:**
```typescript
// NEW — WatchPhotoSection receives signed photos + viewerCanEdit + watch fallback
<WatchPhotoSection
  photos={signedPhotos}        // new prop from RSC
  watchId={watch.id}
  catalogFallbackUrl={getSafeImageUrl(watch.imageUrl) ?? null}  // catalog imageUrl signing happens elsewhere
  brandModel={`${watch.brand} ${watch.model}`}
  viewerCanEdit={viewerCanEdit}
/>
```

**Container class constants to preserve** (UI-SPEC.md lines 340–341 confirm):
```typescript
// The carousel container INHERITS these from the existing image block:
// aspect-square w-full max-w-md rounded-lg — match WatchDetail line 129
// These are locked UI dimensions (UI-SPEC §Spacing Scale + §Responsive Contract)
```

**WatchDetail prop interface extension** (`WatchDetail.tsx` lines 33–61):
```typescript
// Add to WatchDetailProps:
signedPhotos?: Array<{ id: string; signedUrl: string | null; sortOrder: number }>
// Optional for backward compat with any existing caller that hasn't threaded photos
```

**Delete Dialog pattern for reference** (WatchDetail.tsx existing whole-watch delete, lines 85–86 state + ~229 Dialog):
```typescript
// Existing delete uses Dialog for the whole-watch destructive action.
// Per-photo delete uses LIGHTER pattern: immediate optimistic + undo toast.
// Do NOT use Dialog for per-photo delete — UI-SPEC §Delete State + Claude's Discretion.
const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
// Reference only — per-photo does NOT replicate this Dialog pattern.
```

---

### `src/components/watch/AddWatchFlow.tsx` — modify: photos-pending state (component, event-driven)

**Analog:** `src/components/watch/AddWatchFlow.tsx` — the `wishlist-rationale-open` render branch (lines 537–558) and the `handleWishlistConfirm` handler (lines 376–435) as the pattern for intercepting a flow step result.

**New state handling pattern** (mirrors `handleWishlistConfirm` structure, lines 376–386):
```typescript
// After addWatch succeeds in the form-prefill / manual-entry paths,
// instead of calling router.push(dest), call onWatchCreated:
const handleWatchCreated = (watchId: string, dest: string) => {
  setState({ kind: 'photos-pending', watchId, destination: dest })
}

// In the form-prefill render branch (lines 561–568), add the optional prop:
{state.kind === 'form-prefill' && (
  <WatchForm
    mode="create"
    lockedStatus="owned"
    watch={extractedToPartialWatch(state.extracted, 'owned')}
    returnTo={initialReturnTo}
    viewerUsername={viewerUsername}
    onWatchCreated={handleWatchCreated}   // NEW optional prop
  />
)}
```

**New render branch** (mirrors wishlist-rationale-open branch structure, lines 537–558):
```typescript
{state.kind === 'photos-pending' && (
  <WatchPhotoStep
    watchId={state.watchId}
    onDone={() => {
      setUrl('')
      setRail([])
      setState({ kind: 'idle' })
      router.push(state.destination)
    }}
    onSkip={() => {
      setUrl('')
      setRail([])
      setState({ kind: 'idle' })
      router.push(state.destination)
    }}
  />
)}
```

**Activity-hide cleanup extension** (AddWatchFlow.tsx lines 167–180):
```typescript
// EXTEND the existing useLayoutEffect cleanup to also reset photos-pending:
useLayoutEffect(() => {
  return () => {
    const s = stateRef.current
    if (s.kind === 'form-prefill') return
    if (s.kind === 'idle' && urlRef.current === '' && railRef.current.length === 0) return
    // EXISTING: resets to idle on Activity-hide.
    // ADD: 'photos-pending' must also reset (RESEARCH Pitfall 6 — Activity preserved
    // state means back-nav returns to photos-pending for the old watchId).
    setState({ kind: 'idle' })
    setUrl('')
    setRail([])
  }
}, [])
```

---

### `src/components/watch/flowTypes.ts` — modify: add photos-pending (types)

**Analog:** `src/components/watch/flowTypes.ts` — existing `FlowState` union (lines 17–29, read in full)

**Add one variant to the discriminated union** (after the last `|` in the union, following the same pattern):
```typescript
// EXISTING union ends at:
| { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory }

// ADD:
| { kind: 'photos-pending'; watchId: string; destination: string }
// watchId: the ID of the just-created watch row (needed for addWatchPhotoAction)
// destination: where to router.push() after Done or Skip
```

---

## Shared Patterns

### Authentication in Server Actions
**Source:** `src/app/actions/wishlist.ts` lines 208–215
**Apply to:** `src/app/actions/watchPhotos.ts` — all three actions
```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}
```

### Zod `.strict()` mass-assignment protection
**Source:** `src/app/actions/wishlist.ts` lines 202–205 (schema definition)
**Apply to:** `src/app/actions/watchPhotos.ts` — all schemas
```typescript
// .strict() rejects any payload key not declared in the schema.
// userId is NEVER taken from the client — always from getCurrentUser().
const schema = z.object({ ... }).strict()
```

### ActionResult type
**Source:** `src/lib/actionTypes.ts` lines 5–9
**Apply to:** `src/app/actions/watchPhotos.ts` — all action return types
```typescript
import type { ActionResult } from '@/lib/actionTypes'
// ActionResult<void> for mutations that return no data
// ActionResult<{ id: string }> if addWatchPhotoAction returns the new row id
```

### Toast feedback (sonner)
**Source:** `src/components/profile/WishlistTabContent.tsx` line 215
**Apply to:** `src/components/watch/WatchPhotoSection.tsx`, `WatchPhotoStep.tsx`
```typescript
import { toast } from 'sonner'
// Error: toast.error("Couldn't save new order. Reverted.")
// Warning (cap): toast.warning("Added {n} photo(s). {m} skipped — you've reached the 10-photo limit.")
// Success (reorder): toast.success("Order updated")
// Delete (undo): toast("Photo deleted", { action: { label: 'Undo', onClick: () => handleUndo() }, duration: 5000 })
```

### `cn()` for conditional class composition
**Source:** Used throughout the codebase; `src/lib/utils.ts`
**Apply to:** All new components
```typescript
import { cn } from '@/lib/utils'
// Example: cn('base-classes', condition && 'conditional-class', isDragging && 'opacity-30')
```

### `viewerCanEdit` owner-gate pattern
**Source:** `src/components/watch/WatchDetail.tsx` line 44 (prop), line 179 (guard usage)
**Apply to:** `src/components/watch/WatchPhotoSection.tsx`
```typescript
// Prop: viewerCanEdit?: boolean (defaults to true for backward compat — match WatchDetail)
// Usage: {viewerCanEdit && <button>Edit photos</button>}
// Non-owners NEVER see Edit toggle, +Add tile, × badges, or drag handles (D-03)
```

### `revalidatePath` route template pattern
**Source:** `src/app/actions/wishlist.ts` line 233, comment lines 226–232
**Apply to:** `src/app/actions/watchPhotos.ts` — all actions that mutate photos
```typescript
// BR-02 pattern: use route TEMPLATE, not concrete URL
revalidatePath('/w/[ref]', 'page')
// 'page' arg invalidates the page-level render; mirrors reorderWishlist exactly
```

### HEIC → `stripAndResize` pipeline
**Source:** `src/components/watch/CatalogPhotoUploader.tsx` lines 58–165
**Apply to:** `src/components/watch/PhotoDropzone.tsx`, `WatchPhotoStep.tsx`
```typescript
// 1. isHeicFile(file) — MIME + extension check
// 2. convertHeic(file) via Worker — WASM HEIC decode (only for HEIC files)
// 3. const { stripAndResize } = await import('@/lib/exif/strip') — lazy import
// 4. const result = await stripAndResize(blob) — EXIF strip + ≤1080px JPEG @0.85
// 5. uploadWatchPhoto(userId, photoId, result.blob) — client-direct to Storage
// 6. addWatchPhotoAction({ watchId, storagePath }) — server action records row
```

---

## No Analog Found

No files in this phase lack a close codebase analog. Every new file has a direct structural match. The embla carousel integration is the one genuinely new pattern — it is thoroughly documented in RESEARCH.md Pattern 1 and the verified Context7 API, so the planner should reference RESEARCH.md §Pattern 1 (lines 163–232) for the embla-specific excerpt.

---

## Metadata

**Analog search scope:** `src/components/profile/`, `src/components/watch/`, `src/components/wywt/`, `src/app/actions/`, `src/data/watches.ts`, `src/app/w/[ref]/page.tsx`, `src/app/wears/[username]/page.tsx`, `src/lib/storage/watchPhotos.ts`, `src/lib/actionTypes.ts`
**Files read:** 14 source files
**Pattern extraction date:** 2026-05-25

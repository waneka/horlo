# Phase 61: Photo Upload + Carousel UI — Research

**Researched:** 2026-05-25
**Domain:** embla-carousel-react, @dnd-kit/sortable (horizontal), multi-file upload + drop zone, server actions, AddWatchFlow state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Carousel is the clean viewing surface for all viewers. Owner controls live on the always-on thumbnail filmstrip beneath the carousel — no modal/sheet.
- **D-02:** Filmstrip visible to everyone as tap-to-jump navigation. Owner gets an "Edit photos" toggle. Off (default) = clean viewing + tap-to-jump. On = delete × badge per thumbnail, trailing "+ Add" tile, drag-reorder active.
- **D-03:** Owner-only affordances gated on `viewerCanEdit` (existing prop). Non-owners never see Edit toggle, +Add tile, ×, or drag handles. Server actions double-verify ownership.
- **D-04:** Drag-reorder on the filmstrip (in Edit mode) using `@dnd-kit/core` + `@dnd-kit/sortable`, dual Mouse + Touch sensors (activation constraints mutually exclusive on one sensor), `touchAction: 'manipulation'` on draggable. Mirror `SortableProfileWatchCard` / `WishlistTabContent`.
- **D-05:** `bulkReorderPhotos` DAL helper ALREADY EXISTS in `src/data/watches.ts` (Phase 60 shipped it). Phase 61 only needs the server action wrapping it.
- **D-06:** Reorder uses optimistic update (mirror `reorderWishlist`'s `useOptimistic`/transition) + toast on save. On failure: revert + error toast.
- **D-07:** First filmstrip thumbnail always carries a small "Cover" badge that moves with drag.
- **D-08:** No separate "Make cover" button — drag-to-first IS the cover-setting gesture.
- **D-09:** Zero owner uploads + catalog imageUrl → catalog stock image as single slide. Once owner uploads ≥1 photo, carousel shows owner photos only; catalog fallback drops out.
- **D-10:** Cover fallback chain is Phase 60's: owner [0] → catalog imageUrl → placeholder.
- **D-11:** Carousel uses `embla-carousel-react` (already installed at 8.6.0) for one-at-a-time + swipe + arrows. Position indicator (dots/index). Owner photos only in Phase 61 — wear-pic union is Phase 62.
- **D-12:** File input gets `multiple`. Each file routes through inherited pipeline: HEIC→JPEG (worker) → `stripAndResize` → `uploadWatchPhoto` → `addWatchPhoto` server action.
- **D-13:** Desktop also gets drag-and-drop zone. Mobile uses OS picker with `accept="image/*,.heic,.heif"`, no forced `capture` attr.
- **D-14:** Cap enforcement is UI + DAL. +Add tile hidden/disabled at cap with clear message. Batch exceeding remaining slots accepts up to cap, rejects extras with message. `PhotoCapExceededError` is the backstop.
- **D-15:** "Add your photos" step in `AddWatchFlow` state machine after verdict/identification, before final commit. Works for URL-extract and manual-entry paths.
- **D-16:** Skippable with friction. Primary CTA = "Add photos"; "Skip for now" is smaller, lower-contrast, never blocks saving.

### Claude's Discretion

- Exact toast copy ("Order updated", "Photo deleted", cap-reached message), per-photo upload progress/spinner UX, delete confirmation pattern (lighter than whole-watch delete Dialog — e.g., immediate with undo toast or small confirm).
- Whether the add-watch step reuses the exact detail-page filmstrip/upload component or a leaner add-flow variant. Reuse upload mechanics either way (D-12/D-13).
- Embla position-indicator style (dots vs. "2/7" counter) and arrow styling.
- Whether the filmstrip wraps/scrolls horizontally at higher photo counts (≤10 → likely a single scrollable row).

### Deferred Ideas (OUT OF SCOPE)

- Public wear-pic surfacing into carousel + per-pic hide — Phase 62.
- Detail-page information-hierarchy redesign — Phase 64.
- Per-account photo/storage quota — PHOTO-F1 (future).
- In-app photo editing beyond capture crop — PHOTO-F2.
- Multi-photo extraction from URL import — PHOTO-F3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHOTO-02 | A user can upload one or more photos to a watch they own | §Multi-file upload + drop zone; §WatchPhotoUploader component design; `addWatchPhoto` server action; cap enforcement |
| PHOTO-03 | Photos display in a carousel showing one photo at a time, navigable by arrows and swipe | §embla-carousel-react integration; `useEmblaCarousel`, `scrollTo`, `reInit`, `on('select')`; index sync on slide set change |
| PHOTO-05 | A user can reorder photos by drag-and-drop; reordering sets the cover/thumbnail | §dnd-kit horizontal filmstrip; `bulkReorderPhotos` DAL already exists; `reorderWatchPhotos` server action needed; optimistic update pattern |
| PHOTO-06 | A user can delete an individual photo from a watch they own | §delete server action; `deleteWatchPhoto` DAL exists; storage object purge; optimistic update |
| PHOTO-09 | The add-watch flow strongly encourages photo upload via a prominent affordance | §AddWatchFlow state machine surgery; watchId timing; `FlowState` extension |
</phase_requirements>

---

## Summary

Phase 61 is a UI-composition phase that assembles three main surfaces: (1) an embla-powered carousel + always-on thumbnail filmstrip replacing the single `<Image>` block in `WatchDetail`, (2) a multi-file upload + desktop drop zone that routes through the existing Phase 60 HEIC→`stripAndResize`→`uploadWatchPhoto`→`addWatchPhoto` pipeline, and (3) a new "Add your photos" step inserted into the `AddWatchFlow` state machine.

The critical discovery is that `bulkReorderPhotos` **already exists** in `src/data/watches.ts` (Phase 60 shipped it). The only server-side work is the thin server-action wrapper. The genuinely complex work is (a) the embla+dnd-kit gesture coexistence on the filmstrip and (b) the `AddWatchFlow` surgery to insert the photos step and capture the watchId before navigation.

The signed-URL problem is real and unresolved by the DAL: `Watch.imageUrl` for owner photos is a raw Supabase storage path (e.g., `{userId}/{photoId}.jpg`), not a public URL. The carousel and filmstrip need signed URLs. The page.tsx RSC must sign URLs before passing photos to the client component, mirroring the wear-photos pattern in `src/app/wears/[username]/page.tsx`.

**Primary recommendation:** Build the carousel + filmstrip as a single `<WatchPhotoSection>` client component that the RSC (`/w/[ref]/page.tsx`) populates with pre-signed URLs. The filmstrip dnd-kit context disables embla swipe (`draggable: false`) when Edit mode is on, eliminating embla↔dnd-kit gesture conflict entirely.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Carousel display (PHOTO-03) | Browser / Client | — | Embla carousel is entirely client-side JS; swipe, arrow buttons, position indicator all require `useEmblaCarousel` hook |
| Filmstrip drag-reorder (PHOTO-05) | Browser / Client | API / Backend | Optimistic reorder is client-side; `reorderWatchPhotos` server action commits to DB |
| Photo upload pipeline (PHOTO-02) | Browser / Client (upload) + API / Backend (record) | — | Client-direct to Supabase Storage (RLS enforces ownership); `addWatchPhoto` server action records the row |
| Photo deletion (PHOTO-06) | API / Backend | Browser / Client | `deleteWatchPhoto` server action owns delete + storage purge; client optimistic removes the item |
| Signed URL resolution | Frontend Server (SSR) | — | Page RSC signs raw storagePaths before hydrating the client component; never signed client-side |
| Cap enforcement (PHOTO-07) | Browser / Client (UI gate) + API / Backend (DAL gate) | — | UI hides/disables +Add at cap; `addWatchPhoto` DAL is the authoritative backstop |
| Add-watch photo step (PHOTO-09) | Browser / Client | API / Backend | FlowState machine lives in `AddWatchFlow` (client); `addWatch` server action returns watchId enabling upload |
| Owner-gate | API / Backend (re-check) + Browser / Client (hide) | — | `viewerCanEdit` hides UI; server actions double-verify ownership via DAL |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `embla-carousel-react` | 8.6.0 | Carousel, one-at-a-time, swipe, arrows | Already installed (D-11); locked decision |
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop context + sensors | Already installed (D-04); Phase 27 precedent |
| `@dnd-kit/sortable` | 10.0.0 | `useSortable`, `SortableContext`, `arrayMove` | Already installed; Phase 27 precedent |
| `@dnd-kit/utilities` | 3.2.2 | `CSS.Transform.toString()` | Already installed; used in `SortableProfileWatchCard` |
| `sonner` | 2.0.7 | Toast feedback (reorder/delete/cap/error) | Already used for `reorderWishlist` pattern |

[VERIFIED: package.json and npm view]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/image` | 16.2.3 | Carousel slide images + filmstrip thumbnails | Always — unoptimized flag is set in next.config.ts, safe for Supabase signed URLs |
| `lucide-react` | 1.8.0 | ChevronLeft, ChevronRight, X, Plus, GripVertical icons | Arrows, delete × badge, +Add, drag handle |

**No new dependencies expected** (D-12/D-13/D-11 — all libraries already installed).

---

## Architecture Patterns

### System Architecture Diagram

```
/w/[ref]/page.tsx (RSC)
   │  resolves perUserResult → isOwner
   │  fetches watch_photos rows (new: getWatchPhotosForWatch)
   │  signs storagePaths → [{ id, signedUrl, sortOrder }]
   ▼
WatchDetail.tsx ('use client')
   ├── <WatchPhotoSection>       ← NEW 'use client' component
   │      ├── embla carousel (reading carousel)
   │      ├── thumbnail filmstrip (always-on)
   │      │     ├── [viewers] tap-to-jump → embla.scrollTo(index)
   │      │     └── [owner, Edit ON]
   │      │           ├── drag-reorder (dnd-kit DndContext, horizontal)
   │      │           ├── delete × badge → deleteWatchPhoto action
   │      │           └── +Add tile → file picker OR drop zone
   │      └── embla draggable: false when Edit mode ON (prevents conflict)
   │
/watch/new → AddWatchFlow.tsx ('use client')
   ├── ... (existing states: idle, extracting, verdict-ready, form-prefill, manual-entry)
   ├── NEW: 'photos-pending' state { kind: 'photos-pending', watchId }
   │      ├── WatchPhotoStep (lean add-flow variant)
   │      │     ├── drop zone + multi-file picker
   │      │     ├── per-file progress
   │      │     ├── "Add photos" primary CTA → starts uploads → transitions to 'committing'
   │      │     └── "Skip for now" secondary link → router.push(dest)
   │      └── uploads: client-direct → addWatchPhoto server action (watchId already exists)
   └── WatchForm commit → addWatch returns Watch → result.data.id → setState({ kind: 'photos-pending', watchId: result.data.id })
```

### Recommended Project Structure

```
src/components/watch/
├── WatchPhotoSection.tsx        # NEW — carousel + filmstrip + Edit toggle + upload
├── WatchPhotoStep.tsx           # NEW — leaner add-flow photo step (or reuses WatchPhotoSection)
├── SortablePhotoThumb.tsx       # NEW — useSortable thumbnail wrapper (mirrors SortableProfileWatchCard)
├── PhotoDropzone.tsx            # NEW — desktop drag-and-drop zone + multi-file <input>
src/app/actions/
└── watchPhotos.ts               # NEW — addWatchPhotoAction, deleteWatchPhotoAction, reorderWatchPhotosAction
src/data/watches.ts              # EXTEND — add getWatchPhotosForWatch function
src/app/w/[ref]/page.tsx         # MODIFY — fetch + sign photos, pass to WatchDetail
src/components/watch/WatchDetail.tsx  # MODIFY — replace single image block with <WatchPhotoSection>
src/components/watch/AddWatchFlow.tsx # MODIFY — insert 'photos-pending' state + WatchForm result capture
src/components/watch/flowTypes.ts    # MODIFY — add 'photos-pending' FlowState variant
```

### Pattern 1: embla-carousel-react — Correct Integration

**What:** `useEmblaCarousel` returns `[emblaRef, emblaApi]`. `emblaRef` attaches to the viewport div. `emblaApi` is the imperative API (null until mounted).

**When to use:** One-at-a-time slide navigation with swipe + arrows.

```typescript
// Source: Context7 /davidjerleke/embla-carousel [VERIFIED]
import useEmblaCarousel from 'embla-carousel-react'
import { useState, useEffect, useCallback } from 'react'

export function WatchCarousel({ slides }: { slides: SignedPhoto[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateButtonState = useCallback((api: typeof emblaApi) => {
    if (!api) return
    setSelectedIndex(api.selectedSnap())
    setCanScrollPrev(api.canGoToPrev())
    setCanScrollNext(api.canGoToNext())
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    updateButtonState(emblaApi)
    emblaApi.on('select', updateButtonState)
    emblaApi.on('reinit', updateButtonState)
    return () => {
      emblaApi.off('select', updateButtonState)
      emblaApi.off('reinit', updateButtonState)
    }
  }, [emblaApi, updateButtonState])

  // Jump to specific slide (filmstrip tap-to-jump)
  const goToSlide = (index: number) => emblaApi?.scrollTo(index)

  return (
    <div className="embla">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container flex">
          {slides.map((photo, i) => (
            <div key={photo.id} className="embla__slide flex-none w-full">
              <Image src={photo.signedUrl} alt={`Photo ${i + 1}`} fill className="object-cover" />
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => emblaApi?.goToPrev()} disabled={!canScrollPrev}>←</button>
      <button onClick={() => emblaApi?.goToNext()} disabled={!canScrollNext}>→</button>
      <span>{selectedIndex + 1} / {slides.length}</span>
    </div>
  )
}
```

**Key APIs verified:**

| API | Signature | Purpose |
|-----|-----------|---------|
| `useEmblaCarousel(options)` | `[ref, api]` | Hook; api is null until mounted |
| `api.scrollTo(index, instant?)` | `(number, boolean?) => void` | Jump to slide by index (filmstrip tap) |
| `api.goToNext(instant?)` / `api.goToPrev(instant?)` | `(boolean?) => void` | Arrow buttons |
| `api.canGoToNext()` / `api.canGoToPrev()` | `() => boolean` | Arrow disabled state |
| `api.selectedSnap()` | `() => number` | Current index for position indicator |
| `api.on('select', cb)` / `api.off('select', cb)` | Subscribe/unsubscribe | Fires on slide change |
| `api.on('reinit', cb)` | Subscribe | Fires when slide count changes (add/delete/reorder auto-triggers via `slideChanges: true` default) |
| `api.reInit(options?)` | `(options?) => void` | Force re-initialize (merge options, replace plugins) |

[VERIFIED: Context7 /davidjerleke/embla-carousel]

### Pattern 2: Sync carousel index when photos change (add/delete/reorder)

**What:** Embla v8 automatically watches the container for added/removed slides via MutationObserver (default `slideChanges: true`) and calls `reInit` internally. This fires the `'reinit'` event. No manual `reInit` call needed for DOM mutations.

**Critical for stale-instance gotcha (MEMORY `project_router_cache_stale_instance`):** The Router Cache in Next 16 restores the SAME stale client component instance on revisited dynamic `/w/[ref]` URLs. Edit-toggle state and carousel index will appear stuck if reset is tied to mount. Reset the Edit toggle to `false` on `onPointerDown` (interaction), not on mount/useEffect. Carousel index is managed by embla itself and resets to 0 on `reInit`.

```typescript
// After uploading a photo — carousel auto-updates because the slide DOM changes.
// After deleting — same.
// After reorder — call api.scrollTo(newCoverIndex, true) to jump to cover.
// After a cross-session revisit — embed edit toggle reset in onPointerDown:
const [editMode, setEditMode] = useState(false)
const handleEditTogglePointerDown = () => {
  // Reset stale state on interaction, not mount (MEMORY project_router_cache_stale_instance)
  setEditMode(prev => !prev)
}
```

[VERIFIED: Context7 /davidjerleke/embla-carousel — `slideChanges` option docs; MEMORY cited]

### Pattern 3: dnd-kit horizontal filmstrip

**What:** The filmstrip uses `horizontalListSortingStrategy` instead of `rectSortingStrategy` (which is for grids). The rest of the setup mirrors `WishlistTabContent`/`SortableProfileWatchCard` verbatim.

```typescript
// Source: mirrors SortableProfileWatchCard.tsx + WishlistTabContent.tsx [VERIFIED: codebase]
import {
  DndContext, closestCenter, MouseSensor, TouchSensor,
  DragOverlay, useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, horizontalListSortingStrategy
} from '@dnd-kit/sortable'

// In the filmstrip component:
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
)

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={optimisticIds} strategy={horizontalListSortingStrategy}>
    <div className="flex overflow-x-auto gap-2">
      {optimisticIds.map(id => (
        <SortablePhotoThumb key={id} id={id} photo={photosById[id]} />
      ))}
      {/* +Add tile at end */}
    </div>
  </SortableContext>
</DndContext>
```

**Key difference from wishlist grid:** Use `horizontalListSortingStrategy` (not `rectSortingStrategy`). Filmstrip is a single horizontal row, so the grid 2D strategy is wrong. Drop indicators should show left/right gap lines, not top-bottom.

[VERIFIED: @dnd-kit/sortable package; codebase SortableProfileWatchCard.tsx]

### Pattern 4: Embla ↔ dnd-kit gesture conflict resolution

**The conflict:** Both embla (carousel swipe) and dnd-kit (filmstrip drag) claim pointer/touch events on the same vertical region of the screen. Embla listens for drag on the carousel viewport; dnd-kit listens for drag on filmstrip thumbnails. When Edit mode is ON, both surfaces could fire simultaneously.

**Resolution — disable embla drag when Edit mode is ON:**

```typescript
const [emblaRef, emblaApi] = useEmblaCarousel({
  loop: false,
  draggable: !editMode,  // embla's built-in option — set false during Edit mode
})
// OR re-init on mode toggle:
useEffect(() => {
  emblaApi?.reInit({ draggable: !editMode })
}, [editMode, emblaApi])
```

When `draggable: false`, embla no longer competes for touch events on the carousel viewport. The filmstrip's dnd-kit context owns those events during Edit mode. Swiping the carousel is meaningless while editing thumbnails anyway (filmstrip is the primary surface).

**`touchAction: 'manipulation'` remains required** on each `SortablePhotoThumb` — without it, iOS Safari claims the long-press as a scroll gesture instead of letting dnd-kit's TouchSensor promote it to a drag.

[VERIFIED: Context7 /davidjerleke/embla-carousel `draggable` option; codebase SortableProfileWatchCard.tsx comment on touchAction]

### Pattern 5: Multi-file upload + desktop drop zone

**What:** Extend the existing single-file pattern (`PhotoUploader`, `CatalogPhotoUploader`) to `multiple` and add an HTML5 drag-and-drop zone for desktop.

```typescript
// Extending the CatalogPhotoUploader single-file pattern:
// 1. Add multiple to the input
// 2. Iterate e.target.files (FileList) — process each file sequentially
// 3. Track per-file state: queued → processing → uploaded | failed
// 4. Cap check FIRST — compute remaining = max - current; truncate FileList
// 5. Desktop drop zone: onDrop handler on a container div

async function handleFiles(files: File[]) {
  const remaining = MAX_PHOTOS - currentPhotoCount
  const batch = files.slice(0, remaining)
  const rejected = files.slice(remaining)
  if (rejected.length > 0) {
    showCapReachedToast(rejected.length)
  }
  // Process each file in sequence (avoid race conditions on sort_order)
  for (const file of batch) {
    await processSingleFile(file)  // HEIC→stripAndResize→uploadWatchPhoto→addWatchPhoto
  }
}

// Desktop drop zone:
<div
  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
  onDragLeave={() => setIsDragging(false)}
  onDrop={e => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }}
  className={cn('...', isDragging && 'ring-2 ring-ring')}
>
  <input type="file" multiple accept="image/*,.heic,.heif" onChange={...} className="sr-only" />
  Drop photos here or tap to choose
</div>
```

**HEIC conversion per-file:** The existing `convertHeic` in `PhotoUploader.tsx` spawns a new Worker per file. For a batch of 5 files, this spawns 5 workers. This is fine at ≤10 photos — workers terminate after each conversion. No pooling needed at this scale.

**Sequential vs parallel processing:** Process files sequentially to avoid sort_order race conditions. `addWatchPhoto` in the DAL computes `nextSort = coalesce(max(sortOrder), -1) + 1` — if two uploads race, both may compute the same `nextSort`. Sequential processing eliminates this.

[VERIFIED: src/components/wywt/PhotoUploader.tsx, src/components/watch/CatalogPhotoUploader.tsx; src/data/watches.ts addWatchPhoto implementation]

### Pattern 6: Reorder server action (mirrors reorderWishlist)

**What:** `bulkReorderPhotos` is already implemented in `src/data/watches.ts` (lines 618–667). Phase 61 only needs the server action wrapper in `src/app/actions/watchPhotos.ts`.

```typescript
// Source: mirrors src/app/actions/wishlist.ts reorderWishlist [VERIFIED: codebase]
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { bulkReorderPhotos, OwnerMismatchError, SetMismatchError } from '@/data/watches'
import type { ActionResult } from '@/lib/actionTypes'

const schema = z.object({
  watchId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1).max(10),  // cap = 10
}).strict()

export async function reorderWatchPhotos(data: unknown): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = schema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }

  try {
    await bulkReorderPhotos(user.id, parsed.data.watchId, parsed.data.orderedIds)
    // Invalidate the watch detail page so the new cover shows in grids/rails
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    if (err instanceof OwnerMismatchError) return { success: false, error: 'Some photos do not belong to you.' }
    if (err instanceof SetMismatchError) return { success: false, error: 'Photos changed in another tab. Refresh and try again.' }
    return { success: false, error: "Couldn't save new order." }
  }
}
```

**revalidatePath for `/w/[ref]`:** The unified watch detail route is `/w/[ref]`. Use `revalidatePath('/w/[ref]', 'page')` to match the route pattern, mirroring how `reorderWishlist` uses `revalidatePath('/u/[username]/[tab]', 'page')`. This invalidates the RSC render so the updated cover (lowest `sort_order` photo) shows in the carousel on next page load.

[VERIFIED: src/data/watches.ts lines 618–667 (bulkReorderPhotos); src/app/actions/wishlist.ts reorderWishlist pattern]

### Pattern 7: AddWatchFlow state machine surgery (D-15/D-16)

**The watchId timing problem:** Phase 61 requires a watchId before uploading photos. The current `AddWatchFlow` does not expose the created watchId to the state machine — `WatchForm.handleSubmit` calls `router.push(dest)` on success and the watchId is lost. This is the most architecturally complex part of the phase.

**Two paths to insert the photos step:**

**Path A (recommended): Intercept from `form-prefill` / `manual-entry` via a new WatchForm callback**

The WatchForm already handles `addWatch` internally. For Phase 61, we need it to return the watchId to the parent before navigation. The cleanest way is to add an optional `onWatchCreated?: (watchId: string) => void` callback to WatchForm. When this prop is present and a watch is created successfully, WatchForm calls `onWatchCreated(watch.id)` instead of `router.push(dest)` — the parent (AddWatchFlow) takes over navigation.

```typescript
// In flowTypes.ts — add new state:
| { kind: 'photos-pending'; watchId: string; destination: string }

// In AddWatchFlow.tsx:
// 1. Pass onWatchCreated to <WatchForm> in form-prefill and manual-entry branches
// 2. Handle onWatchCreated:
const handleWatchCreated = (watchId: string, dest: string) => {
  setState({ kind: 'photos-pending', watchId, destination: dest })
}

// Render branch for photos-pending:
{state.kind === 'photos-pending' && (
  <WatchPhotoStep
    watchId={state.watchId}
    onDone={() => router.push(state.destination)}
    onSkip={() => router.push(state.destination)}
  />
)}
```

**Path B (alternative): Wishlist path**

For the wishlist path (Wishlist commit via `handleWishlistConfirm`), `addWatch` is called in `AddWatchFlow` directly and the result is in scope. `addWatch` returns `ActionResult<Watch>` so `result.data.id` is the watchId. The same `handleWatchCreated` pattern applies.

**The "after verdict, before commit" placement (D-15):**

D-15 says the step comes "after the watch is identified (verdict shown) and before final commit." This means the photo step is AFTER the watch row exists in the DB, not before. The watch must be created first, then photos uploaded. This is the correct sequence: create watch → photos-pending step → upload photos → navigate. The photos step is between the watch creation and the final navigation.

**Skippable-with-friction (D-16):** "Skip for now" calls `router.push(destination)` directly, bypassing any remaining upload state. This is safe because the watch row already exists.

[VERIFIED: src/components/watch/WatchForm.tsx lines 246–267; src/components/watch/AddWatchFlow.tsx; src/components/watch/flowTypes.ts; src/app/actions/watches.ts addWatch return type]

### Pattern 8: Signed URL resolution in RSC

The DAL returns raw storage paths (e.g., `{userId}/{photoId}.jpg`). These are not public URLs. The watch detail RSC must sign them before passing to the client component.

**New DAL function needed:** `getWatchPhotosForWatch(watchId: string): Promise<{ id: string, storagePath: string, sortOrder: number }[]>`

**RSC signing pattern** (mirrors `src/app/wears/[username]/page.tsx` lines 131–137):

```typescript
// In /w/[ref]/page.tsx (RSC)
import { createSupabaseServerClient } from '@/lib/supabase/server'

const rawPhotos = await getWatchPhotosForWatch(watch.id)
const supabase = await createSupabaseServerClient()
const signedPhotos = await Promise.all(
  rawPhotos.map(async (p) => {
    const { data } = await supabase.storage
      .from('watch-photos')
      .createSignedUrl(p.storagePath, 3600)  // 1-hour TTL
    return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
  })
)
// Pass signedPhotos to WatchDetail → WatchPhotoSection
```

**The cover URL for `Watch.imageUrl`:** The existing `Watch.imageUrl` returned by the DAL is already the raw storagePath (Phase 60 decision: "Phase 61 signs URLs; keep DAL admin-client-free" per `src/data/watches.ts` comment line 148). For grid/rail thumbnails that already render `Watch.imageUrl`, the carrier pages (profile grid, home rail) will also need to sign it — but this is a Phase 61 concern only for the `/w/[ref]` detail page carousel. Grid/rail thumbnails remain broken for owner photos until that signing is wired (this may be an explicit open question for the plan).

[VERIFIED: src/data/watches.ts line 148 comment; src/app/wears/[username]/page.tsx pattern]

### Anti-Patterns to Avoid

- **Signing URLs in the DAL**: The DAL uses `server-only` and the service-role client (or Drizzle). Signing URLs there would mix storage concerns into the data layer. Sign in the RSC page, not the DAL.
- **Processing files in parallel for upload**: Race condition on `sort_order` computation in `addWatchPhoto`. Process sequentially.
- **Using `rectSortingStrategy` for horizontal filmstrip**: That's the 2D grid strategy. Use `horizontalListSortingStrategy` for a single-row horizontal strip.
- **Calling `api.reInit()` manually on every slide change**: Embla v8 watches the DOM automatically (`slideChanges: true` default). Manual `reInit` is only needed to change options (e.g., toggling `draggable`).
- **Resetting carousel index or edit toggle in `useEffect` on mount**: Router Cache stale-instance pattern — reset on interaction (`onPointerDown`), not mount.
- **`multiple` on a file input inside a form without resetting the input value**: After processing, reset `e.target.value = ''` so the user can re-select the same file. Both existing uploaders do this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Carousel swipe + snap | Custom touch handler | `embla-carousel-react` | iOS inertia, momentum, overscroll, snap points — dozens of edge cases |
| Drag-and-drop sortable | Custom pointer event tracking | `@dnd-kit/sortable` | Keyboard accessibility, DragOverlay, sensor abstraction, iOS Safari touch handling |
| HEIC conversion | Canvas-decode HEIC | `heic-worker.ts` (existing) | HEIC decoding requires WASM; browser Canvas API cannot decode HEIC natively |
| EXIF strip + resize | Raw canvas manipulation | `stripAndResize` in `src/lib/exif/strip.ts` | Already handles EXIF removal, JPEG re-encode, 1080px cap — tested in Phase 60 |
| Bulk sort_order rewrite | Sequential per-row UPDATE | `bulkReorderPhotos` (existing DAL) | CASE WHEN single round-trip; ownership re-check; set-completeness guard |
| Toast notifications | Custom toast component | `sonner` (existing) | Already wired; matches project pattern |

**Key insight:** All the hard infrastructure (HEIC→worker, stripAndResize, uploadWatchPhoto, addWatchPhoto, bulkReorderPhotos, deleteWatchPhoto) exists. Phase 61 is assembling these into a UI.

---

## Common Pitfalls

### Pitfall 1: Raw storagePath in `Watch.imageUrl` passed to `<Image>`

**What goes wrong:** `Watch.imageUrl` for owner photos is `{userId}/{photoId}.jpg` (a storage path), not an HTTPS URL. Passing it directly to `next/image` or `getSafeImageUrl` returns null (no https: protocol). The carousel renders blank slides.

**Why it happens:** Phase 60 decision: "Phase 61 signs URLs; keep DAL admin-client-free." The DAL intentionally returns the raw path.

**How to avoid:** Sign all photo URLs in the `/w/[ref]/page.tsx` RSC before passing them to the client. Use `createSupabaseServerClient().storage.from('watch-photos').createSignedUrl(path, 3600)`.

**Warning signs:** `getSafeImageUrl(watch.imageUrl)` returns null for owner watches; blank carousel slides.

### Pitfall 2: Embla `emblaApi` is null on first render

**What goes wrong:** Accessing `emblaApi?.selectedSnap()` in render (not in useEffect) throws or returns undefined. Arrow buttons show incorrect disabled state on first paint.

**Why it happens:** `emblaApi` is the second element of the `useEmblaCarousel` tuple and is `undefined` until the `emblaRef` is attached to the DOM.

**How to avoid:** Always access `emblaApi` inside `useEffect` or on user interaction (`emblaApi?.goToNext()`). Initialize button state in `useEffect` on `emblaApi`.

### Pitfall 3: dnd-kit activation threshold too low causes tap-to-delete conflict

**What goes wrong:** With delay: 150ms on MouseSensor, a quick click on the ×-badge could register as a drag start before the click fires. On mobile with TouchSensor delay: 250ms, a long-press on a thumbnail starts drag instead of tapping.

**Why it happens:** The activation delay exists precisely to distinguish click from drag, but the threshold must be calibrated.

**How to avoid:** Mirror the Phase 27 thresholds verbatim: MouseSensor `{ delay: 150, tolerance: 5 }`, TouchSensor `{ delay: 250, tolerance: 8 }`. Attach dnd-kit listeners to the drag-handle icon only (e.g., a GripVertical icon), not the entire thumbnail. This way, tapping the × badge never conflicts — the dnd-kit listeners are not on the × button.

**Warning signs:** Delete × badge click triggers a drag; long-press on thumbnail opens OS context menu instead of starting drag.

### Pitfall 4: Sequential uploads fail partially — cap state is stale

**What goes wrong:** User selects 3 files when 2 slots remain. Client correctly accepts 2, rejects 1. First upload succeeds. Second upload hits `PhotoCapExceededError` because another session added a photo between the two uploads (race).

**Why it happens:** The cap check is in the DAL at insert time. Sequential client-side processing cannot prevent a cross-session race.

**How to avoid:** Treat `PhotoCapExceededError` responses as a partial-success: show "2 of 3 photos uploaded. Cap reached." rather than surfacing an error toast for the whole batch. The DAL error is the backstop, not a bug.

### Pitfall 5: SetMismatchError on reorder after delete in another tab

**What goes wrong:** `reorderWatchPhotos` throws `SetMismatchError` because `orderedIds.length` no longer matches the DB count (another tab deleted a photo between the drag start and the reorder commit).

**Why it happens:** `bulkReorderPhotos` has the same set-completeness check as `bulkReorderWishlist` — the submitted IDs must exactly match the DB row count.

**How to avoid:** Mirror the `reorderWishlist` error handling: `SetMismatchError` → user-facing toast "Photos changed in another tab. Refresh and try again." Optimistic state auto-reverts when the transition ends without `revalidatePath`.

### Pitfall 6: AddWatchFlow state machine transition leaves photos-pending state on back-nav

**What goes wrong:** User creates a watch, lands on `photos-pending`, uploads 1 photo, then navigates back. The Activity preserved React state. On re-entry, the state is still `photos-pending` for the old watchId — uploading more photos succeeds but the UI has moved on.

**Why it happens:** Next 16 Activity wrapper preserves React state across back navigations. The existing `useLayoutEffect` cleanup in `AddWatchFlow` resets to `idle` on Activity-hide, but `photos-pending` is an intermediate state.

**How to avoid:** Add `{ kind: 'photos-pending' }` to the `useLayoutEffect` cleanup reset condition (alongside the existing non-idle conditions). When the user navigates away mid-photos-step, reset to `idle` so a return visit shows a fresh flow. The partially-uploaded photos persist on the watch and are visible when the owner revisits the detail page.

### Pitfall 7: Embla swipe fires while filmstrip is being dragged

**What goes wrong:** On mobile, initiating a drag on a filmstrip thumbnail (in Edit mode) also triggers embla's swipe handler. The carousel scrolls while the thumbnail is being dragged.

**Why it happens:** Both embla and dnd-kit listen on pointer events. Embla has a lower threshold (`dragThreshold: 10` default).

**How to avoid:** Toggle `draggable: false` on embla when Edit mode is ON (via `emblaApi?.reInit({ draggable: !editMode })`). This is the canonical embla approach to disabling swipe conditionally.

### Pitfall 8: `revalidatePath('/w/[ref]', 'page')` pattern for dynamic segments

**What goes wrong:** Calling `revalidatePath('/w/specific-uuid-here', 'page')` instead of the route template silently no-ops for all other watch pages.

**Why it happens:** `revalidatePath` in Next 16 uses soft tag matching. The second argument must be the route segment template, not a concrete URL.

**How to avoid:** Use `revalidatePath('/w/[ref]', 'page')` (the template). This invalidates all pages matching that route pattern. For photo mutations on one specific watch, this is intentionally broad — acceptable at v7.0 scale.

[VERIFIED: src/app/actions/wishlist.ts reorderWishlist comment "BR-02 fix — actual Next.js route is /u/[username]/[tab]"]

---

## Code Examples

### Verified patterns from official sources / codebase

#### getWatchPhotosForWatch (new DAL function)

```typescript
// To add in src/data/watches.ts
// Source: mirrors addWatchPhoto pattern [VERIFIED: codebase]
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
```

#### deleteWatchPhoto server action

```typescript
// Source: mirrors reorderWishlist pattern [VERIFIED: codebase]
// In src/app/actions/watchPhotos.ts
export async function deleteWatchPhotoAction(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
  const parsed = z.object({ watchId: z.string().uuid(), photoId: z.string().uuid() }).strict().safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }
  try {
    await deleteWatchPhoto(user.id, parsed.data.watchId, parsed.data.photoId)
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: "Couldn't delete photo." }
  }
}
```

#### SortablePhotoThumb (mirrors SortableProfileWatchCard)

```typescript
// Source: mirrors src/components/profile/SortableProfileWatchCard.tsx [VERIFIED: codebase]
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function SortablePhotoThumb({ id, photo, onDelete, isCover }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'manipulation',  // REQUIRED — iOS Safari gesture claim prevention
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className="relative w-16 h-16 rounded-md overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.signedUrl} alt="" className="object-cover w-full h-full" />
        {isCover && <span className="absolute top-0 left-0 text-xs bg-background/80 px-1">Cover</span>}
        <button onClick={onDelete} aria-label="Delete photo" className="absolute top-1 right-1 ...">×</button>
      </div>
    </div>
  )
}
```

#### Optimistic reorder (mirrors OwnerWishlistGrid)

```typescript
// Source: mirrors src/components/profile/WishlistTabContent.tsx OwnerWishlistGrid [VERIFIED: codebase]
const [optimisticIds, setOptimistic] = useOptimistic<string[], string[]>(
  initialIds,
  (_state, newOrder) => newOrder,
)
const [, startTransition] = useTransition()

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIdx = optimisticIds.indexOf(active.id as string)
  const newIdx = optimisticIds.indexOf(over.id as string)
  if (oldIdx < 0 || newIdx < 0) return
  const newOrder = arrayMove(optimisticIds, oldIdx, newIdx)
  startTransition(async () => {
    setOptimistic(newOrder)
    const result = await reorderWatchPhotos({ watchId, orderedIds: newOrder })
    if (!result.success) {
      toast.error("Couldn't save new order. Reverted.")
    }
    // On failure: no revalidatePath in action → optimistic state auto-reverts
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `rectSortingStrategy` for all sortable lists | `horizontalListSortingStrategy` for horizontal, `rectSortingStrategy` for grids | @dnd-kit/sortable v4+ | Correct strategy improves drop-target detection in horizontal strips |
| Manual `reInit` after slide DOM changes | Embla `slideChanges: true` auto-watches (MutationObserver) | Embla v7+ | No manual reInit needed when adding/removing slides |
| `emblaApi.scrollNext()` / `emblaApi.scrollPrev()` | `emblaApi.goToNext()` / `emblaApi.goToPrev()` | Embla v8 | API rename; `scrollNext/scrollPrev` still present but `goToNext/goToPrev` is canonical in v8 docs |

**Deprecated/outdated:**
- `scrollSnap` / `scrollNext` / `scrollPrev`: still work in v8 but the v8 docs consistently use `goToNext`/`goToPrev`. Either works.
- Single-sensor approach (one PointerSensor for both mouse and touch): dnd-kit v6 best practice is separate MouseSensor + TouchSensor so activation constraints can differ. Phase 27 already uses this pattern.

---

## Open Questions

1. **Grid/rail cover photo URLs unsigned**
   - What we know: `Watch.imageUrl` for owner photos is a raw storagePath. The `/w/[ref]` page RSC will sign URLs for the carousel. But profile grid cards, home rails, and other surfaces also render `Watch.imageUrl` via `getSafeImageUrl()`.
   - What's unclear: Phase 61 scope — does signing only the detail page carousel suffice for this phase? Rail/grid covers will silently blank out for owner photos (getSafeImageUrl returns null for raw storage paths).
   - Recommendation: Treat this as a Phase 61 open question. Either (a) sign cover URLs at each RSC that renders them, or (b) move to a public bucket for cover photos (simpler but security trade-off). Confirm scope with user before planning. The CONTEXT.md doesn't address this.

2. **WatchPhotoStep: reuse detail-page component or lean variant?**
   - What we know: Claude's Discretion (CONTEXT.md). "Planner picks based on component fit. Reuse the upload mechanics either way."
   - Recommendation: Build a leaner `WatchPhotoStep` that reuses the upload mechanics (`handleFiles`) but has a simpler layout (just the dropzone + per-file progress, no filmstrip/carousel). The full filmstrip is complex and the add-watch step is a "get it uploaded" moment, not a management surface.

3. **Signed URL TTL for the carousel**
   - What we know: Wear photos use 1-hour TTL (`createSignedUrl(..., 60 * 60)`). Watch detail page is cached by Next.js.
   - What's unclear: If Next.js caches the RSC render for longer than 1 hour, signed URLs expire before the page is invalidated.
   - Recommendation: Use `revalidate: false` (no ISR) on the `/w/[ref]` route (it's currently dynamic due to `getCurrentUser()`). Dynamic routes re-render on every request, so TTL = 1 hour is safe. Verify the route is not accidentally cached.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 61 is a UI-only phase with no new external tool dependencies. All libraries are already installed (embla-carousel-react 8.6.0, @dnd-kit packages, sonner, lucide-react). Supabase Storage (watch-photos bucket) is live from Phase 60 prod migration.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vitest.config.ts` (jsdom environment, `tests/setup.tsx`) |
| Quick run command | `npx vitest run tests/integration/phase61-watch-photos-ui.test.ts` |
| Full suite command | `npm run build` (exit 0 is the authoritative gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHOTO-02 | `addWatchPhotoAction` server action records photo, respects cap, rejects cross-user | unit/integration | `npx vitest run tests/actions/watchPhotos.test.ts` | ❌ Wave 0 |
| PHOTO-02 | Cap enforcement: batch of N files, remaining slots < N → accepts up to cap, shows rejection message | unit (component) | `npx vitest run tests/components/photo-uploader.test.tsx` | ❌ Wave 0 |
| PHOTO-03 | Carousel renders with `useEmblaCarousel`; arrows advance slides; position indicator updates | unit (component) | `npx vitest run tests/components/watch-photo-section.test.tsx` | ❌ Wave 0 |
| PHOTO-05 | `reorderWatchPhotosAction` server action: ownership check, set mismatch, happy path, revalidatePath | unit | `npx vitest run tests/actions/watchPhotos.test.ts` | ❌ Wave 0 |
| PHOTO-06 | `deleteWatchPhotoAction`: ownership check, photo-not-found, happy path | unit | `npx vitest run tests/actions/watchPhotos.test.ts` | ❌ Wave 0 |
| PHOTO-09 | `AddWatchFlow` transitions to `photos-pending` state after `addWatch` returns watchId | unit (component) | `npx vitest run tests/components/add-watch-flow-photos.test.tsx` | ❌ Wave 0 |
| PHOTO-03 | Swipe gesture on carousel — iOS Safari behavior | device behavior | `human_needed` | N/A |
| PHOTO-05 | Drag-reorder on filmstrip — touch drag on iOS | device behavior | `human_needed` | N/A |
| PHOTO-09 | "Skip for now" friction — mobile tap target size, visual prominence hierarchy | device behavior | `human_needed` | N/A |

### Sampling Rate

- **Per task commit:** `npm run build` (exit 0)
- **Per wave merge:** `npm run build && npx vitest run tests/actions/watchPhotos.test.ts tests/components/watch-photo-section.test.tsx`
- **Phase gate:** Full suite (build exit 0) before `/gsd-verify-work`. Device behavior items (`human_needed`) verified by user on prod per MEMORY `feedback_mobile_ui_verify_on_prod`.

### Wave 0 Gaps

- [ ] `tests/actions/watchPhotos.test.ts` — covers PHOTO-02/05/06 server action ownership + cap + error paths
- [ ] `tests/components/watch-photo-section.test.tsx` — covers PHOTO-03 carousel arrow/index behavior
- [ ] `tests/components/photo-uploader.test.tsx` — covers PHOTO-02 cap enforcement + batch rejection message
- [ ] `tests/components/add-watch-flow-photos.test.tsx` — covers PHOTO-09 state machine transition + skip path

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` in all server actions |
| V4 Access Control | yes | `watches.user_id = userId` guard in DAL for all photo mutations; `viewerCanEdit` UI gate |
| V5 Input Validation | yes | Zod `.strict()` schema on all server actions; UUID validation on watchId/photoId |
| V6 Cryptography | no | Supabase handles storage encryption |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user photo delete (another user's photoId) | Tampering | DAL `deleteWatchPhoto` joins `watches` on `user_id = userId` before deleting — watch ownership is the gate, not photo ownership directly |
| Cross-user reorder (another user's watchId) | Tampering | `bulkReorderPhotos` begins with ownership check: `watches.id = watchId AND watches.user_id = userId` |
| Client-supplied `sort_order` manipulation | Tampering | `addWatchPhoto` computes `nextSort` server-side; client never passes sort_order |
| DoS via mass photo upload (>10 per watch) | DoS | `addWatchPhoto` DAL cap check (MAX_PHOTOS_PER_WATCH = 10) with `PhotoCapExceededError` |
| SSRF via drop-zone URL spoofing | Spoofing | Drop zone accepts File objects only (HTML5 DnD API), not URLs; no fetch of arbitrary URLs |
| Storage path traversal | Tampering | `buildWatchPhotoPath` validates photoId against UUID_RE before constructing path; `../` fails UUID test |
| Mass assignment (extra fields in server action payload) | Tampering | Zod `.strict()` rejects any payload key not in schema; userId always from session |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `horizontalListSortingStrategy` is the correct dnd-kit strategy for a horizontal filmstrip | §Pattern 3 | Using `rectSortingStrategy` would produce wrong drop-target hit areas in a single-row strip; visual drag indicators misaligned |
| A2 | Signed URLs from Supabase storage persist long enough for carousel use (1-hour TTL, dynamic RSC = no ISR) | §Pattern 8 + Open Q 3 | If route is accidentally ISR-cached, URLs expire before page invalidates; blank carousel slides for returning users |
| A3 | `emblaApi.goToNext()` is the canonical v8 API (vs `scrollNext()` in older versions) | §Standard Stack | Both work in v8; risk is low — calling either succeeds |
| A4 | `WatchForm` adding `onWatchCreated` callback is backwards-compatible (optional prop) | §Pattern 7 | If WatchForm has strict prop types preventing optional callbacks, a different intercept mechanism is needed |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/davidjerleke/embla-carousel` — `useEmblaCarousel`, `scrollTo`, `reInit`, `on('select')`, `on('reinit')`, `selectedSnap()`, `goToNext/goToPrev`, `canGoToNext/canGoToPrev`, `draggable` option, `slideChanges` option
- `src/data/watches.ts` (codebase) — `bulkReorderPhotos` (lines 618–667), `addWatchPhoto` (lines 567–605), `deleteWatchPhoto` (lines 676–698), `getWatchesByUser` cover subquery (lines 148–168), `OwnerMismatchError`, `SetMismatchError`, `PhotoCapExceededError`, `MAX_PHOTOS_PER_WATCH`
- `src/components/profile/WishlistTabContent.tsx` + `SortableProfileWatchCard.tsx` (codebase) — Phase 27 dnd-kit reorder precedent, sensor configuration, `touchAction: 'manipulation'`, optimistic update pattern
- `src/app/actions/wishlist.ts` (codebase) — `reorderWishlist` server action pattern, `revalidatePath('/u/[username]/[tab]', 'page')`
- `src/components/watch/AddWatchFlow.tsx` + `flowTypes.ts` (codebase) — state machine structure, `WatchForm` result handling, Activity cleanup pattern
- `src/lib/storage/watchPhotos.ts` (codebase) — `uploadWatchPhoto`, `buildWatchPhotoPath`, UUID validation
- `src/components/wywt/PhotoUploader.tsx` + `CatalogPhotoUploader.tsx` (codebase) — single-file upload pattern, HEIC detection, `convertHeic`, `stripAndResize` wiring
- `node_modules/next/dist/docs/01-app/02-guides/how-revalidation-works.md` — `revalidatePath` soft tag mechanics, route template vs concrete URL

### Secondary (MEDIUM confidence)
- Context7 `/clauderic/dnd-kit` — `horizontalListSortingStrategy` confirmation, sensor activation constraint patterns
- `src/app/wears/[username]/page.tsx` (codebase) — `createSignedUrl` pattern for storage photos in RSC (lines 131–137)
- npm registry — embla-carousel-react 8.6.0, @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0 version confirmation

### Tertiary (LOW confidence)
- None flagged in this research.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and npm registry
- Architecture: HIGH — all key patterns verified from codebase + Context7 docs
- Pitfalls: HIGH — all pitfalls derived from verified code inspection + existing codebase comments
- embla API: HIGH — verified via Context7 /davidjerleke/embla-carousel at v8.6.0

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (embla/dnd-kit are stable; Next.js 16 pinned in project)

# Phase 43: Polish Pass - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 9 (new/modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/search/FilterDrawer.tsx` | component | request-response | `src/components/search/FilterSheet.tsx` | exact |
| `src/components/profile/ProfileWatchCard.tsx` | component | request-response | self (modify in place) | exact |
| `src/components/profile/CollectionTabContent.tsx` | component | request-response | self (modify in place) | exact |
| `src/components/profile/WishlistTabContent.tsx` | component | event-driven (DnD) | self (modify in place) | exact |
| `src/components/profile/AvatarUploader.tsx` | component | file-I/O | `src/components/watch/CatalogPhotoUploader.tsx` | exact |
| `src/components/profile/ProfileEditForm.tsx` | component | request-response | self (modify in place) | exact |
| `src/lib/storage/avatarPhotos.ts` | utility | file-I/O | `src/lib/storage/catalogSourcePhotos.ts` | exact |
| `supabase/migrations/20260516000000_phase43_avatar_bucket.sql` | migration | — | `supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql` | exact |
| `src/lib/extractors/llm.ts` | utility | request-response | self (one-line patch) | exact |

---

## Pattern Assignments

### `src/components/search/FilterDrawer.tsx` (component, request-response)

**Analog:** `src/components/search/FilterSheet.tsx` (drop-in replacement)

**Imports pattern** (lines 1-13 of analog):
```typescript
'use client'

import { Drawer } from '@base-ui/react/drawer'
import { Button } from '@/components/ui/button'
import { MovementChips } from '@/components/search/MovementChips'
import { CaseSizeChips } from '@/components/search/CaseSizeChips'
import { StyleChips } from '@/components/search/StyleChips'
```
The `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` imports are replaced wholesale by `{ Drawer } from '@base-ui/react/drawer'`. All chip imports remain unchanged.

**Props interface — copy verbatim from analog** (lines 15-25 of `FilterSheet.tsx`):
```typescript
interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: string | null
  size: string | null
  styleArr: string[]
  onMovementChange: (v: string | null) => void
  onSizeChange: (v: string | null) => void
  onStyleChange: (v: string[]) => void
  styleVocab: string[]
}
```
Same shape as `WatchFacetSheetProps` — the component is a drop-in at the call site.

**Core Drawer pattern** (replaces lines 44-76 of analog):
```tsx
<Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
  <Drawer.Portal>
    <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/10" />
    <Drawer.Viewport className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
      <Drawer.Popup className="max-h-[80vh] overflow-y-auto bg-popover rounded-t-xl border-t border-border pb-[env(safe-area-inset-bottom)] pointer-events-auto">
        {/* Drag handle — h-2 (8px), not h-1.5; per UI-SPEC spacing § */}
        <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-muted-foreground/30 shrink-0" />
        <Drawer.Content className="flex flex-col gap-6 px-4 pb-2 pt-2">
          <Drawer.Title className="font-heading text-base font-semibold text-foreground">Filters</Drawer.Title>
          <MovementChips selected={movement} onSelect={onMovementChange} />
          <CaseSizeChips selected={size} onSelect={onSizeChange} />
          <StyleChips selected={styleArr} onSelect={onStyleChange} vocab={styleVocab} />
        </Drawer.Content>
        <div className="mt-auto flex flex-col gap-2 p-4 border-t border-border pt-3">
          <Drawer.Close
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive w-full"
                onClick={handleClearAll}
              />
            }
          >
            Clear all
          </Drawer.Close>
        </div>
      </Drawer.Popup>
    </Drawer.Viewport>
  </Drawer.Portal>
</Drawer.Root>
```

**`handleClearAll` pattern — copy from analog** (lines 38-42 of `FilterSheet.tsx`):
```typescript
function handleClearAll() {
  onMovementChange(null)
  onSizeChange(null)
  onStyleChange([])
}
```

**Transition pattern — from `src/components/ui/sheet.tsx`** (lines 56-57):
```
Only use data-starting-style / data-ending-style on Drawer.Popup for enter/exit
animation. Do NOT add a blanket `transition` class — it conflicts with
--drawer-swipe-movement-y CSS variable animation during swipe.
```
Reference: `sheet.tsx` line 56 — `data-ending-style:translate-y-[2.5rem] data-starting-style:translate-y-[2.5rem]` (bottom side pattern).

**PLSH-01 critical rule:** `onOpenChange` is passed directly from caller — no async guard, no `if (!loading)` wrapper. The analog (`FilterSheet.tsx` line 45) also passes `onOpenChange` directly to `<Sheet open={open} onOpenChange={onOpenChange}>`.

---

### `src/components/profile/ProfileWatchCard.tsx` (component, request-response)

**Analog:** self (existing file, restructured in place)

**Imports — unchanged** (lines 1-11):
```typescript
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'
import { daysSince, SLEEPING_BEAUTY_DAYS } from '@/lib/wear'
import type { Watch } from '@/lib/types'
```

**Props interface — unchanged** (lines 13-17):
```typescript
interface ProfileWatchCardProps {
  watch: Watch
  lastWornDate: string | null // YYYY-MM-DD or null
  showWishlistMeta?: boolean
}
```

**`isWishlistLike` gate — already present** (line 48):
```typescript
const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
```
This variable is already computed. Use it as the exclusive gate for ALL wear UI.

**Current layout to replace** (lines 58-114) — new target structure:
```tsx
return (
  <Link href={`/watch/${watch.id}`}>
    {/* h-full flex flex-col on Card — NOT height:auto — is the equal-height key */}
    <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col">
      {/* Brand + model ABOVE image (D-04) */}
      <div className="px-3 pt-3 pb-1">
        <p className="text-sm font-normal text-muted-foreground truncate">{watch.brand}</p>
        <p className="text-base font-semibold leading-tight truncate">{watch.model}</p>
      </div>
      {/* Image area — aspect-[3/4] on THIS div, not on Card (PLSH-04 pitfall) */}
      <div className="relative aspect-[3/4] bg-muted">
        {safeUrl ? (
          <Image
            src={safeUrl}
            alt={`${watch.brand} ${watch.model}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"   {/* object-cover MUST be present */}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <WatchIcon className="size-10 text-muted-foreground/40" />
          </div>
        )}
        {/* Wear badge — OWNED watches only (D-12, PLSH-03) */}
        {!isWishlistLike && (isWornToday || isStale) && (
          <span
            className={cn(
              'absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-normal',
              isWornToday
                ? 'bg-accent text-accent-foreground'
                : 'bg-background text-foreground shadow ring-1 ring-border',
            )}
          >
            {isWornToday ? 'Worn today' : 'Not worn recently'}
          </span>
        )}
      </div>
      {/* Fixed text block — flex-1 absorbs height; content top-aligned */}
      <CardContent className="p-3 flex flex-col gap-1 flex-1">
        {tag && (
          <Badge variant="secondary" className="rounded-full text-xs font-normal self-start">
            {tag}
          </Badge>
        )}
        {/* Wear line — OWNED watches only (D-12, PLSH-03) */}
        {!isWishlistLike && (
          <p className="text-xs text-muted-foreground">{lastWornLabel}</p>
        )}
        {priceLine && (
          <p className="text-xs font-normal text-foreground">{priceLine}</p>
        )}
        {showWishlistMeta && watch.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground">Notes: {watch.notes}</p>
        )}
      </CardContent>
    </Card>
  </Link>
)
```

**Derived values — keep exactly** (lines 24-56): `safeUrl`, `days`, `isWornToday`, `isStale`, `lastWornLabel`, `tag`, `isWishlistLike`, `primary`, `primaryLabel`, `priceLine` — all existing derivations stay unchanged.

---

### `src/components/profile/CollectionTabContent.tsx` (component, request-response)

**Analog:** self (modify populated-state block only)

**Populated-state filter row — current** (lines 152-169):
```tsx
<div className="mb-4 flex items-center gap-2">
  <FilterChips options={chipOptions} active={activeChip} onChange={setActiveChip} />
  <div className="relative ml-auto w-48 shrink-0">
    <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input ... />
  </div>
</div>
<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {filtered.map(...)}
  {isOwner && <AddWatchCard returnTo={pathname || null} />}   {/* REMOVE this line */}
</div>
```

**Target — add button after search input; remove `AddWatchCard` from grid** (D-06, D-07):
```tsx
<div className="mb-4 flex items-center gap-2">
  <FilterChips options={chipOptions} active={activeChip} onChange={setActiveChip} />
  <div className="relative ml-auto w-48 shrink-0">
    {/* search input — unchanged */}
  </div>
  {isOwner && (
    <Button asChild variant="default" size="sm" className="shrink-0 min-h-[44px]">
      <Link href={returnTo ? `/watch/new?returnTo=${returnTo}` : '/watch/new'}>
        Add to Collection
      </Link>
    </Button>
  )}
</div>
<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {filtered.map((watch) => (
    <ProfileWatchCard key={watch.id} watch={watch} lastWornDate={wearDates[watch.id] ?? null} />
  ))}
  {/* AddWatchCard removed from grid end — it stays in empty-state branches only (D-08) */}
</div>
```

**New imports needed** (add to existing import block):
```typescript
import Link from 'next/link'  // already imported via pathname usage — verify
// Button already imported; Link is not currently imported — add it
```
Check: `CollectionTabContent.tsx` currently imports `Link` on line 5. Also needs `Button` — currently imported on line 9. No new imports required.

**Empty-state branches — DO NOT TOUCH** (lines 81-148). `AddWatchCard` imports stay; the component is still used in the empty state.

---

### `src/components/profile/WishlistTabContent.tsx` (component, event-driven)

**Analog:** self (`OwnerWishlistGrid` sub-component, modify populated owner branch)

**`OwnerWishlistGrid` return — current** (lines 198-262): `DndContext` wrapping `SortableContext` wrapping grid. `AddWatchCard variant="wishlist"` is the last child inside the grid div (line 247).

**Target changes:**

1. Add a header row above `DndContext` in `OwnerWishlistGrid` (or in `WishlistTabContent` before the `return <OwnerWishlistGrid ...>` on line 108):
```tsx
{/* Add-wishlist button row — PLSH-05, D-07 */}
{isOwner && (
  <div className="mb-4 flex justify-end">
    <Button asChild variant="default" size="sm" className="shrink-0 min-h-[44px]">
      <Link href={returnTo ? `/watch/new?status=wishlist&returnTo=${encodeURIComponent(returnTo)}` : '/watch/new?status=wishlist'}>
        Add to Wishlist
      </Link>
    </Button>
  </div>
)}
```
`returnTo` and `wishlistHref` are already derived on lines 51-54 of `WishlistTabContent`. Prefer placing the button in `WishlistTabContent` before the `<OwnerWishlistGrid>` return so `isOwner` is in scope without threading a new prop.

2. Remove `<AddWatchCard variant="wishlist" returnTo={returnTo} />` from inside `OwnerWishlistGrid` (line 247). The `SortableContext` block becomes:
```tsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {optimisticIds.map((id) => (
    <SortableProfileWatchCard key={id} id={id} watch={watchesById[id]} lastWornDate={wearDates[id] ?? null} showWishlistMeta />
  ))}
  {/* AddWatchCard removed — button above the grid owns the CTA (D-06) */}
</div>
```

3. Non-owner populated branch (lines 90-103) — no change; grid-only, no button.

4. `AddWatchCard` import stays — used by the owner empty-state (line 66).

**`Link` import** — already present on line 5. `Button` already present on line 25.

---

### `src/components/profile/AvatarUploader.tsx` (component, file-I/O)

**Analog:** `src/components/watch/CatalogPhotoUploader.tsx`

**Imports pattern** (from analog lines 22-25, adapted):
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { uploadAvatarPhoto } from '@/lib/storage/avatarPhotos'
import { updateProfile } from '@/app/actions/profile'
import { toast } from 'sonner'
```

**Constants — adapted from analog** (analog lines 56):
```typescript
const MAX_FILE_BYTES = 8 * 1024 * 1024  // same as CatalogPhotoUploader
```

**`isHeicFile` — copy verbatim from analog** (lines 58-64):
```typescript
function isHeicFile(file: File): boolean {
  const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
  const ext = file.name.toLowerCase()
  return mimeOk || ext.endsWith('.heic') || ext.endsWith('.heif')
}
```

**`convertHeic` — copy verbatim from analog** (lines 66-84).

**State machine — new, differs from analog** (analog has `previewUrl`/`busy`; avatar adds crop states):
```typescript
const [imageSrc, setImageSrc] = useState<string | null>(null)    // object URL for crop
const [crop, setCrop] = useState({ x: 0, y: 0 })
const [zoom, setZoom] = useState(1)
const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
const [uploading, setUploading] = useState(false)
const [errorMsg, setErrorMsg] = useState<string | null>(null)
const inputRef = useRef<HTMLInputElement | null>(null)
```

**Object URL revoke pattern — copy from analog** (lines 117-122):
```typescript
useEffect(() => {
  return () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
  }
}, [imageSrc])
```

**`handleChange` — adapted from analog** (analog lines 130-165):
```typescript
async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  e.target.value = ''    // allow re-selecting same file — same as analog line 132
  if (!file) return
  setErrorMsg(null)

  if (file.size > MAX_FILE_BYTES) {
    setErrorMsg('Photo too large. Maximum size is 8 MB.')
    return
  }

  try {
    let blob: Blob = file
    if (isHeicFile(file)) {
      try { blob = await convertHeic(file) }
      catch { setErrorMsg('Could not convert HEIC photo. Please try another image.'); return }
    }
    // Show crop UI — do NOT stripAndResize yet (crop comes first per D-11 pipeline)
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    setImageSrc(URL.createObjectURL(blob))
  } catch {
    setErrorMsg('Could not process photo. Please try another image.')
  }
}
```

**`getCroppedBlob` helper** (from RESEARCH.md Pattern 4):
```typescript
async function getCroppedBlob(src: string, cropArea: Area): Promise<Blob> {
  const image = new window.Image()
  image.src = src
  await new Promise((r) => { image.onload = r })
  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height)
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => b ? res(b) : rej(new Error('toBlob returned null')), 'image/jpeg', 0.9)
  )
}
```

**`handleConfirmCrop`** — called on "Confirm crop" button click:
```typescript
async function handleConfirmCrop() {
  if (!imageSrc || !croppedAreaPixels) return
  setUploading(true)
  try {
    const raw = await getCroppedBlob(imageSrc, croppedAreaPixels)
    // stripAndResize lazy-imported exactly as in analog (line 154)
    const { stripAndResize } = await import('@/lib/exif/strip')
    const { blob: jpeg } = await stripAndResize(raw, 512)
    const result = await uploadAvatarPhoto(userId, jpeg)
    if ('error' in result) { setErrorMsg('Upload failed. Please try again.'); return }
    await updateProfile({ avatarUrl: result.publicUrl })
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    setImageSrc(null)
    toast.success('Profile photo updated')
    onUploadComplete?.(result.publicUrl)
  } catch {
    setErrorMsg('Upload failed. Please try again.')
  } finally {
    setUploading(false)
  }
}
```

**Crop UI render** (react-easy-crop with circular mask):
```tsx
{imageSrc && (
  <div>
    <div className="relative h-[300px] bg-black">
      <Cropper
        image={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={1}
        cropShape="round"
        showGrid={false}
        onCropChange={setCrop}
        onZoomChange={setZoom}
        onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
      />
    </div>
    <div className="flex gap-2 pt-3">
      <Button type="button" variant="outline" onClick={() => { URL.revokeObjectURL(imageSrc!); setImageSrc(null) }} disabled={uploading}>
        Discard crop
      </Button>
      <Button type="button" variant="default" onClick={handleConfirmCrop} disabled={uploading || !croppedAreaPixels}>
        {uploading ? <><Loader2 className="animate-spin" /> Uploading…</> : 'Confirm crop'}
      </Button>
    </div>
  </div>
)}
```

**Props interface:**
```typescript
interface AvatarUploaderProps {
  userId: string
  initialUrl?: string | null
  onUploadComplete?: (url: string) => void
}
```

**Error display — copy from `ProfileEditForm.tsx`** (line 89):
```tsx
{errorMsg && (
  <p className="text-sm text-destructive">{errorMsg}</p>
)}
```

---

### `src/components/profile/ProfileEditForm.tsx` (component, request-response)

**Analog:** self (modify avatarUrl field block only)

**Existing `avatarUrl` field to remove** (lines 62-72):
```tsx
<div className="flex flex-col gap-1">
  <Label htmlFor="profile-avatar-url">Avatar URL</Label>
  <Input
    id="profile-avatar-url"
    type="url"
    value={avatarUrl}
    onChange={(e) => setAvatarUrl(e.target.value)}
    maxLength={500}
    placeholder="https://..."
  />
</div>
```

**Replacement — insert `AvatarUploader` in place of the removed block:**
```tsx
import { AvatarUploader } from '@/components/profile/AvatarUploader'

// In JSX, replace the block above with:
<AvatarUploader
  userId={userId}                   // thread userId from parent via props
  initialUrl={initial.avatarUrl}
  onUploadComplete={() => {}}       // avatar saves itself; parent form covers displayName+bio
/>
```

**State to remove:** The `avatarUrl` useState (line 22) and the `trimmedAvatar`/`avatarUrl` references in `handleSave` (lines 35-38) are dropped. The `handleSave` call simplifies to pass only `displayName` and `bio`.

**`useFormFeedback`, `pending`, `message`, `run` pattern — unchanged** (lines 29-47). Copy preserved verbatim.

**Field layout pattern — copy from existing form fields** (lines 52-60):
```tsx
<div className="flex flex-col gap-1">
  <Label>...</Label>
  {/* component */}
</div>
```

**ProfileEditFormProps** — add `userId: string` to the interface (currently only `initial` and `onDone`):
```typescript
interface ProfileEditFormProps {
  initial: {
    displayName: string | null
    avatarUrl: string | null
    bio: string | null
  }
  onDone: () => void
  userId: string   // new — needed by AvatarUploader
}
```

---

### `src/lib/storage/avatarPhotos.ts` (utility, file-I/O)

**Analog:** `src/lib/storage/catalogSourcePhotos.ts` — copy the browser-side section only (lines 1-100); the server-side signed URL section (lines 106-142) is NOT needed (avatars bucket is public).

**File header comment — adapt from analog** (lines 1-17):
```typescript
// src/lib/storage/avatarPhotos.ts
//
// Phase 43 PLSH-06: helpers for the avatars Supabase Storage bucket.
//
// Browser-safe only: path builder + uploader (used inside AvatarUploader component).
// The avatars bucket is public — no signed URL helper needed.
// RLS folder enforcement (phase43 migration) ensures a user can only write
// into {userId}/avatar.jpg paths.
```

**Import — identical to analog** (line 19):
```typescript
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
```

**Bucket constant — differs from analog**:
```typescript
const BUCKET_ID = 'avatars' as const
```

**Path convention — simpler than analog** (no three-tier path; one file per user):
```typescript
// Path: {userId}/avatar.jpg (upsert:true — replaces in place)
export function buildAvatarPath(userId: string): string {
  if (!userId) throw new TypeError('userId required')
  return `${userId}/avatar.jpg`
}
```

**Upload function — adapted from analog** (lines 78-100):
```typescript
export type AvatarUploadResult = { publicUrl: string } | { error: string }

export async function uploadAvatarPhoto(
  userId: string,
  jpeg: Blob,
): Promise<AvatarUploadResult> {
  let path: string
  try {
    path = buildAvatarPath(userId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid path inputs' }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage.from(BUCKET_ID).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: true,     // avatars replace in place (analog uses upsert: false)
  })
  if (error) return { error: error.message }

  // Public bucket — construct public URL directly (no signed URL needed)
  const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}
```

---

### `supabase/migrations/20260516000000_phase43_avatar_bucket.sql` (migration)

**Analog:** `supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql`

**Structure to copy verbatim** — same `BEGIN`/`COMMIT`, same `ON CONFLICT DO NOTHING`, same `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern per operation.

**Bucket row — differs from analog** (analog line 23-31):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,           -- public (avatars shown to all visitors; analog is false)
  4194304,        -- 4 MB (analog is 8 MB; avatars are small)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
```

**SELECT policy — OMIT** (analog has one on lines 39-43). Public buckets allow unauthenticated reads via the public URL path without a policy.

**INSERT policy — copy and adapt analog** (lines 50-57):
```sql
DROP POLICY IF EXISTS avatars_insert_own_folder ON storage.objects;
CREATE POLICY avatars_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
```

**UPDATE policy — copy and adapt analog** (lines 61-67):
```sql
DROP POLICY IF EXISTS avatars_update_own_folder ON storage.objects;
CREATE POLICY avatars_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
```

**DELETE policy — copy and adapt analog** (lines 70-77):
```sql
DROP POLICY IF EXISTS avatars_delete_own_folder ON storage.objects;
CREATE POLICY avatars_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
```

**Sanity assertion — adapt from analog** (lines 84-102): check `bucket_count = 1` and `policy_count = 3` (3 policies, not 4 — no SELECT policy for public bucket).

---

### `src/lib/extractors/llm.ts` (utility, one-line patch)

**Analog:** `src/lib/taste/enricher.ts` (already uses the target model ID)

**Change location** (line 78):
```typescript
// BEFORE:
model: 'claude-sonnet-4-20250514',

// AFTER:
model: 'claude-sonnet-4-6',
```
No other changes. All other lines (1-77, 79-end) are untouched.

---

## Shared Patterns

### `'use client'` Directive
**Source:** All modified components (`FilterSheet.tsx` line 1, `ProfileWatchCard.tsx` line 1, `CollectionTabContent.tsx` line 1, `WishlistTabContent.tsx` line 1, `ProfileEditForm.tsx` line 1)
**Apply to:** `FilterDrawer.tsx`, `AvatarUploader.tsx`
```typescript
'use client'
```
All new components in `src/components/` that use hooks or browser APIs require this directive as the first line.

### Absolute Imports via `@/*`
**Source:** Every existing file
**Apply to:** All new/modified files
```typescript
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
// Never: import { Button } from '../../components/ui/button'
```

### Object URL Lifecycle
**Source:** `CatalogPhotoUploader.tsx` lines 117-122
**Apply to:** `AvatarUploader.tsx`
```typescript
useEffect(() => {
  return () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
  }
}, [imageSrc])
```
Also revoke proactively before overwriting `imageSrc` state (analog line 158: `if (previewUrl) URL.revokeObjectURL(previewUrl)`).

### Lazy `stripAndResize` Import
**Source:** `CatalogPhotoUploader.tsx` line 154
**Apply to:** `AvatarUploader.tsx` confirm-crop handler
```typescript
const { stripAndResize } = await import('@/lib/exif/strip')
const result = await stripAndResize(blob, 512)
```
The dynamic import keeps the canvas worker out of the initial bundle. Pass `512` as `maxDim` for avatar output resolution.

### Inline Error Display
**Source:** `CatalogPhotoUploader.tsx` line 249, `ProfileEditForm.tsx` line 89
**Apply to:** `AvatarUploader.tsx`
```typescript
{errorMsg && (
  <p className="text-sm text-destructive">{errorMsg}</p>
)}
```

### `createSupabaseBrowserClient` for Storage Uploads
**Source:** `catalogSourcePhotos.ts` line 91
**Apply to:** `avatarPhotos.ts`
```typescript
const supabase = createSupabaseBrowserClient()
const { error } = await supabase.storage.from(BUCKET_ID).upload(path, jpeg, {
  contentType: 'image/jpeg',
  upsert: true,
})
```

### Storage RLS Folder Enforcement
**Source:** `supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql` lines 52-57
**Apply to:** `supabase/migrations/20260516000000_phase43_avatar_bucket.sql`
```sql
AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
```
Exact predicate — copy verbatim, change only `bucket_id` value.

### Sonner Toast for Async Actions
**Source:** `WishlistTabContent.tsx` line 193 (`toast.error`), `ProfileEditForm.tsx` pattern
**Apply to:** `AvatarUploader.tsx`
```typescript
import { toast } from 'sonner'
// success:
toast.success('Profile photo updated')
```

---

## No Analog Found

All files in scope have strong analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/storage/`, `supabase/migrations/`, `src/lib/extractors/`
**Files scanned:** 11 source files read directly
**Pattern extraction date:** 2026-05-16

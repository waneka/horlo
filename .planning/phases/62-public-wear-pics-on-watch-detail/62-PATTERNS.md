# Phase 62: Public Wear Pics on Watch Detail - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/data/wearEvents.ts` (add `getPublicWearPicsForWatch`) | service / DAL | CRUD read | `getWatchPhotosForWatch` in `src/data/watches.ts:709-722` | exact |
| `src/db/schema.ts` (add `hiddenFromDetail` column) | model / schema | — | `watchPhotos` table addition (lines 338-350); migration at `supabase/migrations/20260525000000_phase60_watch_photos.sql` | exact |
| `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql` | migration | — | `supabase/migrations/20260525000000_phase60_watch_photos.sql` (shape, `IF NOT EXISTS`, dual-discipline pattern) | exact |
| `src/app/actions/wearEvents.ts` (add `hideWearPicAction`, `unhideWearPicAction`) | server action | request-response | `src/app/actions/watchPhotos.ts:154-177` (`deleteWatchPhotoAction`) | exact |
| `src/app/w/[ref]/page.tsx` (add wear-pic fetch + signing + slide assembly) | page RSC | request-response | lines 158-169 (admin-client signing loop) + lines 158-169 already in same file | self-analog |
| `src/components/watch/WatchPhotoSection.tsx` (add `SignedWearPic`, badge, social row, eye/hide Edit mode) | component | event-driven | `SortablePhotoThumb.tsx` (badge + delete button overlay) + existing `WatchPhotoSection` edit-mode toggle | exact |
| `src/app/u/[username]/[tab]/page.tsx` (add wear-photo signing in worn tab) | page RSC | request-response | `signCoverUrls` loop at lines 429-441; inline signing at `src/app/w/[ref]/page.tsx:160-169` | role-match |
| `src/components/profile/WornTimeline.tsx` + `WornCalendar.tsx` (prefer `event.photoUrl`) | component | transform | existing `getSafeImageUrl(watch.imageUrl)` usage at `WornTimeline.tsx:65` | exact |

---

## Pattern Assignments

---

### `src/data/wearEvents.ts` — add `getPublicWearPicsForWatch`

**Analog:** `getWatchPhotosForWatch` in `src/data/watches.ts` (lines 709-722)

**Imports pattern** (`src/data/watches.ts` lines 1-6):
```typescript
import 'server-only'

import { db } from '@/db'
import { watches, profileSettings, watchesCatalog, watchPhotos } from '@/db/schema'
import { eq, and, or, asc, desc, inArray, sql, type SQL } from 'drizzle-orm'
import type { Watch, EraSignal } from '@/lib/types'
```
Add `wearEvents` to the existing import of schema; add `desc` to existing drizzle-orm imports (already present).

**Core DAL pattern** — `getWatchPhotosForWatch` (`src/data/watches.ts` lines 709-722):
```typescript
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

**New function — copy and adapt:**
- Same file preamble (`import 'server-only'`, same db/schema/drizzle-orm imports already present in the file)
- Same return-value pattern: a typed inline object array, no domain mapping needed
- WHERE clause: `eq(wearEvents.watchId, watchId)` + `eq(wearEvents.visibility, 'public')` + `eq(wearEvents.hiddenFromDetail, false)` — **do NOT reuse or call `getWearRailForViewer`** (D-17; that function has extra joins and a 48h gate)
- `orderBy(desc(wearEvents.wornDate))` (newest-worn first, per D-02)
- Return shape: `{ id: string; wornDate: string; photoUrl: string | null; hiddenFromDetail: boolean }[]`

**Reference for visibility predicate — getWearRailForViewer (DO NOT TOUCH), lines 371-388 of `src/data/wearEvents.ts`:**
```typescript
// The detail union reuses ONLY the visibility='public' branch (no follows, no 48h gate):
.where(
  and(
    eq(wearEvents.watchId, watchId),
    eq(wearEvents.visibility, 'public'),
    eq(wearEvents.hiddenFromDetail, false),
  ),
)
```

---

### `src/db/schema.ts` — add `hiddenFromDetail` column to `wearEvents`

**Analog:** `watchPhotos` table definition at lines 338-350; `wearVisibilityEnum` column at line 304.

**Existing `wearEvents` table shape** (lines 294-311):
```typescript
export const wearEvents = pgTable(
  'wear_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId: uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    wornDate: text('worn_date').notNull(),
    note: text('note'),
    photoUrl: text('photo_url'),
    visibility: wearVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wear_events_watch_worn_at_idx').on(table.watchId, table.wornDate),
    unique('wear_events_unique_day').on(table.userId, table.watchId, table.wornDate),
  ]
)
```

**Column to add** — insert after `visibility` line, before `createdAt`:
```typescript
hiddenFromDetail: boolean('hidden_from_detail').notNull().default(false),
```

Pattern match: `watchPhotos` uses the same `boolean(...).notNull().default(...)` Drizzle column builder at line 346 (`sortOrder: integer('sort_order').notNull().default(0)` — same notNull+default pattern).

---

### `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql` (NEW)

**Analog:** `supabase/migrations/20260525000000_phase60_watch_photos.sql` (structure, header, IF NOT EXISTS, partial index pattern)

**Migration structure to copy** (from lines 1-34 of Phase 60 migration):
```sql
-- Phase 62 — hidden_from_detail column + partial index on wear_events
-- Source: 62-CONTEXT.md D-11; 62-RESEARCH.md Pattern 4
-- Dual-migration discipline: drizzle-kit push LOCAL ONLY; prod uses supabase db push --linked
--
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   drizzle-kit push is LOCAL ONLY; prod uses supabase db push --linked
--   Migration filename: 20260527000000_phase62_wear_hidden_from_detail.sql

BEGIN;

ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS hidden_from_detail boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS wear_events_watch_id_public_visible_idx
  ON wear_events(watch_id, worn_date DESC)
  WHERE visibility = 'public' AND hidden_from_detail = false;

COMMIT;
```

Key notes from analog:
- `IF NOT EXISTS` on both `ALTER TABLE ... ADD COLUMN` and `CREATE INDEX` — idempotent on re-run (Phase 60 migration uses the same pattern at lines 21-34)
- Wrap in `BEGIN;` / `COMMIT;` (Phase 60 uses a transaction; this DDL is simple enough to wrap; but note Phase 53 MEMORY about non-transactional `ALTER TYPE ADD VALUE` — column additions are fine in a transaction, unlike enum value additions)
- No data backfill needed — `DEFAULT false` handles all existing rows at `ALTER TABLE ... ADD COLUMN ... DEFAULT false` time

---

### `src/app/actions/wearEvents.ts` — add `hideWearPicAction` + `unhideWearPicAction`

**Analog:** `deleteWatchPhotoAction` in `src/app/actions/watchPhotos.ts` (lines 154-177)

**Full analog pattern to copy** (lines 1-15 imports + lines 154-177):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
// ... (existing imports in wearEvents.ts already have getCurrentUser + z)
import type { ActionResult } from '@/lib/actionTypes'

// deleteWatchPhotoAction — PHOTO-06 (lines 154-177)
export async function deleteWatchPhotoAction(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = deleteSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    await deleteWatchPhoto(user.id, parsed.data.watchId, parsed.data.photoId)
    revalidatePath('/w/[ref]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteWatchPhotoAction] unexpected error:', err)
    return { success: false, error: "Couldn't delete photo." }
  }
}
```

**Schema pattern to copy** (`watchPhotos.ts` lines 45-51 — `.strict()` mass-assignment guard):
```typescript
const deleteSchema = z
  .object({
    watchId: z.string().uuid(),
    photoId: z.string().uuid(),
  })
  .strict()
```

**New schema for hide action:**
```typescript
const hideWearPicSchema = z
  .object({
    wearEventId: z.string().uuid(),
    watchId: z.string().uuid(),
  })
  .strict()
```

**Ownership re-check pattern** — from `markAsWorn` and `logWearWithPhoto` in the same file (lines 32-34 and 142-145):
```typescript
// CR-01 / IDOR defense: scope watch lookup to caller; 'Watch not found' for cross-user IDs
const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) {
  return { success: false, error: 'Watch not found' }
}
```

**DAL write pattern** — the hide action calls a new `hideWearPic` / `unhideWearPic` function in `src/data/wearEvents.ts` (or inline via `db.update`). The server action does NOT put raw SQL. DAL owns the WHERE clause:
```sql
UPDATE wear_events
SET hidden_from_detail = true
WHERE id = ? AND watch_id = ? AND watch_id IN (SELECT id FROM watches WHERE user_id = ?)
```

**revalidatePath pattern** — `revalidatePath('/w/[ref]', 'page')` (same as `deleteWatchPhotoAction` line 171 — route template, not concrete URL, per BR-02 pattern).

---

### `src/app/w/[ref]/page.tsx` — add wear-pic fetch, signing, and slide assembly

**Self-analog:** existing owner-photo signing at lines 158-169 of the same file.

**Existing signing pattern to extend** (lines 158-169):
```typescript
const rawPhotos = isOwner ? await getWatchPhotosForWatch(watch.id) : []
let signedPhotos: Array<{ id: string; signedUrl: string | null; sortOrder: number }> = []
if (rawPhotos.length > 0) {
  const supabase = createSupabaseAdminClient()
  signedPhotos = await Promise.all(
    rawPhotos.map(async (p) => {
      const { data } = await supabase.storage
        .from('watch-photos')
        .createSignedUrl(p.storagePath, 60 * 60)  // 60-min TTL
      return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
    }),
  )
}
```

**Wear-pic signing — copy and adapt:**
```typescript
// Phase 62 — fetch public wear pics and sign their URLs
// Called for ALL viewers (D-06: all wear pics are the watch owner's, no per-viewer filter)
const rawWearPics = await getPublicWearPicsForWatch(watch.id)
let signedWearPics: SignedWearPic[] = []
if (rawWearPics.length > 0) {
  const supabase = createSupabaseAdminClient()  // SAME instance, reuse or create once
  signedWearPics = await Promise.all(
    rawWearPics.map(async (p) => {
      if (!p.photoUrl) return { ...p, signedUrl: null }
      try {
        const { data } = await supabase.storage
          .from('wear-photos')   // NOTE: wear-photos bucket, not watch-photos
          .createSignedUrl(p.photoUrl, 60 * 60)
        return { ...p, signedUrl: data?.signedUrl ?? null }
      } catch {
        return { ...p, signedUrl: null }  // fail-safe-to-placeholder (D-19, deferred from Phase 61)
      }
    }),
  )
}
```

Key differences from the watch-photos signing:
1. Bucket is `'wear-photos'` not `'watch-photos'`
2. Field is `p.photoUrl` not `p.storagePath`
3. Wraps each signing call in `try/catch` returning `signedUrl: null` on failure (Phase 61 deferred — close it here)
4. Runs for all viewers (not `isOwner`-gated) because wear-pic surfacing is public
5. `createSupabaseAdminClient()` must be called ONCE per request — share the single `supabase` instance already created for `rawPhotos.length > 0` branch (or create it once unconditionally before both signing loops)

**Import additions** (add to existing import at line 7):
```typescript
import { getPublicWearPicsForWatch } from '@/data/wearEvents'
```

**`unstable_instant = false` and `await connection()` (lines 45 and 91) — MUST NOT be touched.**

**`WatchDetail` props addition** — pass `wearPics={signedWearPics}` and pre-fetched `wearInitialComments` alongside existing `signedPhotos`. Both branches of `UnifiedWatchContent` (Branch 1 lines ~158-169 and the D-06 catalog branch lines ~367-379) need the wear-pic fetch+signing block added.

---

### `src/components/watch/WatchPhotoSection.tsx` — `SignedWearPic` type, badge, social row, eye/hide Edit mode

**Analogs:**
- `SortablePhotoThumb.tsx` — Cover badge overlay (lines 121-128), delete button overlay (lines 131-145), overall thumbnail structure
- `WearCommentHost.tsx` — `WearCommentHost` props contract for the bottom-sheet
- Existing `WatchPhotoSection.tsx` — edit-mode toggle pattern (lines 590-605), `onPointerDown` (line 600), `useOptimistic` usage

**Existing `SignedPhoto` interface** (lines 61-65 — add a parallel interface below it, do NOT modify):
```typescript
export interface SignedPhoto {
  id: string
  signedUrl: string | null
  sortOrder: number
}
```

**New `SignedWearPic` interface to add directly below `SignedPhoto`:**
```typescript
export interface SignedWearPic {
  wearEventId: string
  signedUrl: string | null
  wornDate: string          // ISO date 'YYYY-MM-DD' — format with UTC pin per D-07
  hiddenFromDetail: boolean // needed to render greyed/Hidden state in Edit mode
  initialLikeState: { liked: boolean; count: number }
  commentCount: number
  initialComments: CommentWithAuthor[]  // pre-fetched by page RSC (Option A, RESEARCH §Open Q1)
}
```

**Existing `WatchPhotoSectionProps`** (lines 67-75 — extend, don't replace):
```typescript
export interface WatchPhotoSectionProps {
  photos: SignedPhoto[]
  watchId: string
  catalogFallbackUrl: string | null
  brandModel: string
  viewerCanEdit?: boolean
  userId?: string
}
```
Add: `wearPics?: SignedWearPic[]`, `viewerId?: string | null`, plus viewer/owner props needed by WearCommentHost (see WearCommentHost prop contract below).

**Badge pattern** — Copy from `SortablePhotoThumb.tsx` Cover badge (lines 121-128), adapt for bottom-left position:
```typescript
{/* SortablePhotoThumb Cover badge — SOURCE PATTERN (lines 121-128) */}
{isCover && editMode && (
  <span
    className="absolute top-0 left-0 text-xs font-semibold bg-background/80 text-foreground px-1 py-0.5"
    aria-label="Cover photo"
  >
    Cover
  </span>
)}

{/* Phase 62 "Worn · [date]" badge — copy class string, move to bottom-2 left-2 */}
{isWearSlide && (
  <span className="absolute bottom-2 left-2 text-xs font-semibold bg-background/80 backdrop-blur-sm text-foreground px-2 py-0.5 rounded">
    {/* D-07: MANDATORY UTC pin — React #418 hydration class */}
    Worn · {new Date(slide.wornDate + 'T00:00:00Z').toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    })}
  </span>
)}
```

**Edit-mode toggle `onPointerDown` pattern** (line 600 — copy this exact pattern for the eye/hide button):
```typescript
// onPointerDown — NOT onClick — for stale-instance reset
// (MEMORY project_router_cache_stale_instance)
onPointerDown={() => setEditMode((prev) => !prev)}
```
The eye/hide toggle button uses the same `onPointerDown` (not `onClick`) for the same reason.

**Eye/hide button overlay** — copy from delete button in `SortablePhotoThumb.tsx` lines 131-145, swap icon and action:
```typescript
{/* SortablePhotoThumb delete × button SOURCE PATTERN (lines 131-145) */}
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onDelete() }}
  aria-label={`Delete photo ${index + 1}`}
  className="absolute top-1 right-1 size-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs leading-none p-0 hover:bg-destructive/80"
>
  ×
</button>

{/* Phase 62 eye/hide button — same position, different icon/action, NOT destructive */}
{editMode && isWearThumb && (
  <button
    type="button"
    aria-pressed={isHidden}
    aria-label={isHidden ? 'Show on this page' : 'Hide from this page'}
    onPointerDown={(e) => { e.stopPropagation(); handleHideToggle(wearEventId) }}
    className="absolute top-1 right-1 size-6 bg-background/80 rounded-full flex items-center justify-center"
  >
    {isHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
  </button>
)}
```

**`useOptimistic` pattern** — already in use in `WatchPhotoSection.tsx` for photo reorder. Extend the same pattern for hide state:
```typescript
// Existing useOptimistic for photo IDs — SOURCE PATTERN (WatchPhotoSection.tsx ~line 120)
const [optimisticIds, applyOptimisticReorder] = useOptimistic(
  photos.map((p) => p.id),
  (_prev, next: string[]) => next,
)

// Phase 62: analogous optimistic state for wear-pic hidden flags
const [optimisticWearPics, applyOptimisticHide] = useOptimistic(
  wearPicsProp,
  (prev, update: { wearEventId: string; hidden: boolean }) =>
    prev.map((p) => p.wearEventId === update.wearEventId ? { ...p, hiddenFromDetail: update.hidden } : p),
)
```

**WearCommentHost bottom-sheet invocation** — copy from `WearCommentHost.tsx` prop contract (verified at lines 25-39):
```typescript
<WearCommentHost
  variant="bottom-sheet"
  wearEventId={activeWearPic.wearEventId}
  open={commentSheetOpen}
  onOpenChange={setCommentSheetOpen}
  initialComments={activeWearPic.initialComments}
  canComment={true}           // wear targets always open (canViewerCommentOnTarget line 66 of comments.ts)
  ownerFollowsViewer={false}
  viewerIsFollowing={false}
  ownerUserId={ownerUserId}
  ownerUsername={ownerUsername}
  viewerId={viewerId}
  viewerAuthor={viewerAuthor}
  onCountChange={(delta) => updateSlideCommentCount(activeWearPic.wearEventId, delta)}
/>
```

---

### `src/app/u/[username]/[tab]/page.tsx` — add wear-photo signing in worn tab

**Analog:** existing `signCoverUrls` loop at lines 429-441 in the same file + inline signing pattern at `src/app/w/[ref]/page.tsx:160-169`.

**Existing worn tab event map** (lines 423-456 — the section to modify):
```typescript
const events = await getWearEventsForViewer(viewerId, profile.id)
const watches = await signCoverUrls(resolved.watches)
const watchMap = Object.fromEntries(
  watches.map((w) => [w.id, { id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl ?? null }]),
)
return (
  <WornTabContent
    events={events.map((e) => ({
      id: e.id,
      watchId: e.watchId,
      wornDate: e.wornDate,
      note: e.note ?? null,
      // photoUrl is NOT passed today — it is stripped here
    }))}
```

**Pattern to apply** — add a parallel signing step for wear photos (mirror of `signCoverUrls` but for `wear-photos` bucket):
```typescript
// After `const events = await getWearEventsForViewer(...)`:
// Sign wear-photo raw paths (analogous to signCoverUrls for watch-photos)
const supabase = createSupabaseAdminClient()
const rawWearPhotoPaths = events
  .filter((e) => e.photoUrl && getSafeImageUrl(e.photoUrl) === null)
  .map((e) => e.photoUrl as string)
const distinctPaths = [...new Set(rawWearPhotoPaths)]
const wearPhotoSignedMap = new Map<string, string | null>()
await Promise.all(
  distinctPaths.map(async (path) => {
    try {
      const { data } = await supabase.storage.from('wear-photos').createSignedUrl(path, 3600)
      wearPhotoSignedMap.set(path, data?.signedUrl ?? null)
    } catch {
      wearPhotoSignedMap.set(path, null)
    }
  })
)

// Then in the events.map() — add photoUrl:
events.map((e) => ({
  id: e.id,
  watchId: e.watchId,
  wornDate: e.wornDate,
  note: e.note ?? null,
  photoUrl: e.photoUrl
    ? (wearPhotoSignedMap.get(e.photoUrl) ?? null)
    : null,
}))
```

`createSupabaseAdminClient` import is already present in this file (used by `signCoverUrls` which is imported from `src/lib/storage/signCoverUrls.ts`; add `createSupabaseAdminClient` direct import if inlining rather than extracting a helper).

---

### `src/components/profile/WornTimeline.tsx` + `WornCalendar.tsx` — prefer `event.photoUrl`

**Analog:** existing `getSafeImageUrl(watch.imageUrl)` usage at `WornTimeline.tsx:65`.

**Existing `WearEventLite` interface** (lines 12-17 of `WornTimeline.tsx`):
```typescript
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string
  note: string | null
}
```
Add: `photoUrl: string | null`

**Existing image source** (line 65 of `WornTimeline.tsx`):
```typescript
const safe = watch ? getSafeImageUrl(watch.imageUrl) : null
```

**Changed image source** (D-16 / WPIC-03):
```typescript
// Phase 62: prefer event's own wear photo; fall back to watch cover
const wearPhotoSafe = e.photoUrl ? getSafeImageUrl(e.photoUrl) : null
const safe = wearPhotoSafe ?? (watch ? getSafeImageUrl(watch.imageUrl) : null)
```

`getSafeImageUrl` is already imported at line 3 of `WornTimeline.tsx`. No new imports needed — the signed URL passed as `e.photoUrl` is already a valid https URL so `getSafeImageUrl` returns it as-is.

Apply the identical two-line change in `WornCalendar.tsx` wherever `getSafeImageUrl(watch.imageUrl)` is used.

---

## Shared Patterns

### Admin-Client Signing (applies to: `src/app/w/[ref]/page.tsx`, `src/app/u/[username]/[tab]/page.tsx`)
**Source:** `src/lib/storage/signCoverUrls.ts` lines 65-79 + `src/app/w/[ref]/page.tsx` lines 160-169
```typescript
// Admin client — no cookies() dependency; safe in PPR routes (Phase 61 structural fix)
const supabase = createSupabaseAdminClient()
try {
  const { data } = await supabase.storage
    .from('wear-photos')          // bucket name specific to wear photos
    .createSignedUrl(path, 3600)  // 60-min TTL
  // success: data?.signedUrl ?? null
} catch {
  // fail-safe-to-placeholder: return null, not throw (D-19)
}
```
**Rule:** Never use `createSupabaseServerClient()` for URL signing in any route that also calls 'use cache' functions. Admin client only.

### Server Action Ownership Re-Check (applies to: `src/app/actions/wearEvents.ts` new actions)
**Source:** `src/app/actions/wearEvents.ts` lines 32-34 (existing `markAsWorn`)
```typescript
// getCurrentUser() try/catch → zod safeParse → ownership check → DAL call → revalidatePath
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
const parsed = hideWearPicSchema.safeParse(data)
if (!parsed.success) { return { success: false, error: 'Invalid request' } }
const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) { return { success: false, error: 'Watch not found' } }
// ... then DAL write
```
Use `getWatchById(user.id, watchId)` — scopes ownership check to the calling user's watches.

### React #418 UTC-Pin for Date Formatting (applies to: `WatchPhotoSection.tsx` badge, any date display)
**Source:** `src/components/profile/WornTimeline.tsx` lines 24-36 (`formatDateHeading` function)
```typescript
function formatDateHeading(yyyyMmDd: string): string {
  // Parse + format in UTC with a fixed locale for hydration safety (React #418)
  const d = new Date(yyyyMmDd + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}
// Phase 62 badge version (abbreviated):
new Date(wornDate + 'T00:00:00Z').toLocaleDateString('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})
```
**Rule:** Always append `'T00:00:00Z'` to the date string and always pass `timeZone: 'UTC'` + `'en-US'` locale. Never use bare `new Date(wornDate)` or omit `timeZone`.

### `onPointerDown` instead of `onClick` for Edit-Mode Toggles (applies to: `WatchPhotoSection.tsx` eye/hide button)
**Source:** `src/components/watch/WatchPhotoSection.tsx` lines 598-601
```typescript
// onPointerDown — NOT onClick — for stale-instance reset
// (MEMORY project_router_cache_stale_instance: Next 16 restores the
// same stale client component instance on revisited /w/[ref] URLs)
onPointerDown={() => setEditMode((prev) => !prev)}
```
The hide/unhide toggle must also use `onPointerDown` (not `onClick`) for the same reason.

### `getWearRailForViewer` Must Stay Unchanged (negative pattern — D-17)
**Source:** `src/data/wearEvents.ts` lines 324-421
The rail function is the reference for the visibility predicate logic but must receive zero code changes. The new `getPublicWearPicsForWatch` is a fully separate function that does NOT call or import from `getWearRailForViewer`.

---

## No Analog Found

All 8 files have clear analogs. No new top-level directories needed.

---

## Metadata

**Analog search scope:** `src/data/`, `src/app/actions/`, `src/app/w/`, `src/app/u/`, `src/components/watch/`, `src/components/profile/`, `src/components/wear/`, `src/lib/storage/`, `supabase/migrations/`
**Files scanned:** 14 source files read
**Pattern extraction date:** 2026-05-27

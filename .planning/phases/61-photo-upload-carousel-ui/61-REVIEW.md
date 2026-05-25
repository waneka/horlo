---
phase: 61-photo-upload-carousel-ui
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/app/actions/watchPhotos.ts
  - src/data/watches.ts
  - src/lib/storage/signCoverUrls.ts
  - src/app/w/[ref]/page.tsx
  - src/app/page.tsx
  - src/app/search/page.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - src/app/u/[username]/profile-shell-resolver.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchPhotoSection.tsx
  - src/components/watch/SortablePhotoThumb.tsx
  - src/components/watch/PhotoDropzone.tsx
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/WatchForm.tsx
  - src/components/watch/WatchPhotoStep.tsx
  - src/components/watch/flowTypes.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
resolution:
  fixed:
    - CR-01  # commit 1285c3c: useEffect cleanup + startTransition for delete flow
    - CR-02  # commit 543e023: storagePath folder-scope check (IDOR)
    - WR-02  # commit 1285c3c: useOptimistic auto-revert on delete failure
    - WR-03  # commit 5176f6e: thread userId from RSC, remove client-side getUser
    - WR-04  # commit 194d0f1: localUploadCount for accurate cap math
    - IN-02  # commit 8bcee46: move console.error after instanceof checks
  deferred:
    - WR-01  # intentional: non-owner signing via viewer session fails safe (placeholder fallback); public-photo surfacing is Phase 62 scope
    - IN-01  # intentional: pre-existing dead code unrelated to Phase 61; deferred as separate cleanup
  resolved_at: 2026-05-25
---

# Phase 61: Code Review Report

**Reviewed:** 2026-05-25
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 61 adds watch photo upload (multi-file), a carousel+filmstrip detail UI, and a photos-pending intercept step in the Add Watch flow. The server-action authorization chain is well-constructed — `getCurrentUser()` is always called first, Zod `.strict()` guards against mass-assignment, and DAL ownership checks run against `watches.user_id`. Signed URLs are correctly kept out of the `'use cache'` scope. The main structural concerns are: a delete action that fires without waiting for user confirmation (the undo window is not a substitute for server-action timing), a cross-tenant storagePath injection vulnerability, a stale optimistic-state scenario on delete failure, and two secondary auth/UX issues.

---

## Critical Issues

### CR-01: `deleteWatchPhotoAction` fires unconditionally after 5-second timer — delete is not guarded by undo confirmation

**File:** `src/components/watch/WatchPhotoSection.tsx:236-241`

**Issue:** `handleDelete` schedules `deleteWatchPhotoAction` via `setTimeout(5000)` and stores the timer reference in `undoTimerRef`. The undo toast's `onClick` does `clearTimeout(undoTimerRef.current)` before `window.location.reload()`. However, `undoTimerRef` is a component-level ref. If the user's "Undo" click fires after the timeout already executed (race: toast is still visible at exactly 5000ms boundary due to JS event-loop timing, or the browser throttles the timer in a background tab), `clearTimeout` is a no-op on an already-fired timer and the delete proceeds anyway. More critically: if the component unmounts between the `handleDelete` call and the 5-second mark (e.g., user navigates away, the RSC revalidates, or the page is backgrounded), the timer continues running in the background and fires `deleteWatchPhotoAction` against a potentially stale `watchId`/`photoId` pair with no UI attached to observe the failure. There is no `useEffect` cleanup that clears `undoTimerRef.current` on unmount.

This is a correctness issue: the server-side delete fires even when the user explicitly taps "Undo," in race conditions where the timer fires before `clearTimeout` runs. It also fires after unmount, which is a background-mutation bug that can delete photos the user intended to keep.

**Fix:**
```tsx
// In WatchPhotoSection:
// 1. Add cleanup in useEffect to clear any pending delete timer on unmount.
useEffect(() => {
  return () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }
}, [])

// 2. In the undo onClick, check whether the timer is still pending BEFORE
//    reloading. If clearTimeout returns cleanly (timer was pending), revert
//    optimistic state WITHOUT reloading — use a proper revert path.
//    The current window.location.reload() is a sledgehammer for what should
//    be a state revert: track whether the timer fired via a deletedRef flag.

const deleteFiredRef = useRef<Record<string, boolean>>({})

function handleDelete(photoId: string) {
  startTransition(async () => { setDeletedIds(photoId) })

  toast('Photo deleted', {
    action: {
      label: 'Undo',
      onClick: () => {
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current)
          undoTimerRef.current = null
        }
        // Only reload if the action hasn't already fired
        if (!deleteFiredRef.current[photoId]) {
          window.location.reload() // or trigger router.refresh() for RSC revert
        }
      },
    },
    duration: 5000,
  })

  undoTimerRef.current = setTimeout(async () => {
    deleteFiredRef.current[photoId] = true
    const result = await deleteWatchPhotoAction({ watchId, photoId })
    if (!result.success) {
      toast.error("Couldn't delete photo.")
    }
  }, 5000)
}
```

---

### CR-02: `storagePath` accepted from the client without format validation — path traversal / cross-tenant photo injection possible

**File:** `src/app/actions/watchPhotos.ts:34-37` and `src/data/watches.ts:576-604`

**Issue:** `addSchema` validates `storagePath` as `z.string().min(1)` — any non-empty string is accepted. The client uploads a file to Supabase Storage and then passes the resulting `storagePath` to `addWatchPhotoAction`. The server action forwards this path verbatim to `addWatchPhoto` (DAL), which inserts it into `watch_photos.storage_path` without verifying that the path is scoped to `{userId}/...`.

A malicious authenticated user can:
1. Upload a legitimate file to `{their-userId}/photo.jpg` to learn the path format.
2. Then call `addWatchPhotoAction({ watchId: <their-own-valid-watchId>, storagePath: '{victim-userId}/victim-photo.jpg' })`.
3. The ownership check in `addWatchPhoto` only verifies `watches.user_id = userId` for the `watchId` — it does not validate that `storagePath` starts with `{userId}/`. The photo row is inserted pointing at another user's storage object.

The DAL's three-step guard (ownership → cap → insert) correctly prevents cross-watch injection but does NOT prevent cross-user storage path injection. A non-owner's signed photo URL would then appear on the attacker's watch detail page.

The Supabase Storage RLS policy presumably scopes reads to the file owner's folder, so the signed URL may fail for the injected path — but the `watch_photos` row persists and the attacker can observe which paths yield valid signed URLs vs. errors to probe other users' storage contents.

**Fix:**
```typescript
// In addWatchPhotoAction, after ownership is confirmed by getCurrentUser():
const addSchema = z
  .object({
    watchId: z.string().uuid(),
    storagePath: z.string().min(1),
  })
  .strict()
  .refine(
    (d) => !d.storagePath.includes('..'),
    { message: 'Invalid storage path', path: ['storagePath'] },
  )

// In addWatchPhoto (DAL) or in the action, after user is resolved:
// Verify the storagePath starts with the authenticated user's folder prefix.
// The expected format from uploadWatchPhoto is `{userId}/{photoId}` or similar.
if (!parsed.data.storagePath.startsWith(`${user.id}/`)) {
  return { success: false, error: 'Invalid request' }
}
```

Additionally, confirm and document the exact path format that `uploadWatchPhoto` produces so the prefix check is unambiguous.

---

### CR-03: Non-owner viewers receive `rawPhotos = []` branch silently — but Branch 2 catalog-owned path fetches photos without re-checking ownership of `ownedWatch`

**File:** `src/app/w/[ref]/page.tsx:322-334`

**Issue:** In Branch 2 (D-06 catalog-owned path, lines 279-403), `getWatchPhotosForWatch(ownedWatch.id)` is called after `getWatchById(user.id, viewerOwnedRow.id)` confirms the viewer owns the watch. This is correct. However, `getWatchPhotosForWatch` (DAL, `src/data/watches.ts:709-722`) takes only `watchId` — no `userId` parameter. Its comment says "ownership framing is resolved by the RSC that already confirmed the viewer has access to this watch."

The concern: in the Branch 2 D-06 owned path, `const isOwner = true` is hardcoded (line 319). But the condition triggering this path is `viewerOwnedRow !== null`, which comes from `findViewerWatchByCatalogId(user.id, ref)`. `findViewerWatchByCatalogId` returns a row only if `watches.user_id = userId AND watches.status = 'owned'`. This is correct.

The actual risk is in Branch 1 (lines 145-157): `rawPhotos` is populated only when `isOwner` is true (`const rawPhotos = isOwner ? await getWatchPhotosForWatch(watch.id) : []`). Non-owners correctly get `signedPhotos = []`. But `signedPhotos` is passed to `WatchDetail` which then conditionally renders `WatchPhotoSection`. Since non-owner `signedPhotos` is `[]`, the section renders with zero photos and no `userId`, so upload controls are correctly hidden (`viewerCanEdit` is `false` for non-owners). This path is structurally correct.

However: `WatchDetail` receives `userId={isOwner ? user.id : undefined}` (line 172). When `viewerCanEdit={false}` and `userId={undefined}`, `WatchPhotoSection` correctly suppresses all edit controls. The issue is the `WatchPhotoSection` `viewerCanEdit` default is `false` (line 84) — this is safe. No actual BLOCKER exists here; documenting as WARNING below (WR-01).

**Reclassify:** This is not a BLOCKER as analyzed. See WR-01 below for the warning-level variant.

---

## Warnings

### WR-01: `signCoverUrls` on the profile page signs paths using the VIEWER'S session — non-owner viewers silently receive `null` imageUrl for owner photos

**File:** `src/app/u/[username]/profile-shell-resolver.tsx:71-76` and `src/app/u/[username]/[tab]/page.tsx:191`

**Issue:** `resolveProfileShellSigned` calls `signCoverUrls(resolved.watches)` using the current request's Supabase server client, which uses the VIEWER's session cookies. If the viewer is not the owner, the viewer's session cannot generate signed URLs for files in the owner's storage folder (storage RLS scopes folder access to the uploader's userId prefix). The result: every watch with an owner-uploaded cover photo gets `imageUrl: null` for non-owner viewers.

The comment in `[tab]/page.tsx` line 189 acknowledges this: "returns null for another user's files (storage RLS scopes SELECT to the file owner)." The code treats this as acceptable (graceful fallback to placeholder). However, the intent of the phase is to show owner-uploaded cover photos to all viewers — not just the owner. If the storage bucket policy prevents non-owners from signing URLs for other users' files, then the cover photo is invisible to the owner's profile visitors.

This is a design gap: the signing must happen server-side using a service-role or admin client for photos that should be publicly viewable, or the storage policy must allow signed URL generation for all authenticated users. The current code silently degrades for all non-owner profile views.

**Fix:**
Decide whether owner photos should be visible to other users. If yes:
- Either make the `watch-photos` bucket public (no signing needed) and use the public URL directly.
- Or sign URLs using the admin/service-role Supabase client (not the user-session client) so the signing privilege is independent of viewer identity.
- Or scope the DAL `getWatchPhotosForWatch` → sign at the owner's RSC (already done correctly for `/w/[ref]`) and thread signed URLs through to profile grid card rendering.

If non-owner photo visibility is intentional future scope, document the limitation explicitly and remove the misleading comment that implies it "succeeds for the owner's own files."

---

### WR-02: Optimistic delete state never reverts on server-action failure — deleted photo disappears permanently from UI even after `toast.error`

**File:** `src/components/watch/WatchPhotoSection.tsx:213-241`

**Issue:** `handleDelete` calls `setDeletedIds(photoId)` inside `startTransition` immediately. After the 5-second undo window, `deleteWatchPhotoAction` is called. If it fails, `toast.error("Couldn't delete photo.")` is shown, but the optimistic `deletedIds` state is NOT reverted. The photo remains hidden in the UI even though the server-side delete failed. The user must do a hard reload to restore the photo.

`useOptimistic` is designed to auto-revert when the enclosing `startTransition` settles — but the delete action is fired from a plain `setTimeout` callback, NOT from within a `startTransition`. The `startTransition` wrapping `setDeletedIds` only covers the optimistic update itself. The actual server call at line 237 (`deleteWatchPhotoAction`) runs outside any transition, so React cannot auto-revert the optimistic state on failure.

**Fix:**
Move the delete action inside a `startTransition` that wraps BOTH the optimistic update and the server call, with the optimistic update as the reducer argument. This is the `useOptimistic` intended pattern:

```tsx
function handleDelete(photoId: string) {
  // ... undo toast setup
  undoTimerRef.current = setTimeout(() => {
    startTransition(async () => {
      setDeletedIds(photoId) // optimistic
      const result = await deleteWatchPhotoAction({ watchId, photoId })
      if (!result.success) {
        toast.error("Couldn't delete photo.")
        // useOptimistic auto-reverts when transition settles without revalidatePath
      }
    })
  }, 5000)
}
```

This also eliminates the separate `startTransition(async () => { setDeletedIds(photoId) })` at lines 215-217, which currently fires the optimistic update immediately (before the undo window closes), making the photo disappear from view before the 5-second undo window has elapsed — which is correct UX-wise but structurally disconnected from the actual server call transition.

---

### WR-03: `WatchPhotoStep` resolves `userId` via `supabase.auth.getUser()` in a client-side `useEffect` — creates a window where `userId` is null and upload is blocked

**File:** `src/components/watch/WatchPhotoStep.tsx:60-71`

**Issue:** `WatchPhotoStep` resolves the viewer's `userId` via a `useEffect` that calls `createSupabaseBrowserClient().auth.getUser()` after mount. Until this resolves, `userId` is `null` and `PhotoDropzone` is replaced with a disabled placeholder. The comment notes "typically < 50ms."

The `userId` is already known server-side: it's resolved in `AddWatchFlow`'s parent RSC (`/watch/new/page.tsx`) via `getCurrentUser()` and then threaded as `viewerUsername`. However, `WatchPhotoStep` does not receive `userId` as a prop — it re-resolves it client-side.

This is the same pattern as `WatchForm.handleSubmit` (lines 220-228 in `WatchForm.tsx`), which also does a client-side `supabase.auth.getUser()` call at submit time. The pattern works but creates an unnecessary async dependency at component mount. More importantly, if the session expires between the form commit and the photo step (which are sequential), `getUser()` will return null and uploads silently fail with no error surfaced to the user (the `PhotoDropzone` will remain in disabled state indefinitely since `userId` never gets set).

**Fix:**
Thread `userId` from the RSC (`/watch/new/page.tsx` already has `user.id`) through `AddWatchFlow` → `WatchPhotoStep` as a prop, eliminating the client-side resolution entirely:

```tsx
// WatchPhotoStep props:
interface WatchPhotoStepProps {
  watchId: string
  userId: string  // passed from AddWatchFlow, which receives it from the RSC
  onDone: () => void
  onSkip: () => void
}
```

This also closes the session-expiry edge case and removes the flash of disabled content.

---

### WR-04: `handleFiles` in `PhotoDropzone` uses `currentPhotoCount` from props — stale count during sequential batch upload causes cap bypass

**File:** `src/components/watch/PhotoDropzone.tsx:136-169`

**Issue:** `handleFiles` computes `remaining = MAX_PHOTOS - currentPhotoCount` where `currentPhotoCount` is the prop value at the time the file-picker dialog closes. The batch is sliced to `remaining` files. However, `currentPhotoCount` is a prop that reflects the server-confirmed count from the last RSC render — it does NOT include photos from the current upload batch in progress.

Scenario: The watch has 8 photos. The user opens the file picker and selects 5 files. `remaining = 10 - 8 = 2`, so `batch = [file1, file2]` and `rejected = 3`. `processSingleFile` is called sequentially. Both uploads succeed; the DAL's cap check runs against the DB count (8 → 9 → 10). This is correct for the first batch.

Now: after the first batch completes, `revalidatePath('/w/[ref]', 'page')` invalidates the RSC. But in `WatchPhotoSection`, `onPhotosAdded` is a no-op callback (line 412: `onPhotosAdded={() => {}}`). The page will only show the new count after a full RSC re-render/navigation. Meanwhile, if the user immediately selects more files without navigating, `currentPhotoCount` is still the OLD prop value (8, not 10), so `remaining` calculates as 2 again, and the user can queue another 2 uploads. The DAL backstop (`PhotoCapExceededError`) will reject them server-side, but the UX flow suggests they will succeed (no client-side cap message fires).

This is not a security issue (DAL is the authoritative cap), but the client-side cap message is misleading — it shows "you've reached the 10-photo limit" only at the boundary, not when a second batch is attempted after the count reaches 10 via a previous batch that hasn't yet revalidated.

**Fix:**
In `WatchPhotoSection`, track the number of photos that have been successfully added in the current session and add it to `currentPhotoCount` when computing the prop for `PhotoDropzone`:

```tsx
const [localAddedCount, setLocalAddedCount] = useState(0)

// In the PhotoDropzone inside the filmstrip:
<PhotoDropzone
  watchId={watchId}
  userId={userId ?? ''}
  currentPhotoCount={visibleIds.length + localAddedCount}
  onPhotosAdded={(newIds) => {
    setLocalAddedCount((c) => c + newIds.length)
  }}
/>
```

Or more simply: use `visibleIds.length` (which already reflects optimistic additions via the reorder state) as `currentPhotoCount` rather than a separate prop.

---

## Info

### IN-01: `linkWatchToCatalog` is marked `@deprecated` but never removed — dead code accumulates

**File:** `src/data/watches.ts:393-403`

**Issue:** `linkWatchToCatalog` carries a JSDoc `@deprecated` annotation noting it has no callers post-Phase-38 Plan A and is marked for deletion. It still exists in the codebase. Dead deprecated code is technical debt, and server-only DAL files with unused exports can confuse future callers into resurrecting the helper.

**Fix:** Delete the `linkWatchToCatalog` function and its JSDoc. Run `npm run build` to verify no remaining callers.

---

### IN-02: `reorderWatchPhotosAction` catches `OwnerMismatchError` AFTER the `console.error` for unexpected errors — both the unexpected-error log and the specific error message fire simultaneously

**File:** `src/app/actions/watchPhotos.ts:75-87`

**Issue:** The catch block in `reorderWatchPhotosAction` calls `console.error('[reorderWatchPhotosAction] unexpected error:', err)` unconditionally on line 76, then checks `instanceof OwnerMismatchError` and `instanceof SetMismatchError` on lines 77 and 82. Both `OwnerMismatchError` and `SetMismatchError` are "expected" errors (they indicate invalid client state, not infrastructure failures). They should NOT be logged as unexpected errors.

This is the same issue that the Phase 60 CR-01 fix addressed for `deleteWatchPhoto` — the discriminated error check should come BEFORE the general error log, or the general log should only fire on the final fallback branch.

**Fix:**
```typescript
} catch (err) {
  if (err instanceof OwnerMismatchError) {
    return { success: false, error: 'Some photos do not belong to you.' }
  }
  if (err instanceof SetMismatchError) {
    return {
      success: false,
      error: 'Photos changed in another tab. Refresh and try again.',
    }
  }
  // Only log truly unexpected errors
  console.error('[reorderWatchPhotosAction] unexpected error:', err)
  return { success: false, error: "Couldn't save new order." }
}
```

---

_Reviewed: 2026-05-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 61-photo-upload-carousel-ui
fixed_at: 2026-05-25T14:35:00Z
review_path: .planning/phases/61-photo-upload-carousel-ui/61-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 61: Code Review Fix Report

**Fixed at:** 2026-05-25
**Source review:** .planning/phases/61-photo-upload-carousel-ui/61-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-02, WR-03, WR-04, IN-02)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### IN-02: reorderWatchPhotosAction catch block ordering

**Files modified:** `src/app/actions/watchPhotos.ts`
**Commit:** 8bcee46
**Applied fix:** Moved `console.error` to after the `instanceof OwnerMismatchError` and `instanceof SetMismatchError` checks so expected client-state errors are not logged as unexpected infrastructure failures. Mirrors the Phase 60 CR-01 precedent for `deleteWatchPhoto`.

---

### CR-02: storagePath accepted without folder-scope check (IDOR)

**Files modified:** `src/app/actions/watchPhotos.ts`, `tests/actions/watchPhotos.test.ts`
**Commit:** 543e023
**Applied fix:**
1. Added `.refine((d) => !d.storagePath.includes('..'), ...)` to `addSchema` to block path-traversal strings at the Zod layer.
2. After `addSchema.safeParse` succeeds, added an explicit `storagePath.startsWith(`${user.id}/`)` check — returns `{ success: false, error: 'Invalid request' }` for cross-user paths.
3. Updated `storagePath` test fixture from `'user-folder/watch-123/photo.jpg'` to `` `${userId}/${photoId}.jpg` `` (the format produced by `buildWatchPhotoPath`).
4. Added three IDOR security tests: cross-user path rejected, `..` path rejected, valid caller-scoped path accepted.

The path format (`{userId}/{photoId}.jpg`) is defined in `src/lib/storage/watchPhotos.ts` (`buildWatchPhotoPath`) and enforced by the Storage RLS policy. The action now enforces the same invariant at the server-action layer.

---

### CR-01: deleteWatchPhotoAction fires unconditionally after timer — no unmount cleanup

### WR-02: Optimistic delete state never reverts on server-action failure

**Files modified:** `src/components/watch/WatchPhotoSection.tsx`
**Commit:** 1285c3c
**Applied fix (CR-01):**
- Added `useEffect(() => { return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) } }, [])` to clear the pending delete timer on component unmount, preventing background mutations against a stale `watchId` when the user navigates away during the 5-second undo window.
- In the undo `onClick`, null the ref after clearing (`undoTimerRef.current = null`) so a late undo click cannot `clearTimeout` an already-fired timer ID (which is a silent no-op, not a guard).
- Removed `window.location.reload()` from the undo path — no longer needed since the photo reappears automatically when the transition is abandoned (see WR-02 fix below).

**Applied fix (WR-02):**
- Moved both `setDeletedIds(photoId)` (optimistic hide) and `deleteWatchPhotoAction(...)` (server call) into a single `startTransition` inside the `setTimeout` callback.
- `useOptimistic` auto-reverts the hidden state when the transition settles without a `revalidatePath` on the server side. The error path in `deleteWatchPhotoAction` does not call `revalidatePath`, so the photo reappears automatically on failure.
- The toast showing the undo affordance is still called immediately (before the 5-second wait), preserving the 5-second undo-window UX.

Note: the optimistic hide now occurs after the 5-second timer fires (when the actual server call runs), not immediately on `handleDelete`. This is the correct behavior — the photo should remain visible during the undo window and disappear only when the delete commits.

---

### WR-03: WatchPhotoStep resolves userId client-side via useEffect

**Files modified:** `src/components/watch/WatchPhotoStep.tsx`, `src/components/watch/AddWatchFlow.tsx`, `src/app/watch/new/page.tsx`
**Commit:** 5176f6e
**Applied fix:**
- Added `userId: string` prop to `WatchPhotoStepProps` and removed the `useEffect`/`createSupabaseBrowserClient`/`getUser()` resolution entirely. Removed `useEffect` and `createSupabaseBrowserClient` imports from `WatchPhotoStep.tsx`.
- Added `viewerUserId: string` prop to `AddWatchFlowProps` and destructured in `AddWatchFlow`. Passed `userId={viewerUserId}` to `WatchPhotoStep` at the `photos-pending` render.
- Added `viewerUserId={user.id}` to the `AddWatchFlow` call in `/watch/new/page.tsx` — `user.id` is already available from `getCurrentUser()` at the top of the page.
- `PhotoDropzone` is now immediately enabled on mount with no disabled-placeholder flash.

---

### WR-04: PhotoDropzone cap math uses stale currentPhotoCount after batch upload

**Files modified:** `src/components/watch/WatchPhotoSection.tsx`
**Commit:** 194d0f1
**Applied fix:**
- Added `localUploadCount` (`useState(0)`) to track photos added in the current session before RSC revalidation flushes.
- The filmstrip `PhotoDropzone` now receives `currentPhotoCount={visibleIds.length + localUploadCount}`.
- `onPhotosAdded` increments `localUploadCount` by the number of newly added photos.
- A `useEffect` watching `photos.length` resets `localUploadCount` to 0 when the RSC re-renders with fresh data (i.e., after `revalidatePath` flushes and `photos` prop reflects the new rows), preventing double-counting.
- The DAL `PhotoCapExceededError` remains the authoritative server-side backstop.

---

## Deferred Issues

### WR-01: Non-owner viewers receive null imageUrl for owner cover photos

**File:** `src/app/u/[username]/profile-shell-resolver.tsx:71-76`
**Reason:** Intentional architectural deferral. Signing via the viewer's session fails safe — falls back to a placeholder rather than exposing another user's signed URL. Public-photo surfacing (making owner photos visible to non-owners) is scoped to Phase 62's public-photo consent model. Changing signing strategy now (service-role signer or public bucket) would pre-empt that design decision. Left as-is per constraint.

### IN-01: linkWatchToCatalog deprecated dead code

**File:** `src/data/watches.ts:393-403`
**Reason:** Pre-existing dead code unrelated to Phase 61. No callers since Phase 38. Deferred as a standalone cleanup task to avoid scope creep in this review cycle.

---

_Fixed: 2026-05-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

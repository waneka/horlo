---
phase: 61-photo-upload-carousel-ui
verified: 2026-05-25T22:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Carousel swipe navigation on iOS"
    expected: "Owner can swipe left/right between photos on /w/[ref]; swiping is disabled while Edit mode is active"
    why_human: "Touch gesture behavior (iOS Safari swipe claim) cannot be verified without a device on prod; embla reInit({ watchDrag: !editMode }) is in code but gesture coexistence requires live confirmation"
  - test: "Touch drag-reorder on filmstrip (iOS)"
    expected: "Owner can long-press-drag a thumbnail to a new position; Cover badge moves to new first thumb; 'Order updated' toast fires; grid card thumbnail updates after navigation"
    why_human: "dnd-kit TouchSensor with 250ms delay requires live device confirmation; touchAction: 'manipulation' is in SortablePhotoThumb but iOS gesture claim is not testable locally"
  - test: "OS photo picker (camera-or-library) on mobile"
    expected: "Tapping +Add on the detail page or the dropzone in the add-watch step opens the OS picker offering BOTH camera and library options (no forced capture)"
    why_human: "OS picker behavior depends on the mobile browser's handling of <input type='file' accept='image/*'> without capture attribute; cannot test locally"
  - test: "Skip for now visual prominence / friction"
    expected: "The 'Skip for now' link in the add-watch photos step is clearly the secondary, lower-contrast option compared to the primary 'Add photos'/'Continue' Button; friction is sufficient without being blocking"
    why_human: "Visual hierarchy and UX friction judgment requires human evaluation on prod; code confirms it is a plain <button> with text-muted-foreground but visual weight is device/design context dependent"
  - test: "Router-Cache stale-instance reset on /w/[ref] revisit"
    expected: "Navigating away from /w/[ref] and back resets Edit mode to off; carousel is usable and the filmstrip does not show stale drag state"
    why_human: "Next 16 Router Cache stale-instance behavior (MEMORY project_router_cache_stale_instance) requires on-device prod verification; onPointerDown reset is in code but cannot be confirmed without live navigation"
---

# Phase 61: Photo Upload + Carousel UI Verification Report

**Phase Goal:** A watch owner can upload, view, reorder, and delete photos from the watch detail page; the add-watch flow prominently surfaces photo upload as a first-class step.
**Verified:** 2026-05-25T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | An owner can upload one or more photos to a watch they own and see them appear on the detail page | VERIFIED | `PhotoDropzone` wires `stripAndResize → uploadWatchPhoto → addWatchPhotoAction`; `/w/[ref]/page.tsx` signs paths via `createSignedUrl` and passes `signedPhotos` to `WatchDetail → WatchPhotoSection`; 9 passing photo-uploader tests including pipeline + cap |
| SC2 | Photos display in a one-at-a-time carousel with arrow and swipe navigation | VERIFIED (structural) | `useEmblaCarousel({ loop:false, dragFree:false })` in `WatchPhotoSection`; ChevronLeft/ChevronRight arrows with disabled+opacity-50 at boundaries; position indicator `{n} / {total}` with aria-live; `watchDrag: !editMode` toggles swipe in edit mode; 15 passing carousel tests; iOS swipe is human_needed |
| SC3 | An owner can drag-reorder photos; dragging a photo to the first position makes it the card thumbnail across grids | VERIFIED (structural / owner-view) | `horizontalListSortingStrategy` + `DndContext` + `SortableContext` in `WatchPhotoSection`; `reorderWatchPhotosAction` called on drag-end with `revalidatePath('/w/[ref]', 'page')`; `signCoverUrls` wired into all 4 cover-rendering RSCs (`page.tsx`, `[tab]/page.tsx`, `profile-shell-resolver.tsx`, `search/page.tsx`); 7 passing signCoverUrls unit tests; known limitation: non-owner viewers of another user's grids see placeholder for owner-uploaded covers (storage RLS folder scoping — deferred to Phase 62, fails safe); touch drag is human_needed |
| SC4 | An owner can delete an individual photo; the cap affordance is visibly blocked with clear messaging when the ~10-photo limit is reached | VERIFIED | `handleDelete` + 5-second undo window + `deleteWatchPhotoAction`; CR-01 fix: `useEffect` unmount cleanup clears `undoTimerRef`; WR-02 fix: server call inside `startTransition` for auto-revert; at-cap: `+Add` tile disabled + "10 photos — at the limit." message; `PhotoDropzone` shows cap blocked state; delete tests pass; cap tests pass |
| SC5 | The add-watch flow presents a prominent (not buried) photo upload affordance that is not easily skipped | VERIFIED (structural) | `photos-pending` FlowState variant in `flowTypes.ts`; `WatchForm.onWatchCreated` callback fires with `result.data.id` before `router.push`; `AddWatchFlow.handleWatchCreated` transitions to `photos-pending`; `onWatchCreated={handleWatchCreated}` on BOTH `form-prefill` (~line 586) AND `manual-entry` (~line 619) `<WatchForm>` instances; `WatchPhotoStep` renders "Add your photos" heading + PhotoDropzone + "Skip for now" plain `<button>` (not Button); photos-pending reset in `useLayoutEffect` cleanup; visual prominence/friction is human_needed |

**Score:** 5/5 truths verified (structural wiring complete; device behaviors human_needed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/actions/watchPhotos.ts` | 3 server actions + `.strict()` + ownership | VERIFIED | `addWatchPhotoAction`, `deleteWatchPhotoAction`, `reorderWatchPhotosAction` all present; 3× `.strict()` schemas; `getCurrentUser()` before DAL; CR-02: `storagePath.startsWith(user.id + '/')` check; `revalidatePath('/w/[ref]', 'page')` in all 3 actions |
| `src/data/watches.ts` | `getWatchPhotosForWatch` returning `{id, storagePath, sortOrder}[]` | VERIFIED | Function at line 709; pure SELECT ordered by `asc(watchPhotos.sortOrder)`; no userId param (ownership framing by RSC) |
| `src/components/watch/WatchPhotoSection.tsx` | embla carousel + filmstrip + Edit toggle + upload orchestration (120+ lines) | VERIFIED | 589 lines; `useEmblaCarousel`; `horizontalListSortingStrategy`; `DndContext`; `useOptimistic`; `onPointerDown` Edit toggle; CR-01+WR-02+WR-04 fixes present |
| `src/components/watch/SortablePhotoThumb.tsx` | useSortable thumbnail with Cover badge, delete ×, drag handle | VERIFIED | `useSortable`, `CSS.Transform.toString`, `touchAction: 'manipulation'`, Cover badge, delete `×` (onClick only), `{...listeners}` on GripVertical handle only |
| `src/components/watch/PhotoDropzone.tsx` | multi-file input + desktop drop zone + HEIC + stripAndResize + uploadWatchPhoto + addWatchPhotoAction + cap/batch-overflow | VERIFIED | All pipeline components present: `isHeicFile`, `convertHeic`, lazy `stripAndResize`, `uploadWatchPhoto`, `addWatchPhotoAction`, sequential `for` loop, batch-overflow toast, `e.target.value = ''` reset |
| `src/app/w/[ref]/page.tsx` | RSC: `getWatchPhotosForWatch` + `createSignedUrl` + `signedPhotos` to both owner WatchDetail call sites | VERIFIED | `createSignedUrl` at lines 153 and 330; `signedPhotos` threaded to both Branch 1 (~line 171) and Branch 2 (~line 350) `<WatchDetail>` calls; `userId` passed at both sites |
| `src/lib/storage/signCoverUrls.ts` | Batch helper: signs raw watch-photos paths, passes https through, `import 'server-only'` | VERIFIED | `import 'server-only'`; `getSafeImageUrl` discriminator; de-duped `Promise.all`; immutable output; signing failure → null; 7/7 unit tests pass |
| `src/components/watch/WatchPhotoStep.tsx` | Lean add-flow step: "Add your photos" heading + PhotoDropzone + "Continue"/"Add photos" + "Skip for now" plain button | VERIFIED | Heading `text-lg font-semibold`; subheading `text-sm text-muted-foreground`; `PhotoDropzone` imported; primary `<Button variant="default">`; "Skip for now" is plain `<button>` with `text-muted-foreground`; `userId` prop (WR-03 fix applied) |
| `src/components/watch/flowTypes.ts` | `photos-pending` FlowState variant with watchId + destination | VERIFIED | Line 35: `| { kind: 'photos-pending'; watchId: string; destination: string }` |
| `src/components/watch/WatchForm.tsx` | `onWatchCreated?` callback prop fired on create success before navigation | VERIFIED | Lines 70, 270-271: optional prop, fires with `result.data.id` and `dest`; existing `router.push` preserved for no-callback callers |
| `src/components/watch/AddWatchFlow.tsx` | `handleWatchCreated` + `<WatchPhotoStep>` render branch + photos-pending cleanup | VERIFIED | `handleWatchCreated` at line 461; `onWatchCreated={handleWatchCreated}` at lines 586 and 619 (both form paths); `WatchPhotoStep` render branch at line 628; useLayoutEffect cleanup includes photos-pending (line 184) |
| `tests/actions/watchPhotos.test.ts` | 23 tests covering auth, zod strict, OwnerMismatchError, SetMismatchError, PhotoCapExceededError, revalidatePath | VERIFIED | 23/23 passing; coverage confirmed by review |
| `tests/lib/signCoverUrls.test.ts` | 7 tests: raw→signed, https unchanged, null passthrough, batch de-dupe, signing-failure→null | VERIFIED | 7/7 passing |
| `tests/components/watch-photo-section.test.tsx` | 15 tests: carousel render, arrows, position indicator, filmstrip, edit mode, Cover badge, delete | VERIFIED | 15/15 passing |
| `tests/components/photo-uploader.test.tsx` | 9 tests: cap, batch overflow toast, pipeline, HEIC, input reset, drop zone | VERIFIED | 9/9 passing |
| `tests/components/add-watch-flow-photos.test.tsx` | 7 tests: photos-pending state, Skip path, heading/CTA copy | VERIFIED | 7/7 passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/w/[ref]/page.tsx` | watch-photos bucket signed URLs | `createSupabaseServerClient().storage.from('watch-photos').createSignedUrl(path, 3600)` | WIRED | Lines 153 and 330; signing on both owner branches |
| `src/components/watch/WatchDetail.tsx` | `WatchPhotoSection` | `<WatchPhotoSection photos={signedPhotos} ...>` replacing old image block | WIRED | Line 145; old `<Image src={safeUrl}>` block preserved only in `else` branch (backward compat, never reached from RSC) |
| `src/components/watch/PhotoDropzone.tsx` | `addWatchPhotoAction` | `import + direct call` after upload pipeline | WIRED | Lines 28, 119-128 |
| `src/components/watch/WatchPhotoSection.tsx` | `reorderWatchPhotosAction` / `deleteWatchPhotoAction` | `optimistic useTransition + sonner toast` | WIRED | Lines 59, 212, 279 |
| `src/components/watch/WatchForm.tsx` | `AddWatchFlow.handleWatchCreated` | `onWatchCreated(result.data.id, dest)` on create success | WIRED | Lines 270-271 |
| `src/components/watch/AddWatchFlow.tsx` | `WatchPhotoStep` | `photos-pending` render branch passing `watchId + onDone/onSkip` | WIRED | Lines 628-645 |
| `src/components/watch/WatchPhotoStep.tsx` | `addWatchPhotoAction` | via imported `PhotoDropzone` which calls `addWatchPhotoAction` | WIRED | PhotoDropzone imported at line 25; userId prop at line 87 |
| `src/app/page.tsx` | `signCoverUrls` | `await signCoverUrls(watchesRaw)` | WIRED | Lines 5, 37 |
| `src/app/u/[username]/[tab]/page.tsx` | `signCoverUrls` | `await signCoverUrls(resolved.watches)` | WIRED | Lines 8, 191 |
| `src/app/u/[username]/profile-shell-resolver.tsx` | `signCoverUrls` | `resolveProfileShellSigned` wrapper outside `'use cache'` scope | WIRED | Lines 11, 71-76 |
| `src/app/search/page.tsx` | `signCoverUrls` | `await signCoverUrls(viewerCollectionRaw)` | WIRED | Lines 9, 55 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WatchPhotoSection` | `photos: SignedPhoto[]` | `getWatchPhotosForWatch(watch.id)` in RSC + `createSignedUrl` loop | Yes — DB query + Supabase signing | FLOWING |
| `WatchPhotoSection.optimisticIds` | `reorderWatchPhotosAction` | `bulkReorderPhotos(user.id, watchId, orderedIds)` in DAL | Yes — DB CASE WHEN rewrite | FLOWING |
| Card thumbnails (home/profile/search) | `watch.imageUrl` | `signCoverUrls(watchesRaw)` → `getSafeImageUrl` in card components | Yes for owner's own grids; null for non-owner viewer of other users' grids (known limitation, WR-01 deferred) | FLOWING (with documented limitation) |
| `WatchPhotoStep` | `uploadedPhotos` | `PhotoDropzone → uploadWatchPhoto → addWatchPhotoAction` | Yes — client-direct to Supabase + DB row insert | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `watchPhotos` server action suite | `npx vitest run tests/actions/watchPhotos.test.ts` | 23/23 passed (9ms) | PASS |
| `signCoverUrls` unit tests | `npx vitest run tests/lib/signCoverUrls.test.ts` | 7/7 passed (3ms) | PASS |
| WatchPhotoSection UI tests | `npx vitest run tests/components/watch-photo-section.test.tsx` | 15/15 passed (159ms) | PASS |
| PhotoDropzone upload tests | `npx vitest run tests/components/photo-uploader.test.tsx` | 9/9 passed (90ms) | PASS |
| Add-watch flow photos tests | `npx vitest run tests/components/add-watch-flow-photos.test.tsx` | 7/7 passed (92ms) | PASS |
| Build gate | `npm run build` | exit 0 (`✓ Compiled successfully in 5.3s`) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PHOTO-02 | Plans 01, 02 | A user can upload one or more photos to a watch they own | SATISFIED | `addWatchPhotoAction` + `PhotoDropzone` pipeline (HEIC, stripAndResize, uploadWatchPhoto, sequential processing, cap enforcement); ownership re-verified server-side via `watches.user_id`; 9 upload tests pass |
| PHOTO-03 | Plan 02 | Photos display in a carousel showing one photo at a time, navigable by arrows and swipe | SATISFIED (structural) | `useEmblaCarousel` + ChevronLeft/ChevronRight arrows + position indicator + filmstrip tap-to-jump; iOS swipe is human_needed |
| PHOTO-05 | Plans 01, 02, 04 | A user can reorder photos by drag-and-drop; reordering sets the cover/thumbnail | SATISFIED (structural / owner-view) | `horizontalListSortingStrategy` + `reorderWatchPhotosAction` + `signCoverUrls` in 4 RSCs; Cover badge on optimisticIds[0]; non-owner cover signing limitation documented (WR-01, deferred Phase 62) |
| PHOTO-06 | Plans 01, 02 | A user can delete an individual photo from a watch they own | SATISFIED | `deleteWatchPhotoAction` + 5s undo window + CR-01/WR-02 fixes (unmount cleanup + startTransition wrapping); delete tests pass |
| PHOTO-09 | Plan 03 | The add-watch flow strongly encourages photo upload via a prominent (not buried) affordance | SATISFIED (structural) | `photos-pending` FlowState; `onWatchCreated` on both URL-extract and manual-entry paths; `WatchPhotoStep` heading "Add your photos" + `PhotoDropzone` + "Skip for now" plain button; visual prominence is human_needed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/watch/WatchPhotoStep.tsx` | 127 | `onClick={hasPrimary ? onDone : undefined}` — primary "Add photos" button is non-functional (click does nothing) at 0-uploads state | INFO | The button reads "Add photos" but clicking it does nothing; the functional upload affordance is the `PhotoDropzone` above. This is a minor UX gap: users clicking the big button at 0-upload state get no response. SUMMARY acknowledges this as intentional ("button is a visible affordance above the dropzone, not a duplicate trigger"). The PhotoDropzone text "Drop photos here or tap to choose" is the functional interaction. Classified INFO, not BLOCKER — the upload path works, but the primary CTA is misleadingly non-functional. |
| `src/app/search/page.tsx` | 55, 61 | `signCoverUrls(viewerCollectionRaw)` signed but only `.length` passed to client | INFO | Search result cards for OTHER users' watches carry raw storage paths (from search.ts line 244); they go through `getSafeImageUrl` → null → placeholder. Only the viewer's own collection is signed, and only `.length` is used. This is a known limitation acknowledged in Plan 04 scope. Not a security issue (raw paths render as placeholders, not exposed strings). |

No TBD, FIXME, or XXX debt markers found in any phase-modified file.

### Human Verification Required

#### 1. iOS Carousel Swipe Navigation

**Test:** On prod iPhone, open `/w/[ref]` for a watch with 2+ owner photos. Swipe left/right between photos. Then tap "Edit photos" and confirm swipe is disabled during edit mode (filmstrip drag takes priority).
**Expected:** Smooth carousel swipe in view mode; swipe does not interfere with filmstrip drag in edit mode.
**Why human:** embla `watchDrag: !editMode` toggle is in code, but iOS Safari gesture coexistence with dnd-kit TouchSensor requires live device confirmation (MEMORY `feedback_mobile_ui_verify_on_prod`).

#### 2. Touch Drag-Reorder (Cover Badge + Grid Thumbnail)

**Test:** On prod iPhone, tap "Edit photos" on a watch with 2+ photos. Long-press-drag a non-cover thumbnail to the first position. Confirm the "Cover" badge moves to it and an "Order updated" toast fires. Navigate to your profile grid and confirm that watch's card thumbnail now shows the new cover photo.
**Expected:** Drag succeeds; Cover badge moves; toast fires; grid thumbnails update after navigation.
**Why human:** dnd-kit TouchSensor (250ms delay, tolerance 8) gesture behavior on iOS Safari requires live confirmation; `touchAction: 'manipulation'` is in code but must be verified with actual touch events.

#### 3. OS Photo Picker (Camera-or-Library)

**Test:** On prod iPhone, tap "+Add" in edit mode on the detail page. Confirm the OS picker offers BOTH camera and library options (no forced camera).
**Expected:** Standard OS photo picker sheet with both options; no `capture` attribute forcing camera-only.
**Why human:** `accept="image/*,.heic,.heif"` without `capture` attribute is in `PhotoDropzone` code, but OS picker presentation depends on mobile browser implementation.

#### 4. "Skip for now" Visual Prominence / Friction

**Test:** On prod mobile, add a watch via URL import. When the "Add your photos" step appears, assess: (a) the heading "Add your photos" reads as a first-class step; (b) "Skip for now" is clearly smaller and lower-contrast than the primary "Add photos" Button; (c) "Skip for now" successfully navigates to the destination without blocking.
**Expected:** Clear visual hierarchy — primary button is prominent, "Skip for now" is visually subordinate; skip always works.
**Why human:** Visual hierarchy judgment requires human evaluation on device; code confirms `<button class="text-muted-foreground">` vs `<Button variant="default">` but visual weight is design judgment.

#### 5. Stale-Instance Reset on /w/[ref] Revisit

**Test:** On prod mobile, navigate to `/w/[ref]`, enter Edit mode, navigate away (back button or home), then navigate back to the same `/w/[ref]`. Confirm Edit mode is reset to off and the carousel is usable without a page reload.
**Expected:** Edit mode resets on each visit; no stale drag state persists across navigations.
**Why human:** Next 16 Router Cache stale-instance behavior (MEMORY `project_router_cache_stale_instance`) only manifests on revisited dynamic URLs in a running session; `onPointerDown` reset is in code but requires prod verification.

### Documented Limitation (WR-01 — Deferred)

Non-owner viewers of another user's profile grid or search results see placeholder thumbnails (not the owner's uploaded cover photos) because `signCoverUrls` uses the viewer's session — storage RLS scopes `SELECT` to the file owner's folder, so signing fails for files owned by another user. This fails safe (placeholder, no raw path in markup). Public-photo surfacing is deferred to Phase 62's consent model. The limitation is documented in the code comments at `/w/[ref]/page.tsx` and `[tab]/page.tsx`.

This is NOT a gap for this phase's success criteria — SC3 specifies "makes it the card thumbnail across grids" which is fully observable by the owner viewing their own grids (home + own profile). The limitation affects viewers of another user's grids, which is Phase 62 scope.

### Gaps Summary

No structural gaps. All 5 success criteria are verified in the codebase with substantive, wired implementations. Five device-behavior items are routed to human verification on prod per the established project pattern (MEMORY `feedback_mobile_ui_verify_on_prod`). These are not failures — they are standard gate items for this project's verification model.

**Note on "Add photos" button:** The primary CTA reads "Add photos" at 0-uploads state but has `onClick={undefined}`. The functional upload path is the PhotoDropzone above it. This is a minor UX issue (button is non-responsive on click in 0-upload state) but does not block the phase goal — the upload works through the dropzone, which is clearly labeled "Drop photos here or tap to choose". The SUMMARY documents this as intentional.

---

_Verified: 2026-05-25T22:00:00Z_
_Verifier: Claude (gsd-verifier)_

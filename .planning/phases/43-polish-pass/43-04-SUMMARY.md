---
phase: "43"
plan: "04"
subsystem: profile
tags: [avatar-upload, supabase-storage, react-easy-crop, exif-strip, rls, tdd]
dependency_graph:
  requires:
    - 43-01 (FilterDrawer migration, PLSH-01/02)
    - 43-02 (ProfileWatchCard layout, PLSH-03/04)
    - 43-03 (add-watch button, PLSH-05)
  provides:
    - avatars Supabase Storage bucket + 3 folder-scoped RLS policies
    - avatarPhotos.ts: buildAvatarPath + uploadAvatarPhoto helper
    - AvatarUploader component with circular crop pipeline
    - ProfileEditForm with avatar-URL field dropped (D-10)
  affects:
    - src/components/profile/ProfileEditForm.tsx (avatar-URL field removed)
    - src/components/profile/ProfileHeader.tsx (userId prop threaded)
tech_stack:
  added:
    - react-easy-crop@^5.5.7 (circular crop with cropShape="round")
  patterns:
    - Supabase Storage public bucket + RLS folder enforcement
    - canvas crop → stripAndResize → uploadAvatarPhoto → updateProfile pipeline
    - TDD RED/GREEN commit sequence for AvatarUploader
key_files:
  created:
    - supabase/migrations/20260516000000_phase43_avatar_bucket.sql
    - src/lib/storage/avatarPhotos.ts
    - src/components/profile/AvatarUploader.tsx
    - tests/components/profile/AvatarUploader.test.tsx
  modified:
    - src/components/profile/ProfileEditForm.tsx
    - src/components/profile/ProfileHeader.tsx
    - package.json
    - package-lock.json
decisions:
  - "Avatar bucket is public (not private with signed URLs) — permanent CDN URLs for stable avatar display"
  - "stripAndResize(maxDim=512) — 2x retina quality for largest avatar display size (96px)"
  - "upsert:true for avatar uploads — one file per user, replaced in place"
  - "AvatarUploader saves avatar itself via updateProfile; form Save button covers displayName+bio only"
metrics:
  duration: "~30 minutes (Tasks 3-5; Tasks 1-2 in prior wave)"
  completed: "2026-05-17"
  tasks_completed: 5
  files_changed: 8
---

# Phase 43 Plan 04: Avatar Upload with Circular Crop Summary

Avatar upload with interactive circular crop replacing the avatar-URL text field — react-easy-crop pipeline with EXIF strip, Supabase Storage public bucket, and folder-scoped RLS policies.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Write avatars Storage bucket migration | efa0b4f | Complete (prior wave) |
| 2 | [BLOCKING] Apply avatar bucket migration | checkpoint cleared | Complete (prior wave) |
| 3 | Install react-easy-crop + create avatarPhotos.ts | 67c49e4 | Complete |
| 4 | Create AvatarUploader component (TDD RED/GREEN) | 94bad9f (RED), 3cea1c0 (GREEN) | Complete |
| 5 | Wire AvatarUploader into ProfileEditForm | 55104e7 | Complete |

## What Was Built

**Task 3 — avatarPhotos.ts + react-easy-crop install:**
- `npm install react-easy-crop@^5.5.7` — compatible with installed React 19.2.4
- `src/lib/storage/avatarPhotos.ts`: `buildAvatarPath(userId)` returns `{userId}/avatar.jpg`; `uploadAvatarPhoto(userId, jpeg)` uploads with `upsert:true` and returns `{ publicUrl }` from `getPublicUrl` (no signed URL — bucket is public)

**Task 4 — AvatarUploader component (TDD):**
- RED commit: 4 failing tests covering all behaviors before component exists
- GREEN commit: component implementation makes all 4 pass
- `src/components/profile/AvatarUploader.tsx` (`'use client'`):
  - State A (idle): circular 64px avatar preview or placeholder + "Upload photo" outline button
  - 8 MB guard → "Photo too large. Maximum size is 8 MB." inline error, no crop UI shown
  - HEIC conversion (Worker) → set `imageSrc` object URL for crop
  - State B (crop): `<Cropper cropShape="round" aspect={1} showGrid={false}>` in `h-[300px] bg-black` container
  - `onCropComplete(_, areaPixels)` stores second argument (pixels, not percentages — Pitfall 3 avoided)
  - Confirm crop: `getCroppedBlob` → lazy `stripAndResize(raw, 512)` → `uploadAvatarPhoto(userId, jpeg)` → `updateProfile({ avatarUrl })` → `toast.success('Profile photo updated')`
  - Upload failure: "Upload failed. Please try again." inline error, `updateProfile` not called
  - Object-URL revoke `useEffect` cleanup on `imageSrc` change

**Task 5 — ProfileEditForm + ProfileHeader:**
- `ProfileEditForm.tsx`: removed `avatarUrl` useState, removed "Avatar URL" `<Input type="url">` block, removed `trimmedAvatar` from `handleSave`, added `userId: string` to `ProfileEditFormProps`, inserted `<AvatarUploader>` in place of URL field
- `ProfileHeader.tsx`: passes `userId={props.targetUserId}` to `<ProfileEditForm>` (`targetUserId` already in scope as the profile owner's user ID)

## Success Criteria Verification

- [x] User can pick a profile photo from their device (file input triggers, HEIC supported)
- [x] User drags/zooms under a circular mask (`cropShape="round"`)
- [x] Cropped square JPEG stored in `avatars` Supabase Storage bucket (public, upsert:true)
- [x] Avatar URL written to profile via `updateProfile` Server Action
- [x] Avatar-URL text field gone from ProfileEditForm (D-10)
- [x] `npm test -- AvatarUploader` — 4/4 tests pass
- [x] `npx tsc --noEmit` — no new errors (pre-existing test-file errors not introduced by this plan)
- [x] `npm run build` — compiled successfully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cropper mock caused infinite render loop in test**
- **Found during:** Task 4 RED phase (tests failed with "Maximum update depth exceeded")
- **Issue:** Test mock called `onCropComplete` synchronously in the render function body, triggering `setCroppedAreaPixels` → re-render → mock re-fires infinitely
- **Fix:** Changed mock to use `useEffect(() => { onCropComplete(...) }, [])` — fires once after mount
- **Files modified:** `tests/components/profile/AvatarUploader.test.tsx`

**2. [Rule 1 - Bug] HTMLCanvasElement.getContext type cast error**
- **Found during:** Task 4 tsc verification
- **Issue:** `getContext` mock returning `{ drawImage, fillRect, clearRect }` cast as `CanvasRenderingContext2D` caused TS error (`transferFromImageBitmap` missing)
- **Fix:** Changed to `(HTMLCanvasElement.prototype as any).getContext = ...` to avoid overload type conflict
- **Files modified:** `tests/components/profile/AvatarUploader.test.tsx`

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model covers. The threat register (T-43-05 through T-43-10) covers all surfaces: folder-scoped RLS, canvas re-encode, EXIF strip, size guard, content-type enforcement, and public-bucket acceptance.

## Known Stubs

None — all data flows are wired end-to-end. The `onUploadComplete={() => {}}` callback in `ProfileEditForm` is intentional: the avatar is saved immediately by `AvatarUploader.handleConfirmCrop` via `updateProfile`, so the parent form does not need to act on the URL.

## Self-Check: PASSED

Files created/present:
- `src/lib/storage/avatarPhotos.ts` — FOUND
- `src/components/profile/AvatarUploader.tsx` — FOUND
- `tests/components/profile/AvatarUploader.test.tsx` — FOUND

Commits present:
- `67c49e4` (Task 3) — FOUND
- `94bad9f` (Task 4 RED) — FOUND
- `3cea1c0` (Task 4 GREEN) — FOUND
- `55104e7` (Task 5) — FOUND

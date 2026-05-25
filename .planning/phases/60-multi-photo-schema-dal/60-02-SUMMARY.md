---
phase: 60-multi-photo-schema-dal
plan: "02"
subsystem: storage-helper
tags: [storage, photos, exif, testing, tdd]
dependency_graph:
  requires: []
  provides:
    - src/lib/storage/watchPhotos.ts (buildWatchPhotoPath + uploadWatchPhoto)
    - tests/unit/lib/storage/watchPhotos.test.ts (path-builder unit coverage)
    - tests/unit/lib/exif/stripAndResize.test.ts (SC4 EXIF pipeline verification)
  affects:
    - Phase 61 upload UI (will call uploadWatchPhoto)
tech_stack:
  added: []
  patterns:
    - client-direct upload helper mirroring wearPhotos.ts (D-15)
    - UUID path validation with TypeError throws (T-60-TRAVERSAL mitigation)
    - canvas-stub test infrastructure reuse (no new deps, D-16)
key_files:
  created:
    - src/lib/storage/watchPhotos.ts
    - tests/unit/lib/storage/watchPhotos.test.ts
    - tests/unit/lib/exif/stripAndResize.test.ts
  modified: []
decisions:
  - Option B for SC4 test — created dedicated tests/unit/lib/exif/stripAndResize.test.ts for phase60 traceability rather than citing the existing tests/lib/exif-strip.test.ts
  - WatchPhotoUploadResult type name (distinct from wearPhotos UploadResult to avoid collision)
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 60 Plan 02: Watch-Photos Storage Helper + SC4 Verification Summary

**One-liner:** watch-photos client upload helper mirroring wearPhotos.ts with UUID path validation, plus phase60-scoped SC4 EXIF/≤1080px pipeline traceability test using canvas-stub infrastructure.

## What Was Built

### Task 1: watch-photos storage helper (TDD — RED/GREEN)

Created `src/lib/storage/watchPhotos.ts` as a verbatim mirror of `src/lib/storage/wearPhotos.ts` with substituted bucket name and ID semantics:

- `buildWatchPhotoPath(userId, photoId)` — returns `{userId}/{photoId}.jpg`; throws `TypeError('userId required')` on falsy userId; throws `TypeError('photoId must be a UUID')` when photoId fails `/^[0-9a-f-]{36}$/i` (T-60-TRAVERSAL path-traversal mitigation)
- `uploadWatchPhoto(userId, photoId, jpeg)` — client-direct upload to `watch-photos` bucket with `upsert: false` (T-60-UPSERT), returns `{ path }` on success, `{ error }` on failure
- `WatchPhotoUploadResult` type (distinct from wearPhotos `UploadResult` to avoid name collision on import)
- `BUCKET_ID = 'watch-photos' as const`

Unit test `tests/unit/lib/storage/watchPhotos.test.ts` mirrors `tests/lib/storage-path.test.ts`:
- 7 cases: valid path, uppercase hex UUID, empty userId throws, non-UUID throws, non-hex UUID throws, no-dashes 32-char throws, first-segment-equals-userId RLS contract

### Task 2: SC4 EXIF/≤1080px pipeline verification test

Created `tests/unit/lib/exif/stripAndResize.test.ts` with `// @vitest-environment jsdom` (stripAndResize calls `document.createElement('canvas')`).

Three SC4 contracts verified:
- **SC4-a:** `result.blob.type === 'image/jpeg'` — canvas.toBlob is the EXIF-strip mechanism
- **SC4-b:** `Math.max(result.width, result.height) <= 1080` for 3000×2000 source (→ 1080×720)
- **SC4-c:** EXIF GPS stripped by re-encode — canvas.toBlob output has no EXIF path (T-60-EXIF)

Reuses canvas-stub infrastructure (`vi.mock('exifr/dist/lite.esm.js', ...)`, `stubCreateImageBitmap`, `stubCanvasToBlob`, `stubGetContext`) from `tests/lib/exif-strip.test.ts`. No new npm dependencies added. `src/lib/exif/strip.ts` unchanged (D-16).

## Verification Results

```
npx vitest run tests/unit/lib/storage/watchPhotos.test.ts
  ✓ 7 tests passed

npx vitest run tests/unit/lib/exif/stripAndResize.test.ts
  ✓ 3 tests passed

canvas NOT in package.json: PASS
src/lib/exif/strip.ts unmodified: PASS
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new threat surface beyond what the plan's threat model already covers:
- T-60-TRAVERSAL: mitigated by UUID_RE validation in buildWatchPhotoPath
- T-60-EXIF: mitigated by SC4 verification test pinning the re-encode invariant
- T-60-UPSERT: mitigated by upsert:false in uploadWatchPhoto

## Commits

- `e155f21` — test(60-02): add failing test for watch-photos storage path builder (RED)
- `9d80fa6` — feat(60-02): implement watch-photos storage helper (PHOTO-08 / D-15) (GREEN)
- `3563b4b` — feat(60-02): add SC4 EXIF/≤1080px pipeline verification test (PHOTO-08 / T-60-EXIF)

## Self-Check: PASSED

- FOUND: src/lib/storage/watchPhotos.ts
- FOUND: tests/unit/lib/storage/watchPhotos.test.ts
- FOUND: tests/unit/lib/exif/stripAndResize.test.ts
- FOUND commit: e155f21 (RED test)
- FOUND commit: 9d80fa6 (GREEN implementation)
- FOUND commit: 3563b4b (SC4 EXIF test)

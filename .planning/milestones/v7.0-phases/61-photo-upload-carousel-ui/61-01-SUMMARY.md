---
phase: 61-photo-upload-carousel-ui
plan: "01"
subsystem: server-actions
tags: [server-actions, dal, testing, photo-management]
dependency_graph:
  requires: [phase-60-photo-schema-dal]
  provides: [getWatchPhotosForWatch, addWatchPhotoAction, deleteWatchPhotoAction, reorderWatchPhotosAction, wave-0-test-scaffolds]
  affects: [plans-02-03-carousel-add-flow]
tech_stack:
  added: []
  patterns: [zod-strict-mass-assignment-guard, instanceof-error-discrimination, revalidatePath-route-template]
key_files:
  created:
    - src/app/actions/watchPhotos.ts
    - tests/actions/watchPhotos.test.ts
    - tests/components/watch-photo-section.test.tsx
    - tests/components/photo-uploader.test.tsx
    - tests/components/add-watch-flow-photos.test.tsx
  modified:
    - src/data/watches.ts
decisions:
  - "vi.hoisted() required for error mock classes in vitest — vi.mock factories are hoisted before top-level let/const initialization; error class stubs must live inside vi.hoisted() to be available when mock factory runs"
  - "getWatchPhotosForWatch has no userId param — ownership framing handled by RSC before calling; pure read by watchId matches PATTERNS.md §getWatchPhotosForWatch"
  - "revalidatePath('/w/[ref]', 'page') route template (not concrete URL) mirrors reorderWishlist pattern per RESEARCH Pitfall 8"
metrics:
  duration: 7 minutes
  completed: 2026-05-25
---

# Phase 61 Plan 01: Server Actions Foundation Summary

**One-liner:** DAL read `getWatchPhotosForWatch` + three photo server actions (add/delete/reorder) with zod `.strict()`, instanceof error discrimination, and `revalidatePath('/w/[ref]', 'page')` — plus Wave 0 test scaffolds for plans 02/03.

## What Was Built

### Task 1: Wave 0 Test Scaffolds (TDD RED gate)

Four test files created:

1. **`tests/actions/watchPhotos.test.ts`** — Full PHOTO-02/05/06 server-action coverage (20 tests): authentication gate, zod `.strict()` mass-assignment rejection (extra keys, empty values, oversized arrays), `OwnerMismatchError` / `SetMismatchError` / `PhotoCapExceededError` instanceof discrimination, `revalidatePath('/w/[ref]', 'page')` assertion, session userId vs client payload verification.

2. **`tests/components/watch-photo-section.test.tsx`** — Wave 0 scaffold (7 placeholder tests) for PHOTO-03/05/06 carousel + filmstrip + delete behaviors; to be populated in Plan 02.

3. **`tests/components/photo-uploader.test.tsx`** — Wave 0 scaffold (7 placeholder tests) for PHOTO-02 cap enforcement + upload pipeline; to be populated in Plan 02.

4. **`tests/components/add-watch-flow-photos.test.tsx`** — Wave 0 scaffold (4 placeholder tests) for PHOTO-09 state-machine transitions; to be populated in Plan 03.

### Task 2: DAL Read + Server Actions (TDD GREEN gate)

**`src/data/watches.ts`** extended with `getWatchPhotosForWatch(watchId)`:
- Pure SELECT returning `{id, storagePath, sortOrder}[]` ordered by `asc(watchPhotos.sortOrder)`
- Reuses already-imported `asc`, `eq`, `watchPhotos` from drizzle-orm / schema
- No `userId` param — ownership resolved by RSC that confirmed viewer access

**`src/app/actions/watchPhotos.ts`** (new file, 3 actions, mirrors `reorderWishlist` exactly):

| Action | Schema | Error Classes | Returns |
|--------|--------|--------------|---------|
| `reorderWatchPhotosAction` | `{watchId: uuid, orderedIds: uuid[1..10]}.strict()` | OwnerMismatchError, SetMismatchError | `ActionResult<void>` |
| `addWatchPhotoAction` | `{watchId: uuid, storagePath: string(1+)}.strict()` | PhotoCapExceededError | `ActionResult<{ id: string }>` |
| `deleteWatchPhotoAction` | `{watchId: uuid, photoId: uuid}.strict()` | generic Error | `ActionResult<void>` |

All three: `getCurrentUser()` try/catch → zod safeParse → DAL call → `revalidatePath('/w/[ref]', 'page')` on success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest hoisting order — error mock classes**
- **Found during:** Task 1 verification (server-action test was failing with `ReferenceError: Cannot access 'realPhotoCapExceededError' before initialization`)
- **Issue:** vitest hoists `vi.mock()` factories to top of file; top-level `const` declarations for the mock error classes were not yet initialized when the factory ran
- **Fix:** Moved error class definitions into `vi.hoisted()` callback so they are available when mock factory executes; used `MockPhotoCapExceededError`, `MockOwnerMismatchError`, `MockSetMismatchError` naming
- **Files modified:** `tests/actions/watchPhotos.test.ts`
- **Commit:** b67fa2a (included in Task 2 commit since test file was re-staged)

## Known Stubs

None — server actions are fully implemented, not stubbed. UI test scaffolds are intentionally placeholder (Wave 0 pattern), annotated with the VALIDATION.md behaviors they will assert in Plans 02/03.

## Threat Flags

No new threat surface. All STRIDE threats mitigated as planned:
- T-61-01/02: ownership via `user.id` from session + DAL `watches.user_id` guard
- T-61-03: zod `.strict()` on all three action schemas
- T-61-04: `MAX_PHOTOS_PER_WATCH=10` cap in DAL; `orderedIds.max(10)` in reorder schema
- T-61-05: `storagePath` not accepted in `addWatchPhotoAction` (path already uploaded; sort_order computed server-side in DAL)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/app/actions/watchPhotos.ts` | FOUND |
| `src/data/watches.ts` contains `getWatchPhotosForWatch` | FOUND |
| `tests/actions/watchPhotos.test.ts` | FOUND |
| `tests/components/watch-photo-section.test.tsx` | FOUND |
| `tests/components/photo-uploader.test.tsx` | FOUND |
| `tests/components/add-watch-flow-photos.test.tsx` | FOUND |
| Commit `6be56c1` (test RED gate) | FOUND |
| Commit `b67fa2a` (feat GREEN gate) | FOUND |

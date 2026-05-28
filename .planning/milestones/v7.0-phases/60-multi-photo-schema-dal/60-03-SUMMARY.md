---
phase: 60-multi-photo-schema-dal
plan: "03"
subsystem: dal-watch-photos
tags: [dal, drizzle, cover-resolution, photo-cap, storage-purge, blast-radius]
dependency_graph:
  requires: [60-01-watch-photos-schema, 60-02-storage-helper]
  provides: [cover-resolving-reads, addWatchPhoto, bulkReorderPhotos, deleteWatchPhoto, purgeWatchPhotos]
  affects:
    - src/data/watches.ts
    - src/lib/types.ts
    - src/app/actions/comments.ts
    - src/app/actions/wishlist.ts
    - src/app/actions/account.ts
    - src/app/actions/watches.ts
    - src/data/wearEvents.ts
    - src/data/search.ts
tech_stack:
  added: []
  patterns:
    - correlated-cover-subquery-in-drizzle-select
    - cap-enforced-insert-with-count-check
    - case-when-bulk-reorder (watch_photos analog of bulkReorderWishlist)
    - db-first-storage-purge (query storagePaths then storage.remove)
    - purge-before-delete ordering (T-60-ORPHAN)
key_files:
  modified:
    - src/data/watches.ts
    - src/lib/types.ts
    - src/app/actions/comments.ts
    - src/app/actions/wishlist.ts
    - src/app/actions/account.ts
    - src/app/actions/watches.ts
    - src/data/wearEvents.ts
    - src/data/search.ts
decisions:
  - "Cover subquery uses raw SQL string references (wp.storage_path FROM watch_photos wp) not Drizzle watchPhotos object — avoids needing to import watchPhotos in every repoint site"
  - "purgeWatchPhotos exported from account.ts (where purgeWearPhotos lives) for co-location with the pattern analog; watches.ts imports it"
  - "ActivityRow components confirmed benign (read from stored jsonb metadata.imageUrl via getSafeImageUrl, no watches table join) — no code change needed"
metrics:
  duration: "6m 20s"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 0
  files_modified: 8
---

# Phase 60 Plan 03: DAL Cover Resolution + Blast-Radius Repoint Summary

**One-liner:** Cover-resolving DAL (correlated watch_photos subquery across all 3 read paths) + 10-photo cap enforcement + storage purge hook + full image_url blast-radius repoint so the dropped column does not break runtime queries.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Cover resolution across all 3 read paths + WatchPhoto type | 108a3a5 | src/data/watches.ts, src/lib/types.ts |
| 2 | addWatchPhoto (cap + ownership), bulkReorderPhotos, deleteWatchPhoto | ec179df | src/data/watches.ts |
| 3 | Repoint all direct watches.image_url read sites + purgeWatchPhotos | 16f6bad | 6 files |

## What Was Built

**Task 1 — Cover resolution + WatchPhoto type:**
- Added `watchPhotos` to `@/db/schema` import in `src/data/watches.ts`
- Removed `imageUrl: row.imageUrl ?? undefined` from `mapRowToWatch` (column dropped in Phase 60-01)
- Removed `if ('imageUrl' in data) row.imageUrl = data.imageUrl ?? null` from `mapDomainToRow`
- `getWatchesByUser`: added correlated cover subquery + `catalogImageUrl` to `.select()`; post-map override `imageUrl: coverStoragePath ?? (catalogImageUrl ?? undefined)` (D-04/D-05/D-06)
- `getWatchById`: added catalog `leftJoin` (previously absent) + cover subquery + imageUrl override
- `getWatchByIdForViewer`: added catalog `leftJoin` + cover subquery + imageUrl override
- `src/lib/types.ts`: added `export interface WatchPhoto { id, watchId, storagePath, sortOrder, createdAt }`. `Watch.imageUrl?: string` preserved exactly (D-08)

**Task 2 — DAL write functions:**
- `MAX_PHOTOS_PER_WATCH = 10` — canonical constant at the DAL enforcement site (D-12)
- `PhotoCapExceededError` class — typed error with `cap: number` field (D-13)
- `addWatchPhoto(userId, watchId, storagePath)`: (1) ownership check `watches.id=watchId AND user_id=userId`; (2) cap check `count(watch_photos) >= 10` → throw `PhotoCapExceededError`; (3) `coalesce(max(sortOrder), -1)+1` for next sort; (4) insert + return (T-60-XTENANT, T-60-CAP, D-14)
- `bulkReorderPhotos(userId, watchId, orderedIds)`: ownership check → `SetMismatchError` if count mismatch → CASE WHEN bulk UPDATE → `OwnerMismatchError` on row-count mismatch (T-60-REORDER, D-03)
- `deleteWatchPhoto(userId, watchId, photoId)`: ownership check → delete → throw if not found

**Task 3 — Blast-radius repoint + storage purge:**
- `src/app/actions/comments.ts`: both `imageUrl: watches.imageUrl` SELECT sites replaced with cover subquery (watch-target ~line 82 and wear-target parent-watch ~line 107); added `sql` to drizzle-orm import
- `src/app/actions/wishlist.ts`: `imageUrl: watches.imageUrl` in `addToWishlistFromWearEvent` replaced with cover subquery; added `sql` to import
- `src/data/wearEvents.ts`: all 4 sites replaced — `watchImageUrl: watches.imageUrl` in `getWearEventForViewer`, `imageUrl: watches.imageUrl` in `getWearRailForViewer`, `watchImageUrl: watches.imageUrl` in `getActiveWearsForUser` self-bypass branch and non-owner branch
- `src/data/search.ts`: `w.image_url` in `WITH matched` CTE replaced with correlated subquery `(SELECT wp.storage_path FROM watch_photos wp WHERE wp.watch_id = w.id ORDER BY wp.sort_order ASC LIMIT 1) AS image_url`; downstream `'image_url', m.image_url` in `jsonb_build_object` references CTE alias and is unchanged
- `src/app/actions/account.ts`: added `purgeWatchPhotos(supabase, watchId)` — DB-first: query `watchPhotos` storagePaths then `storage.from('watch-photos').remove(paths)`; early-return on empty; added watch-photos bucket sweep to `wipeCollection` (paginated list+remove loop)
- `src/app/actions/watches.ts`: imported `createSupabaseServerClient` and `purgeWatchPhotos`; `removeWatch` now calls `await purgeWatchPhotos(supabase, watchId)` BEFORE `await watchDAL.deleteWatch(...)` (T-60-ORPHAN)

**Integration test (SC2/SC3/cross-tenant — all 7 tests pass):**
- SC1 (schema assertions): PASS (from Plan 01)
- SC2a: watch with `watch_photos` row at sort_order=0 resolves `imageUrl` to storage_path (cover wins)
- SC2b: watch with NO watch_photos but catalog imageUrl resolves to catalog fallback
- SC3: inserting 10 photos then attempting 11th throws `PhotoCapExceededError`
- Cross-tenant: `addWatchPhoto` for another user's watch throws `/access denied|not found/i`

## Deviations from Plan

### Auto-handled Issues

None — plan executed exactly as written.

### Activity Renderer Confirmation (Discretion Call #3)

`src/components/home/ActivityRow.tsx` (line 33) and `src/components/home/AggregatedActivityRow.tsx` (line 31) both read `metadata.imageUrl` from stored jsonb via `getSafeImageUrl` — confirmed no `watches` table join. These renderers are display-only and fully benign after the column drop. No code change needed; result documented here per plan.

## Known Stubs

None. All watch-read paths now resolve `imageUrl` from `watch_photos` or the catalog fallback. Phase 61 will sign the raw `storagePath` values for display; this plan intentionally returns raw paths (D-04/D-06 decision).

## Threat Surface Scan

No new threat surface identified. All threats from the plan's threat model are now mitigated:

| Threat | Mitigation | Commit |
|--------|-----------|--------|
| T-60-XTENANT | Ownership check `watches.id=watchId AND user_id=userId` before every mutation | ec179df |
| T-60-CAP | `count(watch_photos)::int >= MAX_PHOTOS_PER_WATCH` before insert; counts watch_photos only | ec179df |
| T-60-REORDER | SetMismatchError + OwnerMismatchError in bulkReorderPhotos | ec179df |
| T-60-ORPHAN | purgeWatchPhotos runs BEFORE deleteWatch in removeWatch | 16f6bad |
| T-60-DROPBREAK | All direct watches.image_url SELECT sites repointed; tsc --noEmit clean in src/ | 16f6bad |

## Self-Check

### Files Modified

- [x] src/data/watches.ts — FOUND (cover queries + new functions)
- [x] src/lib/types.ts — FOUND (WatchPhoto interface)
- [x] src/app/actions/comments.ts — FOUND (cover subquery repoints)
- [x] src/app/actions/wishlist.ts — FOUND (cover subquery repoint)
- [x] src/data/wearEvents.ts — FOUND (4 cover subquery repoints)
- [x] src/data/search.ts — FOUND (raw SQL cover subquery in CTE)
- [x] src/app/actions/account.ts — FOUND (purgeWatchPhotos + wipeCollection sweep)
- [x] src/app/actions/watches.ts — FOUND (purgeWatchPhotos before deleteWatch)

### Commits Exist

- [x] 108a3a5 — feat(60-03): cover resolution across all 3 read paths + WatchPhoto type
- [x] ec179df — feat(60-03): addWatchPhoto cap + ownership, bulkReorderPhotos, deleteWatchPhoto
- [x] 16f6bad — fix(60-03): repoint all watches.image_url SELECTs + purgeWatchPhotos storage hook

### Verification Gates

- [x] `grep -q "coverStoragePath" src/data/watches.ts` — PASS
- [x] `grep -q "interface WatchPhoto" src/lib/types.ts` — PASS
- [x] `! grep -q "imageUrl: row.imageUrl" src/data/watches.ts` — PASS
- [x] `grep -q "export const MAX_PHOTOS_PER_WATCH = 10"` — PASS
- [x] `grep -q "export async function addWatchPhoto"` — PASS
- [x] `grep -q "export async function bulkReorderPhotos"` — PASS
- [x] No `imageUrl: watches.imageUrl` in comments/wishlist/wearEvents — PASS
- [x] No bare `w.image_url` in search.ts — PASS
- [x] `purgeWatchPhotos` in account.ts — PASS
- [x] `purgeWatchPhotos` in watches.ts — PASS
- [x] purge-before-delete ordering verified via awk — PASS
- [x] `npx tsc --noEmit` — no errors in src/ — PASS
- [x] Integration tests (7/7) — PASS (SC1/SC2/SC3/cross-tenant all green)

## Self-Check: PASSED

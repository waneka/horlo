---
phase: 60-multi-photo-schema-dal
verified: 2026-05-25T11:00:00Z
status: passed
score: 10/10
overrides_applied: 0
---

# Phase 60: Multi-Photo Schema + DAL Verification Report

**Phase Goal:** The database can store multiple ordered photos per per-user watch and the DAL exposes clean CRUD + ordering operations; a lossless backfill of `watches.image_url` into the new `watch_photos` table precedes dropping that column. (Schema + DAL only — no UI.)
**Verified:** 2026-05-25T11:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SC1) | A watch can hold multiple photo rows with explicit ordering; the single-image field is superseded | VERIFIED | `watchPhotos` pgTable in `src/db/schema.ts` (id, watchId, storagePath, sortOrder, createdAt + composite index); `watches` table has no `imageUrl` column; Supabase migration applies lossless backfill then `ALTER TABLE watches DROP COLUMN IF EXISTS image_url` |
| 2 (SC2) | The first/lowest-order photo is used as the cover thumbnail across grids and rails (observable at data layer) | VERIFIED | Cover subquery `(SELECT wp.storage_path FROM watch_photos wp WHERE wp.watch_id = watches.id ORDER BY wp.sort_order ASC LIMIT 1)` present in all 3 read paths (`getWatchesByUser`, `getWatchById`, `getWatchByIdForViewer`) with `imageUrl: coverStoragePath ?? (catalogImageUrl ?? undefined)` override post-map (D-04/D-05/D-06); integration test SC2a/SC2b pass |
| 3 (SC3) | The DAL enforces a per-watch cap of ~10 photos and rejects inserts beyond it | VERIFIED | `export const MAX_PHOTOS_PER_WATCH = 10` in `src/data/watches.ts`; `addWatchPhoto` counts `watch_photos` rows (`count(*)::int >= MAX_PHOTOS_PER_WATCH`) then throws `PhotoCapExceededError` (D-12, D-13, D-14); integration test SC3 passes |
| 4 (SC4) | The photo upload pipeline strips EXIF and re-encodes to ≤1080px JPEG before storage | VERIFIED | `tests/unit/lib/exif/stripAndResize.test.ts` (3 tests, all PASS): SC4-a `result.blob.type === 'image/jpeg'`; SC4-b `Math.max(result.width, result.height) <= 1080` for 3000×2000 source; SC4-c EXIF stripped by re-encode; `src/lib/exif/strip.ts` unmodified (D-16); `canvas` not in `package.json` |
| 5 (SC5) | In-place migration runs cleanly without wiping `watches_catalog` LLM/factual/photo investment | VERIFIED (trivially, per D-10/D-11) | `watches_catalog` table untouched — no `ALTER TABLE watches_catalog` in `supabase/migrations/20260525000000_phase60_watch_photos.sql`; the real lossless-migration assertion (backfill→DO\$\$→drop) applies to `watches.image_url` only; operator confirmed `watches_catalog` row count and `image_url` column unchanged on prod (60-04-SUMMARY) |
| 6 | `watches.image_url` backfill lossless before column drop | VERIFIED | Migration ordering confirmed: `INSERT INTO watch_photos` at line 43, `ALTER TABLE watches DROP COLUMN IF EXISTS image_url` at line 74; pre-drop `DO $$` assertion raises exception if any `image_url` row has no `sort_order=0` watch_photos row; transaction-wrapped (`BEGIN;`/`COMMIT;`); awk check confirms INSERT line 43 < DROP line 74 |
| 7 | `watches_catalog` untouched (D-10) | VERIFIED | No `ALTER TABLE watches_catalog` in the migration; 14 `watchesCatalog` schema references unchanged; `watchesCatalog.imageUrl` at schema line 452 preserved |
| 8 | watch-photos storage bucket with per-user folder RLS exists | VERIFIED | Migration creates `watch-photos` bucket (private, 8MB, image/jpeg + image/png + image/webp) with 4 `storage.objects` folder RLS policies gating on `(storage.foldername(name))[1] = (SELECT auth.uid())::text`; operator confirmed bucket exists on prod |
| 9 | All direct `watches.image_url` read sites (comments, wishlist, wearEvents, search) repointed | VERIFIED | Zero remaining `imageUrl: watches.imageUrl` in comments.ts, wishlist.ts, wearEvents.ts; zero bare `w.image_url` in search.ts; all replaced with cover subquery `SELECT wp.storage_path FROM watch_photos wp ... ORDER BY wp.sort_order ASC LIMIT 1`; build exits 0 (`✓ Compiled successfully in 5.2s`) |
| 10 | `removeWatch` purges watch-photos storage before deleting the DB row | VERIFIED | `purgeWatchPhotos(supabase, watchId)` called at line 478 before `watchDAL.deleteWatch(...)` at line 480 in `src/app/actions/watches.ts`; awk ordering check confirms purge line 478 < delete line 480 (T-60-ORPHAN) |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | watchPhotos pgTable; watches.image_url removed | VERIFIED | `export const watchPhotos = pgTable('watch_photos', ...)` at line 338; no `imageUrl: text('image_url')` in watches table |
| `supabase/migrations/20260525000000_phase60_watch_photos.sql` | DDL: CREATE TABLE + backfill + lossless assert + DROP COLUMN + RLS + bucket | VERIFIED | File exists; contains all required elements; transaction-wrapped; catalog untouched |
| `drizzle/0013_phase60_watch_photos.sql` | Drizzle-tracked column-shape migration (local sync) | VERIFIED | File exists; journal entry `"tag": "0013_phase60_watch_photos"` present |
| `tests/integration/phase60-watch-photos.test.ts` | SC1/SC2/SC3/cross-tenant integration tests | VERIFIED | File exists; first line `// @vitest-environment jsdom`; `DATABASE_URL` guard present; imports `PhotoCapExceededError`, `MAX_PHOTOS_PER_WATCH`, `getWatchesByUser`, `watchPhotos` |
| `src/lib/storage/watchPhotos.ts` | buildWatchPhotoPath + uploadWatchPhoto for watch-photos bucket | VERIFIED | File exists; first line `'use client'`; exports `buildWatchPhotoPath` and `uploadWatchPhoto`; `from('watch-photos')`; `upsert: false` |
| `tests/unit/lib/storage/watchPhotos.test.ts` | Path-builder unit coverage (7 cases) | VERIFIED | File exists; 7 tests all PASS; first-segment-equals-userId RLS contract asserted |
| `tests/unit/lib/exif/stripAndResize.test.ts` | SC4 EXIF pipeline verification (3 contracts) | VERIFIED | File exists; `// @vitest-environment jsdom`; 3 tests all PASS (SC4-a/b/c) |
| `src/data/watches.ts` | Cover-resolving reads + addWatchPhoto + bulkReorderPhotos + deleteWatchPhoto + MAX_PHOTOS_PER_WATCH + PhotoCapExceededError | VERIFIED | All functions present; cover subquery in 3 read paths; mapper repointed; constants/classes exported |
| `src/app/actions/account.ts` | purgeWatchPhotos + wipeCollection watch-photos sweep | VERIFIED | `purgeWatchPhotos` exported at line 62; watch-photos sweep in wipeCollection |
| `src/app/actions/watches.ts` | removeWatch calls purgeWatchPhotos before deleteWatch | VERIFIED | `await purgeWatchPhotos(supabase, watchId)` at line 478 precedes `deleteWatch` at line 480 |
| `src/lib/types.ts` | WatchPhoto domain type; Watch.imageUrl preserved | VERIFIED | `export interface WatchPhoto { id, watchId, storagePath, sortOrder, createdAt }`; `imageUrl?: string` on Watch unchanged (D-08) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/schema.ts watchPhotos` | `watches.id` | `references(() => watches.id, { onDelete: 'cascade' })` | WIRED | Line 342: `uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' })` |
| Supabase migration backfill INSERT | `watch_photos sort_order=0` | `INSERT INTO watch_photos SELECT image_url FROM watches WHERE image_url IS NOT NULL` | WIRED | Line 43–50 of migration; confirmed ordering: INSERT before DROP |
| `getWatchesByUser` cover subquery | `watch_photos` (lowest sort_order) | correlated subquery in `.select()` | WIRED | 3 occurrences of `FROM watch_photos wp WHERE wp.watch_id = watches.id ORDER BY wp.sort_order ASC LIMIT 1` in watches.ts |
| `addWatchPhoto` | `MAX_PHOTOS_PER_WATCH cap` | `count(*) >= MAX_PHOTOS_PER_WATCH` before insert | WIRED | Lines 582–589 of watches.ts: count check → throw `PhotoCapExceededError` |
| `removeWatch` | `purgeWatchPhotos` before `deleteWatch` | storage purge ordering | WIRED | Line 478 (purge) before line 480 (delete); awk confirms ordering |
| `src/lib/storage/watchPhotos.ts uploadWatchPhoto` | `watch-photos` bucket | `supabase.storage.from('watch-photos').upload(path, jpeg, { upsert: false })` | WIRED | `BUCKET_ID = 'watch-photos'`; `from('watch-photos')` in upload call |
| `buildWatchPhotoPath` | `{userId}/{photoId}.jpg` | UUID-validated path build | WIRED | UUID_RE test + `\`${userId}/${photoId}.jpg\`` return; TypeError on invalid input |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/data/watches.ts getWatchesByUser` | `imageUrl` on Watch | Cover subquery → watch_photos.storage_path OR watchesCatalog.imageUrl | Real DB query (correlated subquery, leftJoin) | FLOWING |
| `src/data/watches.ts addWatchPhoto` | `watch_photos` row | DB insert after ownership + cap checks | Real DB insert with returning | FLOWING |
| `src/app/actions/account.ts purgeWatchPhotos` | `storagePaths` | DB-first: `watchPhotos` query then `storage.from('watch-photos').remove(paths)` | Real DB query + storage remove | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Storage helper unit tests (7 cases) | `npx vitest run tests/unit/lib/storage/watchPhotos.test.ts` | 7 tests passed | PASS |
| SC4 EXIF pipeline test (3 contracts) | `npx vitest run tests/unit/lib/exif/stripAndResize.test.ts` | 3 tests passed | PASS |
| canvas NOT a new dependency (D-16) | `node -e "..."` package.json check | canvas not in dependencies/devDependencies | PASS |
| Next.js build succeeds (blast-radius fully repointed) | `npm run build` | `✓ Compiled successfully in 5.2s` | PASS |
| No debt markers in modified files | grep TBD/FIXME/XXX on 10 modified files | Zero matches | PASS |

---

### Probe Execution

Step 7c: No probes declared in PLAN frontmatter. The integration test (`tests/integration/phase60-watch-photos.test.ts`) is gated on `DATABASE_URL` and is skipped without a live local DB. SUMMARY.md documents 7/7 tests passing with DATABASE_URL set; prod verification was operator-run (Plan 04, `checkpoint:human-action`). No conventional `scripts/*/tests/probe-*.sh` files exist for this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PHOTO-01 | 60-01, 60-04 | A watch can hold multiple photos (replacing the single image field) | SATISFIED | `watchPhotos` table + migration + backfill→drop; prod applied (operator-confirmed) |
| PHOTO-04 | 60-03 | The first/cover photo serves as the watch's card thumbnail across grids and rails | SATISFIED | Cover subquery in all 3 read paths; `imageUrl` override in mappers; SC2 integration tests pass |
| PHOTO-07 | 60-03 | A watch enforces a cap of ~10 photos; upload affordance blocked at cap | SATISFIED (DAL half) | `MAX_PHOTOS_PER_WATCH = 10`; `PhotoCapExceededError` thrown at >= 10 rows; upload affordance UI is Phase 61 (by design) |
| PHOTO-08 | 60-02 | Uploaded photos pass through EXIF-strip / ≤1080px JPEG pipeline before storage | SATISFIED | `stripAndResize` reused (D-16); SC4 test pins 3 contracts; storage helper wires to `stripAndResize` via Phase 61 upload UI (pipeline itself verified in this phase) |

All 4 declared requirement IDs (PHOTO-01, PHOTO-04, PHOTO-07, PHOTO-08) accounted for. No orphaned REQUIREMENTS.md requirements mapped to Phase 60 but absent from plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No TBD, FIXME, XXX, placeholder, or stub patterns found in any of the 10 Phase 60 modified source files. No empty implementations. No hardcoded-empty data flowing to rendering.

**Pre-existing test failure note:** `tests/no-raw-palette.test.ts` flags `src/components/comment/CommentGateLocked.tsx` using `font-medium`. This predates Phase 60 (file modified prior to commit 2192a45, the phase-start marker); Phase 60 never touched `CommentGateLocked.tsx`. Not attributable to this phase.

---

### Human Verification Required

None. All must-haves are verifiable from the local codebase plus operator-confirmed prod claims.

The prod-only items (SC1 on prod, SC5 catalog untouched on prod, RLS subquery-caller gotcha non-blocking for owner reads) were verified by the operator during Plan 04 (`checkpoint:human-action`). Per the critical verification notes, these are accepted as operator-verified and not re-testable locally (local DB has RLS OFF on pre-existing tables). The operator typed "approved" after confirming all prod verification queries and the app smoke-check.

---

### Gaps Summary

No gaps. All 10 truths verified. All 11 required artifacts exist and are substantively implemented and wired. All 7 key links confirmed. Build passes. Unit tests pass. No anti-patterns found. Prod migration applied and operator-verified.

---

_Verified: 2026-05-25T11:00:00Z_
_Verifier: Claude (gsd-verifier)_

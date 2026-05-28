---
phase: 60-multi-photo-schema-dal
reviewed: 2026-05-25T12:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/db/schema.ts
  - src/data/watches.ts
  - src/data/wearEvents.ts
  - src/data/search.ts
  - src/app/actions/comments.ts
  - src/app/actions/wishlist.ts
  - src/app/actions/account.ts
  - src/app/actions/watches.ts
  - src/lib/storage/watchPhotos.ts
  - src/lib/types.ts
  - supabase/migrations/20260525000000_phase60_watch_photos.sql
  - tests/integration/phase60-watch-photos.test.ts
  - tests/unit/lib/storage/watchPhotos.test.ts
  - tests/unit/lib/exif/stripAndResize.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-05-25T12:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 60 implements the multi-photo schema (`watch_photos` table), migrates the existing `watches.image_url` column via a backfill+assert+drop sequence, adds a DAL layer for photo CRUD with cap enforcement, and repoints the cover-resolution subquery across six query sites. The core design is sound: the migration transaction ordering is correct (backfill → lossless assert → DROP), the RLS ownership model is consistent with prior tables, the cross-tenant ownership checks are present in all DAL write paths, and all six cover subqueries use properly parameterized Drizzle `sql` template tags with no SQL injection surface.

One critical data-loss issue was found: `deleteAccount` purges wear-photo storage but does NOT purge the `watch-photos` bucket, leaving storage orphans on every account deletion. Three warnings were found: the migration backfill's `ON CONFLICT DO NOTHING` clause is a no-op (no enforcing unique constraint), the `addWatchPhoto` count-then-insert is not atomic (race condition against the soft cap), and `wishlist.ts` passes `imageUrl` to `createWatch` where it is silently discarded by `mapDomainToRow`.

---

## Critical Issues

### CR-01: `deleteAccount` does not purge `watch-photos` storage before deleting the user

**File:** `src/app/actions/account.ts:192-193`

**Issue:** `deleteAccount` calls `purgeWearPhotos(supabase, user.id)` at step 1, then immediately proceeds to `db.delete(users)` at step 2. The `watch-photos` bucket is never purged. When `db.delete(users)` cascades through `watches → watch_photos`, the DB rows are cleaned up, but the physical storage objects under `watch-photos/{userId}/` remain indefinitely — there is no FK from storage to DB to trigger cleanup.

`wipeCollection` (the same file, ~30 lines above) correctly purges both `wear-photos` and `watch-photos` using a paginated list+remove loop. `deleteAccount` replicated the `purgeWearPhotos` call from `wipeCollection` but missed the Phase 60 `watch-photos` block that was added directly inline in `wipeCollection`.

**Fix:** Add the same paginated list+remove loop that `wipeCollection` uses for `watch-photos`, immediately after the `purgeWearPhotos` call and before `db.delete(users)`:

```typescript
// In deleteAccount, after line 193 (purgeWearPhotos call), add:
const PAGE_SIZE = 1000
while (true) {
  const { data: files, error: listErr } = await supabase.storage
    .from('watch-photos')
    .list(user.id, { limit: PAGE_SIZE })
  if (listErr) throw listErr
  if (!files || files.length === 0) break
  const paths = files.map((f) => `${user.id}/${f.name}`)
  const { error: removeErr } = await supabase.storage
    .from('watch-photos')
    .remove(paths)
  if (removeErr) throw removeErr
}
// then: await db.delete(users)...
```

Alternatively, extract a shared `purgeAllUserPhotos(supabase, userId)` helper that both `wipeCollection` and `deleteAccount` call.

---

## Warnings

### WR-01: Migration backfill `ON CONFLICT DO NOTHING` is a no-op — duplicate rows on re-run

**File:** `supabase/migrations/20260525000000_phase60_watch_photos.sql:43-47`

**Issue:** The backfill INSERT at STEP 3 includes `ON CONFLICT DO NOTHING`, and the comment says "idempotent on re-run." However, `watch_photos` has no unique constraint on `(watch_id, sort_order)` — the only unique constraint is the primary key (`id`), which is `gen_random_uuid()`. Since each run generates a fresh UUID for every backfilled row, there can never be a primary key conflict. `ON CONFLICT DO NOTHING` never fires.

On a partial re-run of just the INSERT (before the DROP reaches line 74), every `watches.image_url IS NOT NULL` row would receive a second `sort_order=0` duplicate in `watch_photos`. The lossless assertion at STEP 4 (`NOT EXISTS sort_order=0`) would still pass because a row already exists, but the table would contain duplicate cover rows with the same `sort_order=0` and `watch_id`. This would cause the cover subquery (`ORDER BY sort_order ASC LIMIT 1`) to return an arbitrary one of the duplicates.

Practical risk: low (the whole migration runs inside `BEGIN/COMMIT` and STEP 5 drops `image_url`, making a second run of STEP 3 a syntax error after STEP 5 has already executed). But the claim of idempotency via `ON CONFLICT DO NOTHING` is false and the comment misleads future readers about the table's constraints.

**Fix:** Replace `ON CONFLICT DO NOTHING` with a WHERE NOT EXISTS guard, or add a partial unique index on `(watch_id, sort_order)` first:

```sql
-- Option A: WHERE NOT EXISTS guard (no new constraint needed)
INSERT INTO watch_photos (id, watch_id, storage_path, sort_order, created_at)
SELECT gen_random_uuid(), id, image_url, 0, now()
FROM watches
WHERE image_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM watch_photos wp WHERE wp.watch_id = watches.id AND wp.sort_order = 0
  );

-- Option B: add a unique constraint first, then ON CONFLICT works correctly
-- (adds a UNIQUE constraint on watch_photos before the INSERT)
```

---

### WR-02: `addWatchPhoto` cap check is not atomic — concurrent uploads can exceed `MAX_PHOTOS_PER_WATCH`

**File:** `src/data/watches.ts:582-604`

**Issue:** `addWatchPhoto` performs four sequential round-trips: (1) ownership check, (2) `COUNT(*)` cap check, (3) `MAX(sort_order)` fetch, (4) INSERT. Steps 2–4 are not wrapped in a transaction and have no row-level lock.

If two concurrent calls for the same `watchId` both pass the cap check at step 2 (both observe `current = MAX_PHOTOS_PER_WATCH - 1`), both will insert, pushing the count to `MAX_PHOTOS_PER_WATCH + 1`. The cap is documented as intentionally soft (D-13: "no DB CHECK so it can be tuned via code"), but there is no acknowledgment of this race window in the implementation comments. At the current `MAX_PHOTOS_PER_WATCH = 10`, the maximum over-count from any single race is +1 (two concurrent final uploads).

Additionally, steps 3 and 4 are non-atomic: if another insert occurs between the `MAX(sort_order)` read and the INSERT, two photos can receive the same `sort_order`. The cover subquery (`ORDER BY sort_order ASC LIMIT 1`) is deterministic in this case but the sort order is corrupt.

**Fix:** Wrap steps 2–4 in a transaction, or combine them into a single CTE that reads the count and max together and conditionally inserts:

```typescript
// Atomic option: single CTE INSERT that aborts if at cap
const inserted = await db.execute<typeof watchPhotos.$inferSelect>(sql`
  WITH counts AS (
    SELECT count(*)::int AS c, coalesce(max(sort_order), -1)::int AS max_sort
    FROM watch_photos WHERE watch_id = ${watchId}
  )
  INSERT INTO watch_photos (watch_id, storage_path, sort_order)
  SELECT ${watchId}, ${storagePath}, counts.max_sort + 1
  FROM counts WHERE counts.c < ${MAX_PHOTOS_PER_WATCH}
  RETURNING *
`)
if (!inserted[0]) throw new PhotoCapExceededError(MAX_PHOTOS_PER_WATCH)
return inserted[0]
```

---

### WR-03: `wishlist.ts` passes `imageUrl` to `createWatch` where it is silently discarded

**File:** `src/app/actions/wishlist.ts:160`

**Issue:** `addToWishlistFromWearEvent` resolves the source wear event's watch cover via the Phase 60 correlated subquery (`row.imageUrl`, a raw storage path), then passes it to `createWatch` at line 160: `imageUrl: row.imageUrl ?? undefined`. However, `mapDomainToRow` in `src/data/watches.ts` explicitly does NOT map `imageUrl` (comment at line 94: "imageUrl is NOT mapped here — the column was dropped in Phase 60 Plan 01"). The field is accepted by the `Watch` domain type but produces no DB write.

The downstream activity log at line 169 then reads `watch.imageUrl ?? null` — but `watch` is the return value of `createWatch`, which calls `mapRowToWatch` and does not set `imageUrl` either. So `watch.imageUrl` is `undefined` and `logActivity` receives `imageUrl: null`, which is correct behavior. But the `createWatch` call still passes a value that is silently dropped, and the `Omit<Watch, 'id' | 'catalogId'>` type passed to `createWatch` still includes the `imageUrl` field, making it appear like a meaningful input.

**Fix:** Remove the `imageUrl` field from the `createWatch` call in `wishlist.ts`. The new watch will resolve its cover from `watch_photos` at read time once photos are uploaded, or fall back to the catalog imageUrl:

```typescript
const watch = await createWatch(user.id, catalogId, {
  brand: row.brand,
  model: row.model,
  status: 'wishlist',
  movement: row.movementType ?? undefined,
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  // imageUrl removed — no longer a DB column (Phase 60); cover resolved from watch_photos at read time
})
```

Also remove `imageUrl: z.string().optional()` from `insertWatchSchema` in `src/app/actions/watches.ts` (line 47) to prevent the same confusion in the `addWatch` and `editWatch` paths. The `Watch` domain type's `imageUrl` field is now read-only (computed at query time), not writable through any action.

---

## Info

### IN-01: Post-migration assertion does not verify storage.objects RLS policies

**File:** `supabase/migrations/20260525000000_phase60_watch_photos.sql:183-204`

**Issue:** The STEP 10 post-migration assertion queries `pg_policies WHERE schemaname = 'public' AND tablename = 'watch_photos'` for the DB table policies. It does NOT verify that the four `storage.objects` policies (`watch_photos_storage_insert_own_folder`, etc.) were created. If the `storage.objects` INSERT at STEP 9 failed silently (e.g., policy name collision in a partial-apply scenario), the assertion would still pass, and upload RLS would be broken without any migration-time signal.

**Fix:** Add a second policy count check against `storage.objects`:

```sql
SELECT count(*) INTO policy_count
  FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects'
   AND policyname LIKE 'watch_photos_storage_%';
IF policy_count < 4 THEN
  RAISE EXCEPTION 'watch-photos storage RLS policies missing: expected >= 4, got %', policy_count;
END IF;
```

---

### IN-02: `insertWatchSchema` still accepts `imageUrl` as a writable field post-Phase-60

**File:** `src/app/actions/watches.ts:47`

**Issue:** `insertWatchSchema` includes `imageUrl: z.string().optional()`, inherited by `updateWatchSchema` via `.partial()`. Since `watches.image_url` was dropped in Phase 60, any client-submitted `imageUrl` is accepted by Zod validation, silently discarded by `mapDomainToRow`, and ignored by Drizzle's `set()` (unknown key in the spread). No runtime error occurs, but the schema implies the field is writable when it is not. Additionally, the `editWatch` divestment transaction path (line 411–413) uses `Object.fromEntries(Object.entries(updatePayload).filter(([, v]) => v !== undefined))` which bypasses `mapDomainToRow` entirely — if `imageUrl` is present in `updatePayload` it ends up in the raw spread to `tx.update(watches).set()`. Drizzle silently ignores keys not in the table schema, but the code path is confusing and could mislead future maintainers into thinking the field persists.

**Fix:** Remove `imageUrl` from `insertWatchSchema` (same fix as WR-03 above). Removing it prevents the dead field from reaching either `mapDomainToRow` or the divestment transaction's raw spread.

---

_Reviewed: 2026-05-25T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

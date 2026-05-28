# Phase 60: Multi-Photo Schema + DAL — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` (modify) | model | CRUD | `src/db/schema.ts` watchLikes table (lines 319–332) | exact |
| `supabase/migrations/20260525000000_phase60_watch_photos.sql` (create) | migration | batch | `supabase/migrations/20260504120000_phase27_sort_order.sql` + `20260522000000_phase53_likes_comments_rls.sql` + `20260423000004_phase11_storage_bucket_rls.sql` | exact (composite) |
| `drizzle/0013_phase60_watch_photos.sql` (create) | migration | batch | `drizzle/0012_phase49_1_drop_primary_archetype.sql` | role-match |
| `src/data/watches.ts` (modify) | service | CRUD | `src/data/watches.ts` itself (bulkReorderWishlist, getWatchesByUser, deleteWatch) | exact |
| `src/lib/storage/watchPhotos.ts` (create) | utility | file-I/O | `src/lib/storage/wearPhotos.ts` (lines 1–76) | exact |
| `src/app/actions/account.ts` (modify) | service | file-I/O | `src/app/actions/account.ts` purgeWearPhotos (lines 22–51) | exact |
| `src/lib/types.ts` (modify) | model | — | `src/lib/types.ts` Watch type (line 76) | exact |
| `tests/integration/phase60-watch-photos.test.ts` (create) | test | CRUD | `tests/integration/phase27-schema.test.ts` + `tests/integration/phase27-bulk-reorder.test.ts` | exact |
| `tests/unit/lib/storage/watchPhotos.test.ts` (create) | test | — | `tests/lib/storage-path.test.ts` | exact |
| `tests/unit/lib/exif/stripAndResize.test.ts` (create) | test | — | `tests/lib/exif-strip.test.ts` | exact |

---

## Pattern Assignments

### `src/db/schema.ts` — add `watchPhotos` table (modify)

**Analog:** `watchLikes` table definition at `src/db/schema.ts` lines 319–332; `wearEvents` lines 295–312 for `photoUrl`/`ON DELETE CASCADE` FK; `watches` lines 159–172 for `sort_order` column + composite index.

**Table header comment pattern** (lines 314–318, watchLikes):
```typescript
// ----- Phase 53 D-01: watch_likes table (LIKE-05, SEC-01, SEC-06) -----
// Column shapes only. UNIQUE constraint ..., RLS policies,
// GRANT/REVOKE, and DO $$ assertions live in
// supabase/migrations/20260522000000_phase53_likes_comments_rls.sql.
// Drizzle 0.45.2 cannot express RLS in the pg-core DSL — raw SQL is authoritative.
```

**Core table definition pattern** (lines 319–332, watchLikes — direct copy model for watchPhotos):
```typescript
export const watchLikes = pgTable(
  'watch_likes',
  {
    id:        uuid('id').defaultRandom().primaryKey(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId:   uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watch_likes_unique_pair').on(table.userId, table.watchId),
    index('watch_likes_watch_id_idx').on(table.watchId),
    index('watch_likes_user_id_idx').on(table.userId),
  ],
)
```

**`sort_order` column + composite index pattern** (lines 159–172, watches table):
```typescript
sortOrder: integer('sort_order').notNull().default(0),
// ...
(table) => [
  index('watches_user_sort_idx').on(table.userId, table.sortOrder),
]
```

**`watchPhotos` target definition** — combine the above:
```typescript
// ----- Phase 60 D-01..D-03: watch_photos table (PHOTO-01) -----
// Column shapes only. ENABLE ROW LEVEL SECURITY, all RLS policies, bucket
// creation, and the backfill + DROP sequence live in
// supabase/migrations/20260525000000_phase60_watch_photos.sql.
// Drizzle 0.45.2 cannot express RLS in the pg-core DSL — raw SQL is authoritative.
export const watchPhotos = pgTable(
  'watch_photos',
  {
    id:          uuid('id').defaultRandom().primaryKey(),
    watchId:     uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    sortOrder:   integer('sort_order').notNull().default(0),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_photos_watch_id_sort_idx').on(table.watchId, table.sortOrder),
  ],
)
```

**`watches.imageUrl` removal** — delete line 136 (`imageUrl: text('image_url'),`) from the `watches` table definition and delete line 93 from `mapDomainToRow` (`if ('imageUrl' in data) row.imageUrl = data.imageUrl ?? null`).

---

### `supabase/migrations/20260525000000_phase60_watch_photos.sql` (create)

**Analog 1 (migration structure + DO $$ pattern):** `supabase/migrations/20260504120000_phase27_sort_order.sql`
**Analog 2 (RLS DROP/CREATE shape + BEGIN/COMMIT + DO $$ assertion):** `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` lines 1–80
**Analog 3 (storage bucket + folder RLS):** `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql`

**File header pattern** (from phase53 lines 1–15):
```sql
-- Phase 60 — watch_photos table + backfill + RLS + storage bucket
-- Source: 60-CONTEXT.md D-01..D-16; 60-RESEARCH.md §Pattern 2
-- Sibling Drizzle schema: src/db/schema.ts (column shapes only — no RLS, no DO $$)
--
-- Threats mitigated:
--   Cross-tenant photo insert — blocked by ownership check + INSERT RLS
--   Storage path traversal — blocked by folder RLS (foldername = auth.uid())
--   Orphaned storage objects — purgeWatchPhotos in Server Action before deleteWatch
--
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   drizzle-kit push is LOCAL ONLY; prod uses supabase db push --linked
```

**Transaction wrapper + CREATE TABLE pattern** (from phase53 lines 16–30):
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS watch_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id     uuid        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS watch_photos_watch_id_sort_idx
  ON watch_photos(watch_id, sort_order);
```

**Backfill + idempotency guard pattern** (from phase27 — guards the data write so re-run does not destroy state):
```sql
-- BACKFILL: watches.image_url → watch_photos (LOSSLESS — BEFORE DROP)
-- ON CONFLICT DO NOTHING: idempotent on re-run (D-07)
INSERT INTO watch_photos (id, watch_id, storage_path, sort_order, created_at)
SELECT gen_random_uuid(), id, image_url, 0, now()
FROM watches
WHERE image_url IS NOT NULL
ON CONFLICT DO NOTHING;
```

**Pre-DROP lossless assertion** (from phase27 DO $$ check pattern):
```sql
DO $$
DECLARE missed_count int;
BEGIN
  SELECT count(*) INTO missed_count
    FROM watches w
   WHERE w.image_url IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM watch_photos wp
        WHERE wp.watch_id = w.id AND wp.sort_order = 0
     );
  IF missed_count > 0 THEN
    RAISE EXCEPTION 'Phase 60 backfill incomplete: % watches still have image_url with no sort_order=0 photo row', missed_count;
  END IF;
END $$;

-- DROP AFTER assertion passes — never before backfill
ALTER TABLE watches DROP COLUMN IF EXISTS image_url;
```

**RLS ENABLE + DROP/CREATE policy pattern** (from phase53 lines ~100–200 shape):
```sql
ALTER TABLE watch_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watch_photos_select_owner ON watch_photos;
CREATE POLICY watch_photos_select_owner ON watch_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS watch_photos_insert_owner ON watch_photos;
CREATE POLICY watch_photos_insert_owner ON watch_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS watch_photos_update_owner ON watch_photos;
CREATE POLICY watch_photos_update_owner ON watch_photos
  FOR UPDATE TO authenticated
  USING      (EXISTS (SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id AND w.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id AND w.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS watch_photos_delete_owner ON watch_photos;
CREATE POLICY watch_photos_delete_owner ON watch_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );
```

**Storage bucket + folder RLS pattern** (from phase11 lines 36–44 + folder policy shape):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('watch-photos', 'watch-photos', false, 8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS watch_photos_storage_insert_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
-- (mirror for UPDATE, DELETE, SELECT)
```

**Post-migration DO $$ assertion** (from phase27/phase53 pattern — always close the transaction with COMMIT):
```sql
DO $$
DECLARE
  table_count  integer;
  policy_count integer;
  bucket_count integer;
BEGIN
  SELECT count(*) INTO table_count  FROM information_schema.tables  WHERE table_schema='public' AND table_name='watch_photos';
  SELECT count(*) INTO policy_count FROM pg_policies               WHERE schemaname='public' AND tablename='watch_photos';
  SELECT count(*) INTO bucket_count FROM storage.buckets           WHERE id='watch-photos';
  IF table_count  <> 1 THEN RAISE EXCEPTION 'watch_photos table missing';     END IF;
  IF policy_count <  4 THEN RAISE EXCEPTION 'watch_photos RLS policies missing: expected >= 4, got %', policy_count; END IF;
  IF bucket_count <> 1 THEN RAISE EXCEPTION 'watch-photos bucket missing';    END IF;
END $$;

COMMIT;
```

**Critical ordering within the migration:** CREATE TABLE → CREATE INDEX → BACKFILL INSERT → DO $$ lossless check → ALTER TABLE DROP COLUMN → ENABLE RLS → CREATE POLICies → storage bucket INSERT → storage RLS policies → DO $$ post-migration assertion → COMMIT. Never swap backfill and DROP.

---

### `drizzle/0013_phase60_watch_photos.sql` (create)

**Analog:** `drizzle/0012_phase49_1_drop_primary_archetype.sql` (generated by drizzle-kit; column shapes only, no RLS).

This file is generated by `npx drizzle-kit generate` after updating `src/db/schema.ts`. It will contain the `CREATE TABLE watch_photos` DDL and the `ALTER TABLE watches DROP COLUMN image_url` statement. The file is used for LOCAL dev sync only — it is NOT the authoritative migration for production. Do not run `drizzle-kit push` before the Supabase migration has backfilled the data locally.

**Drizzle journal:** `drizzle/meta/_journal.json` is auto-updated by drizzle-kit generate. No manual edit.

---

### `src/data/watches.ts` — DAL extensions (modify)

**Analog:** `src/data/watches.ts` itself. All four extension points have direct analogs within the same file.

#### Extension 1: `getWatchesByUser` cover join (lines 126–166)

The existing `.select({...}).from(watches).leftJoin(watchesCatalog, ...)` shape at line 144–145 is the insertion point. Add a correlated subquery to the `.select()` projection alongside the existing `taste` shape:

```typescript
// Add to imports (line 5):
import { watches, profileSettings, watchesCatalog, watchPhotos } from '@/db/schema'

// Inside the db.select({ ... }) at line 128 — add alongside `watch` and `taste`:
coverStoragePath: sql<string | null>`(
  SELECT wp.storage_path
  FROM watch_photos wp
  WHERE wp.watch_id = ${watches.id}
  ORDER BY wp.sort_order ASC
  LIMIT 1
)`,
```

**Mapper repoint** — replace line 45 (`imageUrl: row.imageUrl ?? undefined`) in `mapRowToWatch`. The function signature does NOT change; `imageUrl` stays in the `Watch` domain type (D-08):

```typescript
// Replace the mapRowToWatch call in getWatchesByUser rows.map callback.
// The spread `...mapRowToWatch(watch)` already handles most fields;
// override imageUrl after the spread using the cover join result:
imageUrl: row.coverStoragePath ?? (catalogImageUrl ?? undefined),
```

The `mapRowToWatch` function itself (lines 17–59) should have its `imageUrl: row.imageUrl ?? undefined` line (line 45) REMOVED — that column no longer exists on the DB row. The cover is resolved in the per-query mapper, not in the base `mapRowToWatch`. For `getWatchById` and `getWatchByIdForViewer`, which currently use `mapRowToWatch(row)` directly, each needs its own cover subquery in the SELECT and a post-map imageUrl override (same pattern; see Open Question 3 in RESEARCH.md).

**`mapDomainToRow` line 93** (`if ('imageUrl' in data) row.imageUrl = data.imageUrl ?? null`) — DELETE this line. The column is dropped; writing it causes a DB error.

#### Extension 2: Error classes (insert before `bulkReorderWishlist`)

**Analog:** `OwnerMismatchError` / `SetMismatchError` pattern (lines 390–413):
```typescript
export class OwnerMismatchError extends Error {
  constructor(public expected: number, public got: number) {
    super(`Owner mismatch: expected ${expected} rows, updated ${got}`)
    this.name = 'OwnerMismatchError'
  }
}
```

New class, same shape:
```typescript
export class PhotoCapExceededError extends Error {
  constructor(public cap: number) {
    super(`Photo cap reached: a watch may have at most ${cap} photos`)
    this.name = 'PhotoCapExceededError'
  }
}

export const MAX_PHOTOS_PER_WATCH = 10 // D-12 — single tunable constant
```

#### Extension 3: `addWatchPhoto` (cap-enforced insert)

**Analog:** `createWatch` (lines 276–299) for the insert shape; `bulkReorderWishlist` (line 444–456) for the `count(*)::int` check; `deleteWatch` (lines 320–328) for the ownership-scoped WHERE + throw-on-not-found pattern.

```typescript
// Ownership check shape (from deleteWatch lines 321–328):
const deleted = await db
  .delete(watches)
  .where(and(eq(watches.userId, userId), eq(watches.id, watchId)))
  .returning()
if (!deleted[0]) {
  throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
}

// Count check shape (from bulkReorderWishlist lines 444–456):
const totalRows = await db
  .select({ c: sql<number>`count(*)::int` })
  .from(watches)
  .where(and(eq(watches.userId, userId), inArray(watches.status, ['wishlist', 'grail'])))
const total = totalRows[0]?.c ?? 0
if (total !== orderedIds.length) {
  throw new SetMismatchError(total, orderedIds.length)
}

// Insert + .returning() shape (from createWatch lines 282–298):
const inserted = await db
  .insert(watches)
  .values({ ...rowData, userId, catalogId })
  .returning()
return mapRowToWatch(inserted[0])
```

#### Extension 4: `bulkReorderPhotos` (reorder)

**Analog:** `bulkReorderWishlist` (lines 433–482) — copy the entire CASE WHEN UPDATE pattern, substituting `watchPhotos`/`watchId`/`sortOrder` for `watches`/`userId`/`sortOrder`:

```typescript
// CASE WHEN build (lines 460–465):
const chunks: SQL[] = [sql`(case`]
orderedIds.forEach((id, idx) => {
  chunks.push(sql`when ${watches.id} = ${id} then ${idx}::int4`)
})
chunks.push(sql`end)`)
const caseExpr = sql.join(chunks, sql.raw(' '))

// Update + returning (lines 467–477):
const updated = await db
  .update(watches)
  .set({ sortOrder: caseExpr, updatedAt: new Date() })
  .where(and(eq(watches.userId, userId), inArray(watches.id, orderedIds), inArray(watches.status, ['wishlist', 'grail'])))
  .returning({ id: watches.id })
if (updated.length !== orderedIds.length) {
  throw new OwnerMismatchError(orderedIds.length, updated.length)
}
```

For `bulkReorderPhotos`, the ownership scope is `watchId` (not `userId` on `watchPhotos`), so the WHERE is `eq(watchPhotos.watchId, watchId)` + `inArray(watchPhotos.id, orderedIds)`. Ownership is pre-checked via the `watches` table query before the CASE WHEN update.

---

### `src/lib/storage/watchPhotos.ts` (create)

**Analog:** `src/lib/storage/wearPhotos.ts` (lines 1–76) — copy verbatim, substitute bucket name and ID semantics.

**Full file template** (mirror of wearPhotos.ts):
```typescript
'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type WatchPhotoUploadResult = { path: string } | { error: string }

const UUID_RE = /^[0-9a-f-]{36}$/i
const BUCKET_ID = 'watch-photos' as const

/**
 * Build the Storage path for a watch photo.
 * Convention: `{userId}/{photoId}.jpg` — enforced by Phase 60 Storage RLS.
 * @throws TypeError when userId is falsy or photoId is not a UUID.
 */
export function buildWatchPhotoPath(userId: string, photoId: string): string {
  if (!userId) throw new TypeError('userId required')
  if (!UUID_RE.test(photoId)) throw new TypeError('photoId must be a UUID')
  return `${userId}/${photoId}.jpg`
}

/**
 * Upload a JPEG blob to the watch-photos bucket.
 * Returns {path} on success, {error} on failure.
 * upsert: false — each photo gets a fresh UUID-stamped path (mirrors wearPhotos.ts).
 */
export async function uploadWatchPhoto(
  userId: string,
  photoId: string,
  jpeg: Blob,
): Promise<WatchPhotoUploadResult> {
  let path: string
  try {
    path = buildWatchPhotoPath(userId, photoId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid path inputs' }
  }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(BUCKET_ID)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (error) return { error: error.message }
  return { path }
}
```

**Key differences from `wearPhotos.ts`:**
- Bucket: `'watch-photos'` (not `'wear-photos'`)
- ID param: `photoId` (UUID of the `watch_photos` row, not `wearEventId`)
- Result type: `WatchPhotoUploadResult` (not `UploadResult` — avoids name collision)

---

### `src/app/actions/account.ts` — add `purgeWatchPhotos` (modify)

**Analog:** `purgeWearPhotos` (lines 22–51) in the same file.

**Pattern:** The `purgeWearPhotos` helper uses a paginated `list + remove` loop because wear photos are stored as `{userId}/{wearEventId}.jpg` (a flat directory by userId). For watch photos, the same convention is used (`{userId}/{photoId}.jpg`). However, because we cannot filter by `watchId` via `storage.list()` search (prefix match only works on filename), the recommended approach for per-watch purge is to query `watch_photos` for the watch's `storagePath` values first, then call `remove()` directly:

```typescript
// 'use server' is already at the top of account.ts (line 1)
// Add imports alongside the existing ones (line 7-8):
import { watchPhotos } from '@/db/schema'
import { eq } from 'drizzle-orm'

// New helper — add after purgeWearPhotos (after line 51):
/**
 * Purge storage objects for a specific watch's photos.
 * Queries watch_photos for storagePath values, then removes them from storage.
 * Runs BEFORE deleteWatch (mirrors purgeWearPhotos precedent).
 *
 * @param supabase - session-scoped server client (caller supplies)
 * @param watchId - the watch whose photos should be purged
 */
async function purgeWatchPhotos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  watchId: string,
): Promise<void> {
  const photos = await db
    .select({ storagePath: watchPhotos.storagePath })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  if (photos.length === 0) return
  const paths = photos.map((p) => p.storagePath)
  const { error } = await supabase.storage.from('watch-photos').remove(paths)
  if (error) throw error
}
```

**Integration point:** Find the `removeWatch` Server Action (wherever `deleteWatch` is called from) and add `await purgeWatchPhotos(supabase, watchId)` BEFORE the `deleteWatch(userId, watchId)` call. Mirror the `wipeCollection` call site pattern (line 81–82 in account.ts):
```typescript
// In account.ts wipeCollection (line 81-82) — copy this call-site pattern:
const supabase = await createSupabaseServerClient()
await purgeWearPhotos(supabase, user.id)
// → becomes in removeWatch:
const supabase = await createSupabaseServerClient()
await purgeWatchPhotos(supabase, watchId)
```

**Also update `wipeCollection`:** When wiping the entire collection, add a `watch-photos` sweep alongside `purgeWearPhotos`. Use the paginated `list + remove` pattern (same as `purgeWearPhotos`) over `watch-photos/{userId}/`:
```typescript
// Mirror purgeWearPhotos (lines 36–50), substituting bucket name:
const { data: files, error: listErr } = await supabase.storage
  .from('watch-photos')
  .list(userId, { limit: PAGE_SIZE })
```

---

### `src/lib/types.ts` — add `WatchPhoto` type + `MAX_PHOTOS_PER_WATCH` (modify)

**Analog:** `Watch` type (line 76 for `imageUrl`); `EraSignal` union (discriminated union pattern in the same file).

**`imageUrl` in `Watch` type stays** (line 76, `imageUrl?: string`) — D-08 locks this. No change to the `Watch` type's `imageUrl` field.

**New additions:**
```typescript
// Add near the top of types.ts with other domain types:
export interface WatchPhoto {
  id: string
  watchId: string
  storagePath: string
  sortOrder: number
  createdAt: string // ISO string
}

// Add as a module-level constant (NOT inside a type — needs to be importable at runtime):
export const MAX_PHOTOS_PER_WATCH = 10
```

Note: `MAX_PHOTOS_PER_WATCH` could alternatively live only in `src/data/watches.ts` (the DAL enforcement site). The planner should decide the canonical location. If it stays only in `watches.ts`, import it from there in tests.

---

### `tests/integration/phase60-watch-photos.test.ts` (create)

**Analog:** `tests/integration/phase27-schema.test.ts` (DATABASE_URL guard + `db.execute(sql`...`)` schema checks) + `tests/integration/phase27-bulk-reorder.test.ts` (seed users + watches + watchesCatalog, beforeAll/afterAll cleanup, randomUUID STAMP).

**File header + DATABASE_URL guard pattern** (from phase27-schema.test.ts lines 1–16):
```typescript
/**
 * Phase 60 — watch_photos schema + DAL integration tests (SC1/SC2/SC3).
 * SC1: table exists, image_url dropped, backfill rows at sort_order=0.
 * SC2: getWatchesByUser resolves imageUrl from watch_photos cover.
 * SC3: addWatchPhoto throws PhotoCapExceededError at MAX_PHOTOS_PER_WATCH+1.
 *
 * Gated on DATABASE_URL — skip in CI without local Supabase.
 * // @vitest-environment jsdom  (no fs walking; jsdom is correct here)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { users, watches, watchesCatalog, watchPhotos } from '@/db/schema'
import { getWatchesByUser, addWatchPhoto, MAX_PHOTOS_PER_WATCH, PhotoCapExceededError } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p60wp${Date.now().toString(36)}`
```

**Seed shape pattern** (from phase27-bulk-reorder.test.ts lines 29–60):
```typescript
maybe(`Phase 60 — watch_photos schema + DAL [${STAMP}]`, () => {
  const userId = randomUUID()
  const watchId = randomUUID()
  const catalogId = randomUUID()

  beforeAll(async () => {
    await db.insert(users).values([{ id: userId, email: `${STAMP}@horlo.test` }]).onConflictDoNothing()
    await db.insert(watchesCatalog).values([{
      id: catalogId, brand: 'Test', model: 'Ref', reference: STAMP,
      // ... minimal required catalog columns
    }]).onConflictDoNothing()
    await db.insert(watches).values([{
      id: watchId, userId, brand: 'Test', model: 'Ref', status: 'owned',
      catalogId, complications: [], styleTags: [], designTraits: [], roleTags: [],
    }]).onConflictDoNothing()
  })

  afterAll(async () => {
    await db.delete(watches).where(/* seed rows only */)
    await db.delete(users).where(/* seed rows only */)
  })
  // ...tests...
})
```

**Schema check pattern** (from phase27-schema.test.ts lines 20–39):
```typescript
it('watch_photos table exists with required columns', async () => {
  const result = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'watch_photos'
  `)
  // assert id, watch_id, storage_path, sort_order, created_at present
})

it('watches table no longer has image_url column (SC1 — column dropped)', async () => {
  const result = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'watches'
      AND column_name = 'image_url'
  `)
  expect((result as unknown as unknown[]).length).toBe(0)
})
```

---

### `tests/unit/lib/storage/watchPhotos.test.ts` (create)

**Analog:** `tests/lib/storage-path.test.ts` (lines 1–52) — copy verbatim, substitute `buildWatchPhotoPath` / `photoId` / `watchPhotos`.

**Full structure** (direct copy of storage-path.test.ts with substitutions):
```typescript
// tests/unit/lib/storage/watchPhotos.test.ts
import { describe, it, expect } from 'vitest'
import { buildWatchPhotoPath } from '@/lib/storage/watchPhotos'

const VALID_UUID = '01234567-89ab-cdef-0123-456789abcdef'

describe('buildWatchPhotoPath', () => {
  it('returns `${userId}/${photoId}.jpg` for valid inputs', () => {
    expect(buildWatchPhotoPath('user-abc', VALID_UUID)).toBe(`user-abc/${VALID_UUID}.jpg`)
  })
  it('throws when userId is empty string', () => {
    expect(() => buildWatchPhotoPath('', VALID_UUID)).toThrow(/userId/)
  })
  it('throws when photoId is not a UUID', () => {
    expect(() => buildWatchPhotoPath('user-1', 'not-a-uuid')).toThrow(/UUID/)
  })
  it('first segment equals userId (RLS folder contract)', () => {
    const p = buildWatchPhotoPath('user-xyz', VALID_UUID)
    expect(p.split('/')[0]).toBe('user-xyz')
  })
})
```

---

### `tests/unit/lib/exif/stripAndResize.test.ts` (create)

**Analog:** `tests/lib/exif-strip.test.ts` (lines 1–221) — this file already exists and tests `stripAndResize`. The Phase 60 test is NOT a new test of `stripAndResize` itself; it is a **structural smoke test** confirming the integration between `uploadWatchPhoto` and `stripAndResize` (the wiring from D-15/D-16).

**Key pattern** from `tests/lib/exif-strip.test.ts` — canvas mock setup (lines 16–90) is directly reusable:
```typescript
vi.mock('exifr/dist/lite.esm.js', () => ({ orientation: vi.fn(async () => undefined) }))

HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext']

function stubCreateImageBitmap(width: number, height: number) {
  const fn = vi.fn(async () => ({ width, height, close: () => {} }))
  Object.defineProperty(globalThis, 'createImageBitmap', { value: fn, writable: true, configurable: true })
  return fn
}

function stubCanvasToBlob(bytes: number) {
  const synthetic = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(synthetic))
  return () => { /* restore */ }
}
```

**SC4 test scope** — the Phase 60 `stripAndResize.test.ts` need only confirm:
1. `stripAndResize` is callable and returns a `StripResult` with a JPEG blob
2. Longest edge of output is `<= 1080`
3. Output blob MIME is `image/jpeg`

These three are already covered by `tests/lib/exif-strip.test.ts`. The planner should decide whether to:
- **Option A:** Reference the existing test file as covering SC4 (no new file needed; just cite `tests/lib/exif-strip.test.ts` in the SC4 checklist)
- **Option B:** Create `tests/unit/lib/exif/stripAndResize.test.ts` that imports and re-runs the same assertions scoped to the "Phase 60 integration wiring" narrative

Given the RESEARCH.md spec names this file, Option B is safest for traceability. Copy the three core assertions from `tests/lib/exif-strip.test.ts` (the MIME, dimension-cap, and EXIF-strip-by-construction tests at lines 98–143) into the new file.

**`// @vitest-environment` directive:** `jsdom` (not `node`). `stripAndResize` calls `document.createElement('canvas')` — jsdom is required. No `readdirSync` calls, so the `node` variant from `project_vitest_static_node_env` memory does NOT apply here.

---

## Shared Patterns

### Drizzle imports required in `src/data/watches.ts`

**Source:** `src/data/watches.ts` line 5 (existing import)
**Apply to:** DAL extensions — add `watchPhotos` to the existing schema import:
```typescript
import { watches, profileSettings, watchesCatalog, watchPhotos } from '@/db/schema'
```

### Ownership check before any mutation

**Source:** `src/data/watches.ts` `deleteWatch` (lines 320–328) and `updateWatch` (lines 304–315)
**Apply to:** `addWatchPhoto`, `bulkReorderPhotos`, `deleteWatchPhoto`

Pattern: always scope the initial ownership query to BOTH `watches.userId = userId` AND `watches.id = watchId`, with `.limit(1)`, and throw `new Error('Watch not found or access denied: ...')` on null result.

### `count(*)::int` cast for Drizzle numeric return

**Source:** `src/data/watches.ts` line 445 and line 367
**Apply to:** `addWatchPhoto` cap-check query, `bulkReorderPhotos` set-completeness check

```typescript
sql<number>`count(*)::int`   // must cast to int; postgres-js returns numeric as string
sql<number>`coalesce(max(${column}), -1)::int`  // for max sort_order queries
```

### `server-only` import guard

**Source:** `src/data/watches.ts` line 1
**Apply to:** Any new DAL-adjacent file added to `src/data/` — if watch photo DAL functions are split into a separate file (unlikely but possible), add `import 'server-only'` as the first line.

### `'use client'` directive on storage helpers

**Source:** `src/lib/storage/wearPhotos.ts` line 1
**Apply to:** `src/lib/storage/watchPhotos.ts` — must have `'use client'` because it calls `createSupabaseBrowserClient()`.

### `'use server'` directive on Server Actions

**Source:** `src/app/actions/account.ts` line 1
**Apply to:** Any new Server Action file (the account.ts modification already has it).

### `upsert: false` in storage upload

**Source:** `src/lib/storage/wearPhotos.ts` line 68
**Apply to:** `uploadWatchPhoto` — each photo gets a fresh UUID path; `upsert: false` is correct. Never `upsert: true` on photos (the `avatarPhotos.ts` analog uses `upsert: true` — that is the exception for single-slot overwrite, not the rule for photo uploads).

### Error handling: `try { createSupabaseServerClient } catch → ActionResult`

**Source:** `src/app/actions/account.ts` lines 71–107 (`wipeCollection` structure)
**Apply to:** Any new Server Action that calls `purgeWatchPhotos` — wrap in try/catch, return `{ success: false, error: '...' }` on failure, `{ success: true, data: undefined }` on success.

---

## No Analog Found

All Phase 60 files have strong analogs in the codebase. No entries.

---

## Migration Ordering Critical Notes

1. **Drizzle file number:** next is `0013_phase60_watch_photos.sql` (confirmed: `drizzle/0012_phase49_1_drop_primary_archetype.sql` is the current highest)
2. **Supabase filename:** `20260525000000_phase60_watch_photos.sql` — exactly 14 digits (Rule 1 from `project_drizzle_supabase_db_mismatch` memory)
3. **Backfill before DROP, always:** The backfill INSERT + DO $$ lossless check must precede `ALTER TABLE watches DROP COLUMN image_url` in the same migration transaction
4. **drizzle-kit push is LOCAL ONLY:** Do not use `drizzle-kit push` to apply the DROP COLUMN in production; the Supabase migration is authoritative
5. **RLS subquery-caller gotcha:** The `watch_photos` SELECT policy subqueries `watches` (owner-only RLS). Non-owner reads go through service-role DAL only — do not rely on this policy for public visibility enforcement

---

## Metadata

**Analog search scope:** `src/db/schema.ts`, `src/data/watches.ts`, `src/lib/storage/`, `src/app/actions/account.ts`, `src/lib/exif/strip.ts`, `src/lib/types.ts`, `supabase/migrations/`, `drizzle/`, `tests/integration/phase27-*.test.ts`, `tests/lib/`
**Files scanned:** 15 source files + 3 migration files read directly
**Pattern extraction date:** 2026-05-25

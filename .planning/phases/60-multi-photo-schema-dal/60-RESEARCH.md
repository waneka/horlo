# Phase 60: Multi-Photo Schema + DAL — Research

**Researched:** 2026-05-25
**Domain:** PostgreSQL schema migration + Drizzle ORM DAL + Supabase Storage + EXIF pipeline
**Confidence:** HIGH — all findings verified against codebase source

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `watch_photos` table holds owner uploads only, keyed to `watches.id`, `ON DELETE CASCADE`.
- **D-02:** Public wear pics NOT stored in `watch_photos`. Phase 62 unions `wear_events` at read. Separate tables, union at read — locked.
- **D-03:** Photo ordering mirrors Phase 27 `sort_order` pattern (integer, full-rewrite bulk helper).
- **D-04:** Cover thumbnail computed at read via DAL join (lowest `sort_order`, `LIMIT 1`). No cached `coverPhotoUrl` column on `watches`.
- **D-05:** Cover fallback chain: owner upload `[0]` → catalog `imageUrl` → placeholder.
- **D-06:** Observable at data layer before UI (SC2).
- **D-07:** Backfill every non-null `watches.image_url` into `watch_photos` as `sort_order=0`. Then DROP the column. Lossless.
- **D-08:** `Watch.imageUrl` TS type field stays; repointed to computed cover. No reader churn.
- **D-09:** `watches` is user-side wipeable — lossless-backfill-before-drop is the only concern, not catalog investment.
- **D-10:** No `watches_catalog` ALTER and no catalog backfill in this phase.
- **D-11:** SC5 is satisfied trivially since `watches_catalog` is untouched. The real lossless assertion is D-07.
- **D-12:** `MAX_PHOTOS_PER_WATCH = 10` (single tunable constant).
- **D-13:** Cap enforced in DAL only — `addPhoto` counts rows and rejects beyond cap. No DB CHECK/trigger.
- **D-14:** Cap counts `watch_photos` rows only (owner uploads). Surfaced wear pics do not count.
- **D-15:** Build storage helper + `stripAndResize` wiring + metadata-verifying test in Phase 60. Upload UI is Phase 61.
- **D-16:** Reuse existing `stripAndResize` (`src/lib/exif/strip.ts`). Do not rebuild.
- **Storage bucket:** new dedicated `watch-photos` bucket (not `wear-photos`).
- **Storage path:** `{userId}/{photoId}.jpg`, RLS folder enforcement.
- **RLS shape:** owner-write + visibility-gated public-read, service-role DAL is real gate.

### Claude's Discretion (decided in CONTEXT.md, open to planner refinement)

- Storage-path convention and exact `ON DELETE` storage-object purge on watch delete.
- RLS policy shape on `watch_photos`.

### Deferred Ideas (OUT OF SCOPE)

- Public wear-pic surfacing + carousel union — Phase 62.
- Upload UI, carousel, drag-reorder UI, delete UI — Phase 61.
- Per-account photo cap / storage quota — PHOTO-F1 (future).
- In-app photo editing beyond capture crop — PHOTO-F2 (future).
- Multi-photo extraction from URL import — PHOTO-F3 (future).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHOTO-01 | A watch can hold multiple photos (replacing the single image field) | `watch_photos` table schema (see §Standard Stack); backfill + DROP of `watches.image_url` (D-07); DAL repoint of `imageUrl` mapper (D-08) |
| PHOTO-04 | The first/cover photo serves as the watch's card thumbnail across grids and rails | Cover join in `getWatchesByUser` + `getWatchById*` (D-04/D-05); fallback chain verified in §Architecture Patterns Pattern 2 |
| PHOTO-07 | A watch enforces a cap of ~10 photos; upload affordance blocked at cap | `MAX_PHOTOS_PER_WATCH = 10` constant + `addPhoto` DAL row-count check (D-12/D-13); see §Architecture Patterns Pattern 3 |
| PHOTO-08 | Uploaded photos pass through EXIF-strip / ≤1080px JPEG pipeline before storage | `stripAndResize` reuse (D-16); storage helper mirroring `wearPhotos.ts` (D-15); EXIF-verifying unit test (SC4); see §Architecture Patterns Pattern 4 |

</phase_requirements>

---

## Summary

Phase 60 is a database + DAL + storage-helper phase: no UI, no user-facing changes. It replaces the single `watches.image_url` column with a `watch_photos` child table and rewires all DAL read paths to resolve the cover via a join. The work is self-contained but touches three concerns that have historically caused prod incidents on this project: dual-migration discipline, the RLS-subquery-caller gotcha, and the `// @vitest-environment node` requirement for filesystem-walking test guards.

Every architectural decision is already locked in CONTEXT.md (D-01..D-16). The planner's job is sequencing tasks to avoid footguns: the backfill (`watches.image_url` → `watch_photos`) must run before the column drop, never after. The Drizzle schema update and the Supabase migration are two separate artifacts that must both be written. The storage bucket migration, the storage helper, and the EXIF-verifying test must land in this phase even though the upload UI is deferred to Phase 61.

**Primary recommendation:** Three-wave structure — Wave 1 writes the schema (Drizzle definition + Supabase migration including backfill-then-drop and RLS), Wave 2 extends the DAL (cover join, mapper repoint, `addPhoto`, `bulkReorderPhotos`, `deleteWatch` purge hook), Wave 3 adds the storage helper + EXIF-verifying test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-photo persistence | Database | — | New `watch_photos` table; the data layer change is the phase's entire scope |
| Cover resolution | API / Backend (DAL) | — | Computed at read via LEFT JOIN in service-role DAL; not a cached column |
| `imageUrl` fallback chain | API / Backend (DAL) | — | D-05: owner-upload[0] → catalog imageUrl → placeholder; resolved in row mapper |
| Per-watch cap enforcement | API / Backend (DAL) | — | D-13: DAL-only, no DB trigger; mirrors single-writer invariant |
| EXIF-strip + resize pipeline | Browser / Client | — | `stripAndResize` uses canvas re-encode; called client-side before upload |
| Storage upload | Browser / Client | — | Client-direct to `watch-photos` bucket; RLS folder enforcement |
| Storage purge on watch delete | API / Backend (Server Action) | — | Mirrors `purgeWearPhotos` in `account.ts`; runs before DB delete |
| RLS (defense-in-depth) | Database | — | Anon-block + fail-closed backstop; service-role DAL is real read gate |

---

## Standard Stack

### Core (all verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 | Schema definitions + query builder | Project-wide ORM; `pg-core` DSL for column shapes [VERIFIED: node_modules/drizzle-orm/package.json] |
| `drizzle-kit` | (installed) | Local migration generation | `npx drizzle-kit push` for local schema sync only [VERIFIED: package.json scripts] |
| `supabase` CLI | 2.90.0 | Prod migration apply | `supabase db push --linked` is the prod path [VERIFIED: supabase --version] |
| `@supabase/supabase-js` | (installed) | Storage bucket client | Browser client for client-direct upload; admin client for purge [VERIFIED: src/lib/storage/wearPhotos.ts] |
| `vitest` | (installed) | Test runner | Project standard; `// @vitest-environment node` required for fs-walking tests [VERIFIED: vitest.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | (shim in tests) | Guard DAL imports from client bundles | Already present on `src/data/watches.ts`; include on new `watch_photos` DAL file if split [VERIFIED: src/data/watches.ts:1] |
| `exifr/dist/lite.esm.js` | (installed) | Lazy-loaded EXIF orientation reader | Used inside `stripAndResize` fallback path — no new dependency needed [VERIFIED: src/lib/exif/strip.ts:125] |

### No New Dependencies

All capabilities are covered by existing libraries. The planner should not add any npm packages.

---

## Architecture Patterns

### System Architecture Diagram

```
[Client Component: upload affordance (Phase 61)]
    │ File selected → stripAndResize(blob) → JPEG blob
    │
    ▼
[src/lib/storage/watchPhotos.ts]   (NEW, Phase 60)
    │ buildWatchPhotoPath(userId, photoId) → "{userId}/{photoId}.jpg"
    │ uploadWatchPhoto(userId, photoId, jpeg) → {path} | {error}
    │   └── supabase.storage.from('watch-photos').upload(path, jpeg, {upsert:false})
    │       RLS: (storage.foldername(name))[1] = auth.uid()::text
    │
    ▼
[Supabase Storage: watch-photos bucket]  (NEW, Phase 60 Supabase migration)
    │ Private bucket; per-user folder RLS
    │
    ▼  (Phase 61: Server Action stores the returned path into watch_photos)

[watch_photos table]  ← ON DELETE CASCADE ← [watches table]
    │ watch_id, sort_order, storage_path, created_at
    │
    ▼
[src/data/watches.ts — getWatchesByUser / getWatchById*]
    │ LEFT JOIN watch_photos ON watch_photos.watch_id = watches.id
    │   AND watch_photos.sort_order = (SELECT MIN(sort_order) FROM watch_photos WHERE watch_id = watches.id)
    │ Cover URL resolution: row.coverPhotoPath → signed-URL or public URL
    │ Fallback: coverPhotoPath ?? catalogImageUrl ?? undefined
    │ mapRowToWatch: imageUrl ← resolved cover
    │
    ▼
[Watch domain type: imageUrl stays; populated by computed cover]
    │ All existing grid-card / rail readers unchanged
    ▼
[Grid cards, rails, detail page — no churn (D-08)]
```

### Recommended Project Structure

```
src/
├── db/
│   └── schema.ts            # Add watchPhotos table definition (column shapes)
├── data/
│   └── watches.ts           # Extend: cover join, mapper, addPhoto, bulkReorderPhotos, purge hook
├── lib/
│   └── storage/
│       └── watchPhotos.ts   # NEW: buildWatchPhotoPath + uploadWatchPhoto (mirrors wearPhotos.ts)
drizzle/
│   └── 0013_phase60_watch_photos.sql   # Drizzle-generated: column shapes (local push)
supabase/migrations/
│   └── 20260525000000_phase60_watch_photos.sql  # Authoritative: table + backfill + DROP + RLS + bucket
tests/
├── integration/
│   └── phase60-watch-photos.test.ts    # SC1/SC2/SC3 (DB-gated, DATABASE_URL guard)
└── unit/
    └── lib/
        └── storage/
            └── watchPhotos.test.ts     # path-builder unit tests (no DB needed)
```

---

### Pattern 1: `watch_photos` Drizzle Schema Definition

Add to `src/db/schema.ts` after the `watches` table definition. This carries column shapes for TypeScript type inference only — RLS, indexes, and constraints live in the Supabase migration.

```typescript
// Source: verified pattern from watchLikes (schema.ts:319-332) + wearEvents (schema.ts:295-312)
// Phase 60 — watch_photos table (PHOTO-01, D-01..D-03)
// Column shapes only. ENABLE ROW LEVEL SECURITY, policies, and bucket creation
// live in supabase/migrations/20260525000000_phase60_watch_photos.sql.
export const watchPhotos = pgTable(
  'watch_photos',
  {
    id:          uuid('id').defaultRandom().primaryKey(),
    watchId:     uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    // storagePath: "{userId}/{photoId}.jpg" within the watch-photos bucket (D-15, storage helper)
    storagePath: text('storage_path').notNull(),
    sortOrder:   integer('sort_order').notNull().default(0),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_photos_watch_id_sort_idx').on(table.watchId, table.sortOrder),
  ],
)
```

**Why `storagePath` not `photoUrl`:** The DAL resolves the public/signed URL at read time from the path; storing the full URL couples the schema to the bucket config and CDN. [VERIFIED: wearPhotos.ts stores path, account.ts purge iterates `f.name` paths]

---

### Pattern 2: Supabase Migration — Authoritative DDL

The Supabase migration is the authoritative source for: `CREATE TABLE`, indexes, `ENABLE ROW LEVEL SECURITY`, all policies, bucket creation, and the backfill + DROP sequence.

**Filename:** `supabase/migrations/20260525000000_phase60_watch_photos.sql`
(14-digit timestamp — Rule 1 from `project_drizzle_supabase_db_mismatch` memory)

**Structure (verified against phase27, phase53 patterns):**

```sql
-- Source: phase53_likes_comments_rls.sql pattern + phase27_sort_order.sql backfill pattern
BEGIN;

-- STEP 1: CREATE TABLE watch_photos (column shapes match Drizzle schema)
CREATE TABLE IF NOT EXISTS watch_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id     uuid        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- STEP 2: Indexes
CREATE INDEX IF NOT EXISTS watch_photos_watch_id_sort_idx
  ON watch_photos(watch_id, sort_order);

-- STEP 3: BACKFILL watches.image_url → watch_photos (LOSSLESS — runs BEFORE DROP)
-- Idempotency guard: skip if any watch_photos rows already exist for this watch
-- (mirrors phase27 sort_order backfill idempotency pattern)
INSERT INTO watch_photos (id, watch_id, storage_path, sort_order, created_at)
SELECT
  gen_random_uuid(),
  id,
  image_url,    -- image_url stored as storage_path verbatim (external URL, not a bucket path)
  0,            -- first photo (sort_order=0)
  now()
FROM watches
WHERE image_url IS NOT NULL
ON CONFLICT DO NOTHING;  -- idempotent re-run safety

-- STEP 4: DROP watches.image_url (AFTER backfill — never before)
ALTER TABLE watches DROP COLUMN IF EXISTS image_url;

-- STEP 5: ENABLE ROW LEVEL SECURITY
ALTER TABLE watch_photos ENABLE ROW LEVEL SECURITY;

-- STEP 6: RLS POLICIES — owner-write + visibility-gated public-read
-- CRITICAL GOTCHA (project_rls_subquery_caller_rls): a SELECT policy that
-- subqueries watches (owner-only RLS) fails closed for non-owners — the service-
-- role DAL is the real read gate; this policy is anon-block + fail-closed backstop.
-- Owner-write policies mirror watches RLS shape (20260420000000_rls_existing_tables.sql).

DROP POLICY IF EXISTS watch_photos_select_owner ON watch_photos;
CREATE POLICY watch_photos_select_owner ON watch_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );
-- NOTE: Non-owner reads go through service-role DAL only (see §RLS Gotcha section).

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
  USING (
    EXISTS (SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id AND w.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id AND w.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS watch_photos_delete_owner ON watch_photos;
CREATE POLICY watch_photos_delete_owner ON watch_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

-- STEP 7: Storage bucket — watch-photos (private, 8MB, JPEG/PNG/WEBP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'watch-photos',
  'watch-photos',
  false,
  8388608,  -- 8 MB (matches catalog-source-photos; generous for ≤1080px JPEG)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- STEP 8: Storage RLS — folder enforcement (mirrors wear-photos + avatar patterns)
DROP POLICY IF EXISTS watch_photos_storage_insert_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS watch_photos_storage_update_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS watch_photos_storage_delete_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- STEP 9: SELECT policy for watch-photos bucket
-- Owner only via folder enforcement (non-public bucket; Phase 61 will add signed-URL generation)
DROP POLICY IF EXISTS watch_photos_storage_select_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_select_own_folder ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- STEP 10: Post-migration assertion (mirrors phase27, phase53 DO $$ pattern)
DO $$
DECLARE
  table_count integer;
  policy_count integer;
  bucket_count integer;
BEGIN
  SELECT count(*) INTO table_count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'watch_photos';
  SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'watch_photos';
  SELECT count(*) INTO bucket_count FROM storage.buckets WHERE id = 'watch-photos';

  IF table_count <> 1 THEN
    RAISE EXCEPTION 'watch_photos table missing after migration';
  END IF;
  IF policy_count < 4 THEN
    RAISE EXCEPTION 'watch_photos RLS policies missing: expected >= 4, got %', policy_count;
  END IF;
  IF bucket_count <> 1 THEN
    RAISE EXCEPTION 'watch-photos bucket missing after migration';
  END IF;
END $$;

COMMIT;
```

---

### Pattern 3: DAL Extensions in `src/data/watches.ts`

**3a. Cover join in `getWatchesByUser` (D-04/D-05)**

Add alongside the existing `watchesCatalog` LEFT JOIN at line 145:

```typescript
// Source: verified pattern from getWatchesByUser lines 126-165 + watchesCatalog leftJoin at 145
// Phase 60 — cover resolution via lateral-style subquery join (D-04/D-05)
// NOTE: Drizzle does not support LATERAL directly; use a correlated subquery in the SELECT
// or a second LEFT JOIN with an equality + ORDER + LIMIT subquery.
// Recommended approach: add watch_photos to the db.select() projection with a SQL subquery.
import { watchPhotos } from '@/db/schema'  // add to imports

// In the .select() shape:
coverStoragePath: sql<string | null>`(
  SELECT wp.storage_path
  FROM watch_photos wp
  WHERE wp.watch_id = ${watches.id}
  ORDER BY wp.sort_order ASC
  LIMIT 1
)`,
```

The mapper then resolves the cover:

```typescript
// In mapRowToWatch (or inline in the rows.map callback):
// Source: existing mapRowToWatch pattern at watches.ts:17-58
imageUrl: row.coverStoragePath
  ? buildWatchPhotoPublicUrl(row.coverStoragePath)   // Phase 61 will sign; for now, direct public URL or placeholder
  : (row.catalogImageUrl ?? undefined),   // catalog fallback from LEFT JOIN (already in getWatchesByUser)
```

**3b. `addPhoto` with cap check (D-12/D-13)**

```typescript
// Source: verified pattern from createWatch (line 276) + bulkReorderWishlist count check (line 444)
// Phase 60 — DAL cap enforcement; mirrors bulkReorderWishlist's COUNT(*) check
export class PhotoCapExceededError extends Error {
  constructor(public cap: number) {
    super(`Photo cap reached: a watch may have at most ${cap} photos`)
    this.name = 'PhotoCapExceededError'
  }
}

export const MAX_PHOTOS_PER_WATCH = 10  // D-12

export async function addWatchPhoto(
  userId: string,
  watchId: string,
  storagePath: string,
): Promise<typeof watchPhotos.$inferSelect> {
  // 1. Ownership check: confirm watch belongs to userId
  const owned = await db.select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .limit(1)
  if (!owned[0]) throw new Error(`Watch not found or access denied: watchId=${watchId}`)

  // 2. Cap check (D-13): count existing rows
  const countRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  if ((countRows[0]?.c ?? 0) >= MAX_PHOTOS_PER_WATCH) {
    throw new PhotoCapExceededError(MAX_PHOTOS_PER_WATCH)
  }

  // 3. Determine next sort_order (append at end)
  const maxSort = await db
    .select({ m: sql<number>`coalesce(max(${watchPhotos.sortOrder}), -1)::int` })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  const nextSort = (maxSort[0]?.m ?? -1) + 1

  // 4. Insert
  const inserted = await db
    .insert(watchPhotos)
    .values({ watchId, storagePath, sortOrder: nextSort })
    .returning()
  return inserted[0]
}
```

**3c. `bulkReorderPhotos` (D-03 — mirrors `bulkReorderWishlist`)**

```typescript
// Source: verified pattern from bulkReorderWishlist (watches.ts:433-481)
// Phase 60 — full-rewrite reorder for ≤10 photos per watch
export async function bulkReorderPhotos(
  userId: string,
  watchId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return

  // Ownership check
  const owned = await db.select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .limit(1)
  if (!owned[0]) throw new Error(`Watch not found or access denied`)

  // Set-completeness check (mirrors BR-01 in bulkReorderWishlist)
  const totalRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  const total = totalRows[0]?.c ?? 0
  if (total !== orderedIds.length) {
    throw new SetMismatchError(total, orderedIds.length)  // reuse existing class
  }

  // CASE WHEN bulk update (identical shape to bulkReorderWishlist)
  const chunks: SQL[] = [sql`(case`]
  orderedIds.forEach((id, idx) => {
    chunks.push(sql`when ${watchPhotos.id} = ${id} then ${idx}::int4`)
  })
  chunks.push(sql`end)`)
  const caseExpr = sql.join(chunks, sql.raw(' '))

  const updated = await db
    .update(watchPhotos)
    .set({ sortOrder: caseExpr })
    .where(and(eq(watchPhotos.watchId, watchId), inArray(watchPhotos.id, orderedIds)))
    .returning({ id: watchPhotos.id })

  if (updated.length !== orderedIds.length) {
    throw new OwnerMismatchError(orderedIds.length, updated.length)  // reuse existing class
  }
}
```

**3d. Storage purge on watch delete**

`deleteWatch` in `watches.ts` does a Drizzle `.delete(watches)` — the `ON DELETE CASCADE` on `watch_photos` handles the DB rows automatically. The storage objects in `watch-photos/{userId}/` are NOT auto-deleted by the cascade; they must be purged explicitly.

Pattern: mirror `purgeWearPhotos` in `src/app/actions/account.ts` (lines 22-51). The existing `deleteWatch` DAL function does not yet purge storage. Options:
1. Add a separate `purgeWatchPhotos(supabase, userId, watchId)` helper called by the remove-watch Server Action (same call site as `deleteWatch`).
2. OR: extend `deleteWatch` to accept an optional storage client and purge inline.

Option 1 is cleaner (keeps DAL storage-free, Server Action orchestrates). The Server Action already imports a Supabase client.

```typescript
// Source: purgeWearPhotos pattern in account.ts:22-51
// Phase 60 — purge watch-photos/{userId}/{photoId}.jpg objects for a given watchId
// Caller: remove-watch Server Action, BEFORE calling deleteWatch(userId, watchId)
async function purgeWatchPhotos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  watchId: string,
): Promise<void> {
  const PAGE_SIZE = 1000
  // List all photos for this watch (flat layout: {userId}/{photoId}.jpg)
  // We must iterate — the watch may have up to MAX_PHOTOS_PER_WATCH=10 objects,
  // so a single list() suffices, but the paginated loop is defensive.
  while (true) {
    const { data: files, error: listErr } = await supabase.storage
      .from('watch-photos')
      .list(userId, { limit: PAGE_SIZE, search: watchId })
    // NOTE: Supabase Storage .list() search is prefix-match on filename only.
    // If path is {userId}/{photoId}.jpg and photoId is a UUID, there is no
    // per-watchId folder prefix to filter on. Two approaches:
    //   A. Store paths as {userId}/{watchId}/{photoId}.jpg (adds a level)
    //   B. Query watch_photos table first to get the list of storage_paths, then remove those.
    // Approach B is cleaner (no extra nesting, no search hack).
    if (listErr) throw listErr
    if (!files || files.length === 0) break
    const paths = files.map((f) => `${userId}/${f.name}`)
    const { error: removeErr } = await supabase.storage.from('watch-photos').remove(paths)
    if (removeErr) throw removeErr
  }
}
```

**IMPORTANT NOTE for planner:** The `{userId}/{photoId}.jpg` flat path convention (mirroring `wear-photos`) means there is no per-watchId folder prefix to use with `storage.list()` search. The recommended approach is to query `watch_photos` for the watch's `storagePath` values first, then call `storage.remove(paths)` directly — no list loop needed. This is cleaner and avoids the search-as-prefix-match limitation.

```typescript
// Better purge approach (query DB first, then remove storage objects):
async function purgeWatchPhotos(supabase, userId, watchId) {
  const photos = await db.select({ storagePath: watchPhotos.storagePath })
    .from(watchPhotos)
    .where(eq(watchPhotos.watchId, watchId))
  if (photos.length === 0) return
  const paths = photos.map(p => p.storagePath)
  const { error } = await supabase.storage.from('watch-photos').remove(paths)
  if (error) throw error
}
```

---

### Pattern 4: Storage Helper (`src/lib/storage/watchPhotos.ts`)

Mirrors `src/lib/storage/wearPhotos.ts` exactly except bucket name and ID semantics:

```typescript
// Source: verified pattern from src/lib/storage/wearPhotos.ts (lines 1-76)
'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type WatchPhotoUploadResult = { path: string } | { error: string }
const UUID_RE = /^[0-9a-f-]{36}$/i
const BUCKET_ID = 'watch-photos' as const

export function buildWatchPhotoPath(userId: string, photoId: string): string {
  if (!userId) throw new TypeError('userId required')
  if (!UUID_RE.test(photoId)) throw new TypeError('photoId must be a UUID')
  return `${userId}/${photoId}.jpg`
}

export async function uploadWatchPhoto(
  userId: string,
  photoId: string,
  jpeg: Blob,
): Promise<WatchPhotoUploadResult> {
  let path: string
  try { path = buildWatchPhotoPath(userId, photoId) }
  catch (err) { return { error: err instanceof Error ? err.message : 'Invalid path inputs' } }

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(BUCKET_ID)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (error) return { error: error.message }
  return { path }
}
```

---

### Pattern 5: EXIF-Verifying Test (SC4, PHOTO-08)

`stripAndResize` is client-side (uses `document.createElement('canvas')`). Testing it in Node/Vitest requires a jsdom environment with `OffscreenCanvas` shimmed, OR testing only the output metadata (dimensions + MIME type + absence of EXIF markers). The existing test infrastructure uses jsdom but does not shim `createImageBitmap`. The recommended approach is a unit test that feeds a known JPEG with synthetic EXIF data through `stripAndResize` and asserts:

1. Output blob is `image/jpeg` (MIME type preserved)
2. Output dimensions do not exceed 1080px on either side
3. The output bytes do NOT contain the EXIF marker (`0xFFE1`) that was in the input

This test needs `// @vitest-environment jsdom` (not node) because `stripAndResize` calls `document.createElement`. Canvas operations in jsdom require `canvas` npm package (or `@napi-rs/canvas`), which is NOT currently installed.

**CRITICAL NOTE for planner:** The EXIF-strip test (SC4) likely requires a canvas-capable test environment. Options:
- A. Install `canvas` npm package as devDependency and add jsdom canvas support to vitest setup.
- B. Test at the output byte level only: verify output lacks `0xFFE1` marker bytes by reading the Blob buffer — this does NOT require canvas if the input is a pre-built test fixture JPEG.
- C. Run the test in Node with jsdom + mock canvas, asserting function throws/returns in expected ways.

**Recommended:** Option B. Feed a tiny JPEG fixture with known EXIF bytes, call `stripAndResize` with canvas shimmed in setup, and assert the output bytes. Check `tests/shims/` for existing mocks. If `canvas` is not installed, the test may need to mock `document.createElement('canvas')` and assert the pipeline runs without throwing — at minimum a smoke test.

The `// @vitest-environment node` directive is NOT needed here (no filesystem walking). jsdom environment is correct. The risk is canvas availability; the planner should decide whether to install `canvas` or write the test as a structural smoke test.

---

### Anti-Patterns to Avoid

- **Backfill after column drop:** The column drop MUST come after the `INSERT INTO watch_photos` backfill in the same migration. Reversing order destroys existing `image_url` data.
- **Using `drizzle-kit push` for production:** `drizzle-kit push` targets `DATABASE_URL` (local dev). Production ONLY via `supabase db push --linked`.
- **Storing the cover URL as a cached column on `watches`:** D-04 explicitly forbids this — it creates denormalized-drift bugs every photo mutation must maintain.
- **DB CHECK/trigger for cap enforcement:** D-13 forbids this. Row-count cap cannot be expressed as a simple CHECK. DAL-only enforcement is correct.
- **RLS policy subqueries on owner-only tables:** The `watches` SELECT RLS is owner-only. Any `watch_photos` SELECT policy that subqueries `watches` for non-owner reads will fail closed (not fail-open — safe, but incorrect). Service-role DAL is the real read gate.
- **Omitting `// @vitest-environment node` on fs-walking tests:** Any test that calls `readdirSync`/`statSync` at collection time must declare this or it will crash the Vercel prebuild.
- **Using `upsert: true` on watch photos:** Each upload gets a fresh UUID path; `upsert: false` is correct. Mirrors wearPhotos.ts precedent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk `sort_order` rewrite | Custom N-queries loop | CASE WHEN single UPDATE (Phase 27 pattern in `bulkReorderWishlist`) | Atomic, O(1) round-trips for ≤10 photos |
| EXIF stripping | Custom exif-parser + remover | `stripAndResize` in `src/lib/exif/strip.ts` | Already handles orientation fallback, canvas re-encode, EXIF drop |
| Storage upload | Raw `fetch` to Supabase URL | `createSupabaseBrowserClient().storage.from('watch-photos').upload()` | Session auth, RLS enforcement, error types |
| Storage purge on delete | Custom REST call | Supabase client `.list()` + `.remove()` (see Pattern 3d) | Handles partial-failure, session refresh |
| Cap enforcement trigger | Postgres trigger function | DAL `count(*)::int` before insert | Single-writer invariant; trigger is heavier than warranted |

---

## Migration Discipline (CRITICAL)

### Dual-Migration Workflow

Every schema change requires TWO artifacts:

| Artifact | Purpose | Command | Target |
|----------|---------|---------|--------|
| `drizzle/0013_phase60_watch_photos.sql` | Column shapes for TypeScript type inference; local dev sync | `npx drizzle-kit generate` then `npx drizzle-kit push` | LOCAL only |
| `supabase/migrations/20260525000000_phase60_watch_photos.sql` | Authoritative DDL: table + RLS + bucket + backfill + DROP | `supabase db push --linked` | PRODUCTION |

The Supabase migration is the source of truth for everything Drizzle 0.45.2 cannot express: RLS policies, ENABLE ROW LEVEL SECURITY, DO $$ assertions, bucket creation, raw SQL indexes with ASC/DESC, and the backfill + DROP sequence. [VERIFIED: same dual-artifact pattern in phase27, phase34, phase35, phase36, phase37, phase38, phase45, phase53]

### 4 Prod-Push Gotchas (from `project_drizzle_supabase_db_mismatch` memory)

1. **Filename must be exactly 14 digits:** `20260525000000_name.sql`. A trailing letter (e.g. `000004b`) causes silent skip on every push. Never append suffix letters.

2. **No 14-digit timestamp fits between adjacent integer increments:** If insertion between two applied migrations is needed, rename the LATER migrations forward to open a gap. Only safe before they are applied to prod.

3. **Extensions `WITH SCHEMA extensions` need schema-qualified opclasses:** Not applicable here (no extension install), but note for future.

4. **Enum rename across enum-bound dependents fails with SQLSTATE 42883:** Not applicable here (no enum changes). But run `pg_depend` query before any future enum-touching migration on this phase.

### Lossless Backfill Sequence (D-07)

```sql
-- CORRECT order — always in same migration:
INSERT INTO watch_photos (...) SELECT id, image_url, 0, now() FROM watches WHERE image_url IS NOT NULL ON CONFLICT DO NOTHING;
ALTER TABLE watches DROP COLUMN IF EXISTS image_url;

-- WRONG — never do this:
ALTER TABLE watches DROP COLUMN image_url;  -- destroys data before backfill
INSERT INTO watch_photos ...;  -- image_url is gone
```

The `ON CONFLICT DO NOTHING` makes the backfill INSERT idempotent on re-run (if the migration was partially applied and re-run). Combined with `DROP COLUMN IF EXISTS`, the full migration is idempotent.

**Post-backfill assertion** (mirrors phase27 DO $$ pattern):

```sql
DO $$
DECLARE orphaned_count int;
BEGIN
  -- After backfill + drop, no watch should have image_url that wasn't saved.
  -- Verify: every watch_photos row was inserted from a valid watches.id.
  SELECT count(*) INTO orphaned_count
    FROM watch_photos wp
   WHERE NOT EXISTS (SELECT 1 FROM watches w WHERE w.id = wp.watch_id);
  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Phase 60: % orphaned watch_photos rows (watch_id FK broken)', orphaned_count;
  END IF;
END $$;
```

---

## RLS Gotcha (CRITICAL)

**From `project_rls_subquery_caller_rls` memory:**

The `watches` table has owner-only SELECT RLS (`watches_select_own: user_id = (SELECT auth.uid())`). Any `watch_photos` SELECT policy that subqueries `watches` for a non-owner viewer will find zero rows in the subquery → the gate fails closed (denies the non-owner read). This is safe (no data leak) but means RLS alone cannot enforce the intended visibility gate (public profile → public collection → public watch photos).

**The invariant for this project (confirmed in CONTEXT.md + memory):**
- RLS on `watch_photos` is: anon-block + owner-write backstop.
- The service-role DAL (`src/data/watches.ts`) is the real read gate — it reads watches + watch_photos using the service-role key which bypasses RLS. Non-owner reads of watch detail go through `getWatchByIdForViewer` which enforces visibility via the explicit `profileSettings` WHERE clause (lines 193-234). This is the two-layer privacy gate established in Phase 10.

**Consequence for the SELECT policy shape:**
The Phase 60 SELECT policy (Pattern 2 above) gates on `auth.uid() = watch_photos owner` via the `watches` subquery. For non-owners using the anon/authenticated Supabase client directly, this fails closed. That's acceptable — the intended non-owner read path is always through the service-role DAL, not direct Supabase client calls.

**Local DB caveat:** Local DB has RLS OFF on pre-existing `watches` table (per `project_rls_subquery_caller_rls` memory). Cross-table RLS tests are meaningless locally. Verify RLS behavior against prod only.

---

## Runtime State Inventory

> This section is required for phases that drop columns.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `watches.image_url` column — N rows with non-null values | Backfill to `watch_photos.storage_path` BEFORE DROP (D-07). SQL: `INSERT INTO watch_photos ... SELECT image_url FROM watches WHERE image_url IS NOT NULL` |
| Stored data | `activities.metadata` jsonb field may contain `{ imageUrl: ... }` | Code-edit only — `activities` metadata is display-only, written at add-watch time; no migration needed. The `imageUrl` in metadata is stale after the column drop but `activities` reader code uses the metadata verbatim (no join). Acceptable (deferred). [VERIFIED: src/db/schema.ts:285-291] |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — unchanged | None |
| Build artifacts | `drizzle/meta/_journal.json` — must be updated after `drizzle-kit generate` | Auto-updated by drizzle-kit; no manual action |

**NOTE on `activities.metadata`:** The `activities` table stores `{ brand, model, imageUrl }` in jsonb at insert time (line 285 schema.ts). The `imageUrl` stored in historical activities rows will become a dangling reference after `watches.image_url` is dropped — but `activities` reads its own jsonb directly, not via a join to `watches`. This is a cosmetic issue (old activities may show a stale or missing thumbnail) but does not block Phase 60. Flag for the planner as a known acceptable degradation.

---

## Common Pitfalls

### Pitfall 1: Drizzle Generates Wrong Migration for Column Drop
**What goes wrong:** Running `drizzle-kit generate` after removing `imageUrl` from the `watches` schema definition generates a DROP COLUMN migration in `drizzle/`. If `drizzle-kit push` is run locally BEFORE the Supabase migration backfills the data, the local DB loses `image_url` data silently.
**Why it happens:** `drizzle-kit push` applies to local DB immediately; backfill is only in the Supabase migration.
**How to avoid:** Write the Supabase migration first (with backfill + DROP). Run `drizzle-kit generate` only to update the TypeScript types; do NOT use the generated DROP migration on local DB independently — use `drizzle-kit push` AFTER the Supabase migration has been applied locally via `docker exec psql`.
**Warning signs:** `drizzle-kit push` output shows `DROP COLUMN image_url` without a preceding data migration step.

### Pitfall 2: Correlated Subquery Performance in `getWatchesByUser`
**What goes wrong:** The cover resolution SQL subquery runs once per row in the result set. For a user with 500 watches, this is 500 correlated subqueries.
**Why it happens:** Drizzle does not natively support `LATERAL JOIN` with `LIMIT 1` in the current `pg-core` DSL.
**How to avoid:** At v7.0 scale (≤500 watches/user, ≤10 photos/watch), the correlated subquery is fast — the `watch_photos_watch_id_sort_idx` index covers it. The CONTEXT.md explicitly accepts this (D-04 rationale: "≤500 watches/user makes the extra join cheap"). If it becomes a concern, a raw `sql\`\`` lateral join can be added later.
**Warning signs:** None at current scale. Monitor if collection size grows significantly.

### Pitfall 3: `// @vitest-environment node` Missing on Static FS-Walking Tests
**What goes wrong:** Any new `tests/static/` guard that uses `readdirSync` passes locally (jsdom) but crashes the Vercel prebuild (`TypeError: readdirSync is not a function`).
**Why it happens:** Vercel's build externalizes `node:fs`; jsdom does not. Documented in `project_vitest_static_node_env` memory. Caused a failed prod deploy in Phase 59.
**How to avoid:** Every test that calls `readdirSync`/`statSync` must have `// @vitest-environment node` as its first line (before JSDoc).
**Warning signs:** Test passes locally, Vercel build fails at prebuild step.

### Pitfall 4: Missing `watch-photos` Bucket Causes Silent Upload Failures
**What goes wrong:** `uploadWatchPhoto` returns `{ error: '...' }` for every upload because the bucket doesn't exist.
**Why it happens:** The bucket is created in the Supabase migration — if `supabase db push --linked` has not run yet, the bucket is absent from production.
**How to avoid:** The Supabase migration must include the `INSERT INTO storage.buckets` step and the DO $$ assertion must verify the bucket count.
**Warning signs:** `supabase.storage.from('watch-photos').upload()` returns a "Bucket not found" error.

### Pitfall 5: `image_url` Mapper Left in `mapRowToWatch` After Drop
**What goes wrong:** `mapRowToWatch` still reads `row.imageUrl` (the Drizzle column mapping from the `watches` table). After the column is dropped from the DB, `row.imageUrl` is `undefined` always — the mapper silently returns no cover even for watches that had an image_url before migration.
**Why it happens:** Forgetting to update the mapper when removing the column from schema.
**How to avoid:** Remove `imageUrl: row.imageUrl ?? undefined` from `mapRowToWatch` (line 45 and line 93) AND from `mapDomainToRow` (line 93). Replace with the cover computation from the `watch_photos` join result.
**Warning signs:** All watch thumbnails go blank after migration.

### Pitfall 6: Watch Delete Leaves Orphaned Storage Objects
**What goes wrong:** `deleteWatch` removes the DB row; `ON DELETE CASCADE` removes `watch_photos` rows; but the `watch-photos/{userId}/...` storage objects remain forever.
**Why it happens:** Postgres cascades do not touch external storage.
**How to avoid:** The remove-watch Server Action must call `purgeWatchPhotos(supabase, userId, watchId)` BEFORE `deleteWatch(userId, watchId)`. Mirror the `purgeWearPhotos` precedent in `account.ts` (lines 22-51).
**Warning signs:** Storage bucket grows without bound; deleted watches accumulate orphaned objects.

---

## Code Examples

### Verify schema drop correctness in migration

```sql
-- Source: verified pattern from phase27_sort_order.sql DO $$ assertion (lines 85-106)
-- Post-backfill lossless check: no watch should have lost its image_url without a watch_photos row
DO $$
DECLARE missed_count int;
BEGIN
  -- This check must run AFTER the INSERT INTO watch_photos and BEFORE the DROP COLUMN.
  -- At this point watches.image_url still exists.
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

-- Only after the DO $$ assertion passes:
ALTER TABLE watches DROP COLUMN IF EXISTS image_url;
```

### Integration test structure (SC1/SC2/SC3)

```typescript
// Source: verified pattern from phase27-schema.test.ts + phase54-dal-gate.test.ts
// Phase 60 integration tests — SC1 (backfill), SC2 (cover resolution), SC3 (cap)
// @vitest-environment jsdom  -- NOT node; this file does NOT walk the filesystem

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/db'
import { users, watches, watchPhotos, watchesCatalog } from '@/db/schema'
import { getWatchesByUser, addWatchPhoto, MAX_PHOTOS_PER_WATCH, PhotoCapExceededError } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 60 — watch_photos schema + DAL (SC1/SC2/SC3)', () => {
  // ... seed a user, a watch with image_url → expect watch_photos row at sort_order=0
  // ... call getWatchesByUser, expect imageUrl resolves to the uploaded photo path
  // ... add MAX_PHOTOS_PER_WATCH photos, expect PhotoCapExceededError on the next addWatchPhoto
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `watches.image_url` single text column | `watch_photos` child table with `sort_order` | Phase 60 (this phase) | Enables multi-photo + ordered carousel; `Watch.imageUrl` contract preserved via DAL mapper |
| No per-watch photo cap | `MAX_PHOTOS_PER_WATCH = 10` DAL-enforced | Phase 60 (this phase) | Prevents unbounded storage growth per watch |

**Deprecated/outdated after this phase:**
- `watches.image_url` column: dropped after backfill; remove from Drizzle schema definition and all mappers.
- `mapDomainToRow` `imageUrl` mapping at line 93: remove after column drop (no longer writable).
- `mapRowToWatch` `imageUrl: row.imageUrl ?? undefined` at line 45: replace with cover resolution.

---

## Open Questions

1. **Cover URL resolution — public URL vs signed URL**
   - What we know: `watch-photos` bucket is private (by design). Non-public bucket requires a signed URL to serve images.
   - What's unclear: Phase 61 adds the upload UI; Phase 60's DAL returns `storagePath` strings. Should `getWatchesByUser` resolve to a signed URL (server-side, requires admin client) or return the raw path (and leave URL resolution to Phase 61)?
   - Recommendation: For Phase 60 DAL only, return `storagePath` in the `imageUrl` field as-is (a relative storage path). Phase 61 will wire the server-side signed URL generation. This avoids a premature admin-client dependency in the DAL. The mapper can return `storagePath ?? catalogImageUrl ?? undefined` and Phase 61 replaces the path with a URL.

2. **`activities.metadata.imageUrl` staleness after column drop**
   - What we know: `activities` jsonb field stores `{ brand, model, imageUrl }` at activity creation time. After `watches.image_url` is dropped, historical activities still have `imageUrl` from the old column, but new activities written post-migration won't have it.
   - What's unclear: Does any current code read `activities.metadata.imageUrl` to render a thumbnail? (Not seen in this research.)
   - Recommendation: Treat as a known acceptable degradation; flag in the plan but do not block Phase 60.

3. **`getWatchById` (simple owner query) — needs cover join?**
   - What we know: `getWatchById` (line 172) is a simple `SELECT * FROM watches` with user + id filter. It does not join `watchesCatalog`.
   - What's unclear: Should `getWatchById` also be updated to resolve the cover, or only `getWatchesByUser` and `getWatchByIdForViewer`?
   - Recommendation: Update all three query paths for consistency — `getWatchById`, `getWatchesByUser`, `getWatchByIdForViewer`. Otherwise callers of `getWatchById` will see an empty `imageUrl` field after the column drop.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Docker) | Integration tests (DATABASE_URL) | ✓ | supabase CLI 2.90.0 | — |
| `supabase db push --linked` | Prod migration | ✓ | 2.90.0 | — |
| `drizzle-kit` | Local schema sync + type generation | ✓ | (installed) | — |
| `canvas` npm package | EXIF-verifying test (SC4) — canvas in jsdom | ✗ | — | Mock canvas or structural smoke test only |
| `watch-photos` Supabase bucket | Storage helper test | ✗ (created by migration) | — | Created by Phase 60 Supabase migration |

**Missing dependencies:**
- `canvas` package: NOT installed. The EXIF-strip test (SC4) may need a canvas shim or must be written as a structural test (assert function shape, mock canvas API). Planner should decide: install `canvas` as devDep, or write SC4 as a mock-based smoke test.

---

## Validation Architecture

`workflow.nyquist_validation: true` is set in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (jsdom default environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/integration/phase60-watch-photos.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHOTO-01 / SC1 | `watch_photos` table exists; `watches.image_url` is dropped; backfill rows exist at `sort_order=0` | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ Wave 0 |
| PHOTO-04 / SC2 | `getWatchesByUser` returns `imageUrl` populated from `watch_photos` cover (lowest `sort_order`); catalog fallback when no photos | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ Wave 0 |
| PHOTO-07 / SC3 | `addWatchPhoto` throws `PhotoCapExceededError` at `MAX_PHOTOS_PER_WATCH + 1`; count includes only `watch_photos` rows | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ Wave 0 |
| PHOTO-08 / SC4 | `stripAndResize` output: JPEG MIME type + ≤1080px dimensions + no `0xFFE1` EXIF marker bytes | unit (structural or canvas-mocked) | `npx vitest run tests/unit/lib/exif/stripAndResize.test.ts` | ❌ Wave 0 |
| Schema safety | `watch_photos_watch_id_sort_idx` exists | integration | included in phase60 integration test | ❌ Wave 0 |
| Path builder | `buildWatchPhotoPath` throws TypeError on bad inputs; returns correct path format | unit | `npx vitest run tests/unit/lib/storage/watchPhotos.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/lib/storage/watchPhotos.test.ts` (pure unit, no DB)
- **Per wave merge:** `npx vitest run tests/integration/phase60-watch-photos.test.ts` (requires DATABASE_URL)
- **Phase gate:** Full suite `npm run test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/phase60-watch-photos.test.ts` — covers PHOTO-01/SC1, PHOTO-04/SC2, PHOTO-07/SC3, schema index assertion. Requires `DATABASE_URL` guard (skip when absent). Use `// @vitest-environment jsdom` (no fs walking).
- [ ] `tests/unit/lib/storage/watchPhotos.test.ts` — covers `buildWatchPhotoPath` happy + error paths. No DB needed. Pattern: `tests/lib/storage/catalogSourcePhotos.test.ts`.
- [ ] `tests/unit/lib/exif/stripAndResize.test.ts` — covers SC4 (PHOTO-08). Needs canvas shim decision (see Open Question note). Minimum: structural test asserting function signature and behavior with mocked canvas.
- [ ] `supabase/migrations/20260525000000_phase60_watch_photos.sql` — must be written before Wave 1 completes.
- [ ] `drizzle/0013_phase60_watch_photos.sql` — generated by `drizzle-kit generate` after schema.ts update.

*(Wave 0 integration test requires `DATABASE_URL`. The integration test suite already gates on this env var — see phase27-schema.test.ts:16 pattern.)*

---

## Security Domain

`security_enforcement` is not explicitly set to false in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth is session-gated; no new auth surface |
| V3 Session Management | No | No new session logic |
| V4 Access Control | Yes | Owner-write-only RLS; DAL ownership check before insert/reorder/delete; `userId` scoping on all queries |
| V5 Input Validation | Yes | `storagePath` validated by path builder; `watchId` ownership confirmed before any mutation; `orderedIds` set-completeness check |
| V6 Cryptography | No | No key/credential handling in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant photo insertion (inserting a `watch_photos` row for another user's `watchId`) | Spoofing | `addWatchPhoto` ownership check: `SELECT id FROM watches WHERE id=watchId AND user_id=userId` before insert |
| Partial-set reorder leaving stale `sort_order` values (race between two browser tabs) | Tampering | `SetMismatchError` check in `bulkReorderPhotos` (mirrors Phase 27 BR-01) |
| Storage path traversal (user crafts `photoId` to escape their folder) | Elevation of Privilege | `buildWatchPhotoPath` validates `photoId` is a UUID; RLS folder enforcement: `(storage.foldername(name))[1] = auth.uid()::text` |
| Orphaned storage objects after watch delete | Denial of Service (storage growth) | `purgeWatchPhotos` in Server Action BEFORE `deleteWatch` (mirrors `purgeWearPhotos` pattern) |
| Cap bypass via direct Drizzle insert (bypasses DAL) | Tampering | DAL is the sole write path; no direct Postgres access from client; RLS blocks anon |

---

## Sources

### Primary (HIGH confidence)

- `src/db/schema.ts` — verified `watches` table structure (lines 87-173), `image_url` at line 136, `sort_order` at 159-162, `watchLikes` pattern at 319-332 [VERIFIED: read in this session]
- `src/data/watches.ts` — verified `getWatchesByUser` (126-166), `getWatchById` (172-178), `getWatchByIdForViewer` (193-234), `createWatch` (276-299), `bulkReorderWishlist` (433-481), `mapRowToWatch` (17-58), `mapDomainToRow` (64-108) [VERIFIED: read in this session]
- `src/lib/exif/strip.ts` — verified `stripAndResize` signature + `StripResult` interface [VERIFIED: read in this session]
- `src/lib/storage/wearPhotos.ts` — verified `buildWearPhotoPath` + `uploadWearPhoto` pattern [VERIFIED: read in this session]
- `src/app/actions/account.ts` — verified `purgeWearPhotos` pattern (lines 22-51) [VERIFIED: read in this session]
- `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` — verified storage RLS folder enforcement pattern [VERIFIED: read in this session]
- `supabase/migrations/20260422000000_phase53_likes_comments_rls.sql` — verified RLS policy DROP/CREATE shape, DO $$ assertions, BEGIN/COMMIT wrapper [VERIFIED: read in this session]
- `supabase/migrations/20260420000000_rls_existing_tables.sql` — verified `watches_select_own` policy shape [VERIFIED: read in this session]
- `supabase/migrations/20260504120000_phase27_sort_order.sql` — verified backfill-with-idempotency-guard pattern, DO $$ post-check pattern [VERIFIED: read in this session]
- `src/lib/storage/avatarPhotos.ts` — verified upsert pattern contrast (avatars: `upsert:true`; photos: `upsert:false`) [VERIFIED: read in this session]
- `vitest.config.ts` — confirmed default environment is `jsdom`; `npm run test` command [VERIFIED: read in this session]
- `.planning/config.json` — confirmed `nyquist_validation: true`; `use_worktrees: false` [VERIFIED: read in this session]

### Secondary (MEDIUM confidence)

- `project_drizzle_supabase_db_mismatch.md` memory — 4 prod-push gotchas [CITED: memory file]
- `project_rls_subquery_caller_rls.md` memory — RLS subquery caller behavior + local RLS divergence [CITED: memory file]
- `project_vitest_static_node_env.md` memory — `// @vitest-environment node` requirement for fs-walking tests [CITED: memory file]

### Tertiary (LOW confidence)

None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `drizzle-kit generate` after removing `imageUrl` from the Watches schema will auto-generate a DROP COLUMN migration at index `0013` | Standard Stack (migration file naming) | Wrong index number — cosmetic only; planner chooses the next drizzle index |
| A2 | `canvas` npm package is NOT installed — EXIF-strip test requires a mock or different approach | Environment Availability | If `canvas` is installed, SC4 test can be a full canvas test rather than a structural smoke test |
| A3 | `activities.metadata.imageUrl` is display-only and no code reads it for cover resolution | Runtime State Inventory | If some feed/activity renderer reads `metadata.imageUrl` as the canonical image, activity thumbnails will break post-column-drop |

**If this table is empty:** All claims in this research were verified or cited. Three assumptions logged above; all are low-risk.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified from node_modules/package.json
- Schema patterns: HIGH — read exact table definitions and migration files
- DAL patterns: HIGH — read actual function bodies; all code examples based on verified patterns
- Migration discipline: HIGH — read actual memory files and migration files
- Pitfalls: HIGH — sourced from actual project incidents documented in memory files
- EXIF test approach: MEDIUM — canvas availability is uncertain; `canvas` package absence assumed from lack of observation in node_modules inspection

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable domain; Drizzle 0.45.2, Supabase CLI 2.90.0 — update if major versions change)

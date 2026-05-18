# Phase 45: CMS Data Model + Admin Routes - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 16 new/modified files
**Analogs found:** 16 / 16

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260518200000_phase45_cms_tables.sql` | migration | batch | `supabase/migrations/20260420000001_social_tables_rls.sql` | exact |
| `supabase/migrations/20260518210000_phase45_cms_covers_bucket.sql` | migration | batch | `supabase/migrations/20260516000000_phase43_avatar_bucket.sql` + `20260517000000_phase43_avatar_select_policy.sql` | exact |
| `src/db/schema.ts` (modified — 5 new tables + `is_admin`) | model | CRUD | `src/db/schema.ts` existing tables (watchLineageEdges, follows, notifications) | self |
| `src/lib/auth.ts` (modified — add `assertOwner()`) | utility | request-response | `src/lib/auth.ts` `getCurrentUser()` | self/exact |
| `src/data/curatedLists.ts` | service | CRUD | `src/data/profiles.ts` | role-match |
| `src/data/collectionPaths.ts` | service | CRUD | `src/data/profiles.ts` | role-match |
| `src/data/cmsSettings.ts` | service | CRUD | `src/data/profiles.ts` | role-match |
| `src/app/actions/cms/curatedLists.ts` | service | request-response | `src/app/actions/profile.ts` | exact |
| `src/app/actions/cms/collectionPaths.ts` | service | request-response | `src/app/actions/profile.ts` | exact |
| `src/app/actions/cms/settings.ts` | service | request-response | `src/app/actions/notifications.ts` | role-match |
| `src/lib/storage/cmsCovers.ts` | utility | file-I/O | `src/lib/storage/avatarPhotos.ts` | exact |
| `src/app/admin/layout.tsx` | middleware | request-response | `src/app/settings/page.tsx` (auth redirect pattern) | role-match |
| `src/app/admin/lists/page.tsx` | component | CRUD | `src/app/settings/page.tsx` | role-match |
| `src/app/admin/lists/[id]/page.tsx` | component | CRUD | `src/app/settings/page.tsx` | role-match |
| `src/app/admin/paths/page.tsx` | component | CRUD | `src/app/settings/page.tsx` | role-match |
| `src/app/admin/paths/[id]/page.tsx` | component | CRUD | `src/app/settings/page.tsx` | role-match |

---

## Pattern Assignments

### `supabase/migrations/20260518200000_phase45_cms_tables.sql` (migration, batch)

**Analog:** `supabase/migrations/20260420000001_social_tables_rls.sql`

**RLS policy naming and InitPlan wrapper** (lines 1–42):
```sql
-- Naming convention: {table}_{operation}_own
-- auth.uid() always wrapped in (SELECT auth.uid()) for InitPlan optimization
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_delete_own ON public.profiles
  FOR DELETE TO authenticated
  USING (id = (SELECT auth.uid()));
```

**CMS two-policy SELECT pattern (non-owner published + owner all)** — derived from RESEARCH.md Pattern 4:
```sql
-- Non-owner public read: published only (D-03 layer 1)
CREATE POLICY curated_lists_select_published ON public.curated_lists
  FOR SELECT TO authenticated, anon
  USING (status = 'published');

-- Owner read: all rows including drafts (D-03 owner-scoped SELECT)
CREATE POLICY curated_lists_select_own ON public.curated_lists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );
```

**Owner write pattern (INSERT/UPDATE/DELETE)** — EXISTS predicate from D-02:
```sql
CREATE POLICY curated_lists_insert_own ON public.curated_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY curated_lists_update_own ON public.curated_lists
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

CREATE POLICY curated_lists_delete_own ON public.curated_lists
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );
```

**`is_admin` column + email-keyed seed UPDATE** (D-01, D-04):
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles
   SET is_admin = true
 WHERE id = (SELECT id FROM auth.users WHERE email = 'twwaneka@gmail.com');
```

**path_type CHECK constraint** (D-17 — not expressible in Drizzle DSL):
```sql
-- After CREATE TABLE collection_paths:
ALTER TABLE public.collection_paths
  ADD CONSTRAINT collection_paths_path_type_check
  CHECK (path_type IN ('Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'));
```

**cms_settings single-row enforcement + seed row**:
```sql
ALTER TABLE public.cms_settings ADD CONSTRAINT cms_settings_single_row CHECK (id = 1);
INSERT INTO public.cms_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

**DO $$ sanity assertion block** — analog from `20260516000000_phase43_avatar_bucket.sql` lines 68–87:
```sql
DO $$
DECLARE
  col_count integer;
  table_count integer;
BEGIN
  SELECT count(*) INTO col_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profiles'
     AND column_name = 'is_admin';
  IF col_count <> 1 THEN
    RAISE EXCEPTION 'phase 45: profiles.is_admin column missing';
  END IF;
  -- Similar checks for each of the 5 CMS tables
END $$;
```

---

### `supabase/migrations/20260518210000_phase45_cms_covers_bucket.sql` (migration, batch)

**Analog:** `supabase/migrations/20260516000000_phase43_avatar_bucket.sql` (lines 16–88) + `supabase/migrations/20260517000000_phase43_avatar_select_policy.sql` (lines 32–64)

**Bucket creation** (analog lines 22–30):
```sql
-- cms-covers: public bucket, 4 MB limit, JPEG/PNG/WEBP
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cms-covers', 'cms-covers', true, 4194304,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

**4-policy RLS pattern** — The `cms-covers` bucket replaces the folder-owner predicate with an `is_admin` EXISTS predicate (since only the owner writes). Copy the structure from the avatar bucket but swap the `USING`/`WITH CHECK` predicate. The SELECT policy is mandatory because the upload uses `upsert: false` (still does an object lookup), and Phase 43 hit this exact bug (see `20260517000000`):
```sql
-- SELECT — required for Supabase Storage upsert object lookup (Pitfall 2 from RESEARCH.md)
DROP POLICY IF EXISTS cms_covers_select_own ON storage.objects;
CREATE POLICY cms_covers_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cms-covers'
    AND EXISTS (SELECT 1 FROM public.profiles
                WHERE id = (SELECT auth.uid()) AND is_admin)
  );

-- INSERT
DROP POLICY IF EXISTS cms_covers_insert_own ON storage.objects;
CREATE POLICY cms_covers_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cms-covers'
    AND EXISTS (SELECT 1 FROM public.profiles
                WHERE id = (SELECT auth.uid()) AND is_admin)
  );

-- UPDATE
DROP POLICY IF EXISTS cms_covers_update_own ON storage.objects;
CREATE POLICY cms_covers_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'cms-covers'
              AND EXISTS (SELECT 1 FROM public.profiles
                          WHERE id = (SELECT auth.uid()) AND is_admin))
  WITH CHECK (bucket_id = 'cms-covers'
              AND EXISTS (SELECT 1 FROM public.profiles
                          WHERE id = (SELECT auth.uid()) AND is_admin));

-- DELETE
DROP POLICY IF EXISTS cms_covers_delete_own ON storage.objects;
CREATE POLICY cms_covers_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cms-covers'
    AND EXISTS (SELECT 1 FROM public.profiles
                WHERE id = (SELECT auth.uid()) AND is_admin)
  );
```

**Sanity assertion** (analog lines 68–87 of avatar bucket migration):
```sql
DO $$
DECLARE
  bucket_count integer;
  policy_count integer;
BEGIN
  SELECT count(*) INTO bucket_count FROM storage.buckets WHERE id = 'cms-covers';
  SELECT count(*) INTO policy_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname LIKE 'cms_covers_%';
  IF bucket_count <> 1 THEN
    RAISE EXCEPTION 'cms-covers bucket: expected 1, got %', bucket_count;
  END IF;
  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'cms-covers policies: expected 4, got %', policy_count;
  END IF;
END $$;
```

---

### `src/db/schema.ts` — 5 new tables + `profiles.is_admin` (model, CRUD)

**Analog:** `src/db/schema.ts` (self) — specifically `watchLineageEdges` (lines 453–477) for RESTRICT FKs + unique constraints, `follows` (lines 230–243) for the junction table unique pair pattern, and `notifications` (lines 303–320) for the "Drizzle carries column shapes only; CHECK/RLS in raw SQL" comment pattern.

**Import block** (lines 1–16):
```typescript
import {
  pgTable,
  uuid, text, integer, boolean, timestamp,
  index, unique,
} from 'drizzle-orm/pg-core'
// NOTE: no new pgEnum imports needed — D-17 uses text + CHECK, not pgEnum
```

**`is_admin` column addition on `profiles`** — add inline to the existing `profiles` pgTable definition (analog: `notifyOnFollow` / `notifyOnWatchOverlap` added in Phase 13, lines 253–264):
```typescript
// In the profiles pgTable columns object — add after avatarUrl:
isAdmin: boolean('is_admin').notNull().default(false),
```

**`curated_lists` table** — status text enum (analog: `watches.status` line 91), sortOrder (analog: `watches.sortOrder` line 156), composite index (analog: `watches` table index block lines 161–166):
```typescript
export const curatedLists = pgTable(
  'curated_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    curatorName: text('curator_name').notNull(),
    coverUrl: text('cover_url'),
    introMarkdown: text('intro_markdown'),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curated_lists_status_sort_idx').on(table.status, table.sortOrder),
  ],
)
```

**`curated_list_items` junction table** — RESTRICT FK on `catalogId` (analog: `watchLineageEdges.predecessorCatalogId` lines 457–460), CASCADE FK on `listId` (analog: `watches.userId` line 85 / `wearEvents.watchId` line 288), unique pair (analog: `follows` lines 242–243, `wearEvents` line 299):
```typescript
export const curatedListItems = pgTable(
  'curated_list_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id').notNull().references(() => curatedLists.id, { onDelete: 'cascade' }),
    // D-07: ON DELETE RESTRICT — blocks catalog watch deletion when referenced
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    commentary: text('commentary'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curated_list_items_list_id_idx').on(table.listId),
    index('curated_list_items_catalog_id_idx').on(table.catalogId),
    unique('curated_list_items_unique_pair').on(table.listId, table.catalogId),
  ],
)
```

**`collection_paths` table** — same status enum + sortOrder pattern; `pathType` uses plain `text()` (no enum per D-17), CHECK lives in raw SQL migration only:
```typescript
export const collectionPaths = pgTable(
  'collection_paths',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seedCatalogId: uuid('seed_catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    // D-17: text + CHECK (not enum) — CHECK constraint lives in raw SQL migration only
    pathType: text('path_type').notNull(),
    rationale: text('rationale'),
    // SEED-008: forward-compat source field for future computed paths
    source: text('source', { enum: ['manual', 'computed'] }).notNull().default('manual'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collection_paths_status_idx').on(table.status),
  ],
)
```

**`collection_path_nodes` table** — same RESTRICT FK pattern as `curated_list_items`:
```typescript
export const collectionPathNodes = pgTable(
  'collection_path_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pathId: uuid('path_id').notNull().references(() => collectionPaths.id, { onDelete: 'cascade' }),
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    rationale: text('rationale'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collection_path_nodes_path_id_idx').on(table.pathId),
    index('collection_path_nodes_catalog_id_idx').on(table.catalogId),
  ],
)
```

**`cms_settings` single-row table** (analog: `profileSettings` lines 245–265 — settings table with no `defaultRandom().primaryKey()`):
```typescript
// Single-row table. PK=1 enforced by CHECK (id = 1) in raw SQL migration.
// SEED-008: heroFormat discriminated union with forward-compat 'featured_collector' value.
export const cmsSettings = pgTable('cms_settings', {
  id: integer('id').primaryKey().default(1),
  pinnedListId: uuid('pinned_list_id').references(() => curatedLists.id, { onDelete: 'set null' }),
  pinExpiresAt: timestamp('pin_expires_at', { withTimezone: true }),
  heroFormat: text('hero_format', { enum: ['featured_list', 'featured_collector'] })
    .notNull().default('featured_list'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

**Required Drizzle comment** (analog: `notifications` table comment lines 303–308, `watchLineageEdges` lines 449–452):
```typescript
// Column shapes only. CHECK constraints (path_type_check, cms_settings_single_row)
// and RLS policies live in supabase/migrations/20260518200000_phase45_cms_tables.sql.
// Drizzle 0.45.2 cannot express CHECK constraints in the pg-core DSL — raw SQL is
// authoritative for those. This table definition is the source of truth for column
// types and type inference only.
```

---

### `src/lib/auth.ts` — add `assertOwner()` (utility, request-response)

**Analog:** `src/lib/auth.ts` `getCurrentUser()` (lines 12–20) — exact pattern to extend.

**Existing pattern to extend from** (lines 1–20):
```typescript
import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export async function getCurrentUser(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return { id: user.id, email: user.email! }
}
```

**New `assertOwner()` to add after `getCurrentUserFull()`** (CONTEXT.md D-06):
```typescript
// assertOwner — first call in every CMS Server Action (D-06).
// Layout guard alone is insufficient (Partial Rendering does not re-execute layout on navigation).
// Three-layer security: RLS write policies (DB) + layout redirect (UX) + this call (SA).
export async function assertOwner(): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!data?.is_admin) throw new UnauthorizedError('Not an admin')
  return user
}
```

---

### `src/data/curatedLists.ts` (service, CRUD)

**Analog:** `src/data/profiles.ts` (all lines)

**Imports + `server-only` directive** (analog lines 1–6):
```typescript
import 'server-only'

import { db } from '@/db'
import { curatedLists, curatedListItems } from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'
```

**Public-read function with explicit WHERE** (analog: `getProfileByUsername` lines 34–46; CONTEXT.md D-03 two-layer pattern):
```typescript
// Two-layer draft defense: RLS USING(status='published') + explicit WHERE
// ALWAYS include the explicit filter — RLS alone is insufficient per D-03.
export async function getPublishedLists(limit = 12) {
  return db
    .select()
    .from(curatedLists)
    .where(eq(curatedLists.status, 'published'))  // explicit filter — always present
    .orderBy(asc(curatedLists.sortOrder))
    .limit(limit)
}
```

**Owner-read function (all rows including drafts)** — analog: `getProfileById` lines 48–55:
```typescript
export async function getAllListsForOwner() {
  return db
    .select()
    .from(curatedLists)
    .orderBy(asc(curatedLists.sortOrder))
  // No status filter — owner reads all rows; RLS owner SELECT policy permits this
}
```

**Item count helper for publish guard (CMS-06)**:
```typescript
export async function getListItemCount(listId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curatedListItems)
    .where(eq(curatedListItems.listId, listId))
  return result[0]?.count ?? 0
}
```

**Sort-order swap in a transaction** (RESEARCH.md Ordering Pattern):
```typescript
// Drizzle transaction pattern (analog: no single existing transaction, but db.transaction is used in watches.ts)
export async function swapListSortOrder(idA: string, orderA: number, idB: string, orderB: number) {
  await db.transaction(async (tx) => {
    await tx.update(curatedLists).set({ sortOrder: orderB }).where(eq(curatedLists.id, idA))
    await tx.update(curatedLists).set({ sortOrder: orderA }).where(eq(curatedLists.id, idB))
  })
}
```

---

### `src/data/collectionPaths.ts` (service, CRUD)

**Analog:** `src/data/profiles.ts` — same pattern as `curatedLists.ts` above.

Same `server-only` import, same two-layer public-read pattern with `WHERE status = 'published'`, same owner-read without filter. Key difference: no item count needed (paths are published when they have a seed watch by definition). The `pathType` column maps directly to the CHECK-constrained text values.

---

### `src/data/cmsSettings.ts` (service, CRUD)

**Analog:** `src/data/profiles.ts` `getProfileSettings` (lines 63–81) — single-row read with safe default.

**Single-row read pattern** (analog lines 63–81):
```typescript
import 'server-only'
import { db } from '@/db'
import { cmsSettings, curatedLists } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getCmsSettings() {
  const rows = await db.select().from(cmsSettings).where(eq(cmsSettings.id, 1)).limit(1)
  // Safe default: no pin active
  return rows[0] ?? { id: 1, pinnedListId: null, pinExpiresAt: null, heroFormat: 'featured_list' as const, updatedAt: new Date() }
}

export async function setPinnedHero(listId: string, expiresAt: Date | null) {
  await db
    .update(cmsSettings)
    .set({ pinnedListId: listId, pinExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(cmsSettings.id, 1))
}

export async function clearPinnedHero() {
  await db
    .update(cmsSettings)
    .set({ pinnedListId: null, pinExpiresAt: null, updatedAt: new Date() })
    .where(eq(cmsSettings.id, 1))
}
```

---

### `src/app/actions/cms/curatedLists.ts` (service, request-response)

**Analog:** `src/app/actions/profile.ts` (all lines)

**Full file structure** — copy this pattern exactly, adding `assertOwner()` before `getCurrentUser()` is normally used:

**Header + imports** (analog lines 1–7):
```typescript
'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as curatedListsDAL from '@/data/curatedLists'
import type { ActionResult } from '@/lib/actionTypes'
```

**`assertOwner()` call pattern** (D-06 — every CMS SA starts here, analog: `getCurrentUser()` block in profile.ts lines 21–25):
```typescript
// CRITICAL: assertOwner() is the real security gate for every CMS Server Action.
// The admin layout redirect is UX only — SAs are HTTP-callable and bypass layout guards.
export async function createCuratedList(data: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  // ... zod parse ... DAL call ...
}
```

**Zod schema with `.strict()`** (analog lines 11–17):
```typescript
// Mass-assignment protection: .strict() rejects unknown keys
const createListSchema = z.object({
  title: z.string().min(1).max(200),
  curatorName: z.string().min(1).max(100),
  introMarkdown: z.string().max(5000).optional(),
}).strict()
```

**Three-block try/catch structure** (analog lines 19–31 and 44–48 of profile.ts):
```typescript
// Block 1: auth gate
try { await assertOwner() } catch { return { success: false, error: 'Not authorized' } }
// Block 2: zod parse
const parsed = schema.safeParse(data)
if (!parsed.success) return { success: false, error: 'Invalid data' }
// Block 3: DAL call + revalidation
try {
  const id = await curatedListsDAL.createList(parsed.data)
  return { success: true, data: { id } }
} catch (err) {
  console.error('[createCuratedList] unexpected error:', err)
  return { success: false, error: "Couldn't create list. Try again." }
}
```

**`revalidateTag` for publish/unpublish** (STATE.md locked decision; RESEARCH.md Pattern 6):
```typescript
// CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (Pitfall 3)
// revalidateTag not updateTag — hero cache is GLOBAL, not read-your-own-writes
revalidateTag('explore:hero', 'max')
```

**Zero-watch publish guard** (CMS-06):
```typescript
export async function publishCuratedList(listId: string): Promise<ActionResult<void>> {
  try { await assertOwner() } catch { return { success: false, error: 'Not authorized' } }
  const count = await curatedListsDAL.getListItemCount(listId)
  if (count === 0) return { success: false, error: 'Cannot publish a list with no watches.' }
  // ... setListStatus + revalidateTag ...
}
```

---

### `src/app/actions/cms/collectionPaths.ts` (service, request-response)

**Analog:** `src/app/actions/profile.ts` — identical structure to `curatedLists.ts` above.

Same three-block try/catch, same `assertOwner()` first call, same `.strict()` zod schema, same `revalidateTag('explore:hero', 'max')` on publish/unpublish. No zero-item guard needed (a path with only a seed watch and no follow-ons is valid).

---

### `src/app/actions/cms/settings.ts` (service, request-response)

**Analog:** `src/app/actions/notifications.ts` — closest match for "action that only invalidates a shared cache tag."

**Why `revalidateTag` not `updateTag`** (analog: notifications.ts file-header comment lines 14–55):
```typescript
// Unlike notifications.ts which uses updateTag (read-your-own-writes),
// hero pin is a GLOBAL shared cache — all visitors see it, not just the admin.
// revalidateTag('explore:hero', 'max') is the correct primitive here.
// See notifications.ts:14-55 for the Next.js 16 source-level rationale.
```

**Hero pin/clear actions** (analog: notifications.ts action structure):
```typescript
'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as cmsSettingsDAL from '@/data/cmsSettings'
import type { ActionResult } from '@/lib/actionTypes'

const setPinSchema = z.object({
  listId: z.string().uuid(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict()

export async function setPinnedHero(data: unknown): Promise<ActionResult<void>> {
  try { await assertOwner() } catch { return { success: false, error: 'Not authorized' } }
  const parsed = setPinSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid pin data' }
  try {
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
    await cmsSettingsDAL.setPinnedHero(parsed.data.listId, expiresAt)
    revalidateTag('explore:hero', 'max')  // global hero cache
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[setPinnedHero] unexpected error:', err)
    return { success: false, error: "Couldn't pin hero. Try again." }
  }
}
```

---

### `src/lib/storage/cmsCovers.ts` (utility, file-I/O)

**Analog:** `src/lib/storage/avatarPhotos.ts` (all lines — exact structural match)

**Full structure to copy from** (analog lines 1–67):
```typescript
// Browser-safe only: path builder + uploader.
// The cms-covers bucket is public — no signed URL helper needed.
// RLS enforces is_admin EXISTS predicate on upload (all writes).

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const BUCKET_ID = 'cms-covers' as const

// Path convention: {listId}/{filename}.jpg
// UUID-stamped filenames prevent collision (upsert: false).

export function buildCmsCoverPath(listId: string, filename: string): string {
  if (!listId) throw new TypeError('listId required')
  if (!filename || filename.includes('/')) throw new TypeError('filename must be a basename')
  return `${listId}/${filename}`
}

export function generateCmsCoverFilename(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${id}.jpg`
}

export type CmsCoverUploadResult = { publicUrl: string } | { error: string }

export async function uploadCmsCover(
  listId: string,
  jpeg: Blob,
  filename: string = generateCmsCoverFilename(),
): Promise<CmsCoverUploadResult> {
  let path: string
  try {
    path = buildCmsCoverPath(listId, filename)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid path inputs' }
  }
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage.from(BUCKET_ID).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,  // UUID-stamped filenames prevent collision; cover replace = upload new file
  })
  if (error) return { error: error.message }
  // Public bucket — construct public URL directly (no signed URL needed).
  // Analog: avatarPhotos.ts lines 64-66
  const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}
```

**Key difference from `catalogSourcePhotos.ts`:** No server-side signed URL helper needed (public bucket). No 3-segment path (just `{listId}/{filename}.jpg`).

**Key difference from `avatarPhotos.ts`:** `upsert: false` not `upsert: true` — each cover upload gets a new UUID-stamped filename rather than overwriting in place. Update `curated_lists.cover_url` in the DB after upload.

---

### `src/app/admin/layout.tsx` (middleware, request-response)

**Analog:** `src/app/settings/page.tsx` lines 1–33 (auth redirect pattern); `src/app/u/[username]/layout.tsx` (layout wrapper structure)

**Auth redirect pattern** (analog `settings/page.tsx` lines 18–33):
```typescript
// CRITICAL: assertOwner() throws UnauthorizedError for non-admins.
// The catch block redirects — redirect() throws NEXT_REDIRECT internally,
// so keep it OUTSIDE nested try/catch (Pitfall 7 from settings/page.tsx comment).
import { redirect } from 'next/navigation'
import { assertOwner } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await assertOwner()
  } catch {
    redirect('/')
  }
  // UI-SPEC Layout: max-w-2xl, same max-width as watch form pages
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {children}
    </main>
  )
}
```

**Note from RESEARCH.md §Pitfall 1:** Layout does NOT re-execute on subsequent client-side navigations within `/admin` (Next.js 16 Partial Rendering). This guard is UX only. The `assertOwner()` in every Server Action is the actual security gate.

---

### `src/app/admin/lists/page.tsx` + `src/app/admin/paths/page.tsx` (component, CRUD)

**Analog:** `src/app/settings/page.tsx` (server component page that reads data + renders client shell)

**Server component pattern** (analog lines 1–67):
```typescript
// No 'use client' — server component fetches data for the client shell
import { getAllListsForOwner } from '@/data/curatedLists'
// No redirect needed — layout.tsx already guards the /admin segment

export default async function AdminListsPage() {
  const lists = await getAllListsForOwner()
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Curated Lists</h1>
        {/* "New List" Button variant="default" — primary visual anchor (UI-SPEC) */}
      </div>
      {/* Client shell for interactive list (delete, reorder) */}
    </>
  )
}
```

**UI-SPEC page heading pattern** (`src/app/settings/page.tsx` line 51):
```tsx
<h1 className="text-xl font-semibold">Curated Lists</h1>
```

---

### `src/app/admin/lists/[id]/page.tsx` + `src/app/admin/paths/[id]/page.tsx` (component, CRUD)

**Analog:** `src/app/settings/page.tsx` — same server component shape, fetches a single record by id, passes to a client-side editor shell.

**Dynamic segment pattern** (analog: `src/app/u/[username]/layout.tsx`):
```typescript
// Params must be awaited in Next.js 16 (Partial Rendering + async params)
export default async function AdminListEditorPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const list = await getListById(id)
  if (!list) notFound()
  // ...render editor shell...
}
```

---

## Shared Patterns

### assertOwner() — Every CMS Server Action
**Source:** `src/lib/auth.ts` (to be added)
**Apply to:** All files in `src/app/actions/cms/`
```typescript
// First call in every CMS Server Action body — before zod parse, before DAL calls
try {
  await assertOwner()
} catch {
  return { success: false, error: 'Not authorized' }
}
```

### ActionResult<T> Return Type
**Source:** `src/lib/actionTypes.ts` (lines 1–7)
**Apply to:** All Server Action files
```typescript
import type { ActionResult } from '@/lib/actionTypes'
// Return shape: { success: true, data: T } | { success: false, error: string }
```

### Zod `.strict()` Schema Validation
**Source:** `src/app/actions/profile.ts` lines 11–17
**Apply to:** All Server Action input schemas
```typescript
const schema = z.object({ ... }).strict()  // .strict() rejects unknown keys — mass-assignment protection
const parsed = schema.safeParse(data)
if (!parsed.success) return { success: false, error: 'Invalid data' }
```

### `server-only` Import in DAL Modules
**Source:** `src/data/profiles.ts` line 1; `src/lib/storage/catalogSourcePhotos.ts` (file-level note)
**Apply to:** `src/data/curatedLists.ts`, `src/data/collectionPaths.ts`, `src/data/cmsSettings.ts`
```typescript
import 'server-only'
// First line of every DAL module — build-time error if imported from a client component
```

### Two-Layer Draft Defense in Public-Read DAL
**Source:** `src/data/catalog.ts` pattern; CONTEXT.md D-03
**Apply to:** All public-read functions in `src/data/curatedLists.ts`, `src/data/collectionPaths.ts`
```typescript
// ALWAYS include the explicit WHERE filter — RLS alone is not sufficient (D-03)
.where(eq(table.status, 'published'))
```

### `revalidateTag('explore:hero', 'max')` — Two-arg Form Only
**Source:** `src/app/actions/notifications.ts` + RESEARCH.md Pattern 6
**Apply to:** `setPinnedHero`, `clearPinnedHero`, `publishCuratedList`, `unpublishCuratedList` in CMS Server Actions
```typescript
// Two-argument form (Next.js 16) — single-arg deprecated (Pitfall 3 from RESEARCH.md)
// Use revalidateTag (NOT updateTag) — hero is global shared cache, not read-your-own-writes
revalidateTag('explore:hero', 'max')
```

### `console.error` Error Logging Pattern
**Source:** `src/app/actions/profile.ts` lines 45–47; `src/app/actions/notifications.ts` lines 78–80
**Apply to:** All `catch (err)` blocks in CMS Server Actions
```typescript
console.error('[actionName] unexpected error:', err)
return { success: false, error: "Couldn't save changes. Try again." }
```

### Params Awaiting in Next.js 16 Dynamic Segments
**Source:** `src/app/u/[username]/layout.tsx` line 9 (`const { username } = await params`)
**Apply to:** `src/app/admin/lists/[id]/page.tsx`, `src/app/admin/paths/[id]/page.tsx`
```typescript
const { id } = await params  // params is a Promise in Next.js 16 dynamic segments
```

---

## No Analog Found

All files have close analogs in the codebase. No entries.

---

## Migration Timestamp Note

**Last existing timestamp:** `20260518191301` (from `supabase/migrations/` listing)

New migration files must use timestamps later than this:
- `20260518200000_phase45_cms_tables.sql`
- `20260518210000_phase45_cms_covers_bucket.sql`

Both filenames verified to follow the established `{timestamp}_{phaseslug_descriptor}.sql` naming convention (analog: `20260516000000_phase43_avatar_bucket.sql`).

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/db/schema.ts`, `src/lib/auth.ts`, `src/data/`, `src/app/actions/`, `src/lib/storage/`, `src/app/` (layouts + pages)
**Files scanned:** 14 existing files read in full
**Pattern extraction date:** 2026-05-18

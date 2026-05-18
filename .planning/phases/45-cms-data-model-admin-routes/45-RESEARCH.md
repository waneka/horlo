# Phase 45: CMS Data Model + Admin Routes - Research

**Researched:** 2026-05-18
**Domain:** Supabase RLS + Drizzle ORM schema, Next.js 16 App Router owner-gated routes, Server Actions, Supabase Storage
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Owner identity is a new `is_admin` boolean column on `profiles`. Single source of truth for RLS write policies and app-level `assertOwner()`.

**D-02:** RLS write policies on the five CMS tables gate on the owner via `EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin)`. Wrap `auth.uid()` in `(SELECT ...)` for InitPlan optimization.

**D-03:** RLS public-read policies: `USING (status = 'published')` for non-owner reads, plus explicit `WHERE status = 'published'` in every public-read DAL function (two-layer draft-leak defense). Owner additionally reads drafts via an owner-scoped SELECT policy using the same EXISTS predicate as D-02.

**D-04:** Owner's `is_admin` flag is set to `true` by the same migration, keyed by owner email: `UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'twwaneka@gmail.com')`. Email is the cross-DB-stable key.

**D-05:** Request-level route guard is a server-component `src/app/admin/layout.tsx` that calls `getCurrentUser()`, checks `is_admin`, and `redirect()`s non-owners. No `middleware.ts` introduced.

**D-06:** `assertOwner()` is called at the start of every CMS Server Action independently of the layout guard (Server Actions are HTTP-callable and bypass layout gates).

**D-07:** Deletion of a referenced catalog watch blocked by plain FK `ON DELETE RESTRICT` on `curated_list_items.catalog_id` and `collection_path_nodes.catalog_id`. No trigger, no SECURITY DEFINER function.

**D-08:** RESTRICT blocks deletion whenever the watch is referenced by any list/path — draft or published.

**D-09:** No catalog-watch delete surface inside `/admin/lists` or `/admin/paths` in Phase 45.

**D-10 [planner note]:** RESTRICT FKs from CMS tables onto `watches_catalog` will block a future bulk catalog TRUNCATE (cf. Phase 36 catalog wipes, v5.2 expansion). Flag in plan SUMMARY.

**D-11:** Catalog watches added via search-as-you-type picker (typeahead on brand/model) reusing `src/data/search.ts` (specifically `searchCatalogWatches`).

**D-12:** All ordering (lists in rail, items within a list, path nodes) uses up/down arrow buttons writing an integer `sort_order` column. No drag-and-drop.

**D-13:** Markdown intro copy edited in a plain `<textarea>` with a live preview pane rendered by `react-markdown` (toggle or side pane). No WYSIWYG.

**D-14:** Cover image set by device upload to a new public Supabase Storage bucket (`cms-covers`), reusing the Phase 43 upload pipeline: client-side EXIF strip + canvas re-encode + size guard, and the bucket-helper pattern from `src/lib/storage/catalogSourcePhotos.ts`.

**D-15:** No crop step. Image stored as-uploaded; UI renders in fixed aspect-ratio container with `object-cover`.

**D-16:** Path-type label is a small fixed vocabulary: **Going Deeper**, **Branching Out**, **Trading Up**, **Filling a Gap**.

**D-17:** Path-type constraint is a `text` column + `CHECK`, not a Postgres enum.

### Claude's Discretion

- Exact column names, indexes, and `cms_settings` row shape for the hero pin (single-row settings table vs key/value).
- The `HeroFeature` data shape: SEED-008 wants a discriminated union on `format` accepting `featured_list` and `featured_collector` even though only `featured_list` is wired. Honor that forward-compat shape in the `cms_settings` / pin model.
- Whether order column is dense integer reindexed on each move, or sparse/fractional scheme.
- Exact `cms-covers` bucket name and RLS folder policy (public read; owner-only write — mirror Phase 43 avatar bucket policy).
- Final wording of the four path-type label strings.
- Which 10 watches/themes the seed paths cover (CMS-10) — content authored through the UI; the user supplies or approves the picks at execution time.

### Deferred Ideas (OUT OF SCOPE)

- Catalog-watch management UI (D-09).
- Rectangular cover-image crop component (D-15).
- All public-facing `/explore` rendering (Phases 46-47).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMS-01 | Five new tables with RLS exposing only published content to non-owners | Schema design, RLS policy patterns (§RLS Two-Layer Pattern) |
| CMS-02 | Admin routes unreachable by non-owners; owner assertion in every CMS Server Action | Next.js 16 layout guard, `assertOwner()` pattern (§Admin Route Guard) |
| CMS-03 | Owner can create/edit/delete curated list with title, curator name, cover image, markdown intro | Schema, Storage bucket, react-markdown (§Schema Design, §Cover Image) |
| CMS-04 | Owner can add catalog watches to list with per-item editorial commentary | Watch picker typeahead, `curated_list_items` schema (§Schema Design) |
| CMS-05 | Owner can hand-order curated lists shown in rail | `sort_order` integer column + up/down buttons (§Ordering Pattern) |
| CMS-06 | Owner can save list as draft/publish/unpublish; zero-watch list cannot be published | Status column + enforce-publish-guard in Server Action (§Publish Guard) |
| CMS-07 | Owner can create/edit/delete collection paths (seed + up to 3 follow-ons, rationale, path-type label) | `collection_paths`/`collection_path_nodes` schema, CHECK constraint (§Schema Design) |
| CMS-08 | Owner can pin a curated list as hero with optional expiry; can clear pin | `cms_settings` table, hero pin Server Actions, `revalidateTag('explore:hero')` (§cms_settings) |
| CMS-09 | Deleting a referenced catalog watch is blocked; admin UI warns | ON DELETE RESTRICT FKs — no code change needed; UI has no delete surface (D-09) |
| CMS-10 | Ten seed collection paths authored through the admin UI in published state | Requires functional admin UI from CMS-07; content authored manually at execution time |
</phase_requirements>

---

## Summary

Phase 45 builds the data foundation and owner-only authoring UI for v5.1's editorial content. The five new tables (`curated_lists`, `curated_list_items`, `collection_paths`, `collection_path_nodes`, `cms_settings`) follow the established Drizzle/Supabase split: Drizzle carries column shapes for type inference; raw SQL migrations carry RLS, constraints, and the `is_admin` column addition on `profiles`. The project has clear, verified precedents for every major pattern in this phase — no new architectural territory.

The most important planning concern is the migration file itself: it must add `is_admin` to `profiles`, create all five CMS tables with correct RLS (two SELECT policies per published table: one for public `status='published'`, one owner-scoped EXISTS predicate), create the `cms-covers` bucket with 4-policy Storage RLS (matching the Phase 43 avatar pattern), and seed the owner's `is_admin = true` using the email key. All of this goes in a single timestamped migration file (or two ordered files if the Storage bucket is split as Phase 43 did). The migration pushes to local via `drizzle-kit push` and to prod via `supabase db push --linked`.

The admin route guard in `src/app/admin/layout.tsx` is a straightforward server-component `redirect()`. The Next.js 16 docs explicitly warn that layouts do not re-render on navigation (Partial Rendering), so the layout guard alone is insufficient — the `assertOwner()` call in every Server Action is the defense-in-depth layer the CONTEXT.md locked. `react-markdown@^10.1.0` is not yet installed; Wave 0 must add it.

**Primary recommendation:** Write the migration in two files matching the Phase 43 split: one for tables + RLS + `is_admin` column, one for the `cms-covers` Storage bucket and its policies. Wire `assertOwner()` as a server-only helper that `getCurrentUser()` + `profiles.is_admin` check. Keep public-read DAL functions explicitly filtering `WHERE status = 'published'` regardless of RLS.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CMS table schema + RLS | Database (Supabase) | — | All five tables, `is_admin` column, RESTRICT FKs, CHECK constraint live in migration |
| Owner identity check | API / Backend (Server Action) | Database (RLS) | Three-layer: layout redirect, `assertOwner()` in every SA, RLS write policies |
| Admin route access guard | Frontend Server (SSR) — layout.tsx | — | Server-component layout calls `getCurrentUser()` + `is_admin` check + `redirect()` |
| Cover image upload | Browser / Client | CDN / Static (Supabase Storage) | Client-side EXIF strip + canvas re-encode + browser Supabase client upload |
| Markdown preview render | Browser / Client | — | `react-markdown` renders in client component; textarea + preview pane |
| Catalog watch picker | API / Backend | — | `searchCatalogWatches` in `src/data/catalog.ts` runs server-side |
| Hero pin + cache invalidation | API / Backend (Server Action) | CDN (Next cache) | SA writes `cms_settings`; `revalidateTag('explore:hero', 'max')` marks tag stale |
| Publish invariant (zero-watch guard) | API / Backend (Server Action) | — | Server Action checks `COUNT(*) > 0` on `curated_list_items` before allowing publish |

---

## Standard Stack

### Core (all VERIFIED in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 (installed) | Column shapes + type inference for 5 new tables | Established ORM; all existing tables use it |
| @supabase/supabase-js | (installed) | Supabase client for Storage uploads + auth | Project-wide Supabase client |
| zod | (installed) | Server Action input validation with `.strict()` | All existing Server Actions use it |
| next/cache (revalidateTag, updateTag) | Next.js 16.2.3 | Cache invalidation after CMS mutations | Established pattern in notifications.ts, profile.ts |
| react-markdown | ^10.1.0 (NOT YET INSTALLED) | Markdown preview pane in admin editor | Locked dependency from REQUIREMENTS.md / STATE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| exifr | ^7.1.3 (devDep) | EXIF strip before canvas re-encode on cover upload | Client-side before every cover upload (mirrors avatar pattern) |
| lucide-react | ^1.8.0 | Up/down arrow icons for sort_order controls | Consistent with project icon set |

### Installation (Wave 0)

```bash
npm install react-markdown
```

**Version verification:** `react-markdown@^10.1.0` is locked by STATE.md. Not currently in package.json — must be installed.
[VERIFIED: package.json dependencies — react-markdown is absent]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Admin)
  │
  ├── /admin/lists, /admin/paths
  │     └── src/app/admin/layout.tsx  ← server component
  │           ├── getCurrentUser()    ← auth.ts
  │           ├── profiles.is_admin   ← DB read
  │           └── redirect('/') if not admin
  │
  ├── Cover image upload
  │     └── Client → EXIF strip → canvas re-encode → Supabase Storage (cms-covers)
  │
  └── Server Actions (src/app/actions/cms/*.ts)
        ├── assertOwner()            ← first call in every SA
        ├── zod .strict() schema     ← input validation
        ├── DAL (src/data/curatedLists.ts, collectionPaths.ts)
        │     └── Drizzle ORM → Supabase Postgres
        └── revalidateTag('explore:hero', 'max')  ← pin/clear/publish/unpublish

Database (Supabase)
  ├── profiles.is_admin               ← new boolean column
  ├── curated_lists                   ← title, curator, status, sort_order, cover_url, intro
  ├── curated_list_items              ← list_id, catalog_id (RESTRICT FK), sort_order, commentary
  ├── collection_paths                ← seed_catalog_id, status, path_type (CHECK), rationale, source
  ├── collection_path_nodes           ← path_id, catalog_id (RESTRICT FK), sort_order, rationale
  └── cms_settings                    ← single-row: pinned_list_id (FK), pin_expires_at, format

Supabase Storage
  └── cms-covers (public bucket)
        └── {listId}/{filename}.jpg   ← owner-only write, public CDN read
```

### Recommended Project Structure

```
src/
├── app/
│   └── admin/
│       ├── layout.tsx           # server-component owner guard (D-05)
│       ├── lists/
│       │   ├── page.tsx         # lists index
│       │   ├── new/page.tsx     # create list form
│       │   └── [id]/
│       │       ├── page.tsx     # edit list
│       │       └── items/page.tsx  # manage items + order
│       └── paths/
│           ├── page.tsx         # paths index
│           ├── new/page.tsx     # create path form
│           └── [id]/page.tsx    # edit path
├── app/
│   └── actions/
│       └── cms/
│           ├── curatedLists.ts  # CRUD + publish + order
│           ├── collectionPaths.ts
│           └── settings.ts      # hero pin / clear
├── data/
│   ├── curatedLists.ts          # public-read DAL (status='published' WHERE clause)
│   └── collectionPaths.ts       # public-read DAL
├── lib/
│   ├── auth.ts                  # ADD: assertOwner() helper
│   └── storage/
│       └── cmsCovers.ts         # cms-covers bucket helper (mirrors catalogSourcePhotos.ts)
└── db/
    └── schema.ts                # ADD: 5 new tables + profiles.is_admin column
```

### Pattern 1: assertOwner() Helper

```typescript
// src/lib/auth.ts — add after getCurrentUser()
// Source: CONTEXT.md D-06; mirrors getCurrentUser() pattern
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

### Pattern 2: Admin Layout Guard

```typescript
// src/app/admin/layout.tsx
// Source: CONTEXT.md D-05; Next.js 16 docs §"Server Components" auth check pattern
import { redirect } from 'next/navigation'
import { assertOwner } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await assertOwner()
  } catch {
    redirect('/')
  }
  return <>{children}</>
}
```

**Critical caveat from Next.js 16 docs:** Layouts do not re-render on navigation (Partial Rendering). The layout guard fires on initial load of the `/admin` segment, but NOT on every subsequent client-side route change within `/admin`. This is acceptable here because all mutations go through Server Actions (which call `assertOwner()` independently), and there is no sensitive data rendered by the layout itself that non-owners could read post-navigation. [CITED: node_modules/next/dist/docs/01-app/02-guides/authentication.md §"Layouts and auth checks"]

### Pattern 3: CMS Server Action (full pattern)

```typescript
// src/app/actions/cms/curatedLists.ts
'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as curatedListsDAL from '@/data/curatedLists'
import type { ActionResult } from '@/lib/actionTypes'

const createListSchema = z.object({
  title: z.string().min(1).max(200),
  curatorName: z.string().min(1).max(100),
  introMarkdown: z.string().max(5000).optional(),
}).strict()

export async function createCuratedList(data: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const parsed = createListSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid list data' }
  }

  try {
    const id = await curatedListsDAL.createList(parsed.data)
    return { success: true, data: { id } }
  } catch (err) {
    console.error('[createCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't create list. Try again." }
  }
}

// Hero pin paths must revalidate the explore:hero tag (STATE.md locked decision).
// Use revalidateTag with 'max' profile (stale-while-revalidate) — non-read-your-own-writes.
export async function publishCuratedList(listId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  // CMS-06: zero-watch guard — check item count BEFORE updating status.
  const count = await curatedListsDAL.getItemCount(listId)
  if (count === 0) {
    return { success: false, error: 'Cannot publish a list with no watches.' }
  }

  try {
    await curatedListsDAL.setListStatus(listId, 'published')
    // revalidate hero tag in case this list is now hero-eligible
    revalidateTag('explore:hero', 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[publishCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't publish list. Try again." }
  }
}
```

### Pattern 4: RLS Policies for CMS Tables

```sql
-- Source: supabase/migrations/20260420000001_social_tables_rls.sql (naming convention)
-- Source: CONTEXT.md D-02, D-03

-- curated_lists: public read (published only), owner write
ALTER TABLE public.curated_lists ENABLE ROW LEVEL SECURITY;

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

-- Owner write: INSERT/UPDATE/DELETE (D-02)
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

Same pattern for `collection_paths`. `curated_list_items`, `collection_path_nodes`, and `cms_settings` are junction/settings tables — no `status` column; owner-only write + owner-only read (or no public read). See §Schema Design for per-table read policy notes.

### Pattern 5: Public-Read DAL (two-layer draft defense)

```typescript
// src/data/curatedLists.ts — example public-read function
// Source: CONTEXT.md D-03; mirrors DAL pattern in src/data/catalog.ts

import 'server-only'
import { db } from '@/db'
import { curatedLists } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getPublishedLists(limit = 12) {
  // Two-layer defense: RLS USING(status='published') + explicit WHERE
  return db
    .select()
    .from(curatedLists)
    .where(eq(curatedLists.status, 'published'))  // <— ALWAYS explicit
    .orderBy(curatedLists.sortOrder)
    .limit(limit)
}
```

### Pattern 6: revalidateTag for Hero Pin

```typescript
// In setPinnedHero, clearPinnedHero, publishCuratedList, unpublishCuratedList:
// Source: STATE.md "Key Decisions" — must use revalidateTag('explore:hero')
// Source: Next.js 16 docs — revalidateTag with 'max' = stale-while-revalidate
// Source: notifications.ts — updateTag is for read-your-own-writes; hero is global

import { revalidateTag } from 'next/cache'

// After writing cms_settings pin:
revalidateTag('explore:hero', 'max')
// After publish/unpublish (changes hero-eligible pool):
revalidateTag('explore:hero', 'max')
```

**Why `revalidateTag` not `updateTag`:** The hero cache is NOT a read-your-own-writes scenario — it is a globally shared cache read by all visitors. `updateTag` is for personal data the writer sees immediately. `revalidateTag(..., 'max')` is correct here (stale-while-revalidate, all visitors get fresh data on next visit). [CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md §"Differences from revalidateTag"]

### Anti-Patterns to Avoid

- **Relying on layout guard alone for security:** Layout does not re-render on every navigation (Partial Rendering). `assertOwner()` in every Server Action is the actual security gate.
- **Using `updateTag` for hero cache:** This is global, not read-your-own-writes. Use `revalidateTag('explore:hero', 'max')`.
- **Using a Postgres enum for path_type:** Enum-bound-dependent migration pain (D-17). Use `text + CHECK`.
- **Omitting `WHERE status = 'published'` in DAL:** RLS alone is not sufficient; always add explicit filter (D-03).
- **Hardcoding owner UUID in RLS:** Email-keyed migration update (D-04) handles this. No hardcoded UUID.
- **SECURITY DEFINER functions without REVOKE:** D-07 avoids SECDEF entirely via plain RESTRICT FK, so the SECDEF REVOKE pattern is not needed in Phase 45. Document this explicitly so the planner does not add unnecessary steps.

---

## Schema Design

### Five New Tables

#### `curated_lists`
```typescript
// src/db/schema.ts addition
export const curatedLists = pgTable(
  'curated_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    curatorName: text('curator_name').notNull(),
    coverUrl: text('cover_url'),           // Supabase Storage public URL
    introMarkdown: text('intro_markdown'),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),  // rail ordering (D-12, CMS-05)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curated_lists_status_sort_idx').on(table.status, table.sortOrder),
  ],
)
```

#### `curated_list_items`
```typescript
export const curatedListItems = pgTable(
  'curated_list_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id').notNull().references(() => curatedLists.id, { onDelete: 'cascade' }),
    // D-07: ON DELETE RESTRICT — blocks catalog watch deletion when referenced
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    commentary: text('commentary'),         // per-item editorial commentary (CMS-04)
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

#### `collection_paths`
```typescript
export const collectionPaths = pgTable(
  'collection_paths',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // D-07: ON DELETE RESTRICT on seed_catalog_id as well
    seedCatalogId: uuid('seed_catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    // D-16/D-17: text + CHECK, not enum
    pathType: text('path_type').notNull(),  // CHECK in raw SQL migration
    rationale: text('rationale'),           // editorial rationale for the path overall
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

#### `collection_path_nodes`
```typescript
export const collectionPathNodes = pgTable(
  'collection_path_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pathId: uuid('path_id').notNull().references(() => collectionPaths.id, { onDelete: 'cascade' }),
    // D-07: ON DELETE RESTRICT — blocks catalog watch deletion when referenced
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    rationale: text('rationale'),          // per-node rationale ("why this next?")
    sortOrder: integer('sort_order').notNull().default(0),  // 0=first follow-on, 1=second, 2=third
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collection_path_nodes_path_id_idx').on(table.pathId),
    index('collection_path_nodes_catalog_id_idx').on(table.catalogId),
  ],
)
```

#### `cms_settings`
```typescript
// Single-row settings table. Planner's discretion on shape (Claude's Discretion).
// SEED-008 requires HeroFeature discriminated union on format: 'featured_list' | 'featured_collector'
// Only 'featured_list' is wired in v5.1; forward-compat shape required.
export const cmsSettings = pgTable('cms_settings', {
  id: integer('id').primaryKey().default(1),  // enforce single row via PK=1 + CHECK
  // Hero pin (CMS-08)
  pinnedListId: uuid('pinned_list_id').references(() => curatedLists.id, { onDelete: 'set null' }),
  pinExpiresAt: timestamp('pin_expires_at', { withTimezone: true }),
  // Forward-compat discriminated union format (SEED-008)
  heroFormat: text('hero_format', { enum: ['featured_list', 'featured_collector'] })
    .notNull().default('featured_list'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

**cms_settings single-row enforcement:** Add `CHECK (id = 1)` in the raw SQL migration. Insert the seed row in the migration: `INSERT INTO cms_settings (id) VALUES (1) ON CONFLICT DO NOTHING;`

### profiles.is_admin Column (D-01, D-04)

```sql
-- In the migration:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Seed owner (D-04) — email-keyed, works on both local and prod:
UPDATE public.profiles
   SET is_admin = true
 WHERE id = (SELECT id FROM auth.users WHERE email = 'twwaneka@gmail.com');
```

```typescript
// src/db/schema.ts profiles table — add:
isAdmin: boolean('is_admin').notNull().default(false),
```

### path_type CHECK Constraint (D-17)

```sql
-- In raw SQL migration, after CREATE TABLE collection_paths:
ALTER TABLE public.collection_paths
  ADD CONSTRAINT collection_paths_path_type_check
  CHECK (path_type IN ('Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'));
```

This goes in the raw SQL migration only — not expressible in Drizzle 0.45.2 pg-core DSL (same pattern as notifications CHECK constraints).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown render | Custom parser/renderer | `react-markdown@^10.1.0` | Handles GFM, XSS-safe by default (blocks `javascript:` URLs via `defaultUrlTransform`) |
| Catalog watch search | Full-table client load | `searchCatalogWatches` in `src/data/catalog.ts` | Existing paginated, parameterized, anti-N+1 search with facets |
| Image EXIF strip + resize | Custom canvas pipeline | Existing Phase 43 avatar pipeline pattern | Already battle-tested for HEIC → JPEG, EXIF strip, ≤1080px re-encode |
| Storage RLS folder policy | Ad-hoc policy | Mirror Phase 43 `avatars_insert_own_folder` pattern exactly | 4-policy pattern (SELECT for upsert, INSERT, UPDATE, DELETE) verified in Phase 43 |
| Order management | Drag-and-drop library | Up/down arrow buttons writing `sort_order` integer | D-12 — no new dependency; dense integer reindex on each swap is sufficient |
| Owner-gating | Middleware.ts | Server-component `layout.tsx` + `assertOwner()` in every SA | D-05/D-06 locked; Proxy (middleware) is explicitly not introduced |
| Catalog delete protection | Trigger or app-level guard | FK `ON DELETE RESTRICT` (D-07) | DB enforces it unconditionally; no trigger logic needed |
| Sanitize markdown for owner | rehype-sanitize plugin | No sanitization needed | Content is OWNER-authored only, not UGC. `react-markdown` defaults block `javascript:` URLs. Owner trust level = same as admin. Adding rehype-sanitize for admin-only content is over-engineering. [ASSUMED — but SEED-008 makes no mention of non-owner markdown input in v5.1] |

---

## Migration Strategy

### Migration Filenames (timestamp convention)

[VERIFIED: supabase/migrations/ directory — last timestamp is `20260518191301`]

Use timestamps from today `20260518`:

- **File 1:** `20260518200000_phase45_cms_tables.sql` — `profiles.is_admin` column, five CMS tables with RLS, path_type CHECK, cms_settings seed row, owner `is_admin = true` update.
- **File 2:** `20260518210000_phase45_cms_covers_bucket.sql` — `cms-covers` Storage bucket + 4 RLS policies (mirroring Phase 43 avatar pattern exactly).

**Why split:** Phase 43 split its avatar migration into two files for the same reason (bucket creation failed in a transaction boundary issue). Mirror the proven pattern.

### Local vs Prod Split (memory: `project_drizzle_supabase_db_mismatch`)

[VERIFIED: CONTEXT.md canonical_refs + STATE.md § "Key Decisions"]

| Target | Command | Scope |
|--------|---------|-------|
| Local DB | `npx drizzle-kit push` | Pushes Drizzle schema.ts changes; NO migration file execution |
| Prod DB | `supabase db push --linked` | Runs new migration files in `supabase/migrations/` |

The Drizzle `schema.ts` additions (new tables + `is_admin` column) are the source of truth for column types. The raw SQL migration is the source of truth for RLS, CHECK constraints, bucket creation, and the `is_admin` seed UPDATE.

**4 prod-push gotchas (from memory `project_drizzle_supabase_db_mismatch`):**
1. Migration filename must follow timestamp convention (or ordering breaks).
2. File ordering matters — `phase45_cms_tables` must come before `phase45_cms_covers_bucket` if split.
3. Extension schema: Storage bucket commands touch `storage.buckets` — verify Supabase project has the `storage` extension enabled (it is in all hosted Supabase projects by default).
4. Enum-bound dependents: Phase 45 uses NO new enums (D-17 locks `text + CHECK` for path_type). The enum-pain gotcha does not apply here.

### Catalog ID Divergence (memory: `project-catalog-id-divergence`)

The `is_admin` seed UPDATE uses email as the key (D-04) specifically because of this gotcha — profile UUIDs are stable but catalog UUIDs diverge between local and prod seeded separately. The UPDATE is safe because `auth.users.email` is the same in both environments for the single owner.

---

## Cover Image Upload (cms-covers bucket)

### Bucket Design

Mirror `avatars` bucket exactly (Phase 43 pattern), with `cms-covers` as the bucket ID:

```sql
-- cms-covers: public bucket, 4 MB limit, JPEG/PNG/WEBP
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cms-covers', 'cms-covers', true, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

**4-policy RLS (mirrors avatars — critical: upsert needs SELECT policy):**
```sql
-- SELECT (required for upsert:true — learned in Phase 43 gap closure)
-- Path: {listId}/{filename}.jpg — owner writes into list folders, not user folders
-- Since only the owner writes, folder predicate is: file is in cms-covers bucket + user is_admin
DROP POLICY IF EXISTS cms_covers_select_own ON storage.objects;
CREATE POLICY cms_covers_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cms-covers'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin)
  );

-- INSERT
DROP POLICY IF EXISTS cms_covers_insert_own ON storage.objects;
CREATE POLICY cms_covers_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cms-covers'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin)
  );
-- (UPDATE and DELETE mirror the same EXISTS predicate)
```

**Note on path convention:** Since only the owner uploads, there is no per-user folder isolation needed. Path: `{listId}/{filename}.jpg` or `covers/{filename}.jpg` — planner's discretion (Claude's Discretion). The `is_admin` EXISTS predicate provides the write guard.

### Upload Helper (`src/lib/storage/cmsCovers.ts`)

Mirror `src/lib/storage/catalogSourcePhotos.ts` structure:
- `buildCmsCoverPath(listId, filename)` — path builder
- `generateCmsCoverFilename()` — UUID-stamped JPEG filename
- `uploadCmsCover(listId, jpeg, filename?)` — browser Supabase client upload with `upsert: false`

No server-side signed URL needed — bucket is public; CDN URL returned directly from `supabase.storage.from('cms-covers').getPublicUrl(path)`.

---

## Catalog Watch Picker (D-11)

The admin watch-picker typeahead reuses `searchCatalogWatches` from `src/data/catalog.ts`. Key details:

```typescript
// Function signature (VERIFIED: src/data/catalog.ts)
searchCatalogWatches({
  q: string,           // brand/model/reference ILIKE
  viewerId: string,    // for 'owned'/'wishlist' badge (can be owner's userId)
  limit?: number,      // default 20
  filters?: CatalogSearchFilters
}): Promise<SearchCatalogWatchResult[]>
// Returns: { catalogId, brand, model, reference, imageUrl, ownersCount, wishlistCount, viewerState }
```

The typeahead Client Component calls a Server Action that calls `searchCatalogWatches`. Minimum query length is 2 chars (enforced in the function). No debouncing needed for ≤100 catalog rows — the list is tiny.

---

## react-markdown Usage (D-13)

**Version:** `^10.1.0` [ASSUMED — matches REQUIREMENTS.md/STATE.md lock; not yet installed]

```typescript
// Basic usage — no plugins needed for owner-authored content
import Markdown from 'react-markdown'

// Preview pane component (client component)
export function MarkdownPreview({ source }: { source: string }) {
  return (
    <div className="prose">
      <Markdown>{source}</Markdown>
    </div>
  )
}
```

**Security:** `react-markdown@10` blocks `javascript:` URLs by default via `defaultUrlTransform`. Since content is owner-authored only (not UGC), no additional `rehype-sanitize` plugin is needed. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md §"Security"]

**React 19 / Next.js 16 compatibility:** react-markdown@10 supports React 19. No known compatibility issues. [CITED: context7 react-markdown docs]

**Pattern:** Textarea + toggle preview pane in the same client component. Keep preview pane hidden until the "Preview" tab/button is clicked — avoids re-rendering on every keystroke in a SSR context.

---

## Next.js 16 Cache Invalidation (CMS-08)

[VERIFIED: src/app/actions/notifications.ts — detailed comment explains updateTag vs revalidateTag]
[CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md]
[CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md]

Four write paths must call `revalidateTag('explore:hero', 'max')` (STATE.md locked):

| Server Action | Reason |
|---------------|--------|
| `setPinnedHero(listId, expiresAt?)` | Pin override changes hero selection |
| `clearPinnedHero()` | Pin removal changes hero selection |
| `publishCuratedList(listId)` | List enters the eligible hero pool |
| `unpublishCuratedList(listId)` | List leaves the eligible hero pool |

Use `revalidateTag('explore:hero', 'max')` (two-argument, stale-while-revalidate). The single-argument form `revalidateTag(tag)` is deprecated in Next.js 16. [CITED: revalidateTag.md §"Good to know"]

`updateTag` is NOT appropriate here — that is for read-your-own-writes scenarios where the acting user immediately sees their own change. The hero cache is global (all visitors). [CITED: updateTag.md §"Differences from revalidateTag"]

---

## Ordering Pattern (D-12)

```typescript
// Dense integer swap — when user clicks "move up" on item at sortOrder N:
// Swap sortOrder values between item N and item N-1
// No fractional scheme needed for ≤12 list items / ≤4 path nodes

// Server Action: moveCuratedListItemUp(listId, itemId)
// 1. Fetch all items for listId, ordered by sortOrder ASC
// 2. Find item at index i
// 3. Swap sortOrder with item at index i-1
// 4. Write both rows in a transaction

// Drizzle transaction pattern:
await db.transaction(async (tx) => {
  await tx.update(curatedListItems).set({ sortOrder: lowerOrder }).where(eq(curatedListItems.id, itemId))
  await tx.update(curatedListItems).set({ sortOrder: higherOrder }).where(eq(curatedListItems.id, adjacentId))
})
```

Planner may choose dense integer (reindex all items on each move) vs sparse swap (swap only two rows). For ≤12 items, both are trivial. Swap-two-rows is simpler.

---

## RLS Two-Layer Publish Gating (CMS-01, D-03)

The two-layer defense for draft leaks:

**Layer 1 — Database (RLS):** `USING (status = 'published')` policy on the authenticated + anon roles. Even if the app code has a bug, non-owner users cannot read draft rows.

**Layer 2 — Application (DAL):** Explicit `WHERE status = 'published'` in every public-read DAL function. Defense-in-depth so that even if an RLS policy is misconfigured, the app never returns draft data on public paths.

**Owner sees drafts:** A second SELECT policy with the `is_admin` EXISTS predicate allows the owner to read all rows (draft + published). This is an ADDITIONAL policy (Postgres RLS uses OR logic between policies of the same command type) — not a replacement.

**Junction tables (`curated_list_items`, `collection_path_nodes`):** These do not have a `status` column. Their read access should be owner-only (admin SELECT policy) plus public authenticated (to support the Phase 47 list detail page reading items of a published list). The `curated_lists.status` check happens at the DAL join level.

**`cms_settings`:** No public read needed. Owner reads/writes only. Or: public anon read allowed (the Phase 47 hero render reads it; no sensitive data). Planner's discretion.

---

## SECURITY DEFINER Concern (STATE.md / memory: `project_supabase_secdef_grants`)

D-07's plain `ON DELETE RESTRICT` approach deliberately avoids any SECURITY DEFINER function. No SECDEF function is being added in Phase 45.

The memory note `project_supabase_secdef_grants` warns: "REVOKE FROM PUBLIC alone does not block anon; Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions." This is relevant ONLY if a SECURITY DEFINER function is created. Since D-07 uses a plain FK constraint instead, **no REVOKE steps are needed in Phase 45**.

The STATE.md "Key Decisions" note "Supabase SECDEF grants (Phase 45): Any SECURITY DEFINER functions added in the migration require explicit REVOKE EXECUTE FROM anon, authenticated" is a pre-emptive warning that does NOT apply if Phase 45's migration contains no SECDEF functions. Confirm this in the plan SUMMARY explicitly.

---

## Common Pitfalls

### Pitfall 1: Layout Guard Partial Rendering
**What goes wrong:** Admin layout.tsx fires on first load but not on subsequent client-side navigations within `/admin`. A user who loses `is_admin` mid-session could still render admin child pages.
**Why it happens:** Next.js 16 Partial Rendering — layouts do not re-execute on navigation.
**How to avoid:** `assertOwner()` in every Server Action is the real security gate. Layout guard is UX (shows 404/redirect) not security.
**Warning signs:** If you see an `/admin` child page rendering without a layout check — that's correct behavior; the SA guard is sufficient.

### Pitfall 2: Forgetting the SELECT Storage Policy for upsert
**What goes wrong:** `upsert: true` in Supabase Storage client triggers a SELECT on `storage.objects` before INSERT/UPDATE. Without a SELECT policy, the upsert returns 403 even when INSERT and UPDATE policies exist.
**Why it happens:** Supabase Storage's upsert does an object lookup first.
**How to avoid:** Always add a SELECT policy to any bucket used with `upsert: true`. Phase 43 hit this exact bug (see `20260517000000_phase43_avatar_select_policy.sql`).
**Warning signs:** 403 "new row violates row-level security policy" on upload despite INSERT/UPDATE policies.

### Pitfall 3: Using Single-Arg revalidateTag (deprecated)
**What goes wrong:** `revalidateTag('explore:hero')` (single arg) is deprecated in Next.js 16; behavior may be removed in a future version.
**Why it happens:** API changed in Next.js 16.
**How to avoid:** Always use `revalidateTag('explore:hero', 'max')` (two args).

### Pitfall 4: enum for path_type
**What goes wrong:** Postgres enum requires querying `pg_depend` before altering enum-bound dependents; adding/removing values requires dropping dependent columns, default values, etc.
**Why it happens:** Enum-bound-dependent migration pain documented in `project_drizzle_supabase_db_mismatch`.
**How to avoid:** Use `text + CHECK` per D-17. The planner should define the CHECK constraint in the raw SQL migration (not in Drizzle — Drizzle 0.45.2 cannot express CHECK constraints in pg-core DSL).

### Pitfall 5: Catalog ID Divergence in Seed Data
**What goes wrong:** If CMS-10 seed paths are inserted via id-keyed SQL in a migration file (rather than through the UI), they will work on one DB but be no-ops on the other (different catalog UUIDs).
**Why it happens:** `project-catalog-id-divergence` memory — seed inserts omit id column, so both DBs assign different UUIDs.
**How to avoid:** CMS-10 seed paths are authored through the admin UI at execution time (as specified in CONTEXT.md). No migration-level seed for CMS-10 content. If a SQL seed is needed, key by `(brand, model, reference)` natural key via a subquery.

### Pitfall 6: Forgetting the zero-watch publish guard
**What goes wrong:** A list with zero items gets published; Phase 47 renders it as an empty card.
**Why it happens:** CMS-06 requires this guard but it is easy to omit.
**How to avoid:** The `publishCuratedList` Server Action must `COUNT(*)` items before setting status. Return an error if count is 0.

### Pitfall 7: RESTRICT FK blocks future catalog TRUNCATE (D-10)
**What goes wrong:** In v5.2, a bulk catalog wipe/TRUNCATE fails because CMS tables have RESTRICT FKs.
**Why it happens:** D-08 deliberately blocks on any reference (draft or published).
**How to avoid:** Flag this in the plan SUMMARY (D-10 instructs this). The Phase 45 planner does not need to solve it — just document it.

---

## Code Examples

### Existing patterns the planner should reference

#### Drizzle FK with ON DELETE RESTRICT (VERIFIED in codebase)
```typescript
// src/db/schema.ts — watchLineageEdges as established RESTRICT FK pattern
predecessorCatalogId: uuid('predecessor_catalog_id')
  .notNull()
  .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
```

#### Drizzle FK with ON DELETE CASCADE (for list→items relationship)
```typescript
// src/db/schema.ts — standard cascade pattern for child rows
listId: uuid('list_id').notNull().references(() => curatedLists.id, { onDelete: 'cascade' }),
```

#### text + enum for status (NOT pgEnum — matches existing pattern for small enums)
```typescript
// src/db/schema.ts — watches.status as the established text-enum pattern
status: text('status', { enum: ['owned', 'wishlist', 'sold', 'grail'] }).notNull(),
// CMS tables follow same pattern:
status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
```

#### CHECK constraint in raw SQL (Drizzle cannot express it)
```sql
-- From 20260423000002_phase11_notifications.sql pattern:
-- CHECK constraints live in raw SQL migration, not in Drizzle schema.ts
ALTER TABLE public.collection_paths
  ADD CONSTRAINT collection_paths_path_type_check
  CHECK (path_type IN ('Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'));
```

#### DO $$ assertion block (migration sanity check)
```sql
-- From 20260516000000_phase43_avatar_bucket.sql — verify migration applied correctly
DO $$
DECLARE
  bucket_count integer;
  policy_count integer;
BEGIN
  SELECT count(*) INTO bucket_count FROM storage.buckets WHERE id = 'cms-covers';
  SELECT count(*) INTO policy_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'cms_covers_%';
  IF bucket_count <> 1 THEN RAISE EXCEPTION 'cms-covers bucket: expected 1, got %', bucket_count; END IF;
  IF policy_count <> 4 THEN RAISE EXCEPTION 'cms-covers policies: expected 4, got %', policy_count; END IF;
END $$;
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-markdown | Markdown preview (CMS-03, D-13) | ✗ | — | Must install — no viable fallback for Wave 0 |
| supabase CLI | `supabase db push --linked` | [ASSUMED] | — | Cannot push to prod without it |
| drizzle-kit | Local schema push | [ASSUMED] | — | Must be installed for local dev |
| Supabase Storage (cms-covers bucket) | Cover image upload (CMS-03) | ✗ (not yet created) | — | Created by migration file 2 |

**Missing dependencies with no fallback:**
- `react-markdown@^10.1.0` — must be installed in Wave 0 before any admin editor component is built.

**Missing dependencies created by this phase:**
- `cms-covers` Storage bucket — created by the phase migration. Not a blocking dependency for development (code can be written before bucket exists, but uploads will fail until migration runs).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMS-01 | Five tables exist with correct RLS — published-only to non-owners | manual (RLS) | Query as non-owner auth'd user; verify draft rows absent | ❌ Wave 0 (manual UAT) |
| CMS-02 | Admin routes unreachable by non-owners | unit (SA gate) | `npm test -- tests/actions/cms/curatedLists.test.ts` | ❌ Wave 0 |
| CMS-02 | assertOwner() rejects non-admin users | unit | Same file — "not admin" test case | ❌ Wave 0 |
| CMS-03 | Create/edit/delete curated list | unit (SA) | `npm test -- tests/actions/cms/curatedLists.test.ts` | ❌ Wave 0 |
| CMS-04 | Add catalog watches + commentary | unit (SA) | Same file — addWatchToList SA | ❌ Wave 0 |
| CMS-05 | Sort order moves correctly | unit (SA) | `npm test -- tests/actions/cms/curatedLists.test.ts` | ❌ Wave 0 |
| CMS-06 | Publish blocked when zero watches | unit (SA) | Same file — publish zero-watch test case | ❌ Wave 0 |
| CMS-06 | Unpublished lists absent from public DAL | unit (DAL) | `npm test -- tests/data/curatedLists.test.ts` | ❌ Wave 0 |
| CMS-07 | Collection path CRUD | unit (SA) | `npm test -- tests/actions/cms/collectionPaths.test.ts` | ❌ Wave 0 |
| CMS-08 | Hero pin writes revalidateTag | unit (SA mock) | `npm test -- tests/actions/cms/settings.test.ts` | ❌ Wave 0 |
| CMS-09 | DB RESTRICT FK blocks catalog delete | manual (DB) | Attempt `DELETE FROM watches_catalog WHERE id=<referenced>` — expect error | ❌ Wave 0 (manual) |
| CMS-10 | 10 seed paths exist in published state | manual (UI) | View `/admin/paths` — count published paths | N/A (content, not code) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/cms/curatedLists.test.ts` — covers CMS-02, CMS-03, CMS-04, CMS-05, CMS-06
- [ ] `tests/actions/cms/collectionPaths.test.ts` — covers CMS-07
- [ ] `tests/actions/cms/settings.test.ts` — covers CMS-08 (revalidateTag mock)
- [ ] `tests/data/curatedLists.test.ts` — covers CMS-06 DAL: public read returns published only
- [ ] Install `react-markdown`: `npm install react-markdown`
- [ ] Drizzle schema additions: compile-check passes

**Test pattern for SA auth gate (mirrors `tests/actions/watches.test.ts`):**
```typescript
vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error { ... },
  getCurrentUser: vi.fn(),
  assertOwner: vi.fn(),  // NEW — must be added
}))
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}))
```

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + `getCurrentUser()` / `assertOwner()` |
| V3 Session Management | yes (handled by Supabase) | Supabase session cookies — no custom session logic needed |
| V4 Access Control | yes — critical | Three-layer: RLS (DB) + layout guard + `assertOwner()` in every SA |
| V5 Input Validation | yes | zod `.strict()` on every SA input; `sanitizeHttpUrl` on cover image URLs |
| V6 Cryptography | no | No new crypto; Storage uses Supabase-managed signing |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct HTTP POST to CMS Server Action by non-owner | Elevation of Privilege | `assertOwner()` first call in every SA — layout bypass has no effect |
| Draft list exposed via missing RLS | Information Disclosure | Two-layer: RLS `USING(status='published')` + explicit `WHERE` in DAL |
| XSS via markdown intro copy | Tampering | `react-markdown` blocks `javascript:` URLs by default; owner-authored content only |
| Unauthorized cover image overwrite | Tampering | Storage INSERT policy gated on `is_admin` EXISTS predicate |
| SQL injection via catalog watch picker | Tampering | `searchCatalogWatches` uses Drizzle parameterized binds (verified in src/data/catalog.ts) |
| Catalog watch delete orphaning CMS items | Tampering / DoS | ON DELETE RESTRICT FK — DB refuses the delete |
| Mass assignment in SA input | Tampering | zod `.strict()` rejects unknown keys on all SA schemas |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidateTag(tag)` (single arg) | `revalidateTag(tag, 'max')` | Next.js 16 | Single-arg form deprecated — must use two-arg |
| `revalidatePath` for tag-based invalidation | `revalidateTag` + `updateTag` (distinguished) | Next.js 16 | `updateTag` = read-your-own-writes; `revalidateTag('max')` = global SWR |
| Postgres enum for constrained text | `text + CHECK` | Phase 45 decision (D-17) | Avoids enum-bound-dependent migration pain |

**Deprecated/outdated:**
- `revalidateTag(tag)` (single-argument): deprecated in Next.js 16; use `revalidateTag(tag, 'max')`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-markdown@^10.1.0` is compatible with React 19 / Next.js 16 — no known breaking issues | §react-markdown Usage | Would need to find an alternative markdown renderer; low risk, ctx7 confirms support |
| A2 | No `rehype-sanitize` needed because markdown is owner-authored only | §Don't Hand-Roll | If future phase adds non-owner markdown input, sanitization becomes required |
| A3 | Supabase CLI is available in the execution environment for `supabase db push --linked` | §Environment Availability | Plan must include a "verify supabase CLI available" pre-flight |
| A4 | `cms_settings` single-row design (PK=1 + CHECK) is sufficient for Phase 45; Phase 47 reads the same row | §Schema Design | If Phase 47 needs multiple settings rows, schema change needed — low risk for single hero pin |
| A5 | Cover image path convention `{listId}/{filename}.jpg` is cleaner than `{userId}/{listId}/{filename}.jpg` because only the owner writes | §Cover Image | If multi-owner CMS is ever added, folder convention would need a migration |

---

## Open Questions (RESOLVED)

1. **cms_settings public read policy**
   - What we know: Phase 47 hero render reads `cms_settings`. The table contains only the pinned list ID and expiry — no sensitive data.
   - What's unclear: Should `cms_settings` have a public anon SELECT policy (simplest for Phase 47 server component) or owner-only SELECT?
   - Recommendation: Public authenticated SELECT (no sensitive data; simpler Phase 47 integration). Add to planner's discretion.
   - RESOLVED: `cms_settings` gets a public `authenticated, anon` SELECT policy — implemented in Plan 45-01 Task 2 step (5).

2. **Cover image path in cms_settings vs curated_lists**
   - What we know: `cover_url` lives on `curated_lists`; `cms_settings.pinned_list_id` FK points to the list.
   - What's unclear: Phase 47 hero needs the cover URL. It can join `curated_lists` via the FK, or we can denormalize the cover URL into `cms_settings`.
   - Recommendation: Join — don't denormalize. One join is trivial.
   - RESOLVED: Cover image is joined from `curated_lists` via `pinned_list_id` — NOT denormalized into `cms_settings`. Enforced in Plan 45-04 Task 1 (cmsSettings DAL has no cover column).

3. **CMS-10 content selection**
   - What we know: 10 seed collection paths authored through the admin UI. Content (which watches, what themes) is user-selected at execution time.
   - What's unclear: Does the user want suggestions, or will they come prepared?
   - Recommendation: Plan should include a placeholder task: "Author 10 seed collection paths via admin UI — user selects content at execution time." No code change required.
   - RESOLVED: CMS-10 seed-path content is selected by the user during the Plan 45-06 authoring checkpoint — no code change required.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260420000001_social_tables_rls.sql` — RLS naming convention and InitPlan auth.uid() wrapper [VERIFIED]
- `supabase/migrations/20260516000000_phase43_avatar_bucket.sql` — bucket creation + 3-policy pattern [VERIFIED]
- `supabase/migrations/20260517000000_phase43_avatar_select_policy.sql` — 4th SELECT policy (upsert requirement) [VERIFIED]
- `supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql` — alternate bucket pattern [VERIFIED]
- `src/db/schema.ts` — all existing table definitions, FK patterns, index conventions [VERIFIED]
- `src/lib/auth.ts` — `getCurrentUser()` / `UnauthorizedError` patterns [VERIFIED]
- `src/app/actions/profile.ts` — canonical Server Action pattern (zod .strict(), ActionResult, revalidation) [VERIFIED]
- `src/app/actions/notifications.ts` — detailed updateTag vs revalidateTag explanation [VERIFIED]
- `src/data/catalog.ts` — `searchCatalogWatches` function signature and patterns [VERIFIED]
- `src/lib/storage/catalogSourcePhotos.ts` — bucket helper pattern to replicate [VERIFIED]
- `src/lib/actionTypes.ts` — ActionResult<T> type [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — Next.js 16 revalidateTag API [CITED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — updateTag semantics [CITED]
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — layout guard Partial Rendering caveat [CITED]

### Secondary (MEDIUM confidence)
- context7 react-markdown docs — v10 usage, security, React 19 compat [CITED: context7.com/remarkjs/react-markdown]
- `https://github.com/remarkjs/react-markdown/blob/main/readme.md` — security section [CITED]

### Tertiary (LOW confidence)
- None — all claims are verified against codebase or official Next.js 16 docs bundled in node_modules.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase or bundled docs
- Schema design: HIGH — verified against existing schema.ts patterns and migration files
- RLS patterns: HIGH — directly read from existing migration SQL files
- Server Action patterns: HIGH — verified against profile.ts, notifications.ts, watches.test.ts
- react-markdown: MEDIUM — ctx7 and GitHub docs; library not yet installed
- Next.js 16 cache invalidation: HIGH — read directly from bundled docs in node_modules
- Admin layout guard caveat: HIGH — Next.js 16 docs explicitly state Partial Rendering behavior

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable stack; 30-day validity)

# Architecture Research

**Domain:** v5.1 Explore Page Redesign — editorial CMS, catalog enrichment pipeline, /explore route tree, in-app admin CMS, avatar upload
**Researched:** 2026-05-16
**Confidence:** HIGH — grounded directly in the existing codebase (schema.ts, explore/page.tsx, discovery.ts, auth.ts, backfill-taste.ts, storage utilities), PROJECT.md, SEED-008, and sibling STACK.md + PITFALLS.md outputs.

---

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  Browser / Client                                                      │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │ Zustand     │  │ Client Components │  │  Direct Supabase Storage  │ │
│  │ filter-only │  │ (filter sheets,   │  │  upload (avatar, wear     │ │
│  │ ephemeral   │  │  carousels, CMS   │  │  photos, cover images)    │ │
│  │ state only  │  │  forms)           │  │                           │ │
│  └─────────────┘  └──────────────────┘  └───────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
         | Server Actions / Next.js navigation
         v
┌───────────────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router (Server Layer)                                  │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ proxy.ts — edge auth gate; blocks /admin/* + unauthenticated   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ Server Components  ('use cache' + cacheLife + cacheTag)       │     │
│  │  /explore            — page shell (uncached: viewer gate)     │     │
│  │  /explore/lists      — published lists index (ISR 1h)         │     │
│  │  /explore/paths      — paths index (ISR 1h)                   │     │
│  │  /explore/brands     — brand index (ISR 1h, tag:catalog:browse)│    │
│  │  /explore/eras       — era index (ISR 1h, tag:catalog:browse) │     │
│  │  HeroFeature         — cached weekly (tag:explore:hero)       │     │
│  │  CuratedListsRail    — cached 5m (tag:explore:lists)          │     │
│  │  CollectionPathsModule — cached 1h (tag:explore:paths)        │     │
│  │  BrowseCatalogModule — cached 1h (tag:catalog:browse)         │     │
│  └──────────────────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ Server Actions  (mutations, always auth-gated)                │     │
│  │  src/app/actions/cms.ts — createList, updateList,             │     │
│  │    publishList, unpublishList, deleteList,                    │     │
│  │    createListItem, updateListItem, deleteListItem,            │     │
│  │    setPinnedHero, clearPinnedHero                             │     │
│  │  src/app/actions/paths.ts — createPath, updatePath, deletePath│     │
│  │  src/app/actions/profile.ts — uploadAvatar (updated)          │     │
│  └──────────────────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ DAL  src/data/ (server-only, two-layer privacy)               │     │
│  │  cms.ts       — getCuratedLists, getCuratedList, getHeroFeature│    │
│  │  paths.ts     — getCollectionPaths                            │     │
│  │  browse.ts    — getBrandIndex, getEraIndex, getGenreIndex,    │     │
│  │                 getPriceBandIndex                             │     │
│  └──────────────────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ API Routes (one existing, no new ones for v5.1)               │     │
│  │  POST /api/extract-watch  — existing, unchanged               │     │
│  └──────────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
         | Drizzle ORM / SQL
         v
┌───────────────────────────────────────────────────────────────────────┐
│  Supabase Postgres  (RLS enabled project-wide)                         │
│  ┌─────────────────────┐  ┌──────────────────────────────────────┐   │
│  │ Existing tables      │  │ New v5.1 tables                       │   │
│  │  watches_catalog     │  │  curated_lists                        │   │
│  │  brands              │  │  curated_list_items                   │   │
│  │  watch_families      │  │  collection_paths                     │   │
│  │  watch_variants      │  │  collection_path_nodes                │   │
│  │  watch_lineage_edges │  │  cms_settings (hero pin + config)     │   │
│  │  watches, profiles   │  └──────────────────────────────────────┘   │
│  │  follows, etc.       │                                              │
│  └─────────────────────┘                                              │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ Supabase Storage                                              │     │
│  │  catalog-source-photos (existing, private, signed URLs)       │     │
│  │  wear-photos           (existing, private, signed URLs)       │     │
│  │  avatars               (NEW, public bucket, getPublicUrl)     │     │
│  │  explore-covers        (NEW, public bucket, getPublicUrl)     │     │
│  └──────────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
         |
┌───────────────────────────────────────────────────────────────────────┐
│  Operator Tooling  scripts/                                            │
│  backfill-taste.ts     (existing — extend for v5.1 enrichment run)    │
│  reenrich-taste.ts     (existing — add --min-confidence-threshold)     │
│  refresh-counts.ts     (existing — call revalidateTag after run)       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## New Database Tables — Schema Sketches

### (a) `curated_lists`

The primary CMS entity. One row per editorial list authored by the admin.

```typescript
// Drizzle schema sketch (src/db/schema.ts addition)
export const curatedListStatusEnum = pgEnum('curated_list_status', ['draft', 'published'])

export const curatedLists = pgTable(
  'curated_lists',
  {
    id:           uuid('id').defaultRandom().primaryKey(),
    // authorId references the owner user (admin only ever writes this table)
    authorId:     uuid('author_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    title:        text('title').notNull(),
    slug:         text('slug').notNull(),
    introCopy:    text('intro_copy'),            // rendered as markdown via react-markdown
    coverImagePath: text('cover_image_path'),    // Supabase Storage path in explore-covers bucket
    status:       curatedListStatusEnum('status').notNull().default('draft'),
    // watchCount cached to avoid subquery per card on the rail
    watchCount:   integer('watch_count').notNull().default(0),
    // hero quality gate flags: set on publish
    hasIntroCopy:  boolean('has_intro_copy').notNull().default(false),
    hasCoverImage: boolean('has_cover_image').notNull().default(false),
    publishedAt:  timestamp('published_at', { withTimezone: true }),
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('curated_lists_slug_unique').on(table.slug),
    index('curated_lists_status_published_at_idx').on(table.status, table.publishedAt),
  ]
)
```

**RLS policy shape (in Supabase migration SQL — not expressible in Drizzle DSL):**

```sql
-- Public readers see ONLY published rows
CREATE POLICY "curated_lists_public_read"
  ON curated_lists FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Admin (author) can read their own drafts too
CREATE POLICY "curated_lists_author_read_own"
  ON curated_lists FOR SELECT
  TO authenticated
  USING (status = 'published' OR author_id = auth.uid());

-- Author can write; WITH CHECK enforces ownership on INSERT/UPDATE
CREATE POLICY "curated_lists_author_write"
  ON curated_lists FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
```

Two-layer defense: DAL public-read functions must also include `WHERE status = 'published'` — do not rely on RLS alone. This is the two-layer privacy posture established in Phase 11 and required per PITFALLS.md CP-01.

---

### (b) `curated_list_items`

Junction table: one row per watch in a list, with per-item editorial commentary.

```typescript
export const curatedListItems = pgTable(
  'curated_list_items',
  {
    id:        uuid('id').defaultRandom().primaryKey(),
    listId:    uuid('list_id').notNull()
                 .references(() => curatedLists.id, { onDelete: 'cascade' }),
    // ON DELETE RESTRICT: deleting a catalog row referenced in any list item is blocked.
    // Admin must remove the watch from the list (or unpublish the list) before deleting
    // the catalog row. Prevents silent broken cards on /explore.
    catalogId: uuid('catalog_id').notNull()
                 .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    commentary: text('commentary'),             // per-item editorial note; markdown
    sortOrder:  integer('sort_order').notNull().default(0),
    createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('curated_list_items_list_catalog_unique').on(table.listId, table.catalogId),
    index('curated_list_items_list_id_sort_idx').on(table.listId, table.sortOrder),
  ]
)
```

**FK shape rationale:** `ON DELETE CASCADE` from list (list deleted → items deleted, correct); `ON DELETE RESTRICT` from catalog (catalog deletion blocked if referenced by any list item — forces operator to clean up the list before deleting a catalog row). This prevents PITFALLS.md CP-05.

**RLS:** DAL join always filters by `curated_lists.status = 'published'` for public reads. A direct SELECT on `curated_list_items` by non-admin readers surfaces only items whose parent list is published via the JOIN-through strategy.

---

### (c) `collection_paths` and `collection_path_nodes`

Curated traversal patterns. Two tables: one for the path entity, one for the ordered sequence of catalog references.

```typescript
export const collectionPathSourceEnum = pgEnum('collection_path_source', ['manual', 'computed'])

export const collectionPaths = pgTable(
  'collection_paths',
  {
    id:        uuid('id').defaultRandom().primaryKey(),
    title:     text('title').notNull(),         // e.g. "The Diver's Journey"
    rationale: text('rationale'),               // editorial copy; markdown
    source:    collectionPathSourceEnum('source').notNull().default('manual'),
    status:    curatedListStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collection_paths_status_idx').on(table.status),
  ]
)

export const collectionPathNodes = pgTable(
  'collection_path_nodes',
  {
    id:        uuid('id').defaultRandom().primaryKey(),
    pathId:    uuid('path_id').notNull()
                 .references(() => collectionPaths.id, { onDelete: 'cascade' }),
    // ON DELETE RESTRICT: a path node cannot be orphaned. Operator must remove
    // the node or unpublish the path before deleting the referenced catalog row.
    catalogId: uuid('catalog_id').notNull()
                 .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    position:  integer('position').notNull(),   // 0 = seed; 1, 2, 3 = follow-on
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('collection_path_nodes_path_position_unique').on(table.pathId, table.position),
    index('collection_path_nodes_path_id_idx').on(table.pathId, table.position),
  ]
)
```

**RLS:** Same shape as `curated_lists` — `USING (status = 'published')` for public reads. Admin reads own drafts via the `OR author_id = auth.uid()` fallback (collection_paths does not have a direct author_id; use a service-role read in the admin CMS or add an `author_id` column matching the same pattern).

---

### (d) `cms_settings`

Single-row config table for Hero pin and quality-gate thresholds. Storing this in the DB (not environment variables) ensures the Hero Server Component reads live state on every cache refresh cycle.

```typescript
export const cmsSettings = pgTable(
  'cms_settings',
  {
    id:                    uuid('id').defaultRandom().primaryKey(),
    // Manual hero pin — overrides auto-selection while non-NULL
    pinnedListId:          uuid('pinned_list_id')
                             .references(() => curatedLists.id, { onDelete: 'set null' }),
    // Hero quality gate thresholds (configurable without a deploy)
    heroMinWatchCount:     integer('hero_min_watch_count').notNull().default(3),
    heroRequiresIntroCopy: boolean('hero_requires_intro_copy').notNull().default(true),
    heroRequiresCoverImage: boolean('hero_requires_cover_image').notNull().default(true),
    updatedAt:             timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }
)
```

The `pinnedListId` FK uses `ON DELETE SET NULL` — if the pinned list is deleted, the pin clears automatically and auto-selection resumes.

---

### FK Shape Summary

| Relationship | FK Column | ON DELETE | Rationale |
|---|---|---|---|
| `curated_list_items.list_id → curated_lists.id` | `list_id` | CASCADE | Items deleted when parent list is deleted |
| `curated_list_items.catalog_id → watches_catalog.id` | `catalog_id` | **RESTRICT** | Blocks catalog deletion if referenced in any list |
| `collection_path_nodes.path_id → collection_paths.id` | `path_id` | CASCADE | Nodes deleted when path is deleted |
| `collection_path_nodes.catalog_id → watches_catalog.id` | `catalog_id` | **RESTRICT** | Blocks catalog deletion if referenced in any path |
| `cms_settings.pinned_list_id → curated_lists.id` | `pinned_list_id` | SET NULL | Pin clears automatically if the pinned list is deleted |
| `curated_lists.author_id → users.id` | `author_id` | RESTRICT | Prevents orphaned lists if author account were deleted |

---

### Migration Path

All new tables follow the established Drizzle + Supabase split pattern:

- **`src/db/schema.ts`** — column shapes, FK references, TypeScript type inference only
- **Supabase migration `.sql` file** — authoritative DDL including RLS policies, GIN indexes, GRANT/REVOKE, CHECK constraints, enum creation
- **Production push** — `supabase db push --linked` only (never `drizzle-kit push` to prod)

Suggested single migration file for the initial schema: `supabase/migrations/20260516000000_phase_v51_cms_tables.sql` covering all five new tables and both new Storage buckets. The `curated_list_status` enum (shared by `curated_lists` and `collection_paths`) and the `collection_path_source` enum must be created before the tables that reference them.

---

## `/explore` Route Tree + Rendering Strategy

### Route Tree

```
src/app/
├── explore/
│   ├── page.tsx                    -- /explore shell (MODIFIED: 5-module layout)
│   ├── collectors/
│   │   └── page.tsx                -- existing /explore/collectors (unchanged)
│   ├── watches/
│   │   └── page.tsx                -- existing /explore/watches (unchanged)
│   ├── lists/
│   │   ├── page.tsx                -- NEW /explore/lists — all published lists
│   │   └── [slug]/
│   │       └── page.tsx            -- NEW /explore/lists/[slug] — list detail
│   ├── paths/
│   │   ├── page.tsx                -- NEW /explore/paths — all paths
│   │   └── [id]/
│   │       └── page.tsx            -- NEW /explore/paths/[id] — path detail
│   ├── brands/
│   │   └── page.tsx                -- NEW /explore/brands — brand index
│   ├── eras/
│   │   └── page.tsx                -- NEW /explore/eras — era index
│   ├── genres/
│   │   └── page.tsx                -- NEW /explore/genres — genre/style index
│   └── price-bands/
│       └── page.tsx                -- NEW /explore/price-bands — price-band index
├── admin/
│   ├── layout.tsx                  -- NEW — owner gate at layout level
│   ├── lists/
│   │   ├── page.tsx                -- NEW /admin/lists — list dashboard
│   │   ├── new/
│   │   │   └── page.tsx            -- NEW /admin/lists/new
│   │   └── [id]/
│   │       └── page.tsx            -- NEW /admin/lists/[id] — edit + publish
│   └── paths/
│       ├── page.tsx                -- NEW /admin/paths
│       ├── new/
│       │   └── page.tsx            -- NEW /admin/paths/new
│       └── [id]/
│           └── page.tsx            -- NEW /admin/paths/[id]
```

---

### Rendering Strategy

#### `/explore` main shell

The page-level Server Component remains uncached to preserve viewer-dependent logic (the sparse-network hero gate that checks `followingCount` and `wearEventsCount`). Each of the 5 modules is a separately-cached nested Server Component. This is an extension of the existing Phase 18/25 rail pattern.

```
ExplorePage (Server Component, uncached — viewer-dependent gate)
├── HeroFeature ('use cache', cacheLife 604800, cacheTag('explore:hero'))
├── CollectorArchetypes (hardcoded config — no DB fetch, no cache needed)
├── CuratedListsRail ('use cache', cacheLife 300, cacheTag('explore:lists'))
├── CollectionPathsModule ('use cache', cacheLife 3600, cacheTag('explore:paths'))
└── BrowseCatalogModule ('use cache', cacheLife 3600, cacheTag('catalog:browse'))
```

**Cache scopes by module:**

| Module | Cache TTL | Cache Tags | What Invalidates It |
|---|---|---|---|
| HeroFeature | 604800s (weekly) | `explore:hero` | `setPinnedHero`, `clearPinnedHero`, `publishList`, `unpublishList` |
| CuratedListsRail | 300s (5m) | `explore:lists` | `publishList`, `unpublishList`, `updateList` (cover, title changes) |
| CollectionPathsModule | 3600s (1h) | `explore:paths` | `createPath`, `updatePath`, `deletePath` |
| BrowseCatalogModule | 3600s (1h) | `catalog:browse` | Enrichment script writes, `refresh-counts.ts` run |
| CollectorArchetypes | N/A — no fetch | N/A | Config change requires a deploy |

**Critical constraint — `revalidateTag`, not `revalidatePath`.** Nested `'use cache'` Server Components are not invalidated by `revalidatePath('/explore')`. Every Server Action that mutates CMS data must call `revalidateTag(tag)` for each affected module. This is the established codebase pattern (Phase 13 `updateTag` vs `revalidateTag` distinction; Phase 18 `revalidateTag('explore', 'max')` for SWR fan-out). PITFALLS.md MP-07 documents the specific Hero pin cache-miss failure mode.

#### Browse index sub-routes

Each of `/explore/brands`, `/explore/eras`, `/explore/genres`, `/explore/price-bands` is a Server Component that runs a GROUP BY aggregation query and caches the result under the `catalog:browse` tag.

```typescript
// Pattern for each Browse index page (e.g., src/app/explore/brands/page.tsx)
export default async function BrandsIndexPage() {
  const brands = await getBrandIndex()
  // render groups with counts
}

// src/data/browse.ts
async function getBrandIndex() {
  'use cache'
  cacheTag('catalog:browse')
  cacheLife({ revalidate: 3600 })
  return db
    .select({ name: brands.name, slug: brands.slug, count: sql<number>`count(*)::int` })
    .from(watchesCatalog)
    .innerJoin(brands, eq(watchesCatalog.brandId, brands.id))
    .groupBy(brands.id, brands.name, brands.slug)
    .orderBy(desc(sql`count(*)`))
}
```

These sub-routes share the `catalog:browse` cache tag with the BrowseCatalogModule on the main `/explore` page, so enrichment writes invalidate all of them simultaneously.

#### List detail (`/explore/lists/[slug]`)

A Server Component with its own cache scope:

```typescript
'use cache'
cacheTag('explore:lists', `list:${slug}`)
cacheLife({ revalidate: 3600 })
```

`publishList` and `unpublishList` call `revalidateTag('explore:lists')` to invalidate all list pages. `updateList` on a specific list can call `revalidateTag(`list:${id}`)` for precision invalidation.

#### `/admin/*` routes

No cache — always fresh. Admin routes must render live draft state so the operator sees current content. Since `proxy.ts` blocks these routes for non-owners at the edge, no cache security risk.

---

## In-App Admin CMS — Owner Gating

### Route Guard (layout level)

`src/app/admin/layout.tsx` performs owner verification at the layout level:

```typescript
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

const OWNER_USER_ID = process.env.OWNER_USER_ID!

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (user.id !== OWNER_USER_ID) redirect('/explore')
  return <>{children}</>
}
```

Add `/admin` to the non-public paths in `proxy.ts` (the `PUBLIC_PATHS` constant from Phase 14) so unauthenticated users are redirected to `/login` before the layout gate runs.

### Server Action Pattern — Every CMS Action

Route-level gating is insufficient because Server Actions are directly callable HTTP endpoints. Every Server Action in `src/app/actions/cms.ts` must assert ownership as its literal first statement:

```typescript
'use server'
import { getCurrentUser } from '@/lib/auth'

const OWNER_USER_ID = process.env.OWNER_USER_ID!

async function assertOwner() {
  const user = await getCurrentUser()
  if (user.id !== OWNER_USER_ID) throw new Error('Unauthorized')
  return user
}

export async function createCuratedList(data: CreateListInput) {
  const user = await assertOwner()  // ALWAYS FIRST — see PITFALLS.md CP-02
  // ... mutation logic
  revalidateTag('explore:lists')
}

export async function publishList(listId: string) {
  const user = await assertOwner()  // ALWAYS FIRST
  // validate: watch_count >= 1 (cannot publish empty list)
  // set status = 'published', publishedAt = now(), has_intro_copy, has_cover_image flags
  revalidateTag('explore:lists')
  revalidateTag('explore:hero')     // hero eligibility pool changes when a list publishes
}

export async function setPinnedHero(listId: string) {
  const user = await assertOwner()  // ALWAYS FIRST
  // UPDATE cms_settings SET pinned_list_id = listId
  revalidateTag('explore:hero')     // NOT revalidatePath — see PITFALLS.md MP-07
}
```

The RLS `WITH CHECK (author_id = auth.uid())` on `curated_lists` provides database-layer defense-in-depth — even a crafted request reaching the Supabase client directly is blocked.

### Server Actions vs API Routes

All CMS mutations are Server Actions, not API routes. The sole API route (`POST /api/extract-watch`) exists specifically because it must proxy external fetches server-side to avoid CORS and keep the Anthropic API key off the client. CMS mutations are direct DB writes — no such requirement exists. Server Actions are the correct pattern for this codebase.

### `OWNER_USER_ID` Environment Variable

The owner's Supabase Auth UUID is stored in `OWNER_USER_ID` env var — set in Vercel environment variables and `.env.local`. Never hardcode the UUID in source code; it must not appear in git history.

---

## Catalog Enrichment — Where It Runs

### Where: Operator Script (extend `scripts/backfill-taste.ts`)

The v5.1 catalog enrichment is a one-time operator-run backfill of ~100 existing `watches_catalog` rows. The established precedent in `scripts/backfill-taste.ts` is the correct approach at this scale.

Do not use:
- An API route — exposes enrichment as an HTTP endpoint, creates a security surface, cannot exceed Vercel's function timeout for 100 rows
- pg_cron — enrichment is a one-time fill, not a recurring scheduled task
- Anthropic Batch API — appropriate for 1,000+ rows; adds async polling complexity for no benefit at 100 rows (STACK.md confirmed)

### Idempotency and Resumability

The existing `backfill-taste.ts` already handles idempotency via first-write-wins (`AND confidence IS NULL` predicate in `updateCatalogTaste`). Running the script multiple times is safe; already-enriched rows are skipped.

Required additions before the v5.1 prod run (see PITFALLS.md MP-04 and MP-05):

1. **Rate-limit retry** — exponential backoff (2s/4s/8s, 3 attempts) triggered on `Anthropic.RateLimitError` inside the batch loop. The existing `catch (err) { totalFailed++ }` handler must distinguish rate-limit errors from other failures.
2. **Inter-row delay** — `await new Promise(r => setTimeout(r, 800))` between rows. At 800ms/row, 100 rows takes ~80 seconds, safely within the RPM limit.
3. **Per-row failure logging** — log each failed `catalog_id` explicitly, not just a cumulative count.
4. **`--min-confidence-threshold` flag on `reenrich-taste.ts`** — only re-enriches rows where existing confidence is BELOW the threshold, preventing high-confidence vision-enriched rows from being silently downgraded (PITFALLS.md CP-03, MP-05).
5. **Photo-existence pre-check** — when re-enriching a vision-enriched row (`extracted_from_photo = true`), verify the photo path still resolves before running the LLM call. Warn the operator if the photo is missing instead of silently falling back to text mode.

### After the Enrichment Run

The enrichment script calls `revalidateTag('catalog:browse')` after successful completion (or the operator runs `npm run db:refresh-counts` which is extended to do the same). This invalidates the Browse index cache so updated archetype/era data is reflected immediately.

Post-run assertion before any Archetypes-module ship:
```sql
SELECT primary_archetype, count(*) FROM watches_catalog GROUP BY primary_archetype ORDER BY count DESC;
```
Each archetype config entry must have at least one matching row in the catalog.

---

## Avatar Upload — Supabase Storage

### Bucket: `avatars` (new, public)

A separate public-read bucket distinct from `catalog-source-photos` (private, signed URLs). Profile avatars must be publicly accessible without expiry. Signed URLs expire (60s in the existing enricher pattern) — an expiring avatar URL breaks navigation headers on every page after expiry (PITFALLS.md MP-06).

```
Supabase Storage buckets after v5.1:
  catalog-source-photos  — private; signed URLs (existing)
  wear-photos            — private; signed URLs (existing)
  avatars                — PUBLIC; getPublicUrl (NEW)
  explore-covers         — PUBLIC; getPublicUrl (NEW — curated list covers + hero images)
```

### Upload Pattern

The client-side EXIF-strip + canvas-resize-to-JPEG-1080px pipeline exists in `src/lib/storage/catalogSourcePhotos.ts` and `src/lib/storage/wearPhotos.ts`. For avatar upload, extract the shared resize+encode logic into `src/lib/storage/imageUtils.ts` and call it from a new `src/lib/storage/avatars.ts` with `getPublicUrl` retrieval:

```typescript
// src/lib/storage/avatars.ts
const AVATARS_BUCKET = 'avatars'

export function buildAvatarPath(userId: string): string {
  return `${userId}/avatar.jpg`   // fixed path; upload overwrites previous avatar
}

export function getAvatarPublicUrl(path: string): string {
  const supabase = createSupabaseClient()
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return data.publicUrl            // no expiry; public bucket
}
```

After upload, `uploadAvatar` Server Action (in `src/app/actions/profile.ts`) updates `profiles.avatar_url` to the public URL. The URL stored in the column must not contain an expiry parameter — verify this in acceptance testing.

Add the Supabase Storage CDN hostname for the `avatars` bucket to `next.config.ts` `remotePatterns` if it differs from the existing `catalog-source-photos` entry.

---

## Architectural Patterns

### Pattern 1: Nested 'use cache' with Tag-Based Invalidation

**What:** Page-level Server Component renders uncached (preserves viewer-dependent logic). Module-level Server Components each have their own `'use cache'` scope with named tags. Server Actions that mutate data call `revalidateTag(tag)` — not `revalidatePath`.

**When to use:** Any page that mixes viewer-dependent gating with globally-cacheable editorial content. The existing `/explore` page uses this pattern; v5.1 extends it to 5 modules.

**Trade-off:** Requires maintaining an explicit invalidation matrix for every write path. Worth it — the alternative (page-level caching) would either serve stale viewer-dependent state or skip caching entirely.

### Pattern 2: Two-Layer Privacy on Draft/Published Content

**What:** RLS `USING (status = 'published')` at the DB layer + explicit `WHERE status = 'published'` in every DAL public-read function. Neither layer alone is sufficient.

**When to use:** Any table with a draft/published lifecycle: `curated_lists`, `collection_paths`.

**Trade-off:** Slightly more DAL code. Required — single-layer is fragile (Phase 11 established this as a project-wide constraint).

### Pattern 3: Owner-Asserting Server Actions

**What:** `assertOwner()` called as the literal first statement in every CMS Server Action. Route-level layout gating is defense-in-depth only.

**When to use:** Any Server Action that performs admin-only writes.

**Trade-off:** Minor repetition of the owner check. Required — Server Actions are HTTP-callable endpoints that bypass layout-level gates.

### Pattern 4: ON DELETE RESTRICT for Editorial Catalog References

**What:** `curated_list_items.catalog_id` and `collection_path_nodes.catalog_id` use `ON DELETE RESTRICT`. This prevents catalog deletion from silently breaking published editorial content.

**Contrast with:** `watches.catalog_id` which uses `ON DELETE SET NULL` — per-user watch entries survive catalog cleanup gracefully because the user still owns the physical watch.

**When to use:** Any table that references a catalog row in a way that would produce a broken user-facing UI if the catalog row disappeared.

---

## Data Flow

### Hero Selection Flow

```
Server request to /explore
  -> ExplorePage (uncached)
    -> HeroFeature ('use cache', weekly TTL)
      -> getCmsSettings()  -- read pinnedListId
      IF pinnedListId IS NOT NULL:
        -> getCuratedList(pinnedListId)  -- return pinned list as hero
      ELSE:
        -> SELECT FROM curated_lists
             WHERE status = 'published'
             AND watch_count >= heroMinWatchCount
             AND has_intro_copy = true
             AND has_cover_image = true
             ORDER BY published_at DESC
             LIMIT 1
      -> render HeroFeature with resolved HeroFeatureData
      -> IF no eligible list: return null (module hidden, not empty container)

Admin sets pin -> setPinnedHero(listId) Server Action
  -> assertOwner()
  -> UPDATE cms_settings SET pinned_list_id = listId
  -> revalidateTag('explore:hero')   -- NOT revalidatePath('/explore')
  -> hero updates on next request cycle
```

### CMS Authoring Flow

```
Admin visits /admin/lists/new
  -> proxy.ts blocks unauthenticated users -> /login
  -> AdminLayout assertOwner() -- server-side
  -> renders CMS form (Server Component shell, Client form)

Admin submits create form
  -> createCuratedList Server Action
    -> assertOwner()               -- FIRST
    -> validate: title required, slug unique
    -> INSERT INTO curated_lists (status = 'draft')
    -> revalidateTag('explore:lists')
    -> redirect to /admin/lists/{id}

Admin adds watches to list
  -> addListItem Server Action
    -> assertOwner()
    -> INSERT INTO curated_list_items
    -> UPDATE curated_lists SET watch_count = watch_count + 1, updated_at = now()
    -> revalidateTag(`list:${listId}`)

Admin publishes list
  -> publishList Server Action
    -> assertOwner()
    -> validate: watch_count >= 1 (cannot publish empty list)
    -> UPDATE status = 'published', publishedAt = now()
    -> UPDATE has_intro_copy, has_cover_image quality-gate flags
    -> revalidateTag('explore:lists')
    -> revalidateTag('explore:hero')  -- list now in hero eligibility pool
```

### Catalog Enrichment Flow

```
Operator runs: npm run db:backfill-taste (extended for v5.1)
  -> scripts/backfill-taste.ts
    -> SELECT catalog rows WHERE confidence IS NULL (idempotent predicate)
    -> FOR EACH row:
        -> IF photoPath exists AND storage resolves: vision mode
        -> ELSE: text-only mode (log warning if photo was expected)
        -> call claude-sonnet-4-6 with strict tool_use
        -> write taste columns via updateCatalogTaste (first-write-wins DAL)
        -> await 800ms (rate limit buffer between rows)
        -> ON RateLimitError: exponential backoff retry (2s / 4s / 8s)
        -> ON other failure: log catalog_id + error; continue
    -> log coverage distribution: SELECT primary_archetype, count(*) GROUP BY ...
    -> revalidateTag('catalog:browse')
```

### Avatar Upload Flow

```
User visits /settings -> Profile tab (ProfileSection.tsx)
  -> AvatarUpload Client Component renders
  -> user selects file
    -> EXIF strip (client-side, via imageUtils.ts shared utility)
    -> canvas resize to JPEG <= 1080px
    -> supabase.storage.from('avatars').upload(buildAvatarPath(userId), blob)
    -> supabase.storage.from('avatars').getPublicUrl(path) -> publicUrl
  -> uploadAvatar Server Action
    -> getCurrentUser()               -- auth gate
    -> UPDATE profiles SET avatar_url = publicUrl
    -> revalidateTag(`profile:${user.id}`)
    -> return new publicUrl
  -> AvatarUpload renders new avatar from publicUrl (no expiry, public bucket)
```

---

## Component Boundaries

| Component | Location | Responsibility | Renders As |
|---|---|---|---|
| `ExplorePage` | `src/app/explore/page.tsx` | Shell, viewer gate, 5-module composition | Server Component (uncached) |
| `HeroFeature` | `src/components/explore/HeroFeature.tsx` | Hero selection, quality gate, render | Server Component ('use cache') |
| `CollectorArchetypes` | `src/components/explore/CollectorArchetypes.tsx` | Hardcoded archetype chip rail | Server Component (no cache needed) |
| `CuratedListsRail` | `src/components/explore/CuratedListsRail.tsx` | Published list rail (up to 12) | Server Component ('use cache') |
| `CollectionPathsModule` | `src/components/explore/CollectionPathsModule.tsx` | 3 rotating published paths | Server Component ('use cache') |
| `BrowseCatalogModule` | `src/components/explore/BrowseCatalogModule.tsx` | 4-facet entry points with counts | Server Component ('use cache') |
| `AdminLayout` | `src/app/admin/layout.tsx` | Owner gate (layout level) | Server Component (uncached) |
| `CmsListForm` | `src/components/admin/CmsListForm.tsx` | Create/edit list (title, intro, cover) | Client Component (form state) |
| `CmsListItemsEditor` | `src/components/admin/CmsListItemsEditor.tsx` | Add/reorder/annotate watches in list | Client Component |
| `AvatarUpload` | `src/components/profile/AvatarUpload.tsx` | File picker + resize + upload | Client Component |

**New DAL files:**

| File | Functions |
|---|---|
| `src/data/cms.ts` | `getPublishedLists`, `getCuratedList`, `getHeroFeature`, `getPublishedPaths` |
| `src/data/browse.ts` | `getBrandIndex`, `getEraIndex`, `getGenreIndex`, `getPriceBandIndex` |

**New storage files:**

| File | Functions |
|---|---|
| `src/lib/storage/avatars.ts` | `buildAvatarPath`, `getAvatarPublicUrl` |
| `src/lib/storage/exploreCovers.ts` | `buildCoverPath`, `getCoverPublicUrl` |
| `src/lib/storage/imageUtils.ts` | Shared EXIF-strip + canvas-resize (extracted from existing storage files) |

---

## Suggested Build Order

Dependencies drive this order. Each phase builds on stable foundations from the previous one.

### Phase 1: Polish (no new DB tables; standalone)

- Filter drawer dismiss bug fix + `@base-ui/react/drawer` migration in `sheet.tsx`
- Wishlist card wear-UI gate (`status === 'owned'` guard in `ProfileWatchCard.tsx`)
- Watch card fixed-height metadata block
- Avatar upload: create `avatars` public bucket + `src/lib/storage/avatars.ts` + `AvatarUpload` component + `ProfileSection.tsx` rewrite
- Update `claude-sonnet-4-20250514` → `claude-sonnet-4-6` in `src/lib/extractors/llm.ts` (model deprecates June 15, 2026)

Avatar upload belongs in Polish because it requires only the new `avatars` bucket and an update to `profiles.avatar_url` — no new tables.

### Phase 2: Catalog Enrichment (prerequisite for Browse + Archetypes)

- Extend `backfill-taste.ts`: rate-limit retry, 800ms inter-row delay, per-row failure logging
- Add `--min-confidence-threshold` to `reenrich-taste.ts`
- Add photo-existence pre-check to `reenrich-taste.ts`
- Run backfill against production
- Verify archetype coverage via `SELECT primary_archetype, count(*) GROUP BY ...` before proceeding to Phase 4

This phase must complete and be verified in prod before Phase 4 (Browse + Archetypes) ships, because:
- Browse indices show counts derived from enriched `era`, `style_tags`, `primary_archetype` columns
- Collector Archetype deep-links produce empty results if `primary_archetype` is NULL on all catalog rows

### Phase 3: CMS Data Model + Admin Routes (prerequisite for Curated Lists Rail and Hero)

- DB migration: all 5 new tables + RLS policies + enum types
- Create `explore-covers` public Storage bucket
- `src/data/cms.ts` DAL (public reads with `WHERE status = 'published'`)
- `src/app/actions/cms.ts` Server Actions (owner-gated, `assertOwner()` first)
- `src/app/actions/paths.ts` Server Actions
- `/admin/lists/*` and `/admin/paths/*` routes + CMS forms
- Seed initial 10 collection paths via admin UI

The admin routes and CMS data model must exist before any front-end module reads from them (Curated Lists Rail, Hero). Without content in `curated_lists`, those modules render null — which is correct graceful degradation, but they cannot be meaningfully tested.

### Phase 4: Explore Shell + Browse + Archetypes

- New `/explore` page shell (5-module grid layout; replaces existing)
- `src/data/browse.ts` with `cacheTag('catalog:browse')` + `cacheLife({ revalidate: 3600 })`
- Browse the Catalog module + 4 sub-routes (`/explore/brands`, `/explore/eras`, `/explore/genres`, `/explore/price-bands`)
- Collector Archetypes chip rail (hardcoded config, no new DB queries)
- Add `catalog:browse` `revalidateTag` call to `refresh-counts.ts`

Catalog enrichment (Phase 2) must be complete in prod before this phase ships so archetype deep-links return non-empty results.

### Phase 5: Curated Lists Rail + Hero + Where Collections Go

- Curated Lists Rail component (reads `curated_lists` via `src/data/cms.ts`)
- `/explore/lists` all-lists page + `/explore/lists/[slug]` detail page
- Hero module with auto-selection logic, quality gate, and manual-pin support
- `cms_settings` read/write (pin + quality threshold)
- Where Collections Go module (`collection_paths` + `collection_path_nodes`)
- `/explore/paths` all-paths page + `/explore/paths/[id]` detail page
- Invalidation matrix for Hero: `setPinnedHero`, `clearPinnedHero`, `publishList`, `unpublishList` all call `revalidateTag('explore:hero')`

Hero depends on: curated lists existing in the DB (Phase 3) AND at least one published list meeting quality thresholds (admin-authored content). Hero must hide gracefully (return `null`, not an empty container) when no eligible list exists.

---

## Modified vs New — Explicit Inventory

### Modified Files (extend; do not break existing contracts)

| File | What Changes |
|---|---|
| `src/app/explore/page.tsx` | Add 5-module layout; replace existing 3-rail composition |
| `src/db/schema.ts` | Add 5 new table exports + 2 new enum exports |
| `src/lib/types.ts` | Add `CuratedList`, `CuratedListItem`, `CollectionPath`, `HeroFeature` discriminated union types |
| `scripts/backfill-taste.ts` | Rate-limit retry + inter-row delay + per-row failure logging |
| `scripts/reenrich-taste.ts` | `--min-confidence-threshold` flag + photo-existence pre-check |
| `scripts/refresh-counts.ts` | Call `revalidateTag('catalog:browse')` after count refresh |
| `src/components/ui/sheet.tsx` | Migrate `@base-ui/react/dialog` -> `@base-ui/react/drawer`; public API unchanged |
| `src/components/profile/ProfileSection.tsx` | Add `AvatarUpload` component; replace URL-string stub |
| `src/components/watch/ProfileWatchCard.tsx` | Gate all wear UI on `status === 'owned'` |
| `next.config.ts` | Add `avatars` + `explore-covers` bucket CDN domains to `remotePatterns` |
| `proxy.ts` (PUBLIC_PATHS) | Add `/admin` prefix to non-public path list |
| `src/lib/extractors/llm.ts` | `claude-sonnet-4-20250514` -> `claude-sonnet-4-6` (one-line change, deprecation June 15 2026) |

### New Files

| File | What It Is |
|---|---|
| `src/data/cms.ts` | DAL for public reads of curated lists + hero + paths |
| `src/data/browse.ts` | DAL for Browse index aggregation queries |
| `src/app/actions/cms.ts` | Owner-gated Server Actions for all CMS mutations |
| `src/app/actions/paths.ts` | Owner-gated Server Actions for path authoring |
| `src/app/admin/layout.tsx` | Owner gate layout |
| `src/app/admin/lists/**` | Admin CMS pages for list authoring |
| `src/app/admin/paths/**` | Admin CMS pages for path authoring |
| `src/app/explore/lists/**` | Public list index + list detail routes |
| `src/app/explore/paths/**` | Public paths index + path detail routes |
| `src/app/explore/brands/page.tsx` | Brand index |
| `src/app/explore/eras/page.tsx` | Era index |
| `src/app/explore/genres/page.tsx` | Genre/style index |
| `src/app/explore/price-bands/page.tsx` | Price-band index |
| `src/components/explore/HeroFeature.tsx` | Hero module |
| `src/components/explore/CuratedListsRail.tsx` | Lists rail |
| `src/components/explore/CollectorArchetypes.tsx` | Archetype chip rail |
| `src/components/explore/CollectionPathsModule.tsx` | Paths module |
| `src/components/explore/BrowseCatalogModule.tsx` | Browse module |
| `src/components/admin/CmsListForm.tsx` | List authoring form |
| `src/components/admin/CmsListItemsEditor.tsx` | Per-item commentary + reorder editor |
| `src/lib/storage/avatars.ts` | Avatar upload helpers |
| `src/lib/storage/exploreCovers.ts` | Cover image upload helpers |
| `src/lib/storage/imageUtils.ts` | Shared EXIF-strip + canvas-resize (extracted from existing) |
| `supabase/migrations/20260516000000_phase_v51_cms_tables.sql` | Authoritative DDL for all new tables + RLS policies |

---

## Anti-Patterns

### Anti-Pattern 1: `revalidatePath('/explore')` for nested cached modules

**What people do:** Call `revalidatePath('/explore')` in a CMS Server Action after publishing a list.
**Why it's wrong:** Nested `'use cache'` Server Components (HeroFeature, CuratedListsRail) are not invalidated by path revalidation. The cache persists until TTL expiry — up to 7 days for the Hero.
**Do this instead:** `revalidateTag('explore:hero')` and `revalidateTag('explore:lists')` explicitly in every mutation that affects those modules.

### Anti-Pattern 2: Route-level owner gate without Server Action assertion

**What people do:** Check `user.id !== OWNER_USER_ID` in `AdminLayout` and assume that is sufficient.
**Why it's wrong:** Server Actions are directly-callable HTTP endpoints. Any authenticated user who knows the action's URL can POST to it, bypassing the layout.
**Do this instead:** `assertOwner()` as the literal first statement in every CMS Server Action.

### Anti-Pattern 3: Signed URLs for public avatar retrieval

**What people do:** Reuse `createSignedUrl` from the existing catalog-source-photos pattern for avatar retrieval.
**Why it's wrong:** Signed URLs expire (60s default in the enricher pattern). Avatar URLs appear in navigation headers — an expiring URL breaks the header on every page.
**Do this instead:** `getPublicUrl()` from the `avatars` public bucket. No expiry parameter in the returned URL.

### Anti-Pattern 4: Copying catalog `USING (true)` RLS to CMS tables

**What people do:** Apply `USING (true)` public-read RLS to `curated_lists` the way `watches_catalog` uses it.
**Why it's wrong:** `watches_catalog` is intentionally public with no draft state. `curated_lists` has a draft/published lifecycle — `USING (true)` exposes every draft the admin is writing.
**Do this instead:** `USING (status = 'published')` for public reads; a separate `OR author_id = auth.uid()` predicate for admin self-reads.

### Anti-Pattern 5: LLM enrichment writes to factual spec columns

**What people do:** Extend the enrichment LLM call to produce `case_size_mm`, `movement_type`, `dial_color` alongside taste attributes.
**Why it's wrong:** LLM hallucination on factual specs corrupts search filter results silently. A user filtering for 38-40mm watches gets wrong results without any visible error.
**Do this instead:** LLM writes taste columns only (existing scope: formality, sportiness, heritage_score, primary_archetype, era_signal, design_motifs, confidence, extracted_from_photo). Spec column backfill requires manual operator entry or a human-reviewed scrape step.

---

## Integration Points Summary

| New Feature | Integrates With | How |
|---|---|---|
| Curated Lists Rail | `watches_catalog` | FK + JOIN for watch card data on list detail pages |
| Curated Lists Rail | `explore-covers` bucket | `getPublicUrl` for cover images |
| Hero | `curated_lists` | quality-gate SELECT + `cms_settings` pin read |
| Hero | `explore:hero` cache tag | `revalidateTag` in publish, unpublish, setPinnedHero, clearPinnedHero |
| Browse Indices | `watches_catalog`, `brands`, `watch_families` | GROUP BY aggregation; same public-read RLS |
| Collector Archetypes | `/search` route | Deep-link with archetype filter in query string (no new DB queries) |
| Where Collections Go | `watches_catalog` | FK via `collection_path_nodes.catalog_id` |
| Admin CMS | `users` + Supabase Auth | `OWNER_USER_ID` assertion in every Server Action |
| Avatar Upload | `avatars` public bucket | `getPublicUrl` (no signed URLs); `profiles.avatar_url` updated |
| Catalog Enrichment | `scripts/backfill-taste.ts` | Extend existing script; first-write-wins idempotency preserved |

---

## Sources

- `src/db/schema.ts` — existing table definitions, FK shapes, enum patterns, ON DELETE behaviors (HIGH confidence — read directly)
- `src/app/explore/page.tsx` — existing /explore Server Component shell, nested rail pattern (HIGH confidence — read directly)
- `src/data/discovery.ts` — DAL two-layer privacy pattern, `cacheTag`/`cacheLife` usage, `::int` cast convention (HIGH confidence — read directly)
- `src/lib/auth.ts` — `getCurrentUser()`, `UnauthorizedError`, `getCurrentUserFull()` patterns (HIGH confidence — read directly)
- `scripts/backfill-taste.ts` — sequential enrichment pattern, idempotency, missing rate-limit handling (HIGH confidence — referenced in PITFALLS.md + STACK.md)
- `.planning/PROJECT.md` — current architecture state post-v5.0, key decisions log, current milestone scope (HIGH confidence — read directly)
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` — module specs, implementation order, open questions, success conditions (HIGH confidence — read directly)
- `.planning/research/STACK.md` (sibling) — technology decisions: `@base-ui/react/drawer`, `react-markdown`, image storage strategy, enrichment approach (HIGH confidence — reconciled; all guidance consistent)
- `.planning/research/PITFALLS.md` (sibling) — CP-01/02/05/06, MP-01/06/07 referenced throughout; all guidance consistent (HIGH confidence — reconciled)
- CLAUDE.md memory: `project_drizzle_supabase_db_mismatch.md` — prod push via `supabase db push --linked` only (HIGH confidence)
- CLAUDE.md memory: `project_supabase_secdef_grants.md` — REVOKE pattern for any SECDEF functions added (HIGH confidence)

---
*Architecture research for: v5.1 Explore Page Redesign (Horlo)*
*Researched: 2026-05-16*

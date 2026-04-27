---
dimension: architecture
generated: 2026-04-26
milestone: v4.0 Discovery & Polish
---
# Architecture Research — v4.0 Discovery & Polish

**Domain:** Integration of v4.0 features (canonical `watches_catalog`, `/explore`, `/search` Watches+Collections tabs, `/evaluate`, Settings expansion, custom SMTP, profile nav prominence) into the existing Next.js 16 + Supabase + Drizzle + Cache Components architecture.
**Researched:** 2026-04-26
**Confidence:** HIGH on integration points (codebase read directly), HIGH on Cache Components ergonomics (Phase 13/15 patterns proven), MEDIUM on `owners_count` denormalization (live triggers vs `pg_cron` is a tradeoff that needs phase-time validation), MEDIUM on `/evaluate` anonymous-viewer posture (requires UX call).

> The existing system architecture (Server Components by default, server-only DAL with `'server-only'` import, Server Actions for all mutations, `proxy.ts` edge auth via `PUBLIC_PATHS`, Cache Components with inline theme script + Suspense layout, `'use cache'` + `cacheTag` + `cacheLife` for cached server components, `updateTag()` self-reads vs `revalidateTag('max')` cross-user fan-out, two-layer privacy via RLS + DAL WHERE, Drizzle 0.45.2 + raw SQL for partial indexes / GIN / CHECK, fire-and-forget activity + notification logging) is documented in `src/`, `.planning/PROJECT.md`, and prior phase RESEARCH/CONTEXT artifacts. **Not re-researched here.** This document covers ONLY how each v4.0 feature plugs into that frame.

---

## System Overview — v4.0 Additions Layered Onto v3.0

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER (new v4.0 client islands)                                       │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐  │
│  │ EvaluateClient   │ │ SettingsTabs     │ │ EmailChangeForm          │  │
│  │ (paste URL → POST│ │ (base-ui Tabs    │ │ PasswordChangeForm       │  │
│  │  /api/extract →  │ │  vertical, hash  │ │ (Supabase updateUser     │  │
│  │  render verdict) │ │  state)          │ │  via SA, re-auth dialog) │  │
│  └──────────────────┘ └──────────────────┘ └──────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  SERVER (new v4.0 surfaces)                                              │
│  ┌────────────────────┐ ┌──────────────────┐ ┌────────────────────────┐  │
│  │ /evaluate page.tsx │ │ /explore page.tsx│ │ /settings/page.tsx     │  │
│  │ (Server Component, │ │ (Server Component│ │ (Server Component,     │  │
│  │  loads collection +│ │  composes        │ │  one route, hash-driven│  │
│  │  prefs as props →  │ │  PopularCollect.,│ │  vertical tabs;        │  │
│  │  EvaluateClient)   │ │  Trending watches│ │  sections receive props│  │
│  │                    │ │  via DALs)       │ │  from page-level loader)│  │
│  └────────────────────┘ └──────────────────┘ └────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ New Server Actions                                                 │  │
│  │ updateAccountEmail()   updateAccountPassword()  reauthenticate()   │  │
│  │ updatePreferences() (extends existing for collectionGoal/overlap)  │  │
│  │ toggleNoteVisibility()  toggleIsChronometer()                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ DAL changes                                                        │  │
│  │ src/data/catalog.ts        NEW   getOrCreateCatalogEntry, lookup,  │  │
│  │                                  searchCatalogWatches              │  │
│  │ src/data/explore.ts        NEW   getPopularCollectors,             │  │
│  │                                  getTrendingWatches                │  │
│  │ src/data/search.ts         EXTEND searchCollections (cross-user)   │  │
│  │ src/data/watches.ts        EXTEND createWatch wires catalog_id     │  │
│  │ src/lib/extractors/index.ts EXTEND upsertCatalogFromExtraction     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  SUPABASE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Postgres NEW table:    watches_catalog (UUID PK, natural key UNIQUE,│ │
│  │                        owners_count + wishlist_count denormalized)  │ │
│  │ Postgres MODIFIED:     watches.catalog_id NULLABLE FK ON DELETE NULL│ │
│  │ Postgres EXT:          pg_trgm GIN on watches_catalog.brand/model;  │ │
│  │                        pg_cron job daily refresh of owners_count    │ │
│  │ Auth config:           Custom SMTP (Resend) via Dashboard;          │ │
│  │                        confirm-email ON; secure password change ON; │ │
│  │                        secure email change ON                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Canonical `watches_catalog` Table

### Decision Summary

| Question | Answer | Why |
|---|---|---|
| Catalog as separate table or columns on `watches`? | Separate `watches_catalog` table with surrogate UUID PK | Per-user `watches` and shared catalog rows have different lifecycles; this is the standard product-catalog normalization (STACK §Canonical Watch Catalog) |
| `watches.catalog_id` cardinality | NULLABLE FK with `ON DELETE SET NULL` | Existing rows must survive a missing match; admin merges/deletes must not orphan user data |
| Natural key for dedup | `(brand, model, reference)` UNIQUE NULLS NOT DISTINCT (PG 15+) | Allows null reference rows to dedup against each other; Supabase is PG 15 |
| Indexes beyond pg_trgm | `(brand, model, reference)` UNIQUE; pg_trgm GIN on brand and model; partial index on `(owners_count DESC)` for /explore | Mirrors profile-search pattern (Phase 16) — proven |
| RLS posture | Public-read, write-restricted-to-server-actions-only | Catalog is shared, no privacy data; writes are funneled through Server Actions running with service-role Drizzle client; departure from two-layer privacy is documented |
| Backfill strategy | Single-pass `INSERT … ON CONFLICT DO NOTHING` then `UPDATE watches SET catalog_id=…`, idempotent on re-run | Total dataset ~hundreds of rows — single transaction, no locks |

### Where It Plugs In

#### 1.1 Similarity engine — `src/lib/similarity.ts` is **NOT modified in v4.0**

Per STACK §Ripple Effects, the similarity engine continues reading from per-user `watches` rows. Catalog identity is not yet wired into `analyzeSimilarity()`. This decision is intentional and tight:

- **Why not migrate now:** v4.0 adds catalog as silent infrastructure. Similarity already works at MVP scale; rewiring it adds risk surface (semantic-label regression) for zero user-visible payoff in this milestone.
- **What this means at code level:** `analyzeSimilarity(targetWatch, collection, preferences)` continues to receive plain `Watch[]` from `getWatchesByUser(userId)`. The existing `src/components/insights/SimilarityBadge.tsx` and `WatchDetail.tsx` integration continue working untouched.
- **User-overrides resolution (user typed "ROLEX" but catalog has "Rolex"):** No conflict — the `Watch` domain object the similarity engine sees comes from the per-user row. The catalog row's brand string is only displayed in `/search` Watches and `/explore` Trending. They are different code paths.
- **v5.0+ migration path:** When similarity moves to canonical identity, replace `arrayOverlap` and `caseSizeSimilarity` inputs with catalog-fielded values via `JOIN watches_catalog ON watches.catalog_id`. This is a breaking-shape change to internal helpers, not the public `analyzeSimilarity` signature.

**Touchpoint files (NO changes in v4.0):**
- `src/lib/similarity.ts` — untouched
- `src/components/insights/SimilarityBadge.tsx` — untouched
- `src/components/watch/WatchDetail.tsx` — untouched

#### 1.2 `addWatch` Server Action — wires catalog_id on insert

**File:** `src/app/actions/watches.ts` — extend the existing `addWatch` Server Action.

```typescript
// Pseudocode — final shape decided in plan
export async function addWatch(data: unknown): Promise<ActionResult<Watch>> {
  // ... existing zod parse + auth + createWatch ...

  // NEW v4.0: catalog matching after createWatch returns
  // Note: createWatch is extended to accept optional catalogId, OR a separate
  // wireCatalog(watchId) call follows. Plan-time decision; both work.
  try {
    const catalogId = await catalogDAL.getOrCreateCatalogEntry({
      brand: parsed.data.brand,
      model: parsed.data.model,
      reference: parsed.data.reference ?? null,
      // Spec sheet enrichment from user's row (only if non-null):
      caseSizeMm: parsed.data.caseSizeMm ?? null,
      movement: parsed.data.movement,
      // ... etc — never overwrite non-null catalog fields without admin curation
      source: 'user_promoted',
    })
    if (catalogId) {
      await watchDAL.linkWatchToCatalog(watch.id, catalogId)
    }
  } catch (err) {
    console.error('[addWatch] catalog wiring failed (non-fatal):', err)
  }

  // ... existing activity + notification + revalidate ...
}
```

**Failure semantics:** Catalog wiring is fire-and-forget. If the catalog upsert fails, the user's `watches` row is committed with `catalog_id = NULL`. A future re-attempt (manual repair or per-user batch) can fill it in. This mirrors the established `logActivity` / `logNotification` resilience pattern.

#### 1.3 URL extraction — `src/lib/extractors/index.ts` populates catalog with higher trust

**File:** `src/lib/extractors/index.ts` — extend `fetchAndExtract()` (existing) to upsert into `watches_catalog` with `source: 'url_extracted'`.

The extracted spec sheet has higher provenance than user-promoted rows because the LLM stage reads structured data. `getOrCreateCatalogEntry` should accept an optional `enrichOnConflict: boolean` flag — when set, on conflict it fills in missing (NULL) catalog fields rather than no-op. Never overwrite non-null fields without admin curation.

#### 1.4 RLS Migration

```sql
-- supabase/migrations/{date}_phase_v4_watches_catalog.sql

CREATE TABLE watches_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  reference text,
  movement text,
  case_size_mm real,
  lug_to_lug_mm real,
  water_resistance_m integer,
  crystal_type text,
  production_year_start integer,
  production_year_end integer,
  is_chronometer boolean,
  style_tags text[] NOT NULL DEFAULT '{}',
  design_traits text[] NOT NULL DEFAULT '{}',
  role_tags text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'user_promoted'
    CHECK (source IN ('user_promoted','url_extracted','admin_curated')),
  owners_count integer NOT NULL DEFAULT 0,
  wishlist_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Natural key dedup with NULLS NOT DISTINCT (PG 15+; Supabase is 15+)
CREATE UNIQUE INDEX watches_catalog_natural_key_idx
  ON watches_catalog (brand, model, reference) NULLS NOT DISTINCT;

-- pg_trgm GIN — mirrors phase 11/16 profile pattern
CREATE INDEX watches_catalog_brand_trgm_idx
  ON watches_catalog USING gin (brand gin_trgm_ops);
CREATE INDEX watches_catalog_model_trgm_idx
  ON watches_catalog USING gin (model gin_trgm_ops);

-- /explore Trending sort
CREATE INDEX watches_catalog_owners_count_desc_idx
  ON watches_catalog (owners_count DESC NULLS LAST);

-- RLS — public read, server-action write only
ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watches_catalog_select_all"
  ON watches_catalog FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated → those operations fail
-- under anon-key. Server Actions use service-role client which bypasses RLS.

-- Add catalog_id to watches (nullable, ON DELETE SET NULL — survives catalog merges)
ALTER TABLE watches
  ADD COLUMN catalog_id uuid REFERENCES watches_catalog(id) ON DELETE SET NULL;

CREATE INDEX watches_catalog_id_idx ON watches (catalog_id);
```

**RLS posture justification (must be added to PROJECT.md Key Decisions when v4.0 ships):** The catalog is public-by-design (no privacy data — every collector sees the same Rolex spec sheet) and writes are funneled through Server Actions running on the service-role Drizzle client. Direct anon/authenticated INSERT/UPDATE/DELETE is intentionally blocked, so the absence of WHERE-clause defense in the DAL doesn't introduce a leak. This is a *deliberate* departure from the project's two-layer privacy pattern — and the asymmetry is the point.

#### 1.5 Drizzle schema additions

**File:** `src/db/schema.ts` — additions only.

```typescript
export const watchesCatalog = pgTable(
  'watches_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    reference: text('reference'),
    movement: text('movement', {
      enum: ['automatic','manual','quartz','spring-drive','other'],
    }),
    caseSizeMm: real('case_size_mm'),
    lugToLugMm: real('lug_to_lug_mm'),
    waterResistanceM: integer('water_resistance_m'),
    crystalType: text('crystal_type', {
      enum: ['sapphire','mineral','acrylic','hesalite','hardlex'],
    }),
    productionYearStart: integer('production_year_start'),
    productionYearEnd: integer('production_year_end'),
    isChronometer: boolean('is_chronometer'),
    styleTags: text('style_tags').array().notNull().default(sql`'{}'::text[]`),
    designTraits: text('design_traits').array().notNull().default(sql`'{}'::text[]`),
    roleTags: text('role_tags').array().notNull().default(sql`'{}'::text[]`),
    source: text('source', { enum: ['user_promoted','url_extracted','admin_curated'] })
      .notNull().default('user_promoted'),
    ownersCount: integer('owners_count').notNull().default(0),
    wishlistCount: integer('wishlist_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  // Natural-key UNIQUE w/ NULLS NOT DISTINCT, pg_trgm GIN, owners_count DESC
  // index are all in the raw SQL migration — Drizzle 0.45.2 cannot express
  // UNIQUE NULLS NOT DISTINCT or gin_trgm_ops in pg-core (same constraint as
  // phase 11 notifications partial UNIQUE).
)

// Modification to existing `watches`:
// catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
```

#### 1.6 Backfill script — `scripts/backfill-watches-catalog.ts` (new file)

```typescript
// scripts/backfill-watches-catalog.ts — runs ONCE after migration deploys
// Idempotent on re-run: ON CONFLICT DO NOTHING + UPDATE with same value is no-op
import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import { sql } from 'drizzle-orm'

async function main() {
  const BATCH_SIZE = 100
  let offset = 0
  while (true) {
    const rows = await db.select()
      .from(watches)
      .where(sql`catalog_id IS NULL`)
      .limit(BATCH_SIZE).offset(offset)
    if (rows.length === 0) break

    for (const row of rows) {
      // INSERT or get existing
      await db.execute(sql`
        WITH ins AS (
          INSERT INTO watches_catalog (brand, model, reference, movement,
            case_size_mm, lug_to_lug_mm, water_resistance_m, crystal_type,
            style_tags, design_traits, role_tags, is_chronometer, source)
          VALUES (${row.brand}, ${row.model}, ${row.reference}, ${row.movement},
            ${row.caseSizeMm}, ${row.lugToLugMm}, ${row.waterResistanceM},
            ${row.crystalType}, ${row.styleTags}, ${row.designTraits},
            ${row.roleTags}, ${row.isChronometer}, 'user_promoted')
          ON CONFLICT (brand, model, reference) DO NOTHING
          RETURNING id
        ),
        existing AS (
          SELECT id FROM watches_catalog
          WHERE brand = ${row.brand} AND model = ${row.model}
            AND reference IS NOT DISTINCT FROM ${row.reference}
        )
        UPDATE watches SET catalog_id = COALESCE(
          (SELECT id FROM ins),
          (SELECT id FROM existing)
        ) WHERE id = ${row.id}
      `)
    }
    offset += BATCH_SIZE
  }
}
```

**Failure mode:** If the script crashes mid-run (network drop, timeout), re-running it skips already-linked rows (`WHERE catalog_id IS NULL` filter) and `INSERT … ON CONFLICT DO NOTHING` short-circuits dedup attempts. **Idempotent.**

**Operational runbook (add to `docs/deploy-db-setup.md`):**
1. Run migration via `supabase db push --linked` (column `catalog_id` is now nullable on `watches`)
2. Run `npx tsx scripts/backfill-watches-catalog.ts` against production (uses `DATABASE_URL` from `.env.local`)
3. Verify: `SELECT count(*) FROM watches WHERE catalog_id IS NULL` → 0
4. **Do NOT** add `NOT NULL` to `watches.catalog_id` in v4.0 — defer to v5.0 (preserves UX state where user hasn't matched catalog yet)

---

## Feature 2: `owners_count` Denormalization

### Tradeoff: Live Triggers vs Daily `pg_cron` Batch

| Dimension | Live `AFTER INSERT/UPDATE/DELETE` Trigger | Daily `pg_cron` Batch |
|---|---|---|
| Freshness | Sub-second | ≤24h stale |
| Write amplification | Every `watches` mutation locks the catalog row's `owners_count` (small but real) | None on hot path; one bulk UPDATE per day |
| /explore acceptable staleness | Required by feature semantics? **No** — "trending" is inherently a slow-moving metric | ✓ Acceptable |
| Hot-loop risk | A user adding 50 watches in a sitting fires 50 catalog updates, each a row lock | None |
| Local dev parity | Triggers work in any Postgres | `pg_cron` is NOT in vanilla Supabase Docker image — see local-dev section |

**Recommendation: Daily `pg_cron` batch.** STACK research §/explore Page already calls this out. Reasoning:

- /explore "Trending Watches" is a slow-moving feature. A 24h-stale count is invisible to users.
- Live triggers introduce write amplification that we'd then have to debug at scale (every watch addition locks the catalog row for the duration of the trigger).
- We already accept SWR semantics (`revalidateTag('max')`) for cross-user notification fan-out — daily refresh is a stronger but consistent posture.

### `pg_cron` Migration

```sql
-- supabase/migrations/{date}_phase_v4_owners_count_cron.sql

-- Enable pg_cron in the cron schema (Supabase pre-installs the extension)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The actual recompute function
CREATE OR REPLACE FUNCTION refresh_watches_catalog_counts()
RETURNS void AS $$
BEGIN
  UPDATE watches_catalog wc
  SET
    owners_count = COALESCE(counts.owners, 0),
    wishlist_count = COALESCE(counts.wishlist, 0),
    updated_at = now()
  FROM (
    SELECT
      catalog_id,
      COUNT(*) FILTER (WHERE status IN ('owned','grail')) AS owners,
      COUNT(*) FILTER (WHERE status = 'wishlist') AS wishlist
    FROM watches
    WHERE catalog_id IS NOT NULL
    GROUP BY catalog_id
  ) counts
  WHERE wc.id = counts.catalog_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke PUBLIC EXECUTE per phase 11 SECDEF posture (DEBT-02 audit)
REVOKE EXECUTE ON FUNCTION refresh_watches_catalog_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_watches_catalog_counts() TO service_role;

-- Schedule daily at 04:00 UTC (off-peak for US/EU users)
SELECT cron.schedule('refresh-catalog-counts', '0 4 * * *', $$SELECT refresh_watches_catalog_counts();$$);
```

### Local Dev Workflow (No `pg_cron`)

The vanilla Supabase Docker image (`supabase/postgres`) does NOT ship with `pg_cron` in the local stack. Two options:

**Option A (recommended): Skip cron in local dev; expose a manual refresh script.**
- Local migrations gate the `cron.schedule(...)` line behind an `IF EXISTS` check or a `current_database() != 'postgres'` guard, OR put it in a separate prod-only migration applied via `supabase db push --linked`.
- Add `npm run refresh-counts` script that calls the SQL function directly via psql — devs run on demand.
- Document in `docs/local-dev.md` (a new file or addition to `deploy-db-setup.md`).

**Option B: Run a Node-side scheduler in the dev process.** Add a `dev:cron` script that tails the dev server and calls the refresh function every 60s. Dirtier but matches prod behavior more closely.

**Recommendation: Option A.** The `/explore` Trending count being stale-zero in local dev is acceptable; devs can manually refresh when testing the UI.

### MEMORY.md hit
The user's memory `project_drizzle_supabase_db_mismatch.md` notes "drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`". The `pg_cron` schedule MUST go in a Supabase migration (`supabase/migrations/*.sql`) and be pushed via `supabase db push --linked`, NOT via `drizzle-kit push`. This is consistent with how Phase 11 / 13 raw SQL migrations were handled.

### MEMORY.md hit (SECDEF grants)
The user's memory `project_supabase_secdef_grants.md` notes "REVOKE FROM PUBLIC alone does not block anon; Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions." → Above migration includes the explicit `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated` followed by `GRANT EXECUTE … TO service_role`. Mirrors Phase 11 SECDEF revoke pattern.

---

## Feature 3: `/search` Watches Tab DAL

### File: `src/data/catalog.ts` (new)

Mirrors `searchProfiles` from `src/data/search.ts` — same shape, no privacy gate (catalog is public).

```typescript
// src/data/catalog.ts
import 'server-only'
import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import { and, eq, ilike, inArray, or, sql, count } from 'drizzle-orm'

const TRIM_MIN_LEN = 2
const CANDIDATE_CAP = 50
const DEFAULT_LIMIT = 20

export interface CatalogSearchResult {
  catalogId: string
  brand: string
  model: string
  reference: string | null
  ownersCount: number
  wishlistCount: number
  // Viewer-state badges (anti-N+1 batch resolved at end)
  viewerOwns: boolean
  viewerWishlists: boolean
}

export async function searchCatalogWatches({
  q,
  viewerId,
  limit = DEFAULT_LIMIT,
}: { q: string; viewerId: string; limit?: number }): Promise<CatalogSearchResult[]> {
  const trimmed = q.trim()
  if (trimmed.length < TRIM_MIN_LEN) return []

  const pattern = `%${trimmed}%`

  // 1. Candidate pool — pg_trgm GIN-backed ILIKE on brand/model
  const candidates = await db
    .select({
      catalogId: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      ownersCount: watchesCatalog.ownersCount,
      wishlistCount: watchesCatalog.wishlistCount,
    })
    .from(watchesCatalog)
    .where(or(
      ilike(watchesCatalog.brand, pattern),
      ilike(watchesCatalog.model, pattern),
    ))
    .orderBy(sql`${watchesCatalog.ownersCount} DESC`)
    .limit(CANDIDATE_CAP)

  if (candidates.length === 0) return []

  // 2. Anti-N+1 — batched viewer-state lookup (mirrors Phase 16 isFollowing pattern)
  const topIds = candidates.slice(0, limit).map((c) => c.catalogId)

  const viewerLinks = await db
    .select({ catalogId: watches.catalogId, status: watches.status })
    .from(watches)
    .where(and(
      eq(watches.userId, viewerId),
      inArray(watches.catalogId, topIds),
    ))

  const ownsSet = new Set(viewerLinks.filter((r) => r.status === 'owned' || r.status === 'grail').map((r) => r.catalogId))
  const wishSet = new Set(viewerLinks.filter((r) => r.status === 'wishlist').map((r) => r.catalogId))

  return candidates.slice(0, limit).map((c) => ({
    ...c,
    viewerOwns: ownsSet.has(c.catalogId),
    viewerWishlists: wishSet.has(c.catalogId),
  }))
}
```

### Notes

- **No two-layer privacy.** Catalog is public; the `viewerOwns` / `viewerWishlists` badges are viewer-scoped but the rows themselves leak no privacy data. (Per-collector ownership of a specific watch is not exposed in this query — only "you own/wishlist this" against the *viewer's own* collection.)
- **Anti-N+1 pattern (Phase 16 C-4):** Single `inArray` lookup on `watches.catalog_id` for the viewer's own rows resolves both "owns" and "wishlists" badges in one query. Same structural pattern as `isFollowing` batch in `searchProfiles`.
- **"X collectors own this" badge:** Already denormalized as `owners_count` on `watches_catalog`. Zero additional queries.
- **Server Action wrapping:** `src/app/actions/search.ts` adds a `searchCatalogWatchesAction` mirror of `searchPeopleAction` — Zod `.strict().max(200)` schema, auth gate, `revalidatePath` not needed (read-only).

### Wiring Into Existing `SearchPageClient`

The 4-tab `SearchPageClient` already has the Watches tab as `<ComingSoonCard variant="full">`. Replace with:

```typescript
// src/components/search/WatchSearchRow.tsx (new)
// src/components/search/SearchPageClient.tsx — replace the watches TabsContent
//   with a <WatchResultsBlock> mirror of <PeopleResultsBlock>

// useSearchState already gates fetch on tab; just extend with a `watchesResults`
// branch that calls searchCatalogWatchesAction when tab === 'watches' or 'all'
```

The hook `useSearchState` in `src/components/search/useSearchState.ts` should grow a tab-aware fetch dispatcher. **Pitfall:** if both `people` and `watches` results fetch independently on the All tab, watch the request count — likely fine at 250ms debounce + 2-char minimum but worth a phase-time eyeball.

---

## Feature 4: `/search` Collections Tab DAL

### The Privacy Hard Part

Searching across `watches.brand`/`model`/`role` *for users other than the viewer* requires:

1. **Candidate user pool** = users with `profile_public=true` AND (`collection_public=true` for owned/sold/grail OR `wishlist_public=true` for wishlist) — already gated by `getWatchByIdForViewer` pattern in `src/data/watches.ts` (proven).
2. **Self-exclusion** — viewer's own collection is excluded (mirrors Phase 16 D-Pitfall 10 / `searchProfiles` viewer self-exclusion `${profiles.id} != ${viewerId}`).
3. **RLS-layer one** — `watches` table RLS already gates owner-only at anon-key (DEBT-02 audit, phase 11). DAL service-role client bypasses RLS, so DAL WHERE is load-bearing.
4. **Query shape:** "Show collections (grouped by user) that contain a watch matching the query."

### File: `src/data/search.ts` extension

```typescript
// src/data/search.ts — new function

export interface CollectionSearchResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchingWatches: Array<{
    watchId: string
    brand: string
    model: string
    imageUrl: string | null
    status: 'owned' | 'wishlist' | 'sold' | 'grail'
  }>
  matchCount: number
}

export async function searchCollections({
  q,
  viewerId,
  limit = 20,
}: { q: string; viewerId: string; limit?: number }): Promise<CollectionSearchResult[]> {
  const trimmed = q.trim()
  if (trimmed.length < 2) return []
  const pattern = `%${trimmed}%`

  // Two-layer privacy: RLS (anon-key path) + this WHERE (service-role path).
  // Per-tab gate by status — wishlist uses wishlist_public, owned/sold/grail
  // use collection_public. Mirrors `getWatchByIdForViewer` exactly.
  const rows = await db
    .select({
      userId: watches.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      watchId: watches.id,
      brand: watches.brand,
      model: watches.model,
      imageUrl: watches.imageUrl,
      status: watches.status,
    })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, watches.userId))
    .where(and(
      sql`${watches.userId} != ${viewerId}`, // self-exclusion (Phase 16 Pitfall 10)
      eq(profileSettings.profilePublic, true),
      // Per-tab privacy gate — replicates getWatchByIdForViewer
      sql`(
        (${watches.status} = 'wishlist' AND ${profileSettings.wishlistPublic} = true)
        OR (${watches.status} IN ('owned','sold','grail') AND ${profileSettings.collectionPublic} = true)
      )`,
      // Match query against any of brand/model/role tags
      or(
        ilike(watches.brand, pattern),
        ilike(watches.model, pattern),
        sql`EXISTS (SELECT 1 FROM unnest(${watches.roleTags}) AS r WHERE r ILIKE ${pattern})`,
      ),
    ))
    .limit(200) // pre-grouping cap

  // Group in JS by userId — postgres GROUP BY with array_agg works but adds
  // shape complexity; JS grouping at 200 rows is trivial.
  const grouped = new Map<string, CollectionSearchResult>()
  for (const r of rows) {
    let entry = grouped.get(r.userId)
    if (!entry) {
      entry = {
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        matchingWatches: [],
        matchCount: 0,
      }
      grouped.set(r.userId, entry)
    }
    if (entry.matchingWatches.length < 3) {
      entry.matchingWatches.push({
        watchId: r.watchId,
        brand: r.brand,
        model: r.model,
        imageUrl: r.imageUrl ?? null,
        status: r.status,
      })
    }
    entry.matchCount++
  }
  // Sort by matchCount DESC
  return Array.from(grouped.values())
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, limit)
}
```

### JOIN Topology

```
watches (RLS gates owner-only at anon; DAL WHERE gates at service-role)
  ↓ INNER JOIN profiles ON profiles.id = watches.user_id
  ↓ INNER JOIN profile_settings ON profile_settings.user_id = watches.user_id
  ↓ WHERE
       watches.user_id != viewerId          (self-exclusion)
       AND profile_settings.profile_public = true
       AND (
         (watches.status = 'wishlist' AND wishlist_public = true)
         OR (watches.status IN ('owned','sold','grail') AND collection_public = true)
       )
       AND ILIKE on brand|model|roleTags
  ↓ LIMIT 200 in SQL → GROUP in JS → top 20
```

**Two-layer correctness check:**
- Layer 1 (RLS): `watches` RLS blocks non-owner reads under anon-key. DAL uses service-role, so this layer doesn't fire — but it's still load-bearing if a future DAL function forgets the WHERE clause.
- Layer 2 (DAL WHERE): The above explicit WHERE gates per-tab privacy. If RLS is somehow bypassed, this still catches private profiles.

### Anti-N+1

The query is a single SELECT with two INNER JOINs. The viewer-self-exclusion + privacy + match are all in one WHERE. JS grouping at 200 rows is O(n) — no concern.

### Wiring

Same as Watches tab — replace the `<ComingSoonCard variant="full">` in the Collections TabsContent with a results block calling `searchCollectionsAction`.

---

## Feature 5: `/evaluate` Route Data Flow

### Decision: Server Component shell + Client Component form

```
src/app/evaluate/page.tsx           — Server Component
  - getCurrentUser() (auth gate via proxy.ts; THIS PAGE MUST BE AUTHED — see below)
  - Promise.all([getWatchesByUser(userId), getPreferencesByUser(userId)])
  - <EvaluateClient collection={...} preferences={...} />

src/app/evaluate/EvaluateClient.tsx — Client Component
  - Controlled URL input + Submit button
  - On submit: fetch('/api/extract-watch', { method: 'POST', body: { url } })
  - On success: analyzeSimilarity(extractedWatch, collection, preferences) [client-side, pure]
  - Render <SimilarityVerdictCard ... /> inline
  - "Add to my collection" button → calls existing `addWatch` Server Action

src/components/insights/SimilarityVerdictCard.tsx — NEW shared component
  - Extracted from src/components/insights/SimilarityBadge.tsx
  - Both /watch/[id] (existing call site, owner view) and /evaluate (new call site)
    render this component
```

### Why Auth-Required, Not Anonymous

- **The verdict is meaningless without a collection.** An anonymous user sees `analyzeSimilarity(targetWatch, [], DEFAULT_PREFS)` which always returns `'core-fit'` ("First watch — perfect fit!"). That's deceptive UX, not informative.
- **Auth gate already enforced.** `proxy.ts` redirects unauth users to `/login?next=/evaluate` automatically — no PUBLIC_PATHS change needed.
- **Anonymous "demo" mode is a v5.0+ growth feature.** Out of scope for v4.0.

If we later want a public "demo evaluator" surface (e.g. for marketing), it would be a separate route `/evaluate/demo` with a hardcoded sample collection — not a refactor of `/evaluate`.

### Cache Components Compatibility

`/evaluate` page is a Server Component but reads viewer-scoped data (`getCurrentUser`, `getWatchesByUser`, `getPreferencesByUser`). It is **viewer-dynamic and MUST NOT be cached.**

Per the Cache Components rules established in Phase 10/13/14:
- No `'use cache'` directive on the page.
- Wraps the body in a `<Suspense>` boundary (the layout.tsx already has one for `<main>`).
- The page itself is form-driven (URL paste → POST → render). Form-driven pages are inherently dynamic and survive Cache Components without modification.
- The Client Component (`EvaluateClient`) handles all interactivity; no server-side state.

### Data Flow

```
User navigates to /evaluate
  → proxy.ts checks auth (redirect if anon)
  → page.tsx (Server Component):
       const user = await getCurrentUser()
       const [collection, preferences] = await Promise.all([...])
       render <EvaluateClient collection preferences />
  → EvaluateClient (Client Component) hydrates:
       <Input> for URL
       <Button> Submit
  → User pastes URL, clicks Submit:
       fetch('/api/extract-watch', { method: 'POST', body: JSON.stringify({ url }) })
       → existing POST /api/extract-watch route handler
         (auth-gated, SSRF-hardened, LLM-fallback) returns ExtractedWatchData
  → Client receives extractedWatch, runs analyzeSimilarity(extractedWatch, collection, preferences)
       (similarity.ts is pure / browser-safe — no server roundtrip)
  → render <SimilarityVerdictCard result={...} />
       + "Add to my collection" CTA
  → If user clicks "Add":
       form action → addWatch(extractedWatch) Server Action
       → revalidatePath, navigate to /watch/[newId]
```

### Pitfall: Re-rendering thrash on submit

`EvaluateClient` should use `useTransition()` to mark the extract+analyze flow as non-urgent and avoid janking the input field during the 5-15s LLM stage. Pattern matches existing `WatchDetail.tsx` `useTransition` for `markAsWorn`.

### `SimilarityVerdictCard` Extraction

The existing `SimilarityBadge.tsx` already does most of what `/evaluate` needs. Refactor:

1. Rename `SimilarityBadge` → `SimilarityVerdictCard`.
2. Move it to a shared location: `src/components/insights/SimilarityVerdictCard.tsx`.
3. **Crucial change:** Currently `SimilarityBadge` calls `analyzeSimilarity()` *inside* the component. For `/evaluate`, the caller (`EvaluateClient`) computes the result and passes it as a prop. **Refactor signature:**
   - Old: `<SimilarityBadge watch collection preferences />` — calls similarity inside
   - New: `<SimilarityVerdictCard result={SimilarityResult} watch={Watch} />` — pure renderer
4. Update existing call site (`WatchDetail.tsx` line 425) to compute the result first then pass it, OR keep a thin wrapper that does the computation for backward compat.

**Cleanest path:** introduce `SimilarityVerdictCard` as the pure renderer (new component); have `SimilarityBadge` continue to compute-and-render but delegate render to `SimilarityVerdictCard`. Both `WatchDetail` and `/evaluate` import what they need.

---

## Feature 6: Settings Vertical Tabs

### Decision: Single `/settings` route, hash-driven tabs, base-ui `Tabs orientation="vertical"`

| Question | Answer | Why |
|---|---|---|
| Single page vs sub-routes? | **Single page** with hash state (`/settings#account`, etc.) | Page-level loader fetches all section data once; each section is a Server Component child receiving props; mobile fallback is just scrollable sections |
| URL-driven vs client state? | URL hash for tab state (`#account`) | Survives `router.refresh()`, shareable, no extra layout boilerplate |
| Server Action surface | One per section (5 actions: account-email, account-password, preferences, privacy, notifications, appearance). Appearance is client-only theme toggle — no SA. | Section-level granularity matches the user-mental-model; per-field SA proliferation is overkill |
| Mobile fallback | base-ui `Tabs` with `orientation="vertical"` collapses naturally to scrollable list at <md; no separate component | Avoids shadcn Sidebar adoption (overkill for single-page section nav) |

### File Layout

```
src/app/settings/page.tsx                      — Server Component
                                                  (extend existing — already exists)
                                                  loads user, profile, settings, preferences;
                                                  passes to <SettingsTabs>

src/components/settings/SettingsTabs.tsx       — Client Component (NEW)
                                                  base-ui Tabs orientation="vertical",
                                                  hash sync via window.location.hash + useEffect,
                                                  renders 5 TabsContent panels

src/components/settings/AccountSection.tsx     — Client Component (NEW)
                                                  email change + password change forms
src/components/settings/PreferencesSection.tsx — Client Component (NEW)
                                                  collectionGoal + overlapTolerance forms
                                                  (wraps existing PreferencesClient logic)
src/components/settings/PrivacySection.tsx     — Client Component (refactor existing)
                                                  PrivacyToggleRow inputs
src/components/settings/NotificationsSection.tsx — Client Component (NEW; thin)
                                                  notifyOnFollow + notifyOnWatchOverlap toggles
                                                  (PrivacyToggleRow already handles these fields)
src/components/settings/AppearanceSection.tsx  — Client Component (NEW)
                                                  Lifts InlineThemeSegmented out of UserMenu
```

### Touchpoints in Existing Code

| File | Change |
|---|---|
| `src/app/settings/page.tsx` | Replace inline `<SettingsClient>` with `<SettingsTabs>` (preserves structure) |
| `src/components/settings/SettingsClient.tsx` | Delete or repurpose as PrivacySection (it currently mixes Privacy + dead Note Default) |
| `src/components/settings/PrivacyToggleRow.tsx` | Reuse — already field-generic for the 5 boolean fields including notifyOnFollow + notifyOnWatchOverlap |
| `src/app/preferences/page.tsx` | Optional: redirect `/preferences` → `/settings#preferences` so existing UserMenu link continues working, OR keep both with `/settings` as primary |
| `src/components/layout/UserMenu.tsx` | Remove inline theme block (relocate to Settings → Appearance); replace with simple "Appearance" dropdown item linking to `/settings#appearance` |

### Hash Sync Pattern

```typescript
// src/components/settings/SettingsTabs.tsx
'use client'
import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs' // base-ui

const VALID_HASHES = ['account', 'preferences', 'privacy', 'notifications', 'appearance'] as const
type SettingsHash = typeof VALID_HASHES[number]

export function SettingsTabs(props: SettingsTabsProps) {
  const [tab, setTab] = useState<SettingsHash>('account')

  useEffect(() => {
    // Hydrate tab from URL hash on mount
    const initial = window.location.hash.replace('#', '') as SettingsHash
    if (VALID_HASHES.includes(initial)) setTab(initial)

    const onHashChange = () => {
      const next = window.location.hash.replace('#', '') as SettingsHash
      if (VALID_HASHES.includes(next)) setTab(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleTabChange = (next: SettingsHash) => {
    setTab(next)
    window.history.pushState(null, '', `#${next}`) // no router.push — avoids re-running Server Component loader
  }

  return (
    <Tabs value={tab} onValueChange={(v) => handleTabChange(v as SettingsHash)}
      orientation="vertical" className="flex flex-col md:flex-row gap-6">
      <TabsList className="md:flex-col md:w-48 md:items-stretch">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="privacy">Privacy</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
      </TabsList>
      <div className="flex-1">
        <TabsContent value="account"><AccountSection {...props.account} /></TabsContent>
        <TabsContent value="preferences"><PreferencesSection {...props.preferences} /></TabsContent>
        <TabsContent value="privacy"><PrivacySection {...props.privacy} /></TabsContent>
        <TabsContent value="notifications"><NotificationsSection {...props.notifications} /></TabsContent>
        <TabsContent value="appearance"><AppearanceSection /></TabsContent>
      </div>
    </Tabs>
  )
}
```

**Why `window.history.pushState` not `router.push`:** Hash-only navigation should NOT re-run the Server Component loader (no data dependency). `router.push('#hash')` would still re-render the page tree.

### Cache Components Compatibility

Same pattern as everything else in the app — `/settings` is viewer-scoped (reads from `getCurrentUser`, `getProfileById`, `getProfileSettings`, `getPreferencesByUser`). No `'use cache'` directive. Wrapped in the layout's `<Suspense>` boundary by default. Tab state is client-only via hash; no Cache implications.

---

## Feature 7: Email & Password Change Flow

### Email Change UI State Machine

```
Idle → User enters new email → Submit
  ↓ Server Action: updateAccountEmail(newEmail)
  ↓ supabase.auth.updateUser({ email: newEmail })
  ↓
Pending state shown:
  - Banner: "Confirmation email sent to both inboxes. Click the link in your NEW email to complete the change."
  - "Cancel change" button → calls supabase.auth.updateUser({ email: currentEmail }) effectively no-op? OR signOut and signin again?
    NOTE: Supabase auto-cancels if the user clicks the OLD email's link instead.
  ↓
User clicks link in NEW email → /auth/confirm?token_hash=…&type=email_change
  ↓ Existing /auth/confirm route (extend if not yet handling email_change type)
  ↓ supabase.auth.verifyOtp({ type: 'email_change', token_hash })
  ↓ Email is rotated atomically
  ↓ Redirect to /settings?status=email_changed#account
  ↓
Settings page shows toast: "Email updated to {newEmail}"
```

**Rollback handling:** If user clicks the OLD email's confirmation link, Supabase cancels the change automatically. Our UI should poll? No — too much complexity. Instead:
- The pending banner persists across page loads (the user's session still shows the old email until verifyOtp fires).
- A "Resend confirmation" link is offered on the banner.
- Optionally, a "Cancel pending change" button triggers `supabase.auth.updateUser({ email: currentEmail })` (effectively re-issues a change to the *current* email, which auto-cancels the pending one).

**Simpler v4.0 posture:** No rollback button. User who second-guesses the change just clicks the OLD email's link to cancel. UI shows pending banner indefinitely until they verify or 24h Supabase expiry.

### Server Actions

```typescript
// src/app/actions/account.ts (NEW)
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const emailChangeSchema = z.object({
  newEmail: z.string().email().max(254),
}).strict()

export async function updateAccountEmail(data: unknown): Promise<ActionResult<void>> {
  const parsed = emailChangeSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid email' }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail })
  if (error) return { success: false, error: error.message }

  // Confirmation emails sent automatically by Supabase to both addresses
  return { success: true, data: undefined }
}

const passwordChangeSchema = z.object({
  newPassword: z.string().min(8).max(72),
}).strict()

export async function updateAccountPassword(data: unknown): Promise<ActionResult<{ needsReauth: boolean }>> {
  const parsed = passwordChangeSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Password must be 8-72 characters' }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) {
    // Supabase returns specific error code when re-auth needed (>24h session)
    if (error.code === 'reauthentication_needed') {
      return { success: true, data: { needsReauth: true } }
    }
    return { success: false, error: error.message }
  }
  return { success: true, data: { needsReauth: false } }
}

export async function reauthenticate(): Promise<ActionResult<void>> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.reauthenticate()
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function verifyReauthOtp(data: unknown): Promise<ActionResult<void>> {
  // 6-digit code from email; called from re-auth dialog
  // ...
}
```

### Re-auth Dialog Flow

```
User submits new password →
  if needsReauth = true:
    show ReauthDialog (Client Component)
    → call reauthenticate() Server Action (sends 6-digit code to current email)
    → user enters code → call verifyReauthOtp(code)
    → on success, retry updateAccountPassword(newPassword)
    → success toast
```

The re-auth dialog is a thin base-ui `Dialog` with a 6-digit input + "Verify" button. Pattern matches existing dialogs like `WatchPickerDialog`.

### Confirm Route Extension

The existing `/auth/confirm` route handler (already shipped in v1.0 for sign-up confirmation) needs to handle `type=email_change`:

```typescript
// src/app/auth/confirm/route.ts — extend (or src/app/auth/callback/* equivalent)
const VALID_TYPES = ['signup', 'recovery', 'email_change', 'magiclink'] as const

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  if (!tokenHash || !VALID_TYPES.includes(type as never)) {
    return NextResponse.redirect(new URL('/auth/error?reason=missing_token', request.url))
  }
  const supabase = await createServerClient()
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  })
  if (error) {
    return NextResponse.redirect(new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, request.url))
  }
  // Type-specific redirect
  const next = type === 'email_change' ? '/settings?status=email_changed#account'
             : type === 'recovery'     ? '/reset-password'
             : '/'
  return NextResponse.redirect(new URL(next, request.url))
}
```

The existing `src/app/auth/callback/` directory likely contains this — verify in plan phase. The PUBLIC_PATHS predicate already lists `/auth` as a prefix, so `/auth/confirm` is reachable unauthenticated.

---

## Feature 8: Custom SMTP Integration

### Decision: Pure Supabase Dashboard config — ZERO code changes for v4.0

Per STACK research §Resend, the Auth-only path is:

1. Create Resend account, verify domain (DNS records: SPF + DKIM + bounce MX).
2. Click "Connect to Supabase" in Resend dashboard (native partner integration) OR manually paste SMTP creds in Supabase Dashboard → Auth → SMTP Settings.
3. Toggle "Confirm email" ON in Supabase Dashboard → Auth → Providers → Email.
4. (Optional) Restyle the 4 default email templates (sign-up confirmation, recovery, magic link, email change) in Supabase Dashboard → Auth → Email Templates. Keep the `{{ .ConfirmationURL }}` placeholder so the link still points to `{site_url}/auth/confirm?...`.

**No npm install. No code changes. No new server-side route handlers.**

### When code changes ARE needed

- **Branded HTML email templates:** Supabase Dashboard's template editor accepts custom HTML. If we want fancy templates with our typography, this is HTML-paste in the Dashboard, NOT code in the repo.
- **Code-defined templates:** Would require writing `supabase/functions/{name}/index.ts` Edge Functions and switching Supabase's "Email Provider" to "Custom SMTP via webhook" — significant scope creep. **Defer to v5.0+.**
- **Product-side transactional emails** (e.g. weekly digest, watch-overlap notification email): Install `npm install resend@^4`, add `src/lib/email/resend.ts`, create new Server Actions. **Out of scope for v4.0** unless a phase explicitly opts in.

### Rate Limit Posture

Supabase's hidden 2/h rate limit (currently blocking us under personal-MVP posture) is removed automatically the moment custom SMTP is saved. The new default is 30/h, adjustable in Dashboard → Auth → Rate Limits. For v4.0 personal-MVP scale, 30/h is plenty.

### Production Deploy Order

1. DNS records propagate (24h max; usually <1h)
2. Verify domain in Resend dashboard
3. Save SMTP creds in Supabase Dashboard (production project: `wdntzsckjaoqodsyscns`)
4. Smoke-test: trigger a password reset on production, verify email arrives
5. Toggle "Confirm email" ON in Auth → Providers
6. Smoke-test: sign up a new user (test fixture), verify confirmation email arrives, click link, verify confirmation works

**Add to `docs/deploy-db-setup.md`:** the DNS records, Supabase Dashboard checklist, and smoke-test steps.

---

## Feature 9: Profile Nav Prominence

### Mobile (`BottomNav` 5 slots — already squeezed)

Current 5 slots: Home · Explore · Wear (cradle) · Add · Profile.

**Profile is already in BottomNav** — the User icon links to `/u/{username}/collection` (see `src/components/layout/BottomNav.tsx` lines 140-146). **No change needed.**

### Desktop (`DesktopTopNav`)

Current right-side: NavWearButton · Add · NotificationBell · UserMenu (dropdown with initials).

**Recommendation:** Keep UserMenu dropdown for Settings/Sign-out/Theme; ADD a separate avatar slot to the LEFT of the bell that links to `/u/{username}/collection`.

```
[Logo] [Explore] [Search input ............] [Wear] [+] [Bell] [Avatar] [☰ UserMenu]
                                                            ←──── new ────→
```

**Implementation:** Modify `src/components/layout/DesktopTopNav.tsx`:

```typescript
// Insert before {bell}:
{user && username && (
  <Link href={`/u/${username}/collection`} aria-label="My profile" className="...">
    <Avatar className="h-9 w-9">
      {/* Avatar URL from profile, fall back to initials */}
    </Avatar>
  </Link>
)}
```

Requires the avatar URL — fetch in `Header.tsx` (already fetches profile via `getProfileById`) and pass `avatarUrl` as a prop down to `DesktopTopNav`. **Extend `DesktopTopNavProps` with `avatarUrl: string | null`.**

### UserMenu Adjustments

Once `/settings` becomes the home for theme + everything, the UserMenu loses its inline theme block. New menu structure:

```
UserMenu dropdown:
  Signed in as {email}
  ─────────────────
  Settings → /settings
  ─────────────────
  Sign out
```

(Profile link is removed because the avatar is now its own affordance.)

### Mobile DesktopTopNav (SlimTopNav, <768px)

Current: Logo · Search · Bell · Settings.

**No change needed for v4.0** — Profile is already in BottomNav. Adding profile to SlimTopNav would crowd the row and duplicate BottomNav.

---

## Feature 10: Migration Safety — Catalog Backfill

### Expand-Contract Posture

Three deploys, but in v4.0 we only do the first two:

| Deploy | Contents | Reversible? |
|---|---|---|
| **1. Expand** (v4.0) | `CREATE TABLE watches_catalog`, RLS, indexes, `ALTER TABLE watches ADD COLUMN catalog_id NULL` | YES — drop column + table |
| **2. Backfill** (v4.0) | Run `scripts/backfill-watches-catalog.ts` | YES — `UPDATE watches SET catalog_id = NULL` |
| **3. Contract** (v5.0+) | `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` | DESTRUCTIVE — defer |

### Failure Mode If Backfill Fails Partway

The backfill loop is structured to be re-runnable:

```typescript
while (true) {
  const rows = await db.select()
    .from(watches)
    .where(sql`catalog_id IS NULL`)  // ← only fetches not-yet-linked rows
    .limit(BATCH_SIZE).offset(offset)
  if (rows.length === 0) break
  for (const row of rows) {
    // INSERT ... ON CONFLICT DO NOTHING → no-op on duplicate
    // UPDATE watches SET catalog_id = $id → idempotent
  }
}
```

**Idempotency guarantees:**
- `INSERT … ON CONFLICT (brand, model, reference) DO NOTHING` — safe re-run; the existing row is preserved.
- `UPDATE watches SET catalog_id = $id WHERE id = $watch_id` — same value second time = no-op at the row level (Postgres ROW-WAL still produces a write, but logically no change).
- The `WHERE catalog_id IS NULL` filter on the outer SELECT ensures already-linked rows are skipped.

**Crash mid-batch:** Re-running the script picks up where it left off (the loop only sees NULL `catalog_id` rows). **No risk of double-linking or data corruption.**

**Offline-window posture:** v4.0 is single-tenant low-traffic — the backfill takes seconds. No need for a maintenance window or feature flag. Run during off-peak.

### Rollback Procedure

If the backfill discovers a fundamental bug (e.g., a particular brand crashes the dedup):

1. Stop the script (Ctrl-C).
2. `UPDATE watches SET catalog_id = NULL` — wipes all links.
3. `DELETE FROM watches_catalog` — wipes catalog rows.
4. Optionally `ALTER TABLE watches DROP COLUMN catalog_id` and re-create migration.
5. Fix script, re-run.

Because `watches.catalog_id` is `ON DELETE SET NULL`, dropping catalog rows wouldn't cascade-delete user watches. Safe.

### Hot-Path Read Safety

Even before backfill runs, all existing read paths (`getWatchesByUser`, `getWatchByIdForViewer`, `getWearRailForViewer`, etc.) **DO NOT depend on `catalog_id`**. The column is silently NULL on existing rows; the application doesn't break.

Only the NEW code paths (catalog search, /explore trending, `/search` Watches tab) read `catalog_id`. Those paths gracefully handle the catalog being empty (returns no results — falls back to `<ComingSoonCard>`-style empty state).

---

## Build Order

Dependencies flow bottom-up, mirroring the v3.0 phase-by-phase pattern. **Each phase should produce a deployable state** — no half-shipped data shapes.

### Phase A: Catalog Schema Foundation (prerequisite for everything else)

**Files:**
- `supabase/migrations/{date}_phase_v4_watches_catalog.sql` — table, indexes, RLS, FK
- `src/db/schema.ts` — `watchesCatalog` Drizzle definition + `watches.catalogId`
- `scripts/backfill-watches-catalog.ts` — backfill script

**Deliverable:** Catalog table exists, RLS configured, all existing `watches` rows linked, `watches.catalog_id` NULLABLE.

**Tests:** RLS smoke (anon SELECT works, anon INSERT fails); backfill idempotent on re-run; FK ON DELETE SET NULL preserves user rows.

### Phase B: Catalog Wiring on Write Paths

**Files:**
- `src/data/catalog.ts` (NEW) — `getOrCreateCatalogEntry`, `linkWatchToCatalog`, `searchCatalogWatches`
- `src/app/actions/watches.ts` — extend `addWatch` to wire catalog after `createWatch`
- `src/lib/extractors/index.ts` — extend extraction to upsert catalog with `source: 'url_extracted'`

**Deliverable:** New watches automatically wire `catalog_id`; URL-extracted spec sheets enrich catalog rows.

**Tests:** Adding a watch creates or links a catalog row; URL extraction enriches an existing row's NULL fields without overwriting non-NULL ones; failure of catalog wiring does not block `addWatch` (fire-and-forget).

### Phase C: Custom SMTP + Email Confirmation ON

**Files:**
- DNS config (out-of-tree)
- Supabase Dashboard config (out-of-tree)
- `src/app/auth/callback/` (or equivalent) — extend confirm handler to accept `type=email_change`
- `docs/deploy-db-setup.md` — add SMTP runbook

**Deliverable:** Production custom SMTP active; email confirmation enforced on signups.

**Tests:** Sign up a new test user, verify confirmation email arrives, click link, account activates. Trigger password reset, verify email.

**This phase has no dependencies on Phase A/B** — can be done in parallel.

### Phase D: `owners_count` Denormalization (`pg_cron`)

**Files:**
- `supabase/migrations/{date}_phase_v4_owners_count_cron.sql` — `pg_cron` schedule + refresh function
- `docs/local-dev.md` (NEW or addition) — manual refresh instructions for local dev
- `package.json` script `npm run refresh-counts` (optional)

**Deliverable:** Daily 04:00 UTC refresh of `owners_count` and `wishlist_count` on `watches_catalog`.

**Depends on:** Phase A (catalog table exists).

### Phase E: `/explore` Discovery Surface

**Files:**
- `src/data/explore.ts` (NEW) — `getPopularCollectors`, `getTrendingWatches`
- `src/app/explore/page.tsx` — replace stub with real Server Component
- `src/components/explore/PopularCollectorRow.tsx` (NEW)
- `src/components/explore/TrendingWatchRow.tsx` (NEW)

**Deliverable:** `/explore` shows popular collectors + trending watches.

**Depends on:** Phase A (catalog table), Phase D (counts populated).

### Phase F: `/search` Watches + Collections Tabs

**Files:**
- `src/data/search.ts` — extend with `searchCollections`
- `src/data/catalog.ts` — already has `searchCatalogWatches` from Phase B
- `src/app/actions/search.ts` — extend with `searchCatalogWatchesAction`, `searchCollectionsAction`
- `src/components/search/SearchPageClient.tsx` — replace 2 ComingSoonCards with results blocks
- `src/components/search/WatchSearchRow.tsx` (NEW)
- `src/components/search/CollectionSearchRow.tsx` (NEW)
- `src/components/search/useSearchState.ts` — extend tab-aware fetch dispatcher

**Deliverable:** All 4 search tabs functional (All / Watches / People / Collections).

**Depends on:** Phase A (catalog), Phase B (links populated).

### Phase G: `/evaluate` Route + `SimilarityVerdictCard`

**Files:**
- `src/components/insights/SimilarityVerdictCard.tsx` (NEW) — extracted shared renderer
- `src/components/insights/SimilarityBadge.tsx` — refactor to delegate render to VerdictCard
- `src/app/evaluate/page.tsx` (NEW) — Server Component shell
- `src/components/evaluate/EvaluateClient.tsx` (NEW) — Client Component form

**Deliverable:** `/evaluate` route renders, paste URL → extract → analyze → verdict.

**No dependencies on A-F** — uses existing `/api/extract-watch`, existing `analyzeSimilarity`, existing watches DAL.

### Phase H: Settings Vertical Tabs Restructure

**Files:**
- `src/components/settings/SettingsTabs.tsx` (NEW) — Client Component tab orchestrator
- `src/components/settings/AccountSection.tsx` (NEW)
- `src/components/settings/PreferencesSection.tsx` (NEW)
- `src/components/settings/PrivacySection.tsx` (NEW or rename existing SettingsClient)
- `src/components/settings/NotificationsSection.tsx` (NEW)
- `src/components/settings/AppearanceSection.tsx` (NEW)
- `src/app/settings/page.tsx` — extend page-level loader
- `src/app/actions/account.ts` (NEW) — `updateAccountEmail`, `updateAccountPassword`, `reauthenticate`, `verifyReauthOtp`
- `src/components/layout/UserMenu.tsx` — remove inline theme; simplify menu
- `src/app/preferences/page.tsx` — redirect to `/settings#preferences` OR keep both

**Deliverable:** `/settings` is a unified vertical-tab surface; email/password change works; theme moved out of UserMenu.

**Depends on:** Phase C (email change requires custom SMTP working).

### Phase I: Profile Nav Prominence

**Files:**
- `src/components/layout/Header.tsx` — fetch `avatarUrl`, pass to DesktopTopNav
- `src/components/layout/DesktopTopNav.tsx` — add Avatar slot before bell
- `src/components/layout/UserMenu.tsx` — already simplified in Phase H

**Deliverable:** Desktop avatar shortcut to `/u/[username]`.

**No data dependencies** — pure UI rework.

### Phase J: Polish (Empty States, Form Feedback, isChronometer Toggle, notesPublic UI)

**Files (touchpoints listed in PROJECT.md v4.0 features):**
- WatchForm — add `isChronometer` toggle
- WatchDetail — display `isChronometer`
- WatchForm/edit — `notesPublic` per-note control surface
- Empty state CTAs across collection, wishlist, notes, worn tabs
- WYWT post-submit auto-nav to `/wear/[id]`
- Form feedback (toasts, pending states)
- Remove `price_drop` + `trending_collector` notification stub dead code

**No structural dependencies** — pure UI/UX polish.

### Recommended Sequencing

```
A → B → D → E
       ↘    ↘
        F   (Phase F can also use Phase D counts)
                                  ↑
C (parallel from start)           ↑
                                  ↑
G (parallel from start, no deps)  ↑
                                  ↑
H (depends on C)                  ↑
                                  ↑
I (parallel anywhere after H simplifies UserMenu)
                                  ↑
J (anytime, last for polish)
```

**Critical path:** A → B → D → E → F → finish. Estimated 4-6 phases of plan-execute-validate cadence.

---

## Component Responsibilities Summary

| Component | Responsibility | Type | Cache Components |
|---|---|---|---|
| `watchesCatalog` table | Canonical spec sheet, denormalized counts | Postgres | RLS public-read, server-write |
| `getOrCreateCatalogEntry` (DAL) | Idempotent catalog upsert with `source` provenance | Server-only | N/A |
| `searchCatalogWatches` (DAL) | pg_trgm GIN ILIKE + viewer-state batch | Server-only | N/A — viewer-scoped |
| `searchCollections` (DAL) | Cross-user `watches` query with two-layer privacy | Server-only | N/A — viewer-scoped |
| `getPopularCollectors`, `getTrendingWatches` (DAL) | /explore data composition | Server-only | Could `'use cache'` with `cacheTag('explore', 'global')` + `cacheLife({revalidate: 3600})` for static popular-collectors view (defer to phase) |
| `EvaluateClient` | URL paste form → extract → analyze → render verdict | Client | N/A |
| `SimilarityVerdictCard` | Pure renderer for SimilarityResult | Client (or Server, if no interactivity) | Pure component, cache irrelevant |
| `SettingsTabs` | Hash-driven vertical tabs orchestrator | Client | N/A |
| `AccountSection` | Email/password change forms | Client | N/A |
| `pg_cron` job | Daily refresh of `owners_count` | Postgres | N/A |
| `updateAccountEmail`, `updateAccountPassword` (Server Actions) | Wrappers around `supabase.auth.updateUser` | Server | N/A |

---

## Architectural Patterns

### Pattern 1: Catalog Lookup with Source Provenance

**What:** When inserting into `watches_catalog`, the `source` column records how the row originated. Higher-trust sources (`url_extracted` > `user_promoted`) win on field enrichment conflicts.

**When to use:** Any time multiple subsystems can write to a normalized table.

**Example:**
```typescript
// In addWatch (user_promoted): create or link, never overwrite non-null fields
await getOrCreateCatalogEntry({ ...userData, source: 'user_promoted', enrichOnConflict: false })

// In fetchAndExtract (url_extracted): create or enrich, fill NULL fields with structured data
await getOrCreateCatalogEntry({ ...extractedData, source: 'url_extracted', enrichOnConflict: true })
```

### Pattern 2: Anti-N+1 via Batched `inArray` (continues from Phase 16)

**What:** Per-result lookups (badges, viewer state) are coalesced into a single `inArray` query at the end of the search/list pipeline.

**When to use:** Any list rendering with per-row viewer-state badges (isFollowing, viewerOwns, viewerWishlists, etc.).

**Example:** `searchCatalogWatches` collects `topIds` after the pre-LIMIT, then runs one `inArray(watches.catalogId, topIds)` to resolve `viewerOwns`/`viewerWishlists` for all rows. Mirrors `searchProfiles` `isFollowing` pattern.

### Pattern 3: Hash-Driven Tab State (no router.push)

**What:** Vertical tabs sync to URL hash via `window.history.pushState` directly, bypassing the Next.js router. Page Server Component does not re-render on tab change.

**When to use:** Single-page surfaces with multiple sections (Settings) where each section's data is fetched once at the page level.

**Trade-off:** No middleware-level analytics on tab change (the route doesn't change in Next's router). Pure client navigation.

### Pattern 4: Server-Computed Then Client-Pure Verdict (Evaluate)

**What:** Server Component fetches viewer state (collection + preferences); Client Component runs the pure `analyzeSimilarity()` against props in the browser.

**When to use:** Any feature where the input is user-supplied (URL paste) and the analysis is deterministic given known inputs.

**Why not server-side analyze:** No win — `analyzeSimilarity()` is fast (sub-millisecond), and running it client-side avoids a server roundtrip after extract. The server already paid the cost of fetching collection+preferences once.

---

## Anti-Patterns Specific to v4.0

### Anti-Pattern 1: Live Trigger on `watches` Mutations for `owners_count`

**What people do:** Wire `AFTER INSERT/UPDATE/DELETE` triggers on `watches` to keep `watches_catalog.owners_count` real-time.
**Why bad:** Hot-loop write amplification — every `addWatch` call fires a row-level UPDATE on the catalog row, which is one of dozens of catalog rows that might be hot-spotted. Bulk imports (50 watches in a sitting) become 50 catalog row locks.
**Do this instead:** Daily `pg_cron` batch (Phase D). 24h staleness is invisible for a "trending" feature.

### Anti-Pattern 2: Polymorphic / Single-Table-Inheritance for `watches` ↔ `watches_catalog`

**What people do:** Conditional foreign keys, type-discriminator columns, JSON-with-GIN to merge per-user and canonical fields into one table.
**Why bad:** Cybertec's polymorphism analysis (linked in STACK research) — none of these patterns translate well to SQL. Lifecycles are different (canonical = slow-changing shared; per-user = ephemeral with ownership status), so they want different tables.
**Do this instead:** Two tables joined by FK (current architecture).

### Anti-Pattern 3: Wiring `analyzeSimilarity` to Read from Catalog in v4.0

**What people do:** "Now that we have a canonical catalog, similarity should use it for cross-user identity." Refactor `analyzeSimilarity` to accept catalog rows.
**Why bad:** Adds risk surface (semantic-label regression, broken tests) for zero user-visible value in v4.0. The migration is non-trivial — `analyzeSimilarity` reads 8 dimensions from per-user `Watch` objects, and only some of those (brand, model, caseSizeMm) come from canonical fields; others (notes, pricePaid) are inherently per-user.
**Do this instead:** Defer to v5.0+. v4.0 catalog is silent infrastructure.

### Anti-Pattern 4: Sub-Routes for Settings Sections (`/settings/account`, `/settings/privacy`)

**What people do:** Separate route segments for each settings section, with parent layout boilerplate.
**Why bad:** Forces each section to have its own auth gate / data fetch / Suspense boundary. Triple the boilerplate for zero UX gain (same surface, same scrollable column on mobile).
**Do this instead:** Single `/settings` page, hash-driven tabs (Phase H).

### Anti-Pattern 5: Modal for `/evaluate`

**What people do:** Intercepting routes (`@modal/(.)evaluate/page.tsx`) to make `/evaluate` open as a modal over the user's collection.
**Why bad:** The verdict UI is dense (label + reasoning bullets + top-3 similar watches + per-dimension breakdown). 80–120 vertical lines does not fit a modal. Plus, the flow involves a 5–15s LLM extraction — interruptible, refresh-survivable behavior is what a route gives you, not a modal.
**Do this instead:** Dedicated `/evaluate` route (Phase G).

### Anti-Pattern 6: Forgetting `revalidateTag` on Catalog Updates

**What people do:** When `addWatch` wires `catalog_id`, forget that any cached `/explore` view tag (`'explore', 'global'`) needs invalidation.
**Why bad:** Stale trending counts.
**Do this instead:** If we ever apply `'use cache'` to /explore Server Components (deferred to phase), `addWatch` should `revalidateTag('explore', 'global')` after wiring catalog. Until then, no-op.

---

## Integration Points Summary

### Existing Files Modified

| File | Change Type | What Changes |
|---|---|---|
| `src/db/schema.ts` | Extend | Add `watchesCatalog` table + `watches.catalogId` FK |
| `src/data/watches.ts` | Modify | `createWatch` may set `catalog_id`; add `linkWatchToCatalog` helper |
| `src/data/search.ts` | Extend | Add `searchCollections` |
| `src/lib/extractors/index.ts` | Extend | Upsert into catalog with `source='url_extracted'` |
| `src/app/actions/watches.ts` | Modify | `addWatch` calls `getOrCreateCatalogEntry` after `createWatch` |
| `src/app/actions/search.ts` | Extend | Add `searchCatalogWatchesAction`, `searchCollectionsAction` |
| `src/app/explore/page.tsx` | Replace | Stub → real popular-collectors + trending-watches surface |
| `src/app/settings/page.tsx` | Modify | Wraps new `<SettingsTabs>` instead of inline `<SettingsClient>` |
| `src/app/preferences/page.tsx` | Optional | Redirect to `/settings#preferences` OR keep dual entry |
| `src/components/search/SearchPageClient.tsx` | Modify | Replace 2 `<ComingSoonCard>` with results blocks |
| `src/components/search/useSearchState.ts` | Extend | Tab-aware fetch dispatcher |
| `src/components/insights/SimilarityBadge.tsx` | Refactor | Delegate render to new `SimilarityVerdictCard` |
| `src/components/layout/Header.tsx` | Modify | Pass `avatarUrl` to DesktopTopNav |
| `src/components/layout/DesktopTopNav.tsx` | Modify | Add avatar slot before bell |
| `src/components/layout/UserMenu.tsx` | Modify | Remove inline theme; simplify dropdown |
| `src/components/settings/SettingsClient.tsx` | Replace | Becomes thin shim or split into PrivacySection |
| `src/components/watch/WatchForm.tsx` | Modify | Add `isChronometer` toggle, `notesPublic` per-note control |
| `src/components/watch/WatchDetail.tsx` | Modify | Display `isChronometer` |
| `src/proxy.ts` | NO CHANGE | `/evaluate`, `/settings/...` are authed routes; PUBLIC_PATHS unchanged |

### New Files

| File | Purpose |
|---|---|
| `supabase/migrations/{date}_phase_v4_watches_catalog.sql` | Catalog table + RLS + indexes + FK on watches |
| `supabase/migrations/{date}_phase_v4_owners_count_cron.sql` | pg_cron daily refresh job |
| `scripts/backfill-watches-catalog.ts` | One-shot idempotent backfill |
| `src/data/catalog.ts` | Catalog DAL (`getOrCreateCatalogEntry`, `linkWatchToCatalog`, `searchCatalogWatches`) |
| `src/data/explore.ts` | Explore DAL (`getPopularCollectors`, `getTrendingWatches`) |
| `src/app/actions/account.ts` | Email/password change Server Actions |
| `src/app/evaluate/page.tsx` | Evaluate route (Server Component shell) |
| `src/components/evaluate/EvaluateClient.tsx` | Evaluate Client Component (form + render) |
| `src/components/insights/SimilarityVerdictCard.tsx` | Shared verdict renderer |
| `src/components/explore/PopularCollectorRow.tsx` | Explore popular-collectors row |
| `src/components/explore/TrendingWatchRow.tsx` | Explore trending-watch row |
| `src/components/search/WatchSearchRow.tsx` | Watches search result row |
| `src/components/search/CollectionSearchRow.tsx` | Collections search result row |
| `src/components/settings/SettingsTabs.tsx` | Vertical-tabs orchestrator |
| `src/components/settings/AccountSection.tsx` | Account section (email/password) |
| `src/components/settings/PreferencesSection.tsx` | Preferences section (collectionGoal, overlapTolerance) |
| `src/components/settings/PrivacySection.tsx` | Privacy section (toggles) — likely from refactor |
| `src/components/settings/NotificationsSection.tsx` | Notifications section (toggles) |
| `src/components/settings/AppearanceSection.tsx` | Appearance section (theme) |
| `src/components/settings/EmailChangeForm.tsx` | Email change form + pending banner |
| `src/components/settings/PasswordChangeForm.tsx` | Password change form + ReauthDialog |
| `src/components/settings/ReauthDialog.tsx` | 6-digit code re-auth dialog |
| `docs/local-dev.md` (or extension to deploy-db-setup) | Manual `pg_cron`-equivalent refresh in local dev |

### Out-of-Tree Configuration

| What | Where | When |
|---|---|---|
| DNS records (SPF + DKIM + bounce MX) | Domain registrar for horlo.app | Phase C |
| Resend domain verification | Resend dashboard | Phase C |
| Supabase SMTP creds | Supabase Dashboard → Auth → SMTP | Phase C |
| "Confirm email" toggle ON | Supabase Dashboard → Auth → Providers | Phase C |
| Email templates (HTML restyling) | Supabase Dashboard → Auth → Email Templates | Phase C (optional, can defer) |

---

## Cache Components Compatibility — Per-Feature

| Feature | Cacheable? | Tag Strategy |
|---|---|---|
| `/evaluate` page | NO — viewer-dynamic | No `'use cache'`, just inside layout's `<Suspense>` |
| `/explore` Popular Collectors block | MAYBE — global view | Could `'use cache'` + `cacheTag('explore', 'collectors-global')` + `cacheLife({revalidate: 3600})`. Defer decision to Phase E plan |
| `/explore` Trending Watches block | YES — global view, daily refresh | `'use cache'` + `cacheTag('explore', 'trending-global')` + `cacheLife({revalidate: 3600})`. Invalidate via `revalidateTag` after `pg_cron` job? Or accept SWR. **Phase E plan-time decision.** |
| `/search` Watches results | NO — viewer-dynamic | No cache; query depends on viewer's owned/wishlist state |
| `/search` Collections results | NO — viewer-dynamic | No cache; depends on viewer self-exclusion + privacy gates |
| `/settings/...` sections | NO — viewer-scoped | No cache |
| `getProfileById`, `getProfileSettings` calls in nav layout | Already not cached (per-request) | N/A |
| Catalog row reads in `addWatch` | Per-request, sub-ms | No cache needed |

**Pattern continuity:** Same posture as v3.0 — viewer-scoped reads bypass `'use cache'`; only NotificationBell-style global-or-recipient-scoped reads opt into caching. /explore is the only candidate for v4.0 caching, and the decision is deferred to plan time.

---

## Open Architecture Decisions (Must Resolve at Plan Time)

**Decision 1: pg_cron in local dev**

Option A: Skip `cron.schedule(...)` line in local migrations, run manually via `npm run refresh-counts`.
Option B: Run a Node-side scheduler in dev process.

**Recommendation:** A. Local dev tolerating stale counts is fine.

**Decision 2: `/explore` caching posture**

Option A: No `'use cache'` — re-render on every request. Simplest.
Option B: `'use cache'` with 1h TTL on Trending Watches block. Faster, but adds tag invalidation surface.

**Recommendation:** A initially; revisit if /explore visit volume grows.

**Decision 3: Catalog row source enrichment behavior**

When `url_extracted` extracts a watch that's already a `user_promoted` catalog row, do we:
- (a) overwrite NULL fields silently (recommended STACK §How the Catalog Gets Populated)
- (b) flag the row as "needs admin review" before applying enrichments
- (c) write to a separate `watches_catalog_pending` queue

**Recommendation:** (a) — overwrite NULL only, never non-NULL. Simple, additive, recoverable.

**Decision 4: Email change pending-banner UX**

Option A: Persistent banner at top of /settings#account, "Cancel pending change" button.
Option B: Toast on submit, no banner — user is on their own to remember.

**Recommendation:** A. Banner is more discoverable.

**Decision 5: Catalog matching UX for typos**

When user types "ROLEX" but catalog has "Rolex", do we:
- (a) auto-link silently (case-insensitive natural key) — recommended; mirrors `getProfileByUsername` lower(username)
- (b) prompt user "Did you mean Rolex?" before linking
- (c) link to a NEW catalog row with brand "ROLEX" — pollutes catalog

**Recommendation:** (a) — UNIQUE index on `(LOWER(brand), LOWER(model), reference)` natural key. Prevents catalog pollution. Implementation: a generated column or a custom unique expression index.

```sql
-- Alternative natural-key UNIQUE
CREATE UNIQUE INDEX watches_catalog_natural_key_idx
  ON watches_catalog (LOWER(brand), LOWER(model), reference) NULLS NOT DISTINCT;
```

This handles the typo-canonicalization without requiring an admin tool. The user-displayed string (with original casing) is still preserved on the row.

---

## Sources

- Existing codebase read directly for v4.0 integration:
  - `src/db/schema.ts` (HIGH confidence — current schema)
  - `src/data/search.ts` (HIGH — Phase 16 searchProfiles pattern)
  - `src/data/watches.ts` (HIGH — getWatchByIdForViewer two-layer privacy pattern)
  - `src/data/profiles.ts` (HIGH — getProfileById, getProfileSettings)
  - `src/data/notifications.ts` (HIGH — DAL conventions)
  - `src/lib/similarity.ts` (HIGH — analyzeSimilarity signature)
  - `src/components/insights/SimilarityBadge.tsx` (HIGH — render shape)
  - `src/components/watch/WatchDetail.tsx` (HIGH — call site)
  - `src/components/search/SearchPageClient.tsx` (HIGH — 4-tab pattern)
  - `src/components/layout/DesktopTopNav.tsx` (HIGH — nav surface)
  - `src/components/layout/SlimTopNav.tsx` (HIGH — mobile nav surface)
  - `src/components/layout/BottomNav.tsx` (HIGH — mobile bottom nav)
  - `src/components/layout/UserMenu.tsx` (HIGH — dropdown structure)
  - `src/components/layout/BottomNavServer.tsx` (HIGH — Suspense + DAL composition)
  - `src/proxy.ts` + `src/lib/constants/public-paths.ts` (HIGH — auth gate)
  - `src/app/api/extract-watch/route.ts` (HIGH — extract route handler)
  - `src/app/actions/watches.ts` (HIGH — addWatch shape, fire-and-forget logging)
  - `src/app/layout.tsx` (HIGH — Cache Components + Suspense layout)
  - `src/app/search/page.tsx` (HIGH — current /search wiring)
  - `src/app/settings/page.tsx` (HIGH — current /settings shell)

- `.planning/research/STACK.md` v4.0 (HIGH — informed catalog design, Resend choice, pg_cron, Settings tabs)
- `.planning/PROJECT.md` (HIGH — v4.0 milestone scope and key decisions)
- `.planning/research/ARCHITECTURE.md` v3.0 (HIGH — pre-existing architectural posture for Cache Components, two-layer privacy, fire-and-forget logging)
- MEMORY.md hits:
  - `project_drizzle_supabase_db_mismatch.md` — `pg_cron` schedule placement in supabase/migrations
  - `project_supabase_secdef_grants.md` — `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` for SECDEF functions
- Postgres docs: `UNIQUE NULLS NOT DISTINCT` (PG 15+); `pg_cron` extension; `CREATE POLICY` syntax (consulted via Supabase docs links in STACK.md)

---
*Architecture research for: Horlo v4.0 Discovery & Polish*
*Researched: 2026-04-26*

# Architecture Research

**Domain:** Catalog hierarchy integration + engine rewire — v5.0 Discovery North Star
**Researched:** 2026-05-06
**Confidence:** HIGH (based on first-party source code + seed documents; no external lookup required)

---

## Standard Architecture

### System Overview

The existing architecture does not change. v5.0 extends it vertically (new tables below
`watches_catalog`) and horizontally (new columns on existing tables). No layer changes.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (Client Components — filter state only via Zustand 31 LOC)  │
├──────────────────────────────────────────────────────────────────────┤
│  Next.js 16 App Router — Server Components by default                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐    │
│  │  pages/     │  │  Server      │  │  Cache Components         │    │
│  │  layouts    │  │  Actions     │  │  cacheLife per rail       │    │
│  │  (RSC)      │  │  src/app/    │  │  updateTag / revalidate   │    │
│  └──────┬──────┘  │  actions/*   │  │  Tag for cross-user       │    │
│         │         └──────┬───────┘  └──────────────────────────┘    │
├─────────┴────────────────┴──────────────────────────────────────────┤
│  Server-only DAL  src/data/*   (import 'server-only')                │
│  Two-layer privacy: RLS at DB + DAL WHERE on every cross-user read   │
│  ┌────────────┐ ┌───────────┐ ┌────────────┐ ┌───────────────────┐  │
│  │ catalog.ts │ │watches.ts │ │discovery.ts│ │ NEW: hierarchy.ts │  │
│  └─────┬──────┘ └─────┬─────┘ └─────┬──────┘ └────────┬──────────┘  │
├────────┴──────────────┴─────────────┴───────────────────┴───────────┤
│  Drizzle ORM  →  Supabase Postgres (RLS project-wide)                │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────────┐  │
│  │  watches │  │watches_catalog│  │  NEW: brands / watch_families │  │
│  │  (user)  │  │  (reference) │  │  watch_variants               │  │
│  └──────────┘  └──────────────┘  │  watch_lineage_edges          │  │
│                                   │  divestments                  │  │
│                                   └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## FK Chain: 5-Level Hierarchy

### Correct FK topology

```
brands
  id  PK

watch_families
  id      PK
  brand_id  FK → brands.id  ON DELETE SET NULL   ← nullable so families survive brand record gaps

watches_catalog  (Reference level — canonical unit for recommender + social graph)
  id        PK
  brand_id    FK → brands.id        NULLABLE  ON DELETE SET NULL
  family_id   FK → watch_families.id NULLABLE  ON DELETE SET NULL
  [existing columns unchanged]

watch_variants
  id         PK
  catalog_id   FK → watches_catalog.id  NOT NULL  ON DELETE CASCADE

watch_lineage_edges
  predecessor_catalog_id  FK → watches_catalog.id  NOT NULL  ON DELETE CASCADE
  successor_catalog_id    FK → watches_catalog.id  NOT NULL  ON DELETE CASCADE
  relationship_type       text  CHECK IN ('direct_successor','reissue','homage','inspired_by')

watches  (per-user Individual level)
  catalog_id  FK → watches_catalog.id  NULLABLE → SET NOT NULL in CAT-14
  variant_id  FK → watch_variants.id   NULLABLE  (new; see Variant FK section below)
```

### What stays NULLABLE vs what gets SET NOT NULL

| Column | Phase added | Nullable rule |
|---|---|---|
| `watches_catalog.brand_id` | Layer A | NULLABLE for incremental backfill; no SET NOT NULL target |
| `watches_catalog.family_id` | Layer A | NULLABLE — many References have no Family yet |
| `watch_families.brand_id` | Layer A | NULLABLE — see cascade safety note |
| `watches.catalog_id` | Phase 17 (existing) | NULLABLE until CAT-14; SET NOT NULL in Layer C (clean slate unlocks it) |
| `watches.variant_id` | Layer C | NULLABLE forever — variant assignment is optional |
| `watch_lineage_edges.predecessor_catalog_id` | Layer B | NOT NULL — edge is meaningless without both endpoints |
| `watch_lineage_edges.successor_catalog_id` | Layer B | NOT NULL |
| `watch_variants.catalog_id` | Layer C | NOT NULL — variant must belong to a reference |

**Clean-slate enables CAT-14.** Because this is a single-user DB and the owner consents to a wipe-and-reseed, `watches.catalog_id` can be SET NOT NULL in the same milestone (Layer C phase). Without the clean slate, CAT-14 would require two consecutive deploys with zero NULL rows verified — the documented v4.0 deferral rationale.

### RLS interaction

`watches_catalog` already has public-read RLS and service-role-write only. The new hierarchy tables (`brands`, `watch_families`, `watch_variants`, `watch_lineage_edges`) should follow the same pattern:

- **Public read** — catalog hierarchy is discovery-level data; no personal information
- **Service-role write only** — all writes are admin-curated or via service-role scripts
- No per-user row ownership, so no `auth.uid()` predicate needed on reads

The `divestments` table (or `watches.status += 'sold'`) is per-user and must follow `watches` RLS: `auth.uid() = user_id` for all operations.

---

## Lineage Edges: Separate Junction Table vs Self-Reference

**Use a separate `watch_lineage_edges` junction table.** This is the idiomatic Postgres choice for graph edges and is unambiguously correct here.

**Why not a self-referencing FK on `watches_catalog`:**
- Self-reference only supports a single predecessor, which breaks the multi-predecessor case (e.g., 5513 had regional variants that all feed into 1680)
- Querying multi-hop paths on a self-referencing FK requires ugly lateral joins or recursive CTEs anchored on a single column
- Adding `relationship_type` requires a second self-referencing column, which is awkward
- The junction table cleanly represents an M:N graph edge with metadata

**`watch_lineage_edges` schema:**

```sql
CREATE TABLE watch_lineage_edges (
  predecessor_catalog_id  uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE CASCADE,
  successor_catalog_id    uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE CASCADE,
  relationship_type       text NOT NULL DEFAULT 'direct_successor'
    CHECK (relationship_type IN ('direct_successor','reissue','homage','inspired_by')),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (predecessor_catalog_id, successor_catalog_id, relationship_type)
);
```

**Recursive CTE vs application-side traversal:**

Use a recursive CTE for multi-hop path queries. Application-side traversal requires N+1 round-trips and is appropriate only when hop count is known to be 1 (e.g., "immediate predecessor only").

For discovery ("show me the full lineage of this Reference"), a recursive CTE is the correct primitive:

```sql
WITH RECURSIVE lineage AS (
  SELECT successor_catalog_id AS id, 0 AS depth
  FROM watch_lineage_edges
  WHERE predecessor_catalog_id = $targetId

  UNION ALL

  SELECT e.successor_catalog_id, l.depth + 1
  FROM watch_lineage_edges e
  JOIN lineage l ON e.predecessor_catalog_id = l.id
  WHERE l.depth < 10  -- cycle guard
)
SELECT DISTINCT id, depth FROM lineage;
```

**Cycle guard is mandatory.** The collector taxonomy is not always a clean DAG (homage relationships can be circular in edge cases). Depth limit of 10 is sufficient for any real lineage chain.

For v5.0 scope, implement the recursive CTE in a dedicated DAL function (`getLineageForReference`) and call it application-side only from discovery surfaces (`/catalog/[id]`). Do not embed recursive CTEs inside larger joins used by hot paths (explore rails, search).

---

## Variant FK: where does `watches.variant_id` resolve?

**`watches` points to `watches_catalog` (Reference) as the primary FK.** `watches.variant_id` is an optional secondary FK to `watch_variants`. This is backwards-compatible and is the only safe choice for v5.0.

**Why Reference, not Variant, remains the primary FK:**

- `watches.catalog_id` is already the established FK used by all existing DAL functions, caches, and the engine rewire target (CAT-13)
- The recommendation signal (SEED-002 Layer 1) is built at Reference granularity — all social graph aggregates (`ownersCount`, `wishlistCount`, `watchesCatalogDailySnapshots`) key on `catalog_id`
- Forcing `watches.catalog_id` → `watch_variants.catalog_id` would require a JOIN through variants to reach Reference in every query — a performance and complexity regression
- The explicit SEED-001 guidance: "Reference is the canonical unit for the social graph and recommender. Not Variant, not Individual."

**Variant FK as additive secondary field:**

```typescript
// watches table — Layer C addition
variantId: uuid('variant_id').references(() => watchVariants.id, { onDelete: 'set null' })
```

- When null: the user's watch resolves to the Reference level (existing behavior)
- When set: the user has optionally pinned their instance to a specific variant (dial, bezel, bracelet)
- Never used as a JOIN anchor in aggregate queries; only for display enrichment on watch detail pages

**Backwards compatibility:** `watches.catalog_id` is unchanged. All existing code (`searchCatalogWatches`, `getTrendingCatalogWatches`, `getGainingTractionCatalogWatches`, `analyzeSimilarity` post-CAT-13) continues to work without modification.

---

## Divestments: Separate Table vs `watches.status` += 'sold'

### Current state

`watches.status` already includes `'sold'` as an enum value. The schema at line 58:
```typescript
status: text('status', { enum: ['owned', 'wishlist', 'sold', 'grail'] }).notNull()
```

`'sold'` is a live enum value and already used by the `stateMap` logic in `searchCatalogWatches` (the "sold + grail are NOT badged" branch). It is NOT dead code.

### Analysis for SEED-002 recommender prereq

The recommender needs the "sold" signal as a **negative interaction** weighted at -0.3. What the recommender actually needs is:
- Which user sold which Reference
- When they sold it (for temporal decay)
- Optionally: what they replaced it with (a strong positive signal)

**Option A: `watches.status = 'sold'` (extend existing)**

Advantages:
- Already exists and is used
- No schema change required for the status bit
- Provenance fields added in Layer D (`purchase_date`, `condition`, `paid_currency`) land on the same row, which is the Individual

Disadvantages:
- The "sold" watch row persists in the user's `watches` table indefinitely — it clutters collection views and requires filter-on-read everywhere
- No first-class "sold date" or "sold to" fields unless added as provenance columns (Layer D adds `purchase_date` but not a sale date)
- For SEED-002, the recommender signal is "user_id × catalog_id → -0.3 at timestamp"; this is expressible from a `watches` row where `status = 'sold'` if a `sold_at` timestamp is added

**Option B: `divestments` table**

```sql
CREATE TABLE divestments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  catalog_id   uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE SET NULL,
  variant_id   uuid REFERENCES watch_variants(id) ON DELETE SET NULL,
  sold_at      timestamptz NOT NULL DEFAULT now(),
  sold_price   numeric(10,2),
  sold_currency text,
  condition    text CHECK (condition IN ('mint','excellent','good','fair','poor')),
  replaced_by_catalog_id  uuid REFERENCES watches_catalog(id) ON DELETE SET NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Advantages:
- Clean separation: collection stays in `watches`; divestment history is its own table
- Allows `sold_at` timestamp as a first-class field (critical for temporal decay in recommender)
- `replaced_by_catalog_id` enables the "transition signal" SEED-002 describes: "moved from 16610 to vintage Heuer"
- RLS: `auth.uid() = user_id` on all operations; same pattern as `watches`
- The recommender's signal extractor reads `divestments` as a dedicated negative-signal source rather than filtering `watches` by status

Disadvantages:
- Requires a Server Action transition flow: "Mark as sold" would insert a `divestments` row AND either delete the `watches` row or set `status = 'sold'`
- Two tables to keep in sync if the user edits provenance data later
- More complex than extending `watches`

### Recommendation: Divestments table

Use a `divestments` table for the following reasons:

1. **SEED-002 first-class requirement:** The recommender needs `sold_at` timestamp for temporal decay. Adding `sold_at` to `watches` means a sold watch from 2019 looks like a recent signal unless timestamp is tracked. The `divestments` table makes this a primary key concern, not an afterthought.

2. **Collection view cleanliness:** The user's collection page should not have to filter out sold watches. With a divestments table, `watches` only contains active inventory (owned, wishlist, grail). Sold → archive flow is one-way and explicit.

3. **Transition signal:** `replaced_by_catalog_id` is only natural in a dedicated divestment record, not on the original `watches` row.

4. **`watches.status = 'sold'`:** Keep the existing enum value as a transitional state during the "mark as sold" flow (before the divestment record is created and the watch is archived). This preserves backwards compat with any code that currently checks for `sold` status. After the divestment record is committed, either delete the `watches` row or hard-filter it from collection views.

**Server Action pattern:**

```typescript
// src/app/actions/watches.ts — new action
async function divestWatch(watchId: string, divestmentData: DivestmentInput): Promise<ActionResult<void>> {
  // 1. Verify ownership (double-verified: session + DAL WHERE)
  // 2. Read watch to get catalog_id
  // 3. Insert into divestments
  // 4. Delete (or status='sold') the watches row
  // 5. revalidateTag('explore', 'max')  — counts shift
  // 6. revalidatePath('/')
}
```

**RLS for divestments:** Mirror `watches` RLS exactly:
- `SELECT WHERE user_id = auth.uid()`
- `INSERT WITH CHECK (user_id = auth.uid())`
- `UPDATE USING (user_id = auth.uid())`
- `DELETE USING (user_id = auth.uid())`

---

## CAT-13 Engine Rewire: Migration Path

### Current state (byte-locked)

`analyzeSimilarity(targetWatch, collection, preferences)` in `src/lib/similarity.ts` receives `Watch[]` and `UserPreferences`. It reads `styleTags`, `designTraits`, `roleTags`, `dialColor`, `complications`, `caseSizeMm`, `strapType`, `waterResistanceM` from per-user `Watch` objects. It does NOT read `watches_catalog` taste columns (`formality`, `sportiness`, `heritageScore`, `primaryArchetype`, `eraSignal`, `designMotifs`, `confidence`).

The taste columns were added in Phase 19.1 but the engine was explicitly byte-locked per D-09. The verdict copy in Phase 20 reads taste attributes via a separate `viewerTasteProfile` aggregate — this is the pattern CAT-13 should extend.

### Safe migration path

**Do not modify `analyzeSimilarity()` as a standalone function.** The migration is in how callers assemble the `Watch` objects passed to it. Specifically:

**Step 1: Extend the `Watch` type with optional taste fields.**

```typescript
// src/lib/types.ts — additive, never breaking
interface Watch {
  // ... existing fields ...
  // CAT-13: catalog taste attributes (present when catalogId is set + catalog row has taste data)
  catalogTaste?: {
    formality: number | null
    sportiness: number | null
    heritageScore: number | null
    primaryArchetype: string | null
    eraSignal: string | null
    designMotifs: string[]
    confidence: number | null
  }
}
```

**Step 2: Extend the DAL read path to JOIN catalog taste.**

In `src/data/watches.ts`, wherever `getWatchesByUser` (or equivalent) loads the collection for engine input, add a LEFT JOIN to `watches_catalog` and populate `catalogTaste` on each row. The LEFT JOIN is safe because `catalog_id` is nullable (pre-CAT-14 rows have no catalog row).

```sql
SELECT w.*, wc.formality, wc.sportiness, wc.heritage_score, ...
FROM watches w
LEFT JOIN watches_catalog wc ON wc.id = w.catalog_id
WHERE w.user_id = $userId
```

**Step 3: Modify `analyzeSimilarity()` to use taste columns when present.**

This is the only modification to `similarity.ts`. The engine should weight taste columns as additional scoring dimensions when present, falling back to the existing per-user-watch scoring when they are absent. The byte-lock from Phase 17/19.1/20 was a constraint on those specific phases. CAT-13 is explicitly the rewire phase — the lock is lifted.

**Step 4: Static guard tests (regression protection).**

Before touching `similarity.ts`, add to the test suite:
- `tests/static/similarity.taste-null.test.ts` — verifies that when `catalogTaste` is undefined/null on all Watch objects, all existing test cases produce byte-identical outputs (snapshot test against current labels)
- `tests/static/similarity.taste-present.test.ts` — verifies that when `catalogTaste` is present with known values, scores shift in the expected direction (formality-heavy catalog + formal preference → higher alignment score)

The existing 6-label coverage in `tests/lib/similarity.test.ts` should be run as a regression baseline before the rewire.

**Step 5: No dual-read shadow phase needed.**

A shadow phase (run both old and new scoring in parallel, compare) is appropriate when the old engine is in production and a regression is catastrophic. Here:
- It's a single-user system (one collector)
- The clean-slate DB wipe in Layer C precedes CAT-13
- Static guard tests provide the regression net
- The taste columns have `confidence` scores — the engine can implement a confidence gate (only use taste columns when `confidence >= 0.5`, same threshold as Phase 20 verdict copy)

**Confidence gate pattern:**

```typescript
// Inside analyzeSimilarity or a new calculatePairSimilarityWithTaste function
const tasteWeight = 0.15  // additive; does not displace existing weights
if (watch.catalogTaste?.confidence != null && watch.catalogTaste.confidence >= 0.5) {
  score += tasteWeight * tasteAlignmentScore(watch.catalogTaste, preferences)
}
```

This is additive, not a replacement. The existing 8-dimension scoring continues to run. Taste columns provide a 9th dimension with a confidence gate.

---

## DEBT-09: Why Was the Fix Not Merged?

**Finding: Process miss, not an architectural reason.**

From PROJECT.md Active requirements:

> Phase 23 SUMMARY claimed both shipped via commit `4d362ff`, but `git merge-base --is-ancestor 4d362ff HEAD` returns exit 1 — that commit never reached `main`.

The commit `4d362ff` existed in a worktree or local branch that was not merged before the Phase 23 plan was closed. The Phase 31 audit surfaced this via a direct ancestry check.

**What the fix requires (architectural context):**

1. **`notesPublic` Zod field:** `insertWatchSchema` in `src/app/actions/watches.ts` does not include `notesPublic`. The WatchForm sends it; Zod strips it at the schema boundary before it reaches `watchDAL.createWatch`. Fix: add `notesPublic: z.boolean().optional()` to `insertWatchSchema` and `updateWatchSchema`.

2. **`revalidatePath('/u/{username}/{tab}')` missing:** After `addWatch` and `editWatch`, only `revalidatePath('/')` is called. Profile tab pages (`/u/{username}/collection`, `/u/{username}/wishlist`, etc.) use cached Server Components and do not see the mutation. Fix: call `revalidatePath('/u/[username]/[tab]', 'page')` with the viewer's username after every write. This requires resolving the viewer's username inside the action — either by reading from `getProfileById(user.id)` (already called in `addWatch` for the overlap notification path) or by caching the username on the session.

**Build note for DEBT-09 phase:** Add `notesPublic` to both Zod schemas AND verify it flows through `createWatch` / `updateWatch` in the DAL (check `src/data/watches.ts` insert/update shapes). The test scaffold at `tests/actions/watches.notesPublic.test.ts` is already in place and will go GREEN once the schema field and revalidation call land.

---

## SET-13 Account Delete: Architecture

### Cascade vs soft-delete + cron

**Use hard cascade with a multi-step confirm flow.** This is a single-user system; the owner consents explicitly. Soft-delete introduces complexity (filtering deleted rows from every query, RLS becomes conditional) that is not justified at this scale.

**Cascade behavior from schema (already correct):**

All tables that reference `users.id` already use `ON DELETE CASCADE`:
- `watches` → cascade (users row delete removes all watches)
- `user_preferences` → cascade
- `profiles` → cascade
- `follows` → cascade (both follower_id and following_id)
- `profile_settings` → cascade
- `activities` → cascade
- `wear_events` → cascade
- `notifications` → cascade (both user_id and actor_id)
- `divestments` (new) → cascade

**Edge cases — what happens to public-profile reads for other users:**

After a user deletes their account:
- `follows` rows (where deleted user was followed) cascade-delete, so follower counts for other users' pages reflect the removal on next cache revalidation
- `activities` cascade-delete; their wear events no longer appear in other users' feeds
- `wear_events` cascade-delete; no orphaned wear photos accessible via the API (Supabase Storage bucket files must be purged separately — see below)
- `notifications` where `actor_id = deleted_user_id` cascade-delete; recipients' notification inboxes lose those rows on next revalidation

**Storage bucket orphan cleanup:**

Cascade deletes DB rows but NOT Supabase Storage files. The account delete Server Action must explicitly:
1. List all files in `wear-photos/{userId}/` bucket folder
2. Delete them (Supabase Storage admin client, service-role key)
3. Then delete the `users` row (which cascades the rest)

This must be synchronous within the Server Action, not deferred to a cron, because the user expects their data to be gone immediately on confirm.

**Multi-step confirm pattern:**

```
Settings → Account → "Delete Account" button
  → Step 1: "This will permanently delete your account and all data." + type-to-confirm input (type "DELETE")
  → Step 2: Password re-auth (same pattern as Phase 22 password change re-auth dialog)
  → Commit: deleteAccount() Server Action
```

**RLS implications:** The `deleteAccount` Server Action calls `supabase.auth.admin.deleteUser(userId)` using the service-role client (not the user's session client). This is the only safe path — Supabase Auth does not allow users to delete themselves via the user-session client. The service-role call must be double-verified: read the session inside the action, confirm the authenticated user's ID matches the deletion target before calling admin.deleteUser.

**No soft-delete + cron needed:** The collector is the single user. There is no need for a 30-day grace period or recovery window. If they want this later, soft-delete can be added as a Layer 2 on top of hard cascade.

---

## Cache Invalidation Matrix: New Keys Needed

### Existing cache tags

| Tag | Scope | Used by |
|---|---|---|
| `'explore'` | Global | `addWatch`, `editWatch`, `removeWatch` → `revalidateTag('explore', 'max')` |
| `'notifications'` | Per-user | NotificationBell Server Component |
| `'viewer:{userId}'` | Per-user | Recipient's notification bell after overlap write |
| `'explore:popular-collectors:viewer:{userId}'` | Per-viewer | Follow/unfollow Server Actions |

### New tags required for hierarchy

| New tag | Scope | When to invalidate |
|---|---|---|
| `'catalog:brand:{brandId}'` | Per-brand | When any `brands` row is updated; when `watches_catalog.brand_id` FK changes for that brand |
| `'catalog:family:{familyId}'` | Per-family | When any `watch_families` row is updated; when References are assigned/removed from a family |
| `'catalog:reference:{catalogId}'` | Per-reference | When `watches_catalog` row is updated (taste enrichment, image update, spec change) |
| `'catalog:lineage:{catalogId}'` | Per-reference | When `watch_lineage_edges` rows for this reference change |

**For v5.0 scope:** Only `'catalog:reference:{catalogId}'` needs to be wired immediately (the `/catalog/[catalogId]` route uses this pattern already via the Phase 20 verdict surface). Brand and family tags are needed only when brand/family browse pages ship (audit-driven polish phase).

**Invalidation rule:** Admin writes to hierarchy tables (`brands`, `watch_families`, `watch_lineage_edges`) are service-role operations, not user-session Server Actions. Invalidation should be triggered by an admin Server Action wrapper that:
1. Performs the write with service-role client
2. Calls `revalidateTag('catalog:brand:{id}', 'max')` or equivalent
3. Calls `revalidateTag('explore', 'max')` for any Reference count change

**Do not invalidate `'explore'` on every hierarchy write.** Brand/Family/Lineage changes do not affect `ownersCount`/`wishlistCount` denormalized counts, so the explore rails do not need revalidation.

---

## Test Architecture: Hierarchy Tree Fixtures

### Existing factory patterns

The test suite does not use a formal factory pattern. Tests construct objects inline or import fixture types directly. The Vitest setup in `src/test/` includes `StrictMode` wrapper and MSW for API routes. Integration tests use `src/db/` directly against the local Supabase instance.

### Recommended hierarchy fixture pattern for v5.0 tests

For unit tests (no DB), define in-memory fixture builders:

```typescript
// tests/fixtures/catalog-hierarchy.ts
import type { CatalogEntry } from '@/lib/types'

export function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return { id: crypto.randomUUID(), name: 'Rolex', country: 'CH', ...overrides }
}

export function makeFamily(overrides: Partial<WatchFamily> = {}): WatchFamily {
  return { id: crypto.randomUUID(), brandId: makeBrand().id, name: 'Submariner', ...overrides }
}

export function makeCatalogEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: crypto.randomUUID(), brand: 'Rolex', model: 'Submariner Date',
    reference: '16610', brandId: null, familyId: null,
    formality: 0.3, sportiness: 0.9, heritageScore: 0.85,
    confidence: 0.92, ...overrides
  }
}

export function makeLineageChain(length: number): { entries: CatalogEntry[], edges: LineageEdge[] }
```

For integration tests (with DB), use `beforeEach` + `afterEach` to insert and clean up hierarchy rows. The existing integration test pattern (insert rows directly via Drizzle, verify DAL output, delete rows) applies without modification.

**Static guard for CAT-13 rewire** (described above in the engine rewire section) should live at `tests/static/similarity.taste-null.test.ts` and `tests/static/similarity.taste-present.test.ts`. These are snapshot tests, not unit tests — they establish the byte-identical baseline before the rewire and verify directional correctness after.

---

## Discovery Audit Output as Architecture Artifact

**The audit's output document is a decisions doc, not an abstract recommendations list.** This distinction matters for how the roadmap cites it.

### Format

The audit should produce `.planning/research/DISCOVERY-AUDIT.md` with:
- Click-path map: a text diagram of every path from every surface, including dead ends and missing affordances
- Three decision tables:
  1. "Combine home and explore?" — YES/NO with rationale
  2. "Which dead ends to close in audit-driven polish?" — enumerated list with priority
  3. "What does CAT-13 unlock that isn't currently possible?" — direct evidence for the engine rewire being a discovery feature

The downstream phases (audit-driven polish, CAT-13) cite specific items from these tables. This keeps the roadmap falsifiable: a phase can be "Phase 35 closes DISC-AUDIT items 3, 4, 7" rather than "Phase 35 improves discovery."

**PLAN.md citation format:**
```
Closes: DISC-AUDIT-[item number] from .planning/research/DISCOVERY-AUDIT.md
```

---

## Suggested Build Order

### Dependencies graph

```
Phase 32: Discovery Audit (read-only; no schema)
    ↓ (audit findings shape scope of polish phases)
Phase 33: Layer A — Brand + Family entities (additive FKs on watches_catalog)
    ↓ (brands/families exist before lineage can reference them)
Phase 34: Layer B — Lineage edges + structured movement + era/material/bracelet
    |                (can overlap with Phase 33 for movement/era; lineage needs Layer A for brand context)
    ↓
Phase 35: Layer C — Variant split + clean-slate DB wipe + CAT-14 SET NOT NULL
    ↓ (clean slate makes CAT-14 safe; CAT-14 must precede engine rewire that relies on 100% catalog_id coverage)
Phase 36: Layer D — Provenance fields on watches + divestments table (SEED-002 prereq)
    |
    ↓ (can overlap with Phase 37 if Layer C is complete)
Phase 37: CAT-13 engine rewire + CAT-14 SET NOT NULL enforcement
    |
    ↓ (rewired engine enables better verdicts → discovery surfaces can use them)
Phase 38+: Audit-driven polish (interleaved with DEBT-09, SET-13, SET-14, Nyquist)
```

### Phases that can run in parallel

- **Phase 34 (Layer B movement/era/material columns) can be partially parallelized with Phase 33** if the Drizzle migration work is split by concern: movement/era/material columns on `watches_catalog` do not depend on brand or family FKs. Only the `watch_lineage_edges` table strictly depends on brand entities being seeded (you need Reference rows before you can write edges, but the table schema can be created independently).

- **DEBT-09, SET-13, SET-14, Nyquist** are independent of the catalog hierarchy and can be interleaved at any point after Phase 32. DEBT-09 is a Server Action fix with no schema changes; SET-13 requires no catalog hierarchy; SET-14 is HTML email templates. These can run in parallel with any Layer A/B/C phase as separate plans within a phase.

- **Phase 36 (Layer D provenance) can overlap with Phase 37 (CAT-13 rewire)** if split into separate plans. The `watches` provenance fields (serial, year_of_acquisition, etc.) do not interact with the engine rewire. The `divestments` table similarly. Only the decision "which columns go on watches vs divestments" must be locked before either DAL is written.

### Hard serialization constraints

1. **Phase 32 before all schema work** — audit-first per SEED-004; audit findings may reduce or expand Layer B scope (e.g., if the audit shows lineage browse is low-priority, lineage edges can be deferred to v6.0)
2. **Layer A before Layer B lineage edges** — `watch_lineage_edges` FK to `watches_catalog` is already present, but seeding edges is meaningless without at least some brand/family context in the data
3. **Layer C (clean slate) before CAT-14 SET NOT NULL** — the clean slate ensures 100% of `watches` rows have a `catalog_id` before making it NOT NULL
4. **CAT-14 before or concurrent with CAT-13** — the engine rewire assumes catalog_id is always resolvable; if any watches rows lack catalog_id, the LEFT JOIN fallback must be in place or queries break
5. **CAT-13 engine rewire before audit-driven polish phases that depend on improved verdicts** — if the audit identifies "verdicts on catalog pages are weak because taste attributes aren't used," those polish phases need the rewired engine

### Phase numbering (continuing from Phase 31)

| Phase | Name | Parallelizable? |
|---|---|---|
| 32 | Discovery Audit (read-only) | No — must come first |
| 33 | Layer A: Brand + Family schema | Yes, after 32 |
| 34 | Layer B: Lineage + Movement + Era | Partially (movement/era after 32; lineage edges after 33) |
| 35 | Layer C: Variant split + clean-slate + CAT-14 | After 34 |
| 36 | Layer D: Provenance + Divestments | After 35; parallel with 37 plans |
| 37 | CAT-13 engine rewire | After 35 (needs CAT-14 precondition) |
| 38 | Audit-driven polish wave 1 | After 32 (audit findings); engine-dependent polish after 37 |
| 39 | DEBT-09 + SET-13 + SET-14 + Nyquist | Parallel with any of 33-38 |

---

## Integration Points: Existing Code That Needs to Know About Hierarchy

### Unchanged — no modification required

- `src/lib/similarity.ts` — until CAT-13 phase
- `src/app/api/extract-watch/route.ts` — URL extraction upserts to `watches_catalog` via `upsertCatalogFromExtractedUrl`; adding `brand_id` / `family_id` to `upsertCatalogFromExtractedUrl` is Layer A scope but the upsert shape can remain backwards-compatible with nullable new fields
- `src/data/discovery.ts` — explore rails read `watches_catalog` directly; no hierarchy needed until family/brand browse pages ship
- `tests/static/CollectionFitCard.no-engine.test.ts` — static guard; survives if the engine signature is unchanged (which it is until CAT-13)

### Modified — Layer A

- `src/db/schema.ts` — add `brands`, `watch_families` tables; add `brand_id`, `family_id` FKs to `watchesCatalog`
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` and `upsertCatalogFromExtractedUrl` accept optional `brandId`/`familyId` (nullable; they remain null until admin backfill assigns them)
- `src/lib/types.ts` — extend `CatalogEntry` with `brandId`, `familyId`, `brandName`, `familyName` (denormalized for display)
- `mapRowToCatalogEntry` in `src/data/catalog.ts` — include new fields when present

### Modified — Layer B

- `src/db/schema.ts` — add `watch_lineage_edges` table; extend `watchesCatalog` with `movementCaliber`, `movementType` enum, `era`, `caseMaterial`, `braceletConfig`, `countryOfOrigin`
- New DAL: `src/data/hierarchy.ts` — `getLineageForReference(catalogId)`, `getBrandById(brandId)`, `getFamilyById(familyId)`, `getReferencesForFamily(familyId)`

### Modified — Layer C

- `src/db/schema.ts` — add `watch_variants` table; add `variant_id` FK to `watches`
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` gains variant-awareness (low priority; organic path)

### Modified — Layer D

- `src/db/schema.ts` — add `divestments` table; extend `watches` with `serial`, `yearOfAcquisition`, `condition`, `boxPapers`, `serviceHistory`, `paidCurrency`, `purchaseDate`
- `src/app/actions/watches.ts` — new `divestWatch` Server Action
- `src/app/actions/watches.ts` — `insertWatchSchema` extended with new provenance fields

### Modified — CAT-13

- `src/lib/similarity.ts` — engine rewire (see migration path section above)
- `src/data/watches.ts` — `getWatchesByUser` (or equivalent collection reader) gains LEFT JOIN to `watches_catalog` for taste columns
- `src/lib/types.ts` — `Watch` gains optional `catalogTaste` field

### Data flow change: addWatch → upsertCatalog → upsertFamily

The addWatch → catalog upsert flow in `src/app/actions/watches.ts` currently calls `upsertCatalogFromUserInput` which only writes `(brand, model, reference, source)`. After Layer A:

1. `addWatch` continues to call `upsertCatalogFromUserInput` — no change to the hot path
2. `brand_id` and `family_id` are NOT set during user-promoted catalog upsert — they remain null until admin backfill
3. Admin backfill script (`scripts/backfill-brand-family.ts`) runs separately to assign `brand_id`/`family_id` to existing References, matching on `brand_normalized`

This keeps the hot path (addWatch latency) unchanged and does not require brand/family lookup during the user-facing write path.

---

## Sources

All findings sourced from first-party codebase artifacts:

- `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts` — full schema state
- `/Users/tylerwaneka/Documents/horlo/src/lib/similarity.ts` — byte-locked engine
- `/Users/tylerwaneka/Documents/horlo/src/data/catalog.ts` — DAL surface
- `/Users/tylerwaneka/Documents/horlo/src/data/discovery.ts` — explore rails DAL
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/watches.ts` — mutation surface
- `/Users/tylerwaneka/Documents/horlo/src/app/api/extract-watch/route.ts` — catalog upsert path
- `/Users/tylerwaneka/Documents/horlo/.planning/PROJECT.md` — architecture decisions + requirements
- `/Users/tylerwaneka/Documents/horlo/.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md`
- `/Users/tylerwaneka/Documents/horlo/.planning/seeds/SEED-002-hybrid-recommender.md`
- `/Users/tylerwaneka/Documents/horlo/.planning/seeds/SEED-004-v5-discovery-north-star.md`

---

*Architecture research for: Horlo v5.0 catalog hierarchy + engine rewire integration*
*Researched: 2026-05-06*

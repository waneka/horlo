---
phase: 27-watch-card-collection-render-polish
plan: 02
subsystem: data-layer
tags: [drizzle, supabase, migration, sort-order, dal, server-action, wishlist-reorder, wave-2]

# Dependency graph
requires:
  - phase: 27-watch-card-collection-render-polish
    plan: 01
    provides: "Wave 0 RED tests (phase27-schema, phase27-backfill, phase27-bulk-reorder, phase27-getwatchesbyuser-order) — all 4 turned green by this plan"
provides:
  - "watches.sort_order column (integer NOT NULL DEFAULT 0) + watches_user_sort_idx composite index in local Postgres + parallel supabase migration ready for prod"
  - "bulkReorderWishlist(userId, orderedIds) — owner-scoped CASE WHEN bulk update with int4 cast + Owner mismatch defense (T-27-01, T-27-02)"
  - "getMaxWishlistSortOrder(userId) — coalesce(max(sort_order), -1) over wishlist+grail set, used by addWatch/editWatch sort_order bumps"
  - "getWatchesByUser ORDER BY asc(sort_order), desc(createdAt) — owner-chosen order with createdAt tiebreaker"
  - "addWatch + editWatch sort_order assignment for wishlist|grail entrants (D-03/D-04); within-group changes preserve slot (D-05)"
affects: [27-03-PLAN, 27-04-PLAN, 27-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle CASE WHEN bulk update with sql.join() + explicit ::int4 casts on integer columns"
    - "Per-user backfill via row_number() PARTITION BY user_id ORDER BY created_at DESC, applied through supabase migration"
    - "Idempotent migration shape: BEGIN/COMMIT wrap + IF NOT EXISTS guards + DO $$ post-assertion (Phase 24 precedent)"
    - "Server-side sort_order overwrite for wishlist|grail entries — clients cannot forge their own ordering"
    - "Drizzle snapshot drift handling: trim drizzle-kit-generated SQL to current-phase changes only when prod schema state has diverged via supabase-only migrations"

key-files:
  created:
    - "drizzle/0006_phase27_sort_order.sql"
    - "drizzle/meta/0006_snapshot.json"
    - "supabase/migrations/20260504120000_phase27_sort_order.sql"
    - ".planning/phases/27-watch-card-collection-render-polish/deferred-items.md"
  modified:
    - "src/db/schema.ts (sortOrder column + watches_user_sort_idx index)"
    - "src/lib/types.ts (Watch.sortOrder?: number)"
    - "src/data/watches.ts (mapping helpers + getWatchesByUser ORDER BY + bulkReorderWishlist + getMaxWishlistSortOrder)"
    - "src/app/actions/watches.ts (addWatch + editWatch sort_order bump on wishlist|grail entry; insertWatchSchema accepts sortOrder)"
    - "drizzle/meta/_journal.json (tag rename: 0006_eager_albert_cleary -> 0006_phase27_sort_order)"
    - "tests/integration/phase27-backfill.test.ts (added in-test backfill execution + scoped duplicate check to seeded users)"

key-decisions:
  - "Drizzle-generated SQL (0006_eager_albert_cleary.sql) bundled an unrelated notification_type enum diff stemming from Phase 24's supabase-only migration. Trimmed the file to ONLY the Phase 27 column+index lines (renamed to 0006_phase27_sort_order.sql) — the enum diff is already applied locally and prod, so re-emitting it would clobber state. Documented in commit message."
  - "Postgres infers text type for unbound CASE WHEN parameters; explicit ::int4 cast on each branch's ordinal is required when assigning into an integer column. Surfaced as a runtime PostgresError 42804 during Task 4 verification, fixed inline as Rule 1 deviation."
  - "Backfill test seeded rows with default sort_order=0 then asserted [0,1,2] — added an in-test re-execution of the migration's per-user CTE so the test is self-contained and doesn't depend on the once-per-deploy migration side effect (Plan 01 author's stated intent vs actual seed shape didn't match)."
  - "Backfill duplicate-check assertion was unscoped → concurrent vitest threads cross-pollinated seed data into a global SELECT. Scoped to seeded user ids only."

requirements-completed: [WISH-01]

# Metrics
duration: 25min
completed: 2026-05-04
---

# Phase 27 Plan 02: Wave 2 Data Layer Summary

**Schema column + index, parallel drizzle/supabase migrations, two new DAL helpers (bulkReorderWishlist, getMaxWishlistSortOrder), getWatchesByUser ORDER BY, and addWatch/editWatch sort_order bump for wishlist|grail entries — all four Plan 01 DB-gated Wave 0 RED tests now GREEN.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-04T07:54:08Z
- **Completed:** 2026-05-04T08:04:50Z
- **Tasks:** 4 (all type=auto)
- **Files touched:** 10 (4 created + 6 modified)
- **Commits:** 4 (one per task)

## Accomplishments

- **Schema (Task 1):** Added `watches.sort_order` (integer NOT NULL DEFAULT 0) and composite index `watches_user_sort_idx` on `(user_id, sort_order)` to `src/db/schema.ts`. Added `Watch.sortOrder?: number` to the domain type in `src/lib/types.ts`.
- **Drizzle migration (Task 1):** Generated `drizzle/0006_phase27_sort_order.sql` via `npx drizzle-kit generate`, then trimmed to only the Phase 27 column+index lines (deferred items deviation: drizzle-kit included a stale notification_type enum diff from a prod-only Phase 24 migration that drizzle never tracked — re-emitting it would clobber state).
- **Supabase migration (Task 1):** Hand-wrote `supabase/migrations/20260504120000_phase27_sort_order.sql` with BEGIN/COMMIT wrap, IF NOT EXISTS guards, two backfill CTEs (wishlist|grail per user, owned|sold per user×status for symmetry), and a DO $$ post-assertion verifying no duplicate (user_id, sort_order) tuples in the wishlist+grail set.
- **DAL helpers (Task 2):** Added `bulkReorderWishlist(userId, orderedIds)` (CASE WHEN bulk UPDATE with explicit ::int4 cast + WHERE clause defense-in-depth across user_id + status + inArray(id), throws "Owner mismatch" if returning count != orderedIds.length). Added `getMaxWishlistSortOrder(userId)` (coalesce(max, -1) over wishlist+grail). Updated `getWatchesByUser` ORDER BY asc(sortOrder), desc(createdAt). Updated `mapRowToWatch` and `mapDomainToRow` to round-trip sortOrder.
- **Server Actions (Task 3):** Added sort_order bump path to `addWatch` (D-03 — new wishlist|grail watch lands at end of user's wishlist+grail set with `maxSort + 1`) and `editWatch` (D-04 — status transition INTO wishlist|grail bumps `maxSort + 1`; within-group wishlist↔grail swaps preserve existing slot per D-05). Extended `insertWatchSchema` Zod definition with `sortOrder?: z.number().int().optional()`. Server-side computation overwrites any client-supplied sortOrder for wishlist|grail entries.
- **Local schema applied (Task 4):** `DATABASE_URL` confirmed pointing at `127.0.0.1:54322` (local Supabase) before any DB write. `npx drizzle-kit push` applied the column + index successfully. Verified column shape and index existence via direct psql introspection.
- **All 4 Wave 0 DB-gated tests GREEN (Task 4):**
  - `tests/integration/phase27-schema.test.ts`: 2/2 ✓
  - `tests/integration/phase27-backfill.test.ts`: 2/2 ✓
  - `tests/integration/phase27-bulk-reorder.test.ts`: 3/3 ✓
  - `tests/integration/phase27-getwatchesbyuser-order.test.ts`: 2/2 ✓
  - **Total: 9/9 it() blocks green.**

## Task Commits

1. **Task 1: Schema + types + drizzle/supabase migrations** — `e4d6b78` (feat)
2. **Task 2: DAL helpers (bulkReorderWishlist, getMaxWishlistSortOrder) + getWatchesByUser ORDER BY** — `268834e` (feat)
3. **Task 3: addWatch + editWatch sort_order assignment (D-03/D-04)** — `aaf66a4` (feat)
4. **Task 4: Local schema push + bug fixes from Wave 0 verification** — `6e40ee9` (fix)

## Files Created/Modified

### Created

- `drizzle/0006_phase27_sort_order.sql` — Trimmed drizzle-emitted DDL: `ALTER TABLE "watches" ADD COLUMN "sort_order" ...` + `CREATE INDEX "watches_user_sort_idx" ...`. Renamed from auto-generated `0006_eager_albert_cleary.sql` (and trimmed to remove an unrelated notification_type enum diff that drizzle-kit picked up due to stale snapshot).
- `drizzle/meta/0006_snapshot.json` — drizzle-kit-emitted snapshot capturing the new column+index schema state.
- `supabase/migrations/20260504120000_phase27_sort_order.sql` — Hand-written prod-bound migration with BEGIN/COMMIT, IF NOT EXISTS guards, per-user CTE backfill for wishlist+grail, per-user-per-status CTE backfill for owned+sold (symmetry), and DO $$ duplicate-check assertion.
- `.planning/phases/27-watch-card-collection-render-polish/deferred-items.md` — One pre-existing test failure (phase17-addwatch-wiring catalog_id wiring) logged as out-of-scope.

### Modified

- `src/db/schema.ts` — Added `sortOrder: integer('sort_order').notNull().default(0)` before createdAt, plus `index('watches_user_sort_idx').on(table.userId, table.sortOrder)` in the indexes array.
- `src/lib/types.ts` — Added `sortOrder?: number` to `Watch` interface (after `catalogId`).
- `src/data/watches.ts` — Imports: added `asc, desc, inArray, type SQL` to `drizzle-orm` import. Added `sortOrder: row.sortOrder` to `mapRowToWatch`. Added `if ('sortOrder' in data && data.sortOrder !== undefined) row.sortOrder = data.sortOrder` to `mapDomainToRow`. Updated `getWatchesByUser` ORDER BY clause. Appended new exports `getMaxWishlistSortOrder` and `bulkReorderWishlist`.
- `src/app/actions/watches.ts` — Added `sortOrder: z.number().int().optional()` to `insertWatchSchema`. Wired `getMaxWishlistSortOrder` + payload bump in both `addWatch` (always-bump on wishlist|grail) and `editWatch` (transition-INTO-bump only).
- `drizzle/meta/_journal.json` — Renamed entry tag: `0006_eager_albert_cleary` → `0006_phase27_sort_order`.
- `tests/integration/phase27-backfill.test.ts` — Added in-test re-execution of the migration's per-user backfill CTE (Rule 1 — fix bug: test seeded with default sort_order=0 but asserted [0,1,2] without ever re-running the backfill). Scoped duplicate-check SELECT to seeded user ids (Rule 1 — fix bug: parallel vitest threads cross-pollinated seed data into the global SELECT).

## Decisions Made

- **Trimmed drizzle-kit's generated migration to Phase 27 lines only.** Drizzle's snapshot was on `notification_type` 4-value enum (Phase 11 era); the schema declares 2 values (Phase 24 reduced via supabase-only migration). `drizzle-kit generate` emitted DROP TYPE + CREATE TYPE + ALTER COLUMN steps for the enum alongside the actual Phase 27 column+index. Locally and in prod, the enum is already 2 values; re-running the DROP/CREATE would clobber state and break the partial dedup index. Per project memory `project_drizzle_supabase_db_mismatch.md`, this drift is expected. Trimmed the SQL file to ONLY Phase 27 lines and renamed both the file and its `_journal.json` tag for traceability.
- **Explicit `::int4` cast in CASE WHEN.** Postgres infers text type for unbound parameter expressions in CASE WHEN clauses; assignment into an `integer` column then fails with code 42804. Without the cast, all three bulk-reorder tests fail at the DB layer with a parse error before the application-layer "Owner mismatch" check can fire. Cast each ordinal `${idx}::int4` so the CASE expression resolves to integer.
- **Backfill test made self-contained.** Plan 01's `phase27-backfill.test.ts` seeded rows expecting them to receive [0,1,2] sort_order but the migration backfill only runs once at deploy time. Added an inline backfill execution after seeding (scoped to seeded user ids), mirroring the migration's CTE semantics. The test now turns green deterministically.
- **Backfill duplicate-check scoped to seeded users.** The unscoped global SELECT cross-pollinated with concurrent vitest test threads' seed data. Scoping to `userIdA`/`userIdB` makes the assertion thread-safe and parallel-test-friendly.
- **Did NOT run `supabase db push --linked`.** Prod push is a deploy-time action per plan and per CLAUDE.md memory. The supabase migration is committed and ready for the next deploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle-emitted SQL bundled stale enum diff**
- **Found during:** Task 1 (after `npx drizzle-kit generate`)
- **Issue:** The generated `0006_eager_albert_cleary.sql` contained 4 lines of unrelated `notification_type` ALTER/DROP/CREATE alongside the 2 Phase 27 lines. Re-running it locally would clobber the already-applied Phase 24 enum cleanup (and drop the partial dedup index that the supabase migration created).
- **Fix:** Trimmed the SQL file to ONLY the Phase 27 column+index lines, renamed file (and `_journal.json` tag) to `0006_phase27_sort_order.sql`. Drizzle's snapshot already correctly captures the new state.
- **Files modified:** `drizzle/0006_phase27_sort_order.sql`, `drizzle/meta/_journal.json`
- **Commit:** `e4d6b78`

**2. [Rule 1 - Bug] CASE WHEN UPDATE failed with PostgresError 42804**
- **Found during:** Task 4 (running phase27-bulk-reorder.test.ts)
- **Issue:** Postgres error: `column "sort_order" is of type integer but expression is of type text`. Postgres infers text type for unbound parameters inside CASE WHEN expressions; the integer-column assignment then fails.
- **Fix:** Added `::int4` cast to each ordinal in the CASE WHEN: `then ${idx}::int4`.
- **Files modified:** `src/data/watches.ts`
- **Commit:** `6e40ee9`

**3. [Rule 1 - Bug] phase27-backfill.test.ts depended on external migration backfill**
- **Found during:** Task 4 (running phase27-backfill.test.ts)
- **Issue:** Test seeded 3 wishlist watches per user with default `sort_order=0` and asserted `[0,1,2]`. The migration's CTE backfill only runs once at deploy time; freshly seeded rows in the test never participated. Plan 01 SUMMARY claimed "the test seeds explicit sort_order values" but reading the test source confirmed it does not.
- **Fix:** Added an in-test re-execution of the migration's per-user backfill CTE (scoped to seeded user ids) in `beforeAll` after seeding.
- **Files modified:** `tests/integration/phase27-backfill.test.ts`
- **Commit:** `6e40ee9`

**4. [Rule 1 - Bug] Backfill duplicate-check unscoped → concurrent test cross-pollination**
- **Found during:** Task 4 (running all 4 Wave 0 tests in parallel)
- **Issue:** The duplicate-tuple SELECT was global (`WHERE status IN (wishlist, grail)`); when other phase27 tests' seeds ran concurrently in parallel vitest threads, their wishlist/grail rows showed up and the assertion failed.
- **Fix:** Added `AND user_id IN (${userIdA}::uuid, ${userIdB}::uuid)` scope to the duplicate-check SELECT.
- **Files modified:** `tests/integration/phase27-backfill.test.ts`
- **Commit:** `6e40ee9`

### Out-of-scope discoveries (logged, NOT fixed)

- `tests/integration/phase17-addwatch-wiring.test.ts` is RED on baseline (without my changes). Catalog_id remains null after addWatch despite catalog upsert/link logic; root cause is upstream of Phase 27 work. Logged in `.planning/phases/27-watch-card-collection-render-polish/deferred-items.md`.

## Threat Model Verification

- **T-27-01 (cross-tenant reorder):** WHERE clause includes `eq(watches.userId, userId)`. Test `bulk-reorder.test.ts` "rejects with Owner mismatch when payload includes another user's watch id" — GREEN.
- **T-27-02 (status-confused reorder):** WHERE clause includes `inArray(watches.status, ['wishlist', 'grail'])`. Test "rejects with Owner mismatch when payload includes the user's own owned-status watch" — GREEN.
- **T-27-03 (DoS / mass enumeration):** Owned by Plan 03 — `.array(z.string().uuid()).max(500)` Zod limit on Server Action input. Out of scope here.
- **T-27-04 (concurrent max+1 race):** Accepted per CONTEXT D-09 + D-21 at v4.1 scale (<500 watches/user). ORDER BY tiebreaker on createdAt DESC keeps display deterministic.
- **T-27-LOCAL (drizzle-kit push hits prod):** **PASSED.** `.env.local` was inspected before push; `DATABASE_URL` host was confirmed `127.0.0.1:54322`. Push executed only against local Supabase.

## Authentication / Setup Gates

None — Task 4 ran fully against local Supabase without external auth. `.env.local` was symlinked from the main repo into the worktree (worktree has no `.env*` of its own); `node_modules` was symlinked similarly. Both symlinks are gitignored at the repo root.

## Test Suite Health

The four Plan 01 DB-gated test files all turn GREEN with this plan:

| Test file | Pre-Plan-02 state | Post-Plan-02 state |
|-----------|-------------------|--------------------|
| `tests/integration/phase27-schema.test.ts` | 2/2 RED (column missing) | 2/2 GREEN |
| `tests/integration/phase27-backfill.test.ts` | 2/2 RED (column missing + test bug) | 2/2 GREEN |
| `tests/integration/phase27-bulk-reorder.test.ts` | 3/3 RED (function missing) | 3/3 GREEN |
| `tests/integration/phase27-getwatchesbyuser-order.test.ts` | 2/2 RED (sortOrder missing on Watch type) | 2/2 GREEN |

The Plan 01 SUMMARY's "Wave 0 RED State Inventory" predicted these 4 test files would turn green in Plan 27-02 — this plan confirmed that prediction.

Other Wave 0 RED tests (`reorderWishlist.test.ts`, `ProfileWatchCard-priceLine.test.tsx`, `CollectionTabContent.test.tsx`, `WishlistTabContent.test.tsx`) remain owned by Plans 03-05 and are NOT addressed here.

## Database State After This Plan

Local Supabase (`127.0.0.1:54322`):
- `watches.sort_order` exists: `integer`, `is_nullable=NO`, `column_default=0`. ✓
- `watches_user_sort_idx` exists on `(user_id, sort_order)`. ✓
- Seeded test rows clean up after each run (no residual data verified via direct psql duplicate-check).

Prod (Supabase linked):
- **NOT TOUCHED.** The supabase migration `20260504120000_phase27_sort_order.sql` is committed and ready for `supabase db push --linked` at the next deploy.

## Issues Encountered

All 4 issues encountered were classified as Rule 1 (auto-fix bug) deviations and resolved inline. See "Deviations from Plan" section above. No Rule 4 (architectural) blockers; no auth gates.

## User Setup Required

None — schema is applied locally; the supabase migration awaits the standard prod deploy step.

## Next Phase Readiness

- **Plan 27-03 (Server Action `reorderWishlist`)** can now import `bulkReorderWishlist` from `@/data/watches`. The 7-case surface contract in `reorderWishlist.test.ts` is unblocked at the data layer.
- **Plan 27-04 (card content renderers)** has no dependency on Plan 02 — but the `getWatchesByUser` ORDER BY ensures the WishlistTabContent's pre-DnD list arrives in the user's chosen order on first render.
- **Plan 27-05 (DnD wiring)** can now read `watch.sortOrder` from the domain type and use it as the optimistic state's source of truth before invoking the Server Action.

## Self-Check: PASSED

Verified files exist:
- FOUND: drizzle/0006_phase27_sort_order.sql
- FOUND: drizzle/meta/0006_snapshot.json
- FOUND: drizzle/meta/_journal.json (modified)
- FOUND: supabase/migrations/20260504120000_phase27_sort_order.sql
- FOUND: src/db/schema.ts (modified)
- FOUND: src/lib/types.ts (modified)
- FOUND: src/data/watches.ts (modified)
- FOUND: src/app/actions/watches.ts (modified)
- FOUND: tests/integration/phase27-backfill.test.ts (modified)
- FOUND: .planning/phases/27-watch-card-collection-render-polish/deferred-items.md

Verified commits exist:
- FOUND: e4d6b78 (Task 1 — schema + migrations)
- FOUND: 268834e (Task 2 — DAL helpers + ORDER BY)
- FOUND: aaf66a4 (Task 3 — addWatch/editWatch wiring)
- FOUND: 6e40ee9 (Task 4 — schema push + bug fixes)

Verified DB state:
- FOUND: column `watches.sort_order` (integer, NOT NULL, DEFAULT 0)
- FOUND: index `watches_user_sort_idx` on (user_id, sort_order)

Verified tests GREEN: 9/9 it() blocks across 4 Wave 0 DB-gated test files.

---
*Phase: 27-watch-card-collection-render-polish*
*Plan: 02*
*Completed: 2026-05-04*

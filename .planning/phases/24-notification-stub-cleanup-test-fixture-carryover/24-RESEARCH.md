# Phase 24: Notification Stub Cleanup + Test Fixture & Carryover — Research

**Researched:** 2026-05-01
**Domain:** Postgres ENUM evolution (rename + recreate) · Drizzle schema sequencing · Vitest coverage carryover · runtime test-fixture migration
**Confidence:** HIGH (every load-bearing claim verified by reading the file referenced; nothing relies on training-data hypothesis)

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Pre-Flight Assertion (Defense-in-depth):** Both a standalone pre-migration script AND an embedded SQL `DO $$ … RAISE EXCEPTION` block at the top of the rename+recreate migration.

- **Standalone script:** `scripts/preflight-notification-types.ts` (invokable via `npm run db:preflight-notification-cleanup`) connects to the configured `DATABASE_URL`, runs `SELECT count(*) FROM notifications WHERE type IN ('price_drop','trending_collector')`, and exits non-zero if the count is non-zero. Run in CI before deploying the migration.
- **In-migration assertion:** A `DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM notifications WHERE type IN ('price_drop','trending_collector'); IF n > 0 THEN RAISE EXCEPTION 'preflight failed: % stub rows present', n; END IF; END $$;` block as the first statement in the migration SQL.
- **Why both:** The script catches the condition at deploy-prep time when remediation is cheap. The in-migration assertion is the last line of defense. Mirrors Phase 11/13 (D-09/D-25) two-layer defense posture.

**D-02 — TEST-04/05/06 Coverage Depth: Standard representative coverage** — every public behavior with happy path + 1-2 representative edge cases per behavior. Not minimum-viable smoke; not exhaustive table-driven.

**D-03 — Type-Union Narrowing: Aggressively narrow `NotificationRowData['type']` to `'follow' | 'watch_overlap'` and let TypeScript errors guide deletion.** Applies to `src/lib/notifications/types.ts`, `src/components/notifications/NotificationRow.tsx` (line 21), `src/data/notifications.ts` (line 16), and `src/db/schema.ts` (lines 32-37 — AFTER prod migration applies).

**D-04 — wornPublic Regression-Lock Tests: Rewrite as `wear_visibility` positive-assertion tests.** Convert each negative assertion to a positive assertion against the v3.0 architecture. Per-test rewrite vs. deletion is planner discretion — the rule is "every wornPublic test file ends with positive `wear_visibility` assertions or no assertion at all (dead test removed)."

**D-05 — Migration + Code Sequencing: Single phase branch, ordered commits.** (1) preflight script → (2) migration SQL → (3) prod apply via `supabase db push --linked` → (4) Drizzle pgEnum update → (5) aggressive narrowing + render-branch deletion → (6) wornPublic test rewrites → (7) TEST-04/05/06.

### Claude's Discretion

- D-01..D-04 are user-delegated gray areas; decisions captured above with full rationale. Planner may further refine per-test specifics within D-02 and D-04 without re-asking.
- Exact migration filename timestamp and rename+recreate SQL syntax — researcher fills in (this document).
- Whether `scripts/preflight-notification-types.ts` uses Drizzle's `db` connection or raw `pg` — planner's call (recommended: Drizzle `db`, consistent with `scripts/backfill-catalog.ts` and `scripts/refresh-counts.ts`).

### Deferred Ideas (OUT OF SCOPE)

None raised in discussion. All four gray areas were delegated to Claude's Discretion without scope-creep prompts.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-03 | Pre-flight assertion confirms zero rows reference `price_drop` or `trending_collector` in `notifications.type` before migration | §"Pre-Flight Architecture (DEBT-03)"; §"Code Examples → Standalone Preflight Script" |
| DEBT-04 | `notification_type` enum recreated without dead values via rename + recreate pattern | §"Canonical Rename + Recreate Migration (DEBT-04)"; §"Code Examples → Migration SQL" |
| DEBT-05 | Drizzle `pgEnum` updated AFTER prod migration; render branches and stub UI deleted | §"Aggressive Type-Narrowing Impact Map (DEBT-05)"; §"Common Pitfalls → 1, 2" |
| DEBT-06 | Test fixture cleanup — files referencing `wornPublic` updated to `wear_visibility` enum | §"Per-File `wornPublic` Rewrite Plan (DEBT-06)"; §"Empirical Reconciliation: 4 files, not 9" |
| TEST-04 | Zustand `watchStore` filter reducer unit tests with `beforeEach` reset | §"TEST-04 Implementation Specifics" |
| TEST-05 | POST `/api/extract-watch` integration coverage | §"TEST-05 Implementation Specifics" |
| TEST-06 | `WatchForm` / `FilterBar` / `WatchCard` component tests | §"TEST-06 Implementation Specifics" |

---

## Summary

Phase 24 is a mechanical cleanup phase, not a redesign. Three orthogonal workstreams ship on a single branch with strict commit order (D-05). The Postgres ENUM rename+recreate is the only destructive operation; everything else is additive (new tests) or deletion guided by TypeScript errors (narrowing). The DEBT cleanup is bounded: empirically only **4 files** reference `wornPublic` (roadmap text claimed 9 — verified by grep). Three test suites have been deferred since v1.0 (TEST-04/05/06) and finally land here.

**Primary recommendations:**

1. **Migration filename:** `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (today's UTC date, `000000` suffix matches sibling-pattern). One migration file holds both the in-migration preflight `DO $$` block and the four-step rename+recreate.
2. **Preflight script:** `scripts/preflight-notification-types.ts` follows `scripts/refresh-counts.ts` shape (Drizzle `db` import, `tsx --env-file=.env.local` invocation, `process.exit(1)` on assertion failure).
3. **Aggressive narrowing order** (per D-03 + D-05): SQL prod apply → Drizzle pgEnum narrows → TypeScript compile fails everywhere `'price_drop'`/`'trending_collector'` appears → fix sites using compiler errors as the deletion oracle. Manual grep is **not** sufficient — see §"Common Pitfalls → Pitfall 3" for why.
4. **`wornPublic` rewrite triage:** 4 files, three classes of change. Two files (`getFeedForUser.test.ts`, `getWearRailForViewer.test.ts`) need negative→positive assertion rewrites; one file (`phase12-visibility-matrix.test.ts`) has a one-shot WYWT-11 anchor that should be deleted (column-drop migration cannot regress); one file (`home-privacy.test.ts`) needs fixture data-shape migration only (logic stays).
5. **TEST-04/05/06 patterns:** All three suites already have prior-art in the test tree. TEST-04 follows `tests/components/notifications/NotificationRow.test.tsx` `beforeEach(vi.clearAllMocks)` shape, with Zustand v5 `useWatchStore.setState(initial, true)` for reset. TEST-05 augments `tests/api/extract-watch-auth.test.ts` (auth gate) with happy-path + 4 error categories using the same `vi.mock('@/lib/extractors')` pattern. TEST-06 augments `tests/components/watch/WatchForm.isChronometer.test.tsx` (which is the canonical pattern with PointerEvent polyfill, Server Action mocks, and Browser Supabase mocks).

---

## Project Constraints (from CLAUDE.md)

- **Tech stack lock:** Next.js 16 App Router — continue with existing framework, no rewrites. **CRITICAL:** AGENTS.md says "This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data." [VERIFIED: AGENTS.md] For TEST-05 (route handler test), use the existing `tests/api/extract-watch-auth.test.ts` pattern (`new NextRequest(...)`, `await POST(req)`, `res.json()`) — do NOT introduce app-router test utilities Claude may "remember" from earlier Next.js versions.
- **Data model:** Watch and UserPreferences types are established — extend, don't break. [VERIFIED: CLAUDE.md]
- **GSD Workflow Enforcement:** "Before using Edit, Write, or other file-changing tools, start work through a GSD command." [VERIFIED: CLAUDE.md]
- **No barrel files; absolute imports via `@/*`.** [VERIFIED: CLAUDE.md "Conventions" section + grep of imports]
- **Test framework:** Vitest 2.1.9. **Strict mode TS.** Path alias `@/*` works in tests via `vitest.config.ts` resolve.alias. [VERIFIED: package.json + vitest.config.ts]

---

## Empirical Reconciliation: 4 files, not 9

**Roadmap claim:** "the 9 test files that reference the removed `wornPublic` column are updated"
**Verified by grep:** Only **4** test files actually reference `wornPublic` or `worn_public` in the current tree. [VERIFIED: `grep -rln 'wornPublic\|worn_public' tests/`]

| # | File | wornPublic occurrences | Class of change |
|---|------|------------------------|-----------------|
| 1 | `tests/integration/phase12-visibility-matrix.test.ts` | 4 (3 in comments, 1 in `WYWT-11: profile_settings.worn_public column dropped` test) | Delete one-shot WYWT-11 anchor; rewrite remaining comments |
| 2 | `tests/integration/home-privacy.test.ts` | 7 (all in `wornPublic: true` fixture seeds at lines 100–107) | Fixture data-shape migration only — logic stays |
| 3 | `tests/data/getFeedForUser.test.ts` | 3 (in test names + assertions: `Phase 12: where clause contains no reference to wornPublic`, `select projection contains no wornPublic field`, etc.) | Negative→positive assertion rewrite |
| 4 | `tests/data/getWearRailForViewer.test.ts` | 7 (in test names, fixture properties, AND `_wornPublic` parameter at line 363) | Negative→positive assertion rewrite + remove `_wornPublic` parameter |

**Source files referencing `wornPublic` are documentary comments only** — no runtime references exist. [VERIFIED: `grep -n 'wornPublic\|worn_public' src/app/watch/[id]/page.tsx src/data/wearEvents.ts` returns 3 matches, all in `//` or `/*` blocks]

**Recommendation for ROADMAP drift:** When phase ships, update `.planning/ROADMAP.md` Phase 24 §Success Criteria #4 from "9 test files" to "4 test files" with a footnote that the original count counted reference-sites, not files. [ASSUMED — CONTEXT.md author flagged this as documentation drift; no action other than the planner including a doc-update task in 24-NN-PLAN.md].

**Migration files (`supabase/migrations/*.sql`) referencing `worn_public` are ALL pre-Phase-12 historical migrations and the Phase 12 DROP itself** — they are the migration record and MUST NOT be modified. [VERIFIED: 5 SQL files match grep, all dated 2026-04-19 through 2026-04-24, all are append-only history.]

---

## Standard Stack

### Core (already in repo — no installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | `^2.1.9` | Test runner + assertion + mocking | [VERIFIED: package.json devDependencies] Existing standard for all tests in `tests/**` |
| `@testing-library/react` | `^16.3.2` | Component rendering + queries | [VERIFIED: package.json] Used in every existing component test (e.g., `WatchForm.isChronometer.test.tsx`) |
| `@testing-library/user-event` | `^14.6.1` | User-interaction simulation | [VERIFIED: package.json] Used by existing WatchForm tests for click/type |
| `@testing-library/jest-dom` | `^6.9.1` | `toBeInTheDocument`, `toBeChecked`, etc. | [VERIFIED: tests/setup.ts imports `@testing-library/jest-dom/vitest`] |
| `jsdom` | `^25.0.1` | DOM environment for component tests | [VERIFIED: vitest.config.ts `environment: 'jsdom'`] |
| `next` | `16.2.3` | `NextRequest` for API route tests | [VERIFIED: package.json] AGENTS.md flags this version as having breaking changes from training data |
| `drizzle-orm` | `^0.45.2` | Schema definition + query builder | [VERIFIED: package.json] `pgEnum` is the API for the enum narrowing in step 4 of D-05 |
| `postgres` | `^3.4.9` | Underlying Postgres driver (used via Drizzle `db.execute(sql\`...\`)`) | [VERIFIED: package.json] Used in `src/data/notifications.ts:84-93` for raw SQL fallbacks |
| `zustand` | `^5.0.12` | State store for `watchStore` | [VERIFIED: package.json] Phase 24 TEST-04 target |

### Supporting (already used in codebase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | (transitive via dev) | Running TypeScript scripts under Node | [VERIFIED: package.json `scripts.db:backfill-catalog`] Use for `scripts/preflight-notification-types.ts` invocation |
| `msw` | `^2.13.2` | HTTP request mocking | [VERIFIED: package.json devDependencies] **Available but NOT REQUIRED** — `vi.mock('@/lib/extractors')` is the simpler in-repo pattern (see `tests/api/extract-watch-auth.test.ts`). Recommend NOT introducing MSW for TEST-05; keep with `vi.mock`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vi.mock` for outbound fetch in TEST-05 | MSW request handlers | MSW is lower-level (intercepts the network) and lets you test `fetchAndExtract` integration too. **Reject** for v3.0 / v4.0 phases — `tests/api/extract-watch-auth.test.ts` mocks at the `@/lib/extractors` level (one layer up from fetch). Stay consistent. |
| Drizzle `db` client in preflight script | Raw `pg.Client` | Either works. Drizzle is consistent with `scripts/backfill-catalog.ts` (`import { db } from '../src/db'`) and `scripts/refresh-counts.ts`. **Use Drizzle.** [VERIFIED via reading both scripts] |
| Atomic preflight inside the migration only (skip standalone script) | Just the in-migration `DO $$` block | Simpler but loses the CI-time gate. CONTEXT.md D-01 explicitly locks defense-in-depth — researcher MUST NOT recommend collapsing to one layer. |

**Installation:** None required — every dependency already present.

**Version verification:**
```bash
# All versions confirmed via reading package.json on 2026-05-01.
# No npm view calls needed; lockfile pins these versions.
```

---

## Architecture Patterns

### Recommended Project Structure (post-Phase-24)

```
scripts/
├── preflight-notification-types.ts    # NEW (D-01 standalone script)
├── backfill-catalog.ts                 # existing (precedent)
├── refresh-counts.ts                   # existing (precedent — closer match in shape)
├── backfill-taste.ts                   # existing
└── reenrich-taste.ts                   # existing

supabase/migrations/
├── 20260423000002_phase11_notifications.sql           # existing — original 4-value enum creation
├── 20260423000047_phase11_backfill_coverage_assertion.sql  # existing — DO $$ RAISE EXCEPTION precedent
├── 20260424000001_phase12_drop_worn_public.sql        # existing — Phase 12 column-drop precedent
└── 20260501000000_phase24_notification_enum_cleanup.sql  # NEW (DEBT-04 migration)

src/
├── db/schema.ts                                       # MODIFY (D-05 step 4 — narrow pgEnum AFTER prod migration)
├── lib/notifications/types.ts                         # MODIFY (D-03 — narrow NotificationPayload union)
├── data/notifications.ts                              # MODIFY (D-03 — narrow NotificationRow.type)
└── components/notifications/
    ├── NotificationRow.tsx                            # MODIFY (D-03 — delete render branches + isStubType)
    └── NotificationsInbox.tsx                         # MODIFY (D-03 — update line 71 comment)

tests/
├── store/watchStore.test.ts                           # NEW (TEST-04)
├── api/extract-watch.test.ts                          # NEW (TEST-05) — co-located with extract-watch-auth.test.ts
├── components/watch/
│   ├── WatchForm.test.tsx                             # AUGMENT (TEST-06 — file already exists from Phase 19.1)
│   └── WatchCard.test.tsx                             # NEW (TEST-06)
├── components/filters/
│   └── FilterBar.test.tsx                             # NEW (TEST-06)
├── components/notifications/
│   └── NotificationRow.test.tsx                       # MODIFY (delete `describe('price_drop type')`, `describe('trending_collector type')`, the stub-click test at line 327)
├── data/
│   ├── getFeedForUser.test.ts                         # MODIFY (D-04 rewrite)
│   └── getWearRailForViewer.test.ts                   # MODIFY (D-04 rewrite + drop _wornPublic param)
└── integration/
    ├── home-privacy.test.ts                           # MODIFY (D-04 fixture migration)
    └── phase12-visibility-matrix.test.ts              # MODIFY (D-04 — delete WYWT-11 anchor; clean comments)
```

### Pattern 1: Postgres ENUM Rename + Recreate

**What:** Postgres has no `ALTER TYPE … DROP VALUE`. The canonical workaround is rename → create new → cast column → drop old. Runs in a single transaction so partial failure rolls back.

**When to use:** Any time you need to remove or reorder enum values (in this phase: drop `'price_drop'`, `'trending_collector'`).

**Why a single migration file (and not split):** The four steps depend on each other; if you split them into multiple migrations and one fails mid-sequence, the DB lands in a half-baked state where neither old nor new enum is fully present. One transaction = one atomic outcome.

**Example:**
```sql
-- Source: PROJECT.md Key Decisions ("ENUM cleanup uses rename + recreate") + CONTEXT.md <code_context> "Established Patterns"
-- Sibling reference: 20260424000001_phase12_drop_worn_public.sql (Phase 12 column-drop)
-- Assertion syntax reference: 20260423000047_phase11_backfill_coverage_assertion.sql (DO $$ RAISE EXCEPTION)

BEGIN;

-- D-01 in-migration assertion (last line of defense; standalone script is the first).
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM notifications
   WHERE type IN ('price_drop','trending_collector');
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase 24 preflight failed: % notification rows still reference price_drop or trending_collector. Delete those rows OR pause this migration.', n;
  END IF;
END $$;

-- Step 1: rename old type
ALTER TYPE notification_type RENAME TO notification_type_old;

-- Step 2: create new type with only the live values
CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap');

-- Step 3: cast the column from old to new (USING text bridge — Postgres can't auto-cast between enums)
ALTER TABLE notifications
  ALTER COLUMN type TYPE notification_type
  USING type::text::notification_type;

-- Step 4: drop the old type
DROP TYPE notification_type_old;

COMMIT;
```

### Pattern 2: Defense-in-Depth Preflight (D-01)

**Two layers, two purposes:**

| Layer | Where it runs | What it catches |
|-------|---------------|-----------------|
| 1. Standalone script (`scripts/preflight-notification-types.ts`) | CI / deploy-prep | Stub rows discovered before deploy → fix is cheap (delete rows, re-run) |
| 2. In-migration `DO $$ … RAISE EXCEPTION` | Inside the prod transaction | Stub rows that landed AFTER the script ran but BEFORE the migration → migration aborts cleanly, no half-cast state |

**Why both:** Phase 11 D-09/D-25 and Phase 13 D-09 establish the project's "two-layer defense" posture. Migration cleanup gets the same treatment.

### Pattern 3: Drizzle pgEnum Trails Prod SQL (D-05 step 4)

**Sequence (verbatim from D-05):**

1. Land preflight script (no DB coupling)
2. Land migration SQL file (commits to repo; not yet applied to prod)
3. **`supabase db push --linked` to apply migration to prod** — this is the deploy step, **not autonomous** (requires user-supervised credentials per `~/.claude/projects/.../memory/project_drizzle_supabase_db_mismatch.md`)
4. Update `src/db/schema.ts` `notificationTypeEnum` to `['follow', 'watch_overlap']` only. Drizzle types now match prod.
5. Aggressively narrow `NotificationRowData['type']`, etc. Compile errors light up — fix them.
6. Update wornPublic test fixtures.
7. Land TEST-04, TEST-05, TEST-06 in their own commits.

**Why:** If step 4 leads step 3 (Drizzle changes ship before SQL applies in prod), Drizzle would refuse to insert `'price_drop'` rows in dev (which is fine — none exist), but production code expecting the old enum would still try to insert them via `logNotification`-like paths if any existed. Since no v3.0 write-path inserts these stubs (verified — see §"Threat Model"), the failure mode is theoretical. Still, project precedent (Phase 11 D-09) is "schema follows prod, never leads."

### Anti-Patterns to Avoid

- **`ALTER TYPE … DROP VALUE`:** Does not exist in Postgres. Project Key Decision (PROJECT.md) explicitly forbids attempting this.
- **`drizzle-kit push` against prod:** Forbidden by `project_drizzle_supabase_db_mismatch.md` memory ("drizzle-kit push is LOCAL ONLY"). Prod migrations go through `supabase db push --linked` only.
- **Splitting the rename+recreate into multiple migration files:** A failure between steps would leave the DB in a half-cast state that would be surgical to recover from.
- **Relying on `grep` alone to find all `price_drop` / `trending_collector` references for narrowing:** Misses string-typed paths. The TS compiler is the deletion oracle (D-03 rationale). See Pitfall 3.
- **Touching the historical migration files** (`20260423000002_phase11_notifications.sql`, etc.) to rewrite their enum definition: migrations are append-only history. Add a NEW migration to evolve the enum.
- **Breaking the `notifications.type` `NOT NULL` constraint** during the cast: the `USING type::text::notification_type` expression must produce a non-null result for every row. The preflight guarantees zero stub rows; remaining rows are `'follow'` or `'watch_overlap'` which cast cleanly.

---

## Pre-Flight Architecture (DEBT-03)

### Standalone Script File Shape

Verified by reading `scripts/refresh-counts.ts` (closest sibling — single-DB-call exit-code pattern):

```ts
// scripts/preflight-notification-types.ts
// Phase 24 — DEBT-03 D-01 standalone preflight gate.
// Usage: npm run db:preflight-notification-cleanup
//
// Exits 0 with "OK" message if zero stub rows present.
// Exits 1 with row count + sample on stub rows present.
// Run in CI before `supabase db push --linked` for the rename+recreate migration.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'

async function main() {
  const result = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c
      FROM notifications
     WHERE type IN ('price_drop', 'trending_collector')
  `)
  const count = (result as unknown as Array<{ c: number }>)[0]?.c ?? 0

  if (count !== 0) {
    console.error(`[preflight] FAILED — ${count} notifications reference price_drop or trending_collector.`)
    console.error('[preflight] Delete those rows or pause this migration:')
    console.error(`[preflight]   DELETE FROM notifications WHERE type IN ('price_drop','trending_collector');`)
    process.exit(1)
  }

  console.log('[preflight] OK — zero stub-type notifications. Safe to apply migration.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[preflight] fatal:', err)
  process.exit(1)
})
```

**Key shape decisions** (all verified against `scripts/refresh-counts.ts` and `scripts/backfill-catalog.ts`):

- Relative import from `'../src/db'` — tsx does not resolve `@/*` aliases [VERIFIED: backfill-catalog.ts:14 comment]
- Service-role `DATABASE_URL` consumed via the existing `db` client; no separate `pg.Client`
- `--env-file=.env.local` flag passed by package.json `scripts` entry; no `dotenv` package needed
- `process.exit(0)` / `process.exit(1)` — explicit exit codes; postgres.js keeps the pool alive otherwise
- Console output prefix `[preflight]` matches `[backfill]` and `[refresh-counts]` precedents

**package.json addition:**
```json
"db:preflight-notification-cleanup": "tsx --env-file=.env.local scripts/preflight-notification-types.ts"
```

### In-Migration `DO $$` Block

Direct copy-paste of the Phase 11 backfill assertion syntax (`supabase/migrations/20260423000047_phase11_backfill_coverage_assertion.sql`), adapted for the stub-row count:

```sql
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM notifications
   WHERE type IN ('price_drop','trending_collector');
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase 24 preflight failed: % stub-type rows present. Run scripts/preflight-notification-types.ts before retrying.', n;
  END IF;
END $$;
```

Position: First statement inside `BEGIN;`, before `ALTER TYPE`. If the assertion fails, the entire migration rolls back atomically.

---

## Canonical Rename + Recreate Migration (DEBT-04)

**Filename:** `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql`

Format inferred from sibling files:
- 8-digit date (`20260501`) — today's UTC date when planner generates [VERIFIED: latest existing file is `20260430000001_phase19_1_catalog_source_photos_bucket.sql`]
- 6-digit sequence (`000000`) — first migration that day
- Phase tag (`phase24_`) — sibling pattern
- Descriptive slug (`notification_enum_cleanup`) — one-line summary of intent

**Full SQL (paste-ready):**

```sql
-- Phase 24 Migration: notification_type ENUM cleanup (DEBT-03 + DEBT-04).
-- Removes the never-written 'price_drop' and 'trending_collector' values from the
-- notification_type enum. v3.0 defined them upfront (see 20260423000002_phase11_notifications.sql)
-- under the assumption a future phase would wire a write-path; that decision is reversed in v4.0.
--
-- Pattern: rename + recreate. Postgres has no `ALTER TYPE ... DROP VALUE`.
-- Reference: PROJECT.md Key Decisions ("ENUM cleanup uses rename + recreate")
--
-- Pre-flight (D-01 in-migration layer): the DO $$ block aborts the migration if any
-- notifications.type row still references the dead values. The standalone preflight
-- script `scripts/preflight-notification-types.ts` (npm run db:preflight-notification-cleanup)
-- is the first layer; this is the second.
--
-- Sequencing (D-05): apply this migration to prod via `supabase db push --linked` BEFORE
-- updating the Drizzle pgEnum in src/db/schema.ts. Drizzle's narrower enum would otherwise
-- reject the wider prod reality during dev.

BEGIN;

-- =========================================================================
-- LAYER 2 PREFLIGHT — D-01 in-migration assertion.
-- =========================================================================
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM notifications
   WHERE type IN ('price_drop','trending_collector');
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase 24 preflight failed: % stub-type rows present. Run scripts/preflight-notification-types.ts before retrying.', n;
  END IF;
END $$;

-- =========================================================================
-- ENUM RENAME + RECREATE — atomic with the assertion above.
-- =========================================================================

-- 1. Rename the existing type out of the way.
ALTER TYPE notification_type RENAME TO notification_type_old;

-- 2. Create the new type with only the live values.
CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap');

-- 3. Cast the column. The text bridge is required — Postgres cannot directly cast
--    between two distinct enum types. notifications.type is NOT NULL (per Phase 11
--    migration); the preflight guarantees every remaining row is 'follow' or
--    'watch_overlap', which cast cleanly.
ALTER TABLE notifications
  ALTER COLUMN type TYPE notification_type
  USING type::text::notification_type;

-- 4. Drop the old type. No rows or columns reference it after step 3.
DROP TYPE notification_type_old;

-- =========================================================================
-- POST-MIGRATION ASSERTION — Phase 11 precedent
-- (20260423000005_phase11_debt02_audit.sql / 20260425000000_phase13_profile_settings_notifications.sql).
-- =========================================================================
DO $$
DECLARE
  enum_count int;
BEGIN
  -- Verify the new type has exactly two values.
  SELECT count(*) INTO enum_count
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
   WHERE pg_type.typname = 'notification_type';

  IF enum_count <> 2 THEN
    RAISE EXCEPTION 'Phase 24 post-check: notification_type has % values, expected exactly 2', enum_count;
  END IF;

  -- Verify the column type points at the new enum.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'type'
       AND udt_name = 'notification_type'
  ) THEN
    RAISE EXCEPTION 'Phase 24 post-check: notifications.type column does not reference notification_type';
  END IF;
END $$;

COMMIT;
```

**SQL syntax verification:** All four pattern steps verified by reading existing migration files. The `USING type::text::notification_type` text-bridge cast is canonical Postgres pattern; no `text` column or default needed since both old and new types share the same value names for the surviving values. [CITED: Postgres docs — `ALTER TYPE`; verified by reading sibling migrations and Phase 13 enum-extension precedent in `20260425000000_phase13_profile_settings_notifications.sql`]

---

## Aggressive Type-Narrowing Impact Map (DEBT-05 / D-03)

When the Drizzle pgEnum narrows from 4 values to 2, TypeScript starts complaining at every site that references the dead values. Here is the **dependency chain** with the **expected order of compiler errors**:

### Step 1: Update `src/db/schema.ts` (D-05 step 4)

```ts
// BEFORE
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'price_drop',
  'trending_collector',
])

// AFTER (narrows the inferred TS type used by every consumer)
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
])
```

Drizzle infers the column type from the enum definition. The change ripples through every `select({ type: notifications.type })` call.

### Step 2: TypeScript compile errors light up in this order

| File | Site | Error type | Action |
|------|------|------------|--------|
| `src/data/notifications.ts:16` | `type: 'follow' \| 'watch_overlap' \| 'price_drop' \| 'trending_collector'` literal in `NotificationRow` interface | Type mismatch when assigning from narrowed `notifications.type` | Narrow to `'follow' \| 'watch_overlap'` |
| `src/components/notifications/NotificationRow.tsx:21` | `type: 'follow' \| 'watch_overlap' \| 'price_drop' \| 'trending_collector'` in `NotificationRowData` | Inherited from `NotificationRow` DAL type | Narrow to two values |
| `src/components/notifications/NotificationRow.tsx:50-57` | `if (row.type !== 'follow' && row.type !== 'watch_overlap' && row.type !== 'price_drop' && row.type !== 'trending_collector')` guard | Comparing `'price_drop'` and `'trending_collector'` to a narrowed type → "comparison appears unintentional" | Simplify to `if (row.type !== 'follow' && row.type !== 'watch_overlap') return null;` |
| `src/components/notifications/NotificationRow.tsx:71` | `const isStubType = row.type === 'price_drop' \|\| row.type === 'trending_collector'` | Same overlap error | Delete the variable; delete the `!isStubType` check at line 76 (call `markNotificationRead` unconditionally on unread + non-self rows) |
| `src/components/notifications/NotificationRow.tsx:138` | `// Stub types (price_drop, trending_collector): UI-SPEC says "TBD"` comment + `return '#'` fallback in `resolveHref` | No TS error (comment), but unreachable code | Delete the fallback comment + `return '#'`; the function now exhaustively handles `'follow'` and `'watch_overlap'` |
| `src/components/notifications/NotificationRow.tsx:183-186` | `if (row.type === 'price_drop')` branch in `resolveCopy` | Comparison overlap error | Delete the branch |
| `src/components/notifications/NotificationRow.tsx:199-212` | `// trending_collector` fallback at end of `resolveCopy` | Code becomes unreachable after the watch_overlap branch | Replace fall-through with `// Exhaustive: type is 'follow' or 'watch_overlap'; both handled above.` and have TS exhaustiveness check via a `never` assignment |
| `src/lib/notifications/types.ts` | `PriceDropPayload`, `TrendingPayload` interface declarations + `NotificationPayload` union member references | Unused interface (compiler will not flag — but lint may) | **Delete `PriceDropPayload`, `TrendingPayload` and remove from `NotificationPayload` union.** Manual deletion (TS doesn't error on unused exported types). Grep ensures no stragglers. |
| `src/components/notifications/NotificationsInbox.tsx:71` | Comment `// Non-overlap rows (follow, price_drop, trending) pass through unchanged` | No TS error (comment) | Update comment to `// Non-overlap rows (follow) pass through unchanged` |

### Step 3: Test files

| File | Line(s) | Action |
|------|---------|--------|
| `tests/components/notifications/NotificationRow.test.tsx` | `describe('price_drop type')` lines 162–179 | **Delete entire describe block** |
| `tests/components/notifications/NotificationRow.test.tsx` | `describe('trending_collector type')` lines 181–198 | **Delete entire describe block** |
| `tests/components/notifications/NotificationRow.test.tsx` | `it('price_drop row click does NOT call markNotificationRead (stub type)', ...)` lines 327–341 | **Delete entire test** |

After these deletions: re-run `npm test`. Any remaining failure points to a missed reference — fix and continue.

### Verification by grep (final sweep, after TS errors all fixed)

```bash
grep -rn "price_drop\|trending_collector" src/ tests/ scripts/ supabase/migrations/2026050[1-9]* 2>/dev/null
```

Expected output: only the migration file itself (`20260501...sql`) and historical migrations (`20260423000002_phase11_notifications.sql` — protected as history). If anything else appears, it was missed by TS.

**Why grep alone wasn't enough:** A `string`-typed value flowing into the type column (e.g., `payload.type` where payload is `Record<string, unknown>`) would pass type-check. None exist in the current codebase [VERIFIED: grep showed only 7 files, all enumerated above], but the TS compiler proves there are no string-typed back doors.

---

## Per-File `wornPublic` Rewrite Plan (DEBT-06 / D-04)

### File 1: `tests/integration/phase12-visibility-matrix.test.ts`

**4 occurrences** of `wornPublic` / `worn_public`:

| Line | Content | Action |
|------|---------|--------|
| 99 | Comment `// wornPublic column dropped in Phase 12 Plan 06...` | **Delete the comment** — column was dropped 2026-04-24, no longer noteworthy |
| 188 | Comment in test body: `// Even though Pp's wear is visibility='public' and wornPublic=true on // profileSettings, ...` | **Update comment** — remove the wornPublic clause; the test is about `visibility='public' + profile_public=false` |
| 226 | Comment in test body: `// S follows nobody, so S's rail should not contain Of's tile even if // Of has a visibility='followers' wear with wornPublic=true on profileSettings.` | **Update comment** — remove the wornPublic clause |
| 315–329 | `it('WYWT-11: profile_settings.worn_public column dropped post-migration', ...)` test | **Delete the entire test** — this is a one-shot Phase-12-cutover anchor that asserted the migration ran. It cannot regress: if anyone tried to add `worn_public` back to `profile_settings`, Drizzle's schema would not have it, and any future migration adding it would have to be explicitly written. The test served its purpose. |

**No assertion rewrite needed** — the file's other tests are already positive `wear_visibility` assertions (lines 166–283). They use `getWearEventsForViewer` and check tile visibility per-tier; they don't touch `wornPublic` at all.

### File 2: `tests/integration/home-privacy.test.ts`

**7 occurrences** of `wornPublic` (all in the `privacyByUser` fixture seeds, lines 100–107):

```ts
// CURRENT (broken — column doesn't exist)
const privacyByUser: Record<
  string,
  { profilePublic: boolean; collectionPublic: boolean; wishlistPublic: boolean; wornPublic: boolean }
> = {
  [ids.V]: { profilePublic: true, collectionPublic: true, wishlistPublic: true, wornPublic: true },
  // ...
}
for (const [userId, settings] of Object.entries(privacyByUser)) {
  await db.update(profileSettings).set(settings).where(eq(profileSettings.userId, userId))
}
```

The `db.update(profileSettings).set(settings)` will fail at TypeScript compile time because Drizzle's inferred schema type for `profileSettings` does not include `wornPublic`. (Or: it has been failing and the file was just not run — verify with `npm test tests/integration/home-privacy.test.ts` before changes.)

**Action:** This is a **fixture data-shape migration** — the test logic stays identical. Each row now seeds wear events with the appropriate visibility:

```ts
// AFTER — narrow privacyByUser to the actual columns
const privacyByUser: Record<
  string,
  { profilePublic: boolean; collectionPublic: boolean; wishlistPublic: boolean }
> = {
  [ids.V]: { profilePublic: true, collectionPublic: true, wishlistPublic: true },
  [ids.A]: { profilePublic: true, collectionPublic: true, wishlistPublic: true },
  [ids.B]: { profilePublic: true, collectionPublic: false, wishlistPublic: true },
  [ids.C]: { profilePublic: false, collectionPublic: true, wishlistPublic: true },
  [ids.D]: { profilePublic: true, collectionPublic: true, wishlistPublic: true },
  [ids.E]: { profilePublic: false, collectionPublic: true, wishlistPublic: true },
}
```

Then the wear event seeds (lines 165–171 currently) need explicit `visibility: 'public' as const` on the `db.insert(wearEvents).values(...)` call (Drizzle currently uses the default which is `'public'` per `wear_visibility` enum default — this works correctly today as a no-op fix, but verify the W-01 test at line 200 still passes).

**No assertion rewrite needed** — the F-06/W-01/S-01 assertions don't reference `wornPublic`. Only the seed data shape changes.

### File 3: `tests/data/getFeedForUser.test.ts`

**3 occurrences** of `wornPublic` / `worn_public` (all in the Phase 12 anchor tests):

| Test | Line | Status | Action (per D-04) |
|------|------|--------|-------------------|
| `'Phase 12: where clause contains no reference to wornPublic'` | 191 | Negative assertion — no `worn_public` column in WHERE | **Rewrite as positive:** `'where clause references wear_events.visibility for watch_worn rows'` (extends the existing `'Phase 12: where clause references activities.metadata->>\\'visibility\\' for watch_worn branch'` test at line 213; can be merged or kept separate) |
| `"Phase 12: where clause references activities.metadata->>'visibility' for watch_worn branch"` | 213 | Already positive | **Keep as-is** — this is the rewritten target |
| `'Phase 12: select projection contains no wornPublic field'` | 240 | Negative assertion — no `worn_public` in projection | **Delete** — the column is gone from the schema, the projection cannot include it. Or **rewrite as positive:** `'select projection includes activities.metadata->>\\'visibility\\' check' ` if you want to lock that the visibility metadata is read at projection time. Planner's call. |

**Recommendation:** Merge the three tests into a single test that asserts the WHERE clause references the correct architecture (`activities.metadata->>'visibility'`). The "no wornPublic" negative assertion is dead weight once the column is gone.

| Action | Outcome |
|--------|---------|
| Delete tests at lines 191, 240 | Loses dead-weight negative assertions |
| Keep test at line 213 | Locks the positive architectural intent |
| **Net delta:** -2 tests, +0 tests | The two deletions are safe because the remaining test covers the architectural shape |

### File 4: `tests/data/getWearRailForViewer.test.ts`

**7 occurrences** of `wornPublic` / `worn_public` (in test names, fixture properties, AND a test-helper parameter):

| Site | Line | Action |
|------|------|--------|
| Comment on line 7 (`self-or-wornPublic privacy gate`) | 7 | **Update comment** — replace `wornPublic` with `wear_visibility` |
| `wornPublic: true,` in fixture row at line 124 | 124 | **Delete the property** — Drizzle's `wearEvents` schema doesn't have it; the projection mock contains stale shape |
| `wornPublic: true,` in fixture row at line 139 | 139 | **Delete the property** |
| `wornPublic: false, // private, but self-rule admits it` at line 164 | 164 | **Delete the property + update comment** to reference `visibility: 'private'` (already present in Unit 8 fixture at line 189) |
| `wornPublic: true,` in fixture row at line 188 | 188 | **Delete the property** (the row also has `visibility: 'public'` — the wornPublic was a transitional artifact) |
| Test `'Unit 10 (Phase 12): where clause contains no reference to wornPublic'` lines 275–297 | 275 | **Delete or rewrite per D-04.** Recommendation: delete (dead negative); the existing Unit 9 test at line 269 already asserts the leftJoin against follows is in place, which is the positive-shape assertion |
| Test `'Unit 11 (Phase 12): select projection contains no wornPublic field'` lines 299–327 | 299 | **Delete or rewrite per D-04.** Recommendation: delete; or rewrite to `'Unit 11: select projection includes wear_events.visibility'` and walk the projection AST to confirm. Planner's call. |
| `_wornPublic = true,` parameter at line 363 in `seedProfile` helper | 363 | **Delete the parameter entirely.** The underscore prefix already signals "unused"; D-04 explicitly calls this out. TS will guide deletion of every caller's positional arg (the call sites are in this file at lines 448, 449, 450, 451 — only this file uses the helper). |

**Caller of `seedProfile` with positional `false`:** Line 450 (`await seedProfile(bob, ..., false)`). After dropping the parameter, this becomes `await seedProfile(bob, ...)` and the test no longer pretends to model "bob's worn_public is false" — that semantics is dead. The downstream assertions in this integration test now need verifying that they don't depend on bob being worn-private; if they do, those need `visibility: 'private'` on his wear-event seeds instead.

---

## TEST-04 Implementation Specifics

**Target:** `tests/store/watchStore.test.ts` (NEW file)
**Subject:** `src/store/watchStore.ts` (Zustand v5 store with `setFilter` + `resetFilters`)

### Public Surface (verified by reading source)

```ts
// src/store/watchStore.ts — verbatim public API
export interface WatchFilters {
  status: 'all' | WatchStatus
  styleTags: string[]
  roleTags: string[]
  dialColors: string[]
  priceRange: { min: number | null; max: number | null }
}

interface WatchFilterStore {
  filters: WatchFilters
  setFilter: <K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => void
  resetFilters: () => void
}

export const useWatchStore = create<WatchFilterStore>()((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
}))
```

**Note:** No `addWatch`/`updateWatch`/`deleteWatch` actions on this store (CONTEXT.md §`<decisions>` D-02 Per-suite targets mentions "CRUD" — this is **inaccurate**; verify with planner. The current store is filter-only). The CONTEXT.md "addWatch, updateWatch, deleteWatch" reference is from an older shape; the store has been simplified to filters-only. **Do not write tests for actions that don't exist.**

**Also note:** No `getFilteredWatches()` selector exists in the store today. CONTEXT.md describes an older shape. Filtering happens elsewhere (likely in `src/components/watch/CollectionView.tsx` or `WatchGrid.tsx`). **Verify with the planner before writing assertions for a derived selector that doesn't exist.**

### Zustand v5 Reset Pattern

[VERIFIED: Zustand `^5.0.12` from package.json]

```ts
// tests/store/watchStore.test.ts (NEW)
import { describe, it, expect, beforeEach } from 'vitest'
import { useWatchStore } from '@/store/watchStore'

const initialState = useWatchStore.getState()

describe('useWatchStore — filter reducer', () => {
  beforeEach(() => {
    // Replace mode (`true` second arg) — fully reset state, not merge.
    useWatchStore.setState(initialState, true)
  })

  describe('setFilter', () => {
    it('sets status filter to a non-default value', () => {
      useWatchStore.getState().setFilter('status', 'owned')
      expect(useWatchStore.getState().filters.status).toBe('owned')
    })

    it('appends a styleTag preserving existing slice values', () => {
      useWatchStore.getState().setFilter('styleTags', ['dressy'])
      expect(useWatchStore.getState().filters.styleTags).toEqual(['dressy'])
    })

    it('replaces the styleTags array (not merge)', () => {
      useWatchStore.getState().setFilter('styleTags', ['dressy'])
      useWatchStore.getState().setFilter('styleTags', ['sport'])
      expect(useWatchStore.getState().filters.styleTags).toEqual(['sport'])
    })

    it('preserves other slices when setting one', () => {
      useWatchStore.getState().setFilter('styleTags', ['dressy'])
      useWatchStore.getState().setFilter('status', 'wishlist')
      const f = useWatchStore.getState().filters
      expect(f.styleTags).toEqual(['dressy'])
      expect(f.status).toBe('wishlist')
    })

    it('updates priceRange compound', () => {
      useWatchStore.getState().setFilter('priceRange', { min: 1000, max: 5000 })
      expect(useWatchStore.getState().filters.priceRange).toEqual({ min: 1000, max: 5000 })
    })
  })

  describe('resetFilters', () => {
    it('returns filters to defaults after multiple sets', () => {
      const store = useWatchStore.getState()
      store.setFilter('status', 'owned')
      store.setFilter('styleTags', ['dressy'])
      store.setFilter('priceRange', { min: 100, max: 9999 })
      store.resetFilters()
      expect(useWatchStore.getState().filters).toEqual({
        status: 'all',
        styleTags: [],
        roleTags: [],
        dialColors: [],
        priceRange: { min: null, max: null },
      })
    })
  })
})
```

**Coverage shape (D-02 representative):**

- **setFilter happy path:** 1 test per slice (5 slices total: status, styleTags, roleTags, dialColors, priceRange) — recommended to collapse into 2-3 representative tests covering scalar slice (status), array slice (styleTags), compound slice (priceRange)
- **setFilter edge:** preserves other slices (1 test)
- **setFilter edge:** array replace not merge (1 test)
- **resetFilters:** returns to defaults after multiple sets (1 test)

**Total: ~6-8 tests.** Matches "standard representative" (D-02).

**Out of scope:** Persistence middleware tests (`persist` is NOT used on this store, verified at line 26: `create<WatchFilterStore>()((set) => ({...}))` — no persist wrapper).

---

## TEST-05 Implementation Specifics

**Target:** `tests/api/extract-watch.test.ts` (NEW — separate from `tests/api/extract-watch-auth.test.ts` which covers ONLY the auth gate)
**Subject:** `src/app/api/extract-watch/route.ts` (verified by reading the file)

### Route Handler Shape (verified)

POST handler runs five gates in order:

1. **Auth gate** (line 11): `await getCurrentUser()` — covered by existing `extract-watch-auth.test.ts`
2. **JSON body parse** (line 20): `body = await request.json()`
3. **URL string check** (line 23): `if (!url || typeof url !== 'string')` → 400 `{ error: 'URL is required' }`
4. **URL parse** (line 31): `try { parsedUrl = new URL(url) } catch` → 400 `{ error: 'Invalid URL format' }`
5. **Protocol allow-list** (line 40): `if (!['http:', 'https:'].includes(parsedUrl.protocol))` → 400 `{ error: 'Only HTTP/HTTPS URLs are supported' }`
6. **`fetchAndExtract(url)`** (line 47) — calls `src/lib/extractors/index.ts`
7. **Catalog upsert** (lines 53–93) — fire-and-forget try/catch; populates `catalogId` field in response
8. **Taste enrichment** (lines 100–129) — fire-and-forget try/catch
9. **Response**: `{ success: true, catalogId, catalogIdError, ...result }` (200) OR error responses (400/401/500)

**Error categories already in the handler:**

- 401 `Unauthorized` (auth gate)
- 400 `URL is required` (no URL field)
- 400 `Invalid URL format` (URL constructor throws)
- 400 `Only HTTP/HTTPS URLs are supported` (non-http(s) protocol)
- 400 `That URL points to a private address and can't be imported.` (SsrfError caught at line 146)
- 500 `Failed to extract watch data from URL.` (generic catch)

### TEST-05 Coverage Targets (D-02 representative)

CONTEXT.md D-02 specifies: "Happy path (valid URL → structured-data success), categorized failures (host-403, structured-data-missing, LLM-timeout, generic-network), URL validation (non-http(s) protocol rejected), Zod input shape rejection."

**Note:** The current handler does NOT use Zod for input validation — it does manual checks (lines 23, 31, 40). CONTEXT.md "Zod input shape rejection" assumes a Zod schema that doesn't exist. Either:
- (a) Planner adds Zod input validation as part of TEST-05's scaffolding (scope expansion — flag with user)
- (b) The "Zod" mention in D-02 is aspirational; today's manual check covers the same ground. **Recommend (b)** — don't add Zod here; it's out of D-02's "standard representative" depth. Document as a Followup.

### Test Pattern (mirrors `extract-watch-auth.test.ts`)

```ts
// tests/api/extract-watch.test.ts (NEW)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth so we always pass the auth gate.
vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {},
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'u-1', email: 'a@b.co' }),
}))

// Mock fetchAndExtract — the seam between the route handler and the extraction pipeline.
const mockFetchAndExtract = vi.fn()
vi.mock('@/lib/extractors', () => ({
  fetchAndExtract: (...args: unknown[]) => mockFetchAndExtract(...args),
}))

// Mock SSRF error (used in the 400 path).
vi.mock('@/lib/ssrf', () => ({
  SsrfError: class extends Error {},
}))

// Mock catalog DAL (fire-and-forget — return null catalogId so we exercise the catalogIdError path too).
vi.mock('@/data/catalog', () => ({
  upsertCatalogFromExtractedUrl: vi.fn().mockResolvedValue(null),
  updateCatalogTaste: vi.fn().mockResolvedValue(undefined),
}))

// Mock taste enricher.
vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue(null),
}))

import { POST } from '@/app/api/extract-watch/route'
import { fetchAndExtract } from '@/lib/extractors'
import { SsrfError } from '@/lib/ssrf'

function mkPost(body: unknown) {
  return new NextRequest('http://localhost/api/extract-watch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/extract-watch — beyond the auth gate (TEST-05)', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('happy path', () => {
    it('returns 200 with extracted data + catalogId nullable', async () => {
      vi.mocked(fetchAndExtract).mockResolvedValue({
        success: true,
        data: { brand: 'Omega', model: 'Speedmaster' },
      } as Awaited<ReturnType<typeof fetchAndExtract>>)
      const res = await POST(mkPost({ url: 'https://example.com' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data?.brand).toBe('Omega')
    })
  })

  describe('URL validation', () => {
    it('returns 400 when URL is missing', async () => {
      const res = await POST(mkPost({}))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'URL is required' })
    })

    it('returns 400 for malformed URL', async () => {
      const res = await POST(mkPost({ url: 'not-a-url' }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid URL format' })
    })

    it('returns 400 for non-http(s) protocol (file:, ftp:, javascript:)', async () => {
      const res = await POST(mkPost({ url: 'file:///etc/passwd' }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Only HTTP/HTTPS URLs are supported' })
    })
  })

  describe('extraction error categories', () => {
    it('SsrfError → 400 with privacy-friendly copy', async () => {
      vi.mocked(fetchAndExtract).mockRejectedValue(new SsrfError('blocked'))
      const res = await POST(mkPost({ url: 'http://10.0.0.1' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('private address')
    })

    it('generic extraction failure → 500 with generic copy', async () => {
      vi.mocked(fetchAndExtract).mockRejectedValue(new Error('upstream 403'))
      const res = await POST(mkPost({ url: 'https://example.com' }))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toContain('Failed to extract')
    })

    it('extraction succeeds but catalog upsert fails → 200 with catalogIdError populated', async () => {
      vi.mocked(fetchAndExtract).mockResolvedValue({
        success: true,
        data: { brand: 'Omega', model: 'Speedmaster' },
      } as Awaited<ReturnType<typeof fetchAndExtract>>)
      // upsertCatalogFromExtractedUrl returns null → catalogIdError is populated
      const res = await POST(mkPost({ url: 'https://example.com' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.catalogId).toBeNull()
      expect(body.catalogIdError).toContain('null id')
    })

    it('extraction returns no brand/model → 200 with catalogIdError "brand/model missing"', async () => {
      vi.mocked(fetchAndExtract).mockResolvedValue({
        success: true,
        data: {},
      } as Awaited<ReturnType<typeof fetchAndExtract>>)
      const res = await POST(mkPost({ url: 'https://example.com' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.catalogIdError).toContain('brand/model missing')
    })
  })
})
```

**Coverage shape:** 1 happy + 3 URL validation + 5 error categories = ~9 tests. Stays in D-02's "standard representative" range.

**On host-403 / structured-data-missing / LLM-timeout categories** (CONTEXT.md): These are categories of `fetchAndExtract` *internal* failure that all surface as a generic `Error` to the route handler. The route handler does not differentiate them (it returns 500 for all). UX-05 (Phase 25) calls for differentiating them in the UI. TEST-05 should cover what the **route handler** actually does — generic 500 — and not invent categorization that the handler doesn't perform. Recommend: **single test per route-handler-observable error class** (the generic 500 case), and defer per-category tests to Phase 25 when the handler grows the category-aware response.

---

## TEST-06 Implementation Specifics

**Targets (3 components, 4 test files):**

1. `tests/components/watch/WatchForm.test.tsx` — **AUGMENT existing file** (already exists from Phase 19.1; tests Style/Role/Design picker hiding + CatalogPhotoUploader presence). TEST-06 adds: form submit happy path, validation errors per required field (brand, model), status field transitions.
2. `tests/components/watch/WatchCard.test.tsx` — **NEW file**. TEST-06 covers: status pill display, image-fallback (no `imageUrl`), gap-fill badge for wishlist, deal badge for sold/wishlist with target met, owned vs wishlist marketPrice display.
3. `tests/components/filters/FilterBar.test.tsx` — **NEW file**. TEST-06 covers: each filter section toggles the right store action (`setFilter('styleTags', ...)`), price-range commit fires `setFilter('priceRange', ...)`, "Clear all filters" button fires `resetFilters()`.

### Existing Pattern (verified from `WatchForm.isChronometer.test.tsx`)

Key conventions to mirror:

- **PointerEvent polyfill** (lines 17–28) — required for base-ui `Checkbox` clicks under jsdom
- **Mock `next/navigation`** (lines 31–34): `useRouter: () => ({ push: mockRouterPush, back: vi.fn() })`
- **Mock Server Actions** (lines 36–43): `addWatch` / `editWatch` returned via `vi.mock('@/app/actions/watches')`
- **Mock heavy children** (lines 45–55): `CatalogPhotoUploader`, `UrlImport` rendered as test stubs
- **Mock Browser Supabase client** (lines 56–68) — required for the photo upload path in `mode="create"`
- **Import AFTER mocks** (line 71)
- **`beforeEach` clears mocks** (lines 73–77)
- **Test selectors:** `screen.getByRole('checkbox', { name: /chronometer-certified/i })`, `screen.getByLabelText(/brand/i)`, `screen.getByRole('button', { name: /add watch/i })` — accessibility-first selectors

### TEST-06 WatchCard Coverage Targets

```ts
// tests/components/watch/WatchCard.test.tsx (NEW)
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WatchCard } from '@/components/watch/WatchCard'
import type { Watch, UserPreferences } from '@/lib/types'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }))

const baseWatch: Watch = {
  id: 'w1', brand: 'Omega', model: 'Speedmaster', status: 'owned',
  movement: 'automatic', complications: [], styleTags: [], designTraits: [], roleTags: [],
  notes: '', imageUrl: '',
}
const baseCollection: Watch[] = []
const basePrefs: UserPreferences = {} as UserPreferences  // verify the shape from src/lib/types.ts

describe('<WatchCard>', () => {
  it('renders brand and model', () => {
    render(<WatchCard watch={baseWatch} collection={baseCollection} preferences={basePrefs} />)
    expect(screen.getByText('Omega')).toBeInTheDocument()
    expect(screen.getByText('Speedmaster')).toBeInTheDocument()
  })

  it('renders status pill', () => {
    render(<WatchCard watch={baseWatch} collection={baseCollection} preferences={basePrefs} />)
    expect(screen.getByText('owned')).toBeInTheDocument()
  })

  it('falls back to WatchIcon when imageUrl is empty', () => {
    render(<WatchCard watch={baseWatch} collection={baseCollection} preferences={basePrefs} />)
    // The fallback div has the WatchIcon; no <img/> rendered.
    expect(screen.queryByAltText(/Omega Speedmaster/)).not.toBeInTheDocument()
  })

  it('shows marketPrice for non-owned watches', () => {
    const wishlistWatch = { ...baseWatch, status: 'wishlist' as const, marketPrice: 7500 }
    render(<WatchCard watch={wishlistWatch} collection={baseCollection} preferences={basePrefs} />)
    expect(screen.getByText('$7,500')).toBeInTheDocument()
  })

  it('hides marketPrice for owned watches', () => {
    const ownedWatch = { ...baseWatch, marketPrice: 7500 }
    render(<WatchCard watch={ownedWatch} collection={baseCollection} preferences={basePrefs} />)
    expect(screen.queryByText('$7,500')).not.toBeInTheDocument()
  })

  // + Deal badge test, + gap-fill badge test (one each = ~7 tests)
})
```

### TEST-06 FilterBar Coverage Targets

```ts
// tests/components/filters/FilterBar.test.tsx (NEW)
// FilterBar uses Zustand store via useWatchStore — reset state in beforeEach.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '@/components/filters/FilterBar'
import { useWatchStore } from '@/store/watchStore'

const initialState = useWatchStore.getState()

describe('<FilterBar>', () => {
  beforeEach(() => {
    useWatchStore.setState(initialState, true)
  })

  it('toggles a styleTag through the store action when clicked', async () => {
    const user = userEvent.setup()
    render(<FilterBar maxPrice={5000} />)
    // Open Style section first (CollapsibleSection defaults closed)
    await user.click(screen.getByRole('button', { name: /Style/i }))
    // Click a Badge — STYLE_TAGS from constants.ts; pick the first
    const dressyBadge = screen.getByText(/dressy/i)
    await user.click(dressyBadge)
    expect(useWatchStore.getState().filters.styleTags).toContain('dressy')
  })

  it('removes styleTag on second click (toggle)', async () => {
    // ... same shape: click twice, expect empty array
  })

  it('"Clear all filters" button calls resetFilters', async () => {
    // Set a filter, click Clear, expect default state
  })

  it('priceRange Slider value commits via setFilter', async () => {
    // Synthetic Slider commit — verify setFilter('priceRange', { min, max }) called
  })
})
```

**Note on PointerEvent polyfill:** `FilterBar` uses Slider from `@/components/ui/slider` (which wraps base-ui under the hood) — verify if the polyfill is needed. Recommendation: **add it defensively** (mirrors `WatchForm.isChronometer.test.tsx` lines 17–28).

### TEST-06 WatchForm Augmentations

The existing `tests/components/watch/WatchForm.isChronometer.test.tsx` and `WatchForm.notesPublic.test.tsx` cover the chronometer toggle and notes-public toggle. TEST-06 adds:

- **Form submit happy path:** Fill brand + model → click Add → `mockAddWatch` called with payload
- **Required field validation:** Submit empty form → see "Brand is required", "Model is required", `mockAddWatch` not called
- **Status transition:** Default status is 'wishlist' (line 47); switching to 'owned' (via Select) → submit → payload has `status: 'owned'`
- **Edit mode:** `mode="edit"` with a `watch` prop hydrates form fields → submit → `mockEditWatch` called with `(watchId, payload)`

Recommended file location: **AUGMENT `tests/components/WatchForm.test.tsx`** (note: the existing Phase 19.1 file is at `tests/components/WatchForm.test.tsx`, not `tests/components/watch/WatchForm.test.tsx` — verify the planner picks the right path; consistent location is `tests/components/watch/`).

**Total TEST-06 tests:** ~6 (WatchCard) + ~5 (FilterBar) + ~4 (WatchForm augmentations) = ~15 tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Postgres ENUM value removal | Custom column-rebuild script (drop + recreate column with `text`, copy data, re-add `enum` constraint) | Rename + recreate pattern (4 SQL statements) | Atomic, no data copy, idiomatic Postgres |
| Migration coverage assertion | App-level "did the migration run?" test | In-migration `DO $$ … RAISE EXCEPTION` block | Runs at migration time, blocks bad apply; precedent at `20260423000047_phase11_backfill_coverage_assertion.sql` |
| Database connection in scripts | Hand-rolled `pg.Client.connect`/teardown | `import { db } from '../src/db'` (Drizzle wrapper) | Consistent with `scripts/backfill-catalog.ts`, `scripts/refresh-counts.ts` |
| Fetch mocking in TEST-05 | MSW handlers for full HTTP intercept | `vi.mock('@/lib/extractors')` | One layer up from fetch — what `tests/api/extract-watch-auth.test.ts` already does |
| Zustand reset in tests | Manually re-import the module / spy on `set` | `useWatchStore.setState(initialState, true)` | Zustand v5 documented pattern; `true` = replace mode, not merge |
| ENUM presence verification post-migration | `INSERT INTO notifications WHERE type = 'price_drop'` and catch the error | `pg_enum` JOIN `pg_type` count assertion | Doesn't need a temporary write; precedent in Phase 13 migration |

**Key insight:** Every "Don't hand-roll" entry above has prior-art in this codebase. The phase is a cleanup phase — leverage existing patterns.

---

## Common Pitfalls

### Pitfall 1: Drizzle pgEnum narrows BEFORE prod migration applies

**What goes wrong:** Step 4 (Drizzle update) runs in a commit that lands and is deployed before step 3 (`supabase db push --linked` against prod) actually executes. App boots; Drizzle reads prod schema → notices the wider enum → either errors at boot or silently mismatches the type system.

**Why it happens:** D-05 sequencing is documented but not enforced — a developer pushing fast can swap step 3 and step 4.

**How to avoid:** Plan 24-NN that ships the prod migration MUST be marked `autonomous: false` and gated on user-supervised credentials. The Drizzle update is a SEPARATE plan landing in a SEPARATE commit AFTER the migration confirms in prod. The CI (or a manual checklist in `docs/deploy-db-setup.md`) can run `npm run db:preflight-notification-cleanup` against prod — if non-zero exit, abort the deploy.

**Warning signs:**
- Drizzle types narrowed in `src/db/schema.ts` but `pg_enum` in prod still shows 4 values
- Tests pass locally (where you applied the migration via `supabase db reset`) but fail in CI against a fresh prod-snapshot DB

### Pitfall 2: USING cast fails on unexpected enum values

**What goes wrong:** The `ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::text::notification_type` cast fails if any row's `type` value isn't in the new enum. Preflight catches `'price_drop'` and `'trending_collector'`, but if some mystery value got in (database corruption, manual SQL by an admin), the migration fails.

**Why it happens:** ENUM corruption can happen via direct SQL outside the app (e.g., during a manual recovery operation).

**How to avoid:** The preflight script and in-migration assertion already check for the two known stub values. **Add a third check** for "any value not in the new set" — a positive whitelist:

```sql
-- BETTER preflight (covers unknown corruption too)
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM notifications
   WHERE type::text NOT IN ('follow', 'watch_overlap');
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase 24 preflight failed: % notifications have type values outside the new whitelist {follow, watch_overlap}.', n;
  END IF;
END $$;
```

**Recommendation:** **Replace** the blacklist check (`type IN ('price_drop','trending_collector')`) with the whitelist check (`type NOT IN ('follow','watch_overlap')`) in BOTH the standalone script and the in-migration block. Both detect the same prevalent case (the two known stubs) AND any unknown future stub. CONTEXT.md D-01's blacklist phrasing is the natural mental model; the whitelist is more defensive. Planner's call.

**Warning signs:** Preflight passes (zero blacklist matches), migration starts, USING cast throws `invalid input value for enum notification_type: "<some value>"` mid-transaction.

### Pitfall 3: Manual grep misses string-typed paths

**What goes wrong:** Grep for `'price_drop'` finds explicit literals but misses cases where the type flows through a `string`-typed variable. Example (hypothetical): `const t: string = row.type; if (t === 'price_drop') ...` — TS doesn't error because `t` is `string`, but grep still finds the literal.

**Why it happens:** TypeScript's structural typing doesn't reject literal comparisons against `string`.

**How to avoid:** D-03 narrows the type at the source (`NotificationRowData['type']`); aggressive narrowing means TS errors at every `'price_drop'` literal compared to a narrowed type. The grep step is the **second** verifier, not the first.

**Warning signs:** TS compile passes, grep shows additional hits beyond the migration file (which is expected) and historical migrations (which are protected).

### Pitfall 4: Tests pass locally because `supabase db reset` re-applies the new migration

**What goes wrong:** Local dev runs `supabase db reset` after the migration commits → local DB is on the new enum. Tests pass. But CI / preview deploys against a Supabase project that hasn't had `supabase db push --linked` applied — they fail.

**Why it happens:** Local DB and prod DB diverge between "migration written" and "migration applied to prod". The local-reset workflow at `~/.claude/projects/.../memory/project_local_db_reset.md` is documented but trivially skippable.

**How to avoid:** The `supabase db push --linked` step (D-05 step 3) is a `[BLOCKING]` plan with `autonomous: false` — execution stops until the user confirms. Plan 24-NN that owns this step should match the Phase 17 Plan 05 shape (existing precedent — see Phase 17 plans).

**Warning signs:** Tests green locally; CI red on `npm test` against a prod-cloned Supabase project.

### Pitfall 5: `home-privacy.test.ts` fixture migration breaks an unrelated test

**What goes wrong:** Removing `wornPublic` from the `privacyByUser` fixture (file 2 in §"Per-File `wornPublic` Rewrite Plan") changes the shape of seeds. Tests that read `wear_events.visibility` may behave differently because the seed data shape changed.

**Why it happens:** `wear_events.visibility` defaults to `'public'` (verified in `src/db/schema.ts:239`). Existing seeds at `tests/integration/home-privacy.test.ts:165–171` insert wearEvents without specifying visibility → defaults to `'public'`. The wornPublic field on profileSettings was unused in v3.0; removing it from the fixture has zero effect on production code paths.

**How to avoid:** Run `npm test tests/integration/home-privacy.test.ts` BEFORE the wornPublic removal AND AFTER to verify identical pass/fail outcomes. If a test that was passing now fails, the fixture migration caused a regression — investigate.

**Warning signs:** `home-privacy.test.ts` test count or pass count changes between the BEFORE and AFTER runs.

### Pitfall 6: PointerEvent polyfill missing in TEST-06 FilterBar tests

**What goes wrong:** Slider component (likely uses base-ui under the hood) dispatches `PointerEvent` on click → jsdom doesn't implement it → test errors `ReferenceError: PointerEvent is not defined`.

**Why it happens:** jsdom is incomplete; existing tests work around this with the polyfill at `WatchForm.isChronometer.test.tsx:17–28`.

**How to avoid:** Copy the polyfill into `tests/components/filters/FilterBar.test.tsx` defensively, OR (better) lift the polyfill into `tests/setup.ts` so all tests get it. **Recommend lifting** — it's a no-op for tests that don't need it.

**Warning signs:** Slider commit tests throw `PointerEvent is not defined`.

### Pitfall 7: `tsx` does not resolve `@/*` aliases in scripts

**What goes wrong:** Writing `import { db } from '@/db'` in `scripts/preflight-notification-types.ts` fails at runtime — tsx invokes Node's loader without the Next.js path-alias resolver.

**Why it happens:** tsx is a runtime TypeScript shim; aliases require tsconfig-aware resolution which tsx skips.

**How to avoid:** Use relative imports (`import { db } from '../src/db'`) — verified in `scripts/backfill-catalog.ts:14` comment and `scripts/refresh-counts.ts:11` comment.

**Warning signs:** `npm run db:preflight-notification-cleanup` errors with `Cannot find module '@/db'`.

---

## Code Examples

Verified patterns from sibling files in the repository.

### Standalone Preflight Script

Pattern source: `scripts/refresh-counts.ts` (closest sibling — single read query, exit code).

```ts
// scripts/preflight-notification-types.ts
import { db } from '../src/db'
import { sql } from 'drizzle-orm'

async function main() {
  const result = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c
      FROM notifications
     WHERE type::text NOT IN ('follow', 'watch_overlap')
  `)
  const count = (result as unknown as Array<{ c: number }>)[0]?.c ?? 0

  if (count !== 0) {
    console.error(`[preflight] FAILED — ${count} notification rows have type values outside the new whitelist {follow, watch_overlap}.`)
    process.exit(1)
  }

  console.log('[preflight] OK — zero out-of-whitelist notification.type rows. Safe to apply migration.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[preflight] fatal:', err)
  process.exit(1)
})
```

### Migration SQL (full file)

See §"Canonical Rename + Recreate Migration" above.

### TEST-04 Zustand Reset

Pattern source: Zustand v5 docs + `tests/components/notifications/NotificationRow.test.tsx` `beforeEach` shape.

```ts
// tests/store/watchStore.test.ts (skeleton)
import { describe, it, expect, beforeEach } from 'vitest'
import { useWatchStore } from '@/store/watchStore'

const initialState = useWatchStore.getState()

beforeEach(() => {
  useWatchStore.setState(initialState, true)  // `true` = replace, not merge
})
```

### TEST-05 Route Handler Mock Pattern

Pattern source: `tests/api/extract-watch-auth.test.ts` (existing — auth gate only).

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {},
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'u-1', email: 'a@b.co' }),
}))
const mockFetchAndExtract = vi.fn()
vi.mock('@/lib/extractors', () => ({
  fetchAndExtract: (...args: unknown[]) => mockFetchAndExtract(...args),
}))

import { POST } from '@/app/api/extract-watch/route'
```

### TEST-06 Component Test Pattern

Pattern source: `tests/components/watch/WatchForm.isChronometer.test.tsx`.

Key elements: PointerEvent polyfill, `vi.mock('next/navigation')`, `vi.mock('@/app/actions/watches')`, mock heavy children.

---

## Runtime State Inventory

Phase 24 has **migration / refactor / fixture-migration characteristics** — runtime state inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data (DB rows referencing the renamed string)** | `notifications.type` rows with `'price_drop'` or `'trending_collector'` | Preflight (D-01) verifies count is zero. **No data migration step needed if preflight passes.** If non-zero in prod (unlikely — no v3.0 write-path inserts these), the script aborts the deploy and the planner / operator decides: delete the rows OR pause migration. |
| **Live service config (UI/external services holding the string outside git)** | None — there are no Datadog tags, Cloudflare tunnels, n8n workflows, or other external services with `'price_drop'`/`'trending_collector'` strings. The values exist only in the Postgres enum, the Drizzle schema, and the Next.js render code. | None |
| **OS-registered state (cron, scheduled tasks, daemons)** | None — pg_cron is used only for catalog count refresh (`refresh_watches_catalog_counts`). No cron job references `notification_type` enum values. [VERIFIED: `grep -rn "pg_cron\|cron\.schedule" supabase/migrations/`] | None |
| **Secrets/env vars** | `DATABASE_URL` for prod is read by both the preflight script and the `supabase db push --linked` command. Both reference the same secret already documented in `docs/deploy-db-setup.md`. No new secrets. | None |
| **Build artifacts / installed packages** | None — no Drizzle migration snapshots, no compiled outputs, no installed npm artifacts reference `'price_drop'` / `'trending_collector'`. The Drizzle migration history at `drizzle/0003_phase12_drop_worn_public.sql:1` references the historical 4-value enum CREATE statement — this is migration history (append-only, must NOT be modified). | None — DO NOT touch `drizzle/0003_phase12_drop_worn_public.sql` |

**Nothing found in category (explicit confirmation):**
- No production data migration step is needed beyond the preflight (no rows to update).
- No cron job updates needed.
- No secret rotations needed.
- No build artifacts to invalidate.

**The single runtime state operation:** The `ALTER TYPE` rename+recreate inside `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql`. Atomic. Reversible only via a "recreate the wide enum" migration (drop new, rename old back from `_old` if not yet dropped — but the migration drops `_old` at step 4, so post-commit rollback requires re-creating both values).

---

## Environment Availability

Phase 24 has external dependencies (Postgres, npm scripts).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase Docker) | `supabase db reset`, local migration apply, integration tests | Assumed available | per `supabase/config.toml` (PG 17 default) | None |
| `supabase` CLI | `supabase db push --linked` for prod migration | Required (project tooling) | per `supabase/config.toml` | None |
| `tsx` (transitively via `npx`) | Running TypeScript scripts | Bundled via existing `db:*` scripts | Resolved by package.json | Use `node --loader tsx` instead |
| Vitest | `npm test` for all test runs | `^2.1.9` (package.json) | 2.1.9 | None |
| `DATABASE_URL` (prod) | `supabase db push --linked`, preflight script in CI | User-supervised secret | n/a | None — manual paste required |
| Anthropic API key | Not required for Phase 24 | n/a | — | n/a |

**Missing dependencies with no fallback:** None — all tooling is in place.

**Missing dependencies with fallback:** None.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Define all anticipated enum values upfront (v3.0 D-09 — `notification_type` had 4 values, only 2 wired) | Define only what's used; evolve via rename+recreate when new values land OR when stubs are removed | v4.0 (this phase) | The "anticipated upfront" pattern was created to avoid `ALTER TYPE ADD VALUE` (which can't run in a transaction). The v4.0 reality: stubs survived 6+ months without being wired, so the upfront approach traded migration complexity for dead code. Going forward: add values via `ALTER TYPE ADD VALUE` in a non-transactional migration, accept the slightly worse devex for cleaner state. |
| `tests/integration/phase12-visibility-matrix.test.ts:315` style — anchor test that asserts a migration ran | Trust the schema + Drizzle compile-time check | v4.0 (this phase) | Anchor tests for migration cutovers served their purpose during the cutover window. Once the column / enum is gone from Drizzle and prod for >1 deploy cycle, the anchor test is dead weight — Drizzle would refuse to compile a re-introduction. |

**Deprecated/outdated:**
- `wornPublic` column on `profile_settings` — dropped in Phase 12 (`20260424000001_phase12_drop_worn_public.sql`). Replaced by per-row `wear_events.visibility`.
- `'price_drop'` / `'trending_collector'` notification_type values — removed in this phase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --run <pattern>` (e.g., `npm test -- --run tests/store`) |
| Full suite command | `npm test` |
| Phase gate | Full suite green via `npm test` AND `npm run db:preflight-notification-cleanup` returns 0 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-03 | Preflight script returns non-zero when stub rows present | unit | `npx tsx --env-file=.env.local scripts/preflight-notification-types.ts; echo $?` | ❌ Wave 0 (script + a unit test for the SQL count assertion) |
| DEBT-03 | In-migration `DO $$` block aborts when stub rows present | manual | Apply migration against a DB with stub rows seeded → expect `RAISE EXCEPTION` | ❌ Wave 0 (manual UAT in deploy runbook) |
| DEBT-04 | New `notification_type` enum has only `'follow'` and `'watch_overlap'` after migration applies | integration | `psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = 'notification_type' ORDER BY enumsortorder"` → exact match | ❌ Wave 0 (integration test in `tests/integration/phase24-notification-enum-cleanup.test.ts`) |
| DEBT-04 | `notifications.type` column references the new enum (not `_old`) | integration | `psql "$DATABASE_URL" -c "SELECT udt_name FROM information_schema.columns WHERE table_name='notifications' AND column_name='type'"` → `'notification_type'` (not `'notification_type_old'`) | ❌ Wave 0 (same file as above) |
| DEBT-05 | Drizzle pgEnum in `src/db/schema.ts` has only 2 values | unit | `pytest`-style (vitest): import `notificationTypeEnum`, assert `.enumValues.length === 2` | ❌ Wave 0 (test in `tests/db/schema.test.ts` or extend existing) |
| DEBT-05 | No source file outside the migration contains `'price_drop'` or `'trending_collector'` | grep | `! grep -r "price_drop\|trending_collector" src/ tests/ scripts/ --exclude-dir=migrations` | ❌ Wave 0 (CI grep guard or skill rule) |
| DEBT-05 | `NotificationRow.test.tsx` no longer has `describe('price_drop')` / `describe('trending_collector')` describe blocks | grep / regression | `! grep -E "describe\\(.+(price_drop\|trending_collector)" tests/components/notifications/` | ❌ Wave 0 |
| DEBT-06 | All 4 wornPublic test files compile + pass | integration | `npm test tests/integration/phase12-visibility-matrix.test.ts tests/integration/home-privacy.test.ts tests/data/getFeedForUser.test.ts tests/data/getWearRailForViewer.test.ts` | ✅ Files exist; tests need rewriting |
| DEBT-06 | `_wornPublic` parameter removed from `seedProfile` helper | grep | `! grep '_wornPublic' tests/data/getWearRailForViewer.test.ts` | ❌ Wave 0 |
| TEST-04 | watchStore filter reducer covers happy path + edge cases | unit | `npm test tests/store/watchStore.test.ts` | ❌ Wave 0 (NEW file) |
| TEST-05 | extract-watch route handler covers happy + 4 error categories | integration | `npm test tests/api/extract-watch.test.ts` | ❌ Wave 0 (NEW file; auth gate already covered by `extract-watch-auth.test.ts`) |
| TEST-06 | WatchForm augmentation tests cover form submit + validation + status transition | unit | `npm test tests/components/watch/WatchForm.test.tsx` | ⚠️ EXTEND (Phase 19.1 file at `tests/components/WatchForm.test.tsx`) |
| TEST-06 | WatchCard renders status pill, image-fallback, marketPrice display variants | unit | `npm test tests/components/watch/WatchCard.test.tsx` | ❌ Wave 0 (NEW file) |
| TEST-06 | FilterBar fires correct store actions on each filter slice | unit | `npm test tests/components/filters/FilterBar.test.tsx` | ❌ Wave 0 (NEW file) |

### Sampling Rate

- **Per task commit:** `npm test -- --run <changed-test-pattern>` (fast — affected tests only)
- **Per wave merge:** `npm test` (full suite green)
- **Phase gate:** Full suite green + `npm run db:preflight-notification-cleanup` returns 0 + grep guards return zero hits + manual `psql` enum-shape verification post-prod-apply

### Wave 0 Gaps

- [ ] `scripts/preflight-notification-types.ts` — covers DEBT-03 (NEW)
- [ ] `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` — covers DEBT-04 (NEW; both DO $$ blocks)
- [ ] `tests/integration/phase24-notification-enum-cleanup.test.ts` — covers DEBT-04 post-migration shape (NEW)
- [ ] `tests/store/watchStore.test.ts` — covers TEST-04 (NEW)
- [ ] `tests/api/extract-watch.test.ts` — covers TEST-05 (NEW; co-located with `extract-watch-auth.test.ts`)
- [ ] `tests/components/watch/WatchCard.test.tsx` — covers TEST-06 WatchCard (NEW)
- [ ] `tests/components/filters/FilterBar.test.tsx` — covers TEST-06 FilterBar (NEW)
- [ ] `tests/components/watch/WatchForm.test.tsx` augmentations OR new file — covers TEST-06 WatchForm (EXTEND Phase 19.1 file at `tests/components/WatchForm.test.tsx`, OR create new file at `tests/components/watch/WatchForm.test.tsx`)
- [ ] PointerEvent polyfill — recommend lifting from `WatchForm.isChronometer.test.tsx` to `tests/setup.ts` (defensive)
- [ ] Framework install: NONE — all tooling already in package.json

---

## Security Domain

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | TEST-05 verifies the auth gate behavior past the gate (auth gate itself covered by `extract-watch-auth.test.ts`). Auth implementation not modified. |
| V3 Session Management | no | Not modified in this phase |
| V4 Access Control | yes | RLS on `notifications` table: recipient-only SELECT/UPDATE policies stay intact during the rename+recreate (verified — policies don't reference enum values, only `user_id`). The `notification_type` enum is a column-type concern, not an access-control concern. |
| V5 Input Validation | yes | TEST-05 covers URL validation (non-http(s) protocol, malformed URL, missing field). `notifications.type` `NOT NULL` constraint preserved by USING cast. |
| V6 Cryptography | no | Not relevant to this phase |
| V7 Error Handling and Logging | yes | Preflight script's error message must NOT leak DB internals (script's stub-row count is fine; row IDs would be a leak — current shape is safe). In-migration `RAISE EXCEPTION` includes the count, no PII. |
| V10 Malicious Code | no | Not relevant |
| V12 File and Resources | no | Not relevant |

### Known Threat Patterns for {Postgres ENUM rename + Vitest unit tests}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Migration applied without preflight → data loss (USING cast on rows with values not in new enum) | Tampering / DoS | D-01 two-layer preflight (CI script + in-migration assertion). Recommend whitelist-based check (Pitfall 2) instead of blacklist. |
| Drizzle pgEnum leads prod migration → mismatched type system | Tampering / DoS | D-05 strict commit ordering; `[BLOCKING]` marker on prod migration plan |
| Bypassing preflight script in CI | DoS (data loss) | In-migration `DO $$` is the second layer that runs even if CI is skipped |
| ENUM rename collides with concurrent writes mid-transaction | Tampering | Single-transaction migration; concurrent INSERT during rename would block on the AccessExclusive lock the ALTER TYPE takes — atomic rollback if anything fails |
| Test-side fixture migration loses privacy semantics | Information Disclosure | Run home-privacy.test.ts BEFORE and AFTER fixture migration; verify identical pass/fail (Pitfall 5) |
| `'price_drop'` literal lingers in deleted-but-cached compiled output | Information Disclosure | Build artifact regeneration — Next.js `npm run build` after the deletion sweep, verify `.next/` doesn't contain stale literals (defensive; not required for prod safety since the route-render layer is server-rendered each request) |

**Notes:**
- The `notifications` table RLS policies (`notifications_select_recipient_only`, `notifications_update_recipient_only`) reference `user_id`, not `type`. They are unchanged by the migration. [VERIFIED: `supabase/migrations/20260423000002_phase11_notifications.sql:99–113`]
- The dedup UNIQUE partial index (`notifications_watch_overlap_dedup`) uses `WHERE type = 'watch_overlap'` — `'watch_overlap'` is preserved in the new enum, so the index continues to function. [VERIFIED: `supabase/migrations/20260423000002_phase11_notifications.sql:85–92`]
- The CHECK constraint `notifications_no_self_notification` references `actor_id` and `user_id`, not `type`. Unchanged. [VERIFIED: same migration, lines 46–48]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `_wornPublic = true` parameter at `tests/data/getWearRailForViewer.test.ts:363` is only consumed by callers within the same file (lines 448–451) | §"Per-File `wornPublic` Rewrite Plan / File 4" | Low — verified by reading the file; if missed, TS will error at the parameter site after deletion |
| A2 | Removing the `wornPublic: true` fixture seed from `home-privacy.test.ts` does not change which rows are `'public'` because `wear_events.visibility` defaults to `'public'` | §"Per-File ... / File 2" + Pitfall 5 | Low — verified at `src/db/schema.ts:239` (`.default('public')`); recommend running test before/after to confirm |
| A3 | CONTEXT.md's mention of `addWatch`/`updateWatch`/`deleteWatch` actions on `useWatchStore` is from an older shape; the current store is filter-only | §"TEST-04 Implementation Specifics" | Medium — TEST-04 scope shrinks accordingly; planner should confirm before writing tests for non-existent actions |
| A4 | CONTEXT.md's mention of `getFilteredWatches()` derived selector on `useWatchStore` is from an older shape; today the store has no derived selector | §"TEST-04 Implementation Specifics" | Medium — same as A3 |
| A5 | "Zod input shape rejection" in CONTEXT.md D-02 is aspirational; the route handler does manual checks today, no Zod schema exists | §"TEST-05 Implementation Specifics" | Low — recommendation is to test what the handler does today, not invent a Zod layer; planner can flag for user if they want Zod added in Phase 24 |
| A6 | Whitelist preflight (`type::text NOT IN ('follow','watch_overlap')`) is strictly safer than the blacklist phrasing in CONTEXT.md D-01 | §"Pitfall 2" + §"Code Examples / Standalone Preflight" | Low — both detect the prevalent case; whitelist also detects unknown corruption |
| A7 | The roadmap text "9 test files" is documentation drift counting reference sites instead of files; only 4 files exist | §"Empirical Reconciliation" | Low — verified by grep; recommendation is to update roadmap text post-phase, no impact on plan |
| A8 | `migrations` in `drizzle/` directory are append-only history and must not be modified | §"Architecture Patterns / Anti-Patterns" + §"Runtime State Inventory" | Low — standard tool conventional; modifying them would break drizzle-kit state tracking |
| A9 | `pg_cron` jobs in this codebase only schedule catalog count refresh; nothing references `notification_type` enum values | §"Runtime State Inventory" | Low — verified by `grep -rn 'pg_cron\|cron\.schedule' supabase/migrations/`; no notification cron exists |

**If this table is empty:** All claims would be verified — but A3, A4, and A5 each carry MEDIUM risk because CONTEXT.md describes shapes that don't match the current code. **Planner MUST verify these three with the user before writing TEST-04 / TEST-05 specifics.**

---

## Open Questions

1. **Should the preflight check use whitelist or blacklist phrasing?**
   - What we know: CONTEXT.md D-01 phrases it as blacklist (`type IN ('price_drop','trending_collector')`). Whitelist (`type NOT IN ('follow','watch_overlap')`) is strictly safer.
   - What's unclear: Does the user prefer the explicit "we know about exactly these two stubs" framing, or the safer "anything not in the new set is a bug" framing?
   - Recommendation: **Use whitelist** in both layers (script + in-migration). Mention in plan summary so user can override.

2. **Does `useWatchStore` currently have CRUD actions (addWatch/updateWatch/deleteWatch) and a `getFilteredWatches()` selector?**
   - What we know: CONTEXT.md D-02 mentions both. Reading `src/store/watchStore.ts`: only `setFilter`/`resetFilters` exist. No CRUD. No derived selector.
   - What's unclear: Is the CONTEXT.md text from an older draft, or did the store get simplified between research and now?
   - Recommendation: Planner asks user OR the planner reads the current store as the authoritative source of truth (reasonable given the store file is small and the shape is unambiguous). TEST-04 scope: filter reducer only, no CRUD.

3. **Should the in-migration assertion fail loudly with row count or quietly with a generic message?**
   - What we know: Row count is fine (no PII); Phase 11 backfill assertion includes orphan_count.
   - Recommendation: **Include count + remediation hint** (matches Phase 11 precedent at `20260423000047_phase11_backfill_coverage_assertion.sql:33`).

4. **Should the post-migration assertion be in the same file as the rename+recreate, or a separate "Phase 24 Migration 2" file?**
   - What we know: Phase 11 used 2-file pattern (notifications.sql + backfill_coverage_assertion.sql).
   - Recommendation: **Same file** — the assertion is "did the rename succeed?", not a separate concern. One transaction, one file. (Phase 13 migration also did everything in one file.)

5. **Does the `WatchCard` `gapFill` prop in TEST-06 require seeding a real `UserPreferences` shape?**
   - What we know: `computeGapFill` is called with watch + collection + preferences; preferences shape from `src/lib/types.ts` has many optional fields.
   - Recommendation: Use a minimal `{} as UserPreferences` cast for tests where gap-fill isn't the assertion target; build a realistic preferences fixture for tests that explicitly test gap-fill rendering. Borrow from `tests/components/watch/CollectionView.tsx`-adjacent fixtures if any exist.

---

## Sources

### Primary (HIGH confidence)

- **CONTEXT.md** — `.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-CONTEXT.md` (D-01..D-05 lock decisions; canonical refs section)
- **REQUIREMENTS.md** — `.planning/REQUIREMENTS.md` (DEBT-03..06 + TEST-04..06 wording)
- **ROADMAP.md** — `.planning/ROADMAP.md` Phase 24 section (success criteria, dependencies)
- **PROJECT.md** Key Decisions: "ENUM cleanup uses rename + recreate" (referenced from CONTEXT.md)
- **CLAUDE.md + AGENTS.md** — project tech stack lock; Next.js 16 breaking changes warning
- **`supabase/migrations/20260423000002_phase11_notifications.sql`** — original 4-value enum CREATE statement; idempotence pattern
- **`supabase/migrations/20260423000047_phase11_backfill_coverage_assertion.sql`** — DO $$ RAISE EXCEPTION canonical syntax (verbatim copy target)
- **`supabase/migrations/20260424000001_phase12_drop_worn_public.sql`** — column-drop sibling pattern
- **`supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql`** — post-migration assertion precedent (information_schema.columns shape check)
- **`scripts/refresh-counts.ts`** — closest sibling for D-01 standalone script (single read, exit code, postgres pool teardown)
- **`scripts/backfill-catalog.ts`** — sibling shape (relative imports, env-file pattern)
- **`tests/api/extract-watch-auth.test.ts`** — exact pattern for TEST-05's mock setup
- **`tests/components/watch/WatchForm.isChronometer.test.tsx`** — exact pattern for TEST-06 component tests (PointerEvent polyfill, mocks, selectors)
- **`tests/components/notifications/NotificationRow.test.tsx`** — three describe blocks to delete + the stub-click test (lines 162, 181, 327)
- **`tests/integration/{phase12-visibility-matrix,home-privacy}.test.ts`** — wornPublic seed sites
- **`tests/data/{getFeedForUser,getWearRailForViewer}.test.ts`** — wornPublic anchor tests + helper parameter

### Secondary (MEDIUM confidence)

- **`~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md`** — drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`
- **`~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_local_db_reset.md`** — local re-apply workflow
- **`docs/deploy-db-setup.md`** — Footgun T-XX-... pattern + backout-plan precedent (Phase 17 §17.6, Phase 21 §SMTP backout)
- **`vitest.config.ts`** — test framework setup (jsdom env, alias resolution, `server-only` shim)
- **`tests/setup.ts`** — global test polyfills (PointerEvent NOT in setup currently; recommend adding)

### Tertiary (LOW confidence — none flagged for validation)

None — every load-bearing claim has a primary or secondary source.

---

## Metadata

**Confidence breakdown:**

- Migration SQL: **HIGH** — pattern verified against three sibling files
- Preflight script shape: **HIGH** — verified against three sibling scripts
- Type-narrowing impact map: **HIGH** — every site enumerated by line number with file content read
- wornPublic rewrite per-file plan: **HIGH** — every file read end-to-end; CONTEXT.md author flagged the empirical 4-vs-9 discrepancy and we confirmed it
- TEST-04: **MEDIUM** — store shape verified; CONTEXT.md description of CRUD/getFilteredWatches doesn't match current code (A3, A4 in Assumptions)
- TEST-05: **HIGH** — route handler read end-to-end; mock pattern verified against existing auth-gate test
- TEST-06: **HIGH** — three components read; existing pattern verified at WatchForm.isChronometer.test.tsx
- Common pitfalls: **HIGH** — every pitfall traced to a specific code path or sibling precedent
- Validation architecture: **HIGH** — test commands verified by reading vitest.config.ts and package.json

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (stable enough for a 30-day window — Postgres ENUM patterns and Drizzle 0.45.x are stable; only Next.js 16 has the AGENTS.md flag for "training data may be wrong")

---

## RESEARCH COMPLETE

**Phase:** 24 — Notification Stub Cleanup + Test Fixture & Carryover
**Confidence:** HIGH

### Key Findings

- **Empirically only 4 files (not 9) reference `wornPublic`** — verified by grep; CONTEXT.md flagged this as documentation drift; researcher confirmed.
- **Pitfall 2 — strict whitelist preflight is safer than CONTEXT.md's blacklist phrasing.** Recommend `type::text NOT IN ('follow','watch_overlap')` over `type IN ('price_drop','trending_collector')` for both script and in-migration `DO $$` block; same coverage for known case + catches unknown corruption.
- **CONTEXT.md D-02's TEST-04 scope mentions store shape that doesn't exist today** — `useWatchStore` has only `setFilter`/`resetFilters`, no CRUD or `getFilteredWatches()`. Planner must align with current code, not CONTEXT.md text.
- **Aggressive narrowing exit-criterion is `npm test` clean + grep showing only the migration file matches** — TS compiler is the deletion oracle; grep is the second verifier (Pitfall 3).
- **Migration filename:** `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (matches sibling timestamp pattern).
- **No runtime state outside the DB rows touched** — no pg_cron job, no Datadog tags, no n8n workflows, no OS-level state references the dead enum values.
- **Sequencing is BLOCKING:** Plan that ships `supabase db push --linked` MUST be `autonomous: false`; Drizzle pgEnum update lands in a SEPARATE plan AFTER prod migration confirms.

### File Created

`.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Migration SQL + preflight | HIGH | Three sibling migrations verified; precedent solid |
| Type narrowing map | HIGH | Every site enumerated by line; full file reads |
| wornPublic rewrite | HIGH | Empirically reconciled count + per-file plan |
| TEST-04 | MEDIUM | CONTEXT.md / current code shape mismatch (A3/A4) — flag for user |
| TEST-05 + TEST-06 | HIGH | Existing patterns verified |
| Pitfalls | HIGH | All traced to code paths or precedents |
| Validation architecture | HIGH | Commands verified |

### Open Questions

1. Whitelist vs. blacklist preflight phrasing (recommendation: whitelist)
2. Does `useWatchStore` have CRUD/getFilteredWatches today? (researcher: no — TEST-04 scope shrinks accordingly)
3. Is "Zod input shape rejection" in TEST-05 D-02 aspirational? (researcher: yes — recommend deferring Zod adoption)

### Ready for Planning

Research complete. Planner can now create 24-NN-PLAN.md files. Recommended plan structure (~6-8 plans):

1. `24-01-PLAN.md` — Wave 0: preflight script + new test files RED scaffolds (independent — can land first)
2. `24-02-PLAN.md` — Migration SQL file written (commits to repo; not yet applied)
3. `24-03-PLAN.md` — **[BLOCKING]** `supabase db push --linked` to apply migration to prod (`autonomous: false`)
4. `24-04-PLAN.md` — Drizzle pgEnum narrows in `src/db/schema.ts` (post-prod-apply)
5. `24-05-PLAN.md` — Aggressive type-narrowing sweep (D-03; TS-error-guided deletion)
6. `24-06-PLAN.md` — wornPublic test fixture rewrites (D-04; 4 files)
7. `24-07-PLAN.md` — TEST-04 (watchStore filter reducer)
8. `24-08-PLAN.md` — TEST-05 + TEST-06 (extract-watch + WatchForm/FilterBar/WatchCard)

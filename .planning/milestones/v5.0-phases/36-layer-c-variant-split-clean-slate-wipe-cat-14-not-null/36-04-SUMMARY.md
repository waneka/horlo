---
phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
plan: 04
subsystem: testing
tags: [vitest, integration, rls, schema-push, local-docker, postgres, drizzle, supabase, cat-14]

# Dependency graph
requires:
  - phase: 36-01
    provides: Drizzle schema additions (watchVariants, watches.variantId) — types under test
  - phase: 36-02
    provides: supabase/migrations/20260511000000_phase36_layer_c_variants.sql — the DDL applied to local Docker and statically inspected by V-10
  - phase: 36-03
    provides: drizzle/0009_phase36_layer_c_variants.sql + journal idx=9 — Drizzle migration twin (idempotent guards verified by being already-applied schema being safe to push again)
provides:
  - Local Docker DB with full Phase 36 schema applied (watch_variants table + watches.variant_id column + watches.catalog_id NOT NULL flip)
  - tests/integration/phase36-rls.test.ts — 13 it() blocks covering V-01..V-11 + 1 extra V-09 INSERT NULL rejection test
  - Verified RLS + FK + UNIQUE + CAT-14 contract — all green against local Docker
affects: [36-05 (prod-deploy gate), 37+, 38 (CAT-13 engine rewire — DAL flow rewrite that completes Phase 36's deferred Pitfall 6)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "phase36-rls.test.ts mirror of phase34-rls.test.ts — verbatim header + localhost guard + describe.skip + service-role db + anon supabase-js dual-client pattern"
    - "drizzle/postgres-js error introspection — SQLSTATE codes live on `.cause.code`, NOT top-level — required for rejection assertions"
    - "pg_constraint.confdeltype = 'n' (SET NULL) / 'r' (RESTRICT) lookup pattern for FK cascade behavior assertions"
    - "fs.readFile guard on supabase migration source — V-10 static check that DO $$ pre-flight is the FIRST statement after BEGIN"

key-files:
  created:
    - "tests/integration/phase36-rls.test.ts (189 lines, 13 it() blocks)"
    - ".planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-04-SUMMARY.md"
  modified:
    - "[local Docker DB only] applied 20260511000000_phase36_layer_c_variants.sql via docker exec psql"

key-decisions:
  - "Drizzle error-shape adjustment: postgres-js errors are wrapped by drizzle in a `Failed query: ...` Error whose underlying SQLSTATE code lives on `.cause.code`. The plan's literal `.toMatchObject({ code: '23502' })` assertions failed on top-level — fixed to `.toMatchObject({ cause: { code: '23502' } })`. Pattern propagates to any future plan that asserts on rejected db.execute() promises."
  - "Drizzle-kit push skipped: drizzle-kit prompts interactively for column-rename resolution against pre-existing snapshot drift (snapshots stop at 0006, live DB has 0007/0008/0009 applied via supabase migrations). Push is informational here — the live DB shape ALREADY matches src/db/schema.ts because the supabase migration creates the exact same shape. Types (from schema.ts) match prod (from supabase DDL) by construction. Documented as deviation Rule 3 below."
  - "Plan must-have 'Drizzle types match prod constraint: InferSelectModel<typeof watches>.catalogId is `string` (not `string | null`)' SKIPPED — Plan 01 deferred the `.notNull()` tightening to Phase 38 per Rule 4 (cascading 18-error tsc cascade across DAL + 17 test fixtures). See 36-01-SUMMARY.md § Deviations and deferred-items.md Item 1. This was a known cascade documented at the top of this plan's spec."

patterns-established:
  - "Phase-XX-rls.test.ts template: localhost guard at module top → maybe = (env present + localhost) ? describe : describe.skip → service-role drizzle db client + anon supabase-js client per-it → has_table_privilege + pg_constraint introspection + actual INSERT rejection assertions"
  - "fs.readFile static guard on migration files — proves a structural invariant (e.g., DO $$ pre-flight is the FIRST statement) at the source-file level, complementing runtime DB-state assertions"

requirements-completed: [CAT-17, CAT-14]

# Metrics
duration: 9min
completed: 2026-05-11
---

# Phase 36 Plan 04: Local Schema Push + Integration Test Suite Summary

**Phase 36 schema fully applied to local Docker DB + 13-block phase36-rls.test.ts integration suite passing green, mirroring the Phase 34 pattern verbatim with watch_variants/CAT-14 specifics**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-11T21:32:12Z
- **Completed:** 2026-05-11T21:40:51Z
- **Tasks:** 2 (Task 1 = DB state change, no commit; Task 2 = test file + commit)
- **Files modified:** 1 (tests/integration/phase36-rls.test.ts, +189 lines)

## Accomplishments

- **Local Docker DB has Phase 36 schema:** watch_variants 10-column table with UNIQUE (catalog_id, slug) + ON DELETE RESTRICT FK + RLS policy + anon SELECT grant + BEFORE-UPDATE trigger; watches.variant_id nullable FK with ON DELETE SET NULL; watches.catalog_id NOT NULL (CAT-14 flip applied).
- **Integration test suite:** tests/integration/phase36-rls.test.ts — 13 it() blocks covering V-01..V-11 + a V-09 INSERT NULL catalog_id rejection — all passing against local Docker.
- **V-12 parity gate green:** grep for `variant_id|variantId` in src/data, src/app, src/lib, src/components returns 0 matches — additive nullable column not yet consumed by any UI/DAL code (correct for Phase 36 schema-only scope).
- **tsc baseline preserved:** post-edit tsc error count = 27 (matches pre-Phase-36 baseline documented in deferred-items.md § "Pre-existing baseline"). No NEW errors introduced.

## Task Commits

Task 1 (`[BLOCKING] Apply Phase 36 schema to local Docker DB`) — **no source-file commit** per plan spec `<files>(no source files modified — DB state change only)</files>`. DB-state change verified by 5/5 acceptance criteria (\dt + is_nullable + has_table_privilege + count + variant_id column existence).

Task 2 (`Write tests/integration/phase36-rls.test.ts and run it green`) — **`2347cd9`** (test)
- 189 lines, 13 it() blocks, 16 T-36-XX threat references, all green.

**Plan metadata commit:** (this commit — created after STATE.md + ROADMAP.md update)

## Files Created/Modified

- `tests/integration/phase36-rls.test.ts` — NEW. Mirror of phase34-rls.test.ts with watch_variants/CAT-14 specifics. 13 it() blocks:
  1. `has_table_privilege: anon can SELECT watch_variants` (V-05, T-36-02)
  2. `anon supabase-js SELECT * FROM watch_variants works` (V-05, T-36-02)
  3. `anon supabase-js INSERT INTO watch_variants fails with RLS` (V-06, T-36-01)
  4. `watches.catalog_id is NOT NULL after Phase 36` (V-08, T-36-04, CAT-14)
  5. `INSERT into watches with NULL catalog_id fails with NOT NULL violation` (V-09, CAT-14) — **asserts `.cause.code === '23502'`**
  6. `watch_variants table has all 10 expected columns in order` (V-02)
  7. `watch_variants.catalog_id is NOT NULL` (V-03)
  8. `watch_variants has UNIQUE (catalog_id, slug)` (V-04)
  9. `watches.variant_id FK has ON DELETE SET NULL` (V-07, D-04)
  10. `watches.catalog_id FK has ON DELETE SET NULL preserved` (V-11, Phase 17 D-04)
  11. `watch_variants.catalog_id FK has ON DELETE RESTRICT` (V-01, T-36-03, D-03)
  12. `INSERT into watch_variants with non-existent catalog_id fails with FK violation` (V-01, T-36-03) — **asserts `.cause.code === '23503'`**
  13. `Phase 36 supabase migration has DO $$ as its FIRST statement after BEGIN` (V-10, ROADMAP success #3) — **fs.readFile static guard**

## Schema Introspection Output

`\d watch_variants` (post-migration, local Docker):

```
                             Table "public.watch_variants"
      Column      |           Type           | Collation | Nullable |      Default
------------------+--------------------------+-----------+----------+-------------------
 id               | uuid                     |           | not null | gen_random_uuid()
 catalog_id       | uuid                     |           | not null |
 name             | text                     |           | not null |
 slug             | text                     |           | not null |
 dial_color       | text                     |           |          |
 bezel            | text                     |           |          |
 bracelet_variant | text                     |           |          |
 image_url        | text                     |           |          |
 created_at       | timestamp with time zone |           | not null | now()
 updated_at       | timestamp with time zone |           | not null | now()
Indexes:
    "watch_variants_pkey" PRIMARY KEY, btree (id)
    "watch_variants_catalog_id_idx" btree (catalog_id)
    "watch_variants_catalog_slug_unique" UNIQUE CONSTRAINT, btree (catalog_id, slug)
Foreign-key constraints:
    "watch_variants_catalog_id_fkey" FOREIGN KEY (catalog_id) REFERENCES watches_catalog(id) ON DELETE RESTRICT
Referenced by:
    TABLE "watches" CONSTRAINT "watches_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES watch_variants(id) ON DELETE SET NULL
Policies:
    POLICY "watch_variants_select_all" FOR SELECT
      USING (true)
Triggers:
    watch_variants_set_updated_at_trg BEFORE UPDATE ON watch_variants FOR EACH ROW EXECUTE FUNCTION watch_variants_set_updated_at()
```

`SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id'` → `NO` (CAT-14 flip applied).

`SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT')` → `t` (anon read enabled).

`SELECT count(*) FROM watch_variants` → `0` (table shipped empty per D-06 — population deferred to Phase 39).

## Vitest Output

```
 RUN  v2.1.9 /Users/tylerwaneka/Documents/horlo

 ✓ tests/integration/phase36-rls.test.ts (13 tests) 116ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  14:39:25
   Duration  1.19s
```

All 13 tests green. Run command (with env loaded from .env.local):
```bash
set -a; source .env.local; set +a; npx vitest run tests/integration/phase36-rls.test.ts
```

## V-12 Parity Grep

```bash
$ grep -rln 'variant_id|variantId' src/data src/app src/lib src/components | wc -l
0
```

Phase 36 ships `watches.variant_id` as a nullable additive column. ROADMAP success #5 (parity) requires zero existing DAL/UI references. Verified.

## tsc Baseline Diff

```bash
$ npx tsc --noEmit 2>&1 | grep -c "error TS"
27
```

Matches pre-Phase-36 baseline (documented in deferred-items.md § "Pre-existing baseline"). Plan 04 introduced ZERO new tsc errors.

## Decisions Made

- **Drizzle wrapped-error assertion pattern:** drizzle-orm wraps the underlying postgres-js error in a `Failed query: ... params: ...` Error object. The SQLSTATE code (23502 NOT NULL, 23503 FK violation, 42501 insufficient privilege, etc.) lives on `error.cause.code`, not `error.code`. Assertions on rejected `db.execute()` promises MUST use `.rejects.toMatchObject({ cause: { code: '23502' } })`. Documented inline in tests/integration/phase36-rls.test.ts. Future test plans should follow this pattern.
- **Drizzle-kit push deferred / not required:** drizzle-kit push prompted for interactive column-rename resolution because the in-tree snapshots stop at 0006 (Phase 33 era) while the live local DB has 0007/0008/0009 applied via the Supabase migration channel. The supabase migration creates the exact same shape that `src/db/schema.ts` declares, so type-level "Drizzle matches prod" is preserved by construction — drizzle-kit push is informational only here. The 5/5 acceptance criteria in Task 1 all verify the live DB shape directly, independent of push success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Wrong assertion path for drizzle-wrapped postgres-js errors (V-09 + V-01 INSERT rejection tests)**
- **Found during:** Task 2 first vitest run — 2 it() blocks failed with `expected Error: Failed query: … to match object { code: '23502' }` / `{ code: '23503' }`.
- **Issue:** Plan spec used `.rejects.toMatchObject({ code: '23502' })` / `{ code: '23503' }` to assert PG SQLSTATE codes. drizzle-orm wraps the underlying postgres-js `PostgresError` inside a `Failed query: ...` Error whose `code` field is `undefined` — the SQLSTATE actually lives on `error.cause.code`. Probed empirically via a one-off `scripts/probe-error.ts` (deleted after diagnosis).
- **Fix:** Changed both assertions to `.rejects.toMatchObject({ cause: { code: '23502' } })` and `.rejects.toMatchObject({ cause: { code: '23503' } })` respectively. Added inline comment documenting the wrapping behavior for future readers.
- **Files modified:** tests/integration/phase36-rls.test.ts (V-09 + V-01 it() blocks, +2 inline comments)
- **Verification:** Re-ran vitest — 13/13 pass.
- **Committed in:** 2347cd9 (Task 2 commit, single commit includes the fix).

**2. [Rule 3 — Blocking] drizzle-kit push prompts interactively for snapshot drift, blocking non-TTY execution**
- **Found during:** Task 1 Command 2 (`drizzle-kit push`).
- **Issue:** drizzle-kit push pulled the local DB schema, diffed against `src/db/schema.ts`, and prompted for "did you rename column X?" resolution. The snapshots in `drizzle/meta/` only go up to 0006 (Phase 33), while the live DB has 0007 (brands/families) + 0008 (lineage) + 0009 (variants) applied via the Supabase migration channel. The TTY check (`process.stdin.isTTY`) fails in the executor environment. `--force` flag did not bypass; `script -q /dev/null` wrapper produced silent output.
- **Resolution:** Drizzle-kit push is NOT load-bearing for this plan's verification. The 5/5 Task 1 acceptance criteria all directly verify the live DB shape via `docker exec psql ...` queries, and the supabase migration creates the exact column shape that `src/db/schema.ts` declares — so Drizzle types match the live DB shape by construction. The "push" is informational diff-checking, not the source of truth.
- **Files modified:** none (DB state was already correct via the supabase migration application in Command 3).
- **Verification:** All 5 Task 1 acceptance criteria + all 13 Task 2 vitest tests pass against the live DB shape.
- **Committed in:** N/A (no source change required).

### Plan Must-Have Not Met (Documented Skip)

**Must-have:** "Drizzle types match prod constraint: `InferSelectModel<typeof watches>.catalogId` is `string` (not `string | null`) — proven by tsc"

**Skipped per:** Plan 01's Rule 4 deviation. Plan 01 deferred the `.notNull()` tightening on `watches.catalogId` to Phase 38 because applying it triggered an 18-error tsc cascade across `src/data/watches.ts:184` (production DAL) + `src/app/actions/watches.ts:88-135` + `src/app/actions/wishlist.ts:124` (legacy "insert NULL then UPDATE" flow) + 17 integration test fixtures. The cascade requires rewriting `createWatch(userId, data)` to `createWatch(userId, data, catalogId)` — out of Plan 01's `src/db/schema.ts`-only scope and equally out of Plan 04's testing-only scope.

**Cross-references:**
- `36-01-SUMMARY.md` § Deviations (the original Rule 4 deferral)
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/deferred-items.md` Item 1 (full handoff to Phase 38)

**Prod-side impact:** ZERO. The CAT-14 NOT NULL flip is applied at the database level via Plan 02's supabase migration (verified live in this plan's Task 1 — `is_nullable = NO`). The temporary Drizzle/DB type-level drift on this one column is the documented cost; resolves in Phase 38 when the DAL flow is rewritten.

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking) + 1 must-have skipped (inherited Plan 01 Rule 4 deferral).
**Impact on plan:** All deviations necessary. The Rule 1 fix was load-bearing (test wouldn't have validated the contract without it). The Rule 3 deviation has zero functional impact (the live DB shape is what the test validates, not the diff tool). The must-have skip was a known/documented inherited deferral — no new technical debt introduced by this plan.

## Issues Encountered

- **vitest env loading:** vitest does not auto-load `.env.local` (no plugin configured in `vitest.config.ts`). Tests skipped silently with `13 skipped` until env vars were sourced via `set -a; source .env.local; set +a; npx vitest run …`. Documented in the SUMMARY's Vitest Output section for future test runs.

## Phase 36 Wave 2 → Wave 3 Readiness

Wave 2 closed. Local DB has Phase 36 schema; integration suite proves all CAT-17 + CAT-14 contracts (RLS + FK + UNIQUE + NOT NULL) are alive in the database.

**Ready for Wave 3 Plan 05 (autonomous:false prod-deploy gate):**
- Plan 05 is the prod-push gate (`supabase db push --linked` against prod).
- Plan 05's preconditions are now satisfied: schema-only Phase 36 contract proven green at local DB level; deploy-time invariants (DO $$ pre-flight FIRST, RLS shape, FK cascade behavior) all encoded as integration assertions that prod-side smoke can re-run if desired.
- Phase 38 must absorb the Pitfall 6 `.notNull()` tightening + DAL flow rewrite (handoff in `deferred-items.md` Item 1).

## Self-Check: PASSED

- ✅ tests/integration/phase36-rls.test.ts exists (189 lines, 13 it() blocks)
- ✅ Commit 2347cd9 exists in `git log --oneline`: `test(36-04): add Phase 36 RLS + schema introspection integration test`
- ✅ Local DB shape verified live: \d watch_variants 10 columns + UNIQUE + FK RESTRICT; watches.catalog_id is_nullable = NO; anon has SELECT privilege
- ✅ Vitest: 13 passed / 0 failed / 0 skipped (with .env.local sourced)
- ✅ V-12 parity grep: 0 matches across src/data, src/app, src/lib, src/components
- ✅ tsc baseline: 27 errors (matches pre-Phase-36 baseline)

---
*Phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null*
*Completed: 2026-05-11*

---
phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
plan: 03
subsystem: database
tags: [drizzle, migration, idempotent, journal, watch-variants, cat-14, cat-17]

# Dependency graph
requires:
  - phase: 36
    plan: 01
    provides: watchVariants pgTable Drizzle definition + watches.variantId column — Plan 03's SQL twin mirrors the column shape verbatim
  - phase: 36
    plan: 02
    provides: supabase/migrations/20260511000000_phase36_layer_c_variants.sql authoritative DDL — Plan 03's Drizzle file is the structural twin (no RLS/GRANT/DO $$ pre-flight)
  - phase: 35
    provides: drizzle/0008_phase35_layer_b.sql idempotent pattern (CREATE TABLE IF NOT EXISTS + DO $$ IF NOT EXISTS pg_constraint FK guards + CREATE INDEX IF NOT EXISTS) — Plan 03 mirrors verbatim
  - phase: 34
    plan: 01
    provides: journal-append-in-same-commit lesson (without the idx entry, drizzle-kit silently skips the new SQL) — Plan 03 ships both edits in commit 04fdfe3
provides:
  - "drizzle/0009_phase36_layer_c_variants.sql — 64-line idempotent Drizzle structural twin (CREATE TABLE IF NOT EXISTS watch_variants + ADD COLUMN IF NOT EXISTS variant_id + DO $$ FK guards + CREATE INDEX IF NOT EXISTS + CAT-14 SET NOT NULL re-sync); locally re-runnable after `supabase db reset` + `drizzle-kit push`"
  - "drizzle/meta/_journal.json idx=9 entry (tag: 0009_phase36_layer_c_variants, version: 7, breakpoints: true) — required for drizzle-kit migrate to recognize the new SQL"
affects: [phase-36-plan-04, phase-36-plan-05, phase-38, phase-39]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent Drizzle migration via CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + DO $$ IF NOT EXISTS pg_constraint FK guards + CREATE INDEX IF NOT EXISTS — verbatim mirror of Phase 35's drizzle/0008_phase35_layer_b.sql pattern"
    - "Journal append in SAME commit as the SQL file (idx=9 entry alongside 0009_*.sql creation) — closes the Phase 34 Plan 01 silent-skip footgun where drizzle-kit migrate ignores any SQL file lacking a journal entry"
    - "Idempotent SET NOT NULL — final statement `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` is a no-op against an already-NOT-NULL column per Postgres semantics; only does real work against a fresh local DB where the Supabase Phase 36 migration has not yet applied"

key-files:
  created:
    - "drizzle/0009_phase36_layer_c_variants.sql — 64 lines. Structural twin of supabase/migrations/20260511000000_phase36_layer_c_variants.sql with idempotent guards for local re-sync flow."
  modified:
    - "drizzle/meta/_journal.json — appended idx=9 entry; total entries grew 9 → 10"

key-decisions:
  - "Filename prefix locked at 0009 — strictly the next integer after 0008_phase35_layer_b.sql (no insertion between adjacent integers per memory rule project_drizzle_supabase_db_mismatch.md rule 2 mirror)"
  - "Journal `when` field captured via `node -e 'process.stdout.write(String(Date.now()))'` = 1778534674854 — plain integer literal, not a JavaScript expression (drizzle-kit treats it as opaque epoch ms)"
  - "Drizzle file carries column shapes ONLY — zero RLS, zero GRANT, zero DO $$ pre-flight, zero CHECK, zero trigger. The authoritative DDL lives exclusively in the Supabase migration sibling. Drizzle/Supabase split convention preserved per Phase 17/34/35 precedent."
  - "Final statement `ALTER COLUMN catalog_id SET NOT NULL` shipped as an idempotent no-op-on-already-set safety re-sync (RESEARCH.md §Assumption A1) — does real work only on a fresh local DB; against the Supabase-migrated state it is a metadata no-op"

requirements-completed: [CAT-14, CAT-17]

# Metrics
duration: ~1m 40s
completed: 2026-05-11
---

# Phase 36 Plan 03: Drizzle Migration Twin + Journal Append Summary

**Shipped the 64-line idempotent Drizzle structural twin `drizzle/0009_phase36_layer_c_variants.sql` (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + DO $$ FK guards + CAT-14 SET NOT NULL re-sync; no RLS/GRANT/pre-flight) and appended the `idx=9` entry to `drizzle/meta/_journal.json` in the SAME commit — closes the Phase 34 Plan 01 silent-skip footgun.**

## Performance

- **Duration:** ~1m 40s (100 s)
- **Started:** 2026-05-11T21:24:28Z
- **Completed:** 2026-05-11T21:26:08Z
- **Tasks:** 1 / 1
- **Files created:** 1 (`drizzle/0009_phase36_layer_c_variants.sql`)
- **Files modified:** 1 (`drizzle/meta/_journal.json`)

## Accomplishments

- Wrote `drizzle/0009_phase36_layer_c_variants.sql` (64 lines) as the idempotent structural twin of Plan 02's `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`. Contents:
  - **`CREATE TABLE IF NOT EXISTS "watch_variants"`** with the locked 10-column shape from D-02 (`id`, `catalog_id`, `name`, `slug`, `dial_color`, `bezel`, `bracelet_variant`, `image_url`, `created_at`, `updated_at`); composite `UNIQUE ("catalog_id", "slug")` named `watch_variants_catalog_slug_unique`.
  - **`DO $$ BEGIN ... IF NOT EXISTS pg_constraint ... END $$`** FK guard adding `watch_variants_catalog_id_fk` (`ON DELETE restrict ON UPDATE no action` per D-03) — verbatim Phase 35 pattern.
  - **`CREATE INDEX IF NOT EXISTS "watch_variants_catalog_id_idx"`** btree on FK.
  - **`ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "variant_id" uuid`** (D-04 — nullable additive).
  - **`DO $$ BEGIN ... END $$`** FK guard adding `watches_variant_id_fk` (`ON DELETE set null ON UPDATE no action` per D-04).
  - **`CREATE INDEX IF NOT EXISTS "watches_variant_id_idx"`** btree on FK.
  - **`ALTER TABLE "watches" ALTER COLUMN "catalog_id" SET NOT NULL`** — idempotent CAT-14 safety re-sync (no-op against already-NOT-NULL column per Postgres semantics).
  - 6 `--> statement-breakpoint` markers separating the 6 logical statements (drizzle-kit splits on these when streaming statements to the connection).
- Appended `idx=9` entry to `drizzle/meta/_journal.json`:
  ```json
  {
    "idx": 9,
    "version": "7",
    "when": 1778534674854,
    "tag": "0009_phase36_layer_c_variants",
    "breakpoints": true
  }
  ```
  Total entries grew 9 → 10. `when` field captured via `node -e "process.stdout.write(String(Date.now()))"` and substituted as a plain integer literal (no JS expression). Trailing-comma trap avoided: idx=8 (now second-to-last) gained a comma; idx=9 (new last) closes the array cleanly.
- Both edits shipped in commit `04fdfe3` — same commit per the Phase 34 Plan 01 lesson (STATE.md decision): without the journal entry, `drizzle-kit migrate` silently skips 0009 in prod and the `__drizzle_migrations` row count stays unchanged.
- All 13 plan acceptance criteria verified by automated grep + jq + node JSON.parse:

| AC  | Check                                                                                                  | Result                              |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | `test -f drizzle/0009_phase36_layer_c_variants.sql`                                                    | PASS (exists)                       |
| 2   | `grep -c 'CREATE TABLE IF NOT EXISTS "watch_variants"' …0009….sql`                                     | 1                                   |
| 3   | `grep -c 'ADD COLUMN IF NOT EXISTS "variant_id"' …0009….sql`                                           | 1                                   |
| 4   | `grep -c 'watch_variants_catalog_id_fk' …0009….sql` (>=2)                                              | 2                                   |
| 5   | `grep -c 'watches_variant_id_fk' …0009….sql` (>=2)                                                     | 2                                   |
| 6   | `grep -c 'ON DELETE restrict ON UPDATE no action' …0009….sql` (>=1)                                    | 1                                   |
| 7   | `grep -c 'ON DELETE set null ON UPDATE no action' …0009….sql` (>=1)                                    | 1                                   |
| 8   | `grep -c 'ALTER COLUMN "catalog_id" SET NOT NULL' …0009….sql`                                          | 1                                   |
| 9   | `grep -ciE "ROW LEVEL SECURITY\|^GRANT\|CREATE POLICY" …0009….sql`                                     | 0                                   |
| 10  | `grep -c "^--> statement-breakpoint$" …0009….sql` (>=6)                                                | 6                                   |
| 11  | `node -e "…require('./drizzle/meta/_journal.json').entries.find(x=>x.idx===9)…"` shape check           | `{"idx":9,"version":"7","when":1778534674854,"tag":"0009_phase36_layer_c_variants","breakpoints":true}` |
| 12  | `node -e "JSON.parse(require('fs').readFileSync('drizzle/meta/_journal.json','utf8'))"`                | PASS (valid JSON)                   |
| 13  | `node -e "console.log(require('./drizzle/meta/_journal.json').entries.length)"`                        | 10                                  |
- Bonus verification: `jq . drizzle/meta/_journal.json > /dev/null` exits 0 (independent JSON validator). Line count: `wc -l drizzle/0009_phase36_layer_c_variants.sql` = 64 (within expected 50–60 range ± a few).
- Post-commit deletion check: zero deletions. Post-commit untracked check: only the pre-existing `.planning/milestones/v4.0-research/` directory which is unrelated to this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write drizzle/0009_phase36_layer_c_variants.sql AND append idx=9 to drizzle/meta/_journal.json** — `04fdfe3` (feat)

_(Final metadata commit covering SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md follows.)_

## Files Created/Modified

- `drizzle/0009_phase36_layer_c_variants.sql` — NEW, 64 lines. Idempotent Drizzle structural twin of Plan 02's Supabase migration. No RLS, no GRANT, no DO $$ pre-flight.
- `drizzle/meta/_journal.json` — appended idx=9 entry; total entries grew 9 → 10. JSON still parses cleanly via `jq` and `node JSON.parse`.

## Decisions Made

- **Used Phase 35 idempotent pattern verbatim.** `drizzle/0008_phase35_layer_b.sql` is the locked analog: same `CREATE TABLE IF NOT EXISTS` + `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ...) THEN ALTER TABLE ... ADD CONSTRAINT ... END IF; END $$;` + `CREATE INDEX IF NOT EXISTS` shape. Plan 03's file is a structural mirror with the FK clause swapped for `restrict` vs `set null` per D-03/D-04.
- **`when` field captured at execution time, not hard-coded.** Used `node -e "process.stdout.write(String(Date.now()))"` to get `1778534674854` (substituted as a plain integer literal). drizzle-kit treats this as an opaque epoch ms used for migration ordering display; it does NOT affect actual application order (the `idx` field is what drives ordering).
- **Final `ALTER COLUMN catalog_id SET NOT NULL` shipped as an idempotent no-op-on-already-set safety re-sync** per the additional context block's prescription (and RESEARCH.md §Assumption A1). This statement is the explicit `WITHOUT` exception to the prompt's "DO NOT include CAT-14 SET NOT NULL" — the prompt says NOT to include the FULL CAT-14 flip with the DO $$ pre-flight + RAISE EXCEPTION block (those live in Plan 02), but the bare `ALTER COLUMN SET NOT NULL` IS in the plan's `<action>` block at line 188 and IS an explicit AC (AC8). Re-reading the prompt: the "DO NOT include CAT-14" line refers specifically to the pre-flight DO $$ + RAISE EXCEPTION pattern, which is correctly absent.

## Deviations from Plan

None — the plan executed exactly as written. All Pitfall 1-2 mitigations baked into the action ran clean:

- Pitfall 1 (filename prefix collision) — `0009_phase36_layer_c_variants.sql` is strictly the next integer after `0008_phase35_layer_b.sql` (verified by `ls -1 drizzle/*.sql | tail -3` returning `0006…`, `0007…`, `0008…` before the write).
- Pitfall 2 (journal not appended in same commit) — both edits ship in commit `04fdfe3`; without idx=9, drizzle-kit migrate would silently skip the new SQL in prod (Phase 34 Plan 01 lesson).
- Pitfall 3 (trailing comma in JSON array) — idx=8 entry gained a comma; idx=9 entry closes the array cleanly. `jq . drizzle/meta/_journal.json > /dev/null` exits 0 (independent validator); `node -e "JSON.parse(...)"` also exits 0.
- Pitfall 4 (idx mismatch) — idx=9 = next integer after idx=8. No insertion between adjacent integers per memory rule 2 mirror.
- Pitfall 5 (tag mismatch with filename) — tag `0009_phase36_layer_c_variants` matches filename `0009_phase36_layer_c_variants.sql` minus the `.sql` suffix (drizzle-kit's match key).

No Rule 1/2/3 auto-fixes triggered; no Rule 4 architectural deferrals needed. No authentication gates encountered (this plan only writes 2 files; it does not apply the migration).

## Issues Encountered

None.

## User Setup Required

None for this plan. The Drizzle migration file is written but NOT applied — local application is in Plan 04 (via `drizzle-kit push` against the local Supabase Docker DB after `supabase db reset`), prod application is in Plan 05 (via `drizzle-kit migrate` against the prod Supabase pooler URL).

## Next Phase Readiness

**Phase 36 Plan 04 (local push + integration test, BLOCKING):** READY. The Drizzle file is now part of the journal, so `drizzle-kit push` (local) and `drizzle-kit migrate` (prod) will both pick it up. Plan 04 should:
- Run `supabase db reset` to wipe local Docker DB
- Run `drizzle-kit push` to apply 0000–0009 fresh (including this plan's 0009)
- Selectively apply `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` via `docker exec psql` to get the RLS + GRANT + DO $$ assertions exercised
- Write `tests/integration/phase36-*.test.ts` asserting the same invariants that Plan 02's end-of-migration DO $$ block verifies (table exists, FK cascade clauses correct, RLS policies present, `is_nullable = 'NO'` on `watches.catalog_id`)

**Phase 36 Plan 05 (prod-deploy gate, autonomous:false):** READY. `drizzle-kit migrate` against the prod Supabase pooler URL will apply 0009 because the journal idx=9 entry is in place. The `supabase db push --linked` step will apply the authoritative Supabase migration (Plan 02). Both migrations are designed to be applied in either order (idempotent guards on the Drizzle side; transactional safety on the Supabase side).

**Phase 38 (CAT-13 Engine Rewire):** UNCHANGED — the Drizzle-side `.notNull()` tightening on `watches.catalogId` is still deferred (Plan 01 deferred-items.md Item 1). This plan's `ALTER COLUMN catalog_id SET NOT NULL` operates at the DB level only; the TypeScript-level guarantee in `InferSelectModel<typeof watches>.catalogId: string` still requires the Phase 38 DAL flow rewrite.

**Phase 39 (audit-driven discovery polish):** UNCHANGED — Phase 39 owns the variant population work (`scripts/seed-data/variants.json` + backfill script + anchor variants) plus the lineage/variant browse UI.

**Blockers/Concerns:**
- None. Wave 1 of Phase 36 (Plans 01 + 02 + 03) is now complete; Plan 04 can begin (Wave 2).

## Self-Check: PASSED

**File existence checks:**
- `drizzle/0009_phase36_layer_c_variants.sql`: FOUND (created)
- `drizzle/meta/_journal.json`: FOUND (modified)

**Commit hash check:**
- `04fdfe3`: FOUND in `git log --oneline -1`

**Grep contract checks (all 13 plan ACs — see table above):**
- All 13 ACs verified via grep / jq / node JSON.parse. Counts captured in the ACs table.

---
*Phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null*
*Completed: 2026-05-11*

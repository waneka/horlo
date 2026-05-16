---
phase: 35
slug: layer-b-lineage-edges-structured-movement-era-material
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-09
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 35-RESEARCH.md §12 Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | quick: ~3s · full: ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` (G1–G3)
- **After every plan wave:** Run `npx vitest run` (full suite — G8)
- **Before `/gsd-verify-work`:** All 9 gates (G1–G9) must be green
- **Max feedback latency:** ~30 seconds (full suite)

---

## Per-Task Verification Map

> Planner fills this table during step 8. Each task referencing CAT-16 must map to ≥1 gate from the table below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 0 | CAT-16 SC#2/3 | — | Static guard tests for hierarchy.ts CTE shape (G1, G2, G3) | unit | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 1 | CAT-16 SC#1/4/5 | T-35-04 | Drizzle pgEnum + table declarations source-of-truth | grep | `grep -c "pgEnum('movement_type_enum'" src/db/schema.ts` returns 1 | ❌ W1 | ⬜ pending |
| 35-02-02 | 02 | 1 | CAT-16 SC#4 | — | MovementType realigned + WatchEra type + Watch.movement optional | grep | `grep -c "export type MovementType = 'auto' \| 'manual' \| 'quartz' \| 'spring_drive'" src/lib/types.ts` returns 1 | ❌ W1 | ⬜ pending |
| 35-02-03 | 02 | 1 | CAT-16 SC#4 | — | MOVEMENT_TYPES + MOVEMENT_LABELS + 2 SUGGESTED lists | grep | `grep -c "MOVEMENT_TYPES = \['auto', 'manual', 'quartz', 'spring_drive'\]" src/lib/constants.ts` returns 1 | ❌ W1 | ⬜ pending |
| 35-02-04 | 02 | 1 | CAT-16 SC#1 | — | Anchor JSON seed files (10 families + 2 lineage edges) | unit (node json) | `node -e "JSON.parse(require('fs').readFileSync('scripts/seed-data/families.json','utf-8')).length === 10"` exits 0 | ❌ W1 | ⬜ pending |
| 35-03-01 | 03 | 2 | CAT-16 SC#4 | T-35-CONS-01 | Zod schema accepts 4 new movement values + optional() + LLM prompt advertises 4-value contract | grep | `grep -c "z.enum(\['auto', 'manual', 'quartz', 'spring_drive'\]).optional()" src/app/actions/watches.ts` returns 1 | ❌ W2 | ⬜ pending |
| 35-03-02 | 03 | 2 | CAT-16 SC#4 | T-35-CONS-03 | shims.ts coerceMovement returns MovementType \| undefined; entry.movementType column read; shims.test.ts asserts undefined-fallback | unit | `npx vitest run src/lib/verdict/shims.test.ts` exits 0 | ❌ W2 | ⬜ pending |
| 35-03-03 | 03 | 2 | CAT-16 SC#4/5 | — | Component fallbacks + WatchForm dropdown + 8 test fixtures use 'auto' (not 'automatic') | unit | `npx vitest run src/components src/lib` exits 0 | ❌ W2 | ⬜ pending |
| 35-03-04 | 03 | 2 | CAT-16 SC#4/5 | — | DAL movement column rewrite: catalog.ts upsert writes movement_type; watches.ts mapper reads movementType | unit | `npx vitest run src/data` exits 0 AND `npx tsc --noEmit` exits 0 | ❌ W2 | ⬜ pending |
| 35-04-01 | 04 | 2 | CAT-16 SC#2/3 | T-35-DAL-01/02/03 | hierarchy.ts created; CYCLE clause + depth<10 + getLineageForReference + server-only — flips Plan 01 to load-bearing-pass (G1, G2, G3) | unit | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` exits 0 with 5 passing tests | ❌ W2 | ⬜ pending |
| 35-05-01 | 05 | 3 | CAT-16 SC#1/4/5 | T-35-01/03/04/05 | Supabase authoritative migration: TRUNCATE + 4 CREATE TYPE + ALTER TABLE + CREATE TABLE watch_lineage_edges + cycle trigger + RLS + DO $$ assertions | grep | `grep -c "CREATE TYPE movement_type_enum AS ENUM" supabase/migrations/20260510000001_phase35_layer_b.sql` returns 1 AND 13+ RAISE EXCEPTION assertions | ❌ W3 | ⬜ pending |
| 35-05-02 | 05 | 3 | CAT-16 SC#1/4/5 | — | Drizzle structural twin migration + journal idx=8 entry (no silent skip) | unit (node json) | `node -e "const j=require('./drizzle/meta/_journal.json'); j.entries[j.entries.length-1].idx === 8"` exits 0 | ❌ W3 | ⬜ pending |
| 35-06-01 | 06 | 3 | CAT-16 SC#1 | T-35-02/SCRIPT-01 | scripts/backfill-catalog-families.ts idempotent insert + family_id link | grep | `grep -c "ON CONFLICT (brand_id, name_normalized) DO NOTHING" scripts/backfill-catalog-families.ts` returns 1 | ❌ W3 | ⬜ pending |
| 35-06-02 | 06 | 3 | CAT-16 SC#1 | — | scripts/backfill-catalog-lineage.ts idempotent insert + ref triple resolver | grep | `grep -c "ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING" scripts/backfill-catalog-lineage.ts` returns 1 | ❌ W3 | ⬜ pending |
| 35-06-03 | 06 | 3 | CAT-16 SC#1/4/5 | T-35-RUNBOOK-01 | package.json scripts wired + Phase 35 deploy runbook section (TRUNCATE warning + 6-step + cycle test) | grep | `grep -c "Phase 35 — Layer B" docs/deploy-db-setup.md` returns 1 AND `grep -c "db:backfill-catalog-families" package.json` returns 1 | ❌ W3 | ⬜ pending |
| 35-07-01 | 07 | 4 | CAT-16 SC#1/3/4/5 | T-35-02 | [BLOCKING] auth.users single-user assumption verified pre-TRUNCATE | manual | psql `SELECT count(*) FROM auth.users` returns 1 | manual | ⬜ pending |
| 35-07-02 | 07 | 4 | CAT-16 SC#4 | T-35-04 | [BLOCKING] pg_depend pre-flight returns 0 rows on movement column (G4) | manual | psql pg_depend query (D-03b) | manual | ⬜ pending |
| 35-07-03 | 07 | 4 | CAT-16 SC#1/4/5 | T-35-01/03/04/05 | supabase db push --linked applies migration atomically; DO $$ assertions pass (G5) | shell | `supabase db push --linked` exits 0 + post-push table/enum existence SELECTs return t/t | manual | ⬜ pending |
| 35-07-04 | 07 | 4 | CAT-16 SC#1 | — | db:backfill-catalog runs against PROD with inline DATABASE_URL override | shell | exit 0 with `[backfill-catalog] OK` | manual | ⬜ pending |
| 35-07-05 | 07 | 4 | CAT-16 SC#1 | — | db:backfill-catalog-brands runs against PROD; unlinked=0 | shell | exit 0 with `unlinked=0` | manual | ⬜ pending |
| 35-07-06 | 07 | 4 | CAT-16 SC#1 | — | db:backfill-catalog-families runs against PROD; 10 families seeded | shell | exit 0 with `inserted=10 skipped=0` (or operator-acknowledged lower) | manual | ⬜ pending |
| 35-07-07 | 07 | 4 | CAT-16 SC#3 | — | db:backfill-catalog-lineage runs against PROD; 2 anchor edges inserted | shell | exit 0 with `inserted=2 skipped=0` (or operator-acknowledged with reason) | manual | ⬜ pending |
| 35-07-08 | 07 | 4 | CAT-16 SC#1/4/5 | T-35-01/04/05 | Smoke-test SELECTs against PROD (G6, G9) | manual | 6 SELECT outputs match expected (anon SELECT=t, families count, edges count, pg_typeof shapes) | manual | ⬜ pending |
| 35-07-09 | 07 | 4 | CAT-16 SC#1 | T-35-03 | Cycle trigger manual smoke (G7) | manual | psql cycle-completing INSERT raises `Lineage cycle detected: ...` exception | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Validation Gate Table (Nyquist Dimension 8)

| Gate | What It Asserts | Where It Runs | Blocking? |
|------|-----------------|---------------|-----------|
| G1 | `hierarchy.ts` source contains `CYCLE id SET is_cycle USING path` AND `depth < 10` in every WITH RECURSIVE | `vitest run tests/static/hierarchy.lineage-3-node.test.ts` | YES |
| G2 | `getLineageForReference` exported from `src/data/hierarchy.ts` | Same test file (static scan) | YES |
| G3 | `hierarchy.ts` imports `'server-only'` | Same test file (static scan) | YES |
| G4 | `pg_depend` query returns no unexpected dependents on `movement` column before DROP | Manual SQL (D-03b) in deploy runbook | YES |
| G5 | Migration runs as a single transaction with no `RAISE EXCEPTION` from invariant `DO $$ ... END $$` blocks | `supabase db push --linked` (implicit; tx aborts on failure) | YES |
| G6 | Smoke counts: `watch_families = 10`, `watch_lineage_edges = 2`, anon SELECT on `watch_lineage_edges = true` | Manual SQL in deploy runbook (CONTEXT §Specifics) | YES |
| G7 | INSERT of cycle-completing edge raises `Lineage cycle detected: ... -> ...` | Manual SQL cycle smoke test (deploy runbook) | YES |
| G8 | Full vitest suite green (no TypeScript errors surface; no regressions from movement enum + Watch.movement retype) | `npx vitest run` | YES |
| G9 | `pg_typeof(movement_type)` returns `movement_type_enum`; `pg_typeof(era)` returns `watch_era` | Manual SQL in deploy runbook | YES |

---

## Wave 0 Requirements

- [ ] `tests/static/hierarchy.lineage-3-node.test.ts` — covers CAT-16 SC#2 + SC#3 (gates G1, G2, G3). Static source scan: regex over `src/data/hierarchy.ts` body. No live DB required.
- [ ] No framework install needed — Vitest 2.1.9 already configured (vitest.config.ts present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pg_depend` pre-flight returns expected output (likely zero rows) before `DROP COLUMN movement` is committed to the migration file | CAT-16 SC#4 | Requires live prod DB access; runs once before migration write | Run query in CONTEXT.md §D-03b against prod via psql; abort migration write if unexpected dependents (indexes, views, functions) found |
| Cycle trigger raises exception on cycle-completing INSERT | CAT-16 SC#1 | Requires post-deploy DB state with seeded edges; cycle is the absence-of-success path | Setup: A→B, B→C edges already inserted by backfill. Attempt: `INSERT INTO watch_lineage_edges (predecessor_catalog_id, successor_catalog_id, relationship_type) VALUES (C, A, 'successor');` Expect: `RAISE EXCEPTION 'Lineage cycle detected: <C> -> <A>'` |
| Smoke-test SELECT counts (G6) | CAT-16 SC#1, SC#3 | Requires post-backfill DB state | Run the 6 SELECT statements from CONTEXT.md §Specifics §Smoke-test runbook entries; assert each matches expected count |
| Movement enum column shape (G9) | CAT-16 SC#4 | Requires live DB introspection | `SELECT pg_typeof(movement_type) FROM watches_catalog LIMIT 1;` → `movement_type_enum` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (currently: hierarchy static guard test)
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 30s (quick) / < 60s (full)
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the per-task verification map

**Approval:** pending

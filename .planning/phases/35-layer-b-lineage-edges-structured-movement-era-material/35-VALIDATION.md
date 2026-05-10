---
phase: 35
slug: layer-b-lineage-edges-structured-movement-era-material
status: draft
nyquist_compliant: false
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
| 35-01-01 | 01 | 0 | CAT-16 SC#2/3 | — | Static guard tests for hierarchy.ts CTE shape | unit | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` | ❌ W0 | ⬜ pending |
| {planner-fills-rest} | | | | | | | | | |

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

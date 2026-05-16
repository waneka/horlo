---
phase: 34
plan: 04
subsystem: documentation
tags:
  - documentation
  - runbook
  - deploy-docs
  - phase34
  - cat-15
  - layer-a
dependency_graph:
  requires:
    - docs/deploy-db-setup.md (existing — Phase 17 §17.1–§17.6 template; Phase 19.1 local-reset workflow at line 386)
    - 34-01-SUMMARY.md (schema migration filename + RLS policy names being smoke-tested)
    - 34-02-SUMMARY.md (backfill script invocation form + 3-pass idempotent rhythm being documented)
    - 34-CONTEXT.md (D-04, D-05, D-06 LOCKED user decisions)
    - 34-RESEARCH.md (Validation Architecture pitfalls 1–8; static-analysis evidence for DAL parity)
    - 34-PATTERNS.md (deploy-db-setup.md content pattern §522–590)
  provides:
    - docs/deploy-db-setup.md §"Phase 34 — Layer A: Brand + Family Entities Deploy Steps" (§34.0–§34.7)
    - docs/deploy-db-setup.md §"Local DB reset workflow" updated step 4 with 20260510000000_phase34_brands_families.sql
    - Operator-facing T-34-04 footgun mitigation (inline DATABASE_URL override pattern)
    - Three-step migration discipline documentation (CAT-15 SC#5)
    - Phase-34-only backout plan with post-Phase-35 caveat
  affects:
    - Plan 03 (production push) — operator runs Plan 03 from this runbook section, not from Plan 03 PLAN
    - Phase 35 (Layer B) — when Phase 35 ships, the §34.7 backout window closes; runbook caveat already documents this
tech-stack:
  added: []
  patterns:
    - Phase 17 §17.1–§17.6 section structure mirrored verbatim (preconditions → apply migrations → backfill → smoke checks → backout)
    - Footgun-block-with-cross-reference pattern (Phase 17 T-17-BACKFILL-PROD-DB → Phase 34 T-34-04)
    - Three-step migration discipline as a numbered sub-block (CAT-15 SC#5; D-05)
    - Memory anchor cross-references inline (project_supabase_secdef_grants.md REVOKE pattern; project_drizzle_supabase_db_mismatch.md Rule 4 pg_depend)
key-files:
  created: []
  modified:
    - docs/deploy-db-setup.md (+118 lines: §34.0–§34.7 appended after Phase 24 section + 1 new local-reset step)
decisions:
  - D-04 permanent denormalization (LOCKED) — runbook does NOT mention dropping watches_catalog.brand text
  - D-05 three-step migration discipline (LOCKED) — §34.5 explicitly numbers the steps + flags Step 3 as DEFERRED
  - D-06 D-06 runbook content shape (LOCKED) — appended a Phase 34 section per Phase 17 §17.1–§17.6 template; covers migration push + backfill invocation + RLS smoke + two-step prod sequence
  - W4 (planning checker iteration 1) — windowed grep `grep -B2 -A2 "DEFERRED" | grep -c "Phase 34|Step 3"` validates DEFERRED context, not the count digit
  - W5 (planning checker iteration 1) — backfill script described as BRAND-ONLY; family backfill is Phase 35 scope per CONTEXT D-03
metrics:
  duration: ~2 minutes
  completed_date: 2026-05-09
  tasks_completed: 1
  files_created: 0
  files_modified: 1
  commits: 1
  threats_mitigated: 1 (T-34-04)
---

# Phase 34 Plan 04: Deploy Runbook Summary

Appended a 118-line Phase 34 section to `docs/deploy-db-setup.md` (§34.0 pg_depend pre-flight → §34.7 backout plan with post-Phase-35 caveat) and added the Phase 34 migration filename to the local-DB-reset workflow; load-bearing mitigation for Footgun T-34-04 (silent backfill against wrong DB) is now operator-readable in the runbook rather than relying on memory.

## What Shipped

### `docs/deploy-db-setup.md` (MODIFIED — +118 lines)

**New section: `## Phase 34 — Layer A: Brand + Family Entities Deploy Steps`** appended after the Phase 24 section (end of file). Mirrors Phase 17 §17.1–§17.6 shape verbatim.

Section heading list:
- §34.0 — Pre-flight `pg_depend` check (memory rule 4 — query before structural changes touching catalog; expected delta = +2 FKs)
- §34.1 — Apply migrations to prod (`supabase db push --linked` + `npx drizzle-kit migrate` — Drizzle migration is self-idempotent so order-tolerant)
- §34.2 — Run the brand backfill (CAT-15 SC#4; D-03 actually runs on prod) — three invocations: pass A auto-derive, pass B country patch, pass C idempotence proof. **Footgun T-34-04** callout with explicit `DATABASE_URL="<prod-pooler>"` inline override + cross-reference to Phase 17 §17.2 T-17-BACKFILL-PROD-DB precedent.
- §34.3 — Verify RLS truth values (CAT-15 SC#3) — two `has_table_privilege` queries; memory `project_supabase_secdef_grants.md` REVOKE-FROM-PUBLIC pattern referenced.
- §34.4 — Verify backfill row counts (CAT-15 SC#4 / D-03) — five SQL queries (brand_count, brands_with_country, family_count = 0, catalog_unlinked_brand = 0, catalog_unlinked_family = total).
- §34.5 — Three-step migration discipline (CAT-15 SC#5; D-05) — numbered Step 1 (Phase 34) → Step 2 (Phase 35) → Step 3 (DEFERRED, no target phase) with explicit "DEFERRED beyond Phase 34" callout for the NOT NULL flip; future flip migration's pre-flight assertion shape included.
- §34.6 — DAL parity smoke (CAT-15 SC#2) — five eyeball checks; static-analysis evidence cross-referenced (Phase 34 RESEARCH §Pitfall 8: 31 `watchesCatalog` references survive nullable additive columns).
- §34.7 — Backout plan — three SQL statements (DROP empty `watch_families`, DROP `brands` CASCADE, defensive DROP COLUMN); **post-Phase-35 caveat** explicitly preserved (backout becomes unsafe once Phase 35 ships lineage_edges + populates families).

**Updated local-DB-reset workflow** (§Phase 19.1 → "Local DB reset workflow"): appended Step 4 — `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000000_phase34_brands_families.sql`. Sibling step numbering preserved (Steps 1–3 unchanged; new Step 4 added inline within the same code block).

## Verification Evidence

### Acceptance grep gates (15/15 PASS)

| Gate | Threshold | Actual |
|------|-----------|--------|
| `^## Phase 34` | 1 | 1 |
| `^### 34.{1..7}` subsections | ≥7 | 7 |
| `supabase db push --linked` | ≥2 | 12 (existing + new occurrences) |
| `db:backfill-catalog-brands` | ≥3 | 4 (auto + country-patch + idempotence + heading mention) |
| `20260510000000_phase34_brands_families.sql` | ≥2 | 3 (preconditions + local-reset step + Drizzle migration mention) |
| `has_table_privilege('anon', 'public.brands', 'SELECT')` | ≥1 | 1 |
| `has_table_privilege('anon', 'public.watch_families', 'SELECT')` | ≥1 | 1 |
| `T-34-04\|Footgun T-34-04` | ≥1 | 2 |
| `T-17-BACKFILL-PROD-DB` (cross-reference preserved) | ≥2 | 2 (existing Phase 17 + new Phase 34 cross-ref) |
| `three-step` discipline mention | ≥1 | 2 |
| `NOT NULL flip` | ≥1 | 1 |
| W4 windowed-grep `DEFERRED` near `Phase 34\|Step 3` | ≥1 | 2 |
| `DROP TABLE IF EXISTS brands\|watch_families` | ≥2 | 2 |
| `post-Phase-35\|Phase 35 ships\|after Phase 35` caveat | ≥1 | 1 |
| `REVOKE FROM PUBLIC` (memory cross-ref) | ≥1 | 1 |
| File length growth | +≥80 lines | +118 lines (549 → 667) |

### Verification block (per PLAN.md)
`grep -v '^#' docs/deploy-db-setup.md | grep -c '20260510000000_phase34_brands_families.sql\|db:backfill-catalog-brands\|has_table_privilege.*public.brands\|has_table_privilege.*public.watch_families\|T-34-04'` → **10** (well over the implicit ≥5 distinct-phrase threshold).

### Pre-existing sections unmodified

- Phase 17 §17.1–§17.6 (lines 234–322): no edits — verified by `git diff` showing only additions in the local-reset block (line 404+) and the new section appended at end of file.
- Phase 19.1 (lines 324–384): no edits to deploy steps; only the local-reset code block gained one new line (Step 4 — Phase 34 migration apply).
- Phase 21 / Phase 24 sections: no edits.

## Threat Mitigation Status

| Threat | Status | Evidence |
|--------|--------|----------|
| T-34-04 (silent backfill against wrong DB) | mitigated | §34.2 includes explicit Footgun T-34-04 callout describing the symptom (`SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL` returns same value as before), the inline `DATABASE_URL="<prod session-mode pooler URL>"` override pattern, and a cross-reference to Phase 17 §17.2 T-17-BACKFILL-PROD-DB precedent. The script's own final assertion (`raises and exits 1 if non-zero unlinked`) is also documented as the loud-failure backstop. Operators run Phase 34 from the runbook, not from memory — documentation is the long-term mitigation that survives memory churn. |

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | docs | cafcdb1 | append Phase 34 deploy section to deploy-db-setup.md |

## Deviations from Plan

None — plan executed exactly as written. The verbatim section content from PLAN.md `<action>` block was preserved including:
- Exact §34.0–§34.7 subsection structure
- Footgun T-34-04 callout wording
- Three-step migration discipline numbering with DEFERRED Step 3 note
- Backout plan SQL with post-Phase-35 caveat
- Local-reset workflow step appended inside the existing code block (matching the existing numbering convention as Step 4)

The plan's `<action>` example mentioned "Step 9. Apply Phase 34 migration" but the actual local-reset section uses Steps 1–3 (not 1–8 as the plan example assumed); appended as Step 4 to match what's actually in the file. This is not a deviation per the plan's own instruction "match the existing numbering convention in the file" and "the exact step number depends on what's already there".

## Authentication Gates

None — documentation-only change; no auth required.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: docs/deploy-db-setup.md (modified; 667 lines; up from 549 baseline)

**Commits verified to exist (`git log --oneline -3`):**
- FOUND: cafcdb1 docs(34-04): append Phase 34 deploy section to deploy-db-setup.md
- FOUND: 593e5e0 docs(34-02): complete Phase 34 Plan 02 backfill script layer
- FOUND: a7c53f1 chore(34-02): add db:backfill-catalog-brands npm script entry

**All 15 acceptance grep gates PASS** (table above).

**Pre-existing Phase 17 / 19.1 / 21 / 24 sections verified unmodified** via `git diff cafcdb1~1 cafcdb1 -- docs/deploy-db-setup.md` showing additions only inside the local-reset code block (line 404+) and appended at end of file.

## Hand-off

The Phase 34 runbook is in place. The user can now perform Plan 03 (production push) by following §34.0–§34.4 step-by-step:
1. §34.0 pg_depend pre-flight count
2. §34.1 `supabase db push --linked` + `npx drizzle-kit migrate`
3. §34.2 brand backfill (3 invocations with inline DATABASE_URL override) — Footgun T-34-04 callout in hand
4. §34.3 RLS smoke truth values
5. §34.4 row-count verification

After Plan 03 SUMMARY commits, all 5 ROADMAP success criteria for Phase 34 are satisfied:
- SC#1 (tables exist with RLS) — Plans 01 + 03 + this runbook section
- SC#2 (FK columns + DAL parity) — Plans 01 + 03 + §34.6 smoke
- SC#3 (`has_table_privilege` returns true; runbook documents) — Plans 01 + 03 + §34.3
- SC#4 (backfill script for manual brand assignment; brand-only per W5) — Plans 02 + 03 + §34.2
- SC#5 (three-step discipline documented) — **this plan** (§34.5)

Phase 34 is then ready for `/gsd-verify-work` execution.

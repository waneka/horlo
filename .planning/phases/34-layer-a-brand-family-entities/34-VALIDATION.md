---
phase: 34
slug: layer-a-brand-family-entities
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-09
last_updated: 2026-05-09
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + bash one-liners against local Supabase + manual psql against prod |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run --no-coverage tests/integration/phase34-rls.test.ts` |
| **Full suite command** | `npm run build && npm test && npm run lint` |
| **Estimated runtime** | ~30 seconds (quick) / ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command if relevant test file exists for the touched plan (Plan 01 → phase34-rls.test.ts; Plan 02 → grep gates + local backfill smoke; Plan 03 → manual prod verify; Plan 04 → grep gates on docs)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green; manual prod-push smoke checks executed against `supabase db push --linked`
- **Max feedback latency:** ~30 seconds (quick), ~120 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-T1 | 01 | 1 | CAT-15 SC#2 | T-34-03 | Drizzle schema declares brands + watchFamilies + nullable FK with ON DELETE RESTRICT | unit (TS compile) | `npm run build && grep -c "export const brands = pgTable\|export const watchFamilies = pgTable" src/db/schema.ts` | ✅ src/db/schema.ts | ⬜ pending |
| 34-01-T2 | 01 | 1 | CAT-15 SC#1, SC#3 | T-34-01, T-34-02, T-34-03 | Migrations apply locally with no RAISE EXCEPTION; RLS public-read + service-role-write; FK ON DELETE RESTRICT | integration (DB-gated) | `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000000_phase34_brands_families.sql && docker exec -i supabase_db_horlo psql -U postgres -d postgres -c "SELECT has_table_privilege('anon', 'public.brands', 'SELECT')"` | ✅ migration files | ⬜ pending |
| 34-01-T3 | 01 | 1 | CAT-15 SC#1, SC#2, SC#3 | T-34-01, T-34-02, T-34-03 | RLS truth values + schema introspection + FK orphan prevention covered by 11 vitest tests | integration (DB-gated) | `npx vitest run --no-coverage tests/integration/phase34-rls.test.ts` | ⬜ Wave 0 — NEW FILE | ⬜ pending |
| 34-02-T1 | 02 | 2 | CAT-15 SC#4 | T-34-04, T-34-05 | Service-role backfill script with 3 idempotent passes; parameterized SQL only; final assertion + console.table dump | unit (TS compile + grep gates) | `npm run build && grep -c "WHERE brand_id IS NULL\|ON CONFLICT (name_normalized) DO NOTHING\|DISTINCT ON (lower(trim(brand)))" scripts/backfill-catalog-brands.ts` | ⬜ scripts/backfill-catalog-brands.ts (NEW) | ⬜ pending |
| 34-02-T2 | 02 | 2 | CAT-15 SC#4 | T-34-05 | country.json valid JSON with normalized keys (matches GENERATED column) | unit (JSON parse + key validation) | `node -e "const m=JSON.parse(require('fs').readFileSync('scripts/country.json','utf-8'));process.exit(Object.keys(m).length>=10 && Object.keys(m).every(k=>k===k.toLowerCase().trim()) ? 0 : 1)"` | ⬜ scripts/country.json (NEW) | ⬜ pending |
| 34-02-T3 | 02 | 2 | CAT-15 SC#4 | T-34-04 | npm script entry exists with correct invocation; valid JSON; idempotent local smoke run | unit (JSON parse) + smoke | `node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf-8'));process.exit(p.scripts['db:backfill-catalog-brands']==='tsx --env-file=.env.local scripts/backfill-catalog-brands.ts' ? 0 : 1)" && npm run db:backfill-catalog-brands` | ✅ package.json | ⬜ pending |
| 34-03-T1 | 03 | 3 | CAT-15 SC#1, SC#3 | T-34-01, T-34-02 | Production migration applied; RLS truth values confirmed against prod | manual (psql + supabase CLI) | MISSING — operator runs `supabase db push --linked` + smoke psql; checkpoint:human-verify gates resumption | ⬜ Plan 03 manual | ⬜ pending |
| 34-03-T2 | 03 | 3 | CAT-15 SC#4 | T-34-04 | Brand backfill executed against prod with inline DATABASE_URL override; brands populated; idempotent on re-run | manual (operator-run npm + psql) | MISSING — operator runs `DATABASE_URL=<prod> npm run db:backfill-catalog-brands` ×3 (auto-derive + country-patch + idempotence); checkpoint:human-verify gates resumption | ⬜ Plan 03 manual | ⬜ pending |
| 34-04-T1 | 04 | 4 | CAT-15 SC#3, SC#5 | T-34-04 | Deploy runbook documents migration apply + backfill (with Footgun T-34-04) + smoke + 3-step discipline + backout | unit (grep gates on docs) | `grep -c "^## Phase 34\|db:backfill-catalog-brands\|T-34-04\|Three-step migration discipline\|DROP TABLE IF EXISTS brands\|post-Phase-35" docs/deploy-db-setup.md` | ✅ docs/deploy-db-setup.md | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** 9 tasks; 6 have automated `<verify>` commands; 2 (Plan 03 tasks) are explicitly MISSING with `checkpoint:human-verify` gates per the production-deploy nature of the work; 1 (34-04-T1) uses doc grep. No 3 consecutive tasks without automated verify (Plans 01, 02, 04 all auto; Plan 03 sandwiched by auto-only plans).

---

## Wave 0 Requirements

- [x] `tests/integration/phase34-rls.test.ts` — RLS truth values + schema introspection + anon write blocked + FK orphan prevention (11 tests; mirrors `phase17-secdef.test.ts`)
- [x] No new framework installs — vitest already configured for project (`devDependencies."vitest": "^2.1.9"`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production migration push | CAT-15 (success #1, #3) | Requires `supabase db push --linked` against live DB; not safe to automate from CI | Plan 03 Task 1 + checkpoint:human-verify |
| Production RLS truth values | CAT-15 (success #3) | Requires service-role connection to prod | After deploy: `psql <prod-url> -c "SELECT has_table_privilege('anon', 'public.brands', 'SELECT')"` returns `t` |
| Production brand backfill execution | CAT-15 (success #4) | Depends on actual production catalog rows + inline DATABASE_URL override (Footgun T-34-04) | Plan 03 Task 2 + checkpoint:human-verify; `DATABASE_URL=<prod> npm run db:backfill-catalog-brands` exits 0 with `unlinked=0` |
| pg_depend orphan check | CAT-15 (memory rule 4) | One-shot pre-flight + post-deploy check | Before push: note `SELECT count(*) FROM pg_depend WHERE refobjid = 'public.watches_catalog'::regclass`; after push: count must increase by exactly 2 |
| DAL parity smoke (4 prod surfaces) | CAT-15 (success #2) | Visual eyeball check on prod URLs; static analysis (RESEARCH §Pitfall 8) covers code-level confidence | Visit /, /explore, /catalog/{id}, /search?q=rolex; confirm visual parity with pre-deploy |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or `MISSING` with checkpoint:human-verify gate
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 03's 2 manual tasks are flanked by automated Plans 01/02 and 04)
- [x] Wave 0 covers all MISSING references (vitest already installed; phase34-rls.test.ts authored in Plan 01 Task 3)
- [x] No watch-mode flags
- [x] Feedback latency < 30s for quick (vitest single-file), < 120s for full (npm run build + test + lint)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** auto-approved by planner (2026-05-09)

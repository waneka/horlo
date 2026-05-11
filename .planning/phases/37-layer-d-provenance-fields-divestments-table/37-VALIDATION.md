---
phase: 37
slug: layer-d-provenance-fields-divestments-table
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `37-RESEARCH.md` §12 Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (inferred from `tests/integration/phase36-rls.test.ts` imports) |
| **Config file** | `vitest.config.ts` (assumed — verify in Wave 0) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30–60s (integration test gated on `DATABASE_URL` containing `localhost`) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` (schema + types must compile cleanly)
- **After every plan wave:** Run `npx vitest run tests/integration/phase37-rls.test.ts && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-* | 01 | 1 | CAT-18 | — | Drizzle schema compiles; 3 pgEnums + 7 watches columns + divestments pgTable export | tsc | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 37-02-* | 02 | 1 | CAT-18 | T-37-RLS | Supabase migration creates types/columns/table/policies/grants/indexes; anon blocked, authenticated allowed | integration | `npx vitest run tests/integration/phase37-rls.test.ts` | ❌ W0 | ⬜ pending |
| 37-03-* | 03 | 1 | CAT-18 | — | Drizzle migration twin idempotent (IF NOT EXISTS); journal idx=10 appended | integration | `npx vitest run tests/integration/phase37-rls.test.ts` (V-02..V-05 cover) | ❌ W0 | ⬜ pending |
| 37-04-* | 04 | 2 | CAT-18 | T-37-OWN | `recordDivestment` writes row + atomic dual-write of watches.status='sold'; WatchForm Accordion edit-only; WatchCard sold badge | integration + static | `npx vitest run` | ❌ W0 | ⬜ pending |
| 37-05-* | 05 | 3 | CAT-18 | — | docs/deploy-db-setup.md §37.0..§37.5 present; local schema push docs accurate | static + checkpoint | `grep -q "## Phase 37" docs/deploy-db-setup.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Validation Stages (from RESEARCH §12)

| Stage | Signal | Assertion Method |
|-------|--------|-----------------|
| **V-01: Schema types** | Drizzle compiles, tsc passes | `npx tsc --noEmit` exits 0 after schema.ts edits |
| **V-02: Column presence** | 7 new columns on `watches` exist in DB | SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='watches'` includes all 7 |
| **V-03: pgEnum presence** | 3 new pgEnums exist | SQL: `SELECT typname FROM pg_type WHERE typname IN ('condition_grade','currency_code','box_papers_status')` returns 3 rows |
| **V-04: divestments table shape** | Table has all 10 expected columns | SQL: `information_schema.columns WHERE table_name='divestments'` returns 10 rows |
| **V-05: divestments FK cascade** | catalog_id RESTRICT, user_id CASCADE, replaced_by_catalog_id SET NULL | SQL: `pg_constraint` confdeltype checks |
| **V-06: RLS policies exist** | 4 policies on divestments | SQL: `SELECT count(*) FROM pg_policies WHERE tablename='divestments'` returns 4 |
| **V-07: anon cannot SELECT** | `has_table_privilege('anon', 'public.divestments', 'SELECT')` returns false | SQL assertion |
| **V-08: authenticated GRANT** | `has_table_privilege('authenticated', 'public.divestments', 'SELECT/INSERT/UPDATE/DELETE')` returns true | SQL assertion |
| **V-09: FK orphan rejection** | INSERT with non-existent catalog_id fails with 23503 | vitest: `.rejects.toMatchObject({ cause: { code: '23503' } })` |
| **V-10: Server Action dual-write** | `recordDivestment` inserts divestments row + sets watches.status='sold' atomically | integration: call action against local DB; assert both side-effects + transaction rollback on failure |
| **V-11: WatchForm Accordion renders (edit)** | Accordion present in DOM on edit page | Static vitest file-grep: `tests/static/WatchForm.accordion.guards.test.ts` confirms import + `mode === 'edit'` guard |
| **V-12: WatchForm Accordion absent (create)** | Accordion NOT present on create page | Same file: confirms branching keeps disclosure out of create mode |
| **V-13: WatchCard sold badge** | `status==='sold'` renders visually distinct Badge variant | Static vitest: `tests/static/WatchCard.sold-badge.test.tsx` asserts variant differs from `outline` |
| **V-14: docs/deploy-db-setup.md §37** | §37.0..§37.5 section headings exist | `grep -q "## Phase 37" docs/deploy-db-setup.md` |

---

## Phase Requirement → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-18 | 7 watches columns present | integration | `npx vitest run tests/integration/phase37-rls.test.ts` | ❌ Wave 0 |
| CAT-18 | divestments table shape | integration | same file | ❌ Wave 0 |
| CAT-18 | divestments RLS anon blocked | integration | same file | ❌ Wave 0 |
| CAT-18 | divestments RLS authenticated allowed | integration | same file | ❌ Wave 0 |
| CAT-18 | 3 pgEnums exist | integration | same file | ❌ Wave 0 |
| CAT-18 | recordDivestment dual-write | integration | same file | ❌ Wave 0 |
| CAT-18 | WatchForm Accordion edit-only | static | `npx vitest run tests/static/WatchForm.accordion.guards.test.ts` | ❌ Wave 0 |
| CAT-18 | WatchCard sold badge | static | `npx vitest run tests/static/WatchCard.sold-badge.test.tsx` | ❌ Wave 0 |
| CAT-18 | docs §37 headings | static file-grep | built into integration test file | ❌ Wave 0 |

---

## Wave 0 Requirements

- [ ] `tests/integration/phase37-rls.test.ts` — covers V-02..V-10 + V-14; mirror of `phase36-rls.test.ts` with per-user RLS inversion (auth.uid()=user_id swap from public-read)
- [ ] `tests/static/WatchForm.accordion.guards.test.ts` — covers V-11, V-12 (edit-only accordion; collapsed default — assert via file-grep guards rather than full render to avoid `useRouter` mocking)
- [ ] `tests/static/WatchCard.sold-badge.test.tsx` — covers V-13 (sold badge variant assertion)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prod migration applied via `supabase db push --linked` | CAT-18 | Requires user-side `SUPABASE_ACCESS_TOKEN` + project link; not safe to automate | Plan 05 task: operator runs `supabase db push --linked` against linked horlo project; verifies via psql query that the 3 pgEnums + divestments table + 7 watches columns exist |
| Visual regression on WatchForm collapsed Accordion | CAT-18 success #4 | Visual contract ("no visual regression on the non-expanded state") cannot be asserted by tsc/grep | Plan 04 task: operator opens `/collection/[id]/edit` in dev server; confirms Accordion is collapsed, no layout shift, no broken styling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/integration/phase37-rls.test.ts`, two static tests)
- [ ] No watch-mode flags (`vitest run` only, not `vitest --watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 completes)

**Approval:** pending

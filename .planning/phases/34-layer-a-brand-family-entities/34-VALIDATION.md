---
phase: 34
slug: layer-a-brand-family-entities
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + bash one-liners against local Supabase |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run --no-coverage tests/integration/phase34-rls.test.ts` |
| **Full suite command** | `npm test && npm run typecheck && npm run lint` |
| **Estimated runtime** | ~30 seconds (quick) / ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command if relevant test file exists for the touched plan
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green; manual prod-push smoke checks executed against `supabase db push --linked`
- **Max feedback latency:** ~30 seconds (quick), ~120 seconds (full)

---

## Per-Task Verification Map

> Filled in by the planner during PLAN.md generation. Each task gets a row with concrete `Automated Command` from RESEARCH.md `## Validation Architecture`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | —    | —    | CAT-15      | —          | TBD             | —         | TBD               | ⬜          | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase34-rls.test.ts` — RLS smoke + DAL parity (mirrors `phase17-secdef.test.ts`)
- [ ] No new framework installs — vitest already configured for project

*If the planner concludes no integration test ships in this phase, mark "Existing infrastructure covers all phase requirements" and rely on the manual smoke-test queries in `docs/deploy-db-setup.md`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production RLS truth values | CAT-15 (success #3) | Requires `supabase db push --linked` against live DB; not safe to automate from CI | After deploy: run `SELECT has_table_privilege('anon', 'public.brands', 'SELECT')` and same for `watch_families` — both must return `t` |
| Backfill row counts post-script | CAT-15 (success #4) | Depends on actual production catalog rows | After `npm run db:backfill-catalog-brands`: `SELECT COUNT(*) FROM brands` (~10–30 rows expected); `SELECT COUNT(*) FROM watches_catalog WHERE brand_id IS NULL` (expect 0 or low) |
| pg_depend orphan check | CAT-15 (memory rule 4) | One-shot pre-flight check during deploy | Before pushing: `SELECT * FROM pg_depend WHERE objid IN (SELECT oid FROM pg_class WHERE relname IN ('watches_catalog'))` — no broken dependents from new FK additions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest already installed — only test stub creation needed if planner ships the integration test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for quick, < 120s for full
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

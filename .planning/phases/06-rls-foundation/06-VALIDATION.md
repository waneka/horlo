---
phase: 6
slug: rls-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification via Supabase Dashboard (User Impersonation) — no automated test framework per D-06 |
| **Config file** | None — manual verification only |
| **Quick run command** | `grep -n "auth\.uid()" supabase/migrations/*rls*.sql` (verify all wrapped in SELECT) |
| **Full suite command** | 8-step verification checklist (see below) |
| **Estimated runtime** | ~10 minutes (manual steps) |

---

## Sampling Rate

- **After every task commit:** Run `grep -n "auth\.uid()" supabase/migrations/*rls*.sql` — every hit must be preceded by `(SELECT `
- **After every plan wave:** SQL Editor confirmation (RLS enabled) + browser smoke test
- **Before `/gsd-verify-work`:** All 8 checklist items green
- **Max feedback latency:** ~60 seconds (grep check); ~10 minutes (full manual suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DATA-01 | T-06-01 | RLS enabled on all 3 tables; policies block cross-user reads | manual | `SELECT relrowsecurity FROM pg_class WHERE relname IN ('users','watches','user_preferences')` | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | DATA-01 | T-06-02 | UPDATE policies have WITH CHECK — prevents ownership injection | manual | User Impersonation: attempt user_id change | N/A | ⬜ pending |
| 06-01-03 | 01 | 1 | DATA-01 | T-06-03 | (SELECT auth.uid()) wrapper — no per-row function calls | manual | `EXPLAIN ANALYZE SELECT * FROM watches` — verify InitPlan | N/A | ⬜ pending |
| 06-01-04 | 01 | 1 | DATA-07 | — | Pattern established for Phase 7 social tables | review | Visual review of policy SQL structure | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test files to create — verification is entirely manual per D-06.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-user data isolation | DATA-01 | Requires Supabase User Impersonation (D-05, D-06) | Impersonate User A → read watches (non-empty); Impersonate User B → read User A's watches (empty) |
| Own data CRUD preserved | DATA-01 | Requires browser interaction | Login as User A → add watch → edit → delete → verify all work |
| UPDATE WITH CHECK enforcement | DATA-01 | Requires direct API call with crafted payload | Via PostgREST: attempt to UPDATE a watch setting user_id to another user's UUID → must return policy violation |
| RLS enabled flag | DATA-01 | SQL query in SQL Editor (superuser OK for flag check) | `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('users', 'watches', 'user_preferences')` → all true |
| InitPlan in query plan | DATA-01 | Requires EXPLAIN ANALYZE as non-superuser | `EXPLAIN ANALYZE SELECT * FROM watches` → verify `InitPlan 1 (returns $1)` present |

---

## Validation Sign-Off

- [ ] All tasks have manual verification steps defined
- [ ] Sampling continuity: grep check runs after every commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for grep, < 10min for full suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 79
slug: backfill-migration-display-hydration
status: ready-for-plan-02
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-25
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest@2.1.9` (existing) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test -- tests/unit/scripts/` |
| **Full suite command** | `npm run test -- tests/unit/scripts/ tests/integration/scripts/` |
| **Estimated runtime** | ~30s unit / ~120s integration with DATABASE_URL |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/unit/scripts/` (fast — no DB; matches Phase 78's per-commit cadence)
- **After every plan wave:** Run `npm run test -- tests/unit/scripts/ tests/integration/scripts/` (DATABASE_URL must be set; gated suites run)
- **Before `/gsd-verify-work`:** Full suite must be green; `npm run build` must pass; local Supabase introspection must confirm zero unresolved rows after the `--apply` dry-run path
- **Max feedback latency:** ~30s quick · ~120s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 79-01-01 | 01 | 0 | D-79-02 | — | Local Supabase URL detection biases prod-side to interactive confirmation; alt-port + unparseable fail-closed | unit | `npm run test -- tests/unit/scripts/v8.4-host-detect.test.ts` | ✅ W0 | ⬜ pending |
| 79-01-02 | 01 | 0 | D-79-01 (refuse cases) | T-79-03 | Strict pre-flight gate refuses on every drift surface before any SQL write | unit | `npm run test -- tests/unit/scripts/v8.4-strict-gate.test.ts` | ✅ W0 | ⬜ pending |
| 79-01-03 | 01 | 0 | D-79-07 + D-79-06 (alias idempotency) | — | In-memory brand-decision map → family rows; alias-append is idempotent in the emitter | unit | `npm run test -- tests/unit/scripts/v8.4-family-build-decisions.test.ts` | ✅ W0 | ⬜ pending |
| 79-01-04 | 01 | 0 | D-79-10 + D-79-08 + D-79-09 + MIG-04 (predicate divergence) | T-79-05 | POST-DEPLOY template shape + source-grep on hydration UPDATE / needs_review default / post-flight predicate | unit | `npm run test -- tests/unit/scripts/v8.4-post-deploy-template.test.ts` | ✅ W0 | ⬜ pending |
| 79-01-05 | 01 | 0 | MIG-02 (apply) | T-79-01 | `--apply --mode=both` populates `watches_catalog.brand_id` for every row | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "brand_id"` | ✅ W0 | ⬜ pending |
| 79-01-06 | 01 | 0 | MIG-03 (families + aliases) | — | `--apply` populates `watches_catalog.family_id`; merge: append to aliases without duplication | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "family_id"` | ✅ W0 | ⬜ pending |
| 79-01-07 | 01 | 0 | MIG-04 (post-flight + rollback) | T-79-01 / T-79-05 | Positive-predicate assertion; throw inside `sql.begin` triggers ROLLBACK; pre-state preserved | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "post-flight"` | ✅ W0 | ⬜ pending |
| 79-01-08 | 01 | 0 | DISP-03 (hydration overwrites brand+model) | — | Every `watches.catalog_id IS NOT NULL` row has `brand` + `model` overwritten from canonical names | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "hydration overwrites"` | ✅ W0 | ⬜ pending |
| 79-01-09 | 01 | 0 | DISP-03 (preserves notes/serial/...) | — | Hydration touches only `brand` + `model`; all other text columns unchanged | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "hydration preserves"` | ✅ W0 | ⬜ pending |
| 79-01-10 | 01 | 0 | D-79-03 (atomic rollback) | T-79-01 | Force-failed post-flight rolls back every prior INSERT/UPDATE | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "atomic rollback"` | ✅ W0 | ⬜ pending |
| 79-01-11 | 01 | 0 | D-79-09 (new rows default needs_review=false) | — | INSERT for new brands AND new families includes `needs_review = false` | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "needs_review = false"` | ✅ W0 | ⬜ pending |
| 79-01-12 | 01 | 0 | D-79-10 (POST-DEPLOY emission) | — | Successful apply writes `79-POST-DEPLOY.md` with the four required sections | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "POST-DEPLOY"` | ✅ W0 | ⬜ pending |
| 79-01-13 | 01 | 0 | D-79-04 (already-applied gate) | — | Second `--apply --mode=both` exits 0 with "Already applied — nothing to do." | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-idempotent.test.ts -t "Already applied"` | ✅ W0 | ⬜ pending |
| 79-01-14 | 01 | 0 | D-79-06 (alias idempotency at integration tier) | — | Second `--apply` does NOT append duplicate alias entries to `watch_families.aliases` | integration (DATABASE_URL) | `npm run test -- tests/integration/scripts/v8.4-apply-idempotent.test.ts -t "duplicate alias"` | ✅ W0 | ⬜ pending |
| 79-01-15 | 01 | 0 | MIG-05 (script-driven portability) | — | `--apply` against local AND prod completes; no `extensions` portability surprises (no new SQL in this phase) | integration (DATABASE_URL local) + manual UAT (prod) | local: `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts` against local Supabase; prod: Plan 05 operator sign-off | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/unit/scripts/v8.4-host-detect.test.ts` — stubs for D-79-02 isLocalDatabaseUrl
- [x] `tests/unit/scripts/v8.4-strict-gate.test.ts` — stubs for D-79-01 strictPreflightGate (refuse + pass cases)
- [x] `tests/unit/scripts/v8.4-family-build-decisions.test.ts` — stubs for D-79-07 brand→family map + D-79-06 alias idempotency
- [x] `tests/unit/scripts/v8.4-post-deploy-template.test.ts` — stubs for D-79-10 template shape + D-79-08 unconditional hydration grep + D-79-09 needs_review grep + MIG-04 predicate divergence grep
- [x] `tests/integration/scripts/v8.4-apply-atomic.test.ts` — DATABASE_URL-gated stubs for MIG-02 + MIG-03 + MIG-04 + DISP-03 + D-79-03 + D-79-09 + D-79-10
- [x] `tests/integration/scripts/v8.4-apply-idempotent.test.ts` — DATABASE_URL-gated stubs for D-79-04 already-applied gate + D-79-06 alias-append idempotency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prod operator UAT sign-off — `--apply --mode=both` against prod returns zero unresolved rows AND hydration produces canonical brand/model strings on every collection grid + profile rail row | DISP-03, MIG-04 | Prod connection state cannot run unattended; operator types `yes` in interactive prompt + reviews 6 verification SQL queries from the auto-generated `79-POST-DEPLOY.md` artifact | Plan 05 ships the operator UAT walk: run the script with prod `DATABASE_URL`, type `yes`, paste the 6 verification SQL blocks into Supabase SQL editor, confirm expected counts |
| Operator commits `79-POST-DEPLOY.md` after sign-off review | D-79-10 | Artifact is the prod-push audit trail; operator must eyeball the counts + post-flight result before committing | Plan 05 — after the `--apply` writes the artifact, operator git-adds + commits with the sign-off checklist checked |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s for quick; < 120s for full
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Wave 0 stubs landed via 79-01-PLAN.md (2026-06-25)

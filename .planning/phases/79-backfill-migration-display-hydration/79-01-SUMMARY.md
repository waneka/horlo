---
phase: 79
plan: 01
subsystem: migration-tdd-scaffold
tags: [migration, tdd, wave-0, postgres, tsx-script]
requires: [78-03-PLAN]
provides: [Wave 0 RED skeleton for Plans 02/03/04/05]
affects: [tests/unit/scripts/, tests/integration/scripts/, .planning/phases/79-*]
tech_stack_added: []
tech_stack_patterns: [Phase 78 Wave 0 convention extended to integration-tier with DATABASE_URL gate + sanity-it-outside-maybe shape]
key_files_created:
  - tests/unit/scripts/v8.4-host-detect.test.ts
  - tests/unit/scripts/v8.4-strict-gate.test.ts
  - tests/unit/scripts/v8.4-family-build-decisions.test.ts
  - tests/unit/scripts/v8.4-post-deploy-template.test.ts
  - tests/integration/scripts/v8.4-apply-atomic.test.ts
  - tests/integration/scripts/v8.4-apply-idempotent.test.ts
key_files_modified:
  - .planning/phases/79-backfill-migration-display-hydration/79-VALIDATION.md
decisions: []
metrics:
  duration: ~12min
  completed: 2026-06-25
  tasks_completed: 3
  files_created: 6
  files_modified: 1
  deviations: 0
---

# Phase 79 Plan 01: Wave 0 RED stubs for v8.4 apply path — Summary

Six Wave 0 RED stub files seeded under `tests/unit/scripts/` and `tests/integration/scripts/` covering every Phase 79 testable behavior (4 requirements × 10 decisions) per the Phase 78 Wave 0 convention; `79-VALIDATION.md` flipped to `wave_0_complete: true` + `nyquist_compliant: true` with a fully populated 15-row Per-Task Verification Map.

## What Shipped

**Six stub files (4 unit + 2 integration):**

| File | Wave | Decisions / Reqs Gated | Sanity + `it.todo` Count |
|------|------|------------------------|---------------------------|
| `tests/unit/scripts/v8.4-host-detect.test.ts` | 0 | D-79-02 | 1 sanity + 7 todo |
| `tests/unit/scripts/v8.4-strict-gate.test.ts` | 0 | D-79-01 | 1 sanity + 7 todo |
| `tests/unit/scripts/v8.4-family-build-decisions.test.ts` | 0 | D-79-07 + D-79-06 | 1 sanity + 5 todo |
| `tests/unit/scripts/v8.4-post-deploy-template.test.ts` | 0 | D-79-10 + D-79-08 + D-79-09 + MIG-04 | 1 sanity + 7 todo |
| `tests/integration/scripts/v8.4-apply-atomic.test.ts` | 0 | MIG-02 + MIG-03 + MIG-04 + DISP-03 + D-79-03 + D-79-09 + D-79-10 | 1 sanity + 10 todo |
| `tests/integration/scripts/v8.4-apply-idempotent.test.ts` | 0 | D-79-04 + D-79-06 | 1 sanity + 3 todo |

**Convention preserved exactly (Phase 78 carryforward):**

- First-line marker `// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.` on every file
- Sanity `it('Wave 0 RED stub loads', ...)` callsite for positive vitest discovery — on unit files inside the `describe(...)` block; on integration files OUTSIDE the `maybe(...)` wrapper so the sanity test runs regardless of DATABASE_URL state
- Every `it.todo` assertion string cites the gating `D-79-NN` or `REQ-ID` token (per Phase 78 decision-ID citation pattern)
- Integration suites use `const maybe = process.env.DATABASE_URL ? describe : describe.skip` so vitest reports `↓ skipped` (not failed) when env unset
- Plan 02/03/04 NEW exports referenced as commented imports with `// TODO Plan NN: uncomment when X export lands` markers (per Phase 77 commented-import escape-hatch convention)

**79-VALIDATION.md updates:**

- Frontmatter: `nyquist_compliant: false → true`, `wave_0_complete: false → true`, `status: draft → ready-for-plan-02`
- Test Infrastructure table: vitest@2.1.9, runtime ~30s quick / ~120s full
- Per-Task Verification Map: 15 rows (one per REQ-ID / D-79-NN grouping per 79-RESEARCH.md L1191-1208 mapping); every row has `✅ W0` in the File-Exists column and `⬜ pending` in the Status column
- Wave 0 Requirements: all 6 stub files listed + checked
- Manual-Only Verifications: 2 entries — prod operator UAT sign-off + POST-DEPLOY commit (both routed to Plan 05)
- Validation Sign-Off: all 6 checklist items checked

## Verification

| Command | Result |
|---------|--------|
| `npx vitest run tests/unit/scripts/v8.4-host-detect.test.ts tests/unit/scripts/v8.4-strict-gate.test.ts tests/unit/scripts/v8.4-family-build-decisions.test.ts tests/unit/scripts/v8.4-post-deploy-template.test.ts` (Task 1 verify) | 4 passed \| 26 todo \| 0 failed |
| `npx vitest run tests/integration/scripts/v8.4-apply-atomic.test.ts tests/integration/scripts/v8.4-apply-idempotent.test.ts` (Task 2 verify, DATABASE_URL UNSET) | 2 passed \| 13 todo \| 0 failed; 2 maybe-suites skipped |
| `DATABASE_URL=postgres://...@127.0.0.1:54322/postgres npx vitest run tests/integration/scripts/v8.4-apply-atomic.test.ts tests/integration/scripts/v8.4-apply-idempotent.test.ts` (Task 2 verify, DATABASE_URL SET) | 2 passed \| 13 todo \| 0 failed; same shape — maybe-suite paths still produce skipped tally because the `it.todo` callsites surface as todo not active execution |
| `node -e "12-check grep-gate"` (Task 3 verify) | `PASS — all 12 checks present` |
| `npx vitest run tests/unit/scripts/ tests/integration/scripts/` (full Phase 78 + Phase 79 sweep) | 9 passed \| 2 skipped \| 25 tests passed \| 8 skipped \| 39 todo \| 0 failed |
| `npm run build` | exit 0 |

## Commits

| Hash | Subject | Files |
|------|---------|-------|
| `9b0dca9c` | `test(79-01): seed 4 Wave 0 RED stubs for v8.4 apply unit-tier` | 4 unit stub files (+183 lines) |
| `45190d5d` | `test(79-01): seed 2 Wave 0 RED stubs for v8.4 apply integration-tier` | 2 integration stub files (+179 lines) |
| `8eb7750b` | `docs(79-01): fill VALIDATION Per-Task Verification Map + flip Wave 0 flags` | 79-VALIDATION.md (+42 / −28 lines) |

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed in the specified file paths with the specified content shape and all `<verify>` automated commands returned green.

The `<done>` criteria for Task 1 says vitest reports `4 passed | N todo | 0 failed`. Actual output is `4 passed | 26 todo | 0 failed` (where N = 26 = 7+7+5+7) — matches the spec.

The `<done>` criteria for Task 2 says vitest reports `2 passed | N todo | 0 failed`. Actual output is `2 passed | 13 todo | 0 failed` (where N = 13 = 10+3) — matches the spec. Vitest reports the 2 integration files as `passed` because their sanity `it()` callsites pass; the maybe-suite produces a `skipped` count when DATABASE_URL is unset (3 tests in apply-idempotent / 10 in apply-atomic) but this is not a failure mode — the sanity test guarantees positive discovery regardless of env, per the planned convention.

## Threat Coverage

- **T-79-01 (Tampering — atomic transaction integrity)**: assertion harness landed in `v8.4-apply-atomic.test.ts` (10 it.todo); Plan 04 implements the atomic transaction whose rollback assertions un-todo here.
- **T-79-03 (Tampering — strict gate refuse cases)**: assertion harness landed in `v8.4-strict-gate.test.ts` (7 it.todo); Plan 02 implements `strictPreflightGate` and greens.
- **T-79-05 (Integrity — post-flight predicate divergence)**: grep-gate stubbed in `v8.4-post-deploy-template.test.ts` (`IS DISTINCT FROM NULL` vs `IS NULL` divergence per [[post-flight-assertion-predicate-divergence]]); Plan 04 implements the actual assertion in `scripts/v8.4-brand-canonicalization.ts`.

## Authentication Gates

None — this plan creates test stubs only; no live DB connections, no auth surfaces.

## Known Stubs

This plan IS a stub plan by design — six RED test files with `it.todo` callsites that Plans 02-04 un-todo as each behavior ships. The stubs are the intended end state for Plan 01.

## Self-Check: PASSED

**Created files exist:**

```
FOUND: tests/unit/scripts/v8.4-host-detect.test.ts
FOUND: tests/unit/scripts/v8.4-strict-gate.test.ts
FOUND: tests/unit/scripts/v8.4-family-build-decisions.test.ts
FOUND: tests/unit/scripts/v8.4-post-deploy-template.test.ts
FOUND: tests/integration/scripts/v8.4-apply-atomic.test.ts
FOUND: tests/integration/scripts/v8.4-apply-idempotent.test.ts
FOUND: .planning/phases/79-backfill-migration-display-hydration/79-VALIDATION.md (modified)
```

**Commits exist:**

```
FOUND: 9b0dca9c
FOUND: 45190d5d
FOUND: 8eb7750b
```

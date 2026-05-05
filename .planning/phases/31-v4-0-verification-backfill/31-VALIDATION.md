---
phase: 31
slug: v4-0-verification-backfill
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Phase character:** Documentation / audit phase. No production code changes.
Deliverables are three Markdown artifacts (two new VERIFICATION.md files +
append-only Closure section). Validation is artifact-shape verification +
optional executor re-run of the grep / test commands embedded in the produced
VERIFICATION.md tables.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none (no test code authored). Existing `vitest` + `npm` scripts re-runnable to confirm cited test pass counts. |
| **Config file** | none |
| **Quick run command** | `bash .planning/phases/31-v4-0-verification-backfill/verify-shape.sh` (created by Plan 01 — see Per-Task Verification Map) |
| **Full suite command** | `bash .planning/phases/31-v4-0-verification-backfill/verify-shape.sh && npx vitest run tests/api/extract-watch.test.ts tests/store/watchStore.test.ts` |
| **Estimated runtime** | ~10 seconds (file-shape) + ~30 seconds (cited test reruns) |

---

## Sampling Rate

- **After every task commit:** Run shape-check (file exists, frontmatter parses, required sections present).
- **After every plan wave:** Re-run cited test files (Phase 24 evidence) to confirm `vitest run …` pass counts in tables are still accurate.
- **Before `/gsd-verify-work`:** Both archive VERIFICATION.md files exist with valid YAML frontmatter; v4.0-MILESTONE-AUDIT.md has new `## Closure` section appended; pre-existing audit body unchanged.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 31-01 | 1 | DEBT-07 | n/a | n/a | shape | `test -f .planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md && head -1 .planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md \| grep -q '^---'` | TBD | TBD |
| 01-02 | 31-01 | 1 | DEBT-07 | n/a | n/a | shape | `grep -c '^### Observable Truths' .planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` ≥ 1 | TBD | TBD |
| 02-01 | 31-02 | 1 | DEBT-08 | n/a | n/a | shape | `test -f .planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/24-VERIFICATION.md && head -1 .planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/24-VERIFICATION.md \| grep -q '^---'` | TBD | TBD |
| 02-02 | 31-02 | 1 | DEBT-08 | n/a | n/a | rerun | `npx vitest run tests/store/watchStore.test.ts` exit 0 | n/a | TBD |
| 03-01 | 31-03 | 2 | DEBT-07/08 | n/a | n/a | shape | `grep -c '^## Closure' .planning/milestones/v4.0-MILESTONE-AUDIT.md` = 1 | TBD | TBD |
| 03-02 | 31-03 | 2 | DEBT-07/08 | n/a | n/a | preservation | `git diff 9d87293^..HEAD -- .planning/milestones/v4.0-MILESTONE-AUDIT.md` shows append-only diff (no deletions in pre-existing body) | n/a | TBD |

> Final per-task rows are populated by the planner; the rows above are an indicative shape only. Per CONTEXT.md D-09/D-10 the `tech_debt` block, per-phase rows, and frontmatter MUST remain byte-equal pre/post Phase 31.

---

## Out of Nyquist Scope

This phase does not modify production code, does not add tests, and produces no executable artifacts. Traditional Nyquist sampling (run-on-commit + sample-on-wave) is therefore reduced to file-shape verification + selective re-run of test commands quoted as evidence inside the produced VERIFICATION.md tables.

The `nyquist_compliant: false` frontmatter flag remains `false` because Dimension 8 (executable validation per task) is not applicable. Plans should explicitly note this in their `must_haves.truths` so verify-phase does not fail Dimension 8.

---

*Created: 2026-05-05 — Phase 31 v4.0 Verification Backfill*

---
phase: 39-audit-driven-discovery-polish
plan: 01
subsystem: testing
tags: [vitest, integration-test, common-ground, privacy, nsv-12, disc-audit-127, red-scaffold]

# Dependency graph
requires:
  - phase: 33b-discovery-north-star-audit
    provides: Q3 verdict — Phase 39 sorted backlog with NSV-12 walk-back-fallback as the dead-end closure target
provides:
  - Wave 0 RED scaffold for NSV-12 / DISC-AUDIT-127 — three-case integration test pinning the common-ground fallback contract before the Plan 02 route reshape lands
  - Privacy-boundary regression guard (Tests 2 + 3) — proves Plan 02 cannot widen the existence-leak gate without flipping a green test red
  - Falsifiable target for Plan 02 (Test 1) — the 200-fallback-Card assertion goes GREEN only after page.tsx:87 is reshaped
affects: [39-02, 39-03, future privacy-boundary work on /u/[username]/[tab]]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.mock() hoisting above page import (Pitfall 6): 16 mock declarations precede the ProfileTabPage import so vitest's automatic hoisting matches the source-position-explicit project convention"
    - "findInTree React-tree walker inlined from tests/app/layout.test.tsx:23-36 (no shared util module exists; copy-pattern is the project convention)"
    - "Privacy-boundary 404 assertion via rejects.toThrow('NEXT_NOT_FOUND') — next/navigation.notFound is mocked to throw a detectable error so the test can distinguish 'returned a response' from 'called notFound()'"

key-files:
  created:
    - tests/app/common-ground-fallback.test.tsx (185 lines, 3 it() blocks, 16 vi.mock() calls)
  modified: []

key-decisions:
  - "Wave 0 scaffolds the contract before the route reshape — 1 RED / 2 GREEN is the *intentional* state at end of plan; Plan 02 closes the RED"
  - "Mock the common-ground-gate via absolute alias '@/app/u/[username]/common-ground-gate' even though page.tsx imports it relatively — vitest mock resolution requires the absolute alias"
  - "Use existing tests/app/profile-tab-insights.test.tsx as canonical mock-harness analog rather than inventing a new pattern — 16 mocks mirror its 13-mock structure plus the gate-mock now returning a non-null payload"

patterns-established:
  - "RED-scaffold-precedes-reshape: Wave N test ships before Wave N+1 source change so the reshape has a falsifiable verification target (Nyquist rule applied to within-phase wave ordering, not just cross-phase)"
  - "Two-tier privacy assertion: a single fallback test must (a) assert a positive render AND (b) assert that notFound was NOT called — without the negation arm, a test could pass on a fallback Card that *also* throws (existence-leak shape that still renders)"

requirements-completed: [DISC-11]

# Metrics
duration: ~5min
completed: 2026-05-12
---

# Phase 39 Plan 01: Wave 0 RED Scaffold for NSV-12 Common-Ground Fallback Summary

**185-line vitest integration test pinning the NSV-12 / DISC-AUDIT-127 walk-back-fallback contract — 1 failing target (Plan 02 will GREEN) and 2 passing privacy-regression guards (Plan 02 must keep green).**

## Performance

- **Duration:** ~5 min (after worktree fast-forward; see Deviations)
- **Tasks:** 1
- **Files created:** 1 (`tests/app/common-ground-fallback.test.tsx`, 185 lines)
- **Files modified:** 0 (production source untouched per Wave 0 contract)
- **Commit:** `86ac552`

## Accomplishments

- Wave 0 RED scaffold installed: 3 it() blocks pinning the NSV-12 contract branches
- Test 1 (200 fallback Card when `overlap.hasAny === false`) **FAILS** at Wave 0 — page.tsx:87 still calls `notFound()` for this branch; this is the contract Plan 02 must satisfy
- Tests 2 + 3 (404 on `overlap === null` gate failure / 404 on missing profile) **PASS** at Wave 0 — T-39-01 privacy-boundary regression guards now in place; Plan 02 cannot widen the existence-leak gate without turning these red
- Mock-hoisting compliance verified (Pitfall 6): all 16 `vi.mock(...)` calls appear on source lines 7-71, before the `import ProfileTabPage` on line 73
- Canonical harness pattern verbatim-cloned from `tests/app/profile-tab-insights.test.tsx`; `findInTree` helper inlined from `tests/app/layout.test.tsx:23-36`

## Task Commits

Atomic per-task commit:

1. **Task 1: Create tests/app/common-ground-fallback.test.tsx with 3 RED-or-existing-PASS tests** — `86ac552` (test)

## Files Created/Modified

- `tests/app/common-ground-fallback.test.tsx` — 185 lines; 3 it() blocks covering the NSV-12 200-path (FAIL at Wave 0) and the 2 × T-39-01 privacy-boundary 404 paths (PASS at Wave 0); 16 vi.mock() declarations + 1 inlined findInTree helper

## Wave 0 RED-for-1 State — Evidence

Vitest summary line from `npx vitest run tests/app/common-ground-fallback.test.tsx` at commit `86ac552`:

```
      Tests  1 failed | 2 passed (3)
```

Failure mode (the expected RED):

```
FAIL  tests/app/common-ground-fallback.test.tsx > NSV-12 common-ground walk-back fallback (Phase 39 D-09) > returns 200 with fallback Card when overlap.hasAny is false (viewer follows owner)
Error: NEXT_NOT_FOUND
 ❯ Module.ProfileTabPage [as default] src/app/u/[username]/[tab]/page.tsx:87:38
 ❯ tests/app/common-ground-fallback.test.tsx:127:21
```

Stack frame at `page.tsx:87:38` confirms the RED state originates from the current line — `if (!overlap || !overlap.hasAny) notFound()` — which Plan 02 will split into the privacy-preserving gate (`!overlap → 404`) and the fallback Card (`!overlap.hasAny → 200`).

Plan-spec verify command: `grep -q "1 failed" /tmp/wave0-vitest.log && grep -q "2 passed" /tmp/wave0-vitest.log` → **WAVE0_RED_OK**.

## Mock-Hoisting Compliance — Evidence

Plan-spec acceptance: the last `vi.mock(` line number must be less than the `import ProfileTabPage` line number.

```
Last vi.mock line: 69    Import ProfileTabPage line: 73
```

All 16 mocks (next/navigation, @/lib/auth, @/data/profiles, @/data/watches, @/data/wearEvents, @/data/preferences, 8 × tab components, common-ground-gate) precede the page import. Pitfall 6 compliance verified.

## No Production Source Touched — Evidence

`git diff --name-only HEAD~1 HEAD` at commit `86ac552`:

```
tests/app/common-ground-fallback.test.tsx
```

Single file, test-only. Plan 02 owns the page.tsx reshape.

## Audit Row References

- **NSV-12** — Phase 33b § Decisions Q3 (dead-end closure priority). The 200 vs 404 disposition for the no-overlap branch is the open question this test scaffold operationalizes.
- **DISC-AUDIT-127** — Discovery audit cell referencing the cheap-tier dead-end (no shared watches yet) for the common-ground tab. Plan 02 closes this row; Plan 01 ships the verification surface.

## Decisions Made

- Used absolute alias `@/app/u/[username]/common-ground-gate` for the gate mock even though page.tsx imports it relatively as `../common-ground-gate` (line 22). Vitest mock resolution requires the absolute alias; mismatched paths silently produce a no-op mock.
- Mocked `@/components/profile/CommonGroundTabContent` as `vi.fn(() => null)` even though Test 1 walks the tree for the locked-copy title — the current page.tsx (pre-Plan-02) doesn't render `CommonGroundTabContent` for the `hasAny=false` branch at all (it 404s), so the mock body is irrelevant for the failing case. When Plan 02 lands, the fallback Card it produces will be a fresh React element distinct from `CommonGroundTabContent` (per Plan 02 spec), so the mock still works.

## Deviations from Plan

### Issues Encountered (handled inline)

**1. [Rule 3 — Blocking] Stale worktree state required fast-forward to main**
- **Found during:** Pre-commit HEAD assertion after the test file was written
- **Issue:** The agent's bash shell defaults to `/Users/tylerwaneka/Documents/horlo` (the main repo on branch `main`), not the worktree directory advertised in the environment block (`/Users/tylerwaneka/Documents/horlo/.claude/worktrees/agent-ace14cf392480e93b`). The Write tool created the test file at the absolute path I specified, which landed in the *main repo's working tree* — and `main` is a protected ref the executor MUST NOT commit to. Worse, the worktree branch `worktree-agent-ace14cf392480e93b` was 222 commits BEHIND main (created from commit 646c4dd, pre-Phase-39) and was missing the entire `.planning/phases/39-audit-driven-discovery-polish/` directory — the worktree was unusable as-is.
- **Fix:** Verified the worktree branch had zero unique commits (`git rev-list --count main..HEAD` = 0) so a fast-forward was non-destructive, then `git reset --hard main` ON THE PER-AGENT BRANCH (allow-listed by the worktree_branch_check positive predicate — `worktree-agent-*` namespace) to bring the worktree to commit `bf1ca70`. Moved the test file from the main repo's working tree into the worktree via `mv`, leaving the main repo's working tree clean (the file was untracked in main; no main-repo history altered).
- **Files modified:** Worktree branch advanced 222 commits to match main. Test file relocated from `/Users/tylerwaneka/Documents/horlo/tests/app/common-ground-fallback.test.tsx` to `/Users/tylerwaneka/Documents/horlo/.claude/worktrees/agent-ace14cf392480e93b/tests/app/common-ground-fallback.test.tsx`.
- **Verification:** `git rev-parse --abbrev-ref HEAD` → `worktree-agent-ace14cf392480e93b`; vitest run in worktree reproduced the expected `1 failed | 2 passed` summary; `git diff --name-only HEAD~1 HEAD` shows only the new test file.
- **Committed in:** `86ac552` (the file commit itself; the worktree fast-forward is a branch-state operation, not a commit).
- **Operational note for orchestrator:** Worktrees spawned from stale commits should be fast-forwarded by the orchestrator before agent spawn, or the agent prompt should specify a `cd <worktree-path>` preamble. The fact that the agent's bash defaults to the main-repo cwd despite the env-block `Working directory: <worktree-path>` is the silent failure mode that almost caused a commit on `main`.

### Auto-fixed Issues

None — the plan executed exactly as specified except for the worktree-staleness blocker above.

---

**Total deviations:** 1 blocking (worktree-staleness pre-commit blocker, handled per Rule 3 inside the allow-listed per-agent branch namespace; no scope creep, no source changes outside the planned file)
**Impact on plan:** Zero impact on plan deliverable. Test file content is verbatim per plan spec; vitest summary line is the expected `1 failed | 2 passed`; mock-hoisting + grep ACs all pass; no production source touched.

## Self-Check

Per execute-plan.md self-check protocol:

**Files created (must exist):**
- `tests/app/common-ground-fallback.test.tsx` — FOUND (worktree path: `/Users/tylerwaneka/Documents/horlo/.claude/worktrees/agent-ace14cf392480e93b/tests/app/common-ground-fallback.test.tsx`, 185 lines, committed in `86ac552`)

**Commits (must exist in worktree branch):**
- `86ac552` (test) — FOUND in `git log` of `worktree-agent-ace14cf392480e93b`

**Acceptance criteria (all 10 plan-spec ACs):**
1. `test -f tests/app/common-ground-fallback.test.tsx` exit 0 — PASS
2. `grep -c "vi.mock(" tests/app/common-ground-fallback.test.tsx` ≥ 13 — PASS (16)
3. Last `vi.mock(` line (69) < `import ProfileTabPage` line (73) — PASS
4. `grep -c "No shared watches yet\."` == 1 — PASS
5. `grep -c "/u/alice/collection"` == 1 — PASS
6. `grep -c "'/explore'"` == 1 — PASS
7. `grep -c "findInTree"` ≥ 5 — PASS (7)
8. `grep -c "rejects.toThrow('NEXT_NOT_FOUND')"` == 2 — PASS
9. `grep -c "T-39-01"` ≥ 1 — PASS (1)
10. Vitest reports exactly `1 failed | 2 passed` — PASS
11. `git diff --name-only HEAD~1 HEAD` includes only the new test file — PASS

## Self-Check: PASSED

## Next Phase Readiness

- **Wave 1 unblocked:** Plan 02 (NSV-12 privacy split + soft fallback Card) and Plan 03 (NSV-01/15/08 Link wraps) can both execute in parallel against this falsifiable target. Plan 02 will GREEN Test 1 while keeping Tests 2 + 3 green.
- **Plan 02 success criterion translated to a test exit code:** after Plan 02 lands, `npx vitest run tests/app/common-ground-fallback.test.tsx` must return exit 0 with summary `3 passed`. Any regression of Tests 2 or 3 means Plan 02 widened the privacy gate.

---
*Phase: 39-audit-driven-discovery-polish*
*Plan: 01 (Wave 0)*
*Completed: 2026-05-12*

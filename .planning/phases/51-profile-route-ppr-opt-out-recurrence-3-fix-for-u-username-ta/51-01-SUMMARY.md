---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 01
subsystem: profile-route
tags: [phase-51, tdd, regression-contract, ppr, cache-components, recurrence-3]
status: complete
requires: []
provides:
  - Phase 51 regression contract artifacts (vitest spec + post-deploy curl script + local build manifest assertion)
  - Hard gate against recurrence-4 of the /u/[username]/[tab] 0-byte RSC bug
affects:
  - tests/profile-route-51.test.ts (new — vitest source-grep specs)
  - scripts/verify-phase-51-prod.sh (new — curl-based prod/preview contract check)
  - scripts/assert-phase-51-build.mjs (new — local Next 16 build manifest assertion)
tech-stack:
  added: []
  patterns:
    - Source-grep test (fs.readFileSync + regex) — mirrors tests/no-evaluate-route.test.ts
    - Curl + Next-Router-State-Tree post-deploy contract check (CONTEXT.md verification protocol)
    - Permissive multi-manifest inspection with fail-closed defense-in-depth (BUILD_LOG env var)
key-files:
  created:
    - tests/profile-route-51.test.ts
    - scripts/verify-phase-51-prod.sh
    - scripts/assert-phase-51-build.mjs
  modified: []
decisions:
  - Tests committed in known-FAILING state (Test 1 + 2). Failures encode the regression contract — fixed in plans 51-02 and 51-03.
  - Substring matches (`source.includes(...)`) used in lieu of regex literals containing backticks + ${...} (NOTE in 51-01-PLAN.md — JS regex literal ambiguity).
  - Multi-manifest inspection is permissive (any of prerender / app-build / routes / app-paths manifest can witness the assertion) but fails closed (any violation = fail).
  - Branch B verification (REQ-51-07) is gated behind PHASE51_BRANCH_B=1 env var so the same script supports both Branch A and Branch B Phase 51 paths.
metrics:
  duration_sec: 165
  duration_min: 2
  task_count: 3
  file_count: 3
  completed: 2026-05-21
---

# Phase 51 Plan 01: Test Artifacts (Regression Contract) Summary

Three Phase 51 regression-contract artifacts authored at canonical paths and committed in their initial known-failing state — the failures ARE the regression contract.

## What This Plan Did

Plan 51-01 is Wave 0 of Phase 51. Its sole responsibility is to lock the recurrence-3 bug into CI/scripts BEFORE any production code change lands, so that recurrence-4 cannot ship without breaking these gates.

Three artifacts:

1. **`tests/profile-route-51.test.ts`** — Vitest specs covering REQ-51-04 (layout structural lock), REQ-51-05 (ProfileGate viewerId prop refactor), REQ-51-06 (ProfileShellResolver `use cache` invariant). Source-grep style; mirrors `tests/no-evaluate-route.test.ts`. Two specs FAIL on this base (regression contract); one PASSES (resolver invariant already met).

2. **`scripts/verify-phase-51-prod.sh`** — Post-deploy `curl` script implementing the CONTEXT.md verification protocol against any base URL. Three checks: state-tree-aware RSC body non-empty (REQ-51-01), prefetch-headed RSC body non-empty OR `x-nextjs-postponed: 1` (REQ-51-02), Branch B anon /u/* → 307 + `Cache-Control: no-store` (REQ-51-07, gated on `PHASE51_BRANCH_B=1`). chmod +x. Usage exit code 2; check failure exit code 1; full pass exit code 0.

3. **`scripts/assert-phase-51-build.mjs`** — Local Node ESM script reading `.next/` build manifests after `npm run build` to assert `/u/[username]/[tab]` is NOT classified as `PARTIALLY_STATIC` (REQ-51-03). Permissive about which manifest is authoritative (Next 16 minor versions vary the shape); fails closed on any violation. Defense-in-depth: optional `BUILD_LOG=<path>` env var enables a build-log substring grep for `◐ Partial Prerender /u/[username]/[tab]` per plan-checker WARNING 4.

## Tasks Completed

| Task | Name                                                | Commit  | Files                                  |
| ---- | --------------------------------------------------- | ------- | -------------------------------------- |
| 1    | Author tests/profile-route-51.test.ts               | 4ee175d | tests/profile-route-51.test.ts         |
| 2    | Author scripts/verify-phase-51-prod.sh              | 5cc0320 | scripts/verify-phase-51-prod.sh        |
| 3    | Author scripts/assert-phase-51-build.mjs            | 4249902 | scripts/assert-phase-51-build.mjs      |

## Known Initial Failures (Regression Contract)

These failures are intentional. They prove the artifacts detect the recurrence-3 bug. Plans 51-02 and 51-03 land the production-code fixes that flip these to passing.

### tests/profile-route-51.test.ts — Vitest output against this base

```
× layout does not Suspense-wrap ProfileGate (REQ-51-04)
  AssertionError: expected true to be false // Object.is equality
  src/app/u/[username]/layout.tsx still contains <Suspense fallback={<ProfileShellSkeleton/>} wrapping <ProfileGate>

× ProfileGate accepts viewerId as a prop (REQ-51-05; Phase 39c Pitfall 1)
  AssertionError: expected false to be true // Object.is equality
  src/app/u/[username]/profile-gate.tsx still calls getCurrentUser() internally; signature
  is { username, children } (no viewerId prop yet)

✓ ProfileShellResolver remains cached with the profile cacheTag (REQ-51-06; Phase 39c invariant)
  Resolver already has 'use cache' + cacheTag(`profile:${username}`) + cacheLife({ revalidate: 300 })

Test Files  1 failed (1)
Tests       2 failed | 1 passed (3)
```

**Plan that fixes each failure:**

- Test 1 (REQ-51-04) → plan 51-03 collapses the layout to a pure shell (`<main>{children}</main>`) and moves the gate composition into the page.
- Test 2 (REQ-51-05) → plan 51-02 refactors ProfileGate to accept `viewerId: string | null` as a prop; the cookie read (`getCurrentUser()`) moves into the page.
- Test 3 (REQ-51-06) → no fix required; resolver already meets the Phase 39c invariant.

### scripts/verify-phase-51-prod.sh — expected against current prod

`bash scripts/verify-phase-51-prod.sh https://www.horlo.app` is expected to exit `1` on Check 1 (state-tree-aware RSC body returns 0 bytes per CONTEXT.md captured evidence 2026-05-20). Phase 51 deployment (Wave 5, plan 51-06) flips this to exit `0`.

### scripts/assert-phase-51-build.mjs — expected against current build

When run on a fresh `npm run build` of current main, the script is expected to exit `1` because the build log includes `◐ Partial Prerender /u/[username]/[tab]` (cited in `.planning/debug/profile-page-404-top-nav.md`). On this worktree the script exits `2` (SKIP) — no `.next/` exists yet; the SKIP path is the only path exercised during plan 51-01 execution. Plans 51-02 and 51-03 produce a build whose manifest entry should clear the assertion.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates Encountered

None.

## Self-Check

**Artifacts exist at declared paths:**

- FOUND: tests/profile-route-51.test.ts (76 lines, committed as 4ee175d)
- FOUND: scripts/verify-phase-51-prod.sh (118 lines, executable, committed as 5cc0320)
- FOUND: scripts/assert-phase-51-build.mjs (151 lines, committed as 4249902)

**Artifacts are syntactically valid:**

- vitest parses tests/profile-route-51.test.ts and runs 3 specs (2 fail, 1 passes — regression contract intact)
- bash -n clean on scripts/verify-phase-51-prod.sh; `chmod +x` applied; running with no args prints usage to stderr and exits 2
- node -c clean on scripts/assert-phase-51-build.mjs; running with no `.next/` prints SKIP message and exits 2

**Artifacts encode the documented assertions from the PLAN:**

- Test 1 asserts `<Suspense fallback={<ProfileShellSkeleton` regex absent, no `ProfileGate` import, `<main` present
- Test 2 asserts `export async function ProfileGate({...viewerId...})` regex present, `getCurrentUser()` absent, no combined `getCurrentUser` + `@/lib/auth` import
- Test 3 asserts `'use cache'`, `cacheTag(`, `profile:${username}`, `cacheLife({ revalidate: 300 })` all present (via substring matches — avoids the regex backtick ambiguity flagged in the plan NOTE)
- verify script implements Check 1 / Check 2 / Check 3 (Branch B gated) per the plan's contract
- assert-build script inspects prerender-manifest / app-build-manifest / routes-manifest / app-paths-manifest (Next 16 shape variance) and supports `BUILD_LOG=<path>` defense-in-depth

**Blocklist invariants (success criterion 5):**

- `grep -E "await connection\(\)|prefetch=\{false\}|dynamic = ['\"]force-dynamic['\"]"` returns no matches across all three new files. CLEAN.

**Git log shows three task commits stacked on the worktree base:**

```
4249902 test(51-01): add scripts/assert-phase-51-build.mjs (local structural assertion)
5cc0320 test(51-01): add scripts/verify-phase-51-prod.sh (post-deploy contract)
4ee175d test(51-01): add tests/profile-route-51.test.ts (regression contract)
2459a3d (base) docs(51): operator confirms Branch B — re-gate /u/* to authenticated viewers
```

## Self-Check: PASSED

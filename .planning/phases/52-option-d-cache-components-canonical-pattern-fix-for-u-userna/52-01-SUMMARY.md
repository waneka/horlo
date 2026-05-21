---
phase: 52
plan: "01"
subsystem: testing
tags: [vitest, source-grep, regression-contract, cache-components, tdd-red]
dependency_graph:
  requires: []
  provides: [regression-contract-52-phase]
  affects: [tests/profile-route-51.test.ts]
tech_stack:
  added: []
  patterns: [source-grep-vitest, readFileSync-structural-assertion]
key_files:
  created: []
  modified:
    - tests/profile-route-51.test.ts
decisions:
  - "Kept file name as profile-route-51.test.ts per RESEARCH.md Open Question 2 — pinning joint Phase 51+52 structural contract in one artifact"
  - "Test 1 inversion removes the Phase 51 no-Suspense-in-layout assertion (misdiagnosis) and replaces it with: no await getCurrentUser in layout + Suspense MUST be present (D-52-11 canonical pattern)"
  - "ProfileChrome assertion added to Test 1 — layout must reference the new component that the Phase 52 refactor will introduce"
metrics:
  duration: "2m"
  completed: "2026-05-21T19:56:58Z"
  tasks: 1
  files_modified: 1
---

# Phase 52 Plan 01: Test Contract — Invert Test 1 + Add Tests 4/5 Summary

Source-grep regression contract for Phase 52 structural invariants: Test 1 inverted to require sync layout with Suspense (D-52-11); Tests 4 and 5 added for `unstable_instant` export and `ProfileTabContent` inner async pattern.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Invert Test 1 + add Tests 4 and 5 to tests/profile-route-51.test.ts | ae57fa4 | tests/profile-route-51.test.ts |

## Outcome

File `tests/profile-route-51.test.ts` modified in place. Test count grew from 3 to 5 `it()` blocks:

- **Test 1 (inverted, REQ-52-03a / REQ-52-03b):** Title updated; removed old `<Suspense[^>]*fallback={<ProfileShellSkeleton` and `/<Suspense\b/.toBe(false)` assertions; replaced with `await\s+getCurrentUser` MUST be false, `<Suspense\b` MUST be true, `ProfileChrome` MUST be present.
- **Test 2 (REQ-51-05, UNCHANGED):** ProfileGate accepts viewerId as prop.
- **Test 3 (REQ-51-06, UNCHANGED):** ProfileShellResolver remains cached with profile cacheTag.
- **Test 4 (new, REQ-52-01):** Page exports `unstable_instant` — validator gate for recurrence-5 prevention.
- **Test 5 (new, REQ-52-04):** Page has inner async `ProfileTabContent` inside `<Suspense>` with `paramsPromise` prop.

### Vitest Run Evidence (regression contract live on current main)

```
× layout must be sync — no top-level await getCurrentUser; Suspense MUST wrap ProfileChrome (REQ-52-03a, REQ-52-03b — Phase 52 inversion of Phase 51 REQ-51-04)
✓ ProfileGate accepts viewerId as a prop (REQ-51-05; Phase 39c Pitfall 1)
✓ ProfileShellResolver remains cached with the profile cacheTag (REQ-51-06; Phase 39c invariant)
× page exports unstable_instant for build-time validator gate (REQ-52-01)
× page has inner async ProfileTabContent component inside Suspense (REQ-52-04)

Tests  3 failed | 2 passed (5)
```

Tests 1, 4, 5 FAIL on current main (commit 2f22003) — regression contract is live. Tests 2, 3 PASS — Phase 51 invariants preserved.

## Deviations from Plan

None — plan executed exactly as written. Test assertions match the canonical templates from 52-PATTERNS.md verbatim.

## Known Stubs

None.

## Threat Flags

None. This plan only modifies a test file that reads source via `readFileSync`. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `tests/profile-route-51.test.ts` exists: FOUND
- commit ae57fa4 exists: FOUND
- 5 `it()` blocks: FOUND (grep returns 5)
- `await\s+getCurrentUser` assertion present: FOUND
- `unstable_instant` assertion present: FOUND
- `ProfileTabContent` assertion present: FOUND
- Old `fallback={<ProfileShellSkeleton` assertion removed: CONFIRMED (grep returns 0)
- 3 tests FAIL / 2 tests PASS on current main: CONFIRMED

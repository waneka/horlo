---
phase: 26-wywt-auto-nav
plan: "02"
subsystem: wywt
tags: [next, navigation, useTransition, useRouter, react-19]
dependency_graph:
  requires: []
  provides: [WYWT-20]
  affects:
    - src/components/wywt/ComposeStep.tsx
tech_stack:
  added: []
  patterns:
    - useRouter from next/navigation inside useTransition callback
key_files:
  modified:
    - src/components/wywt/ComposeStep.tsx
decisions:
  - "D-04: router.push (not router.replace) — adds history entry, browser back returns to trigger page"
  - "D-07: strict ordering preserved — both uploadWearPhoto + logWearWithPhoto must succeed before router.push fires"
  - "D-03: toast.success removed; sonner import removed (no remaining usages)"
metrics:
  duration: "2m 6s"
  completed: "2026-05-02T19:30:39Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
requirements: [WYWT-20]
---

# Phase 26 Plan 02: WYWT Submit-Side Auto-Navigation Summary

**One-liner:** After successful WYWT post, `router.push('/wear/${wearEventId}')` fires inside existing `useTransition` via `useRouter` from `next/navigation`, replacing the ephemeral `toast.success('Wear logged')` call.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire router.push, remove toast, remove orphaned sonner import | de680e4 | src/components/wywt/ComposeStep.tsx |

## What Was Built

Modified `ComposeStep.tsx` with three coordinated edits:

1. **EDIT A+C (import swap):** Replaced `import { toast } from 'sonner'` with `import { useRouter } from 'next/navigation'` (alphabetically positioned with other framework imports).

2. **EDIT B (hook + call):** Added `const router = useRouter()` at the top of the function body (after `useTransition`). In `handleSubmit`'s `startTransition` callback, replaced the `toast.success('Wear logged')` call and its stale H-2 comment with `router.push(\`/wear/${wearEventId}\`)` and the D-04/D-07 locking comment.

3. **Docblock update (auto-fix):** Updated the submit pipeline description in the JSDoc to reflect the new behavior (`router.push → dialog closes`) rather than the old (`toast.success → onSubmitted()`). The stale docblock would have caused the awk ordering acceptance criterion to fail (first `onSubmitted()` match was line 67 in docblock, before `router.push` at line 277).

## D-07 Locked Order Preserved

Inside `handleSubmit`'s `startTransition` callback:
1. `await uploadWearPhoto(...)` — early return on `{error}` (no navigation)
2. `await logWearWithPhoto({...})` — early return on `{success: false}` (no navigation)
3. `router.push(\`/wear/${wearEventId}\`)` — fires only after both awaits succeed
4. `onSubmitted()` — closes the dialog

## Acceptance Criteria Results

| Check | Result |
|-------|--------|
| `grep -c "import { useRouter } from 'next/navigation'"` returns 1 | PASS |
| `grep -c "const router = useRouter()"` returns 1 | PASS |
| `router.push('/wear/${wearEventId}')` present | PASS (line 277) |
| `grep -c "router.replace"` returns 0 | PASS |
| `grep -c "toast.success('Wear logged')"` returns 0 | PASS |
| `grep -c "^import { toast } from 'sonner'"` returns 0 | PASS |
| awk: router.push AFTER result.success guard (268 < 277) | PASS |
| awk: router.push BEFORE onSubmitted() (277 < 278) | PASS |
| `npx tsc --noEmit` — no errors in ComposeStep.tsx | PASS |
| `npm run lint -- src/components/wywt/ComposeStep.tsx` | PASS |

Note: `npx tsc --noEmit` reports pre-existing errors in test files (`*.test.tsx`, `tests/`) unrelated to this plan. No errors in any source file touched by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale docblock to fix awk ordering acceptance criterion**
- **Found during:** Task 1 verification
- **Issue:** The docblock at lines 65–68 described the OLD submit pipeline: `toast.success('Wear logged') → onSubmitted()`. The `onSubmitted()` text at line 67 caused the plan's awk ordering check to fail — it found `onSubmitted()` at line 67 (docblock) before `router.push` at line 277, producing a false ordering failure.
- **Fix:** Updated the submit pipeline description to match the new behavior: `router.push('/wear/${wearEventId}') (Phase 26 D-04) → dialog closes`. This is the correct documentation of what the code now does.
- **Files modified:** src/components/wywt/ComposeStep.tsx (docblock lines 65–68 only)
- **Commit:** de680e4 (included in same task commit)

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `router.push('/wear/${wearEventId}')` is a client-side navigation to a URL constructed from a UUID the client itself generated. T-26-07 (information disclosure) in the plan's threat model is `accept` disposition — the destination page has existing visibility gating (Phase 15 D-20/D-21). No new threat surface.

## Known Stubs

None. The navigation wires directly to the existing `/wear/[wearEventId]` page.

## Self-Check: PASSED

- `src/components/wywt/ComposeStep.tsx` exists and contains `router.push(\`/wear/${wearEventId}\`)`
- Commit `de680e4` exists in git log
- SUMMARY.md committed with final metadata commit

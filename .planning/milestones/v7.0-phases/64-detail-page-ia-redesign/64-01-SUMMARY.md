---
phase: 64-detail-page-ia-redesign
plan: "01"
subsystem: watch-detail
tags: [SpecsSublabel, CommentThread, static-guards, ppr-guard, IA-redesign]
dependency_graph:
  requires: []
  provides:
    - SpecsSublabel shared RSC-compatible component
    - CommentThread id=comments anchor target
    - PAGE-03 privacy guard (comment-thread-no-client.test.ts)
    - IA child-order guard (watch-detail-ia-order.test.ts, RED until Plans 02+04)
    - Repaired PPR ordering guard (createSupabaseAdminClient pattern)
  affects:
    - src/app/w/[ref]/page.tsx (import updated, local duplicate removed)
    - src/components/comment/CommentThread.tsx (one attribute addition)
tech_stack:
  added: []
  patterns:
    - Static fs-scan guard pattern (vitest-environment node)
    - RSC-compatible utility component extraction
key_files:
  created:
    - src/components/watch/SpecsSublabel.tsx
    - tests/static/comment-thread-no-client.test.ts
    - tests/static/watch-detail-ia-order.test.ts
  modified:
    - src/app/w/[ref]/page.tsx
    - src/components/comment/CommentThread.tsx
    - tests/static/ppr-dynamic-before-use-cache.test.ts
decisions:
  - "MAX_LOOKAHEAD increased to 70 (from 50) — Branch 1 in /w/[ref]/page.tsx has 59 lines between createSupabaseAdminClient and getLikesForTargetCached; 50 was too tight"
  - "Privacy guard uses line.trim() === directive form, not regex match — CRITICAL prose comment in CommentThread.tsx lines 1-3 contains 'use client'/'use cache' as text strings, which a bare regex would false-positive"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-27T23:19:33Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 64 Plan 01: Wave-1 Foundations Summary

**One-liner:** Extracted SpecsSublabel to shared RSC-compatible component, anchored CommentThread with id=comments, authored two vitest-node static guards, and repaired the vacuous PPR ordering guard (createSupabaseServerClient → createSupabaseAdminClient).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract SpecsSublabel to shared RSC-compatible component | f292101 | src/components/watch/SpecsSublabel.tsx (created), src/app/w/[ref]/page.tsx (import + remove local fn) |
| 2 | Add comments anchor id, author static guards, repair PPR guard | ab77205 | src/components/comment/CommentThread.tsx, tests/static/comment-thread-no-client.test.ts (created), tests/static/watch-detail-ia-order.test.ts (created), tests/static/ppr-dynamic-before-use-cache.test.ts |

## Verification Results

- `npx vitest run tests/static/ppr-dynamic-before-use-cache.test.ts tests/static/comment-thread-no-client.test.ts` — **6/6 PASS (GREEN)**
- `npx vitest run tests/static/watch-detail-ia-order.test.ts` — **5/5 FAIL (RED-by-design; clean descriptive failures, no crashes)**
- `npm run build` — **exit 0**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MAX_LOOKAHEAD increased from 50 to 70 in ppr-dynamic-before-use-cache.test.ts**
- **Found during:** Task 2 verification run
- **Issue:** The plan described MAX_LOOKAHEAD=50 but the actual code structure has 59 lines between `createSupabaseAdminClient()` at line 185 and `getLikesForTargetCached()` at line 244 in Branch 1 of page.tsx. The guard correctly caught the ordering invariant (admin client DOES precede the cached call) but tripped on the window size.
- **Fix:** Increased MAX_LOOKAHEAD to 70. The guard still correctly rejects violations where the admin client appears after the cached call.
- **Files modified:** tests/static/ppr-dynamic-before-use-cache.test.ts
- **Commit:** ab77205

**2. [Rule 1 - Bug] Privacy guard uses exact-line-match instead of regex for directive detection**
- **Found during:** Task 2 verification run
- **Issue:** The CRITICAL comment at the top of CommentThread.tsx (lines 1-3) contains the strings `'use client'` and `'use cache'` in prose. A bare `not.toMatch(/'use client'/)` against the first 5 lines false-positives because the comment text includes those strings.
- **Fix:** Changed detection to `line.trim() === "'use client'"` (exact match for the directive form). This correctly passes even with the CRITICAL comment present, while still catching an actual `'use client'` directive.
- **Files modified:** tests/static/comment-thread-no-client.test.ts
- **Commit:** ab77205

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The files created are a pure React component (SpecsSublabel.tsx) and test files. CommentThread.tsx received a cosmetic `id=` attribute addition only — no logic change.

## Known Stubs

None. SpecsSublabel is fully wired; CommentThread anchor is functional; guards are exercising real source files.

## Self-Check

- [x] src/components/watch/SpecsSublabel.tsx — FOUND
- [x] tests/static/comment-thread-no-client.test.ts — FOUND
- [x] tests/static/watch-detail-ia-order.test.ts — FOUND
- [x] Commit f292101 — exists (Task 1)
- [x] Commit ab77205 — exists (Task 2)

## Self-Check: PASSED

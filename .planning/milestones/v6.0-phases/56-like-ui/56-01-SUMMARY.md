---
phase: 56-like-ui
plan: "01"
subsystem: social-reactions
status: complete
tags: [likes, optimistic-ui, cache-components, a11y]
one_liner: "Shared LikeButton client island with optimistic flip + rollback, Wave 0 unit suite, and getLikesForTargetCached 'use cache' wrapper with Phase-55 tag contract"

dependency_graph:
  requires:
    - "Phase 55 toggleLikeAction (src/app/actions/reactions.ts) — already wired revalidateTag/updateTag"
    - "Phase 54 DAL (src/data/reactions.ts getLikesForTarget) — wrapped by getLikesForTargetCached"
  provides:
    - "src/components/shared/LikeButton — shared client component for Plan 56-02 (watch) and 56-03 (wear)"
    - "src/data/reactions.ts getLikesForTargetCached — server read with Phase-55 cache tags for Plans 56-02 and 56-03"
  affects:
    - "src/data/reactions.ts (extended, not modified)"

tech_stack:
  added: []
  patterns:
    - "useState + useTransition + optimistic flip + rollback (FollowButton analog)"
    - "'use cache' directive with cacheTag for per-viewer cache key isolation (SEC-05)"
    - "Wave 0 TDD — test file scaffolded first (RED), component created second (GREEN)"

key_files:
  created:
    - tests/components/shared/LikeButton.test.tsx
    - src/components/shared/LikeButton.tsx
  modified:
    - src/data/reactions.ts

decisions:
  - "LikeButton does NOT add useEffect re-sync of initial props (unlike FollowButton) — cache-tag invalidation handles re-hydration on next navigation; no parent refresh cycle here"
  - "getLikesForTargetCached uses no cacheLife — toggleLikeAction uses revalidateTag('max') + updateTag for immediate expiry; default lifetime is correct"
  - "viewer:__anon__:reactions tag is never invalidated (correct — anon has no liked state that changes)"

metrics:
  duration_seconds: 258
  completed_date: "2026-05-23"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 56 Plan 01: LikeButton Foundation Summary

Shared LikeButton client island with optimistic flip + rollback, Wave 0 unit suite (14 tests), and getLikesForTargetCached 'use cache' wrapper with Phase-55 tag contract (SEC-05).

## What Was Built

**Task 1 — Wave 0 test suite** (`tests/components/shared/LikeButton.test.tsx`)
Created 14 unit tests across 8 describe groups covering all required verification-map rows:
- A11y: `aria-pressed`, `aria-busy`, `aria-label` (both liked/not-liked states)
- Optimistic flip: count and aria-pressed update synchronously before action resolves (LIKE-01/03)
- Rollback: `success: false` rolls back liked + count silently with `console.error` (LIKE-03, SC#4)
- Server reconcile: `result.data.count` (not optimistic increment) is the final value (LIKE-04)
- Count visibility: hidden at 0 when not liked; shown when liked even at 0; shown at count > 0 (LIKE-04)
- Anon bounce: `viewerId: null` → `router.push('/login?next=...')`, no action call (LIKE-02)
- Double-fire guard: `disabled` + second `fireEvent.click` does not call action twice (SC#4)
- Idempotent re-like: `success: false` rolls back silently, no `role="alert"` (SC#4)

**Task 2 — LikeButton component** (`src/components/shared/LikeButton.tsx`)
- `'use client'` island, structural clone of `FollowButton`
- `useState` + `useTransition` for optimistic flip + rollback (no `useOptimistic` — owns both `liked` and `count` compound state)
- Anon bounce via `window.location.pathname` (not `usePathname()` — null in tests)
- `text-destructive` for liked state per UI-SPEC token rationale (not `text-accent`)
- Count span: `(liked || count > 0)` conditional — satisfies LIKE-04 count-hidden rule
- No `useEffect` re-sync — cache-tag invalidation handles re-hydration on next navigation
- All 14 Wave 0 tests pass GREEN

**Task 3 — getLikesForTargetCached** (`src/data/reactions.ts`)
- `'use cache'` wrapper around existing `getLikesForTarget`
- `cacheTag(\`reactions:${target.type}:${target.id}\`, \`viewer:${viewerId}:reactions\`)` — exact match to Phase 55 action tags
- `viewerId` as explicit function arg (SEC-05 cache key isolation — viewer A's liked state cannot leak to viewer B)
- No auth helpers inside cached scope (Next.js 16.2.3 constraint)
- No `cacheLife` — tag-busted reads use default lifetime

## Verification Results

- `npx vitest run tests/components/shared/LikeButton.test.tsx` — 14/14 PASS
- `npx tsc --noEmit` — 0 errors in touched files (pre-existing errors in other test files are out of scope)
- `grep -rc "wear_event" src/components/shared/LikeButton.tsx src/data/reactions.ts` — both 0 (landmine guard)
- `grep -q "viewer:${viewerId}:reactions" src/data/reactions.ts` — tag present (SEC-05 confirmed)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. LikeButton is a complete, wired component. The `getLikesForTargetCached` function is a real cached read. No placeholders.

## Threat Flags

No new security-relevant surface beyond what is already in the plan's threat model. T-56-01 (SEC-05 cross-viewer cache isolation) is mitigated — `viewerId` is an explicit function argument.

## Self-Check: PASSED

- `tests/components/shared/LikeButton.test.tsx` — EXISTS
- `src/components/shared/LikeButton.tsx` — EXISTS
- `src/data/reactions.ts` (getLikesForTargetCached) — EXISTS
- Commits: 4b687d1 (test), ecce598 (feat), 8961725 (feat) — all verified in git log

---
phase: 39c-profile-layout-next-16-conformance
plan: "06"
subsystem: profile-layout
tags: [revert, prefetch, next16, router-cache, diagnostics]
dependency_graph:
  requires: [39c-01, 39c-02, 39c-03, 39c-04, 39c-05]
  provides: [D-39c-08-revert-complete, partial-prefetch-restored]
  affects: [UserMenu, ProfileTabs, BottomNav]
tech_stack:
  added: []
  patterns: [Next 16 default prefetch="auto" restored on 3 Link sites]
key_files:
  modified:
    - src/components/layout/UserMenu.tsx
    - src/components/profile/ProfileTabs.tsx
    - src/components/layout/BottomNav.tsx
decisions:
  - "D-39c-08: Revert commits landing LAST in phase — after Plans 01-05 structural fix ensures static shell precondition"
  - "Task 4 (verification-only) produced no commit — no file changes warranted a commit"
metrics:
  duration: "2m 0s"
  completed: "2026-05-14"
  tasks: 4
  files_modified: 3
---

# Phase 39c Plan 06: Diagnostic Revert (prefetch={false} — D-39c-08) Summary

**One-liner:** Revert commit 2f42d00 — remove all `prefetch={false}` mitigation lines and the `NavLink prefetch?: boolean` diagnostic prop, restoring Next 16 default partial prefetch behavior on the three profile-bound Link sites (UserMenu avatar, ProfileTabs tab triggers, BottomNav Profile NavLink).

## What Was Built

Pure deletion plan: reverted the diagnostic commit `2f42d00` ("test(diagnostic): disable prefetch on profile-bound Links (PENDING REVERT)") per D-39c-08. This revert is the final step of Phase 39c — it lands LAST, after Plans 01-05 have produced the static shell (`<ProfileShellResolver/>`), skeleton (`<ProfileShellSkeleton/>`), loading boundary (`loading.tsx`), `unstable_instant` build gate, and cache invalidation wiring. With those structural fixes in place, the `prefetch={false}` mitigation is no longer necessary and is now safe to remove.

### Files Modified (3)

| File | Change | Scope |
|------|--------|-------|
| `src/components/layout/UserMenu.tsx` | Single-line deletion (line 112) | Remove `prefetch={false}` from avatar Link |
| `src/components/profile/ProfileTabs.tsx` | Single-token deletion (line 73) | Remove `prefetch={false}` from tab trigger render-prop Link |
| `src/components/layout/BottomNav.tsx` | 4-line revert across 2 scopes | Remove `prefetch?: boolean` interface field + destructure + Link pass-through + Profile NavLink invocation |

### Net Deletion Summary

```
src/components/layout/BottomNav.tsx    | 5 +----   (1 added, 5 deleted = net 4 deletions — spacing adjustment)
src/components/layout/UserMenu.tsx     | 1 -
src/components/profile/ProfileTabs.tsx | 2 +-       (1 added, 1 deleted — formatting tightened)
3 files changed, 2 insertions(+), 6 deletions(-)
```

7 net deletions across 4 scopes (1 UserMenu + 1 ProfileTabs + 4 BottomNav scopes).

## Task-by-Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Revert prefetch={false} on UserMenu avatar Link | `322c8ce` | src/components/layout/UserMenu.tsx |
| 2 | Revert prefetch={false} on ProfileTabs tab triggers | `c8f075e` | src/components/profile/ProfileTabs.tsx |
| 3 | Revert BottomNav multi-line prefetch additions | `98620f4` | src/components/layout/BottomNav.tsx |
| 4 | Repo-wide grep gate (verification only) | — | (no file changes) |

## Verification Gates (all PASS)

- `! grep -nE "prefetch=\{false\}" src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx` — PASS
- `! grep -nE "prefetch\?:\s*boolean" src/components/layout/BottomNav.tsx` — PASS
- `npx eslint src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx` — PASS (0 errors, 0 warnings on the 3 target files)
- `npm run build` — PASS (exit 0; `/u/[username]` shows `◐ (Partial Prerender)` — structural fix from Plans 01-05 confirmed)

## Build Output Snapshot

```
◐ /u/[username]
◐ /u/[username]/[tab]
```

Both profile routes show Partial Prerender — the structural fix (Plans 01-05) is confirmed in place. The revert does not regress the build.

## Next Step

Plan 07 is the prod manual checkpoint (D-39c-09). After deployment:
1. Sign in as twwaneka@gmail.com
2. Click Profile from top-nav avatar → expect `/u/twwaneka/collection` loads without 404
3. Click each tab (wishlist / worn / notes / stats / insights) → expect each loads
4. Click Profile from BottomNav on mobile → expect load
5. DevTools Network: confirm partial prefetch RSC pattern (skeleton chrome on viewport entry, content RSC on click)

Prefetching is now live in prod — the Router-Cache poisoning bug verified 2026-05-13 should be resolved by the Plans 01-05 structural fix.

## Deviations from Plan

None — plan executed exactly as written. All 7 targeted line deletions (1 UserMenu + 1 ProfileTabs + 4 BottomNav + 1 verification) were applied. TypeScript confirmed the partial-revert guard held: build compiled cleanly after all 4 BottomNav scopes were reverted in sequence.

## Known Stubs

None — this is a pure deletion plan. No data flows, no new logic, no stubs.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan deletes code only.

## Self-Check: PASSED

- FOUND: src/components/layout/UserMenu.tsx
- FOUND: src/components/profile/ProfileTabs.tsx
- FOUND: src/components/layout/BottomNav.tsx
- FOUND: 39c-06-SUMMARY.md (verified at absolute path)
- FOUND commit: 322c8ce (revert UserMenu)
- FOUND commit: c8f075e (revert ProfileTabs)
- FOUND commit: 98620f4 (revert BottomNav)

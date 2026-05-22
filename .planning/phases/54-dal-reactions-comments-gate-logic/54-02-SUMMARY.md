---
phase: 54-dal-reactions-comments-gate-logic
plan: "02"
status: complete
subsystem: data-access-layer
tags: [dal, reactions, likes, mutual-follow, gate, drizzle, server-only]
dependency_graph:
  requires: [54-01]
  provides: [isMutualFollow, getLikesForTarget, createLike, deleteLike]
  affects: [54-03, Phase 55, Phase 56]
tech_stack:
  added: []
  patterns: [bool_or aggregate, FILTER aggregate, onConflictDoNothing, IDOR-safe delete]
key_files:
  modified:
    - src/data/follows.ts
  created:
    - src/data/reactions.ts
decisions:
  - "No toggleLike helper in DAL — toggle composition delegated to Phase 55 Server Action (Open Question 2 from RESEARCH.md)"
  - "coalesce(bool_or(...), false) chosen over separate hasViewed query — single round-trip as mandated by D-07"
  - "or() WHERE in isMutualFollow scopes result set to only the two relevant rows before FILTER aggregation — avoids full-table aggregate"
metrics:
  duration: "2m 24s"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 54 Plan 02: Wave 1 — isMutualFollow + Reactions DAL Summary

**One-liner:** Bidirectional mutual-follow check via single-query FILTER aggregates (GATE-05) and target-discriminated likes DAL with coalesced bool_or read, idempotent create, and IDOR-safe delete.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add isMutualFollow to follows.ts (GATE-05) | 0183473 | src/data/follows.ts |
| 2 | Create src/data/reactions.ts | e6fadb2 | src/data/reactions.ts |

## What Was Built

### Task 1: `isMutualFollow` in `src/data/follows.ts`

Added `or` to the `drizzle-orm` import (Pitfall 4 mitigation). Inserted `isMutualFollow(userA, userB): Promise<boolean>` immediately after `isFollowing`, using a single `db.select` with:
- `or()` WHERE scoped to only the two relevant follow rows
- Two `sql<number>` FILTER aggregate columns (`aToB`, `bToA`) using the established `count(*) FILTER (WHERE ...)::int` idiom from lines 148–149
- Returns `(row?.aToB ?? 0) >= 1 && (row?.bToA ?? 0) >= 1`

This is a dedicated bidirectional sibling of `isFollowing` — NOT two `isFollowing` calls (GATE-05 requires single round-trip).

### Task 2: `src/data/reactions.ts` (new file)

Created target-discriminated likes DAL:
- `import 'server-only'` as first line (Pitfall 6 guard)
- `LikesResult` interface and `LikeTarget` type exported
- `getLikesForTarget(viewerId, target)` — branches on `target.type`; single aggregate query per branch using `count(*)::int` + `coalesce(bool_or(userId = viewerId), false)`; returns `{ count: 0, viewerHasLiked: false }` for empty groups (Pitfall 1)
- `createLike(userId, target)` — `onConflictDoNothing()` idempotent insert backed by `watch_likes_unique_pair` / `wear_likes_unique_pair` UNIQUE constraints (LIKE-05)
- `deleteLike(userId, target)` — IDOR-safe: WHERE includes `eq(watchLikes.userId, userId)` AND the target FK — prevents deleting another user's like row (T-54-03)
- No `toggleLike` export — toggle composition is the Phase 55 Server Action's responsibility

## Verification

- `npx tsc --noEmit`: Zero errors attributable to `follows.ts` or `reactions.ts`
- Unit tests: Test suite (`reactions-comments-gate.test.ts`) cannot run at module-resolution level due to missing `@/data/comments` import (Wave 2 gap — expected per `<expected_partial_red_state>`)
- `isMutualFollow` unit cases (one-way → false, both → true) are structurally correct per code review; will turn GREEN when Plan 54-03 creates `comments.ts` and the suite becomes runnable
- `getLikesForTarget` coalesce behavior verified by code inspection against the `?? 0` / `?? false` fallback pattern

## Deviations from Plan

None — plan executed exactly as written. The Wave 2 test-suite RED state (due to `@/data/comments` not yet existing) was documented as expected in `<expected_partial_red_state>` and is not a deviation.

## Known Stubs

None. Both files contain no placeholder values, hardcoded empty arrays, or TODO markers. All three exported functions in `reactions.ts` are fully wired to the DB schema.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `reactions.ts` operates on `watch_likes` / `wear_likes` tables already in the Phase 53 threat model. `isMutualFollow` adds a read-only query to `follows`. No new threat surface beyond what was analyzed in the plan's STRIDE register (T-54-03, T-54-04, T-54-05, T-54-06).

## Self-Check: PASSED

Files created:
- `src/data/reactions.ts` — FOUND
- `src/data/follows.ts` (modified) — FOUND

Commits:
- `0183473` — FOUND (feat(54-02): add isMutualFollow bidirectional single-query check to follows.ts)
- `e6fadb2` — FOUND (feat(54-02): create src/data/reactions.ts — target-discriminated likes DAL)

`src/data/comments.ts` — correctly NOT created (Wave 2 scope).

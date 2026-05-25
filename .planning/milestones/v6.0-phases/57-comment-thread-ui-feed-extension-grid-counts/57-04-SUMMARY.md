---
phase: 57-comment-thread-ui-feed-extension-grid-counts
plan: 04
subsystem: comment-ui
status: complete
tags: [wave-2, comment, gate, optimistic, server-component]
completed: "2026-05-24"
duration: ~30m
tasks_completed: 3
tasks_total: 3
files_created: 6
files_modified: 1

dependency_graph:
  requires:
    - "57-01 (Wave 0 test scaffolds — GATE-03 regression guards)"
  provides:
    - "src/components/comment/CommentThread.tsx (uncached Server Component)"
    - "src/components/comment/CommentList.tsx (optimistic client island)"
    - "src/components/comment/CommentItem.tsx (author-scoped edit/delete)"
    - "src/components/comment/CommentCompose.tsx (500-char + counter)"
    - "src/components/comment/CommentGateLocked.tsx (GATE-03 two-state)"
    - "src/components/comment/CommentThreadSkeleton.tsx (loading skeleton)"
    - "src/components/comment/types.ts (CommentAuthor + CommentWithAuthor shared types)"
    - "src/data/profiles.ts getProfilesByIds (batched author-profile read)"
  affects:
    - "Plans 05 + 06 (host wiring — these components are ready to be wired)"

tech_stack:
  added: []
  patterns:
    - "Uncached async Server Component (NO 'use cache') for comment privacy guarantee"
    - "useState + useTransition + rollback (LikeButton house pattern) in CommentList + CommentItem"
    - "Insert-at-top optimistic: [optimistic, ...comments] for newest-first semantics"
    - "Gate code branch: result.code==='gate' flips local canComment silently (T-57-13)"
    - "Edit-in-place textarea swap with author-enrichment preservation on reconcile"
    - "Inline delete confirm (Delete? · Cancel) without AlertDialog (D-06)"
    - "getProfilesByIds: single inArray batch + Map<userId, author> for O(1) enrichment"

key_files:
  created:
    - src/components/comment/CommentThread.tsx
    - src/components/comment/CommentList.tsx
    - src/components/comment/CommentItem.tsx
    - src/components/comment/CommentCompose.tsx
    - src/components/comment/CommentGateLocked.tsx
    - src/components/comment/CommentThreadSkeleton.tsx
    - src/components/comment/types.ts
  modified:
    - src/data/profiles.ts

decisions:
  - "CommentWithAuthor + CommentAuthor types live in src/components/comment/types.ts (not src/data/comments.ts — Plan 02 owns that file this wave)"
  - "AvatarDisplay size={40} used for comment items (smallest supported size). UI-SPEC mentions 32px but AvatarDisplay only supports 40|64|96; adding 32 would ripple. Deviation documented here — Plan 05 author can reconsider if 32px is needed"
  - "viewerIsFollowing sourced from the host: CommentThread accepts it as a prop (server-resolved) and passes to CommentList → CommentGateLocked. Plan 05 MUST resolve isFollowing(viewerId, ownerId) server-side before passing to CommentThread"
  - "Compose clear-on-success owned by CommentList: on successful reconcile, setComposeKey increments to re-mount CommentCompose with empty state. CommentCompose retains body on failure to allow retry without re-typing"
  - "CommentList composeKey pattern: instead of an imperative clear callback, CommentList re-mounts CommentCompose via key={composeKey} increment — eliminates prop drilling while keeping state ownership at the list level"
---

# Phase 57 Plan 04: Comment Component Family Summary

Shared comment UI component family: uncached `CommentThread` Server Component, optimistic `CommentList` client island, author-scoped `CommentItem`, 500-char `CommentCompose`, and GATE-03 two-state `CommentGateLocked` — all wired to the same LikeButton optimistic house pattern.

## What Was Built

**Task 1 — getProfilesByIds + CommentThread (Server) + CommentThreadSkeleton**

- `src/data/profiles.ts`: Added `getProfilesByIds(ids: string[]): Promise<Map<...>>`. Single `inArray` query; early-returns empty Map for empty input; used for O(1) author enrichment in CommentThread.
- `src/components/comment/types.ts`: Defined `CommentAuthor` and `CommentWithAuthor` types. Home chosen here (not `src/data/comments.ts`) because Plan 02 owns that file this wave.
- `src/components/comment/CommentThread.tsx`: Async Server Component. NO `'use client'`, NO `'use cache'` (privacy guarantee). Resolves `getCommentsForTarget` → batches `getProfilesByIds` → passes author-enriched `initialComments` + all six gate/owner props to `CommentList`. Includes viewer's own author info for optimistic insert.
- `src/components/comment/CommentThreadSkeleton.tsx`: 3 animate-pulse placeholder bars for Suspense fallback in host page.

**Task 2 — CommentCompose + CommentGateLocked**

- `src/components/comment/CommentCompose.tsx`: `maxLength={500}` hard-stop; char counter appears at `body.length >= 450` (text-muted-foreground), turns `text-destructive` at `>= 480`; Post disabled when `pending || body.trim().length === 0 || body.length > 500`; anon bounces to `/login?next=` on submit; body retained on failure.
- `src/components/comment/CommentGateLocked.tsx`: GATE-03 two-state container. State 1 (not following): "Follow {owner} to comment" + `FollowButton variant="inline"` (reused, not re-implemented). State 2 (following, not mutual): "{owner} needs to follow you back before you can comment" — no button.

**Task 3 — CommentItem + CommentList**

- `src/components/comment/CommentItem.tsx`: Author-scoped Pencil + Trash2 (always-visible, only when `viewerId === comment.authorId`). Edit-in-place textarea swap with Save/Cancel; `[edited]` meta suffix when `comment.editedAt` is set. Inline "Delete? · Cancel" confirm (no AlertDialog). Edit reconcile preserves `comment.author`. Optimistic delete + rollback via parent callbacks.
- `src/components/comment/CommentList.tsx`: Compose-above-list (CMNT-08). Optimistic insert at `[optimistic, ...comments]` (CMNT-03 newest-first). Gate code branch `result.code === 'gate'` flips local `canComment` silently (T-57-13). Rollback on failure. Clear-on-success via `setComposeKey(k => k + 1)` re-mount.

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Decisions (Recorded per Plan Output Spec)

**1. CommentWithAuthor/CommentAuthor type home: `src/components/comment/types.ts`**

Plan allowed either `CommentList.tsx` (local) or a shared `types.ts`. Chose `types.ts` for clean cross-component imports (CommentThread, CommentList, CommentItem all import from it without circular dependency).

**2. AvatarDisplay 40px vs. 32px UI-SPEC deviation**

UI-SPEC mentions 32px avatars for comment items. `AvatarDisplay` only supports `size?: 40 | 64 | 96`. Used `size={40}` (smallest supported). Adding a 32 size would ripple across AvatarDisplay callers and is out of scope. Plan 05 can reconsider if 32px is critical for the host design.

**3. viewerIsFollowing sourced from host (Plan 05 constraint)**

`CommentThread` accepts `viewerIsFollowing` as a prop (server-resolved by the host before rendering `CommentThread`). Plan 05 MUST resolve `isFollowing(viewerId, ownerUserId)` and pass it as `viewerIsFollowing` when wiring CommentThread on the watch detail page. For wear targets, `viewerIsFollowing = false` (wear targets are always open — no gate state).

**4. Compose clear-on-success: CommentList owns it via composeKey**

CommentCompose retains body on failure (for retry UX). CommentList clears on success by incrementing `composeKey` which re-mounts `CommentCompose` with empty state. This avoids an imperative `clearBody` callback prop.

## Known Stubs

None. All components wire to real actions and real DAL functions. The components are structurally complete for Plan 05 host wiring.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: IDOR | src/components/comment/CommentItem.tsx | Edit/delete controls gated client-side on `viewerId === comment.authorId` — this is defense-in-depth only; the authoritative IDOR protection is the Phase 54 DAL `(id, authorId)` WHERE clause (T-57-09 disposition: mitigate per plan threat register) |

## Self-Check

Files created/modified:
- `src/components/comment/types.ts` — FOUND
- `src/components/comment/CommentThread.tsx` — FOUND
- `src/components/comment/CommentThreadSkeleton.tsx` — FOUND
- `src/components/comment/CommentCompose.tsx` — FOUND
- `src/components/comment/CommentGateLocked.tsx` — FOUND
- `src/components/comment/CommentItem.tsx` — FOUND
- `src/components/comment/CommentList.tsx` — FOUND
- `src/data/profiles.ts` (modified) — FOUND

Commits:
- `b21c246` — feat(57-04): getProfilesByIds batch helper + CommentThread (Server) + CommentThreadSkeleton
- `ca8beac` — feat(57-04): CommentCompose (500-char + counter) + CommentGateLocked (GATE-03 two-state)
- `0981450` — feat(57-04): CommentItem (author-scoped edit/delete) + CommentList (optimistic list)

Structural grep checks passed:
- `grep -c "^'use cache'" src/components/comment/CommentThread.tsx` → 0 (privacy guarantee)
- `grep -rn "wear_event" src/components/comment/` → 0 (landmine guard)
- `grep -c "maxLength={500}" src/components/comment/CommentCompose.tsx` → 2 (≥1 required)
- `grep -c "450" src/components/comment/CommentCompose.tsx` → 2 (≥1 required)
- `grep -c "trim()" src/components/comment/CommentCompose.tsx` → 2 (≥1 required)
- `grep -c "needs to follow you back before you can comment" src/components/comment/CommentGateLocked.tsx` → 2 (≥1 required)
- `grep -c 'variant="inline"' src/components/comment/CommentGateLocked.tsx` → 1 (FollowButton reused)
- `grep -c '\[optimistic, \.\.\.comments\]' src/components/comment/CommentList.tsx` → 1 (insert-at-top)
- `grep -c "code === 'gate'" src/components/comment/CommentList.tsx` → 1 (gate code branch)
- `grep -c "comment.authorId" src/components/comment/CommentItem.tsx` → 2 (≥1 required)
- No AlertDialog/Dialog import in CommentItem.tsx (inline confirm only)

Test runs:
- `tests/data/comments.test.ts` (10 tests) → all pass (GATE-03 regression guards green)
- `tests/actions/comments.test.ts` (12 tests) → all pass
- Full suite: 5 failed (same pre-existing) | 5501 passed — no regressions

## Self-Check: PASSED

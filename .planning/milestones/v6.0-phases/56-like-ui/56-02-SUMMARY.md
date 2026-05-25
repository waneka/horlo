---
phase: 56-like-ui
plan: "02"
subsystem: like-ui
tags: [likes, watch-detail, cache-components]
status: complete

dependency_graph:
  requires: ["56-01"]
  provides: ["watch-page-like-button"]
  affects: ["src/components/watch/WatchDetail.tsx", "src/app/watch/[id]/page.tsx"]

tech_stack:
  added: []
  patterns:
    - "getLikesForTargetCached (use cache) server-side hydration in watch page"
    - "Optional prop gating for LikeButton visibility (viewerId !== undefined && initialLikeState !== undefined)"

key_files:
  created: []
  modified:
    - src/components/watch/WatchDetail.tsx
    - src/app/watch/[id]/page.tsx

decisions:
  - "LikeButton row placed after title block closing div, before owner-only 'Last worn' block — satisfies D-03 insertion point"
  - "Conditional render on both props (viewerId !== undefined && initialLikeState !== undefined) so existing callers without the new props see no button"
  - "likeState hydration placed after if (!result) notFound() guard so watch.id is guaranteed non-null"
  - "No __anon__ sentinel on this route — getCurrentUser() throws for anon; user.id always string"
  - "type: 'watch' discriminator used throughout — never 'wear_event'"

metrics:
  duration: "156s"
  completed_date: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 56 Plan 02: Watch Detail LikeButton Wiring Summary

**One-liner:** Server-hydrated LikeButton rendered under the brand/model title in WatchDetail for all authenticated viewers via getLikesForTargetCached prop-threading.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add viewerId + initialLikeState props to WatchDetail; render LikeButton under title | 52df693 | src/components/watch/WatchDetail.tsx |
| 2 | Hydrate like-state in watch/[id]/page.tsx; pass to WatchDetail | 0244bbb | src/app/watch/[id]/page.tsx |

## What Was Built

### Task 1 — WatchDetail (client island)

Added two optional props to `WatchDetailProps`:
- `viewerId?: string | null` — viewer identity (comment: null impossible, watch page is auth-only)
- `initialLikeState?: { liked: boolean; count: number }` — server-hydrated from getLikesForTargetCached

Imported `LikeButton` from `@/components/shared/LikeButton`. Inserted a conditional LikeButton row (`flex items-center gap-2 mt-3`) immediately after the title block `</div>` and before the owner-only "Last worn" block:

```tsx
{viewerId !== undefined && initialLikeState !== undefined && (
  <div className="flex items-center gap-2 mt-3">
    <LikeButton
      viewerId={viewerId ?? null}
      target={{ type: 'watch', id: watch.id }}
      initialLiked={initialLikeState.liked}
      initialCount={initialLikeState.count}
    />
  </div>
)}
```

The button is NOT wrapped in any `viewerCanEdit` condition — visible to all authenticated viewers (D-09, GATE-02).

### Task 2 — watch/[id]/page.tsx (server page)

Added import for `getLikesForTargetCached` from `@/data/reactions`. Added a sequential await after the `if (!result) notFound()` guard:

```ts
const likeState = await getLikesForTargetCached(user.id, { type: 'watch', id })
```

Extended `<WatchDetail />` call with:
- `viewerId={user.id}`
- `initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}`

## Deviations from Plan

None — plan executed exactly as written.

## Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| LikeButton import present in WatchDetail.tsx | PASS |
| `target={{ type: 'watch', id: watch.id }}` present | PASS |
| `viewerId !== undefined && initialLikeState !== undefined` conditional render | PASS |
| LikeButton before first `viewerCanEdit &&` block (line 153 vs 166) | PASS |
| No `'wear_event'` discriminator in new code (pre-existing comment `wear_events` is table name, not discriminator) | PASS |
| tsc --noEmit no errors in WatchDetail.tsx | PASS |
| getLikesForTargetCached import in page.tsx | PASS |
| getLikesForTargetCached(user.id, {type:'watch', id}) call present | PASS |
| viewerId={user.id} and initialLikeState props on WatchDetail | PASS |
| likeState await after notFound() guard | PASS |
| No `wear_event` or `__anon__` in page.tsx | PASS |
| tsc --noEmit no errors in watch/[id]/page.tsx | PASS |

## Known Stubs

None — LikeButton is fully wired with real server-hydrated like state.

## Threat Flags

No new security surface introduced. Per T-56-05 and T-56-06 (plan threat model): cache isolation is owned by `getLikesForTargetCached`; `user.id` is the authenticated viewer arg; LikeButton outside `viewerCanEdit` gate is intentional (GATE-02 design, Phase 55 action enforces auth server-side).

## Self-Check: PASSED

- `src/components/watch/WatchDetail.tsx` — exists, contains LikeButton import and conditional render
- `src/app/watch/[id]/page.tsx` — exists, contains getLikesForTargetCached call and new props
- Commit 52df693 exists in git log
- Commit 0244bbb exists in git log

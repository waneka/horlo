---
phase: 63-inline-grid-engagement
plan: "03"
subsystem: profile-grid
tags: [profile, grid, chips, like, comment, optimistic, gate, threading]
dependency_graph:
  requires:
    - 63-01 (WatchCounts.liked + WatchCounts.canComment + viewer-counts-cache-bust)
    - 63-02 (WatchCommentSheet compose-only bottom sheet)
  provides:
    - overlay ♥/💬 chips on profile grid (non-owner only)
    - optimistic like with silent rollback from grid
    - compose-only sheet open from grid 💬 chip
  affects:
    - src/app/u/[username]/[tab]/page.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx
    - src/components/profile/ProfileWatchCard.tsx
tech_stack:
  added: []
  patterns:
    - useState + useTransition optimistic like (mirrors LikeButton)
    - e.preventDefault() + e.stopPropagation() on chip click to stop Link navigation
    - overlay scrim (bg-black/55 pointer-events-none) + chip row (absolute bottom-2 left-2 z-10)
    - canComment gate for 💬 chip; !isOwner gate for entire chip block
    - handleCommentSuccess delegates close + toast + count-bump to parent
key_files:
  created: []
  modified:
    - src/app/u/[username]/[tab]/page.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx
    - src/components/profile/ProfileWatchCard.tsx
decisions:
  - "text-destructive used for liked Heart (not text-red-400) — no-raw-palette test forbids text-red-\\d; text-destructive is the design token and matches LikeButton (Rule 1 auto-fix)"
  - "isOwner prop gates entire chip block (!isOwner); owner static count line at lines 117-136 unchanged (D-03)"
  - "canComment && gates 💬 chip; ♥ chip always rendered for non-owner (D-04/D-09)"
  - "WatchCommentSheet rendered inside !isOwner block; onSuccess = handleCommentSuccess (D-07)"
  - "Silent rollback on like failure — no toast (D-05); console.error only"
metrics:
  duration: "~20m"
  completed_date: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 63 Plan 03: Inline Grid Engagement — Chip Overlay + Threading Summary

**One-liner:** viewerId + liked/canComment threaded from page.tsx RSC through CollectionTabContent + WishlistTabContent into ProfileWatchCard; overlay ♥/💬 pill chips with scrim, 44px touch targets, optimistic like, silent rollback, and WatchCommentSheet wiring added to non-owner grid cards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Thread viewerId + liked/canComment from RSC through tab-content components | e977e25 | src/app/u/[username]/[tab]/page.tsx, src/components/profile/CollectionTabContent.tsx, src/components/profile/WishlistTabContent.tsx, src/components/profile/ProfileWatchCard.tsx (props only) |
| 2 | Add overlay ♥/💬 chips + scrim + optimistic state + sheet wiring to ProfileWatchCard | 3dd1c84 | src/components/profile/ProfileWatchCard.tsx |

## What Was Built

### Task 1: Prop threading

`page.tsx` (`ProfileTabContent`, ~line 378): widened the `counts` type annotation to `Record<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }>` and added `viewerId={viewerId}` to both `<CollectionTabContent ...>` (line 391) and `<WishlistTabContent ...>` (line 405). The fallback empty Map was also widened to match.

`CollectionTabContent.tsx`: `counts` prop type widened to include `liked: boolean; canComment: boolean`; `viewerId?: string | null` added to Props. Card render extended with `isOwner={isOwner}`, `viewerId={viewerId}`, `liked={counts?.[watch.id]?.liked}`, `canComment={counts?.[watch.id]?.canComment}`.

`WishlistTabContent.tsx`: same Props extension. Non-owner `<ProfileWatchCard>` render extended with `isOwner={false}`, `viewerId={viewerId}`, `liked`, `canComment`. `OwnerWishlistGrid` sub-component counts type widened. `SortableProfileWatchCard` render intentionally omits `liked`/`canComment` (D-03 — owner drag path never renders chips).

`ProfileWatchCard.tsx` (props only): `isOwner?`, `viewerId?`, `liked?`, `canComment?` added to `ProfileWatchCardProps` interface and function destructuring.

`unstable_instant = false` and `ProfileTabContent` uncached: both confirmed untouched.

### Task 2: Overlay chips

New imports added to `ProfileWatchCard.tsx`: `useState`, `useTransition` from 'react'; `toast` from 'sonner'; `toggleLikeAction` from `@/app/actions/reactions`; `WatchCommentSheet` from `@/components/watch/WatchCommentSheet`.

Optimistic state added before `return`:
- `likedState` / `likeCountState` seeded from props
- `likePending` / `startLikeTransition`
- `commentCountState` seeded from `commentCount`
- `sheetOpen`

`handleLikeClick`: `preventDefault` + `stopPropagation` first (D-02), optimistic flip, `startLikeTransition` → `toggleLikeAction({ type: 'watch', id })`, silent rollback on failure (D-05), reconcile on success.

`handleCommentClick`: `preventDefault` + `stopPropagation`, `setSheetOpen(true)`.

`handleCommentSuccess`: `setCommentCountState(n => n + 1)`, `setSheetOpen(false)`, `toast('Comment posted')` (D-07).

Inside `<div className="relative aspect-square bg-muted">`, after the wear badge and gated on `!isOwner` (D-03):
- Scrim: `<div className="absolute inset-x-0 bottom-0 h-12 bg-black/55 pointer-events-none" />`
- Chip row: `<div className="absolute bottom-2 left-2 z-10 flex gap-2">`
  - Heart button: `min-h-[44px] min-w-[44px]`, `aria-pressed`, `aria-busy`, `aria-label`, `disabled={likePending}`; count shown when `(likedState || likeCountState > 0)`
  - Comment button: rendered only when `canComment` (D-09); same touch target
- `<WatchCommentSheet open={sheetOpen} onOpenChange={setSheetOpen} watch={watch} viewerId={viewerId ?? null} onSuccess={handleCommentSuccess} />`

Owner static count line (lines 117–136 of original) unchanged (D-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] text-red-400 replaced with text-destructive**
- **Found during:** Task 2 (discovered during `npm run test` run after first implementation)
- **Issue:** Plan specified `text-red-400` for the liked Heart chip. The project's `tests/no-raw-palette.test.ts` forbids raw Tailwind palette colors (`/\btext-red-\d/`). Using `text-red-400` caused 1 new test failure.
- **Fix:** Changed `text-red-400` → `text-destructive`. This matches the canonical `LikeButton` approach (it uses `text-destructive` for liked state) and the UI-SPEC note that "the accent token (warm gold) is used for the wear badge; ♥ active state stays `text-destructive` for semantic heart-red consistency".
- **Files modified:** `src/components/profile/ProfileWatchCard.tsx`
- **Commit:** included in 3dd1c84 (before commit was finalized)

**2. [Rule 3 - Blocking] Empty Map fallback type mismatch in page.tsx**
- **Found during:** Task 1 first build
- **Issue:** The anon-viewer fallback `new Map<string, { likeCount: number; commentCount: number }>()` didn't match the widened `counts` type annotation, causing a TypeScript error.
- **Fix:** Widened the empty Map generic type to match: `new Map<string, { likeCount: number; commentCount: number; liked: boolean; canComment: boolean }>()`.
- **Files modified:** `src/app/u/[username]/[tab]/page.tsx`
- **Commit:** e977e25

## Source Assertion Results

| Assertion | Expected | Result |
|-----------|----------|--------|
| `grep -c "viewerId={viewerId}" page.tsx` (tab-content lines) | ≥2 | 2 (lines 391, 405) |
| `grep -c "canComment" CollectionTabContent.tsx` | ≥1 | 2 |
| `grep -c "canComment" WishlistTabContent.tsx` | ≥1 | 3 |
| `grep -c "'use cache'" page.tsx` unchanged | 5 (baseline) | 5 |
| `unstable_instant = false` present | present | confirmed |
| SortableProfileWatchCard has no canComment | 0 | 0 |
| `grep -c "e.preventDefault()" ProfileWatchCard.tsx` | ≥2 | 2 |
| `grep -c "e.stopPropagation()" ProfileWatchCard.tsx` | ≥2 | 2 |
| `grep -c "bg-black/55" ProfileWatchCard.tsx` | 1 | 1 |
| `grep -c "min-h-[44px]" ProfileWatchCard.tsx` | ≥2 | 2 |
| `grep -c "!isOwner" ProfileWatchCard.tsx` | ≥1 | 2 |
| `grep -c "canComment &&" ProfileWatchCard.tsx` | ≥1 | 1 |
| `grep -c "toggleLikeAction({ type: 'watch'" ProfileWatchCard.tsx` | 1 | 1 |
| `grep -c "WatchCommentSheet" ProfileWatchCard.tsx` | ≥1 | 2 |
| `grep -c "text-muted-foreground tabular-nums" ProfileWatchCard.tsx` | ≥1 | 1 |
| `npm run build` exit 0 | 0 | 0 |

## Human-Needed Verifications (Prod)

The following behaviors require prod verification (touch/optimistic/sheet/gate-visual — MEMORY `feedback_mobile_ui_verify_on_prod`). Bundle into one deploy: push origin main → Vercel.

| # | Test | Expected | How to verify |
|---|------|----------|---------------|
| 1 | Tap ♥ chip on another user's collection card | Optimistic flip, no nav to /w/ | Visit any profile as non-owner; tap ♥ chip |
| 2 | Tap ♥ chip again (unlike) | Optimistic un-flip, silent rollback | Tap liked ♥ again |
| 3 | Tap 💬 chip | Sheet opens, no nav | Tap 💬 on a card where canComment=true |
| 4 | Post a comment in sheet | Sheet closes, count bumps, 'Comment posted' toast | Type + tap Post |
| 5 | Tap card body (not chip) | Navigates to /w/[ref] | Tap image or text outside chips |
| 6 | Owner's own profile cards | No chips, no scrim visible | Sign in, visit own profile |
| 7 | Non-mutual viewer on foreign wishlist | ♥ chip visible, no 💬 chip | View wishlist of non-mutual user |
| 8 | Navigate away and back | Fresh liked state from server | Navigate to another tab, return |

See `.planning/phases/63-inline-grid-engagement/63-VALIDATION.md` "Manual-Only Verifications" for full test cases.

## Known Stubs

None. All data (liked, canComment, likeCount, commentCount) flows from live DB queries via `getBatchedWatchCountsCached`. The server-side engagement actions (`toggleLikeAction`, `addCommentAction`) are fully wired.

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`:

| Flag | File | Description |
|------|------|-------------|
| T-63-08 (UX hide only) | ProfileWatchCard.tsx | 💬 chip hidden via `canComment &&` — server-side gate in `createComment` is the real guard (CommentGateError); UI hide is defense-in-depth only |
| T-63-09 (accepted) | ProfileWatchCard.tsx | viewerId threaded to client — viewer's own id, not third-party identity |
| T-63-10 (mitigated) | ProfileWatchCard.tsx | watch.id passed to toggleLikeAction — server validates via Zod .strict() + DB ownership check |
| T-63-11 (mitigated) | ProfileWatchCard.tsx | liked seeded from viewer-scoped getBatchedWatchCountsCached; tag busted on every engagement action |

## Self-Check: PASSED

Files confirmed:
- `src/app/u/[username]/[tab]/page.tsx` — exists, `viewerId={viewerId}` at lines 391+405, widened counts type at line 378
- `src/components/profile/CollectionTabContent.tsx` — exists, `canComment` in props + card render
- `src/components/profile/WishlistTabContent.tsx` — exists, `canComment` in props + non-owner card render; SortableProfileWatchCard omits liked/canComment
- `src/components/profile/ProfileWatchCard.tsx` — exists, chip block with scrim, optimistic state, WatchCommentSheet

Commits confirmed:
- e977e25: feat(63-03): thread viewerId + liked/canComment from RSC to tab contents
- 3dd1c84: feat(63-03): add overlay chips + scrim + optimistic like + sheet wiring to ProfileWatchCard

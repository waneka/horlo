---
phase: 57-comment-thread-ui-feed-extension-grid-counts
plan: 06
subsystem: ui
tags: [react, next-cache, profile-grid, counts, disp-01]

requires:
  - phase: 57-03
    provides: "getBatchedWatchCountsCached + WatchCounts interface (DISP-01 batched DAL)"

provides:
  - "DISP-01 grid count line live on collection + wishlist grids (owner DnD + non-owner read-only)"
  - "Single batched read per grid (getBatchedWatchCountsCached) resolved in ProfileTabContent"
  - "ProfileWatchCard likeCount/commentCount props with hidden-at-zero and whole-line removal"

affects:
  - "src/components/profile/ProfileWatchCard.tsx — new count line UI"
  - "src/components/profile/SortableProfileWatchCard.tsx — count props threaded"
  - "src/app/u/[username]/[tab]/page.tsx — batched counts resolved per grid"
  - "src/components/profile/CollectionTabContent.tsx — counts prop threaded"
  - "src/components/profile/WishlistTabContent.tsx — counts threaded (both branches + OwnerWishlistGrid)"

tech-stack:
  added: []
  patterns:
    - "Map→Record serialization for server→client boundary (Maps don't serialize in RSC)"
    - "Single batched read resolved in ProfileTabContent (async/uncached RSC inside Suspense)"
    - "Optional counts? prop pattern for progressive enhancement (no counts = no count line)"

key-files:
  created: []
  modified:
    - src/components/profile/ProfileWatchCard.tsx
    - src/components/profile/SortableProfileWatchCard.tsx
    - src/app/u/[username]/[tab]/page.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx

key-decisions:
  - "viewerId is always non-null on /u/* (Phase 51 Branch B auth gate); added anon guard returning empty Map as safety net for any future access-control change"
  - "Map→Record conversion before crossing server→client boundary: Maps are not serializable in RSC Flight protocol; Object.fromEntries(countsMap) converts once in ProfileTabContent"
  - "ProfileTabContent stays uncached async inside Suspense — no 'use cache' added; getBatchedWatchCountsCached carries its own 'use cache' wrapper (T-57-16 preserved)"
  - "rm -rf .next && npm run build succeeded clean — no PPR regression on /u/[username]/[tab] route"

metrics:
  duration: ~15m
  completed: "2026-05-24"
  tasks: 2
  files: 5
---

# Phase 57 Plan 06: Grid Counts UI (DISP-01) Summary

**DISP-01 grid count line ('♥ N · 💬 M') live on collection and wishlist grids, sourced from a single batched read resolved once per grid in ProfileTabContent — no N+1; comment half gated for non-mutual viewers**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `ProfileWatchCard` now accepts `likeCount?` and `commentCount?` props; renders a '♥ N · 💬 M' count line at the bottom of `CardContent` with: whole-line removal when both zero, per-half hidden-at-zero, `·` separator only when both `> 0`, icons `size-3` (12px), text `text-xs tabular-nums text-muted-foreground`
- `SortableProfileWatchCard` threads `likeCount?` and `commentCount?` through to `ProfileWatchCard`
- `ProfileTabContent` calls `getBatchedWatchCountsCached(viewerId, watchIds, profile.username)` exactly once per grid render (not inside a loop), converts the resulting `Map` to a plain `Record` via `Object.fromEntries`, and passes `counts` to both `CollectionTabContent` and `WishlistTabContent`
- `CollectionTabContent` accepts `counts?` and passes `likeCount`/`commentCount` per card by `watch.id`
- `WishlistTabContent` accepts `counts?` and threads it into both the non-owner `ProfileWatchCard` branch and the owner `OwnerWishlistGrid` → `SortableProfileWatchCard` branch
- D-10 comment gate: enforced at the DAL layer (Plan 03) — `commentCount` is already `0` for gated wishlist cards for non-mutual viewers; the display renders what it receives with no per-card gate logic
- `rm -rf .next && npm run build` succeeded (Cache Components / PPR gate; T-57-16 mitigated)

## Task Commits

1. **Task 1: ProfileWatchCard + SortableProfileWatchCard count line (D-09)** - `52fbcb4` (feat)
2. **Task 2: Resolve batched counts in ProfileTabContent + thread through tab content** - `f098610` (feat)

## Files Created/Modified

- `src/components/profile/ProfileWatchCard.tsx` — Added `likeCount?` + `commentCount?` to props and interface; imported `Heart`, `MessageCircle` from lucide-react; added count line JSX at bottom of CardContent
- `src/components/profile/SortableProfileWatchCard.tsx` — Added `likeCount?` + `commentCount?` to `SortableProfileWatchCardProps`; threaded both props into `<ProfileWatchCard />`
- `src/app/u/[username]/[tab]/page.tsx` — Added `getBatchedWatchCountsCached` import; resolved counts once in the collection/wishlist/notes branch; added Map→Record conversion; passed `counts` to tab content components
- `src/components/profile/CollectionTabContent.tsx` — Added `counts?` prop to interface; threaded `likeCount`/`commentCount` per card by `watch.id` in the grid map
- `src/components/profile/WishlistTabContent.tsx` — Added `counts?` prop to `WishlistTabContentProps`; threaded to non-owner `ProfileWatchCard` map and owner `OwnerWishlistGrid`; updated `OwnerWishlistGrid` to accept `counts?` and pass to `SortableProfileWatchCard`

## Decisions Made

**1. viewerId auth gate determination**

Per Phase 51 Branch B (memory: feedback_proxy_router_cache_poisoning.md), `/u/*` is auth-gated — `viewerId` is always non-null when `ProfileTabContent` renders. The anon-guard path (`viewerId !== null ? ... : new Map()`) is a safety net for correctness; in practice it is never reached. Documented in code comment.

**2. Map→Record serialization**

`getBatchedWatchCountsCached` returns `Promise<Map<string, WatchCounts>>`. React Server Component Flight serialization does not support `Map` natively. `Object.fromEntries(countsMap)` converts to a plain `Record<string, {likeCount, commentCount}>` before passing to client components via props — this crosses the RSC→client boundary cleanly.

**3. ProfileTabContent stays uncached (T-57-16)**

`'use cache'` was NOT added to `ProfileTabContent`. The function is an async RSC inside `<Suspense>` (D-52-16 structural lock). `getBatchedWatchCountsCached` carries its own `'use cache'` directive with `cacheTag('profile:${username}', 'viewer:${viewerId}:counts')` — the caching is done at the DAL layer, not the page layer. This preserves the Cache Components / PPR structure established in Phase 52.

**4. Build gate result**

`rm -rf .next && npm run build` completed successfully with `✓ cacheComponents` and `✓ Compiled successfully`. No React #419 / PPR regression on `/u/[username]/[tab]`. The profile route still shows `◐  /u/[username]/[tab]` (Partial Prerender), confirming the PPR structure is intact.

## Deviations from Plan

None — plan executed exactly as written.

## Acceptance Criteria Verification

- `grep -c "(likeCount ?? 0) > 0 || (commentCount" src/components/profile/ProfileWatchCard.tsx` → **1** (outer guard present)
- `grep -c "MessageCircle" src/components/profile/ProfileWatchCard.tsx` → **2** (import + JSX usage)
- `grep -c "getBatchedWatchCountsCached" 'src/app/u/[username]/[tab]/page.tsx'` → **3** (1 import + 1 comment + 1 actual call; the call is not inside a map/loop)
- `grep -c "Object.fromEntries" 'src/app/u/[username]/[tab]/page.tsx'` → **4** (existing usages + new Map→Record conversion)
- `grep -n "'use cache'" 'src/app/u/[username]/[tab]/page.tsx'` → **3 comment occurrences only** (no 'use cache' directive added to ProfileTabContent)
- `npx tsc --noEmit` — no errors in `src/` files touched by this plan
- `npm run test` — 5 pre-existing failures (ECONNREFUSED + watch-page-verdict, verified pre-exist on HEAD~2); priceLine test suite 9/9 PASS
- `rm -rf .next && npm run build` — **BUILD SUCCEEDED** (Cache Components gate; PPR intact)

## Known Stubs

None. The count line renders real counts from `getBatchedWatchCountsCached` (Plan 03 implementation). No hardcoded empty values or placeholders. Cards with zero counts show no count line (correct behavior, not a stub).

## Threat Flags

None beyond what was enumerated in the plan's `<threat_model>`:
- T-57-02 (D-10 comment gate leak): mitigated — DAL returns `commentCount:0` for gated cards; display renders what it receives
- T-57-07 (per-viewer cache leak): mitigated — `getBatchedWatchCountsCached` uses `viewer:${viewerId}:counts` cacheTag (Plan 03)
- T-57-16 (Cache Components PPR regression): mitigated — `ProfileTabContent` is NOT marked `'use cache'`; build gate confirmed clean

## Self-Check: PASSED

Files verified:
- `src/components/profile/ProfileWatchCard.tsx` — FOUND (Heart, MessageCircle imports; count line JSX; optional props)
- `src/components/profile/SortableProfileWatchCard.tsx` — FOUND (likeCount?/commentCount? threaded)
- `src/app/u/[username]/[tab]/page.tsx` — FOUND (getBatchedWatchCountsCached import + single call + Object.fromEntries + counts passed to tab content)
- `src/components/profile/CollectionTabContent.tsx` — FOUND (counts? prop; likeCount/commentCount per card)
- `src/components/profile/WishlistTabContent.tsx` — FOUND (counts? prop; threaded to non-owner branch + OwnerWishlistGrid + SortableProfileWatchCard)

Commits verified:
- `52fbcb4` — FOUND (feat(57-06): ProfileWatchCard + SortableProfileWatchCard)
- `f098610` — FOUND (feat(57-06): ProfileTabContent batched counts + thread)

---
*Phase: 57-comment-thread-ui-feed-extension-grid-counts*
*Completed: 2026-05-24*

---
phase: 10-activity-feed
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - src/app/actions/feed.ts
  - src/app/actions/suggestions.ts
  - src/app/actions/wishlist.ts
  - src/app/page.tsx
  - src/app/layout.tsx
  - src/components/theme-provider.tsx
  - src/components/home/ActivityRow.tsx
  - src/components/home/AggregatedActivityRow.tsx
  - src/components/home/CollectorsLikeYou.tsx
  - src/components/home/CommonGroundFollowerCard.tsx
  - src/components/home/FeedEmptyState.tsx
  - src/components/home/LoadMoreButton.tsx
  - src/components/home/LoadMoreSuggestionsButton.tsx
  - src/components/home/MostWornThisMonthCard.tsx
  - src/components/home/NetworkActivityFeed.tsx
  - src/components/home/PersonalInsightsGrid.tsx
  - src/components/home/RecommendationCard.tsx
  - src/components/home/SleepingBeautyCard.tsx
  - src/components/home/SuggestedCollectorRow.tsx
  - src/components/home/SuggestedCollectors.tsx
  - src/components/home/WatchPickerDialog.tsx
  - src/components/home/WishlistGapCard.tsx
  - src/components/home/WywtOverlay.tsx
  - src/components/home/WywtRail.tsx
  - src/components/home/WywtSlide.tsx
  - src/components/home/WywtTile.tsx
  - src/components/layout/Header.tsx
  - src/components/layout/HeaderSkeleton.tsx
  - src/components/layout/NavWearButton.tsx
  - src/data/activities.ts
  - src/data/recommendations.ts
  - src/data/suggestions.ts
  - src/data/wearEvents.ts
  - src/hooks/useViewedWears.ts
  - src/lib/discoveryTypes.ts
  - src/lib/feedAggregate.ts
  - src/lib/feedTypes.ts
  - src/lib/recommendations.ts
  - src/lib/timeAgo.ts
  - src/lib/wishlistGap.ts
  - src/lib/wywtTypes.ts
  - supabase/migrations/20260422000000_phase10_activities_feed_select.sql
  - next.config.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Phase 10 delivers the 5-section network home (WYWT rail, Collectors Like You, Network Activity, Personal Insights, Suggested Collectors). The security posture is strong: all three Server Actions auth-gate via `getCurrentUser`, Zod-validate with `.strict()` (mass-assignment blocked), and emit generic error strings. The two-layer privacy model for the feed DAL is well-executed (RLS `activities_select_own_or_followed` outer gate plus per-event WHERE clauses in `getFeedForUser`), the F-05 own-filter is present (`not(eq(activities.userId, viewerId))`), and the F-06 per-tab visibility (collection/wishlist/worn `public` flags) is correctly wired. `addToWishlistFromWearEvent` applies the expected defense-in-depth visibility gate with a uniform error message to avoid existence leaks. The Pitfall 10 single-picker contract holds: `WatchPickerDialog` is lazy-loaded and shared between `WywtRail` and `NavWearButton` — no duplicate picker exists. React 19 / Next.js 16 patterns are used idiomatically: `'use cache'` + `cacheLife('minutes')` on `CollectorsLikeYou` with `viewerId` passed as a function argument (Pitfall 7 cache-key safety), `cacheComponents: true` in `next.config.ts`, Suspense around the `Header` auth read, and a blocking theme-init script to avoid FOUC under the Cache Components restriction on `cookies()` in layouts. Client hydration guards are correct in `useViewedWears` (empty Set + `hydrated=false` on server) and `WywtTile` (gates `isViewed` on `hydrated`).

Findings below are non-blocking but merit attention before phase close. Nothing critical; no privacy invariant violations were found.

## Warnings

### WR-01: Cursor schema allows `NaN` / non-finite overlap values

**File:** `src/app/actions/suggestions.ts:19-24`
**Issue:** `cursorSchema.overlap` is typed `z.number()`, which accepts `NaN`, `Infinity`, and `-Infinity`. While JSON drops these to `null` and the React Server Component wire format typically rejects them, nothing in the action's contract enforces finiteness. If a non-finite value ever slips through (e.g., via a future API that re-exposes this shape, or a debugger/SSR bypass), the downstream comparator in `getSuggestedCollectors`:
```ts
c.overlap < cursor.overlap || (c.overlap === cursor.overlap && c.userId > cursor.userId)
```
becomes entirely false for `NaN` comparisons and pagination silently stalls (every page returns the same first-page rows). The bucket values emitted by `overlapBucket` are always finite (0.2 / 0.55 / 0.85), so well-behaved clients never produce an invalid cursor — but the schema should still reject adversarial input.
**Fix:**
```ts
const cursorSchema = z
  .object({
    overlap: z.number().finite(),
    userId: z.string().uuid(),
  })
  .strict()
```

### WR-02: `PersonalInsightsGrid` loads taste-overlap data for followers without honoring their privacy settings

**File:** `src/components/home/PersonalInsightsGrid.tsx:123-144`
**Issue:** For Common Ground, the grid fetches `getTasteOverlapData(viewerId, f.userId)` for each of the viewer's first 10 followings and uses `computeTasteOverlap(data.viewer, data.owner).sharedWatches.length` to pick the top match. `getTasteOverlapData` in `src/data/follows.ts` pulls the full owner collection / preferences / wear events without consulting `profile_settings.collection_public` or `profile_public`. On the Common Ground tab itself this is gated by `common-ground-gate.ts` (`resolveCommonGround`), but this home-page call path has no such gate. Two concrete consequences:
1. A follower who toggled `profile_public=false` after the follow relationship was created still has their `displayName` / `avatarUrl` / `username` surfaced via the Common Ground card on the home.
2. A follower who kept `collection_public=false` has `sharedWatches.length` computed from their private collection — the *count* is disclosed, not the content. This is subtler than a full leak but still violates the "collection_public=false hides all of the collection" invariant enforced on their own tabs.

The DAL currently enforces no such gate — see `src/data/follows.ts:198-253` — so the fix must happen at the call site.
**Fix:** Pre-filter `following` by `profilePublic=true` before scoring, and also require either the viewer-owner having `collectionPublic=true` (mirror `common-ground-gate.ts`). Easiest path is to reuse the existing gate helper:
```ts
import { resolveCommonGround } from '@/app/u/[username]/common-ground-gate'

const scored = await Promise.all(
  following.slice(0, COMMON_GROUND_SCAN_LIMIT).map(async (f) => {
    try {
      const overlap = await resolveCommonGround({ viewerId, ownerId: f.userId })
      return { f, shared: overlap?.sharedWatches.length ?? 0 }
    } catch {
      return { f, shared: 0 }
    }
  }),
)
```
(or inline the `profile_public` / `collection_public` check before calling `getTasteOverlapData`). This also silently fixes the case where a previously-public follower turned private after being followed.

### WR-03: `WywtSlide` button is not disabled after a successful add, allowing re-submit when `status === 'added'`

**File:** `src/components/home/WywtSlide.tsx:81-105`
**Issue:** The success branch renders only `<p>Added to wishlist.</p>` with no button, so on first success the UX is correct. But note the overlay stays mounted for repeat swipes — after `setStatus('added')` the user could swipe back to this slide and the text persists correctly. The subtler bug: in the error branch `Retry` is always enabled unless `pending` is true; no check on `status` prevents a double-tap race where a second `addToWishlistFromWearEvent` is dispatched while the first call's `watches.insert` is still in flight. The action itself calls `createWatch` which unconditionally inserts a new row, so a double-dispatch creates TWO wishlist rows for the same (brand, model). This is documented as intentional in `wishlist.ts:29-31` ("Per Horlo's per-user-independent-entries model there is no canonical watch DB; duplicates are tolerated"), but a double-submit from one *retry click* is a different case — the user didn't intend two adds.

This is the same race that `useTransition` is designed to protect against: `disabled={pending}` already covers the in-flight case. The bug is the `startTransition` guarded by `status !== 'added'` isn't enforced. The simpler posture: disable Retry once `status === 'added'` *and* clear status on swipe.
**Fix:**
```tsx
const handleAddToWishlist = () => {
  if (pending || status === 'added') return
  setStatus('idle')
  startTransition(async () => { /* … */ })
}
```
And on the retry button: `disabled={pending || status === 'added'}`.

### WR-04: `getFeedForUser` cursor tuple bypasses `id`-tiebreak ordering in strict equality case

**File:** `src/data/activities.ts:58-94`
**Issue:** The keyset uses PostgreSQL row-value comparison `(created_at, id) < ($cursorCreatedAt, $cursorId)`, which is correct for strict lexicographic ordering. However, `ORDER BY desc(activities.createdAt), desc(activities.id)` sorts the *outer* result by `(created_at DESC, id DESC)`. Row-value comparison with `<` is standard-SQL lexicographic: it compares the first component first and only falls through to the second on equality. That aligns correctly with the ORDER BY. This part is fine.

The real concern is the `activities.id` type. PostgreSQL `uuid` values compare by their byte representation, not textual hex. The row-value comparator will still give a total order, but the cursor *text* going over the wire is the standard UUID string, and `<`/`>` on UUIDs in Postgres IS string-stable (the textual hex ordering matches the byte ordering because both are hex). So correctness is preserved. No fix needed here — however, under concurrent inserts between pages the `FEED-03` guarantee relies on `(created_at, id)` being a unique tuple. `id` is a UUID v4 so uniqueness is effectively guaranteed. Flagging as Warning only because the comment on lines 38-39 ("`id` is the UUID tiebreaker for rows sharing a millisecond timestamp") is correct but should explicitly note that `created_at` has microsecond precision in Postgres `timestamptz` — at that resolution the id tiebreaker almost never fires. The comment could mislead a future reader into thinking millisecond collisions are the common case.
**Fix:** Tighten the JSDoc on `feedTypes.ts:19-22` and/or the inline comment at `activities.ts:57-61` to clarify `id` is a rare-case tiebreaker for microsecond-identical `created_at` values. No runtime change required.

## Info

### IN-01: `logActivity` inserts without catching; caller relies on try/catch

**File:** `src/data/activities.ts:22-34`
**Issue:** `logActivity` unconditionally `await db.insert(...)`. Callers that want fire-and-forget semantics (e.g., `addToWishlistFromWearEvent` at `wishlist.ts:104-112`) must wrap it in try/catch, which they do. Consider documenting this in the JSDoc so a future caller doesn't accidentally surface an unlogged failure as a user-visible error.
**Fix:** Add a one-line JSDoc: `/** Throws on DB failure — callers MUST wrap in try/catch if the primary mutation must not be blocked. */`

### IN-02: `aggregateFeed` casts `head.type` to narrow union — cast is redundant

**File:** `src/lib/feedAggregate.ts:62-64`
**Issue:** The `head.type as 'watch_added' | 'wishlist_added'` cast at line 64 is narrowed by the `aggregatable` guard on line 25, so TypeScript already knows the type at that point. The cast is safe but noisy.
**Fix:** Remove the cast — `type: head.type` works because control flow narrowing is active. Optional cleanup.

### IN-03: `getRecommendationsForViewer` runs N+1 DAL reads per Load/rerender

**File:** `src/data/recommendations.ts:93-121`
**Issue:** For every public collector, the DAL issues 3 parallel DB queries (watches / preferences / wear events). At 500 users the entire recommendation path issues ~1500 queries on each cache miss. This is guarded by `'use cache'` with `cacheLife('minutes')` in `CollectorsLikeYou`, but the cache key includes `viewerId` only — every distinct viewer pays the cost on first hit. Out of v1 scope (performance) per review guidelines, but worth a follow-up ticket. Suggested approach: batch the three reads with `inArray(userId, publicProfileIds)` to collapse the N+1 into 3 queries total.
**Fix:** Deferred — out of v1 review scope. Consider a follow-up phase.

### IN-04: `WywtRail` uses the tile's `wearEventId` as React key, but also prepends a synthetic self-placeholder — the `self-${i}` fallback could collide if two placeholders ever appear

**File:** `src/components/home/WywtRail.tsx:93-96`
**Issue:** The current `entries` array is built such that at most one placeholder is ever prepended (`hasOwn ? [] : [{ tile: null, isSelfPlaceholder: true }]`), so `self-${i}` only ever produces `self-0`. Safe today, but the key strategy is fragile if the composition rule ever changes (e.g., future per-day placeholders). Use a stable sentinel like `'self-placeholder'` so the key is semantic.
**Fix:** `key={entry.isSelfPlaceholder ? 'self-placeholder' : entry.tile!.wearEventId}`

### IN-05: `Header` falls back to empty `ownedWatches` silently on DB failure

**File:** `src/components/layout/Header.tsx:39-42`
**Issue:** On a transient `getProfileById` / `getWatchesByUser` failure the header renders with `ownedWatches = []`, which in `WatchPickerDialog` triggers the "Add a watch first" empty-state branch. A user with a valid collection who hits a transient DB blip would be shown the wrong dialog on a nav `+ Wear` click. The fallback is defensible (the header still paints) but the UX degradation is misleading. Consider disabling the `NavWearButton` entirely when the watch fetch failed, so the user gets no dialog instead of a wrong one.
**Fix:** Track the error state separately:
```ts
let watchesLoadFailed = false
// in catch: watchesLoadFailed = true
// …then pass it to NavWearButton and hide the button when true.
```

### IN-06: `timeAgo` returns a locale-formatted date for ≥4w without timezone pinning

**File:** `src/lib/timeAgo.ts:31`
**Issue:** `then.toLocaleString('en-US', { month: 'short', day: 'numeric' })` uses the runtime's local time zone. On the server this is UTC on Vercel (or whatever the host is configured for); on the client it is the user's local TZ. An event worn late in the day in one TZ may render as a different date after SSR vs. hydration, which could produce a client/server text mismatch (React 19 usually warns on text hydration mismatches). In practice the ≥4w branch fires only for events at least 28 days old, so the day-boundary edge is rare, but the hydration risk is real.
**Fix:** Pin the format to UTC for consistency:
```ts
return then.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
```

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

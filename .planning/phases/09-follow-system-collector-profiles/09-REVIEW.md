---
phase: 09-follow-system-collector-profiles
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/app/actions/follows.ts
  - src/app/u/[username]/[tab]/page.tsx
  - src/app/u/[username]/common-ground-gate.ts
  - src/app/u/[username]/followers/page.tsx
  - src/app/u/[username]/following/page.tsx
  - src/app/u/[username]/layout.tsx
  - src/components/profile/AvatarDisplay.tsx
  - src/components/profile/CommonGroundHeroBand.tsx
  - src/components/profile/CommonGroundTabContent.tsx
  - src/components/profile/FollowButton.tsx
  - src/components/profile/FollowerList.tsx
  - src/components/profile/FollowerListCard.tsx
  - src/components/profile/LockedProfileState.tsx
  - src/components/profile/LockedTabCard.tsx
  - src/components/profile/ProfileHeader.tsx
  - src/components/profile/ProfileTabs.tsx
  - src/data/follows.ts
  - src/lib/tasteOverlap.ts
  - tests/actions/follows.test.ts
  - tests/app/layout-common-ground-gate.test.ts
  - tests/components/profile/CommonGroundHeroBand.test.tsx
  - tests/components/profile/CommonGroundTabContent.test.tsx
  - tests/components/profile/FollowButton.test.tsx
  - tests/components/profile/FollowerListCard.test.tsx
  - tests/components/profile/LockedProfileState.test.tsx
  - tests/components/profile/LockedTabCard.test.tsx
  - tests/components/profile/ProfileTabs.test.tsx
  - tests/data/follows.test.ts
  - tests/lib/tasteOverlap.test.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 9 delivers the follow system + collector profiles cleanly. The core invariants are well guarded: the Server Action uses `z.strict()` for mass-assignment protection, the common-ground gate is single-sourced and explicitly refuses to call the DAL until the three-way gate passes (T-09-22 invariant is enforced), and list hydration uses Promise.all over explicit id sets rather than per-row queries. The DAL uses parameterized Drizzle (`inArray`, `eq`, `and`) and a `sql<number>` tagged-template FILTER clause with no user-controlled fragments — no injection exposure. Tests pin the load-bearing behaviors (self-follow rejection, revalidatePath path+type, gate short-circuiting, payload shape).

No critical issues. The warnings are quality-of-correctness issues that could surface under load or unusual data, not vulnerabilities. The info items are polish.

## Warnings

### WR-01: Follower/Following hydration runs N round-trips instead of a single batched query

**File:** `src/app/u/[username]/followers/page.tsx:51-53`, `src/app/u/[username]/following/page.tsx:43-45`

**Issue:** `Promise.all(entries.map((e) => isFollowing(localViewerId, e.userId)))` fires one DB query per row. For N followers this is N concurrent SELECTs against `follows`. The header comment on `followers/page.tsx:45` claims "Single round trip across N parallel queries — no N+1 serial loop" — concurrent is not the same as single. Each call round-trips to Postgres; at 100-row lists this becomes 100 connection-pool seats contending for the same operation. Plan-01's DAL merge pattern (single `inArray` query, merge by id) is the established convention in this codebase and is what the header comment's reference to "single-query DAL (no N+1)" implies. The current code contradicts both the convention and its own comment.

**Fix:** Add a batched `isFollowingMany` helper to `src/data/follows.ts` and call it once per page:

```ts
// src/data/follows.ts
export async function isFollowingMany(
  followerId: string,
  candidateIds: string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set()
  const rows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        inArray(follows.followingId, candidateIds),
      ),
    )
  return new Set(rows.map((r) => r.followingId))
}
```

Then in `followers/page.tsx` / `following/page.tsx`:

```ts
const viewerFollowingSet = viewerId
  ? await isFollowingMany(viewerId, entries.map((e) => e.userId))
  : new Set<string>()
```

This is one round trip regardless of list size and aligns with the Pitfall-7 single-pass merge idiom used by `mergeListEntries`. Same issue, same fix, applies to both `/followers` and `/following`.

---

### WR-02: `useEffect([initialIsFollowing])` clobbers in-flight optimistic state during `router.refresh()` races

**File:** `src/components/profile/FollowButton.tsx:54-56` (in conjunction with lines 83-99)

**Issue:** The component optimistically flips `setIsFollowing(next)` at line 85, then awaits the Server Action. On success it calls `router.refresh()` which streams a new `initialIsFollowing` down from the server. The effect on line 54 blindly writes `setIsFollowing(initialIsFollowing)` whenever the prop changes — but the prop update arrives asynchronously, and if the user toggles the button a *second* time before the first refresh lands, the effect will overwrite the newly-optimistic state with the stale server value (which reflects the PREVIOUS successful action, not the current in-flight one).

Concrete race:
1. User clicks Follow — optimistic flip to `true`, Server Action in flight.
2. Action succeeds, `router.refresh()` scheduled.
3. User clicks Unfollow *immediately* — optimistic flip to `false`, new Server Action in flight. `pending` is still true from the first transition; React batches, but the second click is allowed because `disabled={pending}` lags by one render.
4. The first refresh completes; `initialIsFollowing` re-hydrates as `true`.
5. The effect fires and writes `setIsFollowing(true)` — overwriting the user's second optimistic state. The UI now shows "Following" even though an unfollow is in flight.

The code comment acknowledges "re-sync local state when the parent hydrates a fresh initialIsFollowing" but does not guard against this collision.

**Fix:** Gate the effect on `!pending` so in-flight state is never overwritten by a stale server value:

```tsx
useEffect(() => {
  if (pending) return
  setIsFollowing(initialIsFollowing)
}, [initialIsFollowing, pending])
```

Even safer: only re-sync when the prop differs from local state AND no transition is pending AND no action is currently running. The `disabled={pending}` gate blocks new clicks but does not block the effect from overwriting state mid-flight.

---

### WR-03: `mergeListEntries` silently drops rows whose profile was deleted after the follow was recorded

**File:** `src/data/follows.ts:160-162`

**Issue:** `return ordered.flatMap((row) => { const p = profileById.get(row.userId); if (!p) return [] ... })` discards any follower whose `profiles` row no longer exists. This may be intentional, but the follower count from `getFollowerCounts` queries `follows` directly, so the list count in `ProfileHeader` will not match the number of rows shown on `/followers`. User-visible: "42 followers" in the header but 40 rows in the list.

This also masks data-integrity issues — a FK constraint should ensure a `follows` row cannot outlive the `profiles` row. If the schema relies on ON DELETE CASCADE, this branch is dead code; if it doesn't, the code is papering over drift that the header count surfaces.

**Fix:** Either (a) verify the FK has `onDelete: 'cascade'` on both `follower_id` and `following_id` and convert the defensive branch to an invariant-breaking throw (so drift is surfaced loudly), or (b) fix `getFollowerCounts` to compute the count from the same joined result so header and list stay consistent. Option (a) is preferred — silent divergence is worse than a loud failure during reconciliation.

---

### WR-04: Avatar URL round-trip strips `getSafeImageUrl`'s https-upgrade work when the stored URL is http

**File:** `src/components/profile/AvatarDisplay.tsx:21, 37`

**Issue:** `getSafeImageUrl` returns the URL **after** upgrading http→https (line 15 of `src/lib/images.ts` sets `parsed.protocol = 'https:'` and returns the new string). But the `AvatarDisplay` call passes the already-upgraded result straight into `<Image src={safe} />`. That's fine for the rendered image — however, the `sizes` prop is derived from the *intended* display size (correct), and the `alt` text uses the raw `displayName ?? username`. So far so good.

The real issue: when `getSafeImageUrl` returns null (bad URL, file:// scheme, data:, javascript:), the component falls through to the initial-letter placeholder — *silently*. Users who paste a malformed avatar URL in settings have no indication it was rejected. For avatars this is low-stakes, but the pattern is worth flagging because the Phase 8 profile edit form almost certainly accepts the URL without validating it client-side, so "saved successfully" but "avatar shows initial" is a confusing UX.

**Fix:** Not strictly in Phase-9 scope, but the profile-edit server action (or the AvatarDisplay) should surface when a provided URL resolves to null. At minimum, log a warning when `avatarUrl` is non-null but `getSafeImageUrl` returns null — currently there is no signal. A quick win: in `AvatarDisplay`, add `if (process.env.NODE_ENV !== 'production' && avatarUrl && !safe) console.warn('[AvatarDisplay] rejected avatarUrl:', avatarUrl)`.

## Info

### IN-01: FollowerListCard makes the entire row a nested interactive — keyboard focus hits both the Link and the Follow button independently

**File:** `src/components/profile/FollowerListCard.tsx:66-70, 99-114`

**Issue:** The row has an absolute-positioned `<Link>` overlay covering the entire card (z-0) and a `<FollowButton>` promoted to z-10 with `pointer-events-auto`. Mouse clicks work correctly (stopPropagation on lines 101-104 prevents row navigation). Keyboard is subtler: Tab traverses both interactive elements — first the Link (row), then the FollowButton — which is correct a11y behavior but produces the WCAG "nested interactive content" smell because both live inside the same visual "card." Screen reader order announces "View Tyler's profile" (link) → button — acceptable but the Link having `aria-label` with `'` apostrophe (`View Tyler's profile`) renders fine in React; just worth documenting that these are two distinct tab stops.

The `onKeyDown` handler at line 102-104 that calls `stopPropagation` on Enter/Space is unnecessary — the Link is the sibling overlay, not an ancestor, so key events on the button don't bubble *into* the Link in React's synthetic event system anyway. The handler is defensive but does no work in practice.

**Fix:** No functional change required. Optional cleanups: remove the redundant `onKeyDown` wrapper or add a comment explaining what it's actually defending against. If the intent was to preserve the pattern from a prior codebase where the Link was an ancestor, note that here.

---

### IN-02: `isMobileViewport()` queries matchMedia on every click — prefer once-per-render memoization

**File:** `src/components/profile/FollowButton.tsx:151-155`

**Issue:** Called on every click; for SSR hydration correctness this is fine (guarded by `typeof window === 'undefined'`) but the result can change over the lifetime of a mounted component if the user rotates a tablet. Minor; not a bug. The test file at `tests/components/profile/FollowButton.test.tsx:46-78` rewrites `window.matchMedia` in `beforeEach` which suggests the author already knows this is synchronous lookup.

**Fix:** Consider `useSyncExternalStore` or a one-off `useMediaQuery` hook if mobile detection is used elsewhere. Not required for this phase — working as intended.

---

### IN-03: `revalidatePath('/u/[username]', 'layout')` invalidates every profile page, not just the one whose follow state changed

**File:** `src/app/actions/follows.ts:46, 77`

**Issue:** Per Next.js 16 docs (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md:151-162`), `revalidatePath('/u/[username]', 'layout')` matches any path under the `/u/[username]` layout. Following a single user therefore invalidates the cache for *every* profile page the viewer has visited this session, not just the target profile. At Phase 9's MVP scale (<500 watches per user, low profile navigation traffic) this is a non-issue; it's a correctness win because it also refreshes the viewer's *own* profile counters (followers/following) when they navigate back.

**Fix:** None for MVP. If profile-page cache invalidation becomes a hotspot, switch to a literal path like `revalidatePath(\`/u/${targetUsername}\`, 'layout')` — but that requires looking up the target's username from the userId, which adds a DAL call. Current approach is a deliberate simplicity tradeoff.

---

### IN-04: `computeTasteOverlap` averages similarity scores without handling 1-watch edge case

**File:** `src/lib/tasteOverlap.ts:82-88`

**Issue:** When `viewerOwned.length === 1`, `avg` is the similarity of the single viewer watch against the full owner collection. This is dominated by whatever random ordering `analyzeSimilarity` returns on the owner's nearest match. Two new users with one-watch collections each flip wildly between "Strong overlap" and "Different taste" based on that single watch. The D-05 spec acknowledges the zero-watch case but not the one-watch case.

**Fix:** Consider requiring `viewerOwned.length >= 2` before computing a label — or documenting that single-watch viewers always get "Different taste" to avoid the bimodal signal. This is a product decision; flagging for visibility.

---

### IN-05: `AvatarDisplay` uses `size={40}` but sets `sizes={40px}` — next/image prefers vw-based sizes

**File:** `src/components/profile/AvatarDisplay.tsx:40`

**Issue:** `sizes={`${size}px`}` passes `40px` / `64px` / `96px` to next/image. This works but next/image's `sizes` attribute is designed for responsive selection based on viewport width. With fixed-px sizes the browser just picks the smallest candidate image that fits. Given the project has `images.unoptimized: true` (see `src/lib/images.ts:3-6`), this is moot — the browser fetches the origin URL directly and the `sizes` prop is ignored.

**Fix:** None required while `unoptimized` is on. Note for future work: when optimization is enabled, revisit `sizes` semantics.

---

### IN-06: ProfileTabs fallback to 'collection' active tab is ambiguous on /followers and /following

**File:** `src/components/profile/ProfileTabs.tsx:40-41`

**Issue:** `activeTab = tabs.find((t) => pathname.endsWith(\`/${t.id}\`))?.id ?? 'collection'`. On `/u/tyler/followers` or `/u/tyler/following`, no tab ends with the pathname, so `collection` is shown as active — but the user is not on the collection page. This produces a visual "collection tab highlighted" while the content below is the followers list. Minor; the layout header "Followers / Following" provides orienting context.

**Fix:** Return undefined (no active tab) when pathname is `/followers` or `/following`:

```tsx
const activeTab =
  tabs.find((t) => pathname.endsWith(`/${t.id}`))?.id
```

And let the underlying `Tabs` primitive handle "no active value" — verify it doesn't crash when `value` is undefined.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

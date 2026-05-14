# Phase 39c: Profile Layout Next 16 Conformance - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor `src/app/u/[username]/layout.tsx` to comply with Next 16 `cacheComponents: true` partial-prefetch semantics so prefetching can be safely restored on profile-bound `<Link>` sites (UserMenu avatar, ProfileTabs triggers, BottomNav Profile NavLink) without re-introducing Router-Cache poisoning. The layout currently performs ~8 uncached runtime fetches at the top level (`getCurrentUser`, `getProfileByUsername`, `getProfileSettings`, `getFollowerCounts`, `getWatchesByUser`, `getAllWearEventsByUser`, `isFollowing`, `resolveCommonGround`). Under `cacheComponents: true`, any uncached read at the layout body blocks the static shell during prefetch and creates the conditions for the cache-poisoning bug verified in prod 2026-05-13 (`.planning/debug/profile-page-404-top-nav.md`).

This phase produces:
1. A `'use cache'`-marked `<ProfileShellResolver/>` Server Component holding the owner-scoped reads (profile, settings, counts, watches, wearEvents, taste tags).
2. A single `<ProfileGate/>` Suspense subtree handling viewer-dependent state (cookies/auth, locked-vs-public decision, follow state, common-ground overlap).
3. `src/app/u/[username]/loading.tsx` rendering `<ProfileShellSkeleton/>`.
4. `<ProfileShellSkeleton/>` chrome-only component (avatar + name + tab pills + content card placeholder).
5. `export const unstable_instant = { prefetch: 'static' }` on `/u/[username]/[tab]/page.tsx` as a build-time gate.
6. Revert of diagnostic commit `2f42d00` — restores default prefetch on UserMenu, ProfileTabs, BottomNav.
7. Cache invalidation wiring in existing Server Actions (profile.ts, watches.ts, follows.ts) using new `profile:${username}` and `viewer:${viewerId}:profile:${ownerId}` tag families.

### In scope

- Refactor `src/app/u/[username]/layout.tsx` per Path A3 (Hybrid)
- New `<ProfileShellResolver/>`, `<ProfileGate/>`, `<ProfileShellSkeleton/>` components
- New `loading.tsx` at `src/app/u/[username]/loading.tsx`
- `unstable_instant` export on `/u/[username]/[tab]/page.tsx`
- Revert of `2f42d00` (prefetch={false} mitigation on three Link sites)
- Cache invalidation wiring in profile.ts / watches.ts / follows.ts Server Actions
- Prod verification of all three profile-link entry points

### Out of scope

- `src/app/login/login-form.tsx` push/refresh ordering hardening (debug doc Resolution → "Root-cause hardening: deferred")
- Authoring `not-found.tsx` at `src/app/u/[username]/` if one isn't already required by the existing `notFound()` from missing-profile — investigate during planning, may be a no-op
- Any change to children routes (`/[tab]`, `/followers`, `/following`) beyond the `unstable_instant` export on `[tab]/page.tsx`
- Auditing other layouts in the codebase for similar `cacheComponents` violations (separate phase if identified)

</domain>

<decisions>
## Implementation Decisions

### Architectural path (D-39c-01)

- **D-39c-01 — Path A3 (Hybrid).** Cache the idempotent owner-scoped reads behind a `'use cache'` Server Component. Push viewer-dependent reads (cookies, follow state, common-ground) into a Suspense-wrapped gate. The layout's `<main>` chrome prerenders; the gate streams in. This is the smallest refactor that produces a true static shell per the Next 16 `cacheComponents: true` model.

### Cache boundaries + tag taxonomy (D-39c-02 → D-39c-04)

- **D-39c-02 — Per-profile-owner + per-viewer tag families.** Introduce two new tag families:
  - `profile:${username}` for owner-scoped reads (profile lookup, settings, counts, watches, wearEvents, taste tags). The username is the natural cache key because the resolver receives username from route params before resolving profile.id.
  - `viewer:${viewerId}:profile:${ownerId}` for viewer-overlay reads (`isFollowing`, `resolveCommonGround`). Kept distinct from the existing `viewer:${id}` tag (used by notifications) so updates to one don't fan out to the other.

- **D-39c-03 — One cached resolver per shell, 300s revalidate.** Single `<ProfileShellResolver username/>` Server Component marked `'use cache'`. Issues `cacheTag('profile:${username}')` and `cacheLife({ revalidate: 300 })`. Resolves profile + settings + counts + watches + wearEvents + tasteTags in one Promise.all. Mirrors the `PopularCollectors.tsx` pattern (`src/components/explore/PopularCollectors.tsx:22-25`).
  - Pitfall 1 (viewerId in cache key): the resolver MUST NOT call `getCurrentUser()` internally. `viewerId` lives only in the `<ProfileGate/>` subtree.
  - Cache key is `username` only — that's correct for owner-scoped data and matches the pattern of one cache entry shared across all viewers for the same profile.

- **D-39c-04 — Invalidation wiring across Server Actions:**
  - `src/app/actions/profile.ts` (avatar / displayName / bio / settings updates): fire `updateTag('profile:${username}')` for read-your-own-writes semantics (per notifications.ts pattern at `src/app/actions/notifications.ts:76`).
  - `src/app/actions/watches.ts` addWatch / updateWatch / removeWatch: add `revalidateTag('profile:${ownerUsername}', 'max')` alongside the existing `revalidateTag('explore', 'max')` (the watches array contributes to the shell's taste tags).
  - `src/app/actions/follows.ts` follow / unfollow: fire `revalidateTag('profile:${targetUsername}', 'max')` (followerCount on the target changed) AND `updateTag('viewer:${viewerId}:profile:${targetUserId}')` (the viewer-overlay `isFollowing` state changed, read-your-own-writes).
  - Wear-event writes (currently unclear which action file; planner identifies): fire `revalidateTag('profile:${ownerUsername}', 'max')`.

### Viewer-dependent Suspense seams (D-39c-05)

- **D-39c-05 — Single gate Suspense.** Layout body becomes:
  ```tsx
  <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
    <Suspense fallback={<ProfileShellSkeleton/>}>
      <ProfileGate username>{children}</ProfileGate>
    </Suspense>
  </main>
  ```
  The `<ProfileGate/>` Server Component:
  1. Resolves `viewerId` via `getCurrentUser()` (swallowing `UnauthorizedError` → `null`, matching current behavior at `layout.tsx:26-30`).
  2. Renders `<ProfileShellResolver username/>` to obtain cached profile + settings + chrome data.
  3. Calls `notFound()` if profile is missing (preserves SC#6 / current `layout.tsx:35` behavior).
  4. If `!isOwner && !settings.profilePublic`: fetches `initialIsFollowing` for non-owner viewers, returns `<LockedProfileState .../>`.
  5. Otherwise (public path or owner): fetches `initialIsFollowing` and `resolveCommonGround` for the public branch, renders the existing `<ProfileHeader/>` + `<CommonGroundHeroBand/>` + `<ProfileTabs/>` + `{children}` subtree.

  One streaming hop. Static shell prerenders identically for prefetch from authed, unauthed, and stale-cookie sessions.

  Notes for planner:
  - `notFound()` inside Suspense bubbles correctly to the closest `not-found.tsx` in Next 16. No new not-found file required if missing-profile currently falls through to the root not-found.
  - `<ProfileShellResolver/>` is called inside the gate (NOT at the layout body) because the gate's locked-branch needs to render `<LockedProfileState/>` instead — only the chrome reads (`profile`, `settings`) need to resolve before that decision.
  - Refactoring opportunity (planner discretion): the gate could call a tighter `<ProfileGateResolver username/>` (`'use cache'`, returns only `{ profile, settings }`) for the locked-vs-public decision, then a separate full `<ProfileShellResolver/>` for the public branch. Avoids fetching counts/watches/wearEvents on the locked path. Trade-off: two cache entries per profile vs. one over-fetched entry.

### ProfileShellSkeleton + unstable_instant (D-39c-06 → D-39c-07)

- **D-39c-06 — Chrome-only skeleton.** `<ProfileShellSkeleton/>` renders: 96px avatar circle, name placeholder (h-6 w-48), tab pill row (5 fixed-width pills, h-9 each), content card placeholder (rounded-xl border, h-64). Reuses `src/components/ui/skeleton.tsx` (shadcn `<Skeleton/>`) for individual elements. NO taste-tag chip placeholder and NO common-ground band placeholder — accept the small layout shift when taste tags resolve and push tabs down, because the locked branch never renders those elements and rendering placeholders would create visible jank when the gate collapses to LockedProfileState.

- **D-39c-07 — Adopt `unstable_instant`.** Add `export const unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx`. Per `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`, this is the Next 16 native build-time gate confirming the static shell is instant. The debug doc evidence at `2026-05-14T00:26:00Z` flagged this as the acceptance test for this refactor. Add it as part of the same plan that produces the static shell — turns "static shell is instant" into a compile-time invariant.

### Diagnostic revert (D-39c-08)

- **D-39c-08 — Revert commit `2f42d00` in this phase.** The commit added `prefetch={false}` at three sites and added a `prefetch?: boolean` prop to `BottomNav`'s `NavLink`. All four edits must be reverted:
  - `src/components/layout/UserMenu.tsx:111` — remove `prefetch={false}`
  - `src/components/profile/ProfileTabs.tsx:73` — remove `prefetch={false}`
  - `src/components/layout/BottomNav.tsx:158` — remove `prefetch={false}` from the Profile NavLink invocation
  - `src/components/layout/BottomNav.tsx` (NavLink definition) — remove the `prefetch?: boolean` prop addition
  Order matters: the revert lands LAST in the phase, AFTER the layout refactor + skeleton + loading.tsx + invalidation wiring are all in place. Otherwise the bug re-emerges between commits.

### Verification (D-39c-09)

- **D-39c-09 — Prod-only verification gate.** The bug is prod-only (`link.md:298` — prefetching enabled only in production). Phase verification MUST include a manual prod-check checkpoint:
  1. Deploy to a preview URL or production after the layout refactor lands.
  2. Sign in as twwaneka@gmail.com.
  3. Click "Profile" in top nav → expect `/u/twwaneka/collection` to load without 404.
  4. Click each tab (wishlist / worn / notes / stats / insights) → expect each to load.
  5. Click Profile from BottomNav on mobile → expect to load.
  6. DevTools Network: confirm prefetch RSC fetches show partial shell (skeleton chrome RSC) on viewport entry, full content RSC on click.
  7. Build also fails fast if `unstable_instant = { prefetch: 'static' }` detects a non-instant shell — that's an additional automated gate.

  Local verification (dev server) cannot prove the fix because prefetch is disabled in dev.

### Claude's Discretion

- Whether to split `<ProfileShellResolver/>` into two cache scopes (one for the locked-vs-public gate, one for the full chrome). D-39c-05 notes the trade-off; planner picks.
- Exact tag-key shape for `profile:${username}` vs. `profile:${profile.id}` — both are valid. Use `profile:${username}` at read time (it's what the cached scope receives) and use whichever is in hand at write-time (Server Actions usually have one or the other after looking up the row).
- Exact location of `<ProfileGate/>` and `<ProfileShellResolver/>` source files — `src/app/u/[username]/_components/` is fine, or co-locate as `src/app/u/[username]/profile-gate.tsx` like the existing `common-ground-gate.ts`.
- Whether to keep `'use client'` on `<ProfileHeader/>` (it has `useState` for edit mode) or refactor — current pattern is fine, no need to change.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug investigation (PRIMARY INPUT)

- `.planning/debug/profile-page-404-top-nav.md` — Full root-cause investigation, prod verification of Router-Cache poisoning hypothesis, three architectural paths (A1/A2/A3) with trade-offs, evidence trail. Path A3 (Hybrid) is chosen by this CONTEXT.md.

### Next 16 framework docs (REQUIRED READING — these override LLM training data)

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` §lines 88, 90-95 — `loading.js` boundary semantics. Layout same-segment uncached data access is NOT wrapped by `loading.js`. The architectural blocker the debug doc identified.
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` — `unstable_instant` route segment export. Build-time + dev-time validation that a route produces an instant static shell. Adopted in D-39c-07.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` §lines 34-46 — `cacheComponents: true` semantics (Horlo has this on at `next.config.ts:13`). Explains why route segments behave dynamically by default unless explicit `'use cache'`.
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — `'use cache'` directive semantics and gotchas.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — tag namespacing for invalidation.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` — revalidate window configuration.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — broad fan-out invalidation (used in watches.ts).
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — read-your-own-writes invalidation (used in notifications.ts).
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` §line 88 — partial-prefetching behavior for dynamic routes with `loading.tsx`.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` §line 298 — "Prefetching is only enabled in production." Explains the dev/prod reproduction gap.

### Existing Horlo code references (patterns to follow)

- `src/app/u/[username]/layout.tsx` — current layout (the refactor target).
- `src/app/u/[username]/common-ground-gate.ts` — existing extracted gate pattern; mirror this shape when extracting `<ProfileGate/>` and `<ProfileShellResolver/>`.
- `src/components/explore/PopularCollectors.tsx` — canonical `'use cache'` + `cacheTag(...)` + `cacheLife(...)` Server Component pattern. Pitfall 1 (viewerId-as-prop) is documented inline. Match this shape for `<ProfileShellResolver/>`.
- `src/components/notifications/NotificationBell.tsx` — same pattern with viewer-scoped tag.
- `src/app/actions/notifications.ts` §lines 14-50, 76 — `updateTag('viewer:${user.id}')` read-your-own-writes pattern. Match this shape for D-39c-04 viewer-overlay invalidation.
- `src/app/actions/watches.ts` §lines 265, 285, 431, 461 — `revalidateTag('explore', 'max')` + `revalidateTag('viewer:${id}', 'max')` fan-out pattern. Add `profile:${ownerUsername}` to these call sites per D-39c-04.
- `src/components/ui/skeleton.tsx` — shadcn `<Skeleton/>` primitive for the skeleton placeholders.
- Existing skeletons in repo (for inspiration only — none are profile-shell shaped): `HeaderSkeleton.tsx`, `SearchResultsSkeleton.tsx`, `VerdictSkeleton.tsx`, `PhotoSkeleton.tsx`.

### Mitigation commit (to be reverted in this phase)

- Commit `2f42d00` "test(diagnostic): disable prefetch on profile-bound Links (PENDING REVERT)" — the mitigation. Reverted per D-39c-08.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/components/ui/skeleton.tsx`** — shadcn `<Skeleton className="animate-pulse rounded-md bg-muted" />`. Use as the building block for `<ProfileShellSkeleton/>`.
- **`src/app/u/[username]/common-ground-gate.ts`** — already pure, extracted gate logic. The `resolveCommonGround` function gets called inside `<ProfileGate/>`'s public branch unchanged.
- **`src/components/profile/ProfileHeader.tsx`** — client component, `useState` for edit mode, takes all data as props. Render unchanged from the public branch of `<ProfileGate/>`. NO refactor needed.
- **`src/components/profile/LockedProfileState.tsx`** — takes the same viewer + counts shape currently passed. Render unchanged from the locked branch of `<ProfileGate/>`. NO refactor needed.
- **`src/components/profile/ProfileTabs.tsx`** — currently has the `prefetch={false}` mitigation at line 73 (to be reverted per D-39c-08).
- **`src/components/profile/CommonGroundHeroBand.tsx`** — renders `overlap` + `ownerUsername`. Unchanged.
- **`src/lib/tasteTags.ts`** `computeTasteTags(...)` — pure function; runs inside `<ProfileShellResolver/>` cached scope.

### Established Patterns

- **`'use cache'` + `cacheTag` + `cacheLife` at the Server Component boundary, NOT at the DAL boundary.** See `recommendations.ts:50` comment ("Plan 07 will wrap this DAL in a `'use cache'` Server Component"). `<ProfileShellResolver/>` follows this. DAL functions in `src/data/profiles.ts`, `src/data/follows.ts`, `src/data/watches.ts`, `src/data/wearEvents.ts` stay as plain async functions.
- **Pitfall 1 (viewerId in cache key):** never call `getCurrentUser()` inside a `'use cache'` scope. Pass viewerId as an explicit prop or resolve it OUTSIDE the cached scope. Documented at `src/components/explore/PopularCollectors.tsx:9-13`.
- **Tag fan-out conventions:** `revalidateTag('explore', 'max')` for broad cross-cutting in watches.ts; `updateTag('viewer:${user.id}')` for per-viewer read-your-own-writes in notifications.ts. D-39c-04 extends both with `profile:${username}` and `viewer:${viewerId}:profile:${ownerId}`.
- **Server Component → Client Component boundary at edit-mode buttons only.** `ProfileHeader` is `'use client'` to support `useState(editing)` — no need to convert.
- **`notFound()` from Server Components bubbles to the closest `not-found.tsx`.** Works from inside Suspense in Next 16.

### Integration Points

- **`src/app/u/[username]/layout.tsx`** — the refactor target. Becomes a thin shell rendering `<main>` + `<Suspense fallback={<ProfileShellSkeleton/>}><ProfileGate username>{children}</ProfileGate></Suspense>`.
- **`src/app/u/[username]/[tab]/page.tsx`** — adds `export const unstable_instant = { prefetch: 'static' }`. Page body unchanged otherwise.
- **`src/app/u/[username]/loading.tsx`** — new file, renders `<ProfileShellSkeleton/>`.
- **`src/app/actions/profile.ts`** — Server Actions that update profile rows add `updateTag('profile:${username}')` calls.
- **`src/app/actions/watches.ts`** — addWatch / updateWatch / removeWatch add `revalidateTag('profile:${ownerUsername}', 'max')` calls (planner determines whether to pass the username or look it up from `ownerUserId`).
- **`src/app/actions/follows.ts`** — follow / unfollow add `revalidateTag('profile:${targetUsername}', 'max')` and `updateTag('viewer:${viewerId}:profile:${targetUserId}')`.
- **Wear-event Server Action** (file location TBD; planner identifies) — adds `revalidateTag('profile:${ownerUsername}', 'max')`.
- **`src/components/layout/UserMenu.tsx`, `src/components/profile/ProfileTabs.tsx`, `src/components/layout/BottomNav.tsx`** — three sites where `prefetch={false}` is reverted (D-39c-08). BottomNav also drops the `prefetch?: boolean` prop on NavLink.

</code_context>

<specifics>
## Specific Ideas

- **Mirror PopularCollectors.tsx shape** for `<ProfileShellResolver/>`. The 22-line component shape (use-cache directive on line 1 of function body, cacheTag with explore + scope + viewer-suffix on line 2, cacheLife on line 3, then the Promise.all) is the canonical example.
- **Mirror common-ground-gate.ts shape** for the new `<ProfileGate/>` extraction — pure, isolated, testable. Phase 39's verifier praised this pattern; planner should produce a similar single-export module.
- **Reuse the empty-state pattern** from D-39b-07 (hide-rail-if-empty) for any sub-rail style elements that don't apply on the locked branch. The locked branch just renders `<LockedProfileState/>` and that's it — no sub-elements need empty-state handling.
- **Prod-only repro gate.** Verification cannot be done in `npm run dev` (per `link.md:298`). The phase MUST checkpoint on a prod / preview deployment before claiming done.

</specifics>

<deferred>
## Deferred Ideas

- **`src/app/login/login-form.tsx` push/refresh ordering hardening** — the debug doc identifies this as a possible upstream cause (prefetch issued before cookie propagation). Deferred per debug doc Resolution → "Root-cause hardening: deferred". Add to backlog as a follow-up; not in 39c scope.
- **Audit other layouts for similar `cacheComponents: true` violations** — there may be other layouts in `src/app/` performing uncached top-level fetches that would block prefetch under the same mechanism. Not enumerated in this phase; if planner spots an obvious second instance during the refactor, capture it as a backlog item.
- **Splitting `<ProfileShellResolver/>` into two cache scopes** (gate-only vs. full chrome) — flagged in D-39c-05 / Claude's Discretion. Planner decides during planning; if deferred, capture as a v5.x perf polish backlog item.
- **`/u/[username]/followers` and `/u/[username]/following`** — sibling routes with their own data fetches. They use the same layout (so they benefit from this refactor's static shell automatically) but their own page bodies are out of scope for the `unstable_instant` addition.

</deferred>

---

*Phase: 39c-profile-layout-next-16-conformance*
*Context gathered: 2026-05-13*

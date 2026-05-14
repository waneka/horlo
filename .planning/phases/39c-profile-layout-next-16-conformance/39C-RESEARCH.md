# Phase 39c: Profile Layout Next 16 Conformance - Research

**Researched:** 2026-05-13
**Domain:** Next.js 16 Cache Components partial-prefetch semantics (`cacheComponents: true`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-39c-01** — Path A3 (Hybrid). Cache idempotent owner-scoped reads behind a `'use cache'` Server Component; push viewer-dependent reads into a Suspense-wrapped gate. Smallest refactor producing a true static shell per the Next 16 `cacheComponents: true` model.
- **D-39c-02** — Two new tag families:
  - `profile:${username}` for owner-scoped reads (profile, settings, counts, watches, wearEvents, taste tags). Username is the natural cache key (resolver receives username from route params before resolving `profile.id`).
  - `viewer:${viewerId}:profile:${ownerId}` for viewer-overlay reads (`isFollowing`, `resolveCommonGround`). Distinct from the existing `viewer:${id}` tag (notifications) so updates don't fan out across unrelated UI.
- **D-39c-03** — Single `<ProfileShellResolver username/>` Server Component. `'use cache'`, `cacheTag('profile:${username}')`, `cacheLife({ revalidate: 300 })`. Resolves profile + settings + counts + watches + wearEvents + tasteTags in one Promise.all. Mirrors `src/components/explore/PopularCollectors.tsx:22-25`. Pitfall 1: **MUST NOT** call `getCurrentUser()` internally — viewerId lives only in the `<ProfileGate/>` subtree. Cache key is `username` only.
- **D-39c-04** — Invalidation wiring across Server Actions:
  - `src/app/actions/profile.ts` (avatar/displayName/bio/settings updates): fire `updateTag('profile:${username}')` for read-your-own-writes (per `src/app/actions/notifications.ts:76` pattern).
  - `src/app/actions/watches.ts` (addWatch/editWatch/removeWatch): add `revalidateTag('profile:${ownerUsername}', 'max')` alongside existing `revalidateTag('explore', 'max')`.
  - `src/app/actions/follows.ts` (followUser/unfollowUser): add `revalidateTag('profile:${targetUsername}', 'max')` (followerCount changed) AND `updateTag('viewer:${viewerId}:profile:${targetUserId}')` (viewer-overlay `isFollowing` changed, read-your-own-writes).
  - Wear-event writes: planner identifies file; fire `revalidateTag('profile:${ownerUsername}', 'max')`.
- **D-39c-05** — Single gate Suspense. `<ProfileGate username>{children}</ProfileGate>` wrapped in `<Suspense fallback={<ProfileShellSkeleton/>}>`. Gate resolves viewerId, renders `<ProfileShellResolver/>`, calls `notFound()` if profile missing, branches locked vs public. One streaming hop. `notFound()` inside Suspense bubbles correctly in Next 16. `<ProfileShellResolver/>` is called inside the gate (not at the layout body) because the locked branch renders `<LockedProfileState/>` instead. Refactoring opportunity: planner may split into tighter `<ProfileGateResolver/>` (only `{ profile, settings }`) plus separate full `<ProfileShellResolver/>` for the public branch — trade-off two cache entries per profile vs. one over-fetched entry.
- **D-39c-06** — Chrome-only skeleton. `<ProfileShellSkeleton/>`: 96px avatar circle, name placeholder (h-6 w-48), tab pill row (5 fixed-width pills, h-9 each), content card placeholder (rounded-xl border, h-64). Reuses `src/components/ui/skeleton.tsx`. NO taste-tag chip placeholder, NO common-ground band placeholder — locked branch never renders those, placeholders would create visible jank.
- **D-39c-07** — Adopt `unstable_instant`. Add `export const unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx`. Native Next 16 build-time gate confirming the static shell is instant.
- **D-39c-08** — Revert commit `2f42d00` LAST in the phase (after layout refactor + skeleton + loading.tsx + invalidation wiring all in place). Four edits:
  - `src/components/layout/UserMenu.tsx:112` — remove `prefetch={false}` (CONTEXT.md said line 111; actual position is line 112, the Link itself starts at 110).
  - `src/components/profile/ProfileTabs.tsx:73` — remove `prefetch={false}` from the TabsTrigger render prop's Link.
  - `src/components/layout/BottomNav.tsx:157` — remove `prefetch={false}` from the Profile NavLink invocation (CONTEXT.md said line 158; actual is line 157).
  - `src/components/layout/BottomNav.tsx` — remove the `prefetch?: boolean` field from the `NavLinkProps` interface (line 73), the `prefetch` destructure in the NavLink function signature (line 76), and the `prefetch={prefetch}` pass-through on the Link (line 80).
- **D-39c-09** — Prod-only verification gate. Bug is prod-only (link.md:298 — prefetching enabled only in production). Manual prod-check checkpoint per the 7-step protocol in CONTEXT.md.

### Claude's Discretion

- Whether to split `<ProfileShellResolver/>` into two cache scopes (gate-only vs. full chrome).
- Exact tag-key shape — `profile:${username}` vs. `profile:${profile.id}`. CONTEXT.md prefers username; planner may use ID where the Server Action only has ID in hand.
- Exact location of `<ProfileGate/>` and `<ProfileShellResolver/>` source files — `src/app/u/[username]/_components/` or co-located as `src/app/u/[username]/profile-gate.tsx` like the existing `common-ground-gate.ts`.
- Whether to keep `'use client'` on `<ProfileHeader/>` — current pattern is fine, no need to change.

### Deferred Ideas (OUT OF SCOPE)

- `src/app/login/login-form.tsx` push/refresh ordering hardening — debug doc "Root-cause hardening: deferred."
- Audit of other layouts in the codebase for similar `cacheComponents` violations — separate phase if identified.
- Splitting `<ProfileShellResolver/>` into two cache scopes — flagged in D-39c-05 / Claude's Discretion; planner decides during planning.
- `/u/[username]/followers` and `/u/[username]/following` page bodies — they share the new layout's static shell automatically, but their own page bodies are out of scope for the `unstable_instant` addition.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NEXT16-CONFORMANCE | Refactor `src/app/u/[username]/layout.tsx` to comply with Next 16 `cacheComponents: true` partial-prefetch semantics so prefetching can be safely restored on profile-bound Links without re-introducing Router-Cache poisoning verified in prod 2026-05-13. | Next 16 doc verification (loading.md:88,90-95; use-cache.md:194-211; cacheTag.md; cacheLife.md; revalidateTag.md:18-23; updateTag.md:5-16; instant.md:15-25; link.md:298). Pattern mirror `PopularCollectors.tsx:22-25` and `notifications.ts:14-50`. |

</phase_requirements>

## Summary

This research verified every Next 16 API signature and behavior CONTEXT.md depends on by reading `node_modules/next/dist/docs/` directly. **All locked decisions in CONTEXT.md align with verified Next 16 semantics.** Three minor drift items found between CONTEXT.md and the actual code, all in the form of off-by-one line numbers — corrected in the User Constraints section above. One material gap: the **wear-event Server Action location** (CONTEXT.md flagged as TBD) is `src/app/actions/wearEvents.ts`, and the file contains exactly two write paths (`markAsWorn` line 16, `logWearWithPhoto` line 109) — no separate delete/edit action exists. One material implementation question: the existing **`follows.ts`** action receives the target user as `parsed.data.userId` (UUID), not username — adding `revalidateTag('profile:${targetUsername}', 'max')` requires either a `getProfileById(targetUserId)` lookup inside the action OR using `profile:${targetUserId}` as the tag shape and tagging by ID in `<ProfileShellResolver/>` too.

**Primary recommendation:** Mirror the **PopularCollectors.tsx** shape for `<ProfileShellResolver/>` verbatim — same 3-line cache preamble (`'use cache'`, `cacheTag(...)`, `cacheLife(...)`), then Promise.all. Mirror the **common-ground-gate.ts** shape (pure module + single async export) for `<ProfileGate/>`. Tag taxonomy: use `profile:${username}` everywhere for the owner-scoped reads (resolver receives username from route params; Server Actions look up the username from the resolved profile row when needed) and `viewer:${viewerId}:profile:${ownerId}` for the viewer-overlay reads. Use `updateTag` (no second arg) in Server Actions where the caller IS the viewer/owner whose own cache is being invalidated (read-your-own-writes); use `revalidateTag(tag, 'max')` for cross-user fan-out where SWR semantics are correct.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile lookup by username (idempotent, owner-scoped) | API/Backend (cached Server Component) | — | Pure DB read keyed on username; safe to cache for 300s with `profile:${username}` tag. Pitfall 1 says NEVER include viewerId in this cache key. |
| Viewer identity resolution (cookies → user) | API/Backend (Server Component inside Suspense) | — | Reads cookies via `getCurrentUser()`; MUST live outside any `'use cache'` scope (use-cache.md:194-196). The new `<ProfileGate/>` is this component. |
| Locked-vs-public branching | API/Backend (Server Component, inside the gate) | — | Depends on viewer identity AND owner-scoped settings. Decision happens inside the gate after the cached resolver returns. |
| Static chrome rendering (`<main>` shell) | Frontend Server (SSR) | — | Layout body itself. Currently has uncached fetches at top level — refactor target. After refactor, the only synchronous content at the layout body is the `<Suspense>` wrapper. |
| Loading fallback (skeleton) | Frontend Server (loading.tsx) + React | — | `src/app/u/[username]/loading.tsx` renders `<ProfileShellSkeleton/>`. Wraps `page.js` and nested layouts, NOT the same-segment layout (loading.md:88) — but the layout's Suspense fallback covers the layout side. |
| Cache invalidation on profile/watch/follow/wear writes | API/Backend (Server Actions) | — | `updateTag` for read-your-own-writes (caller IS the viewer being invalidated). `revalidateTag(tag, 'max')` for cross-user fan-out. Mirror `notifications.ts:76` and `watches.ts:265,285,431,461`. |
| Build-time validation of instant shell | Frontend Server (route segment config) | — | `export const unstable_instant = { prefetch: 'static' }` on `[tab]/page.tsx` triggers dev + build-time validation at every shared-layout entry point (instant.md:65-69). |
| Prefetch behavior (browser cache poisoning) | Browser/Client (Link component) | API/Backend (RSC fetches) | The bug is browser-side Router Cache poisoning from a stale RSC fetch. The fix is server-side (static shell) but the verification is client-side (DevTools Network + clicking links). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | Cache Components, `'use cache'`, `cacheTag`, `cacheLife`, `revalidateTag`, `updateTag`, `unstable_instant` | Already the project's framework; no upgrade needed. All required APIs are present in 16.2.3 per the local `node_modules/next/dist/docs/` reference. |
| React | 19.2.4 | Suspense boundary, Server Components, `<Activity>` (under cacheComponents) | Already in stack; Suspense semantics are the load-bearing primitive for the refactor. |
| `next/cache` | (Next 16) | `cacheTag`, `cacheLife`, `revalidateTag`, `updateTag` — all exported from this module | The single source for cache primitives. `notifications.ts:3` and `watches.ts:3` and `follows.ts:3` already import from here. |
| `next/navigation` | (Next 16) | `notFound()` (already used at `layout.tsx:35`) | Bubbles from Server Components inside Suspense to the closest `not-found.tsx`. No `not-found.tsx` exists in `src/app/` — Next's built-in fallback handles it. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/ui/skeleton` (shadcn) | local | `<Skeleton/>` primitive — `animate-pulse rounded-md bg-muted` | Building block for `<ProfileShellSkeleton/>` chrome placeholders. |
| (existing) `@/data/profiles`, `@/data/follows`, `@/data/watches`, `@/data/wearEvents` | local | DAL — plain async functions | Stay as plain async per the project's established pattern. The `'use cache'` directive lives at the Server Component boundary, NOT at the DAL boundary (`PopularCollectors.tsx:22`, `NotificationBell.tsx:19`). |

### Alternatives Considered (locked-out by CONTEXT.md)
| Instead of | Could Use | Why Locked Out |
|------------|-----------|----------------|
| Path A3 (Hybrid) | Path A1 (Suspense-wrap everything in layout) | D-39c-01 locked A3. A1 would still call `getCurrentUser()` at the layout top — less clean separation. |
| Path A3 (Hybrid) | Path A2 (Move all data into page.tsx) | D-39c-01 locked A3. A2 is larger surface — every tab page would need to re-render ProfileHeader/ProfileTabs. |
| `'use cache'` on DAL functions | `'use cache'` at the Server Component boundary | Established Horlo pattern (`PopularCollectors.tsx:1-3` comment about `recommendations.ts:50` deferring caching to the SC). |
| `revalidateTag('profile:X')` (single-arg) | `revalidateTag('profile:X', 'max')` | The single-arg form is **deprecated** per `revalidateTag.md:55` — only suppressed by TypeScript ignore. Two-arg form with `'max'` profile is the recommended SWR shape. |
| `revalidateTag` inside a Server Action for read-your-own-writes | `updateTag` | `updateTag` blocks until fresh data is fetched (updateTag.md:16). `revalidateTag(..., 'max')` is SWR — explicit Next 16 source comment at `notifications.ts:26-46` documents that the action response does NOT bundle a fresh RSC payload, so the bell would stick until the next nav. The same logic applies to viewer-overlay reads in profile context. |

**Installation:** No new dependencies. All APIs are in `next@16.2.3` already.

**Version verification (Bash):**
```bash
grep '"next":' package.json   # → "next": "16.2.3"
```
Confirmed via `next.config.ts:13` `cacheComponents: true` is the flag that activates all of this.

## Architecture Patterns

### System Architecture Diagram

```
Browser <Link> (UserMenu / ProfileTabs / BottomNav)
   │
   │  prefetch on viewport (production only — link.md:298)
   ▼
Next.js Router Cache (browser memory)
   │
   │  miss → RSC fetch
   ▼
src/app/u/[username]/layout.tsx (refactored)
   │
   │  <main> chrome (static)
   │  └─ <Suspense fallback={<ProfileShellSkeleton/>}>
   │       <ProfileGate username>{children}</ProfileGate>
   │     </Suspense>
   │
   ▼
src/app/u/[username]/loading.tsx (NEW)
   └─ wraps page.tsx + nested layout.tsx in <Suspense> per loading.md:88
       (NOT the same-segment layout — Suspense ABOVE covers that)

ProfileGate (NEW — viewer-dependent, NOT cached)
   │
   ├─ getCurrentUser() → viewerId | null  (cookies access; lives OUTSIDE cache scope)
   ├─ <ProfileShellResolver username/>     (CACHED — owner-scoped reads)
   │     │
   │     │  'use cache'
   │     │  cacheTag('profile:${username}')
   │     │  cacheLife({ revalidate: 300 })
   │     │
   │     └─ Promise.all([
   │          getProfileByUsername(username),
   │          getProfileSettings(profile.id),
   │          getFollowerCounts(profile.id),
   │          getWatchesByUser(profile.id),
   │          getAllWearEventsByUser(profile.id),
   │          computeTasteTags({...}),
   │        ])
   │
   ├─ if (!profile) notFound()
   ├─ isOwner = viewerId === profile.id
   │
   ├─ if (!isOwner && !settings.profilePublic)
   │     │  // VIEWER-OVERLAY READ — keyed per-viewer
   │     │  // optional: tag with viewer:${viewerId}:profile:${ownerId}
   │     ├─ initialIsFollowing = isFollowing(viewerId, profile.id)
   │     └─ return <LockedProfileState .../>
   │
   └─ (public path or owner path)
        ├─ initialIsFollowing (same as above)
        ├─ overlap = resolveCommonGround({...})  (same gate as common-ground-gate.ts)
        ├─ <ProfileHeader/>
        ├─ <CommonGroundHeroBand/>  (if overlap)
        ├─ <ProfileTabs/>
        └─ {children}                ← page.tsx renders here

[tab]/page.tsx
   │
   ├─ export const unstable_instant = { prefetch: 'static' }   (NEW — build-time gate)
   │
   └─ tab-specific content rendering (unchanged)

Server Actions — invalidation wiring (NEW per D-39c-04)
   ├─ profile.ts.updateProfile             → updateTag(`profile:${username}`)
   ├─ profile.ts.updateProfileSettings     → updateTag(`profile:${username}`)
   ├─ watches.ts.addWatch                  → revalidateTag(`profile:${ownerUsername}`, 'max')
   ├─ watches.ts.editWatch                 → revalidateTag(`profile:${ownerUsername}`, 'max')
   ├─ watches.ts.removeWatch               → revalidateTag(`profile:${ownerUsername}`, 'max')
   ├─ follows.ts.followUser                → revalidateTag(`profile:${targetUsername}`, 'max')
   │                                        + updateTag(`viewer:${viewerId}:profile:${targetUserId}`)
   ├─ follows.ts.unfollowUser              → same as followUser
   ├─ wearEvents.ts.markAsWorn             → revalidateTag(`profile:${ownerUsername}`, 'max')
   └─ wearEvents.ts.logWearWithPhoto       → revalidateTag(`profile:${ownerUsername}`, 'max')
```

### Recommended Component Locations

| File | Role | Why |
|------|------|-----|
| `src/app/u/[username]/layout.tsx` | Refactor target — thin shell, no top-level data fetching | Single `<main>` + `<Suspense>` wrapping the gate. |
| `src/app/u/[username]/profile-gate.tsx` | New — viewer-dependent gate logic, server-only | Co-locate next to `common-ground-gate.ts` (D-39c notes; pattern mirror). |
| `src/app/u/[username]/profile-shell-resolver.tsx` | New — `'use cache'` Server Component, owner-scoped reads | Pattern mirror `src/components/explore/PopularCollectors.tsx`. |
| `src/app/u/[username]/profile-shell-skeleton.tsx` | New — chrome-only skeleton | Reuses `<Skeleton/>` primitive. |
| `src/app/u/[username]/loading.tsx` | New — renders `<ProfileShellSkeleton/>` | Wraps the page + nested layouts in `<Suspense>` per loading.md:88. |
| `src/app/u/[username]/[tab]/page.tsx` | Add `export const unstable_instant = { prefetch: 'static' }` at file top | Build-time + dev-time gate (instant.md:15-19). |

### Pattern 1: `'use cache'` Server Component with `cacheTag` + `cacheLife`

**What:** A Server Component that wraps owner-scoped reads behind the cache layer. Receives identifiers as explicit props (NEVER calls `getCurrentUser()` internally). Tags with stable identifiers so Server Actions can invalidate. Sets an explicit `cacheLife` so behavior is inspectable without tracing nested caches.

**When to use:** Anywhere a piece of UI depends only on inputs that can be passed as serializable props, AND the data is shared across many viewers (so cache reuse pays off).

**Example (canonical — mirror this verbatim for `<ProfileShellResolver/>`):**
```tsx
// Source: src/components/explore/PopularCollectors.tsx (verified in repo)
import { cacheLife, cacheTag } from 'next/cache'

export async function PopularCollectors({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`)
  cacheLife({ revalidate: 300 })

  const collectors = await getMostFollowedCollectors(viewerId, { limit: 5 })
  if (collectors.length === 0) return null

  return ( /* JSX */ )
}
```

**For `<ProfileShellResolver/>`:**
```tsx
// Source pattern: PopularCollectors.tsx:22-25
// Source API: use-cache.md, cacheTag.md, cacheLife.md (all verified)
import { cacheLife, cacheTag } from 'next/cache'

export async function ProfileShellResolver({ username }: { username: string }) {
  'use cache'
  cacheTag(`profile:${username}`)
  cacheLife({ revalidate: 300 })

  const profile = await getProfileByUsername(username)
  if (!profile) return { profile: null } as const

  const [settings, counts, watches, wearEvents] = await Promise.all([
    getProfileSettings(profile.id),
    getFollowerCounts(profile.id),
    getWatchesByUser(profile.id),
    getAllWearEventsByUser(profile.id),
  ])
  const tasteTags = computeTasteTags({ /* ... */ })
  return { profile, settings, counts, watches, wearEvents, tasteTags } as const
}
```

**Notes verified against `use-cache.md`:**
- Arguments must be serializable (use-cache.md:113-119). `username: string` passes.
- Return values can include plain objects and arrays (use-cache.md:118-123). The return shape above passes — `profile`, `settings`, `counts` are plain rows; `watches`/`wearEvents` are arrays of plain rows.
- Do NOT call `cookies()` / `headers()` / `getCurrentUser()` inside — use-cache.md:194-196 makes this explicit; will fail with E7 at runtime.
- `cacheLife({ revalidate: 300 })` is a valid inline profile (cacheLife.md:218-238). `stale` and `expire` inherit from `default` (5min stale, never expire). Note: `revalidate: 300` is exactly 5 minutes — sits right at the prerender exclusion boundary (cacheLife.md:254-258: "zero `revalidate` or `expire` under 5 minutes — are automatically excluded from prerenders"). 300s ≥ 5min so it qualifies for prerender. **HIGH confidence this stays static.**

### Pattern 2: Suspense gate that calls `notFound()` and resolves cookies OUTSIDE the cache scope

**Source:** loading.md:90-95, use-cache.md:194-196, instant-navigation.md:48-66.

```tsx
// app/u/[username]/profile-gate.tsx
import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileShellResolver } from './profile-shell-resolver'

export async function ProfileGate({
  username,
  children,
}: {
  username: string
  children: React.ReactNode
}) {
  // Cookies access happens HERE — outside any 'use cache' scope.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  // Cached, owner-scoped read.
  const { profile, settings, counts, watches, wearEvents, tasteTags } =
    await ProfileShellResolver({ username })

  if (!profile) notFound()

  const isOwner = viewerId === profile.id
  const initialIsFollowing =
    viewerId && !isOwner ? await isFollowing(viewerId, profile.id) : false

  if (!isOwner && !settings.profilePublic) {
    return <LockedProfileState {/* ... */} />
  }

  const overlap = await resolveCommonGround({ /* ... */ })
  return (
    <>
      <ProfileHeader {/* ... */} />
      {overlap && <CommonGroundHeroBand {/* ... */} />}
      <ProfileTabs {/* ... */} />
      <div className="mt-6">{children}</div>
    </>
  )
}
```

**Verified:**
- `notFound()` from a Server Component inside `<Suspense>` bubbles to the nearest `not-found.tsx` — `loading.md:120` confirms response body streaming starts when a Suspense fallback renders, but `notFound()` placed before any `await` that may suspend gets a proper 404 status code; after streaming has begun, the streamed response includes a `<meta name="robots" content="noindex">` (loading.md:106-115). For our case (no client-facing 404 status requirement for an authenticated user hitting their own profile after a Suspense has streamed), this is fine.
- `await ProfileShellResolver({ username })` invokes the cached component as a function (instant-navigation.md:48-56 shows this pattern with `ProductInfo`). The cached result is returned and consumed by the gate.

### Pattern 3: `revalidateTag(tag, 'max')` for cross-user fan-out (SWR)

**Source:** revalidateTag.md:18-23,55. Verified at `src/app/actions/watches.ts:265,285,431,461`.

```tsx
// Source: revalidateTag.md
revalidateTag('profile:twwaneka', 'max')   // SWR — recommended
revalidateTag('profile:twwaneka')           // DEPRECATED single-arg form (revalidateTag.md:55)
revalidateTag('profile:twwaneka', { expire: 0 })   // immediate expiration (revalidateTag.md:136 — for webhooks only)
```

**When to use:** Server Action where the caller is NOT the same viewer whose cached UI is being invalidated. Example: `watches.ts.addWatch` invalidates `profile:${ownerUsername}` for any viewer hitting the owner's profile — those viewers are unrelated to the caller, so SWR (serve stale, refetch in background) is correct.

**Signature:** `revalidateTag(tag: string, profile: string | { expire?: number }): void`. **The two-arg form is required** — single-arg is deprecated and may be removed.

### Pattern 4: `updateTag(tag)` for read-your-own-writes (immediate)

**Source:** updateTag.md:5-16, verified at `src/app/actions/notifications.ts:76,116,152` and `src/app/actions/follows.ts:86,123`.

```tsx
// Source: updateTag.md
updateTag('profile:twwaneka')                            // single-arg — only signature
updateTag(`viewer:${viewerId}:profile:${targetUserId}`)  // viewer-overlay invalidation
```

**When to use:** Server Action where the caller IS the same viewer whose cached UI is being invalidated. Example: `profile.ts.updateProfile` invalidates `profile:${username}` where `username` is the caller's own — the caller expects their displayName change to be visible immediately on their next render.

**Signature:** `updateTag(tag: string): void`. **Single-argument only.** updateTag.md:20-22 documents only one parameter.

**Why this matters (verified at `notifications.ts:26-46`):** Next 16's source-level distinction between the two primitives is that `updateTag` (no profile) sets `pathWasRevalidated = StaticAndDynamic`, which causes the Server Action response to bundle a fresh RSC payload — the client router merges it and the UI reflects the write immediately. `revalidateTag(tag, 'max')` does NOT set `pathWasRevalidated`, so the Server Action response does NOT bundle a fresh payload — the stale cached UI keeps being served until the next nav refetches it.

### Anti-Patterns to Avoid

- **Calling `getCurrentUser()` inside a `'use cache'` scope.** Will fail at runtime with E7. Read viewerId OUTSIDE the cached scope and pass as prop. Source: use-cache.md:194-196.
- **Using `revalidateTag` inside a Server Action for read-your-own-writes UI.** The caller will see stale UI on the immediate next render. Use `updateTag` instead. Source: `notifications.ts:26-46` (in-repo) + `updateTag.md:5-16`.
- **Using the single-argument `revalidateTag(tag)` form.** Deprecated (revalidateTag.md:55). Use `revalidateTag(tag, 'max')` or migrate to `updateTag`.
- **Caching a layout with `'use cache'` when the layout body has uncached data.** `'use cache'` on the file marks ALL exports as cached and requires all reads be serializable — won't work for our layout because `getCurrentUser()` reads cookies. The refactor is to extract the cookie-reading part into a Suspense-wrapped child, not to slap `'use cache'` on the layout.
- **Adding `loading.tsx` without refactoring the layout's data access.** Verified at `loading.md:88,90-95`. The same-segment layout's uncached data blocks the loading fallback. This is exactly the debug-doc finding 2026-05-14T00:25:00Z.
- **Putting `unstable_instant` on a Client Component.** Throws at build time. instant.md:20 makes this explicit. `[tab]/page.tsx` is a Server Component, so this is fine.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache invalidation across users | Custom in-memory invalidation map | `revalidateTag(tag, 'max')` from `next/cache` | Next 16 handles SWR semantics, x-nextjs-stale-time header coordination, and the client cache flush bypass when called from a Server Action (cacheLife.md:240-252). Hand-rolled would miss the client cache. |
| Read-your-own-writes invalidation | Polling/manual refresh button | `updateTag(tag)` from `next/cache` | `updateTag` bundles a fresh RSC payload in the Server Action response (sourced from `notifications.ts:26-46`). Hand-rolled polling adds latency and a worse UX. |
| Build-time validation that a route is instant | Custom snapshot test | `export const unstable_instant = { prefetch: 'static' }` | Next 16 simulates every shared-layout entry point and fails the build if any component would block prefetch (instant.md:65-69, instant-navigation.md:260-271). Hand-rolled would only cover one entry point. |
| Loading skeleton wiring | Custom Suspense + state | `loading.tsx` file convention | Next 16 automatically wraps `page.tsx` + nested layouts in `<Suspense fallback={<Loading/>}>` (loading.md:88). |
| Cookie-aware data access | Custom request-scoped storage | `cookies()` / `getCurrentUser()` resolved outside cached scope, passed as prop | Use-cache.md:21-22 calls this out as the "preferred pattern." |
| Profile username → row lookup caching | Custom in-memory map | `'use cache'` on the resolver Server Component | Established Horlo pattern (`PopularCollectors.tsx`, `NotificationBell.tsx`). |

## Runtime State Inventory

**Trigger applicability:** This is a refactor phase (not a rename/migration), so most categories are N/A. The one runtime state to track is **cache-tag taxonomy**, which is in-memory only (Next's LRU) and rebuilds on each deploy.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No DB schema changes. No data migration. | None. |
| Live service config | None. No external service config changes. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. `cacheComponents: true` already in `next.config.ts:13`. | None. |
| Build artifacts | None. New files (`profile-gate.tsx`, `profile-shell-resolver.tsx`, `profile-shell-skeleton.tsx`, `loading.tsx`) are TypeScript sources — TypeScript compilation produces fresh `.next/` artifacts. | Standard Next build. |
| **In-memory cache state** (new — Next-specific) | Two new tag families introduced: `profile:${username}`, `viewer:${viewerId}:profile:${ownerId}`. These are populated lazily on first read and invalidated by the new Server Action wiring. | Verified explicit invalidation in every mutating Server Action per D-39c-04. |

**Nothing found in any other category:** Verified by grep of `src/db/`, `src/lib/`, and `.env*` files. No persistent state to migrate or re-register.

## Common Pitfalls

### Pitfall 1: `viewerId` leaking into a cached scope

**What goes wrong:** A `'use cache'` Server Component that calls `getCurrentUser()` internally generates a cache entry keyed without viewerId — the first viewer's data is served to subsequent viewers.

**Why it happens:** `cookies()` / `headers()` / `getCurrentUser()` are request-time APIs (use-cache.md:194-196). Inside a `'use cache'` scope, the cache key is computed from arguments only — request-time APIs don't contribute to the key. If the cached function still reads them, the result poisons the cache.

**How to avoid:** Read viewerId OUTSIDE the cached scope and pass it as a prop (use-cache.md:21). For `<ProfileShellResolver/>`, this is enforced by design — the resolver never receives viewerId; the gate does, and the gate's viewer-dependent reads (`isFollowing`, `resolveCommonGround`) happen OUTSIDE the cached scope.

**Warning signs:** TypeScript will NOT catch this. The runtime catches it with an E7 error if you directly call `cookies()` / `headers()` inside `'use cache'`. But `getCurrentUser()` is an indirection — TS won't flag it. The fix is the established Horlo pattern: viewer-scoped reads always go through an explicit prop (see `PopularCollectors.tsx:9-13` comment).

### Pitfall 2: Forgetting the second argument to `revalidateTag`

**What goes wrong:** `revalidateTag(tag)` (single-arg) is the deprecated form per revalidateTag.md:55. TypeScript ignores it if you suppress errors, and behavior may be removed in a future Next minor version.

**Why it happens:** Stack Overflow and old blog posts still show the single-arg form. Training data is stale.

**How to avoid:** Always `revalidateTag(tag, 'max')` for SWR semantics in our cases. Verified throughout the codebase already — `watches.ts:265,285,431,461`, `follows.ts:77`, all pass `'max'`. D-39c-04 maintains this convention.

### Pitfall 3: Using `revalidateTag` when `updateTag` is correct (or vice versa)

**What goes wrong (revalidate-when-update):** Viewer's own UI keeps showing stale state on next render. Verified failure mode at `notifications.ts:26-46` ("the stale NotificationBell entry keeps being served on the next navigation"). For profile context: a user updates their displayName, navigates to their profile, still sees the old name for up to 5min (the cacheLife revalidate window).

**What goes wrong (update-when-revalidate):** Cross-user invalidation triggered as immediate-expire. Every viewer hitting the profile on next nav gets a blocking refetch. Not catastrophic, but loses the SWR benefit.

**How to avoid (decision rule):** Ask "is the caller the same viewer whose cached UI is being invalidated?"
- YES → `updateTag(tag)` (single-arg).
- NO → `revalidateTag(tag, 'max')`.

For D-39c-04:
- `profile.ts.updateProfile / updateProfileSettings` — caller IS the owner = `updateTag('profile:${username}')`. (CONTEXT.md is correct.)
- `watches.ts.addWatch/editWatch/removeWatch` — caller IS the owner. **Strictly, this is read-your-own-writes for the OWNER viewing their own profile.** But the same tag is read by OTHER viewers too. **Recommendation: `revalidateTag('profile:${ownerUsername}', 'max')`** matches CONTEXT.md and matches the existing `revalidateTag('explore', 'max')` pattern at the same call sites. Trade-off: owner sees their new watch with up to 5min delay on the layout-cached counts (but the page body re-fetches watches every nav, so the actual watch list updates immediately). **HIGH confidence this is acceptable.**
- `follows.ts.followUser/unfollowUser`:
  - `revalidateTag('profile:${targetUsername}', 'max')` — caller is NOT the target; SWR is correct.
  - `updateTag('viewer:${viewerId}:profile:${targetUserId}')` — caller IS the viewer; immediate update of viewer-overlay is correct.
- `wearEvents.ts.markAsWorn / logWearWithPhoto` — caller IS the owner. **Recommendation: `revalidateTag('profile:${ownerUsername}', 'max')`** — same logic as watches.

### Pitfall 4: Cache key collisions / fan-out misses

**What goes wrong:** Two tags meant to be distinct fan out together because they share a prefix or a Server Action invalidates one and expects the other to also flush.

**Why it happens:** `cacheTag('profile', `profile:${username}`)` with multiple tag arguments — calling `revalidateTag('profile')` would flush ALL profiles, not just one.

**How to avoid:** D-39c-02 specifies single-tag-per-scope:
- Resolver: `cacheTag('profile:${username}')` — single tag, single argument.
- Viewer overlay: `cacheTag('viewer:${viewerId}:profile:${ownerId}')` — single tag.

NEVER call `cacheTag('profile', ...)` (broad family + scoped) — that creates fan-out hazards. Look at `NotificationBell.tsx:21` (`cacheTag('notifications', 'viewer:${viewerId}')`) — they DO use two tags, but the `notifications` family is intentional fan-out for a future bulk-notif-invalidation case. For profile data, we don't want fan-out across all profiles, so use ONLY the scoped tag.

### Pitfall 5: `notFound()` after a `<Suspense>` has started streaming

**What goes wrong:** Response headers (including 200 status) are already sent; `notFound()` can't change them. The streamed body includes `<meta name="robots" content="noindex">` but the HTTP status stays 200 (loading.md:106-115).

**Why it happens:** `notFound()` placed AFTER an `await` that suspends has already lost the chance to set a 404 status.

**How to avoid:** Place `notFound()` BEFORE any `await` that may suspend (loading.md:118-124). In the gate, this means: call `notFound()` immediately after the profile lookup returns null, before any other awaits like `isFollowing` or `resolveCommonGround`. CONTEXT.md D-39c-05 step 3 places `notFound()` right after the resolver — correct.

**Practical impact:** For our case, the 404 status code is not load-bearing (no SEO/analytics dependency on it for missing profiles). The user-facing UI is what matters, and that's covered. Acceptable per the proxy-can-rewrite path noted at loading.md:113-115 if a hard 404 is ever needed (not required here).

### Pitfall 6: `unstable_instant` validation failure on dev server

**What goes wrong:** Build fails or dev overlay throws because validation simulates every shared-layout entry point (instant.md:65-69) and finds an uncached read that's not behind Suspense.

**Why it happens:** The `unstable_instant` export checks the FULL route hierarchy, not just the page. If the layout itself blocks (which is the bug we're fixing!), the validation catches it.

**How to avoid:** Add `unstable_instant` AFTER the layout refactor lands. If validation fires during the dev phase, that's actually telling us the refactor is incomplete — fix the offending read. CONTEXT.md D-39c-08 correctly orders the revert of 2f42d00 LAST, after all the static-shell work is done.

**Recommended order (planner):**
1. Refactor `layout.tsx` + add `<ProfileShellResolver/>` + `<ProfileGate/>` + `<ProfileShellSkeleton/>` + `loading.tsx`.
2. Wire `unstable_instant` on `[tab]/page.tsx`. Run `npm run build` — must succeed.
3. Add cache invalidation wiring across Server Actions.
4. Revert `2f42d00`.
5. Deploy to prod and run the manual-checkpoint protocol.

## Code Examples

### Example 1: `<ProfileShellResolver/>` (verified pattern from PopularCollectors.tsx)

```tsx
// Source pattern: src/components/explore/PopularCollectors.tsx:1-50 (verified)
// Source API: use-cache.md, cacheTag.md, cacheLife.md
import { cacheLife, cacheTag } from 'next/cache'
import {
  getProfileByUsername,
  getProfileSettings,
  getFollowerCounts,
} from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'

/**
 * CRITICAL (Pitfall 1): username is the SOLE cache key.
 * Do NOT call getCurrentUser() inside this cached scope.
 */
export async function ProfileShellResolver({ username }: { username: string }) {
  'use cache'
  cacheTag(`profile:${username}`)
  cacheLife({ revalidate: 300 })

  const profile = await getProfileByUsername(username)
  if (!profile) return { profile: null } as const

  const [settings, counts, watches, wearEvents] = await Promise.all([
    getProfileSettings(profile.id),
    getFollowerCounts(profile.id),
    getWatchesByUser(profile.id),
    getAllWearEventsByUser(profile.id),
  ])

  // Pure computation inside the cached scope — same as PopularCollectors derives
  // its row data inside the scope. computeTasteTags is a pure function (sync) at
  // src/lib/tasteTags.ts.
  const earliestDate = watches
    .map((w) => w.acquisitionDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  const collectionAgeDays = earliestDate
    ? Math.max(1, Math.floor((Date.now() - new Date(earliestDate).getTime()) / 86400000))
    : 30
  const tasteTags = computeTasteTags({
    watches,
    totalWearEvents: wearEvents.length,
    collectionAgeDays,
  })

  return { profile, settings, counts, watches, wearEvents, tasteTags } as const
}
```

### Example 2: `<ProfileGate/>` (single Suspense gate per D-39c-05)

```tsx
// app/u/[username]/profile-gate.tsx
import 'server-only'
import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { isFollowing } from '@/data/follows'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { CommonGroundHeroBand } from '@/components/profile/CommonGroundHeroBand'
import { LockedProfileState } from '@/components/profile/LockedProfileState'
import { ProfileTabs } from '@/components/profile/ProfileTabs'
import { resolveCommonGround } from './common-ground-gate'
import { ProfileShellResolver } from './profile-shell-resolver'

export async function ProfileGate({
  username,
  children,
}: {
  username: string
  children: React.ReactNode
}) {
  // Viewer resolution OUTSIDE the cached scope — Pitfall 1.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  // Cached, owner-scoped read.
  const resolved = await ProfileShellResolver({ username })
  if (!resolved.profile) notFound()
  const { profile, settings, counts, watches, wearEvents, tasteTags } = resolved

  const isOwner = viewerId === profile.id
  const initialIsFollowing =
    viewerId && !isOwner ? await isFollowing(viewerId, profile.id) : false

  if (!isOwner && !settings.profilePublic) {
    return (
      <LockedProfileState
        username={profile.username}
        displayName={profile.displayName ?? null}
        bio={profile.bio ?? null}
        avatarUrl={profile.avatarUrl ?? null}
        followerCount={counts.followers}
        followingCount={counts.following}
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
      />
    )
  }

  // Public path (or owner path).
  const overlap = await resolveCommonGround({
    viewerId,
    ownerId: profile.id,
    isOwner,
    collectionPublic: settings.collectionPublic,
  })

  const ownedCount = watches.filter((w) => w.status === 'owned').length
  const wishlistCount = watches.filter(
    (w) => w.status === 'wishlist' || w.status === 'grail',
  ).length

  return (
    <>
      <ProfileHeader
        username={username}
        displayName={profile.displayName ?? null}
        bio={profile.bio ?? null}
        avatarUrl={profile.avatarUrl ?? null}
        isOwner={isOwner}
        followerCount={counts.followers}
        followingCount={counts.following}
        watchCount={ownedCount}
        wishlistCount={wishlistCount}
        tasteTags={tasteTags}
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
        targetDisplayName={profile.displayName ?? `@${profile.username}`}
      />
      {overlap && (
        <CommonGroundHeroBand overlap={overlap} ownerUsername={username} />
      )}
      <div className="mt-6">
        <ProfileTabs
          username={username}
          showCommonGround={overlap?.hasAny ?? false}
          isOwner={isOwner}
        />
      </div>
      <div className="mt-6">{children}</div>
    </>
  )
}
```

### Example 3: refactored `layout.tsx`

```tsx
// app/u/[username]/layout.tsx (refactored)
import { Suspense } from 'react'
import { ProfileGate } from './profile-gate'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default async function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  const { username } = await params
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <Suspense fallback={<ProfileShellSkeleton />}>
        <ProfileGate username={username}>{children}</ProfileGate>
      </Suspense>
    </main>
  )
}
```

### Example 4: `loading.tsx`

```tsx
// app/u/[username]/loading.tsx
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <ProfileShellSkeleton />
    </main>
  )
}
```

### Example 5: `<ProfileShellSkeleton/>` (chrome-only per D-39c-06)

```tsx
// app/u/[username]/profile-shell-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'

export function ProfileShellSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header: avatar + name (chrome only — no taste-tag chips, no common-ground band) */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>
      {/* Tab strip — 5 fixed-width pills */}
      <div className="flex gap-2 overflow-hidden">
        {[80, 72, 64, 64, 56].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-md" style={{ width: w }} />
        ))}
      </div>
      {/* Content card placeholder */}
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
```

### Example 6: `unstable_instant` on `[tab]/page.tsx` (per D-39c-07)

```tsx
// Source: instant.md:22-30 (verified)
// app/u/[username]/[tab]/page.tsx — ADD this line at file top:
export const unstable_instant = { prefetch: 'static' }
```

### Example 7: Server Action invalidation wiring (per D-39c-04)

```tsx
// app/actions/profile.ts — INSIDE updateProfile (after the DAL write at line 33)
import { updateTag } from 'next/cache'

const profile = await getProfileById(user.id)  // existing DAL — adds 1 round-trip
if (profile?.username) {
  updateTag(`profile:${profile.username}`)
}

// app/actions/follows.ts — INSIDE followUser (after the DAL write at line 49)
const targetProfile = await getProfileById(parsed.data.userId)  // existing DAL
if (targetProfile?.username) {
  revalidateTag(`profile:${targetProfile.username}`, 'max')
}
updateTag(`viewer:${user.id}:profile:${parsed.data.userId}`)

// app/actions/watches.ts — INSIDE addWatch (after the existing revalidateTag('explore', 'max') at line 285)
const ownerProfile = await getProfileById(user.id)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
```

**Verified:** `getProfileById` exists at `src/data/profiles.ts:48` and returns `{ id, username, displayName, ... } | null`. Used already in `watches.ts:235` and `follows.ts:44` — pattern precedent.

### Example 8: `<ProfileShellResolver/>` invocation pattern

Note: Calling a `'use cache'` component as a function (Example 2 line `await ProfileShellResolver({ username })`) is the verified pattern from `instant-navigation.md:48-56` (`ProductInfo` is invoked the same way). The cache lookup happens transparently inside the function. The instant-navigation example places this inside a Suspense boundary; we do the same at the layout's `<Suspense fallback>` level.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidateTag(tag)` (single-arg) | `revalidateTag(tag, 'max')` (two-arg) | Next 16 (revalidateTag.md:55) | Single-arg is **deprecated**. CONTEXT.md and existing Horlo code (`watches.ts:265,285,431,461`) already use two-arg. Maintain. |
| `revalidateTag` for read-your-own-writes | `updateTag` for read-your-own-writes | Next 16 introduced `updateTag` (updateTag.md version history) | `revalidateTag(..., 'max')` is SWR; in a Server Action it suppresses the RSC-refetch response, so caller's UI stays stale. `updateTag` is the correct primitive for read-your-own-writes. CONTEXT.md D-39c-04 uses both correctly. |
| `loading.tsx` alone for partial prefetch on dynamic routes | `loading.tsx` PLUS the same-segment layout must not have uncached top-level data | Next 16 cacheComponents (loading.md:90-95) | This phase exists because adding `loading.tsx` alone is insufficient — the layout's uncached top-level fetches block the fallback. Refactor required. |
| Build-time correctness via integration tests | `unstable_instant` route segment export | Next 16 introduced (instant.md version history v16.x.x) | Native build-time + dev-time validation. Strictly stronger than integration tests because it simulates every shared-layout entry point (instant.md:65-69). |

**Deprecated/outdated:**
- `revalidateTag(tag)` single-arg form — replace with `revalidateTag(tag, 'max')` or `updateTag(tag)`.
- `unstable_cache` (older Next 15 primitive) — not used in Horlo, no migration needed. `'use cache'` is the Next 16 successor.

## Assumptions Log

> All claims in this research were verified against either `node_modules/next/dist/docs/` (HIGH confidence — local source of truth) or the repo source files. There are NO `[ASSUMED]` claims.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

**All claims tagged `[VERIFIED: ...]` or `[CITED: ...]`:**
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md]` — `'use cache'` semantics, serialization, `cookies()`/`headers()` ban inside cached scope.
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md]` — `cacheTag(tag1, tag2, ...)` signature and idempotency.
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md]` — inline object profile shape `{ revalidate: 300 }` is valid; `stale` and `expire` inherit from `default`; `revalidate >= 300` qualifies for prerender.
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md]` — two-arg signature `(tag, profile)`; `'max'` profile recommended; single-arg deprecated; `{ expire: 0 }` for webhook-style immediate.
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md]` — single-arg `updateTag(tag)`; Server-Actions-only; immediate read-your-own-writes.
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md]` — line 88: `loading.js` does NOT wrap same-segment `layout.js`. Lines 90-95: uncached layout reads block the fallback unless wrapped in `<Suspense>`.
- `[VERIFIED: node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md]` and `instant.md` — `unstable_instant = { prefetch: 'static' }` is correct shape; simulates every shared-layout entry point; opt-out with `false` on layouts.
- `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:298]` — "Prefetching is only enabled in production."
- `[VERIFIED: node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:88]` — Dynamic routes: partial prefetching enabled only when `loading.tsx` is present.
- `[VERIFIED: src/components/explore/PopularCollectors.tsx:22-25]` — canonical Horlo `'use cache'` Server Component pattern.
- `[VERIFIED: src/app/actions/notifications.ts:14-50,76,116,152]` — `updateTag` read-your-own-writes pattern with verbose comment explaining the source-level Next 16 mechanism.
- `[VERIFIED: src/app/actions/watches.ts:265,285,431,461]` — `revalidateTag(tag, 'max')` fan-out pattern.
- `[VERIFIED: src/app/actions/follows.ts:3,77,86,123]` — mixed `revalidateTag` (cross-user) + `updateTag` (read-your-own-writes) pattern.
- `[VERIFIED: src/app/u/[username]/layout.tsx]` — 147 lines, 8 uncached top-level reads (lines 22-110) — confirms the refactor target shape.
- `[VERIFIED: src/app/u/[username]/common-ground-gate.ts]` — pure module + single async export — pattern to mirror.

## Open Questions

1. **Tag-shape choice for `profile.ts.updateProfile`: username vs. userId?**
   - What we know: `profile.ts.updateProfile` only has `user.id` in hand. Username can be looked up via `getProfileById(user.id)` (adds 1 DB round-trip).
   - What's unclear: Whether to (a) do the lookup and tag by username everywhere, OR (b) tag by userId in both the resolver and the actions, OR (c) tag by BOTH `profile:${userId}` and `profile:${username}` in the resolver and let either invalidation form work.
   - Recommendation: **Option (c) — tag both** in the resolver. `cacheTag('profile:${profile.id}', 'profile:${profile.username}')` is two strings to one tag entry — idempotent (cacheTag.md:88) and cheap. Server Actions can then invalidate by whichever is in hand. **HIGH confidence this is the cleanest resolution.** Planner should adopt.
   - **Note for planner:** If adopting Option (c), update D-39c-02 references to be tolerant of the dual-tag shape.

2. **Where to fetch `initialIsFollowing` and `resolveCommonGround` in the gate?**
   - What we know: D-39c-05 says these are fetched inside the gate (not the resolver) because they're viewer-dependent.
   - What's unclear: Whether to wrap them in their OWN nested `<Suspense>` boundaries so the static shell can stream the chrome (header + tabs without follower-button hydration) before these resolve.
   - Recommendation: For the v1 of this refactor, fetch them sequentially inside the gate (current shape). Don't nest extra Suspense boundaries — they add complexity. The gate IS the Suspense boundary. If the bug recurs because `isFollowing` + `resolveCommonGround` are slow, planner can revisit in a follow-up phase.

3. **Should `<ProfileShellResolver/>` be a separate cache scope for the locked-vs-public gate vs. full chrome?**
   - What we know: D-39c-05 / Claude's Discretion calls this out.
   - What's unclear: Whether the additional cache entry per profile is worth saving the Promise.all on the locked branch.
   - Recommendation: **Defer.** Use one resolver. The locked branch is rare in practice (single-user app today; most profiles will be public). If profile traffic to locked profiles grows, split later. Capture as a v5.x perf polish backlog item per the Deferred section.

4. **Does `unstable_instant` validation pass on first attempt?**
   - What we know: Validation simulates every shared-layout entry point (instant.md:65-69).
   - What's unclear: Whether the new gate or any of its children will trigger a validation failure on first build.
   - Recommendation: Run `npm run build` after step 2 of the recommended order. If validation fails, fix the offending component and re-run. The validation error overlay identifies the specific component.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js 16 with `cacheComponents` | All cache primitives | ✓ | 16.2.3 in `package.json`; flag on at `next.config.ts:13` | — |
| Node.js | Build + dev server | ✓ | (project-default; no `.nvmrc`) | — |
| Existing `@/lib/auth` `getCurrentUser` / `UnauthorizedError` | Gate viewer resolution | ✓ | Existing | — |
| Existing DAL functions (`getProfileByUsername`, `getProfileSettings`, `getFollowerCounts`, `getWatchesByUser`, `getAllWearEventsByUser`, `getProfileById`, `isFollowing`) | Resolver + gate | ✓ | All exist; verified via grep | — |
| Existing `computeTasteTags` | Resolver | ✓ | `src/lib/tasteTags.ts` (per CONTEXT.md) | — |
| Existing `resolveCommonGround` | Gate public path | ✓ | `src/app/u/[username]/common-ground-gate.ts:35` | — |
| Existing `<Skeleton/>` primitive | Skeleton | ✓ | `src/components/ui/skeleton.tsx` | — |
| Prod / preview deployment for D-39c-09 verification | Manual checkpoint | ✓ (`www.horlo.app`) | — | Cannot fall back — bug is prod-only per link.md:298 |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to `false` — including this section as required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Project does not currently have a unit-test runner installed (`package.json` shows no `vitest` / `jest` / `@playwright/test`). Verification is **build-time + manual prod checkpoint** per D-39c-09. |
| Config file | `next.config.ts` (lint + build via `npm run build`); no test runner config exists |
| Quick run command | `npm run build` (fails fast if `unstable_instant` validation fires) + `npm run lint` |
| Full suite command | `npm run build && npm run lint && /* manual prod-checkpoint */` |

**Important:** Horlo does not currently use Vitest, Jest, or Playwright in its standard workflow. This phase's verification strategy is intentionally **static analysis + build-time validation + manual prod-checkpoint**, not automated unit tests. This matches the verification pattern used for prior cache-correctness phases (Phase 10 `'use cache'` adoption, Phase 18 DISC tag wiring) — both verified via build + manual prod checks.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEXT16-CONFORMANCE | `<ProfileShellResolver/>` has `'use cache'` directive + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })` | static-analysis | `grep -n "use cache" src/app/u/\[username\]/profile-shell-resolver.tsx && grep -n "cacheTag(.profile:" src/app/u/\[username\]/profile-shell-resolver.tsx && grep -n "cacheLife({.*revalidate:.300" src/app/u/\[username\]/profile-shell-resolver.tsx` | ❌ Wave 0 (file does not yet exist) |
| NEXT16-CONFORMANCE | `<ProfileShellResolver/>` does NOT call `getCurrentUser()` (Pitfall 1) | static-analysis | `! grep -n "getCurrentUser" src/app/u/\[username\]/profile-shell-resolver.tsx` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | Layout body has NO uncached top-level data fetches (no `getCurrentUser`, no `getProfileByUsername`, no `isFollowing`, no DAL calls at the layout body) | static-analysis | `! grep -nE "getCurrentUser\|getProfileByUsername\|getProfileSettings\|isFollowing\|getFollowerCounts\|getWatchesByUser\|getAllWearEventsByUser\|resolveCommonGround" src/app/u/\[username\]/layout.tsx` | ❌ Wave 0 (currently fails — that's the refactor target) |
| NEXT16-CONFORMANCE | `loading.tsx` exists at the profile segment | file-presence | `test -f src/app/u/\[username\]/loading.tsx` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `[tab]/page.tsx` exports `unstable_instant = { prefetch: 'static' }` | static-analysis | `grep -n "unstable_instant.*prefetch.*static" src/app/u/\[username\]/\[tab\]/page.tsx` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `unstable_instant` validation passes at build time (this IS the build-time gate) | build | `npm run build` (exits 0) | ✅ (Next CLI exists) |
| NEXT16-CONFORMANCE | `profile.ts.updateProfile` invalidates `profile:${username}` via `updateTag` | static-analysis | `grep -n "updateTag(.profile:" src/app/actions/profile.ts` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `profile.ts.updateProfileSettings` invalidates `profile:${username}` via `updateTag` | static-analysis | `grep -nA20 "updateProfileSettings" src/app/actions/profile.ts \| grep -n "updateTag(.profile:"` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `watches.ts.addWatch` invalidates `profile:${ownerUsername}` via `revalidateTag(..., 'max')` | static-analysis | `grep -nA5 "revalidateTag('profile:" src/app/actions/watches.ts` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `watches.ts.editWatch` invalidates `profile:${ownerUsername}` | static-analysis | (same as above, in editWatch scope) | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `watches.ts.removeWatch` invalidates `profile:${ownerUsername}` | static-analysis | (same as above, in removeWatch scope) | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `follows.ts.followUser` invalidates `profile:${targetUsername}` AND `viewer:${viewerId}:profile:${targetUserId}` | static-analysis | `grep -n "revalidateTag(.profile:" src/app/actions/follows.ts && grep -n "updateTag(.viewer:.*profile:" src/app/actions/follows.ts` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `follows.ts.unfollowUser` mirrors followUser invalidation | static-analysis | (same as above, in unfollowUser scope) | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `wearEvents.ts.markAsWorn` invalidates `profile:${ownerUsername}` | static-analysis | `grep -n "revalidateTag(.profile:" src/app/actions/wearEvents.ts` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | `wearEvents.ts.logWearWithPhoto` invalidates `profile:${ownerUsername}` | static-analysis | (same as above) | ❌ Wave 0 |
| NEXT16-CONFORMANCE | All `revalidateTag` calls use two-arg form (Pitfall 2) | static-analysis | `! grep -nE "revalidateTag\\([^,]+\\)" src/app/actions/*.ts` (no single-arg `revalidateTag` calls) | ✅ (already true) |
| NEXT16-CONFORMANCE | Diagnostic commit 2f42d00 reverted — `prefetch={false}` absent from UserMenu, ProfileTabs, BottomNav | static-analysis | `! grep -nE "prefetch=\\{false\\}" src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx` | ❌ Wave 0 (currently fails — that's the revert target) |
| NEXT16-CONFORMANCE | BottomNav `NavLink` no longer accepts a `prefetch` prop | static-analysis | `! grep -nE "prefetch\\?:.*boolean" src/components/layout/BottomNav.tsx` | ❌ Wave 0 |
| NEXT16-CONFORMANCE | Prod manual-checkpoint protocol: top-nav Profile click loads without 404 | manual-prod-checkpoint | (manual; see D-39c-09 step 3) | — |
| NEXT16-CONFORMANCE | Prod manual-checkpoint protocol: tab clicks (wishlist/worn/notes/stats/insights) load without 404 | manual-prod-checkpoint | (manual; see D-39c-09 step 4) | — |
| NEXT16-CONFORMANCE | Prod manual-checkpoint protocol: BottomNav Profile (mobile) loads without 404 | manual-prod-checkpoint | (manual; see D-39c-09 step 5) | — |
| NEXT16-CONFORMANCE | Prod manual-checkpoint protocol: DevTools Network shows partial prefetch (skeleton RSC on viewport entry, full RSC on click) | manual-prod-checkpoint | (manual; see D-39c-09 step 6) | — |

### Sampling Rate

- **Per task commit:** `npm run lint && npm run build` (lint catches type errors; build runs `unstable_instant` validation)
- **Per wave merge:** Static-analysis grep checks above + `npm run build`
- **Phase gate:** Full static analysis + `npm run build` green + manual prod-checkpoint per D-39c-09 (6 user-flow steps)

### Wave 0 Gaps

All test/verification artifacts are **commands run against new source files**, not pre-existing test files. Wave 0 should not author test files (there's no test runner). Wave 0 IS the build / static-analysis gate that validates the artifacts produced by other waves.

- [ ] `src/app/u/[username]/profile-shell-resolver.tsx` — file to be created (REQ-validation REQ-resolver-*)
- [ ] `src/app/u/[username]/profile-gate.tsx` — file to be created
- [ ] `src/app/u/[username]/profile-shell-skeleton.tsx` — file to be created
- [ ] `src/app/u/[username]/loading.tsx` — file to be created
- [ ] No test runner install needed — manual-checkpoint protocol covers the bug-specific verification gap that automated tests cannot cover (prod-only prefetch behavior per link.md:298)
- [ ] No Playwright/Vitest installation needed — Horlo does not currently use them; would be a separate phase if adopted

### Prod Manual-Checkpoint Protocol (D-39c-09 — load-bearing, NOT negotiable)

Per CONTEXT.md D-39c-09, the bug is prod-only. Local dev (`npm run dev`) cannot reproduce or verify the fix because prefetching is disabled in dev (link.md:298). The validation strategy therefore REQUIRES:

1. Deploy to a preview URL or production after the layout refactor + skeleton + loading.tsx + invalidation wiring + 2f42d00 revert all land.
2. Sign in as twwaneka@gmail.com.
3. Click "Profile" in top nav → expect `/u/twwaneka/collection` to load without 404. **PASS criterion: page renders, no 404.**
4. Click each tab (wishlist / worn / notes / stats / insights) → expect each to load. **PASS criterion: each tab renders without 404.**
5. Click Profile from BottomNav on mobile (or DevTools mobile emulation) → expect to load. **PASS criterion: page renders.**
6. DevTools Network panel:
   - On viewport entry of UserMenu avatar Link: confirm an RSC prefetch fires.
   - The prefetched RSC should be the **partial shell** (skeleton chrome) — small payload, no profile data.
   - On click: a second RSC fetch completes the full content. **PASS criterion: two-stage prefetch behavior visible in Network panel.**
7. Build-time gate: `unstable_instant = { prefetch: 'static' }` validation passed at `npm run build`. **PASS criterion: build exit code 0.**

If any step fails, the phase is NOT done. No automated test can substitute for steps 3-6 because prefetch behavior is production-only.

## Sources

### Primary (HIGH confidence — local source of truth)

- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — `'use cache'` directive, serialization rules, cookies/headers ban, runtime cache behavior, version history (v16.0.0 enabled with Cache Components).
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — `cacheTag(tag1, tag2, ...)` signature, idempotency, 256-char limit, 128-tag limit.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` — preset profiles (`seconds`/`minutes`/`hours`/`days`/`weeks`/`max`/`default`), inline `{ revalidate: 300 }` shape, prerender exclusion at `revalidate < 5min`, client cache `stale` minimum 30s.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — `(tag, profile)` two-arg signature; `'max'` recommended; single-arg deprecated (line 55); `{ expire: 0 }` for immediate webhooks (line 136).
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — single-arg signature; Server-Actions-only; immediate read-your-own-writes semantics.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` — line 88: `loading.js` does NOT wrap same-segment `layout.js`; lines 90-95: uncached layout reads block fallback; lines 106-115: 200-status streaming + noindex meta tag for `notFound()` after streaming starts.
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` — `unstable_instant` adoption, DevTools Instant Navs panel, opt-out with `false` on layouts, sibling-navigation entry-point semantics.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md` — `InstantConfig` TypeScript shape; `prefetch: 'static' | 'runtime'`; Client Components forbidden; cacheComponents required.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` line 298 — "Prefetching is only enabled in production."
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` line 88 — partial prefetch on dynamic routes requires `loading.tsx`.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` lines 34-46 — `<Activity>` semantics, recently-visited route preservation.

### Repo source files (HIGH confidence — read directly)

- `src/app/u/[username]/layout.tsx` (147 lines, 8 top-level uncached reads — the refactor target).
- `src/app/u/[username]/common-ground-gate.ts` (43 lines — pattern to mirror for `<ProfileGate/>`).
- `src/app/u/[username]/[tab]/page.tsx` (336 lines — receives `unstable_instant` export).
- `src/components/explore/PopularCollectors.tsx` (50 lines — canonical `'use cache'` pattern; mirror for `<ProfileShellResolver/>`).
- `src/components/notifications/NotificationBell.tsx` (40 lines — viewer-scoped tag pattern).
- `src/app/actions/notifications.ts` (158 lines — `updateTag` read-your-own-writes pattern + the in-comment explanation of the Next 16 source-level mechanism at lines 14-50).
- `src/app/actions/watches.ts` (471 lines — `revalidateTag(..., 'max')` fan-out at lines 265, 285, 431, 461).
- `src/app/actions/follows.ts` (130 lines — mixed `revalidateTag` + `updateTag` at lines 77, 86, 123).
- `src/app/actions/profile.ts` (89 lines — current `revalidatePath` shape; add `updateTag` per D-39c-04).
- `src/app/actions/wearEvents.ts` (261 lines — `markAsWorn` line 16 + `logWearWithPhoto` line 109; no delete/edit action).
- `src/components/ui/skeleton.tsx` (20 lines — shadcn primitive).
- `src/components/layout/UserMenu.tsx:110-123` — `prefetch={false}` at line 112 (REVERT TARGET).
- `src/components/profile/ProfileTabs.tsx:73` — `prefetch={false}` (REVERT TARGET).
- `src/components/layout/BottomNav.tsx:73,76,80,157` — `NavLink` definition + `prefetch={false}` Profile invocation (REVERT TARGET; multi-line revert).
- `next.config.ts:13` — `cacheComponents: true` confirmed.
- `src/data/profiles.ts:48` — `getProfileById` exists and returns `{ id, username, displayName, ... }`.
- `src/data/follows.ts:54` — `isFollowing` exists.

### Tertiary (none used)

- No WebSearch results — all evidence sourced from local docs and code.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all APIs verified in local `node_modules/next/dist/docs/`.
- Architecture (Path A3 / single Suspense gate / chrome-only skeleton): **HIGH** — pattern verified against `instant-navigation.md` Suspense-per-fetch example and against existing Horlo `PopularCollectors.tsx` shape.
- Tag taxonomy (`profile:${username}` + `viewer:${viewerId}:profile:${ownerId}`): **HIGH** — matches existing Horlo tag patterns. Open Question #1 (dual-tag with both username and userId) is a minor planner-discretion enhancement.
- Server Action invalidation wiring: **HIGH** — `updateTag` vs `revalidateTag(..., 'max')` decision rule verified against `notifications.ts:14-50` (in-repo) + `updateTag.md` (Next docs).
- `unstable_instant` shape: **HIGH** — `instant.md:22-30` and `instant-navigation.md:25` both show `{ prefetch: 'static' }` verbatim.
- `notFound()` in Suspense: **MEDIUM-HIGH** — `loading.md:120-124` describes the streaming + status-code interaction; for our use case the user-facing behavior is correct, but a hard 404 status would require a proxy rewrite (out of scope).
- Pitfalls: **HIGH** — every pitfall sourced from a doc page or an in-repo precedent comment.
- Wear-event action location: **HIGH** — confirmed via `find` and `grep`; only `markAsWorn` + `logWearWithPhoto` write to `wear_events`. No separate delete/edit action exists.

**Drift between CONTEXT.md and reality (all minor, all corrected in User Constraints):**
- UserMenu prefetch={false} is at **line 112**, not line 111 (the `<Link>` opens at line 110).
- BottomNav prefetch={false} is at **line 157**, not line 158.
- The wear-event Server Action file is `src/app/actions/wearEvents.ts`. It contains 2 write paths (`markAsWorn`, `logWearWithPhoto`) — no delete/edit action exists.
- `follows.ts.followUser` receives `parsed.data.userId` (UUID), NOT username — a `getProfileById(targetUserId)` lookup is needed to derive `targetUsername` for the `revalidateTag('profile:${targetUsername}', 'max')` call. Pattern precedent exists at `follows.ts:44` (already fetches `actorProfile`).
- `profile.ts.updateProfile` operates on `user.id` — a `getProfileById(user.id)` lookup is needed to derive `username`. Pattern precedent at `watches.ts:235`.

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days for stable Next 16 minor; refresh if Next 16.3+ ships before this phase executes)

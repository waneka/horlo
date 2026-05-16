# Phase 39c: Profile Layout Next 16 Conformance - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 12 (4 new, 8 modified)
**Analogs found:** 11 / 12 (one new file — `loading.tsx` — has no in-repo analog because no `loading.tsx` exists in `src/app/` today; mirrors the doc-pattern from `loading.md` and the canonical UI-SPEC Example 4)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/u/[username]/profile-shell-resolver.tsx` | **creation** — cached Server Component (DAL aggregator) | request-response (cached, owner-scoped fan-in) | `src/components/explore/PopularCollectors.tsx` | **exact** (same `'use cache'` + `cacheTag` + `cacheLife` + Promise.all shape; Pitfall 1 comment is verbatim applicable) |
| `src/app/u/[username]/profile-gate.tsx` | **creation** — Server Component gate (viewer-dependent branching) | request-response (sequential viewer-overlay reads + branching) | `src/app/u/[username]/common-ground-gate.ts` | **role-match** (pure module, single async export, `server-only` import, branching gate) — the **target file is component-shaped** (returns JSX) while common-ground-gate is **resolver-shaped** (returns data); shape upgrade is intentional |
| `src/app/u/[username]/profile-shell-skeleton.tsx` | **creation** — presentational Server Component | none (pure JSX) | `src/components/insights/VerdictSkeleton.tsx` + `src/components/wear/PhotoSkeleton.tsx` | **exact** (pure `<Skeleton/>` composition; no client state; no a11y label OR `role="status" aria-label` — both patterns present in repo) |
| `src/app/u/[username]/loading.tsx` | **creation** — Next 16 segment loading boundary | none (file convention) | (no in-repo analog) | **none** — mirror UI-SPEC Example 4 / RESEARCH §Code Examples Example 4 verbatim |
| `src/app/u/[username]/layout.tsx` | **modification** — refactor target (thin shell) | request-response (delegates to gate) | (self-refactor) | n/a — current file is the refactor target; shape becomes `<main>` + `<Suspense>` only |
| `src/app/u/[username]/[tab]/page.tsx` | **modification** — add `unstable_instant` route-segment export | route-segment config | (no in-repo analog) | **none** — no `export const dynamic` / `revalidate` / `unstable_instant` exists anywhere in `src/app/` today; this is the first route-segment config in the project. Mirror `instant.md:22-30` verbatim |
| `src/app/actions/profile.ts` | **modification** — add `updateTag('profile:${username}')` in `updateProfile` + `updateProfileSettings` | event-driven (Server Action invalidation) | `src/app/actions/notifications.ts:66-82` (`markAllNotificationsRead`) | **exact** — same RYO `updateTag(tag)` after DAL write |
| `src/app/actions/watches.ts` | **modification** — add `revalidateTag('profile:${ownerUsername}', 'max')` next to existing `revalidateTag('explore', 'max')` in `addWatch` / `editWatch` / `removeWatch` | event-driven (Server Action invalidation) | self-analog: `src/app/actions/watches.ts:275-285,422-431,455-461` (existing `revalidatePath` + `revalidateTag('explore', 'max')` triplets) | **exact** — call-site already exists; new `revalidateTag` line slots in alongside |
| `src/app/actions/follows.ts` | **modification** — add `revalidateTag('profile:${targetUsername}', 'max')` + `updateTag('viewer:${viewerId}:profile:${targetUserId}')` in `followUser` / `unfollowUser` | event-driven (Server Action invalidation, mixed RYO + cross-user) | self-analog: `src/app/actions/follows.ts:72-86` (existing mixed `revalidateTag` + `updateTag`) + `follows.ts:44` (existing `getProfileById` lookup for `actorProfile`) | **exact** — both primitives + lookup precedent already in the file |
| `src/app/actions/wearEvents.ts` | **modification** — add `revalidateTag('profile:${ownerUsername}', 'max')` in `markAsWorn` + `logWearWithPhoto` | event-driven (Server Action invalidation) | `src/app/actions/watches.ts:265,285,431,461` (cross-user fan-out form) | **role-match** — wearEvents.ts currently has zero `revalidateTag` calls; pattern imported from watches.ts |
| `src/components/layout/UserMenu.tsx` | **modification (revert)** — remove `prefetch={false}` at line 112 | n/a | self (revert of commit `2f42d00`) | n/a — single-line removal |
| `src/components/profile/ProfileTabs.tsx` | **modification (revert)** — remove `prefetch={false}` at line 73 | n/a | self (revert of commit `2f42d00`) | n/a — single-line removal inside JSX render prop |
| `src/components/layout/BottomNav.tsx` | **modification (revert)** — multi-line revert: drop `prefetch?: boolean` from `NavLinkProps` (line 73), drop `prefetch` destructure (line 76), drop `prefetch={prefetch}` Link pass-through (line 80), drop `prefetch={false}` Profile NavLink invocation (line 157) | n/a | self (revert of commit `2f42d00`) | n/a — 4-line revert across two scopes (interface + invocation) |

---

## Pattern Assignments

### `src/app/u/[username]/profile-shell-resolver.tsx` (creation, cached SC)

**Analog:** `src/components/explore/PopularCollectors.tsx` (50 lines — read in full)

**Imports pattern** (PopularCollectors.tsx:1-5):
```typescript
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getMostFollowedCollectors } from '@/data/discovery'
import { PopularCollectorRow } from '@/components/explore/PopularCollectorRow'
```

**For resolver** — match this shape (no `Link` import; named DAL imports from `@/data/*` and `@/lib/tasteTags`):
```typescript
import { cacheLife, cacheTag } from 'next/cache'

import {
  getProfileByUsername,
  getProfileSettings,
  getFollowerCounts,
} from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
```

**Pitfall-1 doc comment pattern** (PopularCollectors.tsx:7-21 — 15 lines of JSDoc; **copy the structure verbatim**, adapt the per-component specifics):
```typescript
/**
 * PopularCollectors — most-followed public profiles rail (DISC-04 / D-11).
 *
 * CRITICAL (Pitfall 1): viewerId MUST be an explicit prop. Do NOT call
 * getCurrentUser() inside this cached scope — the cache key would omit the
 * viewer and leak state across users. Mirrors NotificationBell.tsx pattern.
 *
 * Cache profile: per-viewer 5min (UI-SPEC § Component Inventory). Fan-out
 * tag `explore` covers cross-cutting addWatch/follow invalidations from
 * Plan 05; per-viewer suffix targets just-followed-someone refresh.
 *
 * Empty-state policy (UI-SPEC § Empty States): hide-on-empty for non-
 * Gaining-Traction rails — return null so the page composer omits the
 * section entirely.
 */
```

**Core cached-SC pattern** (PopularCollectors.tsx:22-29 — load-bearing):
```typescript
export async function PopularCollectors({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`)
  cacheLife({ revalidate: 300 })

  const collectors = await getMostFollowedCollectors(viewerId, { limit: 5 })
  if (collectors.length === 0) return null
```

**For resolver — mirror the 4-line preamble (line 1: function signature; line 2: `'use cache'`; line 3: `cacheTag(...)`; line 4: `cacheLife(...)`) verbatim**, then sequential lookup + early-return + Promise.all + pure computation:
```typescript
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
  // ... computeTasteTags(...) on the result, then return aggregate shape
```

**Notes for planner:**
- **`cacheTag` arg shape:** PopularCollectors uses two tags (family + per-viewer). Resolver uses **single tag** per D-39c-02 (no cross-profile fan-out desired). RESEARCH Open Question #1 floats a dual-tag (`profile:${id}` + `profile:${username}`) option that planner may adopt — both forms remain idempotent per cacheTag.md.
- **`cacheLife({ revalidate: 300 })`:** same value as PopularCollectors (300s); RESEARCH verifies 300s ≥ 5min threshold for prerender (cacheLife.md:254-258).
- **`computeTasteTags` is a pure function** at `src/lib/tasteTags.ts` — safe to run inside the cached scope (same pattern as PopularCollectors does derive-then-return).
- **Return shape:** use `as const` on the return object so downstream consumers (gate) get narrow tuple-like types — mirrors how `if (!profile) return { profile: null } as const` lets TS narrow `profile` to non-null after the early return.

---

### `src/app/u/[username]/profile-gate.tsx` (creation, viewer-dependent gate SC)

**Analog:** `src/app/u/[username]/common-ground-gate.ts` (43 lines — read in full)

**`server-only` import pattern** (common-ground-gate.ts:1-6):
```typescript
import 'server-only'
import { getTasteOverlapData } from '@/data/follows'
import {
  computeTasteOverlap,
  type TasteOverlapResult,
} from '@/lib/tasteOverlap'
```

**For gate** — mirror this shape (`'server-only'` first line; named imports for DAL + helpers + components):
```typescript
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
```

**Single-export doc-comment pattern** (common-ground-gate.ts:15-34):
```typescript
/**
 * Server-side Common Ground gate (T-09-08 / T-09-21 / T-09-23).
 *
 * Returns the TasteOverlapResult when the three-way gate passes, otherwise
 * null. Never returns raw TasteOverlapData — only the aggregate result — so
 * raw owner collection data cannot cross the server/client boundary through
 * this helper.
 *
 * Three-way gate (all must pass):
 *   1. viewerId !== null         — authenticated viewer
 *   2. !isOwner                  — viewer is not the profile owner
 *   3. collectionPublic === true — owner's collection visibility flag is on
 * ...
 * Single-sourced between layout.tsx and [tab]/page.tsx (DRY).
 */
```

**For gate — write a doc-comment with the same shape and explicitness**: (1) one-line purpose, (2) load-bearing invariants (notFound() bubbles inside Suspense, viewerId resolution must live OUTSIDE the resolver), (3) explicit branching gate description (locked vs public vs owner).

**Core gate body (current layout.tsx:18-110 distilled, viewer-dependent reads only)** — borrows the auth-resolution pattern from current `layout.tsx:24-30`:
```typescript
// Resolve viewer FIRST so we know if owner == viewer.
let viewerId: string | null = null
try {
  viewerId = (await getCurrentUser()).id
} catch (err) {
  if (!(err instanceof UnauthorizedError)) throw err
}
```

**For gate** — copy this 5-line try/catch block **verbatim** as the gate's first body lines. It is the established Horlo `getCurrentUser` swallow-`UnauthorizedError` pattern.

**Locked-branch render shape** (current `layout.tsx:47-64`):
```typescript
if (!isOwner && !settings.profilePublic) {
  const counts = await getFollowerCounts(profile.id)
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
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
    </main>
  )
}
```

**For gate** — copy the `<LockedProfileState .../>` JSX **verbatim** but drop the outer `<main>` wrapper (the layout owns the `<main>`; gate returns a fragment or the bare component). `counts` comes from the resolver output, not a fresh `getFollowerCounts` call.

**Public-branch render shape** (current `layout.tsx:112-145`):
```typescript
return (
  <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
    <ProfileHeader
      username={username}
      displayName={profile.displayName ?? null}
      // ...12 more props
    />
    {overlap && (
      <CommonGroundHeroBand
        overlap={overlap}
        ownerUsername={username}
      />
    )}
    <div className="mt-6">
      <ProfileTabs
        username={username}
        showCommonGround={overlap?.hasAny ?? false}
        isOwner={isOwner}
      />
    </div>
    <div className="mt-6">{children}</div>
  </main>
)
```

**For gate** — copy the inner JSX (everything inside `<main>...</main>`) **verbatim** into a fragment return. The layout's outer `<main>` wrapper stays in the layout.

---

### `src/app/u/[username]/profile-shell-skeleton.tsx` (creation, presentational SC)

**Analog:** `src/components/insights/VerdictSkeleton.tsx` (49 lines) + `src/components/wear/PhotoSkeleton.tsx` (17 lines) + `src/components/search/SearchResultsSkeleton.tsx` (36 lines)

**Imports pattern** (VerdictSkeleton.tsx:1-2):
```typescript
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
```

**For skeleton** — match the minimal-imports shape; no `Card` needed (UI-SPEC uses raw `rounded-xl border` placeholder, not `<Card>`):
```typescript
import { Skeleton } from '@/components/ui/skeleton'
```

**Doc-comment pattern** (VerdictSkeleton.tsx:4-17 — 14-line JSDoc citing UI-SPEC dimensions):
```typescript
/**
 * Phase 20 D-06: structural skeleton for the FIT-04 search-row inline expand.
 *
 * Mirrors <CollectionFitCard> shape so the swap from skeleton → real card is
 * dimensionally stable (no layout shift).
 *
 * Heights and widths from UI-SPEC § "Component Inventory" → "Loading state":
 *   - Title: h-4 w-24
 *   - Badge: h-5 w-16 rounded-4xl
 *   - ...
 */
```

**For skeleton** — write a JSDoc citing **39C-UI-SPEC § Component Inventory (NEW in 39c) → `<ProfileShellSkeleton/>`** and enumerate the 7 element dimensions from the UI-SPEC table verbatim.

**Pure-component shape with Skeleton primitives** (VerdictSkeleton.tsx:18-48):
```typescript
export function VerdictSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-4xl" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        // ...
```

**For skeleton** — match this pattern: named export, no `'use client'`, all visible elements are `<Skeleton/>` invocations. **Element dimensions are non-negotiable** per 39C-UI-SPEC table; the planner MUST copy them verbatim:
```typescript
export function ProfileShellSkeleton() {
  return (
    <div className="space-y-6" data-testid="profile-shell-skeleton">
      <div className="flex items-center gap-4">
        <Skeleton className="size-24 rounded-full" />  {/* 96px avatar circle */}
        <Skeleton className="h-6 w-48" />               {/* name placeholder */}
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl border" />
    </div>
  )
}
```

**A11y attribute pattern (optional, planner discretion per UI-SPEC):**

Two precedents in repo:
- **No a11y label** (VerdictSkeleton.tsx, SearchResultsSkeleton.tsx, HeaderSkeleton.tsx) — most skeletons follow this.
- **`role="status" aria-label="Loading X"`** (PhotoSkeleton.tsx:11-13):
```typescript
<Skeleton
  role="status"
  aria-label="Loading photo"
  className="..."
/>
```

**For skeleton** — UI-SPEC § Accessibility says either is acceptable. Recommend matching VerdictSkeleton (no label) unless adding sr-only "Loading profile" string for screen readers — in which case follow PhotoSkeleton's `role="status" aria-label` form on the outer `<div>` wrapper.

**Test-hook pattern** (SearchResultsSkeleton.tsx:19,24):
```typescript
<div className="space-y-2" data-testid="search-skeleton">
  {Array.from({ length: 4 }).map((_, i) => (
    <div
      key={i}
      ...
      data-testid="search-skeleton-row"
```

**For skeleton** — UI-SPEC § Test Hooks specifies `data-testid="profile-shell-skeleton"` on the outer wrapper (required) + 3 optional granular hooks. Project does not have Vitest installed (per RESEARCH §Test Framework), so the hooks are forward-compatibility breadcrumbs — adopt the outer hook minimum.

---

### `src/app/u/[username]/loading.tsx` (creation, segment loading boundary)

**Analog:** none in-repo (no `loading.tsx` files exist in `src/app/`). Mirror UI-SPEC Example § `loading.tsx` and RESEARCH §Code Examples Example 4 verbatim.

**Canonical shape** (RESEARCH Example 4):
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

**Notes for planner:**
- **Default export** required by Next 16 segment file convention (different from the named exports throughout the rest of the codebase).
- **Synchronous function** — Next 16 `loading.js` is rendered eagerly as the Suspense fallback wrapping `page.tsx` + nested layouts (loading.md:88,90-95).
- **`<main>` wrapper duplication:** the layout's Suspense fallback (`<ProfileShellSkeleton/>`) renders inside the layout's existing `<main>`. The `loading.tsx` boundary wraps `page.tsx` + nested layouts — different segment scope per loading.md:88 — so it needs its OWN `<main>` wrapper for dimensional consistency. UI-SPEC § Streaming & Interaction Contract calls this out: "they MUST visually match so the user never perceives a skeleton-to-skeleton hop."
- **Re-uses the same `<ProfileShellSkeleton/>` component** the layout's Suspense fallback uses (per UI-SPEC). Don't duplicate the skeleton JSX.

---

### `src/app/u/[username]/layout.tsx` (modification, refactor target)

**Analog:** self (refactor of existing 147-line file)

**Final shape** (RESEARCH Example 3 — load-bearing):
```tsx
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

**Key invariants for the refactor:**
- **No top-level uncached reads.** Verified by RESEARCH §Phase Requirements test: `! grep -nE "getCurrentUser|getProfileByUsername|getProfileSettings|isFollowing|getFollowerCounts|getWatchesByUser|getAllWearEventsByUser|resolveCommonGround" src/app/u/[username]/layout.tsx`. After refactor, this grep MUST be empty.
- **`LayoutProps<'/u/[username]'>` type generic** — preserved verbatim from current line 21 (Next 16 typed layouts feature).
- **`await params`** — preserved verbatim from current line 22 (Next 16 async params).
- **`<main>` className** — preserved verbatim from current lines 50, 113. Same className wraps the Suspense fallback (skeleton) so swap is zero-CLS.
- **`children` prop** is threaded through `<ProfileGate>` (children render inside the gate's public-branch JSX).

**What disappears from the layout (becomes the gate's responsibility):**
- All 8 DAL imports (lines 2-15) move to `profile-gate.tsx` and `profile-shell-resolver.tsx`.
- All 8 top-level `await` calls (lines 27, 32, 38, 44-45, 67-71, 105-110).
- The locked-vs-public branch return (lines 47-64).
- The public-branch JSX (lines 112-145).

---

### `src/app/u/[username]/[tab]/page.tsx` (modification, route-segment export)

**Analog:** none in-repo (no `export const dynamic | revalidate | unstable_instant` anywhere in `src/app/`). Mirror `instant.md:22-30` verbatim per RESEARCH Example 6.

**Pattern** — single-line addition near the top of the file (after imports, before the page component):
```typescript
// Phase 39c D-39c-07: build-time gate that confirms the route produces an
// instant static shell. Fails the build (and dev navigation) if any
// component in the shared-layout chain blocks prefetch.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// 02-route-segment-config/instant.md:22-30
export const unstable_instant = { prefetch: 'static' }
```

**Notes for planner:**
- **Must be a Server Component** — `instant.md:20` makes this explicit. `src/app/u/[username]/[tab]/page.tsx` is currently a Server Component (verified: it starts with `import { notFound } from 'next/navigation'` and uses server-only DAL calls).
- **Position:** convention in Next.js is between imports and the page component default export. Place near line 36-37 (after the imports block ending at `import type { WatchWithWear } from '@/lib/types'`, before the `const VALID_TABS = [...]` declaration).
- **Add LAST in the refactor sequence** — RESEARCH §Pitfall 6 / §Recommended order: layout refactor must land first, otherwise `unstable_instant` validation fails the build.

---

### `src/app/actions/profile.ts` (modification, RYO invalidation)

**Analog:** `src/app/actions/notifications.ts:66-82` (`markAllNotificationsRead`)

**Import pattern** (notifications.ts:3):
```typescript
import { updateTag } from 'next/cache'
```

**For profile.ts** — adjust the existing `import { revalidatePath } from 'next/cache'` at line 3 to `import { revalidatePath, updateTag } from 'next/cache'` (or split per project style — both are fine in Horlo).

**Read-your-own-writes pattern** (notifications.ts:74-77):
```typescript
try {
  await markAllReadForUser(user.id)
  updateTag(`viewer:${user.id}`)
  return { success: true, data: undefined }
}
```

**For profile.ts** — apply after the existing DAL write at line 33 of `updateProfile` (and line 77-81 of `updateProfileSettings`). The username lookup pattern is `getProfileById(user.id)` (RESEARCH Example 7 + verified at `watches.ts:235`):
```typescript
await profilesDAL.updateProfileFields(user.id, parsed.data)
// Phase 39c D-39c-04 — RYO invalidation of the cached owner-scoped profile
// shell. updateTag (single-arg) is the correct primitive: caller IS the
// viewer whose UI is being invalidated. See notifications.ts file-header
// comment for the source-level Next 16 rationale.
const profile = await profilesDAL.getProfileById(user.id)
if (profile?.username) {
  updateTag(`profile:${profile.username}`)
}
revalidatePath('/u/[username]', 'layout')  // existing call — keep alongside
revalidatePath('/settings')                 // existing call — keep alongside
```

**Notes for planner:**
- **Keep both existing `revalidatePath` calls.** They serve a different invariant (path-based invalidation; tag-based invalidation is additive, not a replacement).
- **`getProfileById` already imported in profile.ts?** Verify in plan; current file imports `* as profilesDAL` so it's accessible via `profilesDAL.getProfileById`.
- **Apply to both `updateProfile` AND `updateProfileSettings`** — both are RYO from the owner.

---

### `src/app/actions/watches.ts` (modification, cross-user fan-out)

**Analog:** `src/app/actions/watches.ts:275-285` (self-analog — existing `revalidatePath` + `revalidateTag('explore', 'max')` triplet in `addWatch`)

**Existing pattern verbatim** (watches.ts:274-286 — the exact lines new calls slot into):
```typescript
    revalidatePath('/')
    revalidatePath('/u/[username]', 'layout')

    // Phase 18 DISC-05 / DISC-06 — fan out 'explore' tag so the global
    // Trending + Gaining Traction rails (and the per-viewer Popular Collectors
    // rail, which also tags 'explore') recompute on next render. Cross-user
    // semantics via revalidateTag(tag, 'max') — Pitfall 4. Granularity is
    // intentionally broad (just 'explore') rather than per-rail, per RESEARCH
    // §Pattern 6 recommendation. Fires once regardless of status because
    // both Trending (owners + 0.5*wishlist) and Gaining Traction read the
    // denormalized counts from the catalog.
    revalidateTag('explore', 'max')
```

**For watches.ts** — alongside the existing `revalidateTag('explore', 'max')` call (lines 285, 431, 461), add:
```typescript
    // Phase 39c D-39c-04 — invalidate the owner's cached profile shell so
    // the next /u/{owner} render reflects the new watch count, taste tags,
    // and wear-event aggregates derived inside <ProfileShellResolver/>.
    // Cross-user form (revalidateTag + 'max'): the action's caller is the
    // owner, but OTHER viewers may have stale cached entries for the same
    // profile — SWR is correct.
    const ownerProfile = await profilesDAL.getProfileById(user.id)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
    revalidateTag('explore', 'max')  // existing
```

**Notes for planner:**
- **Pattern precedent for the `getProfileById` lookup** exists at `watches.ts:235` (already calls it for `actorProfile` denormalization). No new import needed.
- **Apply to all three write paths:** `addWatch` (after line 275), `editWatch` (after line 423), `removeWatch` (after line 455).
- **Order:** invalidation fires AFTER the DAL write commits. The existing `revalidatePath('/u/[username]', 'layout')` is path-based (different mechanism) and stays.

---

### `src/app/actions/follows.ts` (modification, mixed RYO + cross-user)

**Analog:** `src/app/actions/follows.ts:72-86` (self-analog — existing mixed `revalidateTag` + `updateTag` block in `followUser`)

**Existing pattern verbatim** (follows.ts:72-86):
```typescript
    // RESEARCH Pitfall 6 — invalidate the RECIPIENT's NotificationBell cache so
    // their unread dot lights up on next render. Bug fix (debug session
    // notifications-revalidate-tag-in-render): previously no invalidation
    // happened on the follow-write path, so the recipient saw no dot until
    // cacheLife TTL (30s) expired. Two-arg Next 16 form — Pitfall 4.
    revalidateTag(`viewer:${parsed.data.userId}`, 'max')

    // Phase 18 DISC-04 — invalidate the viewer's own Popular Collectors rail
    // (read-your-own-writes via updateTag). The just-followed user must drop
    // off the viewer's /explore Popular Collectors list on next render. Tag
    // matches the cacheTag in src/components/explore/PopularCollectors.tsx.
    // RYO semantics: caller is the same viewer whose rail recomputes —
    // updateTag (single-arg) is the right primitive, NOT revalidateTag.
    // RESEARCH §Pattern 6.
    updateTag(`explore:popular-collectors:viewer:${user.id}`)
```

**`getProfileById` lookup precedent** (follows.ts:44):
```typescript
    // Pre-resolve actor profile so logNotification has denormalized fields.
    // Fetching before the primary commit keeps the logger non-blocking (see below).
    // RESEARCH Open Q #5 locks this denormalize-in-caller approach.
    const actorProfile = await getProfileById(user.id)
```

**For follows.ts** — add to BOTH `followUser` AND `unfollowUser` (mirror the existing pattern's RYO + cross-user split):
```typescript
    // Phase 39c D-39c-04 — invalidate the TARGET's cached profile shell so
    // followerCount on /u/{target} reflects the change on next render. Tag
    // matches cacheTag in <ProfileShellResolver/>. Cross-user fan-out
    // (the target is NOT the caller) → revalidateTag(tag, 'max').
    const targetProfile = await getProfileById(parsed.data.userId)
    if (targetProfile?.username) {
      revalidateTag(`profile:${targetProfile.username}`, 'max')
    }

    // Phase 39c D-39c-04 — invalidate the VIEWER-OVERLAY tag so the viewer's
    // own `isFollowing` state inside <ProfileGate/> reflects the toggle
    // immediately (RYO). Tag matches the shape in <ProfileGate/>.
    updateTag(`viewer:${user.id}:profile:${parsed.data.userId}`)
```

**Notes for planner:**
- **`getProfileById` already imported** in follows.ts at line 9. No new import.
- **One extra DB round-trip per follow/unfollow.** Acceptable cost — the pattern precedent at line 44 already does this for actor profile denormalization. Planner may merge the two calls (one query for both `actorProfile` AND `targetProfile`) if the DAL supports a batched lookup, or leave as separate calls (current pattern).
- **`unfollowUser` symmetry** — apply the same two invalidation calls (lines 121-128 region). The current unfollowUser already has the parallel `updateTag('explore:popular-collectors:viewer:${user.id}')`, so the addition is structurally identical to followUser.

---

### `src/app/actions/wearEvents.ts` (modification, cross-user fan-out)

**Analog:** `src/app/actions/watches.ts:265,285,431,461` (cross-user `revalidateTag(tag, 'max')` form — imported into wearEvents.ts which currently has zero `revalidateTag` calls)

**Existing imports in wearEvents.ts:1-12** — needs extension:
```typescript
import { revalidatePath } from 'next/cache'
// → becomes:
import { revalidatePath, revalidateTag } from 'next/cache'
```

**Existing pattern in watches.ts to mirror** (watches.ts:285):
```typescript
    revalidateTag('explore', 'max')
```

**For wearEvents.ts** — after the existing `revalidatePath('/')` at line 55 of `markAsWorn` and line 228 of `logWearWithPhoto`:
```typescript
    revalidatePath('/')

    // Phase 39c D-39c-04 — invalidate the owner's cached profile shell so
    // wear-event aggregates (most-worn / least-worn / WornTabContent) inside
    // <ProfileShellResolver/> recompute on next render. Cross-user fan-out
    // form: although the caller IS the owner, other viewers may have stale
    // cached entries — SWR via revalidateTag(tag, 'max') is correct.
    const ownerProfile = await profilesDAL.getProfileById(user.id)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
```

**Notes for planner:**
- **`profilesDAL` is NOT currently imported** in wearEvents.ts. Plan needs to add: `import * as profilesDAL from '@/data/profiles'` (matching the namespace-import style used for `watchDAL` at line 7).
- **Apply to both write paths** — RESEARCH §Drift notes confirms only two write paths exist: `markAsWorn` (line 16) and `logWearWithPhoto` (line 109). No delete/edit action.
- **Test-hook (RESEARCH validation):** `grep -n "revalidateTag(.profile:" src/app/actions/wearEvents.ts` — expected to match after this change.

---

### `src/components/layout/UserMenu.tsx` (modification, revert)

**Analog:** self (commit `2f42d00` revert)

**Current line 110-114** (the revert target):
```typescript
<Link
  href={`/u/${username}/collection`}
  prefetch={false}
  aria-label={`Go to ${username}'s profile`}
  className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
>
```

**After revert** — remove line 112 (`prefetch={false}`); Next 16 default prefetch behavior takes over:
```typescript
<Link
  href={`/u/${username}/collection`}
  aria-label={`Go to ${username}'s profile`}
  className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
>
```

**Notes for planner:**
- **Single-line removal.** No imports change.
- **Land LAST** in the phase per D-39c-08, AFTER layout refactor + skeleton + loading.tsx + invalidation wiring are all committed. Otherwise the bug re-emerges between commits.

---

### `src/components/profile/ProfileTabs.tsx` (modification, revert)

**Analog:** self (commit `2f42d00` revert)

**Current line 73** (the revert target — inside a render prop):
```typescript
render={<Link href={`/u/${username}/${tab.id}`} prefetch={false} />}
```

**After revert** — remove `prefetch={false}`:
```typescript
render={<Link href={`/u/${username}/${tab.id}`} />}
```

**Notes for planner:**
- **Single-line removal inside JSX render prop.** No imports change.
- **Land LAST** per D-39c-08.

---

### `src/components/layout/BottomNav.tsx` (modification, multi-line revert)

**Analog:** self (commit `2f42d00` revert — 4-line revert across two scopes)

**Revert 1 — `NavLinkProps` interface (line 73):**
```typescript
interface NavLinkProps {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  prefetch?: boolean  // ← remove this line
}
```

**Revert 2 — function destructure (line 76):**
```typescript
function NavLink({ href, icon: Icon, label, active, prefetch }: NavLinkProps) {
  // becomes:
function NavLink({ href, icon: Icon, label, active }: NavLinkProps) {
```

**Revert 3 — Link pass-through (line 80):**
```typescript
<Link
  href={href}
  prefetch={prefetch}  // ← remove this line
  aria-current={active ? 'page' : undefined}
```

**Revert 4 — Profile NavLink invocation (line 157):**
```typescript
<NavLink
  href={profileHref}
  icon={User}
  label="Profile"
  active={isProfile}
  prefetch={false}  // ← remove this line
/>
```

**Notes for planner:**
- **Order of removals does not matter** — they're independent lines. TypeScript will catch any partial-revert (e.g., destructuring `prefetch` when the prop is no longer in the interface would compile-fail).
- **Verify with the RESEARCH test command:** `! grep -nE "prefetch\\?:.*boolean" src/components/layout/BottomNav.tsx` (must be empty after revert) AND `! grep -nE "prefetch=\\{false\\}" src/components/layout/BottomNav.tsx` (must be empty).
- **Land LAST** per D-39c-08.

---

## Shared Patterns

### Pattern S1: `'use cache'` Server Component preamble

**Source:** `src/components/explore/PopularCollectors.tsx:22-25`
**Apply to:** `src/app/u/[username]/profile-shell-resolver.tsx`

```typescript
export async function PopularCollectors({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`)
  cacheLife({ revalidate: 300 })
```

**Invariants** (verified in PopularCollectors.tsx + NotificationBell.tsx + RESEARCH):
1. `'use cache'` is the **first statement** of the function body, before any awaits.
2. `cacheTag(...)` is the **second statement**.
3. `cacheLife({ revalidate: N })` is the **third statement** (N ≥ 300 for prerender qualification per RESEARCH cacheLife.md:254-258).
4. **Never** call `getCurrentUser()`, `cookies()`, or `headers()` after this preamble. Viewer-scoped data must come in as an explicit prop (Pitfall 1).
5. **Arguments must be serializable** (RESEARCH use-cache.md:113-119). `username: string` qualifies; nested objects with Dates do not.

### Pattern S2: `getCurrentUser` swallow-`UnauthorizedError`

**Source:** `src/app/u/[username]/layout.tsx:24-30` (current), reused throughout the codebase
**Apply to:** `src/app/u/[username]/profile-gate.tsx`

```typescript
// Resolve viewer FIRST so we know if owner == viewer.
let viewerId: string | null = null
try {
  viewerId = (await getCurrentUser()).id
} catch (err) {
  if (!(err instanceof UnauthorizedError)) throw err
}
```

**Invariants:**
1. **`viewerId` is `null` for unauthenticated viewers** — never undefined, never throws.
2. **`UnauthorizedError` is the only swallowed exception type.** Other errors (DB outage, malformed JWT) propagate to `error.tsx`.
3. **Must live OUTSIDE any `'use cache'` scope.** This is the load-bearing invariant of Pitfall 1.

### Pattern S3: Server Action invalidation primitive selection

**Sources:**
- `src/app/actions/notifications.ts:14-50` (file-header comment with Next 16 source-level rationale)
- `src/app/actions/follows.ts:72-86` (mixed RYO + cross-user usage in one action)
- `src/app/actions/watches.ts:265,285,431,461` (cross-user fan-out)

**Apply to:** `profile.ts`, `watches.ts`, `follows.ts`, `wearEvents.ts` (the four action files this phase touches)

**Decision rule** (RESEARCH §Pitfall 3 — verified against `notifications.ts:26-46` source-level comment):
- **Caller IS the viewer whose UI is being invalidated** → `updateTag(tag)` (single-arg, no profile).
- **Caller is NOT the same viewer** → `revalidateTag(tag, 'max')` (two-arg, SWR).
- **NEVER use** `revalidateTag(tag)` single-arg form (deprecated per `revalidateTag.md:55`).

**Per-action-file mapping for this phase:**

| File | Function | Caller relationship | Primitive |
|------|----------|---------------------|-----------|
| profile.ts | `updateProfile` | Caller IS owner | `updateTag('profile:${username}')` |
| profile.ts | `updateProfileSettings` | Caller IS owner | `updateTag('profile:${username}')` |
| watches.ts | `addWatch` / `editWatch` / `removeWatch` | Caller is owner BUT other viewers also have stale | `revalidateTag('profile:${ownerUsername}', 'max')` |
| follows.ts | `followUser` / `unfollowUser` (target's profile) | Caller is NOT target | `revalidateTag('profile:${targetUsername}', 'max')` |
| follows.ts | `followUser` / `unfollowUser` (viewer-overlay) | Caller IS viewer | `updateTag('viewer:${viewerId}:profile:${targetUserId}')` |
| wearEvents.ts | `markAsWorn` / `logWearWithPhoto` | Caller is owner BUT other viewers also have stale | `revalidateTag('profile:${ownerUsername}', 'max')` |

### Pattern S4: `getProfileById` lookup for tag derivation

**Source:** `src/app/actions/follows.ts:44` (`actorProfile` lookup precedent) + `src/app/actions/watches.ts:235` (same pattern in watches)
**Apply to:** `profile.ts`, `watches.ts`, `follows.ts`, `wearEvents.ts`

```typescript
const actorProfile = await getProfileById(user.id)
// ... later:
if (actorProfile?.username) {
  // use actorProfile.username in tag
}
```

**Invariants:**
1. Server Actions receive `user.id` (UUID) but the tag taxonomy uses `username`. A `getProfileById(userId)` lookup is required to bridge.
2. **`?.username` chaining** — `getProfileById` returns `{...} | null`. Guard against null.
3. **One extra DB round-trip per Server Action** — accepted cost; pattern precedent at multiple sites.
4. **If batching available**, combine with existing `getProfileById` calls (e.g., follows.ts already calls it for `actorProfile`; the same call can supply the username for the cache tag).

### Pattern S5: Server-only module annotation

**Source:** `src/app/u/[username]/common-ground-gate.ts:1`
**Apply to:** `src/app/u/[username]/profile-gate.tsx`

```typescript
import 'server-only'
```

**Invariants:**
1. Top of file, before any other imports.
2. Causes build to fail if the module is ever transitively imported by a Client Component.
3. **Not needed for** `profile-shell-resolver.tsx` (the `'use cache'` directive already implies server-only) OR `profile-shell-skeleton.tsx` (it has no server-side dependencies; safe to render anywhere).

### Pattern S6: Skeleton primitive composition

**Source:** `src/components/ui/skeleton.tsx` (the primitive itself); existing skeletons (`VerdictSkeleton`, `PhotoSkeleton`, `SearchResultsSkeleton`, `HeaderSkeleton`)
**Apply to:** `src/app/u/[username]/profile-shell-skeleton.tsx`

```typescript
// Primitive (skeleton.tsx:14-18)
<div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
```

**Invariants:**
1. **All visual placeholders use `<Skeleton/>`** — no raw `<div className="bg-gray-200 animate-pulse">`. RESEARCH §Project Lint Notes: `tests/no-raw-palette.test.ts` enforces this.
2. **`bg-muted`** is the only fill color (provided by the primitive).
3. **Tailwind class names that map to tokens** only: `rounded-full`, `rounded-md`, `rounded-xl`, `border`, `size-N`, `h-N`, `w-N`. No raw oklch, hex, or `bg-gray-NNN`.
4. **No `font-medium`** (Phase 39b project-lint rule — skeleton has no text, so moot).
5. **No `'use client'`** directive — Server-Component-safe.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/u/[username]/loading.tsx` | segment loading boundary | file convention | No `loading.tsx` exists anywhere in `src/app/` today. This is the first instance. Mirror UI-SPEC Example § `loading.tsx` and RESEARCH §Code Examples Example 4 verbatim (2-statement file: import + default export). |
| `src/app/u/[username]/[tab]/page.tsx` (the `unstable_instant` export specifically) | route-segment config | file convention | No `export const dynamic | revalidate | unstable_instant` anywhere in `src/app/`. This is the first route-segment config in the project. Mirror `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md:22-30` verbatim. |

---

## Metadata

**Analog search scope:**
- `src/components/explore/` (cached SC pattern)
- `src/components/notifications/` (cached SC + viewer-scoped tag)
- `src/components/ui/skeleton.tsx` + 6 existing skeleton files
- `src/app/u/[username]/` (current layout, common-ground-gate, [tab]/page)
- `src/app/actions/` (profile, follows, notifications, watches, wearEvents)
- `src/components/layout/` (UserMenu, BottomNav — revert targets)
- `src/components/profile/` (ProfileTabs — revert target)

**Files scanned:** ~25 files, ~3000 lines total

**Pattern extraction date:** 2026-05-13

**Open questions inherited from RESEARCH (planner-discretionary):**
1. Dual-tag shape — `cacheTag('profile:${id}', 'profile:${username}')` for tolerance of tag-by-id OR tag-by-username invalidation. RESEARCH recommends adoption; planner picks.
2. Split `<ProfileShellResolver/>` into gate-only vs. full-chrome resolvers — RESEARCH recommends defer.
3. `unstable_instant` build-time validation passes on first attempt — RESEARCH recommends running `npm run build` between layout refactor and invalidation wiring waves to catch failures early.

---

## PATTERN MAPPING COMPLETE

**Phase:** 39c - Profile Layout Next 16 Conformance
**Files classified:** 12
**Analogs found:** 11 / 12

### Coverage
- Files with exact analog: 8 (PopularCollectors for resolver, VerdictSkeleton+PhotoSkeleton for skeleton, notifications.ts/follows.ts/watches.ts patterns for all 4 action-file mods, self-revert for 3 prefetch=false sites)
- Files with role-match analog: 3 (common-ground-gate for profile-gate; watches.ts for wearEvents.ts; self-refactor for layout.tsx)
- Files with no analog: 1 (loading.tsx — no in-repo precedent; doc-pattern only)

### Key Patterns Identified
- **`'use cache'` Server Component preamble** (3-line `'use cache'` + `cacheTag` + `cacheLife` block) is a load-bearing project convention — `PopularCollectors.tsx` and `NotificationBell.tsx` are verbatim shape templates for `<ProfileShellResolver/>`.
- **`getCurrentUser` + `UnauthorizedError` swallow** (5-line try/catch returning `null` on unauth) is the established viewer-resolution pattern, used in the current layout and inherited by `<ProfileGate/>`.
- **Server Action primitive selection rule** is verbatim-applicable from `notifications.ts:14-50` file-header comment: caller-IS-viewer → `updateTag`; caller-is-NOT-viewer → `revalidateTag(tag, 'max')`. Decision is unambiguous for all 5 action functions this phase touches.
- **`getProfileById` lookup-to-derive-username** is the bridge pattern for converting Server Actions' `user.id`/`parsed.data.userId` (UUID) into the username form the tag taxonomy uses — pattern precedent at `follows.ts:44` and `watches.ts:235`.
- **Skeleton composition** (pure `<Skeleton/>` primitives, no raw colors, no `font-medium`) is a project-lint-enforced convention (`tests/no-raw-palette.test.ts`); 6 existing skeletons in repo confirm the shape.

### File Created
`/Users/tylerwaneka/Documents/horlo/.planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns directly (with file paths + line numbers) in PLAN.md action sections. All 12 phase files have a designated source pattern or doc-mirror reference.

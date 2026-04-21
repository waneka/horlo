# Phase 9: Follow System & Collector Profiles - Research

**Researched:** 2026-04-21
**Domain:** Next.js 16 Server Actions for follow graph writes, server-compatible similarity engine extraction, multi-route profile layout with per-tab privacy gating, optimistic UI with server reconciliation
**Confidence:** HIGH (existing codebase is the primary source of truth; all Phase 8 patterns already ship and are load-bearing here)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Common Ground (PROF-09):**
- **D-01: Content = all four data types.** Common Ground includes:
  1. Shared watches (set intersection on normalized `(brand, model)` pairs — lowercase + trim, per research Anti-Pattern 3)
  2. Shared taste tags (intersection of viewer's + owner's computed tags)
  3. Overlap label derived server-side from `analyzeSimilarity()` logic ("Strong overlap" / "Some overlap" / "Different taste" — one phrase, not a numeric score)
  4. Shared styles + role breakdown (side-by-side mini bars using existing HorizontalBarChart)

- **D-02: Split UI across hero band + dedicated 6th tab.**
  - **Hero band** renders on non-owner profile view, between ProfileHeader and ProfileTabs. Compact: overlap label + small stat strip ("3 shared watches · 2 shared taste tags · lean sport together") + a "See full comparison →" link that deep-links to the 6th tab.
  - **6th tab: "Common Ground"** — only appears on other-user profiles (hidden on own profile and on locked private profiles). Full detail: shared watches grid (ProfileWatchCard), shared taste tag row (TasteTagPill), shared styles + role dual bars (HorizontalBarChart), overlap label explained.
  - **Empty overlap:** hero band shows "No overlap yet — your tastes are distinct." 6th tab is **not rendered at all** in this case (no empty tab).

- **D-03: Compute server-side on every render, no cache.** Phase 9 introduces `src/lib/tasteOverlap.ts` — a server-compatible version of the comparison logic that takes two users' `(watches, preferences)` and returns `TasteOverlapResult`. Invoked from the `/u/[username]` layout when viewer ≠ owner. At <500 watches/user, set intersection + similarity read is cheap.

- **D-04: Common Ground is never shown on own profile.** Owner viewing their own profile: no hero band, no 6th tab.

- **D-05: Empty-viewer-collection behavior.** If the **viewer** has zero watches, Common Ground still renders taste-tag intersection (if any) and the "No overlap yet" framing. Fallback signal > silent hide.

**Follow System (FOLL-01, FOLL-02, FOLL-03):**
- **D-06: Optimistic UI + `router.refresh()`.** Click Follow → local count bumps instantly + button flips to "Following" → Server Action writes to `follows` → `router.refresh()` reconciles server-rendered counts. On error, rollback local state + toast.
- **D-07: Follow button placements.**
  - ProfileHeader on non-owner view (primary placement, solid-style).
  - LockedProfileState (wire up Phase 8's non-functional placeholder).
  - Inline in follower/following list cards — per-row button on every entry, `stopPropagation` so clicking the button doesn't navigate.
  - *Not* in the Common Ground hero band.
- **D-08: Private-profile follow flow = auto-accept, instant.** Follow writes the row immediately on private profiles. Content stays locked (privacy is per-tab, not per-relationship).
- **D-09: Unfollow UX = hover-swap + instant click.** Button shows "Following" (muted). Hover (desktop) or tap (mobile) flips label to "Unfollow" (destructive tint). Click unfollows optimistically. Mobile: single tap reveals "Unfollow", second tap confirms.
- **D-10: Follow action validations.**
  - Cannot follow yourself — Server Action rejects if `followerId === followingId`.
  - Idempotent — `(follower_id, following_id)` unique constraint already in schema (Phase 7); Server Action swallows duplicate-key as a no-op.
  - Auth required — `getCurrentUser()` gate; unauth users don't see Follow button (or see it with sign-in redirect — Claude's discretion).

**Follower / Following List (FOLL-04):**
- **D-11: Dedicated routes.** `/u/[username]/followers` and `/u/[username]/following` as siblings of `/u/[username]/[tab]`.
- **D-12: Entry card content.** Avatar · displayName?? username (fall back, not side-by-side) · one-line bio · watch count · wishlist count · inline Follow button (hidden on your own row).
- **D-13: Sort + pagination.** `ORDER BY follows.created_at DESC`. No pagination at MVP — <500 target. Simple list.
- **D-14: Click row → `/u/[other]/collection`.** Explicit default-tab link. Follow button uses `stopPropagation`.

**Other-Profile Tab Visibility (PROF-08, PRIV-05):**
- **D-15: All 5 tabs always render in the tab row.** Visibility of **content** is gated; the tab row is stable.
- **D-16: Per-tab privacy gates.**
  - Collection → `profile_settings.collection_public`
  - Wishlist → `profile_settings.wishlist_public`
  - Worn → `profile_settings.worn_public` (via existing `getPublicWearEventsForViewer`)
  - Notes → per-row `notes_public` (Phase 8 D-13). Tab always shows; content = public notes only. Zero public notes = "No public notes" empty state.
  - Stats → per-card gates. Style/Role distribution gated on `collection_public`. Most/Least Worn + wear observations gated on `worn_public`. Locked card per gated stat.
- **D-17: 6th "Common Ground" tab visibility.** Only on non-owner view, only when at least one of (shared watches, shared taste tags) is non-empty. Not in tab row on own profile.
- **D-18: Locked-tab rendering = per-tab locked card.** When a tab is private and viewer is not the owner, tab content renders a small card with lock icon + "{displayName ?? username} keeps their {collection|wishlist|worn|notes|stats} private".
- **D-19: Owner-only UI hidden on other profiles.** Phase 8 already gates these — Phase 9 must preserve:
  - "+ Add Watch" card on Collection tab
  - "Log Today's Wear" CTA on Worn tab
  - Per-note visibility pill + 3-dot "Remove Note" menu on Notes tab
  - Inline edit on ProfileHeader
  - Stats "Observations" that expose private aggregates

**Privacy Enforcement (PRIV-05):**
- **D-20: Two-layer enforcement persists.** All new reads must be gated at both RLS (DB-level) and DAL (app-level WHERE clause).
- **D-21: Follow writes have RLS too.** `follows` policies:
  - INSERT: `auth.uid() = follower_id`
  - DELETE: `auth.uid() = follower_id`
  - SELECT: anyone can read the graph (counts are public).

**Count Accuracy (Success Criterion #5):**
- **D-22: Counts computed server-side each render.** `getFollowerCounts(userId)` already exists. After Follow/Unfollow, `router.refresh()` re-fetches the layout which calls this DAL again. No denormalized counts, no triggers.

### Claude's Discretion

- Exact shape of `TasteOverlapResult` type (output of `src/lib/tasteOverlap.ts`) — planner decides
- Exact SQL for `getFollowersForProfile` / `getFollowingForProfile` joins (profile+settings+watch/wishlist counts) — planner decides
- Micro-interactions: button loading states, hover transitions, toast positioning
- Exact wording of locked-tab copy variants (just match the "{username} keeps their {tab} private" spirit)
- Sign-in redirect behavior when unauth user clicks Follow
- Whether the Common Ground "stat strip" in hero band uses icons or plain punctuation separators
- Keyset-pagination migration path for follower lists when growth demands it (not shipped now)

### Deferred Ideas (OUT OF SCOPE)

- **Follow approval / request workflow** — would need a new phase + `follows.status` column + notification surface. Out of scope per REQUIREMENTS.md.
- **New-follower notifications** — NOTF-01 deferred to future milestone.
- **Preview popover on follower/following rows** — nice UX polish; re-evaluate after Phase 10.
- **Keyset pagination for follower lists** — swap in when a user crosses a threshold.
- **Sign-in redirect UX for unauth users clicking Follow** — Claude's discretion in planning.
- **Materialized Common Ground view / cache tags** — only if profile render becomes a hot path.
- **Collection discovery surfaces (browse, search, suggestions)** — DISC-*, EXPL-*, SRCH-* deferred.
- **"Collectors who own this watch" on watch detail** — WTCH-* deferred.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOLL-01 | User can follow another collector | New `src/data/follows.ts` DAL + `followUser()` in `src/app/actions/follows.ts`; Phase 7 `follows` table + RLS already in place. Optimistic UI pattern already established in `PrivacyToggleRow` / `NoteVisibilityPill`. |
| FOLL-02 | User can unfollow a collector | `unfollowUser()` Server Action; `DELETE ... WHERE follower_id = auth.uid() AND following_id = target`. Same optimistic-UI pattern. |
| FOLL-03 | Follower and following counts on any profile | `getFollowerCounts()` DAL already exists (Phase 7/8). ProfileHeader + LockedProfileState already render it. Phase 9 re-reads via `router.refresh()` after follow mutation. |
| FOLL-04 | View list of followers and following on a profile | New routes `/u/[username]/followers` and `/u/[username]/following`; new DAL `getFollowersForProfile(userId)` / `getFollowingForProfile(userId)` joining profiles + profile_settings + watch counts. |
| PROF-08 | Non-owner profile view (read-only, privacy-respecting) | Phase 8 layout + `[tab]` route already handle non-owner perfectly. Phase 9 adds per-tab-private-card for tabs shown as locked vs. empty, wires the Follow button, and adds the Common Ground hero band. |
| PROF-09 | Common Ground taste overlap on another collector's profile | New `src/lib/tasteOverlap.ts` pure server-safe function + `getTasteOverlap(viewerId, ownerId)` DAL that loads both users' `(watches, preferences)` and runs the overlap. Rendered in layout hero band + new 6th tab `/u/[username]/common-ground`. |
</phase_requirements>

---

## Summary

Phase 9 is an **integration phase**: almost every building block already exists in the codebase. The Phase 7 `follows` schema + RLS policies (`follows_insert_own`, `follows_delete_own`, `follows_select_all`) are correctly designed for this milestone. The Phase 8 profile route (`/u/[username]/[tab]/page.tsx`), the non-owner read paths in the DAL (including `getPublicWearEventsForViewer`), the `LockedProfileState` (with its non-functional Follow placeholder), the `ProfileHeader`, and the optimistic-toggle primitives (`PrivacyToggleRow`, `NoteVisibilityPill`) are all precedents that this phase extends rather than replaces.

Three new concerns are load-bearing. First: the existing `analyzeSimilarity()` in `src/lib/similarity.ts` is a pure function with no browser APIs — it is already server-safe — but it compares **one target watch against a collection**, not **two collections + preferences**. Phase 9 needs a new `src/lib/tasteOverlap.ts` that intersects on normalized `(brand, model)`, intersects taste tags, and derives a human label ("Strong overlap" / "Some overlap" / "Different taste") from aggregate scores. Second: the `/u/[username]/[tab]/page.tsx` currently enforces `collectionPublic` and `wornPublic` by returning a `PrivateTabState` early — Phase 9 must add the analogous "Common Ground" tab handling, wire the notes tab's per-row privacy correctly with the collection-public pre-gate (Phase 8 WR-01 already landed this fix), and propagate `displayName` to the locked-tab copy ("{displayName ?? username} keeps their {tab} private"). Third: the existing Drizzle connection (`src/db/index.ts`) connects via `DATABASE_URL` using a service-role-equivalent session that bypasses RLS — so RLS on `follows` protects direct anon-key writes but DAL code must independently enforce authorization (already the pattern).

The count-refresh mechanism is subtle. Next.js 16 exposes `refresh()` from `next/cache` for Server Actions, but the existing codebase uses `router.refresh()` from `next/navigation` in Client Components for the same effect (see `WatchDetail.tsx`, `signup-form.tsx`). D-06 locks the Client-Component pattern; the Server Action side of Phase 9 should still call `revalidatePath('/u/[username]', 'layout')` so that subsequent fresh page loads see the updated counts too (matches how Phase 8's `updateNoteVisibility` and `updateProfileSettings` actions are written).

**Primary recommendation:** Ship three plans in dependency order: (1) DAL + Server Actions + `tasteOverlap.ts` library with pure-function unit tests; (2) Follow button components + LockedProfileState wiring + ProfileHeader extension + follower/following route pages; (3) Common Ground hero band + 6th tab route + per-tab locked-card copy + layout wiring. No schema migration required — all tables land in Phase 7.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Next.js | 16.2.3 | App Router dynamic routes, Server Components, Server Actions | Locked [VERIFIED: package.json] |
| React | 19.2.4 | `useOptimistic`, `useTransition`, `useRouter().refresh()` | Locked [VERIFIED: package.json] |
| Drizzle ORM | ^0.45.2 | Typed queries against existing `follows`, `profiles`, `profile_settings`, `watches`, `user_preferences` | Locked [VERIFIED: package.json] |
| Supabase SSR | ^0.10.2 | Server-side session read (already wired via `getCurrentUser()`) | Locked [VERIFIED: package.json] |
| Zod | (bundled via existing actions) | Strict schema validation on Server Action input (`.strict()` pattern, mass-assignment safe) | Locked [VERIFIED: grep `z.object.*strict` in `src/app/actions/profile.ts`, `src/app/actions/notes.ts`] |
| Tailwind CSS 4 | ^4 | All styling | Locked |
| `@base-ui/react` | ^1.3.0 | Tabs (6th tab extension), DropdownMenu if two-tap Unfollow confirm is built | Locked |
| `lucide-react` | ^1.8.0 | Follow / UserPlus / UserMinus / UserCheck icons | Locked |
| `vitest` + `@testing-library/react` | ^2.1.9 / ^16.3.2 | Unit tests for `tasteOverlap.ts` + Server Action mocks | Locked [VERIFIED: `vitest.config.ts` + `tests/lib/tasteTags.test.ts`] |

**No new packages needed.** All follow / social-graph / overlap logic can be written against the existing stack.

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Client-side optimistic update + `router.refresh()` (D-06) | `useOptimistic` wrapping a form action | `useOptimistic` is great for single values; for a pair of (button label, follower count) it requires a compound state. The existing codebase's `PrivacyToggleRow` pattern is single-value only. Keep it simple — `useState` + `useTransition` + `router.refresh()` is the precedent. |
| Server-side `tasteOverlap.ts` as a pure function | Reuse client-side `analyzeSimilarity()` as-is | `analyzeSimilarity(targetWatch, collection, preferences)` answers "does this single watch fit this user's taste" — it takes one watch, not two collections. The shape is wrong for Common Ground. Building a new pure function re-uses the same weights/thresholds but changes the fold axis. |
| Denormalized `follower_count` / `following_count` columns on `profiles` | Trigger on `follows` INSERT/DELETE | CONTEXT.md D-22 locks "no denormalized counts" — at <500 users the JOIN is sub-millisecond. Avoids trigger complexity + race conditions on concurrent follow/unfollow. |
| Next.js 16 `refresh()` from `next/cache` (Server Action side) | `router.refresh()` from `next/navigation` (Client side) | D-06 locks client-side router refresh — matches existing codebase pattern (`WatchDetail.tsx`). Server Action side should *still* call `revalidatePath('/u/[username]', 'layout')` for server-cache correctness on next fresh load (matches `updateNoteVisibility` pattern). |
| `Realtime` subscription on `follows` table | Polling / refresh | Out of scope per STATE.md accumulated context ("No Supabase Realtime — free tier 200 WS limit"). |

**Installation:** None required.

**Version verification:**
- `next`: 16.2.3 [VERIFIED: package.json line 24, `ls node_modules/next/dist/docs/` confirms docs bundled]
- `react`: 19.2.4 [VERIFIED: package.json line 27]
- `drizzle-orm`: ^0.45.2 [VERIFIED: package.json line 22]
- `@supabase/ssr`: ^0.10.2 [VERIFIED: package.json line 16]
- `vitest`: ^2.1.9 [VERIFIED: package.json line 50]

---

## Architecture Patterns

### Routing Structure

```
src/app/u/[username]/
├── layout.tsx                    # EXTEND — fetch viewer prefs + overlap for non-owner,
│                                 #   render hero band between ProfileHeader and ProfileTabs
├── page.tsx                      # NO CHANGE — redirects to /collection
├── [tab]/
│   └── page.tsx                  # EXTEND — respect per-tab privacy gates with new
│                                 #   displayName-aware copy; handle 'common-ground' tab id
├── followers/
│   └── page.tsx                  # NEW — Server Component, fetch follower list
└── following/
    └── page.tsx                  # NEW — Server Component, fetch following list
```

**Alternative considered for Common Ground tab:** dedicated `/u/[username]/common-ground/page.tsx` vs. extending the existing `[tab]` union. Recommendation: **extend `[tab]`** (add `'common-ground'` to `VALID_TABS` in `src/app/u/[username]/[tab]/page.tsx`). Reason: the tab click navigates to `/u/{user}/common-ground` — the existing ProfileTabs component already `Link`s to `/u/{user}/{tab.id}`, so a hyphen in the id works naturally and no new page file is needed. The tab must be conditionally rendered (D-17: hidden on own profile and empty-overlap cases) — extend the `ProfileTabs` component to accept a `showCommonGround: boolean` prop.

### Pattern 1: Async Params (Next.js 16 REQUIRED — reused from Phase 8)

`params` is a Promise in both Server and Client Components. Existing code in `src/app/u/[username]/layout.tsx` already does `const { username } = await params`. The new `followers/page.tsx` and `following/page.tsx` must follow the same pattern.

```typescript
// src/app/u/[username]/followers/page.tsx
// Source: existing pattern in src/app/u/[username]/[tab]/page.tsx line 37
export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  // ...
}
```

[VERIFIED: Next.js 16.2.3 docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`; existing code in Phase 8 confirms this exact pattern works in production]

### Pattern 2: Optimistic Follow with Router Refresh (D-06)

```typescript
// src/components/profile/FollowButton.tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { followUser, unfollowUser } from '@/app/actions/follows'

interface FollowButtonProps {
  targetUserId: string
  initialIsFollowing: boolean
  initialFollowerCount: number
  variant?: 'primary' | 'inline' // 'primary' for ProfileHeader; 'inline' for list rows
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
  initialFollowerCount,
}: FollowButtonProps) {
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const next = !isFollowing
    // Optimistic bump
    setIsFollowing(next)
    setFollowerCount((c) => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = next
        ? await followUser({ userId: targetUserId })
        : await unfollowUser({ userId: targetUserId })
      if (!result.success) {
        // Rollback
        setIsFollowing(!next)
        setFollowerCount((c) => c + (next ? -1 : 1))
        console.error('[FollowButton]', result.error)
        return
      }
      // Server reconciliation — re-fetches layout data, updates the displayed count
      // on both follower's and followed collector's next render.
      router.refresh()
    })
  }
  // ... render Follow / Following (with hover-swap to Unfollow) per D-09
}
```

**Why not `useOptimistic`:** the existing `PrivacyToggleRow` uses `useOptimistic` because it has a single boolean state. The Follow button has a compound state (`isFollowing` + `followerCount`) and pairs with a sibling parent-rendered count, so local `useState` + `router.refresh()` is cleaner. D-06 locks this choice.

### Pattern 3: Server Action with `ActionResult<T>` (existing pattern)

```typescript
// src/app/actions/follows.ts
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as followsDAL from '@/data/follows'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

const followSchema = z.object({ userId: z.string().uuid() }).strict()

export async function followUser(data: unknown): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = followSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }

  // D-10: self-follow rejected
  if (parsed.data.userId === user.id) {
    return { success: false, error: 'Cannot follow yourself' }
  }

  try {
    // D-10: idempotent — DAL uses onConflictDoNothing
    await followsDAL.followUser(user.id, parsed.data.userId)
    // Revalidate BOTH profile layouts so counts refresh on fresh navigations
    // (router.refresh() from the client handles the immediate re-render;
    //  revalidatePath ensures cache consistency for future visits).
    revalidatePath('/u/[username]', 'layout')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[followUser] unexpected:', err)
    return { success: false, error: "Couldn't follow. Try again." }
  }
}
```

[VERIFIED: pattern matches `src/app/actions/profile.ts` (updateProfile, updateProfileSettings) and `src/app/actions/notes.ts` (updateNoteVisibility, removeNote)]

### Pattern 4: Server-Safe Similarity Extraction (D-03)

`src/lib/similarity.ts` has `'use client'`? **No — confirmed absent** ([VERIFIED: read of file]. No `'server-only'` either. It's a pure function module — importable from anywhere. Two key functions are already exported:
- `analyzeSimilarity(targetWatch, collection, preferences)` — answers "does this one watch fit this collection"
- `detectLoyalBrands(owned)` — exported (currently used by `buildObservations` in `src/lib/stats.ts`)
- `GOAL_THRESHOLDS` — exported

For Phase 9, create `src/lib/tasteOverlap.ts` that **reuses** these exported primitives without copying their internals. No `'use client'` and no `'server-only'` — like `similarity.ts`, the overlap function is a pure deterministic calculation so it's safe to import anywhere (and this means the Vitest alias for `server-only` is not needed for its tests).

```typescript
// src/lib/tasteOverlap.ts — illustrative, planner will own exact shape
import type { Watch, UserPreferences } from '@/lib/types'
import { analyzeSimilarity } from '@/lib/similarity'
import { computeTasteTags, type TasteTagInput } from '@/lib/tasteTags'

export interface TasteOverlapResult {
  sharedWatches: Array<{ brand: string; model: string; viewerWatch: Watch; ownerWatch: Watch }>
  sharedTasteTags: string[]
  overlapLabel: 'Strong overlap' | 'Some overlap' | 'Different taste'
  sharedStyleRows: Array<{ label: string; viewerPct: number; ownerPct: number }>
  sharedRoleRows: Array<{ label: string; viewerPct: number; ownerPct: number }>
}

export function computeTasteOverlap(
  viewer: { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] },
  owner:  { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] },
): TasteOverlapResult {
  // 1. Normalize brand+model pairs for intersection (Anti-Pattern 3 in PITFALLS.md)
  const norm = (w: Watch) => `${w.brand.trim().toLowerCase()}|${w.model.trim().toLowerCase()}`
  const viewerOwned = viewer.watches.filter((w) => w.status === 'owned')
  const ownerOwned  = owner.watches.filter((w) => w.status === 'owned')
  const ownerByKey = new Map(ownerOwned.map((w) => [norm(w), w]))
  const sharedWatches = viewerOwned
    .filter((v) => ownerByKey.has(norm(v)))
    .map((v) => ({
      brand: v.brand, model: v.model,
      viewerWatch: v, ownerWatch: ownerByKey.get(norm(v))!,
    }))

  // 2. Shared taste tags (case-sensitive — tasteTags.ts computes canonical strings)
  const sharedTasteTags = viewer.tasteTags.filter((t) => owner.tasteTags.includes(t))

  // 3. Overlap label — derive from avg similarity scores when applying viewer's
  //    watches against owner's collection (reuse analyzeSimilarity).
  const scores = viewerOwned.map((vw) =>
    analyzeSimilarity(vw, ownerOwned, viewer.preferences).score
  )
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const overlapLabel: TasteOverlapResult['overlapLabel'] =
    avgScore >= 0.55 ? 'Strong overlap' :
    avgScore >= 0.30 ? 'Some overlap' :
    'Different taste'

  // 4. Shared style + role rows: label -> (viewerPct, ownerPct)
  //    Reuse calculateDistribution from src/lib/stats.ts for both sides.
  // ...

  return { sharedWatches, sharedTasteTags, overlapLabel, sharedStyleRows: [], sharedRoleRows: [] }
}
```

**Thresholds (0.55 / 0.30) above are illustrative.** The planner should calibrate them against the existing `GOAL_THRESHOLDS` table in `similarity.ts` — specifically the `coreFit` / `familiarTerritory` gates. A principled choice: `>= GOAL_THRESHOLDS.balanced.coreFit` → "Strong", `>= GOAL_THRESHOLDS.balanced.familiarTerritory` → "Some", else "Different". Document the chosen values in PLAN.md.

### Pattern 5: Per-Tab Locked Card with displayName (D-18)

The current `[tab]/page.tsx` has a `PrivateTabState({ tab })` component that renders "This {tab} is private." D-18 requires "{displayName ?? username} keeps their {tab} private" — the message needs the profile identity. Phase 9 must pass `{ displayName, username }` into the private-tab card.

```typescript
// Existing (Phase 8):
function PrivateTabState({ tab }: { tab: Tab }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <p className="text-sm text-muted-foreground">This {tab} is private.</p>
    </section>
  )
}

// Phase 9 extension:
function PrivateTabState({ tab, displayName, username }: { tab: Tab; displayName: string | null; username: string }) {
  const name = displayName ?? `@${username}`
  const label = tab === 'worn' ? 'worn history' : tab // pluralize correctly
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <Lock className="size-5 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm text-muted-foreground">{name} keeps their {label} private.</p>
    </section>
  )
}
```

Pass `displayName` from the already-fetched `profile` in `[tab]/page.tsx`.

### Pattern 6: Follower / Following Card Row with Inline Follow (D-12)

Click the row → `/u/{other}/collection`. Click the Follow button → fires the Server Action without navigating. Use `Link` wrapping the card body and `<button onClick={(e) => e.stopPropagation()}>` inside.

```tsx
// src/components/profile/FollowRow.tsx
'use client'
import Link from 'next/link'
import { AvatarDisplay } from './AvatarDisplay'
import { FollowButton } from './FollowButton'

export function FollowRow({
  username, displayName, bio, avatarUrl,
  watchCount, wishlistCount,
  targetUserId, viewerIsFollowing, followerCount,
  isOwnRow,
}: FollowRowProps) {
  return (
    <div className="relative flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-muted/50">
      <Link href={`/u/${username}/collection`} className="absolute inset-0" aria-label={`View ${username}'s profile`} />
      <AvatarDisplay avatarUrl={avatarUrl} displayName={displayName} username={username} size={64} />
      <div className="relative z-10 flex-1 pointer-events-none">
        <p className="font-semibold">{displayName ?? `@${username}`}</p>
        {bio && <p className="text-sm text-muted-foreground truncate">{bio}</p>}
        <p className="text-xs text-muted-foreground">{watchCount} watches · {wishlistCount} wishlist</p>
      </div>
      {!isOwnRow && (
        <div className="relative z-10 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <FollowButton
            targetUserId={targetUserId}
            initialIsFollowing={viewerIsFollowing}
            initialFollowerCount={followerCount}
            variant="inline"
          />
        </div>
      )}
    </div>
  )
}
```

**Pitfall:** absolute-positioned `<Link>` overlays are a known pattern but the overlay can steal focus from nested buttons. The `pointer-events-auto` + `stopPropagation` handler on the Follow button wrapper is the reliable fix (alternative: lift the Link out and use `useRouter().push()` on a containing `div` — more JS, less clean).

### Anti-Patterns to Avoid

Pulled forward and de-duplicated from `.planning/research/PITFALLS.md`. **Everything in that file still applies** — the list below is specific additions for Phase 9.

- **Denormalized follower_count on profiles:** D-22 forbids this. Computed each render. Cost is negligible at <500 users.
- **Optimistic update without rollback:** Phase 8 found (CR-01 et al.) that failing Server Actions without client rollback leaves the UI wrong. D-06 explicitly requires rollback on error (see Pattern 2).
- **Forgetting `stopPropagation` on inline follow buttons in list rows:** the row `<Link>` will navigate before the Follow action runs, causing a race where the next page loads with stale follower state.
- **Computing Common Ground on the client with fetched foreign data:** Anti-Pattern 9 in PITFALLS.md. D-03 says server-side only. Only the `TasteOverlapResult` (not raw collections) is serialized to the client.
- **Matching shared watches on `watch.id`:** Anti-Pattern 3 in PITFALLS.md. Each user's entries are independent UUIDs. Normalize `(brand, model)` pairs.
- **Revalidating the wrong path in follow action:** Phase 8 WR-07 found that `revalidatePath('/u/[username]/notes', 'page')` silently no-ops because the actual compiled route template is `/u/[username]/[tab]`. Follow actions must use `revalidatePath('/u/[username]', 'layout')` — which invalidates all tab pages beneath it.
- **Rendering Common Ground on own profile:** D-04 forbids. The `isOwner` check in the layout must gate both the hero band and the ProfileTabs 6th-tab prop.
- **Using `router.refresh()` inside a Server Action:** `refresh()` from `next/cache` works in Server Actions but the existing codebase pattern (Phase 8) uses `router.refresh()` from `useRouter()` in the Client Component after awaiting the action. D-06 locks this. Do not mix.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Follower count maintenance | Triggers to increment/decrement `profiles.follower_count` | `SELECT count(*) FROM follows WHERE following_id = $id` via existing `getFollowerCounts()` DAL | Trigger-based counts drift under concurrent writes; count() is O(n) but `follows_following_idx` makes it ~1ms at scale. D-22 locks this. |
| Server-side similarity | New ad-hoc scoring function | Reuse `analyzeSimilarity()` + `GOAL_THRESHOLDS` from `src/lib/similarity.ts` in a new `src/lib/tasteOverlap.ts` wrapper | Single source of truth for similarity weights. If we re-tune scoring later, Common Ground labels track automatically. |
| Taste-tag computation for the viewer | Re-derive tags from watches every render | Reuse `computeTasteTags()` from `src/lib/tasteTags.ts` | Already unit-tested (`tests/lib/tasteTags.test.ts`). Phase 8 layout already computes these for the profile owner; Phase 9 just needs to do the same for the viewer. |
| Style / Role distribution for Common Ground side-by-side | New distribution calculator | Reuse `styleDistribution()` / `roleDistribution()` from `src/lib/stats.ts` and zip into `{ label, viewerPct, ownerPct }` rows | Already handles empty collections and 0-division. |
| Follow button loading/optimistic state machine | Custom hook | Use `useState` + `useTransition` (matches `PrivacyToggleRow` / `ProfileEditForm` precedent) | Consistent with codebase; no new abstraction. |
| Avatar | Custom image component | Reuse `AvatarDisplay` with size=64 for list rows | Already handles null avatars with initial fallback. |
| Absolute path revalidation after follow | Hard-coded paths per user | `revalidatePath('/u/[username]', 'layout')` — matches route template | Phase 8 WR-07 precedent: path revalidation uses the literal template string including brackets when dynamic segments are involved. |
| Watch count and wishlist count in follower rows | Extra N DAL calls per follower | Single JOIN that aggregates `COUNT(CASE WHEN status='owned'...)` + `COUNT(CASE WHEN status IN ('wishlist','grail')...)` grouped by user | Avoids N+1 (PITFALLS.md Pitfall 5). Drizzle's `sql` tagged template + `groupBy` handles this. |

**Key insight:** Phase 9 is composition, not construction. Nearly every UI primitive, DAL, and styling pattern is already in place. Writing new code should be the exception.

---

## Runtime State Inventory

> Phase 9 is additive — no renames, no migrations, no in-place refactors. Still, verify that the existing Phase 7/8 artifacts are consistent with Phase 9 usage.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 7 already shipped the `follows` table with `(follower_id, following_id)` unique constraint and RLS. No new rows to seed. | None |
| Live service config | None — no external services (no CDN, no Realtime channels, no edge config) | None |
| OS-registered state | None | None |
| Secrets/env vars | None — reuses existing `DATABASE_URL` + Supabase Auth env vars | None |
| Build artifacts | Drizzle migrations directory (`drizzle/`) contains 0000-0002; Supabase migrations (`supabase/migrations/`) go through `20260421000000_profile_username_lower_unique.sql`. Phase 9 adds **zero** new migrations (no new table, no new column, all policies already exist). | Verify no drift — `npx drizzle-kit check` before/after planning (local-only, per MEMORY.md) |

**Nothing found in category:** verified by direct inspection of `src/db/schema.ts`, `supabase/migrations/`, and CONTEXT.md which explicitly states "`follows` table (Phase 7) — schema + unique pair constraint + cascade deletes. No schema change in Phase 9."

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* → N/A for this additive phase. If any Phase 7 RLS policies on `follows` were missing (see Open Questions #1), they would need to be added via a new Supabase migration, but CONTEXT.md's D-21 suggests they already exist.

---

## Common Pitfalls

### Pitfall 1: `follows.update_own` policy exists but UPDATE is never used

**What goes wrong:** Phase 7's RLS migration added `follows_update_own` (USING/WITH CHECK follower_id = auth.uid()). The policy is harmless but obscures intent — FollowUser is INSERT-or-nothing, UnfollowUser is DELETE. Someone reading the policies later may assume UPDATE is a supported operation and build features around a `follows.status` column that was never planned.

**Why it happens:** Phase 7 followed a mechanical "full CRUD coverage" convention.

**How to avoid:** Document in PLAN.md that `follows.update_own` is intentionally unused and flag the row as reserved for a future follow-request workflow (out-of-scope per CONTEXT.md Deferred). No action needed this phase.

**Warning signs:** A new contributor adds a `status` column to `follows` and writes Server Action logic that does `UPDATE follows SET status = 'pending'` without a schema migration.

### Pitfall 2: Shared-watch intersection breaks on whitespace/case variants

**What goes wrong:** User A's collection has a watch "Rolex Submariner" (note: trailing space or mixed case). User B's has "rolex submariner". Raw `=` equality misses the intersection and Common Ground says 0 shared watches.

**Why it happens:** Watches are free-text entered by users (there's no canonical watch DB per STATE.md "No watch linking" decision). No normalization at insert time.

**How to avoid:** Normalize both sides with `.trim().toLowerCase()` before forming the intersection key. CONTEXT.md D-01 locks this: "normalized `(brand, model)` pairs — lowercase + trim, per research Anti-Pattern 3." Include a unit test with deliberate whitespace/case mismatches.

**Warning signs:** Users with obvious shared watches (same Rolex ref) see "0 shared watches" in the hero band.

### Pitfall 3: Private profile's Follow button produces a dead-end UX

**What goes wrong:** Viewer follows a private user (D-08 auto-accepts — the follow row writes immediately). The LockedProfileState still shows the content as locked. The viewer sees "Following" but no content, and may think the follow "didn't work."

**Why it happens:** Follows are instant (Rdio model per CONTEXT.md), but privacy is per-tab, not per-relationship. There's no "friends only" visibility currently.

**How to avoid:** Copy in LockedProfileState after a successful follow should acknowledge the state — e.g., "Following. This profile stays private until they make it public." Consider showing follower/following counts even on locked profiles (Phase 8 already does this — confirm it stays correct after follow).

**Warning signs:** User reports clicking Follow on a private profile "does nothing."

### Pitfall 4: `router.refresh()` re-renders layout BUT local optimistic state is stale

**What goes wrong:** FollowButton does optimistic `setFollowerCount(c + 1)` and fires the Server Action. Server writes succeed. `router.refresh()` re-fetches the layout, which passes a new `initialFollowerCount` prop. The button's local state is now 1 ahead of the prop, so next render shows 2 when it should show 1.

**Why it happens:** `useState` initializers only run once. When the prop changes, local state doesn't.

**How to avoid:** When the `initialFollowerCount` prop changes (detected via a `useEffect` dependency), re-sync local state. Or simpler: skip local count state entirely and pass `followerCount` as a prop from the parent, counting on `router.refresh()` to re-render the parent. The tradeoff: the count visibly jumps when the server responds instead of being perfectly instantaneous. Given D-05 ("count bumps instantly"), local state is needed but must re-sync on prop change. React 19 pattern: `key={initialFollowerCount}` on the button component is brute-force but works.

**Warning signs:** Double-click Follow/Unfollow rapidly and see the count drift by 1 or more from truth.

### Pitfall 5: `PrivateTabState` Lock icon import / pluralization regression

**What goes wrong:** Phase 9 updates `PrivateTabState` to take `displayName` / `username` props. Accidentally typing `lock` lowercase, importing from wrong source, or hardcoding the tab label breaks the existing Phase 8 fallback for the 5 tabs already gated.

**Why it happens:** The locked-tab rendering is load-bearing for PRIV-02/03/04 (Phase 8) AND for D-18 (Phase 9). A Phase 9 regression affects Phase 8 success criteria.

**How to avoid:** Add a component test for `PrivateTabState` that renders each of the 6 tab ids (`collection`, `wishlist`, `worn`, `notes`, `stats`, `common-ground`) and confirms the copy and Lock icon. Handle pluralization explicitly (`worn` → "worn history", others → "{tab}").

**Warning signs:** Smoke test shows "This stats is private" (ungrammatical) — the Phase 8 PrivateTabState copy used "This {tab} is private." which is borderline; Phase 9 changes it to include the display name, raising the cost of bad copy.

### Pitfall 6: Follower list card Link overlay blocks focus / screen-reader order

**What goes wrong:** The absolute `<Link>` overlay used to make the whole FollowRow clickable intercepts keyboard focus and screen reader traversal. Screen reader users hear "View username's profile, link" followed by silent content children, missing the name and follow button.

**Why it happens:** Absolute positioning removes the Link from flow but it still captures all click and focus events first.

**How to avoid:** Use `aria-label` on the overlay Link that mentions who it navigates to. Ensure the Follow button has its own unambiguous `aria-label` (e.g., "Follow {displayName}" / "Unfollow {displayName}"). Set `tabIndex={-1}` on the overlay only if keyboard users get the Follow button via the normal focus order — then skip a dedicated row-navigation keyboard affordance (keyboard users can tab into the button row and use the username link inside the card body for navigation).

Alternative: build the row as `<article>` with a regular `<Link>` on the name, no overlay. Click-the-whole-card becomes mouse-only. Simpler, more accessible, consistent with Letterboxd's card pattern.

**Warning signs:** VoiceOver skips the row body entirely and reads only "View username's profile".

### Pitfall 7: Follower list page fetches N+1 watch counts

**What goes wrong:** `getFollowersForProfile(userId)` returns N follower IDs. The page component then calls `getWatchCount(followerId)` for each → N+1 queries.

**Why it happens:** The "get users, then annotate each" pattern is natural.

**How to avoid:** Write a single query that JOINs profiles + profile_settings + watches (with aggregation) + follows. Drizzle supports this via `db.select().from(follows).innerJoin(profiles, ...)` with a subquery for counts. Document the SQL shape in PLAN.md and verify with EXPLAIN ANALYZE. CONTEXT.md flags this as planner's discretion.

**Warning signs:** `getFollowersForProfile` contains a `for (const id of followerIds) await getWatchCount(id)` loop.

### Pitfall 8: Private profile visitors unable to see Common Ground

**What goes wrong:** User A (private profile) has 3 shared watches with viewer B. Viewer B visits `/u/A/...`. Layout hits the `if (!isOwner && !settings.profilePublic)` branch and renders `LockedProfileState` — but the Common Ground hero band (which would live between ProfileHeader and ProfileTabs) never renders. Viewer B gets a dead-end.

**Why it happens:** The locked-profile branch in `layout.tsx` returns early before any child content renders.

**How to avoid:** Clarify with product: should Common Ground render on locked private profiles? **CONTEXT.md's LockedProfileState copy ("This profile is private.") + D-02 hero band location between ProfileHeader and ProfileTabs** suggest Common Ground should NOT render when the profile itself is locked (no ProfileTabs render either). This aligns with D-17 ("hidden on locked private profiles"). Answer: Common Ground hero is part of the "profile open" path only. Locked profile view is unchanged from Phase 8 except for wiring its Follow button to the live Server Action.

**Warning signs:** A private profile with shared tastes doesn't show a taste hook to drive the follow decision — which is exactly the UX problem Common Ground hopes to solve. (Noted as a possible follow-up after Phase 10.)

---

## Code Examples

Verified patterns from existing codebase. All file paths absolute.

### Reading Profile Settings (existing — reuse)

```typescript
// src/data/profiles.ts (existing)
export async function getProfileSettings(userId: string): Promise<ProfileSettings> {
  const rows = await db
    .select()
    .from(profileSettings)
    .where(eq(profileSettings.userId, userId))
    .limit(1)
  if (rows[0]) {
    return {
      userId: rows[0].userId,
      profilePublic: rows[0].profilePublic,
      collectionPublic: rows[0].collectionPublic,
      wishlistPublic: rows[0].wishlistPublic,
      wornPublic: rows[0].wornPublic,
    }
  }
  return { userId, ...DEFAULT_SETTINGS }  // all-public defaults
}
```
[VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/data/profiles.ts:57-73`]

### Existing Follow-Count DAL (reuse)

```typescript
// src/data/profiles.ts (existing)
export async function getFollowerCounts(
  userId: string
): Promise<{ followers: number; following: number }> {
  const [fr, fg] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ])
  return { followers: fr[0]?.count ?? 0, following: fg[0]?.count ?? 0 }
}
```
[VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/data/profiles.ts:75-89`]

### Follow DAL (new — pattern to build)

```typescript
// src/data/follows.ts (NEW)
import 'server-only'
import { db } from '@/db'
import { follows } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

/** Idempotent follow — duplicate pair is a no-op (unique constraint). */
export async function followUser(followerId: string, followingId: string) {
  await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing()
}

export async function unfollowUser(followerId: string, followingId: string) {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1)
  return rows.length > 0
}
```

**Pattern:** mirrors `src/data/wearEvents.ts:7-17` (`logWearEvent` uses `onConflictDoNothing`).

### Existing RLS Policy Set on follows (verified — reuse)

```sql
-- From supabase/migrations/20260420000001_social_tables_rls.sql
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select_all ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = (SELECT auth.uid()));
CREATE POLICY follows_update_own ON public.follows FOR UPDATE TO authenticated
  USING (follower_id = (SELECT auth.uid())) WITH CHECK (follower_id = (SELECT auth.uid()));
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated
  USING (follower_id = (SELECT auth.uid()));
```
[VERIFIED: `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260420000001_social_tables_rls.sql:15-20`]

**Critical detail:** `SELECT TO authenticated USING (true)` — unauthenticated visitors cannot read `follows` rows via the anon key. This is consistent with D-21 ("anyone can read the graph") for *logged-in* visitors. Unauth visitors can still see the counts because the Drizzle DAL connection bypasses RLS (service-role via `DATABASE_URL`) — `getFollowerCounts()` works regardless of caller auth state.

### Optimistic Toggle Precedent

```typescript
// src/components/profile/NoteVisibilityPill.tsx (existing pattern)
const [optimisticPublic, setOptimistic] = useOptimistic(initialIsPublic)
const [pending, startTransition] = useTransition()

function handleClick() {
  if (disabled) return
  const next = !optimisticPublic
  startTransition(async () => {
    setOptimistic(next)
    const result = await updateNoteVisibility({ watchId, isPublic: next })
    if (!result.success) {
      console.error('[NoteVisibilityPill] save failed:', result.error)
    }
  })
}
```
[VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/components/profile/NoteVisibilityPill.tsx:28-47`]

**For Phase 9 Follow button:** use `useState` + `useTransition` + `router.refresh()` instead (see Pattern 2). `useOptimistic` doesn't compose well with the separate `followerCount` state and the existing codebase uses local `useState` for anything compound (see `ProfileEditForm.tsx`).

### Existing PrivateTabState (to be extended)

```typescript
// src/app/u/[username]/[tab]/page.tsx (existing — will change)
function PrivateTabState({ tab }: { tab: Tab }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <p className="text-sm text-muted-foreground">This {tab} is private.</p>
    </section>
  )
}
```
[VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/app/u/[username]/[tab]/page.tsx:175-181`]

### `router.refresh()` After Mutation (existing pattern)

```typescript
// src/components/watch/WatchDetail.tsx — existing pattern
const router = useRouter()
// ...
const result = await editWatch(...)
if (result.success) {
  router.refresh()
}
```
[VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/components/watch/WatchDetail.tsx:80`]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useRouter()` from `next/router` (pages dir) | `useRouter()` from `next/navigation` (App Router) | Next.js 13 | Codebase already migrated; don't import from `next/router`. |
| `router.refresh()` as the only mutation-side fresh-data mechanism | Also available: `refresh()` from `next/cache` (Server Action side) | Next.js 16 | D-06 locks client-side `router.refresh()` — matches existing code. Noted for awareness; don't use both. |
| `params` as plain object | `params` as `Promise` — `await params` (server) or `use(params)` (client) | Next.js 15 → 16 | Existing routes already follow this; new routes MUST use `await params`. |
| `revalidatePath('/u/foo', 'page')` for literal paths | Same API — works for both literal and dynamic template strings when matching | Next.js 15 | Phase 8 WR-07 found that `revalidatePath('/u/[username]/notes', 'page')` silently no-ops (bad template match). Correct form: `revalidatePath('/u/[username]', 'layout')`. Carry this forward to Phase 9. |
| `useOptimistic` in React 18 canary | Stable in React 19 | React 19.0 | Available; used in codebase for single-value toggles. Don't use for compound state (Pattern 2). |
| Raw `fetch()` in server components for foreign-user data | Direct DAL with explicit privacy gates | Phase 8 D-15 | Phase 9 extends — same pattern applies to `getFollowersForProfile` etc. |

**Deprecated/outdated (avoid):**

- Importing from `next/router` instead of `next/navigation`.
- Writing RLS policies with bare `auth.uid()` (Phase 6 used `(SELECT auth.uid())` — keep the wrapper for any new policy).
- Client-side fetch of foreign user data for Common Ground (PITFALLS.md Anti-Pattern 9 + D-03).
- OFFSET pagination for lists (PITFALLS.md Pitfall 6) — not relevant to Phase 9 since D-13 locks "no pagination at MVP", but if needed in future, keyset only.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/lib/similarity.ts` has no `'use client'` directive and uses no browser APIs (pure function, server-safe) | Standard Stack + Pattern 4 | [VERIFIED by reading the file — no assumption; this is a verified claim] — but naming as precaution since tests haven't executed it in a Node-only context yet. |
| A2 | The threshold values `>= 0.55 → Strong`, `>= 0.30 → Some` in example `tasteOverlap` are defensible | Pattern 4 | [ASSUMED] — planner must calibrate against `GOAL_THRESHOLDS` and document in PLAN.md. Too loose = "Strong overlap" loses signal; too strict = most users see "Different taste". |
| A3 | `follows.update_own` RLS policy is a harmless dead code path | Pitfall 1 | [VERIFIED from migration file] — policy exists; UPDATE is not called by any new or existing Server Action. |
| A4 | `AvatarDisplay` size=64 is legible for follower list rows | Pattern 6 | [ASSUMED] — component supports 64/96 (`'size-16 size-24'`). 64 is the precedent ("existing sm variant per D-05" per Phase 8 CONTEXT) — safe. |
| A5 | Drizzle service-role connection bypasses RLS in this app | Common Pitfalls + Pitfall 1 intro | [VERIFIED] — `supabase/migrations/20260420000000_rls_existing_tables.sql:6-8` explicitly documents: "Drizzle DATABASE_URL (service role) bypasses RLS by design (D-01)." |
| A6 | Common Ground hero band has enough space to fit between ProfileHeader and ProfileTabs without shifting layout ratios | D-02 | [ASSUMED] — mobile specifically may push the hero + stat strip into 2 lines. Planner will need to size-test during UI build. |
| A7 | Viewers with empty collections (0 owned watches) still want to see Common Ground | D-05 | [LOCKED per CONTEXT.md D-05] — not assumed, locked. Included here for completeness. |
| A8 | Performance of `getFollowersForProfile` with a JOIN + aggregation subquery is sub-10ms at <500 users | Don't Hand-Roll | [ASSUMED] — at target scale this is trivially fast. Become concerned at 5k+ followers per user, which is well beyond MVP. |
| A9 | `revalidatePath('/u/[username]', 'layout')` invalidates ALL `/u/*/..*` paths including `/followers`, `/following`, `/common-ground`, and all tabs | Pattern 3 | [VERIFIED from Next.js 16 docs at `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md:38-40`] — "Layouts: invalidates the layout, all nested layouts beneath it, and all pages beneath them." |
| A10 | Taste-tag computation (`computeTasteTags`) produces stable output across re-renders with the same input | Pattern 4 | [VERIFIED from `tests/lib/tasteTags.test.ts` — pure function with array inputs, no side effects, deterministic ordering per the evaluation rules in the source file.] |

**If this table has entries:** A2 and A6 need either calibration work (planner) or UI sizing (implementation). A7 isn't actually an assumption — it's a locked decision; listed for completeness. The rest are verified.

---

## Open Questions

1. **Are `follows_insert_own`, `follows_delete_own` policies already applied to the production database?**
   - What we know: the migration file `supabase/migrations/20260420000001_social_tables_rls.sql` defines them correctly, and STATE.md shows Phase 7 complete with all plans checked off.
   - What's unclear: whether `supabase db push --linked` was run after the last Phase 7/8 migration ships. MEMORY.md flags that drizzle-kit push is LOCAL ONLY; prod needs explicit push.
   - Recommendation: Planner adds a verification task ("confirm `supabase migration list --linked` shows the RLS migration applied") before shipping Phase 9 UI. Claude's discretion; easily done.

2. **Should the Common Ground overlap label use 3 tiers or more?**
   - What we know: CONTEXT.md D-01 says three phrases ("Strong overlap" / "Some overlap" / "Different taste").
   - What's unclear: whether "Some overlap" at the boundary (e.g., 0.31) feels too generous. Might want a 4th tier like "Getting warmer" to smooth transitions.
   - Recommendation: ship 3-tier. Iterate once real user data exists. Locked for Phase 9.

3. **When Follower/Following list row's Follow button fires, does the follower count on the row header refresh?**
   - What we know: follower list pages show the list of follower records, not the profile's own follower count header.
   - What's unclear: if User A is on `/u/A/followers` and clicks Follow on row X, the Profile's follower count (in ProfileHeader at top) should stay the same (following X doesn't affect A's own follower count — it affects X's and A's own following count). So this is a non-issue. Noted to make sure planners don't over-wire this.
   - Recommendation: no-op. `router.refresh()` will reconcile everything.

4. **Does the Common Ground tab id `common-ground` collide with any existing or future tab segment?**
   - What we know: current VALID_TABS is `['collection', 'wishlist', 'worn', 'notes', 'stats']`. No collision.
   - What's unclear: Phase 10's activity feed might want a "Feed" or "Activity" tab on a collector profile — not currently planned but worth confirming with PRODUCT-BRIEF if unclear later.
   - Recommendation: proceed with `common-ground` as the URL segment. URL is human-readable and stable.

5. **Taste-tag computation for the VIEWER must run in layout.tsx on every render — is that acceptable cost?**
   - What we know: `computeTasteTags()` is a pure function over an already-loaded watches array. The viewer's watches load from DAL anyway. Additional call is O(n) where n is <500.
   - What's unclear: whether the layout can be cached with `use cache` in Next.js 16 (see Revalidating docs). For a personalized view (viewer-specific), cache is tricky.
   - Recommendation: no caching. Personal data + low cost = direct compute. If profile renders become slow later, add React `cache()` memoization inside a single request's render tree.

---

## Environment Availability

> Phase 9 is pure code/config — no new tools, binaries, or CLIs needed. Everything depends on what Phase 7 already provisioned (Supabase connection, Drizzle, Vitest).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build + dev server | ✓ (implied by shipping Phase 8) | — | — |
| npm | package install | ✓ | — | — |
| `DATABASE_URL` env | Drizzle DAL | ✓ (Phase 7/8 shipped) | — | — |
| `NEXT_PUBLIC_SUPABASE_URL` / anon / service env | Supabase SSR client | ✓ | — | — |
| Supabase CLI (for prod migrations) | Only needed IF new migrations land | ✓ (per MEMORY.md workflow) | — | N/A — no migrations this phase |
| Vitest runtime | Unit tests on `tasteOverlap.ts` | ✓ | 2.1.9 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Step 2.6 result: phase has no new external dependencies beyond what's already wired.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25.0.1 |
| Config file | `vitest.config.ts` (root) [VERIFIED: read] |
| Quick run command | `npm run test -- tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts` (scoped) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOLL-01 | Follow Server Action writes row, rejects self-follow, idempotent | unit + integration | `npm run test -- tests/data/follows.test.ts` | ❌ Wave 0 |
| FOLL-01 | FollowButton optimistic state: clicks, rollback on error, count bumps | unit (RTL) | `npm run test -- tests/components/profile/FollowButton.test.tsx` | ❌ Wave 0 |
| FOLL-02 | Unfollow Server Action deletes row, idempotent (no-op if not following) | unit | `npm run test -- tests/data/follows.test.ts` | ❌ Wave 0 |
| FOLL-03 | `getFollowerCounts` returns correct counts after follow/unfollow | integration | `npm run test -- tests/data/follows.test.ts` | ❌ Wave 0 |
| FOLL-04 | `getFollowersForProfile` returns joined profiles + settings + watch counts | integration | `npm run test -- tests/data/follows.test.ts` | ❌ Wave 0 |
| PROF-08 | Per-tab privacy gates honor settings; locked card copy includes displayName | unit (RTL) on `PrivateTabState` | `npm run test -- tests/components/profile/PrivateTabState.test.tsx` | ❌ Wave 0 |
| PROF-08 | Owner-only UI hidden on non-owner view (Add Watch card, Log Wear, inline edit, notes pill) | manual | Human UAT per Phase 8 precedent | n/a |
| PROF-09 | `computeTasteOverlap` returns correct intersection + label for known inputs | unit | `npm run test -- tests/lib/tasteOverlap.test.ts` | ❌ Wave 0 |
| PROF-09 | `tasteOverlap` handles whitespace/case mismatch on brand+model (Pitfall 2) | unit | `npm run test -- tests/lib/tasteOverlap.test.ts` | ❌ Wave 0 |
| PROF-09 | Empty-viewer-collection behavior: returns tag intersection and "No overlap yet" framing (D-05) | unit | `npm run test -- tests/lib/tasteOverlap.test.ts` | ❌ Wave 0 |
| Success Criterion #5 | Count refreshes without full page reload | manual | Human UAT: click Follow, verify count changes without hard reload | n/a |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts tests/components/profile/FollowButton.test.tsx tests/components/profile/PrivateTabState.test.tsx`
- **Per wave merge:** `npm run test` (full suite — fast, <10s at current scope)
- **Phase gate:** Full suite green + Human UAT on live `/u/{other-user}/...` before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/lib/tasteOverlap.test.ts` — covers PROF-09 intersection, label thresholds, whitespace/case handling, empty-viewer cases.
- [ ] `tests/data/follows.test.ts` — covers FOLL-01/FOLL-02/FOLL-03/FOLL-04 DAL behaviors and Server Action edge cases (self-follow, unauth, duplicate).
- [ ] `tests/components/profile/FollowButton.test.tsx` — RTL test for optimistic state, rollback on Server Action failure, count bump direction.
- [ ] `tests/components/profile/PrivateTabState.test.tsx` — asserts display-name-aware copy for all 6 tab ids (5 existing + `common-ground`).
- [ ] `tests/app/actions/follows.test.ts` (optional, integration-style with fixture) — to exercise the `ActionResult` boundary; Phase 8 skipped integration tests for similar actions, so this is planner's discretion.

Existing test infrastructure (vitest config, setup.ts, shims/server-only) fully covers these additions — no framework work needed.

---

## Security Domain

`security_enforcement` is enabled (no explicit `false` in config). Phase 9 introduces new authorization surfaces (follow / unfollow) and new cross-user read paths (follower lists, Common Ground). Security review is in scope.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuses Supabase Auth + `getCurrentUser()`; no new auth surface. Server Actions MUST call `getCurrentUser()` on entry. |
| V3 Session Management | yes | Existing `@supabase/ssr` session cookie refresh via `src/proxy.ts`; no new session logic. |
| V4 Access Control | yes | Two-layer enforcement (D-20): RLS on `follows` (+ existing RLS on `watches`, `wear_events`, `profile_settings`) AND DAL-layer checks for cross-user reads. Follow writes are RLS-protected via `follower_id = (SELECT auth.uid())`. |
| V5 Input Validation | yes | Zod `.strict()` on Server Action input; `z.string().uuid()` on `targetUserId`; reject self-follow (`user.id === target`). Follows existing pattern in `src/app/actions/notes.ts`, `src/app/actions/profile.ts`. |
| V6 Cryptography | no | No new crypto surface. |
| V10 Malicious Code | yes | No new user-generated content surface this phase. Taste-tag strings are deterministic / computed. Bio already sanitized in Phase 8. |
| V13 API & Web Service | yes | Server Actions are HTTP POST under the hood (per Next.js 16 docs) — directly accessible outside the UI. Must verify auth on every action (existing pattern). |

### Known Threat Patterns for Next.js 16 + Supabase social-graph

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on follow: craft Server Action payload to follow on behalf of another user | Spoofing / Tampering | `follower_id = auth.uid()` derived from session, NEVER from client input. Phase 9 Server Action extracts `user.id` from `getCurrentUser()`, ignores any client-supplied `followerId`. RLS `WITH CHECK (follower_id = (SELECT auth.uid()))` is belt-and-suspenders. |
| IDOR on unfollow: delete another user's follow | Tampering | Same as above — DELETE scoped to `WHERE follower_id = user.id AND following_id = target`. |
| Self-follow exploited for display tricks (e.g., "99 followers" when 98 are self-edges) | Repudiation / Tampering | Reject `followerId === followingId` in the Server Action (D-10). The current Phase 7 RLS `WITH CHECK (follower_id = (SELECT auth.uid()))` does NOT block self-follows — the user's own id DOES match. Must enforce at app layer. |
| Duplicate-row flooding (race condition in rapid Follow clicks) | DoS | `follows_unique_pair` UNIQUE constraint + `onConflictDoNothing()` → race-safe, no throw. |
| Enumeration of private usernames via `/u/[username]` 404 vs. 200 responses | Information disclosure | Phase 8 D-14 Letterboxd pattern: "identical 404 whether profile is missing or private + non-owner" — commented in `layout.tsx:30-32`. Phase 9 must preserve: `getProfileByUsername(name) → null` and `isPrivate + !isOwner → LockedProfileState` share the same visible surface (404 for missing — same status code for both is out of scope at route level but locked-state for private is visibly different; low-severity vs. the broader UX win. Acceptable risk, documented.) |
| Leaking private watch data via Common Ground | Information disclosure | Only compute Common Ground when viewer is authenticated. Only use PUBLIC watches (i.e., watches where the owner's `collection_public` is true) from the owner. **Important:** CONTEXT.md D-01 says "watches both collectors own" — if owner's collection is private, the intersection can STILL be presented at aggregate (e.g., "3 shared brands" not "3 shared watches with images"), OR Common Ground is suppressed entirely when `!collection_public`. Planner must decide; recommendation: **suppress Common Ground when owner's collection is private** (minimizes leak surface, simpler impl). If owner's collection is public, proceed normally. |
| Follower list reveals private profile membership | Information disclosure | Followers/Following are public (D-21: "SELECT anyone can read"). This is by product design. No change. |
| SSRF via `avatarUrl` in follower list | SSRF | Existing `getSafeImageUrl()` utility (used by AvatarDisplay) — no change needed. |
| Cross-user UPDATE on watches via race with follow | Tampering | Not possible — watches UPDATE RLS has `WITH CHECK (user_id = auth.uid())`; no follow-based escalation. |

**Concrete Security Checklist for Planner:**

- [ ] `followUser({ userId })` Server Action: Zod `.strict()` schema with `z.string().uuid()`, `getCurrentUser()` gate, reject `user.id === userId`, use `onConflictDoNothing()`, `revalidatePath('/u/[username]', 'layout')`.
- [ ] `unfollowUser({ userId })`: same pattern, DELETE with `WHERE follower_id = user.id`.
- [ ] `getFollowersForProfile(userId)` / `getFollowingForProfile(userId)`: no authorization gate needed (graph is public per D-21), but the JOIN must respect `profile_public` if applicable? **Check:** CONTEXT.md D-21 says "lists obey profile_public gate at the DAL layer — not RLS — since listing another user's followers is not private data." Wait — that contradicts itself. Re-reading: "SELECT: anyone can read the graph (counts are public, lists obey profile_public gate at the DAL layer — not RLS — since listing another user's followers is not private data)." Grammar is ambiguous. Best reading: the list returns profile data, and each returned profile must be rendered per its own `profile_public` setting. Planner should decide: **if profile X is private, still show X's username in Y's follower list?** Recommendation: yes, show username+avatar only (no bio / no watch counts) for private profiles in the list — Letterboxd's pattern. Flag for explicit planner decision.
- [ ] `computeTasteOverlap(viewer, owner)`: verify that when `owner.collection_public` is false, the function returns a fully suppressed result (no shared watches, label = null or a muted "Common Ground hidden — collection private"). Or — suppress the feature entirely at the layout level when `!settings.collectionPublic`. Planner chooses; recommendation: layout-level suppression (simpler).
- [ ] FollowButton Client Component: never trusts initial state for the authorization decision — the Server Action re-checks.
- [ ] `/u/[username]/followers` and `/following` page: do NOT show viewer's own FollowButton on rows where `targetUserId === viewer.id` (D-12: "hidden on your own row"). This is a UX gate, not a security one, but mentioning here to avoid defect.

---

## Sources

### Primary (HIGH confidence)

- **Existing codebase** (primary source of truth for this integration phase):
  - `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts` — follows, profiles, profile_settings, watches, user_preferences tables [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/data/profiles.ts` — existing getProfileByUsername, getProfileSettings, getFollowerCounts, updateProfileFields [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/data/watches.ts` — getWatchesByUser pattern [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/data/wearEvents.ts` — getPublicWearEventsForViewer DAL visibility-gate pattern [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/app/u/[username]/layout.tsx` — owner-aware profile layout, LockedProfileState branch [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/app/u/[username]/[tab]/page.tsx` — per-tab privacy gates, PrivateTabState [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/components/profile/LockedProfileState.tsx` — Follow button placeholder [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/components/profile/ProfileTabs.tsx` — URL-driven tab active state [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/components/profile/NoteVisibilityPill.tsx` — useOptimistic pattern [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/components/profile/ProfileHeader.tsx` — isOwner-aware header [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/app/actions/profile.ts` — ActionResult + revalidatePath pattern [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/app/actions/notes.ts` — updateNoteVisibility with Zod + revalidatePath layout fix [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/lib/similarity.ts` — pure-function similarity engine, exports analyzeSimilarity / GOAL_THRESHOLDS / detectLoyalBrands [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/lib/tasteTags.ts` — computeTasteTags pure function [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/src/lib/stats.ts` — styleDistribution, roleDistribution, calculateDistribution [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260420000001_social_tables_rls.sql` — follows RLS policies [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260420000000_rls_existing_tables.sql` — RLS on existing tables + Drizzle bypass note [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` — test framework + server-only shim [VERIFIED]

- **Next.js 16.2.3 bundled docs** (`node_modules/next/dist/docs/`):
  - `01-app/01-getting-started/07-mutating-data.md` — Server Action pattern, refresh(), revalidatePath() [VERIFIED]
  - `01-app/01-getting-started/09-revalidating.md` — revalidateTag vs. updateTag vs. revalidatePath [VERIFIED]
  - `01-app/03-api-reference/04-functions/revalidatePath.md` — layout vs. page, dynamic segments [VERIFIED]
  - `01-app/03-api-reference/04-functions/refresh.md` — Server-Action-only refresh from next/cache [VERIFIED]

- **Phase planning artifacts:**
  - `/Users/tylerwaneka/Documents/horlo/.planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md` — all D-01 through D-22 locked decisions [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/.planning/research/ARCHITECTURE.md` — Step 8 (Collector Profile Page — Other User View), Anti-Pattern 3 [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/.planning/research/PITFALLS.md` — full pitfall list, especially #3, #8, #9 for this phase [VERIFIED]
  - `/Users/tylerwaneka/Documents/horlo/.planning/phases/08-self-profile-privacy-controls/08-REVIEW-FIX.md` — WR-01, WR-07 lessons carried forward [VERIFIED]

### Secondary (MEDIUM confidence)

- None — this phase is anchored entirely in the existing codebase and the Phase 7/8 precedents.

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries already present; versions verified from package.json; no new packages.
- Architecture: **HIGH** — routing, DAL, Server Actions, and UI patterns are all established. Phase 9 is extension work.
- Pitfalls: **HIGH** — Phase 7/8 exposed enough pitfalls that the residual risk for Phase 9 is known and catalogued.
- Common Ground label thresholds: **MEDIUM** — A2 in Assumptions Log: need planner calibration.
- Follower-list JOIN SQL: **MEDIUM** — well-understood pattern but specific Drizzle syntax left to planner (CONTEXT.md Claude's Discretion).
- Private-profile Common Ground suppression: **MEDIUM** — security-flagged in Security Domain; planner must decide layout-level vs. compute-level suppression.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable ecosystem; only Next.js minor releases would change anything load-bearing)

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

The project's CLAUDE.md and AGENTS.md enforce the following directives that the planner MUST honor:

- **Next.js 16 has breaking changes** (AGENTS.md): "APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." → This research cites the bundled docs for `refresh()`, `revalidatePath()`, and async params. Plans must do the same for any API not already in use in the codebase.
- **Tech stack locked** (CLAUDE.md): Next.js 16 App Router — continue with existing framework, no rewrites. Phase 9 is pure extension.
- **Data model stability** (CLAUDE.md): Watch and UserPreferences types are established — extend, don't break. Phase 9 does NOT touch these types; it only reads them.
- **Personal-first isolation** (CLAUDE.md): "Single-user experience and data isolation must remain correct even after multi-user auth is added." → Phase 9 explicitly extends multi-user reads (Common Ground, follower lists) but must preserve two-layer enforcement (D-20) so a future scope creep toward "shared collections" doesn't leak private data.
- **Performance target** (CLAUDE.md): "<500 watches per user; no need for complex pagination or infinite scroll in MVP." → Common Ground is O(500×500) in worst case — trivial. Follower lists are O(followers) — also trivial. D-13 locks "no pagination" in this phase.
- **GSD Workflow Enforcement** (CLAUDE.md): Before Edit/Write tools, route through a GSD command. This phase is in scope via `/gsd-plan-phase`. Planner and executor must stay inside the workflow.
- **DB Migration rules** (MEMORY.md): drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`. Phase 9 has ZERO new migrations, so this rule is a check-and-confirm rather than a blocker.

All directives above are compatible with the CONTEXT.md locked decisions. No conflict.

# Phase 56: Like UI - Research

**Researched:** 2026-05-22
**Domain:** React client island (optimistic toggle + rollback), Next.js 16 Cache Components (`'use cache'` / `cacheTag`), CSS overlay positioning, wear-page redesign
**Confidence:** HIGH — all findings verified against live codebase, official Next.js 16 docs in `node_modules/next/dist/docs/`, and prior-phase precedents

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Icon-only lucide `Heart` whose fill toggles — outline when not liked, filled when liked.
- **D-02:** Inline bare number to the right of the heart; hidden when count is zero (LIKE-04).
- **D-03:** Watch page — control inside `WatchDetail` under the brand/model title block; visible to every viewer. `WatchDetail` gains `viewerId` + initial `{ liked, count }` props.
- **D-04:** Wear page — footer action row below the photo (and below the note caption): `[reserved comment-input slot left] [like icon right]`. Phase 56 builds only the like icon; comment input is empty reserved space.
- **D-05:** Avatar + username + relative timestamp overlay the photo, top-left.
- **D-06:** Brand / model overlay the photo, bottom-left; watch thumbnail removed.
- **D-07:** Note / caption renders below the photo, above the footer action row; hidden when note is null.
- **D-08:** Overlays require a legibility scrim/gradient and MUST work on the no-photo / `watchImageUrl` fallback hero, not just on signed wear photos.
- **D-09:** Interactive for the owner too — owner can like their own watch/wear. No self-hide branch.
- **D-10:** Anon viewer on a wear page sees heart + count; click → `/login?next=<pathname>`. Watch page is auth-only so anon never reaches it.
- **Optimistic mechanism:** `useState` + `useTransition` + rollback-on-failure — NOT `useOptimistic`. `disabled={pending}` blocks double-fire.
- **Action contract (Phase 55 D-08):** `toggleLikeAction({ type, id })` → `ActionResult<{ liked: boolean; count: number }>`. UI reconciles to server-confirmed count after transition.
- **Cache contract (Phase 55 D-07):** Action already fires `revalidateTag('reactions:{type}:{id}', 'max')` + `updateTag('viewer:{userId}:reactions')` + `revalidateTag('profile:{username}', 'max')`. Phase 56 only attaches matching `cacheTag()`s on the server read — never re-touches the action.
- **Likes open to all authenticated viewers on every status including wishlist (GATE-02).**
- **DAL discriminator is `'wear'`, NOT `'wear_event'` (live code confirmed).**

### Claude's Discretion

- Exact `cacheTag()` wiring mechanism for the initial-state read (a dedicated `'use cache'`-wrapped reader vs. tagging within the page).
- Whether `LikeButton` is one shared component with a `target: { type, id }` prop (recommended) or two thin wrappers.
- Markup split for the wear-page overlay (extend `WearDetailHero`/`WearPhotoClient` with overlay children vs. a new overlay wrapper).

### Deferred Ideas (OUT OF SCOPE)

- Comment compose box + thread (CMNT-01..09, Phase 57) — Phase 56 only reserves the wear-footer slot.
- Profile-grid "X likes · Y comments" badge (DISP-01, Phase 57).
- Bell/inbox rendering of like notifications, the "X and N others" grouping, Settings opt-out (Phase 58).
- No Server Action, DAL, or migration changes.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIKE-01 | A user can like and unlike any individual watch on a collector's profile (owned/sold/grail/wishlist); the control reflects the viewer's current like state. | `LikeButton` inside `WatchDetail`; initial state from `getLikesForTarget` + `cacheTag`; `toggleLikeAction` with optimistic flip. |
| LIKE-02 | A user can like and unlike any wear post at `/wear/[wearEventId]`. | `LikeButton` in wear footer action row; anon-null guard for `getLikesForTarget`; same action. |
| LIKE-03 | Like state and count update optimistically and roll back on server failure. | `useState` + `useTransition` + rollback pattern verified in `FollowButton.tsx`; mirrored exactly. |
| LIKE-04 | The like count shows next to the control on watch detail and wear detail; hidden when zero. | `{(liked \|\| count > 0) && <span>…</span>}` pattern; reconcile to server-confirmed count. |
</phase_requirements>

---

## Summary

Phase 56 is a pure-frontend wiring phase. The backend (schema, DAL, Server Actions, cache-tag contract) is complete and verified through Phase 55. The work decomposes into three distinct sub-problems:

1. **`LikeButton` component** — a structural clone of `FollowButton.tsx` that replaces the follow/unfollow pattern with a Heart icon toggle + inline count. The optimistic mechanism, anon-bounce, rollback, and aria attributes are identical to the existing pattern; only the icon, count display, and action call differ.

2. **Server hydration wiring** — both detail pages need to call `getLikesForTarget` server-side and pass initial state as props. This read must be wrapped in a `'use cache'` scope with the two Phase-55 cache tags (`reactions:{type}:{id}` + `viewer:{userId}:reactions`) so the already-wired action invalidations actually bust the read. The `cacheComponents: true` flag is already active in `next.config.ts`.

3. **Wear-page redesign** — `WearDetailMetadata` is gutted; collector row and watch row migrate to photo overlays. The overlay CSS chain has a known blind spot: `relative` is missing from 4 of 5 photo-container callsites across `WearDetailHero.tsx` and `WearPhotoClient.tsx`. The no-photo fallback path also requires the overlay but must use `text-foreground` instead of `text-white` on the muted background.

**Primary recommendation:** Build `LikeButton` first as `src/components/shared/LikeButton.tsx` following the `FollowButton` shape, wire the watch page, then tackle the wear-page redesign as a separate wave because it has more surface area and the CSS overlay chain is the most failure-prone part.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Like toggle (optimistic state) | Browser / Client | — | `useState` + `useTransition` lives entirely in the client island |
| Like persistence (create/delete) | API / Backend | — | `toggleLikeAction` Server Action, already complete in Phase 55 |
| Initial like state hydration | Frontend Server (SSR) | — | `getLikesForTarget` called server-side in the page, passed as props to the island |
| Cache invalidation on toggle | Frontend Server (SSR) | — | `revalidateTag`/`updateTag` inside the Server Action — Phase 55, complete |
| Cache tag attachment on read | Frontend Server (SSR) | — | `cacheTag()` inside the `'use cache'`-wrapped read — Phase 56 task |
| Wear photo overlays (avatar, brand/model) | Browser / Client | Frontend Server (SSR) | Overlay markup lives in `WearPhotoClient` (client) and `WearDetailHero` (server) |
| Anon login bounce | Browser / Client | — | `router.push('/login?next=...')` on click when `viewerId === null` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-react | `^1.8.0` | `Heart` icon (outline / filled via `fill` prop) | Already a project dependency; `Heart`/`HeartOff` confirmed exported [VERIFIED: codebase] |
| next/cache | (Next.js 16.2.3) | `cacheTag`, `revalidateTag`, `updateTag` | Required for Cache Components tag wiring [VERIFIED: node_modules/next/dist/docs/] |
| react | 19.2.4 | `useState`, `useTransition` | Optimistic island pattern [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn()` from `@/lib/utils` | — | Conditional class composition | Every button className [VERIFIED: codebase] |
| `useRouter` from `next/navigation` | — | `router.push` for anon bounce | Anon click handler (mirrors FollowButton) [VERIFIED: codebase] |
| `AvatarDisplay` from `@/components/profile/AvatarDisplay` | — | Avatar in photo overlay | Already used in `WearDetailMetadata` [VERIFIED: codebase] |
| `timeAgo` from `@/lib/timeAgo` | — | Relative timestamp in photo overlay | Already used in `WearDetailMetadata` [VERIFIED: codebase] |

### No New Dependencies

No new npm packages needed. All required capabilities exist in the project.

---

## Architecture Patterns

### System Architecture Diagram

```
/watch/[id]/page.tsx (Server)
  getCurrentUser() → viewerId
  getLikesForTarget(viewerId, {type:'watch', id}) → { count, viewerHasLiked }
    └─ wrapped in 'use cache' + cacheTag('reactions:watch:{id}', 'viewer:{viewerId}:reactions')
  WatchDetail (client island)
    └─ LikeButton (client)
           click → toggleLikeAction({type:'watch', id})
                 → ActionResult<{liked, count}>
                 → revalidateTag('reactions:watch:{id}', 'max')  [already in action]
                 → updateTag('viewer:{userId}:reactions')        [already in action]
                 ← cache bust hits getLikesForTarget wrapper     [Phase 56 wires this]

/wear/[wearEventId]/page.tsx (Server)
  getCurrentUser() → viewerId (null if anon)
  getLikesForTarget(viewerId ?? SENTINEL, {type:'wear', id}) → { count, viewerHasLiked }
    └─ wrapped in 'use cache' + cacheTag('reactions:wear:{id}', 'viewer:{viewerId}:reactions')
  WearPhotoClient (client) — has overlays (top: avatar/user, bottom: brand/model)
  WearDetailMetadata (server, gutted) — note caption only
  WearFooterRow (client island, new)
    └─ [empty reserved comment slot] [LikeButton]
           click (anon) → router.push('/login?next=...')
           click (auth) → toggleLikeAction({type:'wear', id})
```

### Recommended Project Structure

```
src/
├── components/
│   ├── shared/
│   │   └── LikeButton.tsx       ← NEW: shared by watch + wear pages
│   ├── watch/
│   │   └── WatchDetail.tsx      ← EDIT: +viewerId, +initialLikeState props
│   └── wear/
│       ├── WearDetailHero.tsx   ← EDIT: +relative to 2 containers, +overlay children
│       ├── WearDetailMetadata.tsx ← RESTRUCTURE: gutted to note-only
│       ├── WearPhotoClient.tsx  ← EDIT: +relative to 2 containers, +overlay children
│       └── WearFooterRow.tsx    ← NEW: footer action row (reserved slot + LikeButton)
├── app/
│   ├── watch/[id]/page.tsx      ← EDIT: +getLikesForTarget hydration
│   └── wear/[wearEventId]/page.tsx ← EDIT: +getLikesForTarget hydration, new tree
```

### Pattern 1: LikeButton as a FollowButton structural clone

**What:** A `'use client'` button component with `useState` + `useTransition` + rollback, `viewerId: string | null`, anon bounce, `disabled={pending}`, `aria-pressed`, `aria-busy`, `aria-label`.

**When to use:** Both watch and wear detail pages. One component, `target: { type: 'watch' | 'wear'; id: string }` prop discriminates the action call.

**Example (from UI-SPEC):**
```typescript
// Source: 56-UI-SPEC.md + FollowButton.tsx template
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleLikeAction } from '@/app/actions/reactions'
import type { LikeTarget } from '@/data/reactions'

interface LikeButtonProps {
  viewerId: string | null
  target: LikeTarget   // { type: 'watch' | 'wear'; id: string }
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({ viewerId, target, initialLiked, initialCount }: LikeButtonProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (viewerId === null) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    const nextLiked = !liked
    const nextCount = nextLiked ? count + 1 : count - 1
    // Optimistic flip
    setLiked(nextLiked)
    setCount(nextCount)
    startTransition(async () => {
      const result = await toggleLikeAction({ type: target.type, id: target.id })
      if (!result.success) {
        // Rollback
        setLiked(liked)
        setCount(count)
        console.error('[LikeButton] action failed:', result.error)
        return
      }
      // Reconcile to server-confirmed values (do not trust the optimistic increment)
      setLiked(result.data.liked)
      setCount(result.data.count)
    })
  }

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-busy={pending}
      aria-label={liked ? 'Unlike' : 'Like'}
      disabled={pending}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-2 rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait',
        pending && 'opacity-50',
      )}
    >
      <Heart
        className={cn('size-5', liked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground')}
        fill={liked ? 'currentColor' : 'none'}
      />
      {(liked || count > 0) && (
        <span className={cn('text-sm tabular-nums', liked ? 'text-destructive' : 'text-muted-foreground')}>
          {count}
        </span>
      )}
    </button>
  )
}
```

### Pattern 2: `'use cache'` wrapper for `getLikesForTarget`

**What:** Wrap the server read in a thin async function marked `'use cache'`, call `cacheTag()` with both Phase-55 tags inside. The page calls this wrapper (not the raw DAL) so the tags are attached and `revalidateTag`/`updateTag` in the action find a matching entry to bust.

**Key rule from official docs:** `cacheTag()` must be called INSIDE a `'use cache'` scope. Tags can be strings derived from arguments (function ID + serialized args form the cache key automatically). [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md]

**Example:**
```typescript
// Source: 56-UI-SPEC.md + Next.js 16 cacheTag docs + project CC pattern (profile-shell-resolver.tsx)
import { cacheTag } from 'next/cache'
import { getLikesForTarget } from '@/data/reactions'
import type { LikeTarget, LikesResult } from '@/data/reactions'

/**
 * Server read for initial like state with Phase-55 cache tags attached.
 * viewerId is part of the cache key automatically (serialized as an argument).
 * Both tags match what toggleLikeAction fires:
 *   revalidateTag('reactions:{type}:{id}', 'max')  → busts cross-user count
 *   updateTag('viewer:{userId}:reactions')          → busts this viewer's liked state
 */
async function getLikesForTargetCached(
  viewerId: string,
  target: LikeTarget,
): Promise<LikesResult> {
  'use cache'
  cacheTag(`reactions:${target.type}:${target.id}`, `viewer:${viewerId}:reactions`)
  return getLikesForTarget(viewerId, target)
}
```

**Anon path:** The raw `getLikesForTarget` signature is `(viewerId: string, target)`. For the wear page where `viewerId` is `null`, pass a sentinel string (e.g., `'__anon__'`). The SQL `bool_or(userId = '__anon__')` evaluates false over all real UUID rows — `viewerHasLiked` is always false for this sentinel. [VERIFIED: src/data/reactions.ts — SQL uses `bool_or(${watchLikes.userId} = ${viewerId})`]

### Pattern 3: Overlay CSS chain (D-08)

**What:** `relative` on the photo container div + `absolute inset-x-0` overlay divs. The container's `aspect-[4/5]` and `overflow-hidden` control the size; `relative` creates the stacking context.

**From UI-SPEC (exact):**
```
outer div: relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto
top overlay:  absolute inset-x-0 top-0 z-10 pointer-events-none
bottom overlay: absolute inset-x-0 bottom-0 z-10 pointer-events-none
```

**The 4 missing `relative` callsites (UI-SPEC verified against live code):**
- `WearPhotoClient.tsx` ~L68 — `status==='failed'` + `watchImageUrl` fallback: MISSING
- `WearPhotoClient.tsx` ~L81 — `status==='failed'` + no-photo fallback: MISSING
- `WearDetailHero.tsx` ~L33 — `watchImageUrl` path: MISSING
- `WearDetailHero.tsx` ~L46 — no-photo fallback: MISSING
- `WearPhotoClient.tsx` ~L94 — signed-URL happy path: ALREADY HAS `relative`

[VERIFIED: live code read of both files]

### Anti-Patterns to Avoid

- **Reading `viewerId` inside a `'use cache'` scope:** The viewerId must be passed as an explicit argument to the cached wrapper so it becomes part of the cache key. Resolving auth inside the cache scope omits the viewer identity from the key and causes cross-user liked-state leakage. [VERIFIED: profile-shell-resolver.tsx comment + `CollectorsLikeYou.tsx` Pitfall 7]
- **Calling `cookies()` or `headers()` inside `'use cache'`:** Next.js 16 throws immediately. Auth must be resolved in the page (uncached scope) and passed down. [VERIFIED: use-cache.md "Request-time APIs" constraint]
- **Using `'wear_event'` as the discriminator string:** The live DAL/action uses `'wear'`. Using `'wear_event'` causes Zod `.strict()` rejection (`z.enum(['watch', 'wear'])`). [VERIFIED: src/app/actions/reactions.ts:23, src/data/reactions.ts:17]
- **Using `useOptimistic` instead of `useState + useTransition`:** The house pattern owns compound local state for clean rollback. `useOptimistic` does not support the rollback + server-reconcile-to-confirmed-count contract. [VERIFIED: 56-CONTEXT.md locked decision + FollowButton.tsx]
- **Not clearing `.next/` before validating overlay CSS:** The Turbopack dev server can serve stale CSS through a restart-only cycle. Clear `.next/` first. [VERIFIED: project memory `project_turbopack_next_cache_stale_css.md`]
- **Surfacing an error toast on idempotent re-like:** SC#4 requires that double-clicking or concurrent-tab re-likes show no error to the user. The rollback must be silent (`console.error` only). [VERIFIED: 56-CONTEXT.md SC#4 + FollowButton.tsx rollback pattern]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic state with rollback | Custom reducer / `useReducer` with undo | `useState` + `useTransition` (FollowButton pattern) | House pattern is already tested; `useTransition` provides `pending` flag for free |
| Idempotent like enforcement | Client-side duplicate detection | DB UNIQUE constraint + `onConflictDoNothing` (Phase 53/54, complete) | Race conditions, concurrent tabs — DB is the backstop |
| Cache tag invalidation on write | Manual `router.refresh()` calls | `revalidateTag`/`updateTag` in the action (already wired, Phase 55) | Already complete; Phase 56 only attaches matching read tags |
| Scrim gradient | Custom canvas overlay | Tailwind `bg-gradient-to-b` / `bg-gradient-to-t` via inline `style` or arbitrary CSS | Simple linear gradient; no need for image manipulation |

---

## Landmine Analysis

The following pre-identified landmines are all CONFIRMED against live code:

### Landmine 1: `'wear'` vs `'wear_event'` discriminator

**Confirmed live:** `src/app/actions/reactions.ts:23` has `type: z.enum(['watch', 'wear'])` with an explicit code comment "DAL discriminator — 'wear' not 'wear_event'". `src/data/reactions.ts:17` defines `LikeTarget = { type: 'watch' | 'wear'; id: string }`.

**Risk:** If any new code uses `'wear_event'`, the Zod `.strict()` parse in `toggleLikeAction` returns `{ success: false, error: 'Invalid request' }` — the action silently fails.

**Mitigation:** Always use `type: 'wear'` in the `target` prop, in the cache tag `reactions:wear:{id}`, and in any TypeScript type annotation. The TypeScript type `LikeTarget` already enforces this at compile time.

### Landmine 2: `getLikesForTarget(viewerId: string, …)` with null viewer

**Confirmed live:** `src/data/reactions.ts:29` — function signature is `(viewerId: string, target: LikeTarget)`. TypeScript strict mode would flag `null` as a type error.

**Resolution:** Pass a sentinel string `'__anon__'` for the anon wear path. The SQL `bool_or(userId = '__anon__')` returns false over all real UUID rows. The count is still correct (counts all likes, not viewer-keyed). This is the cleanest approach without changing the DAL signature.

**Alternative:** Add a guard in the page: `const effectiveViewerId = viewerId ?? '__anon__'`. The cache wrapper receives `effectiveViewerId: string` — no type errors.

### Landmine 3: Overlay CSS chain on no-photo fallback

**Confirmed live:** Both `WearDetailHero.tsx` and `WearPhotoClient.tsx` omit `relative` on the photo container at 4 callsites (L94 in `WearPhotoClient` is the only site that already has it).

**Exact class strings to change:**
- Before: `"w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"`
- After: `"relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"`

**No-photo fallback** (`WearDetailHero.tsx:46`, `WearPhotoClient.tsx:81`): currently renders `{brand} {model}` centered text. Per UI-SPEC, this centered text must be REMOVED — brand/model moves to the bottom overlay. The fallback becomes a plain `bg-muted` block. Overlay `text-color` on muted background: `text-foreground` (not `text-white`).

**Validation:** After patching, clear `.next/` cache (`rm -rf .next`) before concluding the chain works or doesn't work.

### Landmine 4: Cache Components — `'use cache'` + `cacheTag` for viewer-scoped reads

**Confirmed configuration:** `next.config.ts` has `experimental: { cacheComponents: true }` already active. [VERIFIED: live code]

**Official API (Next.js 16):** `cacheTag()` is called INSIDE the `'use cache'` scope. Multiple tags can be passed in a single call: `cacheTag('tag-a', 'tag-b')`. The function is imported from `'next/cache'`. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md]

**Viewer isolation:** Passing `viewerId` as an explicit argument to the `'use cache'` wrapper makes it part of the cache key automatically (serialized arguments → distinct cache entries per viewer). This matches the `CollectorsLikeYou` pattern where `viewerId` is an explicit prop. [VERIFIED: CollectorsLikeYou.tsx + use-cache.md "Cache keys" section]

**The `viewer:{userId}:reactions` tag:** `updateTag` (not `revalidateTag`) is used by the action for this tag (RYO semantics — immediate expiry so the next request sees fresh data). `updateTag` can only be called from Server Actions. For Phase 56, the matching `cacheTag('viewer:{userId}:reactions')` in the read wrapper is what the action's `updateTag` busts. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md + src/app/actions/reactions.ts:111]

**Do NOT add `cacheTag` to the wear page for the anon path:** When `viewerId` is null and the sentinel `'__anon__'` is passed, the `viewer:__anon__:reactions` tag is harmless (it will never be invalidated, which is correct — anon has no liked state). Tag it anyway for consistency; no correctness issue.

**Prior-phase structural rules to honor:** Auth assertion (`getCurrentUser()`) MUST stay OUTSIDE any `'use cache'` boundary. The page calls `getCurrentUser()` and passes the result into the cached wrapper as an argument. [VERIFIED: explore/page.tsx + explore/lists/page.tsx comments + profile-shell-resolver.tsx]

---

## Common Pitfalls

### Pitfall 1: Forgetting to reconcile to server-confirmed count

**What goes wrong:** The optimistic count increment/decrement may differ from the DB count if concurrent likes have happened. If the UI trusts its local increment as final, it drifts from reality.
**Why it happens:** Optimistic updates assume atomic state; DB aggregates are not.
**How to avoid:** After `startTransition` resolves success, call `setLiked(result.data.liked)` and `setCount(result.data.count)` — reconcile to the server-confirmed values, not the locally-computed ones.
**Warning signs:** Count shown in UI drifts from the count shown after a page reload.

### Pitfall 2: `relative` missing from a photo container — overlay clips to viewport

**What goes wrong:** Absolute overlays position relative to the nearest positioned ancestor. Without `relative` on the photo container, overlays escape it and render at the wrong position on the page.
**Why it happens:** The 4 fallback branches in `WearPhotoClient` and `WearDetailHero` were written before overlays were needed.
**How to avoid:** Apply `relative` to all 4 missing callsites. Do not stop after fixing the first one. Assert all 4 in the implementation checklist.
**Warning signs:** Overlays appear at the top of the page or on top of unrelated content; or they seem correctly positioned in the happy-path signed-URL branch but broken in fallback paths.

### Pitfall 3: Stale `.next/` cache hides CSS regression

**What goes wrong:** A CSS fix appears to work (or not work) because Turbopack is serving a cached version of the file.
**Why it happens:** `rm -rf .next/` is required when debugging CSS chains in Next 16 with Turbopack dev mode.
**How to avoid:** Always clear `.next/` before concluding the overlay chain is fixed.
**Warning signs:** Changing a class in source has no visible effect in the browser; changes appear stale.

### Pitfall 4: `WatchDetail` is a `'use client'` island — RSCs cannot be imported into it

**What goes wrong:** If `LikeButton` is accidentally made into an async server component, or if an RSC is imported into `WatchDetail`, compilation fails.
**Why it happens:** `WatchDetail.tsx` has `'use client'` — RSCs cannot be children (must be composed at the server tree level as siblings).
**How to avoid:** `LikeButton` must be a `'use client'` component. It is placed INSIDE `WatchDetail` which is already a client island — this is the correct pattern for D-03. [VERIFIED: watch/[id]/page.tsx — WatchDetail is a child of the server page; RSC siblings (SameFamilyRail, LineageRail) are placed at the server level, not inside WatchDetail]

### Pitfall 5: Anon bounce uses `window.location.pathname`, not `usePathname`

**What goes wrong:** `usePathname()` returns `null` outside of a router context in tests. The live `FollowButton` uses `window.location.pathname` directly in the click handler (not at render time), which works in the browser and in test stubs.
**Why it happens:** `usePathname` is a hook; calling it conditionally or in an event handler violates Rules of Hooks. `window.location.pathname` is safe inside an event handler.
**How to avoid:** Mirror `FollowButton.tsx:71` exactly — `const next = encodeURIComponent(window.location.pathname)` inside `handleClick()`.

---

## Code Examples

### Watch page hydration (src/app/watch/[id]/page.tsx addition)

```typescript
// Source: 56-CONTEXT.md + pattern from existing page Promise.all usage
// Add to the existing Promise.all or as a separate await after auth
const likeState = await getLikesForTargetCached(user.id, { type: 'watch', id })
// Pass to WatchDetail:
<WatchDetail
  ...existingProps
  viewerId={user.id}
  initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
/>
```

### Wear page hydration (anon guard)

```typescript
// Source: 56-CONTEXT.md landmine note + src/data/reactions.ts signature
const ANON_SENTINEL = '__anon__'
const likeState = await getLikesForTargetCached(
  viewerId ?? ANON_SENTINEL,
  { type: 'wear', id: wearEventId },
)
```

### Wear footer action row

```typescript
// Source: 56-UI-SPEC.md §Wear footer action row
// Sits below the photo container and the note caption
<div className="flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto">
  {/* Reserved for Phase 57 comment input */}
  <div className="flex-1 min-h-[44px]" aria-hidden />
  <LikeButton
    viewerId={viewerId}
    target={{ type: 'wear', id: wearEventId }}
    initialLiked={likeState.viewerHasLiked}
    initialCount={likeState.count}
  />
</div>
```

### Top overlay (avatar + username + timestamp)

```typescript
// Source: 56-UI-SPEC.md §Photo container CSS chain
// Placed as absolute child inside the `relative` photo container
<div
  className="absolute inset-x-0 top-0 z-10 pointer-events-none"
  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 40%)' }}
>
  <div className="flex items-center gap-2 p-3 pointer-events-auto">
    {/* avatar + username link + separator + timeAgo */}
  </div>
</div>
```

### Bottom overlay (brand / model)

```typescript
// Source: 56-UI-SPEC.md §Photo container CSS chain
<div
  className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 40%)' }}
>
  <div className="flex flex-col p-3">
    <span className="text-sm font-semibold text-white">{brand}</span>
    <span className="text-sm text-white">{model}</span>
  </div>
</div>
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 56 is a pure frontend wiring phase with no external tool, CLI, database, or service dependencies beyond the already-running development stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + React Testing Library |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- --reporter=verbose tests/components/shared/LikeButton.test.tsx` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIKE-01 | Watch page — viewer can like/unlike; state reflects immediately | unit (LikeButton) | `npm run test -- tests/components/shared/LikeButton.test.tsx` | ❌ Wave 0 |
| LIKE-01 | Watch page — anon viewer never reaches page (auth-only route) | manual check | — | N/A |
| LIKE-02 | Wear page — viewer can like/unlike; anon click bounces to `/login?next=` | unit (LikeButton) | `npm run test -- tests/components/shared/LikeButton.test.tsx` | ❌ Wave 0 |
| LIKE-03 | Optimistic flip reflects before action resolves; count shows new value | unit (LikeButton) | same | ❌ Wave 0 |
| LIKE-03 | Server Action failure → rollback to pre-click state | unit (LikeButton) | same | ❌ Wave 0 |
| LIKE-04 | Count hidden at 0 (not liked, count=0); shown when count ≥ 1 or liked | unit (LikeButton) | same | ❌ Wave 0 |
| LIKE-04 | Count reconciles to server-confirmed value (not local increment) | unit (LikeButton) | same | ❌ Wave 0 |
| SC#4 | Idempotent re-like (double-click) → no error shown; `disabled={pending}` blocks second fire | unit (LikeButton) | same | ❌ Wave 0 |
| D-08 | Overlay CSS chain — photo path: overlays visible at top and bottom | visual / manual | `rm -rf .next && npm run dev` + visual inspection | N/A |
| D-08 | Overlay CSS chain — no-photo fallback: overlays visible, no centered brand/model text | visual / manual | same | N/A |
| D-08 | All 4 `relative` callsites patched (static analysis) | structural / manual grep | `grep -n "w-full aspect-\[4/5\]" src/components/wear/WearDetailHero.tsx src/components/wear/WearPhotoClient.tsx` | N/A |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/components/shared/LikeButton.test.tsx`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/components/shared/LikeButton.test.tsx` — covers LIKE-01, LIKE-02, LIKE-03, LIKE-04, SC#4
- [ ] `src/components/shared/` directory (must be created; no existing files there)

**Precedent test file to mirror:** `tests/components/profile/FollowButton.test.tsx` — same shape: mock `toggleLikeAction` and `next/navigation`, test optimistic flip, rollback, aria attributes, anon bounce, `disabled={pending}` during transition, count hidden/shown logic.

**Manual-only checks (visual CSS):** The overlay positioning and no-photo fallback cannot be meaningfully tested in jsdom. These require a browser: clear `.next/`, `npm run dev`, visit `/wear/[real-id]`, verify both photo and no-photo paths show overlays at top and bottom edges. This is not automatable within the current test setup.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth is handled upstream (Phase 54/55 Server Actions re-verify) |
| V3 Session Management | No | No new session handling |
| V4 Access Control | No | GATE-02 (likes open to all authenticated) is complete in Phase 53/55 |
| V5 Input Validation | No | `toggleLikeAction` uses Zod `.strict()` — complete in Phase 55; UI passes `{ type, id }` only |
| V6 Cryptography | No | No new cryptographic operations |

**Security posture for Phase 56:** This is a UI wiring phase. All security controls (auth re-verification, Zod validation, IDOR prevention, RLS) are implemented in the backend phases (53–55). The only security-adjacent concern is **viewer-scoped cache isolation** (SEC-05) — handled by passing `viewerId` as an explicit argument to the `'use cache'` wrapper so the cache key is viewer-specific. No new security surface is introduced.

---

## Assumptions Log

> All claims in this research were verified against live codebase files or official Next.js 16 docs. No assumptions required.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | All claims verified or cited | — | — |

**This table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

> Resolved at plan time (Phase 56 plans, 2026-05-22): (1) `getLikesForTargetCached` lives as a
> module-level `'use cache'` export in `src/data/reactions.ts`; (2) the wear footer is inlined in
> `wear/[wearEventId]/page.tsx` (no `WearFooterRow.tsx`); (3) overlays are a shared `WearPhotoOverlays`
> sub-component exported from `WearDetailHero.tsx` and imported into `WearPhotoClient.tsx`.

1. **Where exactly should `getLikesForTargetCached` live?**
   - What we know: It must be `import 'server-only'`-safe; it calls `getLikesForTarget` from `src/data/reactions.ts` which already has `import 'server-only'`.
   - What's unclear: Co-locate it in `src/data/reactions.ts` as an additional export, or create `src/data/reactionsCache.ts`, or define it inline in each page.
   - Recommendation: Define it as a module-level function in `src/data/reactions.ts` next to `getLikesForTarget` (same file, easy to diff, no extra module). OR define it inline in each page — both are valid since `'use cache'` at function scope is allowed anywhere. Planner decides.

2. **`WearFooterRow` — client component or server-side markup?**
   - What we know: It contains `LikeButton` (client island). The footer must know `viewerId` and `likeState` (resolved by the page server-side).
   - What's unclear: Extract as `WearFooterRow.tsx` (new file) vs. inline the footer div directly in the page.
   - Recommendation: Inline the footer in the page initially (fewer files); extract to `WearFooterRow.tsx` if Phase 57 comment-input addition requires it. Planner decides.

3. **Where do the photo overlays live — in `WearDetailHero`/`WearPhotoClient` as injected children, or in a new wrapper component?**
   - What we know: Both `WearDetailHero` (server) and `WearPhotoClient` (client) need the overlays. The overlay content includes `avatarUrl`, `username`, `displayName`, `createdAt`, `brand`, `model`, `hasPhoto: boolean`.
   - Recommendation: Pass overlay content as children or as a dedicated `overlaySlot` prop to `WearPhotoClient` (already a client component) and `WearDetailHero` (server). This avoids a new wrapper and keeps the `relative` + overlay logic adjacent to the container that must be `relative`. Planner decides.

---

## Sources

### Primary (HIGH confidence)

- `src/components/profile/FollowButton.tsx` — verified optimistic pattern, anon bounce, `viewerId: string | null`
- `src/app/actions/reactions.ts` — verified `toggleLikeAction` signature, Zod `.strict()` schema, `'wear'` discriminator, `revalidateTag`/`updateTag` calls
- `src/data/reactions.ts` — verified `getLikesForTarget(viewerId: string, target)` signature, `LikeTarget` type
- `src/components/wear/WearDetailHero.tsx` — verified 2 missing `relative` callsites
- `src/components/wear/WearPhotoClient.tsx` — verified 2 missing `relative` callsites + 1 existing `relative`
- `src/components/wear/WearDetailMetadata.tsx` — verified current structure (collector row + watch row + note)
- `src/app/wear/[wearEventId]/page.tsx` — verified anon-allowed path, `viewerId: string | null`
- `src/app/watch/[id]/page.tsx` — verified auth-gated, `getCurrentUser()`, existing `Promise.all` pattern
- `src/components/watch/WatchDetail.tsx` — verified `'use client'`, title block location, `min-h-[44px]` precedent
- `next.config.ts` — verified `experimental: { cacheComponents: true }` already active
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — `cacheTag` API, usage inside `'use cache'`
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — `'use cache'` constraints, cache keys, serialization
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` — `updateTag` vs `revalidateTag` semantics, Server-Action-only constraint
- `src/app/u/[username]/profile-shell-resolver.tsx` — verified `'use cache'` + `cacheTag` + `cacheLife` pattern
- `src/components/home/CollectorsLikeYou.tsx` — verified `viewerId` as explicit prop inside `'use cache'` (Pitfall 7 cross-user isolation)
- `tests/components/profile/FollowButton.test.tsx` — verified test shape for LikeButton test precedent
- `vitest.config.ts` — verified test framework, include patterns
- `tests/setup.tsx` — verified global mocks (`next/cache`, `next/navigation`, StrictMode wrapper)
- `src/lib/actionTypes.ts` — verified `ActionResult<T>` type with optional `code` field
- `.planning/phases/56-like-ui/56-CONTEXT.md` — all locked decisions
- `.planning/phases/56-like-ui/56-UI-SPEC.md` — exact class strings, state colors, overlay spec, footer spec

### Secondary (MEDIUM confidence)

- `.planning/phases/55-server-actions-notification-dedup/55-CONTEXT.md` — D-07 cache tag contract, D-08 action return shapes (plan doc, verified against live `reactions.ts`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against live codebase and official docs
- Architecture: HIGH — all integration points read directly from source files
- Pitfalls: HIGH — landmines confirmed against live code; CSS chain pitfall has prior-codebase precedent (Phase 30)
- Cache Components pattern: HIGH — verified against Next.js 16 official docs in node_modules

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable — no fast-moving dependencies; Next.js and lucide-react versions pinned)

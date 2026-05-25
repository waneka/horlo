# Phase 56: Like UI - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/shared/LikeButton.tsx` | component (client island) | request-response + optimistic | `src/components/profile/FollowButton.tsx` | exact |
| `tests/components/shared/LikeButton.test.tsx` | test | — | `tests/components/profile/FollowButton.test.tsx` | exact |
| `src/data/reactions.ts` (add cached wrapper) | service / cache layer | request-response | `src/app/u/[username]/profile-shell-resolver.tsx` + `src/components/home/CollectorsLikeYou.tsx` | role-match |
| `src/components/watch/WatchDetail.tsx` (edit) | component (client island) | request-response | `src/components/watch/WatchDetail.tsx` (self) | self-edit |
| `src/app/watch/[id]/page.tsx` (edit) | route / server page | request-response | `src/app/watch/[id]/page.tsx` (self) | self-edit |
| `src/app/wear/[wearEventId]/page.tsx` (edit) | route / server page | request-response | `src/app/wear/[wearEventId]/page.tsx` (self) | self-edit |
| `src/components/wear/WearDetailMetadata.tsx` (restructure) | component (server) | request-response | `src/components/wear/WearDetailMetadata.tsx` (self) | self-edit |
| `src/components/wear/WearDetailHero.tsx` (edit) | component (server) | request-response | `src/components/wear/WearDetailHero.tsx` (self) | self-edit |
| `src/components/wear/WearPhotoClient.tsx` (edit) | component (client) | event-driven (retry SM) | `src/components/wear/WearPhotoClient.tsx` (self) | self-edit |

---

## Pattern Assignments

### `src/components/shared/LikeButton.tsx` (new, component, request-response + optimistic)

**Analog:** `src/components/profile/FollowButton.tsx`

**Delta from analog:** Replace follow/unfollow actions with `toggleLikeAction`. Replace text label with `Heart` icon + count span. Remove mobile two-tap branch. Remove self-guard (`viewerId === targetUserId`). Remove `useEffect` re-sync (no parent refresh cycle). Add `target: LikeTarget` prop. Add `initialCount` prop. Add count reconcile after action resolves.

**Imports pattern** (`src/components/profile/FollowButton.tsx` lines 1-7):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
```

New file adds:
```typescript
import { Heart } from 'lucide-react'
import { toggleLikeAction } from '@/app/actions/reactions'
import type { LikeTarget } from '@/data/reactions'
```

**Props interface** (modeled on `FollowButton.tsx` lines 9-20):
```typescript
interface LikeButtonProps {
  /** null for unauthenticated viewer — click routes to /login?next=... */
  viewerId: string | null
  /** { type: 'watch' | 'wear'; id: string } — discriminated by the action schema */
  target: LikeTarget
  initialLiked: boolean
  initialCount: number
}
```

**Anon bounce pattern** (`FollowButton.tsx` lines 70-74 — copy verbatim):
```typescript
if (viewerId === null) {
  const next = encodeURIComponent(window.location.pathname)
  router.push(`/login?next=${next}`)
  return
}
```

**Optimistic + startTransition + rollback core** (`FollowButton.tsx` lines 83-99, adapted):
```typescript
const [liked, setLiked] = useState(initialLiked)
const [count, setCount] = useState(initialCount)
const [pending, startTransition] = useTransition()

function handleClick() {
  // anon bounce first (see above)
  const nextLiked = !liked
  const nextCount = nextLiked ? count + 1 : count - 1
  setLiked(nextLiked)
  setCount(nextCount)
  startTransition(async () => {
    const result = await toggleLikeAction({ type: target.type, id: target.id })
    if (!result.success) {
      // Rollback — flip back to pre-click state
      setLiked(liked)
      setCount(count)
      console.error('[LikeButton] action failed:', result.error)
      return
    }
    // Reconcile to server-confirmed values (CONTEXT.md locked — do not trust optimistic increment)
    setLiked(result.data.liked)
    setCount(result.data.count)
  })
}
```

**Button element + aria attributes** (`FollowButton.tsx` lines 125-148, adapted):
```typescript
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
```

**Count hidden at zero rule (LIKE-04):** `{(liked || count > 0) && <span>…</span>}` — show the count when liked (even if count momentarily reads 0 during optimistic flip) or when count > 0.

**No `useEffect` re-sync:** Unlike `FollowButton` (lines 54-56), `LikeButton` does NOT sync `initialLiked`/`initialCount` on prop change — the cache-tag invalidation on the server read handles re-hydration on the next navigation; no parent refresh cycle drives a prop update.

---

### `tests/components/shared/LikeButton.test.tsx` (new, test)

**Analog:** `tests/components/profile/FollowButton.test.tsx`

**Mock block** (lines 9-22 — copy structure, swap module paths):
```typescript
vi.mock('@/app/actions/reactions', () => ({
  toggleLikeAction: vi.fn(),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { LikeButton } from '@/components/shared/LikeButton'
import { toggleLikeAction } from '@/app/actions/reactions'
```

**Helper setup** (modeled on `FollowButton.test.tsx` lines 27-90):
```typescript
const VIEWER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const WATCH_ID  = '11111111-2222-4333-8444-555555555555'
const WEAR_ID   = '22222222-3333-4444-8555-666666666666'

function renderButton(overrides: Partial<React.ComponentProps<typeof LikeButton>> = {}) {
  const defaults: React.ComponentProps<typeof LikeButton> = {
    viewerId: VIEWER_ID,
    target: { type: 'watch', id: WATCH_ID },
    initialLiked: false,
    initialCount: 0,
  }
  return render(<LikeButton {...defaults} {...overrides} />)
}

async function flush() {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => { vi.clearAllMocks() })
```

**Test groups to cover** (mirror `FollowButton.test.tsx` section structure):
1. Aria attributes — `aria-pressed`, `aria-busy`, `aria-label` (liked/not-liked states)
2. Optimistic + rollback — flip before action resolves; rollback on `success: false`; reconcile to `result.data.count` on success
3. Count display — hidden when `count === 0 && !liked`; shown when `liked === true` even at count 0; shown when `count > 0`
4. Anon bounce — `viewerId: null` renders the button; click calls `router.push('/login?next=...')`, does NOT call `toggleLikeAction`
5. `disabled={pending}` blocks second click while transition runs — `aria-busy=true`
6. SC#4 — action returns `success: false` on a re-like → no visible error (only `console.error`); count rolls back silently

**Global mocks already in `tests/setup.tsx`:** `next/cache` (no-op `cacheTag`, `updateTag`) and `next/navigation` (stub `useRouter`) are pre-mocked. Per-test mocks override them. The `vi.mock` block in the test file MUST appear before the component import (vitest hoists).

---

### `src/data/reactions.ts` — add `getLikesForTargetCached` (cached wrapper)

**Analogs:**
- `src/app/u/[username]/profile-shell-resolver.tsx` — `'use cache'` + `cacheTag` + `cacheLife` inside an async function
- `src/components/home/CollectorsLikeYou.tsx` — `viewerId` as explicit function arg (not resolved inside `'use cache'` scope) for per-viewer cache key isolation

**`'use cache'` directive placement** (`profile-shell-resolver.tsx` lines 28-31):
```typescript
export async function ProfileShellResolver({ username }: { username: string }) {
  'use cache'
  cacheTag(`profile:${username}`)
  cacheLife({ revalidate: 300 })
  // ...
}
```

**Viewer isolation via explicit arg** (`CollectorsLikeYou.tsx` lines 23-27 + header comment):
```typescript
// CRITICAL (Pitfall 7): viewerId MUST flow as a function argument.
// Do NOT resolve the viewer identity inside this cached scope —
// that would omit the viewer from the cache key, causing cross-user leakage.
export async function CollectorsLikeYou({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheLife('minutes')
  const recs = await getRecommendationsForViewer(viewerId)
```

**New function to add to `src/data/reactions.ts`:**
```typescript
// ---------------------------------------------------------------------------
// Cached read — getLikesForTargetCached (Phase 56, LIKE-01/02)
// ---------------------------------------------------------------------------

/**
 * 'use cache' wrapper around getLikesForTarget with Phase-55 cache tags.
 *
 * CRITICAL: viewerId MUST be passed as an explicit argument (not resolved
 * inside this scope) so Next.js serializes it into the cache key. Passing
 * the same viewerId but different targets produces distinct cache entries.
 *
 * Tags match what toggleLikeAction fires:
 *   revalidateTag('reactions:{type}:{id}', 'max') → busts cross-user count
 *   updateTag('viewer:{userId}:reactions')         → busts this viewer's liked state
 *
 * Anon path: pass '__anon__' sentinel for null viewerId. The SQL
 * bool_or(userId = '__anon__') evaluates false over all real UUID rows.
 * The viewer:__anon__:reactions tag is never invalidated — correct.
 */
export async function getLikesForTargetCached(
  viewerId: string,
  target: LikeTarget,
): Promise<LikesResult> {
  'use cache'
  cacheTag(`reactions:${target.type}:${target.id}`, `viewer:${viewerId}:reactions`)
  return getLikesForTarget(viewerId, target)
}
```

**Required import addition** at top of `src/data/reactions.ts` (line 1, after existing imports):
```typescript
import { cacheTag } from 'next/cache'
```

**Anon sentinel constant** (define in each consuming page, NOT in `reactions.ts`):
```typescript
const ANON_SENTINEL = '__anon__' as const
```

---

### `src/components/watch/WatchDetail.tsx` (edit — add props + render LikeButton)

**Analog:** Self (existing `'use client'` island). Pattern: extend `WatchDetailProps` interface, insert `LikeButton` under title block.

**Prop additions** (insert after `verdict?: VerdictBundle | null` in the interface, lines 44-50):
```typescript
/** Phase 56 D-03: viewer identity for LikeButton (null impossible — watch page is auth-only). */
viewerId?: string | null
/** Phase 56 D-03: server-hydrated initial like state from getLikesForTargetCached. */
initialLikeState?: { liked: boolean; count: number }
```

**Import addition** (after existing lucide-react imports at line 7):
```typescript
import { Heart } from 'lucide-react'
import { LikeButton } from '@/components/shared/LikeButton'
```

**Insertion point:** After the title block `</div>` at line ~146 (after `{watch.reference && …}` closes), before the "Last worn" block at line 149:
```typescript
{/* Phase 56 D-03: LikeButton — visible to all authenticated viewers (D-09) */}
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

---

### `src/app/watch/[id]/page.tsx` (edit — add `getLikesForTargetCached` hydration)

**Analog:** Self. Pattern: extend existing `Promise.all` (lines 25-29), pass new props to `WatchDetail`.

**Import addition** (after existing data imports, lines 1-17):
```typescript
import { getLikesForTargetCached } from '@/data/reactions'
```

**Hydration addition** (extend the existing `Promise.all` at lines 25-29 — add as a fourth entry OR as a sequential await after auth):
```typescript
// Existing Promise.all:
const [result, collection, preferences] = await Promise.all([
  getWatchByIdForViewer(user.id, id),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
])

// ADD after the result null-check and before lastWornDate:
const likeState = await getLikesForTargetCached(user.id, { type: 'watch', id })
```

**WatchDetail prop additions** (lines 73-80):
```typescript
<WatchDetail
  // ...existing props unchanged...
  viewerId={user.id}
  initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
/>
```

Note: The `ANON_SENTINEL` pattern is NOT needed here — `watch/[id]/page.tsx` always calls `getCurrentUser()` and throws on anon (it is an auth-only route). `user.id` is always a string.

---

### `src/app/wear/[wearEventId]/page.tsx` (edit — add hydration + redesign page tree)

**Analog:** Self. Pattern: existing anon-tolerant `try/catch` for `viewerId` (lines 39-47); extend tree to pass `likeState` and render footer row.

**Import additions** (after existing imports):
```typescript
import { getLikesForTargetCached } from '@/data/reactions'
import { LikeButton } from '@/components/shared/LikeButton'
```

**Anon-guard hydration pattern** (insert after `wear` resolved, before `altText`):
```typescript
const ANON_SENTINEL = '__anon__'
const likeState = await getLikesForTargetCached(
  viewerId ?? ANON_SENTINEL,
  { type: 'wear', id: wearEventId },
)
```

**Footer action row JSX** (new markup below `<WearDetailMetadata>`, before closing `</article>`):
```typescript
{/* Phase 56 D-04: footer action row — [reserved comment slot] [LikeButton right] */}
<div className="flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto">
  {/* Reserved for Phase 57 comment input — sized to accept a textarea without re-layout */}
  <div className="flex-1 min-h-[44px]" aria-hidden />
  <LikeButton
    viewerId={viewerId}
    target={{ type: 'wear', id: wearEventId }}
    initialLiked={likeState.viewerHasLiked}
    initialCount={likeState.count}
  />
</div>
```

**Existing `article` class stays unchanged** — `flex flex-col gap-4 pt-4` (line 57).

---

### `src/components/wear/WearDetailMetadata.tsx` (restructure — gut to note-only)

**Analog:** Self. The existing component (lines 43-108) renders three sections: collector row (lines 46-78), watch row (lines 80-100), note (lines 102-106). Post-redesign it renders only the note.

**Resulting component after restructure:**
```typescript
import type { JSX } from 'react'

/**
 * Phase 56 D-07: WearDetailMetadata is reduced to the note/caption only.
 * Collector row (D-05) and brand/model row (D-06) moved to photo overlays.
 * Watch thumbnail removed (D-06).
 */
export function WearDetailMetadata({
  note,
}: {
  note: string | null
}): JSX.Element | null {
  if (!note) return null
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap px-4 pt-3 md:max-w-[600px] md:mx-auto">
      {note}
    </p>
  )
}
```

**Props to drop** (no longer needed by this component): `username`, `displayName`, `avatarUrl`, `brand`, `model`, `watchImageUrl`, `createdAt`. Callers (`wear/[wearEventId]/page.tsx`) must stop passing these props to `WearDetailMetadata` — they now go to the overlay components inside `WearDetailHero`/`WearPhotoClient`.

**Note styling source:** Existing line 104 — `className="text-sm text-foreground whitespace-pre-wrap"` — preserved; adds `px-4 pt-3 md:max-w-[600px] md:mx-auto` to align with photo container.

---

### `src/components/wear/WearDetailHero.tsx` (edit — add `relative` + overlay children)

**Analog:** Self. Current file (55 lines). Two callsites both need `relative` added.

**Callsite 1 — `watchImageUrl` path** (line 33):
```typescript
// BEFORE:
<div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
// AFTER:
<div className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
```

**Callsite 2 — no-photo fallback** (line 46):
```typescript
// BEFORE:
<div
  className="w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
  aria-label={`No photo — ${brand} ${model}`}
>
  <span className="text-sm font-semibold text-muted-foreground">
    {brand} {model}
  </span>
</div>
// AFTER:
<div
  className="relative w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
  aria-label={`No photo — ${brand} ${model}`}
>
  {/* Brand/model text removed — moves to bottom overlay (D-06) */}
  {/* Overlay children injected here */}
</div>
```

**Props additions** — component needs overlay content to render. Planner decides: pass as children / `overlaySlot` prop, or accept explicit `{ username, displayName, avatarUrl, createdAt, brand, model, hasPhoto }` and render overlays internally. Whichever path, `brand`/`model` are already accepted props (used for `aria-label`); remaining fields are new.

**`hasPhoto` flag** determines overlay text color: `text-white` (photo path) vs `text-foreground` (muted fallback, D-08).

**Top overlay markup** (place as first absolute child inside the `relative` container):
```typescript
<div
  className="absolute inset-x-0 top-0 z-10 pointer-events-none"
  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 40%)' }}
>
  <div className="flex items-center gap-2 p-3 pointer-events-auto">
    <AvatarDisplay avatarUrl={avatarUrl} displayName={displayName} username={username ?? '?'} size={32} />
    <Link href={`/u/${username}`} className="text-sm font-semibold text-white hover:opacity-80">
      {displayName ?? username}
    </Link>
    <span className="text-sm text-white opacity-70">·</span>
    <span className="text-sm text-white opacity-70">{timeAgo(createdAt)}</span>
  </div>
</div>
```

**Bottom overlay markup** (place as last absolute child inside the `relative` container):
```typescript
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

**No-photo fallback overlay text color:** swap `text-white` → `text-foreground` on both overlays when `hasPhoto === false` (D-08).

**Required import additions:**
```typescript
import Link from 'next/link'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { timeAgo } from '@/lib/timeAgo'
```

---

### `src/components/wear/WearPhotoClient.tsx` (edit — add `relative` to 2 missing callsites + overlay children)

**Analog:** Self. `WearPhotoClient.tsx` has 125 lines. Three photo containers; only `~L94` already has `relative`.

**Callsite 1 — `status==='failed'` + `watchImageUrl` fallback** (line 68):
```typescript
// BEFORE:
<div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
// AFTER:
<div className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
```

**Callsite 2 — `status==='failed'` + no-photo fallback** (line 81):
```typescript
// BEFORE:
<div
  className="w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
  aria-label={`No photo — ${brand} ${model}`}
>
  <span className="text-sm font-semibold text-muted-foreground">
    {brand} {model}
  </span>
</div>
// AFTER:
<div
  className="relative w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto"
  aria-label={`No photo — ${brand} ${model}`}
>
  {/* Brand/model text removed — moves to bottom overlay (D-06) */}
  {/* Same overlay children as WearDetailHero — inject here */}
</div>
```

**Callsite 3 — signed-URL happy path** (line 94): Already has `relative` — **do not touch**.

**Props additions** (same new fields as `WearDetailHero` for overlay content): `username`, `displayName`, `avatarUrl`, `createdAt`. `brand`, `model` are already accepted props (lines 43-49). `hasPhoto` can be derived: `true` when `status !== 'failed'` and signed URL loaded; `false` on fallback.

**Overlay injection pattern:** Same absolute overlay markup as `WearDetailHero`. Both `WearDetailHero` and `WearPhotoClient` need the overlays — planner may extract a shared `<WearPhotoOverlays hasPhoto brand model ...>` sub-component or inline the JSX. Either is valid; the overlay markup is small (~20 lines each).

---

## Shared Patterns

### `'use cache'` + `cacheTag` with viewer-scoped isolation

**Source:** `src/app/u/[username]/profile-shell-resolver.tsx` (lines 29-31) and `src/components/home/CollectorsLikeYou.tsx` (lines 23-27)

**Apply to:** `getLikesForTargetCached` in `src/data/reactions.ts`

**Rule:** `cacheTag()` is called INSIDE the `'use cache'` scope. `viewerId` is a function argument (not resolved inside the scope) so Next.js serializes it into the cache key automatically. `getCurrentUser()` / `cookies()` / `headers()` must NEVER be called inside `'use cache'`.

```typescript
async function getLikesForTargetCached(viewerId: string, target: LikeTarget): Promise<LikesResult> {
  'use cache'
  cacheTag(`reactions:${target.type}:${target.id}`, `viewer:${viewerId}:reactions`)
  return getLikesForTarget(viewerId, target)
}
```

### Optimistic toggle + rollback + reconcile

**Source:** `src/components/profile/FollowButton.tsx` (lines 83-99)

**Apply to:** `src/components/shared/LikeButton.tsx`

```typescript
startTransition(async () => {
  const result = await action(...)
  if (!result.success) {
    setLiked(liked)        // rollback
    setCount(count)
    console.error('[LikeButton] action failed:', result.error)
    return
  }
  setLiked(result.data.liked)    // reconcile to server-confirmed values
  setCount(result.data.count)
})
```

### Anon login bounce via `window.location.pathname`

**Source:** `src/components/profile/FollowButton.tsx` (lines 70-74)

**Apply to:** `src/components/shared/LikeButton.tsx`

Use `window.location.pathname` inside the click handler — NOT `usePathname()` hook (null in tests; conditional hook call is illegal). `router.push` from `useRouter`.

```typescript
if (viewerId === null) {
  const next = encodeURIComponent(window.location.pathname)
  router.push(`/login?next=${next}`)
  return
}
```

### `ActionResult<T>` type

**Source:** `src/lib/actionTypes.ts`

**Apply to:** `LikeButton.tsx` — type-check `result.success` before accessing `result.data`. The `toggleLikeAction` return type is `ActionResult<{ liked: boolean; count: number }>`.

### Test mock block placement (vitest hoisting)

**Source:** `tests/components/profile/FollowButton.test.tsx` (lines 9-22)

**Apply to:** `tests/components/shared/LikeButton.test.tsx`

`vi.mock(...)` calls appear BEFORE component imports. Vitest hoists `vi.mock` automatically, but writing them first avoids confusion. Named import aliases for mocked fns (`import { toggleLikeAction } from '@/app/actions/reactions'`) let `(toggleLikeAction as Mock).mockResolvedValue(...)` work inside tests.

### Global test mocks (already active — no per-file setup needed)

**Source:** `tests/setup.tsx` (lines 217-273)

- `next/navigation` → `useRouter` stubbed globally (`push`, `refresh` etc.)
- `next/cache` → `cacheTag`, `cacheLife`, `revalidateTag`, `updateTag` all stubbed as `vi.fn()`

Per-test overrides win; declare `vi.mock('next/navigation', ...)` in `LikeButton.test.tsx` to control `mockPush` — this overrides the global stub for that file.

### Overlay CSS chain (D-08)

**Source:** `src/components/wear/WearPhotoClient.tsx` line 94 (the one callsite that already has `relative`)

**Apply to:** All 4 missing callsites in `WearPhotoClient.tsx` (lines ~68, ~81) and `WearDetailHero.tsx` (lines ~33, ~46)

Mandatory chain:
```
photo container: relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto
overlay:         absolute inset-x-0 top-0 (or bottom-0) z-10 pointer-events-none
```

After patching all 4 callsites, clear `.next/` before validating (`rm -rf .next && npm run dev`).

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Critical Landmines (for planner)

### L1: `'wear'` vs `'wear_event'` discriminator
The action schema (`src/app/actions/reactions.ts:23`) uses `z.enum(['watch', 'wear'])`. Using `'wear_event'` causes Zod `.strict()` to return `{ success: false }` silently. The TypeScript type `LikeTarget` (`src/data/reactions.ts:17`) is `{ type: 'watch' | 'wear'; id: string }` — enforced at compile time. Never use `'wear_event'` in any new code.

### L2: Anon sentinel for `getLikesForTarget`
`getLikesForTarget(viewerId: string, ...)` signature (`src/data/reactions.ts:29`) is `string`, not `string | null`. TypeScript strict mode rejects `null`. On the wear page where `viewerId` may be `null`, pass `viewerId ?? '__anon__'`. The SQL `bool_or(userId = '__anon__')` returns false over all real UUID rows — correct behavior.

### L3: All 4 `relative` callsites must be patched
Only `WearPhotoClient.tsx:94` (signed-URL happy path) has `relative`. The other 4 callsites do not. Patching only some produces overlay breakage on specific code paths. Use `grep -n "w-full aspect-\[4/5\]"` after editing to confirm all 4 are patched before marking the task done.

### L4: `WatchDetail` is `'use client'` — RSC import constraint
`src/components/watch/WatchDetail.tsx:1` has `'use client'`. `LikeButton` must also be `'use client'`. RSCs cannot be imported into a client island. `SameFamilyRail` and `LineageRail` are composed at the server page level (as siblings of `WatchDetail`), not inside it — same pattern must be followed.

---

## Metadata

**Analog search scope:** `src/components/profile/`, `src/components/wear/`, `src/components/watch/`, `src/app/`, `src/data/`, `tests/components/profile/`, `tests/setup.tsx`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-22

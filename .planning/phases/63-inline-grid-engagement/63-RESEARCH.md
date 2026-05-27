# Phase 63: Inline Grid Engagement - Research

**Researched:** 2026-05-27
**Domain:** React client-side engagement UI (optimistic like + bottom-sheet comment composer) threaded into an existing Next.js 16 Cache Components profile grid
**Confidence:** HIGH — almost all claims verified against the live codebase; only minor styling choices are discretion-level

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Engagement controls render as overlay pill chips (♥ + 💬) on the image, bottom-left corner, with a dark scrim (bg-black/55 or similar) + white icon+count. Bottom-left is clear of the existing badges (status/deal/gap are top-2 right-2; wear badge is top-2 left-2).
- **D-02 (nested-Link conflict):** The whole card wraps in `<Link href={/w/${watch.id}}>`. Chip click handlers MUST `preventDefault()` + `stopPropagation()` so tapping a chip does not navigate to detail. Alternatively, the planner may restructure the link to wrap only image+text and render chips as siblings — either is valid; hard requirement is **chip-tap ≠ navigate**.
- **D-03 (who sees chips):** Interactive chips render for **non-owner, authenticated viewers only**. Owner's own cards keep today's static count line and show no interactive chips.
- **D-04:** Reuse the existing optimistic like pattern from `LikeButton` — `useState` + `useTransition` + rollback + reconcile. The ♥ chip is always present for engageable viewers. Count renders only when `count > 0 || liked`.
- **D-05:** Optimistic flip before Server Action resolves; on success reconcile to server-confirmed `{liked, count}`; on failure roll back silently (no user-facing error toast).
- **D-06:** Tapping the 💬 chip opens a bottom sheet (reuse the Phase 62 wear-pic comment sheet primitive). The sheet shows watch identity (thumbnail + brand/model) + `CommentCompose`. COMPOSE-ONLY — no thread rendered inline (GRID-04). Sheet chosen over inline-expand so the grid does not reflow.
- **D-07:** After Post succeeds: close the sheet, fire a 'Comment posted' toast (sonner), and bump the card's 💬 count optimistically.
- **D-08:** On Post failure: roll back optimistic 💬 count bump, keep typed text for retry (`CommentCompose` retains body on failure), surface failure toast.
- **D-09:** For non-mutual viewer on foreign WISHLIST card (GATE-05 fails): hide 💬 chip entirely. ♥ chip stays. No locked/teaser affordance.
- **D-10 (defense-in-depth):** Chip is hidden client-side via per-card gate flag, AND `createComment` re-checks `canViewerCommentOnTarget` server-side and throws `CommentGateError`. Server action is the real gate.
- **D-11:** `getBatchedWatchCounts` / `getBatchedWatchCountsCached` MUST extend the batched result to carry per-viewer `liked` and `canComment`. The follows queries + `allowedSet` already exist; `canComment` IS `allowedSet` membership. `liked` needs one added query (viewer's `watch_likes` via `inArray(watchIds)`). Keep constant query budget (≤~6, no N+1).
- **D-12 (cache):** `getBatchedWatchCountsCached` is `'use cache'`, viewer-scoped via `viewer:${viewerId}:counts` + `profile:${username}`. Grid like/comment must bust this viewer's counts tag. Confirm `toggleLikeAction` and comment-create action revalidate `viewer:{viewerId}:counts` — today the like action busts `viewer:{userId}:reactions` (NOT `:counts`); the comment action busts only `profile:{username}`. Do NOT introduce request-time APIs inside the `'use cache'` scope.

### Claude's Discretion

- Exact chip styling (pill radius, scrim opacity, icon size), and bottom-left vs bottom-right if a collision emerges; whether owner's display count stays as today's bottom line or also moves to a non-interactive overlay (lean: keep owner exactly as today).
- The specific sheet/dialog primitive for the composer (Phase 62 WearCommentHost vs a new lighter wrapper using the same `Sheet` from `@/components/ui/sheet.tsx`).
- Whether to refactor the whole-card `<Link>` (preventDefault on chips vs restructuring the link to image+text only) — as long as chip-tap ≠ navigate.
- Toast copy and optimistic-rollback specifics — mirror existing `sonner` patterns.

### Deferred Ideas (OUT OF SCOPE)

- Full comment thread inline in the grid card (GRID-04 — reading the thread clicks through to /w/[ref])
- Locked/teaser comment affordance on gated cards (hide the 💬 chip entirely; D-09)
- Owner self-engagement chips on own grid (hide chips for owner; D-03)
- Threaded/nested replies, comment moderation, public liker lists, Realtime (out per v6.0 social scope)
- Detail-page information hierarchy + deliberate comment placement (Phase 64)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRID-01 | Viewer can like a watch from a grid card (one tap, optimistic) | LikeButton pattern verified; `toggleLikeAction` exists; extend `getBatchedWatchCounts` to return `liked` per watch |
| GRID-02 | Viewer can post a comment from a grid card via a lightweight inline composer without opening detail | `CommentCompose` + Sheet primitive verified; `addCommentAction` already handles watch target; compose-only sheet confirmed |
| GRID-03 | Grid card's ♥ N · 💬 M counts update optimistically after an inline like or comment | Optimistic pattern from `LikeButton` verified; count bump + rollback pattern documented |
| GRID-04 | Viewing the full comment thread still requires opening the detail page (inline is compose-only) | Sheet shows ONLY `CommentCompose`, not `CommentList` or `CommentThread` |
| GRID-05 | GATE-03 wishlist mutual-follow comment gate enforced per card; gated cards do not expose the inline composer | `allowedSet` in `getBatchedWatchCounts` IS the gate; `canComment` is `allowedSet` membership; server-side `createComment` throws `CommentGateError` as backstop |
</phase_requirements>

---

## Summary

Phase 63 is a surfacing + data-threading job. The like/comment data layer, server actions, gate logic, optimistic patterns, and sheet primitive ALL ALREADY EXIST from v6.0 + Phase 62. The work is: (1) extend `getBatchedWatchCounts` to carry per-viewer `liked` and `canComment` (one added DB query), (2) thread those new fields from `page.tsx` through the tab-content components to each `ProfileWatchCard`, (3) add two overlay pill chips to `ProfileWatchCard` for non-owner authenticated viewers, and (4) wire the 💬 chip to a compose-only bottom sheet.

The most important structural constraints are all verified in the live codebase. The D-12 cache-tag gap is confirmed real: `toggleLikeAction` currently busts `viewer:{userId}:reactions` but NOT `viewer:{userId}:counts`; the comment-create action busts `profile:{username}` but NOT `viewer:{viewerId}:counts`. Both actions need a `revalidateTag('viewer:{userId}:counts', 'max')` addition. This is the only new wiring required outside of pure UI work.

The Phase 62 `WearCommentHost` is the reference sheet primitive, but the grid composer is COMPOSE-ONLY (no thread) — the planner may choose to create a lightweight `WatchCommentSheet` using `Sheet` + `CommentCompose` directly rather than repurposing `WearCommentHost` (which includes `CommentList` with a full thread). Either is valid per Claude's Discretion.

**Primary recommendation:** Extend `getBatchedWatchCounts` return shape → thread `liked`/`canComment` through page → `ProfileWatchCard` → render overlay chips (non-owner only) → compose-only sheet → add the missing `viewer:{userId}:counts` revalidation in both server actions. Build verifies at zero new runtime dependencies.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Like state seed (initial `liked`) | Backend / RSC | — | `getBatchedWatchCounts` already runs server-side; `liked` is one extra inArray query in that batch |
| Like toggle optimistic UI | Browser / Client | — | `useState` + `useTransition` in the ♥ chip component (mirrors `LikeButton`) |
| Like persistence + cache bust | API / Backend (Server Action) | — | `toggleLikeAction` writes DB + calls `revalidateTag`; needs `viewer:{userId}:counts` bust added |
| Comment gate flag (`canComment`) | Backend / RSC | Browser (UX hide) | `allowedSet` from `getBatchedWatchCounts` is authoritative; server-side DAL enforces at write |
| Comment compose UI | Browser / Client | — | `CommentCompose` is `'use client'`; bottom sheet rendered client-side |
| Comment persistence + count bump | API / Backend (Server Action) | — | `addCommentAction` + `createComment` DAL; needs `viewer:{userId}:counts` bust added |
| Optimistic count badges on card | Browser / Client | — | Local state in the chip/card component; seeded from RSC-resolved counts |
| Cache tag invalidation | Backend (Server Action) | — | `revalidateTag` calls in `reactions.ts` and `comments.ts` actions |

---

## Standard Stack

### Core — All Already Installed
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | `useState`, `useTransition` for optimistic UI | Already in use throughout project |
| Next.js | 16.2.3 | `'use cache'` / `cacheTag` / `revalidateTag` / Server Actions | Project's framework; PPR + Cache Components pattern already locked |
| `@base-ui/react` | ^1.3.0 | Sheet (via `src/components/ui/sheet.tsx`) backed by `Dialog as SheetPrimitive` | Already used for the Phase 62 wear-pic comment sheet |
| `sonner` | (existing) | Toast notifications | Used throughout (Phase 61/62 patterns) |
| `lucide-react` | ^1.8.0 | `Heart`, `MessageCircle` icons for chips | Already imported in `ProfileWatchCard.tsx` |
| `drizzle-orm` | (existing) | `inArray` for the new `watch_likes` viewer query | Already used in `getBatchedWatchCounts` |

**No new packages to install.** All dependencies are present. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
RSC ProfileTabContent (page.tsx)
  │
  ├── getCurrentUser() → viewerId            [uncached, outside 'use cache' scope]
  │
  ├── getBatchedWatchCountsCached(           ['use cache', tags: viewer:{id}:counts + profile:{u}]
  │     viewerId, watchIds, profileUsername) → Map<watchId, {likeCount, commentCount, liked, canComment}>
  │        │
  │        ├── Q1: watch rows (ownership + status)
  │        ├── Q2: viewer→owners follows (wishlist gate)
  │        ├── Q3: owners→viewer follows (wishlist gate)
  │        ├── Q4: like counts (all watchIds)
  │        ├── Q5: comment counts (allowedWatchIds only)
  │        └── Q6 NEW: viewer's watch_likes (inArray watchIds) → liked set
  │
  ├── Object.fromEntries(countsMap) → counts Record
  │        (adds liked, canComment per entry)
  │
  ├── CollectionTabContent(counts, isOwner, viewerId)
  │        └── ProfileWatchCard (per watch)
  │               ├── [isOwner] → static count line (unchanged)
  │               └── [!isOwner + auth] → overlay chips (♥ + 💬 conditional on canComment)
  │                        ├── ♥ chip → onClick: optimistic flip + toggleLikeAction
  │                        │                     → revalidateTag viewer:{userId}:counts [NEEDS ADD]
  │                        └── 💬 chip (if canComment) → onClick: setSheetOpen(true)
  │                                   → WatchCommentSheet (Sheet + CommentCompose)
  │                                             → addCommentAction({type:'watch', id, body})
  │                                                        → revalidateTag viewer:{userId}:counts [NEEDS ADD]
  │
  └── WishlistTabContent (same chips via non-owner branch;
           SortableProfileWatchCard owner-only → chips never render for owner)
```

### Recommended Project Structure

No new top-level directories needed. New files go in existing locations:

```
src/
├── components/
│   ├── profile/
│   │   ├── ProfileWatchCard.tsx        # MODIFY: add overlay chips + sheet state
│   │   ├── CollectionTabContent.tsx    # MODIFY: thread liked/canComment/viewerId
│   │   ├── WishlistTabContent.tsx      # MODIFY: thread liked/canComment/viewerId
│   │   └── SortableProfileWatchCard.tsx # MODIFY: pass through liked/canComment/viewerId
│   └── watch/ (optional)
│       └── WatchCommentSheet.tsx       # NEW (optional): compose-only sheet primitive
├── data/
│   └── reactions.ts                    # MODIFY: extend WatchCounts type + getBatchedWatchCounts
├── app/
│   ├── actions/
│   │   ├── reactions.ts                # MODIFY: add viewer:counts revalidateTag
│   │   └── comments.ts                 # MODIFY: add viewer:counts revalidateTag
│   └── u/[username]/[tab]/
│       └── page.tsx                    # MODIFY: thread viewerId + liked/canComment to tab contents
```

### Pattern 1: Extending WatchCounts Return Shape (D-11)

**What:** Add `liked` (boolean) and `canComment` (boolean) to the `WatchCounts` type and both `getBatchedWatchCounts` and `getBatchedWatchCountsCached`.

**Current shape** (verified at `src/data/reactions.ts:158`):
```typescript
// VERIFIED: codebase read
export interface WatchCounts {
  likeCount: number
  commentCount: number
}
```

**Extended shape:**
```typescript
export interface WatchCounts {
  likeCount: number
  commentCount: number
  liked: boolean       // NEW: viewer has liked this watch
  canComment: boolean  // NEW: viewer is allowed to comment (= allowedSet membership)
}
```

**The one new query (Q6) to add in `getBatchedWatchCounts`:**
```typescript
// After Q5 comment counts, before building the result Map:
// Q6: viewer's liked set — which watchIds has the viewer already liked?
const viewerLikedRows = await db
  .select({ watchId: watchLikes.watchId })
  .from(watchLikes)
  .where(and(eq(watchLikes.userId, viewerId), inArray(watchLikes.watchId, watchIds)))
const viewerLikedSet = new Set(viewerLikedRows.map((r) => r.watchId))
```

**Result Map build update:**
```typescript
for (const id of watchIds) {
  result.set(id, {
    likeCount: likeCountMap.get(id) ?? 0,
    commentCount: commentCountMap.get(id) ?? 0,
    liked: viewerLikedSet.has(id),           // NEW
    canComment: allowedSet.has(id),          // NEW (allowedSet already computed)
  })
}
```

**Query budget verification:** Q1 + Q2 + Q3 + Q4 + Q5 = 5 existing queries. Adding Q6 = 6 total. Stays within the ≤~6 target. [VERIFIED: read getBatchedWatchCounts, reactions.ts:191-294]

### Pattern 2: Overlay Chip (♥) — Optimistic Like

**What:** Non-owner chip that fires `toggleLikeAction`. Mirrors `LikeButton` but as an overlay pill.

**Key pattern from LikeButton** (verified at `src/components/shared/LikeButton.tsx`):
```typescript
// VERIFIED: codebase read
const [liked, setLiked] = useState(initialLiked)
const [count, setCount] = useState(initialCount)
const [pending, startTransition] = useTransition()

function handleClick(e: React.MouseEvent) {
  e.preventDefault()   // D-02: stop <Link> navigation
  e.stopPropagation()
  // ... optimistic flip
  startTransition(async () => {
    const result = await toggleLikeAction({ type: 'watch', id: watch.id })
    if (!result.success) {
      setLiked(liked); setCount(count)  // silent rollback
      return
    }
    setLiked(result.data.liked); setCount(result.data.count)  // reconcile
  })
}
```

**Count visibility rule** (mirrors LikeButton line 114):
```typescript
{(liked || count > 0) && <span>{count}</span>}
```

### Pattern 3: Overlay Chip (💬) — Sheet Trigger

**What:** Non-owner chip conditioned on `canComment`. Tapping opens a compose-only bottom sheet.

```typescript
// VERIFIED: D-02 + D-06 + D-09 from CONTEXT.md; Sheet primitive verified at
// src/components/ui/sheet.tsx (backed by @base-ui/react Dialog)
const [sheetOpen, setSheetOpen] = useState(false)

// In JSX chip:
{canComment && (
  <button
    onClick={(e) => {
      e.preventDefault()
      e.stopPropagation()
      setSheetOpen(true)
    }}
  >
    <MessageCircle /> {commentCount > 0 && commentCount}
  </button>
)}

// Sheet (compose-only — no CommentList/thread per GRID-04):
<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
  <SheetContent side="bottom">
    {/* watch identity header */}
    {/* CommentCompose only — no CommentList */}
  </SheetContent>
</Sheet>
```

### Pattern 4: Compose-Only Sheet vs WearCommentHost

**D-06 says:** reuse the Phase 62 wear-pic comment sheet primitive. However, `WearCommentHost` (verified at `src/components/wear/WearCommentHost.tsx`) wraps a **full `CommentList`** (which includes both the compose box AND the comment thread). For GRID-04 (compose-only, no thread), the planner has two options:

**Option A — New lightweight sheet (recommended for clarity):**
Create `src/components/watch/WatchCommentSheet.tsx` using `Sheet` + `SheetContent` + `CommentCompose` directly. Does not include `CommentList`. Cleaner separation of compose-only vs full-thread surfaces.

**Option B — Reuse WearCommentHost with `suppressCompose`-style prop:**
Add a `composeOnly` prop to `WearCommentHost` that renders just `CommentCompose` instead of the full `CommentList`. Less new code, but makes `WearCommentHost` more complex.

Both are valid per Claude's Discretion (D-06 says "exact sheet/dialog primitive is planner's discretion"). Option A is cleaner for the GRID-04 boundary. [ASSUMED: recommendation for Option A; not a locked decision]

### Pattern 5: D-12 Cache Tag Gap — The Gap is Real

**Current behavior** (verified by reading both action files):

`toggleLikeAction` (`src/app/actions/reactions.ts:102-111`):
- `revalidateTag('reactions:{type}:{id}', 'max')` — per-target reactions
- `revalidateTag('profile:{ownerUsername}', 'max')` — profile grid counts
- `updateTag('viewer:{userId}:reactions')` — viewer's liked state in LikeButton
- **MISSING:** `revalidateTag('viewer:{userId}:counts', 'max')` — the new batched counts tag

`addCommentAction` (`src/app/actions/comments.ts:163`):
- `revalidateTag('profile:{ownerUsername}', 'max')` — profile grid counts
- **MISSING:** `revalidateTag('viewer:{userId}:counts', 'max')` — the new batched counts tag

The `viewer:{viewerId}:counts` tag is assigned in `getBatchedWatchCountsCached` (verified at `src/data/reactions.ts:322`):
```typescript
cacheTag(`profile:${profileUsername}`, `viewer:${viewerId}:counts`)
```

The `profile:{username}` tag IS busted by both actions, which means the full profile cache (including counts) is invalidated for ALL viewers. However, the `viewer:{viewerId}:counts` tag is the VIEWER-SPECIFIC scope that enables the per-viewer `liked`/`canComment` fields to re-hydrate correctly when a viewer navigates away and back. Without busting it explicitly, a viewer who likes a watch, navigates away, and returns could see a stale `liked: false` from the cache. [VERIFIED: codebase read]

**Fix required in `toggleLikeAction`:**
```typescript
// After revalidateTag for profile:
revalidateTag(`viewer:${user.id}:counts`, 'max')
```

**Fix required in `addCommentAction`:**
```typescript
// After revalidateTag for profile:
revalidateTag(`viewer:${user.id}:counts`, 'max')
```

Note: since `profile:{username}` is also busted, this is belt-and-suspenders for cross-viewer counts (the liked state is viewer-specific; the profile tag handles counts for all viewers broadly).

### Pattern 6: viewerId Threading

**Current state** (verified, `page.tsx:366-406`): `viewerId` is resolved in `ProfileTabContent` (outside `'use cache'`), passed to `getBatchedWatchCountsCached`, but the resulting `counts` record (which will now carry `liked`/`canComment`) is passed to `CollectionTabContent` and `WishlistTabContent` as a `Record<string, {likeCount, commentCount}>`. Phase 63 extends that shape.

The `viewerId` itself is NOT currently threaded into `CollectionTabContent` or `WishlistTabContent` (verified: neither component's `Props` interface has `viewerId`). The planner needs to add `viewerId` to both component props so the card can know "is viewer the owner" and render chips vs static counts.

**Alternative:** Pass an `isEngageable: boolean` flag per-card (derived from `!isOwner && viewerId !== null` in `page.tsx`) rather than threading raw `viewerId` into client components. This avoids leaking viewer identity into the client bundle. [ASSUMED: this is a planner-discretion detail, either approach is valid]

### Pattern 7: onPointerDown Reset for Sheet State

Per `project_router_cache_stale_instance` MEMORY: Next 16 restores stale client-component instances on revisited dynamic URLs. Sheet open state and optimistic liked/count must be reset on interaction (onPointerDown), not on mount.

**Pattern from Phase 62** (verified in STATE.md accumulated context):
```typescript
// eye/hide toggle and one-shot state use onPointerDown
// Social comment button keeps onClick (fresh-per-interaction, not a one-shot toggle)
```

The ♥ chip is a toggle (one-shot orientation flip) — should use onClick. The sheet-open is controlled state that resets on close, so `onOpenChange` covers the close path. The liked/count state is seeded from props, which will be freshly resolved on the next hard navigation. This is safe. [VERIFIED: STATE.md accumulated context]

### Anti-Patterns to Avoid

- **Marking `ProfileTabContent` `'use cache'`:** It must NOT be cached — it calls `getCurrentUser()` which is a request-time API forbidden inside `'use cache'` scope (D-52-16 / Next 16 constraint). [VERIFIED: CONTEXT.md D-12 + page.tsx structure]
- **Calling request-time APIs inside `getBatchedWatchCountsCached`:** Auth is resolved OUTSIDE and passed as `viewerId` argument. Never add `getCurrentUser()` inside the `'use cache'` scope.
- **N+1 liked query:** Do NOT query `watch_likes` per watchId in a loop. Use a single `inArray(watchLikes.watchId, watchIds)` + `eq(watchLikes.userId, viewerId)` query, then build a Set. [VERIFIED: existing Q4/Q5 pattern in getBatchedWatchCounts]
- **Letting chips navigate on tap:** The entire `ProfileWatchCard` is wrapped in `<Link href={/w/${watch.id}}>` (verified at line 63). Any button inside must `preventDefault` + `stopPropagation`, or the link must be restructured to not wrap the chips.
- **Rendering chips for owner:** D-03 forbids this. `SortableProfileWatchCard` (owner-only drag reorder) + chip interaction would conflict with dnd-kit sensor timing.
- **Using `WearCommentHost` directly with a watch target:** `WearCommentHost` sets `target = { type: 'wear', id: wearEventId }`. Re-targeting it to a watch requires either props surgery or a new wrapper. The clean path is a new `WatchCommentSheet`.
- **Stale cache on navigation-away/back:** Without the `viewer:{userId}:counts` tag bust, a viewer's liked state can re-hydrate stale. The `profile:{username}` tag bust covers shared counts but not per-viewer `liked`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic like toggle | Custom liked state machine | Exact `LikeButton` pattern (`useState` + `useTransition` + rollback + reconcile) | Already tested; handles double-click, rollback, server-reconcile |
| Bottom sheet | Custom modal/drawer | `Sheet` from `src/components/ui/sheet.tsx` (backed by @base-ui/react Dialog) | Already used for Phase 62 wear-pic comments; consistent scroll behavior |
| Comment composition | Custom textarea + submit | `CommentCompose` (`src/components/comment/CommentCompose.tsx`) | 500-char cap, char counter at ≥450, retains body on failure, anon bounce — all built |
| Wishlist comment gate | Custom mutual-follow check | `allowedSet` from `getBatchedWatchCounts` + `createComment` throws `CommentGateError` | Service-role DAL is the real gate; `allowedSet` is the batch-computed gate flag |
| Toast notifications | Custom notification | `sonner` toast (`import { toast } from 'sonner'`) | Already used across Phase 61/62; consistent UX |

---

## Runtime State Inventory

Step 2.5: SKIPPED — This is a UI surfacing + data-threading phase. No rename/refactor/migration operation. No runtime-stored strings change. No new DB schema, no new Supabase tables, no SOPS keys, no OS-registered tasks.

---

## Common Pitfalls

### Pitfall 1: Chip Tap Navigates to Detail Page
**What goes wrong:** Tapping the ♥ or 💬 chip navigates to `/w/{ref}` instead of triggering the like or opening the sheet.
**Why it happens:** The entire `ProfileWatchCard` is wrapped in `<Link>` (line 63, verified). Any click inside bubbles up to the link.
**How to avoid:** Every chip button handler must call `e.preventDefault()` and `e.stopPropagation()`, OR restructure the `<Link>` to wrap only the image+text content and render chips as siblings outside the link.
**Warning signs:** Clicking the ♥ chip routes away from the profile page instead of flipping.

### Pitfall 2: Chips Appearing for Owner (D-03 violation)
**What goes wrong:** The owner sees interactive ♥/💬 chips on their own collection or wishlist cards.
**Why it happens:** Forgetting to gate on `!isOwner`.
**How to avoid:** Chips must be conditionally rendered only when `viewerId !== null && !isOwner`. Check both conditions.
**Warning signs:** Owner sees heart chip on their own grid.

### Pitfall 3: Stale `liked` State After Navigate-Away and Back
**What goes wrong:** Viewer likes a watch, navigates to `/w/[ref]`, comes back to the grid, and the card shows the old `liked: false` state.
**Why it happens:** `getBatchedWatchCountsCached` is `'use cache'` tagged `viewer:{viewerId}:counts`. If `toggleLikeAction` only busts `viewer:{userId}:reactions` (current behavior — verified), the counts cache is never explicitly invalidated for the viewer's `liked` field.
**How to avoid:** Add `revalidateTag('viewer:{userId}:counts', 'max')` to `toggleLikeAction`. The `profile:{username}` tag is also busted and covers the broader cache, but the viewer-scoped tag is the precise path.
**Warning signs:** ♥ chip shows filled after like, navigate to detail and back, chip shows unfilled (reverts to stale cache).

### Pitfall 4: 'use cache' Scope Contamination
**What goes wrong:** A request-time API (e.g., `cookies()`, `headers()`, `getCurrentUser()`) is called inside `getBatchedWatchCountsCached`'s `'use cache'` scope.
**Why it happens:** Trying to resolve `viewerId` inside the cached function for convenience.
**How to avoid:** `viewerId` MUST be passed as an explicit argument (as it is today). The caller (`ProfileTabContent`) resolves auth outside the cache scope. [VERIFIED: existing pattern in reactions.ts:316-324 + comment in function]
**Warning signs:** Build error: `Error: Dynamic API was called ... inside a "use cache" component`

### Pitfall 5: WearCommentHost Targeting Wrong Type
**What goes wrong:** Re-targeting `WearCommentHost` to a watch target (`type: 'watch'`) breaks the gate and comment creation because `WearCommentHost` hardcodes `type: 'wear'` (verified at WearCommentHost.tsx line 86: `const target = { type: 'wear' as const, id: wearEventId }`).
**Why it happens:** Trying to reuse `WearCommentHost` without modification.
**How to avoid:** Create a new `WatchCommentSheet` component (Option A) that sets `target = { type: 'watch', id: watchId }` and renders `CommentCompose` directly (no full CommentList), OR add a `watchId` path to `WearCommentHost` via its props discriminant.
**Warning signs:** Comments on watch cards get inserted as `wear` type in the DB; gate checks fail.

### Pitfall 6: N+1 for `liked` per card
**What goes wrong:** Querying `watch_likes` once per watch in a loop instead of a single batched query.
**Why it happens:** Forgetting the established batched-query pattern.
**How to avoid:** One `db.select().from(watchLikes).where(and(eq(watchLikes.userId, viewerId), inArray(watchLikes.watchId, watchIds)))` query, then `new Set(rows.map(r => r.watchId))`. [VERIFIED: existing Q4/Q5 pattern]
**Warning signs:** Query count in tests scales with number of watches instead of staying constant.

### Pitfall 7: CommentCompose body not clearing on success
**What goes wrong:** After a successful comment post, the textarea retains the submitted text.
**Why it happens:** `CommentCompose` explicitly does NOT clear on submit (verified: `CommentCompose.tsx` comment "body is NOT cleared here — CommentList clears it on successful reconcile"). When used standalone (not inside `CommentList`), the sheet's parent must clear by re-mounting `CommentCompose` (e.g., using a `key` prop).
**How to avoid:** In the grid comment sheet, maintain a `composeKey` state integer; increment it on successful post to re-mount `CommentCompose` and clear the textarea. Mirror `CommentList`'s `setComposeKey((k) => k + 1)` pattern (verified at CommentList.tsx:132).
**Warning signs:** After posting a comment and re-opening the sheet for the same watch, the old text is still in the textarea.

### Pitfall 8: Re-enabling `unstable_instant` on `/u/[username]/[tab]`
**What goes wrong:** React #419 on page load + intermittent tab-nav 404s.
**Why it happens:** This export is permanently `false` (Phase 52 fix). Any attempt to re-enable it triggers a secondary server-side prerender that aborts.
**How to avoid:** Leave `export const unstable_instant = false` untouched. Do not add any import or export that triggers PPR validation on this route.
**Warning signs:** Build may appear to pass but prod shows React #419 errors.

---

## Code Examples

### Verified: Current ProfileWatchCard structure (line 63, 117-136)

```typescript
// VERIFIED: src/components/profile/ProfileWatchCard.tsx:62-136
return (
  <Link href={`/w/${watch.id}`}>
    <Card ...>
      <div className="relative aspect-square bg-muted">
        {/* image */}
        {/* wear badge: absolute top-2 left-2 */}
        {/* status/deal/gap badges: absolute top-2 right-2 (not in this file actually — see below) */}
      </div>
      <CardContent ...>
        {/* tag badge */}
        {/* price/wear lines */}
        {/* current static count line (lines 117-136): */}
        {((likeCount ?? 0) > 0 || (commentCount ?? 0) > 0) && (
          <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
            {(likeCount ?? 0) > 0 && <><Heart className="size-3" />{likeCount}</>}
            {/* separator */}
            {(commentCount ?? 0) > 0 && <><MessageCircle className="size-3" />{commentCount}</>}
          </p>
        )}
      </CardContent>
    </Card>
  </Link>
)
```

Note: The existing status/deal/gap badges mentioned in D-01 as `top-2 right-2` are NOT visible in the current ProfileWatchCard — they may be on a different card component or not yet implemented. The image area currently shows only the wear badge at `top-2 left-2`. The bottom-left corner of the image IS clear of any badge. [VERIFIED: full read of ProfileWatchCard.tsx]

### Verified: getBatchedWatchCountsCached cache tags (reactions.ts:322)

```typescript
// VERIFIED: src/data/reactions.ts:316-324
export async function getBatchedWatchCountsCached(
  viewerId: string,
  watchIds: string[],
  profileUsername: string,
): Promise<Map<string, WatchCounts>> {
  'use cache'
  cacheTag(`profile:${profileUsername}`, `viewer:${viewerId}:counts`)
  return getBatchedWatchCounts(viewerId, watchIds)
}
```

### Verified: WearCommentHost bottom-sheet binding (for reference, not direct reuse)

```typescript
// VERIFIED: src/components/watch/WatchPhotoSection.tsx:635-655
// Pattern: sheetWearPic state + open/onOpenChange + onCountChange callback
{sheetWearPic && (
  <WearCommentHost
    variant="bottom-sheet"
    wearEventId={sheetWearPic.wearEventId}
    open={commentSheetOpen}
    onOpenChange={setCommentSheetOpen}
    initialComments={sheetWearPic.initialComments}
    canComment={canCommentOnWears}
    // ... other props
    onCountChange={(delta) => { /* update local count map */ }}
  />
)}
```

The grid composer needs no `initialComments` (compose-only, GRID-04). A new `WatchCommentSheet` requires only: `watchId`, `open`, `onOpenChange`, `viewerId`, `canComment` (for the server-action gate defense, D-10 — though the chip is already hidden, the action re-checks anyway).

### Verified: CommentCompose re-mount pattern for clear-on-success

```typescript
// VERIFIED: src/components/comment/CommentList.tsx:78, 131-132
const [composeKey, setComposeKey] = useState(0)
// ... on success:
setComposeKey((k) => k + 1) // re-mount CommentCompose to clear textarea

// In JSX:
<CommentCompose key={composeKey} viewerId={viewerId} pending={pending} onSubmit={handleSubmit} />
```

### Verified: Cache tag revalidation that IS present (toggleLikeAction)

```typescript
// VERIFIED: src/app/actions/reactions.ts:102-111
// These tags ARE busted:
revalidateTag(`reactions:${target.type}:${target.id}`, 'max')  // per-target count
revalidateTag(`profile:${ownerProfile.username}`, 'max')        // profile grid
updateTag(`viewer:${user.id}:reactions`)                         // viewer liked state (LikeButton)

// THIS TAG IS MISSING — needs to be added for Phase 63:
// revalidateTag(`viewer:${user.id}:counts`, 'max')  // viewer batched counts (liked + canComment)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `imageUrl` on watch | Multi-photo via `watch_photos` table | Phase 60/61 | `ProfileWatchCard` uses `watch.imageUrl` from signed cover URL (Phase 61 backfill) |
| `/watch/[id]` route | `/w/[ref]` unified route | Phase 59 | All card `<Link>` already updated to `/w/${watch.id}` (verified line 63) |
| Comments require opening detail page | Comments open from grid card (compose-only) | Phase 63 (this phase) | Inline engagement without navigation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option A (new `WatchCommentSheet`) is cleaner than repurposing `WearCommentHost` | Architecture Patterns §4 | If planner chooses Option B, `WearCommentHost` needs a new props path; slightly more coupling but valid |
| A2 | Threading `isEngageable: boolean` per-card is simpler than threading raw `viewerId` | Pattern 6 | If viewerId is needed for the chip's anon-bounce behavior, raw viewerId must be threaded instead |
| A3 | The `profile:{username}` tag bust already covers cross-viewer counts re-hydration; only viewer-specific `liked` needs the viewer-scoped tag | Pitfall 3 | If `profile:{username}` tag somehow misses a viewer's counts entry, they could see stale data even without the viewer-specific bust — but the profile tag is quite broad |

---

## Open Questions

1. **Should `ProfileWatchCard` receive `viewerId` directly or a derived `isEngageable` flag + `liked`/`canComment` counts?**
   - What we know: `isOwner` is computed in `page.tsx` from `viewerId === profile.id`; `liked`/`canComment` are per-card from the counts map.
   - What's unclear: Whether the chip needs `viewerId` for the anon-bounce path (like `LikeButton`'s `if (viewerId === null) router.push('/login?...')`). On `/u/*`, viewers are always authenticated (Phase 51 Branch B auth gate), so `viewerId` is always non-null.
   - Recommendation: Thread `viewerId` into the card anyway for parity with `LikeButton`'s interface. If the auth gate ever changes, the chip already handles the anon path.

2. **Should the wishlist gate display the 💬 chip count for gated viewers?**
   - What we know: For gated viewers on a foreign wishlist watch, `canComment: false` AND `commentCount: 0` (the gate in Q5 already returns 0 for gated watches). So there is nothing to display.
   - What's unclear: No ambiguity — D-09 says hide chip entirely. The 0 count confirms there is nothing teasing unreachable content.
   - Recommendation: Confirmed per D-09: hide chip entirely for gated viewers. No tease state.

---

## Environment Availability

Step 2.6: SKIPPED — This phase is pure client+server code changes with no new external tool dependencies. All required packages are already installed and verified present in `package.json`. No new CLI tools, no new DB tables, no new Supabase services.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/data/getBatchedWatchCounts.test.ts tests/actions/reactions.test.ts tests/actions/comments.test.ts` |
| Full suite command | `npm run test` |
| Build gate | `npm run build` (exit 0 is authoritative gate per MEMORY project_baseline_not_green_build_is_gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRID-01 | `getBatchedWatchCounts` returns `liked: true` for watches the viewer liked | unit | `npx vitest run tests/data/getBatchedWatchCounts.test.ts` | ✅ exists (needs new test cases) |
| GRID-01 | `getBatchedWatchCounts` returns `liked: false` for unwatched watches | unit | same | ✅ exists (needs new test cases) |
| GRID-01 | `toggleLikeAction` revalidates `viewer:{userId}:counts` tag | unit | `npx vitest run tests/actions/reactions.test.ts` | ✅ exists (needs new assertion) |
| GRID-02 | Sheet renders `CommentCompose` without `CommentList` (no thread) | structural | `npm run build` | build only |
| GRID-03 | `getBatchedWatchCounts` query count stays ≤6 (no N+1) | unit | `npx vitest run tests/data/getBatchedWatchCounts.test.ts` | ✅ existing test pattern covers budget |
| GRID-04 | Compose-only — no `CommentThread` or `CommentList` in sheet | structural | `npm run build` (TypeScript check) | build only |
| GRID-05 | `getBatchedWatchCounts` returns `canComment: false` for gated viewer on wishlist | unit | `npx vitest run tests/data/getBatchedWatchCounts.test.ts` | ✅ exists (needs new test cases) |
| GRID-05 | `addCommentAction` revalidates `viewer:{userId}:counts` tag | unit | `npx vitest run tests/actions/comments.test.ts` | ✅ exists (needs new assertion) |
| D-02 | Chip tap ≠ navigate (preventDefault + stopPropagation) | human_needed | prod (push → Vercel) | — |
| D-03 | Owner sees no chips; non-owner sees chips | human_needed | prod (push → Vercel) | — |
| D-05 | Optimistic flip then reconcile visible on prod | human_needed | prod (push → Vercel) | — |
| D-06 | Sheet opens on 💬 tap without navigating | human_needed | prod (push → Vercel) | — |
| D-07 | 'Comment posted' toast fires on success | human_needed | prod (push → Vercel) | — |
| D-12 | navigate-away/back shows fresh liked state | human_needed | prod (push → Vercel; cache fills needed) | — |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/data/getBatchedWatchCounts.test.ts tests/actions/reactions.test.ts tests/actions/comments.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run build` exit 0 before `/gsd-verify-work`

### Wave 0 Gaps

The existing test files already cover `getBatchedWatchCounts`, `toggleLikeAction`, and `addCommentAction`. The gaps are new test CASES within existing files, not new files:

- [ ] `tests/data/getBatchedWatchCounts.test.ts` — add test cases asserting `liked: true/false` in result and `canComment: true/false` in result; assert Q6 is in the query queue and total query count stays ≤6
- [ ] `tests/actions/reactions.test.ts` — add assertion that `revalidateTag` is called with `viewer:{userId}:counts` after a successful toggle
- [ ] `tests/actions/comments.test.ts` — add assertion that `revalidateTag` is called with `viewer:{userId}:counts` after a successful `addCommentAction`

Note: The existing `tests/data/getBatchedWatchCounts.test.ts` file structure (verified: uses a mock result queue consumed by call order) needs a Q6 slot added to each test's `mockResultQueue` setup. The mock will break with "unexpected queue dequeue" if Q6 is added to the implementation but the test queue is not updated.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — route is already auth-gated | Phase 51 Branch B auth gate |
| V3 Session Management | no — no new session handling | existing cookie auth unchanged |
| V4 Access Control | yes — comment gate (GATE-03/05) and IDOR prevention | service-role DAL + `createComment` throws `CommentGateError`; `toggleLikeAction` resolves ownerId server-side |
| V5 Input Validation | yes — comment body | `addCommentSchema` (Zod `.strict()`, `.trim().min(1).max(500)`) already in `addCommentAction`; `toggleLikeSchema` already in `toggleLikeAction` |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on like target | Spoofing/Tampering | `toggleLikeAction` resolves ownerId from DB (not client input); Zod `.strict()` rejects extra fields |
| IDOR on comment target | Tampering | `addCommentAction` resolves ownerId from DB; `createComment` re-checks `canViewerCommentOnTarget` server-side (D-10) |
| Comment gate bypass by UI manipulation | Elevation of Privilege | Chip hidden client-side is UX only; `createComment` throws `CommentGateError` is the real gate (D-10 defense-in-depth) |
| Cache poisoning (viewer A's liked state served to viewer B) | Information Disclosure | `viewer:{viewerId}:counts` tag isolates per-viewer entries in `getBatchedWatchCountsCached`; auth resolved OUTSIDE the `'use cache'` scope |
| XSS in comment body | Tampering | React escapes by default; DB `CHECK` + Zod max-500 limit already in place |

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on Phase 63 |
|------------|-------------------|
| **Next.js 16 App Router only** — read `node_modules/next/dist/docs/` before writing Next-specific code | `'use cache'` + `cacheTag` + `revalidateTag` patterns must follow Next 16.2.3 semantics (verified: existing usage in `reactions.ts` is correct model) |
| **Tech stack: Next.js 16 App Router — no rewrites** | No new routing; chips surface on existing `/u/[username]/[tab]` grid |
| **`workflow.use_worktrees = false`** (global, MEMORY) | Phase executes in main working tree; `.env.local` available |
| **`npm run build` is authoritative gate** | TypeScript errors in test files (~77 pre-existing) are noise; build exit 0 is the signal |
| **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT** | Do not touch this export |
| **Tailwind CSS 4 utility classes inline in JSX** — no CSS modules | Chip styling uses Tailwind classes inline (e.g., `absolute bottom-2 left-2 bg-black/55 rounded-full`) |
| **All domain types in `src/lib/types.ts`** | `WatchCounts` type is in `src/data/reactions.ts` (an extractor type), not `src/lib/types.ts` — this is correct for DAL-scoped types per existing pattern |
| **`'use client'` on components that use Zustand hooks** | `ProfileWatchCard` is already `'use client'`; the new chip behavior stays within client component |
| **Actions validated with early returns and `NextResponse.json`** | Server action schemas already use Zod `.strict()` — no new validation infrastructure needed |
| **No barrel files** | Import `WatchCommentSheet` (if created) directly, not via index |

---

## Sources

### Primary (HIGH confidence)
- `src/components/profile/ProfileWatchCard.tsx` — full read; line numbers verified against CONTEXT.md claims
- `src/data/reactions.ts` — full read; `WatchCounts` type, `getBatchedWatchCounts`, `getBatchedWatchCountsCached` verified; current 5-query budget confirmed
- `src/app/actions/reactions.ts` — full read; `toggleLikeAction` revalidation tags verified; `viewer:{userId}:counts` gap confirmed
- `src/app/actions/comments.ts` — full read; `addCommentAction` revalidation tags verified; `viewer:{userId}:counts` gap confirmed
- `src/components/shared/LikeButton.tsx` — full read; optimistic pattern verified
- `src/components/comment/CommentCompose.tsx` — full read; retains body on failure confirmed; clear-on-success is parent's job confirmed
- `src/components/comment/CommentList.tsx` — partial read; `composeKey` re-mount pattern verified; `handleSubmit` + optimistic insert pattern verified
- `src/components/wear/WearCommentHost.tsx` — full read; `type: 'wear' as const` hardcoding confirmed; bottom-sheet variant props confirmed
- `src/components/profile/CollectionTabContent.tsx` — full read; current `counts` prop shape (no `liked`/`canComment`) confirmed
- `src/components/profile/WishlistTabContent.tsx` — full read; `SortableProfileWatchCard` owner-only path confirmed; non-owner `ProfileWatchCard` path confirmed
- `src/components/profile/SortableProfileWatchCard.tsx` — full read; passes through `likeCount`/`commentCount` but not `liked`/`canComment` (not yet)
- `src/app/u/[username]/[tab]/page.tsx` (lines 180-406) — viewerId resolution pattern, `getBatchedWatchCountsCached` call, `counts` threading confirmed
- `src/data/comments.ts` — `canViewerCommentOnTarget`, `createComment` / `CommentGateError` confirmed
- `src/components/watch/WatchPhotoSection.tsx` (lines 62-100, 630-655) — Phase 62 sheet binding pattern confirmed
- `src/components/ui/sheet.tsx` — Sheet backed by `@base-ui/react Dialog` confirmed
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — cacheTag API confirmed
- `tests/data/getBatchedWatchCounts.test.ts` — existing test file and mock pattern confirmed
- `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)
- `src/app/u/[username]/[tab]/page.tsx` (full header + structure) — `unstable_instant = false` export confirmed; D-52-16 structural lock confirmed

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries already installed and used; no new dependencies
- Architecture: HIGH — all key files read and verified; D-12 cache gap confirmed in live code
- Pitfalls: HIGH — each pitfall is grounded in a verified code observation, not speculation
- Validation: HIGH — test files exist; specific gaps identified

**Research date:** 2026-05-27
**Valid until:** 2026-06-17 (30-day window; stable codebase, no fast-moving dependencies)

# Phase 57: Comment Thread UI + Feed Extension + Grid Counts — Research

**Researched:** 2026-05-23
**Domain:** React Server Components + Client Islands, Drizzle ORM, Next.js 16 `'use cache'` / cacheTag, optimistic UI patterns
**Confidence:** HIGH (all findings verified against live codebase and Next.js 16 docs in `node_modules/next/dist/docs/`)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**GATE-03 locked state:**
- D-01: Non-mutual-follower sees text + inline `FollowButton` (reuse `src/components/profile/FollowButton.tsx`). No link-to-profile-only or static text.
- D-02: Two-state copy — "Follow [username] to comment" (pre-follow) vs "[username] needs to follow you back before you can comment" (followed, not yet mutual). No explicit-upfront single message.
- D-03: Requires `ownerFollowsViewer` signal alongside `canViewerCommentOnTarget` boolean. Source from `src/data/follows.ts`.
- D-04: Comment count hidden from gated viewers — `getCommentsForTarget` already returns `[]`, no count leaked.

**Edit/Delete UX:**
- D-05: Always-visible pencil + trash icons on author's own comments (no hover). Non-authors see none.
- D-06: All-inline edit (textarea swap) and delete (inline "Delete? · Cancel" confirm). No AlertDialog/modal.
- D-07: `[edited]` indicator on the meta line (username/timestamp row), driven by `editedAt` from `editCommentAction`.

**Count surfacing:**
- D-08: `MessageCircle` icon + bare number, hidden at zero, in the footer action row next to `LikeButton` on `/watch/[id]` and `/wear/[id]`. On the wears-lane, badge the existing comment-trigger icon.
- D-09: Profile-grid line `♥ N · 💬 M` icons, each hidden at zero; whole line removed when both zero.
- D-10 (leak guard): Batched grid query respects comment gate per-watch for viewer. Like counts open (GATE-02). Comment half gated per `canViewerCommentOnTarget` semantics. No N+1.

**Feed comment-activity:**
- D-11: Verb-only feed copy "tyler commented on [Brand Model]". No comment preview. New verb `commented`.
- D-12 (correctness-critical): Wear comments and non-wishlist watch comments surface normally. Wishlist-watch comments surface only to viewers eligible (mutual-follow with target owner, or owner). Feed query needs per-row target-owner gate for comment rows — NOT actor gate.
- D-13: `addCommentAction` gains `logActivity` call (insert-only, never edit/delete). Wear comment carries wear target in `metadata`; no `wearEventId` column on `activities` table. TypeScript union widened; no SQL enum migration (activities.type is `text`).
- D-14: One row per comment, exempt from `feedAggregate` collapse (like `watch_worn`).

**Carried forward (binding):**
- Comment order = NEWEST-FIRST, compose above list, optimistic insert at TOP. CMNT-03/CMNT-08 in REQUIREMENTS.md and `getCommentsForTarget` DAL comment are STALE (say oldest-first). Reconcile this phase.
- Comments render UNCACHED — plain Server Component inside Suspense (Phase 55 D-06).
- Action contracts: `addCommentAction → ActionResult<Comment>` (incl. `id`, `createdAt`); `editCommentAction → ActionResult<Comment>` (incl. `editedAt`); `deleteCommentAction → ActionResult<{id}>`.
- Gate rejection = `{ success:false, error, code:'gate' }` — branch without string-matching (Phase 55 D-09).
- Optimistic = `useState` + `useTransition` + rollback, NOT `useOptimistic`. `disabled={pending}` blocks double-fire.
- 500-char triple-enforced: `maxLength` + Zod + DB CHECK.
- Comment host chrome already built: `WearCommentHost` bottom-sheet + inline (`src/components/wear/WearCommentHost.tsx`). Phase 57 fills the marked `{/* Phase 57: shared comment component renders here */}` seam in both.
- `profile:{username}` tag already invalidated by all three comment actions (Phase 55 D-07). Phase 57 only attaches `cacheTag()` on the grid read.
- Grandfather policy: gate keys off watch's CURRENT status (Phase 53 D-11).
- `'wear'` discriminator: DAL/action `CommentTarget` is `{ type: 'watch' | 'wear' }`, NOT `'wear_event'`.

### Claude's Discretion
- Shared comment component shape: one component with `target:{type,id}` + host-variant prop vs thin wrappers.
- Wear-detail layout: footer slot as trigger to scroll to compose box vs compose in footer.
- Char-counter reveal threshold (e.g., 450/500) and styling.
- Exact `ownerFollowsViewer` data plumbing (extra read vs piggyback on existing follow reads).
- Feed-row deep-link (specific comment anchor vs. target detail page).

### Deferred Ideas (OUT OF SCOPE)
- Bell/inbox rendering of comment notifications (Phase 58).
- Settings opt-out toggles `notifyOnLike`/`notifyOnComment` (Phase 58).
- Comment preview text in feed / reply threads / @mentions / liker-avatar strips (future SOC-F1..F5).
- Comment-thread caching (Phase 55 D-06 deliberately not built).
- Feed-row scroll-to-specific-comment deep link (nice-to-have, planner may skip).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMNT-01 | User can post a comment on a watch (subject to GATE-01) | `addCommentAction` + `createComment` DAL ready; compose UI new this phase |
| CMNT-02 | User can post a comment on a wear post | Same action, target `{type:'wear', id}` |
| CMNT-03 | Comments render newest-first, compose above list, author avatar + username + body + timestamp | STALE in REQUIREMENTS.md — authoritative order is newest-first per operator 2026-05-22; reconcile DAL `orderBy(asc...)` comment + REQUIREMENTS text |
| CMNT-04 | 500-char limit: input + Zod + DB CHECK; whitespace-only rejected | Already triple-enforced in Phase 53/55; UI `maxLength={500}` new this phase |
| CMNT-05 | Live character counter as user nears limit | Client-side `useState` counter in compose textarea |
| CMNT-06 | Author can edit own comment in place; `[edited]` indicator | `editCommentAction` returns `editedAt`; inline textarea swap |
| CMNT-07 | Author can delete via inline confirm; non-authors see neither control | `deleteCommentAction`; no modal (D-06) |
| CMNT-08 | New comment appears optimistically at top of list; reconciles on success / rolls back on failure | `useState`+`useTransition`+rollback pattern; insert at top (newest-first lock) |
| CMNT-09 | Comment count shown on watch/wear detail | `MessageCircle N` hidden-at-zero in footer row, mirrors LikeButton |
| GATE-03 | Non-mutual-follower sees locked-state CTA instead of compose box; no gated content visible | Two-state copy (D-02); `canViewerCommentOnTarget` + `ownerFollowsViewer` signal (D-03) |
| FEED-06 | Comment creates a feed activity visible to commenter's followers | `addCommentAction` gains `logActivity`; ActivityType widened; no SQL migration |
| FEED-07 | Comment on gated wishlist watch not surfaced to ineligible feed viewers | Per-row target-owner mutual-follow check in `getFeedForUser` WHERE clause (D-12) |
| DISP-01 | Profile grid cards show `♥ N · 💬 M` from single batched query (no N+1) | New batched DAL function joining like counts (open) + gated comment counts per watchId list |
</phase_requirements>

---

## Summary

Phase 57 is a UI-heavy phase with a narrow but correctness-critical backend surface. The full DAL and Server Action contracts were established in Phases 54–55; this phase consumes them without modification (one exception: `addCommentAction` gains a `logActivity` call for FEED-06). The three hard problems are not the comment UI itself — they are (1) the per-viewer feed gate for comment activities on gated wishlist watches (D-12), (2) the batched grid count query that asymmetrically gates the comment half (D-10), and (3) the stale comment-order reconciliation.

All component insertion points are pre-wired with marked seams (`WearCommentHost`, `WatchDetail` footer row). The optimistic mutation pattern, cache strategy, and action contracts are locked. The planner's main structural decisions are: shared-component shape for the comment thread, how `ownerFollowsViewer` is plumbed for the two-state GATE-03 copy, and where the wear-detail compose box lives relative to the Phase 56 footer slot.

**Primary recommendation:** Build one shared `<CommentThread>` component accepting `target: {type:'watch'|'wear', id}` + `viewerId` + gate state props. Render it as a plain Server Component inside Suspense (uncached). Wire the three host points in wave order: WearCommentHost (both variants) first (already has seams), then `/watch/[id]` detail (needs a host shell analogous to WearCommentHost). Tackle D-12 feed gate and D-10 batched grid query as dedicated DAL/action tasks before the UI wave.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Comment thread read (list) | API/Backend (Server Component) | — | Uncached Server Component in Suspense (Phase 55 D-06); auth + gate resolved server-side |
| Comment compose / edit / delete | Browser/Client | API/Backend (Server Action) | Optimistic `useState`+`useTransition`; Server Action is the gate backstop |
| GATE-03 locked-state UI | Browser/Client | API/Backend (gate check) | `canViewerCommentOnTarget` resolved server-side, passed as prop; `ownerFollowsViewer` resolved server-side |
| Feed activity logging (FEED-06) | API/Backend (Server Action) | — | `addCommentAction` calls `logActivity` server-side; no client involvement |
| Feed gate (FEED-07) | Database/Storage (DAL query) | — | Per-row SQL mutual-follow check in `getFeedForUser` |
| Grid counts (DISP-01) | API/Backend (DAL) | Browser/Client (display) | Single batched SQL query; `ProfileWatchCard` renders the line |
| Cache invalidation | API/Backend (Server Action) | — | `revalidateTag('profile:{username}', 'max')` already fires; Phase 57 attaches `cacheTag()` on grid read |

---

## Standard Stack

### Core (verified against codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.4 | Server Components, Suspense, `useTransition` | Project standard [VERIFIED: package.json] |
| Next.js | 16.2.3 | App Router, Server Actions, `'use cache'`, `cacheTag` | Project standard [VERIFIED: package.json] |
| Drizzle ORM | (project version) | SQL query building for DAL | Project standard [VERIFIED: src/data/*.ts] |
| Zod | (project version) | Server Action input validation | Project standard [VERIFIED: src/app/actions/comments.ts] |
| Tailwind CSS 4 | ^4 | Utility classes | Project standard [VERIFIED: package.json] |
| lucide-react | ^1.8.0 | `MessageCircle`, `Pencil`, `Trash2` icons | Project standard [VERIFIED: package.json] |

### Existing DAL / Action Assets (consumed as-is)

| Asset | File | Contract |
|-------|------|----------|
| `getCommentsForTarget` | `src/data/comments.ts:138` | Returns `Comment[]` newest-first (after reconciliation); `[]` for gated viewers |
| `canViewerCommentOnTarget` | `src/data/comments.ts:60` | Gate predicate for UI, compose, and grid count gating |
| `createComment` / `editComment` / `deleteComment` | `src/data/comments.ts` | DAL layer; consumed via Server Actions |
| `addCommentAction` | `src/app/actions/comments.ts:51` | `ActionResult<Comment>` incl `id`, `createdAt`; gains `logActivity` |
| `editCommentAction` | `src/app/actions/comments.ts:186` | `ActionResult<Comment>` incl `editedAt` |
| `deleteCommentAction` | `src/app/actions/comments.ts:243` | `ActionResult<{id: string}>` |
| `isMutualFollow` | `src/data/follows.ts:77` | Bidirectional in one query; used for `ownerFollowsViewer` |
| `isFollowing` | `src/data/follows.ts:54` | One-directional; used by FollowButton hydration |
| `getLikesForTarget` | `src/data/reactions.ts:29` | Single-query like count + viewer state |
| `logActivity` | `src/data/activities.ts:53` | Overloaded; Phase 57 adds `commented` overload/branch |
| `getFeedForUser` | `src/data/activities.ts:107` | Two-layer privacy query; needs `commented` row gate (D-12) |

---

## Architecture Patterns

### System Architecture Diagram

```
addCommentAction
  → createComment (DAL, gate check)
  → logActivity('commented', ...) [NEW — D-13]
  → revalidateTag('profile:{username}', 'max')  [already exists]

/watch/[id]/page.tsx (Server Component)
  → getCommentsForTarget(viewerId, target)  [UNCACHED, inside Suspense]
  → canViewerCommentOnTarget(viewerId, target)  [gate for compose box]
  → isFollowing(ownerId, viewerId)  [ownerFollowsViewer signal]
  → getLikesForTargetCached(viewerId, target)  [already exists]
  → [NEW] comment count from thread length (or separate count query)
  → passes initialComments, canComment, ownerFollowsViewer, viewerId to <CommentThread>

/wear/[wearEventId]/page.tsx (Server Component, via WearPhotoStreamed)
  → same pattern, target={type:'wear', id:wearEventId}
  → WearCard passes viewerId, wearEventId to WearCommentHost
  → WearCommentHost fills seam with <CommentThread>

/u/[username]/[tab]/page.tsx (collection/wishlist tab)
  → [NEW] getBatchedWatchCounts(viewerId, watchIds)
     → like counts (open, GROUP BY watchId from watch_likes)
     → comment counts (gated per canViewerCommentOnTarget semantics per watchId)
  → cacheTag('profile:{username}')  [already on ProfileShellResolver]
  → passes likeCount, commentCount per watch to ProfileWatchCard

Home feed (getFeedForUser)
  → existing: innerJoin follows + WHERE actor's profileSettings
  → [NEW]: OR clause for 'commented' rows: per-row mutual-follow check
    between viewerId and target owner for wishlist-watch comments
```

### Recommended File Structure

```
src/
├── components/
│   ├── comment/                    # NEW — comment-specific components
│   │   ├── CommentThread.tsx       # Shared thread (Server Component)
│   │   ├── CommentList.tsx         # Client island (optimistic list)
│   │   ├── CommentItem.tsx         # Single comment (author, body, edit/delete)
│   │   ├── CommentCompose.tsx      # Compose box (500-char, char counter)
│   │   └── CommentGateLocked.tsx   # GATE-03 two-state locked UI
│   └── profile/
│       └── ProfileWatchCard.tsx    # [EDIT] add ♥ N · 💬 M line
├── data/
│   ├── activities.ts               # [EDIT] logActivity + commented overload + feed gate
│   ├── comments.ts                 # [EDIT] reconcile orderBy direction + add desc read
│   └── reactions.ts                # [EDIT] add getBatchedWatchCounts (or new file)
├── lib/
│   └── feedTypes.ts                # [EDIT] ActivityType + RawFeedRow widen for 'commented'
└── app/
    ├── actions/
    │   └── comments.ts             # [EDIT] addCommentAction += logActivity
    ├── watch/[id]/
    │   └── page.tsx                # [EDIT] hydrate comment thread + gate state
    └── wear/[wearEventId]/
        └── page.tsx                # [EDIT] comment count for wear detail header/count
```

### Pattern 1: Uncached Server Component in Suspense (Comment Thread)

**What:** Comments resolve server-side, no `'use cache'`, wrapped in `<Suspense>` so the page does not block. The client island receives `initialComments` and runs optimistic mutations locally.

**When to use:** Any per-viewer-gated read where caching would risk leaking content across viewers (Phase 55 D-06).

```typescript
// Source: node_modules/next/dist/docs/01-app/ + Phase 55 D-06 decision
// Server Component (no 'use cache')
async function CommentThread({ viewerId, target, ...gateProps }) {
  // NOT cached — plain async Server Component
  const comments = await getCommentsForTarget(viewerId, target)
  // returns [] for gated viewers; no count leak
  return (
    <CommentList
      initialComments={comments}  // pass to client island
      viewerId={viewerId}
      target={target}
      {...gateProps}
    />
  )
}
// Usage:
<Suspense fallback={<CommentThreadSkeleton />}>
  <CommentThread viewerId={viewerId} target={target} canComment={canComment} ownerFollowsViewer={ownerFollowsViewer} />
</Suspense>
```

**CRITICAL:** Do NOT add `'use cache'` here. Phase 55 D-06 explicitly forbids it: shared cache would serve gated thread to non-mutual viewers. [VERIFIED: src/data/comments.ts:2 PRIVACY LAYER NOTE]

### Pattern 2: Optimistic Mutation — useState + useTransition + rollback

**What:** House pattern for all mutations (LikeButton, FollowButton). Client component maintains local list state. On submit: add optimistic item to top, fire `startTransition(action)`, reconcile on success, remove on rollback.

**When to use:** All comment add/edit/delete mutations. NOT `useOptimistic` (deliberate house choice, see FollowButton). [VERIFIED: src/components/shared/LikeButton.tsx, src/components/profile/FollowButton.tsx]

```typescript
// Source: src/components/shared/LikeButton.tsx (mirror pattern)
'use client'
const [comments, setComments] = useState<Comment[]>(initialComments)
const [pending, startTransition] = useTransition()

function handleSubmit(body: string) {
  const optimistic: Comment = {
    id: crypto.randomUUID(),  // temp id, replaced on reconcile
    authorId: viewerId,
    body,
    createdAt: new Date().toISOString(),
    editedAt: null,
    // ... other fields
  }
  setComments([optimistic, ...comments])  // INSERT AT TOP (newest-first)
  startTransition(async () => {
    const result = await addCommentAction({ type: target.type, id: target.id, body })
    if (!result.success) {
      // Rollback: remove the optimistic item
      setComments(comments)
      if (result.code === 'gate') { /* branch to GATE-03 locked state */ }
      return
    }
    // Reconcile: replace temp id with server-confirmed id + createdAt
    setComments(prev => prev.map(c => c.id === optimistic.id ? result.data : c))
  })
}
```

### Pattern 3: GATE-03 Two-State Locked UI

**What:** Two distinct states driven by `canComment` (gate result) + `ownerFollowsViewer`. Both resolved server-side before hydration.

```typescript
// Server-side plumbing (in page.tsx, alongside canViewerCommentOnTarget):
const canComment = await canViewerCommentOnTarget(viewerId, target)
// ownerFollowsViewer: needed only for watch targets with status=wishlist
// Use isFollowing(ownerId, viewerId) — note DIRECTION: owner→viewer
const ownerFollowsViewer = target.type === 'watch' && !canComment
  ? await isFollowing(watch.userId, viewerId)
  : false

// Client component CommentGateLocked receives { ownerUsername, ownerFollowsViewer, ownerUserId, viewerId }
// State 1 (viewerFollows=false): "Follow {ownerUsername} to comment" + <FollowButton variant="inline" />
// State 2 (viewerFollows=true, ownerFollows=false): "{ownerUsername} needs to follow you back before you can comment"
// Transition: FollowButton router.refresh() re-hydrates the page; canViewerCommentOnTarget re-evaluates
```

**Pitfall:** `isFollowing(ownerId, viewerId)` direction matters — owner→viewer, NOT viewer→owner. [VERIFIED: src/data/follows.ts:54]

### Pattern 4: Feed Gate for Comment Rows (D-12 — correctness-critical)

**What:** The existing `getFeedForUser` gates on the ACTOR's `profileSettings` (correct for `watch_added`/`wishlist_added`/`watch_worn` where actor=owner). For `commented` rows, actor ≠ owner; the gate must key off the TARGET OWNER's wishlist privacy.

**Exact approach:** Extend the SQL `WHERE` clause in `getFeedForUser` with a `commented`-specific branch:

```sql
-- Current (actor-keyed):
(activities.type = 'watch_added'     AND profile_settings.collection_public = true)
OR (activities.type = 'wishlist_added' AND profile_settings.wishlist_public = true)
OR (activities.type = 'watch_worn'     AND activities.metadata->>'visibility' IN ('public','followers'))

-- New (add):
OR (activities.type = 'commented' AND (
  -- Wear comments always surface (no wishlist concept on wears)
  activities.metadata->>'targetType' = 'wear'
  -- Non-wishlist watch comments surface normally
  OR (activities.metadata->>'targetType' = 'watch' AND activities.metadata->>'watchStatus' != 'wishlist')
  -- Wishlist watch comments: viewer must be mutual-follow with target owner
  OR (activities.metadata->>'targetType' = 'watch' AND activities.metadata->>'watchStatus' = 'wishlist'
      AND EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
        WHERE f1.follower_id = ${viewerId}
          AND f1.following_id = activities.metadata->>'targetOwnerId'
      ))
))
```

**Alternative approach:** Carry `watchStatus` + `targetOwnerId` in the comment activity metadata at log time (simpler join). This avoids a JOIN back to watches at query time. [ASSUMED based on existing metadata pattern in WatchWornMetadata; verify this is the cleanest approach]

**What goes in metadata for `commented` activity:**
```typescript
type CommentedMetadata = {
  brand: string
  model: string
  imageUrl: string | null
  targetType: 'watch' | 'wear'       // 'wear' not 'wear_event'
  targetOwnerId: string               // owner of the watch or wear
  watchStatus?: 'owned' | 'wishlist' | 'sold' | 'grail'  // only for watch targets
  // No wearEventId column on activities table — carry wear target in metadata
  wearEventId?: string               // only for wear targets (navigation link)
}
```

**Key insight:** The `activities` table has `watchId` column (nullable, `SET NULL` on delete) but NO `wearEventId` column. [VERIFIED: src/db/schema.ts:279-293] Wear comment activities therefore carry `wearEventId` in `metadata`, and the feed row renders `/wear/{metadata.wearEventId}` for navigation.

### Pattern 5: DISP-01 Batched Grid Count Query (no N+1)

**What:** Single query returning like count + comment count per watchId, respecting the asymmetric gate (likes open, comments gated).

**Shape:**
```typescript
// New DAL function in src/data/reactions.ts (or a new src/data/counts.ts)
export interface WatchCounts {
  likeCount: number
  commentCount: number  // 0 when viewer is gated (not mutual-follow on wishlist watches)
}

export async function getBatchedWatchCounts(
  viewerId: string,
  watchIds: string[],
): Promise<Map<string, WatchCounts>> {
  // Query 1: like counts (open — no gate)
  // SELECT watch_id, count(*) FROM watch_likes WHERE watch_id = ANY($watchIds) GROUP BY watch_id
  
  // Query 2: comment counts (gated per watch)
  // Approach A: subquery with canViewerCommentOnTarget logic inline (complex SQL but 1 round-trip)
  // Approach B: fetch watches' statuses first, apply gate in-JS, then count only for allowed watches
  
  // Approach B is cleaner for a batch:
  // 1. SELECT id, status, user_id FROM watches WHERE id = ANY($watchIds)
  // 2. For each watch: gate = (status!='wishlist') || (viewerId=ownerId) || isMutualFollow(viewerId, ownerId)
  //    BUT isMutualFollow per-watch would be N+1 again.
  // 3. Better: batch follows check:
  //    SELECT following_id FROM follows WHERE follower_id=$viewerId AND following_id = ANY($ownerIds)
  //    SELECT follower_id FROM follows WHERE following_id=$viewerId AND follower_id = ANY($ownerIds)
  //    Then compute mutual-follow in JS for each ownerUserId.
  
  // Full plan (3 queries, constant-count regardless of collection size):
  // Q1: watch statuses + ownerIds for the watchId list
  // Q2: batch follows (viewer→owners AND owners→viewer) for mutual-follow gate
  // Q3: comment counts for allowed watches + like counts for all watches (one aggregation query)
}
```

**cacheTag for grid read:** The grid count read should be attached with `cacheTag('profile:{username}')` inside a `'use cache'` wrapper, scoped to the profile. The existing `revalidateTag('profile:{username}', 'max')` in all three comment actions already invalidates this when comments change. [VERIFIED: src/app/actions/comments.ts:133, Phase 55 D-07]

**IMPORTANT NOTE on viewer scoping:** Like counts are viewer-agnostic (not viewer-specific — the LikeButton already handles the viewer's own liked-state separately). Comment count on gated watches IS viewer-scoped. The `cacheTag` MUST include the viewerId for the gated portion. Compare to `getLikesForTargetCached` which uses `viewer:{viewerId}:reactions` for per-viewer state. [VERIFIED: src/data/reactions.ts:146-152]

### Anti-Patterns to Avoid

- **Calling `canViewerCommentOnTarget` per-watch in a loop on the grid.** This is N+1. Batch the gate check using a single follows query over all ownerIds in the collection. [VERIFIED: src/data/follows.ts — isMutualFollow does 1 round-trip per call]
- **Putting `'use cache'` on the comment thread.** Phase 55 D-06 explicitly forbids this — gated threads must not be served from shared cache. [VERIFIED: src/data/comments.ts:2 PRIVACY LAYER NOTE]
- **Using `'wear_event'` as the target type discriminator.** The DAL, Zod schema, and action all use `'wear'`. [VERIFIED: src/app/actions/comments.ts:33, src/data/comments.ts:31]
- **Gating the comment feed row by the ACTOR's profileSettings.** The actor is the commenter, not the watch owner. Gate by the target owner's wishlist visibility, not by `profile_settings.wishlist_public` for the actor row. [VERIFIED: src/data/activities.ts:135-165 — current WHERE clause uses actor-based check]
- **Firing `logActivity('commented', ...)` in `editCommentAction` or `deleteCommentAction`.** D-13 locks this to INSERT-only, same as NOTIF-12. [VERIFIED: CONTEXT.md D-13]
- **Using `useOptimistic`.** House pattern is `useState` + `useTransition` + rollback. [VERIFIED: src/components/shared/LikeButton.tsx, src/components/profile/FollowButton.tsx]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Follow/unfollow CTA in locked state | Custom button | `FollowButton` from `src/components/profile/FollowButton.tsx` | Already has `viewerId:null` anon bounce, `disabled={pending}`, optimistic toggle, `variant="inline"` |
| Like count display pattern | Custom counter | Mirror `LikeButton` hidden-at-zero pattern exactly | D-08 mandates comment count mirrors LikeButton; Phase 56 established the convention |
| Feed activity logging | Custom insert | `logActivity` from `src/data/activities.ts` | Already handles the DB insert; just needs a new overload |
| Gate check | Inline SQL | `canViewerCommentOnTarget` from `src/data/comments.ts:60` | Single source of truth for UI, DAL, and grid count gating per Phase 54 D-04 |
| Mutual-follow check | Two `isFollowing` calls | `isMutualFollow` from `src/data/follows.ts:77` | Does both directions in a single round-trip; GATE-05 specifically forbids reusing `isFollowing` |
| Cache invalidation | New `revalidateTag` calls | Existing `revalidateTag('profile:{username}', 'max')` in comments.ts | Already fires on all three comment actions; grid count refresh is free |

---

## Deep-Dive Findings: The Eight Hard Parts

### 1. D-12 / FEED-07 — Per-Viewer Feed Gate (most likely leak)

**Verification:** [VERIFIED: src/data/activities.ts:107-195]

The current `getFeedForUser` inner WHERE clause:
```sql
(type = 'watch_added' AND profile_settings.collection_public = true)
OR (type = 'wishlist_added' AND profile_settings.wishlist_public = true)
OR (type = 'watch_worn' AND metadata->>'visibility' IN ('public','followers'))
```

All three branches gate by the ACTOR's `profileSettings` (the `innerJoin(profileSettings, eq(profileSettings.userId, activities.userId))` at line 130-131). This is correct for the existing three types because actor = watch owner.

**The break:** A `commented` activity's `userId` is the commenter (actor), not the watch owner. A public commenter can comment on a private person's wishlist watch (if mutual-follow). The comment activity MUST NOT appear in the feed for viewers who are not mutual-follow with the WATCH OWNER (not the commenter).

**Concrete implementation:** Carry `targetOwnerId` and `watchStatus` in the `commented` activity metadata at log time (in `addCommentAction` which already resolves `ownerId` and `watch.status` from the DB — lines 72-103 of comments.ts). At query time, the WHERE clause adds:
```sql
OR (type = 'commented' AND (
  metadata->>'targetType' = 'wear'   -- wear: always show
  OR metadata->>'watchStatus' != 'wishlist'  -- non-wishlist watch: always show
  OR (metadata->>'watchStatus' = 'wishlist' AND EXISTS (
    SELECT 1 FROM follows a, follows b
    WHERE a.follower_id = $viewerId
      AND a.following_id = (metadata->>'targetOwnerId')::uuid
      AND b.follower_id = (metadata->>'targetOwnerId')::uuid
      AND b.following_id = $viewerId
  ))
))
```

The `EXISTS` subquery is a self-join on `follows` for mutual-follow — equivalent to what `isMutualFollow` does. This runs once per feed row (not N+1 across rows — it's correlated but limited by the `EXISTS` short-circuit). For typical feed pages of 20 rows, this is acceptable. [ASSUMED: acceptable performance for ≤20 rows; no benchmarks available]

**Alternative:** A LEFT JOIN with two rows and a FILTER aggregate (like `isMutualFollow`) — cleaner SQL but harder to embed in a correlated subquery. The EXISTS approach is simpler to read in Drizzle.

**Critical note:** The OUTER gate (`innerJoin follows WHERE follower_id=$viewerId AND following_id=activities.userId`) ensures only followed actors' activities appear. For comment rows, the outer gate checks if viewerId follows the COMMENTER — this is intentional (followers of the commenter see their activity). The INNER gate then additionally restricts based on the target's visibility. Both layers must pass. [VERIFIED: src/data/activities.ts:129-135]

### 2. D-10 / DISP-01 — Batched Grid Counts (no N+1)

**Verification:** [VERIFIED: src/data/reactions.ts:29 — single-target; no existing batch query]

The current `getLikesForTarget` is a single-target function. The grid renders up to 500 watches (CLAUDE.md constraint). A per-card call would be N+1.

**Proposed batch approach (3 queries total):**
```typescript
// Step 1: Fetch watch rows for gate check (1 query)
const watchRows = await db
  .select({ id: watches.id, status: watches.status, userId: watches.userId })
  .from(watches)
  .where(inArray(watches.id, watchIds))

// Step 2: Batch follows for mutual-follow gate (2 SQL queries via Promise.all or 1 with OR)
const wishlistOwnerIds = watchRows
  .filter(w => w.status === 'wishlist' && w.userId !== viewerId)
  .map(w => w.userId)

// Get viewerId→owners AND owners→viewerId in one query:
const followRows = await db
  .select({
    aToB: sql`count(*) FILTER (WHERE follower_id = ${viewerId})::int`,
    bToA: sql`count(*) FILTER (WHERE following_id = ${viewerId})::int`,
    // Need per-owner breakdown... complex aggregate
  })
  // Better: two separate targeted queries
  const viewerFollowsOwners = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, wishlistOwnerIds)))
  const ownersFollowViewer = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followingId, viewerId), inArray(follows.followerId, wishlistOwnerIds)))
  
  // Compute mutual Set in JS — O(n)
  const viewerFollowsSet = new Set(viewerFollowsOwners.map(r => r.followingId))
  const ownersFollowSet = new Set(ownersFollowViewer.map(r => r.followerId))
  const mutualSet = new Set([...viewerFollowsSet].filter(id => ownersFollowSet.has(id)))

// Step 3: Like counts (all watches) + comment counts (allowed watches) in one query each
const likeCountRows = await db
  .select({
    watchId: watchLikes.watchId,
    count: sql<number>`count(*)::int`,
  })
  .from(watchLikes)
  .where(inArray(watchLikes.watchId, watchIds))
  .groupBy(watchLikes.watchId)

const allowedWatchIds = watchRows
  .filter(w =>
    w.userId === viewerId ||  // owner
    w.status !== 'wishlist' ||  // non-wishlist
    mutualSet.has(w.userId)    // mutual follow
  )
  .map(w => w.id)

const commentCountRows = await db
  .select({
    watchId: comments.watchId,
    count: sql<number>`count(*)::int`,
  })
  .from(comments)
  .where(and(
    inArray(comments.watchId, allowedWatchIds),
    // watchId is non-null for watch comments (DB CHECK ensures XOR)
    sql`${comments.watchId} IS NOT NULL`
  ))
  .groupBy(comments.watchId)
```

**Total queries:** 4 (watch rows, viewer→owners follows, owners→viewer follows, like counts, comment counts). That is 5 queries for the worst case when there are wishlist watches. For collections with no wishlist watches, `wishlistOwnerIds` is empty and the follows queries are skipped (3 queries). All are constant-count regardless of watchId list length (use `inArray` / `ANY()`). [VERIFIED: `inArray` from drizzle-orm used throughout codebase; no existing batch-count pattern found]

**Cache tag for grid read:** Wrap in a `'use cache'` function tagged `profile:{username}` (already on `ProfileShellResolver`). Include viewerId in the cache key to isolate the comment gate (wishlist-gated comment counts are viewer-specific). [VERIFIED: src/data/reactions.ts:145-152 getLikesForTargetCached pattern]

### 3. Comment Order Reconciliation

**Verification:** [VERIFIED: src/data/comments.ts:148, src/data/comments.ts:132-133, CONTEXT.md carried-forward, STATE.md line 68]

`getCommentsForTarget` currently uses `orderBy(asc(comments.createdAt))` with the comment `"(oldest first, CMNT-03)"`. REQUIREMENTS.md CMNT-03 says "oldest-first". Both are STALE.

**Authoritative source:** Operator decision 2026-05-22 (STATE.md line 68), ROADMAP SC1 ("comments appear newest-first"), CONTEXT.md carried-forward — newest-first, compose above, optimistic at top.

**Two reconciliation options:**
- Option A: Change DAL `orderBy(asc(...))` to `orderBy(desc(...))` — cleaner, single source of truth, no UI re-sorting.
- Option B: Keep DAL oldest-first, reverse array in the UI/Server Component.

**Recommendation:** Option A — change DAL to `desc`. The index on `(watch_id, created_at)` and `(wear_event_id, created_at)` supports both directions equally. Update the comment in comments.ts from "(oldest first, CMNT-03)" to "(newest first — CMNT-03 superseded by operator decision 2026-05-22, ROADMAP SC1)". Update REQUIREMENTS.md CMNT-03/08 text in the same commit. [VERIFIED: src/db/schema.ts:375-376 — indexes exist]

### 4. `addCommentAction` += `logActivity` (D-13)

**Verification:** [VERIFIED: src/app/actions/comments.ts:67-103 — `ownerId`, `watchBrand`, `watchModel`, `watch.status` already resolved for notification logging]

The action already resolves `ownerId` and watch metadata. Adding `logActivity` requires:

1. Widen `ActivityType` in `src/data/activities.ts:21` and `src/lib/feedTypes.ts:12` to include `'commented'`.
2. Add a `logActivity` overload for `'commented'`:
   ```typescript
   type CommentedMetadata = {
     brand: string; model: string; imageUrl: string | null
     targetType: 'watch' | 'wear'
     targetOwnerId: string
     watchStatus?: string   // only for watch targets
     wearEventId?: string   // only for wear targets
   }
   export async function logActivity(userId, type: 'commented', watchId, metadata: CommentedMetadata): Promise<void>
   ```
3. In `addCommentAction`, after `createComment` succeeds and before returning:
   ```typescript
   // Only log activity for non-self comments (same guard as notifications)
   if (ownerId !== user.id) {
     const imageUrl = target.type === 'watch'
       ? watchRow.imageUrl ?? null   // need to add imageUrl to the SELECT
       : watchRow?.imageUrl ?? null  // wear target's watch imageUrl
     await logActivity(user.id, 'commented',
       target.type === 'watch' ? target.id : null,  // watchId null for wear
       {
         brand: watchBrand, model: watchModel, imageUrl,
         targetType: target.type,
         targetOwnerId: ownerId,
         watchStatus: target.type === 'watch' ? watch.status : undefined,
         wearEventId: target.type === 'wear' ? target.id : undefined,
       }
     )
   }
   ```

**Note on `activities.watchId` for wear comments:** The `activities.watchId` FK references `watches.id`, ON DELETE SET NULL. For wear comments, `watchId` should be `null` (no direct watch FK). The wear target is in `metadata.wearEventId`. This is consistent with how the table is designed — it's optional, not required. [VERIFIED: src/db/schema.ts:285]

**Note on `activities.type` column:** It is `text('type').notNull()` — plain text, NOT an enum. [VERIFIED: src/db/schema.ts:284] TypeScript union widening is the only change needed; no SQL migration required. [CONFIRMED: CONTEXT.md D-13]

### 5. `ActivityRow.tsx` — `commented` verb + wear link branch

**Verification:** [VERIFIED: src/components/home/ActivityRow.tsx:11-15]

Current `VERBS` map:
```typescript
const VERBS: Record<RawFeedRow['type'], string> = {
  watch_added: 'added',
  wishlist_added: 'wishlisted',
  watch_worn: 'wore',
}
```

Phase 57 adds `commented: 'commented'`. The record type forces TypeScript to enumerate all `ActivityType` members — adding `'commented'` to the type union will surface a type error here unless the VERBS map is updated simultaneously. [VERIFIED: type system enforcement]

The watch-name link in the row body (`row.watchId ? <Link href={/watch/${row.watchId}}> : <span>`) needs a branch for wear comments:
- `row.watchId !== null` → link to `/watch/${row.watchId}` (existing)
- `row.watchId === null && row.metadata.wearEventId` → link to `/wear/${row.metadata.wearEventId}` (new)
- `row.watchId === null && !row.metadata.wearEventId` → plain span (defensive fallback)

`RawFeedRow.metadata` needs to extend to include `wearEventId?: string` for the navigation link. [VERIFIED: src/lib/feedTypes.ts:46-56 — metadata is a flat object with optional fields]

### 6. `feedAggregate.ts` — `commented` rows exempt

**Verification:** [VERIFIED: src/lib/feedAggregate.ts:21-23]

Current aggregatable check:
```typescript
const aggregatable = head.type === 'watch_added' || head.type === 'wishlist_added'
```

This already exempts `watch_worn` (not listed). Adding `'commented'` to `ActivityType` does NOT require any change here — it's not in the aggregatable list. The widened type union will not cause a type error because the check is a positive allowlist, not an exhaustive match. [VERIFIED: src/lib/feedAggregate.ts:21 — no TypeScript exhaustive switch]

### 7. WearCommentHost seam fill + compose-above reconciliation

**Verification:** [VERIFIED: src/components/wear/WearCommentHost.tsx:44, 60]

Both seams are clearly marked with `{/* Phase 57: shared comment component renders here */}`. The `wearEventId` prop is already threaded through and stored as `_wearEventId` (with eslint-disable comment for unused variable — ready to be used).

The `WearCommentHost` is a client component (receives server data via props) — it cannot directly `await` the comment thread. Phase 57's `<CommentThread>` is a Server Component. **The seam must be filled by making `WearCommentHost` accept `initialComments` + gate props as props from the server parent (WearPhotoStreamed → WearCard → WearCommentHost).** Alternatively, `WearCommentHost` calls a Server Component child by lifting the Suspense boundary up.

**Recommended approach:** Keep `WearCommentHost` as a client component for the sheet open/close state, but have the server parent (`WearPhotoStreamed` or a new server sibling) resolve `initialComments`, `canComment`, `ownerFollowsViewer` and pass them as props. The `CommentList` (client island) receives `initialComments` directly without needing to re-fetch. This avoids making `WearCommentHost` async (client components cannot be async in Next.js 16 App Router). [VERIFIED: src/app/wear/[wearEventId]/page.tsx:121-186 — WearPhotoStreamed is already an async Server Component, can add comment reads there]

### 8. Watch-detail host (new this phase)

**Verification:** [VERIFIED: src/components/watch/WatchDetail.tsx:153-163 — footer row at line 153-163 renders LikeButton in a `div` with `flex items-center gap-2 mt-3`]

`/watch/[id]/page.tsx` does not yet have a comment host. Phase 57 must:
1. Add comment thread read to `page.tsx` server phase (alongside the existing `getLikesForTargetCached` call).
2. Pass `initialComments`, `canComment`, `ownerFollowsViewer` down through `WatchDetail` props OR render `<CommentThread>` as an RSC sibling of `<WatchDetail>` (preferred — matches the B1 pattern of RSC siblings below `WatchDetail`).
3. Add `MessageCircle N` comment count to the footer action row in `WatchDetail.tsx` (client component, so count must be a prop).

**RSC sibling pattern** (B1, used for `SameFamilyRail` / `LineageRail` — lines 117-118 in watch/[id]/page.tsx) is preferred: render `<CommentThreadHost viewerId={userId} target={{type:'watch', id}} />` as a Server Component below `<WatchDetail>` in the page, not inside the client island. This avoids threading async data through the client component boundary. [VERIFIED: src/app/watch/[id]/page.tsx:117-118]

---

## Common Pitfalls

### Pitfall 1: `'wear_event'` leaking in target type
**What goes wrong:** Action Zod schema and DAL both use `'wear'`; any code using `'wear_event'` as the type string silently creates non-matching targets or metadata.
**Root cause:** The `comments` table has a `wearEventId` column (DB name) but the DAL/action type discriminator is `'wear'`.
**How to avoid:** Check EVERY use of the target discriminator string. The Zod enum in `addCommentAction` explicitly says `z.enum(['watch', 'wear'])`. [VERIFIED: src/app/actions/comments.ts:33]
**Warning signs:** Feed rows with `targetType: 'wear_event'` in metadata (would never match the gate branch).

### Pitfall 2: Inserting optimistic comment at bottom instead of top
**What goes wrong:** REQUIREMENTS.md CMNT-08 says "bottom" — but this is the STALE version. Newest-first with compose-above means optimistic inserts go at TOP.
**Root cause:** CMNT-08 is flagged STALE in CONTEXT.md; the authoritative source is ROADMAP SC4 + operator decision.
**How to avoid:** In the client island: `setComments([optimistic, ...comments])` not `[...comments, optimistic]`.

### Pitfall 3: Calling `isMutualFollow` in a loop for grid counts
**What goes wrong:** `isMutualFollow(viewerId, ownerId)` is one DB round-trip per call — N+1 on a 500-watch grid.
**Root cause:** The existing `isMutualFollow` in follows.ts is designed for single-pair checks.
**How to avoid:** Batch the follows reads with `inArray` (see Pattern 5 above).

### Pitfall 4: Missing `wearEventId` in commented activity metadata navigation
**What goes wrong:** Feed row for a wear comment has `watchId = null` on the activity row (no wearEventId column). `ActivityRow` renders no link for the watch name.
**Root cause:** `activities` table has `watchId` but no `wearEventId` column. [VERIFIED: src/db/schema.ts:285]
**How to avoid:** Always carry `wearEventId` in `metadata` for wear-type comment activities. Extend `RawFeedRow.metadata` to include `wearEventId?: string`.

### Pitfall 5: Actor-gate passing for the comment feed row
**What goes wrong:** If the actor (commenter) has `profilePublic=true` and `collectionPublic=true`, their commented activity on a private wishlist watch would pass the existing WHERE clause (the existing gate uses actor's settings).
**Root cause:** Current WHERE only covers the three original activity types with actor=owner assumption.
**How to avoid:** The new `commented` branch must add a target-owner visibility check (see D-12 approach above).

### Pitfall 6: `revalidateTag` not fired in `deleteCommentAction`
**What goes wrong:** Delete does not update the grid count badge.
**Root cause:** `deleteCommentAction` in comments.ts currently does NOT resolve the owner and call `revalidateTag`. [VERIFIED: src/app/actions/comments.ts:243-268 — no revalidateTag call in delete action]

Wait — checking again...

[RE-VERIFIED: src/app/actions/comments.ts:243-268] — `deleteCommentAction` returns `{success:true, data:{id}}` and logs no notification — BUT it does NOT call `revalidateTag`. This is a Phase 55 gap; the grid count will not refresh after deletion. Phase 57 must add `revalidateTag` to `deleteCommentAction` (the owner's username must be resolved from the commentId — requires a DB read of the comment row before deletion, or adjusting the DAL to return the deleted row).

**Actually:** The DAL `deleteComment` returns `void`. To get the owner for `revalidateTag`, `deleteCommentAction` would need to first SELECT the comment, then delete it. Pattern: read-then-delete (Phase 55's `editCommentAction` does this for `editedAt`). [VERIFIED: src/app/actions/comments.ts:208-231 — editCommentAction resolves owner via `comment.watchId` or `comment.wearEventId`]

### Pitfall 7: Cache stale after CSS changes
**Warning:** Per MEMORY.md `project_turbopack_next_cache_stale_css.md` — dev server restart alone doesn't invalidate `.next/`. Clear it with `rm -rf .next` before concluding a CSS fix failed.

### Pitfall 8: Bottom-sheet overlay z-index
**Warning:** Per MEMORY.md `feedback_ui_spec_css_chain_blind_spot.md` — the wears-lane bottom-sheet renders over a photo. Assert the full CSS chain (z-index, backdrop, overlay) and clear `.next/` before judging. Phase 30 shipped a black-bar through a 6/6 PASS because the CSS chain wasn't explicitly asserted.

---

## Code Examples

### Existing action shape (verified, consumed as-is)

```typescript
// Source: src/app/actions/comments.ts:51 — ActionResult<Comment>
export async function addCommentAction(data: unknown): Promise<ActionResult<Comment>>
export async function editCommentAction(data: unknown): Promise<ActionResult<Comment>>
export async function deleteCommentAction(data: unknown): Promise<ActionResult<{ id: string }>>

// gate rejection: { success: false, error: '...', code: 'gate' }
// Source: src/lib/actionTypes.ts:8 — code is optional string
```

### LikeButton hidden-at-zero pattern (mirror for comment count)

```typescript
// Source: src/components/shared/LikeButton.tsx:113-125
{(liked || count > 0) && (
  <span className={cn('text-sm tabular-nums', liked ? 'text-destructive' : 'text-muted-foreground')}>
    {count}
  </span>
)}
// Comment count mirror:
{count > 0 && (
  <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
)}
```

### cacheTag on grid read (mirror reactions.ts pattern)

```typescript
// Source: src/data/reactions.ts:145-152
export async function getBatchedWatchCountsCached(
  viewerId: string,
  watchIds: string[],
  profileUsername: string,  // for cacheTag
): Promise<Map<string, WatchCounts>> {
  'use cache'
  cacheTag(`profile:${profileUsername}`, `viewer:${viewerId}:counts`)
  return getBatchedWatchCounts(viewerId, watchIds)
}
```

### ActivityType widening (minimal diff)

```typescript
// Source: src/data/activities.ts:21 AND src/lib/feedTypes.ts:12 — must both be updated
// BEFORE:
export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'
// AFTER:
export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn' | 'commented'
// NOTE: Two files define ActivityType. They MUST stay in sync (or be deduplicated into one).
// [VERIFIED: src/data/activities.ts:21 and src/lib/feedTypes.ts:12 both define ActivityType identically]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CMNT-03/08: oldest-first, compose below | Newest-first, compose above, optimistic at top | 2026-05-22 operator decision | REQUIREMENTS.md + DAL comment STALE; must reconcile in Phase 57 |
| `revalidateTag(tag)` single-arg | `revalidateTag(tag, 'max')` two-arg (deprecated single-arg) | Next.js 16 | All existing usage in codebase already uses two-arg form; new code must too [VERIFIED: src/app/actions/comments.ts:133] |
| `useOptimistic` | `useState` + `useTransition` + rollback | House decision | All client mutations in this codebase use this pattern; do NOT introduce `useOptimistic` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EXISTS subquery for per-row mutual-follow check in `getFeedForUser` is acceptable for ≤20 feed rows | D-12 feed gate approach | Performance issue on large feeds; mitigate by limiting commented rows to EXISTS short-circuit |
| A2 | `imageUrl` is resolvable server-side for the commented activity (watch's `imageUrl` column) | D-13 logActivity | Feed row shows no thumbnail if imageUrl unavailable; not a correctness issue, cosmetic only |
| A3 | `deleteCommentAction` gap (no revalidateTag) is a Phase 55 oversight that Phase 57 should fix | Pitfall 6 | If intentional (maybe DISP-01 grid count update not required on delete?), this adds an unnecessary DB read |

---

## Open Questions

1. **`deleteCommentAction` + `revalidateTag`**
   - What we know: `editCommentAction` resolves owner + calls `revalidateTag`. `deleteCommentAction` does not (verified against source).
   - What's unclear: Was this intentional (grid count not refreshed on delete is acceptable) or an oversight?
   - Recommendation: Treat as an oversight — add the owner lookup + `revalidateTag` to `deleteCommentAction` to keep grid counts accurate. Planner: confirm and add to the action edit task.

2. **Two `ActivityType` definitions**
   - What we know: Both `src/data/activities.ts:21` and `src/lib/feedTypes.ts:12` define `ActivityType` with identical values.
   - What's unclear: Should they be deduplicated (one import the other) or kept separate?
   - Recommendation: Deduplicate in Phase 57 — have `feedTypes.ts` import from `activities.ts` (or vice versa). This prevents them diverging again. Low risk refactor.

3. **`watchId` in addCommentAction SELECT for logActivity**
   - What we know: The current `addCommentAction` SELECT for watch target resolves `userId`, `brand`, `model` (line 74-83). It does NOT select `imageUrl` or `status`.
   - What's unclear: The `logActivity` metadata needs `imageUrl` (for feed thumbnail) and `watchStatus` (for the D-12 gate).
   - Recommendation: Extend the existing SELECT in `addCommentAction` to also fetch `imageUrl` and `status` from the watches row. Low-risk addition to existing query.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 57 is purely code changes (Next.js App Router, TypeScript, Tailwind CSS, Drizzle ORM). No external CLI tools, services, or runtimes beyond the existing project stack. All dependencies are in `package.json` and confirmed installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMNT-01/02 | `addCommentAction` returns `ActionResult<Comment>` with id + createdAt | unit (mock DAL) | `npm run test -- tests/actions/addCommentAction.test.ts` | ❌ Wave 0 |
| CMNT-03 | Comments render newest-first (DAL returns desc order) | unit (mock db) | `npm run test -- tests/data/getCommentsForTarget.test.ts` | ❌ Wave 0 |
| CMNT-04 | 500-char enforcement at Zod layer; whitespace rejection | unit | same file | ❌ Wave 0 |
| CMNT-06 | `editCommentAction` returns Comment with editedAt set | unit (mock DAL) | `npm run test -- tests/actions/editCommentAction.test.ts` | ❌ Wave 0 |
| CMNT-07 | `deleteCommentAction` returns `{id}` | unit (mock DAL) | `npm run test -- tests/actions/deleteCommentAction.test.ts` | ❌ Wave 0 |
| CMNT-08 | Optimistic insert at top; rollback on failure | manual (browser) | n/a | manual_only: React component interaction requires real browser; optimistic timing not testable in jsdom |
| CMNT-09 | Comment count present in response from `getCommentsForTarget` | unit | tests/data/getCommentsForTarget.test.ts | ❌ Wave 0 |
| GATE-03 | `canViewerCommentOnTarget` returns false for non-mutual on wishlist | unit | `npm run test -- tests/data/comments.test.ts` (extend existing) | ❌ check if exists |
| FEED-06 | `addCommentAction` calls `logActivity` with `commented` type | unit (spy on logActivity) | tests/actions/addCommentAction.test.ts | ❌ Wave 0 |
| FEED-07 | `getFeedForUser` does NOT return commented-on-wishlist-watch rows for non-eligible viewers | unit (mock db) | `npm run test -- tests/data/getFeedForUser.test.ts` | ✅ exists — add test case |
| DISP-01 | `getBatchedWatchCounts` returns 0 comment count for gated wishlist watches | unit (mock db) | `npm run test -- tests/data/getBatchedWatchCounts.test.ts` | ❌ Wave 0 |
| SEC-05 | Comment thread does not leak across viewers (no cacheTag on thread) | manual (code review) | n/a | manual_only: structural property verified by code review, not runtime test |

### Correctness-Critical Test Seams

**FEED-07 gate leak test (highest priority):**
- Scenario: User A (viewer) follows User B (commenter). User B comments on User C's wishlist watch. A and C are NOT mutual followers.
- Expected: A's feed does NOT contain B's comment activity row.
- Test approach: mock `db.select` to return a `commented` row with `metadata.watchStatus='wishlist'` and `metadata.targetOwnerId=C`. Assert the WHERE clause in `getFeedForUser` rejects it. [VERIFIED: existing getFeedForUser.test.ts uses mock chain pattern — extend with this case]

**DISP-01 count-gate leak test:**
- Scenario: Viewer X is not mutual-follow with watch owner Y. Watch is `wishlist` status.
- Expected: `getBatchedWatchCounts(X, [watchId])` returns `commentCount: 0`.
- Test approach: mock watch row with `status:'wishlist'`, mock follows to show no mutual follow, assert comment count is 0. [VERIFIED: existing mock db pattern in getFeedForUser.test.ts can be reused]

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test && npm run build`
- **Phase gate:** Full suite green + prod visual verification (per MEMORY.md `feedback_mobile_ui_verify_on_prod.md` — mobile/visual confirmed on prod after Vercel deploy)

### Wave 0 Gaps

- [ ] `tests/actions/addCommentAction.test.ts` — covers CMNT-01, CMNT-02, FEED-06 (spy on logActivity)
- [ ] `tests/actions/editCommentAction.test.ts` — covers CMNT-06
- [ ] `tests/actions/deleteCommentAction.test.ts` — covers CMNT-07
- [ ] `tests/data/getCommentsForTarget.test.ts` — covers CMNT-03 (desc order), CMNT-04
- [ ] `tests/data/getBatchedWatchCounts.test.ts` — covers DISP-01 no-N+1 + comment-count gate leak
- [ ] Extend `tests/data/getFeedForUser.test.ts` — add FEED-07 gated wishlist comment case

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` in all three Server Actions (Phase 55 — already complete) |
| V3 Session Management | no | No new session state |
| V4 Access Control | yes | `(id, authorId)` WHERE in edit/delete (IDOR-safe); `canViewerCommentOnTarget` gate |
| V5 Input Validation | yes | Zod `.strict()` on all three schemas; `maxLength={500}` in UI |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Feed content leak (wishlist comment surfaced to ineligible viewer) | Information Disclosure | Per-row target-owner mutual-follow check in `getFeedForUser` (D-12) |
| Grid comment count leak (non-mutual viewer sees comment count on wishlist watch) | Information Disclosure | Gate comment half of batched query per `canViewerCommentOnTarget` semantics (D-10) |
| IDOR on edit/delete (viewer edits/deletes another user's comment) | Tampering | `WHERE (id, authorId) = ($commentId, $userId)` in DAL (Phase 54 — already enforced) |
| Double-submit optimistic race | Tampering | `disabled={pending}` on submit button — verified pattern in LikeButton |
| Cache cross-viewer leak | Information Disclosure | Comment thread NOT cached (`'use cache'` forbidden per Phase 55 D-06); grid counts use viewer-scoped tag |
| Stale gate: comment submitted between render and action | Tampering | `createComment` re-checks `canViewerCommentOnTarget` DAL-side (Phase 54); action gate is the race backstop |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: src/data/comments.ts] — getCommentsForTarget, canViewerCommentOnTarget, CommentGateError, all contracts
- [VERIFIED: src/data/activities.ts] — getFeedForUser full implementation, ActivityType, logActivity overloads
- [VERIFIED: src/data/follows.ts] — isMutualFollow, isFollowing
- [VERIFIED: src/data/reactions.ts] — getLikesForTarget, getLikesForTargetCached, cacheTag pattern
- [VERIFIED: src/app/actions/comments.ts] — addCommentAction, editCommentAction, deleteCommentAction, logNotification call
- [VERIFIED: src/lib/feedTypes.ts] — RawFeedRow, ActivityType (second definition)
- [VERIFIED: src/lib/feedAggregate.ts] — aggregatable type list, watch_worn exempt precedent
- [VERIFIED: src/components/home/ActivityRow.tsx] — VERBS map, row composition pattern
- [VERIFIED: src/components/profile/FollowButton.tsx] — optimistic pattern, viewerId:null bounce, variant='inline'
- [VERIFIED: src/components/shared/LikeButton.tsx] — hidden-at-zero count pattern, useState+useTransition
- [VERIFIED: src/components/wear/WearCommentHost.tsx] — seam markers, discriminated-union props
- [VERIFIED: src/components/wear/WearCard.tsx] — engagement row, comment trigger, host wiring
- [VERIFIED: src/components/watch/WatchDetail.tsx] — LikeButton footer row location
- [VERIFIED: src/components/profile/ProfileWatchCard.tsx] — CardContent text block location
- [VERIFIED: src/app/watch/[id]/page.tsx] — RSC sibling pattern (SameFamilyRail / LineageRail)
- [VERIFIED: src/app/wear/[wearEventId]/page.tsx] — WearPhotoStreamed async server component
- [VERIFIED: src/db/schema.ts] — activities.type is text not enum (line 284); activities has watchId not wearEventId; comments table shape
- [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md] — cacheTag API
- [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md] — two-arg form, `'max'` profile

### Secondary (MEDIUM confidence)

- [CITED: .planning/phases/57-comment-thread-ui-feed-extension-grid-counts/57-CONTEXT.md] — all D-XX decisions
- [CITED: .planning/REQUIREMENTS.md] — CMNT-03/08 stale status confirmed
- [CITED: .planning/ROADMAP.md §Phase 57] — SC1-SC7 authoritative success criteria
- [CITED: .planning/STATE.md line 68] — operator newest-first decision 2026-05-22

---

## Metadata

**Confidence breakdown:**
- DAL/action contracts: HIGH — all verified against source files
- Feed gate approach (D-12): MEDIUM — approach verified against query structure; specific SQL formulation is a recommendation [A1]
- Batched grid count approach (D-10): MEDIUM — pattern verified against existing code; exact formulation is a recommendation
- Cache strategy: HIGH — pattern verified against reactions.ts + cacheTag docs + existing revalidateTag usage
- Pitfall 6 (deleteCommentAction gap): HIGH — verified by reading source; flagged as a gap to fix

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (30 days; stable codebase with no external churn)

---
phase: 27-watch-card-collection-render-polish
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - drizzle/0006_phase27_sort_order.sql
  - drizzle/meta/0006_snapshot.json
  - drizzle/meta/_journal.json
  - package.json
  - src/app/actions/__tests__/reorderWishlist.test.ts
  - src/app/actions/watches.ts
  - src/app/actions/wishlist.ts
  - src/components/profile/CollectionTabContent.tsx
  - src/components/profile/ProfileWatchCard.tsx
  - src/components/profile/SortableProfileWatchCard.tsx
  - src/components/profile/WishlistTabContent.test.tsx
  - src/components/profile/WishlistTabContent.tsx
  - src/components/profile/__tests__/CollectionTabContent.test.tsx
  - src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx
  - src/data/watches.ts
  - src/db/schema.ts
  - src/lib/types.ts
  - supabase/migrations/20260504120000_phase27_sort_order.sql
  - tests/integration/phase27-backfill.test.ts
  - tests/integration/phase27-bulk-reorder.test.ts
  - tests/integration/phase27-getwatchesbyuser-order.test.ts
  - tests/integration/phase27-schema.test.ts
findings:
  blocker: 2
  warning: 5
  total: 7
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 27 implementation hits the security checklist for the documented threat model (T-27-01 mass-assignment, T-27-02 status confusion, T-27-03 length cap). Defense-in-depth at three layers (Zod `.strict()` + session `getCurrentUser()` + DAL WHERE+count check) is sound for the bulk reorder path. Tests cover the auth/owner/length matrix.

However, two correctness issues need to ship-block:

1. **Partial-set reorder data corruption (BR-01)** — `bulkReorderWishlist` only validates that `updated.length === orderedIds.length`. It does NOT validate that `orderedIds` is the COMPLETE wishlist+grail set for the user. A stale client (race with another tab) can send a partial set; the unsent rows retain their old `sort_order` and collide with the freshly-assigned 0..N range. The `createdAt DESC` tiebreaker in `getWatchesByUser` masks the duplicate from crashing, but UI ordering becomes non-deterministic across renders.
2. **`revalidatePath` argument mismatch (BR-02)** — `reorderWishlist` calls `revalidatePath('/u/[username]/wishlist', 'page')`, but the actual Next.js route is `/u/[username]/[tab]` (verified via `src/app/u/[username]/[tab]/page.tsx`). The literal `wishlist` segment does NOT match the dynamic `[tab]` segment, so revalidation silently no-ops. The optimistic UI happens to mask this (auto-reverts on failure, server state isn't read again on success because the user stays on the page), but anyone clicking back into the tab will see stale order from cache.

Five additional warnings, including a client-controllable `sortOrder` mass-assignment surface in `addWatch`/`editWatch`, an asymmetric drop-indicator UX in `SortableProfileWatchCard`, and minor concerns around error string-matching brittleness.

The migration backfill, drag/drop sensor configuration, optimistic UI rollback, and price-line logic all check out.

## Critical Issues

### BR-01: `bulkReorderWishlist` does not enforce that `orderedIds` is the complete user wishlist+grail set

**File:** `src/data/watches.ts:288-320`
**Severity:** BLOCKER

**Issue:**
The DAL helper validates that every id in `orderedIds` belongs to the user and is in wishlist/grail status (`updated.length !== orderedIds.length` ⇒ throw). It does NOT check that `orderedIds.length` equals the user's total wishlist+grail count.

If the client sends a strict subset (e.g., due to a race with a concurrent add/remove in another tab), the unsent rows retain their pre-existing `sort_order` while the sent rows get 0..N-1. Two rows can end up with the same `sort_order`, breaking the post-migration assertion in `supabase/migrations/20260504120000_phase27_sort_order.sql:54-70` ("no duplicate (user_id, sort_order) tuples in wishlist+grail").

The `getWatchesByUser` `ORDER BY sort_order ASC, created_at DESC` tiebreaker prevents a query crash but makes UI order observably non-deterministic — refreshing can shuffle siblings within the duplicate slot.

**Concrete scenario:**
1. Tab A loads with watches `[a, b, c]` (sort 0,1,2).
2. Tab B adds watch `d` (lands at sort 3 via `getMaxWishlistSortOrder + 1`).
3. Tab A's user reorders to `[c, b, a]` and submits `orderedIds: [c, b, a]`.
4. After update: `c=0, b=1, a=2, d=3` — fine in this case.
5. BUT if Tab B had reordered first (`d=0, a=1, b=2, c=3`) and Tab A then submits `[c, b, a]`: post-update `c=0, b=1, a=2, d=0` — collision.

**Fix:**
Either (a) compare against the user's total wishlist+grail count, or (b) add a UNIQUE partial index on `(user_id, sort_order) WHERE status IN ('wishlist','grail')` and let the constraint reject the violation:

```ts
// Option A — count check
const total = await db
  .select({ c: sql<number>`count(*)::int` })
  .from(watches)
  .where(
    and(
      eq(watches.userId, userId),
      inArray(watches.status, ['wishlist', 'grail']),
    ),
  )
if ((total[0]?.c ?? 0) !== orderedIds.length) {
  throw new Error(
    `Stale reorder: expected ${total[0]?.c ?? 0} ids, received ${orderedIds.length}`,
  )
}
```

Option A is preferable because it preserves the single-round-trip envelope; option B would force a separate migration and conflict with the existing default-0 column.

---

### BR-02: `revalidatePath` uses literal `'wishlist'` segment that does not match dynamic `[tab]` route

**File:** `src/app/actions/wishlist.ts:199`
**Severity:** BLOCKER

**Issue:**
```ts
revalidatePath('/u/[username]/wishlist', 'page')
```
The actual Next.js route is `/u/[username]/[tab]/page.tsx`. The literal segment `wishlist` is not a route — Next.js requires the dynamic placeholder `[tab]` (or the fully-resolved concrete path `/u/<username>/wishlist`).

Per Next.js docs (and verified in `node_modules/next/dist/server/web/spec-extension/revalidate.d.ts`), `revalidatePath` matches against the route definition, not arbitrary URLs. Passing a non-matching path silently no-ops — there is no thrown error or warning.

**Effect:** the reorder Server Action does NOT actually invalidate the wishlist tab cache. The optimistic UI hides this on the same page (the optimistic state stays correct until the next page load), but:
- Navigating away and back returns the cached pre-reorder order.
- `revalidatePath` was the only mechanism in the action to fan out the new order to follower views (those are gated by `wishlist_public` but cached per-viewer).
- The behavior contradicts the comment on lines 196-198 ("…revalidatePath strips the params; the second arg 'page' invalidates the entire page-level render for that route") — the strip behavior only applies when the dynamic placeholder syntax is used.

**Fix:**
```ts
// Use the dynamic-route form so all wishlist tab variants invalidate.
// Pattern matches addToWishlistFromWearEvent('/') and the addWatch action.
revalidatePath('/u/[username]/[tab]', 'page')
```

If only the wishlist tab should invalidate (not the collection tab on `[tab]=collection`), pass the concrete user path:
```ts
const profile = await getProfileById(user.id)  // already imported elsewhere
if (profile?.username) {
  revalidatePath(`/u/${profile.username}/wishlist`)
}
```

## Warnings

### WR-01: Client-controllable `sortOrder` bypasses server-side ordering policy in `addWatch`/`editWatch`

**File:** `src/app/actions/watches.ts:46`, `:93-97`, `:308-317`
**Severity:** WARNING

**Issue:**
The `insertWatchSchema` accepts `sortOrder: z.number().int().optional()`. The action overwrites it ONLY when:
- `addWatch`: status is `wishlist` or `grail` (line 94-97)
- `editWatch`: status is wishlist/grail AND prior status was NOT wishlist/grail (line 309-317)

In all other paths — including the common "user edits an existing wishlist watch" case — the client-supplied `sortOrder` is passed through to `mapDomainToRow`, which writes it to the DB (`src/data/watches.ts:88-89`). The comment on line 92-93 claims "Server-side overwrites any client sortOrder," but this only holds for the two transitions above.

**Attack/error scenarios:**
1. A malicious client edits their own wishlist watch with `{status: 'wishlist', sortOrder: -999999}` — bypasses `bulkReorderWishlist`'s 500-id cap to force the watch to the top of the user's own list.
2. A malicious client sets `sortOrder: 2147483647` on an `owned` watch. Currently no UI surfaces owned-tab reorder, but a future Collection-tab reorder phase (deferred per CONTEXT) will inherit poisoned data.
3. A buggy client serializes `sortOrder` from a stale `Watch` shape and clobbers the server-computed value during a non-status edit.

The schema explicitly accepting `sortOrder` is documented (line 42-46 comment) as "passed through after computing maxSort + 1 server-side" — but the `editWatch` path leaves it as-is for within-group edits, which directly contradicts D-04.

**Fix:**
Strip `sortOrder` from `parsed.data` BEFORE mapping to row, except in the two transitions where the action explicitly sets it:

```ts
// addWatch — replace lines 93-99 with:
const { sortOrder: _ignored, ...clientData } = parsed.data
let createPayload = clientData
if (clientData.status === 'wishlist' || clientData.status === 'grail') {
  const maxSort = await watchDAL.getMaxWishlistSortOrder(user.id)
  createPayload = { ...clientData, sortOrder: maxSort + 1 }
}
```

Apply the same pattern in `editWatch`. Or remove `sortOrder` from `insertWatchSchema` entirely and expose a typed internal interface for the action↔DAL contract.

---

### WR-02: Drop-indicator UX is asymmetric and renders before the wrong slot

**File:** `src/components/profile/SortableProfileWatchCard.tsx:64-65`, `:69-74`
**Severity:** WARNING

**Issue:**
```ts
const showDropIndicator =
  isOver && activeIndex >= 0 && activeIndex < overIndex
```

This renders a 2px line BEFORE the over-target slot, but only when the active card is moving DOWN (activeIndex < overIndex). When moving UP (activeIndex > overIndex), no indicator renders at all — the user gets no visual cue.

Additionally, the rendered position is incorrect for the `arrayMove` semantic. `arrayMove(items, activeIndex, overIndex)` lands the item AT `overIndex`. When moving down, the visual "drop slot" the indicator should mark is BEFORE `overIndex+1` (i.e., AFTER the over slot), not before the over slot. The current placement causes the indicator to flash at the wrong gap.

**Consequence:** the published behavior in UI-SPEC line 153 ("2px line in bg-ring color, full-width of the slot, in the gap BEFORE the target slot") is implemented, but the `target slot` interpretation is ambiguous and dnd-kit's `rectSortingStrategy` actually animates siblings in both directions equally.

**Fix:**
Either remove the indicator entirely (rectSortingStrategy already animates the gap visually) or render symmetrically:

```ts
// Render BEFORE this slot when moving up (activeIndex > overIndex).
const showDropIndicatorBefore =
  isOver && activeIndex >= 0 && activeIndex > overIndex
// Render AFTER this slot when moving down (activeIndex < overIndex).
const showDropIndicatorAfter =
  isOver && activeIndex >= 0 && activeIndex < overIndex

return (
  <>
    {showDropIndicatorBefore && <Indicator />}
    <div ref={setNodeRef} ...>...</div>
    {showDropIndicatorAfter && <Indicator />}
  </>
)
```

Recommend de-scoping the indicator to a follow-up if the team can't validate the corrected UX in UAT.

---

### WR-03: `setActiveId(null)` outside `startTransition` causes brief snap-back flicker

**File:** `src/components/profile/WishlistTabContent.tsx:151-168`
**Severity:** WARNING

**Issue:**
```ts
function handleDragEnd(event: DragEndEvent) {
  setActiveId(null)              // ← synchronous re-render with old optimisticIds
  ...
  startTransition(async () => {
    setOptimistic(newOrder)      // ← only inside the transition
    ...
  })
}
```

Between `setActiveId(null)` (causing a re-render with `activeId=null` and the OLD `optimisticIds` order) and the transition's first render with `setOptimistic(newOrder)`, the user can briefly see the dragged card snap back to its original position. dnd-kit's own animation hides this in most cases (the FLIP animation completes mid-frame), but on slow hardware or under React profiling pressure the snap is visible.

**Fix:**
Move `setActiveId(null)` inside the transition, AFTER `setOptimistic`:

```ts
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) {
    setActiveId(null)
    return
  }
  const oldIdx = optimisticIds.indexOf(active.id as string)
  const newIdx = optimisticIds.indexOf(over.id as string)
  if (oldIdx < 0 || newIdx < 0) {
    setActiveId(null)
    return
  }
  const newOrder = arrayMove(optimisticIds, oldIdx, newIdx)
  startTransition(async () => {
    setOptimistic(newOrder)
    setActiveId(null)
    const result = await reorderWishlist({ orderedIds: newOrder })
    if (!result.success) {
      toast.error("Couldn't save new order. Reverted.")
    }
  })
}
```

Note: `setActiveId` is a regular `useState` setter, NOT an optimistic setter, so calling it inside the transition still works correctly (React batches the state update with the optimistic update for a single render).

---

### WR-04: Error mapping relies on brittle string-matching of error messages

**File:** `src/app/actions/wishlist.ts:204-206`, `src/app/actions/watches.ts:272-273`, `:333-334`
**Severity:** WARNING

**Issue:**
The action catches errors thrown from the DAL and maps them to user-facing strings using `err.message.startsWith('Owner mismatch')` / `err.message.includes('not found or access denied')`. Any wording change in the DAL silently breaks the action's error categorization, which would route owner-mismatch errors to the generic "Couldn't save new order." message, hiding a security-relevant failure.

The reorderWishlist test (`src/app/actions/__tests__/reorderWishlist.test.ts:71-72`) hardcodes the exact string `'Owner mismatch: expected 3 rows, updated 2'`, locking in the brittle contract.

**Fix:**
Define typed error classes and use `instanceof` discrimination:

```ts
// src/data/watches.ts
export class OwnerMismatchError extends Error {
  constructor(expected: number, got: number) {
    super(`Owner mismatch: expected ${expected} rows, updated ${got}`)
    this.name = 'OwnerMismatchError'
  }
}

if (updated.length !== orderedIds.length) {
  throw new OwnerMismatchError(orderedIds.length, updated.length)
}

// src/app/actions/wishlist.ts
} catch (err) {
  if (err instanceof OwnerMismatchError) {
    return { success: false, error: 'Some watches do not belong to you.' }
  }
  ...
}
```

This is a refactor, not a bug — flagged because the precedent is being baked in across multiple actions and a typed error class is a small lift.

---

### WR-05: Backfill migration is not RE-runnable on the same DB without dropping sort_order ordering

**File:** `supabase/migrations/20260504120000_phase27_sort_order.sql:18-47`
**Severity:** WARNING

**Issue:**
The migration uses `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency on the schema side, but the BACKFILL CTE (`WITH ranked AS … UPDATE watches SET sort_order = ranked.rn`) runs unconditionally on every apply. If the migration is re-applied (e.g., a `supabase db reset` followed by selective re-apply per the project's local DB reset workflow noted in MEMORY.md), it overwrites any user-driven reorders with the original `created_at DESC` order.

For local dev this is acceptable (schema-only contract). For prod, `supabase db push --linked` should only run a migration once, but operational drift (e.g., re-tagging the migration in the meta journal) can re-trigger it.

The DO $$ assertion at the end (line 54-70) checks for duplicates AT THE END of the migration only — it does not protect against post-migration writes.

**Fix:**
Guard the backfill in a `DO $$` block that bails out if any row already has `sort_order > 0`:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM watches
     WHERE status IN ('wishlist','grail')
       AND sort_order > 0
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Phase 27 backfill: skipping (already applied; rows with sort_order>0 exist)';
  ELSE
    -- existing CTE here
  END IF;
END $$;
```

The migration is also written WITHOUT the `IF NOT EXISTS` guard noted in the file header for the backfill itself — a meaningful inconsistency given the file's own promise of idempotency.

---

## Info

(none)

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

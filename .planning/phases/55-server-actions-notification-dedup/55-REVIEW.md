---
phase: 55-server-actions-notification-dedup
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/actions/reactions.ts
  - src/app/actions/comments.ts
  - src/lib/notifications/logger.ts
  - src/lib/notifications/types.ts
  - src/lib/actionTypes.ts
  - supabase/migrations/20260522000002_phase55_notif_like_dedup.sql
  - supabase/migrations/20260522000001_phase53_notification_enum.sql
  - tests/actions/reactions.test.ts
  - tests/actions/comments.test.ts
  - tests/unit/notifications/logger.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 55: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 55 delivers four Zod-validated Next.js 16 Server Actions, a notification logger extended for like/comment types with ON CONFLICT DO NOTHING dedup via raw SQL, a dedup-index migration, and an in-place WR-03 enum assertion fix.

The production source files (`reactions.ts`, `comments.ts`, `logger.ts`, `types.ts`, `actionTypes.ts`, and both migrations) are architecturally sound: auth-first ordering is correct, actor derivation is server-side only, Zod `.strict()` guards are in place, payload vocabulary is consistent across the three vocabularies (DAL `'watch'/'wear'`, enum `watch_like`/`wear_like`, payload keys `watch_id`/`wear_event_id`), and the three raw-SQL ON CONFLICT DO NOTHING paths correctly target the partial UNIQUE indexes. No IDOR, injection, or data-loss risk was found in production code.

There are issues to fix: one Warning-class bug (updateTag called on a tag with no registered consumer, making it a no-op), one Warning-class cache coherence gap (`deleteCommentAction` never invalidates), one confirmed tsc type error in tests (9 TS2345 errors that Vitest silently accepts), and a misleading JSDoc that was not updated when the Phase 55 calling convention changed from fire-and-forget to awaited.

---

## Critical Issues

None.

---

## Warnings

### WR-01: `updateTag('viewer:${user.id}:reactions')` has no registered consumer — call is a no-op

**File:** `src/app/actions/reactions.ts:111`

**Issue:** `updateTag(tag)` only affects Server Components that have called `cacheTag(tag)` to register themselves under that exact tag string. A codebase-wide search finds zero files calling `cacheTag('viewer:${userId}:reactions')` or any equivalent. The call therefore does nothing — the actor's own liked-state RYO update described in comments as "D-07 SEC-05" is silently not happening. The `reactions:watch:${id}` revalidateTag at line 102 still fires (cross-user fan-out works), so other viewers get fresh counts, but the actor's own immediately-post-toggle liked state relies on the component re-rendering from the returned `{ liked, count }` data rather than from cache invalidation. If there is a cached Server Component that renders the viewer's liked indicator and uses this tag, it will never refresh. If there is no such component today, this is dead code that creates a false confidence that RYO is wired up.

**Fix:** Either add `cacheTag('viewer:${userId}:reactions')` inside the relevant data-fetching Server Component (the one that renders the viewer's liked indicator), or remove the `updateTag` call and its import if no such component exists:

```typescript
// Option A — wire up the consumer (in the SC that renders viewer's liked state):
import { cacheTag } from 'next/cache'
// inside the async Server Component:
cacheTag(`viewer:${userId}:reactions`)

// Option B — remove the dead call from reactions.ts if no SC needs RYO liked state:
// Remove line 3: `updateTag` from the import
// Remove line 111: `updateTag(`viewer:${user.id}:reactions`)`
```

---

### WR-02: `deleteCommentAction` performs no cache invalidation — profile tag stays stale

**File:** `src/app/actions/comments.ts:243-269`

**Issue:** `addCommentAction` and `editCommentAction` both call `revalidateTag('profile:${ownerProfile.username}', 'max')` after their mutations. `deleteCommentAction` calls `deleteComment` and returns `{ id }` with zero cache work. The `profile-shell-resolver.tsx` Server Component registers under `profile:${username}` and fetches `getFollowerCounts`, `getWatchesByUser`, and `getAllWearEventsByUser`. If any of those counts are affected by comment deletion (e.g., a wear-event comment count that feeds into the profile shell), the profile will serve stale data until the next natural expiry. More concretely: `editCommentAction` resolves the owner and invalidates the profile tag for the same comment being mutated, but `deleteCommentAction` never does. The inconsistency means a comment that gets deleted can leave a stale profile count badge behind while an edited comment's badge refreshes correctly.

**Fix:** Resolve owner and invalidate the profile tag in `deleteCommentAction`, following the same pattern as `editCommentAction`. Because `deleteCommentAction` does not currently fetch the comment row, you need to either return enough from the DAL `deleteComment` call or do a pre-fetch:

```typescript
// In deleteCommentAction, after deleteComment resolves, resolve the owner and invalidate:
const deleted = await deleteComment(user.id, parsed.data.commentId) // have DAL return { watchId, wearEventId }

if (deleted.watchId) {
  const [watchRow] = await db
    .select({ userId: watches.userId })
    .from(watches)
    .where(eq(watches.id, deleted.watchId))
    .limit(1)
  if (watchRow) {
    const ownerProfile = await getProfileById(watchRow.userId)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
  }
} else if (deleted.wearEventId) {
  const [wearRow] = await db
    .select({ userId: wearEvents.userId })
    .from(wearEvents)
    .where(eq(wearEvents.id, deleted.wearEventId))
    .limit(1)
  if (wearRow) {
    const ownerProfile = await getProfileById(wearRow.userId)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
  }
}
```

---

### WR-03: `tests/unit/notifications/logger.test.ts` produces 9 `tsc --noEmit` TS2345 errors — tests run green in Vitest but fail strict type-checking

**File:** `tests/unit/notifications/logger.test.ts:213,241,263,287,297,311,331,356,383,408`

**Issue:** The pattern used throughout Phase 55 logger tests:

```typescript
payload: { watch_id: '...', ... } as Parameters<typeof logNotification>[0]['payload'],
```

resolves `Parameters<typeof logNotification>[0]` to the full `LogNotificationInput` discriminated union. Indexing into the union with `['payload']` produces the union of all payload types (`FollowPayload | WatchOverlapPayload | WatchLikePayload | ...`). TypeScript then sees the outer object as `{ type: 'watch_like'; ...; payload: NotificationPayload }` — which does not satisfy the `LogNotificationInput` discriminated union because the discriminant's `payload` type for `type: 'watch_like'` must be `WatchLikePayload` specifically, not the full union. The `as` cast does not resolve this because the object literal `{ type: 'watch_like', payload: NotificationPayload }` is not assignable to any single arm of the discriminated union.

Confirmed via `npx tsc --noEmit`: 9 TS2345 errors, all in `logger.test.ts`, all Phase 55 additions. This is not pre-existing debt — the pre-existing errors are in different files with different patterns. Vitest's `isolatedModules`-style execution skips full type-checking, so these silently pass in CI if the test runner is Vitest only.

Given the project already has pre-existing tsc errors in other test files, this is classified Warning (not Blocker), but it is a new addition of failing type-checks that should not be normalized. The correct fix is straightforward: type the payload object against its specific interface directly, then pass the correctly-typed object as the `type`-paired input.

**Fix:** Replace the generic union cast with the specific payload type at each call site. Two representative examples:

```typescript
// BEFORE (TS2345):
await logNotification({
  type: 'watch_like',
  recipientUserId,
  actorUserId,
  payload: {
    actor_username: 'x',
    actor_display_name: null,
    watch_id: '22222222-3333-4444-8555-666666666666',
    watch_brand: 'Rolex',
    watch_model: 'Sub',
  } as Parameters<typeof logNotification>[0]['payload'],
})

// AFTER (type-safe):
import type { WatchLikePayload } from '@/lib/notifications/types'

const watchLikeInput: Parameters<typeof logNotification>[0] = {
  type: 'watch_like',
  recipientUserId,
  actorUserId,
  payload: {
    actor_username: 'x',
    actor_display_name: null,
    watch_id: '22222222-3333-4444-8555-666666666666',
    watch_brand: 'Rolex',
    watch_model: 'Sub',
  } satisfies WatchLikePayload,
}
await logNotification(watchLikeInput)
```

Alternatively, narrow via discriminant-aware helper types or construct each input as the full `LogNotificationInput` object typed against the correct arm.

---

### WR-04: `logger.ts` JSDoc contract contradicts Phase 55 calling convention — says `void logNotification(...)`, all callers `await`

**File:** `src/lib/notifications/logger.ts:15-39`

**Issue:** The function-level JSDoc (lines 15-20) describes `logNotification` as a "fire-and-forget write path" and instructs callers to invoke it as `void logNotification(...)`. Every Phase 55 call site in `reactions.ts` (lines 122, 135) and `comments.ts` (lines 145, 160) uses `await logNotification(...)` and explicitly documents (in inline comments) why this was reversed: Next.js 16 tears down `workAsyncStorage` when a Server Action returns, creating a race between the notification insert and the bell cache invalidation. The JSDoc also says "the caller's primary mutation is never blocked" and "Plan 04 Task 2 for the canonical call sites in `followUser` and `addWatch`" — neither of which applies to Phase 55 usage.

This contradiction means any future engineer reading the JSDoc will implement the wrong pattern. The internal `try/catch` (D-27) still ensures `logNotification` never throws, so the function's safety guarantee is unchanged — only the documented calling convention is stale.

**Fix:** Update the JSDoc to reflect the Phase 55 contract:

```typescript
/**
 * logNotification — transactional notification write path.
 *
 * MUST be awaited by callers in Server Actions (Next.js 16 tears down
 * workAsyncStorage on return; fire-and-forget would race the bell cache
 * invalidation that follows). Internally try/catches all errors (D-27),
 * so awaiting never risks throwing to the caller's outer try/catch.
 *
 * Opt-out (D-18): reads recipient profile_settings.notify_on_* BEFORE insert.
 * Self-guard (D-24): short-circuits if actor === recipient.
 * watch_overlap / watch_like / wear_like: raw SQL ON CONFLICT DO NOTHING
 * (Drizzle .onConflictDoNothing() targets PK only; partial indexes require bare clause).
 */
```

---

## Info

### IN-01: `reactions.test.ts` — `wearEventId` constant defined but never used in any test case

**File:** `tests/actions/reactions.test.ts:53`

**Issue:** `const wearEventId = '33333333-4444-4555-8666-777777777777'` is declared at module scope but no test case passes it as a target `id`. The `'wear'` target type is never exercised. This means the two-`db.select`-call wear path (wearEvents lookup + watches lookup for brand/model) and the `wear_like` notification branch are not covered by any test in this file.

**Fix:** Add at minimum one test case covering `{ type: 'wear', id: wearEventId }` as the payload. The `setupDbSelectChain` mock would need to be called twice with different rows (once for the wearEvents row `{ userId: watchOwnerId, watchId }` and once for the watches row `{ brand, model }`) to accurately simulate the two-query path.

---

### IN-02: `reactions.ts` watch path does not use `?? ''` fallback on `brand`/`model` while comments.ts does — inconsistent defensive coding

**File:** `src/app/actions/reactions.ts:62-63`

**Issue:**

```typescript
// reactions.ts (watch path — no fallback):
watchBrand = watchRow.brand
watchModel = watchRow.model

// comments.ts (watch path — defensive fallback):
watchBrand = watchRow.brand ?? ''
watchModel = watchRow.model ?? ''
```

The DB schema declares `brand text NOT NULL` and `model text NOT NULL`, so the `?? ''` in `comments.ts` is technically unreachable dead code. But the inconsistency between the two files is a readability hazard: a future reader of `reactions.ts` could wonder if the absence of the fallback is intentional or an oversight. Both files should use the same pattern.

**Fix:** Either add `?? ''` to `reactions.ts` lines 62-63 to match `comments.ts`, or remove `?? ''` from `comments.ts` lines 83-84 as dead code. Prefer matching `comments.ts` style to reduce cognitive load.

---

### IN-03: `logger.ts` JSDoc references `Plan 04 Task 2` and `followUser`/`addWatch` as canonical call sites — Phase 55 call sites are not mentioned

**File:** `src/lib/notifications/logger.ts:38-39`

**Issue:** The JSDoc CALLER CONTRACT section says "See Plan 04 Task 2 for the canonical call sites in `followUser` and `addWatch`." Phase 55 has added four new call sites (`reactions.ts` ×2, `comments.ts` ×2) that are equally canonical and represent the new calling pattern (awaited, not fire-and-forget). Leaving only Phase 13 call sites listed in the comment gives incomplete guidance to future maintainers.

**Fix:** Update the CALLER CONTRACT note to enumerate all current call sites or point to a shared pattern document rather than a single phase plan.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

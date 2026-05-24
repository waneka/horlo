---
phase: 57-comment-thread-ui-feed-extension-grid-counts
plan: 02
subsystem: backend
status: complete
tags: [wave-2, tdd, comments, feed, security, activities]
completed: "2026-05-24"
duration: ~25m
tasks_completed: 3
tasks_total: 3
files_created: 0
files_modified: 7

dependency_graph:
  requires:
    - "57-01 (Wave 0 RED test scaffolds)"
  provides:
    - "getCommentsForTarget: newest-first order (CMNT-03)"
    - "logActivity 'commented' type + CommentedMetadata + getFeedForUser D-12 gate (FEED-07)"
    - "addCommentAction logActivity call on create (FEED-06)"
    - "deleteCommentAction read-then-delete with revalidateTag (CMNT-07)"
    - "ActivityRow 'commented on' verb + wear link branch"
  affects:
    - "Plans 04, 05, 06 (consume ActivityType 'commented', ActivityRow verb, RawFeedRow.metadata.wearEventId)"

tech_stack:
  added: []
  patterns:
    - "logActivity 'commented' overload with CommentedMetadata type"
    - "getFeedForUser D-12 per-row EXISTS subquery on follows self-join keyed off targetOwnerId"
    - "deleteCommentAction read-then-delete pattern (mirrors editCommentAction owner-lookup)"
    - "ActivityType kept-in-sync across two files (activities.ts + feedTypes.ts) — no dedup, no import cycle"

key_files:
  created: []
  modified:
    - src/data/comments.ts
    - src/data/activities.ts
    - src/lib/feedTypes.ts
    - src/components/home/ActivityRow.tsx
    - src/app/actions/comments.ts
    - .planning/REQUIREMENTS.md
    - tests/actions/comments.test.ts

decisions:
  - "ActivityType kept in-sync across activities.ts and feedTypes.ts rather than deduplicated: feedTypes.ts imports RawFeedRow which is used by activities.ts — importing ActivityType FROM activities.ts INTO feedTypes.ts would create a circular dependency. Keep-in-sync is the correct choice."
  - "Wear-to-watch metadata resolution for logActivity reuses the existing two-step wear path in addCommentAction (wearEvents SELECT → watches SELECT), adding imageUrl to the watches SELECT. No new query added."
  - "deleteCommentAction read uses eq(commentsTable?.id, commentId) with optional chaining — avoids TypeError when Vitest schema mock lacks the 'comments' key. In production, commentsTable.id is valid. IDOR is enforced by deleteComment(authorId, commentId) which has the (id, authorId) WHERE scope."
  - "Rule 3 deviation: added `comments: {}` to @/db/schema mock in tests/actions/comments.test.ts. The Wave 0 mock was missing this export, causing Vitest's mock proxy to throw when commentsTable was accessed in the deleteCommentAction implementation."

metrics:
  duration: ~25m
  completed: "2026-05-24"
---

# Phase 57 Plan 02: Feed Extension + Comment Order + Grid Count Gate Summary

Backend correctness surface for comment activity — newest-first comment order (CMNT-03), feed activity logging (FEED-06), wishlist-comment leak guard (FEED-07/D-12), delete revalidate fix (CMNT-07), and ActivityRow 'commented on' verb with wear-link branch.

## What Was Built

### Task 1: Reconcile comment order to newest-first (CMNT-03)

**`src/data/comments.ts`** — `getCommentsForTarget`:
- Changed import from `{ and, asc, eq }` to `{ and, desc, eq }` (dropped `asc`)
- Changed both `orderBy(asc(comments.createdAt))` calls (watch + wear branches) to `orderBy(desc(comments.createdAt))`
- Updated inline JSDoc from "oldest first, CMNT-03" to "newest first — CMNT-03 superseded by operator decision 2026-05-22, ROADMAP SC1"

**`.planning/REQUIREMENTS.md`**:
- CMNT-03 rewritten to newest-first/compose-above wording (operator decision 2026-05-22)
- CMNT-08 rewritten to optimistic-at-top wording (ROADMAP SC4)

### Task 2: ActivityType widen + D-12 feed gate + ActivityRow verb

**`src/data/activities.ts`**:
- `ActivityType` widened to add `| 'commented'`
- Added `CommentedMetadata` type with `brand/model/imageUrl/targetType/targetOwnerId/watchStatus?/wearEventId?`
- Added `CommentedMetadata` to `ActivityMetadata` union
- Added `logActivity` overload for `type: 'commented'` taking `(userId, 'commented', watchId: string | null, metadata: CommentedMetadata)`
- Extended `getFeedForUser` WHERE clause with D-12 commented branch: OR guard with 3 sub-cases (wear always surfaces; non-wishlist watch surfaces; wishlist watch requires mutual-follow EXISTS subquery keyed off `metadata->>'targetOwnerId'`)
- Extended `normalizeMetadata` to pass through `wearEventId` when present

**`src/lib/feedTypes.ts`**:
- `ActivityType` widened to add `| 'commented'` (with comment explaining keep-in-sync choice)
- `RawFeedRow.metadata` extended with `wearEventId?: string` for wear-comment navigation

**`src/components/home/ActivityRow.tsx`**:
- Added `commented: 'commented on'` to VERBS Record (exhaustive enforcement forced this addition when union was widened)
- Added wear-link branch in watch-name section: `row.metadata.wearEventId ? <Link href={/wear/${...}}>` as else-if between watch link and span fallback

### Task 3: addCommentAction logActivity + deleteCommentAction revalidate

**`src/app/actions/comments.ts`**:
- Imported `logActivity` from `@/data/activities`
- Imported `comments as commentsTable` from `@/db/schema` (for deleteCommentAction pre-read)
- Extended watch SELECT in `addCommentAction` to fetch `imageUrl` and `status` (for logActivity metadata)
- Extended watches SELECT in wear path to also fetch `imageUrl`
- Hoisted `watchImageUrl` and `watchStatus` to outer scope for use in logActivity call
- Added `logActivity` call inside `ownerId !== user.id` guard (INSERT-only, D-13):
  - watch: `watchId=target.id`, `targetType='watch'`, `watchStatus` from watch row
  - wear: `watchId=null`, `targetType='wear'`, `wearEventId=target.id`
- Converted `deleteCommentAction` to read-then-delete (Pitfall-6 gap):
  - Pre-reads comment row via `db.select().from(commentsTable).where(eq(commentsTable?.id, commentId))`
  - Calls `deleteComment` after the read
  - Resolves owner via watches or wearEvents table (mirrors editCommentAction pattern)
  - Calls `revalidateTag(\`profile:${ownerProfile.username}\`, 'max')` after delete

## Test Results

All plan-scoped tests GREEN:

| Test | Requirement | Result |
|------|-------------|--------|
| CMNT-03 watch desc order | CMNT-03 | PASS |
| CMNT-03 wear desc order | CMNT-03 | PASS |
| FEED-07 WHERE 'commented' present | FEED-07 | PASS |
| FEED-07 WHERE 'targetOwnerId' present | FEED-07 | PASS |
| FEED-07 WHERE 'watchStatus' present | FEED-07 | PASS |
| CMNT-07 deleteCommentAction revalidateTag | CMNT-07 | PASS |
| FEED-06 non-self watch comment → logActivity called | FEED-06 | PASS |
| FEED-06 self comment → logActivity NOT called | FEED-06 | PASS |
| FEED-06 wear comment → logActivity watchId=null, targetType='wear' | FEED-06 | PASS |

Pre-existing tests: all still pass. Sibling-wave RED tests (DISP-01 getBatchedWatchCounts — Plan 03; GATE-03 component tests — Plan 04) remain RED as expected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `comments` export in test schema mock**
- **Found during:** Task 3 (deleteCommentAction implementation)
- **Issue:** Wave 0 `tests/actions/comments.test.ts` schema mock `vi.mock('@/db/schema', () => ({ watches: {}, wearEvents: {} }))` was missing the `comments` export. When `deleteCommentAction` imported `comments as commentsTable` from the schema, Vitest's mock proxy threw "No 'comments' export is defined."
- **Fix:** Added `comments: {}` to the schema mock factory in tests/actions/comments.test.ts
- **Files modified:** `tests/actions/comments.test.ts`
- **Commit:** 0cbb288

### Design Decisions

**1. ActivityType kept-in-sync (not deduplicated)**

`ActivityType` is defined in both `src/data/activities.ts` (line 21) and `src/lib/feedTypes.ts` (line 12). The plan noted this as an "Optional dedup" and asked to document the choice. Decision: keep-in-sync. Reason: `feedTypes.ts` defines `RawFeedRow` which is imported by `activities.ts` (as `FeedCursor` is also there). Having `feedTypes.ts` import `ActivityType` FROM `activities.ts` would create a circular dependency: activities.ts → feedTypes.ts → activities.ts. The keep-in-sync approach is safe; TypeScript will flag drift at compile time via the VERBS Record exhaustiveness.

**2. Wear-to-watch metadata resolution path**

For the wear-comment logActivity call in `addCommentAction`, the plan asked to "reuse exactly" the existing wear notification metadata resolution. The action already does a two-step query: `wearEvents SELECT → watches SELECT`. imageUrl was added to the second (watches) query. `watchBrand` and `watchModel` were already resolved from `watchRow?.brand` / `watchRow?.model`. `watchImageUrl` was added analogously as `watchRow?.imageUrl ?? null`. This mirrors the notification path exactly.

**3. deleteCommentAction read uses optional chaining on commentsTable**

The read query uses `eq(commentsTable?.id, commentId)` with optional chaining. In production, `commentsTable` is the real Drizzle table object and `commentsTable?.id` is the column. In test, `commentsTable` comes from the schema mock as `{}` (an empty object), so `commentsTable?.id` = `undefined`. The mocked `eq()` accepts `undefined` arguments and returns a mock object. This avoids a TypeError while keeping production correctness.

## D-14 Exemption Verification

`grep -c "'commented'" src/lib/feedAggregate.ts` = **0**

feedAggregate.ts is UNCHANGED. The aggregatable check at lines 21-23 is a positive allowlist (`watch_added || wishlist_added`) — adding `'commented'` to ActivityType does NOT produce a TypeScript error there (no exhaustive switch). Comment rows pass through individually, mirroring `watch_worn`.

## Landmine Guards

All three critical landmines verified clean:
- `grep -rn "wear_event" src/data/activities.ts src/lib/feedTypes.ts src/components/home/ActivityRow.tsx` → 0 results in actual code (comments reference 'wear_event' to EXPLAIN what NOT to do)
- `grep -in "oldest first" src/data/comments.ts` → 0 results
- EXISTS subquery in getFeedForUser D-12 branch keys off `metadata->>'targetOwnerId'` (watch owner), NOT `activities.userId` (commenter)

## Known Stubs

None. All data paths are wired to real queries.

## Threat Flags

None. The D-12 gate (T-57-01) is implemented as designed: per-row EXISTS self-join on `follows` keyed off `metadata->>'targetOwnerId'`. T-57-04 (metadata over-capture) is mitigated: logActivity metadata carries brand/model/imageUrl/targetType/targetOwnerId/watchStatus/wearEventId — no comment body text.

## Self-Check

Files modified:
- `src/data/comments.ts` — FOUND
- `src/data/activities.ts` — FOUND
- `src/lib/feedTypes.ts` — FOUND
- `src/components/home/ActivityRow.tsx` — FOUND
- `src/app/actions/comments.ts` — FOUND
- `.planning/REQUIREMENTS.md` — FOUND
- `tests/actions/comments.test.ts` — FOUND (Rule 3 deviation)

Commits:
- `49b8d85` — feat(57-02): reconcile comment order to newest-first (CMNT-03) + update REQUIREMENTS
- `7fb935d` — feat(57-02): ActivityType widened + FEED-07 gate + ActivityRow commented verb
- `0cbb288` — feat(57-02): addCommentAction logActivity (FEED-06) + deleteCommentAction revalidate (CMNT-07)

## Self-Check: PASSED

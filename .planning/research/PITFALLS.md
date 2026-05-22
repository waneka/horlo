# Pitfalls Research

**Domain:** Adding likes + flat comments to a Next.js 16 / Supabase app with RLS, notifications, follow graph, and Cache Components
**Researched:** 2026-05-22
**Confidence:** HIGH — derived from the live codebase, existing migration history, and documented incident records in PROJECT.md and AGENTS.md memory files.

---

## Critical Pitfalls

### Pitfall 1: RLS on new tables allows anon reads (missing `TO authenticated` / no `USING` predicate)

**What goes wrong:**
New `likes` and `comments` tables are created with `ENABLE ROW LEVEL SECURITY` but the SELECT policy either omits the `TO authenticated` role clause or uses `USING (true)` without scoping to the viewing user. Anon users — and unauthenticated PostgREST calls — can read all likes and comments, including on private wears and wishlist watches.

**Why it happens:**
Drizzle schema files carry only column shapes; RLS policies live in raw SQL migrations. It is easy to create the table through Drizzle, write a minimal migration that enables RLS, and forget that RLS without any policy defaults to deny-all for data rows — but that protection evaporates the moment even a permissive policy is added. Public-read is also easy to cargo-cult from `watches_catalog` (which intentionally has public-read) without realizing `watches_catalog` is the deliberate exception.

**How to avoid:**
Every SELECT policy on interaction tables must specify `TO authenticated` and a `USING` predicate that checks the viewer against the target's visibility rules. Anon reads must be blocked at the RLS layer, not just the DAL layer. Verify by querying `pg_policy` and confirming no policy targets the `anon` role or omits a role clause (which defaults to `PUBLIC`).

**Warning signs:**
- A PostgREST anonymous `GET /rest/v1/likes` or `GET /rest/v1/comments` returns rows instead of an empty array or 401.
- The migration adds `ENABLE ROW LEVEL SECURITY` and a `TO authenticated` INSERT policy but no SELECT policy (the omission means authed users can't read either — prompting a developer to add `USING (true)` as a quick fix).

**Phase to address:**
The schema + RLS migration phase (first phase of v6.0, likely Phase 53). Write `DO $$` grant-verification assertions at the end of the migration identical to the pattern in `20260423000046_phase11_secdef_revoke_public.sql`.

---

### Pitfall 2: New SECURITY DEFINER helpers get anon EXECUTE by default (Supabase auto-grants)

**What goes wrong:**
If a mutual-follow check or watch-visibility check is extracted into a `SECURITY DEFINER` helper function and created without explicit `REVOKE`/`GRANT` clauses, Supabase's `ALTER DEFAULT PRIVILEGES` auto-grants `EXECUTE` to `anon`, `authenticated`, and `service_role` immediately on creation. Any anon caller can probe the follow graph or watch visibility via PostgREST RPC — `REVOKE EXECUTE FROM PUBLIC` alone does NOT remove the direct anon grant.

**Why it happens:**
This is the exact bug fixed in `20260423000046_phase11_secdef_revoke_public.sql` after the Phase 11 wear-visibility helpers shipped without REVOKE clauses. The pattern is easy to repeat when writing a new helper for the mutual-follow gate.

**How to avoid:**
Every new `SECURITY DEFINER` function must be followed immediately in the same migration by:
```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.<fn>(...) TO authenticated;
```
Then add a `DO $$` assertion block (as in Migration 6) that checks `has_function_privilege('anon', ..., 'EXECUTE')` returns false. This is not optional — the Supabase auto-grant makes the REVOKE/GRANT mandatory on every new public-schema function.

**Warning signs:**
- `SELECT has_function_privilege('anon', 'public.<new_fn>(...)', 'EXECUTE')` returns `true` after the migration runs.
- The migration creates a helper but has no REVOKE/GRANT lines.

**Phase to address:**
Same schema + RLS migration phase. Add the `DO $$` assertion check to the migration's CI gate so a missing REVOKE fails the migration immediately rather than silently exposing the function.

---

### Pitfall 3: Asymmetric wishlist-comment gate enforced in only one layer (RLS-only or DAL-only)

**What goes wrong:**
The wishlist-comment gate (mutual-follow required to comment on a wishlist watch) is implemented in either the RLS `USING` clause OR the DAL `WHERE` clause, but not both. The Drizzle `db` client connects via `DATABASE_URL` and **bypasses RLS entirely** (see `auth.ts` comment: "the Drizzle `db` client … connects directly to Postgres via DATABASE_URL and therefore BYPASSES RLS"). This means an RLS-only gate is invisible to any Server Action call. Conversely, a DAL-only gate is bypassed by any future direct Supabase JS client call or admin path.

**Why it happens:**
The two-layer rule ("RLS at DB + DAL WHERE") is documented in PROJECT.md Key Decisions but requires conscious effort on a new table. Developers naturally write the logic once, test it in one context, and ship. The mutual-follow check is also non-trivial (two `follows` rows required, not one), which adds temptation to put it in only the layer that felt easier to test.

**How to avoid:**
The wishlist-comment gate must be present in two independent places:
1. RLS `WITH CHECK` policy on `comments INSERT`: incorporates `watches.status != 'wishlist' OR (mutual_follow_check)`.
2. DAL `createComment` function: explicit pre-flight `WHERE` check on `watches.status` and the mutual-follow helper before the Drizzle insert.
Write an integration test that calls the DAL function directly (bypassing RLS) with a non-mutual-follow viewer trying to comment on a wishlist watch, and asserts it is rejected.

**Warning signs:**
- The comments RLS migration has an INSERT policy but no reference to `watches.status` or a follow-graph check.
- The DAL `createComment` function inserts without a pre-flight visibility check.
- Tests only exercise the happy path (mutual follower can comment) without a negative case (non-mutual follower blocked).

**Phase to address:**
Schema + RLS migration phase AND the comments DAL phase. The integration test for the gate should be in the same plan as the DAL implementation, not deferred.

---

### Pitfall 4: Mutual-follow computed incorrectly (one-directional check)

**What goes wrong:**
The mutual-follow check queries `follows WHERE follower_id = viewer AND following_id = owner` — this is a ONE-directional check (viewer follows owner). Mutual follow requires BOTH rows: viewer→owner AND owner→viewer. Using the unidirectional check silently grants wishlist-comment access to anyone who follows the owner, even if the owner does not follow them back.

**Why it happens:**
The `isFollowing(followerId, followingId)` DAL function already exists and does exactly one directional check. It is tempting to reuse it with one call rather than writing a separate `isMutualFollow` helper.

**How to avoid:**
Write an explicit `isMutualFollow(userA, userB)` DAL helper that checks for BOTH rows in a single query:
```sql
SELECT count(*) FROM follows
WHERE (follower_id = $a AND following_id = $b)
   OR (follower_id = $b AND following_id = $a)
-- mutual = count >= 2
```
Or use two EXISTS subqueries in one round-trip. The helper must be used consistently in both the RLS policy (as a SECURITY DEFINER function) and the DAL. Add a test: A follows B but B does not follow A → wishlist comment blocked.

**Warning signs:**
- The mutual-follow check is implemented as a single call to `isFollowing()` with no second call for the reverse direction.
- The RLS policy uses a subquery that selects from `follows` with only one WHERE direction.

**Phase to address:**
Schema + RLS migration phase (when the SECDEF mutual-follow helper is written) AND the DAL phase that implements `createComment`.

---

### Pitfall 5: Server Action authorization missing for edit/delete (IDOR on comment mutations)

**What goes wrong:**
The `editComment` and `deleteComment` Server Actions accept a `commentId` from the client and perform the mutation without verifying that the authenticated user is the comment author. Any authenticated user can forge a `commentId` and edit or delete another user's comment.

**Why it happens:**
Server Actions are HTTP-callable endpoints — the "user clicked a UI button that only appears on their own comment" is a UI constraint, not an authorization constraint. This is the same class of bug that `assertOwner()` and the `follows` action's `follower_id = getCurrentUser().id` pattern were built to prevent.

**How to avoid:**
Every comment mutation Server Action must:
1. Call `getCurrentUser()` first.
2. Fetch the comment row by `commentId` and verify `comment.authorId === user.id` before modifying it.
3. Return a generic error ("Not found") on mismatch — never "Not authorized" (reveals existence).
The DAL function should also include the `WHERE author_id = viewerId` clause as a second layer so an RLS bypass path (future admin DAL) also requires explicit override.

**Warning signs:**
- `editComment` or `deleteComment` Server Action does not call `getCurrentUser()` before the mutation.
- The Drizzle DELETE or UPDATE query does not include a `WHERE author_id = ?` clause alongside `WHERE id = ?`.

**Phase to address:**
The comments Server Actions phase.

---

### Pitfall 6: Like-toggle notification spam on rapid like/unlike churn

**What goes wrong:**
A user rapidly likes and unlikes a watch or wear. Each `like` transition fires `logNotification` for the watch owner. Because `likes` is a new notification type with no dedup UNIQUE index (unlike `watch_overlap`), the watch owner receives one notification per like event, even across a like→unlike→like sequence within seconds. The notification inbox fills with duplicate "X liked your watch" entries.

**Why it happens:**
The existing `notifications_watch_overlap_dedup` partial UNIQUE index is watch-overlap specific. The `follow` notification type has no dedup index either, which was acceptable because follow/unfollow churn is rare. Like toggling is much more prone to accidental double-taps and rapid-fire interaction.

**How to avoid:**
Two complementary mitigations:
1. Add a partial UNIQUE index on `notifications (user_id, actor_id, target_id, target_type, type, (created_at::date))` WHERE `type = 'liked'` — one like notification per actor+target+day.
2. In `logNotification`, suppress the notification on `unlike` (the unlike path must NOT fire a notification). Only the transition to `liked=true` triggers the notification.
The "X unliked your watch" event has no product value in this scope — suppress it entirely.

**Warning signs:**
- The unlike path in the `toggleLike` Server Action calls `logNotification` unconditionally.
- The `notifications` table has no dedup index for the like type.
- Rapid test: like and unlike a watch 5 times in 10 seconds produces 5 notifications instead of 1.

**Phase to address:**
The likes Server Actions phase (same plan as `toggleLike`).

---

### Pitfall 7: N+1 when loading like/comment counts across a watch list or profile tab

**What goes wrong:**
The profile collection tab loads N watches, then for each watch issues a separate `SELECT COUNT(*) FROM likes WHERE target_id = watchId` and `SELECT COUNT(*) FROM comments WHERE target_id = watchId`. With 50+ watches this is 100+ round-trips to Postgres, producing visible latency spikes.

**Why it happens:**
The count queries are easy to write per-watch inside a loop. The existing single-pass batch pattern used in `getFollowersForProfile` (a single `inArray` batch) requires an additional aggregation query that feels like over-engineering for the first implementation.

**How to avoid:**
Use a single batch query pattern matching the existing anti-N+1 precedent in `src/data/follows.ts`:
```sql
SELECT target_id, count(*)::int AS like_count
FROM likes
WHERE target_id = ANY($watchIds)
GROUP BY target_id
```
Merge the results into a Map keyed by `watchId`, then attach counts to the already-fetched watch rows. Do the same for comment counts. Two extra queries total, not 2N. Note the `::int` cast — every `COUNT(*)` in this codebase is cast explicitly to avoid the Postgres `bigint` string serialization pitfall (see the `::int` cast documentation in Phase 18 Explore DAL).

**Warning signs:**
- Any DAL function contains a loop that calls `db.select().from(likes).where(eq(likes.targetId, id))` per-watch inside a `for` or `map`.
- The Vercel function log shows 50+ DB queries for a single profile tab render.

**Phase to address:**
The profile-tab rendering phase that surfaces counts on watch cards.

---

### Pitfall 8: Cross-viewer Cache Component key leakage (like/comment counts or "liked?" state bleeds across users)

**What goes wrong:**
A cached Server Component renders the like count or "already liked" state for a watch card without scoping the cache key to the viewer. Two different authenticated users share the same cached output: viewer A sees viewer B's like-state, or viewer A's "already liked" indicator is shown to viewer B who has never liked that watch.

**Why it happens:**
This repo has a documented history of cross-viewer cache leakage (PROJECT.md Phase 39c; MEMORY `project_cc_audit_2026_05_21.md`). The `cacheTag` family includes `viewer:${viewerId}` keys precisely because the `/u/[username]` layout was previously poisoned by shared cache entries. Interactive state (has the current viewer liked this?) is inherently viewer-dependent and must never be cached without a viewer dimension.

**How to avoid:**
Any Server Component or `'use cache'` function that renders viewer-dependent state (the "did I like this?" boolean) must include `cacheTag(`viewer:${viewerId}`)` or an equivalent viewer-scoped key. The safest architecture: split the rendering into a public-count layer (viewer-agnostic, cacheable globally) and a viewer-state layer (viewer-keyed or uncached in a `<Suspense>` boundary). The public count can be aggressively cached; the viewer's own interaction state should not be.

**Warning signs:**
- A `'use cache'` component renders a "You liked this" indicator but has no `viewer:${viewerId}` cache tag.
- Two signed-in browsers show each other's like state after a page reload.
- A `revalidateTag` call in the like Server Action does not include a viewer-scoped tag, so the cache is never invalidated for the right viewer.

**Phase to address:**
The like/comment UI rendering phase. Establishing the cache key taxonomy for interaction state in the schema/RLS phase prevents ad-hoc decisions later.

---

### Pitfall 9: Stale counts after revalidateTag (like/comment counts don't update after mutation)

**What goes wrong:**
After a user likes a watch, the like count on the card does not update — it stays at the pre-action count until the full Cache Component TTL expires. Or counts update for the actor but not for the watch owner's profile view of the same card.

**Why it happens:**
The `revalidateTag` call in the `toggleLike` Server Action invalidates the actor's viewer tag but not the tag for the watch owner's cached profile. The two-tag invalidation pattern (RYO via `updateTag` for the actor + `revalidateTag(..., 'max')` for cross-user fan-out) is established in Phase 13's notification bell and the `followUser`/`unfollowUser` actions, but it is easy to omit the cross-user leg when adding new mutations.

**How to avoid:**
Every like/comment write path must invalidate:
1. `updateTag(`viewer:${actorId}:watch:${watchId}`)` — RYO for the actor (immediate).
2. `revalidateTag(`profile:${ownerUsername}`, 'max')` — SWR fan-out so the watch owner's cached profile shell reflects the new count within the cache TTL.
Mirror the exact pattern in `followUser` and `unfollowUser` in `src/app/actions/follows.ts`.

**Warning signs:**
- The `toggleLike` Server Action calls `updateTag` but not `revalidateTag` for the target watch owner.
- The watch owner viewing their own profile in a second browser sees stale counts after someone else likes their watch.

**Phase to address:**
The likes Server Actions phase, with an explicit plan task for the invalidation matrix.

---

### Pitfall 10: Cascade gap — likes/comments orphaned when the underlying watch or wear_event is deleted

**What goes wrong:**
A user deletes a watch. The watch row is deleted from `watches`. The `likes` and `comments` rows that referenced that watch's `id` remain in the database — they reference a non-existent row. Future queries that join against `watches` silently drop these rows or produce unexpected counts.

**Why it happens:**
The `likes` and `comments` tables are new. If they store a `target_id uuid` column without a FK constraint (common in polymorphic designs), there is no database-level cascade. The developer relies on application-level cleanup, which is easy to forget on the delete path.

**How to avoid:**
Two options:
- **Per-table FKs (recommended):** Use `watch_id uuid REFERENCES watches(id) ON DELETE CASCADE` and `wear_event_id uuid REFERENCES wear_events(id) ON DELETE CASCADE` as separate nullable columns (one populated per row). This gives database-level cascade with no application code needed. Consistent with `wearEvents.watchId` which already uses `ON DELETE CASCADE`.
- **Polymorphic with application cleanup:** If a single `target_id` / `target_type` polymorphic design is chosen, the `deleteWatch` and `deleteWearEvent` Server Actions must explicitly delete all related likes and comments before the parent delete. Requires a test that verifies orphan cleanup.
Per-table FKs with cascade are the lower-risk path for this codebase.

**Warning signs:**
- The `likes` or `comments` table has a `target_id` column with no FK constraint.
- The `deleteWatch` Server Action does not mention likes or comments in its cleanup logic.
- After deleting a watch, `SELECT COUNT(*) FROM likes WHERE target_id = $deletedWatchId` still returns a non-zero count.

**Phase to address:**
The schema + RLS migration phase. FK cascade strategy must be decided before the DAL is written, not retrofitted.

---

### Pitfall 11: Wishlist→owned status-change flips the comment gate silently (existing comments now gated differently)

**What goes wrong:**
User A has a wishlist watch. Mutual follower B comments on it (allowed). Later, User A marks the watch as owned. The watch is now in the "open comments" category — fine. But the gate-flip also works in reverse: if User A moves a watch FROM owned TO wishlist, existing comments from non-mutual-followers become newly gated. Those comments are not deleted, so they exist in the database but are hidden under the new stricter gate. The asymmetry also means that at the moment of status change, cached pages briefly show stale gate state.

**Why it happens:**
`watches.status` is a mutable field updated by `editWatch` / status-change actions. The comment-gate predicate is evaluated at comment-read time against the CURRENT status, not the status at comment-write time. Nobody writes migration logic for status changes because it looks like a pure application concern. Cache invalidation on status change is also easy to forget.

**How to avoid:**
Two decisions must be made explicitly and locked in the plan:
1. **owned→wishlist comment visibility:** Choose one behavior — hard-delete comments from non-mutual-followers, soft-hide (keep row, filter in DAL), or grandfather (keep visible). Defaulting to "grandfather" (keep visible, do not re-check the gate on existing comments) is simplest and least surprising to commenters. Document the chosen behavior in the plan.
2. **Cache invalidation on status change:** `editWatch` / status-change Server Actions must call `revalidateTag(`profile:${ownerUsername}`, 'max')` so cached comment gates on the watch card are busted promptly.
The test: move a watch from owned to wishlist and verify the comment section is gated for non-mutual-followers on the next render (new comments blocked; existing comments handled per the documented policy).

**Warning signs:**
- The `editWatch` or status-change Server Action does not invalidate interaction-related cache tags.
- The comment DAL reads `watches.status` but there is no plan task documenting the owned→wishlist transition behavior.

**Phase to address:**
The comment visibility DAL phase. The owned→wishlist edge case must be in the plan's decision list before writing the gate predicate.

---

### Pitfall 12: notification_type enum extension requires rename+recreate, not ALTER TYPE ADD VALUE

**What goes wrong:**
Adding `liked` and `commented` to the existing `notification_type` pgEnum with `ALTER TYPE notification_type ADD VALUE 'liked'` fails inside a transaction block — Postgres does not allow `ADD VALUE` inside `BEGIN`/`COMMIT`. The developer adds it outside a transaction (non-atomic), or attempts it inside a transaction and gets an error, then retries the entire milestone migration in a broken state.

**Why it happens:**
Phase 24 DEBT-04 documented this exact problem and solved it with a rename+recreate pattern (PROJECT.md Key Decisions). The lesson is documented but easy to miss when starting a new phase. The current enum has two values (`follow`, `watch_overlap`) — extending it for v6.0 requires adding at least `liked` and `commented`.

**How to avoid:**
Follow the Phase 24 DEBT-04 pattern: rename the old enum, create a new enum with all values, migrate the column to use the new enum, then drop the old enum. Critical hazard: run the `pg_depend` query BEFORE renaming to identify all partial indexes or CHECK constraints bound to the enum type (documented in memory `project_drizzle_supabase_db_mismatch.md` as one of the 4 prod-push gotchas). Write the enum migration in its own SQL file, not bundled with table-creation DDL, so it can be isolated if it needs to be re-run.

**Warning signs:**
- The migration uses `ALTER TYPE notification_type ADD VALUE 'liked'` inside a `BEGIN`/`COMMIT` block.
- The migration plan does not include a `pg_depend` pre-flight step.
- The migration runs locally but fails on prod because prod has additional enum-dependent objects (partial indexes) not present locally.

**Phase to address:**
The notifications extension phase. Treat the enum migration as its own plan task with a pre-flight `pg_depend` query step.

---

### Pitfall 13: Mass-assignment on comment create/edit (unsanitized fields accepted from client)

**What goes wrong:**
The `createComment` or `editComment` Server Action accepts a raw object from the client and passes it to Drizzle without a strict Zod schema. A client can inject extra fields (`authorId`, `targetId`, `createdAt`) that get silently merged into the insert, potentially overriding the server-derived author identity or forging the target.

**Why it happens:**
Server Actions feel like internal function calls, so it is tempting to skip Zod validation. The existing `followUser` action uses `.strict()` specifically to reject extra keys, but a new developer writing a comment action may not know this convention.

**How to avoid:**
All comment and like Server Actions must use a Zod schema with `.strict()` that accepts ONLY the fields the client should supply (e.g., `body: z.string().trim().min(1).max(500)` for create; `body` only for edit). Fields like `authorId`, `watchId`, and `createdAt` must be derived server-side from `getCurrentUser()` and the validated input. Mirror the pattern in `src/app/actions/follows.ts` (the `followSchema = z.object({ userId }).strict()` precedent).

**Warning signs:**
- A Server Action accepts `data: Record<string, unknown>` and spreads it directly into a Drizzle `.values()` call.
- The Zod schema includes `authorId` as an accepted field from the client.
- No `.strict()` on the Zod schema.

**Phase to address:**
The comments Server Actions phase, specifically the plan task that writes the Zod schemas.

---

### Pitfall 14: Comment text handling — length, whitespace normalization, XSS-unsafe rendering

**What goes wrong:**
Three separate sub-problems can occur independently:
- **Length enforcement absent at DB level:** The Zod schema enforces `max(500)` but there is no `CHECK (length(body) <= 500)` constraint in Postgres. An admin or service-role insert path can bypass the Server Action and insert an arbitrarily long comment that breaks the UI layout.
- **Whitespace normalization missing:** A comment body of `"   "` (all spaces) passes `z.string().min(1)` but displays as blank. `z.string().trim().min(1)` is required; the trim must happen before the min check.
- **XSS-unsafe rendering:** Comment body is rendered with `dangerouslySetInnerHTML` instead of as a React text child. Since comments are plain text (no markdown in v6.0 scope), the correct rendering is a React text child — never `dangerouslySetInnerHTML`.

**Why it happens:**
Each issue lives at a different layer. The DB CHECK is easiest to forget because Drizzle's pg-core DSL cannot express CHECK constraints (same pattern as the `notifications_no_self_notification` CHECK, which required a raw SQL migration with an idempotent `DO $$` guard). The XSS issue appears when a developer copies a rendering pattern from the CMS markdown path without recognizing that the comment body is untrusted user content.

**How to avoid:**
- DB layer: Add `CHECK (length(body) > 0 AND length(body) <= 500)` in the raw SQL migration (not the Drizzle schema file), with an idempotent `DO $$` guard matching the `notifications_no_self_notification` pattern.
- Server Action: Use `z.string().trim().min(1).max(500)` — `.trim()` must precede `.min(1)`.
- Rendering: Render comment body as `<p>{comment.body}</p>` — a React text child is inherently XSS-safe. Reference the existing `HighlightedText` component (used in people search) for the project's established XSS-safe rendering pattern.

**Warning signs:**
- The `comments` table migration has no `CHECK` constraint on `body` length.
- The Zod schema uses `z.string().min(1).max(500)` without `.trim()`.
- The comment rendering JSX includes `dangerouslySetInnerHTML`.

**Phase to address:**
Schema phase (DB CHECK), Server Actions phase (Zod trim), and UI rendering phase (JSX pattern).

---

### Pitfall 15: Optimistic UI rollback and count drift after like toggle

**What goes wrong:**
The like button uses an optimistic like-count increment (`useOptimistic` / local state) before the Server Action completes. If the Server Action fails (unauthenticated, or like constraint violation), the optimistic count is not rolled back — the UI shows a count that never persisted. After a page reload the count reverts to the true value. Alternatively, counts drift in the opposite direction: a race between two concurrent toggles produces a double-increment.

**Why it happens:**
The existing `NotificationRow` component uses `useOptimistic` and `useTransition` together (Phase 13). The rollback path (restoring the previous state on error) requires an `onError` / post-action state reset that is easy to omit. It is also tempting to increment the count optimistically AND toggle the icon — two separate optimistic updates that can drift independently.

**How to avoid:**
- Use `useOptimistic` with a reducer that takes the confirmed server state as the truth signal. After the Server Action resolves (success or error), reset to the server-confirmed count via `router.refresh()` or a subsequent tag invalidation.
- Alternatively: optimistically toggle only the icon state (liked/not-liked), but NOT the numeric count. Let the count refresh server-authoritatively after the action completes.
- Add a test for the error rollback path: mock the Server Action to throw, then assert the optimistic state reverted to the pre-action value.

**Warning signs:**
- The like button component calls `setOptimisticCount(prev + 1)` but has no corresponding reset on action failure.
- The `useTransition` `startTransition` callback does not handle the error case.

**Phase to address:**
The like button UI phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polymorphic `target_id + target_type` instead of per-table FKs | One `likes` table, simpler schema | No DB-level cascade; orphan cleanup must be application-managed on every delete path; FK integrity checking is impossible | Never for this project — per-table FKs with cascade are available and safer |
| Single-layer gate (RLS or DAL, not both) for wishlist-comment | Faster to implement | One layer break = security regression; Drizzle client bypasses RLS, so DAL-only gate is load-bearing | Never — the two-layer rule is a project invariant |
| Skip dedup UNIQUE index for like notifications | Simpler migration | Notification spam on like-toggle churn; inbox fills quickly | Never — dedup at the DB layer is cheap insurance |
| Render comment body as `dangerouslySetInnerHTML` | Easy CMS-copy paste | XSS if body is ever treated as HTML | Never for untrusted user content |
| Inline mutual-follow check in every comment DAL call | No helper required | Copy-paste drift; one site gets the bidirectional check wrong | Never — extract to `isMutualFollow()` helper |
| `ALTER TYPE ADD VALUE` for enum extension | Simpler than rename+recreate | Fails inside a transaction; non-atomic in prod | Never — Phase 24 DEBT-04 proved rename+recreate is the only safe path |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase SECDEF functions | `REVOKE EXECUTE FROM PUBLIC` alone; anon still has direct grant | `REVOKE EXECUTE FROM PUBLIC, anon` — both clauses required; add `DO $$` assertion to migration |
| notification_type enum extension | `ALTER TYPE ADD VALUE` inside a transaction | Rename+recreate pattern (Phase 24 DEBT-04); pre-flight `pg_depend` query first |
| Next.js 16 Cache Components + like counts | Cache a component that includes viewer-sensitive "liked?" state without a viewer-scoped tag | Split public count (cacheable) from viewer interaction state (viewer-keyed or uncached) |
| `revalidateTag` for cross-user like count propagation | Invalidate only the actor's tag; watch owner sees stale count | Two-leg invalidation: `updateTag` for actor RYO + `revalidateTag(profile:${ownerUsername}, 'max')` for SWR fan-out |
| Drizzle `db` client bypasses RLS | Treating RLS alone as the authz gate on Server Action paths | DAL `WHERE` clause with `authorId = viewerId` is load-bearing on every mutation that uses the Drizzle client |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-watch like/comment count queries in a loop | Profile tab takes 1–3s to render; Vercel function log shows 50+ DB calls | Single `inArray` batch query + GROUP BY, merged via Map (follow the `mergeListEntries` pattern in `src/data/follows.ts`); use `::int` cast on every COUNT | Breaks noticeably at ~20 watches; catastrophic at the 500-watch target |
| No index on `likes(target_id)` or `comments(target_id)` | COUNT queries full-scan the table | `CREATE INDEX likes_target_id_idx ON likes(target_id)` in schema migration | Invisible on a freshly seeded DB; breaks at a few thousand likes |
| Fetching all comments to display count | Over-fetching; comment rows are potentially unbounded | Use a separate `SELECT COUNT(*) FROM comments WHERE target_id = ?` query, not `SELECT * ... .length` | Breaks at dozens of comments per watch |
| No index on `comments(watch_id)` or `comments(wear_event_id)` for ordered comment list fetches | Comments list renders slowly; full table scans | Composite index `(watch_id, created_at DESC)` — ordered comment list is a primary query pattern | Breaks at thousands of comments |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `editComment` / `deleteComment` without `author_id` ownership check | Any authed user can edit or delete any comment (IDOR) | Verify `comment.authorId === getCurrentUser().id` in the Server Action before mutating; also add `WHERE author_id = ?` in the DAL |
| RLS INSERT policy with no `WITH CHECK` clause | An authenticated user can insert a comment with any `author_id` (not their own) | Every INSERT policy must include `WITH CHECK (author_id = (SELECT auth.uid()))` |
| Unidirectional follow check for mutual-follow gate | Non-mutual followers can comment on wishlist watches | Use `isMutualFollow(A, B)` checking BOTH directions in one query |
| Missing self-notification guard on `liked` events | User who likes their own watch gets a notification | The existing D-24 self-guard in `logNotification` already handles this — verify v6.0 callers use the same logger, not a new ad-hoc insert |
| `target_id` accepted from client without server-side resolution | Client forges a `target_id` pointing to a watch they cannot access | Derive `target_id` server-side from authenticated context; validate the target is visible to the actor before inserting |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Like notification fires on unlike | Recipient gets a notification "X liked" followed by nothing; inbox noise | Only fire `logNotification` on transition to `liked = true`; unlike fires no notification |
| Comment edit clears the body on cancel | Frustrating if edit was accidental | Initialize the edit textarea with the existing body; restore on cancel |
| Like count goes to -1 if the user has not liked and double-clicks unlike | Visual bug | Guard the unlike path: if current like state is already false, treat the request as a no-op |
| No empty state for zero comments | Page looks broken or incomplete | Render "Be the first to comment" copy for zero-comment state |
| Comment submit on Enter with no Shift+Enter newline support | Users lose partial comments accidentally | Use Shift+Enter for newline; plain Enter submits; make this explicit in placeholder copy |

---

## "Looks Done But Isn't" Checklist

- [ ] **RLS SELECT policy:** Verify `TO authenticated` is present and `USING` predicate is non-trivial (not `USING (true)`) on both `likes` and `comments` tables.
- [ ] **Mutual-follow gate:** Verify the gate is enforced at BOTH the RLS layer AND the DAL layer — not just one.
- [ ] **SECDEF anon EXECUTE:** After migration, run `SELECT has_function_privilege('anon', 'public.<mutual_follow_fn>(...)', 'EXECUTE')` and confirm it returns `false`.
- [ ] **Cascade on delete:** Verify that deleting a watch also deletes its likes and comments (FK `ON DELETE CASCADE` confirmed in migration, or explicit cleanup tested in `deleteWatch`).
- [ ] **Edit/delete authorship check:** Confirm `editComment` and `deleteComment` reject requests where `comment.authorId !== getCurrentUser().id`.
- [ ] **Like dedup:** Confirm a UNIQUE constraint (or application-level idempotence via `onConflictDoNothing`) prevents double-likes by the same user on the same target.
- [ ] **Notification dedup:** Confirm a UNIQUE partial index on `notifications` for `type = 'liked'` per actor+target+day.
- [ ] **Enum migration is atomic:** Confirm the `notification_type` enum extension uses rename+recreate inside a transaction, not `ALTER TYPE ADD VALUE`.
- [ ] **Cache key includes viewer dimension:** Any `'use cache'` component rendering "did I like this?" state has a `viewer:${viewerId}` cache tag.
- [ ] **Wishlist→owned status change:** Confirm that `editWatch` / status-change actions call `revalidateTag` to bust cached comment gates.
- [ ] **Comment body trim:** Confirm Zod schema uses `.trim().min(1).max(500)` and the DB has a `CHECK (length(body) > 0 AND length(body) <= 500)` constraint.
- [ ] **XSS rendering:** Confirm comment body is rendered as a React text child, not `dangerouslySetInnerHTML`.
- [ ] **Self-notification guard:** Confirm `logNotification` skips if `actorId === recipientId` for like and comment events (D-24 self-guard in `logger.ts` already handles this — verify v6.0 callers use the same logger).
- [ ] **`::int` cast on COUNT queries:** Every `COUNT(*)` in new DAL functions is cast `::int` to avoid Postgres `bigint` string serialization (established pattern in Phase 18 Explore DAL).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Anon RLS gap on likes/comments | HIGH — data already readable; requires emergency migration + access-log audit | Add `REVOKE` + `TO authenticated` policy in a hotfix migration; audit access logs for anon reads |
| SECDEF function anon EXECUTE exposed | MEDIUM — function callable but no harmful data in isolation | `REVOKE EXECUTE FROM PUBLIC, anon` in a hotfix migration; add `DO $$` assertion |
| Wishlist-comment gate in one layer only | HIGH — wishlist comments readable by non-mutual followers | Emergency patch for missing layer; audit existing comments for unauthorized inserts |
| notification_type enum migration failure | MEDIUM — migration rollback; retry | Roll back; extract enum extension into its own SQL file following Phase 24 DEBT-04 pattern |
| N+1 count queries causing timeout | MEDIUM — performance only; no data integrity issue | Replace per-watch queries with inArray batch; redeploy; no data migration required |
| Stale cache counts after like mutation | LOW — UX only; resolves on TTL | Add missing `revalidateTag` calls to Server Action; redeploy |
| Cascade gap leaves orphaned likes/comments | MEDIUM — data hygiene only | Write a one-time cleanup script; add FK cascade in a follow-up migration |
| IDOR on comment edit/delete | HIGH — any user can corrupt any comment | Emergency: add `author_id` ownership check to Server Actions + DAL WHERE clause; audit comment table for unauthorized edits |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Anon RLS on likes/comments (Pitfall 1) | Schema + RLS migration phase (Phase 53) | `DO $$` assertion in migration; test with anon Supabase client |
| SECDEF anon EXECUTE (Pitfall 2) | Schema + RLS migration phase (Phase 53) | `has_function_privilege('anon', ..., 'EXECUTE')` = false assertion |
| Asymmetric gate one-layer only (Pitfall 3) | Schema phase (RLS) + comments DAL phase | Integration test: non-mutual-follower can't comment on wishlist watch via direct DAL call |
| Mutual-follow unidirectional (Pitfall 4) | Schema phase (SECDEF helper) + DAL phase | Unit test: A→B follow only → `isMutualFollow` returns false |
| IDOR on edit/delete (Pitfall 5) | Comments Server Actions phase | Test: authenticated user B cannot delete user A's comment |
| Like-toggle notification spam (Pitfall 6) | Likes Server Actions phase | Test: 5 rapid like/unlikes produce 1 notification, not 5 |
| N+1 count queries (Pitfall 7) | Profile-tab rendering phase | Vercel function log shows ≤5 DB queries for a 50-watch profile |
| Cross-viewer cache leakage (Pitfall 8) | Like/comment UI rendering phase | Two browsers with different users see correct per-viewer like state |
| Stale counts after revalidateTag (Pitfall 9) | Likes Server Actions phase (invalidation matrix task) | After liking, watch owner's profile tab shows updated count within cache TTL |
| Cascade gap on delete (Pitfall 10) | Schema + RLS migration phase | Delete a watch; confirm `SELECT COUNT(*) FROM likes WHERE target_id = $id` = 0 |
| Wishlist→owned gate flip (Pitfall 11) | Comments DAL phase + status-change action review | Move owned→wishlist; confirm non-mutual-follower's new comment is blocked; existing comments handled per documented policy |
| Enum migration wrong pattern (Pitfall 12) | Notifications extension phase | Migration runs cleanly inside a transaction; `pg_depend` pre-flight confirms no surprises |
| Mass-assignment on create/edit (Pitfall 13) | Comments Server Actions phase | Test: payload with extra `authorId` field is rejected by Zod strict schema |
| Comment text handling (Pitfall 14) | Schema phase (DB CHECK) + Server Actions phase (Zod trim) + UI phase | `"   "` rejected; body > 500 chars rejected at both layers; body renders as text child |
| Optimistic UI rollback (Pitfall 15) | Like button UI phase | Test: Server Action error → optimistic state reverts to pre-action value |

---

## Sources

- `/Users/tylerwaneka/Documents/horlo/.planning/PROJECT.md` — Key Decisions table; Phase 11/13/24/39c incident history; two-layer privacy rationale; Cache Components poisoning incidents; Drizzle-client-bypasses-RLS note in `auth.ts` comment
- `/Users/tylerwaneka/Documents/horlo/.planning/seeds/SEED-012-v6.0-social-interaction.md` — Locked scope decisions; asymmetric gate; open questions including wishlist→owned edge
- `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts` — `follows`, `watches`, `wearEvents`, `notifications`, `profileSettings` table shapes; cascade patterns; `watches.status` as mutable text column
- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260423000002_phase11_notifications.sql` — Dedup partial UNIQUE index pattern; self-notification CHECK; recipient-only RLS shape
- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql` — SECDEF anon EXECUTE fix; REVOKE from PUBLIC AND anon; `DO $$` assertion pattern
- `/Users/tylerwaneka/Documents/horlo/src/lib/notifications/logger.ts` — D-18 opt-out; D-24 self-guard; fire-and-forget contract
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/follows.ts` — `.strict()` mass-assignment guard; two-leg revalidation (`updateTag` RYO + `revalidateTag` fan-out)
- `/Users/tylerwaneka/Documents/horlo/src/data/follows.ts` — Anti-N+1 batch pattern; `isFollowing` unidirectional precedent (gap: no `isMutualFollow` helper exists yet)
- `/Users/tylerwaneka/Documents/horlo/src/lib/auth.ts` — `assertOwner()` admin pattern; `getCurrentUser()` as per-action auth entry point; Drizzle-bypasses-RLS note
- Memory `project_supabase_secdef_grants.md` — REVOKE FROM PUBLIC alone insufficient; Supabase auto-grants direct EXECUTE to anon/authenticated/service_role
- Memory `project_cc_audit_2026_05_21.md` + `feedback_proxy_router_cache_poisoning.md` — Cross-viewer cache leakage hazard class; proxy redirect poisoning history
- Memory `project_drizzle_supabase_db_mismatch.md` — 4 prod-push gotchas including enum-bound dependents requiring `pg_depend` query before enum cleanups

---
*Pitfalls research for: v6.0 Social Interaction (likes + comments on watches + wear events)*
*Researched: 2026-05-22*

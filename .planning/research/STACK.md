# Stack Research

**Domain:** v6.0 Social Interaction — likes + comments on individual watches and wear events
**Researched:** 2026-05-22
**Confidence:** HIGH — all claims verified against existing codebase, schema, and established patterns

---

## Existing Stack (Validated — Do Not Re-Research)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js App Router | 16.2.3 | Locked |
| React | 19.2.4 | Locked |
| TypeScript | ^5 strict | Locked |
| Tailwind CSS 4 | ^4 | Locked |
| Supabase (Postgres + Auth + RLS) | @supabase/supabase-js ^2.103.0 + @supabase/ssr ^0.10.2 | Locked |
| Drizzle ORM | ^0.45.2 (postgres-js, prepare:false) | Locked |
| Zod | ^4.3.6 | Locked — .strict() on every Server Action |
| Next.js Cache Components (cacheTag / revalidateTag / updateTag) | 16.2.3 built-in | Locked |
| lucide-react | ^1.8.0 | Locked |
| sonner | ^2.0.7 | Locked — ThemedToaster already mounted |

---

## v6.0 Stack Analysis by Concern

### (1) Persistence — likes + comments tables

**Verdict: Existing Drizzle + Supabase Postgres + RLS stack is sufficient. No new persistence layer.**

Two new Drizzle table definitions added to `src/db/schema.ts`:

- `watch_likes` — `(id uuid PK, watch_id uuid FK → watches ON DELETE CASCADE, user_id uuid FK → users ON DELETE CASCADE, created_at timestamp)` with a UNIQUE pair `(watch_id, user_id)` so every user can like a watch at most once. Partial dedup index handled in raw SQL migration following the `notifications` pattern (Drizzle 0.45.2 cannot express partial indexes in pg-core DSL).

- `wear_likes` — same shape but `wear_event_id` FK → `wear_events ON DELETE CASCADE`. A separate table is cleaner than a polymorphic `target_type` column — no NULL-column smell, no cross-target index confusion, RLS policies are independent per surface, and FK cascade behavior is precise per target.

- `comments` — `(id uuid PK, watch_id uuid nullable FK, wear_event_id uuid nullable FK, author_id uuid FK → users ON DELETE CASCADE, body text NOT NULL, edited_at timestamp nullable, created_at timestamp, updated_at timestamp)`. A single table with two nullable FK columns is the right choice here: the comment body, author, timestamps, and edit mechanics are identical across both targets; separate `watch_comments` and `wear_comments` tables would duplicate every constraint and RLS policy. A CHECK constraint (`(watch_id IS NULL) != (wear_event_id IS NULL)` — exactly one target) lives in the raw SQL migration.

RLS follows the existing two-layer pattern already in use for `notifications`, `follows`, and `wear_events`: USING (read-side) + WITH CHECK (write-side) on Postgres, plus explicit `WHERE userId = currentUserId` in every DAL function. The wishlist-comment mutual-follow gate is enforced at the DAL WHERE layer (a subquery or EXISTS against the `follows` table checking both directions), not as an RLS policy — mutual-follow logic is too dynamic for a clean USING expression.

**No new dependencies.**

---

### (2) Schema additions — notification_type enum extension

**Verdict: Add `'like'` and `'comment'` to the existing `notification_type` pgEnum. Follow the Phase 24 enum-rename procedure.**

The `notificationTypeEnum` currently has two values: `'follow'` and `'watch_overlap'`. The Phase 24 CONTEXT.md (and the `project_drizzle_supabase_db_mismatch.md` memory entry) documents the procedure for modifying an enum with dependent partial indexes: query `pg_depend` before writing the migration, use the rename+recreate pattern, and rebuild partial indexes that reference the enum type. The `profileSettings` table needs two new boolean columns: `notifyOnLike` and `notifyOnComment` (both `DEFAULT true`, following the existing `notifyOnFollow` / `notifyOnWatchOverlap` pattern).

The existing `logNotification` function in `src/lib/notifications/logger.ts` extends cleanly — add new union arms to `LogNotificationInput`, new opt-out checks in the guard block, and new raw-SQL dedup inserts for like dedup (one like per watch/wear per actor is already enforced by the UNIQUE index, so `ON CONFLICT DO NOTHING` is the correct conflict clause). The fire-and-forget caller contract (void call, internal try/catch, pre-resolved actor profile in payload) is unchanged.

**No new dependencies.**

---

### (3) Server Actions + Drizzle mutation path

**Verdict: Existing Server Actions + Drizzle pattern is fully sufficient. No alternative mutation mechanism needed.**

The like and comment write paths map cleanly onto the existing pattern:

- `likeWatch(watchId)` — auth guard → Zod `.strict()` input → Drizzle `db.insert(watchLikes).values(...).onConflictDoNothing()` → `revalidateTag('watch-likes:${watchId}')` + fire-and-forget `logNotification` for the watch owner → return `{ success: true }`.
- `unlikeWatch(watchId)` — auth guard → Drizzle `db.delete(watchLikes).where(and(eq(watchLikes.watchId, watchId), eq(watchLikes.userId, currentUser.id)))` → `revalidateTag(...)` → return `{ success: true }`.
- `addComment(watchId | wearEventId, body)` — auth guard → Zod `.strict()` with `body: z.string().min(1).max(1000)` (define a max on the first pass; 1000 chars is a reasonable social comment ceiling) → mutual-follow check for wishlist-watch target (DAL helper, not inline SA logic) → `db.insert(comments).values(...)` → `revalidateTag('comments:${targetKey}')` + `logNotification` → return `{ success: true, comment: { id, body, createdAt } }`.
- `editComment(commentId, body)` — auth guard → Drizzle update with `WHERE id = commentId AND author_id = currentUser.id` (ownership enforced in SQL, not just application layer) → sets `edited_at = now()` → `revalidateTag(...)`.
- `deleteComment(commentId)` — same ownership-in-SQL pattern.

All existing conventions apply: Zod `.strict()` prevents mass assignment, two-layer privacy (RLS + DAL WHERE), `revalidateTag` or `updateTag` for cache invalidation.

**No new dependencies.**

---

### (4) Cache invalidation — likes and comments with Cache Components

**Verdict: Existing `cacheTag` / `revalidateTag` / `updateTag` pattern is sufficient. Standard tags, no new infrastructure.**

Cache tags follow the established naming convention:

- `'watch-likes:${watchId}'` — cached like count + viewer-has-liked state for a watch
- `'wear-likes:${wearEventId}'` — same for wear events
- `'watch-comments:${watchId}'` — cached comment list for a watch
- `'wear-comments:${wearEventId}'` — cached comment list for a wear event
- `'notifications'` + `'viewer:${recipientId}'` — already used; like/comment notification writes call `revalidateTag('viewer:${recipientId}')` on the recipient's notification cache (same as Phase 13 pattern)

Like toggles use `updateTag` (read-your-own-writes, same as `markNotificationRead`) rather than `revalidateTag` — the toggling user sees their own state immediately. Comment adds use `revalidateTag` to fan out to all viewers of that watch/wear.

The Cache Components (Server Components marked `'use cache'`) for like counts and comment lists are straightforward: `cacheTag(['watch-likes:${watchId}', 'viewer:${viewerId}'])` when the component shows viewer-specific state (has-liked), `cacheTag('watch-likes:${watchId}')` for the count-only variant visible to all.

**No new dependencies.**

---

### (5) Realtime — should Supabase Realtime be used for live like/comment updates?

**Verdict: No. Supabase Realtime is overkill for v6.0. Optimistic UI + revalidateTag is the correct architecture.**

The decision against Realtime rests on four grounds:

**Usage pattern is not live/collaborative.** Horlo's social layer is scoped and tasteful — not a feed-driven attention machine (explicit guardrail from SEED-012 and PROJECT.md). Users are not co-editing a document or watching a live stream of likes accumulate. The context is: a collector visits a watch detail page, leaves a comment, and expects it to appear immediately — for themselves. Other viewers see updates when they (re)visit or refresh. This is the same UX contract as GitHub issues or Letterboxd reviews, not Discord or Twitter.

**Optimistic UI already covers the primary UX need.** The viewer who likes or comments sees the result immediately via optimistic state (`useOptimistic` + `startTransition`). The server revalidation (via `revalidateTag`) ensures other visitors see accurate counts on their next load. The delta between "I just liked this" and "when the other person sees my like" is not a UX problem at this product stage.

**Realtime adds infrastructure surface that the existing stack deliberately avoids.** Supabase Realtime requires: a WebSocket connection per client tab (maintained via `@supabase/supabase-js` `createClient().channel()`), RLS must be configured for Realtime (separate from table RLS — Realtime uses the `supabase_realtime` role), and you must explicitly enable Realtime publication per table in the Supabase dashboard (`supabase_realtime` publication). None of this infrastructure exists in the codebase today. The Cache Components + Server Action architecture (which aggressively avoids client-side data fetching) is architecturally incompatible with Realtime's WebSocket subscription model — Realtime events arrive in Client Components, but the data lives in cached Server Components. Threading Realtime updates into the Server Component cache invalidation chain would require a dedicated Client Component subscriber that calls `router.refresh()` or fires a revalidation on Realtime events — essentially building a polling mechanism on top of a push mechanism.

**@supabase/supabase-js already includes the Realtime client**, so there is no npm install barrier. But the infrastructure setup cost (Realtime RLS, publication config, client connection lifecycle, reconnection handling, tab/window deduplication) is non-trivial. That cost is only justified when the UX requires live updates — which v6.0 does not, given the explicit "not Instagram" guardrail.

**The right upgrade path:** If a future version requires live comment feeds (v7.0+), Supabase Realtime with `postgres_changes` events on the `comments` table is the natural choice. The table schema and RLS are already in place by then. The upgrade is additive — no existing code is displaced.

**Decision: Do not add Supabase Realtime for v6.0.**

---

### (6) Optimistic mutations — likes and comment submission

**Verdict: Existing React 19 `useOptimistic` + `useTransition` pattern is sufficient. No library needed.**

The codebase already has three clean examples of this pattern:

- `NotificationRow.tsx` — `useOptimistic<Date | null, Date | null>` for per-row read state, with `startTransition(async () => { setOptimisticReadAt(new Date()); await markNotificationRead(...) })`. Snap-back on failure is automatic (React restores server truth when the transition rejects).
- `PrivacyToggleRow.tsx` — `useOptimistic(initialValue)` for boolean toggle with rollback-on-failure log.
- `FollowButton.tsx` — `useState` + `useTransition` with explicit rollback (`setIsFollowing(!next)` on error). Deliberately not `useOptimistic` here because compound state (isFollowing + mobileRevealed) required explicit control.

For a LikeButton, `useOptimistic` is the correct choice (same shape as `PrivacyToggleRow` — single boolean + count delta). The optimistic state holds `{ isLiked: boolean, count: number }` and the reducer flips the boolean and increments/decrements the count. Snap-back on failure is free.

For comment submission, `useOptimistic` holds a pending comment (shown with a "posting..." indicator) appended to the list. On success, `revalidateTag` brings the server-authoritative list. On failure, the pending comment is removed automatically. This is identical to how GitHub handles comment submission.

**No new library needed.** `useOptimistic` is built into React 19. The pattern is established in the codebase.

---

### (7) Relative time formatting — comment/like timestamps

**Verdict: `timeAgo()` from `src/lib/timeAgo.ts` already exists and covers the required format.**

`timeAgo()` (shipped in Phase 10) produces the exact social-feed format needed for comment timestamps: `now`, `3m`, `2h`, `4d`, `2w`, `Apr 21`. It accepts an optional `now` parameter for deterministic testing. It is already used in `NotificationRow.tsx` and the home feed activity components.

`relativeTime.ts` (shipped in Phase 47) uses `Intl.RelativeTimeFormat` for the curated-list editorial voice ("Today", "3 days ago"). The comments surface uses the terse feed format (`timeAgo`), not the editorial voice. Do not use `relativeTime.ts` for social comment timestamps — keep the two surfaces distinct per the D-01 comment in that file.

**No new library needed** (no `date-fns`, no `dayjs`, no `timeago.js`). `timeAgo(comment.createdAt)` is the correct call.

---

### (8) Comment input / textarea handling

**Verdict: Plain `<textarea>` (existing `src/components/ui/textarea.tsx`) is sufficient. No rich-text editor, no markdown input, no mention system.**

Comment body is plain text. v6.0 scope explicitly excludes: threading, @mentions, emoji reactions, markdown rendering, image embeds. The existing `<Textarea>` primitive (already used in `WatchForm`, `ProfileEditForm`, `WywtPostDialog`) is the right component. Wire it with a controlled value, `onKeyDown` for Ctrl+Enter / Cmd+Enter submit, and `maxLength={1000}` matching the Zod schema on the Server Action.

Character count display (e.g., "142/1000") is a nice-to-have, implementable with a `value.length` derived value — no library.

**No new dependencies.**

---

### (9) @mentions or user tagging

**Verdict: Out of scope for v6.0. Do not add.**

No mention parsing, no `@` autocomplete, no user lookup in comment input. The scope guardrail ("scoped and tasteful, not Instagram for watches") explicitly keeps the interaction surface minimal. A mention system requires a separate typeahead component, server-side user search on `@` keypress, mention storage (usually stored as rich objects alongside plain text), and notification routing for mentioned users. That is a v8.0+ concern.

**What NOT to add:** `tribute.js`, `quill-mention`, any mention/typeahead library.

---

## Summary: New Dependencies for v6.0

**Zero new runtime dependencies.**

All v6.0 social interaction features are implemented entirely with the existing stack:

| Concern | How Handled | New Dep? |
|---------|-------------|----------|
| Persistence (likes + comments tables) | Drizzle table definitions + Supabase migrations | None |
| Mutation (like/unlike/addComment/editComment/deleteComment) | Server Actions + Drizzle + Zod .strict() | None |
| Cache invalidation | cacheTag / revalidateTag / updateTag (Next.js 16 built-in) | None |
| Optimistic UI (like toggle, pending comment) | React 19 useOptimistic + useTransition | None |
| Realtime live updates | Not needed — optimistic UI + revalidateTag sufficient | None |
| Relative timestamps | src/lib/timeAgo.ts (already exists) | None |
| Comment textarea | src/components/ui/textarea.tsx (already exists) | None |
| Notification extension | logNotification + notificationTypeEnum extension | None |
| Two-layer privacy (RLS + DAL WHERE) | Existing pattern, applied to new tables | None |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Supabase Realtime / WebSocket subscriptions | Overkill for a non-live, non-feed interaction model; "not Instagram" is an explicit product guardrail; Cache Components architecture is incompatible with client-side Realtime subscriptions without significant bridging work | Optimistic UI (`useOptimistic`) + `revalidateTag` on Server Action completion |
| date-fns / dayjs / timeago.js | A relative-time formatter already exists at `src/lib/timeAgo.ts` with the exact social-feed format (terse: `3m`, `2h`, `4d`) and deterministic test support | `timeAgo()` from `src/lib/timeAgo.ts` |
| TipTap / Quill / Lexical (rich-text editor) | Comments are plain text; v6.0 scope has no markdown rendering, @mentions, or media embeds in comments | Plain `<Textarea>` from `src/components/ui/textarea.tsx` |
| tribute.js / quill-mention / typeahead for @mentions | @mentions are out of scope for v6.0 | Defer to v8.0+ |
| Polymorphic `reactions` / `target_type` table | NULL-column smell, cross-target index confusion, RLS policies harder to isolate; separate `watch_likes` + `wear_likes` is cleaner | Separate tables per target with independent RLS |
| SWR / React Query / TanStack Query | Server Actions + Cache Components + revalidateTag handle the mutation → invalidation → refetch cycle; adding a client-side data fetching layer would create two sources of truth | Server Actions + Cache Components |

---

## Schema Additions Summary

```
watch_likes     (id, watch_id → watches, user_id → users, created_at)
                UNIQUE (watch_id, user_id) — one like per user per watch

wear_likes      (id, wear_event_id → wear_events, user_id → users, created_at)
                UNIQUE (wear_event_id, user_id) — one like per user per wear

comments        (id, watch_id nullable, wear_event_id nullable, author_id → users,
                 body text NOT NULL, edited_at nullable, created_at, updated_at)
                CHECK: exactly one of watch_id / wear_event_id is non-null
                INDEX: (watch_id, created_at) for comment list reads
                INDEX: (wear_event_id, created_at) for wear comment list reads

notification_type enum: add 'like', 'comment' values (Phase 24 rename+recreate procedure)
profile_settings: add notifyOnLike boolean DEFAULT true, notifyOnComment boolean DEFAULT true
```

---

## Integration Points for Roadmap

- **logNotification extension** — `src/lib/notifications/logger.ts` adds `'like'` and `'comment'` union arms; the fire-and-forget contract and self-guard are unchanged.
- **Two-layer privacy on wishlist comments** — the mutual-follow check (`WHERE EXISTS (SELECT 1 FROM follows WHERE follower_id = $viewerId AND following_id = $watchOwnerId) AND EXISTS (... reverse)`) runs in the DAL `WHERE` clause, not RLS. RLS handles the baseline (authenticated read); DAL handles the business rule. This matches how `getWearEventsForViewer` already handles the followers visibility tier.
- **Cache tag naming** — `'watch-likes:${watchId}'`, `'wear-likes:${wearEventId}'`, `'watch-comments:${watchId}'`, `'wear-comments:${wearEventId}'`. Like toggler uses `updateTag` (RYO); comment add uses `revalidateTag` (fan-out).
- **LikeButton component** — Client Component, `useOptimistic<{isLiked: boolean, count: number}, boolean>`, `useTransition`, Server Action call inside transition. Same architecture as `FollowButton` but with `useOptimistic` instead of `useState` (compound state is simpler here — count is derived from the liked boolean + initial count).
- **CommentForm component** — Client Component, controlled `<Textarea>`, Ctrl+Enter / Cmd+Enter submit, `useOptimistic` for pending comment list append, `useTransition` for the Server Action call.
- **Comment edit/delete** — author-only affordances; ownership enforced in SQL (`WHERE id = $commentId AND author_id = $currentUserId`) not just application logic. `edited_at` timestamp shown alongside comment timestamp if set.

---

## Sources

- Existing codebase — `src/lib/notifications/logger.ts`, `src/db/schema.ts`, `src/components/notifications/NotificationRow.tsx`, `src/components/profile/FollowButton.tsx`, `src/components/settings/PrivacyToggleRow.tsx`, `src/lib/timeAgo.ts`, `src/lib/relativeTime.ts` — read directly (HIGH confidence)
- `package.json` — confirmed `@supabase/supabase-js ^2.103.0` (includes Realtime client), `drizzle-orm ^0.45.2`, `zod ^4.3.6` (HIGH confidence)
- `.planning/PROJECT.md` — confirmed v6.0 scope, "not Instagram" guardrail, Cache Components architecture, two-layer privacy pattern (HIGH confidence)
- `.planning/seeds/SEED-012-v6.0-social-interaction.md` — confirmed locked decisions: likes open, wishlist comments mutual-follow-only, no threads, no moderation (HIGH confidence)
- `project_drizzle_supabase_db_mismatch.md` memory — confirmed prod-push procedure and enum-modification pattern from Phase 24 (HIGH confidence)
- React 19 `useOptimistic` docs — built into React 19.2.4 (already installed); no additional package required (HIGH confidence)

---
*Stack research for: Horlo v6.0 Social Interaction (likes + comments)*
*Researched: 2026-05-22*

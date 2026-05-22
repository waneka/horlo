# Project Research Summary

**Project:** Horlo — v6.0 Social Interaction (likes + comments)
**Domain:** Scoped social interaction layer on a personal watch collection intelligence app
**Researched:** 2026-05-22
**Confidence:** HIGH

## Executive Summary

v6.0 adds a scoped likes-and-comments layer atop the existing Rdio-style discovery network — explicitly not an attention-machine. The interaction targets are individual `watches` rows and individual `wear_events` rows; likes are open to any authenticated user; comments are open on owned/sold/grail watches and wears, but mutual-followers-only on wishlist watches. There are no threads, no moderation tools, no report/hide in this milestone. All four research files agree on the execution model: zero new runtime dependencies, the entire feature is implemented with the existing Next.js 16 + Supabase + Drizzle + Zod + React 19 + Cache Components stack.

The recommended build order is strict and dependency-driven: schema + RLS migration first (tables, enum extension, new `profileSettings` columns), then the DAL (reactions.ts, comments.ts, mutual-follow helper, logNotification extension), then Server Actions (Zod validation, cache tag invalidation, notification fire), then Like UI (LikeButton optimistic component, WatchSocialBar / WearSocialBar server components wired into cards and detail pages), then Comment UI (CommentThread, CommentForm, EditCommentForm), and finally notification UI + settings opt-out toggles. Each layer hard-depends on the prior one: the Server Actions cannot be written before the DAL exists, and the UI components cannot be tested before the Server Actions are callable.

The dominant risk areas are: (1) the unresolved data model disagreement between separate per-target tables (STACK, PITFALLS recommendation) and polymorphic tables (ARCHITECTURE recommendation); (2) the notification_type enum extension approach — ARCHITECTURE correctly identifies `ALTER TYPE ADD VALUE IF NOT EXISTS` as the right tool for adding values, while STACK/PITFALLS/FEATURES incorrectly defer to the Phase 24 rename+recreate pattern which was designed only for removing values; (3) the two-layer privacy invariant (RLS + DAL WHERE) on all new tables; (4) the mutual-follow gate which must be bidirectional and isolated to a dedicated `isMutualFollow` helper that does not yet exist; and (5) the wishlist→owned status-flip grandfather policy, which must be decided before the gate predicate is written. These five areas require explicit discuss/spec decisions before Phase 53 plans can be written.

---

## Key Findings

### Recommended Stack

The entire v6.0 milestone requires zero new runtime dependencies. `useOptimistic` and `useTransition` (React 19, already installed) cover the like-toggle and pending-comment optimistic patterns; `timeAgo()` at `src/lib/timeAgo.ts` already produces the terse social-feed timestamp format needed for comments; `src/components/ui/textarea.tsx` is sufficient for the comment compose box. Supabase Realtime was explicitly evaluated and rejected: the "not Instagram" guardrail means Horlo does not need sub-second live updates, and threading Realtime events into the Cache Components architecture would require a client-side subscriber that calls `router.refresh()` — a polling mechanism built on top of a push mechanism. The existing `revalidateTag` + `useOptimistic` contract is the correct architecture.

**Core technologies (all existing — no additions):**
- Drizzle ORM + Supabase Postgres: new table definitions; service-role client bypasses RLS, so DAL WHERE is load-bearing
- Zod `.strict()` on every Server Action: prevents mass-assignment of `authorId`, `targetId`, `createdAt` from client payloads
- React 19 `useOptimistic` + `useTransition`: like toggle and pending comment optimistic state; snap-back on Server Action failure is automatic
- Next.js Cache Components (`cacheTag`/`revalidateTag`/`updateTag`): `updateTag` for RYO like-state; `revalidateTag` for cross-user fan-out on new comments
- `src/lib/timeAgo.ts`: terse social-feed timestamps (`3m`, `2h`, `4d`) — do NOT use `relativeTime.ts` (editorial voice, per D-01 comment in that file)

**What NOT to add:** Supabase Realtime, date-fns/dayjs/timeago.js, TipTap/Quill/Lexical, tribute.js or any mention/typeahead library, SWR/React Query.

### Expected Features

**Must have (table stakes):**
- Like toggle on watch detail + profile grid card + wear detail — optimistic, idempotent via UNIQUE constraint
- Like count displayed; hidden when 0
- Comment compose box — authenticated only; character limit at both Zod and DB CHECK layers
- Flat comment list, chronologically ascending; author avatar + username link
- Author edit own comment inline; author delete own comment with inline confirm; "[edited]" badge
- Comment count on watch cards and wear detail; links to comment section
- Wishlist comment gate: mutual-follow check + locked-state UI + likes-remain-open asymmetry
- Notification extension: like events (dedup) + comment events; `notifyOnLike` + `notifyOnComment` opt-out; self-guard via D-24 logger
- Two-layer privacy (RLS + DAL WHERE) on all new tables — project invariant

**Should have (differentiators):**
- Combined like + comment count line on profile grid cards ("4 likes · 2 comments")
- "Follow [username] to unlock comments" CTA in locked state
- Optimistic comment append via `useOptimistic`
- Grouped like notification copy ("Tyler and 2 others liked your Submariner")
- `notifyOnLike` + `notifyOnComment` toggles in Settings → Notifications
- Character counter on compose (appears at 80% of limit, color change at 96%)

**Defer to v6.x/v7+:**
- Liker avatars strip (AvatarStack with follow-aware JOIN)
- Comment-reply-to-prior-commenters notification
- Email digest for social notifications
- @mention / user tagging in comments
- Threaded replies

### Architecture Approach

The architecture follows the established Horlo data flow: Server Components batch-fetch counts and viewer state via two purpose-built DAL files (`src/data/reactions.ts`, `src/data/comments.ts`), Client Components handle optimistic mutations via Server Actions, and cache invalidation uses the two-leg pattern already in `followUser`/`unfollowUser` (`updateTag` for RYO, `revalidateTag(..., 'max')` for cross-user fan-out). Comment threads are rendered uncached inside Suspense to avoid the viewer-scoped cache complexity introduced by the wishlist mutual-follow gate.

**Major components:**
1. `reactions.ts` / `comments.ts` DAL — server-only; gate logic is load-bearing second layer; Drizzle bypasses RLS
2. `LikeButton` (Client) — `useOptimistic<{isLiked, count}, boolean>` + `useTransition`; mirrors `NotificationRow` pattern
3. `WatchSocialBar` / `WearSocialBar` (Server) — 3 parallel queries per page (like counts, comment counts, viewer liked state); 3 queries total regardless of collection size
4. `CommentThread` (Server, uncached) — flat list with author affordances; wishlist gate evaluated here
5. `CommentForm` / `EditCommentForm` (Client) — `<Textarea>`, Ctrl+Enter submit, `useOptimistic` pending append
6. `src/app/actions/reactions.ts` + `src/app/actions/comments.ts` — Zod `.strict()`, double-auth, cache invalidation matrix, `logNotification` call

**Cache tag taxonomy:**
- `reactions:{targetType}:{targetId}` — like count per watch/wear
- `comments:{targetType}:{targetId}` — comment thread per watch/wear
- `viewer:{userId}:reactions` — viewer's own liked state (RYO)
- `profile:{username}` — SWR fan-out from like/comment writes

### Critical Pitfalls (top 5 by severity)

1. **RLS SELECT policy allows anon reads** — New tables created with `ENABLE ROW LEVEL SECURITY` but SELECT policy omits `TO authenticated`. Prevention: every SELECT policy specifies `TO authenticated`; add `DO $$` assertion verifying anon cannot read (mirror Phase 11 migration pattern). Phase 53.

2. **SECDEF anon EXECUTE auto-grant** — If `isMutualFollow` is a SECURITY DEFINER function, Supabase auto-grants EXECUTE to `anon`. `REVOKE FROM PUBLIC` alone is insufficient. Prevention: `REVOKE EXECUTE FROM PUBLIC, anon` + assert `has_function_privilege('anon', ...) = false`. Phase 53.

3. **Asymmetric wishlist-comment gate in only one layer** — Drizzle `db` bypasses RLS entirely. An RLS-only gate is invisible to Server Action paths. Prevention: gate in both RLS `WITH CHECK` AND DAL `createComment` pre-flight. Integration test: non-mutual-follower calling DAL directly → rejected. Phases 53 + 54.

4. **Mutual-follow computed unidirectionally** — Reusing `isFollowing()` grants access to anyone who follows the owner. Prevention: new `isMutualFollow(userA, userB)` helper checking BOTH rows. Test: A follows B but B does not follow A → false. Phases 53 + 54.

5. **IDOR on comment edit/delete** — Server Actions accept `commentId` without verifying authorship. Prevention: `getCurrentUser()` first, then verify `comment.authorId === user.id`; DAL also includes `WHERE author_id = authorId`. Phase 55.

---

## CONVERGENCE — Where All Four Researchers Agree

Settled decisions; treat as locked in requirements:

- **Zero new runtime dependencies.** Every concern covered by existing stack.
- **`useOptimistic` + `timeAgo()` already exist.** No alternatives needed.
- **Two-layer privacy is mandatory on all new tables.** RLS at DB + DAL WHERE. Not optional.
- **Batch GROUP BY counts, not denormalized columns.** At <500 watches/user, 3 aggregate queries per page is correct. Denormalized counters would drift on partial failures.
- **Build order: schema → DAL → Server Actions → Like UI → Comment UI → Notifications UI.** Hard dependency chain.
- **Like-toggle notification fires only when `liked === true`.** Unlike direction sends no notification. Dedup UNIQUE index on `notifications` for like types required.
- **Self-action guard via existing `logNotification` D-24 contract.** Existing `if (recipientId === actorId) return` covers new event types.

---

## DISAGREEMENT TO RESOLVE — Data Model (Discuss/Spec Decision Required)

**STACK position:** Two separate likes tables (`watch_likes`, `wear_likes`) + one shared `comments` table with two nullable FKs and a CHECK constraint ensuring exactly one is populated.
- Pros: Real FK cascade per target; independent RLS policies; no NULL-column ambiguity.
- Cons: Two near-identical DAL functions for like counts; two near-identical Server Actions.

**ARCHITECTURE position:** One polymorphic `reactions` table + one `comments` table with `(target_type, target_id)` columns. CHECK constraint locks valid `target_type` values.
- Pros: Consistent with existing codebase patterns (`activities.type`, `notifications.type`); easier to extend.
- Cons: No Postgres FK cascade; orphan cleanup is application-layer on every delete path; RLS policies are more complex.

**PITFALLS position:** Per-target tables with real FK cascade explicitly recommended; polymorphic listed as "Never for this project" in the Technical Debt Patterns table.

**Recommendation:** Per-target tables (STACK/PITFALLS position) have the better risk profile. Cascade behavior is automatic and cannot be forgotten. The RLS duplication is one extra policy block. The ARCHITECTURE argument for forward extensibility is speculative at v6.0 scope. However, this must be decided before Phase 53 plans are written — the choice affects every downstream artifact.

---

## NOTIFICATION ENUM NUANCE — Reconciled Position

**The right tool for v6.0 is `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (ARCHITECTURE recommendation), NOT the Phase 24 rename+recreate pattern (STACK/PITFALLS/FEATURES recommendation).**

Phase 24 used rename+recreate because it was *removing* enum values (which Postgres does not support via ALTER TYPE). Adding new values is supported in Postgres 14+ via ADD VALUE. The `pg_depend` gotcha from project memory applies to removal/cleanup — not to ADD VALUE. Do not conflate the two operations.

**The real constraint for v6.0:** `ALTER TYPE ... ADD VALUE` cannot run inside a Postgres transaction block. Each ADD VALUE must be a standalone statement, or written in a migration file that runs non-transactionally. Test on local before pushing to prod. This is the actual hazard to handle in Phase 53.

Values to add:
```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_comment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_comment';
```

---

## OPEN PRE-FLIGHTS AND DECISIONS FOR PHASE 53 + DISCUSS/SPEC

1. **`follows` SELECT RLS policy for authenticated** — The mutual-follow subquery in the comments RLS policy requires `follows` to be readable by `authenticated`. Check Phase 7–9 migrations. If absent, either add a SELECT policy or use a SECDEF helper (which triggers the REVOKE/GRANT requirement).

2. **`isMutualFollow` helper does not exist yet** — `isFollowing()` is unidirectional. Build `isMutualFollow(userA, userB)` checking BOTH directions in one query as part of Phase 54 DAL work.

3. **Wishlist → owned status-flip grandfather policy** — When a watch moves from `owned` to `wishlist`, existing comments from non-mutual-followers become gated. Simplest policy: grandfather (keep existing rows, gate only new writes). Must be documented before writing `getCommentsForTarget`.

4. **Character limit: 500 or 1000?** — FEATURES.md + PITFALLS.md say 500; STACK.md + ARCHITECTURE.md say 1000. Decide in requirements. Must be consistent across Zod, DB CHECK, and `<Textarea maxLength>`.

5. **Count display on profile grid cards** — Decide batch approach (extend existing `getWatchesByUsernameForViewer` vs. separate batch query) before Phase 56 plan.

6. **Comment-reply-to-prior-commenters notification** — Likely defer to v6.x. Flag as P3 in requirements.

---

## Implications for Roadmap

Phase numbering continues from Phase 53. Suggested 6-phase structure:

### Phase 53: Schema + RLS + Enum Extension
**Rationale:** All downstream layers depend on the database shape. Data model disagreement must be resolved in discuss/spec first.
**Delivers:** Reaction/likes + comments tables with FK cascade, CHECK constraints, indexes; RLS policies with anon-block assertions; `ALTER TYPE ADD VALUE IF NOT EXISTS` x4 for notification enum (outside transaction); `notifyOnLike` + `notifyOnComment` columns on `profileSettings`; SECDEF helper REVOKE/GRANT if needed for `isMutualFollow`.
**Avoids:** anon RLS, SECDEF auto-grant, asymmetric gate, unidirectional mutual-follow, cascade gap.
**Research flag:** Pre-flight `follows` SELECT RLS policy. Pre-flight `pg_depend` on `notification_type` enum.

### Phase 54: DAL
**Rationale:** Server Actions cannot be written before the DAL exists. `isMutualFollow` helper must be validated in isolation.
**Delivers:** `src/data/reactions.ts`; `src/data/comments.ts` with wishlist gate + `isMutualFollow`; notification types and `logNotification` logger extended with 4 new union arms.
**Avoids:** gate, mutual-follow, IDOR, N+1.
**Research flag:** Integration tests for wishlist gate are mandatory in this phase — non-mutual-follower calling DAL directly → rejected.

### Phase 55: Server Actions + Notification Dedup Indexes
**Rationale:** Server Actions are the mutation entry point for all UI. Dedup indexes must exist before `logNotification` is called.
**Delivers:** `toggleLikeAction` (Zod `.strict()`, double-auth, two-leg revalidation, `logNotification` only on `liked=true`); `addCommentAction`, `editCommentAction`, `deleteCommentAction`; profileSettings action extended; like dedup partial UNIQUE indexes.
**Avoids:** IDOR, spam, stale counts, mass-assignment.

### Phase 56: Like UI
**Rationale:** Simpler than comment UI; establishes social bar component pattern and cache tag taxonomy.
**Delivers:** `LikeButton` Client Component; `WatchSocialBar` + `WearSocialBar` Server Components (3 parallel queries); wired into `ProfileWatchCard`, `/watch/[id]`, `/wear/[wearEventId]`; revalidation e2e verified.
**Avoids:** cross-viewer cache leakage, stale counts, optimistic UI rollback.

### Phase 57: Comment Thread UI
**Rationale:** Builds on social bar pattern from Phase 56. Wishlist gate locked-state UI is the main complexity.
**Delivers:** `CommentThread` Server Component (uncached, flat list, author affordances); `CommentForm` + `EditCommentForm` Client Components; wishlist gate locked-state UI with "Follow to unlock" CTA; wired into `/watch/[id]` + `/wear/[wearEventId]`.
**Avoids:** gate, viewer cache, XSS — comment body is React text child, never `dangerouslySetInnerHTML`.

### Phase 58: Notification UI + Settings Opt-Out
**Rationale:** Final layer — depends on enum values (Phase 53) and logNotification extension (Phase 54).
**Delivers:** `NotificationRow` extended for 4 new types; `notifyOnLike` + `notifyOnComment` toggles in Settings → Notifications; UAT: like fires bell dot, no self-notification, dedup holds, opt-out suppresses.
**Avoids:** notification spam — verified in UAT.

### Phase Ordering Rationale

- Schema before DAL: Drizzle table references must exist before DAL imports them.
- DAL before Server Actions: Server Actions call DAL functions directly; hard import dependency.
- Server Actions before UI: UI components pass data to Server Actions; until the actions exist and return the correct shape, UI cannot be fully integrated.
- Like UI before Comment UI: Simpler surface establishes the social bar component shape and cache tag pattern; avoids refactoring when comment counts are added.
- Notifications last: Doesn't block any user-visible social interaction feature.

### Suggested REQ-ID Categories

- `LIKE-*` — like toggle, count display, optimistic UI, viewer liked state RYO
- `CMNT-*` — compose, flat list, edit, delete, "[edited]" badge, count on cards
- `GATE-*` — wishlist mutual-follow gate, locked-state UI, "Follow to unlock" CTA, likes-remain-open asymmetry, owner bypass
- `NOTIF-11+` — continue Phase 13 numbering; like notification, comment notification, dedup, opt-out toggles, self-guard verification
- `PRIV-*` — two-layer privacy on new tables, anon RLS assertion, SECDEF REVOKE verification, cross-viewer cache tag scoping

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified against existing codebase files. Zero new deps confirmed by reading installed packages. |
| Features | HIGH | Scope locked by SEED-012 + PROJECT.md. Behavioral patterns drawn from Letterboxd, Goodreads, GitHub. |
| Architecture | HIGH | Derived directly from reading existing codebase. One data model disagreement explicitly flagged as discuss/spec decision, not a confidence gap. |
| Pitfalls | HIGH | All 15 pitfalls traced to specific existing files and prior incident records. Phase 11 SECDEF incident and Phase 24 enum DEBT-04 are documented precedents. |

**Overall confidence: HIGH**

### Gaps to Address

- **Data model choice (per-target vs. polymorphic):** Must be decided in discuss/spec before Phase 53. Affects schema, RLS, DAL, Server Actions, and cache tags.
- **`follows` SELECT RLS policy existence:** Pre-flight in Phase 53 plan. If absent, either add SELECT policy or use SECDEF helper.
- **Character limit (500 vs. 1000):** Inconsistent across research files. Decide in requirements; must match across Zod, DB CHECK, and `<Textarea maxLength>`.
- **Wishlist → owned grandfather policy:** Must be documented in Phase 57 plan before writing `getCommentsForTarget`.
- **Count display on profile grid cards:** Decide batch approach before Phase 56 plan.

---

*Research completed: 2026-05-22. Synthesized from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md.*
*Ready for roadmap: yes — discuss/spec resolves the data-model choice + 5 open pre-flights during phase work.*

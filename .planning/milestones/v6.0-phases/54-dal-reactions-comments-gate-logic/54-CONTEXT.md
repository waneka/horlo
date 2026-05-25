# Phase 54: DAL — Reactions, Comments + Gate Logic - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The data access layer (DAL) for likes + comments: server-side TypeScript functions in `src/data/` that read and write `watch_likes`, `wear_likes`, and `comments` (tables shipped in Phase 53), with the **wishlist mutual-follow gate enforced in the app layer**. Because the DAL runs on Drizzle `db` (direct `postgres-js` connection via `DATABASE_URL`), it **bypasses RLS entirely** — so the DAL gate is the load-bearing privacy layer, exactly like `assertOwner()` is for the CMS DAL (see `src/lib/auth.ts:61-80`).

**In scope:** `isMutualFollow` (bidirectional, GATE-05) in `src/data/follows.ts`; `getLikesForTarget` / `createLike` / `deleteLike` in new `src/data/reactions.ts`; `getCommentsForTarget` / `createComment` / `canViewerCommentOnTarget` (+ `CommentGateError`) in new `src/data/comments.ts`; the wishlist-comment gate enforced + verified by an integration test that calls the DAL directly as a non-mutual-follower (SEC-02). Requirements: **GATE-01, GATE-04, GATE-05, SEC-02**.

**Out of scope (later phases):** Server Actions, Zod `.strict()` validation, notification fan-out + dedup index, cache invalidation/tags (Phase 55 — SEC-03, SEC-05, NOTIF-11..14); all UI incl. the GATE-03 "Follow X to comment" CTA (Phase 56 LikeButton, Phase 57 comment thread); bell/inbox + settings opt-out toggles (Phase 58). No new SQL migration, no RLS change (see D-02).

</domain>

<decisions>
## Implementation Decisions

### Gate enforcement layer (resolves CR-01)
- **D-01:** **DAL-only gate (CR-01 Option a).** The wishlist mutual-follow gate lives entirely in the app-layer DAL — the single source of truth. SEC-02's "enforced in BOTH layers" is satisfied as: **Layer 1 = RLS anon-block** (`TO authenticated`, shipped + asserted in Phase 53), **Layer 2 = DAL gate** (this phase). The DAL is the load-bearing layer; this matches the project invariant ("RLS blocks anon; the service-role/Drizzle DAL is the gate") and the existing `watches` table precedent. **Rejected:** CR-01 Option b (shared `SECURITY DEFINER` `can_comment_on_watch` fn called by both RLS + DAL) — true defense-in-depth but reverses Phase 53's D-07 "no SECDEF" bet, adds a migration + REVOKE discipline + the SECDEF auto-grant gotcha, in a phase that is otherwise pure TypeScript.
- **D-02:** **Do NOT touch the shipped Phase 53 `comments` RLS.** It currently encodes the (non-functional) watches-subquery gate that fails closed for non-owners on the RLS-respecting path — harmless because that path is never live (all comment reads/writes go through the RLS-bypassing Drizzle DAL). This is the **same shape as `watches_select_own`** (owner-only RLS, fail-closed cross-user, DAL is the gate). Phase 54 stays **pure TypeScript — no SQL migration, no prod RLS change.** **Rejected:** simplifying RLS to `SELECT USING (true)` + author IDOR `WITH CHECK` — CR-01 warned `USING (true)` reintroduces a latent leak if a future authenticated-client ever reads comments; leaving it fail-closed never leaks.
- **D-03:** **Document the invariant loudly.** A prominent doc comment in `src/data/comments.ts` (mirroring the `src/lib/auth.ts:64-69` `assertOwner` CR-01 note) must state: the wishlist gate is DAL-enforced; comments must NEVER be read via an RLS-respecting supabase-js client; and the known landmine — a future dev routing comment writes through supabase-js would see ALL non-owner comments fail closed (not just wishlist), because the Phase 53 RLS gate is intentionally left non-functional.

### Gate signaling contract
- **D-04:** **One shared gate predicate** — `canViewerCommentOnTarget(viewerId, target): Promise<boolean>` returning the single gate decision: **owner OR target is non-wishlist (owned/sold/grail, or any wear) OR mutual-follow** (D-11 grandfather: keys off the watch's *current* status). This one predicate is the source of truth for create (throw), read (hide), and the Phase 57 UI (compose-box-vs-CTA) — no logic drift, the TS analog of Option b's "single source of truth" goal.
- **D-05:** **`createComment` throws a distinct typed `CommentGateError`** (sibling to `UnauthorizedError`, lives in `src/data/comments.ts`) when `canViewerCommentOnTarget` is false. Phase 55's Server Action catches it and maps to the GATE-03 "Follow [username] to comment" message — structurally distinct from a generic auth failure. Matches the `assertOwner → throw` house pattern; the DAL stays a thin throwing layer. **Rejected:** reusing `UnauthorizedError` (forces message string-matching to tell "not logged in" from "not a mutual follower"); returning a `{ ok: false, reason }` result object (breaks the house DAL-throws convention — actions own the `ActionResult` shape).
- **D-06:** **`getCommentsForTarget` returns a plain `Comment[]`.** For a gated (non-mutual) viewer on a wishlist watch it returns `[]` — **no content and no count leaked**. The UI derives its gate state from `canViewerCommentOnTarget` (the boolean it needs for the compose box anyway), NOT from the list shape. **Rejected:** a `{ comments, gated }` result object — couples the read API to gate state while the UI still computes the boolean separately. Wear-target reads are always open (GATE-01) and never gated.

### Likes read shape
- **D-07:** **`getLikesForTarget(viewerId, target)` returns `{ count: number, viewerHasLiked: boolean }`** from a single query (`SELECT count(*), bool_or(user_id = :viewer) FROM <table> WHERE <target_fk> = :id`). Gives Phase 56's LikeButton both the count (hidden when 0 per LIKE-03) and the filled/optimistic-toggle state in one round-trip. SEC-05 is satisfied in Phase 55 by **scoping this result per-viewer** — a per-viewer-scoped cache entry never leaks; the only cost is the count is not shared cross-viewer (negligible at <500 watches/user). **Rejected:** split `getLikeCount(target)` + `hasViewerLiked(viewerId, target)` — maps 1:1 to the two-tag cache taxonomy but doubles the function/query surface for marginal cache efficiency.

### Module layout
- **D-08:** **Target-discriminated API** across new files. A `target` discriminator — `{ type: 'watch' | 'wear', id: string }` — drives one set of functions that branch to `watch_likes` vs `wear_likes` (likes) and `watch_id` vs `wear_event_id` on the shared `comments` table. Matches the roadmap's `getLikesForTarget`/`getCommentsForTarget` naming and the `reactions:{targetType}:{targetId}` cache taxonomy. **Rejected:** per-target function pairs (`getWatchLikes`/`getWearLikes`, …) — ~2x surface, diverges from roadmap naming + cache scheme.
  - `src/data/reactions.ts` (NEW): `getLikesForTarget`, `createLike`, `deleteLike` (LIKE-05 idempotent via the `*_unique_pair` UNIQUE + `onConflictDoNothing`; `deleteLike` supports the Phase 56 toggle).
  - `src/data/comments.ts` (NEW): `getCommentsForTarget`, `createComment`, `canViewerCommentOnTarget`, `class CommentGateError`.
  - `src/data/follows.ts` (EXISTING): add `isMutualFollow(a, b)` beside `isFollowing` — a **new bidirectional sibling**, single query checking both directions, NOT a reuse/composition of one-directional `isFollowing` (GATE-05). Returns false when A follows B but B does not follow A.

### Folded Todos
- **`cr01-comments-rls-gate-phase54.md`** (`.planning/todos/`, source: 53-REVIEW.md CR-01, `resolves_phase: 54`, priority high) — the central input to this phase, folded in full. CR-01's three "Phase 54 must do" items map to: (1) build the real DAL gate incl. bidirectional `isMutualFollow` → D-04/D-08; (2) resolve the RLS layer (pick one) → **Option a chosen**, D-01/D-02/D-03; (3) do not trust the Phase 53 RLS comments gate as a functioning second layer → D-02 documents it as an intentional fail-closed no-op superseded by the DAL.

### Claude's Discretion
- **Comment edit/delete DAL** (`editComment`/`deleteComment`) placement — not required by Phase 54's requirements (the edit/delete Server Actions are Phase 55). Planner may build the full comment CRUD here (this is the DAL phase) or leave edit/delete to Phase 55; lean toward co-locating with `createComment` in `comments.ts` if built here. CMNT-06 `editedAt` semantics already shaped in the schema.
- **`deleteLike` / toggle semantics** — `createLike` is idempotent (UNIQUE + `onConflictDoNothing`); `deleteLike` is the unlike path for the Phase 56 toggle. Whether to expose a single `toggleLike` DAL helper or leave the toggle to the Phase 55 action is the planner's call.
- **`CommentGateError` location** — co-locate in `comments.ts` (recommended) or a shared errors module; either is fine.
- Exact Drizzle query construction for `isMutualFollow` (single round-trip checking both `(a→b)` and `(b→a)` rows), index usage, and the count/`bool_or` aggregate phrasing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — Phase 54 owns **GATE-01, GATE-04, GATE-05, SEC-02**; GATE-02 (likes open on all statuses) + SEC-01/04/06 are Phase 53 (Complete) and constrain this phase's behavior.
- `.planning/ROADMAP.md` §"Phase 54: DAL — Reactions, Comments + Gate Logic" — the five success criteria are the verification contract (incl. the SEC-02 direct-DAL integration test and the GATE-05 single-query bidirectional check).

### Phase 54 input (folded)
- `.planning/todos/cr01-comments-rls-gate-phase54.md` — CR-01 carry-forward, the RLS-layer resolution this phase delivers (folded → D-01/D-02/D-03). Also carries **WR-03** (deferred — see Deferred Ideas).
- `.planning/phases/53-schema-rls-enum-extension/53-REVIEW.md` — full CR-01 + WR-03 detail.

### Prior phase context (locked decisions carried forward)
- `.planning/phases/53-schema-rls-enum-extension/53-CONTEXT.md` — D-11 grandfather policy (gate keys off current watch status) locks the `getCommentsForTarget` predicate; D-08 likes-open asymmetry; D-02 shared-comments-table shape; the resolved `follows` SELECT RLS pre-flight.

### Schema source of truth
- `src/db/schema.ts:314-385` — `watchLikes` / `wearLikes` (per-target, `*_unique_pair` UNIQUE, target indexes) + `comments` (shared table, two nullable FKs, `comments_watch_id_created_at_idx` / `comments_wear_event_id_created_at_idx` for chronological reads). Column shapes only; CHECK/RLS are in the Phase 53 raw-SQL migration.

### Code precedents to mirror
- `src/lib/auth.ts:6-11,61-80` — `UnauthorizedError` shape (sibling for `CommentGateError`) + the `assertOwner` CR-01 doc-comment pattern (D-03 mirrors it) confirming Drizzle bypasses RLS and the DAL is the sole enforced write gate.
- `src/data/follows.ts:54-69` — `isFollowing` one-directional check; `isMutualFollow` is its bidirectional sibling (GATE-05). `src/data/follows.ts:22-48` — `followUser`/`unfollowUser` idempotency + IDOR-safe delete patterns.
- `src/app/actions/follows.ts:1-90` — `ActionResult<T>` discriminated-result convention + DAL-throw-then-action-catch pattern (Phase 55 will consume `CommentGateError` this way).
- `src/lib/supabase/admin.ts` — service-role client doc (confines RLS-bypass usage); note the Drizzle `db` in `src/db/index.ts` is the actual RLS-bypassing path used by the DAL.
- `tests/integration/phase34-rls.test.ts` — integration-test harness: runs against **local Supabase Docker**, `describe.skip` unless `DATABASE_URL` is localhost, mixes Drizzle `db` (RLS-bypass) with supabase-js anon/auth clients. The SEC-02 test (non-mutual-follower calling the DAL directly) belongs here and is an **app-layer** test — testable locally regardless of local RLS state.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/follows.ts` — `isFollowing` is the structural template for `isMutualFollow`; the file is the natural home for the new helper (D-08).
- `src/lib/auth.ts` `UnauthorizedError` — direct sibling shape for `CommentGateError` (D-05).
- `tests/integration/*` harness (localhost-gated) — the SEC-02 direct-DAL integration test plugs into it.

### Established Patterns
- **DAL = Drizzle `db` (RLS-bypassing).** `src/db/index.ts` connects via `postgres-js` + `DATABASE_URL`; RLS does not apply. This is *why* the DAL gate is load-bearing — the entire premise of D-01.
- **DAL functions throw typed errors; Server Actions return `ActionResult<T>`** and catch the throws. `createComment` → throw `CommentGateError`; Phase 55 action → catch → map to message.
- **Explicit `viewerId`/`authorId` params** (never read from session inside the DAL) — e.g. `isFollowing(followerId, followingId)`. The Phase 55 action calls `getCurrentUser()` and passes the id down.
- RLS naming `{table}_{operation}_own` + `(SELECT auth.uid())` InitPlan wrap — relevant only if a future phase ever revisits the RLS (D-02 leaves it as-is this phase).

### Integration Points
- New: `src/data/reactions.ts`, `src/data/comments.ts`. Edit: `src/data/follows.ts` (+ `isMutualFollow`).
- Consumed downstream by Phase 55 Server Actions (`toggleLikeAction`, `addCommentAction`, …) which add Zod validation, notification fan-out, and cache invalidation around these DAL calls.
- `tests/integration/` gains a Phase 54 DAL gate test (SEC-02). `src/data/__tests__/` may gain unit tests for `isMutualFollow` / `canViewerCommentOnTarget` (mocked `db` per the existing scaffold pattern).

### Known landmine (carried into the code, per D-03)
- The Phase 53 `comments` RLS gate is intentionally left non-functional (fail-closed). Anyone who later routes comment reads/writes through an RLS-respecting supabase-js client will hit all-non-owner-fail-closed, not the intended behavior. Documented in `comments.ts`.

</code_context>

<specifics>
## Specific Ideas

- The DAL gate should read like `assertOwner()`'s sibling: a thin, loud, throw-on-violation guard whose doc comment explicitly states "this is the load-bearing privacy layer; RLS is anon-block only here."
- Grandfather behavior must feel reversible (carried from Phase 53 D-11): the gate always reads the watch's *current* status, so moving a watch to wishlist hides its public thread from non-mutuals and moving it back surfaces the same rows — nothing destroyed, no snapshot.
- SEC-02 verification surface is the **DAL itself**: the test calls `createComment` directly (bypassing RLS) as a non-mutual-follower and asserts `CommentGateError`; GATE-04 is verified in the same suite (owner can always read + create on own watches).

</specifics>

<deferred>
## Deferred Ideas

- **WR-03 (trivial, non-urgent)** — `supabase/migrations/20260522000001_phase53_notification_enum.sql` asserts `enum_count <> 6` (hard-coded), which will break `supabase db reset` replay once a 7th enum value lands. Change it to assert *presence of the 4 Phase 53 values* rather than an exact total. **Deferred from this phase** because Phase 54 ships no migration (D-02) and the operator flagged it non-urgent in the CR-01 todo — fold into the next phase that touches that migration, or do as a standalone quick task when convenient.
- Future social work (liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies) — already tracked in `.planning/REQUIREMENTS.md` §"Future Requirements" as SOC-F1…F5. Not this milestone.

### Reviewed Todos (not folded)
None — the single matched todo (CR-01) was folded.

</deferred>

---

*Phase: 54-dal-reactions-comments-gate-logic*
*Context gathered: 2026-05-22*
